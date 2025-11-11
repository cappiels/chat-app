# Google Calendar & Tasks Sync Strategy

## Overview

This document outlines the intelligent sync strategy for integrating our revolutionary task/event system with Google's ecosystem. The system automatically determines whether to sync items to Google Calendar, Google Tasks, or both services based on the nature and attributes of each task/event.

## Core Philosophy

**"Sync Smart, Not Hard"** - The system should intuitively understand user intent and sync to the most appropriate Google service without requiring manual selection.

## 🎯 Sync Decision Matrix

### Google Calendar Events (Time-Blocking Focus)
**Purpose:** Visual scheduling, time allocation, calendar blocking
**When to Sync:**
- Has time span (`start_date` + `end_date`) 
- Has specific times (`start_time` + `end_time`)
- Represents meetings, appointments, scheduled work blocks
- Multi-day events or projects
- **All-day tasks with dates** (PRIMARY SYNC TARGET)

**✅ Confirmed Approach:** Most of our tasks will sync to Google Calendar as all-day events since they include start/end dates. This provides visual time-blocking and calendar integration.

**Data Mapping:**
```javascript
{
  summary: task.title,
  description: task.description,
  start: { 
    dateTime: `${task.start_date}T${task.start_time}:00Z`,
    date: task.start_date // for all-day events
  },
  end: {
    dateTime: `${task.end_date}T${task.end_time}:00Z`, 
    date: task.end_date // for all-day events
  },
  colorId: getPriorityColor(task.priority),
  // Advanced tagging and categorization
  extendedProperties: {
    shared: {
      source: 'syncup-chat-app',
      taskId: task.id,
      channelId: task.thread_id,
      priority: task.priority,
      status: task.status,
      assignees: JSON.stringify(task.assignees),
      teams: JSON.stringify(task.assigned_teams)
    }
  },
  // Use attendees for multi-assignee tracking
  attendees: task.assignees?.map(userId => ({
    email: getUserEmail(userId),
    displayName: getUserDisplayName(userId),
    responseStatus: getTaskCompletionStatus(task, userId)
  })),
  // Transparency for time-blocking
  transparency: task.is_all_day ? 'transparent' : 'opaque'
}
```

### Google Tasks (Action-Oriented Focus)
**Purpose:** To-do management, completion tracking, deadline awareness
**When to Sync:**
- Has `due_date` but no time span
- No specific times (flexible completion)
- Status-driven workflow (pending/completed)
- Actionable items requiring completion
- Tasks without scheduling requirements

**Data Mapping:**
```javascript
{
  title: task.title,
  notes: `${task.description}\n\n[Source: ${task.channel_name}]\n[Priority: ${task.priority}]\n[Assignees: ${task.assignees?.join(', ')}]\n[Task ID: ${task.id}]`,
  due: task.due_date,
  status: task.status === 'completed' ? 'completed' : 'needsAction',
  updated: task.updated_at,
  // Parent/child hierarchy support
  parent: task.parent_task_id ? getGoogleTaskId(task.parent_task_id) : null,
  // Links back to our system
  links: [{
    type: 'email',
    description: 'View in SyncUp Chat',
    link: `${APP_URL}/workspace/${task.workspace_id}/channel/${task.thread_id}?task=${task.id}`
  }]
}
```

## 🏷️ Google API Tagging & Filtering Options

### Google Calendar Extended Properties
**Available Metadata Fields:**
```javascript
{
  // Shared properties (visible to all calendar users)
  extendedProperties: {
    shared: {
      source: 'syncup-chat-app',
      taskId: task.id,
      channelId: task.thread_id,
      channelName: task.channel_name,
      workspaceId: task.workspace_id,
      priority: task.priority,          // low, medium, high, urgent
      status: task.status,              // pending, in_progress, completed
      assignees: JSON.stringify(task.assignees),
      teams: JSON.stringify(task.assigned_teams),
      tags: JSON.stringify(task.tags),
      isMultiAssignee: task.assignees?.length > 1 ? 'true' : 'false',
      completionMode: task.assignment_mode, // collaborative, individual_response
      originalType: 'task'              // vs 'event' for native calendar items
    }
  },
  
  // Color coding for visual filtering
  colorId: getPriorityColor(task.priority), // 1-11 available colors
  
  // Attendees for multi-assignee tracking
  attendees: task.assignees?.map(userId => ({
    email: getUserEmail(userId),
    displayName: getUserDisplayName(userId),
    responseStatus: getTaskCompletionStatus(task, userId) // needsAction, accepted, declined
  })),
  
  // Calendar-specific categorization
  eventType: task.is_all_day ? 'default' : 'workingLocation',
  visibility: task.is_private ? 'private' : 'default'
}
```

### Google Tasks Tagging via Notes Field
**Structured Data in Notes:**
```javascript
function formatTaskNotes(task) {
  return `
${task.description}

