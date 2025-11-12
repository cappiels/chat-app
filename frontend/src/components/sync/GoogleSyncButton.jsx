/**
 * Google Sync Button Component
 * Handles Google OAuth authentication and task synchronization
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

const GoogleSyncButton = ({ 
  workspaceId, 
  userId, 
  taskId = null, 
  onSyncComplete = null,
  variant = 'default', // 'default', 'compact', 'icon-only'
  className = ''
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);

  // Check connection status on mount
  useEffect(() => {
    if (workspaceId && userId) {
      checkConnectionStatus();
    }
  }, [workspaceId, userId]);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch(`/api/auth/google/status/${workspaceId}/${userId}`);
      const data = await response.json();
      
      setIsConnected(data.connected);
      setUserInfo(data.connected ? {
        email: data.email,
        name: data.name,
        picture: data.picture
      } : null);
    } catch (error) {
      console.error('Error checking Google connection:', error);
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get authorization URL
      const response = await fetch(`/api/auth/google/authorize?workspaceId=${workspaceId}&userId=${userId}`);
      const data = await response.json();

      if (data.authUrl) {
        // Open authorization URL in new window
        const authWindow = window.open(
          data.authUrl, 
          'google-auth', 
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Poll for completion
        const pollForCompletion = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(pollForCompletion);
              setIsLoading(false);
              // Check if connection was successful
              setTimeout(checkConnectionStatus, 1000);
            }
          } catch (e) {
            // Cross-origin error expected, continue polling
          }
        }, 1000);

        // Fallback timeout
        setTimeout(() => {
          if (!authWindow.closed) {
            authWindow.close();
          }
          clearInterval(pollForCompletion);
          setIsLoading(false);
          checkConnectionStatus();
        }, 300000); // 5 minutes timeout

      } else {
        throw new Error(data.error || 'Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Error connecting to Google:', error);
      setError(error.message);
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google sync? This will remove access to your Google Calendar and Tasks.')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/auth/google/revoke/${workspaceId}/${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Google sync');
      }

      setIsConnected(false);
      setUserInfo(null);
      setSyncStatus(null);
    } catch (error) {
      console.error('Error disconnecting Google:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!isConnected) {
      await handleConnect();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSyncStatus('syncing');

      const endpoint = taskId 
        ? `/api/sync/google/task/${workspaceId}/${null}/${taskId}` // threadId not needed for single task
        : `/api/sync/google/bulk/${workspaceId}/${null}`; // threadId not needed for bulk

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          ...(taskId ? {} : { syncAll: true })
        })
      });

      const data = await response.json();

      if (data.success) {
        setSyncStatus('success');
        if (onSyncComplete) {
          onSyncComplete(data);
        }
        
        // Auto-clear success status after 3 seconds
        setTimeout(() => setSyncStatus(null), 3000);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing with Google:', error);
      setError(error.message);
      setSyncStatus('error');
      
      // Auto-clear error status after 5 seconds
      setTimeout(() => setSyncStatus(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    try {
      const response = await fetch(`/api/sync/google/status/${workspaceId}/${userId}`);
      const data = await response.json();
      
      if (data.health?.overall === 'healthy') {
        alert('✅ Google sync is working properly!');
      } else {
        alert(`⚠️ Google sync health: ${data.health?.overall || 'unknown'}`);
      }
    } catch (error) {
      alert('❌ Failed to check Google sync health');
    }
  };

  // Render different variants
  if (variant === 'icon-only') {
    return (
      <button
        onClick={isConnected ? handleSync : handleConnect}
        disabled={isLoading}
        className={`p-2 rounded-md transition-colors ${
          isConnected 
            ? 'text-green-600 hover:bg-green-50 border border-green-200' 
            : 'text-gray-500 hover:bg-gray-50 border border-gray-200'
        } ${className}`}
        title={isConnected ? 'Sync with Google' : 'Connect to Google'}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isConnected ? (
          <Cloud className="w-4 h-4" />
        ) : (
          <CloudOff className="w-4 h-4" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={isConnected ? handleSync : handleConnect}
          disabled={isLoading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
            isConnected
              ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
              : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : syncStatus === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : syncStatus === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : isConnected ? (
            <Cloud className="w-4 h-4" />
          ) : (
            <CloudOff className="w-4 h-4" />
          )}
          
          {isLoading ? 'Syncing...' : 
           syncStatus === 'success' ? 'Synced!' : 
           syncStatus === 'error' ? 'Error' : 
           isConnected ? 'Google Sync' : 'Connect Google'}
        </button>
        
        {error && (
          <div className="text-xs text-red-600 max-w-32 truncate" title={error}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Default full variant
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-gray-700">
            Google Sync {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        {isConnected && userInfo && (
          <div className="flex items-center gap-2">
            {userInfo.picture && (
              <img 
                src={userInfo.picture} 
                alt={userInfo.name} 
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="text-xs text-gray-500">{userInfo.email}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={isConnected ? handleSync : handleConnect}
          disabled={isLoading}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
            isConnected
              ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
              : 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : syncStatus === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : syncStatus === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : isConnected ? (
            <Cloud className="w-4 h-4" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          
          {isLoading ? 'Processing...' : 
           syncStatus === 'success' ? 'Sync Complete!' : 
           syncStatus === 'error' ? 'Sync Failed' : 
           isConnected ? (taskId ? 'Sync Task' : 'Sync All Tasks') : 'Connect to Google'}
        </button>

        {isConnected && (
          <>
            <button
              onClick={handleHealthCheck}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200"
            >
              Test Connection
            </button>
            
            <button
              onClick={handleDisconnect}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {syncStatus === 'success' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            Successfully synced {taskId ? 'task' : 'tasks'} to Google Calendar and Tasks!
          </p>
        </div>
      )}

      {isConnected && !isLoading && !error && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-800">
            Your tasks will be intelligently synced to Google Calendar (for time-blocking) 
            and Google Tasks (for completion tracking) based on task attributes.
          </p>
        </div>
      )}
    </div>
  );
};

GoogleSyncButton.propTypes = {
  workspaceId: PropTypes.string.isRequired,
  userId: PropTypes.string.isRequired,
  taskId: PropTypes.string, // Optional: sync specific task
  onSyncComplete: PropTypes.func, // Optional: callback when sync completes
  variant: PropTypes.oneOf(['default', 'compact', 'icon-only']),
  className: PropTypes.string
};

export default GoogleSyncButton;
