import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, ChevronRight } from 'lucide-react';
import Message from './Message';
import MessageComposer from './MessageComposer';

const Thread = ({ message, isOpen, onClose, currentUser }) => {
  const [threadMessages, setThreadMessages] = useState([]);

  useEffect(() => {
    if (message && isOpen) {
      // Mock thread messages
      setThreadMessages([
        {
          id: 't1',
          user: message.user,
          content: message.content,
          timestamp: message.timestamp,
          isOriginal: true
        },
        {
          id: 't2',
          user: {
            name: 'Mike Johnson',
            initials: 'MJ',
            status: 'online'
          },
          content: 'I agree, this looks great! When can we start implementing?',
          timestamp: new Date(Date.now() - 1800000)
        },
        {
          id: 't3',
          user: {
            name: 'Lisa Park',
            initials: 'LP',
            status: 'online'
          },
          content: 'I can start working on this tomorrow. Should take about 2 days.',
          timestamp: new Date(Date.now() - 900000)
        }
      ]);
    }
  }, [message, isOpen]);

  const handleSendReply = (content) => {
    const newReply = {
      id: `t${Date.now()}`,
      user: {
        name: currentUser.displayName || 'You',
        avatar: currentUser.photoURL,
        initials: currentUser.displayName ? currentUser.displayName.split(' ').map(n => n[0]).join('') : 'U',
        status: 'online'
      },
      content,
      timestamp: new Date()
    };
    setThreadMessages([...threadMessages, newReply]);
  };

  if (!isOpen || !message) return null;

  return (
    <aside className={`thread-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Thread Header */}
      <div className="thread-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="thread-title">Thread</h2>
          <span className="text-sm text-tertiary">#{message.channel || 'general'}</span>
        </div>
        <button onClick={onClose} className="btn-icon btn-ghost">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {threadMessages.map((msg, index) => (
          <div key={msg.id}>
            {msg.isOriginal && (
              <div className="mb-4 pb-4 border-b border-border">
                <Message
                  message={msg}
                  showAvatar={true}
                  onThreadClick={() => {}}
                  currentUser={currentUser}
                />
                <div className="flex items-center gap-2 mt-3 text-sm">
                  <span className="font-medium text-blue">{message.thread_count || 3} replies</span>
                  <ChevronRight className="w-3 h-3 text-tertiary" />
                  <div className="flex -space-x-2">
                    {message.thread_participants?.slice(0, 3).map((participant, i) => (
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
            )}
            {!msg.isOriginal && (
              <Message
                message={msg}
                showAvatar={true}
                onThreadClick={() => {}}
                currentUser={currentUser}
              />
            )}
          </div>
        ))}
      </div>

      {/* Thread Reply Input */}
      <MessageComposer
        channel={{ name: 'thread' }}
        onSendMessage={handleSendReply}
        placeholder="Reply..."
      />
    </aside>
  );
};

Thread.propTypes = {
  message: PropTypes.object,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  currentUser: PropTypes.object.isRequired,
};

export default Thread;
