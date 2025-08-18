import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Reply, MoreHorizontal, Smile, Bookmark, Edit, MessageSquare } from 'lucide-react';

const Message = ({ message, showAvatar, onThreadClick, currentUser }) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isCurrentUser = message.user.name === currentUser?.displayName;

  // Common emojis for quick reactions
  const quickEmojis = ['👍', '❤️', '😂', '🎉', '👀', '🔥'];

  const handleAddReaction = (emoji) => {
    // Handle adding reaction
    console.log('Adding reaction:', emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div 
      className="flex py-3 px-5 gap-3 relative border-b border-transparent transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/20 hover:to-transparent hover:border-b-slate-200 hover:shadow-[inset_3px_0_0_rgb(37,99,235)] group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="w-9 flex-shrink-0">
        {showAvatar && (
          <div className="relative inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-50 border-2 border-slate-200 shadow-sm overflow-hidden">
            {message.user.avatar ? (
              <img
                src={message.user.avatar}
                alt={message.user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-slate-700">
                {message.user.initials}
              </span>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
              message.user.status === 'online' ? 'bg-green-500' : 
              message.user.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
            }`} />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[15px] font-bold text-slate-900">{message.user.name}</span>
            <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
            {message.edited && (
              <span className="text-xs text-slate-400">(edited)</span>
            )}
          </div>
        )}
        <div className="text-slate-900 leading-relaxed">{message.content}</div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full border transition-all duration-200 cursor-pointer hover:scale-110 hover:shadow-md ${
                  reaction.users.includes(currentUser?.displayName) 
                    ? 'bg-purple-100 border-purple-500 text-purple-700' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                }`}
                title={reaction.users.join(', ')}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
            <button 
              className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 hover:scale-110 transition-all duration-200"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Thread indicator */}
        {message.thread_count > 0 && (
          <button
            onClick={onThreadClick}
            className="flex items-center gap-2 mt-3 p-3 text-sm rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-blue-600 hover:text-blue-700"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">{message.thread_count} replies</span>
            {message.thread_participants && (
              <span className="text-slate-500">
                {message.thread_participants.slice(0, 2).join(', ')}
                {message.thread_participants.length > 2 && ' and others'}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Message Actions */}
      {showActions && (
        <div className="absolute -top-2 right-4 bg-white border border-slate-300 rounded-lg p-1 shadow-lg backdrop-blur-sm flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" title="Add reaction">
            <Smile className="w-4 h-4" />
          </button>
          <button className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" title="Reply in thread" onClick={onThreadClick}>
            <Reply className="w-4 h-4" />
          </button>
          <button className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" title="Bookmark">
            <Bookmark className="w-4 h-4" />
          </button>
          {isCurrentUser && (
            <button className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" title="Edit message">
              <Edit className="w-4 h-4" />
            </button>
          )}
          <button className="p-1 rounded-md transition-colors hover:bg-blue-100 hover:text-blue-600 hover:scale-110" title="More actions">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute left-12 top-full mt-1 bg-white rounded-lg border border-slate-300 shadow-lg p-3 z-20 animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-6 gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleAddReaction(emoji)}
                className="p-2 hover:bg-slate-100 rounded-lg text-lg transition-colors hover:scale-110 duration-200"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

Message.propTypes = {
  message: PropTypes.object.isRequired,
  showAvatar: PropTypes.bool,
  onThreadClick: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
};

export default Message;
