import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Hash, Reply, MoreHorizontal, Smile, Bookmark, Edit, Users, Info } from 'lucide-react';
import Message from './Message';

const MessageList = ({ channel, messages, onThreadClick, currentUser }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      <div className="px-5 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-slate-500" />
            <h1 className="text-lg font-bold text-slate-900">{channel.name}</h1>
            <span className="text-sm text-slate-500">#{channel.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700">
              <Users className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700">
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="px-5 py-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-full mb-4">
              <Hash className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold mb-1 text-slate-900">
              This is the beginning of #{channel.name}
            </h3>
            <p className="text-slate-500">
              Start the conversation!
            </p>
          </div>
        ) : (
          <>
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

                {/* Messages for this date */}
                {group.messages.map((message, index) => {
                  const prevMessage = index > 0 ? group.messages[index - 1] : null;
                  const showAvatar = !prevMessage || 
                    prevMessage.user.name !== message.user.name ||
                    (message.timestamp - prevMessage.timestamp) > 300000; // 5 minutes

                  return (
                    <Message
                      key={message.id}
                      message={message}
                      showAvatar={showAvatar}
                      onThreadClick={() => onThreadClick(message)}
                      currentUser={currentUser}
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

MessageList.propTypes = {
  channel: PropTypes.object.isRequired,
  messages: PropTypes.array.isRequired,
  onThreadClick: PropTypes.func.isRequired,
  currentUser: PropTypes.object.isRequired,
};

export default MessageList;
