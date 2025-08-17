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

  // Load channels based on workspace
  useEffect(() => {
    if (workspace) {
      // Generate workspace-specific channels
      const workspaceChannels = generateWorkspaceChannels(workspace);
      setChannels(workspaceChannels);
      setCurrentChannel(workspaceChannels[0] || null);
      setMessages([]);
      setThreads([]);
    }
  }, [workspace]);

  const generateWorkspaceChannels = (ws) => {
    const baseChannels = [
      { id: 'general', name: 'general', type: 'channel', unread: 0 },
    ];

    // Add workspace-specific channels based on workspace name or type
    const workspaceSpecificChannels = {
      'Frank': [
        { id: 'team-frank', name: 'team-updates', type: 'channel', unread: 2 },
        { id: 'projects-frank', name: 'projects', type: 'channel', unread: 1 },
        { id: 'random-frank', name: 'random', type: 'channel', unread: 0 },
      ],
      'Engineering': [
        { id: 'eng-general', name: 'engineering', type: 'channel', unread: 5 },
        { id: 'eng-backend', name: 'backend', type: 'channel', unread: 2 },
        { id: 'eng-frontend', name: 'frontend', type: 'channel', unread: 3 },
        { id: 'eng-devops', name: 'devops', type: 'channel', unread: 0 },
      ],
      'Design': [
        { id: 'design-general', name: 'design-team', type: 'channel', unread: 1 },
        { id: 'design-reviews', name: 'design-reviews', type: 'channel', unread: 2 },
        { id: 'design-resources', name: 'resources', type: 'channel', unread: 0 },
      ]
    };

    const specific = workspaceSpecificChannels[ws.name] || [
      { id: 'projects', name: 'projects', type: 'channel', unread: 0 },
      { id: 'announcements', name: 'announcements', type: 'channel', unread: 0 },
    ];

    return [...baseChannels, ...specific];
  };

  // Load messages when channel changes
  useEffect(() => {
    if (currentChannel && workspace) {
      loadChannelMessages(currentChannel);
    }
  }, [currentChannel, workspace, user]);

  const loadChannelMessages = (channel) => {
    // Clear existing threads when switching channels
    setThreads([]);
    setSelectedThread(null);
    setThreadOpen(false);

    const channelMessages = generateChannelMessages(channel, workspace);
    setMessages(channelMessages);
    
    // Generate threads for messages that have threads
    const channelThreads = channelMessages
      .filter(msg => msg.thread_count > 0)
      .map(msg => ({
        id: `thread-${msg.id}`,
        parentMessage: msg,
        messages: generateMockThreadReplies(msg)
      }));
    
    setThreads(channelThreads);
  };

  const generateChannelMessages = (channel, ws) => {
    const channelKey = `${ws.name}-${channel.name}`;
    
    const messageTemplates = {
      'Frank-general': [
        {
          id: 'frank-gen-1',
          user: { name: 'Frank', initials: 'F', status: 'online' },
          content: `Welcome to the Frank workspace! This is our main discussion channel.`,
          timestamp: new Date(Date.now() - 7200000),
          reactions: [{ emoji: '👋', count: 3, users: ['Team', 'Members'] }]
        },
        {
          id: 'frank-gen-2',
          user: { name: 'Team Lead', initials: 'TL', status: 'online' },
          content: 'Daily standup in 10 minutes. Please prepare your updates!',
          timestamp: new Date(Date.now() - 1800000),
          thread_count: 2,
          thread_participants: ['Frank', 'Developer']
        }
      ],
      'Frank-team-updates': [
        {
          id: 'frank-team-1',
          user: { name: 'Project Manager', initials: 'PM', status: 'online' },
          content: 'Q4 roadmap has been finalized. Key deliverables:\n• Feature A - Due Nov 15\n• Feature B - Due Dec 1\n• Performance optimization - Ongoing',
          timestamp: new Date(Date.now() - 3600000),
          thread_count: 4,
          thread_participants: ['Frank', 'Developer', 'Designer']
        }
      ],
      'Frank-projects': [
        {
          id: 'frank-proj-1',
          user: { name: 'Developer', initials: 'D', status: 'online' },
          content: 'Chat app MVP is 85% complete. Working on final navigation fixes.',
          timestamp: new Date(Date.now() - 900000),
          reactions: [{ emoji: '🚀', count: 2, users: ['Frank', 'PM'] }]
        }
      ],
      'Engineering-engineering': [
        {
          id: 'eng-main-1',
          user: { name: 'Senior Engineer', initials: 'SE', status: 'online' },
          content: 'Code review for PR #234 is complete. Great work on the optimization!',
          timestamp: new Date(Date.now() - 2400000),
          thread_count: 3,
          thread_participants: ['Junior Dev', 'Tech Lead']
        }
      ],
      'Engineering-backend': [
        {
          id: 'eng-back-1',
          user: { name: 'Backend Dev', initials: 'BD', status: 'online' },
          content: 'Database migration completed successfully. All tests passing ✅',
          timestamp: new Date(Date.now() - 1200000),
        }
      ]
    };

    const messages = messageTemplates[channelKey] || [
      {
        id: `${channelKey}-default`,
        user: { name: 'System', initials: 'S', status: 'online' },
        content: `This is the #${channel.name} channel in ${ws.name} workspace. Start the conversation!`,
        timestamp: new Date(Date.now() - 3600000),
      }
    ];

    // Always add user's current message to show they switched
    return [...messages, {
      id: `${channelKey}-user-${Date.now()}`,
      user: {
        name: user.displayName || 'You',
        avatar: user.photoURL,
        initials: user.displayName ? user.displayName.split(' ').map(n => n[0]).join('') : 'U',
        status: 'online'
      },
      content: `Switched to #${channel.name} in ${ws.name}`,
      timestamp: new Date()
    }];
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
