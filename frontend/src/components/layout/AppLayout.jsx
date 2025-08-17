import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import MessageList from '../chat/MessageList';
import MessageComposer from '../chat/MessageComposer';
import Thread from '../chat/Thread';
import InviteDialog from '../InviteDialog';
import { threadAPI, messageAPI } from '../../utils/api';

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
  
  // Loading and error states
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);

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

  // Load channels based on workspace
  useEffect(() => {
    const loadChannels = async () => {
      if (workspace) {
        const realChannels = await loadWorkspaceChannels(workspace);
        setChannels(realChannels);
        setCurrentChannel(realChannels[0] || null);
        setMessages([]);
        setThreads([]);
      }
    };
    loadChannels();
  }, [workspace]);

  const loadWorkspaceChannels = async (workspace) => {
    try {
      setChannelsLoading(true);
      setError(null);
      
      const response = await threadAPI.getThreads(workspace.id);
      const threadsData = response.data;
      
      // Filter channels from the threads response
      const channels = threadsData.filter(thread => thread.type === 'channel').map(thread => ({
        id: thread.id,
        name: thread.name,
        type: thread.type,
        unread: thread.unread_count || 0
      }));
      
      // Always ensure there's at least a general channel
      if (channels.length === 0) {
        return [{ id: 'general', name: 'general', type: 'channel', unread: 0 }];
      }
      
      return channels;
    } catch (error) {
      console.error('Failed to load channels:', error);
      setError('Failed to load channels. Please try refreshing the page.');
      // Fallback to general channel only
      return [{ id: 'general', name: 'general', type: 'channel', unread: 0 }];
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
    // Clear existing threads when switching channels
    setThreads([]);
    setSelectedThread(null);
    setThreadOpen(false);
    setMessagesLoading(true);
    setError(null);

    try {
      const messagesResponse = await messageAPI.getMessages(channel.id);
      const channelMessages = messagesResponse.data.map(msg => ({
        id: msg.id,
        user: {
          name: msg.user_name || 'User',
          avatar: msg.user_avatar,
          initials: msg.user_name ? msg.user_name.split(' ').map(n => n[0]).join('') : 'U',
          status: 'online'
        },
        content: msg.content,
        timestamp: new Date(msg.created_at),
        thread_count: msg.thread_count || 0,
        thread_participants: msg.thread_participants || [],
        reactions: msg.reactions || []
      }));
      
      setMessages(channelMessages);
      
      // Don't load all thread replies immediately - only load when user opens thread
      // This dramatically improves initial load time
      setThreads([]);
      
    } catch (error) {
      console.error('Failed to load channel messages:', error);
      setError('Failed to load messages. Please try again.');
      // Show empty state - let user start conversation
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
      await messageAPI.sendMessage({
        thread_id: currentChannel.id,
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

  return (
    <div className="app-layout">
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
          className={`mobile-overlay ${sidebarOpen ? 'visible' : ''}`}
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="main-content">
        {currentChannel ? (
          <>
            <MessageList
              channel={currentChannel}
              messages={messages}
              onThreadClick={handleThreadOpen}
              currentUser={user}
            />
            <MessageComposer
              channel={currentChannel}
              onSendMessage={handleSendMessage}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-tertiary">Select a channel to start messaging</p>
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
            
            const updatedThread = {
              ...selectedThread,
              messages: [...selectedThread.messages, newReply]
            };
            
            setSelectedThread(updatedThread);
            setThreads(threads.map(t => t.id === selectedThread.id ? updatedThread : t));
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
