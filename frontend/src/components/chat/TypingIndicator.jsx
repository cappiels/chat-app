import React from 'react';
import PropTypes from 'prop-types';
import { Avatar } from '../ui/Avatar';

const TypingIndicator = ({ typingUsers = [] }) => {
  if (typingUsers.length === 0) return null;

  const renderTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].user.display_name} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].user.display_name} and ${typingUsers[1].user.display_name} are typing...`;
    } else if (typingUsers.length === 3) {
      return `${typingUsers[0].user.display_name}, ${typingUsers[1].user.display_name}, and ${typingUsers[2].user.display_name} are typing...`;
    } else {
      return `${typingUsers[0].user.display_name} and ${typingUsers.length - 1} others are typing...`;
    }
  };

  return (
    <div className="px-5 py-3 animate-fade-in sticky bottom-0 bg-gradient-to-b from-transparent to-white z-10">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 shadow-sm border border-blue-100">
        <div className="flex items-center -space-x-2">
          {typingUsers.slice(0, 3).map((typingUser) => (
            <div
              key={typingUser.userId}
              className="relative"
            >
              <Avatar
                src={typingUser.user.profile_picture_url}
                alt={typingUser.user.display_name}
                size="sm"
                className="border-2 border-white shadow-sm"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-700 font-medium">
            {renderTypingText()}
          </span>
          <div className="flex gap-1 ml-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

TypingIndicator.propTypes = {
  typingUsers: PropTypes.arrayOf(
    PropTypes.shape({
      userId: PropTypes.string.isRequired,
      user: PropTypes.shape({
        display_name: PropTypes.string.isRequired,
        profile_picture_url: PropTypes.string,
      }).isRequired,
    })
  ),
};

export default TypingIndicator;
