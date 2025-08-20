import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Hash, Reply, MoreHorizontal, Smile, Bookmark, Edit, Users, Info } from 'lucide-react';
import Message from './Message';
import NewMessageDivider from './NewMessageDivider';
import TypingIndicator from './TypingIndicator';
import socketManager from '../../utils/socket';
import notificationManager from '../../utils/notifications';

const MessageList = ({ channel, messages, onThreadClick, currentUser, lastReadMessageId, onChannelMembers, onChannelInfo, typingUsers: externalTypingUsers }) => {
  const messagesEndRef = useRef(null);
  const [internalTypingUsers, setInternalTypingUsers] = useState([]);
  const [newMessages, setNewMessages] = useState([]);
  
  // Use external typing users if provided, otherwise use internal state
  const typingUsers = externalTypingUsers || internalTypingUsers;

  // Scroll to bottom when messages or typing indicators change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers.length]);

  // Set up event listeners only if external typing users are not provided
  useEffect(() => {
    // Skip setting up listeners if external typing users are provided
    if (!channel?.id || externalTypingUsers !== undefined) return;

    const handleUserTyping = (data) => {
      if (data.threadId !== channel.id) return;

      console.log('💬 Typing event received:', data); // Debug log

      setInternalTypingUsers(prev => {
        // Remove this user first (to avoid duplicates)
        const filtered = prev.filter(user => user.userId !== data.userId);
        
        if (data.isTyping) {
          // Add user to typing list with current timestamp
          const newTypingUser = {
            userId: data.userId,
            user: data.user,
            timestamp: new Date() // Use current time for better staleness detection
          };
          console.log('➕ Adding typing user:', newTypingUser);
          return [...filtered, newTypingUser];
        } else {
          // User stopped typing
          console.log('➖ Removing typing user:', data.userId);
          return filtered;
        }
      });
    };

    const handleNewMessage = (data) => {
      if (data.threadId === channel.id) {
        // Remove sender from typing indicators
        setInternalTypingUsers(prev => prev.filter(user => user.userId !== data.message.sender_id));
        
        // Add subtle animation for new messages
        setNewMessages(prev => [...prev, data.message.id]);
        
        // Remove animation class after a short delay
        setTimeout(() => {
          setNewMessages(prev => prev.filter(id => id !== data.message.id));
        }, 1000);
      } else {
        // Show browser notification for messages in other channels
        const message = data.message;
        const isMention = message.mentions && message.mentions.some(m => m.user_id === currentUser?.id);
        const isDM = channel.type === 'dm';
        
        if (isMention) {
          notificationManager.showMessageNotification(message, 'mention', channel.id);
          notificationManager.playNotificationSound();
        } else if (isDM) {
          notificationManager.showMessageNotification(message, 'direct_message', channel.id);
          notificationManager.playNotificationSound();
        } else if (notificationManager.getSettings().allMessages) {
          notificationManager.showMessageNotification(message, 'message', channel.id);
        }
      }
    };

    socketManager.on('user_typing', handleUserTyping);
    socketManager.on('new_message', handleNewMessage);

    // Clean up typing users when component unmounts or channel changes
    return () => {
      socketManager.off('user_typing', handleUserTyping);
      socketManager.off('new_message', handleNewMessage);
      setInternalTypingUsers([]);
      setNewMessages([]);
    };
  }, [channel?.id, externalTypingUsers]);

  // Clean up stale typing indicators (remove users who have been typing for too long)
  // Only do this for internal typing users, not for externally provided ones
  useEffect(() => {
    if (externalTypingUsers !== undefined) return; // Skip if external typing users are provided
    
    const interval = setInterval(() => {
      setInternalTypingUsers(prev => {
        const now = new Date();
        return prev.filter(user => {
          const timeSinceTyping = now - new Date(user.timestamp);
          return timeSinceTyping < 10000; // Remove after 10 seconds
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [externalTypingUsers]);

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          date: message.timestamp,
          messages: [message]
        });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const formatDate = (date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Channel Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Hash className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{channel.name}</h1>
              <span className="text-xs text-slate-500 font-medium">#{channel.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              className="p-2.5 rounded-lg transition-all duration-200 bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md hover:-translate-y-px"
              title="View channel members"
              onClick={onChannelMembers}
            >
              <Users className="w-4 h-4" />
            </button>
            <button 
              className="p-2.5 rounded-lg transition-all duration-200 bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md hover:-translate-y-px"
              title="Channel information"
              onClick={onChannelInfo}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Container with proper flex layout */}
      <div className="px-5 py-4 flex flex-col flex-1 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-6 shadow-lg">
                <Hash className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900">
                This is the beginning of #{channel.name}
              </h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Start the conversation! Share ideas, ask questions, or just say hello to get things going.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Messages - flex grow to fill available space */}
            <div className="flex-1 flex flex-col justify-end min-h-0">
              <div className="flex flex-col">
                {messageGroups.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {/* Date Divider */}
                    <div className="flex items-center my-4">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {formatDate(group.date)}
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Messages for this date - sorted by timestamp with oldest at top, newest at bottom */}
                    {(() => {
                      // Sort messages first, then operate on the sorted array
                      const sortedMessages = [...group.messages]
                        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                        
                      return sortedMessages.map((message, index) => {
                      // Now prevMessage refers to the previous message in the sorted array
                      const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
                      const showAvatar = !prevMessage || 
                        prevMessage.user.name !== message.user.name ||
                        (message.timestamp - prevMessage.timestamp) > 300000; // 5 minutes

                      // Check if this is the first unread message
                      const isFirstUnreadMessage = lastReadMessageId && 
                        prevMessage?.id === lastReadMessageId && 
                        message.id !== lastReadMessageId;

                      // Count unread messages after this point
                      const unreadMessagesAfter = lastReadMessageId ? 
                        messages.filter(m => {
                          const lastReadIndex = messages.findIndex(msg => msg.id === lastReadMessageId);
                          const currentIndex = messages.findIndex(msg => msg.id === message.id);
                          return currentIndex > lastReadIndex;
                        }).length : 0;

                      // Check if this is a new message for animation
                      const isNewMessage = newMessages.includes(message.id);

                      return (
                        <React.Fragment key={message.id}>
                          {/* Show NEW divider before first unread message */}
                          {isFirstUnreadMessage && unreadMessagesAfter > 0 && (
                            <NewMessageDivider messageCount={unreadMessagesAfter} />
                          )}
                          
                          <div className={isNewMessage ? 'animate-fade-in-up' : ''}>
                            <Message
                              message={message}
                              showAvatar={showAvatar}
                              onThreadClick={() => onThreadClick(message)}
                              currentUser={currentUser}
                            />
                          </div>
                        </React.Fragment>
                      );
                      })})()}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Typing Indicator - positioned at the bottom, always visible */}
            {typingUsers.length > 0 && (
              <div className="flex-shrink-0 pb-2">
                <TypingIndicator typingUsers={typingUsers} />
              </div>
            )}
            
            {/* Invisible element for scrolling to bottom */}
            <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
          </>
        )}
      </div>
    </div>
  );
};

MessageList.propTypes = {
  channel: PropTypes.object.isRequired,
  messages: PropTypes.array.isRequired,
  onThreadClick: PropTypes.func.isRequired,
  currentUser: PropTypes.object.isRequired,
  lastReadMessageId: PropTypes.string,
  onChannelMembers: PropTypes.func,
  onChannelInfo: PropTypes.func,
  typingUsers: PropTypes.arrayOf(
    PropTypes.shape({
      userId: PropTypes.string.isRequired,
      user: PropTypes.object.isRequired,
      timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.object, PropTypes.instanceOf(Date)]),
    })
  ),
};

export default MessageList;
