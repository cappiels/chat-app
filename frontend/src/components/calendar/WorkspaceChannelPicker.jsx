import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Building2, Hash, ChevronDown, Globe, Check, X } from 'lucide-react';
import { workspaceAPI, threadAPI } from '../../utils/api';

/**
 * Workspace and Channel Picker for Calendar/Timeline Views
 * Supports multi-select for workspaces and channels
 * Allows users to view tasks from:
 * - All workspaces (default)
 * - Multiple specific workspaces
 * - Multiple specific channels across workspaces
 */
const WorkspaceChannelPicker = ({
  currentWorkspace,
  currentChannel,
  onSelectionChange,
  className = ''
}) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [channelsByWorkspace, setChannelsByWorkspace] = useState({}); // { workspaceId: channels[] }
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState([]); // Empty = "All Workspaces"
  const [selectedChannels, setSelectedChannels] = useState([]); // [{ workspaceId, channelId, channel }]
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState({});
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({}); // For channel loading

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load channels when workspaces are selected
  useEffect(() => {
    selectedWorkspaceIds.forEach(wsId => {
      if (!channelsByWorkspace[wsId] && !loadingChannels[wsId]) {
        loadChannels(wsId);
      }
    });
  }, [selectedWorkspaceIds]);

  // Notify parent of selection changes
  // Note: onSelectionChange is excluded from deps since it's a stable setState function
  useEffect(() => {
    const selectedWorkspaces = workspaces.filter(ws => selectedWorkspaceIds.includes(ws.id));

    onSelectionChange({
      workspaces: selectedWorkspaces,
      channels: selectedChannels,
      showAllWorkspaces: selectedWorkspaceIds.length === 0,
      workspaceIds: selectedWorkspaceIds.length > 0 ? selectedWorkspaceIds : null,
      channelIds: selectedChannels.length > 0 ? selectedChannels.map(c => c.channelId) : null,
      // For backwards compatibility - single selection
      workspace: selectedWorkspaces.length === 1 ? selectedWorkspaces[0] : null,
      channel: selectedChannels.length === 1 ? selectedChannels[0].channel : null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceIds, selectedChannels, workspaces]);

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
      setLoadingChannels(prev => ({ ...prev, [workspaceId]: true }));
      const response = await threadAPI.getThreads(workspaceId);
      const allThreads = response.data.threads || [];
      const channelList = allThreads.filter(t => t.type === 'channel');
      setChannelsByWorkspace(prev => ({ ...prev, [workspaceId]: channelList }));
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannelsByWorkspace(prev => ({ ...prev, [workspaceId]: [] }));
    } finally {
      setLoadingChannels(prev => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleWorkspaceToggle = (workspace) => {
    setSelectedWorkspaceIds(prev => {
      if (prev.includes(workspace.id)) {
        // Remove workspace and its channels from selection
        setSelectedChannels(channels =>
          channels.filter(c => c.workspaceId !== workspace.id)
        );
        return prev.filter(id => id !== workspace.id);
      } else {
        // Add workspace and load its channels
        if (!channelsByWorkspace[workspace.id]) {
          loadChannels(workspace.id);
        }
        return [...prev, workspace.id];
      }
    });
  };

  const handleSelectAllWorkspaces = () => {
    setSelectedWorkspaceIds([]);
    setSelectedChannels([]);
  };

  const handleChannelToggle = (workspaceId, channel) => {
    setSelectedChannels(prev => {
      const exists = prev.some(c => c.channelId === channel.id);
      if (exists) {
        return prev.filter(c => c.channelId !== channel.id);
      } else {
        return [...prev, { workspaceId, channelId: channel.id, channel }];
      }
    });
  };

  const handleSelectAllChannelsInWorkspace = (workspaceId) => {
    const channels = channelsByWorkspace[workspaceId] || [];
    const allSelected = channels.every(ch =>
      selectedChannels.some(c => c.channelId === ch.id)
    );

    if (allSelected) {
      // Deselect all channels in this workspace
      setSelectedChannels(prev => prev.filter(c => c.workspaceId !== workspaceId));
    } else {
      // Select all channels in this workspace
      const newChannels = channels
        .filter(ch => !selectedChannels.some(c => c.channelId === ch.id))
        .map(ch => ({ workspaceId, channelId: ch.id, channel: ch }));
      setSelectedChannels(prev => [...prev, ...newChannels]);
    }
  };

  const clearChannelSelection = () => {
    setSelectedChannels([]);
  };

  // Display text for workspace dropdown
  const workspaceDisplayText = selectedWorkspaceIds.length === 0
    ? 'All Workspaces'
    : selectedWorkspaceIds.length === 1
      ? workspaces.find(ws => ws.id === selectedWorkspaceIds[0])?.name || '1 Workspace'
      : `${selectedWorkspaceIds.length} Workspaces`;

  // Display text for channel dropdown
  const channelDisplayText = selectedChannels.length === 0
    ? selectedWorkspaceIds.length > 0 ? 'All Channels' : 'Select Workspace First'
    : selectedChannels.length === 1
      ? `#${selectedChannels[0].channel.name}`
      : `${selectedChannels.length} Channels`;

  const hasWorkspaceSelection = selectedWorkspaceIds.length > 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Workspace Picker */}
      <div className="relative">
        <button
          onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-border-primary rounded-lg hover:bg-surface-hover transition-colors duration-200"
          title="Select workspaces"
        >
          {selectedWorkspaceIds.length === 0 ? (
            <Globe className="w-4 h-4 text-purple-600" />
          ) : (
            <Building2 className="w-4 h-4 text-accent-600" />
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
            <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-border-primary z-50 max-h-96 overflow-y-auto">
              {/* All Workspaces Option */}
              <button
                onClick={() => {
                  handleSelectAllWorkspaces();
                  setShowWorkspaceDropdown(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                  selectedWorkspaceIds.length === 0 ? 'bg-accent-50 text-accent-600' : 'text-text-primary'
                }`}
              >
                <Globe className="w-4 h-4" />
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">All Workspaces</div>
                  <div className="text-xs text-text-tertiary">View tasks from all workspaces</div>
                </div>
                {selectedWorkspaceIds.length === 0 && (
                  <Check className="w-4 h-4 text-accent-500" />
                )}
              </button>

              <div className="border-t border-border-primary my-1"></div>

              <div className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase">
                Select Workspaces
              </div>

              {/* Individual Workspaces with Checkboxes */}
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
                    onClick={() => handleWorkspaceToggle(workspace)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                      selectedWorkspaceIds.includes(workspace.id) ? 'bg-accent-50' : 'text-text-primary'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedWorkspaceIds.includes(workspace.id)
                        ? 'bg-accent-500 border-accent-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedWorkspaceIds.includes(workspace.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <Building2 className="w-4 h-4 text-text-tertiary" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-sm truncate">{workspace.name}</div>
                      <div className="text-xs text-text-tertiary">{workspace.member_count || 0} members</div>
                    </div>
                  </button>
                ))
              )}

              {selectedWorkspaceIds.length > 0 && (
                <div className="border-t border-border-primary p-2">
                  <button
                    onClick={() => setShowWorkspaceDropdown(false)}
                    className="w-full px-4 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 transition-colors text-sm font-medium"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Channel Picker */}
      <div className="relative">
        <button
          onClick={() => hasWorkspaceSelection && setShowChannelDropdown(!showChannelDropdown)}
          disabled={!hasWorkspaceSelection}
          className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-lg transition-colors duration-200 ${
            hasWorkspaceSelection
              ? 'border-border-primary hover:bg-surface-hover cursor-pointer'
              : 'border-dashed border-gray-300 opacity-60 cursor-not-allowed'
          } ${selectedChannels.length > 0 ? 'ring-2 ring-green-200 border-green-400' : ''}`}
          title={hasWorkspaceSelection ? "Select channels" : "Select a workspace first"}
        >
          <Hash className={`w-4 h-4 ${selectedChannels.length > 0 ? 'text-green-600' : 'text-text-tertiary'}`} />
          <span className={`text-sm font-medium max-w-[150px] truncate ${
            selectedChannels.length > 0 ? 'text-green-700' : 'text-text-primary'
          }`}>
            {channelDisplayText}
          </span>
          {selectedChannels.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearChannelSelection();
              }}
              className="ml-1 p-0.5 hover:bg-gray-200 rounded"
              title="Clear channel selection"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
          {hasWorkspaceSelection && (
            <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${showChannelDropdown ? 'rotate-180' : ''}`} />
          )}
        </button>

        {/* Channel Dropdown */}
        {showChannelDropdown && hasWorkspaceSelection && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowChannelDropdown(false)}
            />
            <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-border-primary z-50 max-h-96 overflow-y-auto">
              {/* All Channels Option */}
              <button
                onClick={() => {
                  clearChannelSelection();
                  setShowChannelDropdown(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors ${
                  selectedChannels.length === 0 ? 'bg-accent-50 text-accent-600' : 'text-text-primary'
                }`}
              >
                <Hash className="w-4 h-4" />
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">All Channels</div>
                  <div className="text-xs text-text-tertiary">View all channels in selected workspaces</div>
                </div>
                {selectedChannels.length === 0 && (
                  <Check className="w-4 h-4 text-accent-500" />
                )}
              </button>

              <div className="border-t border-border-primary my-1"></div>

              {/* Channels grouped by workspace */}
              {selectedWorkspaceIds.map(wsId => {
                const workspace = workspaces.find(ws => ws.id === wsId);
                const channels = channelsByWorkspace[wsId] || [];
                const isLoading = loadingChannels[wsId];
                const wsChannelsSelected = channels.filter(ch =>
                  selectedChannels.some(c => c.channelId === ch.id)
                ).length;
                const allWsChannelsSelected = channels.length > 0 && wsChannelsSelected === channels.length;

                return (
                  <div key={wsId} className="border-b border-border-primary last:border-b-0">
                    {/* Workspace Header */}
                    <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-text-tertiary" />
                        <span className="text-xs font-semibold text-text-secondary">
                          {workspace?.name}
                        </span>
                      </div>
                      {channels.length > 0 && (
                        <button
                          onClick={() => handleSelectAllChannelsInWorkspace(wsId)}
                          className="text-xs text-accent-600 hover:text-accent-700"
                        >
                          {allWsChannelsSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    {/* Channels */}
                    {isLoading ? (
                      <div className="px-4 py-4 text-center text-text-tertiary">
                        <div className="loading-spinner w-4 h-4 mx-auto"></div>
                      </div>
                    ) : channels.length === 0 ? (
                      <div className="px-4 py-3 text-center text-text-tertiary text-xs">
                        No channels in this workspace
                      </div>
                    ) : (
                      channels.map((channel) => {
                        const isSelected = selectedChannels.some(c => c.channelId === channel.id);
                        return (
                          <button
                            key={channel.id}
                            onClick={() => handleChannelToggle(wsId, channel)}
                            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover transition-colors ${
                              isSelected ? 'bg-green-50' : ''
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <Check className="w-2.5 h-2.5 text-white" />
                              )}
                            </div>
                            <Hash className="w-3 h-3 text-text-tertiary" />
                            <span className="text-sm text-text-primary truncate">
                              {channel.name}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}

              {selectedChannels.length > 0 && (
                <div className="border-t border-border-primary p-2">
                  <button
                    onClick={() => setShowChannelDropdown(false)}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    Done ({selectedChannels.length} selected)
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
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
