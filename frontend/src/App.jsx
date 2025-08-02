import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Sparkles, 
  Users, 
  Zap, 
  Shield,
  ChevronRight,
  Globe
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import toast, { Toaster } from 'react-hot-toast';
import ChatInterface from './components/ChatInterface';
import { workspaceAPI } from './utils/api';

// Beautiful loading component
const LoadingSpinner = () => (
  <motion.div
    className="flex-center space-x-2"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="loading-dots">
      <div className="loading-dot bg-primary-500"></div>
      <div className="loading-dot bg-primary-600"></div>
      <div className="loading-dot bg-primary-700"></div>
    </div>
    <span className="text-gray-600 dark:text-gray-400 font-medium ml-3">
      Loading...
    </span>
  </motion.div>
);

// Stunning hero section
const HeroSection = ({ onSignIn, isLoading }) => (
  <div className="min-h-screen bg-gradient-light dark:bg-gradient-dark flex-center p-4">
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
          className="flex-center mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-xl opacity-60 animate-pulse-glow"></div>
            <div className="relative bg-white dark:bg-dark-900 p-4 rounded-2xl shadow-soft-lg">
              <MessageCircle className="w-12 h-12 text-primary-600" />
            </div>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          className="text-6xl md:text-8xl font-black mb-6 text-balance"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <span className="text-gradient-primary">Chat</span>
          <span className="text-gray-900 dark:text-white">Flow</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto text-balance"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          The world's most advanced team communication platform. 
          <br />
          Built for the future of work.
        </motion.p>

        {/* Feature highlights */}
        <motion.div
          className="flex flex-wrap justify-center gap-6 mb-12"
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
              className="flex items-center space-x-2 glass-light px-4 py-2 rounded-full"
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ duration: 0.2 }}
            >
              <feature.icon className="w-5 h-5 text-primary-600" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {feature.text}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <motion.button
            className="btn-primary btn-lg px-12 py-4 text-xl font-bold group relative overflow-hidden"
            onClick={onSignIn}
            disabled={isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            />
            <span className="relative flex items-center space-x-3">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>Get Started with Google</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
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
        className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
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
            className="card-glass p-6 text-center group"
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="flex-center mb-4">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors duration-300">
                <feature.icon className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {feature.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </div>
);

// Beautiful workspace selection screen
const WorkspaceScreen = ({ user, onSignOut, onSelectWorkspace }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await workspaceAPI.getWorkspaces();
      setWorkspaces(response.data.workspaces || []);
    } catch (error) {
      console.error('Load workspaces error:', error);
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }

    setCreating(true);
    try {
      const response = await workspaceAPI.createWorkspace({
        name: newWorkspaceName,
        description: newWorkspaceDescription,
      });
      toast.success('Workspace created successfully!');
      setWorkspaces([...workspaces, response.data]);
      setShowCreateForm(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
    } catch (error) {
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-light dark:bg-gradient-dark flex-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-gradient-primary rounded-2xl animate-pulse-glow"></div>
              <div className="relative bg-white dark:bg-dark-900 p-4 rounded-2xl shadow-soft-lg">
                <MessageCircle className="w-12 h-12 text-primary-600" />
              </div>
            </div>
          </div>
          <LoadingSpinner />
          <p className="text-gray-600 dark:text-gray-400 mt-4">
            Loading your workspaces...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-light dark:bg-gradient-dark">
      {/* Header */}
      <motion.header
        className="glass border-b border-gray-200/50 dark:border-dark-700/50 px-6 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto flex-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary rounded-xl blur-md opacity-60"></div>
              <div className="relative bg-white dark:bg-dark-900 p-2 rounded-xl shadow-soft">
                <MessageCircle className="w-8 h-8 text-primary-600" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient-primary">ChatFlow</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Welcome back, {user.displayName}!
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <img 
              src={user.photoURL} 
              alt={user.displayName}
              className="avatar-md"
            />
            <button
              onClick={onSignOut}
              className="btn-ghost btn-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto p-6">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Choose Your Workspace
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Select a workspace to start collaborating with your team
          </p>
        </motion.div>

        {/* Workspaces grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {workspaces.map((workspace, index) => (
            <motion.div
              key={workspace.id}
              className="card-hover p-6 cursor-pointer group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectWorkspace(workspace)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {workspace.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                    {workspace.description || 'No description'}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{workspace.member_count || 0} members</span>
                    </span>
                    {workspace.user_role === 'owner' && (
                      <span className="bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-full text-xs font-medium">
                        Owner
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </motion.div>
          ))}

          {/* Create new workspace card */}
          <motion.div
            className="card-hover p-6 cursor-pointer group border-2 border-dashed border-gray-300 dark:border-dark-600 hover:border-primary-500 dark:hover:border-primary-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateForm(true)}
          >
            <div className="text-center py-8">
              {showCreateForm ? (
                <div className="text-left">
                  <input
                    type="text"
                    placeholder="Workspace name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="input mb-3 text-sm"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    className="input mb-3 text-sm"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewWorkspaceName('');
                        setNewWorkspaceDescription('');
                      }}
                      className="btn-ghost btn-sm flex-1"
                      disabled={creating}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateWorkspace}
                      className="btn-primary btn-sm flex-1"
                      disabled={creating || !newWorkspaceName.trim()}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-center mb-4">
                    <div className="p-3 bg-gray-100 dark:bg-dark-800 rounded-xl group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors duration-300">
                      <Sparkles className="w-8 h-8 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 transition-colors duration-300" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Create New Workspace
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Start a new workspace for your team
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
};

// Main App component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      toast.success(`Welcome, ${result.user.displayName}! 🎉`);
    } catch (error) {
      console.error("Error signing in with Google", error);
      toast.error("Failed to sign in. Please try again.");
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out", error);
      toast.error("Failed to sign out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-light dark:bg-gradient-dark flex-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <LoadingSpinner />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <HeroSection onSignIn={signInWithGoogle} isLoading={authLoading} />
          </motion.div>
        ) : selectedWorkspace ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ChatInterface 
              user={user} 
              workspace={selectedWorkspace} 
              onSignOut={handleSignOut} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <WorkspaceScreen 
              user={user} 
              onSignOut={handleSignOut} 
              onSelectWorkspace={setSelectedWorkspace}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: 'glass',
          style: {
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }
        }}
      />
    </div>
  );
}

export default App;
