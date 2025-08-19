const express = require('express');
const { Pool } = require('pg');
const { authenticateUser, requireWorkspaceMembership } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * GET /api/workspaces/:workspaceId/notifications/unread-summary
 * Get unread counts summary for user across all channels/threads
 */
router.get('/unread-summary', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Get comprehensive unread summary
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(urs.unread_count), 0) as total_unread,
        COALESCE(SUM(urs.unread_mentions), 0) as total_mentions,
        COUNT(CASE WHEN urs.unread_count > 0 THEN 1 END) as unread_conversations,
        
        -- Breakdown by entity type
        JSON_AGG(
          CASE WHEN urs.unread_count > 0 THEN
            JSON_BUILD_OBJECT(
              'entity_type', urs.entity_type,
              'entity_id', urs.entity_id,
              'unread_count', urs.unread_count,
              'unread_mentions', urs.unread_mentions,
              'last_read_at', urs.last_read_at,
              'is_muted', urs.is_muted,
              'thread_name', t.name,
              'thread_type', t.type
            )
          END
        ) FILTER (WHERE urs.unread_count > 0) as unread_items
      FROM user_read_status urs
      LEFT JOIN threads t ON urs.entity_id = t.id AND urs.entity_type = 'thread'
      WHERE urs.user_id = $1 
      AND urs.workspace_id = $2;
    `;

    const result = await pool.query(summaryQuery, [userId, workspaceId]);

    res.json({
      summary: result.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get unread summary error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve unread summary' 
    });
  }
});

/**
 * GET /api/workspaces/:workspaceId/notifications/channels
 * Get unread status for all channels user has access to
 */
router.get('/channels', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const channelsQuery = `
      SELECT 
        t.id,
        t.name,
        t.type,
        t.description,
        t.is_private,
        COALESCE(urs.unread_count, 0) as unread_count,
        COALESCE(urs.unread_mentions, 0) as unread_mentions,
        COALESCE(urs.is_muted, false) as is_muted,
        urs.last_read_at,
        urs.last_read_message_id,
        
        -- Latest message info for preview
        (
          SELECT JSON_BUILD_OBJECT(
            'id', m.id,
            'content', LEFT(m.content, 100),
            'sender_name', u.display_name,
            'created_at', m.created_at,
            'message_type', m.message_type
          )
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.thread_id = t.id 
          AND m.is_deleted = false
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as latest_message
        
      FROM threads t
      JOIN thread_members tm ON t.id = tm.thread_id
      LEFT JOIN user_read_status urs ON (
        urs.user_id = $1 
        AND urs.workspace_id = $2 
        AND urs.entity_type = 'thread' 
        AND urs.entity_id = t.id
      )
      WHERE tm.user_id = $1 
      AND t.workspace_id = $2
      ORDER BY 
        CASE WHEN urs.unread_count > 0 THEN 0 ELSE 1 END,
        urs.unread_mentions DESC,
        t.updated_at DESC;
    `;

    const result = await pool.query(channelsQuery, [userId, workspaceId]);

    res.json({
      channels: result.rows,
      total_unread: result.rows.reduce((sum, ch) => sum + ch.unread_count, 0),
      total_mentions: result.rows.reduce((sum, ch) => sum + ch.unread_mentions, 0)
    });

  } catch (error) {
    console.error('Get channels unread error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve channel unread status' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/notifications/mark-read
 * Mark messages as read for a specific channel/thread
 */
router.post('/mark-read', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { entity_type, entity_id, message_id = null } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!entity_type || !entity_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entity_type and entity_id are required'
      });
    }

    if (!['thread', 'channel', 'dm'].includes(entity_type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entity_type must be thread, channel, or dm'
      });
    }

    // Verify user has access to this entity
    if (entity_type === 'thread') {
      const accessCheck = await pool.query(`
        SELECT tm.user_id
        FROM thread_members tm
        JOIN threads t ON tm.thread_id = t.id
        WHERE tm.user_id = $1 AND tm.thread_id = $2 AND t.workspace_id = $3;
      `, [userId, entity_id, workspaceId]);

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this thread'
        });
      }
    }

    // Use the PostgreSQL function to mark as read
    const result = await pool.query(`
      SELECT * FROM mark_messages_read($1, $2, $3, $4, $5);
    `, [userId, workspaceId, entity_type, entity_id, message_id]);

    const updatedCounts = result.rows[0];

    // Refresh materialized view for real-time updates
    await pool.query('SELECT refresh_unread_summary();');

    console.log(`📖 Marked ${entity_type} ${entity_id} as read for ${req.user.display_name}`);

    res.json({
      message: 'Messages marked as read successfully',
      entity_type,
      entity_id,
      unread_count: updatedCounts.unread_count,
      unread_mentions: updatedCounts.unread_mentions,
      marked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to mark messages as read' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/notifications/mark-all-read
 * Mark all messages as read across entire workspace
 */
router.post('/mark-all-read', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Mark all threads as read for this user
    await client.query(`
      UPDATE user_read_status
      SET 
        unread_count = 0,
        unread_mentions = 0,
        last_read_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND workspace_id = $2;
    `, [userId, workspaceId]);

    // Also update thread_members for backwards compatibility
    await client.query(`
      UPDATE thread_members tm
      SET 
        unread_count = 0,
        unread_mentions = 0,
        last_read_at = CURRENT_TIMESTAMP
      FROM threads t
      WHERE tm.thread_id = t.id 
      AND tm.user_id = $1 
      AND t.workspace_id = $2;
    `, [userId, workspaceId]);

    // Refresh materialized view
    await client.query('SELECT refresh_unread_summary();');

    await client.query('COMMIT');

    console.log(`📖 Marked ALL messages as read for ${req.user.display_name} in workspace ${workspaceId}`);

    res.json({
      message: 'All messages marked as read successfully',
      workspace_id: workspaceId,
      marked_at: new Date().toISOString()
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Mark all as read error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to mark all messages as read' 
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/workspaces/:workspaceId/notifications/mute
 * Mute/unmute a specific channel or thread
 */
router.put('/mute', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { entity_type, entity_id, is_muted } = req.body;
    const userId = req.user.id;

    if (!entity_type || !entity_id || typeof is_muted !== 'boolean') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'entity_type, entity_id, and is_muted are required'
      });
    }

    // Update mute status
    const result = await pool.query(`
      INSERT INTO user_read_status (
        user_id, workspace_id, entity_type, entity_id, is_muted, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, workspace_id, entity_type, entity_id)
      DO UPDATE SET
        is_muted = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [userId, workspaceId, entity_type, entity_id, is_muted]);

    console.log(`🔇 ${is_muted ? 'Muted' : 'Unmuted'} ${entity_type} ${entity_id} for ${req.user.display_name}`);

    res.json({
      message: `${entity_type} ${is_muted ? 'muted' : 'unmuted'} successfully`,
      entity_type,
      entity_id,
      is_muted,
      updated_at: result.rows[0].updated_at
    });

  } catch (error) {
    console.error('Mute/unmute error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to update mute status' 
    });
  }
});

