const express = require('express');
const router = express.Router({ mergeParams: true }); // Important: merge params to access threadId

// Middleware
const { authenticateUser } = require('../middleware/auth');
const { createPool } = require('../config/database');
const emailService = require('../services/emailService');
const pushNotificationService = require('../services/pushNotificationService');

// Database connection
const pool = createPool();

// Middleware to check if user is member of the channel/thread
const requireChannelMembership = async (req, res, next) => {
  try {
    const { workspaceId, threadId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Checking channel membership - workspaceId: ${workspaceId}, threadId: ${threadId}, userId: ${userId}`);

    // Check if user is member of this channel
    const result = await pool.query(`
      SELECT tm.role 
      FROM thread_members tm
      JOIN threads t ON tm.thread_id = t.id
      WHERE t.id = $1 AND t.workspace_id = $2 AND tm.user_id = $3
    `, [threadId, workspaceId, userId]);

    console.log(`🔍 Channel membership result: ${JSON.stringify(result.rows)}`);

    if (result.rows.length === 0) {
      console.log(`❌ User ${userId} is not a member of channel ${threadId} in workspace ${workspaceId}`);
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    req.channelRole = result.rows[0].role;
    console.log(`✅ User is member with role: ${req.channelRole}`);
    next();
  } catch (error) {
    console.error('❌ Error checking channel membership:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
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
        -- Get reply count for task discussion
        (
          SELECT COUNT(*)::integer
          FROM messages m
          WHERE m.parent_message_id = ct.message_id
        ) as reply_count,
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
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT
        ct.*,
        u1.display_name as assigned_to_name,
        u2.display_name as created_by_name,
        t.name as channel_name,
        -- Get reply count for task discussion
        (
          SELECT COUNT(*)::integer
          FROM messages m
          WHERE m.parent_message_id = ct.message_id
        ) as reply_count,
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
        -- Check permissions
        CASE WHEN ct.created_by = $3 THEN true ELSE false END as user_is_creator
      FROM channel_tasks ct
      LEFT JOIN users u1 ON ct.assigned_to = u1.id
      LEFT JOIN users u2 ON ct.created_by = u2.id
      JOIN threads t ON ct.thread_id = t.id
      WHERE ct.id = $1 AND ct.thread_id = $2
    `, [taskId, threadId, userId]);

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

    const taskId = result.rows[0].id;

    // Create a task message in the channel for discussion
    let taskMessageId = null;
    try {
      const taskMessageResult = await pool.query(`
        INSERT INTO messages (thread_id, sender_id, content, message_type, metadata)
        VALUES ($1, $2, $3, 'task', $4)
        RETURNING id
      `, [
        threadId,
        userId,
        `Task: ${title.trim()}`,
        JSON.stringify({ task_id: taskId })
      ]);
      taskMessageId = taskMessageResult.rows[0].id;

      // Update the task with the message reference
      await pool.query(
        'UPDATE channel_tasks SET message_id = $1 WHERE id = $2',
        [taskMessageId, taskId]
      );

      console.log(`📝 Created task message ${taskMessageId} for task ${taskId}`);
    } catch (msgError) {
      // Non-critical - continue even if message creation fails
      console.error('Warning: Could not create task message:', msgError.message);
    }

    // Send email notifications to all assignees (don't notify the creator)
    if (finalAssignees.length > 0) {
      // Get assigner info, assignee info, workspace info, and channel info
      try {
        const contextQuery = await pool.query(`
          SELECT 
            u.display_name as assigner_name,
            w.name as workspace_name,
            t.name as channel_name
          FROM users u, workspaces w, threads t
          WHERE u.id = $1 AND w.id = $2 AND t.id = $3
        `, [userId, req.params.workspaceId, threadId]);

        if (contextQuery.rows.length > 0) {
          const { assigner_name, workspace_name, channel_name } = contextQuery.rows[0];
          
          // Get all assignee details
          const assigneesQuery = await pool.query(
            'SELECT id, display_name, email FROM users WHERE id = ANY($1)',
            [finalAssignees]
          );

          const baseUrl = process.env.FRONTEND_URL || 'https://crewchat.elbarriobk.com';
          const taskUrl = `${baseUrl}/#/workspace/${req.params.workspaceId}`;

          // Send email to each assignee (except the creator)
              // Get creator email to CC them
              const creatorQuery = await pool.query(
                'SELECT email, display_name FROM users WHERE id = $1',
                [userId]
              );
              const creatorEmail = creatorQuery.rows[0]?.email;
              const creatorDisplayName = creatorQuery.rows[0]?.display_name;

              for (const assignee of assigneesQuery.rows) {
                if (assignee.id !== userId && assignee.email) {
                  console.log(`📧 Sending task assignment email to ${assignee.email} for task "${title.trim()}"`);
                  
                  emailService.sendTaskAssignmentNotification({
                    to: assignee.email,
                    assigneeName: assignee.display_name || 'Team Member',
                    assignerName: assigner_name,
                    taskTitle: title.trim(),
                    taskDescription: description || null,
                    workspaceName: workspace_name,
                    channelName: channel_name,
                    dueDate: cleanDueDate || cleanEndDate || null,
                    taskUrl
                  }).then(result => {
                    if (result.success) {
                      console.log(`✅ Task assignment email sent to ${assignee.email}`);
                    } else {
                      console.log(`⚠️ Task assignment email failed for ${assignee.email}: ${result.error}`);
                    }
                  }).catch(err => {
                    console.error(`❌ Error sending task assignment email to ${assignee.email}:`, err);
                  });
                }
              }

              // Send confirmation copy to the assignor (task creator)
              if (creatorEmail && assigneesQuery.rows.length > 0) {
                console.log(`📧 Sending task assignment confirmation to creator ${creatorEmail}`);
                
                const assigneeNames = assigneesQuery.rows
                  .filter(a => a.id !== userId)
                  .map(a => a.display_name || a.email)
                  .join(', ');
                
                emailService.sendEmail({
                  to: creatorEmail,
                  subject: `📋 Task Created: "${title.trim()}" assigned to ${assigneeNames}`,
                  html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Task Assignment Confirmation</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .task-info { background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Task Created Successfully</h1>
        </div>
        <div class="content">
            <p>Hi ${creatorDisplayName || 'there'},</p>
            <p>Your task has been created and assigned. Here's a summary:</p>
            <div class="task-info">
                <h3 style="margin-top: 0; color: #6366f1;">${title.trim()}</h3>
                ${description ? `<p>${description}</p>` : ''}
                <p><strong>Assigned to:</strong> ${assigneeNames}</p>
                <p><strong>Channel:</strong> #${channel_name}</p>
                ${cleanDueDate || cleanEndDate ? `<p><strong>Due:</strong> ${new Date(cleanDueDate || cleanEndDate).toLocaleDateString()}</p>` : ''}
            </div>
            <p style="text-align: center;">
                <a href="${taskUrl}" class="cta-button">View Task</a>
            </p>
        </div>
        <div class="footer">
            <p>You'll be notified when assignees complete this task.</p>
        </div>
    </div>
</body>
</html>`,
                  category: 'task-assignment-confirmation'
                }).then(result => {
                  if (result.success) {
                    console.log(`✅ Task assignment confirmation sent to creator ${creatorEmail}`);
                  }
                }).catch(err => {
                  console.error(`❌ Error sending confirmation to creator:`, err);
                });
              }

          // Also send emails to team members if teams are assigned
          if (assigned_teams.length > 0) {
            const teamMembersQuery = await pool.query(`
              SELECT DISTINCT u.id, u.display_name, u.email
              FROM workspace_team_members wtm
              JOIN users u ON u.id = wtm.user_id
              WHERE wtm.team_id = ANY($1) AND wtm.is_active = true AND u.id != $2
            `, [assigned_teams.map(id => parseInt(id)), userId]);

            for (const member of teamMembersQuery.rows) {
              // Skip if already in individual assignees
              if (member.email && !finalAssignees.includes(member.id)) {
                console.log(`📧 Sending team task assignment email to ${member.email} for task "${title.trim()}"`);
                
                emailService.sendTaskAssignmentNotification({
                  to: member.email,
                  assigneeName: member.display_name || 'Team Member',
                  assignerName: assigner_name,
                  taskTitle: title.trim(),
                  taskDescription: description || null,
                  workspaceName: workspace_name,
                  channelName: channel_name,
                  dueDate: cleanDueDate || cleanEndDate || null,
                  taskUrl
                }).then(result => {
                  if (result.success) {
                    console.log(`✅ Team task assignment email sent to ${member.email}`);
                  } else {
                    console.log(`⚠️ Team task assignment email failed for ${member.email}: ${result.error}`);
                  }
                }).catch(err => {
                  console.error(`❌ Error sending team task assignment email to ${member.email}:`, err);
                });
              }
            }
          }
        }
      } catch (emailError) {
        // Don't fail the request if email sending fails - just log it
        console.error('Error sending task assignment emails:', emailError);
      }
    }

    // Send push notifications to all assignees (don't notify the creator)
    if (finalAssignees.length > 0 || assigned_teams.length > 0) {
      try {
        // Get assigner name for push notification
        const assignerQuery = await pool.query(
          'SELECT display_name FROM users WHERE id = $1',
          [userId]
        );
        const assignerName = assignerQuery.rows[0]?.display_name || 'Someone';

        // Send push to individual assignees
        for (const assigneeId of finalAssignees) {
          if (assigneeId !== userId) {
            try {
              await pushNotificationService.notifyTaskAssigned(
                assigneeId,
                req.params.workspaceId,
                taskId,
                assignerName,
                title.trim()
              );
              console.log(`📱 Push notification queued for task assignment to user ${assigneeId}`);
            } catch (pushError) {
              console.error(`Failed to queue push notification for task assignment to user ${assigneeId}:`, pushError);
            }
          }
        }

        // Also send push to team members if teams are assigned
        if (assigned_teams.length > 0) {
          const teamMembersQuery = await pool.query(`
            SELECT DISTINCT u.id
            FROM workspace_team_members wtm
            JOIN users u ON u.id = wtm.user_id
            WHERE wtm.team_id = ANY($1) AND wtm.is_active = true AND u.id != $2
          `, [assigned_teams.map(id => parseInt(id)), userId]);

          for (const member of teamMembersQuery.rows) {
            // Skip if already in individual assignees
            if (!finalAssignees.includes(member.id)) {
              try {
                await pushNotificationService.notifyTaskAssigned(
                  member.id,
                  req.params.workspaceId,
                  taskId,
                  assignerName,
                  title.trim()
                );
                console.log(`📱 Push notification queued for team task assignment to user ${member.id}`);
              } catch (pushError) {
                console.error(`Failed to queue push notification for team member ${member.id}:`, pushError);
              }
            }
          }
        }
      } catch (pushError) {
        // Don't fail the request if push notification fails - just log it
        console.error('Error sending task assignment push notifications:', pushError);
      }
    }

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
    const { workspaceId, threadId, taskId } = req.params;
    const userId = req.user.id;

    console.log(`📝 Task completion request - workspaceId: ${workspaceId}, threadId: ${threadId}, taskId: ${taskId}, userId: ${userId}`);

    // Simplified completion - directly update the task without complex SQL function
    // 1. First, get the current task
    console.log(`🔍 Looking for task: SELECT * FROM channel_tasks WHERE id = '${taskId}' AND thread_id = '${threadId}'`);
    const taskResult = await pool.query(
      'SELECT * FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );
    console.log(`🔍 Task result: found ${taskResult.rows.length} rows`);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];
    const timestamp = new Date().toISOString();

    // 2. Update individual_completions to include this user
    const currentCompletions = task.individual_completions || {};
    const updatedCompletions = { ...currentCompletions, [userId]: timestamp };
    const completionCount = Object.keys(updatedCompletions).length;

    // 3. Update the task
    await pool.query(`
      UPDATE channel_tasks 
      SET 
        individual_completions = $1,
        completion_count = $2,
        completed_at = $3,
        status = CASE WHEN $4 = 'individual_response' THEN status ELSE 'completed' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [
      JSON.stringify(updatedCompletions),
      completionCount,
      timestamp,
      task.assignment_mode || 'collaborative',
      taskId
    ]);

    const completion_result = {
      success: true,
      progress: { completed: completionCount, total: completionCount },
      completed_by_user: userId,
      timestamp: timestamp
    };

    // Send email notification to task creator
    try {
      // Get task details, creator info, completer info, workspace/channel info
      const taskInfoQuery = await pool.query(`
        SELECT 
          ct.title,
          ct.created_by,
          ct.progress_info,
          u_creator.email as creator_email,
          u_creator.display_name as creator_name,
          u_completer.display_name as completer_name,
          w.name as workspace_name,
          t.name as channel_name
        FROM channel_tasks ct
        JOIN users u_creator ON ct.created_by = u_creator.id
        JOIN users u_completer ON u_completer.id = $2
        JOIN workspaces w ON ct.workspace_id = w.id
        JOIN threads t ON ct.thread_id = t.id
        WHERE ct.id = $1
      `, [taskId, userId]);

      if (taskInfoQuery.rows.length > 0) {
        const { 
          title, 
          created_by, 
          progress_info,
          creator_email, 
          creator_name, 
          completer_name,
          workspace_name, 
          channel_name 
        } = taskInfoQuery.rows[0];

        // Only notify if completer is not the creator
        if (created_by !== userId && creator_email) {
          const baseUrl = process.env.FRONTEND_URL || 'https://crewchat.elbarriobk.com';
          const taskUrl = `${baseUrl}/#/workspace/${workspaceId}`;

          console.log(`📧 Sending task completion email to creator ${creator_email} for task "${title}"`);
          
          emailService.sendTaskCompletionNotification({
            to: creator_email,
            creatorName: creator_name || 'there',
            completerName: completer_name || 'A team member',
            taskTitle: title,
            workspaceName: workspace_name,
            channelName: channel_name,
            completedAt: new Date().toISOString(),
            progressInfo: completion_result.progress || progress_info,
            taskUrl
          }).then(result => {
            if (result.success) {
              console.log(`✅ Task completion email sent to ${creator_email}`);
            } else {
              console.log(`⚠️ Task completion email failed for ${creator_email}: ${result.error}`);
            }
          }).catch(err => {
            console.error(`❌ Error sending task completion email to ${creator_email}:`, err);
          });
        }
      }
    } catch (emailError) {
      // Don't fail the request if email sending fails
      console.error('Error sending task completion email:', emailError);
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
    const { threadId, taskId } = req.params;
    const userId = req.user.id;

    // Simplified - directly update the task without complex SQL function
    // 1. First, get the current task
    const taskResult = await pool.query(
      'SELECT * FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // 2. Remove user from individual_completions
    const currentCompletions = task.individual_completions || {};
    delete currentCompletions[userId];
    const completionCount = Object.keys(currentCompletions).length;

    // 3. Update the task
    await pool.query(`
      UPDATE channel_tasks 
      SET 
        individual_completions = $1,
        completion_count = $2,
        completed_at = CASE WHEN $2 = 0 THEN NULL ELSE completed_at END,
        status = CASE WHEN $2 = 0 THEN 'pending' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      JSON.stringify(currentCompletions),
      completionCount,
      taskId
    ]);

    res.json({
      message: 'Task marked as incomplete',
      progress: { completed: completionCount, total: completionCount },
      uncompleted_by: userId
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


// POST /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/complete/:targetUserId
// Admin/creator marks task as complete for a specific user
router.post('/:taskId/complete/:targetUserId', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId, targetUserId } = req.params;
    const userId = req.user.id;

    // Get the task and check permissions
    const taskResult = await pool.query(
      'SELECT * FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is workspace admin or task creator
    const workspaceCheck = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    const isAdmin = workspaceCheck.rows.length > 0 && workspaceCheck.rows[0].role === 'admin';
    const isCreator = task.created_by === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only workspace admins or task creators can mark completion for others' });
    }

    // Verify target user is an assignee
    const assignees = task.assignees || [];
    if (!assignees.includes(targetUserId) && task.assigned_to !== targetUserId) {
      return res.status(400).json({ error: 'Target user is not assigned to this task' });
    }

    const timestamp = new Date().toISOString();
    const currentCompletions = task.individual_completions || {};
    const updatedCompletions = { ...currentCompletions, [targetUserId]: timestamp };
    const completionCount = Object.keys(updatedCompletions).length;

    await pool.query(`
      UPDATE channel_tasks
      SET
        individual_completions = $1,
        completion_count = $2,
        completed_at = $3,
        status = CASE WHEN $4 = 'individual_response' THEN status ELSE 'completed' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [
      JSON.stringify(updatedCompletions),
      completionCount,
      timestamp,
      task.assignment_mode || 'collaborative',
      taskId
    ]);

    // Get target user name for response
    const targetUserResult = await pool.query(
      'SELECT display_name FROM users WHERE id = $1',
      [targetUserId]
    );
    const targetUserName = targetUserResult.rows[0]?.display_name || 'Unknown';

    res.json({
      message: `Task marked as complete for ${targetUserName}`,
      progress: { completed: completionCount, total: assignees.length || 1 },
      completed_for: targetUserId,
      completed_by_admin: userId,
      timestamp
    });
  } catch (error) {
    console.error('Error marking task complete for user:', error);
    res.status(500).json({ error: 'Failed to mark task complete' });
  }
});

// DELETE /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/complete/:targetUserId
// Admin/creator unmarks task completion for a specific user
router.delete('/:taskId/complete/:targetUserId', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId, targetUserId } = req.params;
    const userId = req.user.id;

    const taskResult = await pool.query(
      'SELECT * FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is workspace admin or task creator
    const workspaceCheck = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    const isAdmin = workspaceCheck.rows.length > 0 && workspaceCheck.rows[0].role === 'admin';
    const isCreator = task.created_by === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only workspace admins or task creators can modify completion for others' });
    }

    const currentCompletions = task.individual_completions || {};
    delete currentCompletions[targetUserId];
    const completionCount = Object.keys(currentCompletions).length;

    await pool.query(`
      UPDATE channel_tasks
      SET
        individual_completions = $1,
        completion_count = $2,
        completed_at = CASE WHEN $2 = 0 THEN NULL ELSE completed_at END,
        status = CASE WHEN $2 = 0 THEN 'pending' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      JSON.stringify(currentCompletions),
      completionCount,
      taskId
    ]);

    res.json({
      message: 'Task completion removed for user',
      progress: { completed: completionCount },
      uncompleted_for: targetUserId,
      modified_by: userId
    });
  } catch (error) {
    console.error('Error unmarking task complete for user:', error);
    res.status(500).json({ error: 'Failed to unmark task complete' });
  }
});

// POST /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/complete-all
// Admin/creator marks task as complete for ALL assignees
router.post('/:taskId/complete-all', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId } = req.params;
    const userId = req.user.id;

    const taskResult = await pool.query(
      'SELECT * FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is workspace admin or task creator
    const workspaceCheck = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    const isAdmin = workspaceCheck.rows.length > 0 && workspaceCheck.rows[0].role === 'admin';
    const isCreator = task.created_by === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only workspace admins or task creators can mark all as complete' });
    }

    const timestamp = new Date().toISOString();
    const assignees = task.assignees || [];

    // If no assignees array, use assigned_to
    const allAssignees = assignees.length > 0 ? assignees : (task.assigned_to ? [task.assigned_to] : []);

    if (allAssignees.length === 0) {
      return res.status(400).json({ error: 'No assignees to mark as complete' });
    }

    // Create completions for all assignees
    const completions = {};
    allAssignees.forEach(assigneeId => {
      completions[assigneeId] = timestamp;
    });

    await pool.query(`
      UPDATE channel_tasks
      SET
        individual_completions = $1,
        completion_count = $2,
        completed_at = $3,
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [
      JSON.stringify(completions),
      allAssignees.length,
      timestamp,
      taskId
    ]);

    res.json({
      message: 'Task marked as complete for all assignees',
      progress: { completed: allAssignees.length, total: allAssignees.length },
      completed_for: allAssignees,
      completed_by_admin: userId,
      timestamp
    });
  } catch (error) {
    console.error('Error marking task complete for all:', error);
    res.status(500).json({ error: 'Failed to mark task complete for all' });
  }
});

// === TASK DISCUSSION ENDPOINTS ===

// GET /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/replies
// Get all replies (discussion) for a task
router.get('/:taskId/replies', async (req, res) => {
  try {
    const { threadId, taskId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // First get the task's message_id
    const taskResult = await pool.query(
      'SELECT message_id FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const messageId = taskResult.rows[0].message_id;

    if (!messageId) {
      // No message associated with task yet - return empty replies
      return res.json({ replies: [], total: 0 });
    }

    // Get replies to the task message
    const repliesResult = await pool.query(`
      SELECT
        m.id,
        m.content,
        m.sender_id,
        m.created_at,
        m.updated_at,
        m.is_edited,
        u.display_name as sender_name,
        u.photo_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.parent_message_id = $1 AND m.is_deleted = false
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `, [messageId, limit, offset]);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*)::integer as total FROM messages WHERE parent_message_id = $1 AND is_deleted = false',
      [messageId]
    );

    res.json({
      replies: repliesResult.rows,
      total: countResult.rows[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching task replies:', error);
    res.status(500).json({ error: 'Failed to fetch task replies' });
  }
});

// POST /api/workspaces/:workspaceId/threads/:threadId/tasks/:taskId/replies
// Post a reply to a task discussion
router.post('/:taskId/replies', async (req, res) => {
  try {
    const { workspaceId, threadId, taskId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Reply content is required' });
    }

    // Get the task's message_id
    const taskResult = await pool.query(
      'SELECT message_id, title, created_by FROM channel_tasks WHERE id = $1 AND thread_id = $2',
      [taskId, threadId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let messageId = taskResult.rows[0].message_id;
    const taskTitle = taskResult.rows[0].title;
    // Use task creator, or fall back to current user if creator is null
    const taskCreatorId = taskResult.rows[0].created_by || userId;

    // If no message exists for this task, create one first
    if (!messageId) {
      try {
        const taskMessageResult = await pool.query(`
          INSERT INTO messages (thread_id, sender_id, content, message_type, metadata)
          VALUES ($1, $2, $3, 'task', $4)
          RETURNING id
        `, [
          threadId,
          taskCreatorId,
          `Task: ${taskTitle}`,
          JSON.stringify({ task_id: taskId })
        ]);
        if (!taskMessageResult.rows[0]?.id) {
          throw new Error('Failed to create task message - no ID returned');
        }
        messageId = taskMessageResult.rows[0].id;
      } catch (msgError) {
        console.error('Error creating task message:', msgError.message, msgError.stack);
        // Fall back to inserting without metadata if column doesn't exist
        const taskMessageResult = await pool.query(`
          INSERT INTO messages (thread_id, sender_id, content, message_type)
          VALUES ($1, $2, $3, 'task')
          RETURNING id
        `, [
          threadId,
          taskCreatorId,
          `Task: ${taskTitle}`
        ]);
        if (!taskMessageResult.rows[0]?.id) {
          throw new Error('Failed to create task message in fallback - no ID returned');
        }
        messageId = taskMessageResult.rows[0].id;
      }

      // Update the task with the message reference
      await pool.query(
        'UPDATE channel_tasks SET message_id = $1 WHERE id = $2',
        [messageId, taskId]
      );
    }

    // Insert the reply
    const replyResult = await pool.query(`
      INSERT INTO messages (thread_id, sender_id, content, message_type, parent_message_id)
      VALUES ($1, $2, $3, 'text', $4)
      RETURNING id, content, sender_id, created_at
    `, [threadId, userId, content.trim(), messageId]);

    // Get sender details
    const userResult = await pool.query(
      'SELECT display_name, profile_picture_url FROM users WHERE id = $1',
      [userId]
    );

    const reply = {
      ...replyResult.rows[0],
      sender_name: userResult.rows[0]?.display_name || 'Unknown',
      sender_avatar: userResult.rows[0]?.profile_picture_url
    };

    // Send push notification to task creator if different from replier
    if (taskCreatorId !== userId) {
      try {
        await pushNotificationService.sendNotification(taskCreatorId, {
          title: 'New reply on your task',
          body: `${reply.sender_name}: ${content.trim().substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          data: {
            type: 'task_reply',
            workspace_id: workspaceId,
            thread_id: threadId,
            task_id: taskId
          }
        });
      } catch (pushError) {
        console.error('Failed to send push notification for task reply:', pushError);
      }
    }

    res.status(201).json({
      message: 'Reply posted successfully',
      reply
    });
  } catch (error) {
    console.error('Error posting task reply:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to post task reply', details: error.message });
  }
});

module.exports = router;
