import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  BookOpen, 
  TrendingUp, 
  Star, 
  Clock, 
  Users, 
  Tag,
  Filter,
  Grid,
  List,
  Eye,
  Bookmark,
  MessageCircle,
  Sparkles,
  ChevronRight,
  Globe,
  Lock
} from 'lucide-react';
import { knowledgeAPI } from '../../utils/api';

const KnowledgeDashboard = ({ workspaceId, currentUser }) => {
  const [featuredKnowledge, setFeaturedKnowledge] = useState([]);
  const [trendingKnowledge, setTrendingKnowledge] = useState([]);
  const [recentKnowledge, setRecentKnowledge] = useState([]);
  const [myKnowledge, setMyKnowledge] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [selectedScope, setSelectedScope] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadKnowledgeData();
  }, [workspaceId]);

  const loadKnowledgeData = async () => {
    try {
      setIsLoading(true);
      const [featured, trending, recent, mine, cats] = await Promise.all([
        knowledgeAPI.getKnowledgeItems(workspaceId, { featured: true, limit: 6 }),
        knowledgeAPI.getKnowledgeItems(workspaceId, { trending: true, limit: 8 }),
        knowledgeAPI.getKnowledgeItems(workspaceId, { recent: true, limit: 10 }),
        knowledgeAPI.getKnowledgeItems(workspaceId, { created_by: currentUser.uid, limit: 8 }),
        knowledgeAPI.getCategories(workspaceId)
      ]);

      setFeaturedKnowledge(featured.data?.items || []);
      setTrendingKnowledge(trending.data?.items || []);
      setRecentKnowledge(recent.data?.items || []);
      setMyKnowledge(mine.data?.items || []);
      setCategories(cats.data || []);
    } catch (error) {
      console.error('Error loading knowledge data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const KnowledgeCard = ({ item, featured = false }) => (
    <motion.div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200 dark:border-gray-700 group cursor-pointer ${
        featured ? 'md:col-span-2' : ''
      }`}
      whileHover={{ y: -2 }}
      onClick={() => {/* Navigate to knowledge item */}}
    >
      {/* Knowledge Item Header */}
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {item.category && (
              <span 
                className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                style={{ 
                  backgroundColor: item.category.color + '20', 
                  color: item.category.color 
                }}
              >
                {item.category.name}
              </span>
            )}
            {item.is_featured && (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            )}
            {item.source_type === 'message' && (
              <MessageCircle className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <div className="flex items-center space-x-2 text-gray-500 text-sm">
            <Eye className="w-4 h-4" />
            <span>{item.views_count || 0}</span>
          </div>
        </div>

        <h3 className={`font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors ${
          featured ? 'text-lg sm:text-xl' : 'text-base'
        }`}>
          {item.title}
        </h3>
        
        <p className={`text-gray-600 dark:text-gray-400 mb-4 ${
          featured ? 'text-base' : 'text-sm'
        }`}>
          {item.ai_summary || item.content.substring(0, featured ? 200 : 120) + '...'}
        </p>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.tags.slice(0, featured ? 4 : 3).map((tag, index) => (
              <span key={index} className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                <Tag className="w-3 h-3 mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <img 
                src={item.created_by_avatar} 
                alt={item.created_by_name}
                className="w-5 h-5 rounded-full"
              />
              <span>{item.created_by_name}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="hover:text-yellow-500 transition-colors">
              <Bookmark className="w-4 h-4" />
            </button>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {item.scope_name}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const SectionHeader = ({ title, description, action, icon: Icon }) => (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon className="w-6 h-6 text-blue-600" />
          {title}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
      </div>
      {action}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          className="flex flex-col items-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading knowledge base...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Search & Filter Header */}
      <motion.div
        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
            <p className="text-blue-100">Discover, learn, and contribute to your team's collective intelligence</p>
          </div>
          <div className="flex items-center space-x-3">
            <motion.button
              className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-white hover:bg-white/30 transition-colors flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Insights</span>
            </motion.button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white hover:bg-white/30 transition-colors"
            >
              {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
            </button>
            <button className="p-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white hover:bg-white/30 transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: 'Total Knowledge', value: '1,234', icon: BookOpen, color: 'blue' },
          { label: 'This Week', value: '47', icon: TrendingUp, color: 'green' },
          { label: 'My Contributions', value: '23', icon: Users, color: 'purple' },
          { label: 'Bookmarked', value: '89', icon: Bookmark, color: 'yellow' }
        ].map((stat, index) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
              <div className={`p-2 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/20`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Featured Knowledge */}
      {featuredKnowledge.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SectionHeader
            title="Featured Knowledge"
            description="Curated insights and essential information for your team"
            icon={Star}
            action={
              <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredKnowledge.map((item, index) => (
              <KnowledgeCard key={item.id} item={item} featured={index === 0} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Trending & Recent Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Trending Knowledge */}
        <motion.section
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <SectionHeader
            title="Trending Now"
            description="Most viewed and discussed knowledge this week"
            icon={TrendingUp}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trendingKnowledge.map((item) => (
              <KnowledgeCard key={item.id} item={item} />
            ))}
          </div>
        </motion.section>

        {/* Sidebar */}
        <motion.aside
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {/* Categories */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Categories
            </h3>
            <div className="space-y-2">
              {categories.slice(0, 8).map((category) => (
                <button
                  key={category.id}
                  className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{category.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {category.item_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {recentKnowledge.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start space-x-3">
                  <img 
                    src={item.created_by_avatar} 
                    alt={item.created_by_name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      by {item.created_by_name} • {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
};

export default KnowledgeDashboard;
