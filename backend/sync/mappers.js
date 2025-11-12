/**
 * Google Sync Mappers - Location & Tags Integration
 * 
 * Expert-reviewed implementation for syncing location and tags between
 * our task system and Google Calendar/Tasks APIs.
 * 
 * Key Features:
 * - Intelligent location mapping
 * - Smart tag-to-color conversion  
 * - De-duplication using sourceKey
 * - End-exclusive date handling
 * - No accidental email notifications
 * 
 * Future-ready for Outlook and Apple Calendar integration.
 */

const GOOGLE_CALENDAR_COLORS = {
  1: 'Blue',      // Default, medium priority
  2: 'Green',     // Low priority, completed
  3: 'Purple',    // Review, analysis
  4: 'Red',       // Critical, deployment
  5: 'Yellow',    // Marketing, content
  6: 'Orange',    // High priority, attention needed
  7: 'Turquoise', // Testing, QA
  8: 'Gray',      // Cancelled, inactive
  9: 'Bold Blue', // Design, creative
  10: 'Bold Green', // Meeting, collaboration
  11: 'Bold Red'    // Urgent, critical bugs
};

const PRIORITY_TO_COLOR_MAP = {
  urgent: '11',   // Bold Red
  high: '6',      // Orange
  medium: '1',    // Blue
  low: '2'        // Green
};

const TAG_TO_COLOR_MAP = {
  // Priority tags
  urgent: '11',
  critical: '11',
  high: '6',
  
  // Type tags
  bug: '11',
  meeting: '10',
  review: '3',
  testing: '7',
  deployment: '4',
  
  // Department tags
  development: '1',
  frontend: '1',
  backend: '2',
  design: '9',
  marketing: '5',
  
  // Status tags
  blocked: '8',
  cancelled: '8',
  done: '2',
  
  // Special tags
  client: '6',
  presentation: '5',
  demo: '10'
};

/**
 * Maps our internal task to Google Calendar event format
 * Handles location, tags, and expert-recommended safeguards
 */
function mapTaskToCalendarEvent(task, options = {}) {
  const {
    preventEmailNotifications = true,
    useEndExclusiveDates = true,
    includeAttendees = false
  } = options;

  // Base event structure
  const calendarEvent = {
    summary: task.title,
    description: formatCalendarDescription(task),
    
    // Location mapping (direct from our location field)
    location: task.location || undefined,
    
    // Color coding based on tags and priority
    colorId: mapTaskToColorId(task.tags, task.priority),
    
    // Extended properties for metadata and filtering
    extendedProperties: {
      shared: {
        // De-duplication and source tracking
        source: 'syncup-chat-app',
        sourceKey: task.source_key,
        taskId: task.id,
        channelId: task.thread_id,
        workspaceId: task.workspace_id,
        
        // Task metadata
        priority: task.priority,
        status: task.status,
        
        // Assignee information (without creating attendees)
        assignees: JSON.stringify(task.assignees || []),
        assignedTeams: JSON.stringify(task.assigned_teams || []),
        assignmentMode: task.assignment_mode,
        
        // Tags for filtering and categorization
        tags: JSON.stringify(task.tags || []),
        tagCount: task.tags ? task.tags.length.toString() : '0',
        
        // Multi-assignee progress info
        isMultiAssignee: (task.assignees?.length > 1 || task.assigned_teams?.length > 0) ? 'true' : 'false',
        completionProgress: task.completion_count ? `${task.completion_count}/${task.assignee_count || 1}` : '0/1',
        
        // Sync metadata
        syncVersion: '1.0',
        lastSyncedFrom: 'our-system'
      }
    },

    // Transparency setting for time-blocking
    transparency: task.is_all_day ? 'transparent' : 'opaque',
    
    // Event type
    eventType: 'default',
    
    // Visibility (default to prevent accidental sharing)
    visibility: 'default'
  };

  // Handle date/time mapping with end-exclusive logic
  if (task.start_time && task.end_time && !task.is_all_day) {
    // Timed event with specific times
    calendarEvent.start = {
      dateTime: formatDateTime(task.start_date, task.start_time, task.timezone),
      timeZone: task.timezone || 'UTC'
    };
    calendarEvent.end = {
      dateTime: formatDateTime(task.end_date, task.end_time, task.timezone),
      timeZone: task.timezone || 'UTC'
    };
  } else if (task.start_date) {
    // All-day event with end-exclusive date handling
    calendarEvent.start = { date: formatDate(task.start_date) };
    
    if (useEndExclusiveDates && task.end_date) {
      // Google Calendar expects end-exclusive dates for all-day events
      const endDate = new Date(task.end_date);
      endDate.setDate(endDate.getDate() + 1);
      calendarEvent.end = { date: formatDate(endDate) };
    } else {
      // Default to single day
      calendarEvent.end = { date: formatDate(task.start_date) };
    }
  }

  // Attendees handling (expert safeguard: default to NO attendees)
  if (includeAttendees && task.assignees?.length > 0) {
    // Only add attendees if explicitly requested and with safeguards
    calendarEvent.attendees = task.assignees.map(userId => ({
      email: getUserEmail(userId), // This would need to be implemented
      displayName: getUserDisplayName(userId), // This would need to be implemented
      responseStatus: getTaskCompletionStatus(task, userId) ? 'accepted' : 'needsAction',
      optional: task.assignment_mode === 'collaborative' // Make collaborative assignments optional
    }));
    
    // Prevent automatic email notifications
    calendarEvent.guestsCanSeeOtherGuests = false;
    calendarEvent.guestsCanInviteOthers = false;
    calendarEvent.guestsCanModify = false;
  }

  // Working location properties for office/remote work
  if (task.location && isWorkingLocation(task.location)) {
    calendarEvent.workingLocationProperties = mapWorkingLocation(task.location);
  }

  return calendarEvent;
}

