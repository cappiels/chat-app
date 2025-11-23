import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Header from './Header';
import Sidebar from './Sidebar';
import MessageList from '../chat/MessageList';
import MessageComposer from '../chat/MessageComposer';
import Thread from '../chat/Thread';
import InviteDialog from '../InviteDialog';
import WorkspaceSettingsDialog from '../WorkspaceSettingsDialog';
import { threadAPI, messageAPI } from '../../utils/api';
import socketManager from '../../utils/socket';
import notificationManager from '../../utils/notifications';

const AppLayout = ({ user, workspace, onSignOut, onWorkspaceSwitch, onBackToWorkspaces }) => {
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeSection, setActiveSection] = useState('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createChannelDialogOpen, setCreateChannelDialogOpen] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  
  // Loading and error states
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentView, setCurrentView] = useState('chat'); // chat, calendar, timeline

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize socket connection and load channels when workspace changes
  useEffect(() => {
    const initializeWorkspace = async () => {
      if (workspace && user) {
        console.log('🚀 Initializing workspace:', workspace.name);
        
        // Initialize socket connection
        try {
          await socketManager.connect();
          socketManager.joinWorkspace(workspace.id);
        } catch (error) {
          console.error('Failed to initialize socket for workspace:', error);
          notificationManager.playErrorSound();
        }
        
        // Enable notification sounds automatically (browser requires user interaction first)
        // This runs after user has clicked to select a workspace, satisfying browser requirements
        try {
          const soundManager = (await import('../../utils/soundManager')).default;
          await soundManager.enableAudioContext();
          console.log('🔊 Notification sounds enabled');
        } catch (error) {
          console.warn('Failed to enable notification sounds:', error);
          // Non-critical - sounds just won't play
        }
        
        // Load channels
        const realChannels = await loadWorkspaceChannels(workspace);
        setChannels(realChannels);
        setCurrentChannel(realChannels[0] || null);
        setMessages([]);
        setThreads([]);
      }
    };
    
    initializeWorkspace();
  }, [workspace, user]);

  // Socket connection status listeners
  useEffect(() => {
    const handleConnection = () => {
      console.log('🔗 Socket connected');
      notificationManager.playConnectionSound(true);
    };

    const handleDisconnection = (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      notificationManager.playConnectionSound(false);
    };

    socketManager.onConnect(handleConnection);
    socketManager.onDisconnect(handleDisconnection);

    return () => {
      // Cleanup is handled by socketManager internally
    };
  }, []);

  // Join thread when current channel changes  
  useEffect(() => {
    if (currentChannel && workspace) {
      // Leave previous thread if any
      socketManager.leaveThread().then(() => {
        console.log('💬 Joining thread for channel:', currentChannel.name);
        socketManager.joinThread(workspace.id, currentChannel.id);
      });
    }
  }, [currentChannel, workspace]);

  // Handler for new messages - useCallback to maintain stable reference
  // Industry standard: Socket.IO is just a notification, fetch from API for reliability
  const handleNewMessage = useCallback((data) => {
    console.log('🔔 New message notification:', data);
    
    const isCurrentUser = data.message?.sender_id === user?.uid;
    const isCurrentThread = data.threadId === currentChannel?.id;
    const isCurrentWorkspace = data.workspaceId === workspace?.id;
    
    // Refresh messages from HTTP API (source of truth) for current channel
    if (isCurrentThread && currentChannel) {
      console.log('🔄 Refreshing messages from API due to Socket.IO notification');
      loadChannelMessages(currentChannel);
    }
    
    // Play notification sounds (but not for messages sent by current user)
    if (!isCurrentUser) {
      // Determine the type of notification based on message context
      let notificationType = 'message';
      const messageContent = data.message.content || '';
      
      // Check if user is mentioned in the message
      const userDisplayName = user?.displayName || '';
      const userEmail = user?.email || '';
      const isMentioned = messageContent.includes(`@${userDisplayName}`) || 
                         messageContent.includes(`@${userEmail}`) ||
                         messageContent.includes('@everyone') ||
                         messageContent.includes('@here');
      
      if (isMentioned) {
        notificationType = 'mention';
      } else if (data.message.is_direct_message) {
        notificationType = 'direct_message';
      }
      
      // Create message object for notification
      const messageForNotification = {
        ...data.message,
        sender_name: data.message.sender_name || 'Someone',
        thread_name: data.threadName || currentChannel?.name || 'channel',
        content: data.message.content || 'sent a message'
      };
      
      // Show desktop notification and play sound
      notificationManager.showMessageNotification(
        messageForNotification, 
        notificationType, 
        currentChannel?.id, 
        workspace?.id
      );
    }
  }, [user, currentChannel, workspace]);

  // Handler for typing indicators - useCallback to maintain stable reference
  const handleUserTyping = useCallback((data) => {
    console.log('⌨️ Typing event received in AppLayout:', data);
    
    // Only process typing events for the current channel
    if (data.threadId === currentChannel?.id) {
      setTypingUsers(prev => {
        // Remove this user first (to avoid duplicates)
        const filtered = prev.filter(user => user.userId !== data.userId);
        
        if (data.isTyping) {
          // BACKWARDS COMPATIBLE: Handle both old nested format and new flattened format
          let userName, userAvatar;
          
          if (data.userName) {
            // New flattened format
            userName = data.userName;
            userAvatar = data.userAvatar;
          } else if (data.user) {
            // Old nested format
            userName = data.user.display_name || data.user.name || 'User';
            userAvatar = data.user.profile_picture_url || data.user.avatar;
          } else {
            userName = 'User';
            userAvatar = null;
          }
          
          const newTypingUser = {
            userId: data.userId,
            user: {
              display_name: userName,
              profile_picture_url: userAvatar
            },
            timestamp: new Date(data.timestamp)
          };
          return [...filtered, newTypingUser];
        } else {
          return filtered;
        }
      });
    }
  }, [currentChannel]);

  // Socket event listeners for real-time updates
  useEffect(() => {
    if (!currentChannel) return;

    // Register event listeners
    socketManager.on('new_message', handleNewMessage);
    socketManager.on('user_typing', handleUserTyping);
    
    // Clean up
    return () => {
      socketManager.off('new_message', handleNewMessage);
      socketManager.off('user_typing', handleUserTyping);
      setTypingUsers([]);
    };
  }, [currentChannel, handleNewMessage, handleUserTyping]);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = new Date();
        return prev.filter(user => {
          const timeSinceTyping = now - new Date(user.timestamp);
          return timeSinceTyping < 10000;
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadWorkspaceChannels = async (workspace) => {
    try {
      setChannelsLoading(true);
      setError(null);
      
      const response = await threadAPI.getThreads(workspace.id);
      console.log('Threads API response:', response.data);
      
      const threadsData = response.data;
      const allThreads = threadsData.threads || [];
      
      // Filter only channels and map to expected format
      const channels = allThreads
        .filter(thread => thread.type === 'channel')
        .map(thread => ({
          id: thread.id,
          name: thread.name,
          type: thread.type,
          unread: thread.unread_count || 0,
          is_member: thread.is_member,
          member_count: thread.member_count || 0
        }));
      
      return channels;
      
    } catch (error) {
      console.error('Failed to load channels:', error);
      setError(`Failed to load channels: ${error.response?.data?.message || error.message}`);
      return [];
    } finally {
      setChannelsLoading(false);
    }
  };

  // Load messages when channel changes
  useEffect(() => {
    if (currentChannel && workspace) {
      loadChannelMessages(currentChannel);
    }
  }, [currentChannel, workspace, user]);

  const loadChannelMessages = async (channel) => {
    if (!channel?.id) {
      console.log('No valid channel provided');
      return;
    }
    
    // Clear existing threads when switching channels
    setThreads([]);
    setSelectedThread(null);
    setThreadOpen(false);
    setMessagesLoading(true);
    setError(null);

    try {
      console.log(`Loading messages for channel: ${channel.name} (${channel.id})`);
      const messagesResponse = await messageAPI.getMessages(workspace.id, channel.id);
      
      const messagesData = messagesResponse.data;
      const rawMessages = messagesData.messages || [];
      
      const channelMessages = rawMessages.map(msg => ({
        id: msg.id,
        user: {
          name: msg.sender_name || 'User',
          avatar: msg.sender_avatar,
          initials: msg.sender_name ? msg.sender_name.split(' ').map(n => n[0]).join('') : 'U',
          status: 'online'
        },
        content: msg.content,
        timestamp: new Date(msg.created_at),
        thread_count: msg.reply_count || 0,
        thread_participants: [],
        reactions: msg.reactions || [],
        attachments: msg.attachments ? msg.attachments.map(att => ({
          id: att.id,
          name: att.file_name,
          url: att.file_url,
          type: att.mime_type,
          size: att.file_size_bytes,
          thumbnail_url: att.thumbnail_url
        })) : []
      }));
      
      setMessages(channelMessages);
      setThreads([]);
      
    } catch (error) {
      console.error('Failed to load channel messages:', error);
      setError(`Failed to load messages: ${error.response?.data?.message || error.message}`);
      setMessages([]);
      setThreads([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadThreadReplies = async (messageId) => {
    try {
      const response = await messageAPI.getMessages(messageId, { thread: true });
      return response.data.map(reply => ({
        id: reply.id,
        user: {
          name: reply.user_name || 'User',
          avatar: reply.user_avatar,
          initials: reply.user_name ? reply.user_name.split(' ').map(n => n[0]).join('') : 'U',
          status: 'online'
        },
        content: reply.content,
        timestamp: new Date(reply.created_at),
        attachments: reply.attachments || [],
        reactions: reply.reactions || [],
        edited: reply.is_edited || false,
        thread_count: reply.reply_count || 0
      }));
    } catch (error) {
      console.error('Failed to load thread replies:', error);
      return [];
    }
  };

  const handleChannelSelect = async (channel) => {
    setCurrentChannel(channel);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleThreadOpen = async (message) => {
    try {
      // Check if message has existing thread responses
      if (message.thread_count > 0) {
        const threadReplies = await loadThreadReplies(message.id);
        
        const thread = {
          id: `thread-${message.id}`,
          parentMessage: message,
          messages: threadReplies
        };
        setSelectedThread(thread);
        setThreadOpen(true);
      } else {
        // Create new empty thread
        const thread = {
          id: `thread-${message.id}`,
          parentMessage: message,
          messages: []
        };
        setSelectedThread(thread);
        setThreadOpen(true);
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
      // Still allow opening thread but with empty messages
      const thread = {
        id: `thread-${message.id}`,
        parentMessage: message,
        messages: []
      };
      setSelectedThread(thread);
      setThreadOpen(true);
    }
  };

  const handleSendMessage = async (content) => {
    if (!currentChannel || !content.trim()) return;
    
    try {
      // Get pending attachments from MessageComposer
      const attachments = window.pendingAttachments || [];
      
      // Remove attachment prefix from message content before sending
      const cleanContent = content.replace(/^📎 \d+ files? attached\n\n/, '').trim();
      
      // Build message payload
      const messagePayload = {
        content: cleanContent,
        message_type: 'text'
      };
      
      // Add attachments if any exist
      if (attachments.length > 0) {
        messagePayload.attachments = attachments.map(file => ({
          file_name: file.name,
          file_url: file.url,
          mime_type: file.type,
          file_size_bytes: file.size
        }));
      }
      
      // Send message via API
      await messageAPI.sendMessage(workspace.id, currentChannel.id, messagePayload);
      
      // Clear pending attachments after successful send
      window.pendingAttachments = [];
      
      // Reload messages to get the real message with proper ID and timestamp
      await loadChannelMessages(currentChannel);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add optimistic message for immediate feedback
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        user: {
          name: user.displayName || 'You',
          avatar: user.photoURL,
          initials: user.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : 'U',
          status: 'online'
        },
        content: content.trim(),
        timestamp: new Date(),
        sending: true
      };
      setMessages([...messages, optimisticMessage]);
    }
  };

  const handleCreateChannel = async (channelName) => {
    if (!workspace || !channelName.trim()) return;
    
    try {
      // Create channel via API
      await threadAPI.createChannel(workspace.id, {
        name: channelName.trim(),
        type: 'channel',
        description: `${channelName} channel`
      });
      
      // Reload channels to show the new one
      const updatedChannels = await loadWorkspaceChannels(workspace);
      setChannels(updatedChannels);
      
      // Find and select the newly created channel
      const newChannel = updatedChannels.find(ch => ch.name === channelName.trim());
      if (newChannel) {
        setCurrentChannel(newChannel);
      }
      
    } catch (error) {
      console.error('Failed to create channel:', error);
      setError('Failed to create channel. Please try again.');
    }
  };

  const handleAddChannelClick = () => {
    const channelName = prompt('Enter channel name:');
    if (channelName) {
      handleCreateChannel(channelName);
    }
  };

  const handleInviteSuccess = (invites) => {
    console.log('Invitations sent successfully:', invites);
  };

  const handleWorkspaceSettingsOpen = () => {
    setShowWorkspaceSettings(true);
  };

  const handleWorkspaceDeleted = (workspaceId, archived) => {
    onBackToWorkspaces();
  };

  const handleMemberRemoved = (memberId) => {
    console.log('Member removed:', memberId);
  };

  const handleChannelMembers = () => {
    setShowWorkspaceSettings(true);
  };

  const handleChannelInfo = () => {
    setShowWorkspaceSettings(true);
  };

  // Import calendar and timeline components at the top level
  const ChannelCalendar = React.lazy(() => import('../calendar/ChannelCalendar'));
  const WeeklyCalendar = React.lazy(() => import('../calendar/WeeklyCalendar'));
  const ChannelTimeline = React.lazy(() => import('../timeline/ChannelTimeline'));

  // Helper function to render full-screen views
  const renderFullScreenView = () => {
    const commonProps = {
      channel: currentChannel,
      workspace: workspace,
      workspaceId: workspace.id,
      currentUser: user
    };

    switch(currentView) {
      case 'calendar':
        return (
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading calendar...</div>}>
            <ChannelCalendar {...commonProps} />
          </React.Suspense>
        );
      case 'week':
        return (
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading weekly calendar...</div>}>
            <WeeklyCalendar {...commonProps} />
          </React.Suspense>
        );
      case 'timeline':
        return (
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading timeline...</div>}>
            <ChannelTimeline {...commonProps} />
          </React.Suspense>
        );
      default:
        return null;
    }
  };

  const isFullScreenView = ['calendar', 'week', 'timeline'].includes(currentView);

  return (
    <div className="app-shell">
      {/* Modern Header */}
      <div className="app-header">
        <Header
          workspace={workspace}
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onSignOut={onSignOut}
          onInvite={() => setInviteDialogOpen(true)}
          onWorkspaceSwitch={onWorkspaceSwitch}
          onBackToWorkspaces={onBackToWorkspaces}
          currentChannel={currentChannel}
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      </div>

      {/* Full-screen view for calendar/timeline modes */}
      {isFullScreenView && currentChannel ? (
        <div className="flex-1 overflow-hidden">
          {renderFullScreenView()}
        </div>
      ) : (
        <>
          {/* Mobile overlay */}
          {isMobile && sidebarOpen && (
            <div 
              className="mobile-overlay visible"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Modern Sidebar */}
          <div className={`app-sidebar ${isMobile && sidebarOpen ? 'open' : ''}`}>
            <Sidebar
              workspace={workspace}
              channels={channels}
              currentChannel={currentChannel}
              onChannelSelect={handleChannelSelect}
              onAddChannel={handleAddChannelClick}
              onWorkspaceSettings={handleWorkspaceSettingsOpen}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          </div>

          {/* Modern Main Content */}
          <div className="main-content">
            {currentChannel ? (
              <>
                <MessageList
                  channel={currentChannel}
                  messages={messages}
                  onThreadClick={handleThreadOpen}
                  currentUser={user}
                  typingUsers={typingUsers}
                  lastReadMessageId={currentChannel.last_read_id}
                  workspace={workspace}
                  workspaceId={workspace.id}
                  currentView={currentView}
                  userRole={workspace.user_role || workspace.role}
                />
                <div className="message-input-container">
                  <MessageComposer
                    channel={currentChannel}
                    onSendMessage={handleSendMessage}
                    workspace={workspace}
                    workspaceId={workspace?.id}
                    currentUser={user}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-surface-tertiary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">💬</span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    Select a channel
                  </h3>
                  <p className="text-text-secondary">
                    Choose a channel from the sidebar to start messaging
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modern Thread Panel */}
      {threadOpen && (
        <div className={`thread-panel ${threadOpen ? 'open' : ''}`}>
          <Thread
            thread={selectedThread}
            isOpen={threadOpen}
            onClose={() => setThreadOpen(false)}
            currentUser={user}
            typingUsers={typingUsers}
            workspace={workspace}
            workspaceId={workspace.id}
            userRole={workspace.user_role || workspace.role}
            onSendReply={(content) => {
              const newReply = {
                id: `${selectedThread.id}-reply-${Date.now()}`,
                user: {
                  name: user.displayName || 'You',
                  avatar: user.photoURL,
                  initials: user.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : 'U',
                  status: 'online'
                },
                content,
                timestamp: new Date()
              };
              
              const newMessages = [...selectedThread.messages, newReply];
              const updatedThread = {
                ...selectedThread,
                messages: newMessages
              };
              
              setSelectedThread(updatedThread);
              setThreads(threads.map(t => t.id === selectedThread.id ? updatedThread : t));
            }}
          />
        </div>
      )}

      {/* Invite Dialog */}
      <InviteDialog
        workspace={workspace}
        isOpen={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        onInviteSuccess={handleInviteSuccess}
      />

      {/* Workspace Settings Dialog */}
      <WorkspaceSettingsDialog
        workspace={workspace}
        user={user}
        isOpen={showWorkspaceSettings}
        onClose={() => setShowWorkspaceSettings(false)}
        onWorkspaceDeleted={handleWorkspaceDeleted}
        onMemberRemoved={handleMemberRemoved}
      />
    </div>
  );
};

AppLayout.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
  onWorkspaceSwitch: PropTypes.func,
  onBackToWorkspaces: PropTypes.func,
};

export default AppLayout;
