/**
 * Google Tasks Provider - Production Ready with Expert Fixes
 * Handles Tasks API operations with incremental sync and structured notes
 */

const { google } = require('googleapis');
const NodeCache = require('node-cache');
const ExponentialBackoff = require('../../utils/backoff');

class TasksProvider {
  constructor() {
    this.backoff = new ExponentialBackoff({
      baseDelay: 1000,
      maxDelay: 30000,
      maxRetries: 3
    });
    
    // Cache for task list instances (1 hour TTL)
    this.tasksCache = new NodeCache({ stdTTL: 3600 });
    
    // Cache for workspace task lists (24 hour TTL)
    this.taskListCache = new NodeCache({ stdTTL: 86400 });
  }

  /**
   * Initialize Google Tasks client with OAuth credentials
   * @param {Object} credentials - User's OAuth credentials
   * @returns {Object} Authenticated Tasks client
   */
  async initializeClient(credentials) {
    const cacheKey = `tasks_${credentials.userId}`;
    let tasks = this.tasksCache.get(cacheKey);
    
    if (!tasks) {
      const auth = new google.auth.OAuth2(
        process.env.GMAIL_OAUTH_CLIENT_ID,
        process.env.GMAIL_OAUTH_CLIENT_SECRET
      );

      auth.setCredentials({
        refresh_token: credentials.refresh_token,
        access_token: credentials.access_token,
        token_type: 'Bearer'
      });

      tasks = google.tasks({ version: 'v1', auth });
      this.tasksCache.set(cacheKey, tasks);
    }

    return tasks;
  }

  /**
   * Get or create per-workspace task list
   * Expert Fix: Use separate task lists per workspace for organization
   * @param {Object} tasks - Tasks client
   * @param {string} workspaceName - Name of the workspace
   * @returns {string} Task list ID for the workspace
   */
  async getWorkspaceTaskList(tasks, workspaceName) {
    const listTitle = `${workspaceName} Tasks`;
    const cacheKey = `taskList_${workspaceName}`;
    
    // Check cache first
    let taskListId = this.taskListCache.get(cacheKey);
    if (taskListId) {
      return taskListId;
    }

    try {
      // First, try to find existing workspace task list
      const taskListsResponse = await this.backoff.execute(async () => {
        return await tasks.tasklists.list();
      }, { operation: 'list_tasklists', workspace: workspaceName });

      const existingTaskList = taskListsResponse.data.items.find(
        list => list.title === listTitle
      );

      if (existingTaskList) {
        this.taskListCache.set(cacheKey, existingTaskList.id);
        return existingTaskList.id;
      }

      // Create new task list for this workspace
      const createResponse = await this.backoff.execute(async () => {
        return await tasks.tasklists.insert({
          requestBody: {
            title: listTitle
          }
        });
      }, { operation: 'create_tasklist', workspace: workspaceName });

      taskListId = createResponse.data.id;
      this.taskListCache.set(cacheKey, taskListId);
      
      console.log(`✅ Created workspace task list: ${listTitle}`);
      return taskListId;

    } catch (error) {
      console.error('❌ Error managing workspace task list:', error.message);
      throw error;
    }
  }

  /**
   * Sync task to Google Tasks with expert fixes
   * @param {Object} credentials - User's OAuth credentials  
   * @param {Object} task - Task data with mapping applied
   * @param {string} workspaceName - Workspace name for task list selection
   * @returns {Object} Created/updated task details
   */
  async syncTaskToTasks(credentials, task, workspaceName) {
    const tasks = await this.initializeClient(credentials);
    const taskListId = await this.getWorkspaceTaskList(tasks, workspaceName);

    try {
      // Check if task already exists using sourceKey in notes (de-duplication)
      let existingTask = null;
      if (task.sourceKey) {
        const searchResponse = await this.backoff.execute(async () => {
          return await tasks.tasks.list({
            tasklist: taskListId,
            maxResults: 100, // Tasks API doesn't have search, so we need to check manually
            showCompleted: true,
            showHidden: true
          });
        }, { operation: 'search_existing', taskId: task.id });

        // Look for task with matching sourceKey in notes
        existingTask = searchResponse.data.items?.find(googleTask => {
          const notes = googleTask.notes || '';
          return notes.includes(`sourceKey:${task.sourceKey}`);
        });
      }

      // Prepare task data with expert fixes
      const taskData = this.prepareTaskData(task);

      if (existingTask) {
        // Update existing task
        const updateResponse = await this.backoff.execute(async () => {
          return await tasks.tasks.update({
            tasklist: taskListId,
            task: existingTask.id,
            requestBody: taskData
          });
        }, { operation: 'update_task', taskId: task.id });

        console.log(`✅ Updated Google Task: ${task.title}`);
        return {
          taskId: updateResponse.data.id,
          operation: 'updated'
        };

      } else {
        // Create new task
        const createResponse = await this.backoff.execute(async () => {
          return await tasks.tasks.insert({
            tasklist: taskListId,
            requestBody: taskData
          });
        }, { operation: 'create_task', taskId: task.id });

        console.log(`✅ Created Google Task: ${task.title}`);
        return {
          taskId: createResponse.data.id,
          operation: 'created'
        };
      }

    } catch (error) {
      console.error('❌ Error syncing task to Google Tasks:', error.message);
      throw error;
    }
  }