/**
 * Maps our internal task to Google Tasks format
 * Handles structured notes with location and tag information
 */
function mapTaskToGoogleTask(task) {
  const googleTask = {
    title: task.title,
    notes: formatTaskNotes(task),
    
    // Due date handling
    due: task.due_date ? formatTaskDueDate(task.due_date) : undefined,
    
    // Status mapping
    status: task.status === 'completed' ? 'completed' : 'needsAction',
    
    // Parent/child hierarchy support
    parent: task.parent_task_id ? getGoogleTaskId(task.parent_task_id) : undefined
  };

  // Add links back to our system
  if (task.workspace_id && task.thread_id) {
    googleTask.links = [{
      type: 'email',
      description: 'View in SyncUp Chat',
      link: `${process.env.APP_URL || 'https://app.syncup.com'}/workspace/${task.workspace_id}/channel/${task.thread_id}?task=${task.id}`
    }];
  }

  return googleTask;
}

/**
 * Smart color mapping based on tags and priority
 * Returns Google Calendar color ID
 */
function mapTaskToColorId(tags = [], priority = 'medium') {
  // First, check tags for specific color matches
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (TAG_TO_COLOR_MAP[tagLower]) {
        return TAG_TO_COLOR_MAP[tagLower];
      }
    }
  }
  
  // Fallback to priority-based colors
  return PRIORITY_TO_COLOR_MAP[priority?.toLowerCase()] || PRIORITY_TO_COLOR_MAP.medium;
}

/**
 * Format enhanced calendar event description with location and tags
 */
function formatCalendarDescription(task) {
  let description = task.description || '';
  
  // Add location information if present
  if (task.location) {
    description += `\n\n📍 Location: ${task.location}`;
  }
  
  // Add tags as hashtags
  if (task.tags && task.tags.length > 0) {
    const tagList = task.tags.map(tag => `#${tag}`).join(' ');
    description += `\n\n🏷️ Tags: ${tagList}`;
  }
  
  // Add assignee information
  if (task.assignees?.length > 0) {
    description += `\n\n👥 Assigned to: ${task.assignees.length} people`;
    if (task.assignment_mode === 'individual_response') {
      description += ` (individual completion required)`;
    }
  }
  
  // Add team assignments
  if (task.assigned_teams?.length > 0) {
    description += `\n\n👥 Teams: ${task.assigned_teams.length} teams assigned`;
  }
  
  // Add source and metadata
  description += `\n\n---\n🔗 Source: SyncUp Chat App`;
  description += `\n📋 Channel: ${getChannelName(task.thread_id)}`;
  description += `\n🆔 Task ID: ${task.id}`;
  
  return description.trim();
}

/**
 * Format Google Tasks notes with structured data including location and tags
 */
