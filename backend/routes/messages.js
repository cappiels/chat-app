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

// Import email notification service
const emailNotificationService = require('../services/emailNotificationService');

// Socket server instance - will be set by the main app
let socketServer = null;

// Function to set the socket server instance
router.setSocketServer = (server) => {
  socketServer = server;
};

/**
 * GET /api/workspaces/:workspaceId/threads/:threadId/messages
 * Get messages in a thread with enterprise features
 */
router.get('/', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const { 
      limit = 50, 
      offset = 0, 
      search, 
      before, 
      after,
      pinned_only = false,
      message_type = 'all' 
    } = req.query;
    const userId = req.user.id;

    // Verify thread access
    const accessQuery = `
      SELECT 
        t.type, 
        t.is_private,
        CASE 
          WHEN tm.user_id IS NOT NULL THEN true
          WHEN t.type = 'channel' AND t.is_private = false THEN true
          ELSE false
        END as has_access
      FROM threads t
      LEFT JOIN thread_members tm ON t.id = tm.thread_id AND tm.user_id = $2
      WHERE t.id = $1 AND t.workspace_id = $3;
    `;

    const accessResult = await pool.query(accessQuery, [threadId, userId, workspaceId]);

    if (accessResult.rows.length === 0 || !accessResult.rows[0].has_access) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have access to this thread' 
      });
    }

    // Build dynamic query with filters
    let whereConditions = ['m.thread_id = $1', 'm.is_deleted = false'];
    let queryParams = [threadId];
    let paramCount = 1;

    // Search filter
    if (search) {
      paramCount++;
      whereConditions.push(`m.content ILIKE $${paramCount}`);
      queryParams.push(`%${search}%`);
    }

    // Date filters
    if (before) {
      paramCount++;
      whereConditions.push(`m.created_at < $${paramCount}`);
      queryParams.push(before);
    }

    if (after) {
      paramCount++;
      whereConditions.push(`m.created_at > $${paramCount}`);
      queryParams.push(after);
    }

    // Pinned messages filter
    if (pinned_only === 'true') {
      whereConditions.push(`m.is_pinned = true`);
    }

    // Message type filter
    if (message_type !== 'all') {
      paramCount++;
      whereConditions.push(`m.message_type = $${paramCount}`);
      queryParams.push(message_type);
    }

    // Add limit and offset
    paramCount++;
    const limitParam = paramCount;
    queryParams.push(parseInt(limit));

    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(parseInt(offset));

    const messagesQuery = `
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.is_edited,
        m.is_deleted,
        m.is_pinned,
        m.parent_message_id,
        m.created_at,
        m.updated_at,
        m.scheduled_for,
        sender.id as sender_id,
        sender.display_name as sender_name,
        sender.profile_picture_url as sender_avatar,
        sender.auth_provider as sender_auth_provider,
        
        -- Reactions aggregation
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'emoji', mr.emoji,
              'count', mr.reaction_count,
              'users', mr.user_names,
              'user_reacted', CASE WHEN $${paramCount + 1} = ANY(mr.user_ids) THEN true ELSE false END
            )
          )
          FROM (
            SELECT 
              emoji,
              COUNT(*) as reaction_count,
              ARRAY_AGG(DISTINCT u.display_name) as user_names,
              ARRAY_AGG(DISTINCT r.user_id) as user_ids
            FROM message_reactions r
            JOIN users u ON r.user_id = u.id
            WHERE r.message_id = m.id
            GROUP BY emoji
          ) mr
        ) as reactions,
        
        -- Attachments
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'file_name', a.file_name,
              'file_url', a.file_url,
              'mime_type', a.mime_type,
              'file_size_bytes', a.file_size_bytes,
              'thumbnail_url', a.thumbnail_url,
              'uploaded_at', a.uploaded_at
            )
          )
          FROM attachments a 
          WHERE a.message_id = m.id
        ) as attachments,
        
        -- Mentions
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'user_id', men.mentioned_user_id,
              'display_name', u.display_name,
              'type', men.mention_type
            )
          )
          FROM message_mentions men
          JOIN users u ON men.mentioned_user_id = u.id
          WHERE men.message_id = m.id
        ) as mentions,
        
        -- Parent message (for threading)
        CASE 
          WHEN m.parent_message_id IS NOT NULL THEN
            JSON_BUILD_OBJECT(
              'id', pm.id,
              'content', LEFT(pm.content, 100),
              'sender_name', pu.display_name,
              'created_at', pm.created_at
            )
          ELSE NULL
        END as parent_message,
        
        -- Reply count
        (
          SELECT COUNT(*) 
          FROM messages replies 
          WHERE replies.parent_message_id = m.id 
          AND replies.is_deleted = false
        ) as reply_count,
        
        -- Edit history count
        (
          SELECT COUNT(*) 
          FROM message_edit_history meh 
          WHERE meh.message_id = m.id
        ) as edit_count
        
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN messages pm ON m.parent_message_id = pm.id
      LEFT JOIN users pu ON pm.sender_id = pu.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE WHEN m.is_pinned THEN 0 ELSE 1 END,
        m.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam};
    `;

    // Add current user ID for reaction checking
    queryParams.push(userId);

    const result = await pool.query(messagesQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE ${whereConditions.join(' AND ')};
    `;

    const countResult = await pool.query(countQuery, queryParams.slice(0, -3)); // Remove limit, offset, userId

    // Update read timestamp for user
    await pool.query(`
      UPDATE thread_members 
      SET last_read_at = CURRENT_TIMESTAMP
      WHERE thread_id = $1 AND user_id = $2;
    `, [threadId, userId]);

    res.json({
      messages: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + result.rows.length < parseInt(countResult.rows[0].total)
      },
      filters: {
        search: search || null,
        before: before || null,
        after: after || null,
        pinned_only: pinned_only === 'true',
        message_type
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve messages' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/threads/:threadId/messages
 * Create new message with enterprise features
 */
router.post('/', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId, threadId } = req.params;
    const { 
      content, 
      message_type = 'text', 
      parent_message_id = null,
      scheduled_for = null,
      mentions = [],
      attachments = []
    } = req.body;
    const userId = req.user.id;

    // Verify thread membership for posting
    const memberQuery = `
      SELECT tm.user_id
      FROM thread_members tm
      JOIN threads t ON tm.thread_id = t.id
      WHERE tm.thread_id = $1 AND tm.user_id = $2 AND t.workspace_id = $3;
    `;

    const memberResult = await pool.query(memberQuery, [threadId, userId, workspaceId]);

    if (memberResult.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You must be a member of this thread to post messages' 
      });
    }

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Message content is required' 
      });
    }

    if (content.length > 10000) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Message content cannot exceed 10,000 characters' 
      });
    }

    if (!['text', 'file', 'system', 'code', 'rich_text'].includes(message_type)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid message type' 
      });
    }

    if (scheduled_for && new Date(scheduled_for) <= new Date()) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Scheduled time must be in the future' 
      });
    }

    await client.query('BEGIN');

    // Create message
    const messageQuery = `
      INSERT INTO messages (
        thread_id, 
        sender_id, 
        content, 
        message_type, 
        parent_message_id,
        scheduled_for
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const messageResult = await client.query(messageQuery, [
      threadId,
      userId,
      content.trim(),
      message_type,
      parent_message_id,
      scheduled_for
    ]);

    const message = messageResult.rows[0];

    // Process mentions
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        // Verify mentioned user is in workspace
        const mentionedUserQuery = `
          SELECT wm.user_id
          FROM workspace_members wm
          WHERE wm.workspace_id = $1 AND wm.user_id = $2;
        `;

        const mentionedResult = await client.query(mentionedUserQuery, [workspaceId, mention.user_id]);

        if (mentionedResult.rows.length > 0) {
          await client.query(`
            INSERT INTO message_mentions (message_id, mentioned_user_id, mention_type)
            VALUES ($1, $2, $3);
          `, [message.id, mention.user_id, mention.type || 'user']);

          // Create notification for mentioned user
          await client.query(`
            INSERT INTO notifications (
              user_id, 
              type, 
              title, 
              message, 
              data,
              workspace_id,
              thread_id,
              message_id
            )
            VALUES ($1, 'mention', $2, $3, $4, $5, $6, $7);
          `, [
            mention.user_id,
            `You were mentioned by ${req.user.display_name}`,
            content.substring(0, 200),
            JSON.stringify({
              sender: req.user.display_name,
              thread_id: threadId,
              message_id: message.id
            }),
            workspaceId,
            threadId,
            message.id
          ]);

          // Queue email notification for mention
          try {
            await emailNotificationService.queueNotification({
              userId: mention.user_id,
              workspaceId: parseInt(workspaceId),
              threadId: parseInt(threadId),
              messageId: message.id,
              notificationType: 'mention',
              priority: 'immediate',
              senderName: req.user.display_name,
              senderEmail: req.user.email,
              messageContent: content.substring(0, 500),
              messageTimestamp: new Date()
            });
            console.log(`📧 Email notification queued for mention to user ${mention.user_id}`);
          } catch (emailError) {
            console.error('Failed to queue email notification for mention:', emailError);
            // Don't fail the request if email notification fails
          }
        }
      }
    }

    // Process attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await client.query(`
          INSERT INTO attachments (
            message_id, 
            file_name, 
            file_url, 
            mime_type, 
            file_size_bytes,
            thumbnail_url
          )
          VALUES ($1, $2, $3, $4, $5, $6);
        `, [
          message.id,
          attachment.file_name,
          attachment.file_url,
          attachment.mime_type,
          attachment.file_size_bytes,
          attachment.thumbnail_url || null
        ]);
      }
    }

    // Update thread's updated_at
    await client.query(`
      UPDATE threads 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1;
    `, [threadId]);

    await client.query('COMMIT');

    // Get complete message with all relations
    const completeMessageQuery = `
      SELECT 
        m.*,
        sender.display_name as sender_name,
        sender.profile_picture_url as sender_avatar,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', a.id,
              'file_name', a.file_name,
              'file_url', a.file_url,
              'mime_type', a.mime_type
            )
          )
          FROM attachments a WHERE a.message_id = m.id
        ) as attachments,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'user_id', men.mentioned_user_id,
              'display_name', u.display_name,
              'type', men.mention_type
            )
          )
          FROM message_mentions men
          JOIN users u ON men.mentioned_user_id = u.id
          WHERE men.message_id = m.id
        ) as mentions
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      WHERE m.id = $1;
    `;

    const completeMessage = await client.query(completeMessageQuery, [message.id]);
    const messageData = completeMessage.rows[0];

    console.log(`💬 Message created in thread ${threadId} by ${req.user.display_name}`);

    // 🔥 EMIT SOCKET EVENT FOR REAL-TIME UPDATES
    if (socketServer && socketServer.io) {
      const socketMessage = {
        id: messageData.id,
        content: messageData.content,
        message_type: messageData.message_type,
        sender_id: messageData.sender_id,
        sender_name: messageData.sender_name,
        sender_avatar: messageData.sender_avatar,
        thread_id: threadId,
        created_at: messageData.created_at,
        mentions: messageData.mentions || [],
        attachments: messageData.attachments || [],
        reactions: []
      };

      // Broadcast to all users in this thread
      socketServer.io.to(`thread:${threadId}`).emit('new_message', {
        message: socketMessage,
        threadId,
        timestamp: new Date()
      });

      console.log(`🚀 Socket event emitted for new message in thread ${threadId}`);

      // Handle notification updates for users not currently viewing this thread
      try {
        // Get thread info to determine entity type
        const threadResult = await pool.query(
          'SELECT type FROM threads WHERE id = $1',
          [threadId]
        );

        if (threadResult.rows.length > 0) {
          const entityType = threadResult.rows[0].type;

          // Get all workspace members except the sender
          const membersResult = await pool.query(`
            SELECT user_id FROM workspace_members 
            WHERE workspace_id = $1 AND user_id != $2
          `, [workspaceId, userId]);

          // Update unread counts and broadcast notifications for each member
          for (const member of membersResult.rows) {
            const memberId = member.user_id;

            // Check if user is currently viewing this thread via active socket connections
            const isCurrentlyViewing = Array.from(socketServer.activeConnections.values())
              .some(conn => conn.userId === memberId && conn.currentThread === threadId);

            if (!isCurrentlyViewing) {
              // Increment unread count for users not currently viewing
              await pool.query(`
                INSERT INTO user_read_status (user_id, workspace_id, entity_type, entity_id, unread_count, unread_mentions)
                VALUES ($1, $2, $3, $4, 1, $5)
                ON CONFLICT (user_id, workspace_id, entity_type, entity_id)
                DO UPDATE SET 
                  unread_count = user_read_status.unread_count + 1,
                  unread_mentions = user_read_status.unread_mentions + $5
              `, [
                memberId, 
                workspaceId, 
                entityType, 
                threadId, 
                messageData.mentions?.some(m => m.user_id === memberId) ? 1 : 0
              ]);

              // Broadcast notification update to user's devices
              socketServer.io.emit('notification_update', {
                userId: memberId,
                workspaceId,
                entityType,
                entityId: threadId,
                messageId: messageData.id,
                unreadIncrement: 1,
                mentionIncrement: messageData.mentions?.some(m => m.user_id === memberId) ? 1 : 0,
                message: {
                  id: messageData.id,
                  content: messageData.content,
                  senderName: messageData.sender_name,
                  createdAt: messageData.created_at
                },
                timestamp: new Date()
              });
            }
          }
        }
      } catch (notificationError) {
        console.error('Notification update error:', notificationError);
        // Don't fail the request for notification errors
      }
    } else {
      console.warn('⚠️ Socket server not available for real-time events');
    }

    res.status(201).json({
      message: 'Message created successfully',
      data: messageData
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create message error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to create message' 
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/workspaces/:workspaceId/threads/:threadId/messages/:messageId
 * Edit message with history tracking
 */
router.put('/:messageId', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId, threadId, messageId } = req.params;
    const { content, edit_reason } = req.body;
    const userId = req.user.id;

    // Verify message ownership or admin rights
    const messageQuery = `
      SELECT m.*, t.workspace_id
      FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = $1 AND m.thread_id = $2 AND t.workspace_id = $3;
    `;

    const messageResult = await pool.query(messageQuery, [messageId, threadId, workspaceId]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Message Not Found', 
        message: 'Message not found' 
      });
    }

    const message = messageResult.rows[0];

    // Check if user can edit (owner or admin)
    if (message.sender_id !== userId && req.userWorkspaceRole !== 'admin') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only edit your own messages or be an admin' 
      });
    }

    // Validation
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Message content is required' 
      });
    }

    if (content.length > 10000) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Message content cannot exceed 10,000 characters' 
      });
    }

    await client.query('BEGIN');

    // Save edit history
    await client.query(`
      INSERT INTO message_edit_history (
        message_id, 
        previous_content, 
        edited_by, 
        edit_reason,
        edited_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);
    `, [messageId, message.content, userId, edit_reason || null]);

    // Update message
    const updateQuery = `
      UPDATE messages 
      SET 
        content = $1, 
        is_edited = true, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;

    const updatedMessage = await client.query(updateQuery, [content.trim(), messageId]);

    await client.query('COMMIT');

    console.log(`✏️ Message ${messageId} edited by ${req.user.display_name}`);

    res.json({
      message: 'Message updated successfully',
      data: updatedMessage.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Edit message error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to edit message' 
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/threads/:threadId/messages/:messageId
 * Soft delete message with admin recovery
 */
router.delete('/:messageId', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId, messageId } = req.params;
    const userId = req.user.id;

    // Verify message ownership or admin rights
    const messageQuery = `
      SELECT m.*, t.workspace_id
      FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = $1 AND m.thread_id = $2 AND t.workspace_id = $3;
    `;

    const messageResult = await pool.query(messageQuery, [messageId, threadId, workspaceId]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Message Not Found', 
        message: 'Message not found' 
      });
    }

    const message = messageResult.rows[0];

    // Check if user can delete (owner or admin)
    if (message.sender_id !== userId && req.userWorkspaceRole !== 'admin') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You can only delete your own messages or be an admin' 
      });
    }

    // Soft delete
    await pool.query(`
      UPDATE messages 
      SET 
        is_deleted = true, 
        deleted_by = $1,
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [userId, messageId]);

    console.log(`🗑️ Message ${messageId} deleted by ${req.user.display_name}`);

    res.json({
      message: 'Message deleted successfully',
      message_id: messageId
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to delete message' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/reactions
 * Add reaction to message
 */
router.post('/:messageId/reactions', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Validation
    if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Emoji is required' 
      });
    }

    // Verify message exists and user has access
    const messageQuery = `
      SELECT m.id FROM messages m
      JOIN threads t ON m.thread_id = t.id
      WHERE m.id = $1 AND t.id = $2 AND t.workspace_id = $3 AND m.is_deleted = false;
    `;

    const messageResult = await pool.query(messageQuery, [messageId, threadId, workspaceId]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Message Not Found', 
        message: 'Message not found or access denied' 
      });
    }

    // Add or toggle reaction
    const reactionQuery = `
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, emoji) 
      DO NOTHING
      RETURNING *;
    `;

    const reactionResult = await pool.query(reactionQuery, [messageId, userId, emoji.trim()]);

    // Get updated reaction counts
    const reactionsQuery = `
      SELECT 
        emoji,
        COUNT(*) as count,
        ARRAY_AGG(DISTINCT u.display_name) as users,
        BOOL_OR(r.user_id = $2) as user_reacted
      FROM message_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = $1
      GROUP BY emoji;
    `;

    const reactions = await pool.query(reactionsQuery, [messageId, userId]);

    // Emit socket event for real-time updates
    if (socketServer && socketServer.io) {
      socketServer.io.to(`thread:${threadId}`).emit('message_reaction_updated', {
        messageId,
        threadId,
        reactions: reactions.rows,
        timestamp: new Date()
      });
    }

    res.json({
      message: 'Reaction added successfully',
      added: reactionResult.rows.length > 0,
      reactions: reactions.rows
    });

  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to add reaction' 
    });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/threads/:threadId/messages/:messageId/reactions/:emoji
 * Remove reaction from message
 */
router.delete('/:messageId/reactions/:emoji', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId, messageId, emoji } = req.params;
    const userId = req.user.id;

    // Remove reaction
    const deleteQuery = `
      DELETE FROM message_reactions 
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
      RETURNING *;
    `;

    const deleteResult = await pool.query(deleteQuery, [messageId, userId, decodeURIComponent(emoji)]);

    // Get updated reaction counts
    const reactionsQuery = `
      SELECT 
        emoji,
        COUNT(*) as count,
        ARRAY_AGG(DISTINCT u.display_name) as users,
        BOOL_OR(r.user_id = $2) as user_reacted
      FROM message_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = $1
      GROUP BY emoji;
    `;

    const reactions = await pool.query(reactionsQuery, [messageId, userId]);

    // Emit socket event for real-time updates
    if (socketServer && socketServer.io) {
      socketServer.io.to(`thread:${threadId}`).emit('message_reaction_updated', {
        messageId,
        threadId,
        reactions: reactions.rows,
        timestamp: new Date()
      });
    }

    res.json({
      message: 'Reaction removed successfully',
      removed: deleteResult.rows.length > 0,
      reactions: reactions.rows
    });

  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to remove reaction' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/threads/:threadId/bookmarks
 * Bookmark/unbookmark a thread
 */
router.post('/:threadId/bookmarks', authenticateUser, requireWorkspaceMembership, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id;

    // Check if bookmark exists
    const existingBookmark = await pool.query(
      'SELECT id FROM thread_bookmarks WHERE user_id = $1 AND thread_id = $2',
      [userId, threadId]
    );

    if (existingBookmark.rows.length > 0) {
      // Remove bookmark
      await pool.query(
        'DELETE FROM thread_bookmarks WHERE user_id = $1 AND thread_id = $2',
        [userId, threadId]
      );

      res.json({
        message: 'Thread unbookmarked successfully',
        bookmarked: false
      });
    } else {
      // Add bookmark
      await pool.query(
        'INSERT INTO thread_bookmarks (user_id, thread_id, workspace_id) VALUES ($1, $2, $3)',
        [userId, threadId, workspaceId]
      );

      res.json({
        message: 'Thread bookmarked successfully',
        bookmarked: true
      });
    }

  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to toggle bookmark' 
    });
  }
});

module.exports = router;
