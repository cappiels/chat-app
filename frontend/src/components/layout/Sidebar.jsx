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
import { threadAPI, notificationAPI } from '../../utils/api';
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

  const loadWorkspaceDirectMessages = async (workspace) => {
    if (!workspace) return [];
    
    try {
      setLoading(true);
      const response = await threadAPI.getThreads(workspace.id);
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

  // Auto-clear unreads when viewing a channel that has unread messages
  // This fixes the race condition where user clicks a channel before unread data loads
  useEffect(() => {
    const clearUnreadsForCurrentChannel = async () => {
      if (!workspace?.id || !currentChannel?.id) return;

      const unreadCount = getChannelUnreadCount(currentChannel.id);
      if (unreadCount > 0) {
        console.log('📖 Auto-marking current channel as read:', currentChannel.name);
        try {
          await notificationAPI.markAsRead(workspace.id, {
            entity_type: 'thread',
            entity_id: currentChannel.id
          });

          setChannelsWithUnread(prev =>
            prev.map(ch =>
              ch.id === currentChannel.id
                ? { ...ch, unread_count: 0, unread_mentions: 0 }
                : ch
            )
          );

          const mentionCount = getChannelMentionCount(currentChannel.id);
          setUnreadSummary(prev => ({
            ...prev,
            total_unread: Math.max(0, prev.total_unread - unreadCount),
            total_mentions: Math.max(0, prev.total_mentions - mentionCount),
            unread_conversations: Math.max(0, prev.unread_conversations - 1)
          }));
        } catch (error) {
          console.error('Failed to auto-mark channel as read:', error);
        }
      }
    };

    clearUnreadsForCurrentChannel();
  }, [currentChannel?.id, channelsWithUnread, workspace?.id]);

  const handleChannelSelect = async (channel) => {
    const unreadCount = getChannelUnreadCount(channel.id);
    if (unreadCount > 0) {
      try {
        await notificationAPI.markAsRead(workspace.id, {
          entity_type: 'thread',
          entity_id: channel.id
        });
        
        setChannelsWithUnread(prev => 
          prev.map(ch => 
            ch.id === channel.id 
              ? { ...ch, unread_count: 0, unread_mentions: 0 }
              : ch
          )
        );
        
        setUnreadSummary(prev => ({
          ...prev,
          total_unread: Math.max(0, prev.total_unread - unreadCount),
          total_mentions: Math.max(0, prev.total_mentions - getChannelMentionCount(channel.id)),
          unread_conversations: Math.max(0, prev.unread_conversations - 1)
        }));
      } catch (error) {
        console.error('Failed to mark channel as read:', error);
      }
    }
    
    onChannelSelect(channel);
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
            <button className="btn-icon" title="New message">
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
