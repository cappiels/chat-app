import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import MessageList from '../chat/MessageList';
import MessageComposer from '../chat/MessageComposer';
import Thread from '../chat/Thread';

const AppLayout = ({ user, workspace, onSignOut }) => {
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [activeSection, setActiveSection] = useState('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
      setMessages([
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
      ]);
    }
  }, [currentChannel, user]);

  const handleChannelSelect = (channel) => {
    setCurrentChannel(channel);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleThreadOpen = (message) => {
    setSelectedThread(message);
    setThreadOpen(true);
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

  return (
    <div className="app-layout">
      {/* Header */}
      <Header
        workspace={workspace}
        user={user}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        onSignOut={onSignOut}
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
          message={selectedThread}
          isOpen={threadOpen}
          onClose={() => setThreadOpen(false)}
          currentUser={user}
        />
      )}

      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      )}
    </div>
  );
};

AppLayout.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default AppLayout;
