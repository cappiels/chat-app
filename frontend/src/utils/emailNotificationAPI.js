import api from './api';

export const emailNotificationAPI = {
  // Get user's email notification preferences
  async getPreferences(workspaceId = null, threadId = null) {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    if (threadId) params.append('threadId', threadId);
    
    return api.get(`/email-notifications/preferences?${params}`);
  },

  // Save user's email notification preferences
  async savePreferences(preferences) {
    return api.post('/email-notifications/preferences', preferences);
  },

  // Get thread subscription status
  async getThreadSubscription(threadId, workspaceId) {
    return api.get(`/email-notifications/thread/${threadId}/subscription?workspaceId=${workspaceId}`);
  },

  // Subscribe/unsubscribe to thread immediate notifications
  async subscribeToThread(threadId, workspaceId, immediate = true) {
    return api.post(`/email-notifications/thread/${threadId}/subscribe`, {
      workspaceId,
      immediate
    });
  },

  // Get workspace subscription status
  async getWorkspaceSubscription(workspaceId) {
    return api.get(`/email-notifications/workspace/${workspaceId}/subscription`);
  },

  // Subscribe/unsubscribe to workspace immediate notifications
  async subscribeToWorkspace(workspaceId, immediate = true) {
    return api.post(`/email-notifications/workspace/${workspaceId}/subscribe`, {
      immediate
    });
  },

  // Test email notification
  async testNotification(workspaceId, threadId = null, type = 'mention') {
    return api.post('/email-notifications/test', {
      type,
      workspaceId,
      threadId
    });
  },

  // Get notification queue status
  async getQueueStatus() {
    return api.get('/email-notifications/queue/status');
  },

  // Clear failed notifications
  async clearFailedNotifications() {
    return api.post('/email-notifications/queue/clear-failed');
  },

  // Get user activity status
  async getActivity(workspaceId = null) {
    const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
    return api.get(`/email-notifications/activity${params}`);
  }
};

export default emailNotificationAPI;
