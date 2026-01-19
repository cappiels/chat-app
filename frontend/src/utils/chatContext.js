/**
 * Chat Context Manager
 * Persists and retrieves the user's last-used workspace and channel
 * for instant navigation when clicking the "Chat" tab.
 */

const STORAGE_KEY = 'crewchat_last_context';

export const chatContextManager = {
  /**
   * Save the current workspace and channel context
   * @param {Object} workspace - { id, name }
   * @param {Object} channel - { id, name }
   */
  save: (workspace, channel) => {
    if (!workspace?.id) return;

    const context = {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      channelId: channel?.id || null,
      channelName: channel?.name || null,
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch (error) {
      console.warn('Failed to save chat context:', error);
    }
  },

  /**
   * Load the saved context
   * @returns {Object|null} - { workspaceId, workspaceName, channelId, channelName, updatedAt } or null
   */
  load: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const context = JSON.parse(stored);

      // Validate required fields
      if (!context.workspaceId) return null;

      return context;
    } catch (error) {
      console.warn('Failed to load chat context:', error);
      return null;
    }
  },

  /**
   * Clear the saved context (e.g., when user is removed from workspace)
   */
  clear: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear chat context:', error);
    }
  },

  /**
   * Check if there's a valid saved context
   * @returns {boolean}
   */
  hasContext: () => {
    const context = chatContextManager.load();
    return context !== null && !!context.workspaceId;
  },

  /**
   * Update only the channel (when switching channels within same workspace)
   * @param {Object} channel - { id, name }
   */
  updateChannel: (channel) => {
    const context = chatContextManager.load();
    if (!context) return;

    chatContextManager.save(
      { id: context.workspaceId, name: context.workspaceName },
      channel
    );
  }
};

export default chatContextManager;
