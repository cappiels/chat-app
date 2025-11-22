import axios from 'axios';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

// In production, use the same domain with /api routing
// In development, use localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout for better reliability
});

// Auth state management
let authStateRestored = false;
let authStatePromise = null;

// Wait for auth state to be restored
const waitForAuthState = () => {
  if (authStateRestored) {
    return Promise.resolve();
  }
  
  if (!authStatePromise) {
    authStatePromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        authStateRestored = true;
        unsubscribe();
        resolve(user);
      });
    });
  }
  
  return authStatePromise;
};

// Add auth token to requests with better error handling
api.interceptors.request.use(async (config) => {
  try {
    // Wait for auth state to be restored before making requests
    await waitForAuthState();
    
    const user = auth.currentUser;
    if (user) {
      try {
        // Use cached token (will auto-refresh if expired)
        // This is more efficient and prevents race conditions
        const token = await user.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      } catch (tokenError) {
        console.error('Failed to get authentication token:', tokenError);
        // Don't block the request - let backend handle 401
      }
    } else {
      console.log('No authenticated user for API request');
      // Don't throw error here - let the backend handle the 401
    }
  } catch (error) {
    console.error('Error in auth interceptor:', error);
    // Don't block the request, let it proceed and handle 401s in response interceptor
  }
  return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`API Error: ${error.response?.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    console.error('Error details:', error.response?.data);
    return Promise.reject(error);
  }
);

// API functions - baseURL already includes /api, so no prefix needed
export const workspaceAPI = {
  getWorkspaces: () => api.get('/workspaces'),
  getWorkspace: (id) => api.get(`/workspaces/${id}`),
  createWorkspace: (data) => api.post('/workspaces', data),
  updateWorkspace: (id, data) => api.put(`/workspaces/${id}`, data),
  deleteWorkspace: (id, options = {}) => api.delete(`/workspaces/${id}`, { data: options }),
  archiveWorkspace: (id) => api.delete(`/workspaces/${id}`, { data: { archive: true } }),
  inviteUser: (id, data) => api.post(`/workspaces/${id}/invite`, data),
  acceptInvitation: (token) => api.post(`/workspaces/accept-invite/${token}`),
  acceptInvite: (token) => api.post(`/workspaces/accept-invite/${token}`), // Keep for backward compatibility
  getMembers: (id) => api.get(`/workspaces/${id}/members`),
  removeMember: (workspaceId, userId) => api.delete(`/workspaces/${workspaceId}/members/${userId}`),
  cancelInvitation: (workspaceId, invitationId) => api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`),
  getNotifications: (params = {}) => api.get('/workspaces/notifications', { params }),
  markNotificationRead: (id) => api.put(`/workspaces/notifications/${id}/read`),
};

export const threadAPI = {
  getThreads: (workspaceId) => api.get(`/workspaces/${workspaceId}/threads`),
  getThread: (workspaceId, threadId) => api.get(`/workspaces/${workspaceId}/threads/${threadId}`),
  createChannel: (workspaceId, data) => api.post(`/workspaces/${workspaceId}/threads`, { ...data, type: 'channel' }),
  createDM: (workspaceId, userId) => api.post(`/workspaces/${workspaceId}/threads`, { type: 'direct_message', members: [userId] }),
  joinThread: (workspaceId, threadId) => api.post(`/workspaces/${workspaceId}/threads/${threadId}/join`),
  leaveThread: (workspaceId, threadId) => api.delete(`/workspaces/${workspaceId}/threads/${threadId}/leave`),
  updateThread: (workspaceId, threadId, data) => api.put(`/workspaces/${workspaceId}/threads/${threadId}`, data),
  deleteThread: (workspaceId, threadId) => api.delete(`/workspaces/${workspaceId}/threads/${threadId}`),
  getMembers: (workspaceId, threadId) => api.get(`/workspaces/${workspaceId}/threads/${threadId}/members`),
  toggleBookmark: (workspaceId, threadId) => api.post(`/workspaces/${workspaceId}/threads/${threadId}/bookmarks`),
};

