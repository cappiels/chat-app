import axios from 'axios';
import { auth } from '../firebase';

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
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
};

export const messageAPI = {
  getMessages: (workspaceId, threadId, params = {}) => api.get(`/workspaces/${workspaceId}/threads/${threadId}/messages`, { params }),
  sendMessage: (workspaceId, threadId, data) => api.post(`/workspaces/${workspaceId}/threads/${threadId}/messages`, data),
  updateMessage: (workspaceId, threadId, messageId, data) => api.put(`/workspaces/${workspaceId}/threads/${threadId}/messages/${messageId}`, data),
  deleteMessage: (workspaceId, threadId, messageId) => api.delete(`/workspaces/${workspaceId}/threads/${threadId}/messages/${messageId}`),
  addReaction: (id, emoji) => api.post(`/messages/${id}/reactions`, { emoji }),
  removeReaction: (id, emoji) => api.delete(`/messages/${id}/reactions`, { data: { emoji } }),
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
  getKnowledgeItems: (workspaceId, params = {}) => api.get(`/knowledge/workspace/${workspaceId}`, { params }),
  createKnowledgeItem: (workspaceId, data) => api.post(`/knowledge/workspace/${workspaceId}`, data),
  updateKnowledgeItem: (id, data) => api.put(`/knowledge/${id}`, data),
  deleteKnowledgeItem: (id) => api.delete(`/knowledge/${id}`),
  recordView: (id, userId) => api.post(`/knowledge/${id}/view`, { userId }),
  getCategories: (workspaceId) => api.get(`/knowledge/workspace/${workspaceId}/categories`),
  getTags: (workspaceId) => api.get(`/knowledge/workspace/${workspaceId}/tags`),
};

export default api;