📋 Task Details:
• Channel: #${task.channel_name}
• Priority: ${task.priority.toUpperCase()}
• Status: ${task.status.replace('_', ' ').toUpperCase()}
• Assigned to: ${task.assignees?.map(id => getUserDisplayName(id)).join(', ') || 'Unassigned'}
• Teams: ${task.assigned_teams?.map(id => getTeamName(id)).join(', ') || 'None'}
• Tags: ${task.tags?.join(', ') || 'None'}

🔗 Links:
• View in SyncUp: ${getTaskUrl(task)}
• Channel: ${getChannelUrl(task)}

🤖 Sync Data:
[SYNCUP:${task.id}:${task.workspace_id}:${task.thread_id}]
`.trim();
}
```

### Advanced Filtering Strategies

#### Calendar Filtering Options:
```javascript
// Filter by source system
calendar.events.list({
  calendarId: 'primary',
  sharedExtendedProperty: 'source=syncup-chat-app'
});

// Filter by priority
calendar.events.list({
  calendarId: 'primary', 
  sharedExtendedProperty: 'priority=high'
});

// Filter by channel
calendar.events.list({
  calendarId: 'primary',
  sharedExtendedProperty: 'channelId=abc-123'
});

// Filter by assignment type
calendar.events.list({
  calendarId: 'primary',
  sharedExtendedProperty: 'isMultiAssignee=true'
});
```

#### Tasks Filtering Options:
```javascript
// Filter by completion status
tasks.list({
  tasklist: 'primary',
  showCompleted: false
});

// Filter by due date range
tasks.list({
  tasklist: 'primary',
  dueMin: '2025-11-01T00:00:00Z',
  dueMax: '2025-11-30T23:59:59Z'
});

// Custom filtering via structured notes
function filterTasksBySource(allTasks) {
  return allTasks.filter(task => 
    task.notes && task.notes.includes('[SYNCUP:')
  );
}

function filterTasksByPriority(allTasks, priority) {
  return allTasks.filter(task =>
    task.notes && task.notes.includes(`Priority: ${priority.toUpperCase()}`)
  );
}
```

### Color Coding System

#### Google Calendar Colors:
```javascript
const PRIORITY_COLORS = {
  low: '2',      // Green - Peaceful, low stress
  medium: '1',   // Blue - Default, standard work
  high: '6',     // Orange - Attention needed
  urgent: '11'   // Red - Critical, immediate action
};

const CHANNEL_COLORS = {
  general: '1',     // Blue
  development: '10', // Green
  marketing: '5',   // Pink
  support: '6',     // Orange
  leadership: '9'   // Purple
};
```

#### Google Tasks Visual Indicators:
```javascript
// Use emoji prefixes for visual categorization
const TASK_PREFIXES = {
  urgent: '🚨',
  high: '⚠️',  
  medium: '📋',
  low: '📝',
  meeting: '🤝',
  deadline: '⏰',
  development: '💻',
  design: '🎨'
};
```

### Smart Search & Filtering

#### Unified Search Query Format:
```javascript
function buildUnifiedSearchQuery(filters) {
  const calendarQuery = {
    q: filters.text,
    sharedExtendedProperty: [
      filters.channel ? `channelId=${filters.channel}` : null,
      filters.priority ? `priority=${filters.priority}` : null,
      filters.assignee ? `assignees=${filters.assignee}` : null
    ].filter(Boolean)
  };
  
  const tasksQuery = {
    q: filters.text,
    // Search within structured notes
    showCompleted: filters.includeCompleted
  };
  
  return { calendarQuery, tasksQuery };
}
```

### Hybrid Sync (Both Services)
**Purpose:** Comprehensive project management with both time allocation and completion tracking
**When to Sync to Both:**
- Has time span AND due date
- Multi-day projects with deliverables
- Scheduled work requiring completion confirmation
- Events with actionable outcomes

## 🤖 Intelligent Detection Algorithm

```javascript
function determineGoogleSyncStrategy(task) {
  const hasTimeSpan = task.start_date && task.end_date;
  const hasSpecificTimes = task.start_time && task.end_time;
  const hasDueDate = task.due_date;
  const isMultiDay = hasTimeSpan && (task.start_date !== task.end_date);
  const hasDescription = task.description && task.description.trim();
  
  // Priority 1: Timed Events → Calendar Only
  if (hasSpecificTimes) {
    return {
      calendar: true,
      tasks: false,
      reason: 'Timed event with specific start/end times'
    };
  }
  
  // Priority 2: Multi-day without due date → Calendar Only
  if (isMultiDay && !hasDueDate) {
    return {
      calendar: true,
      tasks: false,
      reason: 'Multi-day event without specific deliverable'
    };
  }
  
  // Priority 3: Due date without time span → Tasks Only
  if (hasDueDate && !hasTimeSpan) {
    return {
      calendar: false,
      tasks: true,
      reason: 'Deadline-focused task without time blocking'
    };
  }
  
  // Priority 4: No scheduling → Tasks Only
  if (!hasTimeSpan && !hasSpecificTimes && !hasDueDate) {
    return {
      calendar: false,
      tasks: true,
      reason: 'Unscheduled actionable item'
    };
  }
  
  // Priority 5: Time span + Due date → Both Services
  if (hasTimeSpan && hasDueDate) {
    return {
      calendar: true,
      tasks: true,
      reason: 'Project with both time allocation and completion requirement'
    };
  }
  
  // Default: Time span without due date → Calendar
  if (hasTimeSpan) {
    return {
      calendar: true,
      tasks: false,
      reason: 'Scheduled event without completion requirement'
    };
  }
  
  // Fallback → Tasks
  return {
    calendar: false,
    tasks: true,
    reason: 'Default to tasks for unclassified items'
  };
}
```