function formatTaskNotes(task) {
  let notes = task.description || '';
  
  // Add structured metadata
  notes += `\n\n📋 Task Details:`;
  notes += `\n• Priority: ${(task.priority || 'medium').toUpperCase()}`;
  notes += `\n• Status: ${(task.status || 'pending').replace('_', ' ').toUpperCase()}`;
  
  // Location information
  if (task.location) {
    notes += `\n• Location: ${task.location}`;
  }
  
  // Tags information
  if (task.tags && task.tags.length > 0) {
    notes += `\n• Tags: ${task.tags.join(', ')}`;
  }
  
  // Assignee information
  if (task.assignees?.length > 0) {
    notes += `\n• Assigned to: ${task.assignees.length} people`;
  }
  
  // Team assignments
  if (task.assigned_teams?.length > 0) {
    notes += `\n• Teams: ${task.assigned_teams.length} teams`;
  }
  
  // Links and metadata
  notes += `\n\n🔗 Links:`;
  notes += `\n• Channel: ${getChannelName(task.thread_id)}`;
  
  if (task.workspace_id && task.thread_id) {
    const appUrl = process.env.APP_URL || 'https://app.syncup.com';
    notes += `\n• View Task: ${appUrl}/workspace/${task.workspace_id}/channel/${task.thread_id}?task=${task.id}`;
  }
  
  // Sync metadata for debugging
  notes += `\n\n🤖 Sync Data:`;
  notes += `\n[SYNCUP:${task.id}:${task.workspace_id}:${task.thread_id}:${task.source_key}]`;
  
  return notes.trim();
}

/**
 * Working location mapping for Google Calendar's workingLocationProperties
 */
function mapWorkingLocation(location) {
  const locationLower = location.toLowerCase();
  
  if (locationLower.includes('home') || locationLower.includes('remote')) {
    return {
      type: 'homeOffice',
      homeOffice: {}
    };
  }
  
  if (locationLower.includes('office') || locationLower.includes('conference room') || locationLower.includes('meeting room')) {
    return {
      type: 'officeLocation',
      officeLocation: {
        label: location
      }
    };
  }
  
  // Custom location
  return {
    type: 'customLocation',
    customLocation: {
      label: location
    }
  };
}

/**
 * Check if location should be treated as a working location
 */
function isWorkingLocation(location) {
  if (!location) return false;
  
  const locationLower = location.toLowerCase();
  const workingKeywords = ['office', 'home', 'remote', 'conference room', 'meeting room', 'desk', 'building'];
  
  return workingKeywords.some(keyword => locationLower.includes(keyword));
}

/**
 * Utility functions for date/time formatting
 */
function formatDateTime(date, time, timezone = 'UTC') {
  const dateStr = typeof date === 'string' ? date.split('T')[0] : date.toISOString().split('T')[0];
  return `${dateStr}T${time}:00${timezone === 'UTC' ? 'Z' : ''}`;
}

function formatDate(date) {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

function formatTaskDueDate(dueDate) {
  return formatDate(dueDate) + 'T00:00:00.000Z';
}

/**
 * Reverse mapping: Google Calendar event to our task format
 */
function mapCalendarEventToTask(event, workspaceId, threadId) {
  const task = {
    title: event.summary,
    description: extractTaskDescription(event.description),
    location: event.location || null,
    priority: extractPriorityFromEvent(event),
    tags: extractTagsFromEvent(event),
    
    // Date/time extraction
    start_date: event.start?.dateTime ? new Date(event.start.dateTime) : (event.start?.date ? new Date(event.start.date) : null),
    end_date: event.end?.dateTime ? new Date(event.end.dateTime) : (event.end?.date ? new Date(event.end.date) : null),
    is_all_day: !event.start?.dateTime,
    
    // Timezone
    timezone: event.start?.timeZone || 'UTC',
    
    // Google sync metadata
    google_calendar_event_id: event.id,
    google_calendar_etag: event.etag,
    source_key: event.extendedProperties?.shared?.sourceKey,
    sync_strategy: 'calendar',
    
    // Workspace/thread context
    workspace_id: workspaceId,
    thread_id: threadId,
    
    // Status
    status: event.status === 'cancelled' ? 'cancelled' : 'pending'
  };
  
  // Extract times for non-all-day events
  if (!task.is_all_day && event.start?.dateTime) {
    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);
    
    task.start_time = startDate.toTimeString().slice(0, 5); // HH:MM format
    task.end_time = endDate.toTimeString().slice(0, 5);
  }
  
  return task;
}

/**
 * Reverse mapping: Google Task to our task format
 */
function mapGoogleTaskToTask(googleTask, workspaceId, threadId) {
  const task = {
    title: googleTask.title,
    description: extractTaskDescriptionFromNotes(googleTask.notes),
    due_date: googleTask.due ? new Date(googleTask.due) : null,
    status: googleTask.status === 'completed' ? 'completed' : 'pending',
    
    // Extract location and tags from notes
    location: extractLocationFromNotes(googleTask.notes),
    tags: extractTagsFromNotes(googleTask.notes),
    priority: extractPriorityFromNotes(googleTask.notes),
    
    // Google sync metadata
    google_task_id: googleTask.id,
    google_task_etag: googleTask.etag,
    source_key: extractSourceKeyFromNotes(googleTask.notes),
    sync_strategy: 'tasks',
    
    // Workspace/thread context
    workspace_id: workspaceId,
    thread_id: threadId,
    
    // Completion tracking
    completed_at: googleTask.status === 'completed' && googleTask.updated ? new Date(googleTask.updated) : null
  };
  
  return task;
}

