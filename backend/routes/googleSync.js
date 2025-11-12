/**
 * Google Sync API Routes
 * Handles task synchronization with Google Calendar & Tasks
 */

const express = require('express');
const SyncService = require('../sync/SyncService');
const router = express.Router();

// Initialize sync service
const syncService = new SyncService();

/**
 * POST /api/sync/google/task/:workspaceId/:threadId/:taskId
 * Sync individual task to Google services
 */
router.post('/task/:workspaceId/:threadId/:taskId', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId } = req.params;
    const { userId, forceStrategy } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId in request body'
      });
    }

    // Get user's Google credentials
    const credentials = await getUserCredentialsForSync(userId, workspaceId);
    if (!credentials) {
      return res.status(401).json({
        error: 'Google sync not configured. Please authorize Google access first.',
        requiresAuth: true
      });
    }

    // Get task from database
    const task = await getTaskForSync(taskId, workspaceId, threadId);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    // Get workspace name for Google organization
    const workspaceName = await getWorkspaceName(workspaceId);

    // Override sync strategy if requested
    if (forceStrategy) {
      task.forcedSyncStrategy = forceStrategy;
    }

    // Execute sync
    const syncResult = await syncService.syncTask(credentials, task, workspaceName);

    // Return results
    res.json({
      success: true,
      taskId: taskId,
      strategy: syncResult.strategy,
      results: syncResult.results,
      duration: syncResult.duration,
      errors: syncResult.errors
    });

  } catch (error) {
    console.error('❌ Individual task sync error:', error);
    res.status(500).json({
      error: 'Task sync failed',
      details: error.message
    });
  }
});

/**
 * POST /api/sync/google/bulk/:workspaceId/:threadId
 * Bulk sync multiple tasks
 */
router.post('/bulk/:workspaceId/:threadId', async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const { userId, taskIds, syncAll = false } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId in request body'
      });
    }

    // Get user's Google credentials
    const credentials = await getUserCredentialsForSync(userId, workspaceId);
    if (!credentials) {
      return res.status(401).json({
        error: 'Google sync not configured. Please authorize Google access first.',
        requiresAuth: true
      });
    }

    // Get tasks from database
    let tasks;
    if (syncAll) {
      tasks = await getAllChannelTasks(workspaceId, threadId);
    } else {
      tasks = await getTasksForSync(taskIds, workspaceId, threadId);
    }

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        error: 'No tasks found to sync'
      });
    }

    // Get workspace name
    const workspaceName = await getWorkspaceName(workspaceId);

    // Execute bulk sync
    const syncResults = await syncService.syncTasks(credentials, tasks, workspaceName);

    res.json({
      success: true,
      total: syncResults.total,
      successful: syncResults.successful,
      failed: syncResults.failed,
      errors: syncResults.errors,
      summary: {
        workspaceId,
        threadId,
        workspaceName,
        tasksProcessed: tasks.length
      }
    });

  } catch (error) {
    console.error('❌ Bulk sync error:', error);
    res.status(500).json({
      error: 'Bulk sync failed',
      details: error.message
    });
  }
});

/**
 * GET /api/sync/google/status/:workspaceId/:userId
 * Get sync status and health check
 */
router.get('/status/:workspaceId/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;

    // Get user's Google credentials
    const credentials = await getUserCredentialsForSync(userId, workspaceId);
    
    if (!credentials) {
      return res.json({
        connected: false,
        health: { overall: 'not_connected' },
        stats: null,
        error: 'Google sync not configured'
      });
    }

    // Health check
    const healthStatus = await syncService.healthCheck(credentials);
    
    // Get sync statistics
    const syncStats = syncService.getSyncStats();

    res.json({
      connected: true,
      health: healthStatus,
      stats: syncStats,
      credentials: {
        email: credentials.google_email,
        name: credentials.google_name,
        connected_at: credentials.created_at
      }
    });

  } catch (error) {
    console.error('❌ Sync status error:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      details: error.message
    });
  }
});

/**
 * POST /api/sync/google/incremental/:workspaceId/:userId
 * Perform incremental sync from Google back to our system
 */
router.post('/incremental/:workspaceId/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const { lastSyncTime } = req.body;

    // Get user's Google credentials
    const credentials = await getUserCredentialsForSync(userId, workspaceId);
    if (!credentials) {
      return res.status(401).json({
        error: 'Google sync not configured',
        requiresAuth: true
      });
    }

    // Get workspace name
    const workspaceName = await getWorkspaceName(workspaceId);

    // Execute incremental sync
    const syncResults = await syncService.incrementalSync(
      credentials,
      workspaceName,
      lastSyncTime
    );

    // Process results and update our database
    const processingResults = await processIncrementalChanges(
      workspaceId,
      syncResults
    );

    res.json({
      success: true,
      calendar: syncResults.calendar,
      tasks: syncResults.tasks,
      conflicts: syncResults.conflicts,
      errors: syncResults.errors,
      processing: processingResults
    });

  } catch (error) {
    console.error('❌ Incremental sync error:', error);
    res.status(500).json({
      error: 'Incremental sync failed',
      details: error.message
    });
  }
});

/**
 * GET /api/sync/google/strategy/:workspaceId/:threadId/:taskId
 * Preview sync strategy for a task without executing
 */
