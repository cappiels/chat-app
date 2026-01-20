import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Eye,
  Clock,
  MessageCircle,
  Pin,
  Lock,
  User,
  BookMarked
} from 'lucide-react';
import { knowledgeAPI } from '../../utils/api';
import VoteButtons from './VoteButtons';
import CommentThread from './CommentThread';
import ModerationToolbar from './ModerationToolbar';

const TopicDetailView = ({
  workspaceId,
  topicId,
  currentUser,
  onBack,
  onTopicDeleted
}) => {
  const [topic, setTopic] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommentsLoading, setIsCommentsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (topicId) {
      loadTopic();
      loadComments();
    }
  }, [topicId]);

  const loadTopic = async () => {
    try {
      setIsLoading(true);
      const response = await knowledgeAPI.getTopic(workspaceId, topicId);
      setTopic(response.data.topic);
    } catch (err) {
      console.error('Error loading topic:', err);
      setError('Failed to load topic');
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      setIsCommentsLoading(true);
      const response = await knowledgeAPI.getComments(workspaceId, topicId);
      setComments(response.data.comments);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setIsCommentsLoading(false);
    }
  };

  const handleVote = async (voteType) => {
    try {
      const response = await knowledgeAPI.voteOnTopic(workspaceId, topicId, voteType);
      setTopic(prev => ({
        ...prev,
        user_vote: voteType,
        upvotes_count: response.data.upvotes_count,
        downvotes_count: response.data.downvotes_count
      }));
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const handleRemoveVote = async () => {
    try {
      const response = await knowledgeAPI.removeTopicVote(workspaceId, topicId);
      setTopic(prev => ({
        ...prev,
        user_vote: null,
        upvotes_count: response.data.upvotes_count,
        downvotes_count: response.data.downvotes_count
      }));
    } catch (err) {
      console.error('Error removing vote:', err);
    }
  };

  const handleLock = async (locked) => {
    try {
      const response = await knowledgeAPI.lockTopic(workspaceId, topicId, locked);
      setTopic(response.data.topic);
    } catch (err) {
      console.error('Error locking topic:', err);
    }
  };

  const handlePin = async (pinned) => {
    try {
      const response = await knowledgeAPI.pinTopic(workspaceId, topicId, pinned);
      setTopic(response.data.topic);
    } catch (err) {
      console.error('Error pinning topic:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await knowledgeAPI.deleteTopic(workspaceId, topicId);
      onTopicDeleted?.();
      onBack?.();
    } catch (err) {
      console.error('Error deleting topic:', err);
    }
  };

  const handleAddComment = async (content) => {
    try {
      const response = await knowledgeAPI.addComment(workspaceId, topicId, content);
      setComments(prev => [...prev, response.data.comment]);
      setTopic(prev => ({
        ...prev,
        comment_count: (prev.comment_count || 0) + 1
      }));
    } catch (err) {
      console.error('Error adding comment:', err);
      throw err;
    }
  };

  const handleReply = async (content, parentCommentId) => {
    try {
      const response = await knowledgeAPI.addComment(workspaceId, topicId, content, parentCommentId);
      // Add reply to the parent comment's replies array
      const addReplyToComment = (comments, parentId, newReply) => {
        return comments.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply]
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: addReplyToComment(comment.replies, parentId, newReply)
            };
          }
          return comment;
        });
      };
      setComments(prev => addReplyToComment(prev, parentCommentId, response.data.comment));
      setTopic(prev => ({
        ...prev,
        comment_count: (prev.comment_count || 0) + 1
      }));
    } catch (err) {
      console.error('Error adding reply:', err);
      throw err;
    }
  };

  const handleEditComment = async (commentId, content) => {
    try {
      const response = await knowledgeAPI.editComment(workspaceId, commentId, content);
      // Update comment in tree
      const updateCommentInTree = (comments, id, updatedComment) => {
        return comments.map(comment => {
          if (comment.id === id) {
            return { ...comment, ...updatedComment };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateCommentInTree(comment.replies, id, updatedComment)
            };
          }
          return comment;
        });
      };
      setComments(prev => updateCommentInTree(prev, commentId, response.data.comment));
    } catch (err) {
      console.error('Error editing comment:', err);
      throw err;
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await knowledgeAPI.deleteComment(workspaceId, commentId);
      // Remove comment from tree
      const removeCommentFromTree = (comments, id) => {
        return comments
          .filter(comment => comment.id !== id)
          .map(comment => ({
            ...comment,
            replies: comment.replies ? removeCommentFromTree(comment.replies, id) : []
          }));
      };
      setComments(prev => removeCommentFromTree(prev, commentId));
      setTopic(prev => ({
        ...prev,
        comment_count: Math.max(0, (prev.comment_count || 0) - 1)
      }));
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleCommentVote = async (commentId, voteType) => {
    try {
      const response = await knowledgeAPI.voteOnComment(workspaceId, commentId, voteType);
      const updateVoteInTree = (comments, id, votes) => {
        return comments.map(comment => {
          if (comment.id === id) {
            return {
              ...comment,
              user_vote: voteType,
              upvotes_count: votes.upvotes_count,
              downvotes_count: votes.downvotes_count
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateVoteInTree(comment.replies, id, votes)
            };
          }
          return comment;
        });
      };
      setComments(prev => updateVoteInTree(prev, commentId, response.data));
    } catch (err) {
      console.error('Error voting on comment:', err);
    }
  };

  const handleRemoveCommentVote = async (commentId) => {
    try {
      const response = await knowledgeAPI.removeCommentVote(workspaceId, commentId);
      const updateVoteInTree = (comments, id, votes) => {
        return comments.map(comment => {
          if (comment.id === id) {
            return {
              ...comment,
              user_vote: null,
              upvotes_count: votes.upvotes_count,
              downvotes_count: votes.downvotes_count
            };
          }
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateVoteInTree(comment.replies, id, votes)
            };
          }
          return comment;
        });
      };
      setComments(prev => updateVoteInTree(prev, commentId, response.data));
    } catch (err) {
      console.error('Error removing comment vote:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          className="flex flex-col items-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading topic...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-red-600 dark:text-red-400">{error || 'Topic not found'}</p>
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to Knowledge Base</span>
      </button>

      {/* Topic Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex">
          {/* Vote Column */}
          <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700">
            <VoteButtons
              upvotes={topic.upvotes_count || 0}
              downvotes={topic.downvotes_count || 0}
              userVote={topic.user_vote}
              onVote={handleVote}
              onRemoveVote={handleRemoveVote}
              size="lg"
              layout="vertical"
            />
          </div>

          {/* Content Column */}
          <div className="flex-1 p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center flex-wrap gap-2">
                {topic.is_pinned && (
                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                    <Pin className="w-3 h-3 mr-1" />
                    Pinned
                  </span>
                )}
                {topic.is_locked && (
                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </span>
                )}
                {topic.category_name && (
                  <span
                    className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: (topic.category_color || '#6366f1') + '20',
                      color: topic.category_color || '#6366f1'
                    }}
                  >
                    {topic.category_name}
                  </span>
                )}
              </div>

              <ModerationToolbar
                topic={topic}
                onLock={handleLock}
                onPin={handlePin}
                onDelete={handleDelete}
                canModerate={topic.user_can_moderate}
                isOwner={topic.is_owner}
                isCompact
              />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {topic.title}
            </h1>

            {/* Meta info */}
            <div className="flex items-center flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <div className="flex items-center space-x-2">
                {topic.creator_avatar ? (
                  <img
                    src={topic.creator_avatar}
                    alt={topic.creator_name}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {topic.creator_name || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{formatDate(topic.created_at)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{topic.views_count || 0} views</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-4 h-4" />
                <span>{topic.comment_count || 0} comments</span>
              </div>
            </div>

            {/* Content */}
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {topic.content}
              </div>
            </div>

            {/* Source info if from message */}
            {topic.source_type === 'message' && (
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300">
                <BookMarked className="w-4 h-4" />
                <span>Saved from chat message</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center space-x-2">
          <MessageCircle className="w-5 h-5" />
          <span>Comments ({topic.comment_count || 0})</span>
        </h2>

        <CommentThread
          comments={comments}
          onAddComment={handleAddComment}
          onReply={handleReply}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
          onVote={handleCommentVote}
          onRemoveVote={handleRemoveCommentVote}
          currentUserId={currentUser?.uid}
          isLocked={topic.is_locked}
          isLoading={isCommentsLoading}
        />
      </div>
    </motion.div>
  );
};

export default TopicDetailView;
