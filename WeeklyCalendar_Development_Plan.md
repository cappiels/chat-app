# WeeklyCalendar Development Plan
*Based on WeeklyOSRMCalendar from syncup-staging - Adapted for Chat-App Architecture*

---

## 📋 **OVERVIEW**

### **Purpose**
Create a WeeklyCalendar component that provides week and day views for the revolutionary multi-assignee task system, complementing the existing monthly ChannelCalendar and ChannelTimeline components.

### **Source Analysis**
- **Source File**: `syncup-staging/src/components/WeeklyOSRMCalendar.js` (479 lines)
- **CSS File**: `syncup-staging/src/components/WeeklyOSRMCalendar.css` (comprehensive styling)
- **Key Features**: Drag/drop, optimistic updates, all-day events, project colors, permission system
- **Dependencies**: react-big-calendar, moment.js, react-dnd, HTML5Backend

### **Architecture Adaptation**
- **From**: Project-based system (userProjects, projectTitle, PI_id)
- **To**: Channel-based system (channels, threads, workspaces)
- **From**: Custom auth system (token, username, accountMappings)
- **To**: Firebase Authentication integration
- **From**: FileMaker/custom API endpoints
- **To**: Existing `/api/workspaces/:id/threads/:id/tasks` endpoints

---

## 🚀 **IMPLEMENTATION ROADMAP**

### **Phase 1: Component Architecture & Dependencies (Week 1)**

#### **1.1 Project Setup & Dependencies**
```bash
# Install required dependencies (if not already installed)
npm install react-big-calendar moment react-dnd react-dnd-html5-backend
```

#### **1.2 Component Structure**
```
frontend/src/components/calendar/
├── WeeklyCalendar.jsx           # Main component (adapt from WeeklyOSRMCalendar.js)
├── WeeklyCalendar.module.css    # Adapted styling (from WeeklyOSRMCalendar.css)
└── WeeklyEventModal.jsx         # Task creation/editing modal (adapt EventCreateOrEdit)
```

#### **1.3 Core Component Architecture**
```jsx
// frontend/src/components/calendar/WeeklyCalendar.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './WeeklyCalendar.module.css';
import WeeklyEventModal from './WeeklyEventModal';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

const WeeklyCalendar = ({
  workspaceId,
  threadId,
  channelName,
  channelColor,
  tasks = [],
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  selectedChannels = [],
  teamMembers = [],
  userTeams = []
}) => {
  // Component implementation...
};

export default WeeklyCalendar;
```

### **Phase 2: Data Integration & API Adaptation (Week 1-2)**

#### **2.1 Task Data Transformation**
```javascript
// Transform channel_tasks data to react-big-calendar events format
const transformTasksToEvents = useCallback((tasks, channelColors) => {
  return tasks
    .filter(task => task.start_date) // Only tasks with dates
    .map(task => {
      const start = moment(task.start_date);
      const end = task.end_date ? moment(task.end_date) : start.clone();
      const isAllDay = task.is_all_day || !task.start_time;
      
      if (isAllDay) {
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          start: start.startOf('day').toDate(),
          end: end.endOf('day').toDate(),
          allDay: true,
          // Chat-app specific fields
          threadId: task.thread_id,
          workspaceId: task.workspace_id,
          channelName: task.channel_name,
          assignees: task.assignees || [],
          assignedTeams: task.assigned_teams || [],
          status: task.status,
          priority: task.priority,
          assignmentMode: task.assignment_mode,
          completionProgress: task.completion_count,
          totalAssignees: (task.assignees?.length || 0) + (task.assigned_teams?.length || 0),
          createdBy: task.created_by,
          // Color from channel or priority
          backgroundColor: channelColors[task.thread_id] || getPriorityColor(task.priority),
          // Permission check
          canEdit: canEditTask(task, currentUser, teamMembers, userTeams)
        };
      } else {
        // Timed events
        const startTime = task.start_time ? `${task.start_date} ${task.start_time}` : task.start_date;
        const endTime = task.end_time ? `${task.end_date || task.start_date} ${task.end_time}` : 
                       moment(startTime).add(1, 'hour').format('YYYY-MM-DD HH:mm');
        
        return {
          .../* same fields as all-day */,
          start: moment(startTime).toDate(),
          end: moment(endTime).toDate(),
          allDay: false
        };
      }
    });
}, [currentUser, teamMembers, userTeams]);
```

