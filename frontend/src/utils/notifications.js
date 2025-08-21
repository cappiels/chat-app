import soundManager from './soundManager.js';

class NotificationManager {
  constructor() {
    this.permission = null;
    this.isSupported = 'Notification' in window;
    this.soundEnabled = true;
    this.settings = {
      mentions: true,
      directMessages: true,
      allMessages: false,
      soundEnabled: true,
      desktopNotifications: true,
    };
    
    // Load settings from localStorage
    this.loadSettings();
    
    // Request permission on first use
    this.checkPermission();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save notification settings:', error);
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  async checkPermission() {
    if (!this.isSupported) {
      console.log('🔕 Browser notifications not supported');
      return false;
    }

    this.permission = Notification.permission;
    
    if (this.permission === 'granted') {
      console.log('✅ Notification permission granted');
      return true;
    } else if (this.permission === 'denied') {
      console.log('❌ Notification permission denied');
      return false;
    } else {
      console.log('❓ Notification permission not determined');
      return false;
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      console.log('🔔 Requesting notification permission...');
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        this.showWelcomeNotification();
        return true;
      } else {
        console.log('❌ Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  showWelcomeNotification() {
    this.showNotification('ChatFlow Notifications Enabled', {
      body: 'You\'ll now receive desktop notifications for important messages.',
      icon: '/vite.svg',
      tag: 'welcome'
    });
  }

  shouldShowNotification(type, message, currentThread) {
    // Don't show notifications if user is currently viewing the thread
    if (message.thread_id === currentThread) {
      return false;
    }

    // Check user settings
    switch (type) {
      case 'mention':
        return this.settings.mentions;
      case 'direct_message':
        return this.settings.directMessages;
      case 'message':
        return this.settings.allMessages;
      default:
        return false;
    }
  }

  showNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted' || !this.settings.desktopNotifications) {
      return null;
    }

    const defaultOptions = {
      icon: '/vite.svg',
      badge: '/vite.svg',
      requireInteraction: false,
      silent: !this.settings.soundEnabled,
      timestamp: Date.now(),
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto-close after 5 seconds unless requireInteraction is true
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      // Handle click events
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Call custom click handler if provided
        if (options.onClick) {
          options.onClick();
        }
      };

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  showMessageNotification(message, type = 'message', currentThread = null, currentWorkspace = null) {
    if (!this.shouldShowNotification(type, message, currentThread)) {
      return null;
    }

    const senderName = message.sender_name || message.user?.display_name || 'Someone';
    const threadName = message.thread_name || 'a channel';
    const content = message.content || 'sent a message';
    
    // Determine sound context for different notification types
    const soundContext = {
      isMention: type === 'mention',
      isDirect: type === 'direct_message',
      isDifferentThread: currentThread && message.thread_id !== currentThread,
      isDifferentWorkspace: currentWorkspace && message.workspace_id !== currentWorkspace
    };

    // Play appropriate notification sound
    this.playNotificationSound(type, soundContext);
    
    let title, body, tag;
    
    switch (type) {
      case 'mention':
        title = `${senderName} mentioned you`;
        body = `in #${threadName}: ${this.truncateText(content, 100)}`;
        tag = `mention-${message.id}`;
        break;
        
      case 'direct_message':
        title = `New message from ${senderName}`;
        body = this.truncateText(content, 100);
        tag = `dm-${message.thread_id}`;
        break;
        
      case 'message':
        title = `New message in #${threadName}`;
        body = `${senderName}: ${this.truncateText(content, 100)}`;
        tag = `message-${message.thread_id}`;
        break;
        
      default:
        return null;
    }

    return this.showNotification(title, {
      body,
      tag,
      icon: message.sender_avatar || '/vite.svg',
      data: {
        messageId: message.id,
        threadId: message.thread_id,
        workspaceId: message.workspace_id,
        type
      },
      onClick: () => {
        // Focus the thread/channel where the message was sent
        if (message.thread_id) {
          this.focusThread(message.thread_id, message.workspace_id);
        }
      }
    });
  }

  showTypingNotification(users, threadName) {
    if (!this.settings.desktopNotifications) return null;

    const userNames = users.map(u => u.user.display_name).join(', ');
    const title = users.length === 1 ? 
      `${userNames} is typing...` : 
      `${userNames} are typing...`;
    
    return this.showNotification(title, {
      body: `in #${threadName}`,
      tag: `typing-${threadName}`,
      silent: true,
      requireInteraction: false
    });
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  focusThread(threadId, workspaceId) {
    // This would typically trigger navigation to the specific thread
    // Implementation depends on your routing system
    console.log('📍 Focus thread:', threadId, 'in workspace:', workspaceId);
    
    // Example: dispatch custom event that the app can listen to
    window.dispatchEvent(new CustomEvent('focusThread', {
      detail: { threadId, workspaceId }
    }));
  }

  playNotificationSound(type = 'message', context = {}) {
    if (!this.settings.soundEnabled) return;
    
    try {
      soundManager.playMessageReceived(context);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }

  // Method to play sound when user sends a message
  playMessageSentSound() {
    if (!this.settings.soundEnabled) return;
    soundManager.playMessageSent();
  }

  // Method to play typing sound
  playTypingSound() {
    if (!this.settings.soundEnabled) return;
    soundManager.playTyping();
  }

  // Method to play connection status sounds
  playConnectionSound(connected) {
    if (!this.settings.soundEnabled) return;
    soundManager.playConnectionChange(connected);
  }

  // Method to play error sound
  playErrorSound() {
    if (!this.settings.soundEnabled) return;
    soundManager.playError();
  }

  // Get combined settings from both notification and sound managers
  getAllSettings() {
    return {
      notifications: this.getSettings(),
      sounds: soundManager.getSettings()
    };
  }

  // Update sound settings
  updateSoundSettings(newSettings) {
    soundManager.updateSettings(newSettings);
  }

  // Enable/disable sounds globally
  setSoundEnabled(enabled) {
    this.settings.soundEnabled = enabled;
    soundManager.setEnabled(enabled);
    this.saveSettings();
  }

  // Set master volume for all sounds
  setSoundVolume(volume) {
    soundManager.setVolume(volume);
  }

  // Enable/disable specific sound types
  setSoundTypeEnabled(soundType, enabled) {
    soundManager.setSoundEnabled(soundType, enabled);
  }

  // Test sound functionality
  testSound(soundType) {
    soundManager.testSound(soundType);
  }

  testAllSounds() {
    soundManager.testAllSounds();
  }

  clearNotifications(tag = null) {
    // Clear specific notifications by tag if supported
    // Note: This is limited by browser security policies
    console.log('🔕 Clearing notifications:', tag || 'all');
  }

  getSettings() {
    return { ...this.settings };
  }

  isPermissionGranted() {
    return this.permission === 'granted';
  }

  isSupported() {
    return this.isSupported;
  }
}

// Export singleton instance
const notificationManager = new NotificationManager();
export default notificationManager;
