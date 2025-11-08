const express = require('express');
const router = express.Router({ mergeParams: true }); // Important: merge params to access threadId

// Middleware
const { authenticateUser } = require('../middleware/auth');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware to check if user is member of the channel/thread
const requireChannelMembership = async (req, res, next) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.uid;

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
// Get all tasks for a channel
router.get('/', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { status, assigned_to, start_date, end_date, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        ct.*,
        u1.display_name as assigned_to_name,
        u2.display_name as created_by_name,
        t.name as channel_name
      FROM channel_tasks ct
      LEFT JOIN users u1 ON ct.assigned_to = u1.id
      LEFT JOIN users u2 ON ct.created_by = u2.id
      JOIN threads t ON ct.thread_id = t.id
      WHERE ct.thread_id = $1
    `;
    
    const params = [threadId];
    let paramCount = 1;

    // Add filters
    if (status) {
      paramCount++;
      query += ` AND ct.status = $${paramCount}`;
      params.push(status);
    }
    
    if (assigned_to) {
      paramCount++;
      query += ` AND ct.assigned_to = $${paramCount}`;
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
// Create a new task in the channel
router.post('/', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.uid;
    const { 
      title, 
      description, 
      start_date, 
      end_date, 
      due_date,
      assigned_to,
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

    // Validate assigned_to user exists
    if (assigned_to) {
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [assigned_to]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Assigned user does not exist' });
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

    const result = await pool.query(`
      INSERT INTO channel_tasks (
        thread_id, title, description, start_date, end_date, due_date,
        assigned_to, status, priority, tags, estimated_hours, 
        is_all_day, start_time, end_time, parent_task_id, dependencies, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, created_at, updated_at
    `, [
      threadId, title.trim(), description, start_date, end_date, due_date,
      assigned_to, status, priority, JSON.stringify(tags), estimated_hours,
      is_all_day, start_time, end_time, parent_task_id, JSON.stringify(dependencies), userId
    ]);

    res.status(201).json({
      message: 'Channel task created successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating channel task:', error);
    res.status(500).json({ error: 'Failed to create channel task' });
  }
});

// PUT /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId
// Update a task
router.put('/:taskId', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;
    const userId = req.user.uid;
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

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 0;

    const addUpdate = (field, value) => {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        values.push(value);
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

module.exports = router;
