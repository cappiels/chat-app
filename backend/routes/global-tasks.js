const express = require('express');
const router = express.Router();

// Middleware
const { authenticateUser } = require('../middleware/auth');
const { createPool } = require('../config/database');

// Database connection
const pool = createPool();

// Apply authentication to all routes
router.use(authenticateUser);

// GET /api/tasks/all
// Get tasks across multiple workspaces/channels with filtering
router.get('/all', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      workspace_ids, 
      channel_ids, 
      status, 
      start_date, 
      end_date,
      assigned_to_me,
      limit = 500, 
      offset = 0 
    } = req.query;

    // Parse array parameters (can be passed as comma-separated or multiple params)
    const workspaceIds = workspace_ids 
      ? (Array.isArray(workspace_ids) ? workspace_ids : workspace_ids.split(','))
      : null;
    const channelIds = channel_ids 
      ? (Array.isArray(channel_ids) ? channel_ids : channel_ids.split(','))
      : null;

    let query = `
      SELECT 
        ct.*,
        u2.display_name as created_by_name,
        t.name as channel_name,
        t.id as channel_id,
        w.name as workspace_name,
        w.id as workspace_id,
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
        can_user_edit_task(ct.assignees, ct.assigned_teams, ct.created_by, $1) as user_can_edit,
        -- Check if current user is assignee
        is_task_assignee(ct.assignees, ct.assigned_teams, $1) as user_is_assignee,
        -- Check if current user has completed this task
        CASE 
          WHEN ct.individual_completions ? $1 THEN true
          ELSE false
        END as user_completed
      FROM channel_tasks_with_progress ct
      LEFT JOIN users u2 ON ct.created_by = u2.id
      JOIN threads t ON ct.thread_id = t.id
      JOIN workspaces w ON ct.workspace_id = w.id
      WHERE EXISTS (
        -- User must be member of the channel to see its tasks
        SELECT 1 FROM thread_members tm
        WHERE tm.thread_id = ct.thread_id AND tm.user_id = $1
      )
    `;
    
    const params = [userId];
    let paramCount = 1;

    // Filter by workspace IDs
    if (workspaceIds && workspaceIds.length > 0) {
      paramCount++;
      query += ` AND ct.workspace_id = ANY($${paramCount})`;
      params.push(workspaceIds.map(id => parseInt(id)));
    }

    // Filter by channel IDs
    if (channelIds && channelIds.length > 0) {
      paramCount++;
      query += ` AND ct.thread_id = ANY($${paramCount})`;
      params.push(channelIds.map(id => parseInt(id)));
    }

    // Filter by status
    if (status) {
      paramCount++;
      query += ` AND ct.status = $${paramCount}`;
      params.push(status);
    }

    // Filter by date range
    if (start_date) {
      paramCount++;
      query += ` AND (ct.start_date >= $${paramCount} OR ct.due_date >= $${paramCount})`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      query += ` AND (ct.end_date <= $${paramCount} OR ct.due_date <= $${paramCount})`;
      params.push(end_date);
    }

    // Filter tasks assigned to current user
    if (assigned_to_me === 'true') {
      query += ` AND is_task_assignee(ct.assignees, ct.assigned_teams, $1)`;
    }

    // Order by start_date, due_date, then created_at
    query += ` 
      ORDER BY 
        COALESCE(ct.start_date, ct.due_date, ct.created_at) ASC,
        ct.created_at DESC 
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count (without pagination)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM channel_tasks ct
      JOIN threads t ON ct.thread_id = t.id
      WHERE EXISTS (
        SELECT 1 FROM thread_members tm
        WHERE tm.thread_id = ct.thread_id AND tm.user_id = $1
      )
    `;
    const countParams = [userId];
    let countParamCount = 1;

    if (workspaceIds && workspaceIds.length > 0) {
      countParamCount++;
      countQuery += ` AND ct.workspace_id = ANY($${countParamCount})`;
      countParams.push(workspaceIds.map(id => parseInt(id)));
    }

    if (channelIds && channelIds.length > 0) {
      countParamCount++;
      countQuery += ` AND ct.thread_id = ANY($${countParamCount})`;
      countParams.push(channelIds.map(id => parseInt(id)));
    }

    if (status) {
      countParamCount++;
      countQuery += ` AND ct.status = $${countParamCount}`;
      countParams.push(status);
    }

    if (start_date) {
      countParamCount++;
      countQuery += ` AND (ct.start_date >= $${countParamCount} OR ct.due_date >= $${countParamCount})`;
      countParams.push(start_date);
    }

    if (end_date) {
      countParamCount++;
      countQuery += ` AND (ct.end_date <= $${countParamCount} OR ct.due_date <= $${countParamCount})`;
      countParams.push(end_date);
    }

    if (assigned_to_me === 'true') {
      countQuery += ` AND (
        ct.assignees ? $1
        OR EXISTS (
          SELECT 1 FROM workspace_team_members wtm
          WHERE wtm.user_id = $1 
          AND wtm.team_id IN (
            SELECT (jsonb_array_elements_text(ct.assigned_teams))::integer
          )
        )
      )`;
    }

    const countResult = await pool.query(countQuery, countParams);
    
    res.json({
      tasks: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: {
        workspace_ids: workspaceIds,
        channel_ids: channelIds,
        status,
        start_date,
        end_date,
        assigned_to_me
      }
    });
  } catch (error) {
    console.error('Error fetching global tasks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tasks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/tasks/workspaces
// Get list of workspaces user has access to (for filter dropdown)
router.get('/workspaces', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT DISTINCT
        w.id,
        w.name,
        w.description,
        (
          SELECT COUNT(DISTINCT ct.id)
          FROM channel_tasks ct
          JOIN threads t ON ct.thread_id = t.id
          JOIN thread_members tm ON tm.thread_id = t.id
          WHERE ct.workspace_id = w.id AND tm.user_id = $1
        ) as task_count
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = $1
      ORDER BY w.name ASC
    `, [userId]);

    res.json({ workspaces: result.rows });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/tasks/channels
// Get list of channels user has access to (for filter dropdown)
// Optionally filtered by workspace_ids
router.get('/channels', async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspace_ids } = req.query;

    const workspaceIds = workspace_ids 
      ? (Array.isArray(workspace_ids) ? workspace_ids : workspace_ids.split(','))
      : null;

    let query = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.workspace_id,
        w.name as workspace_name,
        (
          SELECT COUNT(*)
          FROM channel_tasks ct
          WHERE ct.thread_id = t.id
        ) as task_count
      FROM threads t
      JOIN workspaces w ON t.workspace_id = w.id
      JOIN thread_members tm ON tm.thread_id = t.id
      WHERE tm.user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (workspaceIds && workspaceIds.length > 0) {
      paramCount++;
      query += ` AND t.workspace_id = ANY($${paramCount})`;
      params.push(workspaceIds.map(id => parseInt(id)));
    }

    query += ` ORDER BY w.name ASC, t.name ASC`;

    const result = await pool.query(query, params);

    res.json({ channels: result.rows });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

module.exports = router;