## 📋 Sync Examples

### Google Calendar Only

| Task/Event | Start Date | End Date | Times | Due Date | Sync To | Reason |
|------------|------------|----------|-------|----------|---------|---------|
| "Team Meeting" | Today | Today | 2pm-3pm | - | Calendar | Timed event |
| "Vacation" | Dec 20 | Dec 27 | All-day | - | Calendar | Multi-day event |
| "Conference" | Mar 15 | Mar 17 | All-day | - | Calendar | Multi-day event |

### Google Tasks Only

| Task/Event | Start Date | End Date | Times | Due Date | Sync To | Reason |
|------------|------------|----------|-------|----------|---------|---------|
| "Submit Report" | - | - | - | Friday | Tasks | Due date only |
| "Call Client" | - | - | - | - | Tasks | No scheduling |
| "Review Docs" | - | - | - | Tomorrow | Tasks | Action item |

### Both Services

| Task/Event | Start Date | End Date | Times | Due Date | Sync To | Reason |
|------------|------------|----------|-------|----------|---------|---------|
| "Write Proposal" | Monday | Wednesday | All-day | Wednesday | Both | Time block + deliverable |
| "Project Alpha" | Week 1 | Week 3 | All-day | Week 3 Fri | Both | Project timeline + deadline |

## 🔄 Technical Implementation Details

### Current Database Schema (Production Ready)

#### Core Tables Structure:
```sql
-- Main tasks table (from migration 017 + 018 + 019)
CREATE TABLE channel_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, -- Added in migration 019
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling fields (Google Calendar compatible)
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN DEFAULT false,
    start_time TIME,
    end_time TIME,
    
    -- Assignment system (Multi-assignee revolutionary features)
    assigned_to VARCHAR(128) REFERENCES users(id),  -- Legacy single assignment
    assignees JSONB DEFAULT '[]'::jsonb,            -- New multi-assignee array
    assigned_teams JSONB DEFAULT '[]'::jsonb,       -- Team assignments
    assignment_mode VARCHAR(50) DEFAULT 'collaborative', -- 'collaborative' | 'individual_response'
    individual_completions JSONB DEFAULT '{}'::jsonb,    -- {"user_id": "timestamp"}
    completion_count INTEGER DEFAULT 0,
    requires_individual_response BOOLEAN DEFAULT false,
    
    -- Status and metadata
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    tags JSONB DEFAULT '[]',
    
    -- Google Calendar integration
    google_calendar_event_id VARCHAR(255),
    calendar_type VARCHAR(20) DEFAULT 'channel',
    
    -- Timeline/Dependencies
    parent_task_id UUID REFERENCES channel_tasks(id),
    dependencies JSONB DEFAULT '[]',
    
    -- Performance fields
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    
    -- Audit fields
    created_by VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Computed columns for efficient querying
    assignee_count INTEGER GENERATED ALWAYS AS (
        jsonb_array_length(assignees) + jsonb_array_length(assigned_teams)
    ) STORED,
    
    -- Constraints
    CONSTRAINT channel_tasks_title_length CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 255),
    CONSTRAINT channel_tasks_valid_dates CHECK (
        (start_date IS NULL OR end_date IS NULL OR start_date <= end_date) AND
        (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
    ),
    CONSTRAINT channel_tasks_valid_assignment_mode CHECK (
        assignment_mode IN ('collaborative', 'individual_response')
    )
);

-- Team system tables (from migration 018)
CREATE TABLE workspace_teams (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(workspace_id, name),
    CONSTRAINT check_team_color_valid CHECK (
        color IN ('blue', 'green', 'purple', 'orange', 'pink', 'teal', 'indigo', 'red', 'yellow', 'cyan', 'rose', 'violet')
    )
);

CREATE TABLE workspace_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_by VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(team_id, user_id),
    CONSTRAINT check_member_role_valid CHECK (role IN ('member', 'lead', 'admin'))
);

-- Performance indexes
CREATE INDEX idx_channel_tasks_thread ON channel_tasks(thread_id);
CREATE INDEX idx_channel_tasks_workspace ON channel_tasks(workspace_id);
CREATE INDEX idx_channel_tasks_assigned_to ON channel_tasks(assigned_to);
CREATE INDEX idx_channel_tasks_assignees ON channel_tasks USING gin(assignees);
CREATE INDEX idx_channel_tasks_assigned_teams ON channel_tasks USING gin(assigned_teams);
CREATE INDEX idx_channel_tasks_status ON channel_tasks(status);
CREATE INDEX idx_channel_tasks_priority ON channel_tasks(priority);
CREATE INDEX idx_channel_tasks_dates ON channel_tasks(start_date, end_date);
CREATE INDEX idx_channel_tasks_calendar_sync ON channel_tasks(google_calendar_event_id);
CREATE INDEX idx_channel_tasks_individual_completions ON channel_tasks USING gin(individual_completions);
CREATE INDEX idx_channel_tasks_completion_progress ON channel_tasks(completion_count, assignee_count);
```

