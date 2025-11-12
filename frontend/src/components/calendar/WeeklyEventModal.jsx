import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Calendar, Clock, Users, Flag, Trash2, MapPin, Tag } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import TagsInput from '../ui/TagsInput';

const WeeklyEventModal = ({
  task = null,
  isNew = false,
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  workspaceId,
  threadId,
  teamMembers = [],
  userTeams = []
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    is_all_day: false,
    assignees: [],
    assigned_teams: [],
    priority: 'medium',
    assignment_mode: 'collaborative',
    due_date: '',
    tags: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form data when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        location: task.location || '',
        start_date: task.start_date || '',
        end_date: task.end_date || task.start_date || '',
        start_time: task.start_time || '',
        end_time: task.end_time || '',
        is_all_day: task.is_all_day || false,
        assignees: task.assignees || [],
        assigned_teams: task.assigned_teams || [],
        priority: task.priority || 'medium',
        assignment_mode: task.assignment_mode || 'collaborative',
        due_date: task.due_date || '',
        tags: task.tags || []
      });
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!formData.start_date) {
      setError('Start date is required');
      return;
    }
    
    try {
      setLoading(true);
      
      const taskData = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        // Ensure end_date is set
        end_date: formData.end_date || formData.start_date,
        // Clean up time fields for all-day events
        start_time: formData.is_all_day ? null : formData.start_time,
        end_time: formData.is_all_day ? null : formData.end_time,
        // Ensure arrays are properly formatted
        assignees: Array.isArray(formData.assignees) ? formData.assignees : [],
        assigned_teams: Array.isArray(formData.assigned_teams) ? formData.assigned_teams : [],
        tags: Array.isArray(formData.tags) ? formData.tags : []
      };
      
      await onSubmit(taskData);
    } catch (error) {
      console.error('Error submitting task:', error);
      setError(error.response?.data?.message || error.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this task?');
    if (!confirmed) return;
    
    try {
      setLoading(true);
      await onDelete();
    } catch (error) {
      console.error('Error deleting task:', error);
      setError(error.response?.data?.message || error.message || 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const handleAssigneeChange = (memberId, checked) => {
    setFormData(prev => ({
      ...prev,
      assignees: checked 
        ? [...prev.assignees, memberId]
        : prev.assignees.filter(id => id !== memberId)
    }));
  };

  const handleTeamChange = (teamId, checked) => {
    setFormData(prev => ({
      ...prev,
      assigned_teams: checked 
        ? [...prev.assigned_teams, teamId]
        : prev.assigned_teams.filter(id => id !== teamId)
    }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-2xl">
      <div className="bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isNew ? 'Create Task' : 'Edit Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter task title..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a description..."
              />
            </div>
          </div>

          {/* Location and Tags */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Location</label>
              </div>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add location (e.g., Conference Room A, Remote, Office)"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Tags</label>
              </div>
              <TagsInput
                tags={formData.tags}
                onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                workspaceId={workspaceId}
                placeholder="Add tags (e.g., urgent, meeting, development)"
              />
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900">Schedule</h3>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="all-day"
                checked={formData.is_all_day}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  is_all_day: e.target.checked,
                  start_time: e.target.checked ? '' : prev.start_time,
                  end_time: e.target.checked ? '' : prev.end_time
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="all-day" className="text-sm text-gray-700">
                All day
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    start_date: e.target.value,
                    end_date: prev.end_date || e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {!formData.is_all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Priority</label>
            </div>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assignees */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900">Assign to</h3>
            </div>

            {/* Team Members */}
            {teamMembers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Team Members</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {teamMembers.map(member => (
                    <label key={member.user_id || member.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.assignees.includes(member.user_id || member.id)}
                        onChange={(e) => handleAssigneeChange(member.user_id || member.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {member.display_name || member.name || member.email}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Teams */}
            {userTeams.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Teams</h4>
                <div className="space-y-2">
                  {userTeams.map(team => (
                    <label key={team.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.assigned_teams.includes(team.id)}
                        onChange={(e) => handleTeamChange(team.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span 
                        className="text-sm font-medium"
                        style={{ color: team.color || '#6b7280' }}
                      >
                        {team.display_name || team.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Assignment Mode */}
            {(formData.assignees.length > 1 || formData.assigned_teams.length > 0) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignment Mode
                </label>
                <select
                  value={formData.assignment_mode}
                  onChange={(e) => setFormData(prev => ({ ...prev, assignment_mode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="collaborative">Collaborative (any assignee can complete)</option>
                  <option value="individual_response">Individual Response (all must complete)</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {!isNew && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isNew ? 'Create Task' : 'Update Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Dialog>
  );
};

WeeklyEventModal.propTypes = {
  task: PropTypes.object,
  isNew: PropTypes.bool,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  workspaceId: PropTypes.string.isRequired,
  threadId: PropTypes.string.isRequired,
  teamMembers: PropTypes.array,
  userTeams: PropTypes.array,
};

export default WeeklyEventModal;
