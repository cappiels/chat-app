const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { 
  authenticateUser, 
  requireWorkspaceMembership, 
  requireWorkspaceAdmin 
} = require('../middleware/auth');
const emailService = require('../services/emailService');
const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Email functionality temporarily disabled to fix core workspaces
const logInvitation = (email, workspace, inviteUrl, inviterName) => {
  console.log(`📧 Invitation created for ${email} to join ${workspace.name}`);
  console.log(`📧 Invitation URL: ${inviteUrl}`);
  console.log(`📧 Invited by: ${inviterName}`);
  console.log('📧 Email sending temporarily disabled - invitation saved to database');
};

// Mount thread routes as sub-routes FIRST
const threadRoutes = require('./threads');
router.use('/:workspaceId/threads', threadRoutes);

/**
 * GET /api/workspaces
 * Get all workspaces for current user
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Simplified, fast query - get basic workspace data first
    const basicWorkspacesQuery = `
      SELECT 
        w.id,
        w.name,
        w.description,
        w.created_at,
        w.settings,
        wm.role,
        wm.joined_at,
        u.display_name as owner_name,
        u.profile_picture_url as owner_avatar
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      JOIN users u ON w.owner_user_id = u.id
      WHERE wm.user_id = $1
      ORDER BY wm.joined_at DESC;
    `;

    // Add timeout to prevent hanging queries
    const queryPromise = pool.query(basicWorkspacesQuery, [userId]);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);

    // Get basic member counts efficiently (optional for better UX)
    const memberCountsQuery = `
      SELECT workspace_id, COUNT(*) as member_count
      FROM workspace_members 
      WHERE workspace_id = ANY($1::uuid[])
      GROUP BY workspace_id;
    `;
    
    const workspaceIds = result.rows.map(w => w.id);
    let memberCounts = {};
    
    if (workspaceIds.length > 0) {
      try {
        const countResult = await Promise.race([
          pool.query(memberCountsQuery, [workspaceIds]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Count timeout')), 2000))
        ]);
        
        countResult.rows.forEach(row => {
          memberCounts[row.workspace_id] = parseInt(row.member_count);
        });
      } catch (countError) {
        console.warn('Member count query failed, using defaults:', countError.message);
        // Use default counts if query fails
      }
    }

    // Enhance workspace data with counts (use defaults if query failed)
    const enhancedWorkspaces = result.rows.map(workspace => ({
      ...workspace,
      member_count: memberCounts[workspace.id] || 1,
      channel_count: 1, // Default - avoid expensive query
      recent_message_count: 0 // Default - avoid expensive query
    }));

    res.json({
      workspaces: enhancedWorkspaces,
      count: enhancedWorkspaces.length
    });

  } catch (error) {
    console.error('Get workspaces error:', error);
    
    // Provide more specific error handling
    if (error.message === 'Database query timeout') {
      res.status(504).json({ 
        error: 'Request Timeout', 
        message: 'Database query is taking too long. Please try again.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Server Error', 
        message: 'Unable to retrieve workspaces' 
      });
    }
  }
});

/**
 * POST /api/workspaces
 * Create new workspace
 */
