import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './WeeklyCalendar.css';
import WeeklyEventModal from './WeeklyEventModal';
import { auth } from '../../firebase';
import api from '../../utils/api';
import socketManager from '../../utils/socket';

const localizer = momentLocalizer(moment);

const WeeklyCalendar = ({
  channel,
  workspace,
  workspaceId,
  currentUser
}) => {
  // State management
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [userTeams, setUserTeams] = useState([]);
  const [currentView, setCurrentView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Optimistic updates and WebSocket race prevention
  const [optimisticTaskUpdates, setOptimisticTaskUpdates] = useState(new Map());
  const [websocketRacePreventionIds, setWebsocketRacePreventionIds] = useState(new Set());

  // Load tasks and related data
  const loadTasks = useCallback(async () => {
    if (!channel?.id || !workspace?.id) return;

    try {
      setLoading(true);
      setError('');

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
      
      const headers = { Authorization: `Bearer ${token}` };

      // Load tasks
      const tasksResponse = await api.get(
        `/workspaces/${workspace.id}/threads/${channel.id}/tasks`,
        { headers }
      );

      // Load thread details (includes members)
      const threadResponse = await api.get(
        `/workspaces/${workspace.id}/threads/${channel.id}`,
        { headers }
      );

      // Load teams
      const teamsResponse = await api.get(
        `/workspaces/${workspace.id}/teams`,
        { headers }
      );

      setTasks(tasksResponse.data?.tasks || []);
      setTeamMembers(threadResponse.data?.members || []);
      setUserTeams(teamsResponse.data?.teams || []);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setError('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [channel?.id, workspace?.id]);

  // Initial data load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Permission system
  const canEditTask = useCallback((task, user, members, teams) => {
    if (!user || !task) return false;
    
    // Task creator can always edit
    if (task.created_by === user.id) return true;
    
    // Direct assignee can edit
    if (task.assignees?.includes(user.id)) return true;
    
    // Team member can edit if assigned team
    if (task.assigned_teams?.length > 0) {
      const userTeamIds = teams
        .filter(team => team.members?.includes(user.id))
        .map(team => team.id);
      
      if (task.assigned_teams.some(teamId => userTeamIds.includes(teamId))) {
        return true;
      }
    }
    
    return false;
  }, []);

  // Transform tasks to calendar events
  const events = useMemo(() => {
    return tasks
      .filter(task => task.start_date) // Only tasks with dates
      .map(task => {
        // Apply optimistic updates if any
        const optimisticUpdate = optimisticTaskUpdates.get(task.id);
        const updatedTask = optimisticUpdate ? { ...task, ...optimisticUpdate } : task;
        
        const start = moment(updatedTask.start_date);
        const end = updatedTask.end_date ? moment(updatedTask.end_date) : start.clone();
        const isAllDay = updatedTask.is_all_day || !updatedTask.start_time;
        
        let eventStart, eventEnd;
        
        if (isAllDay) {
          eventStart = start.startOf('day').toDate();
          eventEnd = end.endOf('day').toDate();
        } else {
          const startTime = updatedTask.start_time ? `${updatedTask.start_date} ${updatedTask.start_time}` : updatedTask.start_date;
          const endTime = updatedTask.end_time ? `${updatedTask.end_date || updatedTask.start_date} ${updatedTask.end_time}` : 
                         moment(startTime).add(1, 'hour').format('YYYY-MM-DD HH:mm');
          
          eventStart = moment(startTime).toDate();
          eventEnd = moment(endTime).toDate();
        }

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          start: eventStart,
          end: eventEnd,
          allDay: isAllDay,
          // Task-specific data
          taskId: task.id,
          threadId: task.thread_id,
          workspaceId: task.workspace_id,
          assignees: task.assignees || [],
          assignedTeams: task.assigned_teams || [],
          status: task.status,
          priority: task.priority,
          assignmentMode: task.assignment_mode,
          completionProgress: task.completion_count,
          totalAssignees: (task.assignees?.length || 0) + (task.assigned_teams?.length || 0),
          createdBy: task.created_by,
          // Styling and interaction
          canEdit: canEditTask(updatedTask, currentUser, teamMembers, userTeams),
          // For custom rendering
          resource: {
            isOptimistic: !!optimisticUpdate,
            priority: task.priority,
            isMultiAssignee: (task.assignees?.length || 0) + (task.assigned_teams?.length || 0) > 1,
            progress: task.assignment_mode === 'individual_response' 
              ? `${task.completion_count || 0}/${(task.assignees?.length || 0) + (task.assigned_teams?.length || 0)}`
              : null
          }
        };
      });
  }, [tasks, optimisticTaskUpdates, canEditTask, currentUser, teamMembers, userTeams]);

  // Custom event component
  const EventComponent = ({ event }) => {
    const progressText = event.resource?.progress;
    const priority = event.resource?.priority || 'medium';
    const isMultiAssignee = event.resource?.isMultiAssignee;
    
    return (
      <div 
        className={`custom-event-content ${event.canEdit ? 'editable' : 'non-editable'}`}
        style={{ 
          position: 'relative',
          height: '100%',
          overflow: 'hidden'
        }}
        data-priority={priority}
      >
        <div className="event-title" style={{ fontWeight: 500, fontSize: '0.85em' }}>
          {event.title}
        </div>
        {event.description && (
          <div className="event-description" style={{ fontSize: '0.75em', opacity: 0.8 }}>
            {event.description.substring(0, 50)}
            {event.description.length > 50 ? '...' : ''}
          </div>
        )}
        {isMultiAssignee && progressText && (
          <div 
            className="progress-indicator"
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              fontSize: '0.625rem',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              lineHeight: '1'
            }}
          >
            {progressText}
          </div>
        )}
      </div>
    );
  };

  // API functions
  const handleTaskUpdate = useCallback(async (taskId, updatedData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const token = await user.getIdToken(true);
      
      const response = await api.put(
        `/workspaces/${workspace.id}/threads/${channel.id}/tasks/${taskId}`,
        updatedData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }, [workspace?.id, channel?.id]);

  const handleTaskCreate = useCallback(async (taskData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const token = await user.getIdToken(true);
      
      const response = await api.post(
        `/workspaces/${workspace.id}/threads/${channel.id}/tasks`,
        taskData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }, [workspace?.id, channel?.id]);

  const handleTaskDelete = useCallback(async (taskId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      const token = await user.getIdToken(true);
      
      await api.delete(
        `/workspaces/${workspace.id}/threads/${channel.id}/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }, [workspace?.id, channel?.id]);


  // Event selection and modal handlers
  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setIsNewEvent(false);
    setIsModalOpen(true);
  }, []);

  const handleSelectSlot = useCallback(({ start, end, action }) => {
    if (action === 'select' || action === 'click') {
      // Create new event at selected time
      const newEvent = {
        start_date: moment(start).format('YYYY-MM-DD'),
        end_date: moment(end).format('YYYY-MM-DD'),
        start_time: moment(start).format('HH:mm'),
        end_time: moment(end).format('HH:mm'),
        is_all_day: false
      };
      setSelectedEvent(newEvent);
      setIsNewEvent(true);
      setIsModalOpen(true);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setIsNewEvent(false);
    setError('');
  }, []);

  const handleModalSubmit = useCallback(async (taskData) => {
    try {
      if (isNewEvent) {
        const newTask = await handleTaskCreate(taskData);
        setTasks(prev => [...prev, newTask]);
      } else {
        const updatedTask = await handleTaskUpdate(selectedEvent.id, taskData);
        setTasks(prev => prev.map(task => 
          task.id === selectedEvent.id ? { ...task, ...updatedTask } : task
        ));
      }
      handleModalClose();
    } catch (error) {
      // Error is handled in modal
      throw error;
    }
  }, [isNewEvent, selectedEvent, handleTaskCreate, handleTaskUpdate, handleModalClose]);

  const handleModalDelete = useCallback(async () => {
    if (!selectedEvent?.id) return;
    
    try {
      await handleTaskDelete(selectedEvent.id);
      setTasks(prev => prev.filter(task => task.id !== selectedEvent.id));
      handleModalClose();
    } catch (error) {
      // Error is handled in modal
      throw error;
    }
  }, [selectedEvent, handleTaskDelete, handleModalClose]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!socketManager?.socket?.connected || !channel?.id) return;

    const handleTaskUpdated = (updatedTask) => {
      // Prevent WebSocket race conditions with optimistic updates
      if (websocketRacePreventionIds.has(updatedTask.id)) {
        console.log('⚠️ WebSocket update ignored due to optimistic update in progress:', updatedTask.id);
        return;
      }
      
      // Update task in local state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        )
      );
    };

    const handleTaskCreated = (newTask) => {
      if (newTask.thread_id === channel.id) {
        setTasks(prevTasks => [...prevTasks, newTask]);
      }
    };

    const handleTaskDeleted = (deletedTaskId) => {
      setTasks(prevTasks => prevTasks.filter(task => task.id !== deletedTaskId));
    };

    socketManager.on('task_updated', handleTaskUpdated);
    socketManager.on('task_created', handleTaskCreated);
    socketManager.on('task_deleted', handleTaskDeleted);

    return () => {
      socketManager.off('task_updated', handleTaskUpdated);
      socketManager.off('task_created', handleTaskCreated);
      socketManager.off('task_deleted', handleTaskDeleted);
    };
  }, [channel?.id, websocketRacePreventionIds]);

  // Custom formats to hide time display in events
  const formats = {
    eventTimeRangeFormat: () => '', // Hide time range
    agendaTimeFormat: 'HH:mm',
    agendaDateFormat: 'ddd MMM DD',
  };

  // Custom event style getter
  const eventStyleGetter = (event) => {
    const priority = event.resource?.priority || 'medium';
    const isOptimistic = event.resource?.isOptimistic;
    
    const priorityColors = {
      low: '#10b981',     // green-500
      medium: '#3b82f6',  // blue-500  
      high: '#f59e0b',    // amber-500
      urgent: '#ef4444'   // red-500
    };
    
    return {
      style: {
        backgroundColor: priorityColors[priority],
        opacity: isOptimistic ? 0.7 : 1,
        border: 'none',
        borderRadius: '4px',
        color: 'white'
      }
    };
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <p className="text-red-600 mb-2">{error}</p>
          <button 
            onClick={loadTasks}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="weekly-calendar-container">
      <Calendar
        localizer={localizer}
        events={events}
        views={['month', 'week', 'day']}
        view={currentView}
        date={currentDate}
        onView={setCurrentView}
        onNavigate={setCurrentDate}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        selectable
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        formats={formats}
        eventPropGetter={eventStyleGetter}
        components={{
          event: EventComponent
        }}
        step={30}
        timeslots={2}
        defaultView="week"
        min={new Date(2024, 0, 1, 6, 0)} // 6 AM
        max={new Date(2024, 0, 1, 22, 0)} // 10 PM
        dayLayoutAlgorithm="no-overlap"
      />
      
      {/* Event Modal */}
      <WeeklyEventModal
        task={selectedEvent}
        isNew={isNewEvent}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        onDelete={!isNewEvent ? handleModalDelete : undefined}
        workspaceId={workspace?.id}
        threadId={channel?.id}
        teamMembers={teamMembers}
        userTeams={userTeams}
      />
    </div>
  );
};

WeeklyCalendar.propTypes = {
  channel: PropTypes.object.isRequired,
  workspace: PropTypes.object.isRequired,
  workspaceId: PropTypes.string.isRequired,
  currentUser: PropTypes.object.isRequired,
};

export default WeeklyCalendar;
