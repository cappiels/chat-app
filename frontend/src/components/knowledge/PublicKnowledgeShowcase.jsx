import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  TrendingUp, 
  Star, 
  Eye, 
  Clock, 
  Users,
  ArrowRight,
  Globe,
  Sparkles,
  MessageCircle,
  Tag
} from 'lucide-react';

const PublicKnowledgeShowcase = ({ showPublicContent = false }) => {
  const [featuredKnowledge] = useState([
    {
      id: 1,
      title: "Modern Team Communication Best Practices",
      content: "Learn how leading organizations structure their team communication for maximum efficiency and collaboration...",
      category: { name: "Best Practices", color: "#3B82F6" },
      views_count: 2847,
      created_at: "2024-01-15",
      created_by_name: "crew Team",
      created_by_avatar: null,
      tags: [{ name: "communication" }, { name: "productivity" }, { name: "teamwork" }],
      is_featured: true,
      scope_name: "Public"
    },
    {
      id: 2,
      title: "Building Effective Knowledge Bases",
      content: "A comprehensive guide to creating, organizing, and maintaining knowledge that scales with your organization...",
      category: { name: "Knowledge Management", color: "#8B5CF6" },
      views_count: 1923,
      created_at: "2024-01-12",
      created_by_name: "Sarah Chen",
      created_by_avatar: null,
      tags: [{ name: "knowledge" }, { name: "organization" }, { name: "scaling" }],
      is_featured: true,
      scope_name: "Public"
    },
    {
      id: 3,
      title: "Remote Team Collaboration Strategies",
      content: "Proven strategies for maintaining strong collaboration and culture in distributed teams across time zones...",
      category: { name: "Remote Work", color: "#10B981" },
      views_count: 3156,
      created_at: "2024-01-10",
      created_by_name: "Alex Rodriguez",
      created_by_avatar: null,
      tags: [{ name: "remote" }, { name: "collaboration" }, { name: "culture" }],
      is_featured: true,
      scope_name: "Public"
    }
  ]);

  const [trendingStats] = useState([
    { label: "Knowledge Articles", value: "15,000+", icon: BookOpen },
    { label: "Active Contributors", value: "2,500+", icon: Users },
    { label: "Monthly Views", value: "500K+", icon: Eye },
    { label: "Organizations", value: "1,000+", icon: Globe }
  ]);

  const PublicKnowledgeCard = ({ item, featured = false }) => (
    <motion.div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group cursor-pointer ${
        featured ? 'lg:col-span-2' : ''
      }`}
      whileHover={{ y: -4, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {item.category && (
              <span 
                className="inline-flex px-3 py-1 text-sm font-medium rounded-full"
                style={{ 
                  backgroundColor: item.category.color + '20', 
                  color: item.category.color 
                }}
              >
                {item.category.name}
              </span>
            )}
            {item.is_featured && (
              <div className="flex items-center space-x-1 text-yellow-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-xs font-medium">Featured</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 text-gray-500 text-sm">
            <Eye className="w-4 h-4" />
            <span>{item.views_count?.toLocaleString()}</span>
          </div>
        </div>

        <h3 className={`font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 transition-colors ${
          featured ? 'text-xl sm:text-2xl' : 'text-lg'
        }`}>
          {item.title}
        </h3>
        
        <p className={`text-gray-600 dark:text-gray-400 mb-4 leading-relaxed ${
          featured ? 'text-base' : 'text-sm'
        }`}>
          {item.content}
        </p>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {item.tags.slice(0, featured ? 4 : 3).map((tag, index) => (
              <span key={index} className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                <Tag className="w-3 h-3 mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {item.created_by_avatar ? (
              <img 
                src={item.created_by_avatar} 
                alt={item.created_by_name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-semibold">
                  {item.created_by_name?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.created_by_name}</p>
              <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 px-2 py-1 rounded-full">
              {item.scope_name}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-900/10 dark:to-purple-900/10 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-40 animate-pulse"></div>
              <div className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-lg">
                <BookOpen className="w-12 h-12 text-blue-600" />
              </div>
            </div>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-black mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Knowledge
            </span>
            <span className="text-gray-900 dark:text-white"> Hub</span>
          </h2>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Discover insights, best practices, and collective wisdom from teams around the world. 
            {showPublicContent ? 
              ' Contribute to the largest repository of modern workplace knowledge.' : 
              ' Join thousands of organizations already building their knowledge base.'
            }
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {trendingStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl mb-3">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Featured Knowledge Section */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-yellow-500" />
                Featured Knowledge
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {showPublicContent ? 
                  'Curated insights from our community of experts and practitioners' :
                  'See what knowledge looks like in action'
                }
              </p>
            </div>
            {showPublicContent && (
              <motion.button
                className="hidden sm:flex items-center space-x-2 bg-white dark:bg-gray-800 text-blue-600 px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Explore All</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {featuredKnowledge.map((item, index) => (
              <PublicKnowledgeCard 
                key={item.id} 
                item={item} 
                featured={index === 0}
              />
            ))}
          </div>
        </motion.div>

        {/* Call to Action */}
        {!showPublicContent && (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 sm:p-12 text-white">
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">
                Ready to build your knowledge base?
              </h3>
              <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto">
                Transform your team's conversations into valuable, searchable knowledge. 
                Start capturing insights from day one.
              </p>
              <motion.button
                className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all duration-200 inline-flex items-center space-x-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles className="w-5 h-5" />
                <span>Start Building Knowledge</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Browse Categories */}
        {showPublicContent && (
          <motion.div
            className="mt-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Browse by Category
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { name: "Best Practices", color: "#3B82F6", count: 234 },
                { name: "Remote Work", color: "#10B981", count: 189 },
                { name: "Team Building", color: "#F59E0B", count: 156 },
                { name: "Productivity", color: "#8B5CF6", count: 298 },
                { name: "Leadership", color: "#EF4444", count: 134 },
                { name: "Technology", color: "#06B6D4", count: 267 }
              ].map((category, index) => (
                <motion.button
                  key={category.name}
                  className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-center group"
                  whileHover={{ y: -2, scale: 1.02 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <div 
                    className="w-8 h-8 rounded-lg mx-auto mb-2 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    <div 
                      className="w-4 h-4 rounded-full mx-auto transform translate-y-2"
                      style={{ backgroundColor: category.color }}
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {category.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {category.count} articles
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PublicKnowledgeShowcase;
