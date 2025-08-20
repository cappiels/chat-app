import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, ChevronRight } from 'lucide-react';
import Message from './Message';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';

const Thread = ({ thread, isOpen, onClose, currentUser, onSendReply, typingUsers = [] }) => {
  if (!isOpen || !thread) return null;

  const originalMessage = thread.parentMessage;
  const replies = thread.messages || [];

  return (
    <aside className={`thread-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Thread Header */}
      <div className="thread-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="thread-title">Thread</h2>
          <span className="text-sm text-tertiary">#{originalMessage.channel || 'general'}</span>
        </div>
        <button onClick={onClose} className="btn-icon btn-ghost">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Original Message */}
        <div className="mb-4 pb-4 border-b border-border">
          <Message
            message={originalMessage}
            showAvatar={true}
            onThreadClick={() => {}}
            currentUser={currentUser}
          />
          <div className="flex items-center gap-2 mt-3 text-sm">
            <span className="font-medium text-blue">{replies.length} replies</span>
            <ChevronRight className="w-3 h-3 text-tertiary" />
            <div className="flex -space-x-2">
              {originalMessage.thread_participants?.slice(0, 3).map((participant, i) => (
                <div 
                  key={i}
                  className="w-6 h-6 bg-maroon rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                  title={participant}
                >
                  {participant.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thread Replies - sorted by timestamp to ensure chronological order */}
        {[...replies]
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          .map((reply) => (
            <Message
              key={reply.id}
              message={reply}
              showAvatar={true}
              onThreadClick={() => {}}
              currentUser={currentUser}
            />
          ))}
          
        {/* Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} />
      </div>

      {/* Thread Reply Input */}
      <MessageComposer
        channel={{ name: 'thread' }}
        onSendMessage={onSendReply}
        placeholder="Reply..."
      />
    </aside>
  );
};

Thread.propTypes = {
  thread: PropTypes.object,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  currentUser: PropTypes.object.isRequired,
  onSendReply: PropTypes.func.isRequired,
  typingUsers: PropTypes.array,
};

export default Thread;
