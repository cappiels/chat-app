const admin = require('firebase-admin');
const { Pool } = require('pg');
const cron = require('node-cron');
require('dotenv').config();

class PushNotificationService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    this.isProcessing = false;
    this.queueProcessingInterval = null;
    this.cleanupJob = null;

    // Ensure Firebase Admin is initialized (should be done in auth.js already)
    if (!admin.apps.length) {
      console.warn('Firebase Admin not initialized. Push notifications may not work.');
    }
  }

  // =====================================================
  // Initialization
  // =====================================================

  startBackgroundProcessing() {
    console.log('🔔 Starting push notification background processing...');

    // Process notification queue every 5 seconds
    this.queueProcessingInterval = setInterval(() => {
      this.processNotificationQueue();
    }, 5000);

    // Cleanup expired tokens daily at 3 AM
    this.cleanupJob = cron.schedule('0 3 * * *', () => {
      this.cleanupExpiredTokens();
    });

    console.log('✅ Push notification service started');
  }

  // =====================================================
  // Device Token Management
  // =====================================================

  async registerDeviceToken(userId, token, platform, deviceInfo = {}) {
    try {
      const query = `
        INSERT INTO user_device_tokens (user_id, device_token, platform, device_info, is_active, last_used_at)
        VALUES ($1, $2, $3, $4, TRUE, NOW())
        ON CONFLICT (user_id, device_token)
        DO UPDATE SET
          platform = $3,
          device_info = $4,
          is_active = TRUE,
          last_used_at = NOW()
        RETURNING id
      `;

      const result = await this.pool.query(query, [userId, token, platform, JSON.stringify(deviceInfo)]);
      console.log(`📱 Registered device token for user ${userId} (${platform})`);
      return result.rows[0].id;

    } catch (error) {
      console.error('Failed to register device token:', error);
      throw error;
    }
  }

  async unregisterDeviceToken(userId, token) {
    try {
      const query = `
        UPDATE user_device_tokens
        SET is_active = FALSE
        WHERE user_id = $1 AND device_token = $2
        RETURNING id
      `;

      const result = await this.pool.query(query, [userId, token]);
      if (result.rows.length > 0) {
        console.log(`📱 Unregistered device token for user ${userId}`);
      }
      return result.rows[0]?.id;

    } catch (error) {
      console.error('Failed to unregister device token:', error);
      throw error;
    }
  }

  async refreshDeviceToken(userId, oldToken, newToken) {
    try {
      const query = `
        UPDATE user_device_tokens
        SET device_token = $3, last_used_at = NOW()
        WHERE user_id = $1 AND device_token = $2
        RETURNING id
      `;

      const result = await this.pool.query(query, [userId, oldToken, newToken]);

      if (result.rows.length === 0) {
        // Old token doesn't exist, register the new one
        return await this.registerDeviceToken(userId, newToken, 'ios', {});
      }

      console.log(`📱 Refreshed device token for user ${userId}`);
      return result.rows[0].id;

    } catch (error) {
      console.error('Failed to refresh device token:', error);
      throw error;
    }
  }

  async getActiveTokensForUser(userId) {
    try {
      const query = `
        SELECT id, device_token, platform
        FROM user_device_tokens
        WHERE user_id = $1 AND is_active = TRUE
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;

    } catch (error) {
      console.error('Failed to get active tokens:', error);
      return [];
    }
  }

  // =====================================================
  // Preference Checks
  // =====================================================

  async shouldSendNotification(userId, workspaceId, threadId, notificationType) {
    try {
      // First check if user has any active device tokens
      const tokens = await this.getActiveTokensForUser(userId);
      if (tokens.length === 0) {
        return false;
      }

      // Check if user is currently online (skip push if they're active)
      const isOnline = await this.isUserOnline(userId, workspaceId);
      if (isOnline) {
        return false;
      }

      // Get effective preferences
      const prefs = await this.getEffectivePreferences(userId, workspaceId, threadId);

      if (!prefs || !prefs.push_enabled) {
        return false;
      }

      // Check DND
      if (await this.isUserInDND(userId)) {
        // During DND, only allow mentions if configured
        if (prefs.dnd_allow_mentions && notificationType === 'mention') {
          return true;
        }
        return false;
      }

      // Check quiet hours
      if (await this.isUserInQuietHours(userId)) {
        return false;
      }

      // Check mute status
      const muteStatus = prefs.mute_level;
      if (muteStatus === 'all') {
        return false;
      }
      if (muteStatus === 'mentions_only' && notificationType !== 'mention') {
        return false;
      }

      // Check specific notification type preferences
      switch (notificationType) {
        case 'mention':
          return prefs.notify_mentions !== false;
        case 'direct_message':
          return prefs.notify_direct_messages !== false;
        case 'thread_reply':
          return prefs.notify_thread_replies !== false;
        case 'task_assigned':
          return prefs.notify_task_assigned !== false;
        case 'task_due':
          return prefs.notify_task_due !== false;
        case 'task_completed':
          return prefs.notify_task_completed !== false;
        case 'workspace_invite':
          return prefs.notify_workspace_invites !== false;
        case 'message':
          return prefs.notify_all_messages === true;
        default:
          return true;
      }

    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return false;
    }
  }

  async isUserOnline(userId, workspaceId) {
    try {
      const query = `
        SELECT is_online, last_active
        FROM user_activity
        WHERE user_id = $1 AND (workspace_id = $2 OR workspace_id IS NULL)
        ORDER BY last_active DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId, workspaceId]);

      if (result.rows.length === 0) return false;

      const { is_online, last_active } = result.rows[0];
      const lastActiveTime = new Date(last_active);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      return is_online || lastActiveTime > twoMinutesAgo;

    } catch (error) {
      return false;
    }
  }

  async isUserInDND(userId) {
    try {
      const query = `
        SELECT dnd_enabled, dnd_start_time, dnd_end_time, dnd_timezone
        FROM push_notification_preferences
        WHERE user_id = $1 AND workspace_id IS NULL AND thread_id IS NULL
      `;

      const result = await this.pool.query(query, [userId]);

      if (result.rows.length === 0 || !result.rows[0].dnd_enabled) {
        return false;
      }

      const { dnd_start_time, dnd_end_time, dnd_timezone } = result.rows[0];

      if (!dnd_start_time || !dnd_end_time) return false;

      // Get current time in user's timezone
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: dnd_timezone || 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const currentTime = formatter.format(now);
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMin;

      const [startHour, startMin] = dnd_start_time.split(':').map(Number);
      const [endHour, endMin] = dnd_end_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Handle overnight DND (e.g., 22:00 to 08:00)
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;

    } catch (error) {
      console.error('Error checking DND status:', error);
      return false;
    }
  }

  async isUserInQuietHours(userId) {
    try {
      const query = `
        SELECT quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
               quiet_hours_weekends_only, dnd_timezone
        FROM push_notification_preferences
        WHERE user_id = $1 AND workspace_id IS NULL AND thread_id IS NULL
      `;

      const result = await this.pool.query(query, [userId]);

      if (result.rows.length === 0 || !result.rows[0].quiet_hours_enabled) {
        return false;
      }

      const prefs = result.rows[0];

      if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;

      // Check if weekends only
      if (prefs.quiet_hours_weekends_only) {
        const now = new Date();
        const day = now.getDay();
        if (day !== 0 && day !== 6) return false; // Not weekend
      }

      // Same time comparison logic as DND
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: prefs.dnd_timezone || 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const currentTime = formatter.format(now);
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const currentMinutes = currentHour * 60 + currentMin;

      const [startHour, startMin] = prefs.quiet_hours_start.split(':').map(Number);
      const [endHour, endMin] = prefs.quiet_hours_end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;

    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return false;
    }
  }

  async getEffectivePreferences(userId, workspaceId = null, threadId = null) {
    try {
      // Get global preferences
      const globalQuery = `
        SELECT * FROM push_notification_preferences
        WHERE user_id = $1 AND workspace_id IS NULL AND thread_id IS NULL
      `;
      const globalResult = await this.pool.query(globalQuery, [userId]);
      const globalPrefs = globalResult.rows[0] || this.getDefaultPreferences();

      // Get workspace preferences if applicable
      let workspacePrefs = null;
      if (workspaceId) {
        const workspaceQuery = `
          SELECT * FROM push_notification_preferences
          WHERE user_id = $1 AND workspace_id = $2 AND thread_id IS NULL
        `;
        const workspaceResult = await this.pool.query(workspaceQuery, [userId, workspaceId]);
        workspacePrefs = workspaceResult.rows[0];
      }

      // Get thread preferences if applicable
      let threadPrefs = null;
      if (threadId) {
        const threadQuery = `
          SELECT * FROM push_notification_preferences
          WHERE user_id = $1 AND thread_id = $2
        `;
        const threadResult = await this.pool.query(threadQuery, [userId, threadId]);
        threadPrefs = threadResult.rows[0];
      }

      // Merge preferences (thread > workspace > global)
      return {
        push_enabled: globalPrefs.push_enabled ?? true,
        sound_enabled: globalPrefs.sound_enabled ?? true,
        badge_enabled: globalPrefs.badge_enabled ?? true,
        notify_all_messages: threadPrefs?.notify_all_messages ?? workspacePrefs?.notify_all_messages ?? globalPrefs.notify_all_messages ?? false,
        notify_mentions: threadPrefs?.notify_mentions ?? workspacePrefs?.notify_mentions ?? globalPrefs.notify_mentions ?? true,
        notify_direct_messages: threadPrefs?.notify_direct_messages ?? workspacePrefs?.notify_direct_messages ?? globalPrefs.notify_direct_messages ?? true,
        notify_thread_replies: threadPrefs?.notify_thread_replies ?? workspacePrefs?.notify_thread_replies ?? globalPrefs.notify_thread_replies ?? true,
        notify_task_assigned: workspacePrefs?.notify_task_assigned ?? globalPrefs.notify_task_assigned ?? true,
        notify_task_due: workspacePrefs?.notify_task_due ?? globalPrefs.notify_task_due ?? true,
        notify_task_completed: workspacePrefs?.notify_task_completed ?? globalPrefs.notify_task_completed ?? true,
        notify_workspace_invites: globalPrefs.notify_workspace_invites ?? true,
        mute_level: threadPrefs?.mute_level ?? workspacePrefs?.mute_level ?? 'none',
        muted_until: threadPrefs?.muted_until ?? workspacePrefs?.muted_until ?? null,
        dnd_enabled: globalPrefs.dnd_enabled ?? false,
        dnd_allow_mentions: globalPrefs.dnd_allow_mentions ?? true,
        show_message_preview: globalPrefs.show_message_preview ?? true
      };

    } catch (error) {
      console.error('Error getting effective preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  getDefaultPreferences() {
    return {
      push_enabled: true,
      sound_enabled: true,
      badge_enabled: true,
      notify_all_messages: false,
      notify_mentions: true,
      notify_direct_messages: true,
      notify_thread_replies: true,
      notify_task_assigned: true,
      notify_task_due: true,
      notify_task_completed: true,
      notify_workspace_invites: true,
      mute_level: 'none',
      muted_until: null,
      dnd_enabled: false,
      dnd_allow_mentions: true,
      show_message_preview: true
    };
  }

  // =====================================================
  // Queue & Send Notifications
  // =====================================================

  async queueNotification({
    userId,
    workspaceId = null,
    threadId = null,
    messageId = null,
    notificationType,
    title,
    body,
    data = {},
    category = null,
    priority = 'high'
  }) {
    try {
      // Check if we should even queue this notification
      const shouldSend = await this.shouldSendNotification(userId, workspaceId, threadId, notificationType);

      if (!shouldSend) {
        console.log(`⏭️ Skipping notification for user ${userId} (preferences/online)`);
        return null;
      }

      // Get badge count
      const badgeCount = await this.getTotalBadgeCount(userId);

      const query = `
        INSERT INTO push_notification_queue
        (user_id, workspace_id, thread_id, message_id, notification_type, title, body, data,
         badge_count, category, priority, status, scheduled_for)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW())
        RETURNING id
      `;

      const result = await this.pool.query(query, [
        userId, workspaceId, threadId, messageId, notificationType, title, body,
        JSON.stringify(data), badgeCount + 1, category, priority
      ]);

      console.log(`🔔 Queued ${notificationType} notification for user ${userId}`);
      return result.rows[0].id;

    } catch (error) {
      console.error('Failed to queue push notification:', error);
      throw error;
    }
  }

  async processNotificationQueue() {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;

      const query = `
        SELECT * FROM push_notification_queue
        WHERE status = 'pending' AND scheduled_for <= NOW()
        ORDER BY priority DESC, created_at ASC
        LIMIT 50
      `;

      const result = await this.pool.query(query);

      for (const notification of result.rows) {
        await this.sendNotification(notification);
      }

    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async sendNotification(notification) {
    try {
      // Mark as processing
      await this.pool.query(
        "UPDATE push_notification_queue SET status = 'processing' WHERE id = $1",
        [notification.id]
      );

      // Get user's device tokens
      const tokens = await this.getActiveTokensForUser(notification.user_id);

      if (tokens.length === 0) {
        await this.pool.query(
          "UPDATE push_notification_queue SET status = 'cancelled', last_error = 'No active device tokens' WHERE id = $1",
          [notification.id]
        );
        return;
      }

      // Get user preferences for sound/preview settings
      const prefs = await this.getEffectivePreferences(notification.user_id, notification.workspace_id);

      const failedTokens = [];
      let successCount = 0;

      for (const tokenRecord of tokens) {
        try {
          const message = this.buildFCMMessage(notification, tokenRecord, prefs);
          const fcmResult = await admin.messaging().send(message);

          // Log success
          await this.logDelivery(notification.id, notification.user_id, tokenRecord.id, true, fcmResult);
          successCount++;

        } catch (fcmError) {
          console.error(`FCM send error for token ${tokenRecord.id}:`, fcmError.code, fcmError.message);

          // Log failure
          await this.logDelivery(notification.id, notification.user_id, tokenRecord.id, false, null, fcmError.code, fcmError.message);
          failedTokens.push({ id: tokenRecord.id, error: fcmError.code });

          // Handle invalid tokens
          if (fcmError.code === 'messaging/registration-token-not-registered' ||
              fcmError.code === 'messaging/invalid-registration-token') {
            await this.unregisterDeviceToken(notification.user_id, tokenRecord.device_token);
          }
        }
      }

      // Update queue status
      if (successCount > 0) {
        await this.pool.query(
          "UPDATE push_notification_queue SET status = 'sent', sent_at = NOW(), failed_tokens = $2 WHERE id = $1",
          [notification.id, JSON.stringify(failedTokens)]
        );
        console.log(`✅ Sent push notification to ${successCount} device(s) for user ${notification.user_id}`);
      } else {
        await this.pool.query(
          "UPDATE push_notification_queue SET status = 'failed', retry_count = retry_count + 1, last_error = $2, failed_tokens = $3 WHERE id = $1",
          [notification.id, 'All tokens failed', JSON.stringify(failedTokens)]
        );
      }

    } catch (error) {
      console.error(`Failed to send notification ${notification.id}:`, error);

      await this.pool.query(
        "UPDATE push_notification_queue SET status = 'failed', retry_count = retry_count + 1, last_error = $2 WHERE id = $1",
        [notification.id, error.message]
      );
    }
  }

  buildFCMMessage(notification, tokenRecord, prefs) {
    const data = typeof notification.data === 'string'
      ? JSON.parse(notification.data)
      : notification.data || {};

    // Base message
    const message = {
      token: tokenRecord.device_token,
      data: {
        notificationType: notification.notification_type,
        workspaceId: notification.workspace_id || '',
        threadId: notification.thread_id || '',
        messageId: notification.message_id || '',
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      }
    };

    // Platform-specific configuration
    if (tokenRecord.platform === 'ios') {
      message.apns = {
        headers: {
          'apns-priority': notification.priority === 'high' ? '10' : '5',
          'apns-push-type': 'alert'
        },
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: prefs.show_message_preview ? notification.body : 'New notification'
            },
            badge: notification.badge_count || 1,
            sound: prefs.sound_enabled ? 'default' : null,
            'mutable-content': 1,
            'thread-id': notification.thread_id || notification.workspace_id || 'default'
          }
        }
      };

      if (notification.category) {
        message.apns.payload.aps.category = notification.category;
      }
    } else if (tokenRecord.platform === 'android') {
      message.android = {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          title: notification.title,
          body: prefs.show_message_preview ? notification.body : 'New notification',
          channelId: `crew_${notification.notification_type}`,
          icon: 'ic_notification',
          color: '#4f46e5'
        }
      };
    }

    return message;
  }

  async logDelivery(queueId, userId, tokenId, success, fcmMessageId = null, errorCode = null, errorMessage = null) {
    try {
      const query = `
        INSERT INTO push_notification_log
        (queue_id, user_id, device_token_id, success, fcm_message_id, error_code, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await this.pool.query(query, [queueId, userId, tokenId, success, fcmMessageId, errorCode, errorMessage]);

    } catch (error) {
      console.error('Failed to log delivery:', error);
    }
  }

  // =====================================================
  // Badge Management
  // =====================================================

  async updateBadgeCount(userId, workspaceId, delta = 1) {
    try {
      const query = `
        INSERT INTO user_badge_counts (user_id, workspace_id, unread_messages)
        VALUES ($1, $2, GREATEST(0, $3))
        ON CONFLICT (user_id, workspace_id)
        DO UPDATE SET
          unread_messages = GREATEST(0, user_badge_counts.unread_messages + $3),
          last_updated_at = NOW()
        RETURNING unread_messages
      `;

      const result = await this.pool.query(query, [userId, workspaceId, delta]);
      return result.rows[0]?.unread_messages || 0;

    } catch (error) {
      console.error('Failed to update badge count:', error);
      return 0;
    }
  }

  async getTotalBadgeCount(userId) {
    try {
      const query = `
        SELECT COALESCE(SUM(unread_messages + unread_mentions + unread_direct_messages + unread_tasks), 0) as total
        FROM user_badge_counts
        WHERE user_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      return parseInt(result.rows[0]?.total || '0', 10);

    } catch (error) {
      console.error('Failed to get badge count:', error);
      return 0;
    }
  }

  async clearBadgeCount(userId, workspaceId = null) {
    try {
      if (workspaceId) {
        await this.pool.query(
          'UPDATE user_badge_counts SET unread_messages = 0, unread_mentions = 0, unread_direct_messages = 0, last_updated_at = NOW() WHERE user_id = $1 AND workspace_id = $2',
          [userId, workspaceId]
        );
      } else {
        await this.pool.query(
          'UPDATE user_badge_counts SET unread_messages = 0, unread_mentions = 0, unread_direct_messages = 0, unread_tasks = 0, last_updated_at = NOW() WHERE user_id = $1',
          [userId]
        );
      }
    } catch (error) {
      console.error('Failed to clear badge count:', error);
    }
  }

  // =====================================================
  // Preferences Management
  // =====================================================

  async getPreferences(userId, workspaceId = null, threadId = null) {
    try {
      const query = `
        SELECT * FROM push_notification_preferences
        WHERE user_id = $1
          AND (workspace_id = $2 OR ($2 IS NULL AND workspace_id IS NULL))
          AND (thread_id = $3 OR ($3 IS NULL AND thread_id IS NULL))
      `;

      const result = await this.pool.query(query, [userId, workspaceId, threadId]);
      return result.rows[0] || null;

    } catch (error) {
      console.error('Failed to get preferences:', error);
      return null;
    }
  }

  async savePreferences(userId, preferences) {
    try {
      const {
        workspaceId = null,
        threadId = null,
        pushEnabled = true,
        soundEnabled = true,
        badgeEnabled = true,
        vibrationEnabled = true,
        notifyAllMessages = false,
        notifyMentions = true,
        notifyDirectMessages = true,
        notifyThreadReplies = true,
        notifyTaskAssigned = true,
        notifyTaskDue = true,
        notifyTaskCompleted = true,
        notifyCalendarEvents = true,
        notifyWorkspaceInvites = true,
        muteLevel = 'none',
        mutedUntil = null,
        dndEnabled = false,
        dndStartTime = null,
        dndEndTime = null,
        dndTimezone = 'America/New_York',
        dndAllowMentions = true,
        quietHoursEnabled = false,
        quietHoursStart = null,
        quietHoursEnd = null,
        quietHoursWeekendsOnly = false,
        showMessagePreview = true,
        showSenderName = true
      } = preferences;

      const query = `
        INSERT INTO push_notification_preferences
        (user_id, workspace_id, thread_id, push_enabled, sound_enabled, badge_enabled, vibration_enabled,
         notify_all_messages, notify_mentions, notify_direct_messages, notify_thread_replies,
         notify_task_assigned, notify_task_due, notify_task_completed, notify_calendar_events,
         notify_workspace_invites, mute_level, muted_until, dnd_enabled, dnd_start_time, dnd_end_time,
         dnd_timezone, dnd_allow_mentions, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
         quiet_hours_weekends_only, show_message_preview, show_sender_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        ON CONFLICT (user_id, workspace_id, thread_id)
        DO UPDATE SET
          push_enabled = $4, sound_enabled = $5, badge_enabled = $6, vibration_enabled = $7,
          notify_all_messages = $8, notify_mentions = $9, notify_direct_messages = $10, notify_thread_replies = $11,
          notify_task_assigned = $12, notify_task_due = $13, notify_task_completed = $14, notify_calendar_events = $15,
          notify_workspace_invites = $16, mute_level = $17, muted_until = $18, dnd_enabled = $19,
          dnd_start_time = $20, dnd_end_time = $21, dnd_timezone = $22, dnd_allow_mentions = $23,
          quiet_hours_enabled = $24, quiet_hours_start = $25, quiet_hours_end = $26, quiet_hours_weekends_only = $27,
          show_message_preview = $28, show_sender_name = $29, updated_at = NOW()
        RETURNING id
      `;

      const result = await this.pool.query(query, [
        userId, workspaceId, threadId, pushEnabled, soundEnabled, badgeEnabled, vibrationEnabled,
        notifyAllMessages, notifyMentions, notifyDirectMessages, notifyThreadReplies,
        notifyTaskAssigned, notifyTaskDue, notifyTaskCompleted, notifyCalendarEvents,
        notifyWorkspaceInvites, muteLevel, mutedUntil, dndEnabled, dndStartTime, dndEndTime,
        dndTimezone, dndAllowMentions, quietHoursEnabled, quietHoursStart, quietHoursEnd,
        quietHoursWeekendsOnly, showMessagePreview, showSenderName
      ]);

      return result.rows[0];

    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  }

  async muteWorkspace(userId, workspaceId, muteLevel = 'all', duration = null) {
    const mutedUntil = duration ? new Date(Date.now() + duration) : null;

    return await this.savePreferences(userId, {
      workspaceId,
      muteLevel,
      mutedUntil
    });
  }

  async muteThread(userId, threadId, muteLevel = 'all', duration = null) {
    const mutedUntil = duration ? new Date(Date.now() + duration) : null;

    return await this.savePreferences(userId, {
      threadId,
      muteLevel,
      mutedUntil
    });
  }

  async unmuteWorkspace(userId, workspaceId) {
    return await this.savePreferences(userId, {
      workspaceId,
      muteLevel: 'none',
      mutedUntil: null
    });
  }

  async unmuteThread(userId, threadId) {
    return await this.savePreferences(userId, {
      threadId,
      muteLevel: 'none',
      mutedUntil: null
    });
  }

  // =====================================================
  // Cleanup
  // =====================================================

  async cleanupExpiredTokens() {
    try {
      // Deactivate tokens not used in 90 days
      const result = await this.pool.query(`
        UPDATE user_device_tokens
        SET is_active = FALSE
        WHERE last_used_at < NOW() - INTERVAL '90 days' AND is_active = TRUE
        RETURNING id
      `);

      if (result.rowCount > 0) {
        console.log(`🧹 Deactivated ${result.rowCount} expired device tokens`);
      }

      // Clear old unmuted entries
      await this.pool.query(`
        UPDATE push_notification_preferences
        SET mute_level = 'none', muted_until = NULL
        WHERE muted_until IS NOT NULL AND muted_until < NOW()
      `);

      // Delete old queue entries
      await this.pool.query(`
        DELETE FROM push_notification_queue
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);

      // Delete old logs
      await this.pool.query(`
        DELETE FROM push_notification_log
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }

  // =====================================================
  // Convenience Methods for Common Notifications
  // =====================================================

  async notifyMention(userId, workspaceId, threadId, messageId, senderName, channelName, messagePreview) {
    return await this.queueNotification({
      userId,
      workspaceId,
      threadId,
      messageId,
      notificationType: 'mention',
      title: `${senderName} mentioned you`,
      body: `in #${channelName}: ${messagePreview.substring(0, 100)}`,
      data: { senderName, channelName },
      category: 'MESSAGE_REPLY'
    });
  }

  async notifyDirectMessage(userId, workspaceId, threadId, messageId, senderName, messagePreview) {
    return await this.queueNotification({
      userId,
      workspaceId,
      threadId,
      messageId,
      notificationType: 'direct_message',
      title: senderName,
      body: messagePreview.substring(0, 100),
      data: { senderName },
      category: 'MESSAGE_REPLY'
    });
  }

  async notifyThreadReply(userId, workspaceId, threadId, messageId, senderName, channelName, messagePreview) {
    return await this.queueNotification({
      userId,
      workspaceId,
      threadId,
      messageId,
      notificationType: 'thread_reply',
      title: `${senderName} replied`,
      body: `in #${channelName}: ${messagePreview.substring(0, 100)}`,
      data: { senderName, channelName },
      category: 'MESSAGE_REPLY'
    });
  }

  async notifyTaskAssigned(userId, workspaceId, taskId, assignerName, taskTitle) {
    return await this.queueNotification({
      userId,
      workspaceId,
      notificationType: 'task_assigned',
      title: 'New task assigned',
      body: `${assignerName} assigned you: ${taskTitle}`,
      data: { taskId, assignerName, taskTitle }
    });
  }

  async notifyTaskDue(userId, workspaceId, taskId, taskTitle, dueDate) {
    return await this.queueNotification({
      userId,
      workspaceId,
      notificationType: 'task_due',
      title: 'Task due soon',
      body: taskTitle,
      data: { taskId, taskTitle, dueDate }
    });
  }

  async notifyWorkspaceInvite(userId, workspaceId, workspaceName, inviterName) {
    return await this.queueNotification({
      userId,
      workspaceId,
      notificationType: 'workspace_invite',
      title: 'Workspace invitation',
      body: `${inviterName} invited you to ${workspaceName}`,
      data: { workspaceName, inviterName }
    });
  }

  // =====================================================
  // Shutdown
  // =====================================================

  shutdown() {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
    }
    if (this.cleanupJob) {
      this.cleanupJob.destroy();
    }
    console.log('🛑 Push notification service stopped');
  }
}

// Export singleton instance
const pushNotificationService = new PushNotificationService();
module.exports = pushNotificationService;
