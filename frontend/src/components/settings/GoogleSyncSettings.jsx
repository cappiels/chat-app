/**
 * User Profile Google Sync Settings Component
 * Allows users to authorize their personal Google account once
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Settings, Shield, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import GoogleSyncButton from '../sync/GoogleSyncButton';

const GoogleSyncSettings = ({ workspaceId, userId, currentUser }) => {
  const [syncSettings, setSyncSettings] = useState({
    isAuthorized: false,
    googleEmail: null,
    authorizedAt: null,
    enabledChannels: [],
    preferences: {
      autoSync: true,
      syncToCalendar: true,
      syncToTasks: true,
      defaultCalendar: 'secondary' // 'primary' or 'secondary'
    }
  });

  useEffect(() => {
    loadUserSyncSettings();
  }, [workspaceId, userId]);

  const loadUserSyncSettings = async () => {
    try {
      const response = await fetch(`/api/auth/google/status/${workspaceId}/${userId}`);
      const data = await response.json();
      
      setSyncSettings(prev => ({
        ...prev,
        isAuthorized: data.connected,
        googleEmail: data.email,
        authorizedAt: data.connected_at
      }));

      // Also load user preferences
      if (data.connected) {
        const prefsResponse = await fetch(`/api/sync/google/preferences/${workspaceId}/${userId}`);
        if (prefsResponse.ok) {
          const prefs = await prefsResponse.json();
          setSyncSettings(prev => ({
            ...prev,
            preferences: { ...prev.preferences, ...prefs }
          }));
        }
      }
    } catch (error) {
      console.error('Error loading sync settings:', error);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const newPreferences = { ...syncSettings.preferences, [key]: value };
    
    try {
      await fetch(`/api/sync/google/preferences/${workspaceId}/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      });
      
      setSyncSettings(prev => ({
        ...prev,
        preferences: newPreferences
      }));
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Google Calendar & Tasks</h3>
          <p className="text-sm text-gray-600">Connect your personal Google account for task synchronization</p>
        </div>
      </div>

      {/* Authorization Status */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-gray-600" />
          <h4 className="font-medium text-gray-900">Authorization Status</h4>
        </div>
        
        {syncSettings.isAuthorized ? (
          <div className="flex items-center gap-2 text-green-700 mb-3">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Connected to {syncSettings.googleEmail}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-600 mb-3">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Not connected to Google</span>
          </div>
        )}

        <GoogleSyncButton 
          workspaceId={workspaceId}
          userId={userId}
          variant="compact"
          onSyncComplete={loadUserSyncSettings}
        />

        {syncSettings.isAuthorized && (
          <div className="mt-3 text-xs text-gray-500">
            Authorized on {new Date(syncSettings.authorizedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Sync Preferences */}
      {syncSettings.isAuthorized && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Sync Preferences</h4>
          </div>
          
          <div className="space-y-3">
            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-sync tasks</label>
                <p className="text-xs text-gray-500">Automatically sync when tasks are created/updated</p>
              </div>
              <input
                type="checkbox"
                checked={syncSettings.preferences.autoSync}
                onChange={(e) => handlePreferenceChange('autoSync', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Calendar sync */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Sync to Google Calendar</label>
                <p className="text-xs text-gray-500">Time-blocking for scheduled tasks</p>
              </div>
              <input
                type="checkbox"
                checked={syncSettings.preferences.syncToCalendar}
                onChange={(e) => handlePreferenceChange('syncToCalendar', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Tasks sync */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Sync to Google Tasks</label>
                <p className="text-xs text-gray-500">Completion tracking and task management</p>
              </div>
              <input
                type="checkbox"
                checked={syncSettings.preferences.syncToTasks}
                onChange={(e) => handlePreferenceChange('syncToTasks', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Calendar type */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Calendar location</label>
                <p className="text-xs text-gray-500">Where to create calendar events</p>
              </div>
              <select
                value={syncSettings.preferences.defaultCalendar}
                onChange={(e) => handlePreferenceChange('defaultCalendar', e.target.value)}
                className="text-sm border-gray-300 rounded-md"
              >
                <option value="secondary">Separate workspace calendars</option>
                <option value="primary">Primary calendar</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• <strong>One-time setup:</strong> Authorize once per workspace</li>
          <li>• <strong>Channel control:</strong> Admins enable sync per channel</li>
          <li>• <strong>Smart sync:</strong> Tasks go to Calendar (time-blocking) and/or Tasks (completion)</li>
          <li>• <strong>Privacy:</strong> Your personal calendar data stays private</li>
        </ul>
      </div>
    </div>
  );
};

GoogleSyncSettings.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  currentUser: PropTypes.object.isRequired
};

export default GoogleSyncSettings;
