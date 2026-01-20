import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plus,
  BookOpen,
  TrendingUp,
  Clock,
  Pin,
  ChevronDown,
  X,
  MessageCircle
} from 'lucide-react';
import { knowledgeAPI } from '../../utils/api';
import TopicCard from './TopicCard';
import TopicDetailView from './TopicDetailView';

const KnowledgeBoardScreen = ({ workspaceId, currentUser }) => {
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [total, setTotal] = useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadCategories();
  }, [workspaceId]);

  useEffect(() => {
    loadTopics();
  }, [workspaceId, selectedCategory, debouncedSearch, sortBy]);

  const loadCategories = async () => {
    try {
      const response = await knowledgeAPI.getCategories(workspaceId);
      setCategories(response.data.data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadTopics = async () => {
    try {
      setIsLoading(true);
      const params = {
        sort_by: sortBy,
        sort_order: 'DESC',
        limit: 50
      };

      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      const response = await knowledgeAPI.getTopics(workspaceId, params);
      setTopics(response.data.topics || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error loading topics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (topicId, voteType) => {
    try {
      const response = await knowledgeAPI.voteOnTopic(workspaceId, topicId, voteType);
      setTopics(prev => prev.map(topic =>
        topic.id === topicId
          ? {
              ...topic,
              user_vote: voteType,
              upvotes_count: response.data.upvotes_count,
              downvotes_count: response.data.downvotes_count
            }
          : topic
      ));
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const handleRemoveVote = async (topicId) => {
    try {
      const response = await knowledgeAPI.removeTopicVote(workspaceId, topicId);
      setTopics(prev => prev.map(topic =>
        topic.id === topicId
          ? {
              ...topic,
              user_vote: null,
              upvotes_count: response.data.upvotes_count,
              downvotes_count: response.data.downvotes_count
            }
          : topic
      ));
    } catch (err) {
      console.error('Error removing vote:', err);
    }
  };

  const handleTopicClick = (topic) => {
    setSelectedTopicId(topic.id);
  };

  const handleBackFromDetail = () => {
    setSelectedTopicId(null);
  };

  const handleTopicDeleted = () => {
    loadTopics();
  };

  const sortOptions = [
    { value: 'last_activity_at', label: 'Recent Activity', icon: Clock },
    { value: 'created_at', label: 'Newest', icon: Clock },
    { value: 'upvotes_count', label: 'Most Upvoted', icon: TrendingUp },
    { value: 'comment_count', label: 'Most Discussed', icon: MessageCircle },
  ];

  // Show topic detail view if a topic is selected
  if (selectedTopicId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TopicDetailView
          workspaceId={workspaceId}
          topicId={selectedTopicId}
          currentUser={currentUser}
          onBack={handleBackFromDetail}
          onTopicDeleted={handleTopicDeleted}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <motion.div
        className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <BookOpen className="w-8 h-8" />
              Knowledge Base
            </h1>
            <p className="text-indigo-100">
              {total} topics in your team's collective knowledge
            </p>
          </div>
          <motion.button
            className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5 mr-2" />
            New Topic
          </motion.button>
        </div>

        {/* Search Bar */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-300 w-5 h-5" />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-4 py-3 rounded-lg transition-colors ${
              showFilters
                ? 'bg-white text-indigo-600'
                : 'bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30'
            }`}
          >
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </button>
        </div>
      </motion.div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex flex-wrap gap-4">
              {/* Category Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.item_count || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Pills (quick filter) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All Topics
        </button>
        {categories.slice(0, 6).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            style={selectedCategory === cat.id ? { backgroundColor: cat.color || '#6366f1' } : {}}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Topics List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
            >
              <div className="flex space-x-4">
                <div className="w-12 space-y-2">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : topics.length === 0 ? (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No topics found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery
              ? `No topics match "${searchQuery}"`
              : 'Be the first to create a topic!'}
          </p>
          <motion.button
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Topic
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {topics.map((topic, index) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <TopicCard
                topic={topic}
                onClick={handleTopicClick}
                onVote={handleVote}
                onRemoveVote={handleRemoveVote}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Load More */}
      {topics.length > 0 && topics.length < total && (
        <div className="text-center pt-4">
          <button className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium">
            Load more topics...
          </button>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBoardScreen;
