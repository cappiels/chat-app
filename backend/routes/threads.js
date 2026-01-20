const express = require('express');
const { Pool } = require('pg');
const { 
  authenticateUser, 
  requireWorkspaceMembership, 
  requireWorkspaceAdmin 
} = require('../middleware/auth');
const router = express.Router({ mergeParams: true }); // Fix: Inherit parent route params

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * GET /api/workspaces/:workspaceId/threads
 * Get all threads (channels/DMs) in a workspace for current user
 */
router.get('/', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Get threads where user is a member, plus public channels they can join
    const threadsQuery = `
      SELECT 
        t.id,
        t.name,
        t.type,
        t.description,
        t.is_private,
        t.created_at,
        t.updated_at,
        creator.display_name as created_by_name,
        creator.profile_picture_url as created_by_avatar,
        CASE 
          WHEN tm.user_id IS NOT NULL THEN true 
          ELSE false 
        END as is_member,
        tm.joined_at,
        tm.last_read_at,
        (
          SELECT COUNT(*) 
          FROM thread_members tm2 
          WHERE tm2.thread_id = t.id
        ) as member_count,
        (
          SELECT COUNT(*) 
          FROM messages m 
          WHERE m.thread_id = t.id 
          AND m.is_deleted = false
        ) as message_count,
        (
          SELECT JSON_BUILD_OBJECT(
            'id', m.id,
            'content', LEFT(m.content, 100),
            'sender_name', u.display_name,
            'created_at', m.created_at
          )
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.thread_id = t.id 
          AND m.is_deleted = false
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*) 
          FROM messages m 
          WHERE m.thread_id = t.id 
          AND m.created_at > COALESCE(tm.last_read_at, tm.joined_at, '1970-01-01'::timestamp)
          AND m.is_deleted = false
          AND m.sender_id != $2
        ) as unread_count
      FROM threads t
      JOIN users creator ON t.created_by = creator.id
      LEFT JOIN thread_members tm ON t.id = tm.thread_id AND tm.user_id = $2
      WHERE t.workspace_id = $1
      AND (
        tm.user_id IS NOT NULL  -- User is a member
        OR (t.type = 'channel' AND t.is_private = false)  -- Or it's a public channel
      )
      ORDER BY 
        CASE WHEN t.name = 'general' THEN 0 ELSE 1 END,  -- General first
        t.type ASC,  -- Channels before DMs
        CASE WHEN tm.user_id IS NOT NULL THEN 0 ELSE 1 END,  -- Member channels first
        t.name ASC,
        t.created_at DESC;
    `;

    const result = await pool.query(threadsQuery, [workspaceId, userId]);

    // Separate channels and DMs
    const channels = result.rows.filter(t => t.type === 'channel');
    const directMessages = result.rows.filter(t => t.type === 'direct_message');

    res.json({
      threads: result.rows,
      channels,
      direct_messages: directMessages,
      counts: {
        total: result.rows.length,
        channels: channels.length,
        direct_messages: directMessages.length,
        joined: result.rows.filter(t => t.is_member).length,
        unread_total: result.rows.reduce((sum, t) => sum + parseInt(t.unread_count || 0), 0)
      }
    });

  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve threads' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/threads
 * Create new thread (channel or DM)
 */
router.post('/', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { name, type, description, is_private = false, members = [] } = req.body;
    const userId = req.user.id;

    // Validation
    if (!type || !['channel', 'direct_message'].includes(type)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Type must be either "channel" or "direct_message"' 
      });
    }

    if (type === 'channel') {
      if (!name || name.length < 1 || name.length > 255) {
        return res.status(400).json({ 
          error: 'Validation Error', 
          message: 'Channel name must be between 1 and 255 characters' 
        });
      }

      // Channel names should be lowercase, no spaces
      const channelName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      
      if (channelName !== name.toLowerCase().replace(/\s+/g, '-')) {
        return res.status(400).json({ 
          error: 'Validation Error', 
          message: 'Channel name can only contain lowercase letters, numbers, and hyphens' 
        });
      }
    }

    if (type === 'direct_message') {
      if (members.length !== 1) {
        return res.status(400).json({ 
          error: 'Validation Error', 
          message: 'Direct messages must have exactly one other member' 
        });
      }

      // Check if DM already exists between these users
      const existingDM = await client.query(`
        SELECT t.id FROM threads t
        JOIN thread_members tm1 ON t.id = tm1.thread_id AND tm1.user_id = $1
        JOIN thread_members tm2 ON t.id = tm2.thread_id AND tm2.user_id = $2
        WHERE t.workspace_id = $3 AND t.type = 'direct_message'
        AND (SELECT COUNT(*) FROM thread_members WHERE thread_id = t.id) = 2;
      `, [userId, members[0], workspaceId]);

      if (existingDM.rows.length > 0) {
        return res.status(409).json({ 
          error: 'DM Exists', 
          message: 'Direct message already exists between these users',
          thread_id: existingDM.rows[0].id
        });
      }
    }

    await client.query('BEGIN');

    // For channels, check if admin for private channels
    if (type === 'channel' && is_private && req.userWorkspaceRole !== 'admin') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Only workspace admins can create private channels' 
      });
    }

    // Create thread
    const threadQuery = `
      INSERT INTO threads (workspace_id, name, type, description, is_private, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const threadResult = await client.query(threadQuery, [
      workspaceId,
      type === 'channel' ? name : null,
      type,
      description || null,
      is_private,
      userId
    ]);

    const thread = threadResult.rows[0];

    // Add creator to thread
    await client.query(`
      INSERT INTO thread_members (thread_id, user_id)
      VALUES ($1, $2);
    `, [thread.id, userId]);

    // Add additional members for DMs or specified channel members
    const allMembers = type === 'direct_message' ? members : members.filter(m => m !== userId);
    
    for (const memberId of allMembers) {
      // Verify member is in workspace
      const memberCheck = await client.query(`
        SELECT user_id FROM workspace_members 
        WHERE workspace_id = $1 AND user_id = $2;
      `, [workspaceId, memberId]);

      if (memberCheck.rows.length > 0) {
        await client.query(`
          INSERT INTO thread_members (thread_id, user_id)
          VALUES ($1, $2);
        `, [thread.id, memberId]);
      }
    }

    // For public channels, send a system message
    if (type === 'channel' && !is_private) {
      await client.query(`
        INSERT INTO messages (thread_id, sender_id, content, message_type)
        VALUES ($1, $2, $3, 'system');
      `, [
        thread.id, 
        userId, 
        `${req.user.display_name} created the #${name} channel`
      ]);
    }

    await client.query('COMMIT');

    // Get the complete thread info
    const completeThreadQuery = `
      SELECT 
        t.*,
        creator.display_name as created_by_name,
        (SELECT COUNT(*) FROM thread_members WHERE thread_id = t.id) as member_count
      FROM threads t
      JOIN users creator ON t.created_by = creator.id
      WHERE t.id = $1;
    `;

    const completeThread = await client.query(completeThreadQuery, [thread.id]);

    console.log(`📝 ${type} created: ${name || 'DM'} (${thread.id}) in workspace ${req.workspaceName}`);

    res.status(201).json({
      message: `${type === 'channel' ? 'Channel' : 'Direct message'} created successfully`,
      thread: completeThread.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create thread error:', error);
    
    if (error.code === '23505') { // Duplicate key
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'A channel with this name already exists' 
      });
    }
    
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to create thread' 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/workspaces/:workspaceId/threads/:threadId
 * Get thread details with recent messages
 */
