import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Sparkles, 
  Users, 
  Search,
  ChevronRight,
  Settings,
  MoreVertical,
  Archive,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { workspaceAPI } from '../utils/api';
import toast from 'react-hot-toast';

// Beautiful workspace selection screen
const WorkspaceScreen = ({ user, onSignOut, onSelectWorkspace }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest('.workspace-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const loadWorkspaces = async () => {
    // Add timeout to prevent hanging on API calls
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API timeout')), 8000)
    );

    try {
      const response = await Promise.race([
        workspaceAPI.getWorkspaces(),
        timeoutPromise
      ]);
      
      // Enhanced workspace data with mock statistics for better UX
      const enhancedWorkspaces = (response.data.workspaces || []).map(workspace => ({
        ...workspace,
        // Add mock data for demonstration - in real app this would come from API
        conversations: Math.floor(Math.random() * 200) + 50,
        knowledgeBase: Math.floor(Math.random() * 100) + 20,
        lastActivity: getRandomLastActivity(),
        color: getWorkspaceColor(workspace.name)
      }));
      setWorkspaces(enhancedWorkspaces);
    } catch (error) {
      console.error('Load workspaces error:', error);
      if (error.message === 'API timeout') {
        toast.error('Loading workspaces is taking longer than expected. Please check your connection.');
      } else {
        toast.error('Failed to load workspaces');
      }
      // Even on error, stop loading so user can see the page
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  const getRandomLastActivity = () => {
    const activities = ['2 hours ago', '1 day ago', '30 minutes ago', '3 hours ago', '1 week ago'];
    return activities[Math.floor(Math.random() * activities.length)];
  };

  const getWorkspaceColor = (name) => {
    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'];
    return colors[name.length % colors.length];
  };

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (workspace.description && workspace.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }

    setCreating(true);
    try {
      const response = await workspaceAPI.createWorkspace({
        name: newWorkspaceName,
        description: newWorkspaceDescription
      });
      const newWorkspace = {
        ...response.data.workspace,
        conversations: 0,
        knowledgeBase: 0,
        lastActivity: 'Just created',
        color: getWorkspaceColor(newWorkspaceName)
      };
      toast.success('Workspace created successfully!');
      setWorkspaces([...workspaces, newWorkspace]);
      setShowCreateForm(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
    } catch (error) {
      console.error('Create workspace error:', error);
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkspace = async (workspace) => {
    const confirmText = `Type "${workspace.name}" to confirm deletion:`;
    const userInput = window.prompt(
      `⚠️ This will delete "${workspace.name}" and make it inaccessible to all members.\n\nThe workspace will be permanently removed after 90 days.\n\n${confirmText}`
    );
    
    if (userInput !== workspace.name) {
      if (userInput !== null) { // User didn't cancel
        toast.error('Workspace name does not match. Deletion cancelled.');
      }
      return;
    }
    
    try {
      console.log('Attempting to delete workspace:', workspace.id);
      console.log('Current user:', user);
      console.log('Workspace owner_user_id:', workspace.owner_user_id);
      console.log('User ID comparison:', workspace.owner_user_id === user?.id);
      
      // Call archive API instead of delete - this is now a "soft delete"
      await workspaceAPI.archiveWorkspace(workspace.id);
      toast.success('Workspace deleted successfully (archived for 90 days)');
      setWorkspaces(workspaces.filter(w => w.id !== workspace.id));
    } catch (error) {
      console.error('Delete workspace error:', error);
      
      // More specific error handling
      if (error.response) {
        const { status, data } = error.response;
        console.error('Error response:', status, data);
        
        if (status === 403) {
          toast.error('Only the workspace owner can delete this workspace');
        } else if (status === 404) {
          toast.error('Workspace not found');
        } else if (status === 401) {
          toast.error('Authentication failed. Please sign in again.');
        } else {
          toast.error(data?.message || 'Failed to delete workspace');
        }
      } else if (error.request) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error('An unexpected error occurred');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl animate-pulse"></div>
              <div className="relative bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-lg">
                <MessageCircle className="w-12 h-12 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="loading-dots mb-4">
            <div className="loading-dot bg-blue-500"></div>
            <div className="loading-dot bg-blue-600"></div>
            <div className="loading-dot bg-blue-700"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">
            Loading your workspaces...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <motion.header
        className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 px-6 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-md opacity-60"></div>
              <div className="relative bg-white dark:bg-gray-900 p-2 rounded-xl shadow-lg">
                <MessageCircle className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Chat
                </span>
                <span className="text-gray-900 dark:text-white">Flow</span>
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Welcome back, {user.displayName}!
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <img 
              src={user.photoURL} 
              alt={user.displayName}
              className="w-10 h-10 rounded-full shadow-lg"
            />
            <button
              onClick={onSignOut}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <motion.div
          className="mb-6 sm:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Choose Your Workspace
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg mb-6 sm:mb-8">
            Select a workspace to start collaborating with your team, access your knowledge base, and manage conversations
          </p>

          {/* Search Bar */}
          <div className="relative max-w-md mx-auto mb-6 sm:mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </motion.div>

        {/* Workspaces grid */}
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {filteredWorkspaces.map((workspace, index) => (
            <motion.div
              key={workspace.id}
              className={`bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/20 group hover:shadow-xl transition-all duration-300 relative overflow-hidden ${openMenuId === workspace.id ? 'z-50' : 'z-10'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              {/* Workspace Card Content - Clickable area */}
              <div 
                className="cursor-pointer pr-12"
                onClick={() => onSelectWorkspace(workspace)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 truncate">
                      {workspace.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                      {workspace.description || 'No description'}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{workspace.member_count || 0} member{(workspace.member_count || 0) === 1 ? '' : 's'}</span>
                      </span>
                      {workspace.role === 'admin' && (
                        <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                          Admin
                        </span>
                      )}
                      {workspace.owner_user_id === user?.id && (
                        <span className="bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200 ml-2" />
                </div>
              </div>

              {/* Workspace Options Menu - Fixed positioning */}
              <div className="absolute top-4 right-4 z-20">
                <div className="relative workspace-menu">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === workspace.id ? null : workspace.id);
                    }}
                    className="p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm opacity-70 hover:opacity-100 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all shadow-sm border border-gray-200/50 dark:border-gray-600/50"
                    title="Workspace options"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  {/* Dropdown Menu - Fixed z-index and positioning */}
                  {openMenuId === workspace.id && (
                    <div 
                      className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden"
                    >
                      <div className="py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            toast.info('Workspace settings coming soon!');
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </button>
                        
                        {workspace.owner_user_id === user?.id && (
                          <>
                            <hr className="my-1 border-gray-200 dark:border-gray-700" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleDeleteWorkspace(workspace);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Create new workspace card */}
          <motion.div
            className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm p-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer group transition-all duration-300"
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
                    className="w-full p-3 mb-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    className="w-full p-3 mb-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreateForm(false);
                        setNewWorkspaceName('');
                        setNewWorkspaceDescription('');
                      }}
                      className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                      disabled={creating}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateWorkspace();
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                      disabled={creating || !newWorkspaceName.trim()}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors duration-300">
                      <Sparkles className="w-8 h-8 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 transition-colors duration-300" />
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

export default WorkspaceScreen;