router.post('/', authenticateUser, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, description = null } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || name.length < 1 || name.length > 255) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Workspace name must be between 1 and 255 characters' 
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Description cannot exceed 1000 characters' 
      });
    }

    await client.query('BEGIN');

    // Create workspace
    const workspaceQuery = `
      INSERT INTO workspaces (name, description, owner_user_id, settings)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const defaultSettings = {
      allow_public_channels: true,
      allow_private_channels: true,
      max_file_size_mb: 25,
      retention_days: null, // null = forever
      created_at: new Date().toISOString()
    };

    const workspaceResult = await client.query(workspaceQuery, [
      name, 
      description, 
      userId,
      JSON.stringify(defaultSettings)
    ]);

    const workspace = workspaceResult.rows[0];

    // Add creator as admin member
    await client.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, 'admin');
    `, [workspace.id, userId]);

    // Create default "general" channel
    const generalChannelQuery = `
      INSERT INTO threads (workspace_id, name, type, description, is_private, created_by)
      VALUES ($1, 'general', 'channel', 'General discussion channel', false, $2)
      RETURNING *;
    `;

    const channelResult = await client.query(generalChannelQuery, [workspace.id, userId]);
    const generalChannel = channelResult.rows[0];

    // Add creator to general channel
    await client.query(`
      INSERT INTO thread_members (thread_id, user_id)
      VALUES ($1, $2);
    `, [generalChannel.id, userId]);

    await client.query('COMMIT');

    // Log workspace creation for billing/analytics
    console.log(`🏢 Workspace created: ${workspace.name} (${workspace.id}) by ${req.user.email}`);

    res.status(201).json({
      message: 'Workspace created successfully',
      workspace: {
        ...workspace,
        role: 'admin',
        member_count: 1,
        channel_count: 1,
        default_channel: generalChannel
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create workspace error:', error);
    
    if (error.code === '23505') { // Duplicate key
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'A similar workspace already exists' 
      });
    }
    
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to create workspace' 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/workspaces/:workspaceId
 * Get workspace details
 */
router.get('/:workspaceId', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspaceQuery = `
      SELECT 
        w.*,
        u.display_name as owner_name,
        u.email as owner_email,
        u.profile_picture_url as owner_avatar,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', wm.user_id,
              'email', um.email,
              'display_name', um.display_name,
              'profile_picture_url', um.profile_picture_url,
              'role', wm.role,
              'joined_at', wm.joined_at,
              'last_login', um.last_login
            )
            ORDER BY wm.role DESC, wm.joined_at ASC
          )
          FROM workspace_members wm
          JOIN users um ON wm.user_id = um.id
          WHERE wm.workspace_id = w.id
        ) as members,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', t.id,
              'name', t.name,
              'type', t.type,
              'description', t.description,
              'is_private', t.is_private,
              'created_at', t.created_at,
              'member_count', (
                SELECT COUNT(*) 
                FROM thread_members tm 
                WHERE tm.thread_id = t.id
              )
            )
            ORDER BY 
              CASE WHEN t.name = 'general' THEN 0 ELSE 1 END,
              t.created_at ASC
          )
          FROM threads t
          WHERE t.workspace_id = w.id
        ) as channels
      FROM workspaces w
      JOIN users u ON w.owner_user_id = u.id
      WHERE w.id = $1;
    `;

    const result = await pool.query(workspaceQuery, [workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Workspace Not Found', 
        message: 'Workspace not found' 
      });
    }

    const workspace = result.rows[0];
    
    res.json({
      workspace: {
        ...workspace,
        user_role: req.userWorkspaceRole,
        member_count: workspace.members?.length || 0,
        channel_count: workspace.channels?.length || 0
      }
    });

  } catch (error) {
    console.error('Get workspace details error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve workspace details' 
    });
  }
});

/**
 * PUT /api/workspaces/:workspaceId
 * Update workspace settings (admin only)
 */
