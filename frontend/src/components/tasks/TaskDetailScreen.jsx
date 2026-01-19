import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Users,
  Flag,
  MessageCircle,
  CheckCircle2,
  Circle,
  AlertCircle,
  MapPin,
  Tag,
  Building2,
  ExternalLink,
  Edit3,
  Trash2,
  Send,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  'pending': 'bg-gray-100 text-gray-700 border-gray-200',
  'in_progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'completed': 'bg-green-100 text-green-700 border-green-200',
  'blocked': 'bg-red-100 text-red-700 border-red-200',
  'cancelled': 'bg-gray-100 text-gray-500 border-gray-200'
};

const STATUS_LABELS = {
  'pending': 'Pending',
  'in_progress': 'In Progress',
  'completed': 'Completed',
  'blocked': 'Blocked',
  'cancelled': 'Cancelled'
};

const PRIORITY_COLORS = {
  'low': 'bg-green-100 text-green-700 border-green-200',
  'medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'high': 'bg-orange-100 text-orange-700 border-orange-200',
  'urgent': 'bg-red-100 text-red-700 border-red-200'
};

const TaskDetailScreen = ({ onSelectWorkspace }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState(location.state?.task);
  const [replies, setReplies] = useState([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const repliesEndRef = useRef(null);

  useEffect(() => {
    if (!task) {
      navigate('/', { replace: true });
    } else {
      loadReplies();
    }
  }, [task, navigate]);

  const loadReplies = async () => {
    if (!task) return;

    try {
      setLoadingReplies(true);
      const response = await api.get(
        `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}/replies`
      );
      setReplies(response.data.replies || []);
    } catch (error) {
      console.error('Error loading replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const sendReply = async () => {
    if (!replyContent.trim() || !task) return;

    try {
      setSendingReply(true);
      const response = await api.post(
        `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}/replies`,
        { content: replyContent.trim() }
      );

      setReplies(prev => [...prev, response.data.reply]);
      setReplyContent('');

      // Scroll to bottom
      setTimeout(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleToggleComplete = async () => {
    if (!task) return;

    try {
      setLoading(true);
      const isCompleted = task.status === 'completed' || task.user_completed;
      const endpoint = `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}/complete`;

      if (isCompleted) {
        await api.delete(endpoint);
        toast.success('Task marked incomplete');
        setTask(prev => ({ ...prev, status: 'pending', user_completed: false }));
      } else {
        await api.post(endpoint);
        toast.success('Task completed!');
        setTask(prev => ({ ...prev, status: 'completed', user_completed: true }));
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    const confirmed = window.confirm('Are you sure you want to delete this task? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.delete(
        `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}`
      );
      toast.success('Task deleted');
      navigate(-1);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!task || !editForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setLoading(true);
      await api.put(
        `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}`,
        editForm
      );

      setTask(prev => ({
        ...prev,
        ...editForm,
        due_date: editForm.due_date || null
      }));
      setIsEditing(false);
      toast.success('Task updated');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInChannel = async () => {
    if (!task?.workspace_id) return;

    try {
      const response = await api.get(`/workspaces/${task.workspace_id}`);
      const workspace = response.data.workspace;

      if (workspace && onSelectWorkspace) {
        onSelectWorkspace(workspace);
      }
    } catch (error) {
      console.error('Error loading workspace:', error);
      toast.error('Failed to open channel');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const isOverdue = useMemo(() => {
    if (!task) return false;
    const dueDate = task.due_date || task.end_date;
    if (!dueDate || task.status === 'completed' || task.user_completed) return false;
    return new Date(dueDate) < new Date();
  }, [task]);

  const isCompleted = task?.status === 'completed' || task?.user_completed;

  // Use API-provided user_can_edit flag which includes creator and assignee checks
  const canEdit = useMemo(() => {
    if (!task || !user) return false;
    // Prefer API's user_can_edit, fallback to creator/assignee check
    return task.user_can_edit || task.user_is_assignee || task.created_by === user.id || task.user_is_creator;
  }, [task, user]);

  const getPriorityRing = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-500';
      case 'urgent': return 'border-red-600';
      case 'medium': return 'border-yellow-500';
      case 'low': return 'border-green-500';
      default: return 'border-gray-300';
    }
  };

  const replyCount = task?.reply_count || replies.length;

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Task Details</h1>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEdit}
                  disabled={loading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit task"
                >
                  <Edit3 className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-5 h-5 text-red-500" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto px-4 py-6 w-full overflow-y-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Task Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              {/* Completion Checkbox */}
              <button
                onClick={handleToggleComplete}
                disabled={loading}
                className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all mt-1 ${
                  isCompleted
                    ? 'bg-green-500 border-green-500'
                    : `${getPriorityRing(task.priority)} hover:bg-gray-50`
                } ${loading ? 'opacity-50' : ''}`}
              >
                {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
              </button>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <h2 className={`text-xl font-semibold leading-tight ${
                  isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'
                }`}>
                  {task.title}
                </h2>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_COLORS[task.status]}`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>
              {task.priority && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium border capitalize ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority} Priority
                </span>
              )}
              {isOverdue && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Overdue
                </span>
              )}
            </div>
          </div>

          {/* Task Metadata */}
          <div className="p-6 space-y-4">
            {/* Due Date */}
            {(task.due_date || task.end_date) && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Due Date</p>
                  <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {formatDate(task.due_date || task.end_date)}
                    {task.end_time && !task.is_all_day && ` at ${formatTime(task.end_time)}`}
                  </p>
                </div>
              </div>
            )}

            {/* Start Date (if different from due date) */}
            {task.start_date && task.start_date !== task.end_date && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Start Date</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(task.start_date)}
                    {task.start_time && !task.is_all_day && ` at ${formatTime(task.start_time)}`}
                  </p>
                </div>
              </div>
            )}

            {/* Assignees */}
            {(task.assignee_names || task.assigned_to_name) && (
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Assigned to</p>
                  <p className="text-sm text-gray-600">
                    {task.assignee_names || task.assigned_to_name}
                  </p>
                </div>
              </div>
            )}

            {/* Progress for group tasks */}
            {task.progress_info && task.total_assignees > 1 && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Progress</p>
                  <p className="text-sm text-blue-600">{task.progress_info}</p>
                </div>
              </div>
            )}

            {/* Location */}
            {task.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Location</p>
                  <p className="text-sm text-gray-600">{task.location}</p>
                </div>
              </div>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Tags</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {task.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {task.description && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}
          </div>

          {/* Channel Context */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Workspace</p>
                <p className="text-sm text-gray-600">{task.workspace_name}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Channel</p>
                  <p className="text-sm text-blue-600">#{task.channel_name}</p>
                </div>
              </div>

              {/* Chat Icon with Message Count */}
              <button
                onClick={handleOpenInChannel}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  replyCount > 0
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <MessageSquare className={`w-4 h-4 ${replyCount > 0 ? 'text-blue-600' : 'text-gray-500'}`} />
                {replyCount > 0 && (
                  <span className={`text-sm font-semibold ${replyCount > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                    {replyCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Discussion Section */}
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h3 className="text-base font-semibold text-gray-800">Discussion</h3>
              {replyCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {replyCount}
                </span>
              )}
            </div>

            {/* Replies List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {loadingReplies ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : replies.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <MessageCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No discussion yet</p>
                  <p className="text-xs text-gray-500">Start a conversation about this task</p>
                </div>
              ) : (
                replies.map((reply, index) => (
                  <div key={reply.id || index} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      {reply.sender_avatar ? (
                        <img
                          src={reply.sender_avatar}
                          alt={reply.sender_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-blue-700">
                          {(reply.sender_name || 'U')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">
                          {reply.sender_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{reply.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={repliesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="flex gap-2 mt-4">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={sendingReply}
              />
              <button
                onClick={sendReply}
                disabled={sendingReply || !replyContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingReply ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Task</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDetailScreen;
