import React, { useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/Dialog';
import TagsInput from '../ui/TagsInput';
import { auth } from '../../firebase';

const QuickTaskDialog = ({ 
  isOpen, 
  onClose, 
  channel, 
  workspaceId,
  currentUser,
  onTaskCreated 
}) => {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDueDate, setEndDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log('QuickTaskDialog render:', { isOpen, channel, workspaceId, currentUser });

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('QuickTaskDialog handleSubmit:', { title, startDate, endDueDate, startTime, endTime, priority });
    
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    if (!workspaceId || !channel?.id) {
      setError('Missing workspace or channel information');
      return;
    }

    // Validate times - must have both start & end time or neither
    if ((startTime && !endTime) || (!startTime && endTime)) {
      setError('Please provide both start and end times, or leave both empty for all-day');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get Firebase auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      let token = null;
      try {
        token = await user.getIdToken(true); // Force refresh
      } catch (tokenError) {
        console.error('Failed to get auth token:', tokenError);
        throw new Error('Authentication failed - please sign in again');
      }

      // Smart logic based on user input
      let taskData = {
        title: title.trim(),
        location: location.trim() || null,
        tags: tags.length > 0 ? tags : [],
        priority,
        status: 'pending',
        assigned_to: currentUser?.id || currentUser?.uid
      };

      // Handle different scenarios
      if (startTime && endTime) {
        // Has times - timed event
        taskData.start_date = startDate || null;
        taskData.end_date = endDueDate || null;
        taskData.due_date = endDueDate || null;
        taskData.start_time = startTime;
        taskData.end_time = endTime;
        taskData.is_all_day = false;
      } else if (endDueDate && !startDate) {
        // Has due date but no start date - all day task
        taskData.start_date = endDueDate;
        taskData.end_date = endDueDate;
        taskData.due_date = endDueDate;
        taskData.is_all_day = true;
      } else if (startDate && endDueDate) {
        // Has both start and end dates - all day event
        taskData.start_date = startDate;
        taskData.end_date = endDueDate;
        taskData.due_date = endDueDate;
        taskData.is_all_day = true;
      } else if (startDate) {
        // Has only start date - single day all day
        taskData.start_date = startDate;
        taskData.end_date = startDate;
        taskData.due_date = startDate;
        taskData.is_all_day = true;
      } else {
        // No dates - just a task with no scheduling
        taskData.due_date = null;
        taskData.start_date = null;
        taskData.end_date = null;
        // Don't set is_all_day for tasks with no dates
      }

      console.log('Creating task with data:', taskData, 'Auth token available:', !!token);

      const response = await fetch(`/api/workspaces/${workspaceId}/threads/${channel.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create task');
      }

      const result = await response.json();
      console.log('Task created successfully:', result);
      
      // Reset form
      setTitle('');
      setLocation('');
      setTags([]);
      setStartDate('');
      setEndDueDate('');
      setStartTime('');
      setEndTime('');
      setPriority('medium');
      setError(null);
      
      // Notify parent component
      if (onTaskCreated) {
        onTaskCreated(result.task);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating task:', err);
      setError(`Failed to create task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    console.log('QuickTaskDialog closing');
    // Reset form when closing
    setTitle('');
    setLocation('');
    setTags([]);
    setStartDate('');
    setEndDueDate('');
    setStartTime('');
    setEndTime('');
    setPriority('medium');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogContent className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4 px-6">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Add Task to #{channel?.name || 'channel'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
              required
            />
          </div>

          {/* Location Field */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 text-gray-500" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Conference Room A, Home Office, Remote..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Tags Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <TagsInput
              value={tags}
              onChange={setTags}
              placeholder="Add tags..."
              suggestions={[
                'meeting', 'urgent', 'development', 'design', 'marketing', 
                'review', 'testing', 'deployment', 'bug', 'feature'
              ]}
              allowNew={true}
              maxTags={8}
              className="w-full"
            />
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End/Due Date
              </label>
              <input
                type="date"
                value={endDueDate}
                onChange={(e) => setEndDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Time Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Smart Helper Text */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
            <strong>Smart Tips:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Add times for scheduled events</li>
              <li>• Leave times empty for all-day tasks</li>
              <li>• Tasks with no dates won't appear on calendar</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Add Task
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickTaskDialog;