router.put('/:workspaceId', authenticateUser, requireWorkspaceMembership, requireWorkspaceAdmin, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { name, description, settings } = req.body;

    // Validation
    if (name && (name.length < 1 || name.length > 255)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Workspace name must be between 1 and 255 characters' 
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Description cannot exceed 1000 characters' 
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (settings !== undefined) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'No valid fields provided for update' 
      });
    }

    // Add updated timestamp and workspace ID
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(workspaceId);

    const updateQuery = `
      UPDATE workspaces 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      message: 'Workspace updated successfully',
      workspace: result.rows[0]
    });

  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to update workspace' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/invite
 * Invite user to workspace via email
 */
router.post('/:workspaceId/invite', authenticateUser, requireWorkspaceMembership, requireWorkspaceAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { email, role = 'member' } = req.body;

    // Validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Valid email address is required' 
      });
    }

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Role must be either "admin" or "member"' 
      });
    }

    await client.query('BEGIN');

    // Check if user already exists
    const existingUserQuery = `
      SELECT id, email, display_name 
      FROM users 
      WHERE email = $1 AND is_active = true;
    `;
    const existingUser = await client.query(existingUserQuery, [email]);

    // Check if already a member
    if (existingUser.rows.length > 0) {
      const membershipCheck = await client.query(`
        SELECT role FROM workspace_members 
        WHERE workspace_id = $1 AND user_id = $2;
      `, [workspaceId, existingUser.rows[0].id]);

      if (membershipCheck.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Already Member', 
          message: 'User is already a member of this workspace' 
        });
      }
    }

    // Create invitation token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store invitation
    const inviteQuery = `
      INSERT INTO workspace_invitations (
        workspace_id, 
        invited_email, 
        invited_by, 
        role, 
        token, 
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const inviteResult = await client.query(inviteQuery, [
      workspaceId,
      email,
      req.user.id,
      role,
      inviteToken,
      expiresAt
    ]);

    // Get workspace info for email
    const workspaceInfo = await client.query(`
      SELECT name, description FROM workspaces WHERE id = $1;
    `, [workspaceId]);

    await client.query('COMMIT');

    // Send professional email invitation
    const workspace = workspaceInfo.rows[0];
    const inviteUrl = `${process.env.FRONTEND_URL}/#/invite/${inviteToken}`;
    
    // Get member count for email
    const memberCountResult = await client.query(`
      SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = $1;
    `, [workspaceId]);
    
    try {
      await emailService.sendWorkspaceInvitation({
        to: email,
        workspaceName: workspace.name,
        workspaceDescription: workspace.description,
        inviterName: req.user.display_name,
        inviterEmail: req.user.email,
        inviteUrl,
        userRole: role,
        memberCount: memberCountResult.rows[0].count,
        expiryDate: expiresAt
      });
      
      console.log(`📧 Invitation email sent to ${email} for workspace ${workspace.name}`);
    } catch (emailError) {
      console.error('Email sending failed, but invitation saved:', emailError.message);
      // Don't fail the invitation if email fails - user can still use direct link
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: inviteResult.rows[0].id,
        email,
        role,
        expires_at: expiresAt,
        workspace_name: workspaceInfo.rows[0].name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send invitation error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to send invitation' 
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/workspaces/accept-invite/:token
 * Accept workspace invitation
 */
router.post('/accept-invite/:token', authenticateUser, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { token } = req.params;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Find valid invitation
    const inviteQuery = `
      SELECT wi.*, w.name as workspace_name, u.display_name as inviter_name
      FROM workspace_invitations wi
      JOIN workspaces w ON wi.workspace_id = w.id
      JOIN users u ON wi.invited_by = u.id
      WHERE wi.token = $1 
      AND wi.expires_at > NOW() 
      AND wi.accepted_at IS NULL;
    `;

    const inviteResult = await client.query(inviteQuery, [token]);

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Invalid Invitation', 
        message: 'Invitation not found or has expired' 
      });
    }

    const invitation = inviteResult.rows[0];

    // Check if user's email matches invitation
    if (req.user.email !== invitation.invited_email) {
      return res.status(403).json({ 
        error: 'Email Mismatch', 
        message: 'This invitation was sent to a different email address' 
      });
    }

    // Check if already a member
    const membershipCheck = await client.query(`
      SELECT role FROM workspace_members 
      WHERE workspace_id = $1 AND user_id = $2;
    `, [invitation.workspace_id, userId]);

    if (membershipCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Already Member', 
        message: 'You are already a member of this workspace' 
      });
    }

    // Add user to workspace
    await client.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, $3);
    `, [invitation.workspace_id, userId, invitation.role]);

    // Add user to general channel automatically
    const generalChannelQuery = `
      SELECT id FROM threads 
      WHERE workspace_id = $1 AND name = 'general' AND type = 'channel'
      LIMIT 1;
    `;
    const generalChannel = await client.query(generalChannelQuery, [invitation.workspace_id]);
    
    if (generalChannel.rows.length > 0) {
      await client.query(`
        INSERT INTO thread_members (thread_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [generalChannel.rows[0].id, userId]);
    }

    // Mark invitation as accepted
    await client.query(`
      UPDATE workspace_invitations 
      SET accepted_at = NOW(), accepted_by = $1
      WHERE token = $2;
    `, [userId, token]);

    // Create notification for inviter
    await client.query(`
      INSERT INTO notifications (
        user_id, 
        workspace_id, 
        type, 
        title, 
        message, 
        data
      )
      VALUES ($1, $2, 'invite_accepted', $3, $4, $5);
    `, [
      invitation.invited_by,
      invitation.workspace_id,
      '🎉 Invitation Accepted',
      `${req.user.display_name} joined ${invitation.workspace_name}`,
      JSON.stringify({
        new_member_id: userId,
        new_member_name: req.user.display_name,
        new_member_email: req.user.email,
        workspace_id: invitation.workspace_id,
        workspace_name: invitation.workspace_name,
        role: invitation.role
      })
    ]);

    await client.query('COMMIT');

    // Send email notification to inviter
    try {
      // Get inviter details and total member count
      const inviterResult = await pool.query('SELECT email FROM users WHERE id = $1', [invitation.invited_by]);
      const memberCountResult = await pool.query(`
        SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = $1;
      `, [invitation.workspace_id]);

      if (inviterResult.rows.length > 0) {
        await emailService.sendMemberJoinedNotification({
          to: inviterResult.rows[0].email,
          workspaceName: invitation.workspace_name,
          newMemberName: req.user.display_name,
          newMemberEmail: req.user.email,
          memberRole: invitation.role,
          workspaceUrl: `${process.env.FRONTEND_URL}/workspace/${invitation.workspace_id}`,
          totalMembers: memberCountResult.rows[0].count
        });
        
        console.log(`📧 Member joined notification sent to ${inviterResult.rows[0].email}`);
      }
    } catch (emailError) {
      console.error('Failed to send member joined email notification:', emailError.message);
      // Don't fail the join process if email fails
    }

    // Log successful join
    console.log(`👥 User ${req.user.email} joined workspace ${invitation.workspace_name} via invitation`);

    res.json({
      message: 'Successfully joined workspace',
      workspace: {
        id: invitation.workspace_id,
        name: invitation.workspace_name,
        role: invitation.role
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept invitation error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to accept invitation' 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/workspaces/notifications
 * Get notifications for current user
 */
router.get('/notifications', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, unread_only = false } = req.query;

    let notificationsQuery = `
      SELECT n.*, w.name as workspace_name
      FROM notifications n
      LEFT JOIN workspaces w ON n.workspace_id = w.id
      WHERE n.user_id = $1
    `;

    const params = [userId];

    if (unread_only === 'true') {
      notificationsQuery += ` AND n.is_read = false`;
    }

    notificationsQuery += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(notificationsQuery, params);

    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(unreadResult.rows[0].unread_count),
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve notifications' 
    });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId
 * Delete or archive workspace (owner only)
 */
router.delete('/:workspaceId', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { archive = false } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Check if user is the workspace owner
    const ownerCheck = await client.query(`
      SELECT owner_user_id, name FROM workspaces WHERE id = $1;
    `, [workspaceId]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Workspace Not Found', 
        message: 'Workspace not found' 
      });
    }

    const workspace = ownerCheck.rows[0];
    if (workspace.owner_user_id !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Only the workspace owner can delete this workspace' 
      });
    }

    if (archive) {
      // Archive workspace - add archived flag and timestamp
      await client.query(`
        UPDATE workspaces 
        SET settings = COALESCE(settings, '{}') || '{"archived": true, "archived_at": $2}'::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [workspaceId, new Date().toISOString()]);

      console.log(`🗄️ Workspace archived: ${workspace.name} (${workspaceId}) by ${req.user.email}`);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workspace archived successfully',
        action: 'archived'
      });
    } else {
      // Permanently delete workspace and all related data
      // Note: Foreign key cascades will handle related data deletion
      await client.query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);

      console.log(`🗑️ Workspace permanently deleted: ${workspace.name} (${workspaceId}) by ${req.user.email}`);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workspace permanently deleted',
        action: 'deleted'
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete workspace error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to delete workspace' 
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/members/:userId
 * Remove member from workspace (admin only)
 */
router.delete('/:workspaceId/members/:userId', authenticateUser, requireWorkspaceMembership, requireWorkspaceAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId, userId: targetUserId } = req.params;
    const requesterId = req.user.id;

    await client.query('BEGIN');

    // Prevent self-removal
    if (requesterId === targetUserId) {
      return res.status(400).json({ 
        error: 'Invalid Operation', 
        message: 'You cannot remove yourself from the workspace' 
      });
    }

    // Check if target user is a member
    const memberCheck = await client.query(`
      SELECT wm.role, u.display_name, u.email 
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1 AND wm.user_id = $2;
    `, [workspaceId, targetUserId]);

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Member Not Found', 
        message: 'User is not a member of this workspace' 
      });
    }

    const member = memberCheck.rows[0];

    // Check if trying to remove workspace owner
    const ownerCheck = await client.query(`
      SELECT owner_user_id FROM workspaces WHERE id = $1;
    `, [workspaceId]);

    if (ownerCheck.rows[0]?.owner_user_id === targetUserId) {
      return res.status(400).json({ 
        error: 'Invalid Operation', 
        message: 'Cannot remove the workspace owner. Transfer ownership first or delete the workspace.' 
      });
    }

    // Remove user from all workspace threads
    await client.query(`
      DELETE FROM thread_members 
      WHERE user_id = $1 
      AND thread_id IN (
        SELECT id FROM threads WHERE workspace_id = $2
      );
    `, [targetUserId, workspaceId]);

    // Remove user from workspace
    await client.query(`
      DELETE FROM workspace_members 
      WHERE workspace_id = $1 AND user_id = $2;
    `, [workspaceId, targetUserId]);

    // Get workspace name for logging
    const workspaceInfo = await client.query(`
      SELECT name FROM workspaces WHERE id = $1;
    `, [workspaceId]);

    // Create notification for removed user (if they want to know)
    await client.query(`
      INSERT INTO notifications (
        user_id, 
        workspace_id, 
        type, 
        title, 
        message, 
        data
      )
      VALUES ($1, $2, 'member_removed', $3, $4, $5);
    `, [
      targetUserId,
      workspaceId,
      'Removed from Workspace',
      `You have been removed from ${workspaceInfo.rows[0].name}`,
      JSON.stringify({
        workspace_id: workspaceId,
        workspace_name: workspaceInfo.rows[0].name,
        removed_by: req.user.display_name,
        removed_at: new Date().toISOString()
      })
    ]);

    await client.query('COMMIT');

    console.log(`👥 User ${member.email} removed from workspace ${workspaceInfo.rows[0].name} by ${req.user.email}`);

    res.json({
      message: 'Member removed successfully',
      removed_member: {
        id: targetUserId,
        display_name: member.display_name,
        email: member.email,
        role: member.role
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Remove member error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to remove member' 
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/workspaces/notifications/:notificationId/read
 * Mark notification as read
 */
router.put('/notifications/:notificationId/read', authenticateUser, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `, [notificationId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: 'Notification not found' 
      });
    }

    res.json({
      message: 'Notification marked as read',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to mark notification as read' 
    });
  }
});

// Create workspace_invitations table if it doesn't exist
const createInvitationsTable = async () => {
  try {
    // First, add missing columns to workspaces table
    await pool.query(`
      ALTER TABLE workspaces 
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
    `);

    // Create invitations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        invited_email VARCHAR(255) NOT NULL,
        invited_by VARCHAR(128) NOT NULL REFERENCES users(id),
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        token VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        accepted_at TIMESTAMP WITH TIME ZONE,
        accepted_by VARCHAR(128) REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations (token);
      CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations (invited_email);
      CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations (workspace_id);
    `);

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP WITH TIME ZONE
      );
      
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications (workspace_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read) WHERE is_read = false;
    `);
  } catch (error) {
    console.error('Error creating invitations table:', error);
  }
};

// Initialize invitations table
createInvitationsTable();

module.exports = router;