router.get('/:threadId', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this thread
    const accessQuery = `
      SELECT 
        t.*,
        creator.display_name as created_by_name,
        creator.profile_picture_url as created_by_avatar,
        CASE 
          WHEN tm.user_id IS NOT NULL THEN true
          WHEN t.type = 'channel' AND t.is_private = false THEN true
          ELSE false
        END as has_access,
        CASE 
          WHEN tm.user_id IS NOT NULL THEN true 
          ELSE false 
        END as is_member,
        tm.joined_at,
        tm.last_read_at
      FROM threads t
      JOIN users creator ON t.created_by = creator.id
      LEFT JOIN thread_members tm ON t.id = tm.thread_id AND tm.user_id = $2
      WHERE t.id = $1 AND t.workspace_id = $3;
    `;

    const threadResult = await pool.query(accessQuery, [threadId, userId, workspaceId]);

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Thread Not Found', 
        message: 'Thread not found' 
      });
    }

    const thread = threadResult.rows[0];

    if (!thread.has_access) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have access to this private thread' 
      });
    }

    // Get thread members
    const membersQuery = `
      SELECT 
        u.id,
        u.display_name,
        u.profile_picture_url,
        u.last_login,
        tm.joined_at,
        tm.last_read_at
      FROM thread_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.thread_id = $1
      ORDER BY tm.joined_at ASC;
    `;

    const membersResult = await pool.query(membersQuery, [threadId]);

    // Get recent messages (last 50)
    const messagesQuery = `
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.is_edited,
        m.is_deleted,
        m.parent_message_id,
        m.created_at,
        m.updated_at,
        sender.id as sender_id,
        sender.display_name as sender_name,
        sender.profile_picture_url as sender_avatar,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'file_name', a.file_name,
              'file_url', a.file_url,
              'mime_type', a.mime_type,
              'file_size_bytes', a.file_size_bytes,
              'thumbnail_url', a.thumbnail_url
            )
          )
          FROM attachments a 
          WHERE a.message_id = m.id
        ) as attachments
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      WHERE m.thread_id = $1
      ORDER BY m.created_at DESC
      LIMIT 50;
    `;

    const messagesResult = await pool.query(messagesQuery, [threadId]);

    res.json({
      thread: {
        ...thread,
        member_count: membersResult.rows.length,
        message_count: messagesResult.rows.length
      },
      members: membersResult.rows,
      messages: messagesResult.rows.reverse(), // Reverse to show oldest first
      user_access: {
        has_access: thread.has_access,
        is_member: thread.is_member,
        joined_at: thread.joined_at,
        last_read_at: thread.last_read_at
      }
    });

  } catch (error) {
    console.error('Get thread details error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to retrieve thread details'
    });
  }
});

