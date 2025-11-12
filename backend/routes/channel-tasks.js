const express = require('express');
const router = express.Router({ mergeParams: true }); // Important: merge params to access threadId

// Middleware
const { authenticateUser } = require('../middleware/auth');
const { createPool } = require('../config/database');

// Database connection
const pool = createPool();

// Middleware to check if user is member of the channel/thread
const requireChannelMembership = async (req, res, next) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id; // Fixed: use req.user.id instead of req.user.uid

    // Check if user is member of this channel
    const result = await pool.query(`
      SELECT tm.role 
      FROM thread_members tm
      JOIN threads t ON tm.thread_id = t.id
      WHERE t.id = $1 AND t.workspace_id = $2 AND tm.user_id = $3
    `, [threadId, workspaceId, userId]);

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    req.channelRole = result.rows[0].role;
    next();
  } catch (error) {
    console.error('Error checking channel membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Apply middleware to all routes
router.use(authenticateUser);
router.use(requireChannelMembership);

// GET /api/workspaces/:workspaceId/threads/:threadId/tasks
// Get all tasks for a channel with multi-assignee support
router.get('/', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { status, assigned_to, start_date, end_date, limit = 100, offset = 0 } = req.query;
    const userId = req.user.id; // Fixed: use req.user.id

    let query = `
      SELECT 
        ct.*,
        u2.display_name as created_by_name,
        t.name as channel_name,
        ct.progress_info,
        ct.is_complete,
        ct.total_assignees,
        ct.individual_assignee_count,
        ct.team_count,
        -- Get assignee details
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'display_name', u.display_name,
              'email', u.email
            )
          )
          FROM users u 
          WHERE u.id IN (
            SELECT jsonb_array_elements_text(ct.assignees)
          )
        ) as assignee_details,
        -- Get team details
        (
          SELECT json_agg(
            json_build_object(
              'id', wt.id,
              'name', wt.name,
              'display_name', wt.display_name,
              'color', wt.color,
              'member_count', (
                SELECT count(*) 
                FROM workspace_team_members wtm 
                WHERE wtm.team_id = wt.id AND wtm.is_active = true
              )
            )
          )
          FROM workspace_teams wt
          WHERE wt.id IN (
            SELECT (jsonb_array_elements_text(ct.assigned_teams))::integer
          )
        ) as team_details,
        -- Check if current user can edit this task
        can_user_edit_task(ct.assignees, ct.assigned_teams, ct.created_by, $2) as user_can_edit,
        -- Check if current user is assignee
        is_task_assignee(ct.assignees, ct.assigned_teams, $2) as user_is_assignee,
        -- Check if current user has completed this task
        CASE 
          WHEN ct.individual_completions ? $2 THEN true
          ELSE false
        END as user_completed
      FROM channel_tasks_with_progress ct
      LEFT JOIN users u2 ON ct.created_by = u2.id
      JOIN threads t ON ct.thread_id = t.id
      WHERE ct.thread_id = $1
    `;
    
    const params = [threadId, userId];
    let paramCount = 2;

    // Add filters - updated for multi-assignee
    if (status) {
      paramCount++;
      query += ` AND ct.status = $${paramCount}`;
      params.push(status);
    }
    
    if (assigned_to) {
      paramCount++;
      // Updated to support both old and new assignment systems
      query += ` AND (ct.assigned_to = $${paramCount} OR ct.assignees ? $${paramCount})`;
      params.push(assigned_to);
    }
    
    if (start_date) {
      paramCount++;
      query += ` AND ct.start_date >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      query += ` AND ct.end_date <= $${paramCount}`;
      params.push(end_date);
    }

    query += ` ORDER BY ct.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    res.json({
      tasks: result.rows,
      total: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching channel tasks:', error);
    res.status(500).json({ error: 'Failed to fetch channel tasks' });
  }
});

// GET /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId
// Get a specific task
router.get('/:taskId', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;

    const result = await pool.query(`
      SELECT 
        ct.*,
        u1.display_name as assigned_to_name,
        u2.display_name as created_by_name,
        t.name as channel_name
      FROM channel_tasks ct
      LEFT JOIN users u1 ON ct.assigned_to = u1.id
      LEFT JOIN users u2 ON ct.created_by = u2.id
      JOIN threads t ON ct.thread_id = t.id
      WHERE ct.id = $1 AND ct.thread_id = $2
    `, [taskId, threadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching channel task:', error);
    res.status(500).json({ error: 'Failed to fetch channel task' });
  }
});

// POST /api/workspaces/:workspaceId/threads/:threadId/tasks
// Create a new task with multi-assignee and teams support
router.post('/', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.id; // Fixed: use req.user.id
    const { 
      title, 
      description, 
      start_date, 
      end_date, 
      due_date,
      // Legacy support
      assigned_to,
      // New multi-assignee fields
      assignees = [],
      assigned_teams = [],
      assignment_mode = 'collaborative',
      requires_individual_response = false,
      status = 'pending',
      priority = 'medium',
      tags = [],
      estimated_hours,
      is_all_day = false,
      start_time,
      end_time,
      parent_task_id,
      dependencies = []
    } = req.body;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    if (title.length > 255) {
      return res.status(400).json({ error: 'Task title must be 255 characters or less' });
    }

    // Validate assignment mode
    if (!['collaborative', 'individual_response'].includes(assignment_mode)) {
      return res.status(400).json({ error: 'Invalid assignment mode' });
    }

    // Convert legacy assigned_to to new assignees format
    let finalAssignees = [...assignees];
    if (assigned_to && !finalAssignees.includes(assigned_to)) {
      finalAssignees.push(assigned_to);
    }

    // Validate all assignee users exist
    if (finalAssignees.length > 0) {
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE id = ANY($1)', 
        [finalAssignees]
      );
      if (userCheck.rows.length !== finalAssignees.length) {
        const foundUsers = userCheck.rows.map(u => u.id);
        const missingUsers = finalAssignees.filter(id => !foundUsers.includes(id));
        return res.status(400).json({ 
          error: 'Some assigned users do not exist',
          missing_users: missingUsers
        });
      }
    }

    // Validate assigned teams exist
    if (assigned_teams.length > 0) {
      const teamCheck = await pool.query(
        'SELECT id FROM workspace_teams WHERE id = ANY($1)', 
        [assigned_teams.map(id => parseInt(id))]
      );
      if (teamCheck.rows.length !== assigned_teams.length) {
        return res.status(400).json({ error: 'Some assigned teams do not exist' });
      }
    }

    // Validate parent_task exists and belongs to same channel
    if (parent_task_id) {
      const parentCheck = await pool.query(
        'SELECT id FROM channel_tasks WHERE id = $1 AND thread_id = $2', 
        [parent_task_id, threadId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Parent task not found in this channel' });
      }
    }

    // Convert empty strings to null for timestamp fields (PostgreSQL requirement)
    const cleanStartDate = start_date === '' ? null : start_date;
    const cleanEndDate = end_date === '' ? null : end_date;
    const cleanDueDate = due_date === '' ? null : due_date;
    const cleanStartTime = start_time === '' ? null : start_time;
    const cleanEndTime = end_time === '' ? null : end_time;
    const cleanEstimatedHours = estimated_hours === '' ? null : estimated_hours;
    const cleanParentTaskId = parent_task_id === '' ? null : parent_task_id;

    console.log('Creating task with cleaned data:', {
      threadId, 
      workspaceId: req.params.workspaceId, 
      title: title.trim(), 
      description, 
      start_date: cleanStartDate, 
      end_date: cleanEndDate, 
      due_date: cleanDueDate,
      assigned_to, 
      finalAssignees, 
      assigned_teams, 
      assignment_mode, 
      requires_individual_response,
      status, 
      priority, 
      tags, 
      estimated_hours: cleanEstimatedHours,
      is_all_day, 
      start_time: cleanStartTime, 
      end_time: cleanEndTime, 
      parent_task_id: cleanParentTaskId, 
      dependencies, 
      userId
    });

    const result = await pool.query(`
      INSERT INTO channel_tasks (
        thread_id, workspace_id, title, description, start_date, end_date, due_date,
        assigned_to, assignees, assigned_teams, assignment_mode, requires_individual_response,
        status, priority, tags, estimated_hours, 
        is_all_day, start_time, end_time, parent_task_id, dependencies, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id, created_at, updated_at
    `, [
      threadId, req.params.workspaceId, title.trim(), description, cleanStartDate, cleanEndDate, cleanDueDate,
      assigned_to, JSON.stringify(finalAssignees), JSON.stringify(assigned_teams), assignment_mode, requires_individual_response,
      status, priority, JSON.stringify(tags), cleanEstimatedHours,
      is_all_day, cleanStartTime, cleanEndTime, cleanParentTaskId, JSON.stringify(dependencies), userId
    ]);

    res.status(201).json({
      message: 'Channel task created successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating channel task:', error);
    console.error('SQL Error details:', error.message);
    console.error('Error code:', error.code);
    console.error('Error constraint:', error.constraint);
    res.status(500).json({ 
      error: 'Failed to create channel task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId
// Update a task
router.put('/:taskId', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;
    const userId = req.user.id; // Fixed: use req.user.id
    const { 
      title, 
      description, 
      start_date, 
      end_date, 
      due_date,
      assigned_to,
      status,
      priority,
      tags,
      estimated_hours,
      actual_hours,
      is_all_day,
      start_time,
      end_time,
      parent_task_id,
      dependencies,
      google_calendar_event_id,
      completed_at
    } = req.body;

    // Check if task exists in this channel
    const existingTask = await pool.query(
      'SELECT * FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found in this channel' });
    }

    // Validate assigned_to user exists
    if (assigned_to) {
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [assigned_to]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Assigned user does not exist' });
      }
    }

    // Build dynamic update query - convert empty strings to null for PostgreSQL
    const updates = [];
    const values = [];
    let paramCount = 0;

    const addUpdate = (field, value) => {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        // Convert empty strings to null for timestamp and numeric fields
        if (value === '' && ['start_date', 'end_date', 'due_date', 'start_time', 'end_time', 'estimated_hours', 'actual_hours', 'parent_task_id', 'completed_at'].includes(field)) {
          values.push(null);
        } else {
          values.push(value);
        }
      }
    };

    addUpdate('title', title);
    addUpdate('description', description);
    addUpdate('start_date', start_date);
    addUpdate('end_date', end_date);
    addUpdate('due_date', due_date);
    addUpdate('assigned_to', assigned_to);
    addUpdate('status', status);
    addUpdate('priority', priority);
    addUpdate('tags', tags ? JSON.stringify(tags) : undefined);
    addUpdate('estimated_hours', estimated_hours);
    addUpdate('actual_hours', actual_hours);
    addUpdate('is_all_day', is_all_day);
    addUpdate('start_time', start_time);
    addUpdate('end_time', end_time);
    addUpdate('parent_task_id', parent_task_id);
    addUpdate('dependencies', dependencies ? JSON.stringify(dependencies) : undefined);
    addUpdate('google_calendar_event_id', google_calendar_event_id);
    addUpdate('completed_at', completed_at);
    addUpdate('updated_at', new Date());

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add WHERE clause
    paramCount++;
    values.push(taskId);
    paramCount++;
    values.push(threadId);

    const query = `
      UPDATE channel_tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount - 1} AND thread_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.json({
      message: 'Channel task updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating channel task:', error);
    res.status(500).json({ error: 'Failed to update channel task' });
  }
});

// DELETE /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId
// Delete a task
router.delete('/:taskId', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;

    // Check if task exists
    const existingTask = await pool.query(
      'SELECT id FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found in this channel' });
    }

    // Delete the task
    await pool.query(
      'DELETE FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    res.json({ message: 'Channel task deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel task:', error);
    res.status(500).json({ error: 'Failed to delete channel task' });
  }
});

// GET /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/subtasks
// Get subtasks of a specific task
router.get('/:taskId/subtasks', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;

    const result = await pool.query(`
      SELECT 
        ct.*,
        u1.display_name as assigned_to_name,
        u2.display_name as created_by_name
      FROM channel_tasks ct
      LEFT JOIN users u1 ON ct.assigned_to = u1.id
      LEFT JOIN users u2 ON ct.created_by = u2.id
      WHERE ct.thread_id = $1 AND ct.parent_task_id = $2
      ORDER BY ct.created_at ASC
    `, [threadId, taskId]);

    res.json({ subtasks: result.rows });
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    res.status(500).json({ error: 'Failed to fetch subtasks' });
  }
});

// === REVOLUTIONARY MULTI-ASSIGNEE ENDPOINTS ===

// POST /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/complete
// Mark task as completed by current user (individual completion)
router.post('/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id; // Fixed: use req.user.id

    const result = await pool.query(
      'SELECT mark_task_complete_individual($1, $2)',
      [taskId, userId]
    );

    const completion_result = result.rows[0].mark_task_complete_individual;
    
    if (!completion_result.success) {
      return res.status(400).json({ 
        error: completion_result.error 
      });
    }

    res.json({
      message: 'Task marked as complete',
      progress: completion_result.progress,
      completed_by: completion_result.completed_by_user,
      timestamp: completion_result.timestamp
    });
  } catch (error) {
    console.error('Error marking task complete:', error);
    res.status(500).json({ error: 'Failed to mark task complete' });
  }
});

// DELETE /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/complete
// Mark task as incomplete by current user (remove individual completion)
router.delete('/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id; // Fixed: use req.user.id

    const result = await pool.query(
      'SELECT mark_task_incomplete_individual($1, $2)',
      [taskId, userId]
    );

    const completion_result = result.rows[0].mark_task_incomplete_individual;
    
    if (!completion_result.success) {
      return res.status(400).json({ 
        error: completion_result.error 
      });
    }

    res.json({
      message: 'Task marked as incomplete',
      progress: completion_result.progress,
      uncompleted_by: completion_result.uncompleted_by_user
    });
  } catch (error) {
    console.error('Error marking task incomplete:', error);
    res.status(500).json({ error: 'Failed to mark task incomplete' });
  }
});

// GET /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/progress
// Get detailed progress information for a task
router.get('/:taskId/progress', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;
    const userId = req.user.id; // Fixed: use req.user.id

    const result = await pool.query(`
      SELECT 
        ct.id,
        ct.title,
        ct.assignment_mode,
        ct.requires_individual_response,
        ct.progress_info,
        ct.individual_completions,
        ct.assignee_details,
        ct.team_details,
        ct.user_can_edit,
        ct.user_is_assignee,
        ct.user_completed,
        -- Get detailed completion info with timestamps
        (
          SELECT json_object_agg(
            completion_user_id,
            json_build_object(
              'completed_at', completion_timestamp,
              'user_name', u.display_name
            )
          )
          FROM (
            SELECT 
              completion_user_id,
              completion_timestamp,
              u.display_name
            FROM jsonb_each_text(ct.individual_completions) as comp(completion_user_id, completion_timestamp)
            JOIN users u ON u.id = comp.completion_user_id
          ) as completions_with_names
        ) as detailed_completions
      FROM channel_tasks_with_progress ct
      WHERE ct.id = $1 AND ct.thread_id = $2
    `, [taskId, threadId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task progress:', error);
    res.status(500).json({ error: 'Failed to fetch task progress' });
  }
});


module.exports = router;