/**
 * GET /api/workspaces/:workspaceId/notifications/history
 * Get notification history for user
 */
router.get('/history', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { limit = 50, offset = 0, type = null, unread_only = false } = req.query;
    const userId = req.user.id;

    let whereConditions = ['n.user_id = $1', 'n.workspace_id = $2'];
    let queryParams = [userId, workspaceId];
    let paramCount = 2;

    if (type) {
      paramCount++;
      whereConditions.push(`n.type = $${paramCount}`);
      queryParams.push(type);
    }

    if (unread_only === 'true') {
      whereConditions.push('n.is_read = false');
    }

    paramCount++;
    const limitParam = paramCount;
    queryParams.push(parseInt(limit));

    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(parseInt(offset));

    const notificationsQuery = `
      SELECT 
        n.*,
        t.name as thread_name,
        t.type as thread_type,
        m.content as message_content
      FROM notifications n
      LEFT JOIN threads t ON n.thread_id = t.id
      LEFT JOIN messages m ON n.message_id = m.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY n.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;

    const result = await pool.query(notificationsQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications n
      WHERE ${whereConditions.join(' AND ')};
    `;

    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));

    res.json({
      notifications: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Get notification history error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve notification history' 
    });
  }
});

/**
 * PUT /api/workspaces/:workspaceId/notifications/:notificationId/read
 * Mark a specific notification as read
 */
router.put('/:notificationId/read', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, notificationId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(`
      UPDATE notifications 
      SET 
        is_read = true,
        read_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      AND user_id = $2 
      AND workspace_id = $3
      RETURNING *;
    `, [notificationId, userId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Notification Not Found',
        message: 'Notification not found or access denied'
      });
    }

    res.json({
      message: 'Notification marked as read',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to mark notification as read' 
    });
  }
});

module.exports = router;
