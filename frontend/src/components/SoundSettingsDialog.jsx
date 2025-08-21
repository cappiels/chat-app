import React, { useState, useEffect } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { Select } from './ui/Select';
import notificationManager from '../utils/notifications';
import soundManager from '../utils/soundManager';
import emailNotificationAPI from '../utils/emailNotificationAPI';

export default function SoundSettingsDialog({ open, onClose, workspace = null }) {
  const [settings, setSettings] = useState({
    notifications: {},
    sounds: {},
    email: {}
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, workspace]);

  const loadSettings = async () => {
    try {
      const allSettings = notificationManager.getAllSettings();
      
      // Load email preferences from backend
      let emailPreferences = {};
      try {
        const response = await emailNotificationAPI.getPreferences(workspace?.id);
        emailPreferences = response.data.preferences || {};
      } catch (error) {
        console.log('No email preferences found, using defaults');
        emailPreferences = {
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
      }
      
      setSettings({
        ...allSettings,
        email: emailPreferences
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      const allSettings = notificationManager.getAllSettings();
      setSettings(allSettings);
      setHasChanges(false);
    }
  };

  const handleSoundToggle = (soundType) => {
    const newSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        sounds: {
          ...settings.sounds.sounds,
          [soundType]: !settings.sounds.sounds[soundType]
        }
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleMasterSoundToggle = () => {
    const newSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        enabled: !settings.sounds.enabled
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleVolumeChange = (volume) => {
    const newSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        volume: parseFloat(volume)
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleNotificationToggle = (notificationType) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [notificationType]: !settings.notifications[notificationType]
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleEmailToggle = (emailType) => {
    const newSettings = {
      ...settings,
      email: {
        ...settings.email,
        [emailType]: !settings.email[emailType]
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      // Update notification settings
      notificationManager.updateSettings(settings.notifications);
      
      // Update sound settings
      soundManager.updateSettings(settings.sounds);
      
      // Update email notification preferences
      if (settings.email && Object.keys(settings.email).length > 0) {
        try {
          await emailNotificationAPI.savePreferences({
            workspaceId: workspace?.id,
            ...settings.email
          });
          console.log('✅ Email notification preferences saved');
        } catch (error) {
          console.error('Failed to save email preferences:', error);
        }
      }
      
      setHasChanges(false);
      console.log('✅ Sound and notification settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const testSound = (soundType) => {
    soundManager.testSound(soundType);
  };

  const testAllSounds = () => {
    soundManager.testAllSounds();
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      notifications: {
        mentions: true,
        directMessages: true,
        allMessages: false,
        soundEnabled: true,
        desktopNotifications: true
      },
      sounds: {
        enabled: true,
        volume: 0.7,
        sounds: {
          messageSent: true,
          messageReceived: true,
          mentionReceived: true,
          directMessage: true,
          differentThread: true,
          differentWorkspace: true,
          typing: false,
          connectionChange: true
        }
      }
    };
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const soundTypes = [
    { key: 'messageSent', label: 'Message Sent', description: 'When you send a message' },
    { key: 'messageReceived', label: 'Message Received', description: 'When you receive a message in current thread' },
    { key: 'mentionReceived', label: 'Mention Received', description: 'When someone mentions you' },
    { key: 'directMessage', label: 'Direct Message', description: 'When you receive a direct message' },
    { key: 'differentThread', label: 'Different Thread', description: 'When you receive a message in a different thread' },
    { key: 'differentWorkspace', label: 'Different Workspace', description: 'When you receive a message in a different workspace' },
    { key: 'typing', label: 'Typing Indicator', description: 'When someone starts typing (usually disabled)' },
    { key: 'connectionChange', label: 'Connection Status', description: 'When connection status changes' }
  ];

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Sound & Notification Settings</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={testAllSounds}
            className="text-sm"
          >
            🔊 Test All Sounds
          </Button>
        </div>

        <div className="space-y-6">
          {/* Master Controls */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Master Controls</h3>
            
            <div className="space-y-4">
              {/* Master Sound Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Sounds</Label>
                  <p className="text-xs text-gray-600">Turn all notification sounds on or off</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sounds?.enabled || false}
                    onChange={handleMasterSoundToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Master Volume Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Master Volume</Label>
                  <span className="text-sm text-gray-600">
                    {Math.round((settings.sounds?.volume || 0.7) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.sounds?.volume || 0.7}
                  onChange={(e) => handleVolumeChange(e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!settings.sounds?.enabled}
                />
              </div>

              {/* Desktop Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Desktop Notifications</Label>
                  <p className="text-xs text-gray-600">Show browser notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.desktopNotifications || false}
                    onChange={() => handleNotificationToggle('desktopNotifications')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Notification Types */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Types</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Mentions</Label>
                  <p className="text-xs text-gray-600">When someone mentions you</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.mentions || false}
                    onChange={() => handleNotificationToggle('mentions')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Direct Messages</Label>
                  <p className="text-xs text-gray-600">Personal messages to you</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.directMessages || false}
                    onChange={() => handleNotificationToggle('directMessages')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">All Messages</Label>
                  <p className="text-xs text-gray-600">Every message in channels</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications?.allMessages || false}
                    onChange={() => handleNotificationToggle('allMessages')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-4">📧 Email Notifications</h3>
            <p className="text-sm text-blue-700 mb-4">Get emails when you're offline</p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Immediate Email for @Mentions</Label>
                  <p className="text-xs text-gray-600">Get instant emails when someone mentions you</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.email?.immediateMentions !== false}
                    onChange={() => handleEmailToggle('immediateMentions')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Immediate Email for Direct Messages</Label>
                  <p className="text-xs text-gray-600">Get instant emails for personal messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.email?.immediateDirectMessages !== false}
                    onChange={() => handleEmailToggle('immediateDirectMessages')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Daily Email Digest</Label>
                  <p className="text-xs text-gray-600">Summary of missed messages once per day</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.email?.digestEnabled !== false}
                    onChange={() => handleEmailToggle('digestEnabled')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {workspace && (
                <div className="mt-4 p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">📬 {workspace.name} Immediate Emails</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setEmailLoading(true);
                          await emailNotificationAPI.testNotification(workspace.id);
                          console.log('✅ Test email sent');
                        } catch (error) {
                          console.error('❌ Test email failed:', error);
                        } finally {
                          setEmailLoading(false);
                        }
                      }}
                      disabled={emailLoading}
                      className="text-xs"
                    >
                      {emailLoading ? 'Sending...' : 'Test Email'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">Subscribe to get immediate emails for ALL messages in this workspace</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={false} // TODO: Get actual subscription status
                      onChange={() => {/* TODO: Implement workspace subscription */}}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Individual Sound Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Individual Sound Settings</h3>
            
            <div className="space-y-3">
              {soundTypes.map((soundType) => (
                <div key={soundType.key} className="flex items-center justify-between group">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{soundType.label}</Label>
                    <p className="text-xs text-gray-600">{soundType.description}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testSound(soundType.key)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1"
                      disabled={!settings.sounds?.enabled}
                    >
                      Test
                    </Button>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.sounds?.sounds?.[soundType.key] || false}
                        onChange={() => handleSoundToggle(soundType.key)}
                        disabled={!settings.sounds?.enabled}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="text-sm"
          >
            Reset to Defaults
          </Button>
          
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                saveSettings();
                onClose();
              }}
              disabled={!hasChanges}
              className={hasChanges ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              {hasChanges ? 'Save Changes' : 'No Changes'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