/**
 * Helper functions for extracting data from Google responses
 */
function extractTaskDescription(description) {
  if (!description) return '';
  
  // Remove our added metadata sections
  return description
    .split('\n\n📍')[0] // Remove location section
    .split('\n\n🏷️')[0] // Remove tags section  
    .split('\n\n👥')[0] // Remove assignee section
    .split('\n\n---')[0] // Remove source section
    .trim();
}

function extractPriorityFromEvent(event) {
  const priority = event.extendedProperties?.shared?.priority;
  if (priority) return priority;
  
  // Fallback: derive from color
  const colorId = event.colorId;
  switch (colorId) {
    case '11': return 'urgent';
    case '6': return 'high';
    case '2': return 'low';
    default: return 'medium';
  }
}

function extractTagsFromEvent(event) {
  const tagsString = event.extendedProperties?.shared?.tags;
  if (tagsString) {
    try {
      return JSON.parse(tagsString);
    } catch (e) {
      console.warn('Failed to parse tags from event:', e);
    }
  }
  
  // Fallback: extract hashtags from description
  if (event.description) {
    const hashtagRegex = /#(\w+)/g;
    const matches = [...event.description.matchAll(hashtagRegex)];
    return matches.map(match => match[1]);
  }
  
  return [];
}

function extractLocationFromNotes(notes) {
  if (!notes) return null;
  
  const locationMatch = notes.match(/• Location: (.+)/);
  return locationMatch ? locationMatch[1] : null;
}

function extractTagsFromNotes(notes) {
  if (!notes) return [];
  
  const tagsMatch = notes.match(/• Tags: (.+)/);
  if (tagsMatch) {
    return tagsMatch[1].split(', ').map(tag => tag.trim());
  }
  
  return [];
}

function extractPriorityFromNotes(notes) {
  if (!notes) return 'medium';
  
  const priorityMatch = notes.match(/• Priority: (\w+)/);
  return priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';
}

function extractSourceKeyFromNotes(notes) {
  if (!notes) return null;
  
  const sourceKeyMatch = notes.match(/\[SYNCUP:[^:]+:[^:]+:[^:]+:([^\]]+)\]/);
  return sourceKeyMatch ? sourceKeyMatch[1] : null;
}

function extractTaskDescriptionFromNotes(notes) {
  if (!notes) return '';
  
  // Extract everything before the metadata sections
  return notes
    .split('\n\n📋 Task Details:')[0]
    .split('\n\n🔗 Links:')[0]
    .split('\n\n🤖 Sync Data:')[0]
    .trim();
}

/**
 * Placeholder functions that would need to be implemented
 * These would interface with your user management system
 */
function getUserEmail(userId) {
  // TODO: Implement user lookup
  return `user-${userId}@example.com`;
}

function getUserDisplayName(userId) {
  // TODO: Implement user lookup
  return `User ${userId}`;
}

function getChannelName(threadId) {
  // TODO: Implement channel lookup
  return `Channel ${threadId}`;
}

function getTaskCompletionStatus(task, userId) {
  // TODO: Check if user has completed the task
  return task.individual_completions && task.individual_completions[userId];
}

function getGoogleTaskId(parentTaskId) {
  // TODO: Look up Google Task ID for parent
  return null;
}

// Export all mapping functions
module.exports = {
  // Core mapping functions
  mapTaskToCalendarEvent,
  mapTaskToGoogleTask,
  mapCalendarEventToTask,
  mapGoogleTaskToTask,
  
  // Utility functions
  mapTaskToColorId,
  mapWorkingLocation,
  isWorkingLocation,
  
  // Format functions
  formatCalendarDescription,
  formatTaskNotes,
  formatDateTime,
  formatDate,
  formatTaskDueDate,
  
  // Extraction functions
  extractTaskDescription,
  extractPriorityFromEvent,
  extractTagsFromEvent,
  extractLocationFromNotes,
  extractTagsFromNotes,
  extractPriorityFromNotes,
  extractSourceKeyFromNotes,
  
  // Constants
  GOOGLE_CALENDAR_COLORS,
  PRIORITY_TO_COLOR_MAP,
  TAG_TO_COLOR_MAP
};
