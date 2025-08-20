import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import MessageList from '../chat/MessageList';
import MessageComposer from '../chat/MessageComposer';
import Thread from '../chat/Thread';
import InviteDialog from '../InviteDialog';
import WorkspaceSettingsDialog from '../WorkspaceSettingsDialog';
import { threadAPI, messageAPI } from '../../utils/api';
import socketManager from '../../utils/socket';

const AppLayout = ({ user, workspace, onSignOut, onWorkspaceSwitch, onBackToWorkspaces }) => {
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeSection, setActiveSection] = useState('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createChannelDialogOpen, setCreateChannelDialogOpen] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  
  // Loading and error states
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false); // Close mobile sidebar on desktop
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

  // Join thread when current channel changes  
  useEffect(() => {
    if (currentChannel && workspace) {
      console.log('💬 Joining thread for channel:', currentChannel.name);
      socketManager.joinThread(workspace.id, currentChannel.id);
    }
  }, [currentChannel, workspace]);

  // Socket event listeners for real-time updates
  useEffect(() => {
    if (!currentChannel) return;

    // Handler for new messages
    const handleNewMessage = (data) => {
      console.log('📩 New message received in AppLayout:', data);
      
      // Only process messages for the current channel
      if (data.threadId === currentChannel.id) {
        const newMessage = {
          id: data.message.id,
          user: {
            name: data.message.sender_name || 'User',
            avatar: data.message.sender_avatar,
            initials: data.message.sender_name ? data.message.sender_name.split(' ').map(n => n[0]).join('') : 'U',
            status: 'online'
          },
          content: data.message.content,
          timestamp: new Date(data.timestamp || data.message.created_at),
          thread_count: data.message.reply_count || 0,
          thread_participants: [],
          reactions: data.message.reactions || []
        };
        
        // Update messages array with the new message
        setMessages(prevMessages => [...prevMessages, newMessage]);
      }
    };

    // Handler for typing indicators
    const handleUserTyping = (data) => {
      console.log('⌨️ Typing event in AppLayout:', data);
      
      // Only process typing events for the current channel
      if (data.threadId === currentChannel.id) {
        setTypingUsers(prev => {
          // Remove this user first (to avoid duplicates)
          const filtered = prev.filter(user => user.userId !== data.userId);
          
          if (data.isTyping) {
            // Add user to typing list with compatible naming
            return [...filtered, {
              userId: data.userId,
              user: {
                // Map user properties ensuring they match what TypingIndicator expects
                display_name: data.user.name || data.user.display_name || 'User',
                profile_picture_url: data.user.avatar || data.user.profile_picture_url,
                // Keep original data for reference
                ...data.user
              },
              timestamp: new Date(data.timestamp)
            }];
          } else {
            // User stopped typing
            return filtered;
          }
        });
      }
    };

    // Register event listeners
    socketManager.on('new_message', handleNewMessage);
    socketManager.on('user_typing', handleUserTyping);
    
    // Clean up
    return () => {
      socketManager.off('new_message', handleNewMessage);
      socketManager.off('user_typing', handleUserTyping);
      setTypingUsers([]);
    };
  }, [currentChannel]);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = new Date();
        return prev.filter(user => {
          const timeSinceTyping = now - new Date(user.timestamp);
          return timeSinceTyping < 10000; // Remove after 10 seconds
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
      
      // Handle the actual response structure from backend
      const threadsData = response.data;
      const allThreads = threadsData.threads || [];
      
      // Filter only channels (not DMs) and map to expected format
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
      
      console.log('Processed channels:', channels);
      
      // If no channels found, return empty array - don't create fake channels
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
      console.log('Messages API response:', messagesResponse.data);
      
      // Handle the actual response structure from backend
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
        reactions: msg.reactions || []
      }));
      
      console.log('Processed messages:', channelMessages);
      setMessages(channelMessages);
      setThreads([]);
      
    } catch (error) {
      console.error('Failed to load channel messages:', error);
      console.error('Error details:', error.response?.data);
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
        timestamp: new Date(reply.created_at)
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
    // Messages will be loaded by the useEffect that watches currentChannel changes
  };

  const generateMockThreadReplies = (parentMessage) => {
    return [
      {
        id: `${parentMessage.id}-reply-1`,
        user: { name: 'Team Member', initials: 'TM', status: 'online' },
        content: 'Thanks for sharing this!',
        timestamp: new Date(parentMessage.timestamp.getTime() + 300000)
      },
      {
        id: `${parentMessage.id}-reply-2`,
        user: { name: 'Another User', initials: 'AU', status: 'online' },
        content: 'This is really helpful information.',
        timestamp: new Date(parentMessage.timestamp.getTime() + 600000)
      }
    ];
  };

  const handleThreadOpen = async (message) => {
    try {
      // Check if message has existing thread responses
      if (message.thread_count > 0) {
        // Load thread replies via API
        const threadReplies = await loadThreadReplies(message.id);
      // Log the threadReplies to verify sort order
      console.log('Thread replies before setting state:', threadReplies.map(r => ({ 
        id: r.id, 
        timestamp: r.timestamp, 
        content: r.content.substring(0, 30) 
      })));
      
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
      // Send message via API
      await messageAPI.sendMessage(workspace.id, currentChannel.id, {
        content: content.trim(),
        message_type: 'text'
      });
      
      // Reload messages to get the real message with proper ID and timestamp
      await loadChannelMessages(currentChannel);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Could show toast error notification here
      // For now, add the message optimistically to show immediate feedback
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
        sending: true // Mark as sending to show different UI state
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
    // In a real app, you might want to refresh workspace member list
  };

  const handleWorkspaceSettingsOpen = () => {
    setShowWorkspaceSettings(true);
  };

  const handleWorkspaceDeleted = (workspaceId, archived) => {
    // If workspace is deleted, go back to workspace selection
    onBackToWorkspaces();
  };

  const handleMemberRemoved = (memberId) => {
    // Member removed - could refresh channel list if needed
    console.log('Member removed:', memberId);
  };

  const handleChannelMembers = () => {
    // Open workspace settings dialog to show members
    setShowWorkspaceSettings(true);
  };

  const handleChannelInfo = () => {
    // For now, show workspace settings (could create separate ChannelInfoDialog later)
    setShowWorkspaceSettings(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Header */}
      <Header
        workspace={workspace}
        user={user}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onSignOut={onSignOut}
        onInvite={() => setInviteDialogOpen(true)}
        onWorkspaceSwitch={onWorkspaceSwitch}
        onBackToWorkspaces={onBackToWorkspaces}
      />

      {/* Mobile overlay */}
      {isMobile && (
        <div 
          className={`fixed inset-0 bg-black/50 z-40 ${sidebarOpen ? 'block' : 'hidden'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white mt-11 h-[calc(100vh-44px)] min-w-0 border-l border-slate-200" style={{ marginTop: '44px', height: 'calc(100vh - 44px)' }}>
        {currentChannel ? (
          <>
            <MessageList
              channel={currentChannel}
              messages={messages}
              onThreadClick={handleThreadOpen}
              currentUser={user}
              onChannelMembers={handleChannelMembers}
              onChannelInfo={handleChannelInfo}
              typingUsers={typingUsers}
              lastReadMessageId={currentChannel.last_read_id}
            />
            <MessageComposer
              channel={currentChannel}
              onSendMessage={handleSendMessage}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-500">Select a channel to start messaging</p>
          </div>
        )}
      </main>

      {/* Thread Sidebar */}
      {threadOpen && (
        <Thread
          thread={selectedThread}
          isOpen={threadOpen}
          onClose={() => setThreadOpen(false)}
          currentUser={user}
          typingUsers={typingUsers} 
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
            
            // Add the new reply to the thread's messages
            const newMessages = [...selectedThread.messages, newReply];
            
            // Log the messages to check order
            console.log('Thread messages after adding reply:', newMessages.map(m => ({
              id: m.id, 
              timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
              content: m.content.substring(0, 30)
            })));
            
            // The Thread component will handle sorting these by timestamp
            const updatedThread = {
              ...selectedThread,
              messages: newMessages
            };
            
            setSelectedThread(updatedThread);
            setThreads(threads.map(t => t.id === selectedThread.id ? updatedThread : t));
            
            // In a real implementation, you would also send this reply to the server
            // messageAPI.sendThreadReply(workspace.id, selectedThread.parentMessage.id, {
            //   content: content.trim(),
            //   message_type: 'text'
            // });
          }}
        />
      )}

      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
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
