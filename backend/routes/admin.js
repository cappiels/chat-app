const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { createPool } = require('../config/database');

const pool = createPool();

// Site admin email
const SITE_ADMIN_EMAIL = 'cappiels@gmail.com';

// Middleware to check if user is site admin
const requireSiteAdmin = (req, res, next) => {
  if (req.user?.email !== SITE_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Site admin access required' });
  }
  next();
};

// Apply authentication and admin check to all routes
router.use(authenticateUser);
router.use(requireSiteAdmin);

// GET /api/admin/workspaces - Get all workspaces with owner and subscription data
router.get('/workspaces', async (req, res) => {
  try {
    const query = `
      SELECT 
        w.id,
        w.name,
        w.description,
        w.created_at,
        w.owner_user_id,
        u.display_name as owner_name,
        u.email as owner_email,
        COUNT(DISTINCT wm.user_id) as member_count,
        COALESCE(sp.name, 'free') as owner_subscription_plan,
        COALESCE(sp.display_name, 'Free Plan') as owner_subscription_display_name,
        us.status as owner_subscription_status,
        us.current_period_end as owner_subscription_expires
      FROM workspaces w
      LEFT JOIN users u ON w.owner_user_id = u.id
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status IN ('trialing', 'active')
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      GROUP BY w.id, w.name, w.description, w.created_at, w.owner_user_id, 
               u.display_name, u.email, sp.name, sp.display_name, us.status, us.current_period_end
      ORDER BY w.created_at DESC
    `;

    const result = await pool.query(query);
    
    const workspaces = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      owner: {
        user_id: row.owner_user_id,
        name: row.owner_name,
        email: row.owner_email,
        subscription: {
          plan: row.owner_subscription_plan,
          display_name: row.owner_subscription_display_name,
          status: row.owner_subscription_status,
          expires: row.owner_subscription_expires
        }
      },
      member_count: parseInt(row.member_count) || 0
    }));

    res.json({ workspaces });
  } catch (error) {
    console.error('Error fetching admin workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// GET /api/admin/users - Get all users with subscription and workspace stats
router.get('/users', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.profile_picture_url,
        u.created_at as joined_date,
        u.last_login,
        u.is_active,
        COALESCE(sp.name, 'free') as subscription_plan,
        COALESCE(sp.display_name, 'Free Plan') as subscription_display_name,
        us.status as subscription_status,
        us.current_period_end as subscription_expires,
        COUNT(DISTINCT w_owned.id) as workspaces_owned,
        COUNT(DISTINCT wm.workspace_id) as workspaces_member_of
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status IN ('trialing', 'active')
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN workspaces w_owned ON u.id = w_owned.owner_user_id
      LEFT JOIN workspace_members wm ON u.id = wm.user_id
      GROUP BY u.id, u.email, u.display_name, u.profile_picture_url, u.created_at,
               u.last_login, u.is_active, sp.name, sp.display_name, us.status, us.current_period_end
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);
    
    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      profile_picture_url: row.profile_picture_url,
      joined_date: row.joined_date,
      last_login: row.last_login,
      is_active: row.is_active,
      subscription: {
        plan: row.subscription_plan,
        display_name: row.subscription_display_name,
        status: row.subscription_status,
        expires: row.subscription_expires
      },
      workspaces_owned: parseInt(row.workspaces_owned) || 0,
      workspaces_member_of: parseInt(row.workspaces_member_of) || 0
    }));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/stats - Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const queries = await Promise.all([
      // Total users
      pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      
      // Users by subscription plan
      pool.query(`
        SELECT 
          COALESCE(sp.name, 'free') as plan,
          COALESCE(sp.display_name, 'Free Plan') as display_name,
          COUNT(*) as count
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id 
          AND us.status IN ('trialing', 'active')
        LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE u.is_active = true
        GROUP BY sp.name, sp.display_name
        ORDER BY COUNT(*) DESC
      `),
      
      // Total workspaces
      pool.query('SELECT COUNT(*) as count FROM workspaces'),
      
      // Recent activity (users who logged in within last 7 days)
      pool.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE last_login > NOW() - INTERVAL '7 days' AND is_active = true
      `)
    ]);

    const stats = {
      total_users: parseInt(queries[0].rows[0].count),
      subscription_breakdown: queries[1].rows,
      total_workspaces: parseInt(queries[2].rows[0].count),
      active_users_7d: parseInt(queries[3].rows[0].count)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// DELETE /api/admin/workspaces/:workspaceId - Admin delete or archive workspace
router.delete('/workspaces/:workspaceId', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workspaceId } = req.params;
    const { archive = false } = req.body;

    await client.query('BEGIN');

    // Get workspace info for logging
    const workspaceQuery = await client.query(`
      SELECT w.name, u.email as owner_email, u.display_name as owner_name
      FROM workspaces w
      LEFT JOIN users u ON w.owner_user_id = u.id
      WHERE w.id = $1;
    `, [workspaceId]);

    if (workspaceQuery.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Workspace Not Found', 
        message: 'Workspace not found' 
      });
    }

    const workspace = workspaceQuery.rows[0];

    if (archive) {
      // Archive workspace - add archived flag and timestamp
      await client.query(`
        UPDATE workspaces 
        SET settings = COALESCE(settings, '{}') || jsonb_build_object(
          'archived', true,
          'archived_at', $2,
          'archived_by_admin', $3
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [workspaceId, new Date().toISOString(), req.user.email]);

      console.log(`🗄️ [ADMIN] Workspace archived: ${workspace.name} (${workspaceId}) by admin ${req.user.email}`);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workspace archived successfully by admin',
        action: 'archived',
        workspace_name: workspace.name,
        owner: workspace.owner_name || workspace.owner_email
      });
    } else {
      // Permanently delete workspace and all related data
      // Note: Foreign key cascades will handle related data deletion
      await client.query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);

      console.log(`🗑️ [ADMIN] Workspace permanently deleted: ${workspace.name} (${workspaceId}) by admin ${req.user.email}`);
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workspace permanently deleted by admin',
        action: 'deleted',
        workspace_name: workspace.name,
        owner: workspace.owner_name || workspace.owner_email
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin delete workspace error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to delete workspace' 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
