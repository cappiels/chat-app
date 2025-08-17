import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

// API functions
export const workspaceAPI = {
  getWorkspaces: () => api.get('/api/workspaces'),
  getWorkspace: (id) => api.get(`/api/workspaces/${id}`),
  createWorkspace: (data) => api.post('/api/workspaces', data),
  updateWorkspace: (id, data) => api.put(`/api/workspaces/${id}`, data),
  deleteWorkspace: (id) => api.delete(`/api/workspaces/${id}`),
  inviteUser: (id, data) => api.post(`/api/workspaces/${id}/invite`, data),
  acceptInvitation: (token) => api.post(`/api/workspaces/accept-invite/${token}`),
  acceptInvite: (token) => api.post(`/api/workspaces/accept-invite/${token}`), // Keep for backward compatibility
  getMembers: (id) => api.get(`/api/workspaces/${id}/members`),
  getNotifications: (params = {}) => api.get('/api/workspaces/notifications', { params }),
  markNotificationRead: (id) => api.put(`/api/workspaces/notifications/${id}/read`),
};

export const threadAPI = {
  getThreads: (workspaceId) => api.get(`/api/workspaces/${workspaceId}/threads`),
  getThread: (workspaceId, threadId) => api.get(`/api/workspaces/${workspaceId}/threads/${threadId}`),
  createChannel: (workspaceId, data) => api.post(`/api/workspaces/${workspaceId}/threads/channels`, data),
  createDM: (workspaceId, userId) => api.post(`/api/workspaces/${workspaceId}/threads/dm`, { user_id: userId }),
  joinThread: (workspaceId, threadId) => api.post(`/api/workspaces/${workspaceId}/threads/${threadId}/join`),
  leaveThread: (workspaceId, threadId) => api.post(`/api/workspaces/${workspaceId}/threads/${threadId}/leave`),
  updateThread: (workspaceId, threadId, data) => api.put(`/api/workspaces/${workspaceId}/threads/${threadId}`, data),
  deleteThread: (workspaceId, threadId) => api.delete(`/api/workspaces/${workspaceId}/threads/${threadId}`),
  getMembers: (workspaceId, threadId) => api.get(`/api/workspaces/${workspaceId}/threads/${threadId}/members`),
};

export const messageAPI = {
  getMessages: (threadId, params = {}) => api.get(`/api/messages?thread_id=${threadId}`, { params }),
  sendMessage: (data) => api.post('/api/messages', data),
  updateMessage: (id, data) => api.put(`/api/messages/${id}`, data),
  deleteMessage: (id) => api.delete(`/api/messages/${id}`),
  addReaction: (id, emoji) => api.post(`/api/messages/${id}/reactions`, { emoji }),
  removeReaction: (id, emoji) => api.delete(`/api/messages/${id}/reactions`, { data: { emoji } }),
  pinMessage: (id) => api.post(`/api/messages/${id}/pin`),
  unpinMessage: (id) => api.delete(`/api/messages/${id}/pin`),
  getTemplates: () => api.get('/api/messages/templates'),
  createTemplate: (data) => api.post('/api/messages/templates', data),
};

export const userAPI = {
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data) => api.put('/api/users/profile', data),
  searchUsers: (workspaceId, query) => api.get(`/api/users/search?workspace_id=${workspaceId}&q=${query}`),
};

export const knowledgeAPI = {
  getKnowledgeItems: (workspaceId, params = {}) => api.get(`/api/knowledge/workspace/${workspaceId}`, { params }),
  createKnowledgeItem: (workspaceId, data) => api.post(`/api/knowledge/workspace/${workspaceId}`, data),
  updateKnowledgeItem: (id, data) => api.put(`/api/knowledge/${id}`, data),
  deleteKnowledgeItem: (id) => api.delete(`/api/knowledge/${id}`),
  recordView: (id, userId) => api.post(`/api/knowledge/${id}/view`, { userId }),
  getCategories: (workspaceId) => api.get(`/api/knowledge/workspace/${workspaceId}/categories`),
  getTags: (workspaceId) => api.get(`/api/knowledge/workspace/${workspaceId}/tags`),
};

export default api;
