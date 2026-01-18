const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { createPool } = require('../config/database');

const pool = createPool();

// Site admin email
const SITE_ADMIN_EMAIL = 'cappiels@gmail.com';

// Middleware to check if user is site admin
const requireSiteAdmin = (req, res, next) => {
  if (req.user?.email !== SITE_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Site admin access required' });
  }
  next();
};

// Apply authentication and admin check to all routes
router.use(authenticateUser);
router.use(requireSiteAdmin);

// GET /api/admin/workspaces - Get all workspaces with owner and subscription data
router.get('/workspaces', async (req, res) => {
  try {
    const query = `
      SELECT 
        w.id,
        w.name,
        w.description,
        w.created_at,
        w.owner_user_id,
        u.display_name as owner_name,
        u.email as owner_email,
        COUNT(DISTINCT wm.user_id) as member_count,
        COALESCE(sp.name, 'free') as owner_subscription_plan,
        COALESCE(sp.display_name, 'Free Plan') as owner_subscription_display_name,
        us.status as owner_subscription_status,
        us.current_period_end as owner_subscription_expires
      FROM workspaces w
      LEFT JOIN users u ON w.owner_user_id = u.id
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status IN ('trialing', 'active')
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      GROUP BY w.id, w.name, w.description, w.created_at, w.owner_user_id, 
               u.display_name, u.email, sp.name, sp.display_name, us.status, us.current_period_end
      ORDER BY w.created_at DESC
    `;

    const result = await pool.query(query);
    
    const workspaces = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      owner: {
        user_id: row.owner_user_id,
        name: row.owner_name,
        email: row.owner_email,
        subscription: {
          plan: row.owner_subscription_plan,
          display_name: row.owner_subscription_display_name,
          status: row.owner_subscription_status,
          expires: row.owner_subscription_expires
        }
      },
      member_count: parseInt(row.member_count) || 0
    }));

    res.json({ workspaces });
  } catch (error) {
    console.error('Error fetching admin workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/admin/users - Get all users with subscription and workspace stats
router.get('/users', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.profile_picture_url,
        u.created_at as joined_date,
        u.last_login,
        u.is_active,
        COALESCE(sp.name, 'free') as subscription_plan,
        COALESCE(sp.display_name, 'Free Plan') as subscription_display_name,
        us.status as subscription_status,
        us.current_period_end as subscription_expires,
        COUNT(DISTINCT w_owned.id) as workspaces_owned,
        COUNT(DISTINCT wm.workspace_id) as workspaces_member_of
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status IN ('trialing', 'active')
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN workspaces w_owned ON u.id = w_owned.owner_user_id
      LEFT JOIN workspace_members wm ON u.id = wm.user_id
      GROUP BY u.id, u.email, u.display_name, u.profile_picture_url, u.created_at,
               u.last_login, u.is_active, sp.name, sp.display_name, us.status, us.current_period_end
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);
    
    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      profile_picture_url: row.profile_picture_url,
      joined_date: row.joined_date,
      last_login: row.last_login,
      is_active: row.is_active,
      subscription: {
        plan: row.subscription_plan,
        display_name: row.subscription_display_name,
        status: row.subscription_status,
        expires: row.subscription_expires
      },
      workspaces_owned: parseInt(row.workspaces_owned) || 0,
      workspaces_member_of: parseInt(row.workspaces_member_of) || 0
    }));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/stats - Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const queries = await Promise.all([
      // Total users
      pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      
      // Users by subscription plan
      pool.query(`
        SELECT 
          COALESCE(sp.name, 'free') as plan,
          COALESCE(sp.display_name, 'Free Plan') as display_name,
          COUNT(*) as count
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id 
          AND us.status IN ('trialing', 'active')
        LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE u.is_active = true
        GROUP BY sp.name, sp.display_name
        ORDER BY COUNT(*) DESC
      `),
      
      // Total workspaces
      pool.query('SELECT COUNT(*) as count FROM workspaces'),
      
      // Recent activity (users who logged in within last 7 days)
      pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE last_login > NOW() - INTERVAL '7 days' AND is_active = true
      `)
    ]);

    const stats = {
      total_users: parseInt(queries[0].rows[0].count),
      subscription_breakdown: queries[1].rows,
      total_workspaces: parseInt(queries[2].rows[0].count),
      active_users_7d: parseInt(queries[3].rows[0].count)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/users/search - Search registered users by name or email
router.get('/users/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }
    
    const searchTerm = `%${q.toLowerCase()}%`;
    
    const query = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.profile_picture_url,
        u.created_at as joined_date
      FROM users u
      WHERE u.is_active = true
        AND (
          LOWER(u.email) LIKE $1 
          OR LOWER(u.display_name) LIKE $1
        )
      ORDER BY u.display_name
      LIMIT $2
    `;
    
    const result = await pool.query(query, [searchTerm, parseInt(limit)]);
    
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// POST /api/admin/workspaces/:workspaceId/add-member - Directly add a registered user to workspace (site admin only)
router.post('/workspaces/:workspaceId/add-member', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { user_id, role = 'member' } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "admin" or "member"' });
    }
    
    await client.query('BEGIN');
    
    // Get workspace info
    const workspaceQuery = await client.query(`
      SELECT id, name, description FROM workspaces WHERE id = $1
    `, [workspaceId]);
    
    if (workspaceQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    const workspace = workspaceQuery.rows[0];
    
    // Get user info
    const userQuery = await client.query(`
      SELECT id, email, display_name, is_active FROM users WHERE id = $1
    `, [user_id]);
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const targetUser = userQuery.rows[0];
    
    if (!targetUser.is_active) {
      return res.status(400).json({ error: 'User account is not active' });
    }
    
    // Check if user is already a member
    const existingMember = await client.query(`
      SELECT workspace_id, user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2
    `, [workspaceId, user_id]);
    
    if (existingMember.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Already Member', 
        message: 'User is already a member of this workspace' 
      });
    }
    
    // Add user to workspace
    await client.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
    `, [workspaceId, user_id, role]);
    
    // Add user to general channel automatically
    const generalChannel = await client.query(`
      SELECT id FROM threads 
      WHERE workspace_id = $1 AND name = 'general' AND type = 'channel'
      LIMIT 1
    `, [workspaceId]);
    
    if (generalChannel.rows.length > 0) {
      await client.query(`
        INSERT INTO thread_members (thread_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [generalChannel.rows[0].id, user_id]);
    }
    
    // Create notification for the added user
    await client.query(`
      INSERT INTO notifications (
        user_id, 
        workspace_id, 
        type, 
        title, 
        message, 
        data
      )
      VALUES ($1, $2, 'workspace_added', $3, $4, $5)
    `, [
      user_id,
      workspaceId,
      '🎉 Added to Workspace',
      `You've been added to ${workspace.name} by admin`,
      JSON.stringify({
        workspace_id: workspaceId,
        workspace_name: workspace.name,
        role: role,
        added_by: req.user.email,
        added_at: new Date().toISOString()
      })
    ]);
    
    await client.query('COMMIT');
    
    // Send email notification to the added user
    const emailService = require('../services/emailService');
    try {
      const frontendUrl = process.env.FRONTEND_URL || 
                         process.env.REACT_APP_FRONTEND_URL ||
                         'https://coral-app-rgki8.ondigitalocean.app';
      
      await emailService.sendWorkspaceAddedNotification({
        to: targetUser.email,
        workspaceName: workspace.name,
        workspaceDescription: workspace.description,
        adminName: req.user.display_name || req.user.email,
        userRole: role,
        workspaceUrl: `${frontendUrl}/workspace/${workspaceId}`
      });
      
      console.log(`📧 Workspace added notification sent to ${targetUser.email}`);
    } catch (emailError) {
      console.error('Failed to send workspace added email:', emailError.message);
      // Don't fail if email fails
    }
    
    console.log(`👥 [ADMIN] User ${targetUser.email} added to workspace ${workspace.name} by ${req.user.email}`);
    
    res.status(201).json({
      message: 'User added to workspace successfully',
      member: {
        id: targetUser.id,
        email: targetUser.email,
        display_name: targetUser.display_name,
        role: role
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add member error:', error);
    console.error('Add member error stack:', error.stack);
    console.error('Add member error details:', {
      workspaceId: req.params.workspaceId,
      userId: req.body.user_id,
      role: req.body.role
    });
    res.status(500).json({ 
      error: 'Failed to add member to workspace',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/messages/:messageId - Admin delete any message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get message info for logging
    const messageQuery = await pool.query(`
      SELECT m.id, m.content, m.sender_id, t.workspace_id, t.name as channel_name,
             u.display_name as sender_name, u.email as sender_email
      FROM messages m
      JOIN threads t ON m.thread_id = t.id
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.id = $1
    `, [messageId]);

    if (messageQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Message Not Found',
        message: 'Message not found'
      });
    }

    const message = messageQuery.rows[0];

    // Soft delete the message
    await pool.query(`
      UPDATE messages
      SET
        is_deleted = true,
        deleted_by = $1,
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [req.user.id, messageId]);

    console.log(`🗑️ [ADMIN] Message ${messageId} deleted by admin ${req.user.email} (original sender: ${message.sender_email})`);

    res.json({
      message: 'Message deleted successfully by admin',
      deleted_message: {
        id: messageId,
        channel_name: message.channel_name,
        sender_name: message.sender_name,
        sender_email: message.sender_email
      }
    });

  } catch (error) {
    console.error('Admin delete message error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to delete message'
    });
  }
});

// DELETE /api/admin/tasks/:taskId - Admin delete any task/event
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    // Get task info for logging
    const taskQuery = await pool.query(`
      SELECT ct.id, ct.title, ct.thread_id, t.workspace_id, t.name as channel_name,
             u.display_name as created_by_name, u.email as created_by_email
      FROM channel_tasks ct
      JOIN threads t ON ct.thread_id = t.id
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.id = $1
    `, [taskId]);

    if (taskQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Task Not Found',
        message: 'Task/event not found'
      });
    }

    const task = taskQuery.rows[0];

    // Hard delete the task (channel_tasks doesn't have soft delete)
    await pool.query(`DELETE FROM channel_tasks WHERE id = $1`, [taskId]);

    console.log(`🗑️ [ADMIN] Task "${task.title}" (${taskId}) deleted by admin ${req.user.email}`);

    res.json({
      message: 'Task/event deleted successfully by admin',
      deleted_task: {
        id: taskId,
        title: task.title,
        channel_name: task.channel_name,
        created_by_name: task.created_by_name,
        created_by_email: task.created_by_email
      }
    });

  } catch (error) {
    console.error('Admin delete task error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to delete task/event'
    });
  }
});

// DELETE /api/admin/channels/:channelId - Admin delete any channel
router.delete('/channels/:channelId', async (req, res) => {
  const client = await pool.connect();

  try {
    const { channelId } = req.params;

    await client.query('BEGIN');

    // Get channel info for logging and validation
    const channelQuery = await client.query(`
      SELECT t.id, t.name, t.type, t.workspace_id,
             w.name as workspace_name,
             u.display_name as created_by_name, u.email as created_by_email,
             (SELECT COUNT(*) FROM thread_members WHERE thread_id = t.id) as member_count,
             (SELECT COUNT(*) FROM messages WHERE thread_id = t.id) as message_count
      FROM threads t
      JOIN workspaces w ON t.workspace_id = w.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
    `, [channelId]);

    if (channelQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Channel Not Found',
        message: 'Channel not found'
      });
    }

    const channel = channelQuery.rows[0];

    // Prevent deleting the general channel
    if (channel.name === 'general') {
      return res.status(400).json({
        error: 'Cannot Delete',
        message: 'Cannot delete the general channel. Archive or rename it instead.'
      });
    }

    // Delete the channel (cascades to messages, members, tasks via foreign keys)
    await client.query(`DELETE FROM threads WHERE id = $1`, [channelId]);

    await client.query('COMMIT');

    console.log(`🗑️ [ADMIN] Channel "#${channel.name}" (${channelId}) deleted by admin ${req.user.email} - had ${channel.member_count} members, ${channel.message_count} messages`);

    res.json({
      message: 'Channel deleted successfully by admin',
      deleted_channel: {
        id: channelId,
        name: channel.name,
        type: channel.type,
        workspace_name: channel.workspace_name,
        member_count: parseInt(channel.member_count),
        message_count: parseInt(channel.message_count),
        created_by_name: channel.created_by_name,
        created_by_email: channel.created_by_email
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin delete channel error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to delete channel'
    });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/workspaces/:workspaceId - Admin delete or archive workspace
router.delete('/workspaces/:workspaceId', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { archive = false } = req.body;

    await client.query('BEGIN');

    // Get workspace info for logging
    const workspaceQuery = await client.query(`
      SELECT w.name, u.email as owner_email, u.display_name as owner_name
      FROM workspaces w
      LEFT JOIN users u ON w.owner_user_id = u.id
      WHERE w.id = $1;
    `, [workspaceId]);

    if (workspaceQuery.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Workspace Not Found', 
        message: 'Workspace not found' 
      });
    }

    const workspace = workspaceQuery.rows[0];

    if (archive) {
      // Archive workspace - add archived flag and timestamp
      await client.query(`
        UPDATE workspaces 
        SET settings = COALESCE(settings, '{}') || jsonb_build_object(
          'archived', true,
          'archived_at', $2,
          'archived_by_admin', $3
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [workspaceId, new Date().toISOString(), req.user.email]);

      console.log(`🗄️ [ADMIN] Workspace archived: ${workspace.name} (${workspaceId}) by admin ${req.user.email}`);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workspace archived successfully by admin',
        action: 'archived',
        workspace_name: workspace.name,
        owner: workspace.owner_name || workspace.owner_email
      });
    } else {
      // Permanently delete workspace and all related data
      // Note: Foreign key cascades will handle related data deletion
      await client.query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);

      console.log(`🗑️ [ADMIN] Workspace permanently deleted: ${workspace.name} (${workspaceId}) by admin ${req.user.email}`);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workspace permanently deleted by admin',
        action: 'deleted',
        workspace_name: workspace.name,
        owner: workspace.owner_name || workspace.owner_email
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin delete workspace error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to delete workspace' 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
