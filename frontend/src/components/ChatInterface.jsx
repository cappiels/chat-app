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
  X
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
            { id: '1', name: 'general', type: 'channel', unread: 0, isActive: true },
            { id: '2', name: 'random', type: 'channel', unread: 2, isActive: false },
          ]);
          setCurrentChannel({ id: '1', name: 'general', type: 'channel' });
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
                name: user.displayName,
                avatar: user.photoURL || '',
                initials: user.displayName.split(' ').map(n => n[0]).join('').toUpperCase(),
                status: "online",
              },
              content: `Welcome to #${currentChannel.name}! This channel is ready for your team collaboration.`,
              timestamp: new Date(Date.now() - 3600000),
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
      if (window.innerWidth < 1024) {
        e.target.blur();
        setTimeout(() => e.target.focus(), 100);
      }
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleChannelSelect = (channel) => {
    setCurrentChannel(channel);
    setSidebarOpen(false);
    
    setChannels(prev => prev.map(ch => ({ ...ch, isActive: ch.id === channel.id })));
    setDirectMessages(prev => prev.map(dm => ({ ...dm, isActive: dm.id === channel.id })));
  };

  if (loadingChannels) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center">
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

  return (
    <div className="h-screen w-screen bg-slate-50 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar - Simple Responsive Approach */}
      <motion.div
        className={`
          w-80 bg-white border-r border-slate-200 shadow-lg flex-shrink-0
          ${sidebarOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden lg:flex'}
        `}
        style={{ display: sidebarOpen ? 'flex' : undefined }}
      >
        {/* Workspace Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {workspace.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{workspace.name}</h2>
              <p className="text-sm text-slate-500">{workspace.member_count || 0} members</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden" 
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Workspace Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Users className="w-4 h-4 mr-2" />
                  Manage Members
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          {/* Channels Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Channels</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors
                    ${
                      currentChannel?.id === channel.id
                        ? "bg-purple-100 text-purple-900 border-l-4 border-purple-500"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                >
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4" />
                    <span className="text-sm font-medium">{channel.name}</span>
                  </div>
                  {channel.unread > 0 && (
                    <Badge variant="secondary" className="bg-red-500 text-white text-xs px-2 py-0.5">
                      {channel.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Direct Messages</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {directMessages.map((dm) => (
                <button
                  key={dm.id}
                  onClick={() => handleChannelSelect(dm)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    </div>
                    <span className="text-sm font-medium">{dm.name}</span>
                  </div>
                  {dm.unread > 0 && (
                    <Badge variant="secondary" className="bg-red-500 text-white text-xs px-2 py-0.5">
                      {dm.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center justify-center">
            <Button variant="ghost" size="sm" className="hover:bg-slate-200 rounded-lg p-3">
              <Plus className="w-5 h-5 text-slate-600" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </Button>
            <Hash className="w-5 h-5 text-purple-600" />
            <h1 className="text-xl font-bold text-slate-900">
              {currentChannel?.name || 'Select a channel'}
            </h1>
            <Badge variant="secondary" className="hidden sm:inline-flex text-sm bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1">
              {workspace.member_count || 0} members
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-slate-100">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-slate-100">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-slate-100">
              <Users className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="hover:bg-slate-100"
              onClick={() => window.location.reload()} 
              aria-label="Go back to workspace selection"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4 bg-white">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Loading messages...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const showDate =
                  index === 0 || formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp);

                return (
                  <motion.div 
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {showDate && (
                      <div className="flex items-center justify-center my-6">
                        <div className="bg-slate-200 px-4 py-2 rounded-full">
                          <span className="text-sm font-bold text-slate-700">
                            {formatDate(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start space-x-3 group hover:bg-slate-50 -mx-4 px-4 py-2 rounded-lg">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white font-bold">
                          {message.user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="font-bold text-slate-900">{message.user.name}</span>
                          <span className="text-sm text-slate-500">{formatTime(message.timestamp)}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed break-words">{message.content}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-slate-200 bg-white p-4 shadow-lg flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0"
              aria-label="Add attachment"
            >
              <Plus className="w-5 h-5 text-slate-600" />
            </Button>
            <div className="flex-1 relative">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message #${currentChannel?.name || 'channel'}`}
                className="py-3 px-4 text-base border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-xl bg-white w-full"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 hidden sm:flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <Smile className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {messageInput.trim() && (
              <Button
                onClick={handleSendMessage}
                className="bg-purple-600 hover:bg-purple-700 p-3 rounded-lg shadow-sm flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </Button>
            )}
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
