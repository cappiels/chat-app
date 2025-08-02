import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Hash, 
  Lock, 
  Plus, 
  Search, 
  Send, 
  Smile, 
  Paperclip,
  MoreVertical,
  Edit2,
  Trash2,
  Pin,
  Reply,
  ChevronDown,
  Users,
  Settings,
  LogOut,
  Star,
  Archive,
  X,
  MessageCircle
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import socketManager from '../utils/socket';
import { workspaceAPI, threadAPI, messageAPI, userAPI } from '../utils/api';

// Loading component
const LoadingSpinner = () => (
  <div className="flex-center space-x-2">
    <div className="loading-dots">
      <div className="loading-dot bg-primary-500"></div>
      <div className="loading-dot bg-primary-600"></div>
      <div className="loading-dot bg-primary-700"></div>
    </div>
    <span className="text-gray-600 dark:text-gray-400 font-medium ml-3">
      Loading messages...
    </span>
  </div>
);

// Sidebar component
const Sidebar = ({ workspace, threads, currentThread, onSelectThread, user, onSignOut }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);

  const channels = threads.filter(t => t.type === 'channel');
  const directMessages = threads.filter(t => t.type === 'dm');

  const filteredChannels = channels.filter(ch => 
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      await threadAPI.createChannel(workspace.id, {
        name: newChannelName,
        is_private: newChannelPrivate,
      });
      toast.success('Channel created successfully!');
      setShowNewChannel(false);
      setNewChannelName('');
      setNewChannelPrivate(false);
    } catch (error) {
      toast.error('Failed to create channel');
    }
  };

  return (
    <div className="sidebar">
      {/* Workspace Header */}
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <div className="flex-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {workspace.name}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span className="status-dot status-online"></span>
              <span>{user.displayName}</span>
            </div>
          </div>
          <button className="btn-ghost btn-sm">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-2 text-sm"
          />
        </div>
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-6">
          <div className="flex-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Channels
            </h3>
            <button
              onClick={() => setShowNewChannel(true)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* New Channel Form */}
          <AnimatePresence>
            {showNewChannel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg"
              >
                <input
                  type="text"
                  placeholder="Channel name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
                  className="input mb-2 text-sm"
                  autoFocus
                />
                <div className="flex-between">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newChannelPrivate}
                      onChange={(e) => setNewChannelPrivate(e.target.checked)}
                      className="rounded"
                    />
                    <span>Private</span>
                  </label>
                  <div className="space-x-2">
                    <button
                      onClick={() => setShowNewChannel(false)}
                      className="btn-ghost btn-sm text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateChannel}
                      className="btn-primary btn-sm text-xs"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Channel List */}
          <div className="space-y-1">
            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => onSelectThread(channel)}
                className={`sidebar-item ${
                  currentThread?.id === channel.id ? 'sidebar-item-active' : ''
                }`}
              >
                <div className="flex items-center space-x-2 flex-1">
                  {channel.is_private ? (
                    <Lock className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Hash className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="text-sm">{channel.name}</span>
                </div>
                {channel.unread_count > 0 && (
                  <span className="notification-badge">{channel.unread_count}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Direct Messages */}
        <div>
          <div className="flex-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Direct Messages
            </h3>
            <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {directMessages.map((dm) => (
              <div
                key={dm.id}
                onClick={() => onSelectThread(dm)}
                className={`sidebar-item ${
                  currentThread?.id === dm.id ? 'sidebar-item-active' : ''
                }`}
              >
                <div className="flex items-center space-x-2 flex-1">
                  <div className="relative">
                    <img
                      src={dm.other_user?.photo_url || `https://ui-avatars.com/api/?name=${dm.other_user?.display_name}`}
                      alt={dm.other_user?.display_name}
                      className="avatar-sm"
                    />
                    {dm.other_user?.is_online && (
                      <span className="absolute -bottom-0.5 -right-0.5 status-dot status-online"></span>
                    )}
                  </div>
                  <span className="text-sm">{dm.other_user?.display_name}</span>
                </div>
                {dm.unread_count > 0 && (
                  <span className="notification-badge">{dm.unread_count}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Menu */}
      <div className="p-3 border-t border-gray-200 dark:border-dark-700">
        <div className="sidebar-item">
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="avatar-sm"
          />
          <span className="text-sm flex-1">{user.displayName}</span>
          <button onClick={onSignOut} className="text-gray-500 hover:text-gray-700">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Message component
const Message = ({ message, isOwn, onEdit, onDelete, onReact, onReply }) => {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, 'h:mm a');
    } else if (isYesterday(messageDate)) {
      return `Yesterday at ${format(messageDate, 'h:mm a')}`;
    }
    return format(messageDate, 'MMM d at h:mm a');
  };

  const handleEdit = () => {
    onEdit(message.id, editContent);
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && (
        <img
          src={message.user.photo_url || `https://ui-avatars.com/api/?name=${message.user.display_name}`}
          alt={message.user.display_name}
          className="avatar-sm mr-3 mt-1"
        />
      )}

      <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className={`${isOwn ? 'message-sent' : 'message-received'} relative`}>
          {!isOwn && (
            <p className="text-xs font-semibold mb-1 opacity-80">
              {message.user.display_name}
            </p>
          )}

          {isEditing ? (
            <div>
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEdit()}
                className="bg-transparent border-b border-white/50 outline-none w-full"
                autoFocus
              />
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs opacity-80 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  className="text-xs opacity-80 hover:opacity-100"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm">{message.content}</p>
              {message.is_edited && (
                <span className="text-xs opacity-60 mt-1">(edited)</span>
              )}
            </>
          )}

          {/* Message Actions */}
          <AnimatePresence>
            {showActions && !isEditing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`absolute top-0 ${
                  isOwn ? 'right-full mr-2' : 'left-full ml-2'
                } flex items-center space-x-1 bg-white dark:bg-dark-800 rounded-lg shadow-lg p-1`}
              >
                <button
                  onClick={() => onReact(message.id, '👍')}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded"
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onReply(message)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded"
                >
                  <Reply className="w-4 h-4" />
                </button>
                {isOwn && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(message.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => onReact(message.id, reaction.emoji)}
                className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-dark-800 rounded-full text-xs"
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {formatMessageTime(message.created_at)}
        </p>
      </div>
    </motion.div>
  );
};

// Main Chat Interface
const ChatInterface = ({ user, workspace, onSignOut }) => {
  const [threads, setThreads] = useState([]);
  const [currentThread, setCurrentThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    socketManager.connect();
    socketManager.joinWorkspace(workspace.id);

    // Socket event listeners
    socketManager.on('new_message', handleNewMessage);
    socketManager.on('message_edited', handleMessageEdited);
    socketManager.on('message_deleted', handleMessageDeleted);
    socketManager.on('reaction_added', handleReactionAdded);
    socketManager.on('reaction_removed', handleReactionRemoved);
    socketManager.on('user_typing', handleUserTyping);
    socketManager.on('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      socketManager.disconnect();
    };
  }, [workspace.id]);

  // Load threads
  useEffect(() => {
    loadThreads();
  }, [workspace.id]);

  // Load messages when thread changes
  useEffect(() => {
    if (currentThread) {
      loadMessages();
      socketManager.joinThread(currentThread.id);
    }
  }, [currentThread]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadThreads = async () => {
    try {
      const response = await threadAPI.getThreads(workspace.id);
      setThreads(response.data);
      
      // Auto-select first channel
      const generalChannel = response.data.find(t => t.name === 'general');
      if (generalChannel) {
        setCurrentThread(generalChannel);
      }
    } catch (error) {
      toast.error('Failed to load channels');
    }
  };

  const loadMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const response = await messageAPI.getMessages(currentThread.id);
      setMessages(response.data);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Socket event handlers
  const handleNewMessage = (message) => {
    if (message.thread_id === currentThread?.id) {
      setMessages(prev => [...prev, message]);
    }
  };

  const handleMessageEdited = ({ message_id, content }) => {
    setMessages(prev => prev.map(msg => 
      msg.id === message_id ? { ...msg, content, is_edited: true } : msg
    ));
  };

  const handleMessageDeleted = ({ message_id }) => {
    setMessages(prev => prev.filter(msg => msg.id !== message_id));
  };

  const handleReactionAdded = ({ message_id, emoji, user }) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === message_id) {
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find(r => r.emoji === emoji);
        
        if (existingReaction) {
          existingReaction.count++;
          existingReaction.users.push(user);
        } else {
          reactions.push({ emoji, count: 1, users: [user] });
        }
        
        return { ...msg, reactions };
      }
      return msg;
    }));
  };

  const handleReactionRemoved = ({ message_id, emoji, user_id }) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === message_id) {
        const reactions = msg.reactions || [];
        const reactionIndex = reactions.findIndex(r => r.emoji === emoji);
        
        if (reactionIndex !== -1) {
          reactions[reactionIndex].count--;
          reactions[reactionIndex].users = reactions[reactionIndex].users.filter(
            u => u.id !== user_id
          );
          
          if (reactions[reactionIndex].count === 0) {
            reactions.splice(reactionIndex, 1);
          }
        }
        
        return { ...msg, reactions };
      }
      return msg;
    }));
  };

  const handleUserTyping = ({ user, thread_id }) => {
    if (thread_id === currentThread?.id && user.id !== user.id) {
      setTypingUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
    }
  };

  const handleUserStoppedTyping = ({ user_id, thread_id }) => {
    if (thread_id === currentThread?.id) {
      setTypingUsers(prev => prev.filter(u => u.id !== user_id));
    }
  };

  // Message actions
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentThread) return;

    const messageData = {
      thread_id: currentThread.id,
      content: messageInput.trim(),
      type: 'text',
    };

    try {
      await messageAPI.sendMessage(messageData);
      setMessageInput('');
      socketManager.stopTyping(currentThread.id);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const editMessage = async (messageId, content) => {
    try {
      await messageAPI.updateMessage(messageId, { content });
    } catch (error) {
      toast.error('Failed to edit message');
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await messageAPI.deleteMessage(messageId);
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const addReaction = async (messageId, emoji) => {
    try {
      await messageAPI.addReaction(messageId, emoji);
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  };

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socketManager.startTyping(currentThread.id);

    typingTimeoutRef.current = setTimeout(() => {
      socketManager.stopTyping(currentThread.id);
    }, 3000);
  };

  return (
    <div className="flex h-screen bg-white dark:bg-dark-950">
      {/* Sidebar */}
      <Sidebar
        workspace={workspace}
        threads={threads}
        currentThread={currentThread}
        onSelectThread={setCurrentThread}
        user={user}
        onSignOut={onSignOut}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentThread ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="flex items-center space-x-3">
                {currentThread.type === 'channel' ? (
                  <>
                    {currentThread.is_private ? (
                      <Lock className="w-5 h-5 text-gray-500" />
                    ) : (
                      <Hash className="w-5 h-5 text-gray-500" />
                    )}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {currentThread.name}
                    </h2>
                  </>
                ) : (
                  <>
                    <img
                      src={currentThread.other_user?.photo_url}
                      alt={currentThread.other_user?.display_name}
                      className="avatar-sm"
                    />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {currentThread.other_user?.display_name}
                    </h2>
                  </>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button className="btn-ghost">
                  <Users className="w-5 h-5" />
                </button>
                <button className="btn-ghost">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="chat-messages">
              {isLoadingMessages ? (
                <div className="flex-center h-full">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      isOwn={message.user_id === user.uid}
                      onEdit={editMessage}
                      onDelete={deleteMessage}
                      onReact={addReaction}
                      onReply={() => {}}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <span className="ml-2">
                    {typingUsers.map(u => u.display_name).join(', ')} typing...
                  </span>
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className="chat-input">
              <button type="button" className="btn-ghost">
                <Plus className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  handleTyping();
                }}
                placeholder={`Message #${currentThread.name || currentThread.other_user?.display_name}`}
                className="flex-1 bg-gray-100 dark:bg-dark-800 rounded-lg px-4 py-2 outline-none"
              />

              <button type="button" className="btn-ghost">
                <Paperclip className="w-5 h-5" />
              </button>
              
              <button type="button" className="btn-ghost">
                <Smile className="w-5 h-5" />
              </button>

              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="btn-primary"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-center h-full">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Select a channel or direct message to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
