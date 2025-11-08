const express = require('express');
const { Pool } = require('pg');
const { 
  authenticateUser, 
  requireWorkspaceMembership 
} = require('../middleware/auth');
const router = express.Router({ mergeParams: true }); // Inherit workspaceId from parent route

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Apply authentication and workspace membership middleware to all routes
router.use(authenticateUser);
router.use(requireWorkspaceMembership);

/**
 * GET /api/workspaces/:workspaceId/projects
 * List all projects in workspace
 */
router.get('/', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    const projectsQuery = `
      SELECT 
        p.*,
        u.display_name as created_by_name,
        u.email as created_by_email,
        pm.role as user_role,
        pm.permissions as user_permissions,
        (
          SELECT COUNT(*)
          FROM project_members pm2
          WHERE pm2.project_id = p.id
        ) as member_count,
        (
          SELECT COUNT(*)
          FROM project_tasks pt
          WHERE pt.project_id = p.id
        ) as task_count,
        (
          SELECT COUNT(*)
          FROM project_tasks pt
          WHERE pt.project_id = p.id 
          AND pt.status = 'completed'
        ) as completed_task_count
      FROM projects p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
      WHERE p.workspace_id = $1
      ORDER BY p.created_at DESC;
    `;

    const result = await pool.query(projectsQuery, [workspaceId, userId]);

    res.json({
      projects: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve projects' 
    });
  }
});

/**
 * POST /api/workspaces/:workspaceId/projects
 * Create new project
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { name, description = null } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || name.length < 1 || name.length > 255) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Project name must be between 1 and 255 characters' 
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Description cannot exceed 1000 characters' 
      });
    }

    await client.query('BEGIN');

    // Create project
    const projectQuery = `
      INSERT INTO projects (workspace_id, name, description, created_by, settings)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const defaultSettings = {
      calendar_integration: true,
      google_drive_enabled: false,
      default_task_status: 'pending',
      notification_preferences: {
        task_assignments: true,
        due_date_reminders: true,
        project_updates: true
      },
      created_at: new Date().toISOString()
    };

    const projectResult = await client.query(projectQuery, [
      workspaceId,
      name, 
      description, 
      userId,
      JSON.stringify(defaultSettings)
    ]);

    const project = projectResult.rows[0];

    // Add creator as project owner
    await client.query(`
      INSERT INTO project_members (project_id, user_id, role, permissions)
      VALUES ($1, $2, 'owner', $3);
    `, [
      project.id, 
      userId,
      JSON.stringify({
        calendar_access: true,
        drive_access: true,
        manage_members: true,
        manage_tasks: true,
        manage_settings: true
      })
    ]);

    await client.query('COMMIT');

    // Log project creation
    console.log(`📊 Project created: ${project.name} (${project.id}) in workspace ${workspaceId} by ${req.user.email}`);

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        ...project,
        user_role: 'owner',
        member_count: 1,
        task_count: 0,
        completed_task_count: 0
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create project error:', error);
    
    if (error.code === '23505') { // Duplicate key
      return res.status(409).json({ 
        error: 'Conflict', 
        message: 'A project with this name already exists in this workspace' 
      });
    }
    
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to create project' 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/workspaces/:workspaceId/projects/:projectId
 * Get project details
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { workspaceId, projectId } = req.params;
    const userId = req.user.id;

    const projectQuery = `
      SELECT 
        p.*,
        u.display_name as created_by_name,
        u.email as created_by_email,
        pm.role as user_role,
        pm.permissions as user_permissions,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pm2.user_id,
              'email', u2.email,
              'display_name', u2.display_name,
              'profile_picture_url', u2.profile_picture_url,
              'role', pm2.role,
              'permissions', pm2.permissions,
              'joined_at', pm2.joined_at
            )
            ORDER BY pm2.role DESC, pm2.joined_at ASC
          )
          FROM project_members pm2
          JOIN users u2 ON pm2.user_id = u2.id
          WHERE pm2.project_id = p.id
        ) as members,
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', pt.id,
              'title', pt.title,
              'description', pt.description,
              'status', pt.status,
              'priority', pt.priority,
              'start_date', pt.start_date,
              'end_date', pt.end_date,
              'due_date', pt.due_date,
              'assigned_to', pt.assigned_to,
              'assigned_to_name', u3.display_name,
              'created_by', pt.created_by,
              'created_at', pt.created_at,
              'updated_at', pt.updated_at
            )
            ORDER BY pt.created_at DESC
          )
          FROM project_tasks pt
          LEFT JOIN users u3 ON pt.assigned_to = u3.id
          WHERE pt.project_id = p.id
        ) as tasks
      FROM projects p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $3
      WHERE p.id = $1 AND p.workspace_id = $2;
    `;

    const result = await pool.query(projectQuery, [projectId, workspaceId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Project Not Found', 
        message: 'Project not found or access denied' 
      });
    }

    const project = result.rows[0];
    
    res.json({
      project: {
        ...project,
        member_count: project.members?.length || 0,
        task_count: project.tasks?.length || 0,
        completed_task_count: project.tasks?.filter(t => t.status === 'completed').length || 0
      }
    });

  } catch (error) {
    console.error('Get project details error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve project details' 
    });
  }
});

/**
 * PUT /api/workspaces/:workspaceId/projects/:projectId
 * Update project settings
 */
router.put('/:projectId', async (req, res) => {
  try {
    const { workspaceId, projectId } = req.params;
    const { name, description, settings } = req.body;
    const userId = req.user.id;

    // Check if user has permission to update project
    const permissionCheck = await pool.query(`
      SELECT pm.role, pm.permissions
      FROM project_members pm
      WHERE pm.project_id = $1 AND pm.user_id = $2;
    `, [projectId, userId]);

    if (permissionCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: 'You are not a member of this project' 
      });
    }

    const userRole = permissionCheck.rows[0].role;
    const userPermissions = permissionCheck.rows[0].permissions;

    // Only owners and admins can update project settings
    if (!['owner', 'admin'].includes(userRole) && !userPermissions?.manage_settings) {
      return res.status(403).json({ 
        error: 'Insufficient Permissions', 
        message: 'You do not have permission to update this project' 
      });
    }

    // Validation
    if (name && (name.length < 1 || name.length > 255)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Project name must be between 1 and 255 characters' 
      });
    }

    if (description && description.length > 1000) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Description cannot exceed 1000 characters' 
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (settings !== undefined) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'No valid fields provided for update' 
      });
    }

    // Add updated timestamp and project ID
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(projectId, workspaceId);

    const updateQuery = `
      UPDATE projects 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND workspace_id = $${paramCount}
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Project Not Found', 
        message: 'Project not found' 
      });
    }

    res.json({
      message: 'Project updated successfully',
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to update project' 
    });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/projects/:projectId
 * Delete project (owner only)
 */
router.delete('/:projectId', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId, projectId } = req.params;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Check if user is project owner
    const ownerCheck = await client.query(`
      SELECT p.name, pm.role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
      WHERE p.id = $1 AND p.workspace_id = $3;
    `, [projectId, userId, workspaceId]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Project Not Found', 
        message: 'Project not found' 
      });
    }

    const project = ownerCheck.rows[0];
    if (project.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Only the project owner can delete this project' 
      });
    }

    // Delete project (cascades to members, tasks, etc.)
    await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);

    await client.query('COMMIT');

    console.log(`🗑️ Project deleted: ${project.name} (${projectId}) by ${req.user.email}`);

    res.json({
      message: 'Project deleted successfully',
      project_id: projectId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete project error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to delete project' 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