### Enhanced Schema for Google Sync Extensions

```sql
-- Additional Google sync tracking fields (to be added)
ALTER TABLE channel_tasks ADD COLUMN google_task_id VARCHAR(255);
ALTER TABLE channel_tasks ADD COLUMN sync_strategy VARCHAR(20); -- 'calendar', 'tasks', 'both', 'none'
ALTER TABLE channel_tasks ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE channel_tasks ADD COLUMN sync_error TEXT;
ALTER TABLE channel_tasks ADD COLUMN sync_retry_count INTEGER DEFAULT 0;
ALTER TABLE channel_tasks ADD COLUMN google_calendar_etag VARCHAR(255); -- For conflict detection
ALTER TABLE channel_tasks ADD COLUMN google_task_etag VARCHAR(255);

-- Sync configuration per workspace
CREATE TABLE workspace_google_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    google_calendar_id VARCHAR(255),
    google_task_list_id VARCHAR(255),
    sync_enabled BOOLEAN DEFAULT false,
    auto_sync BOOLEAN DEFAULT true,
    sync_frequency_minutes INTEGER DEFAULT 15,
    last_full_sync_at TIMESTAMP WITH TIME ZONE,
    sync_errors JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(workspace_id)
);

-- User-level Google sync preferences
CREATE TABLE user_google_sync_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    google_calendar_enabled BOOLEAN DEFAULT true,
    google_tasks_enabled BOOLEAN DEFAULT true,
    preferred_calendar VARCHAR(255) DEFAULT 'primary',
    preferred_task_list VARCHAR(255) DEFAULT 'primary',
    conflict_resolution VARCHAR(50) DEFAULT 'last_modified_wins',
    sync_personal_tasks BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_conflict_resolution CHECK (
        conflict_resolution IN ('last_modified_wins', 'our_system_wins', 'google_wins', 'manual')
    )
);

-- Sync operation logging for debugging and monitoring
CREATE TABLE google_sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES channel_tasks(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'sync_from_google'
    google_service VARCHAR(20) NOT NULL, -- 'calendar', 'tasks'
    google_id VARCHAR(255),
    operation_status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'retry'
    error_message TEXT,
    request_payload JSONB,
    response_payload JSONB,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_operation_type CHECK (
        operation_type IN ('create', 'update', 'delete', 'sync_from_google', 'conflict_resolution')
    ),
    CONSTRAINT check_google_service CHECK (google_service IN ('calendar', 'tasks')),
    CONSTRAINT check_operation_status CHECK (operation_status IN ('success', 'failed', 'retry', 'skipped'))
);

-- Indexes for sync operations
CREATE INDEX idx_google_sync_ops_task_id ON google_sync_operations(task_id);
CREATE INDEX idx_google_sync_ops_status ON google_sync_operations(operation_status);
CREATE INDEX idx_google_sync_ops_created_at ON google_sync_operations(created_at DESC);
CREATE INDEX idx_google_sync_ops_google_service ON google_sync_operations(google_service);
```

### Database Views and Functions (Already Implemented)

