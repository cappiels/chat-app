const { Server } = require('socket.io');
const admin = require('firebase-admin');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

class SocketServer {
  constructor(httpServer) {
    // Initialize Socket.IO with CORS support
    this.io = new Server(httpServer, {
      cors: {
        origin: [
          'http://localhost:5173',
          'http://localhost:5174', 
          'http://localhost:5175',
          'https://coral-app-rgki8.ondigitalocean.app',
          process.env.FRONTEND_URL
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
      allowEIO3: true
    });

    // Store active connections and user presence
    this.activeConnections = new Map(); // socketId -> { userId, workspaceId, threadId }
    this.userPresence = new Map(); // userId -> { status, lastSeen, workspaces: Set() }
    this.typingUsers = new Map(); // threadId -> Set(userId)

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  // Authentication middleware for Socket.IO
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Get user from database
        const userResult = await pool.query(
          'SELECT * FROM users WHERE id = $1 AND is_active = true',
          [decodedToken.uid]
        );

        if (userResult.rows.length === 0) {
          return next(new Error('User not found or inactive'));
        }

        // Attach user info to socket
        socket.userId = decodedToken.uid;
        socket.user = userResult.rows[0];
        
        console.log(`🔌 Socket authenticated: ${socket.user.display_name} (${socket.id})`);
        next();

      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const user = socket.user;

    console.log(`✅ User connected: ${user.display_name} (${socket.id})`);

    // Store connection
    this.activeConnections.set(socket.id, {
      userId,
      user,
      connectedAt: new Date(),
      workspaces: new Set(),
      currentThread: null
    });

    // Update user presence
    this.updateUserPresence(userId, 'online');

    // Handle workspace joining
    socket.on('join_workspace', async (data) => {
      await this.handleJoinWorkspace(socket, data);
    });

    // Handle thread joining
    socket.on('join_thread', async (data) => {
      await this.handleJoinThread(socket, data);
    });

    // Handle leaving thread
    socket.on('leave_thread', (data) => {
      this.handleLeaveThread(socket, data);
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      await this.handleSendMessage(socket, data);
    });

    // Handle message editing
    socket.on('edit_message', async (data) => {
      await this.handleEditMessage(socket, data);
    });

    // Handle message deletion
    socket.on('delete_message', async (data) => {
      await this.handleDeleteMessage(socket, data);
    });

    // Handle message reactions
    socket.on('add_reaction', async (data) => {
      await this.handleAddReaction(socket, data);
    });

    socket.on('remove_reaction', async (data) => {
      await this.handleRemoveReaction(socket, data);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    // Handle user presence updates
    socket.on('update_presence', (data) => {
      this.handlePresenceUpdate(socket, data);
    });

    // Handle marking messages as read
    socket.on('mark_as_read', async (data) => {
      await this.handleMarkAsRead(socket, data);
    });

    // Handle notification updates
    socket.on('notification_read', async (data) => {
      await this.handleNotificationRead(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${user.display_name}:`, error);
    });
  }

  async handleJoinWorkspace(socket, { workspaceId }) {
    try {
      const userId = socket.userId;

      // Verify workspace membership
      const memberResult = await pool.query(`
        SELECT wm.role, w.name
        FROM workspace_members wm
        JOIN workspaces w ON wm.workspace_id = w.id
        WHERE wm.workspace_id = $1 AND wm.user_id = $2
      `, [workspaceId, userId]);

      if (memberResult.rows.length === 0) {
        socket.emit('error', { message: 'Not a member of this workspace' });
        return;
      }

      const workspace = memberResult.rows[0];
      
      // Join workspace room
      socket.join(`workspace:${workspaceId}`);
      
      // Update connection info
      const connection = this.activeConnections.get(socket.id);
      if (connection) {
        connection.workspaces.add(workspaceId);
        connection.currentWorkspace = workspaceId;
        connection.workspaceRole = workspace.role;
      }

      // Notify others in workspace about user joining
      socket.broadcast.to(`workspace:${workspaceId}`).emit('user_joined_workspace', {
        userId,
        user: socket.user,
        workspaceId,
        timestamp: new Date()
      });

      // Send workspace info to user
      socket.emit('workspace_joined', {
        workspaceId,
        workspaceName: workspace.name,
        role: workspace.role,
        timestamp: new Date()
      });

      console.log(`📝 ${socket.user.display_name} joined workspace: ${workspace.name}`);

    } catch (error) {
      console.error('Join workspace error:', error);
      socket.emit('error', { message: 'Failed to join workspace' });
    }
  }

  async handleJoinThread(socket, { workspaceId, threadId }) {
    try {
      const userId = socket.userId;

      // Verify thread access
      const accessResult = await pool.query(`
        SELECT 
          t.name, 
          t.type,
          t.is_private,
          CASE 
            WHEN tm.user_id IS NOT NULL THEN true
            WHEN t.type = 'channel' AND t.is_private = false THEN true
            ELSE false
          END as has_access,
          CASE 
            WHEN tm.user_id IS NOT NULL THEN true 
            ELSE false 
          END as is_member
        FROM threads t
        LEFT JOIN thread_members tm ON t.id = tm.thread_id AND tm.user_id = $2
        WHERE t.id = $1 AND t.workspace_id = $3
      `, [threadId, userId, workspaceId]);

      if (accessResult.rows.length === 0 || !accessResult.rows[0].has_access) {
        socket.emit('error', { message: 'No access to this thread' });
        return;
      }

      const thread = accessResult.rows[0];

      // Leave previous thread if any
      const connection = this.activeConnections.get(socket.id);
      if (connection && connection.currentThread) {
        socket.leave(`thread:${connection.currentThread}`);
        this.handleTypingStop(socket, { threadId: connection.currentThread });
      }

      // Join thread room
      socket.join(`thread:${threadId}`);
      
      // Update connection info
      if (connection) {
        connection.currentThread = threadId;
        connection.currentWorkspace = workspaceId;
      }

      // Update read timestamp if user is a member
      if (thread.is_member) {
        await pool.query(`
          UPDATE thread_members 
          SET last_read_at = CURRENT_TIMESTAMP
          WHERE thread_id = $1 AND user_id = $2
        `, [threadId, userId]);
      }

      // Notify others in thread about user joining
      socket.broadcast.to(`thread:${threadId}`).emit('user_joined_thread', {
        userId,
        user: socket.user,
        threadId,
        timestamp: new Date()
      });

      // Send thread info to user
      socket.emit('thread_joined', {
        threadId,
        threadName: thread.name,
        threadType: thread.type,
        isMember: thread.is_member,
        timestamp: new Date()
      });

      console.log(`💬 ${socket.user.display_name} joined thread: ${thread.name || 'DM'}`);

    } catch (error) {
      console.error('Join thread error:', error);
      socket.emit('error', { message: 'Failed to join thread' });
    }
  }

  handleLeaveThread(socket, { threadId }) {
    socket.leave(`thread:${threadId}`);
    
    // Stop typing if user was typing
    this.handleTypingStop(socket, { threadId });

    // Update connection info
    const connection = this.activeConnections.get(socket.id);
    if (connection && connection.currentThread === threadId) {
      connection.currentThread = null;
    }

    // Notify others
    socket.broadcast.to(`thread:${threadId}`).emit('user_left_thread', {
      userId: socket.userId,
      threadId,
      timestamp: new Date()
    });

    console.log(`🚪 ${socket.user.display_name} left thread: ${threadId}`);
  }

  async handleSendMessage(socket, messageData) {
    try {
      // This would typically call the messages API
      // For now, we'll broadcast the message to the thread
      const { threadId, content, message_type, mentions, attachments } = messageData;
      
      // Verify user is in thread
      const connection = this.activeConnections.get(socket.id);
      if (!connection || connection.currentThread !== threadId) {
        socket.emit('error', { message: 'Not in this thread' });
        return;
      }

      // Stop typing indicator
      this.handleTypingStop(socket, { threadId });

      // Create message object (in real implementation, this would come from the API)
      const message = {
        id: `temp-${Date.now()}`, // Temporary ID
        content,
        message_type: message_type || 'text',
        sender_id: socket.userId,
        sender_name: socket.user.display_name,
        sender_avatar: socket.user.profile_picture_url,
        thread_id: threadId,
        created_at: new Date(),
        mentions: mentions || [],
        attachments: attachments || [],
        reactions: []
      };

      // Broadcast to all users in thread
      this.io.to(`thread:${threadId}`).emit('new_message', {
        message,
        threadId,
        timestamp: new Date()
      });

      // Update unread counts for users not currently viewing this thread
      await this.updateUnreadCountsForNewMessage(socket, message, threadId);

      // Send notifications for mentions
      if (mentions && mentions.length > 0) {
        for (const mention of mentions) {
          this.sendMentionNotification(mention.user_id, message);
        }
      }

      console.log(`💬 Message sent by ${socket.user.display_name} in thread ${threadId}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  async updateUnreadCountsForNewMessage(senderSocket, message, threadId) {
    try {
      const workspaceId = this.activeConnections.get(senderSocket.id)?.currentWorkspace;
      
      if (!workspaceId) return;

      // Get thread info to determine entity type
      const threadResult = await pool.query(
        'SELECT type FROM threads WHERE id = $1',
        [threadId]
      );

      if (threadResult.rows.length === 0) return;

      const entityType = threadResult.rows[0].type;

      // Get all workspace members except the sender
      const membersResult = await pool.query(`
        SELECT user_id FROM workspace_members 
        WHERE workspace_id = $1 AND user_id != $2
      `, [workspaceId, senderSocket.userId]);

      // Update unread counts for each member
      for (const member of membersResult.rows) {
        const memberId = member.user_id;

        // Check if user is currently viewing this thread
        const isCurrentlyViewing = Array.from(this.activeConnections.values())
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
            message.mentions?.some(m => m.user_id === memberId) ? 1 : 0
          ]);

          // Broadcast notification update to user's devices
          this.broadcastToUserDevices(memberId, 'notification_update', {
            workspaceId,
            entityType,
            entityId: threadId,
            messageId: message.id,
            unreadIncrement: 1,
            mentionIncrement: message.mentions?.some(m => m.user_id === memberId) ? 1 : 0,
            message: {
              id: message.id,
              content: message.content,
              senderName: message.sender_name,
              createdAt: message.created_at
            },
            timestamp: new Date()
          });

          // Update workspace-level counts for this user
          await this.updateWorkspaceNotificationCounts(memberId, workspaceId);
        }
      }

    } catch (error) {
      console.error('Update unread counts error:', error);
    }
  }

  async handleEditMessage(socket, { messageId, content, threadId }) {
    try {
      // Broadcast message edit to thread
      this.io.to(`thread:${threadId}`).emit('message_edited', {
        messageId,
        content,
        threadId,
        editedBy: socket.userId,
        editedAt: new Date()
      });

      console.log(`✏️ Message ${messageId} edited by ${socket.user.display_name}`);

    } catch (error) {
      console.error('Edit message error:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  }

  async handleDeleteMessage(socket, { messageId, threadId }) {
    try {
      // Broadcast message deletion to thread
      this.io.to(`thread:${threadId}`).emit('message_deleted', {
        messageId,
        threadId,
        deletedBy: socket.userId,
        deletedAt: new Date()
      });

      console.log(`🗑️ Message ${messageId} deleted by ${socket.user.display_name}`);

    } catch (error) {
      console.error('Delete message error:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  }

  async handleAddReaction(socket, { messageId, emoji, threadId }) {
    try {
      // Broadcast reaction to thread
      this.io.to(`thread:${threadId}`).emit('reaction_added', {
        messageId,
        emoji,
        userId: socket.userId,
        user: socket.user,
        threadId,
        timestamp: new Date()
      });

      console.log(`😀 Reaction ${emoji} added by ${socket.user.display_name} to message ${messageId}`);

    } catch (error) {
      console.error('Add reaction error:', error);
      socket.emit('error', { message: 'Failed to add reaction' });
    }
  }

  async handleRemoveReaction(socket, { messageId, emoji, threadId }) {
    try {
      // Broadcast reaction removal to thread
      this.io.to(`thread:${threadId}`).emit('reaction_removed', {
        messageId,
        emoji,
        userId: socket.userId,
        threadId,
        timestamp: new Date()
      });

      console.log(`😐 Reaction ${emoji} removed by ${socket.user.display_name} from message ${messageId}`);

    } catch (error) {
      console.error('Remove reaction error:', error);
      socket.emit('error', { message: 'Failed to remove reaction' });
    }
  }

  handleTypingStart(socket, { threadId }) {
    const userId = socket.userId;
    
    if (!this.typingUsers.has(threadId)) {
      this.typingUsers.set(threadId, new Set());
    }
    
    this.typingUsers.get(threadId).add(userId);

    // Broadcast typing indicator to others in thread
    socket.broadcast.to(`thread:${threadId}`).emit('user_typing', {
      userId,
      user: socket.user,
      threadId,
      isTyping: true,
      timestamp: new Date()
    });

    // Clear typing after 5 seconds of inactivity
    clearTimeout(socket.typingTimeout);
    socket.typingTimeout = setTimeout(() => {
      this.handleTypingStop(socket, { threadId });
    }, 5000);
  }

  handleTypingStop(socket, { threadId }) {
    const userId = socket.userId;
    
    if (this.typingUsers.has(threadId)) {
      this.typingUsers.get(threadId).delete(userId);
      
      if (this.typingUsers.get(threadId).size === 0) {
        this.typingUsers.delete(threadId);
      }
    }

    // Broadcast stop typing to others in thread
    socket.broadcast.to(`thread:${threadId}`).emit('user_typing', {
      userId,
      user: socket.user,
      threadId,
      isTyping: false,
      timestamp: new Date()
    });

    clearTimeout(socket.typingTimeout);
  }

  handlePresenceUpdate(socket, { status }) {
    this.updateUserPresence(socket.userId, status);
    
    // Broadcast presence update to all workspaces user is in
    const connection = this.activeConnections.get(socket.id);
    if (connection) {
      connection.workspaces.forEach(workspaceId => {
        socket.broadcast.to(`workspace:${workspaceId}`).emit('presence_update', {
          userId: socket.userId,
          user: socket.user,
          status,
          timestamp: new Date()
        });
      });
    }
  }

  handleDisconnection(socket, reason) {
    const connection = this.activeConnections.get(socket.id);
    
    if (connection) {
      // Stop typing in current thread
      if (connection.currentThread) {
        this.handleTypingStop(socket, { threadId: connection.currentThread });
      }

      // Update presence to offline
      this.updateUserPresence(connection.userId, 'offline');

      // Notify workspaces
      connection.workspaces.forEach(workspaceId => {
        socket.broadcast.to(`workspace:${workspaceId}`).emit('user_disconnected', {
          userId: connection.userId,
          user: connection.user,
          timestamp: new Date()
        });
      });

      // Clean up
      this.activeConnections.delete(socket.id);
    }

    console.log(`❌ User disconnected: ${socket.user?.display_name} (${socket.id}) - ${reason}`);
  }

  updateUserPresence(userId, status) {
    this.userPresence.set(userId, {
      status,
      lastSeen: new Date(),
      updatedAt: new Date()
    });

    // Update database
    pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    ).catch(err => console.error('Failed to update user presence:', err));
  }

  sendMentionNotification(userId, message) {
    // Find all sockets for the mentioned user
    for (const [socketId, connection] of this.activeConnections) {
      if (connection.userId === userId) {
        this.io.to(socketId).emit('mention_notification', {
          message,
          mentionedBy: message.sender_name,
          threadId: message.thread_id,
          timestamp: new Date()
        });
      }
    }
  }

  async handleMarkAsRead(socket, { workspaceId, entityType, entityId, messageId }) {
    try {
      const userId = socket.userId;

      // Call the PostgreSQL function to mark as read
      const result = await pool.query(`
        SELECT mark_messages_as_read($1, $2, $3, $4, $5) as unread_count
      `, [userId, workspaceId, entityType, entityId, messageId]);

      const unreadCount = result.rows[0]?.unread_count || 0;

      // Broadcast read status update to user's other devices
      this.broadcastToUserDevices(userId, 'read_status_update', {
        workspaceId,
        entityType,
        entityId,
        messageId,
        unreadCount,
        readAt: new Date()
      });

      // Update workspace-level notification counts
      await this.updateWorkspaceNotificationCounts(userId, workspaceId);

      console.log(`📖 ${socket.user.display_name} marked ${entityType}:${entityId} as read`);

    } catch (error) {
      console.error('Mark as read error:', error);
      socket.emit('error', { message: 'Failed to mark as read' });
    }
  }

  async handleNotificationRead(socket, { workspaceId, entityType, entityId }) {
    try {
      const userId = socket.userId;

      // Mark all messages in entity as read
      await pool.query(`
        UPDATE user_read_status 
        SET unread_count = 0, last_read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND workspace_id = $2 AND entity_type = $3 AND entity_id = $4
      `, [userId, workspaceId, entityType, entityId]);

      // Broadcast notification update to user's other devices
      this.broadcastToUserDevices(userId, 'notification_cleared', {
        workspaceId,
        entityType,
        entityId,
        clearedAt: new Date()
      });

      // Update workspace-level counts
      await this.updateWorkspaceNotificationCounts(userId, workspaceId);

      console.log(`🔕 ${socket.user.display_name} cleared notifications for ${entityType}:${entityId}`);

    } catch (error) {
      console.error('Notification read error:', error);
      socket.emit('error', { message: 'Failed to clear notifications' });
    }
  }

  broadcastToUserDevices(userId, event, data) {
    // Send to all devices/tabs for this user
    for (const [socketId, connection] of this.activeConnections) {
      if (connection.userId === userId) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  async updateWorkspaceNotificationCounts(userId, workspaceId) {
    try {
      // Get updated notification summary for workspace
      const summaryResult = await pool.query(`
        SELECT 
          SUM(unread_count) as total_unread,
          SUM(unread_mentions) as total_mentions
        FROM user_read_status 
        WHERE user_id = $1 AND workspace_id = $2
      `, [userId, workspaceId]);

      const summary = summaryResult.rows[0] || { total_unread: 0, total_mentions: 0 };

      // Broadcast updated counts to user's devices
      this.broadcastToUserDevices(userId, 'workspace_notification_update', {
        workspaceId,
        totalUnread: parseInt(summary.total_unread || 0),
        totalMentions: parseInt(summary.total_mentions || 0),
        updatedAt: new Date()
      });

    } catch (error) {
      console.error('Update workspace notification counts error:', error);
    }
  }

  // Utility methods for external use
  getActiveUsers(workspaceId) {
    const activeUsers = [];
    for (const connection of this.activeConnections.values()) {
      if (connection.workspaces.has(workspaceId)) {
        activeUsers.push({
          userId: connection.userId,
          user: connection.user,
          status: this.userPresence.get(connection.userId)?.status || 'online',
          connectedAt: connection.connectedAt
        });
      }
    }
    return activeUsers;
  }

  getTypingUsers(threadId) {
    return Array.from(this.typingUsers.get(threadId) || []);
  }

  getUserPresence(userId) {
    return this.userPresence.get(userId) || { status: 'offline', lastSeen: null };
  }
}

module.exports = SocketServer;