/**
 * PUT /api/workspaces/:workspaceId/threads/:threadId
 * Update thread/channel details (name, description)
 */
router.put('/:threadId', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    // Get thread and check permissions
    const threadResult = await pool.query(
      'SELECT * FROM threads WHERE id = $1 AND workspace_id = $2',
      [threadId, workspaceId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Thread not found'
      });
    }

    const thread = threadResult.rows[0];

    // Check if user has permission (admin or thread creator)
    const isAdmin = req.userWorkspaceRole === 'admin';
    const isCreator = thread.created_by === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins or the channel creator can edit this channel'
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (name !== undefined) {
      // Validate and sanitize channel name
      const channelName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      if (channelName.length < 1 || channelName.length > 255) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Channel name must be between 1 and 255 characters'
        });
      }
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(channelName);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No fields to update'
      });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const updateQuery = `
      UPDATE threads
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND workspace_id = $${paramCount + 1}
      RETURNING *;
    `;
    values.push(threadId, workspaceId);

    const result = await pool.query(updateQuery, values);

    console.log(`📝 Thread ${threadId} updated by ${userId}`);

    res.json({
      message: 'Channel updated successfully',
      thread: result.rows[0]
    });

  } catch (error) {
    console.error('Update thread error:', error);
    res.status(500).json({
      error: 'Server Error',
      message: 'Unable to update channel'
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/threads/:threadId/join
 * Join a public channel
 */
router.post('/:threadId/join', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id;

    // Check if thread exists and is joinable
    const threadQuery = `
      SELECT type, is_private, name 
      FROM threads 
      WHERE id = $1 AND workspace_id = $2;
    `;

    const threadResult = await pool.query(threadQuery, [threadId, workspaceId]);

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Thread Not Found', 
        message: 'Thread not found' 
      });
    }

    const thread = threadResult.rows[0];

    if (thread.type !== 'channel' || thread.is_private) {
      return res.status(400).json({ 
        error: 'Cannot Join', 
        message: 'You can only join public channels' 
      });
    }

    // Check if already a member
    const memberCheck = await pool.query(`
      SELECT user_id FROM thread_members 
      WHERE thread_id = $1 AND user_id = $2;
    `, [threadId, userId]);

    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Already Member', 
        message: 'You are already a member of this channel' 
      });
    }

    // Add user to channel
    await pool.query(`
      INSERT INTO thread_members (thread_id, user_id)
      VALUES ($1, $2);
    `, [threadId, userId]);

    // Add system message
    await pool.query(`
      INSERT INTO messages (thread_id, sender_id, content, message_type)
      VALUES ($1, $2, $3, 'system');
    `, [
      threadId, 
      userId, 
      `${req.user.display_name} joined the channel`
    ]);

    res.json({
      message: `Successfully joined #${thread.name}`,
      thread_id: threadId
    });

  } catch (error) {
    console.error('Join thread error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to join thread' 
    });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/threads/:threadId/leave
 * Leave a channel (cannot leave DMs)
 */