```sql
-- View with computed progress information
CREATE VIEW channel_tasks_with_progress AS
SELECT 
  ct.*,
  get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions) as progress_info,
  CASE 
    WHEN ct.assignment_mode = 'individual_response' THEN 
      (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'is_fully_complete')::boolean
    ELSE 
      ct.completed_at IS NOT NULL
  END as is_complete,
  (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'total')::integer as total_assignees,
  jsonb_array_length(ct.assignees) as individual_assignee_count,
  jsonb_array_length(ct.assigned_teams) as team_count
FROM channel_tasks ct;

-- Helper functions for task assignment logic
CREATE OR REPLACE FUNCTION is_task_assignee(task_assignees jsonb, task_teams jsonb, user_id varchar)
RETURNS boolean AS $$
DECLARE
  team_record RECORD;
BEGIN
  -- Check direct assignment
  IF task_assignees ? user_id THEN
    RETURN true;
  END IF;
  
  -- Check team assignments
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM workspace_team_members wtm 
      WHERE wtm.team_id = team_record.team_id::integer 
      AND wtm.user_id = user_id 
      AND wtm.is_active = true
    ) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function for individual task completion
CREATE OR REPLACE FUNCTION mark_task_complete_individual(
  task_id_param uuid,
  user_id_param varchar,
  completion_timestamp_param timestamp DEFAULT CURRENT_TIMESTAMP
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks_with_progress%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks_with_progress WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Check if user is assignee
  IF NOT is_task_assignee(task_record.assignees, task_record.assigned_teams, user_id_param) THEN
    RETURN json_build_object('success', false, 'error', 'User not assigned to this task');
  END IF;
  
  -- Update individual completions
  updated_completions := task_record.individual_completions || 
    jsonb_build_object(user_id_param, completion_timestamp_param);
  
  -- Count completions
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN assignment_mode = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(assignees, assigned_teams, updated_completions)->>'total')::integer
        THEN completion_timestamp_param
        ELSE completed_at END
      ELSE completion_timestamp_param
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(assignees, assigned_teams, individual_completions) 
  INTO progress_result
  FROM channel_tasks 
  WHERE id = task_id_param;
  
  RETURN json_build_object(
    'success', true,
    'progress', progress_result,
    'completed_by_user', user_id_param,
    'timestamp', completion_timestamp_param
  );
END;
$$ LANGUAGE plpgsql;
```

### API Architecture & Design Patterns

#### RESTful Endpoints Structure:
```javascript
// Core sync endpoints
POST   /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/sync/google
DELETE /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/sync/google
GET    /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/sync/status
POST   /api/workspaces/:workspaceId/sync/google/bulk          // Batch operations
GET    /api/workspaces/:workspaceId/sync/google/status        // Overall sync health

// Configuration endpoints
GET    /api/users/:userId/google-sync/preferences
PUT    /api/users/:userId/google-sync/preferences
GET    /api/workspaces/:workspaceId/google-sync/config
PUT    /api/workspaces/:workspaceId/google-sync/config

// OAuth and authentication
GET    /api/auth/google/calendar/authorize
GET    /api/auth/google/calendar/callback
GET    /api/auth/google/tasks/authorize
GET    /api/auth/google/tasks/callback
DELETE /api/auth/google/disconnect
```

#### Service Layer Architecture:
```javascript
class GoogleSyncService {
  constructor(googleCalendarClient, googleTasksClient, database) {
    this.calendar = googleCalendarClient;
    this.tasks = googleTasksClient;
    this.db = database;
    this.syncQueue = new Bull('google-sync');
    this.rateLimiter = new RateLimiter();
  }

  async syncTaskToGoogle(taskId, options = {}) {
    const startTime = Date.now();
    const task = await this.db.getTaskWithRelations(taskId);
    
    try {
      // Determine sync strategy
      const strategy = this.determineGoogleSyncStrategy(task);
      
      // Execute sync based on strategy
      const results = await this.executeSyncStrategy(task, strategy, options);
      
      // Log operation
      await this.logSyncOperation(taskId, 'sync', 'success', results, Date.now() - startTime);
      
      return results;
    } catch (error) {
      await this.logSyncOperation(taskId, 'sync', 'failed', null, Date.now() - startTime, error.message);
      throw error;
    }
  }

  async executeSyncStrategy(task, strategy, options) {
    const results = {};
    const promises = [];

    if (strategy.calendar) {
      promises.push(
        this.syncToGoogleCalendar(task, options)
          .then(result => { results.calendar = result; })
      );
    }

    if (strategy.tasks) {
      promises.push(
        this.syncToGoogleTasks(task, options)
          .then(result => { results.tasks = result; })
      );
    }

    // Execute sync operations in parallel with error isolation
    const settledResults = await Promise.allSettled(promises);
    
    // Handle partial failures gracefully
    settledResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const service = strategy.calendar && index === 0 ? 'calendar' : 'tasks';
        console.error(`Sync failed for ${service}:`, result.reason);
        results[service] = { error: result.reason.message };
      }
    });

    return results;
  }

  async syncToGoogleCalendar(task, options = {}) {
    // Rate limiting
    await this.rateLimiter.acquire('calendar');
    
    try {
      const calendarEvent = this.mapTaskToCalendarEvent(task);
      
      if (task.google_calendar_event_id) {
        // Update existing event
        const result = await this.calendar.events.update({
          calendarId: options.calendarId || 'primary',
          eventId: task.google_calendar_event_id,
          resource: calendarEvent,
          sendUpdates: 'all' // Notify attendees of changes
        });
        return { id: result.data.id, etag: result.data.etag, operation: 'update' };
      } else {
        // Create new event
        const result = await this.calendar.events.insert({
          calendarId: options.calendarId || 'primary',
          resource: calendarEvent,
          sendUpdates: 'all'
        });
        
        // Update our database with the Google event ID
        await this.db.updateTask(task.id, {
          google_calendar_event_id: result.data.id,
          google_calendar_etag: result.data.etag
        });
        
        return { id: result.data.id, etag: result.data.etag, operation: 'create' };
      }
    } finally {
      this.rateLimiter.release('calendar');
    }
  }

  mapTaskToCalendarEvent(task) {
    const baseEvent = {
      summary: task.title,
      description: this.formatCalendarDescription(task),
      extendedProperties: {
        shared: {
          source: 'syncup-chat-app',
          taskId: task.id,
          channelId: task.thread_id,
          workspaceId: task.workspace_id,
          priority: task.priority,
          status: task.status,
          assignees: JSON.stringify(task.assignees),
          teams: JSON.stringify(task.assigned_teams),
          syncVersion: '1.0'
        }
      },
      colorId: this.getPriorityColor(task.priority),
      transparency: task.is_all_day ? 'transparent' : 'opaque'
    };

    // Handle scheduling
    if (task.start_time && task.end_time) {
      // Timed event
      baseEvent.start = {
        dateTime: `${task.start_date}T${task.start_time}:00Z`,
        timeZone: task.timezone || 'UTC'
      };
      baseEvent.end = {
        dateTime: `${task.end_date}T${task.end_time}:00Z`,
        timeZone: task.timezone || 'UTC'
      };
    } else if (task.start_date) {
      // All-day event
      baseEvent.start = { date: task.start_date };
      baseEvent.end = { date: task.end_date || task.start_date };
    }

    // Multi-assignee support via attendees
    if (task.assignees && task.assignees.length > 0) {
      baseEvent.attendees = task.assignees.map(userId => ({
        email: this.getUserEmail(userId),
        displayName: this.getUserDisplayName(userId),
        responseStatus: this.getTaskCompletionStatus(task, userId) ? 'accepted' : 'needsAction'
      }));
    }

    return baseEvent;
  }
}

class GoogleTasksClient {
  async syncToGoogleTasks(task, options = {}) {
    await this.rateLimiter.acquire('tasks');
    
    try {
      const googleTask = this.mapTaskToGoogleTask(task);
      
      if (task.google_task_id) {
        // Update existing task
        const result = await this.tasks.tasks.update({
          tasklist: options.taskListId || '@default',
          task: task.google_task_id,
          resource: googleTask
        });
        return { id: result.data.id, etag: result.data.etag, operation: 'update' };
      } else {
        // Create new task
        const result = await this.tasks.tasks.insert({
          tasklist: options.taskListId || '@default',
          resource: googleTask,
          parent: task.parent_task_id ? this.getGoogleTaskId(task.parent_task_id) : undefined
        });
        
        await this.db.updateTask(task.id, {
          google_task_id: result.data.id,
          google_task_etag: result.data.etag
        });
        
        return { id: result.data.id, etag: result.data.etag, operation: 'create' };
      }
    } finally {
      this.rateLimiter.release('tasks');
    }
  }
}
```

