import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MessageSquare,
  Headphones,
  Bookmark,
  Send,
  Hash,
  Plus,
  User,
  Home,
  MessageCircle,
  Bell,
  MoreHorizontal,
  ChevronDown,
  Settings,
  LogOut
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';
import socketManager from '../utils/socket';
import { threadAPI, messageAPI } from '../utils/api';

// Slack-style Mobile Chat Interface
const ChatInterface = ({ user, workspace, onSignOut }) => {
  const [threads, setThreads] = useState([]);
  const [currentView, setCurrentView] = useState('home'); // 'home', 'dms', 'activity', 'more'
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize socket and load data
  useEffect(() => {
    socketManager.connect();
    socketManager.joinWorkspace(workspace.id);
    loadThreads();

    return () => {
      socketManager.disconnect();
    };
  }, [workspace.id]);

  const loadThreads = async () => {
    try {
      const response = await threadAPI.getThreads(workspace.id);
      setThreads(response.data);
    } catch (error) {
      toast.error('Failed to load channels');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      await threadAPI.createChannel(workspace.id, {
        name: newChannelName,
        is_private: false,
      });
      toast.success('Channel created successfully!');
      setShowCreateChannel(false);
      setNewChannelName('');
      loadThreads();
    } catch (error) {
      toast.error('Failed to create channel');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onSignOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const channels = threads.filter(t => t.type === 'channel');
  const directMessages = threads.filter(t => t.type === 'dm');

  // Slack-style Home View
  const HomeView = () => (
    <div className="flex-1 bg-white overflow-y-auto">
      {/* Header */}
      <div className="bg-purple-600 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold">{workspace.name}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-8 h-8 rounded-full border-2 border-white/30"
            />
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
          <input
            type="text"
            placeholder="Jump to or search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/20 text-white placeholder-white/60 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:bg-white/30"
          />
          <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <MoreHorizontal className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="bg-gray-50 rounded-xl p-4 flex flex-col items-center"
          >
            <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
            <span className="font-semibold text-gray-900">Threads</span>
            <span className="text-sm text-gray-500">0 new</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.98 }}
            className="bg-gray-50 rounded-xl p-4 flex flex-col items-center"
          >
            <Headphones className="w-8 h-8 text-gray-600 mb-2" />
            <span className="font-semibold text-gray-900">Huddles</span>
            <span className="text-sm text-gray-500">0 live</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.98 }}
            className="bg-gray-50 rounded-xl p-4 flex flex-col items-center"
          >
            <Bookmark className="w-8 h-8 text-gray-600 mb-2" />
            <span className="font-semibold text-gray-900">Later</span>
            <span className="text-sm text-gray-500">0 items</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.98 }}
            className="bg-gray-50 rounded-xl p-4 flex flex-col items-center"
          >
            <Send className="w-8 h-8 text-gray-600 mb-2" />
            <span className="font-semibold text-gray-900">Drafts & Sent</span>
            <span className="text-sm text-gray-500">0 items</span>
          </motion.div>
        </div>

        {/* Channels Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Channels</h2>
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </div>

          <div className="space-y-2">
            {channels.map((channel) => (
              <motion.div
                key={channel.id}
                whileTap={{ scale: 0.98 }}
                className="flex items-center space-x-3 py-2"
              >
                <Hash className="w-5 h-5 text-gray-500" />
                <span className="text-gray-900 font-medium">{channel.name}</span>
              </motion.div>
            ))}

            {/* Add Channel */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateChannel(true)}
              className="flex items-center space-x-3 py-2 cursor-pointer"
            >
              <Plus className="w-5 h-5 text-gray-500" />
              <span className="text-gray-600">Add channel</span>
            </motion.div>
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Direct Messages</h2>
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </div>

          <div className="space-y-2">
            {/* Current User */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center space-x-3 py-2"
            >
              <div className="relative">
                <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              </div>
              <span className="text-gray-900 font-medium">{user.displayName} (you)</span>
            </motion.div>

            {/* Other DMs */}
            {directMessages.map((dm) => (
              <motion.div
                key={dm.id}
                whileTap={{ scale: 0.98 }}
                className="flex items-center space-x-3 py-2"
              >
                <img
                  src={dm.other_user?.photo_url || `https://ui-avatars.com/api/?name=${dm.other_user?.display_name}`}
                  alt={dm.other_user?.display_name}
                  className="w-6 h-6 rounded"
                />
                <span className="text-gray-900 font-medium">{dm.other_user?.display_name}</span>
              </motion.div>
            ))}

            {/* Start New Message */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center space-x-3 py-2 cursor-pointer"
            >
              <Plus className="w-5 h-5 text-gray-500" />
              <span className="text-gray-600">Start a new message</span>
            </motion.div>
          </div>
        </div>

        {/* Apps Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Apps</h2>
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </div>

          <div className="space-y-2">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center space-x-3 py-2"
            >
              <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-900 font-medium">Slackbot</span>
            </motion.div>
          </div>
        </div>

        {/* Add Teammates */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="flex items-center space-x-3 py-4 cursor-pointer"
        >
          <Plus className="w-5 h-5 text-gray-500" />
          <span className="text-gray-900 font-medium">Add teammates</span>
        </motion.div>

        {/* Floating Action Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="fixed bottom-20 right-6 w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center shadow-lg"
        >
          <Plus className="w-6 h-6 text-white" />
        </motion.button>
      </div>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {showCreateChannel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-sm"
            >
              <h3 className="text-lg font-bold mb-4">Create Channel</h3>
              <input
                type="text"
                placeholder="Channel name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-purple-500"
                autoFocus
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateChannel(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateChannel}
                  className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg font-medium"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // DMs View (placeholder)
  const DMsView = () => (
    <div className="flex-1 bg-white flex items-center justify-center">
      <div className="text-center">
        <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Direct Messages</p>
      </div>
    </div>
  );

  // Activity View (placeholder)
  const ActivityView = () => (
    <div className="flex-1 bg-white flex items-center justify-center">
      <div className="text-center">
        <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Activity</p>
      </div>
    </div>
  );

  // More View with settings
  const MoreView = () => (
    <div className="flex-1 bg-white">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">More</h1>
        
        <div className="space-y-4">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="flex items-center space-x-3 py-3"
          >
            <Settings className="w-6 h-6 text-gray-600" />
            <span className="text-gray-900 font-medium">Settings</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={handleSignOut}
            className="flex items-center space-x-3 py-3 cursor-pointer"
          >
            <LogOut className="w-6 h-6 text-red-600" />
            <span className="text-red-600 font-medium">Sign Out</span>
          </motion.div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Main Content */}
      {currentView === 'home' && <HomeView />}
      {currentView === 'dms' && <DMsView />}
      {currentView === 'activity' && <ActivityView />}
      {currentView === 'more' && <MoreView />}

      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentView('home')}
            className={`flex flex-col items-center py-2 px-3 ${
              currentView === 'home' ? 'text-purple-600' : 'text-gray-500'
            }`}
          >
            <Home className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Home</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentView('dms')}
            className={`flex flex-col items-center py-2 px-3 ${
              currentView === 'dms' ? 'text-purple-600' : 'text-gray-500'
            }`}
          >
            <MessageCircle className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">DMs</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentView('activity')}
            className={`flex flex-col items-center py-2 px-3 ${
              currentView === 'activity' ? 'text-purple-600' : 'text-gray-500'
            }`}
          >
            <Bell className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Activity</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentView('more')}
            className={`flex flex-col items-center py-2 px-3 ${
              currentView === 'more' ? 'text-purple-600' : 'text-gray-500'
            }`}
          >
            <MoreHorizontal className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">More</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
