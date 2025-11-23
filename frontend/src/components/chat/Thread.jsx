import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { X, ChevronRight } from 'lucide-react';
import Message from './Message';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';

const Thread = ({ thread, isOpen, onClose, currentUser, onSendReply, typingUsers = [], workspace, workspaceId, userRole }) => {
  if (!isOpen || !thread) return null;

  const messagesEndRef = useRef(null);
  const originalMessage = thread.parentMessage;
  const replies = thread.messages || [];

  // Scroll to bottom when new messages arrive or typing status changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length, typingUsers.length]);

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
      <div className="flex-1 overflow-y-auto p-5 flex flex-col">
        {/* Original Message */}
        <div className="mb-4 pb-4 border-b border-border flex-shrink-0">
          <Message
            message={originalMessage}
            showAvatar={true}
            onThreadClick={() => {}}
            currentUser={currentUser}
            workspaceId={workspaceId || workspace?.id}
            threadId={thread.id}
            workspace={workspace}
            thread={thread}
            userRole={userRole}
            onMessageUpdate={(messageId, action) => {
              if (action === 'deleted') {
                window.location.reload();
              }
            }}
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

        {/* Thread Messages Container - proper flex layout for message positioning */}
        <div className="flex-1 flex flex-col min-h-0">
          {replies.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">No replies yet. Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages container - grows to fill space, messages stick to bottom */}
              <div className="flex-1 flex flex-col justify-end min-h-0">
                <div className="flex flex-col space-y-4">
                  {/* Replies sorted chronologically with oldest at top, newest at bottom */}
                  {replies
                    .slice() // Create a copy to avoid mutating the original array
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map((reply) => (
                      <Message
                        key={reply.id}
                        message={reply}
                        showAvatar={true}
                        onThreadClick={() => {}}
                        currentUser={currentUser}
                        workspaceId={workspaceId || workspace?.id}
                        threadId={thread.id}
                        workspace={workspace}
                        thread={thread}
                        userRole={userRole}
                        onMessageUpdate={(messageId, action) => {
                          if (action === 'deleted') {
                            window.location.reload();
                          }
                        }}
                      />
                    ))}
                </div>
              </div>
              
              {/* Typing Indicator - positioned at the bottom, always visible */}
              {typingUsers.length > 0 && (
                <div className="flex-shrink-0 pt-2">
                  <TypingIndicator typingUsers={typingUsers} />
                </div>
              )}
              
              {/* Invisible element for scrolling to bottom */}
              <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
            </>
          )}
        </div>
      </div>

      {/* Thread Reply Input */}
      <MessageComposer
        channel={{ name: 'thread' }}
        onSendMessage={onSendReply}
        placeholder="Reply..."
        workspace={workspace}
        workspaceId={workspaceId || workspace?.id}
        currentUser={currentUser}
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
  userRole: PropTypes.string,
};

export default Thread;
