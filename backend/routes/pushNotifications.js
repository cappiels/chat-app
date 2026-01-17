const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const pushNotificationService = require('../services/pushNotificationService');

// All routes require authentication
router.use(authenticateUser);

// =====================================================
// Device Token Management
// =====================================================

/**
 * POST /api/push/register
 * Register a device token for push notifications
 */
router.post('/register', async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform, deviceInfo } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    if (!platform || !['ios', 'android', 'web', 'macos'].includes(platform)) {
      return res.status(400).json({ error: 'Valid platform is required (ios, android, web, macos)' });
    }

    const tokenId = await pushNotificationService.registerDeviceToken(userId, token, platform, deviceInfo || {});

    res.json({
      success: true,
      tokenId,
      message: 'Device registered for push notifications'
    });

  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

/**
 * DELETE /api/push/unregister
 * Unregister a device token
 */
router.delete('/unregister', async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    await pushNotificationService.unregisterDeviceToken(userId, token);

    res.json({
      success: true,
      message: 'Device unregistered from push notifications'
    });

  } catch (error) {
    console.error('Error unregistering device token:', error);
    res.status(500).json({ error: 'Failed to unregister device token' });
  }
});

/**
 * PUT /api/push/refresh-token
 * Refresh/update a device token (e.g., when FCM token changes)
 */
router.put('/refresh-token', async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldToken, newToken } = req.body;

    if (!oldToken || !newToken) {
      return res.status(400).json({ error: 'Both old and new tokens are required' });
    }

    const tokenId = await pushNotificationService.refreshDeviceToken(userId, oldToken, newToken);

    res.json({
      success: true,
      tokenId,
      message: 'Device token refreshed'
    });

  } catch (error) {
    console.error('Error refreshing device token:', error);
    res.status(500).json({ error: 'Failed to refresh device token' });
  }
});

// =====================================================
// Notification Preferences
// =====================================================

/**
 * GET /api/push/preferences
 * Get user's global notification preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, threadId } = req.query;

    const preferences = await pushNotificationService.getPreferences(
      userId,
      workspaceId || null,
      threadId || null
    );

    if (!preferences) {
      // Return default preferences if none exist
      return res.json(pushNotificationService.getDefaultPreferences());
    }

    res.json(preferences);

  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * POST /api/push/preferences
 * Save user's notification preferences (global or scoped)
 */
router.post('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    const result = await pushNotificationService.savePreferences(userId, preferences);

    res.json({
      success: true,
      id: result.id,
      message: 'Notification preferences saved'
    });

  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ error: 'Failed to save notification preferences' });
  }
});

/**
 * POST /api/push/preferences/workspace/:workspaceId
 * Save workspace-specific notification preferences
 */
router.post('/preferences/workspace/:workspaceId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const preferences = { ...req.body, workspaceId };

    const result = await pushNotificationService.savePreferences(userId, preferences);

    res.json({
      success: true,
      id: result.id,
      message: 'Workspace notification preferences saved'
    });

  } catch (error) {
    console.error('Error saving workspace preferences:', error);
    res.status(500).json({ error: 'Failed to save workspace notification preferences' });
  }
});

/**
 * POST /api/push/preferences/channel/:threadId
 * Save channel/thread-specific notification preferences
 */
router.post('/preferences/channel/:threadId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { threadId } = req.params;
    const preferences = { ...req.body, threadId };

    const result = await pushNotificationService.savePreferences(userId, preferences);

    res.json({
      success: true,
      id: result.id,
      message: 'Channel notification preferences saved'
    });

  } catch (error) {
    console.error('Error saving channel preferences:', error);
    res.status(500).json({ error: 'Failed to save channel notification preferences' });
  }
});

// =====================================================
// Muting
// =====================================================

/**
 * POST /api/push/mute/workspace/:workspaceId
 * Mute a workspace
 */
router.post('/mute/workspace/:workspaceId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;
    const { muteLevel = 'all', duration } = req.body;
    // duration in milliseconds: null = permanent, otherwise temporary

    await pushNotificationService.muteWorkspace(userId, workspaceId, muteLevel, duration);

    const message = duration
      ? `Workspace muted for ${Math.round(duration / 60000)} minutes`
      : 'Workspace muted';

    res.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Error muting workspace:', error);
    res.status(500).json({ error: 'Failed to mute workspace' });
  }
});

