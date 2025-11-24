import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Building2, Hash, ChevronDown, Globe } from 'lucide-react';
import { workspaceAPI, threadAPI } from '../../utils/api';

/**
 * Workspace and Channel Picker for Calendar/Timeline Views
 * Allows users to view tasks from:
 * - All workspaces (default)
 * - Specific workspace (all channels)
 * - Specific channel in workspace
 */
const WorkspaceChannelPicker = ({ 
  currentWorkspace, 
  currentChannel,
  onSelectionChange,
  className = ''
}) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null); // null = "All Workspaces"
  const [selectedChannel, setSelectedChannel] = useState(null); // null = "All Channels in workspace"
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load channels when workspace selected
  useEffect(() => {
    if (selectedWorkspace) {
      loadChannels(selectedWorkspace.id);
    } else {
      setChannels([]);
      setSelectedChannel(null);
    }
  }, [selectedWorkspace]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange({
      workspace: selectedWorkspace,
      channel: selectedChannel,
      showAllWorkspaces: !selectedWorkspace,
      workspaceIds: selectedWorkspace ? [selectedWorkspace.id] : null,
      channelIds: selectedChannel ? [selectedChannel.id] : null
    });
  }, [selectedWorkspace, selectedChannel, onSelectionChange]);

  const loadWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true);
      const response = await workspaceAPI.getWorkspaces();
      setWorkspaces(response.data.workspaces || []);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const loadChannels = async (workspaceId) => {
    try {
      setLoadingChannels(true);
      const response = await threadAPI.getThreads(workspaceId);
      const allThreads = response.data.threads || [];
      const channelList = allThreads.filter(t => t.type === 'channel');
      setChannels(channelList);
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleWorkspaceSelect = (workspace) => {
    setSelectedWorkspace(workspace);
    setSelectedChannel(null); // Reset channel when workspace changes
    setShowWorkspaceDropdown(false);
  };

  const handleChannelSelect = (channel) => {
    setSelectedChannel(channel);
    setShowChannelDropdown(false);
  };

  // Display text for workspace dropdown
  const workspaceDisplayText = selectedWorkspace 
    ? selectedWorkspace.name 
    : 'All Workspaces';

  // Display text for channel dropdown
  const channelDisplayText = selectedChannel
    ? `#${selectedChannel.name}`
    : selectedWorkspace
      ? 'All Channels'
      : 'Select Workspace First';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Workspace Picker */}
      <div className="relative">
        <button
          onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-border-primary rounded-lg hover:bg-surface-hover transition-colors duration-200"
          title="Select workspace"
        >
          {selectedWorkspace ? (
            <Building2 className="w-4 h-4 text-accent-600" />
          ) : (
            <Globe className="w-4 h-4 text-purple-600" />
          )}
          <span className="text-sm font-medium text-text-primary max-w-[150px] truncate">
            {workspaceDisplayText}
          </span>
          <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Workspace Dropdown */}
        {showWorkspaceDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowWorkspaceDropdown(false)}
            />
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-border-primary z-50 max-h-96 overflow-y-auto">
              {/* All Workspaces Option */}
              <button
                onClick={() => handleWorkspaceSelect(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                  !selectedWorkspace ? 'bg-accent-50 text-accent-600' : 'text-text-primary'
                }`}
              >
                <Globe className="w-4 h-4" />
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">All Workspaces</div>
                  <div className="text-xs text-text-tertiary">View tasks from all workspaces</div>
                </div>
                {!selectedWorkspace && (
                  <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                )}
              </button>

              <div className="border-t border-border-primary my-1"></div>

              {/* Individual Workspaces */}
              {loadingWorkspaces ? (
                <div className="px-4 py-8 text-center text-text-tertiary">
                  <div className="loading-spinner w-4 h-4 mx-auto mb-2"></div>
                  <div className="text-sm">Loading...</div>
                </div>
              ) : workspaces.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-tertiary text-sm">
                  No workspaces found
                </div>
              ) : (
                workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleWorkspaceSelect(workspace)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                      selectedWorkspace?.id === workspace.id ? 'bg-accent-50 text-accent-600' : 'text-text-primary'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-sm truncate">{workspace.name}</div>
                      <div className="text-xs text-text-tertiary">{workspace.member_count || 0} members</div>
                    </div>
                    {selectedWorkspace?.id === workspace.id && (
                      <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Channel Picker (only enabled when workspace selected) */}
      {selectedWorkspace && (
        <div className="relative">
          <button
            onClick={() => setShowChannelDropdown(!showChannelDropdown)}
            disabled={!selectedWorkspace}
            className={`flex items-center gap-2 px-3 py-2 bg-white border border-border-primary rounded-lg transition-colors duration-200 ${
              selectedWorkspace 
                ? 'hover:bg-surface-hover cursor-pointer' 
                : 'opacity-50 cursor-not-allowed'
            }`}
            title="Select channel"
          >
            <Hash className="w-4 h-4 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary max-w-[150px] truncate">
              {channelDisplayText}
            </span>
            <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${showChannelDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Channel Dropdown */}
          {showChannelDropdown && selectedWorkspace && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowChannelDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-border-primary z-50 max-h-96 overflow-y-auto">
                {/* All Channels Option */}
                <button
                  onClick={() => handleChannelSelect(null)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                    !selectedChannel ? 'bg-accent-50 text-accent-600' : 'text-text-primary'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">All Channels</div>
                    <div className="text-xs text-text-tertiary">View all channels in workspace</div>
                  </div>
                  {!selectedChannel && (
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                  )}
                </button>

                <div className="border-t border-border-primary my-1"></div>

                {/* Individual Channels */}
                {loadingChannels ? (
                  <div className="px-4 py-8 text-center text-text-tertiary">
                    <div className="loading-spinner w-4 h-4 mx-auto mb-2"></div>
                    <div className="text-sm">Loading...</div>
                  </div>
                ) : channels.length === 0 ? (
                  <div className="px-4 py-8 text-center text-text-tertiary text-sm">
                    No channels found
                  </div>
                ) : (
                  channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleChannelSelect(channel)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                        selectedChannel?.id === channel.id ? 'bg-accent-50 text-accent-600' : 'text-text-primary'
                      }`}
                    >
                      <Hash className="w-4 h-4" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium text-sm truncate">{channel.name}</div>
                        <div className="text-xs text-text-tertiary">
                          {channel.member_count || 0} members
                        </div>
                      </div>
                      {selectedChannel?.id === channel.id && (
                        <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

WorkspaceChannelPicker.propTypes = {
  currentWorkspace: PropTypes.object,
  currentChannel: PropTypes.object,
  onSelectionChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default WorkspaceChannelPicker;
