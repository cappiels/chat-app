const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const { 
  authenticateUser, 
  requireWorkspaceMembership, 
  requireWorkspaceAdmin 
} = require('../middleware/auth');
const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Gmail API setup using service account (lazy initialization)
const createGmailService = () => {
  // Check if Gmail credentials exist
  if (!process.env.GMAIL_SERVICE_ACCOUNT_EMAIL || !process.env.GMAIL_PRIVATE_KEY) {
    console.log('📧 Gmail service account credentials not configured - email invitations disabled');
    return null;
  }
  
  try {
    // Safely parse the private key
    let privateKey;
    try {
      privateKey = process.env.GMAIL_PRIVATE_KEY.replace(/\\n/g, '\n');
    } catch (keyError) {
      console.error('📧 Invalid Gmail private key format:', keyError.message);
      return null;
    }

    const auth = new google.auth.JWT(
      process.env.GMAIL_SERVICE_ACCOUNT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/gmail.send'],
      process.env.GMAIL_SERVICE_ACCOUNT_EMAIL
    );

    return google.gmail({ version: 'v1', auth });
  } catch (error) {
    console.error('📧 Failed to create Gmail service:', error.message);
    return null;
  }
};

// Send email using Gmail API
const sendGmailInvitation = async (toEmail, subject, htmlContent) => {
  const gmail = createGmailService();
  if (!gmail) {
    console.log('📧 Gmail service not available');
    return false;
  }

  try {
    const message = [
      `To: ${toEmail}`,
      `From: ${process.env.GMAIL_SERVICE_ACCOUNT_EMAIL}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlContent
    ].join('\n');

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    return true;
  } catch (error) {
    console.error('📧 Failed to send Gmail:', error);
    return false;
  }
};

/**
 * GET /api/workspaces
 * Get all workspaces for current user
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const workspacesQuery = `
      SELECT 
        w.id,
        w.name,
        w.description,
        w.created_at,
        w.settings,
        wm.role,
        wm.joined_at,
        u.display_name as owner_name,
        u.profile_picture_url as owner_avatar,
        (
          SELECT COUNT(*) 
          FROM workspace_members wm2 
          WHERE wm2.workspace_id = w.id
        ) as member_count,
        (
          SELECT COUNT(*) 
          FROM threads t 
          WHERE t.workspace_id = w.id
        ) as channel_count,
        (
          SELECT COUNT(*) 
          FROM messages m 
          JOIN threads t ON m.thread_id = t.id 
          WHERE t.workspace_id = w.id 
          AND m.created_at >= NOW() - INTERVAL '24 hours'
        ) as recent_message_count
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      JOIN users u ON w.owner_user_id = u.id
      WHERE wm.user_id = $1
      ORDER BY wm.joined_at DESC;
    `;

    const result = await pool.query(workspacesQuery, [userId]);

    res.json({
      workspaces: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve workspaces' 
    });
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

    // Send invitation email using Gmail API
    try {
      const workspace = workspaceInfo.rows[0];
      const inviteUrl = `${process.env.FRONTEND_URL}/invite/${inviteToken}`;

      const subject = `You're invited to join ${workspace.name}`;
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🎉 You're invited to join ${workspace.name}!</h2>
          <p>Hi there!</p>
          <p><strong>${req.user.display_name}</strong> has invited you to join <strong>${workspace.name}</strong> on our chat platform.</p>
          ${workspace.description ? `<p><em>"${workspace.description}"</em></p>` : ''}
          <div style="margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days. If you're having trouble with the button above, 
            copy and paste this link into your browser: <br>
            <a href="${inviteUrl}">${inviteUrl}</a>
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            This invitation was sent to ${email}. If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      `;

      const emailSent = await sendGmailInvitation(email, subject, htmlContent);
      
      if (emailSent) {
        console.log(`📧 Gmail invitation sent to ${email} for workspace ${workspace.name}`);
      } else {
        console.log(`📧 Gmail not configured - invitation saved but no email sent to ${email}`);
      }

    } catch (emailError) {
      console.error('Failed to send Gmail invitation:', emailError);
      // Don't fail the whole request if email fails
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
  } catch (error) {
    console.error('Error creating invitations table:', error);
  }
};

// Initialize invitations table
createInvitationsTable();

// Mount thread routes as sub-routes
const threadRoutes = require('./threads');
router.use('/:workspaceId/threads', threadRoutes);

module.exports = router;
