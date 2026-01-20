import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Reply,
  MoreHorizontal,
  Edit2,
  Trash2,
  User,
  Clock
} from 'lucide-react';
import VoteButtons from './VoteButtons';
import CommentComposer from './CommentComposer';

const Comment = ({
  comment,
  depth = 0,
  onReply,
  onEdit,
  onDelete,
  onVote,
  onRemoveVote,
  currentUserId,
  isLocked = false,
  maxDepth = 4
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = comment.user_id === currentUserId;
  const canDelete = comment.is_owner || comment.user_can_moderate;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleReply = async (content) => {
    setIsSubmitting(true);
    try {
      await onReply?.(content, comment.id);
      setShowReplyForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (content) => {
    setIsSubmitting(true);
    try {
      await onEdit?.(comment.id, content);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      await onDelete?.(comment.id);
    }
    setShowMenu(false);
  };

  return (
    <motion.div
      className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-200 dark:border-gray-700' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex space-x-3 py-3">
        {/* Vote buttons */}
        <div className="flex-shrink-0">
          <VoteButtons
            upvotes={comment.upvotes_count || 0}
            downvotes={comment.downvotes_count || 0}
            userVote={comment.user_vote}
            onVote={(type) => onVote?.(comment.id, type)}
            onRemoveVote={() => onRemoveVote?.(comment.id)}
            size="sm"
            layout="vertical"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-1">
            {comment.user_avatar ? (
              <img
                src={comment.user_avatar}
                alt={comment.user_name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-400" />
              </div>
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {comment.user_name || 'Unknown User'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatDate(comment.created_at)}
            </span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs text-gray-400 italic">(edited)</span>
            )}
          </div>

          {/* Body */}
          {isEditing ? (
            <CommentComposer
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              initialValue={comment.content}
              isEditing={true}
              isSubmitting={isSubmitting}
              autoFocus
            />
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {comment.content}
            </div>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center space-x-4 mt-2">
              {!isLocked && depth < maxDepth && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center space-x-1 transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              )}

              {(canEdit || canDelete) && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[120px]"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        {canEdit && (
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setShowMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={handleDelete}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Reply Form */}
          <AnimatePresence>
            {showReplyForm && (
              <div className="mt-3">
                <CommentComposer
                  onSubmit={handleReply}
                  onCancel={() => setShowReplyForm(false)}
                  placeholder={`Reply to ${comment.user_name}...`}
                  isReply={true}
                  replyToUser={comment.user_name}
                  isSubmitting={isSubmitting}
                  autoFocus
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-1">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onVote={onVote}
              onRemoveVote={onRemoveVote}
              currentUserId={currentUserId}
              isLocked={isLocked}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

const CommentThread = ({
  comments = [],
  onAddComment,
  onReply,
  onEdit,
  onDelete,
  onVote,
  onRemoveVote,
  currentUserId,
  isLocked = false,
  isLoading = false
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddComment = async (content) => {
    setIsSubmitting(true);
    try {
      await onAddComment?.(content);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex space-x-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Comment Form */}
      {!isLocked ? (
        <CommentComposer
          onSubmit={handleAddComment}
          placeholder="Add a comment..."
          isSubmitting={isSubmitting}
        />
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          This topic is locked. Comments are disabled.
        </div>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onVote={onVote}
              onRemoveVote={onRemoveVote}
              currentUserId={currentUserId}
              isLocked={isLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