#### Data Flow Architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Google APIs   │
│   Task Dialog   │───▶│   Sync Service   │───▶│   Calendar &    │
│                 │    │                  │    │   Tasks         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   Database       │    │   Webhook       │
│   Updates       │◀───│   PostgreSQL     │◀───│   Notifications │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

#### Performance Considerations:

```javascript
class PerformanceOptimizations {
  // Batch processing for bulk operations
  async batchSyncTasks(taskIds, options = {}) {
    const BATCH_SIZE = 50; // Google API batch limit
    const batches = this.createBatches(taskIds, BATCH_SIZE);
    
    const results = await Promise.allSettled(
      batches.map(batch => this.processBatch(batch, options))
    );
    
    return this.aggregateBatchResults(results);
  }

  // Database query optimization
  async getTasksForSync(workspaceId, options = {}) {
    // Use prepared statements and indexes
    const query = `
      SELECT ct.*, 
             array_agg(DISTINCT u.email) as assignee_emails,
             array_agg(DISTINCT u.display_name) as assignee_names,
             wt.name as workspace_name,
             th.name as channel_name
      FROM channel_tasks ct
      LEFT JOIN users u ON u.id = ANY(ct.assignees)
      LEFT JOIN workspace_teams wt ON wt.id = ANY((ct.assigned_teams)::int[])
      LEFT JOIN threads th ON th.id = ct.thread_id
      WHERE ct.workspace_id = $1
        AND (ct.last_synced_at IS NULL OR ct.last_synced_at < ct.updated_at)
        AND ct.sync_strategy IS NOT NULL
      GROUP BY ct.id, wt.name, th.name
      ORDER BY ct.updated_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    return await this.db.query(query, [workspaceId, options.limit || 100, options.offset || 0]);
  }

  // Caching strategy
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: 300, // 5 minute cache
      checkperiod: 60,
      useClones: false
    });
    
    // Cache Google API responses to reduce duplicate calls
    this.googleApiCache = new Map();
  }
}
```

#### Security Implementation:

```javascript
class SecurityLayer {
  // OAuth token management
  async getValidAccessToken(userId) {
    const token = await this.tokenStore.getToken(userId);
    
    if (this.isTokenExpired(token)) {
      return await this.refreshToken(token.refresh_token);
    }
    
    return token.access_token;
  }

