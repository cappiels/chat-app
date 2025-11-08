import React, { useState, useEffect } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PlusIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';

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

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/threads/${channel.id}/tasks`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Error fetching channel tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (channel?.id && workspaceId) {
      fetchTasks();
    }
  }, [channel?.id, workspaceId]);

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
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-text-primary">
            #{channel.name} Calendar
          </h2>
          <div className="text-sm text-text-tertiary">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </div>
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

          <button
            onClick={() => setShowTaskModal(true)}
            className="btn btn-primary"
          >
            <PlusIcon className="w-4 h-4" />
            New Task
          </button>
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
                      className={`calendar-task p-1.5 rounded text-xs border ${STATUS_COLORS[task.status]} ${PRIORITY_COLORS[task.priority]} transition-all duration-200`}
                      title={`${task.title}${task.assigned_to_name ? ` - ${task.assigned_to_name}` : ''}`}
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
    </div>
  );
};

export default ChannelCalendar;