#### **2.2 Permission System Adaptation**
```javascript
// Adapt permission system for chat-app multi-assignee architecture
const canEditTask = useCallback((task, currentUser, teamMembers, userTeams) => {
  if (!currentUser || !task) return false;
  
  // Task creator can always edit
  if (task.created_by === currentUser.id) return true;
  
  // Direct assignee can edit
  if (task.assignees?.includes(currentUser.id)) return true;
  
  // Team member can edit if assigned team
  if (task.assigned_teams?.length > 0) {
    const userTeamIds = userTeams.filter(team => 
      team.members?.includes(currentUser.id)
    ).map(team => team.id);
    
    if (task.assigned_teams.some(teamId => userTeamIds.includes(teamId))) {
      return true;
    }
  }
  
  // Channel admin/moderator can edit (if we add roles later)
  // TODO: Implement channel-level permissions
  
  return false;
}, []);
```

#### **2.3 API Integration Functions**
```javascript
// API integration adapted for existing endpoints
const handleTaskUpdate = useCallback(async (taskId, updatedData) => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/threads/${threadId}/tasks/${taskId}`,
      updatedData
    );
    
    if (onTaskUpdate) {
      onTaskUpdate(response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}, [workspaceId, threadId, onTaskUpdate]);

const handleTaskCreate = useCallback(async (taskData) => {
  try {
    const response = await api.post(
      `/workspaces/${workspaceId}/threads/${threadId}/tasks`,
      taskData
    );
    
    if (onTaskCreate) {
      onTaskCreate(response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}, [workspaceId, threadId, onTaskCreate]);
```

### **Phase 3: Advanced Features Implementation (Week 2-3)**

#### **3.1 Optimistic Updates System**
```javascript
// Optimistic updates for drag/drop operations
const [optimisticTaskUpdates, setOptimisticTaskUpdates] = useState(new Map());
const [websocketRacePreventionIds, setWebsocketRacePreventionIds] = useState(new Set());

const handleEventDrop = useCallback(async ({ event, start, end, isAllDay }) => {
  if (!canEditTask(event, currentUser, teamMembers, userTeams)) return;
  
  const updatedTask = {
    ...event,
    start_date: moment(start).format('YYYY-MM-DD'),
    end_date: moment(end).format('YYYY-MM-DD'),
    start_time: isAllDay ? null : moment(start).format('HH:mm'),
    end_time: isAllDay ? null : moment(end).format('HH:mm'),
    is_all_day: isAllDay
  };
  
  // Apply optimistic update
  const optimisticUpdate = {
    start_date: updatedTask.start_date,
    end_date: updatedTask.end_date,
    start_time: updatedTask.start_time,
    end_time: updatedTask.end_time,
    is_all_day: updatedTask.is_all_day,
    _optimisticUpdate: true
  };
  
  setOptimisticTaskUpdates(prev => new Map(prev).set(event.id, optimisticUpdate));
  setWebsocketRacePreventionIds(prev => new Set(prev).add(event.id));
  
  try {
    await handleTaskUpdate(event.id, updatedTask);
    
    // Clear optimistic update on success
    setOptimisticTaskUpdates(prev => {
      const next = new Map(prev);
      next.delete(event.id);
      return next;
    });
    
    // Clear race prevention after delay
    setTimeout(() => {
      setWebsocketRacePreventionIds(prev => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
    }, 1000);
    
  } catch (error) {
    // Revert optimistic update on error
    setOptimisticTaskUpdates(prev => {
      const next = new Map(prev);
      next.delete(event.id);
      return next;
    });
    setWebsocketRacePreventionIds(prev => {
      const next = new Set(prev);
      next.delete(event.id);
      return next;
    });
  }
}, [canEditTask, currentUser, teamMembers, userTeams, handleTaskUpdate]);
```

#### **3.2 Multi-Channel Support**
```javascript
// Support for viewing multiple channels simultaneously
const [selectedChannels, setSelectedChannels] = useState([threadId]);
const [channelColors, setChannelColors] = useState({});

const allTasks = useMemo(() => {
  if (!selectedChannels.length) return tasks;
  
  // Combine tasks from multiple channels
  return selectedChannels.reduce((allTasks, channelId) => {
    const channelTasks = tasks.filter(task => task.thread_id === channelId);
    return [...allTasks, ...channelTasks];
  }, []);
}, [selectedChannels, tasks]);

// Channel color management
const getChannelColor = useCallback((channelId) => {
  return channelColors[channelId] || getDefaultChannelColor(channelId);
}, [channelColors]);
```

#### **3.3 WeeklyEventModal Implementation**
```javascript
// Task creation/editing modal adapted for chat-app
const WeeklyEventModal = ({
  task = null,
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  workspaceId,
  threadId,
  teamMembers = [],
  userTeams = [],
  isNew = false
}) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    start_date: task?.start_date || moment().format('YYYY-MM-DD'),
    end_date: task?.end_date || moment().format('YYYY-MM-DD'),
    start_time: task?.start_time || '',
    end_time: task?.end_time || '',
    is_all_day: task?.is_all_day || false,
    assignees: task?.assignees || [],
    assigned_teams: task?.assigned_teams || [],
    priority: task?.priority || 'medium',
    assignment_mode: task?.assignment_mode || 'collaborative'
  });

  // Multi-assignee UI components
  const AssigneeSelector = () => (
    <div className={styles.assigneeSelector}>
      <label>Assign to:</label>
      
      {/* Individual Users */}
      <div className={styles.userList}>
        <h4>Team Members</h4>
        {teamMembers.map(member => (
          <label key={member.id} className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={formData.assignees.includes(member.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData(prev => ({
                    ...prev,
                    assignees: [...prev.assignees, member.id]
                  }));
                } else {
                  setFormData(prev => ({
                    ...prev,
                    assignees: prev.assignees.filter(id => id !== member.id)
                  }));
                }
              }}
            />
            <span>{member.display_name || member.email}</span>
          </label>
        ))}
      </div>
      
      {/* Teams */}
      {userTeams.length > 0 && (
        <div className={styles.teamList}>
          <h4>Teams</h4>
          {userTeams.map(team => (
            <label key={team.id} className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={formData.assigned_teams.includes(team.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      assigned_teams: [...prev.assigned_teams, team.id]
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      assigned_teams: prev.assigned_teams.filter(id => id !== team.id)
                    }));
                  }
                }}
              />
              <span className={styles.teamName} style={{ color: team.color }}>
                {team.display_name}
              </span>
            </label>
          ))}
        </div>
      )}
      
      {/* Assignment Mode */}
      <div className={styles.assignmentMode}>
        <label>Assignment Mode:</label>
        <select
          value={formData.assignment_mode}
          onChange={(e) => setFormData(prev => ({ ...prev, assignment_mode: e.target.value }))}
        >
          <option value="collaborative">Collaborative (any assignee can complete)</option>
          <option value="individual_response">Individual Response (all must complete)</option>
        </select>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className={styles.modalContent}>
        <h2>{isNew ? 'Create Task' : 'Edit Task'}</h2>
        
        <form onSubmit={handleSubmit}>
          {/* Basic task fields */}
          <div className={styles.formGroup}>
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
          
          {/* Date/Time fields */}
          <div className={styles.dateTimeGroup}>
            <label>
              <input
                type="checkbox"
                checked={formData.is_all_day}
                onChange={(e) => setFormData(prev => ({ ...prev, is_all_day: e.target.checked }))}
              />
              All Day
            </label>
            
            <div className={styles.dateRow}>
              <div className={styles.formGroup}>
                <label>Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              
              {!formData.is_all_day && (
                <div className={styles.formGroup}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
              )}
            </div>
            
            <div className={styles.dateRow}>
              <div className={styles.formGroup}>
                <label>End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              
              {!formData.is_all_day && (
                <div className={styles.formGroup}>
                  <label>End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Priority */}
          <div className={styles.formGroup}>
            <label>Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          
          {/* Multi-assignee selector */}
          <AssigneeSelector />
          
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryButton}>
              {isNew ? 'Create Task' : 'Update Task'}
            </button>
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className={styles.deleteButton}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </Dialog>
  );
};
```

### **Phase 4: Styling & Design System Integration (Week 3)**

#### **4.1 CSS Module Adaptation**
```css
/* frontend/src/components/calendar/WeeklyCalendar.module.css */
.weeklyCalendarContainer {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--surface-primary);
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.weeklyCalendarContainer :global(.rbc-calendar) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.weeklyCalendarContainer :global(.rbc-time-content) {
  flex: 1;
}

