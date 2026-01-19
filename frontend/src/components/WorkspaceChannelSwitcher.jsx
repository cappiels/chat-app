import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ChevronDown,
  ChevronRight,
  Hash,
  Briefcase,
  Check,
  Plus,
  Loader2
} from 'lucide-react';
import { threadAPI } from '../utils/api';

/**
 * Compact Workspace-Channel Switcher
 * Shows "Workspace > #channel" with a dropdown to quickly switch
 */
const WorkspaceChannelSwitcher = ({
  currentWorkspace,
  currentChannel,
  workspaces = [],
  onWorkspaceChange,
  onChannelChange,
  onCreateWorkspace
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState(currentWorkspace?.id);
  const [channelsCache, setChannelsCache] = useState({});
  const [loadingChannels, setLoadingChannels] = useState({});
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Pre-load channels for current workspace
  useEffect(() => {
    if (currentWorkspace?.id) {
      loadChannels(currentWorkspace.id);
    }
  }, [currentWorkspace?.id]);

  const loadChannels = async (workspaceId) => {
    if (channelsCache[workspaceId] || loadingChannels[workspaceId]) return;

    setLoadingChannels(prev => ({ ...prev, [workspaceId]: true }));

    try {
      const response = await threadAPI.getThreads(workspaceId);
      const channels = (response.data.threads || []).filter(t => t.type === 'channel');
      setChannelsCache(prev => ({ ...prev, [workspaceId]: channels }));
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannelsCache(prev => ({ ...prev, [workspaceId]: [] }));
    } finally {
      setLoadingChannels(prev => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleWorkspaceExpand = (workspaceId) => {
    if (expandedWorkspaceId === workspaceId) {
      setExpandedWorkspaceId(null);
    } else {
      setExpandedWorkspaceId(workspaceId);
      loadChannels(workspaceId);
    }
  };

  const handleChannelSelect = (workspace, channel) => {
    if (workspace.id !== currentWorkspace?.id) {
      onWorkspaceChange(workspace);
    }
    onChannelChange(channel);
    setIsOpen(false);
  };

  const getWorkspaceColor = (name) => {
    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'];
    return colors[(name?.length || 0) % colors.length];
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left min-w-0"
      >
        {/* Workspace indicator */}
        <div className={`w-5 h-5 ${getWorkspaceColor(currentWorkspace?.name)} rounded flex-shrink-0 flex items-center justify-center`}>
          <Briefcase className="w-3 h-3 text-white" />
        </div>

        {/* Workspace name */}
        <span className="font-medium text-gray-900 truncate max-w-[120px]">
          {currentWorkspace?.name || 'Select Workspace'}
        </span>

        {/* Separator */}
        {currentChannel && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <Hash className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-gray-700 truncate max-w-[100px]">
              {currentChannel.name}
            </span>
          </>
        )}

        {/* Dropdown arrow */}
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 max-h-[400px] overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Workspaces
            </span>
          </div>

          {/* Workspace List */}
          {workspaces.length === 0 ? (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              No workspaces available
            </div>
          ) : (
            <div className="py-1">
              {workspaces.map(workspace => {
                const isExpanded = expandedWorkspaceId === workspace.id;
                const isCurrent = workspace.id === currentWorkspace?.id;
                const channels = channelsCache[workspace.id] || [];
                const isLoading = loadingChannels[workspace.id];

                return (
                  <div key={workspace.id}>
                    {/* Workspace Row */}
                    <button
                      onClick={() => handleWorkspaceExpand(workspace.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors ${
                        isCurrent ? 'bg-blue-50' : ''
                      }`}
                    >
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                      <div className={`w-6 h-6 ${getWorkspaceColor(workspace.name)} rounded flex items-center justify-center flex-shrink-0`}>
                        <Briefcase className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className={`flex-1 text-left font-medium truncate ${isCurrent ? 'text-blue-700' : 'text-gray-900'}`}>
                        {workspace.name}
                      </span>
                      {isCurrent && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                          current
                        </span>
                      )}
                    </button>

                    {/* Channels (when expanded) */}
                    {isExpanded && (
                      <div className="ml-6 border-l border-gray-200 pl-2 py-1">
                        {isLoading ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-gray-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading channels...
                          </div>
                        ) : channels.length === 0 ? (
                          <div className="px-3 py-2 text-gray-400 text-sm">
                            No channels
                          </div>
                        ) : (
                          channels.map(channel => {
                            const isCurrentChannel =
                              isCurrent && channel.id === currentChannel?.id;

                            return (
                              <button
                                key={channel.id}
                                onClick={() => handleChannelSelect(workspace, channel)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors ${
                                  isCurrentChannel ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                              >
                                <Hash className="w-3.5 h-3.5 text-gray-400" />
                                <span className="flex-1 text-left text-sm truncate">
                                  {channel.name}
                                </span>
                                {isCurrentChannel && (
                                  <Check className="w-4 h-4 text-blue-600" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Workspace */}
          {onCreateWorkspace && (
            <>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onCreateWorkspace();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Create Workspace</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

WorkspaceChannelSwitcher.propTypes = {
  currentWorkspace: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string
  }),
  currentChannel: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string
  }),
  workspaces: PropTypes.array,
  onWorkspaceChange: PropTypes.func.isRequired,
  onChannelChange: PropTypes.func.isRequired,
  onCreateWorkspace: PropTypes.func
};

export default WorkspaceChannelSwitcher;
