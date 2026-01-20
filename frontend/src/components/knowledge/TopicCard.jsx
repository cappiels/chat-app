import React from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Eye,
  Pin,
  Lock,
  Clock,
  User
} from 'lucide-react';
import VoteButtons from './VoteButtons';

const TopicCard = ({
  topic,
  onClick,
  onVote,
  onRemoveVote
}) => {
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

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 overflow-hidden group"
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
      onClick={() => onClick?.(topic)}
    >
      <div className="flex">
        {/* Vote Column */}
        <div className="flex-shrink-0 p-3 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700">
          <VoteButtons
            upvotes={topic.upvotes_count || 0}
            downvotes={topic.downvotes_count || 0}
            userVote={topic.user_vote}
            onVote={(type) => {
              // Prevent card click when voting
              event.stopPropagation();
              onVote?.(topic.id, type);
            }}
            onRemoveVote={() => {
              event.stopPropagation();
              onRemoveVote?.(topic.id);
            }}
            size="sm"
            layout="vertical"
          />
        </div>

        {/* Content Column */}
        <div className="flex-1 p-4 cursor-pointer">
          {/* Header with badges */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center flex-wrap gap-2">
              {topic.is_pinned && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                  <Pin className="w-3 h-3 mr-1" />
                  Pinned
                </span>
              )}
              {topic.is_locked && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </span>
              )}
              {topic.category_name && (
                <span
                  className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: (topic.category_color || '#6366f1') + '20',
                    color: topic.category_color || '#6366f1'
                  }}
                >
                  {topic.category_name}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {topic.title}
          </h3>

          {/* Content Preview */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {topic.ai_summary || topic.content?.substring(0, 150)}
            {(topic.content?.length > 150 && !topic.ai_summary) ? '...' : ''}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              {/* Author */}
              <div className="flex items-center space-x-1.5">
                {topic.creator_avatar ? (
                  <img
                    src={topic.creator_avatar}
                    alt={topic.creator_name}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                )}
                <span className="font-medium">{topic.creator_name || 'Unknown'}</span>
              </div>

              {/* Time */}
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDate(topic.last_activity_at || topic.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Comments count */}
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{topic.comment_count || 0}</span>
              </div>

              {/* Views count */}
              <div className="flex items-center space-x-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{topic.views_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TopicCard;