/* Event styling adapted for chat-app design system */
:global(.rbc-event-custom) {
  border-radius: 0.375rem;
  border: none;
  padding: 0.125rem 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
  font-weight: 500;
  position: relative;
}

:global(.rbc-event-custom.multi-assignee)::after {
  content: attr(data-progress);
  position: absolute;
  top: -2px;
  right: -2px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 0.625rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  line-height: 1;
}

/* Toolbar styling to match chat-app design */
:global(.rbc-toolbar) {
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

:global(.rbc-toolbar button) {
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

:global(.rbc-toolbar button:hover) {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

:global(.rbc-toolbar .rbc-active button) {
  background-color: var(--primary-500);
  color: white;
  font-weight: 600;
}

/* All-day events styling */
:global(.rbc-allday-cell) {
  border-bottom: 1px solid var(--border-color);
  background-color: var(--surface-secondary);
  min-height: 3rem;
  height: auto !important;
  overflow: visible !important;
}

:global(.rbc-allday-cell .rbc-event) {
  margin: 0.125rem 0;
  height: auto !important;
  white-space: normal !important;
  word-wrap: break-word !important;
  min-height: 1.5rem;
}

/* Priority color system */
:global(.rbc-event-custom.priority-low) {
  background-color: var(--green-500);
}

:global(.rbc-event-custom.priority-medium) {
  background-color: var(--blue-500);
}

:global(.rbc-event-custom.priority-high) {
  background-color: var(--orange-500);
}

:global(.rbc-event-custom.priority-urgent) {
  background-color: var(--red-500);
}

/* Channel color overrides */
:global(.rbc-event-custom.channel-colored) {
  /* Color will be set via inline styles from channel color */
}

/* Multi-assignee progress indicators */
.progressIndicator {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 0.625rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

/* Modal styling */
.modalContent {
  background: var(--surface-primary);
  border-radius: 0.5rem;
  padding: 1.5rem;
  max-width: 32rem;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.formGroup {
  margin-bottom: 1rem;
}

.formGroup label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
  color: var(--text-primary);
}

.formGroup input,
.formGroup textarea,
.formGroup select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: var(--surface-primary);
  color: var(--text-primary);
}

.formGroup input:focus,
.formGroup textarea:focus,
.formGroup select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dateTimeGroup {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: var(--surface-secondary);
  border-radius: 0.375rem;
}

.dateRow {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.assigneeSelector {
  margin-top: 1rem;
  padding: 1rem;
  background-color: var(--surface-secondary);
  border-radius: 0.375rem;
}

.userList,
.teamList {
  margin-top: 0.5rem;
}

.userList h4,
.teamList h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.checkboxItem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
}

.checkboxItem input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.teamName {
  font-weight: 500;
}

.assignmentMode {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.modalActions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.modalActions button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modalActions button[type="button"] {
  background: var(--surface-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.modalActions button[type="button"]:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.primaryButton {
  background: var(--primary-500) !important;
  border: 1px solid var(--primary-500) !important;
  color: white !important;
}

.primaryButton:hover {
  background: var(--primary-600) !important;
  border-color: var(--primary-600) !important;
}

.deleteButton {
  background: var(--red-500) !important;
  border: 1px solid var(--red-500) !important;
  color: white !important;
}

.deleteButton:hover {
  background: var(--red-600) !important;
  border-color: var(--red-600) !important;
}

/* Mobile responsive design */
@media (max-width: 768px) {
  .weeklyCalendarContainer {
    padding: 0.5rem;
  }
  
  .dateRow {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .modalContent {
    margin: 1rem;
    padding: 1rem;
  }
  
  .modalActions {
    flex-direction: column;
  }
  
  :global(.rbc-toolbar) {
    flex-direction: column;
    gap: 0.5rem;
  }
}
```

### **Phase 5: Integration & Testing (Week 4)**

#### **5.1 Integration with MessageList**
```jsx
// Integration point in MessageList.jsx
const renderCalendarView = () => {
  if (currentView === 'week') {
    return (
      <WeeklyCalendar
        workspaceId={workspace.id}
        threadId={activeThread.id}
        channelName={activeThread.name}
        channelColor={getChannelColor(activeThread.id)}
        tasks={tasks}
        onTaskUpdate={handleTaskUpdate}
        onTaskCreate={handleTaskCreate}
        onTaskDelete={handleTaskDelete}
        selectedChannels={selectedChannels}
        teamMembers={threadMembers}
        userTeams={userTeams}
      />
    );
  }
  
  return currentView === 'calendar' ? (
    <ChannelCalendar {...calendarProps} />
  ) : currentView === 'timeline' ? (
    <ChannelTimeline {...timelineProps} />
  ) : (
    <div className="chat-messages">
      {/* Regular chat interface */}
    </div>
  );
};
```

#### **5.2 View Switching Enhancement**
```jsx
// Enhanced view switching to include week view
const ViewSwitchButtons = ({ currentView, onViewChange }) => (
  <div className="view-switch-buttons">
    <button
      className={`view-switch-btn ${currentView === 'chat' ? 'active' : ''}`}
      onClick={() => onViewChange('chat')}
    >
      <MessageSquare size={16} />
      Chat
    </button>
    <button
      className={`view-switch-btn ${currentView === 'calendar' ? 'active' : ''}`}
      onClick={() => onViewChange('calendar')}
    >
      <Calendar size={16} />
      Month
    </button>
    <button
      className={`view-switch-btn ${currentView === 'week' ? 'active' : ''}`}
      onClick={() => onViewChange('week')}
    >
      <CalendarDays size={16} />
      Week
    </button>
    <button
      className={`view-switch-btn ${currentView === 'timeline' ? 'active' : ''}`}
      onClick={() => onViewChange('timeline')}
    >
      <BarChart3 size={16} />
      Timeline
    </button>
  </div>
);
```

#### **5.3 Real-time Updates Integration**
```jsx
// WebSocket integration for real-time task updates
useEffect(() => {
  if (!socket) return;

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
    if (newTask.thread_id === threadId) {
      setTasks(prevTasks => [...prevTasks, newTask]);
    }
  };

  const handleTaskDeleted = (deletedTaskId) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== deletedTaskId));
  };

  socket.on('task_updated', handleTaskUpdated);
  socket.on('task_created', handleTaskCreated);
  socket.on('task_deleted', handleTaskDeleted);

  return () => {
    socket.off('task_updated', handleTaskUpdated);
    socket.off('task_created', handleTaskCreated);
    socket.off('task_deleted', handleTaskDeleted);
  };
}, [socket, threadId, websocketRacePreventionIds]);
```

#### **5.4 Multi-Channel Integration**
```jsx
// Channel dropdown integration (similar to existing ChannelDropdown.jsx)
const ChannelSelector = ({ selectedChannels, onChannelsChange, availableChannels }) => (
  <div className={styles.channelSelector}>
    <label>View Channels:</label>
    <div className={styles.channelList}>
      {availableChannels.map(channel => (
        <label key={channel.id} className={styles.channelItem}>
          <input
            type="checkbox"
            checked={selectedChannels.includes(channel.id)}
            onChange={(e) => {
              if (e.target.checked) {
                onChannelsChange([...selectedChannels, channel.id]);
              } else {
                onChannelsChange(selectedChannels.filter(id => id !== channel.id));
              }
            }}
          />
          <span 
            className={styles.channelColor}
            style={{ backgroundColor: channel.color }}
          />
          <span>{channel.name}</span>
        </label>
      ))}
    </div>
  </div>
);
```

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests**
- **Task transformation functions**: Test data mapping from API to calendar events
- **Permission system**: Test canEditTask logic with various user/team combinations
- **Optimistic updates**: Test state management for drag/drop operations
- **Date/time handling**: Test all-day vs timed events, timezone handling

### **Integration Tests**
- **API endpoints**: Test task CRUD operations through calendar interface
- **WebSocket updates**: Test real-time synchronization without race conditions
- **Multi-channel views**: Test filtering and color coding across channels
- **Drag/drop operations**: Test calendar event updates via drag/drop

### **User Experience Tests**
- **Mobile responsiveness**: Test week view on various screen sizes
- **Accessibility**: Test keyboard navigation, screen reader compatibility
- **Performance**: Test with large numbers of tasks/events
- **Cross-browser compatibility**: Test in Chrome, Firefox, Safari, Edge

### **Visual Regression Tests**
- **Calendar rendering**: Compare screenshots of different view states
- **Event styling**: Test priority colors, channel colors, progress indicators
- **Modal dialogs**: Test task creation/editing modal appearance
- **Responsive breakpoints**: Test layout changes at different screen sizes

---

## 📊 **SUCCESS METRICS**

### **Functional Requirements**
- ✅ Week and day views display tasks correctly
- ✅ Drag/drop updates task dates/times without data loss
- ✅ Multi-assignee tasks show progress indicators (e.g., "2/7 done")
- ✅ All-day events render properly without time overlap
- ✅ Timed events show proper duration and positioning
- ✅ Task creation/editing modal supports all task fields
- ✅ Permission system prevents unauthorized edits
- ✅ Real-time updates sync across users without conflicts

### **Performance Targets**
- **Initial Load**: < 2 seconds for calendar view with 100+ tasks
- **Drag Response**: < 100ms visual feedback for drag operations
- **API Calls**: < 500ms response time for task CRUD operations
- **Bundle Size**: < 150KB additional size for weekly calendar components
- **Memory Usage**: < 50MB additional RAM for calendar view

### **User Experience Goals**
- **Intuitive Navigation**: Users can switch between views seamlessly
- **Mobile Usability**: Touch interactions work properly on mobile devices
- **Accessibility**: WCAG 2.1 AA compliance for screen readers
- **Visual Clarity**: Events are clearly readable and properly color-coded
- **Error Handling**: Clear feedback for failed operations with retry options

### **Integration Requirements**
- ✅ Consistent with existing ChannelCalendar and ChannelTimeline components
- ✅ Uses established Firebase authentication and API patterns
- ✅ Follows existing design system and CSS architecture
- ✅ Maintains compatibility with existing WebSocket infrastructure
- ✅ Supports multi-assignee system without breaking existing functionality

---

## 🚀 **DEPLOYMENT PLAN**

### **Development Workflow**
1. **Create Feature Branch**: `feature/weekly-calendar-component`
2. **Install Dependencies**: Add react-big-calendar and related packages
3. **Implement Components**: Build WeeklyCalendar.jsx and WeeklyEventModal.jsx
4. **Add Styling**: Create CSS modules with design system integration
5. **Integration Testing**: Test with existing MessageList and API endpoints
6. **Code Review**: Review with team for architecture and UX feedback
7. **Merge to Development**: Deploy to development environment for testing
8. **User Acceptance**: Get feedback from team members and stakeholders
9. **Production Deploy**: Merge to main and deploy via DigitalOcean

### **Feature Flag Strategy**
```javascript
// Use feature flags for gradual rollout
const WEEKLY_CALENDAR_ENABLED = process.env.REACT_APP_WEEKLY_CALENDAR_ENABLED === 'true';

const ViewSwitchButtons = ({ currentView, onViewChange }) => (
  <div className="view-switch-buttons">
    {/* Existing buttons */}
    {WEEKLY_CALENDAR_ENABLED && (
      <button
        className={`view-switch-btn ${currentView === 'week' ? 'active' : ''}`}
        onClick={() => onViewChange('week')}
      >
        <CalendarDays size={16} />
        Week
      </button>
    )}
  </div>
);
```

### **Migration Considerations**
- **No database changes required** - uses existing channel_tasks schema
- **API compatibility maintained** - uses existing task endpoints
- **Backward compatibility** - existing calendar views remain unchanged
- **Progressive enhancement** - week view is additive feature

---

## 📝 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Setup (Week 1)**
- [ ] Install react-big-calendar, moment, react-dnd dependencies
- [ ] Create component file structure in `/components/calendar/`
- [ ] Set up basic WeeklyCalendar.jsx component shell
- [ ] Create WeeklyCalendar.module.css with basic styling
- [ ] Test basic calendar rendering without data

### **Phase 2: Core Features (Week 1-2)**
- [ ] Implement task-to-event data transformation
- [ ] Add drag/drop functionality with optimistic updates
- [ ] Create task creation/editing modal (WeeklyEventModal.jsx)
- [ ] Implement permission system for task editing
- [ ] Add all-day event support with proper rendering
- [ ] Test basic CRUD operations through calendar interface

### **Phase 3: Advanced Features (Week 2-3)**
- [ ] Add multi-assignee progress indicators on events
- [ ] Implement multi-channel support with color coding
- [ ] Add WebSocket integration for real-time updates
- [ ] Implement race condition prevention for optimistic updates
- [ ] Add priority-based color coding system
- [ ] Test advanced features with complex task scenarios

### **Phase 4: Integration & Polish (Week 3-4)**
- [ ] Integrate with MessageList view switching
- [ ] Add responsive design for mobile devices
- [ ] Implement accessibility features (ARIA labels, keyboard navigation)
- [ ] Add error handling and loading states
- [ ] Create comprehensive test suite
- [ ] Optimize performance for large numbers of tasks

### **Phase 5: Testing & Deployment (Week 4)**
- [ ] Conduct thorough testing across browsers and devices
- [ ] Perform accessibility audit and fixes
- [ ] Get user feedback and iterate on UX improvements
- [ ] Deploy to development environment
- [ ] Conduct performance testing and optimization
- [ ] Deploy to production with feature flag

---

## 🔧 **MAINTENANCE & FUTURE ENHANCEMENTS**

### **Maintenance Tasks**
- **Dependency Updates**: Keep react-big-calendar and related packages updated
- **Performance Monitoring**: Track calendar rendering performance metrics
- **Bug Fixes**: Address any drag/drop or rendering issues
- **Browser Compatibility**: Test and fix issues with new browser versions

### **Future Enhancement Ideas**
- **Recurring Events**: Support for recurring task patterns
- **Calendar Import/Export**: ICS file support for external calendar integration
- **Custom Views**: Support for custom time ranges (2-week, month, etc.)
- **Advanced Filtering**: Filter by assignee, priority, status, tags
- **Keyboard Shortcuts**: Power user shortcuts for common actions
- **Bulk Operations**: Multi-select and bulk edit capabilities
- **Print Support**: Print-friendly calendar layouts

### **Integration with Google Sync**
- **Bidirectional Sync**: Week view updates sync to Google Calendar
- **Conflict Resolution**: Handle conflicts between local and Google changes
- **Sync Status Indicators**: Visual indicators for sync status per event
- **Offline Support**: Cache events for offline viewing and editing

---

**📋 SUMMARY**

The WeeklyCalendar component will provide a comprehensive week and day view for the revolutionary multi-assignee task system. By adapting the proven WeeklyOSRMCalendar from syncup-staging and integrating it with the chat-app's channel-based architecture, we'll deliver a powerful calendar interface that maintains consistency with existing components while adding significant value for users who prefer week-based planning.

**🎯 Key Benefits:**
- **Enhanced Time Management**: Week view provides better scheduling granularity
- **Multi-Assignee Support**: Visual progress indicators for collaborative tasks
- **Seamless Integration**: Consistent with existing calendar and timeline views
- **Mobile-First Design**: Responsive interface for all devices
- **Real-time Collaboration**: WebSocket integration with race condition prevention

**🚀 Expected Timeline:** 4 weeks from start to production deployment

**💡 Success Criteria:** Users can efficiently manage tasks in week/day views with drag/drop functionality, multi-assignee progress tracking, and real-time collaboration features.
