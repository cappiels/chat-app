import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';

// Lazy load calendar/timeline components
const ChannelCalendar = lazy(() => import('./calendar/ChannelCalendar'));
const WeeklyCalendar = lazy(() => import('./calendar/WeeklyCalendar'));
const ChannelTimeline = lazy(() => import('./timeline/ChannelTimeline'));
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Users, 
  Search,
  ChevronRight,
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  ExternalLink,
  Plus,
  CalendarDays,
  LayoutGrid,
  BookOpen,
  GanttChart,
  LogOut,
  Shield
} from 'lucide-react';
import { workspaceAPI, globalTasksAPI } from '../utils/api';
import toast from 'react-hot-toast';
import WorkspaceSettingsDialog from './WorkspaceSettingsDialog';
import { useSubscription } from '../contexts/SubscriptionContext';
import SubscriptionGate from './subscription/SubscriptionGate';
import { auth } from '../firebase';
import QuickTaskDialog from './tasks/QuickTaskDialog';
import chatContextManager from '../utils/chatContext';

// Hook for responsive detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

// Task Item Component
const TaskItem = ({ task, workspaces, onSelectWorkspace, onToggleComplete, onViewTaskDetails, formatTaskDate, isOverdue }) => {
  const isCompleted = task.status === 'completed' || task.user_completed;
  const workspace = workspaces.find(w => w.id === task.workspace_id);

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
      <button
        onClick={() => onToggleComplete(task)}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          isCompleted ? 'bg-green-500 border-green-500' : getPriorityRing(task.priority)
        }`}
      >
        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <button
              onClick={() => onViewTaskDetails(task)}
              className="text-left w-full"
            >
              <h4 className={`text-sm font-medium leading-tight hover:text-blue-600 transition-colors ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {task.title}
              </h4>
            </button>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <button onClick={() => workspace && onSelectWorkspace(workspace)} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-600 transition-colors">
                <MessageCircle className="w-3 h-3" />{task.workspace_name}
              </button>
              <button onClick={() => workspace && onSelectWorkspace(workspace)} className="inline-flex items-center gap-1 px-2 py-0.5 hover:bg-blue-50 rounded text-xs text-blue-600 hover:text-blue-700 transition-colors">
                <span className="text-blue-400">#</span>{task.channel_name}
                <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {task.progress_info && task.total_assignees > 1 && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                  <Users className="w-3 h-3 mr-1" />{task.progress_info}
                </span>
              )}
            </div>
          </div>
          {(task.due_date || task.end_date) && !isCompleted && (
            <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${isOverdue(task) ? 'bg-red-100 text-red-700' : 'text-gray-500'}`}>
              <Calendar className="w-3 h-3" />{formatTaskDate(task.due_date || task.end_date)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Calendar View Selector Modal
const CalendarViewSelector = ({ isOpen, onClose, onSelectView }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 md:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
        <div className="px-4 pb-2 pt-2 md:pt-4"><h3 className="text-lg font-bold text-gray-900">Select Calendar View</h3></div>
        <div className="px-2 pb-6 space-y-1">
          {[
            { view: 'monthly', icon: CalendarDays, color: 'purple', title: 'Monthly Calendar', desc: 'View tasks across months' },
            { view: 'weekly', icon: LayoutGrid, color: 'teal', title: 'Weekly Calendar', desc: 'Week view with time blocking' },
            { view: 'timeline', icon: GanttChart, color: 'orange', title: 'Timeline', desc: 'Gantt chart with dependencies' },
          ].map(({ view, icon: Icon, color, title, desc }) => (
            <button key={view} onClick={() => onSelectView(view)} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className={`p-2 bg-${color}-100 rounded-lg`}><Icon className={`w-5 h-5 text-${color}-600`} /></div>
              <div className="text-left"><div className="font-medium text-gray-900">{title}</div><div className="text-sm text-gray-500">{desc}</div></div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

// Navigation Tab Button
const NavTab = ({ active, icon: Icon, label, onClick, isMobile }) => (
  <button onClick={onClick} className={`flex ${isMobile ? 'flex-col' : 'flex-row gap-2'} items-center ${isMobile ? 'py-2 px-3' : 'px-4 py-2 rounded-lg'} ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'} ${!isMobile && active ? 'bg-blue-50' : ''} transition-colors`}>
    <Icon className="w-5 h-5" />
    <span className={`${isMobile ? 'text-xs mt-1' : 'text-sm'} font-medium`}>{label}</span>
  </button>
);

// Main Screen Component
const MainScreen = ({ user, onSignOut, onSelectWorkspace }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { canCreateWorkspace, isSiteAdmin, fetchSubscriptionStatus } = useSubscription();
  const [activeTab, setActiveTab] = useState('today');
  const [calendarView, setCalendarView] = useState(null);
  const [showCalendarSelector, setShowCalendarSelector] = useState(false);
  
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSubscriptionGate, setShowSubscriptionGate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [selectedWorkspaceForSettings, setSelectedWorkspaceForSettings] = useState(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  const [myTasks, setMyTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [showQuickTaskDialog, setShowQuickTaskDialog] = useState(false);
  const [showWorkspaceSelectionModal, setShowWorkspaceSelectionModal] = useState(false);

  useEffect(() => { loadWorkspaces(); loadMyTasks(); }, []);

  // Handle Chat tab click - navigate to last used workspace/channel or show selection modal
  const handleChatTabClick = () => {
    const savedContext = chatContextManager.load();

    if (savedContext && savedContext.workspaceId) {
      // Find the workspace in our list
      const workspace = workspaces.find(w => w.id === savedContext.workspaceId);

      if (workspace) {
        // Navigate to the workspace with the saved channel context
        onSelectWorkspace({
          ...workspace,
          initialChannelId: savedContext.channelId
        });
        return;
      }
    }

    // No saved context or workspace not found - show selection modal
    if (workspaces.length === 0) {
      toast.error('Create a workspace first');
      setActiveTab('workspaces');
    } else {
      setShowWorkspaceSelectionModal(true);
    }
  };

  const loadWorkspaces = async () => {
    try {
      const response = await workspaceAPI.getWorkspaces();
      const data = response.data.workspaces || [];
      setWorkspaces(data.map(w => ({ ...w, member_count: w.member_count || 1, color: getWorkspaceColor(w.name) })));
    } catch (error) {
      console.error('Load workspaces error:', error);
      setWorkspaces([]);
    } finally { setLoading(false); }
  };

  const getWorkspaceColor = (name) => {
    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-indigo-500'];
    return colors[name.length % colors.length];
  };

  const loadMyTasks = async () => {
    try {
      setTasksLoading(true);
      const response = await globalTasksAPI.getMyTasks({ limit: 100 });
      setMyTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setMyTasks([]);
    } finally { setTasksLoading(false); }
  };

  const getFilteredTasks = () => myTasks.filter(task => {
    if (roleFilter === 'assigned' && !task.user_is_assignee) return false;
    if (roleFilter === 'created' && task.created_by !== user?.id) return false;
    // Show completed tasks only when "completed" filter is active
    if (roleFilter === 'completed') return task.status === 'completed' || task.user_completed;
    // Show overdue tasks only when "overdue" filter is active
    if (roleFilter === 'overdue') {
      const dueDate = task.due_date || task.end_date;
      if (!dueDate) return false;
      const isOverdue = new Date(dueDate) < new Date();
      return isOverdue && task.status !== 'completed' && !task.user_completed;
    }
    // For other filters, exclude completed tasks
    return task.status !== 'completed' && !task.user_completed;
  });

  const getTasksGroupedByDate = () => {
    const filtered = getFilteredTasks();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today); endOfWeek.setDate(endOfWeek.getDate() + 7);
    const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDueDate: [] };
    filtered.forEach(task => {
      const dueDate = task.due_date || task.end_date;
      if (!dueDate) { groups.noDueDate.push(task); return; }
      const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
      if (due < today) groups.overdue.push(task);
      else if (due.getTime() === today.getTime()) groups.today.push(task);
      else if (due.getTime() === tomorrow.getTime()) groups.tomorrow.push(task);
      else if (due <= endOfWeek) groups.thisWeek.push(task);
      else groups.later.push(task);
    });
    return groups;
  };

  const formatTaskDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleToggleComplete = async (task) => {
    try {
      const isCompleted = task.status === 'completed' || task.user_completed;
      const endpoint = `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}/complete`;
      await fetch(`${import.meta.env.VITE_API_URL || '/api'}${endpoint}`, {
        method: isCompleted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` }
      });
      await loadMyTasks();
      toast.success(isCompleted ? 'Task marked incomplete' : 'Task completed!');
    } catch (error) { toast.error('Failed to update task'); }
  };

  const isOverdue = (task) => {
    const dueDate = task.due_date || task.end_date;
    if (!dueDate || task.status === 'completed' || task.user_completed) return false;
    return new Date(dueDate) < new Date();
  };

  const handleViewTaskDetails = (task) => {
    navigate(`/task/${task.id}`, { state: { task } });
  };

  const filteredWorkspaces = workspaces.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) { toast.error('Please enter a workspace name'); return; }
    setCreating(true);
    try {
      const response = await workspaceAPI.createWorkspace({ name: newWorkspaceName, description: newWorkspaceDescription });
      setWorkspaces([...workspaces, { ...response.data.workspace, color: getWorkspaceColor(newWorkspaceName) }]);
      toast.success('Workspace created!');
      setShowCreateForm(false); setNewWorkspaceName(''); setNewWorkspaceDescription('');
      await fetchSubscriptionStatus();
    } catch (error) {
      if (error.response?.status === 403) setShowSubscriptionGate(true);
      else toast.error('Failed to create workspace');
    } finally { setCreating(false); }
  };

  const handleCalendarViewSelect = (view) => { setCalendarView(view); setShowCalendarSelector(false); setActiveTab('calendar'); };

  if (loading) {
    return (<div className="h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="loading-spinner mb-4"></div><p className="text-gray-600 text-sm">Loading...</p></div></div>);
  }

  const renderTaskGroup = (title, tasks, icon, iconColor, bgColor) => {
    if (tasks.length === 0) return null;
    return (
      <div className="mb-4">
        <div className={`flex items-center gap-2 px-2 py-2 ${bgColor} rounded-lg mb-2`}>
          {icon}<span className={`text-sm font-semibold ${iconColor}`}>{title}</span>
          <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full ml-auto">{tasks.length}</span>
        </div>
        {tasks.map(task => (<TaskItem key={task.id} task={task} workspaces={workspaces} onSelectWorkspace={onSelectWorkspace} onToggleComplete={handleToggleComplete} onViewTaskDetails={handleViewTaskDetails} formatTaskDate={formatTaskDate} isOverdue={isOverdue} />))}
      </div>
    );
  };

  const navTabs = [
    { key: 'today', icon: CalendarDays, label: 'Today' },
    { key: 'calendar', icon: Calendar, label: 'Calendar', onClick: () => setShowCalendarSelector(true) },
    { key: 'chat', icon: MessageCircle, label: 'Chat', onClick: handleChatTabClick },
    { key: 'knowledge', icon: BookOpen, label: 'Knowledge' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Desktop Top Navigation */}
      {!isMobile && (
        <header className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-lg"><MessageCircle className="w-5 h-5 text-gray-700" /></div>
                <span className="text-xl font-semibold text-gray-900">crew</span>
                {isSiteAdmin() && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1"><Shield className="w-3 h-3" />Admin</span>}
              </div>
              <nav className="flex items-center gap-1">
                {navTabs.map(({ key, icon, label, onClick }) => (
                  <NavTab key={key} active={activeTab === key} icon={icon} label={label} isMobile={false} onClick={onClick || (() => setActiveTab(key))} />
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
              <span className="text-sm text-gray-700">{user.displayName}</span>
              <button onClick={onSignOut} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 bg-gray-100 rounded-lg"><LogOut className="w-4 h-4" />Sign Out</button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? 'pb-20' : ''}`}>
        {activeTab === 'today' && (
          <div className="max-w-4xl mx-auto">
            {/* Mobile Header */}
            {isMobile && (
              <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 px-4 pt-4 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full shadow-sm" />
                    <div><p className="text-xs text-gray-500">Welcome back</p><p className="text-sm font-medium text-gray-900">{user.displayName}</p></div>
                  </div>
                  <button onClick={onSignOut} className="px-3 py-1.5 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg">Sign Out</button>
                </div>
              </div>
            )}
            <div className="px-4 py-4">
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-gray-900">Today</h1>
                <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
              </div>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {[{ key: 'all', label: 'All Tasks' }, { key: 'assigned', label: 'Assigned to Me' }, { key: 'created', label: 'Created by Me' }, { key: 'overdue', label: 'Overdue' }, { key: 'completed', label: 'Completed' }].map(({ key, label }) => {
                  // Calculate overdue count for badge
                  const overdueCount = key === 'overdue' ? myTasks.filter(t => {
                    const dueDate = t.due_date || t.end_date;
                    return dueDate && new Date(dueDate) < new Date() && t.status !== 'completed' && !t.user_completed;
                  }).length : 0;
                  return (
                    <button key={key} onClick={() => setRoleFilter(key)} className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${roleFilter === key ? (key === 'completed' ? 'bg-green-600 text-white' : key === 'overdue' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {label}
                      {key === 'overdue' && overdueCount > 0 && (
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${roleFilter === 'overdue' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>{overdueCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="h-px bg-gray-200 mb-4" />
              {tasksLoading ? (
                <div className="flex items-center justify-center py-12"><div className="loading-spinner w-6 h-6"></div><span className="ml-3 text-gray-500">Loading tasks...</span></div>
              ) : getFilteredTasks().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><CheckCircle2 className="w-10 h-10 text-gray-300" /></div>
                  <p className="font-semibold text-lg text-gray-700">No Tasks Found</p>
                  <p className="text-sm text-gray-400 mt-1">Tasks assigned to you will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderTaskGroup('Overdue', getTasksGroupedByDate().overdue, <AlertCircle className="w-4 h-4 text-red-500" />, 'text-red-700', 'bg-red-50')}
                  {renderTaskGroup('Today', getTasksGroupedByDate().today, <Calendar className="w-4 h-4 text-blue-600" />, 'text-gray-900', 'border-b-2 border-blue-500 bg-transparent')}
                  {renderTaskGroup('Tomorrow', getTasksGroupedByDate().tomorrow, <Calendar className="w-4 h-4 text-orange-500" />, 'text-gray-800', 'border-b border-gray-200 bg-transparent')}
                  {renderTaskGroup('This Week', getTasksGroupedByDate().thisWeek, <Clock className="w-4 h-4 text-purple-500" />, 'text-gray-800', 'border-b border-gray-200 bg-transparent')}
                  {renderTaskGroup('Later', getTasksGroupedByDate().later, <Calendar className="w-4 h-4 text-gray-400" />, 'text-gray-800', 'border-b border-gray-200 bg-transparent')}
                  {renderTaskGroup('No Due Date', getTasksGroupedByDate().noDueDate, <Circle className="w-4 h-4 text-gray-300" />, 'text-gray-500', 'border-b border-dashed border-gray-200 bg-transparent')}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && calendarView && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <div className="loading-spinner"></div>
              </div>
            }>
              {calendarView === 'monthly' && (
                <ChannelCalendar
                  channel={null}
                  workspace={null}
                  workspaceId={null}
                />
              )}
              {calendarView === 'weekly' && (
                <WeeklyCalendar
                  channel={null}
                  workspace={null}
                  workspaceId={null}
                />
              )}
              {calendarView === 'timeline' && (
                <ChannelTimeline
                  channel={null}
                  workspace={null}
                  workspaceId={null}
                />
              )}
            </Suspense>
          </div>
        )}

        {/* Workspaces tab removed - use Chat tab instead */}

        {activeTab === 'knowledge' && (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"><BookOpen className="w-10 h-10 text-green-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Knowledge Base</h2>
            <p className="text-gray-500 text-center">Organized knowledge with categories and tagging - Coming soon!</p>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
          <div className="flex justify-around items-center">
            {navTabs.map(({ key, icon, label, onClick }) => (
              <NavTab key={key} active={activeTab === key} icon={icon} label={label} isMobile={true} onClick={onClick || (() => setActiveTab(key))} />
            ))}
          </div>
        </div>
      )}

      {/* FAB for Today view */}
      {activeTab === 'today' && (
        <button
          onClick={() => setShowQuickTaskDialog(true)}
          className={`fixed ${isMobile ? 'bottom-20 right-4' : 'bottom-6 right-6'} w-14 h-14 bg-red-500 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-red-600 transition-colors z-40`}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <CalendarViewSelector isOpen={showCalendarSelector} onClose={() => setShowCalendarSelector(false)} onSelectView={handleCalendarViewSelect} />

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Workspace</h2>
            <input type="text" placeholder="Workspace name" value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} className="w-full p-3 mb-3 rounded-lg border border-gray-300" autoFocus />
            <input type="text" placeholder="Description (optional)" value={newWorkspaceDescription} onChange={e => setNewWorkspaceDescription(e.target.value)} className="w-full p-3 mb-4 rounded-lg border border-gray-300" />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateForm(false)} className="flex-1 py-2 text-gray-600">Cancel</button>
              <button onClick={handleCreateWorkspace} disabled={creating || !newWorkspaceName.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionGate && (<SubscriptionGate action="Create workspace" title="Upgrade to Create Workspaces" description="Creating workspaces requires a paid subscription." showRedeemPass={true} onClose={() => setShowSubscriptionGate(false)} />)}

      <WorkspaceSettingsDialog workspace={selectedWorkspaceForSettings} user={user} isOpen={showSettingsDialog} onClose={() => { setShowSettingsDialog(false); setSelectedWorkspaceForSettings(null); }} onWorkspaceDeleted={(id) => { setWorkspaces(workspaces.filter(w => w.id !== id)); setShowSettingsDialog(false); }} onMemberRemoved={() => {}} />

      {/* Quick Task Dialog for Today screen */}
      <QuickTaskDialog
        isOpen={showQuickTaskDialog}
        onClose={() => setShowQuickTaskDialog(false)}
        workspaces={workspaces}
        currentUser={user}
        onTaskCreated={() => {
          setShowQuickTaskDialog(false);
          loadMyTasks();
          toast.success('Task created!');
        }}
      />

      {/* Workspace Selection Modal - shown when clicking Chat with no saved context */}
      {showWorkspaceSelectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowWorkspaceSelectionModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Select a Workspace</h2>
              <p className="text-sm text-gray-500 mt-1">Choose a workspace to start chatting</p>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {workspaces.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No workspaces yet</p>
                  <button
                    onClick={() => {
                      setShowWorkspaceSelectionModal(false);
                      setShowCreateForm(true);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Workspace
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {workspaces.map(workspace => (
                    <button
                      key={workspace.id}
                      onClick={() => {
                        setShowWorkspaceSelectionModal(false);
                        onSelectWorkspace(workspace);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className={`w-10 h-10 ${workspace.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <MessageCircle className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{workspace.name}</h3>
                        <p className="text-xs text-gray-500">{workspace.member_count} member{workspace.member_count !== 1 ? 's' : ''}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setShowWorkspaceSelectionModal(false)}
                className="w-full py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainScreen;
