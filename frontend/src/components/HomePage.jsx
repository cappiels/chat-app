import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Sparkles, 
  Users, 
  Zap, 
  Shield,
  ChevronRight,
  Globe
} from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-6xl mx-auto">
        {/* Main hero content */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Logo and branding */}
          <motion.div
            className="flex items-center justify-center mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-60 animate-pulse"></div>
              <div className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-lg">
                <MessageCircle className="w-12 h-12 text-blue-600" />
              </div>
            </div>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 sm:mb-6 text-balance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Chat
            </span>
            <span className="text-gray-900 dark:text-white">Flow</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-2xl sm:max-w-3xl mx-auto text-balance px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            The world's most advanced team communication platform. 
            <br className="hidden sm:block" />
            Built for the future of work.
          </motion.p>

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
          <motion.div
            className="px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <motion.button
              className="btn btn-primary px-6 sm:px-8 md:px-12 py-3 sm:py-4 text-lg sm:text-xl font-bold rounded-xl shadow-lg group relative overflow-hidden w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none'
              }}
              onClick={onSignIn}
              disabled={isLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative flex items-center justify-center space-x-2 sm:space-x-3">
                {isLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="hidden sm:inline">Login with Google</span>
                    <span className="sm:hidden">Login with Google</span>
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </>
                )}
              </span>
            </motion.button>
          </motion.div>

          {/* Trust indicators */}
          <motion.p
            className="text-sm text-gray-500 dark:text-gray-400 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            Trusted by over 10,000+ teams worldwide • Enterprise-grade security • 99.9% uptime
          </motion.p>
        </motion.div>

        {/* Feature showcase */}
        <motion.div
          className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto px-4"
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
              title: "Smart Workspaces", 
              description: "Organize your team with channels, direct messages, and powerful search",
              icon: Users,
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
    </div>
  );
};

export default HomePage;
