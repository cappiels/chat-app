const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const emailNotificationService = require('../services/emailNotificationService');

// Get user's email notification preferences
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const { workspaceId, threadId } = req.query;
    const userId = req.user.uid;
    
    const preferences = await emailNotificationService.getUserPreferences(
      userId, 
      workspaceId || null, 
      threadId || null
    );
    
    // Return default preferences if none exist
    const defaultPrefs = {
      immediateMentions: true,
      immediateDirectMessages: true,
      immediateWorkspaceInvites: true,
      batchedEnabled: true,
      batchedFrequencyMinutes: 30,
      digestEnabled: true,
      digestTime: '09:00:00',
      digestTimezone: 'America/New_York',
      threadImmediate: null,
      workspaceImmediate: null
    };
    
    res.json({
      success: true,
      preferences: preferences || defaultPrefs
    });
    
  } catch (error) {
    console.error('Failed to get email notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email notification preferences'
    });
  }
});

// Save user's email notification preferences
router.post('/preferences', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const preferences = req.body;
    
    const savedPreferences = await emailNotificationService.saveUserPreferences(
      userId, 
      preferences
    );
    
    res.json({
      success: true,
      preferences: savedPreferences,
      message: 'Email notification preferences saved successfully'
    });
    
  } catch (error) {
    console.error('Failed to save email notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save email notification preferences'
    });
  }
});

// Get thread-specific subscription status
router.get('/thread/:threadId/subscription', authenticateUser, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { workspaceId } = req.query;
    const userId = req.user.uid;
    
    const preferences = await emailNotificationService.getUserPreferences(
      userId, 
      parseInt(workspaceId), 
      parseInt(threadId)
    );
    
    res.json({
      success: true,
      subscribed: preferences?.thread_immediate === true,
      subscription: {
        immediate: preferences?.thread_immediate,
        inherited: preferences?.thread_immediate === null
      }
    });
    
  } catch (error) {
    console.error('Failed to get thread subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get thread subscription status'
    });
  }
});

// Subscribe/unsubscribe to thread immediate notifications
router.post('/thread/:threadId/subscribe', authenticateUser, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { workspaceId, immediate = true } = req.body;
    const userId = req.user.uid;
    
    const preferences = {
      workspaceId: parseInt(workspaceId),
      threadId: parseInt(threadId),
      threadImmediate: immediate
    };
    
    await emailNotificationService.saveUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      message: immediate ? 
        'Subscribed to immediate notifications for this thread' :
        'Unsubscribed from immediate notifications for this thread'
    });
    
  } catch (error) {
    console.error('Failed to update thread subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update thread subscription'
    });
  }
});

// Get workspace-specific subscription status
router.get('/workspace/:workspaceId/subscription', authenticateUser, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.uid;
    
    const preferences = await emailNotificationService.getUserPreferences(
      userId, 
      parseInt(workspaceId), 
      null
    );
    
    res.json({
      success: true,
      subscribed: preferences?.workspace_immediate === true,
      subscription: {
        immediate: preferences?.workspace_immediate,
        inherited: preferences?.workspace_immediate === null
      }
    });
    
  } catch (error) {
    console.error('Failed to get workspace subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workspace subscription status'
    });
  }
});

// Subscribe/unsubscribe to workspace immediate notifications
router.post('/workspace/:workspaceId/subscribe', authenticateUser, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { immediate = true } = req.body;
    const userId = req.user.uid;
    
    const preferences = {
      workspaceId: parseInt(workspaceId),
      workspaceImmediate: immediate
    };
    
    await emailNotificationService.saveUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      message: immediate ? 
        'Subscribed to immediate notifications for this workspace' :
        'Unsubscribed from immediate notifications for this workspace'
    });
    
  } catch (error) {
    console.error('Failed to update workspace subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workspace subscription'
    });
  }
});

// Test email notification (for debugging)
router.post('/test', authenticateUser, async (req, res) => {
  try {
    const { type = 'mention', workspaceId, threadId } = req.body;
    const userId = req.user.uid;
    
    // Queue a test notification
    await emailNotificationService.queueNotification({
      userId,
      workspaceId: parseInt(workspaceId),
      threadId: threadId ? parseInt(threadId) : null,
      notificationType: type,
      priority: 'immediate',
      senderName: 'Test User',
      senderEmail: 'test@example.com',
      messageContent: 'This is a test notification to verify your email settings are working correctly.',
      messageTimestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Test email notification queued successfully'
    });
    
  } catch (error) {
    console.error('Failed to send test email notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email notification'
    });
  }
});

// Get notification queue status (admin/debugging)
router.get('/queue/status', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const query = `
      SELECT 
        status,
        priority,
        notification_type,
        COUNT(*) as count
      FROM email_notification_queue 
      WHERE user_id = $1
      GROUP BY status, priority, notification_type
      ORDER BY status, priority, notification_type
    `;
    
    const result = await emailNotificationService.pool.query(query, [userId]);
    
    res.json({
      success: true,
      queueStatus: result.rows
    });
    
  } catch (error) {
    console.error('Failed to get queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status'
    });
  }
});

// Clear failed notifications for user
router.post('/queue/clear-failed', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const query = `
      DELETE FROM email_notification_queue 
      WHERE user_id = $1 AND status = 'failed'
    `;
    
    const result = await emailNotificationService.pool.query(query, [userId]);
    
    res.json({
      success: true,
      message: `Cleared ${result.rowCount} failed notifications`,
      clearedCount: result.rowCount
    });
    
  } catch (error) {
    console.error('Failed to clear failed notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear failed notifications'
    });
  }
});

// Get user activity status
router.get('/activity', authenticateUser, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const userId = req.user.uid;
    
    const query = `
      SELECT 
        workspace_id,
        last_active,
        is_online,
        last_socket_connection
      FROM user_activity 
      WHERE user_id = $1 ${workspaceId ? 'AND workspace_id = $2' : ''}
      ORDER BY last_active DESC
    `;
    
    const params = workspaceId ? [userId, parseInt(workspaceId)] : [userId];
    const result = await emailNotificationService.pool.query(query, params);
    
    res.json({
      success: true,
      activity: result.rows
    });
    
  } catch (error) {
    console.error('Failed to get user activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user activity'
    });
  }
});

module.exports = router;
