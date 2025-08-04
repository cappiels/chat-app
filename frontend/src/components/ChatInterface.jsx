import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { 
  Hash,
  Plus,
  Search,
  Settings,
  Users,
  Bell,
  MoreVertical,
  Smile,
  Paperclip,
  Send,
  Menu,
  ChevronDown,
  Circle,
  MessageCircle,
  X,
  ChevronLeft,
  Headphones,
  Mic,
  Home,
  MessageSquare,
  Activity,
  MoreHorizontal
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Avatar, AvatarFallback } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { ScrollArea } from './ui/ScrollArea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/DropdownMenu';
import { threadAPI, messageAPI } from '../utils/api';

const ChatInterface = ({ user, workspace, onSignOut }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchChannels = async () => {
      if (workspace) {
        setLoadingChannels(true);
        try {
          const response = await threadAPI.getThreads(workspace.id);
          const threads = response.data.threads || [];
          
          const channelThreads = threads.filter(thread => thread.type === 'channel');
          const dmThreads = threads.filter(thread => thread.type === 'dm');
          
          setChannels(channelThreads.map(thread => ({
            ...thread,
            unread: Math.floor(Math.random() * 5),
            isActive: false
          })));
          
          setDirectMessages(dmThreads.map(thread => ({
            ...thread,
            unread: Math.floor(Math.random() * 3),
            isActive: false
          })));

          if (channelThreads.length > 0) {
            setCurrentChannel(channelThreads[0]);
          }
        } catch (err) {
          console.error('Load channels error:', err);
          setChannels([
            { id: '1', name: 'general_chat', type: 'channel', unread: 0, isActive: true },
            { id: '2', name: 'random', type: 'channel', unread: 2, isActive: false },
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
              content: `Welcome to the chat! This is working perfectly now.`,
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

  // SINGLE UNIFIED RESPONSIVE LAYOUT
  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar - Always present on desktop, overlay on mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 transform transition-transform lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:flex lg:flex-col hidden lg:block
      `}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{workspace.name}</h2>
                <p className="text-sm text-gray-500">{workspace.member_count || 0} members</p>
              </div>
            </div>
            <button 
              className="lg:hidden p-1 hover:bg-gray-100 rounded-full"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Channels</h3>
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => {
                  setCurrentChannel(channel);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors mb-1 ${
                  currentChannel?.id === channel.id
                    ? "bg-purple-100 text-purple-900"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Hash className="w-4 h-4" />
                <span className="text-sm font-medium">{channel.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Responsive */}
        <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            {/* Mobile hamburger */}
            <button 
              className="lg:hidden p-1 hover:bg-gray-100 rounded-full"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>

            {/* Mobile back button - only show on mobile */}
            <button 
              className="lg:hidden p-1 hover:bg-gray-100 rounded-full"
              onClick={() => window.location.reload()}
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>

            <Hash className="w-5 h-5 text-purple-600" />
            
            {/* Mobile: Show column with name + member count */}
            <div className="lg:hidden flex flex-col">
              <h1 className="text-lg font-semibold text-gray-900">
                {currentChannel?.name || 'general_chat'}
              </h1>
              <p className="text-sm text-gray-500">
                {workspace.member_count || 63} members • 3 tabs
              </p>
            </div>

            {/* Desktop: Show inline */}
            <div className="hidden lg:flex lg:items-center lg:space-x-3">
              <h1 className="text-xl font-bold text-gray-900">
                {currentChannel?.name || 'Select a channel'}
              </h1>
              <span className="text-sm text-gray-500">
                {workspace.member_count || 0} members
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Mobile: Only headphones */}
            <button className="lg:hidden p-2 hover:bg-gray-100 rounded-full">
              <Headphones className="w-6 h-6 text-gray-600" />
            </button>

            {/* Desktop: Full toolbar */}
            <div className="hidden lg:flex lg:items-center lg:space-x-2">
              <Button variant="ghost" size="sm">
                <Search className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <Users className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4">
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
                
                <div className="flex items-start space-x-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${message.user.color || 'bg-gray-500'}`}>
                    {message.user.initials}
                  </div>
                  
                  <div className="flex-1">
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
                      <div className="flex items-center space-x-3 mt-3">
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

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 px-4 lg:px-6 py-3 flex-shrink-0">
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
            <button className="lg:hidden p-2 hover:bg-gray-100 rounded-full">
              <Mic className="w-5 h-5 text-gray-600" />
            </button>
            {messageInput.trim() && (
              <button
                onClick={handleSendMessage}
                className="hidden lg:block bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Bottom Navigation - Only show on mobile */}
        <div className="lg:hidden bg-white border-t border-gray-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-around">
            <button className="flex flex-col items-center space-y-1 py-2 px-4">
              <Home className="w-6 h-6 text-gray-900" />
              <span className="text-xs font-medium text-gray-900">Home</span>
            </button>
            <button className="flex flex-col items-center space-y-1 py-2 px-4">
              <MessageSquare className="w-6 h-6 text-gray-500" />
              <span className="text-xs text-gray-500">DMs</span>
            </button>
            <button className="flex flex-col items-center space-y-1 py-2 px-4">
              <Bell className="w-6 h-6 text-gray-500" />
              <span className="text-xs text-gray-500">Activity</span>
            </button>
            <button className="flex flex-col items-center space-y-1 py-2 px-4">
              <MoreHorizontal className="w-6 h-6 text-gray-500" />
              <span className="text-xs text-gray-500">More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

ChatInterface.propTypes = {
  user: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  onSignOut: PropTypes.func.isRequired,
};

export default ChatInterface;
