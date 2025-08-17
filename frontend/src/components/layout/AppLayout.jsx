import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import MessageList from '../chat/MessageList';
import MessageComposer from '../chat/MessageComposer';
import Thread from '../chat/Thread';
import InviteDialog from '../InviteDialog';

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

  // Mock data for demo
  useEffect(() => {
    setChannels([
      { id: '1', name: 'general', type: 'channel', unread: 0 },
      { id: '2', name: 'engineering', type: 'channel', unread: 3 },
      { id: '3', name: 'design', type: 'channel', unread: 0 },
      { id: '4', name: 'marketing', type: 'channel', unread: 1 },
      { id: '5', name: 'random', type: 'channel', unread: 0 },
    ]);
    setCurrentChannel({ id: '1', name: 'general', type: 'channel' });
  }, []);

  // Mock messages
  useEffect(() => {
    if (currentChannel) {
      const mockMessages = [
        {
          id: '1',
          user: {
            name: 'Alex Johnson',
            avatar: null,
            initials: 'AJ',
            status: 'online'
          },
          content: 'Hey team! Just wanted to check in on the project status. How are things going?',
          timestamp: new Date(Date.now() - 7200000),
          reactions: [
            { emoji: '👍', count: 3, users: ['Sarah', 'Mike', 'Lisa'] },
            { emoji: '🎉', count: 1, users: ['John'] }
          ]
        },
        {
          id: '2',
          user: {
            name: 'Sarah Chen',
            avatar: null,
            initials: 'SC',
            status: 'online'
          },
          content: 'Good morning! I just finished the design mockups for the new feature. Here\'s the link to the Figma file.',
          timestamp: new Date(Date.now() - 3600000),
          thread_count: 5,
          thread_participants: ['Mike', 'Lisa']
        },
        {
          id: '3',
          user: {
            name: user.displayName || 'You',
            avatar: user.photoURL,
            initials: user.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : 'U',
            status: 'online'
          },
          content: 'Looks great! I\'ll review them this afternoon.',
          timestamp: new Date(Date.now() - 1800000)
        }
      ];
      
      setMessages(mockMessages);
      
      // Generate mock threads for messages that have threads
      const mockThreads = mockMessages
        .filter(msg => msg.thread_count > 0)
        .map(msg => ({
          id: `thread-${msg.id}`,
          parentMessage: msg,
          messages: [
            {
              id: `${msg.id}-reply-1`,
              user: { name: 'Mike Johnson', initials: 'MJ', status: 'online' },
              content: 'I agree, this looks great! When can we start implementing?',
              timestamp: new Date(msg.timestamp.getTime() + 600000)
            },
            {
              id: `${msg.id}-reply-2`,
              user: { name: 'Lisa Park', initials: 'LP', status: 'online' },
              content: 'I can start working on this tomorrow. Should take about 2 days.',
              timestamp: new Date(msg.timestamp.getTime() + 1200000)
            }
          ]
        }));
      
      setThreads(mockThreads);
    }
  }, [currentChannel, user]);

  const handleChannelSelect = async (channel) => {
    setCurrentChannel(channel);
    if (isMobile) {
      setSidebarOpen(false);
    }
    
    // Load messages for the selected channel
    try {
      // In a real app, you would fetch messages from API
      // For now, we'll generate different mock data for different channels
      const channelMessages = generateMockMessagesForChannel(channel);
      setMessages(channelMessages);
      
      // Also generate threads for this channel's messages
      const channelThreads = channelMessages
        .filter(msg => msg.thread_count > 0)
        .map(msg => ({
          id: `thread-${msg.id}`,
          parentMessage: msg,
          messages: generateMockThreadReplies(msg)
        }));
      
      setThreads(channelThreads);
    } catch (error) {
      console.error('Failed to load channel messages:', error);
    }
  };

  // Generate different mock messages based on channel
  const generateMockMessagesForChannel = (channel) => {
    const baseMessages = {
      general: [
        {
          id: 'gen-1',
          user: { name: 'Alex Johnson', initials: 'AJ', status: 'online' },
          content: `Welcome to #${channel.name}! This is where we discuss general topics and company updates.`,
          timestamp: new Date(Date.now() - 7200000),
          reactions: [{ emoji: '👋', count: 5, users: ['Sarah', 'Mike', 'Lisa', 'John', 'Emma'] }]
        },
        {
          id: 'gen-2',
          user: { name: 'Sarah Chen', initials: 'SC', status: 'online' },
          content: 'Good morning everyone! Hope you all have a great day ahead. 🌟',
          timestamp: new Date(Date.now() - 3600000),
          thread_count: 3,
          thread_participants: ['Mike', 'Lisa', 'John']
        }
      ],
      engineering: [
        {
          id: 'eng-1',
          user: { name: 'Mike Johnson', initials: 'MJ', status: 'online' },
          content: 'Just deployed the new API endpoint. Here are the details:\n- Endpoint: `/api/v2/users`\n- Rate limit: 1000 req/min\n- Authentication required',
          timestamp: new Date(Date.now() - 5400000),
          reactions: [{ emoji: '🚀', count: 3, users: ['Sarah', 'Lisa', 'Tom'] }]
        },
        {
          id: 'eng-2',
          user: { name: 'Lisa Park', initials: 'LP', status: 'online' },
          content: 'Great work on the deployment! I noticed a small performance improvement in the dashboard loading times.',
          timestamp: new Date(Date.now() - 1800000),
          thread_count: 2,
          thread_participants: ['Mike', 'Tom']
        }
      ],
      design: [
        {
          id: 'des-1',
          user: { name: 'Emma Wilson', initials: 'EW', status: 'online' },
          content: 'New design system components are ready! 🎨\nCheck out the updated color palette and typography guidelines in Figma.',
          timestamp: new Date(Date.now() - 4200000),
          reactions: [{ emoji: '🎨', count: 4, users: ['Sarah', 'Mike', 'John', 'Alex'] }]
        }
      ],
      marketing: [
        {
          id: 'mar-1',
          user: { name: 'John Davis', initials: 'JD', status: 'away' },
          content: 'Campaign results are in! 📊\n- CTR: 3.2% (up 0.8%)\n- Conversions: 127 (target was 100)\n- ROI: 4.2x',
          timestamp: new Date(Date.now() - 2700000),
          thread_count: 5,
          thread_participants: ['Sarah', 'Alex', 'Emma']
        }
      ],
      random: [
        {
          id: 'ran-1',
          user: { name: 'Tom Anderson', initials: 'TA', status: 'online' },
          content: 'Anyone up for coffee? ☕ There\'s a new cafe that opened near the office!',
          timestamp: new Date(Date.now() - 900000),
          reactions: [{ emoji: '☕', count: 6, users: ['Sarah', 'Mike', 'Lisa', 'Emma', 'John', 'Alex'] }]
        }
      ]
    };

    const channelMessages = baseMessages[channel.name] || [
      {
        id: `${channel.id}-default`,
        user: { name: 'ChatFlow Bot', initials: 'CB', status: 'online' },
        content: `Welcome to #${channel.name}! Start the conversation here.`,
        timestamp: new Date(Date.now() - 3600000),
      }
    ];

    // Always add user's message to show interaction
    return [...channelMessages, {
      id: `${channel.id}-user`,
      user: {
        name: user.displayName || 'You',
        avatar: user.photoURL,
        initials: user.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : 'U',
        status: 'online'
      },
      content: `Just switched to #${channel.name}`,
      timestamp: new Date()
    }];
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

  const handleThreadOpen = (message) => {
    // Find the thread for this message
    const thread = threads.find(t => t.parentMessage.id === message.id);
    if (thread) {
      setSelectedThread(thread);
      setThreadOpen(true);
    } else {
      // Create a new thread if none exists
      const newThread = {
        id: `thread-${message.id}`,
        parentMessage: message,
        messages: []
      };
      setThreads([...threads, newThread]);
      setSelectedThread(newThread);
      setThreadOpen(true);
    }
  };

  const handleSendMessage = (content) => {
    const newMessage = {
      id: Date.now().toString(),
      user: {
        name: user.displayName || 'You',
        avatar: user.photoURL,
        initials: user.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : 'U',
        status: 'online'
      },
      content,
      timestamp: new Date()
    };
    setMessages([...messages, newMessage]);
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
