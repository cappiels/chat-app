import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  ChevronDown, 
  Plus, 
  Hash, 
  MessageSquare,
  Users,
  X,
  Bell,
  BellOff,
  BookOpen,
  Star
} from 'lucide-react';
import { threadAPI, notificationAPI, workspaceAPI } from '../../utils/api';
import socketManager from '../../utils/socket';

const Sidebar = ({ workspace, channels, currentChannel, onChannelSelect, onAddChannel, onWorkspaceSettings, isOpen, onClose }) => {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [directMessagesExpanded, setDirectMessagesExpanded] = useState(true);
  const [directMessages, setDirectMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadSummary, setUnreadSummary] = useState({
    total_unread: 0,
    total_mentions: 0,
    unread_conversations: 0
  });
  const [channelsWithUnread, setChannelsWithUnread] = useState([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Helper functions - defined before useEffects that use them
  const loadWorkspaceDirectMessages = async (ws) => {
    if (!ws) return [];

    try {
      setLoading(true);
      const response = await threadAPI.getThreads(ws.id);
      const threadsData = response.data;

      const dms = threadsData.direct_messages.map(thread => ({
        id: thread.id,
        name: thread.name || 'Direct Message',
        status: 'online',
        initials: thread.name ? thread.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'DM',
        unread: thread.unread_count || 0
      }));

      return dms;
    } catch (error) {
      console.error('Failed to load direct messages:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getChannelUnreadCount = (channelId) => {
    const channelData = channelsWithUnread.find(ch => ch.id === channelId);
    return channelData?.unread_count || 0;
  };

  const getChannelMentionCount = (channelId) => {
    const channelData = channelsWithUnread.find(ch => ch.id === channelId);
    return channelData?.unread_mentions || 0;
  };

  const isChannelMuted = (channelId) => {
    const channelData = channelsWithUnread.find(ch => ch.id === channelId);
    return channelData?.is_muted || false;
  };

  // Load direct messages and unread data when workspace changes
  useEffect(() => {
    const loadDMs = async () => {
      if (workspace) {
        const dms = await loadWorkspaceDirectMessages(workspace);
        setDirectMessages(dms);
      }
    };
    loadDMs();
  }, [workspace]);

  // Load unread summary and channel data
  useEffect(() => {
    const loadUnreadData = async () => {
      if (!workspace?.id) return;
      
      try {
        console.log('📊 Loading initial unread data for workspace:', workspace.id);
        
        const [summaryResponse, channelsResponse] = await Promise.all([
          notificationAPI.getUnreadSummary(workspace.id),
          notificationAPI.getChannelsWithUnread(workspace.id)
        ]);
        
        setUnreadSummary(summaryResponse.data.summary);
        setChannelsWithUnread(channelsResponse.data.channels);
        
        console.log('📊 Initial unread data loaded:', {
          summary: summaryResponse.data.summary,
          channelsCount: channelsResponse.data.channels.length
        });
      } catch (error) {
        console.error('Failed to load unread data:', error);
      }
    };

    loadUnreadData();
  }, [workspace?.id]);

  // Set up real-time notification listeners
  useEffect(() => {
    if (!workspace?.id) return;

    const handleNotificationUpdate = (data) => {
      if (data.workspaceId === workspace.id) {
        console.log('📱 Sidebar: Notification update received', data);
        
        setChannelsWithUnread(prev => {
          const existingIndex = prev.findIndex(ch => ch.id === data.entityId);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              unread_count: Math.max(0, updated[existingIndex].unread_count + data.unreadIncrement),
              unread_mentions: Math.max(0, updated[existingIndex].unread_mentions + data.mentionIncrement)
            };
            return updated;
          } else {
            if (data.unreadIncrement > 0) {
              return [...prev, {
                id: data.entityId,
                unread_count: data.unreadIncrement,
                unread_mentions: data.mentionIncrement || 0,
                is_muted: false
              }];
            }
          }
          return prev;
        });

        setUnreadSummary(prev => ({
          ...prev,
          total_unread: Math.max(0, prev.total_unread + data.unreadIncrement),
          total_mentions: Math.max(0, prev.total_mentions + data.mentionIncrement)
        }));
      }
    };

    const handleReadStatusUpdate = (data) => {
      if (data.workspaceId === workspace.id) {
        console.log('📖 Sidebar: Read status update', data);
        
        setChannelsWithUnread(prev => 
          prev.map(ch => 
            ch.id === data.entityId 
              ? { ...ch, unread_count: data.unreadCount || 0, unread_mentions: 0 }
              : ch
          ).filter(ch => ch.unread_count > 0 || ch.unread_mentions > 0)
        );
      }
    };

    const handleWorkspaceNotificationUpdate = (data) => {
      if (data.workspaceId === workspace.id) {
        console.log('🏢 Sidebar: Workspace notification update', data);
        
        setUnreadSummary({
          total_unread: data.totalUnread || 0,
          total_mentions: data.totalMentions || 0,
          unread_conversations: data.totalUnread > 0 ? 1 : 0
        });
      }
    };

    const handleNewMessage = (data) => {
      if (data.workspaceId === workspace.id || (data.message && data.threadId)) {
        console.log('💬 Sidebar: New message notification', data);
        
        const channelElement = document.querySelector(`[data-channel-id="${data.threadId}"]`);
        if (channelElement) {
          channelElement.classList.add('animate-notification-bounce');
          setTimeout(() => {
            channelElement.classList.remove('animate-notification-bounce');
          }, 1000);
        }
      }
    };

    socketManager.on('notification_update', handleNotificationUpdate);
    socketManager.on('read_status_update', handleReadStatusUpdate);
    socketManager.on('workspace_notification_update', handleWorkspaceNotificationUpdate);
    socketManager.on('new_message', handleNewMessage);

    return () => {
      socketManager.off('notification_update', handleNotificationUpdate);
      socketManager.off('read_status_update', handleReadStatusUpdate);
      socketManager.off('workspace_notification_update', handleWorkspaceNotificationUpdate);
      socketManager.off('new_message', handleNewMessage);
    };
  }, [workspace?.id]);

  const handleChannelSelect = async (channel) => {
    // Always mark channel as read when selected (fixes race condition)
    // The API will handle the case where there are no unreads
    try {
      await notificationAPI.markAsRead(workspace.id, {
        entity_type: 'thread',
        entity_id: channel.id
      });

      // Update local state - clear any unreads for this channel
      setChannelsWithUnread(prev =>
        prev.map(ch =>
          ch.id === channel.id
            ? { ...ch, unread_count: 0, unread_mentions: 0 }
            : ch
        )
      );
    } catch (error) {
      console.error('Failed to mark channel as read:', error);
      // Continue anyway - not critical
    }

    onChannelSelect(channel);
  };

  const handleOpenCreateGroup = async () => {
    if (!workspace?.id) return;

    try {
      const response = await workspaceAPI.getMembers(workspace.id);
      setWorkspaceMembers(response.data.members || []);
      setSelectedGroupMembers([]);
      setShowCreateGroupModal(true);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleToggleGroupMember = (memberId) => {
    setSelectedGroupMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateGroup = async () => {
    if (selectedGroupMembers.length === 0 || !workspace?.id) return;

    setCreatingGroup(true);
    try {
      await threadAPI.createThread(workspace.id, {
        type: 'direct_message',
        members: selectedGroupMembers
      });

      // Reload DMs
      const dms = await loadWorkspaceDirectMessages(workspace);
      setDirectMessages(dms);

      setShowCreateGroupModal(false);
      setSelectedGroupMembers([]);
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Workspace Header */}
      <div className="workspace-header" onClick={onWorkspaceSettings}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gradient-brand rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-text-inverse font-bold text-sm">
              {workspace?.name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="workspace-name truncate">
              {workspace?.name || 'crew'}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-success-400 rounded-full"></div>
              <span className="text-xs text-text-tertiary">
                {workspace?.member_count || 0} members
              </span>
            </div>
          </div>
        </div>
        
        {/* Mobile close button */}
        <button 
          className="btn-icon md:hidden" 
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Channel List */}
      <div className="channel-list">
        {/* Channels Section */}
        <div>
          <div className="section-header">
            <button
              onClick={() => setChannelsExpanded(!channelsExpanded)}
              className="flex items-center gap-2"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${channelsExpanded ? '' : '-rotate-90'}`} />
              <span>Channels</span>
            </button>
            <button 
              className="btn-icon" 
              onClick={onAddChannel}
              title="Add channel"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {channelsExpanded && (
            <div className="space-y-1">
              {channels.map((channel) => {
                const unreadCount = getChannelUnreadCount(channel.id);
                const mentionCount = getChannelMentionCount(channel.id);
                const isMuted = isChannelMuted(channel.id);
                
                return (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    data-channel-id={channel.id}
                    className={`channel-item ${
                      currentChannel?.id === channel.id ? 'active' : ''
                    } ${unreadCount > 0 ? 'unread' : ''}`}
                  >
                    <Hash className="w-4 h-4" />
                    <span className="truncate flex-1">{channel.name}</span>
                    
                    <div className="flex items-center gap-1">
                      {isMuted && (
                        <BellOff className="w-3 h-3 text-text-quaternary" />
                      )}
                      {mentionCount > 0 && (
                        <div className="badge-count bg-error-500">
                          @{mentionCount}
                        </div>
                      )}
                      {unreadCount > 0 && mentionCount === 0 && (
                        <div className={`badge-count ${isMuted ? 'bg-gray-400' : 'bg-accent-500'}`}>
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              
              <button 
                className="channel-item text-text-tertiary" 
                onClick={onAddChannel}
              >
                <Plus className="w-4 h-4" />
                <span>Add channels</span>
              </button>
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="section-header">
            <button
              onClick={() => setDirectMessagesExpanded(!directMessagesExpanded)}
              className="flex items-center gap-2"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${directMessagesExpanded ? '' : '-rotate-90'}`} />
              <span>Direct messages</span>
            </button>
            <button
              className="btn-icon"
              title="New group"
              onClick={handleOpenCreateGroup}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {directMessagesExpanded && (
            <div className="space-y-1">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  className="channel-item"
                >
                  <div className="relative">
                    <div className="w-7 h-7 bg-gradient-accent rounded-lg flex items-center justify-center">
                      <span className="text-text-inverse text-xs font-medium">{dm.initials}</span>
                    </div>
                    <div className={`w-3 h-3 absolute -bottom-0.5 -right-0.5 border-2 border-white rounded-full ${
                      dm.status === 'online' ? 'bg-online' : dm.status === 'away' ? 'bg-away' : 'bg-offline'
                    }`} />
                  </div>
                  <span className="truncate">{dm.name}</span>
                  
                  {dm.unread > 0 && (
                    <div className="badge-count">
                      {dm.unread}
                    </div>
                  )}
                </button>
              ))}
              
              <button className="channel-item text-text-tertiary">
                <Users className="w-4 h-4" />
                <span>Browse people</span>
              </button>
            </div>
          )}
        </div>

        {/* Knowledge Base Section */}
        <div>
          <div className="section-header">
            <span>Knowledge Base</span>
            <button className="btn-icon" title="Add knowledge">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          
          <div className="space-y-1">
            <button className="channel-item">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Browse Knowledge</span>
            </button>
            
            <button className="channel-item">
              <Star className="w-4 h-4 text-yellow-600" />
              <span>My Bookmarks</span>
              {unreadSummary.total_unread > 0 && (
                <div className="badge-count">
                  {unreadSummary.total_unread > 99 ? '99+' : unreadSummary.total_unread}
                </div>
              )}
            </button>
            
            <button className="channel-item">
              <Hash className="w-4 h-4 text-purple-600" />
              <span>Categories</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-auto p-3 border-t border-border-primary bg-surface-secondary/50 backdrop-blur-sm space-y-1">
        <button className="channel-item">
          <MessageSquare className="w-4 h-4" />
          <span>All Threads</span>
        </button>

        <button
          className="channel-item"
          onClick={onWorkspaceSettings}
        >
          <Users className="w-4 h-4" />
          <span>People & Teams</span>
        </button>
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create Group</h2>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">
                Select members for this group chat:
              </p>

              <div className="space-y-2">
                {workspaceMembers
                  .filter(m => !m.is_current_user)
                  .map((member) => {
                    const memberId = member.id || member.user_id;
                    const isSelected = selectedGroupMembers.includes(memberId);
                    const displayName = member.display_name || 'Unknown';

                    return (
                      <label
                        key={memberId}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 hover:bg-gray-100'
                        } border`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleGroupMember(memberId)}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-700">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{displayName}</div>
                          <div className="text-xs text-gray-500 truncate">{member.email}</div>
                        </div>
                      </label>
                    );
                  })}
              </div>

              {selectedGroupMembers.length > 0 && (
                <p className="mt-4 text-sm text-purple-600 font-medium">
                  {selectedGroupMembers.length} member{selectedGroupMembers.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={selectedGroupMembers.length === 0 || creatingGroup}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Sidebar.propTypes = {
  workspace: PropTypes.object,
  channels: PropTypes.array.isRequired,
  currentChannel: PropTypes.object,
  onChannelSelect: PropTypes.func.isRequired,
  onAddChannel: PropTypes.func,
  onWorkspaceSettings: PropTypes.func,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Sidebar;
