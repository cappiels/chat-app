import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Pin,
  PinOff,
  Trash2,
  MoreHorizontal,
  Shield,
  AlertTriangle
} from 'lucide-react';

const ModerationToolbar = ({
  topic,
  onLock,
  onPin,
  onDelete,
  canModerate = false,
  isOwner = false,
  isCompact = false
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!canModerate && !isOwner) {
    return null;
  }

  const handleLock = async () => {
    setIsLoading(true);
    try {
      await onLock?.(!topic.is_locked);
    } finally {
      setIsLoading(false);
      setShowMenu(false);
    }
  };

  const handlePin = async () => {
    setIsLoading(true);
    try {
      await onPin?.(!topic.is_pinned);
    } finally {
      setIsLoading(false);
      setShowMenu(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete?.();
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
      setShowMenu(false);
    }
  };

  if (isCompact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Moderation options"
        >
          <Shield className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              <motion.div
                className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[180px]"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
              >
                {canModerate && (
                  <>
                    <button
                      onClick={handleLock}
                      disabled={isLoading}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 disabled:opacity-50"
                    >
                      {topic.is_locked ? (
                        <>
                          <Unlock className="w-4 h-4" />
                          <span>Unlock Topic</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Lock Topic</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handlePin}
                      disabled={isLoading}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 disabled:opacity-50"
                    >
                      {topic.is_pinned ? (
                        <>
                          <PinOff className="w-4 h-4" />
                          <span>Unpin Topic</span>
                        </>
                      ) : (
                        <>
                          <Pin className="w-4 h-4" />
                          <span>Pin Topic</span>
                        </>
                      )}
                    </button>

                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  </>
                )}

                {(canModerate || isOwner) && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Topic</span>
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center space-x-3 text-red-600 mb-4">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-lg font-semibold">Delete Topic?</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  This will permanently delete this topic and all its comments. This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full toolbar version
  return (
    <div className="flex items-center space-x-2">
      {canModerate && (
        <>
          <motion.button
            onClick={handleLock}
            disabled={isLoading}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              topic.is_locked
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
            } disabled:opacity-50`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {topic.is_locked ? (
              <>
                <Unlock className="w-4 h-4 mr-1.5" />
                Unlock
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-1.5" />
                Lock
              </>
            )}
          </motion.button>

          <motion.button
            onClick={handlePin}
            disabled={isLoading}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              topic.is_pinned
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            } disabled:opacity-50`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {topic.is_pinned ? (
              <>
                <PinOff className="w-4 h-4 mr-1.5" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="w-4 h-4 mr-1.5" />
                Pin
              </>
            )}
          </motion.button>
        </>
      )}

      {(canModerate || isOwner) && (
        <motion.button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Delete
        </motion.button>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 text-red-600 mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Delete Topic?</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This will permanently delete this topic and all its comments. This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModerationToolbar;
