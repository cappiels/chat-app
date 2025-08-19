import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  ChevronDown, 
  Plus, 
  Hash, 
  Lock, 
  MessageSquare,
  Users,
  MoreVertical,
  X,
  Bell,
  BellOff
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

  // Load unread summary and channel data (initial load only)
  useEffect(() => {
    const loadUnreadData = async () => {
      if (!workspace?.id) return;
      
      try {
        console.log('📊 Loading initial unread data for workspace:', workspace.id);
        
        // Load both unread summary and channels with unread counts
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
    
    // No more polling - rely purely on real-time updates
  }, [workspace?.id]);

  // Set up real-time notification listeners
  useEffect(() => {
    if (!workspace?.id) return;

    const handleNotificationUpdate = (data) => {
      if (data.workspaceId === workspace.id) {
        console.log('📱 Sidebar: Notification update received', data);
        
        // Update unread count for specific channel
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
            // Add new channel to unread list if it has unread messages
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

        // Update summary
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
        
        // Update specific channel unread count
        setChannelsWithUnread(prev => 
          prev.map(ch => 
            ch.id === data.entityId 
              ? { ...ch, unread_count: data.unreadCount || 0, unread_mentions: 0 }
              : ch
          ).filter(ch => ch.unread_count > 0 || ch.unread_mentions > 0) // Remove channels with no unread
        );
      }
    };

    const handleWorkspaceNotificationUpdate = (data) => {
      if (data.workspaceId === workspace.id) {
        console.log('🏢 Sidebar: Workspace notification update', data);
        
        setUnreadSummary({
          total_unread: data.totalUnread || 0,
          total_mentions: data.totalMentions || 0,
          unread_conversations: data.totalUnread > 0 ? 1 : 0 // Simplified count
        });
      }
    };

    const handleNewMessage = (data) => {
      if (data.workspaceId === workspace.id || (data.message && data.threadId)) {
        console.log('💬 Sidebar: New message notification', data);
        
        // Show notification badge animation for new messages
        const channelElement = document.querySelector(`[data-channel-id="${data.threadId}"]`);
        if (channelElement) {
          channelElement.classList.add('animate-notification-bounce');
          setTimeout(() => {
            channelElement.classList.remove('animate-notification-bounce');
          }, 1000);
        }
      }
    };

    // Listen for real-time notification events
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
      
      // Filter direct messages from the threads response
      const dms = threadsData.direct_messages.map(thread => ({
        id: thread.id,
        name: thread.name || 'Direct Message',
        status: 'online', // Default status - could be enhanced with real presence data
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

  // Helper to get unread count for a specific channel
  const getChannelUnreadCount = (channelId) => {
    const channelData = channelsWithUnread.find(ch => ch.id === channelId);
    return channelData?.unread_count || 0;
  };

  // Helper to get mention count for a specific channel
  const getChannelMentionCount = (channelId) => {
    const channelData = channelsWithUnread.find(ch => ch.id === channelId);
    return channelData?.unread_mentions || 0;
  };

  // Helper to check if channel is muted
  const isChannelMuted = (channelId) => {
    const channelData = channelsWithUnread.find(ch => ch.id === channelId);
    return channelData?.is_muted || false;
  };

  // Handle marking channel as read when user clicks on it
  const handleChannelSelect = async (channel) => {
    // Mark as read if there are unread messages
    const unreadCount = getChannelUnreadCount(channel.id);
    if (unreadCount > 0) {
      try {
        await notificationAPI.markAsRead(workspace.id, {
          entity_type: 'thread',
          entity_id: channel.id
        });
        
        // Update local state immediately for instant UI feedback
        setChannelsWithUnread(prev => 
          prev.map(ch => 
            ch.id === channel.id 
              ? { ...ch, unread_count: 0, unread_mentions: 0 }
              : ch
          )
        );
        
        // Update summary
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
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Workspace Header */}
      <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-white font-bold text-sm">
                {workspace?.name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 truncate text-sm">
                {workspace?.name || 'ChatFlow'}
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full shadow-sm" />
                <span className="text-xs text-slate-500">
                  {workspace?.member_count || 0} {(workspace?.member_count || 0) === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>
          <button 
            className="md:hidden p-2 hover:bg-slate-200 rounded-lg transition-colors duration-200" 
            onClick={onClose}
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Channels Section */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <button
              onClick={() => setChannelsExpanded(!channelsExpanded)}
              className="flex items-center gap-2 hover:text-slate-800 transition-colors duration-200"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${channelsExpanded ? '' : '-rotate-90'}`} />
              <span>Channels</span>
            </button>
            <button 
              className="p-1 hover:bg-slate-200 rounded transition-colors duration-200" 
              onClick={onAddChannel}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {channelsExpanded && (
            <div className="mt-2 space-y-0.5">
              {channels.map((channel) => {
                const unreadCount = getChannelUnreadCount(channel.id);
                const mentionCount = getChannelMentionCount(channel.id);
                const isMuted = isChannelMuted(channel.id);
                
                return (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    data-channel-id={channel.id}
                    className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-all duration-200 relative group ${
                      currentChannel?.id === channel.id 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm' 
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    } ${unreadCount > 0 ? 'font-semibold' : ''}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Hash className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate flex-1">{channel.name}</span>
                      {isMuted && (
                        <BellOff className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {mentionCount > 0 && (
                        <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                          @{mentionCount}
                        </span>
                      )}
                      {unreadCount > 0 && mentionCount === 0 && (
                        <span className={`text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-sm ${
                          isMuted ? 'bg-slate-400' : 'bg-red-500'
                        }`}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              <button 
                className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200" 
                onClick={onAddChannel}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Add channels</span>
              </button>
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <button
              onClick={() => setDirectMessagesExpanded(!directMessagesExpanded)}
              className="flex items-center gap-2 hover:text-slate-800 transition-colors duration-200"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${directMessagesExpanded ? '' : '-rotate-90'}`} />
              <span>Direct messages</span>
            </button>
            <button className="p-1 hover:bg-slate-200 rounded transition-colors duration-200">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {directMessagesExpanded && (
            <div className="mt-2 space-y-0.5">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                      <span className="text-white text-xs font-medium">{dm.initials}</span>
                    </div>
                    <div className={`w-3 h-3 absolute -bottom-0.5 -right-0.5 border-2 border-white rounded-full ${
                      dm.status === 'online' ? 'bg-green-400' : dm.status === 'away' ? 'bg-yellow-400' : 'bg-slate-400'
                    }`} />
                  </div>
                  <span className="truncate flex-1">{dm.name}</span>
                </button>
              ))}
              <button className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all duration-200">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Browse people</span>
              </button>
            </div>
          )}
        </div>

        {/* Apps Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Apps</span>
            <button className="p-1 hover:bg-slate-200 rounded transition-colors duration-200">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom User Section */}
      <div className="p-3 border-t border-slate-200 bg-white/30 backdrop-blur-sm space-y-0.5">
        <button className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200">
          <MessageSquare className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Threads</span>
        </button>
        <button 
          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all duration-200"
          onClick={onWorkspaceSettings}
        >
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">People & user groups</span>
        </button>
      </div>
    </aside>
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