router.delete('/:threadId/leave', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id;

    // Check thread type and membership
    const threadQuery = `
      SELECT t.type, t.name, t.created_by, tm.user_id as is_member
      FROM threads t
      LEFT JOIN thread_members tm ON t.id = tm.thread_id AND tm.user_id = $2
      WHERE t.id = $1 AND t.workspace_id = $3;
    `;

    const result = await pool.query(threadQuery, [threadId, userId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Thread Not Found', 
        message: 'Thread not found' 
      });
    }

    const thread = result.rows[0];

    if (!thread.is_member) {
      return res.status(400).json({ 
        error: 'Not Member', 
        message: 'You are not a member of this thread' 
      });
    }

    if (thread.type === 'direct_message') {
      return res.status(400).json({ 
        error: 'Cannot Leave', 
        message: 'You cannot leave direct messages' 
      });
    }

    if (thread.name === 'general') {
      return res.status(400).json({ 
        error: 'Cannot Leave', 
        message: 'You cannot leave the general channel' 
      });
    }

    // Remove user from thread
    await pool.query(`
      DELETE FROM thread_members 
      WHERE thread_id = $1 AND user_id = $2;
    `, [threadId, userId]);

    // Add system message
    await pool.query(`
      INSERT INTO messages (thread_id, sender_id, content, message_type)
      VALUES ($1, $2, $3, 'system');
    `, [
      threadId, 
      userId, 
      `${req.user.display_name} left the channel`
    ]);

    res.json({
      message: `Successfully left #${thread.name}`,
      thread_id: threadId
    });

  } catch (error) {
    console.error('Leave thread error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to leave thread' 
    });
  }
});

/**
 * PUT /api/workspaces/:workspaceId/threads/:threadId/read
 * Mark thread as read (update last_read_at)
 */
router.put('/:threadId/read', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id;

    // Update last_read_at for user in this thread
    const result = await pool.query(`
      UPDATE thread_members 
      SET last_read_at = CURRENT_TIMESTAMP
      WHERE thread_id = $1 AND user_id = $2
      RETURNING last_read_at;
    `, [threadId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Not Member', 
        message: 'You are not a member of this thread' 
      });
    }

    res.json({
      message: 'Thread marked as read',
      last_read_at: result.rows[0].last_read_at
    });

  } catch (error) {
    console.error('Mark thread read error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to mark thread as read' 
    });
  }
});

// Mount messages routes as sub-routes
const messageRoutes = require('./messages');
router.use('/:threadId/messages', messageRoutes);

// Mount channel task routes as sub-routes
const channelTaskRoutes = require('./channel-tasks');
router.use('/:threadId/tasks', channelTaskRoutes);

// Socket server instance - will be set by the parent route
let socketServer = null;

// Function to set the socket server instance and pass it down the chain
router.setSocketServer = (server) => {
  socketServer = server;
  console.log('🔌 Socket server connected to thread routes');
  
  // Pass socket server to nested routes
  if (messageRoutes.setSocketServer) {
    messageRoutes.setSocketServer(server);
    console.log('🔌 Socket server passed to message routes');
  }
};

module.exports = router;
