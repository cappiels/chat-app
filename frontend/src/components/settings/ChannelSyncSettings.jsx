/**
 * Channel Admin Google Sync Settings Component
 * Allows channel admins to enable/disable Google sync per channel
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Calendar, Users, Shield, ToggleLeft, ToggleRight, Info } from 'lucide-react';

const ChannelSyncSettings = ({ 
  workspaceId, 
  channelId, 
  currentUser, 
  isAdmin = false 
}) => {
  const [channelSyncConfig, setChannelSyncConfig] = useState({
    isSyncEnabled: false,
    allowedUsers: [],
    connectedUsers: [],
    syncSettings: {
      autoSyncNewTasks: true,
      requireAdminApproval: false,
      allowBulkSync: true,
      maxTasksPerSync: 50
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (channelId) {
      loadChannelSyncConfig();
    }
  }, [channelId, workspaceId]);

  const loadChannelSyncConfig = async () => {
    try {
      const response = await fetch(`/api/sync/google/channel/${workspaceId}/${channelId}/config`);
      if (response.ok) {
        const data = await response.json();
        setChannelSyncConfig(data);
      }
    } catch (error) {
      console.error('Error loading channel sync config:', error);
    }
  };

  const updateSyncEnabled = async (enabled) => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/sync/google/channel/${workspaceId}/${channelId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enabled,
          updatedBy: currentUser.id
        })
      });

      if (response.ok) {
        setChannelSyncConfig(prev => ({
          ...prev,
          isSyncEnabled: enabled
        }));
      }
    } catch (error) {
      console.error('Error toggling channel sync:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSyncSetting = async (key, value) => {
    if (!isAdmin) return;

    try {
      const newSettings = { ...channelSyncConfig.syncSettings, [key]: value };
      
      const response = await fetch(`/api/sync/google/channel/${workspaceId}/${channelId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setChannelSyncConfig(prev => ({
          ...prev,
          syncSettings: newSettings
        }));
      }
    } catch (error) {
      console.error('Error updating sync settings:', error);
    }
  };

  // Non-admin view
  if (!isAdmin) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h4 className="font-medium text-gray-900">Google Sync Status</h4>
        </div>
        
        {channelSyncConfig.isSyncEnabled ? (
          <div className="flex items-center gap-2 text-green-700">
            <Shield className="w-4 h-4" />
            <span className="text-sm">Google sync is enabled for this channel</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-600">
            <Shield className="w-4 h-4" />
            <span className="text-sm">Google sync is not enabled for this channel</span>
          </div>
        )}

        {channelSyncConfig.isSyncEnabled && (
          <div className="mt-3 text-xs text-gray-500">
            {channelSyncConfig.connectedUsers.length} team member(s) have connected their Google accounts
          </div>
        )}
      </div>
    );
  }

  // Admin view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
          <Shield className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Channel Sync Controls</h3>
          <p className="text-sm text-gray-600">Manage Google sync settings for this channel</p>
        </div>
      </div>

      {/* Main Toggle */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-600" />
            <div>
              <h4 className="font-medium text-gray-900">Enable Google Sync</h4>
              <p className="text-sm text-gray-600">Allow team members to sync tasks to their Google accounts</p>
            </div>
          </div>
          
          <button
            onClick={() => updateSyncEnabled(!channelSyncConfig.isSyncEnabled)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              channelSyncConfig.isSyncEnabled
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {channelSyncConfig.isSyncEnabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            {channelSyncConfig.isSyncEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Sync Settings */}
      {channelSyncConfig.isSyncEnabled && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-4">Sync Configuration</h4>
          
          <div className="space-y-4">
            {/* Auto-sync new tasks */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-sync new tasks</label>
                <p className="text-xs text-gray-500">Automatically sync when tasks are created in this channel</p>
              </div>
              <input
                type="checkbox"
                checked={channelSyncConfig.syncSettings.autoSyncNewTasks}
                onChange={(e) => updateSyncSetting('autoSyncNewTasks', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Require admin approval */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Require admin approval</label>
                <p className="text-xs text-gray-500">Users need approval before their first sync</p>
              </div>
              <input
                type="checkbox"
                checked={channelSyncConfig.syncSettings.requireAdminApproval}
                onChange={(e) => updateSyncSetting('requireAdminApproval', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Allow bulk sync */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Allow bulk sync</label>
                <p className="text-xs text-gray-500">Users can sync all existing tasks at once</p>
              </div>
              <input
                type="checkbox"
                checked={channelSyncConfig.syncSettings.allowBulkSync}
                onChange={(e) => updateSyncSetting('allowBulkSync', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Max tasks per sync */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Max tasks per sync</label>
                <p className="text-xs text-gray-500">Limit concurrent sync operations</p>
              </div>
              <select
                value={channelSyncConfig.syncSettings.maxTasksPerSync}
                onChange={(e) => updateSyncSetting('maxTasksPerSync', parseInt(e.target.value))}
                className="text-sm border-gray-300 rounded-md w-20"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Connected Users */}
      {channelSyncConfig.isSyncEnabled && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Connected Users</h4>
          </div>
          
          {channelSyncConfig.connectedUsers.length > 0 ? (
            <div className="space-y-2">
              {channelSyncConfig.connectedUsers.map(user => (
                <div key={user.userId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-3">
                    {user.avatar && (
                      <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">Connected to {user.googleEmail}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      {user.lastSyncedTasks || 0} tasks synced
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No users have connected their Google accounts yet</p>
            </div>
          )}
        </div>
      )}

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Admin Controls</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Users must first authorize Google in their profile settings</li>
              <li>• Channel sync must be enabled before users can sync tasks</li>
              <li>• Each user syncs to their own personal Google Calendar & Tasks</li>
              <li>• You can disable sync at any time to stop new synchronizations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

ChannelSyncSettings.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  channelId: PropTypes.string.isRequired,
  currentUser: PropTypes.object.isRequired,
  isAdmin: PropTypes.bool
};

export default ChannelSyncSettings;
