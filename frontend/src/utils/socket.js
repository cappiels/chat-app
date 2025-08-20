import { io } from 'socket.io-client';
import { auth } from '../firebase';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.connecting = false;
    this.currentWorkspace = null;
    this.currentThread = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map(); // Track event listeners for cleanup
    this.connectionCallbacks = [];
    this.disconnectionCallbacks = [];
  }

  async connect() {
    if (this.socket?.connected || this.connecting) return;

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No authenticated user for socket connection');
      return;
    }

    try {
      this.connecting = true;
      const token = await user.getIdToken();

      console.log('🔌 Connecting to socket server:', SOCKET_URL);

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'], // WebSocket first for maximum speed
        timeout: 15000, // Fast connection timeout  
        reconnection: false, // Manual reconnection for better control
        forceNew: false,
        upgrade: true, // Enable WebSocket upgrades for speed
        autoConnect: true,
        pingTimeout: 20000, // Match backend for fast disconnect detection
        pingInterval: 10000, // Frequent pings for instant status updates
        maxHttpBufferSize: 1000000, // 1MB buffer for high throughput
        withCredentials: false,
        path: '/socket.io/',
        rememberUpgrade: true, // Remember WebSocket upgrade for future connections
        compression: true, // Enable compression for speed
        perMessageDeflate: true // Enable message compression
      });

      this.setupEventListeners();
      
    } catch (error) {
      console.error('❌ Socket connection error:', error);
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;
      
      // Rejoin workspace and thread if they were set
      if (this.currentWorkspace) {
        this.socket.emit('join_workspace', { workspaceId: this.currentWorkspace });
      }
      if (this.currentThread && this.currentWorkspace) {
        this.socket.emit('join_thread', { 
          workspaceId: this.currentWorkspace, 
          threadId: this.currentThread 
        });
      }

      // Notify connection callbacks
      this.connectionCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Connection callback error:', error);
        }
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.connected = false;
      this.connecting = false;

      // Notify disconnection callbacks
      this.disconnectionCallbacks.forEach(callback => {
        try {
          callback(reason);
        } catch (error) {
          console.error('Disconnection callback error:', error);
        }
      });

      // Auto-reconnect for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't auto-reconnect
        console.log('Server disconnected client, not auto-reconnecting');
      } else {
        // Client-side disconnect or network issue, attempt to reconnect
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.connected = false;
      this.connecting = false;
      this.scheduleReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // Enhanced real-time event logging
    this.socket.on('new_message', (data) => {
      console.log('📩 New message received:', data);
    });

    this.socket.on('user_typing', (data) => {
      console.log('⌨️ Typing event:', data);
    });

    this.socket.on('notification_update', (data) => {
      console.log('🔔 Notification update:', data);
    });

    this.socket.on('workspace_notification_update', (data) => {
      console.log('🏢 Workspace notification update:', data);
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      // Notify disconnection callbacks about failed reconnection
      this.disconnectionCallbacks.forEach(callback => {
        try {
          callback('max_reconnect_attempts_reached');
        } catch (error) {
          console.error('Disconnection callback error:', error);
        }
      });
      return;
    }

    // Progressive backoff: 1s, 2s, 4s, 8s, 16s
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (!this.connected && !this.connecting) {
        console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}`);
        this.connect();
      }
    }, delay);
  }

  // Reset reconnection state (useful for manual retries)
  resetReconnection() {
    this.reconnectAttempts = 0;
    console.log('🔄 Reconnection state reset');
  }

  // Connection status methods
  onConnect(callback) {
    this.connectionCallbacks.push(callback);
  }

  onDisconnect(callback) {
    this.disconnectionCallbacks.push(callback);
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      reconnectAttempts: this.reconnectAttempts,
      currentWorkspace: this.currentWorkspace,
      currentThread: this.currentThread,
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.connecting = false;
      this.currentWorkspace = null;
      this.currentThread = null;
    }
  }

  // Enhanced workspace events
  joinWorkspace(workspaceId) {
    console.log('🏢 Joining workspace:', workspaceId);
    if (!this.socket?.connected) {
      console.warn('⚠️ Socket not connected, queueing workspace join');
      this.currentWorkspace = workspaceId;
      return;
    }
    
    this.currentWorkspace = workspaceId;
    this.socket.emit('join_workspace', { workspaceId });
  }

  // Enhanced thread events
  joinThread(workspaceId, threadId) {
    console.log('💬 Joining thread:', threadId, 'in workspace:', workspaceId);
    if (!this.socket?.connected) {
      console.warn('⚠️ Socket not connected, queueing thread join');
      this.currentWorkspace = workspaceId;
      this.currentThread = threadId;
      return;
    }

    this.currentWorkspace = workspaceId;
    this.currentThread = threadId;
    this.socket.emit('join_thread', { workspaceId, threadId });
  }

  leaveThread(threadId) {
    console.log('🚪 Leaving thread:', threadId);
    if (!this.socket?.connected) return;
    
    this.currentThread = null;
    this.socket.emit('leave_thread', { threadId });
  }

  // Enhanced message events with retry and acknowledgment
  sendMessage(data) {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot send message: socket not connected');
      return false;
    }
    
    // Generate unique message ID for tracking
    const messageId = data.messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageData = { ...data, messageId };
    
    console.log('📤 Sending message:', messageData);
    
    // Set up timeout for message acknowledgment
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Message send timeout:', messageId);
      // Emit timeout event that components can listen for
      if (this.socket) {
        this.socket.emit('internal_message_timeout', { messageId, data: messageData });
      }
    }, 10000); // 10 second timeout

    // Listen for acknowledgment
    const handleMessageSent = (ackData) => {
      if (ackData.messageId === messageId) {
        clearTimeout(timeoutId);
        console.log('✅ Message sent successfully:', messageId);
        this.socket.off('message_sent', handleMessageSent);
      }
    };

    const handleMessageError = (errorData) => {
      if (errorData.messageId === messageId) {
        clearTimeout(timeoutId);
        console.error('❌ Message send failed:', messageId, errorData.error);
        this.socket.off('message_error', handleMessageError);
        
        // Retry once after 2 seconds
        setTimeout(() => {
          if (this.socket?.connected) {
            console.log('🔄 Retrying message send:', messageId);
            this.socket.emit('send_message', messageData);
          }
        }, 2000);
      }
    };

    this.socket.on('message_sent', handleMessageSent);
    this.socket.on('message_error', handleMessageError);
    this.socket.emit('send_message', messageData);
    
    return messageId;
  }

  editMessage(messageId, content, threadId) {
    if (!this.socket?.connected) return false;
    console.log('✏️ Editing message:', messageId);
    this.socket.emit('edit_message', { messageId, content, threadId });
    return true;
  }

  deleteMessage(messageId, threadId) {
    if (!this.socket?.connected) return false;
    console.log('🗑️ Deleting message:', messageId);
    this.socket.emit('delete_message', { messageId, threadId });
    return true;
  }

  // Enhanced reaction events
  addReaction(messageId, emoji, threadId) {
    if (!this.socket?.connected) return false;
    console.log('😀 Adding reaction:', emoji, 'to message:', messageId);
    this.socket.emit('add_reaction', { messageId, emoji, threadId });
    return true;
  }

  removeReaction(messageId, emoji, threadId) {
    if (!this.socket?.connected) return false;
    console.log('😐 Removing reaction:', emoji, 'from message:', messageId);
    this.socket.emit('remove_reaction', { messageId, emoji, threadId });
    return true;
  }

  // Enhanced typing events
  startTyping(threadId) {
    if (!this.socket?.connected || !threadId) return false;
    this.socket.emit('typing_start', { threadId });
    return true;
  }

  stopTyping(threadId) {
    if (!this.socket?.connected || !threadId) return false;
    this.socket.emit('typing_stop', { threadId });
    return true;
  }

  // Enhanced notification events
  markAsRead(workspaceId, entityType, entityId, messageId) {
    if (!this.socket?.connected) return false;
    console.log('📖 Marking as read:', entityType, entityId);
    this.socket.emit('mark_as_read', { workspaceId, entityType, entityId, messageId });
    return true;
  }

  clearNotifications(workspaceId, entityType, entityId) {
    if (!this.socket?.connected) return false;
    console.log('🔕 Clearing notifications:', entityType, entityId);
    this.socket.emit('notification_read', { workspaceId, entityType, entityId });
    return true;
  }

  // Enhanced presence events
  updatePresence(status) {
    if (!this.socket?.connected) return false;
    console.log('👋 Updating presence:', status);
    this.socket.emit('update_presence', { status });
    return true;
  }

  // Enhanced event listener management
  on(event, callback) {
    if (!this.socket) {
      console.warn('⚠️ Cannot add listener: socket not initialized');
      return;
    }
    
    // Track listeners for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    
    // Remove from tracking
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
    
    this.socket.off(event, callback);
  }

  // Remove all listeners for an event
  removeAllListeners(event) {
    if (!this.socket) return;
    
    if (event) {
      this.socket.removeAllListeners(event);
      this.listeners.delete(event);
    } else {
      this.socket.removeAllListeners();
      this.listeners.clear();
    }
  }

  // Get active listeners (for debugging)
  getActiveListeners() {
    return Array.from(this.listeners.keys());
  }
}

export default new SocketManager();
