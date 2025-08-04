import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { 
  Hash,
  Plus,
  Send,
  MessageCircle,
  ChevronLeft,
  Headphones,
  Mic
} from 'lucide-react';
import AppHeader from './AppHeader';
import AppFooter from './AppFooter';
import AppSidebar from './AppSidebar';
import { threadAPI, messageAPI } from '../utils/api';

const ChatInterface = ({ user, workspace, onSignOut }) => {
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeSection, setActiveSection] = useState('chat');
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef(null);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint is 1024px
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const fetchChannels = async () => {
      if (workspace) {
        setLoadingChannels(true);
        try {
          const response = await threadAPI.getThreads(workspace.id);
          const threads = response.data.threads || [];
          
          const channelThreads = threads.filter(thread => thread.type === 'channel');
          
          setChannels(channelThreads.map(thread => ({
            ...thread,
            unread: Math.floor(Math.random() * 3),
          })));

          if (channelThreads.length > 0) {
            setCurrentChannel(channelThreads[0]);
          }
        } catch (err) {
          console.error('Load channels error:', err);
          // Demo data
          setChannels([
            { id: '1', name: 'general_chat', type: 'channel', unread: 0 },
            { id: '2', name: 'random', type: 'channel', unread: 2 },
            { id: '3', name: 'design', type: 'channel', unread: 0 },
          ]);
          setCurrentChannel({ id: '1', name: 'general_chat', type: 'channel' });
        } finally {
          setLoadingChannels(false);
        }
      }
    };
    fetchChannels();
  }, [workspace]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (currentChannel) {
        setLoadingMessages(true);
        try {
          const response = await messageAPI.getMessages(currentChannel.id);
          const fetchedMessages = response.data.messages || [];
          
          const transformedMessages = fetchedMessages.map(msg => ({
            id: msg.id,
            user: {
              name: msg.author_name || msg.author || 'Unknown',
              avatar: msg.author_avatar || '',
              initials: (msg.author_name || msg.author || 'U').split(' ').map(n => n[0]).join('').toUpperCase(),
              status: 'online'
            },
            content: msg.content,
            timestamp: new Date(msg.created_at),
            type: 'message'
          }));
          
          setMessages(transformedMessages);
        } catch (err) {
          console.error('Load messages error:', err);
          // Demo data
          setMessages([
            {
              id: "1",
              user: {
                name: "Alex M",
                avatar: '',
                initials: "AM",
                status: "online",
                color: "bg-blue-500"
              },
              content: "Hey everyone! How's the project going?",
              timestamp: new Date(Date.now() - 7200000),
              type: "message",
            },
            {
              id: "2",
              user: {
                name: "Sarah K",
                avatar: '',
                initials: "SK",
                status: "online",
                color: "bg-green-500"
              },
              content: "Just finished the mobile designs! Check them out 🎨",
              timestamp: new Date(Date.now() - 3600000),
              type: "message",
              attachments: 1,
              reactions: [
                { emoji: "🎉", count: 5 },
                { emoji: "👏", count: 3 },
                { emoji: "🔥", count: 2 }
              ],
              replies: 2
            },
            {
              id: "3",
              user: {
                name: user.displayName || 'Demo User',
                avatar: user.photoURL || '',
                initials: (user.displayName || 'DU').split(' ').map(n => n[0]).join('').toUpperCase(),
                status: "online",
                color: "bg-purple-500"
              },
              content: `Welcome to #${currentChannel.name}! This is working perfectly now.`,
              timestamp: new Date(Date.now() - 1800000),
              type: "message",
            }
          ]);
        } finally {
          setLoadingMessages(false);
        }
      }
    };
    fetchMessages();
  }, [currentChannel, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput?.trim() || !currentChannel || !user?.displayName) return;
    
    const messageContent = messageInput.trim();
    const newMessage = {
      id: Date.now().toString(),
      user: {
        name: user.displayName || 'Anonymous',
        avatar: user.photoURL || '',
        initials: (user.displayName || 'A').split(' ').map(n => n[0]).join('').toUpperCase(),
        status: "online",
        color: "bg-purple-500"
      },
      content: messageContent,
      timestamp: new Date(),
      type: "message",
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageInput("");

    try {
      await messageAPI.sendMessage(currentChannel.id, {
        content: messageContent,
        author: user.displayName || 'Anonymous'
      });
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== new Date().getFullYear()) {
      options.year = 'numeric';
    }
    return date.toLocaleDateString('en-US', options);
  };

  if (loadingChannels) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl animate-pulse"></div>
              <div className="relative bg-white p-4 rounded-2xl shadow-lg">
                <MessageCircle className="w-12 h-12 text-purple-600" />
              </div>
            </div>
          </div>
          <p className="text-gray-600">Loading workspace...</p>
        </motion.div>
      </div>
    );
  }

  // UNIFIED ARCHITECTURE WITH REUSABLE COMPONENTS
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Global App Header - Slack-like search bar */}
      <AppHeader 
        workspace={workspace}
        onSignOut={onSignOut}
        searchPlaceholder={`Search ${workspace.name}`}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar - Only shows on desktop */}
        <AppSidebar
          workspace={workspace}
          channels={channels}
          currentChannel={currentChannel}
          onChannelSelect={setCurrentChannel}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onSignOut={onSignOut}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile Channel Header - Only shows on mobile */}
          {isMobile && (
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => window.history.back()}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <Hash className="w-5 h-5 text-gray-600" />
                <div className="flex flex-col">
                  <h1 className="text-lg font-semibold text-gray-900">
                    {currentChannel?.name || 'general_chat'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {workspace.member_count || 5} members
                  </p>
                </div>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Headphones className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          )}

          {/* Desktop Channel Header - Only shows on desktop */}
          {!isMobile && (
            <div className="bg-white border-b border-gray-200 px-6 py-4 hidden lg:block">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Hash className="w-5 h-5 text-gray-600" />
                  <h1 className="text-xl font-bold text-gray-900">
                    {currentChannel?.name || 'Select a channel'}
                  </h1>
                  <span className="text-sm text-gray-500">
                    {workspace.member_count || 0} members
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div>Messages</div>
                  <div>Canvas</div>
                  <div>Files</div>
                </div>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading messages...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const showDate = index === 0 || 
                    formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp);

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-left mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {formatDate(message.timestamp)}
                          </h3>
                        </div>
                      )}
                      
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${message.user.color || 'bg-gray-500'}`}>
                          {message.user.initials}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline space-x-2 mb-1">
                            <span className="font-semibold text-gray-900 text-base">
                              {message.user.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                          
                          <p className="text-gray-800 text-base leading-relaxed">
                            {message.content}
                          </p>
                          
                          {message.attachments && (
                            <p className="text-sm text-gray-500 mt-2">
                              {message.attachments} attachments
                            </p>
                          )}
                          
                          {message.reactions && (
                            <div className="flex items-center space-x-2 mt-3">
                              {message.reactions.map((reaction, idx) => (
                                <div key={idx} className="flex items-center space-x-1 bg-gray-100 rounded-full px-2 py-1">
                                  <span className="text-sm">{reaction.emoji}</span>
                                  <span className="text-sm font-medium text-gray-700">{reaction.count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {message.replies && (
                            <div className="mt-2">
                              <button className="text-sm text-blue-600 hover:underline">
                                {message.replies} replies
                              </button>
                              <span className="text-sm text-gray-500 ml-2">
                                Jul 4th at 8:...
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 px-4 lg:px-6 py-3">
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message #${currentChannel?.name || 'general_chat'}`}
                  className="w-full py-3 px-4 bg-gray-100 lg:bg-white lg:border lg:border-gray-300 rounded-full lg:rounded-lg text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              {isMobile && (
                <button className="p-2 hover:bg-gray-100 rounded-full">
                  <Mic className="w-5 h-5 text-gray-600" />
                </button>
              )}
              {messageInput.trim() && (
                <button
                  onClick={handleSendMessage}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Footer Navigation */}
      <AppFooter 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
    </div>
  );
};

ChatInterface.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default ChatInterface;
