import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  Plus, 
  Send, 
  Smile, 
  Paperclip, 
  AtSign, 
  Bold, 
  Italic, 
  Code,
  Link2,
  List,
  ListOrdered
} from 'lucide-react';

const MessageComposer = ({ channel, onSendMessage, placeholder }) => {
  const [message, setMessage] = useState('');
  const [showFormatting, setShowFormatting] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    const newText = message.substring(0, start) + before + selectedText + after + message.substring(end);
    
    setMessage(newText);
    
    // Set cursor position after formatting
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit}>
        <div className="message-input-wrapper">
          {/* Formatting toolbar */}
          {showFormatting && (
            <div className="flex items-center gap-1 pb-2 mb-2 border-b border-border">
              <button
                type="button"
                onClick={() => insertFormatting('**', '**')}
                className="btn-icon btn-ghost p-1"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('_', '_')}
                className="btn-icon btn-ghost p-1"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('`', '`')}
                className="btn-icon btn-ghost p-1"
                title="Code"
              >
                <Code className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-border mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting('[', '](url)')}
                className="btn-icon btn-ghost p-1"
                title="Link"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('• ')}
                className="btn-icon btn-ghost p-1"
                title="Bulleted list"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('1. ')}
                className="btn-icon btn-ghost p-1"
                title="Numbered list"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="flex items-end gap-2">
            {/* Plus button for attachments */}
            <button
              type="button"
              className="btn-icon btn-ghost flex-shrink-0 mb-1"
              title="Add attachments"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Textarea */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || `Message #${channel?.name || 'channel'}`}
                className="message-input"
                rows="1"
              />
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1 mb-1">
              <button
                type="button"
                onClick={() => setShowFormatting(!showFormatting)}
                className={`btn-icon btn-ghost ${showFormatting ? 'bg-surface' : ''}`}
                title="Show formatting"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost"
                title="Mention someone"
              >
                <AtSign className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost"
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              
              {/* Send button */}
              <button
                type="submit"
                disabled={!message.trim()}
                className={`btn-icon ml-1 ${message.trim() ? 'btn-primary' : 'btn-ghost opacity-50'}`}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Helper text */}
          <div className="flex items-center justify-between mt-2 text-xs text-tertiary">
            <span>
              Press <kbd className="px-1 py-0.5 bg-surface rounded text-xs">Enter</kbd> to send, 
              <kbd className="px-1 py-0.5 bg-surface rounded text-xs ml-1">Shift + Enter</kbd> for new line
            </span>
          </div>
        </div>
      </form>
    </div>
  );
};

MessageComposer.propTypes = {
  channel: PropTypes.object,
  onSendMessage: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default MessageComposer;
