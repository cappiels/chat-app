import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import socketManager from '../../utils/socket';

const MessageComposer = ({ channel, onSendMessage, placeholder }) => {
  const [message, setMessage] = useState('');
  const [showFormatting, setShowFormatting] = useState(false);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  // Typing indicator handlers
  const startTyping = useCallback(() => {
    if (!channel?.id || isTypingRef.current) return;
    
    isTypingRef.current = true;
    socketManager.startTyping(channel.id);
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socketManager.stopTyping(channel.id);
      }
    }, 3000);
  }, [channel?.id]);

  const stopTyping = useCallback(() => {
    if (!channel?.id || !isTypingRef.current) return;
    
    isTypingRef.current = false;
    socketManager.stopTyping(channel.id);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [channel?.id]);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && channel?.id) {
        socketManager.stopTyping(channel.id);
      }
    };
  }, [channel?.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      // Stop typing indicator before sending
      stopTyping();
      
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
    } else if (e.key !== 'Enter') {
      // Start typing on any other key press
      startTyping();
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    // Start typing indicator when user starts typing
    if (e.target.value.trim() && !isTypingRef.current) {
      startTyping();
    } else if (!e.target.value.trim() && isTypingRef.current) {
      stopTyping();
    }
  };

  const handleInputFocus = () => {
    // Start typing if there's content
    if (message.trim()) {
      startTyping();
    }
  };

  const handleInputBlur = () => {
    // Stop typing when input loses focus
    stopTyping();
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
    <div className="p-4 bg-gradient-to-t from-slate-50/30 to-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <form onSubmit={handleSubmit}>
        <div className="bg-white border-2 border-slate-200 rounded-lg p-3 transition-all duration-200 shadow-sm focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] focus-within:shadow-md focus-within:-translate-y-px">
          {/* Formatting toolbar */}
          {showFormatting && (
            <div className="flex items-center gap-1 pb-2 mb-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => insertFormatting('**', '**')}
                className="p-1 rounded-md transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('_', '_')}
                className="p-1 rounded-md transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('`', '`')}
                className="p-1 rounded-md transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Code"
              >
                <Code className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => insertFormatting('[', '](url)')}
                className="p-1 rounded-md transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Link"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('• ')}
                className="p-1 rounded-md transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Bulleted list"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('1. ')}
                className="p-1 rounded-md transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
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
              className="p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700 flex-shrink-0 mb-1"
              title="Add attachments"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Textarea */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={placeholder || `Message #${channel?.name || 'channel'}`}
                className="w-full border-none outline-none text-[15px] font-[inherit] bg-transparent resize-none min-h-[24px] max-h-[200px] text-slate-900 placeholder:text-slate-500"
                rows="1"
              />
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1 mb-1">
              <button
                type="button"
                onClick={() => setShowFormatting(!showFormatting)}
                className={`p-2 rounded-lg transition-colors text-slate-500 hover:text-slate-700 ${showFormatting ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
                title="Show formatting"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Mention someone"
              >
                <AtSign className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              
              {/* Send button */}
              <button
                type="submit"
                disabled={!message.trim()}
                className={`p-2 ml-1 rounded-lg transition-all duration-200 ${
                  message.trim() 
                    ? 'bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-sm hover:-translate-y-px hover:shadow-md' 
                    : 'text-slate-400 hover:bg-slate-100 opacity-50'
                }`}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Helper text */}
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>
              Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs border border-slate-200">Enter</kbd> to send, 
              <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs ml-1 border border-slate-200">Shift + Enter</kbd> for new line
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
