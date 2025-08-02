const express = require('express');
const { Pool } = require('pg');
const { authenticateUser, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    // Get user with workspace count and recent activity
    const userQuery = `
      SELECT 
        u.*,
        COUNT(DISTINCT wm.workspace_id) as workspace_count,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'id', w.id,
              'name', w.name,
              'role', wm.role,
              'joined_at', wm.joined_at
            )
          ) FILTER (WHERE w.id IS NOT NULL),
          '[]'::json
        ) as workspaces
      FROM users u
      LEFT JOIN workspace_members wm ON u.id = wm.user_id
      LEFT JOIN workspaces w ON wm.workspace_id = w.id
      WHERE u.id = $1
      GROUP BY u.id;
    `;

    const result = await pool.query(userQuery, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User Not Found', 
        message: 'User profile not found' 
      });
    }

    const user = result.rows[0];
    
    // Remove sensitive information
    delete user.auth_provider; // Keep this internal
    
    res.json({
      user,
      meta: {
        workspace_count: parseInt(user.workspace_count),
        last_login: user.last_login,
        is_active: user.is_active
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve user profile' 
    });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', authenticateUser, async (req, res) => {
  try {
    const { display_name, profile_picture_url, phone_number } = req.body;
    const userId = req.user.id;

    // Validate input
    if (display_name && (display_name.length < 1 || display_name.length > 255)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Display name must be between 1 and 255 characters' 
      });
    }

    if (phone_number && !/^\+?[\d\s\-\(\)]{10,20}$/.test(phone_number)) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Invalid phone number format' 
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }

    if (profile_picture_url !== undefined) {
      updates.push(`profile_picture_url = $${paramCount++}`);
      values.push(profile_picture_url);
    }

    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(phone_number);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'No valid fields provided for update' 
      });
    }

    // Add updated timestamp and user ID
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, display_name, profile_picture_url, phone_number, created_at, last_login, is_active;
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to update user profile' 
    });
  }
});

/**
 * GET /api/users/search
 * Search for users (for invitations)
 * Requires authentication, returns limited user info
 */
router.get('/search', authenticateUser, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Search query must be at least 2 characters' 
      });
    }

    if (limit > 50) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        message: 'Limit cannot exceed 50 users' 
      });
    }

    // Search by email or display name
    const searchQuery = `
      SELECT 
        id,
        email,
        display_name,
        profile_picture_url,
        created_at
      FROM users 
      WHERE (
        email ILIKE $1 
        OR display_name ILIKE $1
      )
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN email = $2 THEN 1
          WHEN email ILIKE $1 THEN 2
          WHEN display_name ILIKE $1 THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT $3;
    `;

    const searchTerm = `%${q}%`;
    const result = await pool.query(searchQuery, [searchTerm, q, parseInt(limit)]);

    res.json({
      users: result.rows,
      query: q,
      count: result.rows.length
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to search users' 
    });
  }
});

/**
 * GET /api/users/:userId
 * Get public user profile (limited info)
 */
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Basic public profile info
    const userQuery = `
      SELECT 
        id,
        display_name,
        profile_picture_url,
        created_at
      FROM users 
      WHERE id = $1 AND is_active = true;
    `;

    const result = await pool.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User Not Found', 
        message: 'User not found or inactive' 
      });
    }

    const user = result.rows[0];

    // If authenticated user is requesting their own profile, add more details
    if (req.user && req.user.id === userId) {
      const detailedQuery = `
        SELECT 
          u.*,
          COUNT(DISTINCT wm.workspace_id) as workspace_count
        FROM users u
        LEFT JOIN workspace_members wm ON u.id = wm.user_id
        WHERE u.id = $1
        GROUP BY u.id;
      `;

      const detailedResult = await pool.query(detailedQuery, [userId]);
      return res.json({
        user: detailedResult.rows[0],
        is_own_profile: true
      });
    }

    res.json({
      user,
      is_own_profile: false
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to retrieve user profile' 
    });
  }
});

/**
 * DELETE /api/users/me
 * Deactivate current user account (soft delete)
 */
router.delete('/me', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Soft delete - set is_active to false
    const deactivateQuery = `
      UPDATE users 
      SET 
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, display_name, is_active;
    `;

    const result = await pool.query(deactivateQuery, [userId]);

    // Note: In production, you'd also want to:
    // 1. Remove from all workspaces
    // 2. Clean up sessions
    // 3. Send confirmation email
    // 4. Log the action for compliance

    res.json({
      message: 'Account deactivated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to deactivate account' 
    });
  }
});

/**
 * POST /api/users/reactivate
 * Reactivate deactivated account
 */
router.post('/reactivate', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    const reactivateQuery = `
      UPDATE users 
      SET 
        is_active = true,
        last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, display_name, is_active;
    `;

    const result = await pool.query(reactivateQuery, [userId]);

    res.json({
      message: 'Account reactivated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      message: 'Unable to reactivate account' 
    });
  }
});

module.exports = router;
