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
                name: "Ray S",
                avatar: '',
                initials: "RS",
                status: "online",
                color: "bg-emerald-500"
              },
              content: "Thanks friends! Miss you...",
              timestamp: new Date(Date.now() - 7200000),
              type: "message",
            },
            {
              id: "2",
              user: {
                name: "Luke Virginia",
                avatar: '',
                initials: "LV",
                status: "online",
                color: "bg-amber-700"
              },
              content: "Had a visitor come through virginia beach yesterday!! @Audrey G Was so awesome to get the chance to connect ❤️",
              timestamp: new Date(Date.now() - 3600000),
              type: "message",
              attachments: 2,
              reactions: [
                { emoji: "❤️", count: 10 },
                { emoji: "🚀", count: 2 },
                { emoji: "👑", count: 1 }
              ],
              replies: 4
            },
            {
              id: "3",
              user: {
                name: "Joe S.",
                avatar: '',
                initials: "JS",
                status: "online",
                color: "bg-slate-600"
              },
              content: "Another 4thD connection!!!",
              timestamp: new Date(Date.now() - 1800000),
              type: "message",
              attachments: 1
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

  // MOBILE-FIRST DESIGN - matches the provided screenshot exactly
  return (
    <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Mobile Header - matches screenshot */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => window.location.reload()}
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
              63 members • 3 tabs
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-full">
          <Headphones className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Messages Area - matches screenshot styling */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
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
                  
                  <div className="flex items-start space-x-3 mb-4">
                    {/* Avatar - matches screenshot style */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${message.user.color || 'bg-gray-500'}`}>
                      {message.user.initials}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Message Header */}
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-gray-900 text-base">
                          {message.user.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      
                      {/* Message Content */}
                      <p className="text-gray-800 text-base leading-relaxed">
                        {message.content}
                      </p>
                      
                      {/* Attachments indicator */}
                      {message.attachments && (
                        <p className="text-sm text-gray-500 mt-2">
                          {message.attachments} attachments
                        </p>
                      )}
                      
                      {/* Reactions */}
                      {message.reactions && (
                        <div className="flex items-center space-x-3 mt-3">
                          {message.reactions.map((reaction, idx) => (
                            <div key={idx} className="flex items-center space-x-1 bg-gray-100 rounded-full px-2 py-1">
                              <span className="text-sm">{reaction.emoji}</span>
                              <span className="text-sm font-medium text-gray-700">{reaction.count}</span>
                            </div>
                          ))}
                          <button className="p-1 hover:bg-gray-100 rounded-full">
                            <Smile className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      )}
                      
                      {/* Replies */}
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

      {/* Message Input - matches screenshot */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-3">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Message #${currentChannel?.name || 'general_chat'}`}
              className="w-full py-3 px-4 bg-gray-100 rounded-full text-base placeholder-gray-500 border-0 focus:outline-none focus:ring-0"
            />
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Mic className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Bottom Navigation - matches screenshot */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
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

      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:block fixed inset-y-0 left-0 w-80 bg-white border-r border-gray-200 z-50">
        {/* Desktop sidebar content here if needed */}
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
