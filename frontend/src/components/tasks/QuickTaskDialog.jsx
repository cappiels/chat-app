import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, UserCheck } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/Dialog';
import TagsInput from '../ui/TagsInput';
import { auth } from '../../firebase';
import { workspaceAPI } from '../../utils/api';

const QuickTaskDialog = ({
  isOpen,
  onClose,
  channel,
  workspaceId,
  currentUser,
  onTaskCreated,
  workspaces // Optional: for workspace/channel selection when no workspaceId provided
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

  // 🚀 NEW: Assignment functionality
  const [assignees, setAssignees] = useState([]);
  const [assignedTeams, setAssignedTeams] = useState([]);
  const [assignmentMode, setAssignmentMode] = useState('collaborative');
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [workspaceTeams, setWorkspaceTeams] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAssignmentSection, setShowAssignmentSection] = useState(true);

  // 🚀 NEW: Workspace/channel selection for Today screen
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId || '');
  const [selectedChannelId, setSelectedChannelId] = useState(channel?.id || '');
  const [availableChannels, setAvailableChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Effective workspace and channel (from props or selection)
  const effectiveWorkspaceId = workspaceId || selectedWorkspaceId;
  const effectiveChannel = channel || availableChannels.find(c => c.id === selectedChannelId);

  console.log('QuickTaskDialog render:', { isOpen, channel, workspaceId, currentUser, workspaces });

  // Load channels when workspace is selected (for Today screen mode)
  useEffect(() => {
    if (isOpen && !workspaceId && selectedWorkspaceId) {
      loadChannelsForWorkspace(selectedWorkspaceId);
    }
  }, [isOpen, workspaceId, selectedWorkspaceId]);

  // Reset selection when dialog opens without workspaceId
  useEffect(() => {
    if (isOpen && !workspaceId && workspaces?.length > 0) {
      // Auto-select first workspace if none selected
      if (!selectedWorkspaceId) {
        setSelectedWorkspaceId(workspaces[0].id);
      }
    }
  }, [isOpen, workspaceId, workspaces]);

  const loadChannelsForWorkspace = async (wsId) => {
    setLoadingChannels(true);
    try {
      const response = await workspaceAPI.getWorkspace(wsId);
      const channels = response.data.workspace.channels || [];
      setAvailableChannels(channels);
      // Auto-select first channel
      if (channels.length > 0 && !selectedChannelId) {
        setSelectedChannelId(channels[0].id);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      setAvailableChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  // 🚀 NEW: Load workspace members and teams when dialog opens
  useEffect(() => {
    if (isOpen && effectiveWorkspaceId) {
      loadWorkspaceData();
    }
  }, [isOpen, effectiveWorkspaceId]);

  const loadWorkspaceData = async () => {
    if (!effectiveWorkspaceId) return;
    setLoadingMembers(true);
    try {
      // Load workspace members
      const workspaceResponse = await workspaceAPI.getWorkspace(effectiveWorkspaceId);
      const members = workspaceResponse.data.workspace.members || [];
      setWorkspaceMembers(members);

      // Load workspace teams
      try {
        const teamsResponse = await workspaceAPI.getTeams(effectiveWorkspaceId);
        setWorkspaceTeams(teamsResponse.data.teams || []);
      } catch (teamError) {
        console.warn('Teams not available:', teamError);
        setWorkspaceTeams([]);
      }

      // Auto-assign to current user by default
      if (currentUser?.id || currentUser?.uid) {
        setAssignees([currentUser.id || currentUser.uid]);
      }
    } catch (error) {
      console.error('Error loading workspace data:', error);
      setError('Failed to load workspace members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleAssignee = (memberId) => {
    setAssignees(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleTeam = (teamId) => {
    setAssignedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('QuickTaskDialog handleSubmit:', { title, startDate, endDueDate, startTime, endTime, priority });
    
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    if (!effectiveWorkspaceId || !effectiveChannel?.id) {
      setError('Please select a workspace and channel');
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
        // 🚀 NEW: Multi-assignee support
        assignees: assignees.length > 0 ? assignees : [],
        assigned_teams: assignedTeams.length > 0 ? assignedTeams : [],
        assignment_mode: assignmentMode,
        requires_individual_response: assignmentMode === 'individual_response',
        // Legacy support - keep for backward compatibility
        assigned_to: assignees.length > 0 ? assignees[0] : (currentUser?.id || currentUser?.uid)
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

      const response = await fetch(`/api/workspaces/${effectiveWorkspaceId}/threads/${effectiveChannel.id}/tasks`, {
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
      setAssignees([]);
      setAssignedTeams([]);
      setAssignmentMode('collaborative');
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
    setAssignees([]);
    setAssignedTeams([]);
    setAssignmentMode('collaborative');
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
            {workspaceId ? `Add Task to #${channel?.name || 'channel'}` : 'Create New Task'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Workspace/Channel Selection (when no workspaceId prop) */}
          {!workspaceId && workspaces && workspaces.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace
                </label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => {
                    setSelectedWorkspaceId(e.target.value);
                    setSelectedChannelId('');
                    setAvailableChannels([]);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                >
                  <option value="">Select workspace</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel
                </label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  disabled={!selectedWorkspaceId || loadingChannels}
                >
                  <option value="">{loadingChannels ? 'Loading...' : 'Select channel'}</option>
                  {availableChannels.map(ch => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              </div>
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

          {/* 🚀 NEW: Assignment Section */}
          <div className="border-t border-gray-200 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setShowAssignmentSection(!showAssignmentSection)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-2"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Assign To</span>
                {(assignees.length > 0 || assignedTeams.length > 0) && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {assignees.length + assignedTeams.length} selected
                  </span>
                )}
              </div>
              <span className="text-gray-400">{showAssignmentSection ? '▼' : '▶'}</span>
            </button>

            {showAssignmentSection && (
              <div className="space-y-3 pl-6">
                {/* Assignment Mode Toggle */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Assignment Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignmentMode('collaborative')}
                      className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors ${
                        assignmentMode === 'collaborative'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">Collaborative</div>
                      <div className="text-xs opacity-75">Anyone can complete</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentMode('individual_response')}
                      className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors ${
                        assignmentMode === 'individual_response'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">Individual Response</div>
                      <div className="text-xs opacity-75">Each must complete</div>
                    </button>
                  </div>
                </div>

                {/* Members Selection */}
                {loadingMembers ? (
                  <div className="text-center py-4 text-sm text-gray-500">
                    <div className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                    Loading members...
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        Team Members ({assignees.length} selected)
                      </label>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                        {workspaceMembers.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 text-center">
                            No members found
                          </div>
                        ) : (
                          workspaceMembers.map(member => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => toggleAssignee(member.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                                assignees.includes(member.id) ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className={`flex-shrink-0 w-4 h-4 border-2 rounded ${
                                assignees.includes(member.id)
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300'
                              } flex items-center justify-center`}>
                                {assignees.includes(member.id) && (
                                  <UserCheck className="w-3 h-3 text-white" />
                                )}
                              </div>
                              {member.profile_picture_url ? (
                                <img
                                  src={member.profile_picture_url}
                                  alt={member.display_name}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-medium text-white">
                                  {member.display_name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {member.display_name}
                                  {member.id === currentUser?.id && (
                                    <span className="text-xs text-gray-500 ml-1">(you)</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {member.email}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Teams Selection */}
                    {workspaceTeams.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Teams ({assignedTeams.length} selected)
                        </label>
                        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                          {workspaceTeams.map(team => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => toggleTeam(team.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                                assignedTeams.includes(team.id) ? 'bg-purple-50' : ''
                              }`}
                            >
                              <div className={`flex-shrink-0 w-4 h-4 border-2 rounded ${
                                assignedTeams.includes(team.id)
                                  ? 'bg-purple-600 border-purple-600'
                                  : 'border-gray-300'
                              } flex items-center justify-center`}>
                                {assignedTeams.includes(team.id) && (
                                  <UserCheck className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <div
                                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white`}
                                style={{ backgroundColor: `var(--${team.color}-500, #6366f1)` }}
                              >
                                {team.display_name?.charAt(0) || 'T'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {team.display_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {team.member_count || 0} members
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assignment Summary */}
                    {(assignees.length > 0 || assignedTeams.length > 0) && (
                      <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        <strong>Assignment:</strong>{' '}
                        {assignmentMode === 'collaborative' 
                          ? 'Any assignee can complete this task'
                          : `All ${assignees.length + assignedTeams.length} assignee(s) must complete individually`
                        }
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
