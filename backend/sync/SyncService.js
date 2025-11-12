/**
 * Main Sync Service - Google Calendar & Tasks Integration
 * Orchestrates the complete sync process with intelligent strategy selection
 */

const CalendarProvider = require('./google/CalendarProvider');
const TasksProvider = require('./google/TasksProvider');
const {
  mapTaskToCalendarEvent,
  mapTaskToGoogleTask,
  mapCalendarEventToTask,
  mapGoogleTaskToTask
} = require('./mappers');

class SyncService {
  constructor() {
    this.calendarProvider = new CalendarProvider();
    this.tasksProvider = new TasksProvider();
    
    // Track sync operations for debugging
    this.syncOperations = [];
    this.conflictLog = [];
  }

  /**
   * Main sync method - determine strategy and execute sync
   * @param {Object} credentials - User's OAuth credentials
   * @param {Object} task - Task data to sync
   * @param {string} workspaceName - Workspace name
   * @returns {Object} Sync results
   */
  async syncTask(credentials, task, workspaceName) {
    const operation = {
      taskId: task.id,
      taskTitle: task.title,
      workspaceName,
      startTime: new Date(),
      strategy: null,
      results: {},
      errors: []
    };

    try {
      // Step 1: Determine sync strategy using intelligent algorithm
      const strategy = this.determineSyncStrategy(task);
      operation.strategy = strategy;

      console.log(`🎯 Sync strategy for "${task.title}": ${strategy}`);

      // Step 2: Execute sync based on strategy
      switch (strategy) {
        case 'calendar_only':
          operation.results.calendar = await this.syncToCalendar(credentials, task, workspaceName);
          break;

        case 'tasks_only':
          operation.results.tasks = await this.syncToTasks(credentials, task, workspaceName);
          break;

        case 'both':
          // Sync to both services in parallel for efficiency
          const [calendarResult, tasksResult] = await Promise.allSettled([
            this.syncToCalendar(credentials, task, workspaceName),
            this.syncToTasks(credentials, task, workspaceName)
          ]);

          if (calendarResult.status === 'fulfilled') {
            operation.results.calendar = calendarResult.value;
          } else {
            operation.errors.push({ service: 'calendar', error: calendarResult.reason.message });
          }

          if (tasksResult.status === 'fulfilled') {
            operation.results.tasks = tasksResult.value;
          } else {
            operation.errors.push({ service: 'tasks', error: tasksResult.reason.message });
          }
          break;

        case 'none':
          console.log(`⏭️ Skipping sync for task "${task.title}" - strategy determined as 'none'`);
          operation.results.skipped = true;
          break;

        default:
          throw new Error(`Unknown sync strategy: ${strategy}`);
      }

      // Step 3: Update task with Google IDs
      await this.updateTaskWithSyncResults(task, operation.results);

      operation.endTime = new Date();
      operation.duration = operation.endTime - operation.startTime;
      operation.success = true;

      console.log(`✅ Sync completed for "${task.title}" in ${operation.duration}ms`);

    } catch (error) {
      operation.endTime = new Date();
      operation.duration = operation.endTime - operation.startTime;
      operation.success = false;
      operation.mainError = error.message;

      console.error(`❌ Sync failed for "${task.title}":`, error.message);
      throw error;

    } finally {
      this.syncOperations.push(operation);
    }

    return operation;
  }

  /**
   * Intelligent sync strategy determination
   * Expert Algorithm: Analyzes task attributes to decide Calendar vs Tasks vs Both
   * @param {Object} task - Task to analyze
   * @returns {string} Strategy: 'calendar_only', 'tasks_only', 'both', or 'none'
   */
  determineSyncStrategy(task) {
    const hasSpecificTimes = task.start_time && task.end_time;
    const hasLocation = task.location && task.location.trim().length > 0;
    const isScheduledEvent = hasSpecificTimes || hasLocation;
    const isSimpleTask = !hasSpecificTimes && !hasLocation;
    const hasMultipleAssignees = (task.assignees?.length > 1) || (task.assigned_teams?.length > 0);
    const isHighPriority = ['urgent', 'high'].includes(task.priority?.toLowerCase());
    const hasComplexTags = task.tags?.length > 2;
    const isLongRunning = task.estimated_hours && task.estimated_hours > 4;

    // Strategy Rules (Expert-Reviewed):

    // 1. Time-blocked events with specific times → Calendar Only
    if (hasSpecificTimes && hasLocation) {
      return 'calendar_only';
    }

    // 2. Simple tasks without time/location → Tasks Only
    if (isSimpleTask && !hasMultipleAssignees && !isHighPriority) {
      return 'tasks_only';
    }

    // 3. Multi-assignee or high-priority tasks → Both (for visibility)
    if (hasMultipleAssignees || isHighPriority || hasComplexTags) {
      return 'both';
    }

    // 4. Long-running tasks → Both (time-blocking + task tracking)
    if (isLongRunning) {
      return 'both';
    }

    // 5. Tasks with specific dates but no times → Both
    if (task.start_date && !hasSpecificTimes) {
      return 'both';
    }

    // 6. Tasks with location but no specific times → Calendar Only
    if (hasLocation && !hasSpecificTimes) {
      return 'calendar_only';
    }

    // 7. Default fallback based on due date
    if (task.due_date) {
      return 'tasks_only';
    }

    // 8. Everything else → Tasks Only (conservative approach)
    return 'tasks_only';
  }

