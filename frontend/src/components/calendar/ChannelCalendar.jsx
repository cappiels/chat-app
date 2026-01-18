import React, { useState, useEffect } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { Building2 } from 'lucide-react';
import { auth } from '../../firebase';
import api from '../../utils/api';
import WorkspaceChannelPicker from './WorkspaceChannelPicker';
import ChannelPickerModal from './ChannelPickerModal';
import TaskDetailsModal from '../tasks/TaskDetailsModal';
import WeeklyEventModal from './WeeklyEventModal';

// Channel color mapping using our design tokens
const CHANNEL_COLORS = {
  blue: 'bg-channel-blue border-channel-blue text-white',
  green: 'bg-channel-green border-channel-green text-white', 
  purple: 'bg-channel-purple border-channel-purple text-white',
  orange: 'bg-channel-orange border-channel-orange text-white',
  pink: 'bg-channel-pink border-channel-pink text-white',
  teal: 'bg-channel-teal border-channel-teal text-white',
  indigo: 'bg-channel-indigo border-channel-indigo text-white',
  red: 'bg-channel-red border-channel-red text-white',
  yellow: 'bg-channel-yellow border-channel-yellow text-white',
  cyan: 'bg-channel-cyan border-channel-cyan text-white',
  rose: 'bg-channel-rose border-channel-rose text-white',
  violet: 'bg-channel-violet border-channel-violet text-white',
};

const STATUS_COLORS = {
  'pending': 'bg-gray-100 text-gray-700 border-gray-200',
  'in_progress': 'bg-blue-100 text-blue-700 border-blue-200',
  'completed': 'bg-green-100 text-green-700 border-green-200',
  'blocked': 'bg-red-100 text-red-700 border-red-200',
  'cancelled': 'bg-gray-100 text-gray-500 border-gray-200'
};

const PRIORITY_COLORS = {
  'low': 'border-l-gray-300',
  'medium': 'border-l-blue-500',
  'high': 'border-l-orange-500',
  'urgent': 'border-l-red-500'
};

