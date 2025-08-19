import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import socketManager from '../../utils/socket';

const ConnectionStatus = ({ className = '' }) => {
  const [status, setStatus] = useState(socketManager.getConnectionStatus());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(socketManager.getConnectionStatus());
    };

    // Set up connection callbacks
    socketManager.onConnect(updateStatus);
    socketManager.onDisconnect(updateStatus);

    // Poll for status updates (as a backup)
    const interval = setInterval(updateStatus, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getStatusInfo = () => {
    if (status.connected) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        text: 'Connected',
        description: 'Real-time updates active'
      };
    } else if (status.connecting) {
      return {
        icon: AlertCircle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        text: 'Connecting...',
        description: `Attempt ${status.reconnectAttempts || 0}`
      };
    } else {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        text: 'Disconnected',
        description: 'Real-time updates unavailable'
      };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  if (status.connected && !showDetails) {
    // Show minimal indicator when connected
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`p-1 rounded-full transition-all duration-200 ${statusInfo.color} hover:bg-white/20 ${className}`}
        title="Connection Status"
      >
        <Icon className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all duration-200 ${statusInfo.bgColor} ${statusInfo.borderColor} hover:shadow-sm`}
        title="Connection Status"
      >
        <Icon className={`w-3 h-3 ${statusInfo.color}`} />
        <span className={`text-xs font-medium ${statusInfo.color}`}>
          {statusInfo.text}
        </span>
      </button>

      {showDetails && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${statusInfo.color}`} />
            <span className="font-medium text-slate-900">{statusInfo.text}</span>
          </div>
          
          <p className="text-xs text-slate-600 mb-3">
            {statusInfo.description}
          </p>
          
          <div className="space-y-1 text-xs text-slate-500">
            {status.currentWorkspace && (
              <div>Workspace: {status.currentWorkspace}</div>
            )}
            {status.currentThread && (
              <div>Thread: {status.currentThread}</div>
            )}
            {status.reconnectAttempts > 0 && (
              <div>Reconnect attempts: {status.reconnectAttempts}</div>
            )}
          </div>
          
          <div className="flex justify-end mt-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowDetails(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
