import { io } from 'socket.io-client';
import { auth } from '../firebase';

const SOCKET_URL = 'http://localhost:8080';

class SocketManager {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    if (this.socket?.connected) return;

    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return;
    }

    const token = await user.getIdToken();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Workspace events
  joinWorkspace(workspaceId) {
    if (!this.socket) return;
    this.socket.emit('join_workspace', { workspace_id: workspaceId });
  }

  // Thread events
  joinThread(threadId) {
    if (!this.socket) return;
    this.socket.emit('join_thread', { thread_id: threadId });
  }

  leaveThread(threadId) {
    if (!this.socket) return;
    this.socket.emit('leave_thread', { thread_id: threadId });
  }

  // Message events
  sendMessage(data) {
    if (!this.socket) return;
    this.socket.emit('send_message', data);
  }

  editMessage(messageId, content) {
    if (!this.socket) return;
    this.socket.emit('edit_message', { message_id: messageId, content });
  }

  deleteMessage(messageId) {
    if (!this.socket) return;
    this.socket.emit('delete_message', { message_id: messageId });
  }

  // Reaction events
  addReaction(messageId, emoji) {
    if (!this.socket) return;
    this.socket.emit('add_reaction', { message_id: messageId, emoji });
  }

  removeReaction(messageId, emoji) {
    if (!this.socket) return;
    this.socket.emit('remove_reaction', { message_id: messageId, emoji });
  }

  // Typing events
  startTyping(threadId) {
    if (!this.socket) return;
    this.socket.emit('typing_start', { thread_id: threadId });
  }

  stopTyping(threadId) {
    if (!this.socket) return;
    this.socket.emit('typing_stop', { thread_id: threadId });
  }

  // Presence events
  updatePresence(status) {
    if (!this.socket) return;
    this.socket.emit('update_presence', { status });
  }

  // Event listeners
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }
}

export default new SocketManager();