  /**
   * Prepare task data with all expert fixes applied
   * @param {Object} task - Mapped task data
   * @returns {Object} Google Tasks task data
   */
  prepareTaskData(task) {
    const taskData = {
      title: task.title,
      notes: this.formatTaskNotes(task),
      
      // Expert Fix: Handle due date properly (Tasks API uses date-only format)
      due: task.dueDate ? this.formatDueDate(task.dueDate) : undefined,
      
      // Status mapping
      status: task.completed ? 'completed' : 'needsAction'
    };

    // If task was completed, set completion date
    if (task.completed && task.completedAt) {
      taskData.completed = task.completedAt;
    }

    return taskData;
  }

  /**
   * Format task notes with structured data including tags and metadata
   * Expert Fix: Store sync metadata and tags in structured format
   * @param {Object} task - Task data
   * @returns {string} Formatted notes with structured data
   */
  formatTaskNotes(task) {
    let notes = task.notes || task.description || '';
    
    // Add structured metadata section
    const metadata = [];
    
    // Source key for de-duplication
    if (task.sourceKey) {
      metadata.push(`sourceKey:${task.sourceKey}`);
    }
    
    // Sync version for conflict resolution
    metadata.push('syncVersion:1');
    
    // Location if provided
    if (task.location) {
      metadata.push(`location:${task.location}`);
    }
    
    // Tags as structured data
    if (task.tags && task.tags.length > 0) {
      const tagsList = task.tags.map(tag => `#${tag}`).join(' ');
      metadata.push(`tags:${task.tags.join(',')}`);
      notes += `\n\nTags: ${tagsList}`;
    }

    // Assignees information
    if (task.assignees && task.assignees.length > 0) {
      const assigneesList = task.assignees.join(', ');
      metadata.push(`assignees:${task.assignees.join(',')}`);
      notes += `\n\nAssigned to: ${assigneesList}`;
    }

    // Add metadata as hidden section (will be parsed for sync operations)
    if (metadata.length > 0) {
      notes += `\n\n[SYNC_METADATA:${metadata.join('|')}]`;
    }

    return notes.trim();
  }

  /**
   * Format due date for Google Tasks API
   * Expert Fix: Google Tasks expects RFC 3339 date format
   * @param {string} dueDate - ISO date string
   * @returns {string} RFC 3339 formatted date
   */
  formatDueDate(dueDate) {
    try {
      const date = new Date(dueDate);
      // Google Tasks expects date in RFC 3339 format (YYYY-MM-DDTHH:MM:SS.sssZ)
      return date.toISOString();
    } catch (error) {
      console.warn('⚠️ Invalid due date format:', dueDate);
      return undefined;
    }
  }

  /**
   * Incremental sync using updatedMin for efficiency
   * Expert Fix: Reduces API calls by only fetching tasks updated since last sync
   * @param {Object} credentials - User credentials
   * @param {string} workspaceName - Workspace name
   * @param {string} lastSyncTime - ISO timestamp of last sync
   * @returns {Object} Sync results with changes
   */
  async incrementalSync(credentials, workspaceName, lastSyncTime) {
    const tasks = await this.initializeClient(credentials);
    const taskListId = await this.getWorkspaceTaskList(tasks, workspaceName);

    try {
      const listParams = {
        tasklist: taskListId,
        maxResults: 100,
        showCompleted: true,
        showHidden: true
      };

      // Use updatedMin for incremental sync
      if (lastSyncTime) {
        listParams.updatedMin = lastSyncTime;
      }

      const response = await this.backoff.execute(async () => {
        return await tasks.tasks.list(listParams);
      }, { operation: 'incremental_sync', workspace: workspaceName });

      // Filter tasks that belong to our sync system (have sourceKey in notes)
      const syncedTasks = (response.data.items || []).filter(task => {
        const notes = task.notes || '';
        return notes.includes('sourceKey:');
      });

      console.log(`✅ Incremental sync found ${syncedTasks.length} changed tasks`);

      return {
        tasks: syncedTasks,
        changes: syncedTasks.length
      };

    } catch (error) {
      console.error('❌ Error during incremental sync:', error.message);
      throw error;
    }
  }