  // Data sanitization for Google APIs
  sanitizeForGoogle(data) {
    return {
      ...data,
      // Remove sensitive fields
      workspace_id: undefined,
      internal_notes: undefined,
      // Escape HTML/script content
      title: this.escapeHtml(data.title),
      description: this.escapeHtml(data.description)
    };
  }

  // Rate limiting per user
  async checkUserRateLimit(userId, operation) {
    const key = `rate_limit:${userId}:${operation}`;
    const current = await this.redis.get(key);
    
    if (current && parseInt(current) >= this.rateLimits[operation]) {
      throw new Error('Rate limit exceeded');
    }
    
    await this.redis.incr(key);
    await this.redis.expire(key, 60); // 1 minute window
  }

  // Audit logging
  async auditLog(operation, userId, details) {
    await this.db.auditLogs.create({
      operation,
      userId,
      details: JSON.stringify(details),
      timestamp: new Date(),
      ip_address: this.getClientIP(),
      user_agent: this.getUserAgent()
    });
  }
}
```

### Bidirectional Sync

**From Google → Our System:**
- Calendar events create time-blocked tasks
- Google Tasks create action-oriented tasks
- Changes in Google sync back to our system

**From Our System → Google:**
- Task completion updates both Calendar events and Google Tasks
- Date/time changes update Calendar events
- Status changes update Google Tasks

## 🛡️ Error Handling & Edge Cases

### Sync Conflicts
- **Resolution Strategy:** Last-modified-wins with conflict logging
- **User Notification:** Alert users to sync conflicts requiring manual resolution

### API Rate Limits
- **Batching:** Group multiple sync operations
- **Queuing:** Implement retry logic with exponential backoff
- **Prioritization:** Sync user-facing items first

### Partial Failures
- **Graceful Degradation:** Continue syncing to available services
- **Retry Logic:** Automatic retry for transient failures
- **User Feedback:** Clear status indicators for sync health

## 🚀 Implementation Phases

### Phase 1: Foundation
- [x] Database schema ready
- [x] Smart detection algorithm
- [ ] Google Calendar API integration
- [ ] Google Tasks API integration

### Phase 2: Basic Sync
- [ ] One-way sync (Our System → Google)
- [ ] Manual sync triggers
- [ ] Error handling and logging

### Phase 3: Advanced Sync
- [ ] Bidirectional sync (Google ↔ Our System)
- [ ] Real-time sync via webhooks
- [ ] Conflict resolution UI

### Phase 4: Optimization
- [ ] Bulk sync operations
- [ ] Smart sync scheduling
- [ ] Performance monitoring

## 📊 Success Metrics

- **Sync Accuracy:** >95% successful sync operations
- **User Satisfaction:** Minimal manual intervention required
- **Performance:** Sync operations complete within 2 seconds
- **Reliability:** 99.9% uptime for sync services

## 🔧 Configuration

### User Preferences
```javascript
{
  googleSync: {
    enabled: true,
    autoSync: true,
    preferredCalendar: 'primary',
    preferredTaskList: 'My Tasks',
    syncStrategy: 'auto', // 'auto', 'manual', 'calendar-only', 'tasks-only'
    conflictResolution: 'last-modified-wins' // 'manual', 'our-system-wins', 'google-wins'
  }
}
```

### Workspace Settings
```javascript
{
  googleIntegration: {
    defaultCalendar: 'Work Calendar',
    teamTaskList: 'Team Tasks',
    syncFrequency: '5min', // 'realtime', '1min', '5min', '15min', 'manual'
    bulkOperations: true
  }
}
```

## 🎨 Production-Ready UI Implementation (Expert-Reviewed)

**Updated based on expert developer feedback with production-grade TypeScript components, accessibility, and safety features.**

### Goals
- Provider-agnostic UI (Google now, Outlook later)
- No accidental attendee emails (UI warns when an action would notify others)
- Clear admin vs. user control with safe defaults
- Per-channel destinations and per-user overrides
- Accessible, resilient, and observable (loading, errors, telemetry)

### Multi-Provider Architecture (Future-Proof)

**File**: `frontend/src/components/integrations/ProviderCard.tsx`
```tsx
import React from "react";

type ProviderStatus = "connected" | "disconnected" | "coming-soon" | "planned";

