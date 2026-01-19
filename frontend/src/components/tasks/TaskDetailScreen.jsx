import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink
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

  // Get task from location state
  const task = location.state?.task;

  useEffect(() => {
    if (!task) {
      // If no task in state, navigate back
      navigate('/', { replace: true });
    }
  }, [task, navigate]);

  const handleToggleComplete = async () => {
    if (!task) return;

    try {
      setLoading(true);
      const isCompleted = task.status === 'completed' || task.user_completed;
      const endpoint = `/workspaces/${task.workspace_id}/threads/${task.thread_id}/tasks/${task.id}/complete`;

      if (isCompleted) {
        await api.delete(endpoint);
        toast.success('Task marked incomplete');
      } else {
        await api.post(endpoint);
        toast.success('Task completed!');
      }

      // Navigate back after toggling
      navigate(-1);
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInChannel = async () => {
    if (!task?.workspace_id) return;

    try {
      // Fetch workspace details
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

  const isOverdue = useMemo(() => {
    if (!task) return false;
    const dueDate = task.due_date || task.end_date;
    if (!dueDate || task.status === 'completed' || task.user_completed) return false;
    return new Date(dueDate) < new Date();
  }, [task]);

  const isCompleted = task?.status === 'completed' || task?.user_completed;

  const getPriorityRing = (priority) => {
    switch (priority) {
      case 'high': return 'border-red-500';
      case 'urgent': return 'border-red-600';
      case 'medium': return 'border-yellow-500';
      case 'low': return 'border-green-500';
      default: return 'border-gray-300';
    }
  };

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Task Details</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
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

            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Channel</p>
                <p className="text-sm text-blue-600">#{task.channel_name}</p>
              </div>
            </div>

            {/* Open in Channel Button */}
            <button
              onClick={handleOpenInChannel}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <MessageCircle className="w-5 h-5" />
              Open in Channel
              <ExternalLink className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TaskDetailScreen;
