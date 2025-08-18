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
            >
              <Users className="w-4 h-4" />
            </button>
            <button 
              className="p-2.5 rounded-lg transition-all duration-200 bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md hover:-translate-y-px"
              title="Channel information"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="px-5 py-4">
        {messages.length === 0 ? (
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
