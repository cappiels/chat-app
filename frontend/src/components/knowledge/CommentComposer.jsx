import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X } from 'lucide-react';

const CommentComposer = ({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  initialValue = '',
  isReply = false,
  replyToUser = null,
  isEditing = false,
  isSubmitting = false,
  autoFocus = false
}) => {
  const [content, setContent] = useState(initialValue);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim() && !isSubmitting) {
      onSubmit(content.trim());
      if (!isEditing) {
        setContent('');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className={`relative ${isReply ? 'ml-8' : ''}`}
      initial={isReply ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {replyToUser && (
        <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 flex items-center">
          Replying to {replyToUser}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-start space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isSubmitting}
            className="w-full px-4 py-3 pr-12 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[44px] max-h-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="absolute right-2 bottom-2 flex items-center space-x-1">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-1.5">
        Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Cmd+Enter</kbd> to submit
      </p>
    </motion.form>
  );
};

export default CommentComposer;