router.get('/strategy/:workspaceId/:threadId/:taskId', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId } = req.params;

    // Get task from database
    const task = await getTaskForSync(taskId, workspaceId, threadId);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    // Determine strategy without executing sync
    const strategy = syncService.determineSyncStrategy(task);

    // Provide explanation
    const explanation = getStrategyExplanation(strategy, task);

    res.json({
      taskId,
      strategy,
      explanation,
      task: {
        title: task.title,
        hasSpecificTimes: !!(task.start_time && task.end_time),
        hasLocation: !!(task.location && task.location.trim()),
        hasMultipleAssignees: (task.assignees?.length > 1) || (task.assigned_teams?.length > 0),
        priority: task.priority,
        tags: task.tags,
        estimatedHours: task.estimated_hours
      }
    });

  } catch (error) {
    console.error('❌ Strategy preview error:', error);
    res.status(500).json({
      error: 'Failed to preview sync strategy',
      details: error.message
    });
  }
});

/**
 * DELETE /api/sync/google/task/:workspaceId/:threadId/:taskId
 * Remove task from Google services
 */
router.delete('/task/:workspaceId/:threadId/:taskId', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'Missing userId parameter'
      });
    }

    // Get user's Google credentials
    const credentials = await getUserCredentialsForSync(userId, workspaceId);
    if (!credentials) {
      return res.status(401).json({
        error: 'Google sync not configured',
        requiresAuth: true
      });
    }

    // Get task to find Google IDs
    const task = await getTaskForSync(taskId, workspaceId, threadId);
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    const workspaceName = await getWorkspaceName(workspaceId);
    const results = {};

    // Delete from Google Calendar if present
    if (task.google_calendar_event_id) {
      try {
        await syncService.calendarProvider.deleteEvent(
          credentials,
          task.google_calendar_event_id,
          workspaceName
        );
        results.calendar = { deleted: true };
      } catch (error) {
        results.calendar = { error: error.message };
      }
    }

    // Delete from Google Tasks if present
    if (task.google_task_id) {
      try {
        await syncService.tasksProvider.deleteTask(
          credentials,
          task.google_task_id,
          workspaceName
        );
        results.tasks = { deleted: true };
      } catch (error) {
        results.tasks = { error: error.message };
      }
    }

    // Clear Google IDs from our database
    await clearTaskGoogleIds(taskId);

    res.json({
      success: true,
      taskId,
      results
    });

  } catch (error) {
    console.error('❌ Google task deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete task from Google services',
      details: error.message
    });
  }
});

/**
 * POST /api/sync/google/cleanup/:workspaceId/:userId
 * Clean up sync history and cached data
 */
router.post('/cleanup/:workspaceId/:userId', async (req, res) => {
  try {
    const { keepDays = 7 } = req.body;

    // Clean up sync service history
    syncService.clearOldSyncHistory(keepDays);

    res.json({
      success: true,
      message: `Cleaned up sync history older than ${keepDays} days`
    });

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({
      error: 'Failed to clean up sync data',
      details: error.message
    });
  }
});

/**
 * Database helper functions (TODO: Implement with actual database queries)
 */

async function getUserCredentialsForSync(userId, workspaceId) {
  // TODO: Implement - get credentials from user_google_sync_preferences table
  console.log(`🔍 Would get credentials for user ${userId} in workspace ${workspaceId}`);
  return null; // Return null until implemented
}

async function getTaskForSync(taskId, workspaceId, threadId) {
  // TODO: Implement - get task with all required fields for sync
  console.log(`📋 Would get task ${taskId} for sync`);
  return null; // Return null until implemented
}

async function getTasksForSync(taskIds, workspaceId, threadId) {
  // TODO: Implement - get multiple tasks
  console.log(`📋 Would get ${taskIds.length} tasks for sync`);
  return [];
}

async function getAllChannelTasks(workspaceId, threadId) {
  // TODO: Implement - get all tasks in a channel
  console.log(`📋 Would get all tasks in channel ${threadId}`);
  return [];
}

async function getWorkspaceName(workspaceId) {
  // TODO: Implement - get workspace name
  console.log(`🏢 Would get name for workspace ${workspaceId}`);
  return `Workspace ${workspaceId}`;
}

async function clearTaskGoogleIds(taskId) {
  // TODO: Implement - clear google_calendar_event_id and google_task_id
  console.log(`🗑️ Would clear Google IDs for task ${taskId}`);
}

async function processIncrementalChanges(workspaceId, syncResults) {
  // TODO: Implement - process changes from Google and update our database
  console.log(`🔄 Would process incremental changes for workspace ${workspaceId}:`, {
    calendarChanges: syncResults.calendar.changes,
    taskChanges: syncResults.tasks.changes,
    conflicts: syncResults.conflicts.length
  });

  return {
    processed: 0,
    updated: 0,
    conflicts: syncResults.conflicts.length
  };
}

/**
 * Strategy explanation helper
 */
function getStrategyExplanation(strategy, task) {
  const explanations = {
    'calendar_only': 'Task has specific times/location, best suited for Google Calendar time-blocking',
    'tasks_only': 'Simple task without scheduling details, perfect for Google Tasks completion tracking',
    'both': 'Complex task with multiple assignees or high priority, synced to both services for maximum visibility',
    'none': 'Task does not meet criteria for Google sync'
  };

  const reasons = [];

  if (task.start_time && task.end_time) {
    reasons.push('has specific time slots');
  }
  if (task.location) {
    reasons.push('includes location information');
  }
  if ((task.assignees?.length > 1) || (task.assigned_teams?.length > 0)) {
    reasons.push('has multiple assignees');
  }
  if (['urgent', 'high'].includes(task.priority?.toLowerCase())) {
    reasons.push('is high priority');
  }
  if (task.tags?.length > 2) {
    reasons.push('has complex tags');
  }
  if (task.estimated_hours && task.estimated_hours > 4) {
    reasons.push('is long-running');
  }

  return {
    description: explanations[strategy],
    reasons: reasons.length > 0 ? reasons : ['matches default criteria for this strategy'],
    recommended: true
  };
}

module.exports = router;
