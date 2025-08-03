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
  Rocket,
  BookOpen,
  ChevronDown,
  Circle,
  MessageCircle
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
          
          // Separate channels and direct messages
          const channelThreads = threads.filter(thread => thread.type === 'channel');
          const dmThreads = threads.filter(thread => thread.type === 'dm');
          
          setChannels(channelThreads.map(thread => ({
            ...thread,
            unread: Math.floor(Math.random() * 5), // Mock unread count
            isActive: false
          })));
          
          setDirectMessages(dmThreads.map(thread => ({
            ...thread,
            unread: Math.floor(Math.random() * 3),
            isActive: false
          })));

          // Set first channel as active
          if (channelThreads.length > 0) {
            setCurrentChannel(channelThreads[0]);
          }
        } catch (err) {
          console.error('Load channels error:', err);
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
          
          // Transform messages to match our interface
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
          // Set some demo messages if API fails
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
    if (messageInput.trim() && currentChannel) {
      const newMessage = {
        id: Date.now().toString(),
        user: {
          name: user.displayName,
          avatar: user.photoURL || '',
          initials: user.displayName.split(' ').map(n => n[0]).join('').toUpperCase(),
          status: "online",
        },
        content: messageInput,
        timestamp: new Date(),
        type: "message",
      };

      setMessages(prev => [...prev, newMessage]);
      setMessageInput("");

      // Try to send to backend
      try {
        await messageAPI.sendMessage(currentChannel.id, {
          content: messageInput,
          author: user.displayName
        });
      } catch (err) {
        console.error('Send message error:', err);
      }
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
    
    // Update active states
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
    <div className="flex h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <motion.div
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 lg:w-72 bg-white border-r-2 border-slate-300 shadow-lg lg:shadow-none transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        initial={false}
        animate={sidebarOpen ? { x: 0 } : { x: -256 }}
        transition={{ duration: 0.3 }}
      >
        {/* Workspace Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
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
              <DropdownMenuItem>
                <BookOpen className="w-4 h-4 mr-2" />
                Knowledge Base
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          {/* Channels Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide">Channels</h3>
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
                        ? "bg-purple-100 text-purple-900"
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
              <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide">Direct Messages</h3>
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
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="flex-1 justify-start">
              <Plus className="w-4 h-4 mr-2" />
              Add Channel
            </Button>
            <Button variant="ghost" size="sm">
              <Rocket className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-slate-300 bg-white shadow-sm">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden bg-slate-100 hover:bg-slate-200 border border-slate-300" 
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </Button>
            <Hash className="w-5 h-5 text-purple-600" />
            <h1 className="text-lg font-semibold text-slate-900">
              {currentChannel?.name || 'Select a channel'}
            </h1>
            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border border-purple-200">
              {workspace.member_count || 0} members
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-slate-100">
              <Search className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-slate-100">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex hover:bg-slate-100">
              <Users className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="hover:bg-slate-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
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
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-slate-100 px-3 py-1 rounded-full">
                          <span className="text-xs font-medium text-slate-600">
                            {formatDate(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start space-x-3 group hover:bg-slate-50 -mx-4 px-4 py-2 rounded-lg">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                          {message.user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-slate-900">{message.user.name}</span>
                          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{message.content}</p>
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
        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message #${currentChannel?.name || 'channel'}`}
                className="pr-20 py-3 resize-none border-2 border-slate-200 focus:border-purple-400 rounded-xl"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Smile className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 px-6 py-3 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
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