  /**
   * Sync task to Google Calendar
   * @param {Object} credentials - User credentials
   * @param {Object} task - Task to sync
   * @param {string} workspaceName - Workspace name
   * @returns {Object} Calendar sync result
   */
  async syncToCalendar(credentials, task, workspaceName) {
    try {
      // Map task to calendar event format
      const calendarEvent = mapTaskToCalendarEvent(task, {
        preventEmailNotifications: true,
        useEndExclusiveDates: true,
        includeAttendees: false // Expert safeguard: no email spam
      });

      // Sync to Google Calendar
      const result = await this.calendarProvider.syncTaskToCalendar(
        credentials, 
        calendarEvent, 
        workspaceName
      );

      return {
        service: 'calendar',
        eventId: result.eventId,
        htmlLink: result.htmlLink,
        operation: result.operation,
        success: true
      };

    } catch (error) {
      console.error('❌ Calendar sync error:', error.message);
      throw new Error(`Calendar sync failed: ${error.message}`);
    }
  }

  /**
   * Sync task to Google Tasks
   * @param {Object} credentials - User credentials
   * @param {Object} task - Task to sync
   * @param {string} workspaceName - Workspace name
   * @returns {Object} Tasks sync result
   */
  async syncToTasks(credentials, task, workspaceName) {
    try {
      // Map task to Google Tasks format
      const googleTask = mapTaskToGoogleTask(task);

      // Sync to Google Tasks
      const result = await this.tasksProvider.syncTaskToTasks(
        credentials,
        googleTask,
        workspaceName
      );

      return {
        service: 'tasks',
        taskId: result.taskId,
        operation: result.operation,
        success: true
      };

    } catch (error) {
      console.error('❌ Tasks sync error:', error.message);
      throw new Error(`Tasks sync failed: ${error.message}`);
    }
  }

  /**
   * Update task with Google sync results (would interface with database)
   * @param {Object} task - Original task
   * @param {Object} results - Sync results
   */
  async updateTaskWithSyncResults(task, results) {
    const updates = {
      last_synced_at: new Date(),
      sync_status: 'synced',
      sync_errors: null
    };

    // Update Google Calendar ID if synced
    if (results.calendar?.eventId) {
      updates.google_calendar_event_id = results.calendar.eventId;
      updates.google_calendar_link = results.calendar.htmlLink;
    }

    // Update Google Tasks ID if synced
    if (results.tasks?.taskId) {
      updates.google_task_id = results.tasks.taskId;
    }

    // Set sync strategy used
    if (results.calendar && results.tasks) {
      updates.sync_strategy = 'both';
    } else if (results.calendar) {
      updates.sync_strategy = 'calendar';
    } else if (results.tasks) {
      updates.sync_strategy = 'tasks';
    }

    console.log(`🔄 Would update task ${task.id} with sync results:`, updates);
    
    // TODO: Implement database update
    // await updateTaskInDatabase(task.id, updates);
  }

