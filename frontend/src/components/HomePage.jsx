import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Sparkles, 
  Users, 
  Zap, 
  Shield,
  ChevronRight,
  Globe,
  BookOpen,
  Brain,
  TrendingUp,
  Star
} from 'lucide-react';
import PublicKnowledgeShowcase from './knowledge/PublicKnowledgeShowcase';
import { getVersionString } from '../utils/version';

// Beautiful loading component
const LoadingSpinner = ({ message = "Loading...", showProgress = false }) => (
  <motion.div
    className="flex-center flex-col space-y-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="loading-dots">
      <div className="loading-dot bg-blue-500"></div>
      <div className="loading-dot bg-blue-600"></div>
      <div className="loading-dot bg-blue-700"></div>
    </div>
    <span className="text-gray-600 dark:text-gray-400 font-medium">
      {message}
    </span>
    {showProgress && (
      <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <motion.div
          className="bg-blue-600 h-1.5 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />
      </div>
    )}
  </motion.div>
);

// Homepage Component
const HomePage = ({ onSignIn, isLoading = false }) => {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16 flex flex-col justify-center min-h-screen">
        {/* Main hero content */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Logo and branding */}
          <div className="flex items-center justify-center mb-12">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <MessageCircle className="w-8 h-8 text-gray-700" />
            </div>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl font-semibold mb-6 text-gray-900">
            ChatFlow
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
            Professional team communication platform.
            <br />
            Simple, powerful, and secure.
          </p>

          {/* Feature highlights */}
          <motion.div
            className="flex flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10 md:mb-12 px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            {[
              { icon: Zap, text: "Lightning Fast" },
              { icon: Shield, text: "Enterprise Security" },
              { icon: Users, text: "Team Collaboration" },
              { icon: Globe, text: "Global Scale" }
            ].map((feature, index) => (
              <motion.div
                key={feature.text}
                className="flex items-center space-x-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full text-sm sm:text-base border border-white/20"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <span className="text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                  {feature.text}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Button */}
          <div className="mb-8">
            <button
              className="inline-flex items-center gap-3 px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="loading-spinner"></div>
              ) : (
                <>
                  <span>Continue with Google</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Trust indicators */}
          <motion.div
            className="text-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trusted by over 10,000+ teams worldwide • Enterprise-grade security • 99.9% uptime
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {getVersionString()} • Advanced Knowledge Management System
            </p>
          </motion.div>
        </motion.div>

        {/* Feature showcase */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl mx-auto px-4"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          {[
            {
              title: "Real-time Messaging",
              description: "Instant messaging with typing indicators, reactions, and file sharing",
              icon: MessageCircle,
            },
            {
              title: "Smart Knowledge Base", 
              description: "Save to multiple locations, organize with categories, and find knowledge instantly with AI-powered bookmarks",
              icon: BookOpen,
            },
            {
              title: "Multi-Location Bookmarks",
              description: "Save messages to personal bookmarks and multiple knowledge bases simultaneously",
              icon: Star,
            },
            {
              title: "Enterprise Ready",
              description: "Advanced security, admin controls, and compliance features",
              icon: Shield,
            }
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-4 sm:p-6 rounded-2xl text-center group border border-white/20 shadow-lg"
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center justify-center mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors duration-300">
                  <feature.icon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Knowledge Base Showcase */}
      <PublicKnowledgeShowcase showPublicContent={false} />
    </div>
  );
};

export default HomePage;
