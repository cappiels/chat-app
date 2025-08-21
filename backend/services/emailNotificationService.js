const { Pool } = require('pg');
const emailService = require('./emailService');
const cron = require('node-cron');

class EmailNotificationService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    this.isProcessing = false;
    this.batchProcessingInterval = null;
    this.digestProcessingJob = null;
    
    // Start background processing
    this.startBackgroundProcessing();
  }

  startBackgroundProcessing() {
    console.log('🚀 Starting email notification background processing...');
    
    // Process immediate notifications every 30 seconds
    this.batchProcessingInterval = setInterval(() => {
      this.processImmediateNotifications();
    }, 30000);
    
    // Process batched notifications every 5 minutes
    setInterval(() => {
      this.processBatchedNotifications();
    }, 300000);
    
    // Process daily digests at 6 AM UTC (adjusts for timezones)
    this.digestProcessingJob = cron.schedule('0 6 * * *', () => {
      this.processDailyDigests();
    });
    
    console.log('✅ Email notification service started');
  }

  // Queue a notification for processing
  async queueNotification({
    userId,
    workspaceId,
    threadId = null,
    messageId = null,
    notificationType,
    priority = 'normal',
    senderName,
    senderEmail,
    messageContent,
    messageTimestamp = new Date()
  }) {
    try {
      const query = `
        INSERT INTO email_notification_queue 
        (user_id, workspace_id, thread_id, message_id, notification_type, priority, 
         sender_name, sender_email, message_content, message_timestamp, scheduled_for)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
      
      const scheduledFor = priority === 'immediate' ? new Date() : new Date(Date.now() + 2 * 60 * 1000);
      
      const result = await this.pool.query(query, [
        userId, workspaceId, threadId, messageId, notificationType, priority,
        senderName, senderEmail, messageContent, messageTimestamp, scheduledFor
      ]);
      
      console.log(`📧 Queued ${priority} ${notificationType} notification for user ${userId}`);
      return result.rows[0].id;
      
    } catch (error) {
      console.error('Failed to queue email notification:', error);
      throw error;
    }
  }

  // Check if user should receive email notifications
  async shouldSendEmailNotification(userId, workspaceId, threadId, notificationType) {
    try {
      // Check if user is currently online
      const activityQuery = `
        SELECT is_online, last_active 
        FROM user_activity 
        WHERE user_id = $1 AND workspace_id = $2
      `;
      const activityResult = await this.pool.query(activityQuery, [userId, workspaceId]);
      
      // If user is online and active within last 5 minutes, skip email
      if (activityResult.rows.length > 0) {
        const { is_online, last_active } = activityResult.rows[0];
        const lastActiveTime = new Date(last_active);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (is_online || lastActiveTime > fiveMinutesAgo) {
          return false;
        }
      }
      
      // Get user's email preferences
      const prefsQuery = `
        SELECT 
          enp.immediate_mentions,
          enp.immediate_direct_messages,
          enp.immediate_workspace_invites,
          enp.thread_immediate,
          enp.workspace_immediate,
          u.email
        FROM users u
        LEFT JOIN email_notification_preferences enp ON (
          u.id = enp.user_id AND 
          (enp.workspace_id = $2 OR enp.workspace_id IS NULL) AND
          (enp.thread_id = $3 OR enp.thread_id IS NULL)
        )
        WHERE u.id = $1
        ORDER BY enp.thread_id DESC, enp.workspace_id DESC
        LIMIT 1
      `;
      
      const prefsResult = await this.pool.query(prefsQuery, [userId, workspaceId, threadId]);
      
      if (prefsResult.rows.length === 0) {
        return false; // No user found or no email
      }
      
      const prefs = prefsResult.rows[0];
      
      // Check thread/workspace specific overrides first
      if (threadId && prefs.thread_immediate !== null) {
        return prefs.thread_immediate;
      }
      
      if (prefs.workspace_immediate !== null) {
        return prefs.workspace_immediate;
      }
      
      // Fall back to global preferences
      switch (notificationType) {
        case 'mention':
          return prefs.immediate_mentions !== false;
        case 'direct_message':
          return prefs.immediate_direct_messages !== false;
        case 'workspace_invite':
          return prefs.immediate_workspace_invites !== false;
        default:
          return false;
      }
      
    } catch (error) {
      console.error('Error checking email notification preferences:', error);
      return false;
    }
  }

  // Process immediate notifications
  async processImmediateNotifications() {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      
      const query = `
        SELECT enq.*, u.email, u.display_name, w.name as workspace_name, t.name as thread_name
        FROM email_notification_queue enq
        JOIN users u ON enq.user_id = u.id
        JOIN workspaces w ON enq.workspace_id = w.id
        LEFT JOIN threads t ON enq.thread_id = t.id
        WHERE enq.status = 'pending' 
          AND enq.priority = 'immediate'
          AND enq.scheduled_for <= NOW()
        ORDER BY enq.created_at
        LIMIT 20
      `;
      
      const result = await this.pool.query(query);
      
      for (const notification of result.rows) {
        await this.processNotification(notification);
      }
      
    } catch (error) {
      console.error('Error processing immediate notifications:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process batched notifications
  async processBatchedNotifications() {
    try {
      // Get users who have batched notifications enabled and pending
      const query = `
        SELECT DISTINCT enq.user_id, enq.workspace_id, u.email, enp.batched_frequency_minutes
        FROM email_notification_queue enq
        JOIN users u ON enq.user_id = u.id
        JOIN email_notification_preferences enp ON (
          u.id = enp.user_id AND 
          enp.workspace_id = enq.workspace_id AND
          enp.batched_enabled = true
        )
        WHERE enq.status = 'pending' 
          AND enq.priority = 'normal'
          AND enq.scheduled_for <= NOW()
      `;
      
      const result = await this.pool.query(query);
      
      for (const user of result.rows) {
        await this.processBatchedNotificationsForUser(user);
      }
      
    } catch (error) {
      console.error('Error processing batched notifications:', error);
    }
  }

  // Process single notification
  async processNotification(notification) {
    try {
      // Mark as processing
      await this.pool.query(
        'UPDATE email_notification_queue SET status = $1, processed_at = NOW() WHERE id = $2',
        ['processing', notification.id]
      );

      const emailData = await this.buildEmailContent(notification);
      
      if (emailData) {
        await emailService.sendEmail(emailData);
        
        // Mark as sent
        await this.pool.query(
          'UPDATE email_notification_queue SET status = $1 WHERE id = $2',
          ['sent', notification.id]
        );
        
        console.log(`✅ Sent ${notification.notification_type} email to ${notification.email}`);
      }
      
    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error);
      
      // Mark as failed and increment retry count
      await this.pool.query(`
        UPDATE email_notification_queue 
        SET status = $1, error_message = $2, retry_count = retry_count + 1
        WHERE id = $3
      `, ['failed', error.message, notification.id]);
    }
  }

  // Process batched notifications for a specific user
  async processBatchedNotificationsForUser({ user_id, workspace_id, email, batched_frequency_minutes }) {
    try {
      // Get all pending notifications for this user/workspace
      const query = `
        SELECT enq.*, t.name as thread_name
        FROM email_notification_queue enq
        LEFT JOIN threads t ON enq.thread_id = t.id
        WHERE enq.user_id = $1 
          AND enq.workspace_id = $2
          AND enq.status = 'pending'
          AND enq.priority = 'normal'
        ORDER BY enq.created_at
      `;
      
      const result = await this.pool.query(query, [user_id, workspace_id]);
      const notifications = result.rows;
      
      if (notifications.length === 0) return;
      
      // Check if enough time has passed since last batch
      const lastBatchTime = new Date(Date.now() - batched_frequency_minutes * 60 * 1000);
      const oldestNotification = new Date(notifications[0].created_at);
      
      if (oldestNotification > lastBatchTime) return; // Not time yet
      
      // Build batched email content
      const emailData = await this.buildBatchedEmailContent({
        userEmail: email,
        notifications,
        workspaceId: workspace_id
      });
      
      if (emailData) {
        await emailService.sendEmail(emailData);
        
        // Mark all notifications as sent
        const notificationIds = notifications.map(n => n.id);
        await this.pool.query(`
          UPDATE email_notification_queue 
          SET status = 'sent', processed_at = NOW() 
          WHERE id = ANY($1)
        `, [notificationIds]);
        
        console.log(`✅ Sent batched email with ${notifications.length} items to ${email}`);
      }
      
    } catch (error) {
      console.error(`Failed to process batched notifications for ${user_id}:`, error);
    }
  }

  // Build email content for single notification
  async buildEmailContent(notification) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    switch (notification.notification_type) {
      case 'mention':
        return {
          to: notification.email,
          subject: `${notification.sender_name} mentioned you in ${notification.workspace_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">💬 You were mentioned!</h2>
              <p><strong>${notification.sender_name}</strong> mentioned you in <strong>#${notification.thread_name || 'general'}</strong>:</p>
              <blockquote style="border-left: 4px solid #4f46e5; margin: 16px 0; padding: 16px; background: #f8fafc;">
                ${notification.message_content}
              </blockquote>
              <div style="margin-top: 24px;">
                <a href="${baseUrl}/#/workspace/${notification.workspace_id}" 
                   style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Message
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                <a href="${baseUrl}/#/settings/notifications">Manage notification preferences</a>
              </p>
            </div>
          `
        };

      case 'direct_message':
        return {
          to: notification.email,
          subject: `New message from ${notification.sender_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">📩 New Direct Message</h2>
              <p><strong>${notification.sender_name}</strong> sent you a message:</p>
              <blockquote style="border-left: 4px solid #4f46e5; margin: 16px 0; padding: 16px; background: #f8fafc;">
                ${notification.message_content}
              </blockquote>
              <div style="margin-top: 24px;">
                <a href="${baseUrl}/#/workspace/${notification.workspace_id}" 
                   style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reply
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                <a href="${baseUrl}/#/settings/notifications">Manage notification preferences</a>
              </p>
            </div>
          `
        };

      default:
        return null;
    }
  }

  // Build batched email content
  async buildBatchedEmailContent({ userEmail, notifications, workspaceId }) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const groupedNotifications = this.groupNotificationsByType(notifications);
    
    let contentSections = [];
    
    if (groupedNotifications.mentions.length > 0) {
      contentSections.push(`
        <h3 style="color: #4f46e5;">💬 Mentions (${groupedNotifications.mentions.length})</h3>
        ${groupedNotifications.mentions.map(n => `
          <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid #4f46e5; background: #f8fafc;">
            <p><strong>${n.sender_name}</strong> in <strong>#${n.thread_name}</strong>:</p>
            <p style="color: #6b7280;">${n.message_content.substring(0, 100)}...</p>
          </div>
        `).join('')}
      `);
    }
    
    if (groupedNotifications.messages.length > 0) {
      contentSections.push(`
        <h3 style="color: #4f46e5;">📩 New Messages (${groupedNotifications.messages.length})</h3>
        ${groupedNotifications.messages.map(n => `
          <div style="margin-bottom: 16px; padding: 12px; border-left: 4px solid #e5e7eb; background: #f9fafb;">
            <p><strong>${n.sender_name}</strong> in <strong>#${n.thread_name}</strong>:</p>
            <p style="color: #6b7280;">${n.message_content.substring(0, 100)}...</p>
          </div>
        `).join('')}
      `);
    }
    
    return {
      to: userEmail,
      subject: `Activity Summary - ${notifications.length} new items`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">📊 Your Activity Summary</h2>
          <p>Here's what happened while you were away:</p>
          ${contentSections.join('')}
          <div style="margin-top: 32px;">
            <a href="${baseUrl}/#/workspace/${workspaceId}" 
               style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View All Messages
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
            <a href="${baseUrl}/#/settings/notifications">Manage notification preferences</a>
          </p>
        </div>
      `
    };
  }

  // Group notifications by type for batched emails
  groupNotificationsByType(notifications) {
    return {
      mentions: notifications.filter(n => n.notification_type === 'mention'),
      messages: notifications.filter(n => n.notification_type === 'thread_message'),
      invites: notifications.filter(n => n.notification_type === 'workspace_invite')
    };
  }

  // Update user activity (called from socket events)
  async updateUserActivity(userId, workspaceId, isOnline = true) {
    try {
      const query = `
        INSERT INTO user_activity (user_id, workspace_id, last_active, is_online, last_socket_connection)
        VALUES ($1, $2, NOW(), $3, NOW())
        ON CONFLICT (user_id, workspace_id)
        DO UPDATE SET 
          last_active = NOW(),
          is_online = $3,
          last_socket_connection = CASE WHEN $3 THEN NOW() ELSE user_activity.last_socket_connection END
      `;
      
      await this.pool.query(query, [userId, workspaceId, isOnline]);
      
    } catch (error) {
      console.error('Failed to update user activity:', error);
    }
  }

  // Get user email notification preferences
  async getUserPreferences(userId, workspaceId = null, threadId = null) {
    try {
      const query = `
        SELECT * FROM email_notification_preferences
        WHERE user_id = $1 
          AND (workspace_id = $2 OR workspace_id IS NULL)
          AND (thread_id = $3 OR thread_id IS NULL)
        ORDER BY thread_id DESC, workspace_id DESC
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [userId, workspaceId, threadId]);
      return result.rows[0] || null;
      
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  // Save user email notification preferences
  async saveUserPreferences(userId, preferences) {
    try {
      const {
        workspaceId = null,
        threadId = null,
        immediateMentions = true,
        immediateDirectMessages = true,
        immediateWorkspaceInvites = true,
        batchedEnabled = true,
        batchedFrequencyMinutes = 30,
        digestEnabled = true,
        digestTime = '09:00:00',
        digestTimezone = 'America/New_York',
        threadImmediate = null,
        workspaceImmediate = null
      } = preferences;

      const query = `
        INSERT INTO email_notification_preferences 
        (user_id, workspace_id, thread_id, immediate_mentions, immediate_direct_messages, 
         immediate_workspace_invites, batched_enabled, batched_frequency_minutes, 
         digest_enabled, digest_time, digest_timezone, thread_immediate, workspace_immediate)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (user_id, workspace_id, thread_id)
        DO UPDATE SET
          immediate_mentions = $4,
          immediate_direct_messages = $5,
          immediate_workspace_invites = $6,
          batched_enabled = $7,
          batched_frequency_minutes = $8,
          digest_enabled = $9,
          digest_time = $10,
          digest_timezone = $11,
          thread_immediate = $12,
          workspace_immediate = $13,
          updated_at = NOW()
        RETURNING id
      `;
      
      const result = await this.pool.query(query, [
        userId, workspaceId, threadId, immediateMentions, immediateDirectMessages,
        immediateWorkspaceInvites, batchedEnabled, batchedFrequencyMinutes,
        digestEnabled, digestTime, digestTimezone, threadImmediate, workspaceImmediate
      ]);
      
      return result.rows[0];
      
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  // Cleanup old processed notifications
  async cleanup() {
    try {
      // Delete notifications older than 30 days
      await this.pool.query(`
        DELETE FROM email_notification_queue 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      // Delete old digest cache entries
      await this.pool.query(`
        DELETE FROM daily_digest_cache 
        WHERE digest_date < NOW() - INTERVAL '90 days'
      `);
      
      console.log('✅ Cleaned up old email notification records');
      
    } catch (error) {
      console.error('Failed to cleanup email notifications:', error);
    }
  }

  // Shutdown cleanup
  shutdown() {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
    }
    if (this.digestProcessingJob) {
      this.digestProcessingJob.destroy();
    }
    console.log('🛑 Email notification service stopped');
  }
}

module.exports = new EmailNotificationService();
