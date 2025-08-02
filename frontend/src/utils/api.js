import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

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
  getWorkspaces: () => api.get('/workspaces'),
  getWorkspace: (id) => api.get(`/workspaces/${id}`),
  createWorkspace: (data) => api.post('/workspaces', data),
  updateWorkspace: (id, data) => api.put(`/workspaces/${id}`, data),
  deleteWorkspace: (id) => api.delete(`/workspaces/${id}`),
  inviteUser: (id, email) => api.post(`/workspaces/${id}/invite`, { email }),
  getMembers: (id) => api.get(`/workspaces/${id}/members`),
};

export const threadAPI = {
  getThreads: (workspaceId) => api.get(`/threads?workspace_id=${workspaceId}`),
  getThread: (id) => api.get(`/threads/${id}`),
  createChannel: (workspaceId, data) => api.post(`/threads/channels`, { workspace_id: workspaceId, ...data }),
  createDM: (workspaceId, userId) => api.post(`/threads/dm`, { workspace_id: workspaceId, user_id: userId }),
  joinThread: (id) => api.post(`/threads/${id}/join`),
  leaveThread: (id) => api.post(`/threads/${id}/leave`),
  updateThread: (id, data) => api.put(`/threads/${id}`, data),
  deleteThread: (id) => api.delete(`/threads/${id}`),
  getMembers: (id) => api.get(`/threads/${id}/members`),
};

export const messageAPI = {
  getMessages: (threadId, params = {}) => api.get(`/messages?thread_id=${threadId}`, { params }),
  sendMessage: (data) => api.post('/messages', data),
  updateMessage: (id, data) => api.put(`/messages/${id}`, data),
  deleteMessage: (id) => api.delete(`/messages/${id}`),
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

export default api;
