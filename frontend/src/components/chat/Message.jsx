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
      className="message group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="w-9 flex-shrink-0">
        {showAvatar && (
          <>
            {message.user.avatar ? (
              <img
                src={message.user.avatar}
                alt={message.user.name}
                className="message-avatar"
              />
            ) : (
              <div className="message-avatar bg-blue flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {message.user.initials}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Message Content */}
      <div className="message-content">
        {showAvatar && (
          <div className="message-header">
            <span className="message-author">{message.user.name}</span>
            <span className="message-time">{formatTime(message.timestamp)}</span>
            {message.edited && (
              <span className="text-xs text-tertiary">(edited)</span>
            )}
          </div>
        )}
        <div className="message-text">{message.content}</div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="message-reactions">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                className={`reaction ${reaction.users.includes(currentUser?.displayName) ? 'reacted' : ''}`}
                title={reaction.users.join(', ')}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
            <button 
              className="reaction"
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
            className="flex items-center gap-2 mt-2 text-sm text-blue hover:underline"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">{message.thread_count} replies</span>
            {message.thread_participants && (
              <span className="text-tertiary">
                {message.thread_participants.slice(0, 2).join(', ')}
                {message.thread_participants.length > 2 && ' and others'}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Message Actions */}
      {showActions && (
        <div className="message-actions">
          <button className="btn-icon btn-ghost" title="Add reaction">
            <Smile className="w-4 h-4" />
          </button>
          <button className="btn-icon btn-ghost" title="Reply in thread" onClick={onThreadClick}>
            <Reply className="w-4 h-4" />
          </button>
          <button className="btn-icon btn-ghost" title="Bookmark">
            <Bookmark className="w-4 h-4" />
          </button>
          {isCurrentUser && (
            <button className="btn-icon btn-ghost" title="Edit message">
              <Edit className="w-4 h-4" />
            </button>
          )}
          <button className="btn-icon btn-ghost" title="More actions">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute left-12 top-full mt-1 bg-white rounded-lg shadow-lg border border-border p-2 z-10">
          <div className="grid grid-cols-6 gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleAddReaction(emoji)}
                className="p-2 hover:bg-surface rounded text-lg"
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