const ChannelCalendar = ({ channel, workspace, workspaceId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [pickerSelection, setPickerSelection] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [userTeams, setUserTeams] = useState([]);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [taskCreationChannel, setTaskCreationChannel] = useState(null);

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
        return;
      }
      
      setTasks(response.data.tasks || []);
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
  const handleTaskClick = (task, e) => {
    e.stopPropagation();
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

  // Handle "New Task" button click
  const handleNewTaskClick = () => {
    // Check if multiple channels are selected
    if (pickerSelection?.channels?.length > 1) {
      // Show channel picker modal to select one
      setShowChannelPicker(true);
    } else if (pickerSelection?.channels?.length === 1) {
      // Single channel selected - use it directly
      setTaskCreationChannel(pickerSelection.channels[0]);
      setShowTaskModal(true);
    } else if (pickerSelection?.channel) {
      // Single channel selected (backwards compat)
      setTaskCreationChannel({
        workspaceId: pickerSelection.workspace?.id,
        channelId: pickerSelection.channel.id,
        channel: pickerSelection.channel
      });
      setShowTaskModal(true);
    } else if (channel && workspaceId) {
      // Fall back to props
      setTaskCreationChannel({
        workspaceId: workspaceId,
        channelId: channel.id,
        channel: channel
      });
      setShowTaskModal(true);
    }
  };

  // Handle channel selected from picker modal
  const handleChannelPickedForTask = (channelData) => {
    setTaskCreationChannel(channelData);
    setShowChannelPicker(false);
    setShowTaskModal(true);
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

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar helpers
  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameMonth = (date) => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  // Get tasks for a specific date
  const getTasksForDate = (date) => {
    const dateStr = formatDate(date);
    return tasks.filter(task => {
      if (task.is_all_day) {
        // For all-day tasks, check if date falls between start_date and end_date
        const startDate = task.start_date ? new Date(task.start_date) : null;
        const endDate = task.end_date ? new Date(task.end_date) : startDate;
        
        if (startDate) {
          const taskStartStr = formatDate(startDate);
          const taskEndStr = formatDate(endDate || startDate);
          return dateStr >= taskStartStr && dateStr <= taskEndStr;
        }
      } else {
        // For timed tasks, check start_date
        if (task.start_date) {
          const taskDateStr = formatDate(new Date(task.start_date));
          return taskDateStr === dateStr;
        }
      }
      
      // Check due_date as fallback
      if (task.due_date) {
        const dueDateStr = formatDate(new Date(task.due_date));
        return dueDateStr === dateStr;
      }
      
      return false;
    });
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Previous month's days
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, daysInPrevMonth - i);
      days.push({
        date,
        isCurrentMonth: false,
        tasks: getTasksForDate(date)
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      days.push({
        date,
        isCurrentMonth: true,
        tasks: getTasksForDate(date)
      });
    }

    // Next month's days to complete the grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, nextMonthDay);
      days.push({
        date,
        isCurrentMonth: false,
        tasks: getTasksForDate(date)
      });
      nextMonthDay++;
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-8 h-8 text-error-600" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load calendar</h3>
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
    <div className="calendar-view">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-semibold text-text-primary">
            {pickerSelection?.showAllWorkspaces 
              ? 'All Workspaces Calendar'
              : pickerSelection?.workspace && !pickerSelection?.channel
                ? `${pickerSelection.workspace.name} Calendar`
                : channel 
                  ? `#${channel.name} Calendar`
                  : 'Calendar'
            }
          </h2>
          <div className="text-sm text-text-tertiary">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
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
            onClick={goToToday}
            className="btn btn-secondary text-sm"
          >
            Today
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousMonth}
              className="btn-icon"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            
            <div className="min-w-[180px] text-center">
              <h3 className="text-lg font-semibold text-text-primary">
                {formatMonthYear(currentDate)}
              </h3>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="btn-icon"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          {/* New Task button - requires a channel to be selected (or multiple for picker) */}
          {(pickerSelection?.channels?.length > 0 || pickerSelection?.channel || channel) ? (
            <button
              onClick={handleNewTaskClick}
              className="btn btn-primary"
            >
              <PlusIcon className="w-4 h-4" />
              New Task
            </button>
          ) : (
            <div className="relative group">
              <button
                disabled
                className="btn btn-primary opacity-50 cursor-not-allowed"
                title="Select a workspace and channel to create tasks"
              >
                <PlusIcon className="w-4 h-4" />
                New Task
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Select a workspace and channel first
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-surface-elevated rounded-xl shadow-sm border border-border-primary overflow-hidden">
          {/* Week Headers */}
          <div className="grid grid-cols-7 bg-surface-secondary border-b border-border-primary">
            {weekDays.map((day) => (
              <div key={day} className="p-4 text-center">
                <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  {day}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((dayData, index) => (
              <div
                key={index}
                className={`calendar-day relative border-r border-b border-border-primary/30 ${
                  !dayData.isCurrentMonth ? 'bg-surface-tertiary/50' : ''
                } ${isToday(dayData.date) ? 'bg-accent-50/50' : ''}`}
                onClick={() => setSelectedDate(dayData.date)}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    !dayData.isCurrentMonth 
                      ? 'text-text-quaternary' 
                      : isToday(dayData.date) 
                        ? 'text-accent-600 font-bold' 
                        : 'text-text-secondary'
                  }`}>
                    {dayData.date.getDate()}
                  </span>
                  {dayData.tasks.length > 0 && (
                    <span className="text-xs font-bold text-text-tertiary">
                      {dayData.tasks.length}
                    </span>
                  )}
                </div>

                {/* Tasks */}
                <div className="space-y-1">
                  {dayData.tasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className={`calendar-task p-1.5 rounded text-xs border ${STATUS_COLORS[task.status]} ${PRIORITY_COLORS[task.priority]} transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5`}
                      title={`${task.title}${task.workspace_name ? ` - ${task.workspace_name}` : ''}${task.assigned_to_name ? ` - ${task.assigned_to_name}` : ''}`}
                      onClick={(e) => handleTaskClick(task, e)}
                    >
                      <div className="flex items-center gap-1.5">
                        {task.is_all_day ? (
                          <CalendarIcon className="w-3 h-3 flex-shrink-0 opacity-75" />
                        ) : (
                          <ClockIcon className="w-3 h-3 flex-shrink-0 opacity-75" />
                        )}
                        <span className="font-medium truncate flex-1">
                          {task.title}
                        </span>
                      </div>
                      
                      {/* Show workspace badge if viewing multiple workspaces */}
                      {pickerSelection?.showAllWorkspaces && task.workspace_name && (
                        <div className="flex items-center gap-1 mt-1 opacity-75">
                          <Building2 className="w-2.5 h-2.5" />
                          <span className="text-[10px] truncate">
                            {task.workspace_name}
                          </span>
                        </div>
                      )}
                      
                      {task.assigned_to_name && (
                        <div className="flex items-center gap-1 mt-1 opacity-75">
                          <UserIcon className="w-2.5 h-2.5" />
                          <span className="text-[10px] truncate">
                            {task.assigned_to_name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {dayData.tasks.length > 3 && (
                    <div className="text-xs text-text-tertiary p-1 text-center">
                      +{dayData.tasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Creation Modal - Placeholder for now */}
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
      <TaskDetailsModal
        task={selectedTask}
        isOpen={!!selectedTask && !isEditMode}
        onClose={() => setSelectedTask(null)}
        workspace={pickerSelection?.workspace || workspace}
        workspaceId={selectedTask?.workspace_id || pickerSelection?.workspace?.id || workspaceId}
        threadId={selectedTask?.thread_id || pickerSelection?.channel?.id || channel?.id}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
        onEdit={handleEditTask}
        teamMembers={teamMembers}
        userTeams={userTeams}
      />

      {/* Edit Task Modal - only render when we have valid task data */}
      {isEditMode && selectedTask && (
        <WeeklyEventModal
          task={selectedTask}
          isNew={false}
          isOpen={true}
          onClose={handleEditModalClose}
          onSubmit={handleEditModalSubmit}
          onDelete={async () => {
            const taskWorkspaceId = selectedTask.workspace_id || pickerSelection?.workspace?.id || workspaceId;
            const taskThreadId = selectedTask.thread_id || pickerSelection?.channel?.id || channel?.id;
            await api.delete(`/workspaces/${taskWorkspaceId}/threads/${taskThreadId}/tasks/${selectedTask.id}`);
            handleTaskDeleted();
          }}
          workspaceId={selectedTask.workspace_id || pickerSelection?.workspace?.id || workspaceId || ''}
          threadId={selectedTask.thread_id || pickerSelection?.channel?.id || channel?.id || ''}
          teamMembers={teamMembers}
          userTeams={userTeams}
        />
      )}

      {/* Channel Picker Modal for multi-select task creation */}
      <ChannelPickerModal
        isOpen={showChannelPicker}
        onClose={() => setShowChannelPicker(false)}
        selectedChannels={pickerSelection?.channels || []}
        workspaces={pickerSelection?.workspaces || []}
        onChannelSelected={handleChannelPickedForTask}
        title="Select a Channel"
        description="You have multiple channels selected. Please choose which channel to create the task in:"
      />
    </div>
  );
};

export default ChannelCalendar;
