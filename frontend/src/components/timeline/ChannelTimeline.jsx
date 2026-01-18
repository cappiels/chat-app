import React, { useState, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ChartBarIcon,
  ClockIcon,
  UserIcon,
  ArrowRightIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { Building2 } from 'lucide-react';
import { auth } from '../../firebase';
import api from '../../utils/api';
import WorkspaceChannelPicker from '../calendar/WorkspaceChannelPicker';
import TaskDetailsModal from '../tasks/TaskDetailsModal';
import WeeklyEventModal from '../calendar/WeeklyEventModal';

const STATUS_COLORS = {
  'pending': 'bg-gray-400',
  'in_progress': 'bg-blue-500',
  'completed': 'bg-green-500',
  'blocked': 'bg-red-500',
  'cancelled': 'bg-gray-300'
};

const PRIORITY_COLORS = {
  'low': 'border-gray-300',
  'medium': 'border-blue-500',
  'high': 'border-orange-500',
  'urgent': 'border-red-500'
};

const ChannelTimeline = ({ channel, workspace, workspaceId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timelineStart, setTimelineStart] = useState(null);
  const [timelineEnd, setTimelineEnd] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [pickerSelection, setPickerSelection] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [userTeams, setUserTeams] = useState([]);

  // Fetch tasks from API - supports both single channel and multi-workspace views
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      if (pickerSelection?.showAllWorkspaces) {
        // Fetch tasks from ALL workspaces using global tasks API
        response = await api.get('/tasks/all');
      } else if (pickerSelection?.workspace && !pickerSelection?.channel) {
        // Fetch tasks from all channels in specific workspace
        const workspaceIds = [pickerSelection.workspace.id].join(',');
        response = await api.get(`/tasks/all?workspace_ids=${workspaceIds}`);
      } else if (pickerSelection?.channel) {
        // Fetch tasks from specific channel
        response = await api.get(`/workspaces/${pickerSelection.workspace.id}/threads/${pickerSelection.channel.id}/tasks`);
      } else if (channel?.id && workspaceId) {
        // Fallback to current channel (original behavior)
        response = await api.get(`/workspaces/${workspaceId}/threads/${channel.id}/tasks`);
      } else {
        setTasks([]);
        setLoading(false);
        setTimelineStart(new Date());
        setTimelineEnd(new Date());
        return;
      }
      
      const tasksData = response.data.tasks || [];
      setTasks(tasksData);
      
      // Calculate timeline bounds
      if (tasksData.length > 0) {
        const dates = tasksData.reduce((acc, task) => {
          if (task.start_date) acc.push(new Date(task.start_date));
          if (task.end_date) acc.push(new Date(task.end_date));
          if (task.due_date) acc.push(new Date(task.due_date));
          return acc;
        }, []);
        
        if (dates.length > 0) {
          const minDate = new Date(Math.min(...dates));
          const maxDate = new Date(Math.max(...dates));
          
          // Add padding to timeline
          const startPadding = new Date(minDate);
          startPadding.setDate(startPadding.getDate() - 7);
          
          const endPadding = new Date(maxDate);
          endPadding.setDate(endPadding.getDate() + 7);
          
          setTimelineStart(startPadding);
          setTimelineEnd(endPadding);
        } else {
          // Default to current month if no dates
          const today = new Date();
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          setTimelineStart(start);
          setTimelineEnd(end);
        }
      } else {
        // Default to current month if no tasks
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setTimelineStart(start);
        setTimelineEnd(end);
      }
    } catch (err) {
      console.error('Error fetching channel tasks:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [pickerSelection, channel?.id, workspaceId]);

  // Fetch team members and teams for the current workspace/channel context
  const fetchTeamData = async (wsId, chId) => {
    if (!wsId || !chId) return;
    try {
      const [threadResponse, teamsResponse] = await Promise.all([
        api.get(`/workspaces/${wsId}/threads/${chId}`),
        api.get(`/workspaces/${wsId}/teams`)
      ]);
      setTeamMembers(threadResponse.data?.members || []);
      setUserTeams(teamsResponse.data?.teams || []);
    } catch (err) {
      console.error('Error fetching team data:', err);
    }
  };

  // Handle task click
  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setIsEditMode(false);

    // Fetch team data for the task's workspace/channel
    const taskWorkspaceId = task.workspace_id || pickerSelection?.workspace?.id || workspaceId;
    const taskThreadId = task.thread_id || pickerSelection?.channel?.id || channel?.id;
    if (taskWorkspaceId && taskThreadId) {
      fetchTeamData(taskWorkspaceId, taskThreadId);
    }
  };

  // Handle task updated
  const handleTaskUpdated = () => {
    fetchTasks();
    setSelectedTask(null);
    setIsEditMode(false);
  };

  // Handle task deleted
  const handleTaskDeleted = () => {
    fetchTasks();
    setSelectedTask(null);
    setIsEditMode(false);
  };

  // Handle edit task
  const handleEditTask = (task) => {
    setIsEditMode(true);
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setIsEditMode(false);
    setSelectedTask(null);
  };

  // Handle edit modal submit
  const handleEditModalSubmit = async (taskData) => {
    const taskWorkspaceId = selectedTask.workspace_id || pickerSelection?.workspace?.id || workspaceId;
    const taskThreadId = selectedTask.thread_id || pickerSelection?.channel?.id || channel?.id;

    await api.put(
      `/workspaces/${taskWorkspaceId}/threads/${taskThreadId}/tasks/${selectedTask.id}`,
      taskData
    );
    handleTaskUpdated();
  };

  // Timeline helpers
  const formatDateRange = (start, end) => {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    if (start && end) {
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
    } else if (start) {
      return start.toLocaleDateString('en-US', options);
    }
    return 'No dates';
  };

  const getDaysDifference = (start, end) => {
    if (!start || !end) return 0;
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  };

  const getTimelinePosition = (date, totalDays) => {
    if (!date || !timelineStart || !timelineEnd) return 0;
    const taskDate = new Date(date);
    const startTime = timelineStart.getTime();
    const endTime = timelineEnd.getTime();
    const taskTime = taskDate.getTime();
    
    if (taskTime < startTime) return 0;
    if (taskTime > endTime) return 100;
    
    return ((taskTime - startTime) / (endTime - startTime)) * 100;
  };

  const getTaskBarWidth = (task) => {
    if (!timelineStart || !timelineEnd) return 0;
    
    const startDate = task.start_date ? new Date(task.start_date) : null;
    const endDate = task.end_date ? new Date(task.end_date) : startDate;
    
    if (!startDate || !endDate) return 5; // Minimum width for milestone
    
    const totalTimelineMs = timelineEnd.getTime() - timelineStart.getTime();
    const taskDurationMs = endDate.getTime() - startDate.getTime();
    
    const width = (taskDurationMs / totalTimelineMs) * 100;
    return Math.max(width, 2); // Minimum 2% width
  };

  const getTaskBarLeft = (task) => {
    const startDate = task.start_date ? new Date(task.start_date) : null;
    if (!startDate) return 0;
    return getTimelinePosition(startDate);
  };

  // Generate timeline weeks for header
  const generateTimelineWeeks = () => {
    if (!timelineStart || !timelineEnd) return [];
    
    const weeks = [];
    const current = new Date(timelineStart);
    
    while (current <= timelineEnd) {
      weeks.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }
    
    return weeks;
  };

  const timelineWeeks = generateTimelineWeeks();

  // Group tasks by hierarchy (parent/child relationships)
  const organizeTaskHierarchy = (tasks) => {
    const taskMap = new Map();
    const rootTasks = [];
    
    // Create map for quick lookup
    tasks.forEach(task => taskMap.set(task.id, { ...task, children: [] }));
    
    // Organize hierarchy
    tasks.forEach(task => {
      const taskWithChildren = taskMap.get(task.id);
      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        // Add to parent's children
        const parent = taskMap.get(task.parent_task_id);
        parent.children.push(taskWithChildren);
      } else {
        // Root level task
        rootTasks.push(taskWithChildren);
      }
    });
    
    return rootTasks;
  };

  const organizedTasks = organizeTaskHierarchy(tasks);

  // Render task row recursively for hierarchy
  const renderTaskRow = (task, depth = 0) => {
    const hasStartEnd = task.start_date && task.end_date;
    const isCompleted = task.status === 'completed';
    const progress = task.actual_hours && task.estimated_hours 
      ? Math.min((task.actual_hours / task.estimated_hours) * 100, 100)
      : isCompleted ? 100 : 0;

    return (
      <React.Fragment key={task.id}>
        {/* Main task row */}
        <div className={`grid grid-cols-timeline gap-4 py-3 border-b border-border-primary/30 hover:bg-surface-hover/50 transition-colors duration-200 ${depth > 0 ? 'bg-surface-tertiary/30' : ''}`}>
          {/* Task Info */}
          <div className="flex items-center gap-3 pr-4" style={{ paddingLeft: `${depth * 24}px` }}>
            {depth > 0 && (
              <div className="w-4 h-px bg-border-secondary"></div>
            )}
            
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[task.status]} flex-shrink-0`} />
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary text-sm truncate">
                    {task.title}
                  </span>
                  {task.priority !== 'medium' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {task.priority}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {/* Show workspace badge if viewing multiple workspaces */}
                  {pickerSelection?.showAllWorkspaces && task.workspace_name && (
                    <div className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Building2 className="w-3 h-3" />
                      {task.workspace_name}
                    </div>
                  )}
                  
                  {task.assigned_to_name && (
                    <div className="flex items-center gap-1 text-xs text-text-tertiary">
                      <UserIcon className="w-3 h-3" />
                      {task.assigned_to_name}
                    </div>
                  )}
                  
                  {hasStartEnd && (
                    <div className="flex items-center gap-1 text-xs text-text-tertiary">
                      <CalendarDaysIcon className="w-3 h-3" />
                      {formatDateRange(new Date(task.start_date), new Date(task.end_date))}
                    </div>
                  )}
                  
                  {task.estimated_hours && (
                    <div className="flex items-center gap-1 text-xs text-text-tertiary">
                      <ClockIcon className="w-3 h-3" />
                      {task.estimated_hours}h
                      {task.actual_hours ? ` (${task.actual_hours}h actual)` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Bar */}
          <div className="relative h-8 flex items-center bg-surface-secondary/30 rounded overflow-hidden">
            {hasStartEnd ? (
              <div 
                className={`timeline-task-bar h-6 rounded-md flex items-center relative ${STATUS_COLORS[task.status]} ${PRIORITY_COLORS[task.priority]} border-l-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer`}
                style={{
                  left: `${getTaskBarLeft(task)}%`,
                  width: `${getTaskBarWidth(task)}%`,
                  minWidth: '32px'
                }}
                onClick={() => handleTaskClick(task)}
                title={`${task.title} - ${formatDateRange(new Date(task.start_date), new Date(task.end_date))}`}
              >
                {/* Progress bar */}
                {progress > 0 && (
                  <div 
                    className="absolute top-0 left-0 h-full bg-black/20 rounded-l"
                    style={{ width: `${progress}%` }}
                  />
                )}
                
                {/* Task title in bar if there's space */}
                <span className="text-xs font-medium px-2 text-white truncate">
                  {task.title}
                </span>
              </div>
            ) : (
              /* Milestone marker */
              <div
                className={`w-3 h-3 rotate-45 ${STATUS_COLORS[task.status]} border border-white shadow-sm cursor-pointer`}
                style={{ left: `${getTimelinePosition(task.due_date ? new Date(task.due_date) : new Date())}%` }}
                onClick={() => handleTaskClick(task)}
                title={`${task.title} - Milestone`}
              />
            )}
          </div>
        </div>

        {/* Render children recursively */}
        {task.children && task.children.length > 0 && task.children.map(child => 
          renderTaskRow(child, depth + 1)
        )}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ChartBarIcon className="w-8 h-8 text-error-600" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load timeline</h3>
          <p className="text-text-secondary mb-4">{error}</p>
          <button
            onClick={fetchTasks}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-view">
      {/* Timeline Header */}
      <div className="timeline-header">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-text-primary">
            {pickerSelection?.showAllWorkspaces 
              ? 'All Workspaces Timeline'
              : pickerSelection?.workspace && !pickerSelection?.channel
                ? `${pickerSelection.workspace.name} Timeline`
                : channel 
                  ? `#${channel.name} Timeline`
                  : 'Timeline'
            }
          </h2>
          <div className="text-sm text-text-tertiary">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {timelineStart && timelineEnd && (
              <span className="ml-2">
                • {formatDateRange(timelineStart, timelineEnd)}
              </span>
            )}
          </div>
          
          {/* Workspace/Channel Picker */}
          <WorkspaceChannelPicker
            currentWorkspace={workspace}
            currentChannel={channel}
            onSelectionChange={setPickerSelection}
            className="ml-auto"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTaskModal(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChartBarIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No tasks in #{channel.name}
              </h3>
              <p className="text-text-secondary mb-4">
                Create tasks to see them in timeline view. Tasks will show dependencies and progress.
              </p>
              <button
                onClick={() => setShowTaskModal(true)}
                className="btn btn-primary"
              >
                Create First Task
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-elevated">
            {/* Timeline Grid Header */}
            <div className="grid grid-cols-timeline gap-4 py-3 border-b border-border-strong bg-surface-secondary/50 sticky top-0 z-10">
              <div className="px-4">
                <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  Tasks
                </span>
              </div>
              
              <div className="relative">
                <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  Timeline
                </span>
                
                {/* Week markers */}
                <div className="flex absolute top-6 left-0 right-0 h-4">
                  {timelineWeeks.map((week, index) => (
                    <div 
                      key={index}
                      className="flex-1 text-xs text-text-quaternary border-l border-border-primary/30 pl-1"
                      style={{ width: `${100 / timelineWeeks.length}%` }}
                    >
                      {week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Task Rows */}
            <div className="relative">
              {/* Week grid lines */}
              <div className="absolute inset-0 grid grid-cols-timeline gap-4">
                <div></div>
                <div className="relative">
                  {timelineWeeks.map((_, index) => (
                    <div 
                      key={index}
                      className="absolute top-0 bottom-0 border-l border-border-primary/20"
                      style={{ left: `${(index / (timelineWeeks.length - 1)) * 100}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Tasks */}
              {organizedTasks.map(task => renderTaskRow(task))}
            </div>
          </div>
        )}
      </div>

      {/* Task Modal - Placeholder */}
      {showTaskModal && (
        <div className="modal-backdrop">
          <div className="modal w-modal-lg">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Create New Task
              </h3>
              <p className="text-text-secondary mb-6">
                Task creation modal will be implemented in the next iteration.
                For now, you can create tasks via the /task command in chat.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && !isEditMode && (
        <TaskDetailsModal
          task={selectedTask}
          isOpen={!!selectedTask && !isEditMode}
          onClose={() => setSelectedTask(null)}
          workspace={pickerSelection?.workspace || workspace}
          workspaceId={selectedTask.workspace_id || pickerSelection?.workspace?.id || workspaceId}
          threadId={selectedTask.thread_id || pickerSelection?.channel?.id || channel?.id}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
          onEdit={handleEditTask}
          teamMembers={teamMembers}
          userTeams={userTeams}
        />
      )}

      {/* Edit Task Modal */}
      {isEditMode && selectedTask && (
        <WeeklyEventModal
          task={selectedTask}
          isNew={false}
          isOpen={isEditMode}
          onClose={handleEditModalClose}
          onSubmit={handleEditModalSubmit}
          onDelete={async () => {
            const taskWorkspaceId = selectedTask.workspace_id || pickerSelection?.workspace?.id || workspaceId;
            const taskThreadId = selectedTask.thread_id || pickerSelection?.channel?.id || channel?.id;
            await api.delete(`/workspaces/${taskWorkspaceId}/threads/${taskThreadId}/tasks/${selectedTask.id}`);
            handleTaskDeleted();
          }}
          workspaceId={selectedTask.workspace_id || pickerSelection?.workspace?.id || workspaceId}
          threadId={selectedTask.thread_id || pickerSelection?.channel?.id || channel?.id}
          teamMembers={teamMembers}
          userTeams={userTeams}
        />
      )}
    </div>
  );
};

export default ChannelTimeline;