/**
 * DELETE /api/push/mute/workspace/:workspaceId
 * Unmute a workspace
 */
router.delete('/mute/workspace/:workspaceId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.params;

    await pushNotificationService.unmuteWorkspace(userId, workspaceId);

    res.json({
      success: true,
      message: 'Workspace unmuted'
    });

  } catch (error) {
    console.error('Error unmuting workspace:', error);
    res.status(500).json({ error: 'Failed to unmute workspace' });
  }
});

/**
 * POST /api/push/mute/channel/:threadId
 * Mute a channel/thread
 */
router.post('/mute/channel/:threadId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { threadId } = req.params;
    const { muteLevel = 'all', duration } = req.body;

    await pushNotificationService.muteThread(userId, threadId, muteLevel, duration);

    const message = duration
      ? `Channel muted for ${Math.round(duration / 60000)} minutes`
      : 'Channel muted';

    res.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Error muting channel:', error);
    res.status(500).json({ error: 'Failed to mute channel' });
  }
});

/**
 * DELETE /api/push/mute/channel/:threadId
 * Unmute a channel/thread
 */
router.delete('/mute/channel/:threadId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { threadId } = req.params;

    await pushNotificationService.unmuteThread(userId, threadId);

    res.json({
      success: true,
      message: 'Channel unmuted'
    });

  } catch (error) {
    console.error('Error unmuting channel:', error);
    res.status(500).json({ error: 'Failed to unmute channel' });
  }
});

// =====================================================
// Do Not Disturb
// =====================================================

/**
 * POST /api/push/dnd
 * Enable Do Not Disturb
 */
router.post('/dnd', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      enabled = true,
      startTime,
      endTime,
      timezone = 'America/New_York',
      allowMentions = true
    } = req.body;

    await pushNotificationService.savePreferences(userId, {
      dndEnabled: enabled,
      dndStartTime: startTime,
      dndEndTime: endTime,
      dndTimezone: timezone,
      dndAllowMentions: allowMentions
    });

    res.json({
      success: true,
      message: enabled ? 'Do Not Disturb enabled' : 'Do Not Disturb disabled'
    });

  } catch (error) {
    console.error('Error setting DND:', error);
    res.status(500).json({ error: 'Failed to set Do Not Disturb' });
  }
});

/**
 * DELETE /api/push/dnd
 * Disable Do Not Disturb
 */
router.delete('/dnd', async (req, res) => {
  try {
    const userId = req.user.id;

    await pushNotificationService.savePreferences(userId, {
      dndEnabled: false
    });

    res.json({
      success: true,
      message: 'Do Not Disturb disabled'
    });

  } catch (error) {
    console.error('Error disabling DND:', error);
    res.status(500).json({ error: 'Failed to disable Do Not Disturb' });
  }
});

// =====================================================
// Badge Count
// =====================================================

/**
 * GET /api/push/badge-count
 * Get user's total badge count
 */
router.get('/badge-count', async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await pushNotificationService.getTotalBadgeCount(userId);

    res.json({
      count
    });

  } catch (error) {
    console.error('Error getting badge count:', error);
    res.status(500).json({ error: 'Failed to get badge count' });
  }
});

/**
 * POST /api/push/badge-count/clear
 * Clear badge count (when user opens the app)
 */
router.post('/badge-count/clear', async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.body;

    await pushNotificationService.clearBadgeCount(userId, workspaceId);

    res.json({
      success: true,
      message: 'Badge count cleared'
    });

  } catch (error) {
    console.error('Error clearing badge count:', error);
    res.status(500).json({ error: 'Failed to clear badge count' });
  }
});

// =====================================================
// Testing
// =====================================================

/**
 * POST /api/push/test
 * Send a test push notification (development only)
 */
router.post('/test', async (req, res) => {
  try {
    const userId = req.user.id;
    const { title = 'Test Notification', body = 'This is a test push notification' } = req.body;

    const notificationId = await pushNotificationService.queueNotification({
      userId,
      notificationType: 'test',
      title,
      body,
      data: { test: true }
    });

    if (notificationId) {
      res.json({
        success: true,
        notificationId,
        message: 'Test notification queued'
      });
    } else {
      res.json({
        success: false,
        message: 'Notification not sent (check preferences or device registration)'
      });
    }

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = router;