  /**
   * Delete task from Google Tasks
   * @param {Object} credentials - User credentials
   * @param {string} taskId - Google Tasks task ID
   * @param {string} workspaceName - Workspace name
   * @returns {boolean} Success status
   */
  async deleteTask(credentials, taskId, workspaceName) {
    const tasks = await this.initializeClient(credentials);
    const taskListId = await this.getWorkspaceTaskList(tasks, workspaceName);

    try {
      await this.backoff.execute(async () => {
        return await tasks.tasks.delete({
          tasklist: taskListId,
          task: taskId
        });
      }, { operation: 'delete_task', taskId: taskId });

      console.log(`✅ Deleted Google Task: ${taskId}`);
      return true;

    } catch (error) {
      if (error.code === 404) {
        console.warn(`⚠️ Task already deleted: ${taskId}`);
        return true; // Consider it successful
      }
      
      console.error('❌ Error deleting Google Task:', error.message);
      throw error;
    }
  }

  /**
   * Mark task as complete in Google Tasks
   * @param {Object} credentials - User credentials
   * @param {string} taskId - Google Tasks task ID
   * @param {string} workspaceName - Workspace name
   * @param {boolean} completed - Completion status
   * @returns {Object} Updated task details
   */
  async updateTaskStatus(credentials, taskId, workspaceName, completed) {
    const tasks = await this.initializeClient(credentials);
    const taskListId = await this.getWorkspaceTaskList(tasks, workspaceName);

    try {
      const updateData = {
        status: completed ? 'completed' : 'needsAction'
      };

      if (completed) {
        updateData.completed = new Date().toISOString();
      } else {
        // Clear completion date when marking as incomplete
        updateData.completed = null;
      }

      const response = await this.backoff.execute(async () => {
        return await tasks.tasks.update({
          tasklist: taskListId,
          task: taskId,
          requestBody: updateData
        });
      }, { operation: 'update_status', taskId: taskId });

      console.log(`✅ Updated task status: ${taskId} - ${completed ? 'completed' : 'active'}`);
      return response.data;

    } catch (error) {
      console.error('❌ Error updating task status:', error.message);
      throw error;
    }
  }

  /**
   * Parse structured metadata from task notes
   * Expert Fix: Extract sync metadata for conflict resolution
   * @param {string} notes - Task notes containing metadata
   * @returns {Object} Parsed metadata
   */
  parseTaskMetadata(notes) {
    const metadata = {
      sourceKey: null,
      syncVersion: null,
      location: null,
      tags: [],
      assignees: []
    };

    if (!notes) return metadata;

    // Extract metadata from structured section
    const metadataMatch = notes.match(/\[SYNC_METADATA:([^\]]+)\]/);
    if (metadataMatch) {
      const metadataPairs = metadataMatch[1].split('|');
      
      metadataPairs.forEach(pair => {
        const [key, value] = pair.split(':');
        switch (key) {
          case 'sourceKey':
            metadata.sourceKey = value;
            break;
          case 'syncVersion':
            metadata.syncVersion = value;
            break;
          case 'location':
            metadata.location = value;
            break;
          case 'tags':
            metadata.tags = value ? value.split(',') : [];
            break;
          case 'assignees':
            metadata.assignees = value ? value.split(',') : [];
            break;
        }
      });
    }

    return metadata;
  }

  /**
   * Health check for Tasks API access
   * @param {Object} credentials - User credentials
   * @returns {Object} Health status
   */
  async healthCheck(credentials) {
    try {
      const tasks = await this.initializeClient(credentials);
      
      await this.backoff.execute(async () => {
        return await tasks.tasklists.list({ maxResults: 1 });
      }, { operation: 'health_check' });

      return {
        status: 'healthy',
        service: 'Google Tasks',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Google Tasks',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = TasksProvider;