export const messageAPI = {
  getMessages: (workspaceId, threadId, params = {}) => api.get(`/workspaces/${workspaceId}/threads/${threadId}/messages`, { params }),
  sendMessage: (workspaceId, threadId, data) => api.post(`/workspaces/${workspaceId}/threads/${threadId}/messages`, data),
  updateMessage: (workspaceId, threadId, messageId, data) => api.put(`/workspaces/${workspaceId}/threads/${threadId}/messages/${messageId}`, data),
  deleteMessage: (workspaceId, threadId, messageId) => api.delete(`/workspaces/${workspaceId}/threads/${threadId}/messages/${messageId}`),
  addReaction: (workspaceId, threadId, messageId, emoji) => api.post(`/workspaces/${workspaceId}/threads/${threadId}/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (workspaceId, threadId, messageId, emoji) => api.delete(`/workspaces/${workspaceId}/threads/${threadId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
  pinMessage: (id) => api.post(`/messages/${id}/pin`),
  unpinMessage: (id) => api.delete(`/messages/${id}/pin`),
  getTemplates: () => api.get('/messages/templates'),
  createTemplate: (data) => api.post('/messages/templates', data),
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  searchUsers: (workspaceId, query) => api.get(`/users/search?workspace_id=${workspaceId}&q=${query}`),
};

export const knowledgeAPI = {
  // Knowledge scopes
  getScopes: (workspaceId) => api.get(`/knowledge/workspaces/${workspaceId}/scopes`),
  createScope: (workspaceId, data) => api.post(`/knowledge/workspaces/${workspaceId}/scopes`, data),
  
  // User permissions
  getUserPermissions: (workspaceId, userId) => api.get(`/knowledge/workspaces/${workspaceId}/permissions/${userId}`),
  
  // AI suggestions
  generateAISuggestions: (workspaceId, data) => api.post(`/knowledge/workspaces/${workspaceId}/ai-suggestions`, data),
  
  // Personal bookmarks
  getOrCreatePersonalBookmarks: (workspaceId, userId) => api.post(`/knowledge/workspaces/${workspaceId}/personal-bookmarks`, { userId }),
  
  // Multi-location support - Knowledge items in scopes
  getScopeItems: (workspaceId, scopeId, params = {}) => api.get(`/knowledge/workspaces/${workspaceId}/scopes/${scopeId}/items`, { params }),
  createKnowledgeItem: (workspaceId, data) => {
    // Use the primary scope or first selected location for the API call
    const primaryScopeId = data.primary_scope_id || data.additional_scope_ids?.[0];
    if (!primaryScopeId) {
      return Promise.reject(new Error('No scope specified for knowledge item creation'));
    }
    return api.post(`/knowledge/workspaces/${workspaceId}/scopes/${primaryScopeId}/items`, data);
  },
  updateKnowledgeItem: (workspaceId, scopeId, id, data) => api.put(`/knowledge/workspaces/${workspaceId}/scopes/${scopeId}/items/${id}`, data),
  deleteKnowledgeItem: (workspaceId, scopeId, id) => api.delete(`/knowledge/workspaces/${workspaceId}/scopes/${scopeId}/items/${id}`),
  
  // Collections
  getCollections: (workspaceId, scopeId) => api.get(`/knowledge/workspaces/${workspaceId}/scopes/${scopeId}/collections`),
  
  // Categories and tags - simplified for now
  getCategories: (workspaceId) => api.get(`/knowledge/workspaces/${workspaceId}/categories`),
  getTags: (workspaceId) => api.get(`/knowledge/workspaces/${workspaceId}/tags`),
  
  // Analytics
  getAnalytics: (workspaceId, params = {}) => api.get(`/knowledge/workspaces/${workspaceId}/analytics`, { params }),
  recordAnalytics: (itemId, data) => api.post(`/knowledge/items/${itemId}/analytics`, data),
};

export const notificationAPI = {
  // Get unread summary across all channels/threads
  getUnreadSummary: (workspaceId) => api.get(`/workspaces/${workspaceId}/notifications/unread-summary`),
  
  // Get all channels with their unread counts and latest messages
  getChannelsWithUnread: (workspaceId) => api.get(`/workspaces/${workspaceId}/notifications/channels`),
  
  // Mark messages as read for a specific channel/thread
  markAsRead: (workspaceId, data) => api.post(`/workspaces/${workspaceId}/notifications/mark-read`, data),
  
  // Mark all messages as read across entire workspace
  markAllAsRead: (workspaceId) => api.post(`/workspaces/${workspaceId}/notifications/mark-all-read`),
  
  // Mute/unmute a channel or thread
  updateMuteStatus: (workspaceId, data) => api.put(`/workspaces/${workspaceId}/notifications/mute`, data),
  
  // Get notification history
  getHistory: (workspaceId, params = {}) => api.get(`/workspaces/${workspaceId}/notifications/history`, { params }),
  
  // Mark a specific notification as read
  markNotificationAsRead: (workspaceId, notificationId) => api.put(`/workspaces/${workspaceId}/notifications/${notificationId}/read`),
};

export default api;
