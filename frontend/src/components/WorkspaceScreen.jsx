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
  AlertTriangle,
  Crown,
  CheckSquare,
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { workspaceAPI, globalTasksAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { logAbsoluteTiming, logTiming } from '../utils/timing.js';
import WorkspaceSettingsDialog from './WorkspaceSettingsDialog';
import { getVersionString } from '../utils/version';
import { useSubscription } from '../contexts/SubscriptionContext';
import SubscriptionGate from './subscription/SubscriptionGate';
import AdminWorkspaceTabs from './admin/AdminWorkspaceTabs';
import { auth } from '../firebase';

// Todoist-style Task Item Component
const TaskItem = ({ task, workspaces, onSelectWorkspace, onToggleComplete, getPriorityColor, formatTaskDate, isOverdue }) => {
  const isCompleted = task.status === 'completed' || task.user_completed;
  const workspace = workspaces.find(w => w.id === task.workspace_id);
  
  // Priority ring colors
  const getPriorityRing = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-500 hover:bg-red-50';
      case 'medium': return 'border-yellow-500 hover:bg-yellow-50';
      case 'low': return 'border-green-500 hover:bg-green-50';
      default: return 'border-gray-300 hover:bg-gray-50';
    }
  };

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors group">
      {/* Clickable Checkbox */}
      <button
        onClick={() => onToggleComplete(task)}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          isCompleted 
            ? 'bg-green-500 border-green-500' 
            : getPriorityRing(task.priority)
        }`}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted && (
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
        )}
      </button>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* Task Title */}
            <h4 className={`text-sm font-medium leading-tight ${
              isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}>
              {task.title}
            </h4>
            
            {/* Task Metadata - Channel Navigation */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {/* Workspace Badge */}
              <button
                onClick={() => workspace && onSelectWorkspace(workspace)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-600 transition-colors"
                title={`Go to ${task.workspace_name}`}
              >
                <MessageCircle className="w-3 h-3" />
                {task.workspace_name}
              </button>
              
              {/* Channel Link */}
              <button
                onClick={() => workspace && onSelectWorkspace(workspace)}
                className="inline-flex items-center gap-1 px-2 py-0.5 hover:bg-blue-50 rounded text-xs text-blue-600 hover:text-blue-700 transition-colors"
                title={`Go to #${task.channel_name} to add a note`}
              >
                <span className="text-blue-400">#</span>
                {task.channel_name}
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Multi-assignee progress */}
              {task.progress_info && task.total_assignees > 1 && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {task.progress_info}
                </span>
              )}
            </div>
          </div>

          {/* Due Date Badge */}
          {(task.due_date || task.end_date) && !isCompleted && (
            <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              isOverdue(task)
                ? 'bg-red-100 text-red-700'
                : 'text-gray-500'
            }`}>
              <Calendar className="w-3 h-3" />
              {formatTaskDate(task.due_date || task.end_date)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Beautiful workspace selection screen
const WorkspaceScreen = ({ user, onSignOut, onSelectWorkspace }) => {
  const { canCreateWorkspace, isSiteAdmin, getCurrentPlan, fetchSubscriptionStatus } = useSubscription();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSubscriptionGate, setShowSubscriptionGate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedWorkspaceForSettings, setSelectedWorkspaceForSettings] = useState(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showNewUserOnboarding, setShowNewUserOnboarding] = useState(false);
  
  // Task list state
  const [myTasks, setMyTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [taskFilter, setTaskFilter] = useState('pending'); // 'all', 'pending', 'completed', 'overdue'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'assigned', 'created'

  useEffect(() => {
    loadWorkspaces();
    loadMyTasks();
  }, []);

  // Check if this is a new user who needs onboarding
  useEffect(() => {
    if (!loading && workspaces.length === 0 && !canCreateWorkspace() && !isSiteAdmin()) {
      setShowNewUserOnboarding(true);
    }
  }, [loading, workspaces, canCreateWorkspace, isSiteAdmin]);

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
    const workspaceLoadStart = performance.now();
    logAbsoluteTiming('📊', 'WorkspaceScreen: Starting workspace load');
    
    // Reduced timeout from 8s to 4s for better UX
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API timeout')), 4000)
    );

    try {
      const apiCallStart = performance.now();
      const response = await Promise.race([
        workspaceAPI.getWorkspaces(),
        timeoutPromise
      ]);
      logTiming('🌐', 'WorkspaceScreen: API call completed', apiCallStart);
      
      const dataProcessStart = performance.now();
      // Use actual data from optimized backend API
      const workspaces = response.data.workspaces || [];
      
      // Only add UI enhancements, use real backend data for counts
      const enhancedWorkspaces = workspaces.map(workspace => ({
        ...workspace,
        // Use real member_count from backend, fallback to 1
        member_count: workspace.member_count || 1,
        // Add UI enhancements for better UX
        lastActivity: getRandomLastActivity(),
        color: getWorkspaceColor(workspace.name),
        // Keep real owner info from backend
        owner_user_id: workspace.owner_user_id
      }));
      
      logTiming('⚙️', 'WorkspaceScreen: Data processing completed', dataProcessStart);
      
      const setStateStart = performance.now();
      setWorkspaces(enhancedWorkspaces);
      logTiming('📝', 'WorkspaceScreen: State update completed', setStateStart);
      
      logTiming('⏱️', 'WorkspaceScreen: Total workspace load time', workspaceLoadStart);
      
    } catch (error) {
      const errorTime = performance.now();
      console.error('Load workspaces error:', error);
      logTiming('❌', 'WorkspaceScreen: Error occurred after', workspaceLoadStart, errorTime);
      
      if (error.message === 'API timeout') {
        toast.error('Connection is slow. Try refreshing the page.');
      } else if (error.response?.status === 504) {
        toast.error('Server is taking too long to respond. Please try again.');
      } else if (error.response?.status >= 500) {
        toast.error('Server error. Please try again in a moment.');
      } else {
        toast.error('Failed to load workspaces. Check your connection.');
      }
      // Even on error, stop loading so user can see the page
      setWorkspaces([]);
    } finally {
      const finalizeStart = performance.now();
      setLoading(false);
      logTiming('🏁', 'WorkspaceScreen: Loading state cleared', finalizeStart);
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

  // Load tasks assigned to OR created by current user
  const loadMyTasks = async () => {
    try {
      setTasksLoading(true);
      const response = await globalTasksAPI.getMyTasks({ limit: 100 });
      setMyTasks(response.data.tasks || []);
      console.log(`📋 Loaded ${response.data.tasks?.length || 0} tasks for My Tasks section`);
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Don't show error toast - tasks are secondary to workspaces
      setMyTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  // Filter tasks based on current filters (status + role)
  const getFilteredTasks = () => {
    const now = new Date();
    return myTasks.filter(task => {
      // Role filter (assigned vs created)
      if (roleFilter === 'assigned' && !task.user_is_assignee) return false;
      if (roleFilter === 'created' && task.created_by !== user?.id) return false;
      
      // Status filter
      switch (taskFilter) {
        case 'pending':
          return task.status !== 'completed' && !task.user_completed;
        case 'completed':
          return task.status === 'completed' || task.user_completed;
        case 'overdue':
          const dueDate = task.due_date || task.end_date;
          return dueDate && new Date(dueDate) < now && task.status !== 'completed' && !task.user_completed;
        default:
          return true;
      }
    });
  };

  // Group tasks by date (Todoist-style)
  const getTasksGroupedByDate = () => {
    const filtered = getFilteredTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const groups = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: []
    };
    
    filtered.forEach(task => {
      const dueDate = task.due_date || task.end_date;
      if (!dueDate) {
        groups.noDueDate.push(task);
        return;
      }
      
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      
      if (due < today && task.status !== 'completed' && !task.user_completed) {
        groups.overdue.push(task);
      } else if (due.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (due.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(task);
      } else if (due <= endOfWeek) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });
    
    return groups;
  };

  // Format date for display
  const formatTaskDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format relative date for section headers
  const formatSectionDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Handle task completion toggle
  const handleToggleComplete = async (task) => {
    // Find the workspace to construct the API URL
    const workspace = workspaces.find(w => w.id === task.workspace_id);
    if (!workspace) return;
    
    try {
      const isCompleted = task.status === 'completed' || task.user_completed;
      const endpoint = `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}/complete`;
      
      if (isCompleted) {
        // Mark incomplete
        await fetch(`${import.meta.env.VITE_API_URL || '/api'}${endpoint}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          }
        });
      } else {
        // Mark complete
        await fetch(`${import.meta.env.VITE_API_URL || '/api'}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          }
        });
      }
      
      // Refresh tasks
      await loadMyTasks();
      toast.success(isCompleted ? 'Task marked incomplete' : 'Task completed!');
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    }
  };

  // Check if task is overdue
  const isOverdue = (task) => {
    const dueDate = task.due_date || task.end_date;
    if (!dueDate || task.status === 'completed' || task.user_completed) return false;
    return new Date(dueDate) < new Date();
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-400';
    }
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
      
      // Refetch subscription status to update workspace count
      await fetchSubscriptionStatus();
    } catch (error) {
      console.error('Create workspace error:', error);
      
      // Handle subscription limit error specifically
      if (error.response?.status === 403 && error.response?.data?.error === 'Subscription Limit Reached') {
        toast.error(error.response.data.message);
        setShowCreateForm(false);
        setShowSubscriptionGate(true);
      } else {
        toast.error('Failed to create workspace');
      }
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

  const handleWorkspaceDeleted = (workspaceId, archived) => {
    setWorkspaces(workspaces.filter(w => w.id !== workspaceId));
    setShowSettingsDialog(false);
    setSelectedWorkspaceForSettings(null);
  };

  const handleMemberRemoved = (memberId) => {
    // Update the workspace in the list to reflect member removal
    if (selectedWorkspaceForSettings) {
      const updatedWorkspace = {
        ...selectedWorkspaceForSettings,
        member_count: Math.max(0, (selectedWorkspaceForSettings.member_count || 1) - 1)
      };
      setSelectedWorkspaceForSettings(updatedWorkspace);
      setWorkspaces(workspaces.map(w => 
        w.id === updatedWorkspace.id ? { ...w, member_count: updatedWorkspace.member_count } : w
      ));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <div className="mx-auto w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-gray-500" />
            </div>
          </div>
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600 text-sm">
            Loading your workspaces...
          </p>
        </div>
      </div>
    );
  }

  // Site admin gets special admin interface
  if (isSiteAdmin()) {
    return (
      <AdminWorkspaceTabs
        user={user}
        personalWorkspaces={workspaces}
        onSelectWorkspace={onSelectWorkspace}
        onShowCreateForm={() => setShowCreateForm(true)}
        onSignOut={onSignOut}
      />
    );
  }

  // Regular users get standard workspace selection
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">
              <MessageCircle className="w-6 h-6 text-gray-700" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                crew
              </h1>
              <div className="flex flex-col">
                <p className="text-sm text-gray-600">
                  Welcome back, {user.displayName}!
                </p>
                <p className="text-xs text-gray-500">
                  {getVersionString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <img 
              src={user.photoURL} 
              alt={user.displayName}
              className="w-7 h-7 rounded-full shadow-sm"
            />
            <button
              onClick={onSignOut}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

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
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 mb-8"
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
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                        {workspace.name}
                      </h3>
                      {workspace.unread_count > 0 && (
                        <span className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                          {workspace.unread_count > 99 ? '99+' : workspace.unread_count}
                        </span>
                      )}
                    </div>
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
                    className="p-2.5 bg-white hover:bg-gray-50 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200 hover:border-gray-300 opacity-80 hover:opacity-100 hover:scale-105"
                    title="Workspace options"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-700 hover:text-gray-900" />
                  </button>
                  
                  {/* Dropdown Menu - Fixed z-index and positioning */}
                  {openMenuId === workspace.id && (
                    <div 
                      className="fixed z-[99999] mt-2 w-48 rounded-lg overflow-hidden"
                      style={{ 
                        backgroundColor: 'rgba(255, 255, 255, 1)', 
                        backdropFilter: 'none',
                        top: `${openMenuId === workspace.id ? 'auto' : '0'}px`,
                        right: '16px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 10px 25px -6px rgba(0, 0, 0, 0.1)',
                        border: '2px solid rgba(229, 231, 235, 1)'
                      }}
                    >
                      <div className="py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setSelectedWorkspaceForSettings(workspace);
                            setShowSettingsDialog(true);
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
            onClick={() => {
              // Count workspaces owned by current user
              const ownedWorkspacesCount = workspaces.filter(w => w.owner_user_id === user?.id).length;
              if (canCreateWorkspace(ownedWorkspacesCount)) {
                setShowCreateForm(true);
              } else {
                setShowSubscriptionGate(true);
              }
            }}
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

        {/* My Tasks Section - All Workspaces */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {/* Section Header */}
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => setTasksExpanded(!tasksExpanded)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">My Tasks</h3>
                <p className="text-sm text-gray-500">
                  {myTasks.length} task{myTasks.length !== 1 ? 's' : ''} across all workspaces
                </p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              {tasksExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>

          {/* Task List Content */}
          {tasksExpanded && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Role Filter (Assigned vs Created) */}
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <span className="text-sm text-gray-500 mr-2">Show:</span>
                {[
                  { key: 'all', label: 'All Tasks' },
                  { key: 'assigned', label: 'Assigned to Me' },
                  { key: 'created', label: 'Created by Me' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setRoleFilter(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      roleFilter === key
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex border-b border-gray-100 px-4">
                {[
                  { key: 'pending', label: 'Pending', icon: Circle },
                  { key: 'overdue', label: 'Overdue', icon: AlertCircle },
                  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
                  { key: 'all', label: 'All Statuses', icon: CheckSquare },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTaskFilter(key)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      taskFilter === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {key === 'overdue' && myTasks.filter(t => isOverdue(t)).length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                        {myTasks.filter(t => isOverdue(t)).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Todoist-Style Task List - Grouped by Date */}
              <div className="px-2 py-3">
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="loading-spinner w-6 h-6"></div>
                    <span className="ml-3 text-gray-500">Loading tasks...</span>
                  </div>
                ) : getFilteredTasks().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="font-semibold text-lg text-gray-700">No {taskFilter === 'all' ? '' : taskFilter} tasks</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {taskFilter === 'pending' && "You're all caught up! 🎉"}
                      {taskFilter === 'overdue' && "No overdue tasks - great job!"}
                      {taskFilter === 'completed' && "Complete some tasks to see them here"}
                      {taskFilter === 'all' && "No tasks assigned to you yet"}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Overdue Section */}
                    {getTasksGroupedByDate().overdue.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg mb-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm font-semibold text-red-700">Overdue</span>
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-auto">
                            {getTasksGroupedByDate().overdue.length}
                          </span>
                        </div>
                        {getTasksGroupedByDate().overdue.map(task => (
                          <TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} getPriorityColor={getPriorityColor} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />
                        ))}
                      </div>
                    )}

                    {/* Today Section */}
                    {getTasksGroupedByDate().today.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-blue-500 mb-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-bold text-gray-900">Today</span>
                          <span className="text-xs text-gray-500 ml-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full ml-auto">
                            {getTasksGroupedByDate().today.length}
                          </span>
                        </div>
                        {getTasksGroupedByDate().today.map(task => (
                          <TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} getPriorityColor={getPriorityColor} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />
                        ))}
                      </div>
                    )}

                    {/* Tomorrow Section */}
                    {getTasksGroupedByDate().tomorrow.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-semibold text-gray-800">Tomorrow</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
                            {getTasksGroupedByDate().tomorrow.length}
                          </span>
                        </div>
                        {getTasksGroupedByDate().tomorrow.map(task => (
                          <TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} getPriorityColor={getPriorityColor} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />
                        ))}
                      </div>
                    )}

                    {/* This Week Section */}
                    {getTasksGroupedByDate().thisWeek.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                          <Clock className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-semibold text-gray-800">This Week</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
                            {getTasksGroupedByDate().thisWeek.length}
                          </span>
                        </div>
                        {getTasksGroupedByDate().thisWeek.map(task => (
                          <TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} getPriorityColor={getPriorityColor} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />
                        ))}
                      </div>
                    )}

                    {/* Later Section */}
                    {getTasksGroupedByDate().later.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-800">Later</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-auto">
                            {getTasksGroupedByDate().later.length}
                          </span>
                        </div>
                        {getTasksGroupedByDate().later.map(task => (
                          <TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} getPriorityColor={getPriorityColor} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />
                        ))}
                      </div>
                    )}

                    {/* No Due Date Section */}
                    {getTasksGroupedByDate().noDueDate.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-dashed border-gray-200 mb-2">
                          <Circle className="w-4 h-4 text-gray-300" />
                          <span className="text-sm font-medium text-gray-500">No Due Date</span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-auto">
                            {getTasksGroupedByDate().noDueDate.length}
                          </span>
                        </div>
                        {getTasksGroupedByDate().noDueDate.map(task => (
                          <TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} getPriorityColor={getPriorityColor} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Workspace Settings Dialog */}
      <WorkspaceSettingsDialog
        workspace={selectedWorkspaceForSettings}
        user={user}
        isOpen={showSettingsDialog}
        onClose={() => {
          setShowSettingsDialog(false);
          setSelectedWorkspaceForSettings(null);
        }}
        onWorkspaceDeleted={handleWorkspaceDeleted}
        onMemberRemoved={handleMemberRemoved}
      />

      {/* Subscription Gate */}
      {showSubscriptionGate && (
        <SubscriptionGate
          action="Create workspace"
          title="Upgrade to Create Workspaces"
          description="Creating workspaces requires a paid subscription. You can still join and participate in channels you've been invited to."
          showRedeemPass={true}
          onClose={() => setShowSubscriptionGate(false)}
        />
      )}

      {/* New User Onboarding Modal */}
      {showNewUserOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center">
                <Crown className="h-6 w-6 text-blue-500 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Welcome to crew!
                </h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  You're on the Free Plan
                </h3>
                <p className="text-gray-600 text-sm">
                  Perfect for joining existing workspaces and collaborating with teams that invite you.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-4">
                {/* Free Plan Benefits */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">What you can do now:</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Join workspaces when invited by others</li>
                    <li>• Participate in team channels and conversations</li>
                    <li>• View tasks, calendar, and knowledge bases</li>
                    <li>• Upload files up to 5MB</li>
                  </ul>
                </div>

                {/* Upgrade Option */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Want to create your own workspaces?</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Upgrade to a paid plan to create unlimited workspaces and invite team members.
                  </p>
                  <button
                    onClick={() => {
                      setShowNewUserOnboarding(false);
                      setShowSubscriptionGate(true);
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    View Upgrade Options
                  </button>
                </div>
              </div>

              {/* Continue Button */}
              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowNewUserOnboarding(false)}
                  className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Continue with Free Plan
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  You'll be notified when someone invites you to a workspace
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceScreen;