export interface ProviderCardProps {
  provider: "google" | "outlook" | "apple";
  status: ProviderStatus;
  icon: React.ReactNode;
  title: string;
  description: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function ProviderCard({
  provider, status, icon, title, description, onConnect, onDisconnect
}: ProviderCardProps) {
  const disabled = status === "coming-soon" || status === "planned";
  return (
    <div
      className={`rounded-2xl border p-4 flex gap-3 items-start ${disabled ? "opacity-60" : ""}`}
      role="group"
      aria-disabled={disabled}
      data-provider={provider}
    >
      <div className="mt-1">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs rounded-full px-2 py-0.5 border">
            {status.replace("-", " ")}
          </span>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
        <div className="mt-3 flex gap-2">
          {status === "connected" && (
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={onDisconnect}>
              Disconnect
            </button>
          )}
          {status === "disconnected" && (
            <button className="rounded-xl bg-black text-white px-3 py-2 text-sm" onClick={onConnect}>
              Connect
            </button>
          )}
          {disabled && (
            <span className="text-xs text-gray-500" aria-live="polite">
              {status === "coming-soon" ? "Coming soon" : "Planned"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Task Creation with Sync Options (Production-Ready)

**File**: `frontend/src/components/tasks/TaskSyncOptions.tsx`
```tsx
import React, { useState } from "react";
import { useSyncRules } from "../hooks/useSyncRules";

export function TaskSyncOptions({
  defaultStrategy = "smart",
  availableDestinations
}: {
  defaultStrategy?: "smart" | "calendar-only" | "tasks-only" | "both";
  availableDestinations: Array<{
    id: string; 
    label: string; 
    visibility: "public"|"internal"|"external"; 
    provider: "google"|"outlook"; 
    type: "shared"|"personal" 
  }>;
}) {
  const [strategy, setStrategy] = useState(defaultStrategy);
  const { policy, notifyEmailOnAttendees } = useSyncRules();
  const [selected, setSelected] = useState<string[]>(() => 
    availableDestinations.filter(d => d.type === "shared").map(d => d.id)
  );

  const showNotifyWarning = notifyEmailOnAttendees && strategy !== "tasks-only";

  return (
    <section aria-labelledby="sync-options">
      <h4 id="sync-options" className="font-medium mb-2">Calendar & Task Sync</h4>

      <div className="space-y-2 mb-3">
        {availableDestinations.map(d => (
          <label key={d.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.includes(d.id)}
              onChange={e => {
                const next = new Set(selected);
                e.target.checked ? next.add(d.id) : next.delete(d.id);
                setSelected([...next]);
              }}
            />
            <span>{d.label}</span>
            <span className="text-xs rounded-full border px-2 py-0.5">{d.visibility}</span>
            <span className="text-[10px] ml-1 opacity-70">{d.provider}</span>
          </label>
        ))}
      </div>

      <label className="block text-sm mb-1">Sync Strategy</label>
      <select
        value={strategy}
        onChange={e => setStrategy(e.target.value as any)}
        className="border rounded-md px-2 py-2 text-sm"
      >
        <option value="smart">Smart Auto-Sync</option>
        <option value="calendar-only">Calendar Event Only</option>
        <option value="tasks-only">Task List Only</option>
        <option value="both">Both Calendar & Tasks</option>
      </select>

      {policy === "admin-mandatory" && (
        <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-2">
          Admin policy enforces certain destinations. Your choices may be supplemented by workspace rules.
        </div>
      )}

      {showNotifyWarning && (
        <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
          Heads-up: Adding <b>attendees</b> to provider events can send email updates. Our default mapping avoids
          attendees unless you explicitly enable them in advanced options.
        </div>
      )}
    </section>
  );
}
```

### UX Safeguards & Implementation Notes

**Safety Features:**
- **No surprise emails**: UI warns when attendees would be added (and we default to no attendees)
- **End-exclusive all-day**: Tooltips in date pickers ("All-day spans end-exclusive in Google Calendar")
- **Loading & error states**: All buttons show pending spinners; error toasts with action IDs
- **Conflict banner**: If backend returns ETAG_CONFLICT, surface "Event updated in Google. Review changes?"
- **Telemetry**: Fire events on connect/disconnect, save rules, per-task sync toggle

**Provider Capability Abstraction:**
```javascript
const PROVIDER_CAPABILITIES = {
  google: {
    calendar: true,
    tasks: true,
    bidirectionalSync: true,
    smartStrategy: true,
    sharedCalendars: true,
    taskHierarchy: true
  },
  outlook: {  // Future
    calendar: true,
    tasks: false,  // No task lists in Outlook
    bidirectionalSync: true,
    smartStrategy: false, // Different rules
    sharedCalendars: true,
    taskHierarchy: false
  },
  icloud: {  // Future
    calendar: true,
    tasks: false,  // No task API
    bidirectionalSync: false, // Read-only
    smartStrategy: false,
    sharedCalendars: false,
    taskHierarchy: false
  }
}
```

**Implementation Notes:**
- **Attendees**: Keep assignees in extendedProperties; only expose "Invite attendees" advanced toggle that clearly notes it may send emails
- **Default targets**: Admin can set per-channel shared calendars; user can add personal calendar/task list when policy allows
- **Accessibility**: Ensure all status pills are read by screen readers (use aria-label)
- **Provider parity**: Components accept Outlook later without redesign—only plug a Graph provider behind the same hooks

---

**Last Updated:** November 10, 2025  
**Version:** 1.1 (Expert Developer Feedback Integrated)  
**Status:** Production-Ready UI Implementation  
**Next Review:** December 1, 2025