  /**
   * Bulk sync for multiple tasks
   * @param {Object} credentials - User credentials
   * @param {Array} tasks - Array of tasks to sync
   * @param {string} workspaceName - Workspace name
   * @returns {Object} Bulk sync results
   */
  async syncTasks(credentials, tasks, workspaceName) {
    const results = {
      total: tasks.length,
      successful: 0,
      failed: 0,
      errors: [],
      operations: []
    };

    console.log(`🚀 Starting bulk sync of ${tasks.length} tasks for workspace: ${workspaceName}`);

    // Process tasks with controlled concurrency (max 3 at a time)
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(tasks, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(task => 
        this.syncTask(credentials, task, workspaceName)
          .then(operation => {
            results.successful++;
            return operation;
          })
          .catch(error => {
            results.failed++;
            results.errors.push({
              taskId: task.id,
              taskTitle: task.title,
              error: error.message
            });
            return { success: false, error: error.message, taskId: task.id };
          })
      );

      const chunkResults = await Promise.allSettled(chunkPromises);
      results.operations.push(...chunkResults.map(r => r.value));

      // Brief pause between chunks to be respectful to Google APIs
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ Bulk sync completed: ${results.successful}/${results.total} successful`);
    return results;
  }

  /**
   * Incremental sync - fetch changes from Google and update our system
   * @param {Object} credentials - User credentials
   * @param {string} workspaceName - Workspace name
   * @param {string} lastSyncTime - Last sync timestamp
   * @returns {Object} Incremental sync results
   */
  async incrementalSync(credentials, workspaceName, lastSyncTime) {
    console.log(`🔄 Starting incremental sync for workspace: ${workspaceName}`);

    const results = {
      calendar: { changes: 0, events: [] },
      tasks: { changes: 0, tasks: [] },
      conflicts: [],
      errors: []
    };

    try {
      // Fetch changes from both services in parallel
      const [calendarChanges, tasksChanges] = await Promise.allSettled([
        this.calendarProvider.incrementalSync(credentials, workspaceName, lastSyncTime),
        this.tasksProvider.incrementalSync(credentials, workspaceName, lastSyncTime)
      ]);

      // Process Calendar changes
      if (calendarChanges.status === 'fulfilled') {
        results.calendar = calendarChanges.value;
        console.log(`📅 Found ${results.calendar.changes} calendar changes`);
      } else {
        results.errors.push({ service: 'calendar', error: calendarChanges.reason.message });
      }

      // Process Tasks changes  
      if (tasksChanges.status === 'fulfilled') {
        results.tasks = tasksChanges.value;
        console.log(`✅ Found ${results.tasks.changes} task changes`);
      } else {
        results.errors.push({ service: 'tasks', error: tasksChanges.reason.message });
      }

      // Detect and handle conflicts (same task changed in multiple places)
      results.conflicts = await this.detectConflicts(results.calendar.events, results.tasks.tasks);

    } catch (error) {
      console.error('❌ Incremental sync error:', error.message);
      results.errors.push({ service: 'general', error: error.message });
    }

    return results;
  }

  /**
   * Detect conflicts between Calendar and Tasks changes
   * @param {Array} calendarEvents - Changed calendar events
   * @param {Array} googleTasks - Changed Google tasks
   * @returns {Array} Detected conflicts
   */
  async detectConflicts(calendarEvents, googleTasks) {
    const conflicts = [];

    // Look for tasks that changed in both systems
    for (const event of calendarEvents) {
      const sourceKey = event.extendedProperties?.private?.sourceKey;
      if (sourceKey) {
        const matchingTask = googleTasks.find(task => {
          const notes = task.notes || '';
          return notes.includes(`sourceKey:${sourceKey}`);
        });

        if (matchingTask) {
          conflicts.push({
            sourceKey,
            calendarEvent: event,
            googleTask: matchingTask,
            timestamp: new Date(),
            severity: 'medium'
          });
        }
      }
    }

    if (conflicts.length > 0) {
      console.warn(`⚠️ Detected ${conflicts.length} sync conflicts`);
      this.conflictLog.push(...conflicts);
    }

    return conflicts;
  }

  /**
   * Health check for both Google services
   * @param {Object} credentials - User credentials
   * @returns {Object} Health status
   */
  async healthCheck(credentials) {
    const [calendarHealth, tasksHealth] = await Promise.allSettled([
      this.calendarProvider.healthCheck(credentials),
      this.tasksProvider.healthCheck(credentials)
    ]);

    return {
      calendar: calendarHealth.status === 'fulfilled' ? calendarHealth.value : { status: 'unhealthy', error: calendarHealth.reason.message },
      tasks: tasksHealth.status === 'fulfilled' ? tasksHealth.value : { status: 'unhealthy', error: tasksHealth.reason.message },
      overall: (calendarHealth.status === 'fulfilled' && tasksHealth.status === 'fulfilled') ? 'healthy' : 'degraded',
      timestamp: new Date()
    };
  }

  /**
   * Get sync statistics and debugging info
   * @returns {Object} Sync statistics
   */
  getSyncStats() {
    const recentOperations = this.syncOperations.slice(-100); // Last 100 operations
    
    const stats = {
      totalOperations: this.syncOperations.length,
      recentOperations: recentOperations.length,
      successRate: recentOperations.filter(op => op.success).length / recentOperations.length,
      averageDuration: recentOperations.reduce((sum, op) => sum + (op.duration || 0), 0) / recentOperations.length,
      strategyCounts: {},
      recentConflicts: this.conflictLog.slice(-10),
      lastOperation: recentOperations[recentOperations.length - 1]
    };

    // Count strategy usage
    recentOperations.forEach(op => {
      if (op.strategy) {
        stats.strategyCounts[op.strategy] = (stats.strategyCounts[op.strategy] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Utility: Split array into chunks
   * @param {Array} array - Array to chunk
   * @param {number} chunkSize - Size of each chunk
   * @returns {Array} Array of chunks
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clear sync history (for cleanup)
   * @param {number} keepDays - Days of history to keep (default 7)
   */
  clearOldSyncHistory(keepDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    this.syncOperations = this.syncOperations.filter(op => 
      op.startTime > cutoffDate
    );

    this.conflictLog = this.conflictLog.filter(conflict => 
      conflict.timestamp > cutoffDate
    );

    console.log(`🧹 Cleaned up sync history older than ${keepDays} days`);
  }
}

module.exports = SyncService;
