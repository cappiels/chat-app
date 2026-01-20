import React from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

const VoteButtons = ({
  upvotes = 0,
  downvotes = 0,
  userVote = null, // 'upvote', 'downvote', or null
  onVote,
  onRemoveVote,
  size = 'md', // 'sm', 'md', 'lg'
  layout = 'vertical', // 'vertical' or 'horizontal'
  disabled = false
}) => {
  const score = upvotes - downvotes;

  const handleUpvote = () => {
    if (disabled) return;
    if (userVote === 'upvote') {
      onRemoveVote?.();
    } else {
      onVote?.('upvote');
    }
  };

  const handleDownvote = () => {
    if (disabled) return;
    if (userVote === 'downvote') {
      onRemoveVote?.();
    } else {
      onVote?.('downvote');
    }
  };

  const sizeConfig = {
    sm: { icon: 'w-4 h-4', button: 'p-1', text: 'text-xs' },
    md: { icon: 'w-5 h-5', button: 'p-1.5', text: 'text-sm' },
    lg: { icon: 'w-6 h-6', button: 'p-2', text: 'text-base' }
  };

  const config = sizeConfig[size];

  const containerClass = layout === 'vertical'
    ? 'flex flex-col items-center space-y-1'
    : 'flex items-center space-x-1';

  return (
    <div className={containerClass}>
      <motion.button
        onClick={handleUpvote}
        disabled={disabled}
        className={`${config.button} rounded-md transition-colors ${
          userVote === 'upvote'
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        whileHover={!disabled ? { scale: 1.1 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        title="Upvote"
      >
        <ChevronUp className={config.icon} />
      </motion.button>

      <span className={`${config.text} font-semibold ${
        score > 0 ? 'text-green-600 dark:text-green-400' :
        score < 0 ? 'text-red-600 dark:text-red-400' :
        'text-gray-500 dark:text-gray-400'
      }`}>
        {score}
      </span>

      <motion.button
        onClick={handleDownvote}
        disabled={disabled}
        className={`${config.button} rounded-md transition-colors ${
          userVote === 'downvote'
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        whileHover={!disabled ? { scale: 1.1 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        title="Downvote"
      >
        <ChevronDown className={config.icon} />
      </motion.button>
    </div>
  );
};

export default VoteButtons;
