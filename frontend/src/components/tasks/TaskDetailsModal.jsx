import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  Calendar,
  Clock,
  User,
  Flag,
  Trash2,
  Edit3,
  CheckCircle,
  Circle,
  Users,
  Building2,
  AlertCircle
} from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const STATUS_COLORS = {
  'pending': 'bg-gray-100 text-gray-700',
  'in_progress': 'bg-blue-100 text-blue-700',
  'completed': 'bg-green-100 text-green-700',
  'blocked': 'bg-red-100 text-red-700',
  'cancelled': 'bg-gray-100 text-gray-500'
};

const STATUS_LABELS = {
  'pending': 'Pending',
  'in_progress': 'In Progress',
  'completed': 'Completed',
  'blocked': 'Blocked',
  'cancelled': 'Cancelled'
};

const PRIORITY_COLORS = {
  'low': 'bg-gray-100 text-gray-600',
  'medium': 'bg-blue-100 text-blue-700',
  'high': 'bg-orange-100 text-orange-700',
  'urgent': 'bg-red-100 text-red-700'
};

const TaskDetailsModal = ({
  task,
  isOpen,
  onClose,
  workspace,
  workspaceId,
  threadId,
  onTaskUpdated,
  onTaskDeleted,
  onEdit,
  teamMembers = [],
  userTeams = []
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assigneeCompletions, setAssigneeCompletions] = useState({});

  // Parse individual completions from task
  useEffect(() => {
    if (task?.individual_completions) {
      try {
        const completions = typeof task.individual_completions === 'string'
          ? JSON.parse(task.individual_completions)
          : task.individual_completions;
        setAssigneeCompletions(completions || {});
      } catch (e) {
        setAssigneeCompletions({});
      }
    } else {
      setAssigneeCompletions({});
    }
  }, [task]);

  // Permission calculations
  const permissions = useMemo(() => {
    if (!task || !user) return { canEdit: false, canDelete: false, canMarkDone: false, canMarkDoneForOthers: false };

    const workspaceRole = workspace?.role || workspace?.user_role;
    const isAdmin = workspaceRole === 'admin';
    const isCreator = task.created_by === user.uid;
    const isAssignee = task.assignees?.includes(user.uid) ||
                       task.assigned_to === user.uid;

    // Check if user is in an assigned team
    const userTeamIds = userTeams
      .filter(team => team.members?.includes(user.uid))
      .map(team => team.id);
    const isInAssignedTeam = task.assigned_teams?.some(teamId => userTeamIds.includes(teamId));

    return {
      canEdit: isAdmin || isCreator,
      canDelete: isAdmin || isCreator,
      canMarkDone: isAdmin || isCreator || isAssignee || isInAssignedTeam,
      canMarkDoneForOthers: isAdmin || isCreator
    };
  }, [task, user, workspace, userTeams]);

  // Determine if this is a group task
  const isGroupTask = useMemo(() => {
    if (!task) return false;
    const assigneeCount = (task.assignees?.length || 0) + (task.assigned_teams?.length || 0);
    return assigneeCount > 1 || task.assignment_mode === 'individual_response';
  }, [task]);

  // Get all assignees for group task display
  const allAssignees = useMemo(() => {
    if (!task) return [];

    const assignees = [];

    // Add individual assignees
    if (task.assignees?.length > 0) {
      task.assignees.forEach(assigneeId => {
        const member = teamMembers.find(m => (m.user_id || m.id) === assigneeId);
        assignees.push({
          id: assigneeId,
          name: member?.display_name || member?.name || member?.email || `User ${assigneeId.slice(0, 6)}`,
          type: 'user',
          isCompleted: !!assigneeCompletions[assigneeId]
        });
      });
    }

    // Add team assignees
    if (task.assigned_teams?.length > 0) {
      task.assigned_teams.forEach(teamId => {
        const team = userTeams.find(t => t.id === teamId);
        assignees.push({
          id: teamId,
          name: team?.display_name || team?.name || `Team ${teamId}`,
          type: 'team',
          isCompleted: !!assigneeCompletions[`team_${teamId}`]
        });
      });
    }

    // Fallback to assigned_to if no assignees array
    if (assignees.length === 0 && task.assigned_to) {
      const member = teamMembers.find(m => (m.user_id || m.id) === task.assigned_to);
      assignees.push({
        id: task.assigned_to,
        name: task.assigned_to_name || member?.display_name || member?.name || `User ${task.assigned_to.slice(0, 6)}`,
        type: 'user',
        isCompleted: !!assigneeCompletions[task.assigned_to]
      });
    }

    return assignees;
  }, [task, teamMembers, userTeams, assigneeCompletions]);

  // API calls
  const effectiveWorkspaceId = workspaceId || task?.workspace_id;
  const effectiveThreadId = threadId || task?.thread_id;

  const handleMarkComplete = async () => {
    if (!permissions.canMarkDone || !effectiveWorkspaceId || !effectiveThreadId) return;

    try {
      setLoading(true);
      setError('');

      await api.put(
        `/workspaces/${effectiveWorkspaceId}/threads/${effectiveThreadId}/tasks/${task.id}`,
        { status: 'completed' }
      );

      onTaskUpdated?.();
      onClose();
    } catch (err) {
      console.error('Error marking task complete:', err);
      setError(err.response?.data?.message || 'Failed to mark task complete');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleteForUser = async (targetUserId) => {
    if (!permissions.canMarkDoneForOthers || !effectiveWorkspaceId || !effectiveThreadId) return;

    try {
      setLoading(true);
      setError('');

      await api.post(
        `/workspaces/${effectiveWorkspaceId}/threads/${effectiveThreadId}/tasks/${task.id}/complete/${targetUserId}`
      );

      // Update local state
      setAssigneeCompletions(prev => ({ ...prev, [targetUserId]: true }));
      onTaskUpdated?.();
    } catch (err) {
      console.error('Error marking complete for user:', err);
      setError(err.response?.data?.message || 'Failed to mark complete for user');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkIncompleteForUser = async (targetUserId) => {
    if (!permissions.canMarkDoneForOthers || !effectiveWorkspaceId || !effectiveThreadId) return;

    try {
      setLoading(true);
      setError('');

      await api.delete(
        `/workspaces/${effectiveWorkspaceId}/threads/${effectiveThreadId}/tasks/${task.id}/complete/${targetUserId}`
      );

      // Update local state
      setAssigneeCompletions(prev => {
        const updated = { ...prev };
        delete updated[targetUserId];
        return updated;
      });
      onTaskUpdated?.();
    } catch (err) {
      console.error('Error unmarking complete for user:', err);
      setError(err.response?.data?.message || 'Failed to unmark complete for user');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleteForAll = async () => {
    if (!permissions.canMarkDoneForOthers || !effectiveWorkspaceId || !effectiveThreadId) return;

    try {
      setLoading(true);
      setError('');

      await api.post(
        `/workspaces/${effectiveWorkspaceId}/threads/${effectiveThreadId}/tasks/${task.id}/complete-all`
      );

      onTaskUpdated?.();
      onClose();
    } catch (err) {
      console.error('Error marking complete for all:', err);
      setError(err.response?.data?.message || 'Failed to mark complete for all');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!permissions.canDelete || !effectiveWorkspaceId || !effectiveThreadId) return;

    const confirmed = window.confirm('Are you sure you want to delete this task? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setLoading(true);
      setError('');

      await api.delete(
        `/workspaces/${effectiveWorkspaceId}/threads/${effectiveThreadId}/tasks/${task.id}`
      );

      onTaskDeleted?.();
      onClose();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.response?.data?.message || 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!permissions.canEdit) return;
    onEdit?.(task);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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

  if (!task) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-xl">
      <div className="bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-xl font-semibold text-gray-900 break-words">
              {task.title}
            </h2>
            {task.workspace_name && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-purple-600">
                <Building2 className="w-4 h-4" />
                <span>{task.workspace_name}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Status and Priority */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[task.status]}`}>
              {STATUS_LABELS[task.status] || task.status}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority} Priority
            </span>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            {task.start_date && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Start</p>
                  <p className="text-sm text-gray-600">{formatDate(task.start_date)}</p>
                  {task.start_time && !task.is_all_day && (
                    <p className="text-sm text-gray-500">{formatTime(task.start_time)}</p>
                  )}
                </div>
              </div>
            )}

            {task.end_date && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">End</p>
                  <p className="text-sm text-gray-600">{formatDate(task.end_date)}</p>
                  {task.end_time && !task.is_all_day && (
                    <p className="text-sm text-gray-500">{formatTime(task.end_time)}</p>
                  )}
                </div>
              </div>
            )}

            {task.due_date && (
              <div className="flex items-start gap-2">
                <Flag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Due Date</p>
                  <p className="text-sm text-gray-600">{formatDate(task.due_date)}</p>
                </div>
              </div>
            )}

            {task.is_all_day && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600">All Day Event</span>
              </div>
            )}
          </div>

          {/* Assignees Section */}
          {allAssignees.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {isGroupTask ? 'Assignees' : 'Assigned To'}
              </h3>

              {isGroupTask && permissions.canMarkDoneForOthers ? (
                // Group task with admin controls
                <div className="space-y-2">
                  {allAssignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {assignee.type === 'team' ? (
                          <Users className="w-4 h-4 text-purple-500" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-gray-700">{assignee.name}</span>
                      </div>
                      <button
                        onClick={() => assignee.isCompleted
                          ? handleMarkIncompleteForUser(assignee.id)
                          : handleMarkCompleteForUser(assignee.id)
                        }
                        disabled={loading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          assignee.isCompleted
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        } disabled:opacity-50`}
                      >
                        {assignee.isCompleted ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Done
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4" />
                            Mark Done
                          </>
                        )}
                      </button>
                    </div>
                  ))}

                  {/* Mark All Complete Button */}
                  <button
                    onClick={handleMarkCompleteForAll}
                    disabled={loading}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark All Complete
                  </button>
                </div>
              ) : (
                // Simple assignee display (non-admin or single assignee)
                <div className="space-y-2">
                  {allAssignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      {assignee.isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-400" />
                      )}
                      {assignee.type === 'team' ? (
                        <Users className="w-4 h-4 text-purple-500" />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-700">{assignee.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          {/* Delete Button (left side) */}
          <div>
            {permissions.canDelete && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>

          {/* Edit and Done buttons (right side) */}
          <div className="flex items-center gap-3">
            {permissions.canEdit && onEdit && (
              <button
                onClick={handleEdit}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}

            {permissions.canMarkDone && task.status !== 'completed' && !isGroupTask && (
              <button
                onClick={handleMarkComplete}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Mark Done
              </button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

TaskDetailsModal.propTypes = {
  task: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  workspace: PropTypes.object,
  workspaceId: PropTypes.string,
  threadId: PropTypes.string,
  onTaskUpdated: PropTypes.func,
  onTaskDeleted: PropTypes.func,
  onEdit: PropTypes.func,
  teamMembers: PropTypes.array,
  userTeams: PropTypes.array,
};

export default TaskDetailsModal;
