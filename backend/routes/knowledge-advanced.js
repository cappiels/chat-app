const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { authenticateUser, requireWorkspaceMembership } = require('../middleware/auth');

// Use the same database pool as the main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Permission checking middleware (simplified for now - full RBAC can be added later)
const checkKnowledgePermission = (requiredPermission) => {
  return (req, res, next) => {
    // User is already authenticated by authenticateUser middleware
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Grant all permissions for now during development
    req.userPermissions = {
      create: true,
      read: true,
      update: true,
      delete: true,
      manage_permissions: true
    };
    
    next();
  };
};

// Apply authentication to all knowledge routes
router.use(authenticateUser);
router.use('/workspaces/:workspaceId/*', requireWorkspaceMembership);

// Get or create personal bookmarks folder for a user
router.post('/workspaces/:workspaceId/personal-bookmarks', async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId } = req.params;
    const { userId } = req.body;
    const authenticatedUserId = req.user?.id;
    
    // Only allow users to create their own personal bookmarks
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Can only access your own personal bookmarks' });
    }
    
    await client.query('BEGIN');
    
    // Check if personal bookmarks scope already exists
    let personalScopeQuery = `
      SELECT * FROM knowledge_scopes 
      WHERE workspace_id = $1 AND scope_type = 'personal' AND created_by = $2
    `;
    let existingScope = await client.query(personalScopeQuery, [workspaceId, userId]);
    
    if (existingScope.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({ scope: existingScope.rows[0] });
    }
    
    // Create personal bookmarks scope
    const createScopeQuery = `
      INSERT INTO knowledge_scopes (
        workspace_id, name, description, scope_type, created_by, settings
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const scopeResult = await client.query(createScopeQuery, [
      workspaceId,
      'My Bookmarks',
      'Personal bookmark collection - private to you',
      'personal',
      userId,
      JSON.stringify({ is_personal: true, private_access: true })
    ]);
    
    const newScope = scopeResult.rows[0];
    
    // Add user as owner of their personal bookmarks
    const ownerRoleQuery = 'SELECT id FROM knowledge_roles WHERE name = $1 AND scope_level = $2';
    const ownerRoleResult = await client.query(ownerRoleQuery, ['Scope Admin', 'scope']);
    
    if (ownerRoleResult.rows.length > 0) {
      const addMemberQuery = `
        INSERT INTO knowledge_scope_members (scope_id, user_id, role_id, granted_by)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(addMemberQuery, [newScope.id, userId, ownerRoleResult.rows[0].id, userId]);
    }
    
    await client.query('COMMIT');
    
    res.json({ scope: newScope });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating personal bookmarks:', error);
    res.status(500).json({ error: 'Failed to create personal bookmarks' });
  } finally {
    client.release();
  }
});

// Get user permissions for a workspace
router.get('/workspaces/:workspaceId/permissions/:userId', async (req, res) => {
  try {
    const { workspaceId, userId } = req.params;
    const authenticatedUserId = req.user?.id;
    
    // Users can only check their own permissions (or admins can check others)
    if (userId !== authenticatedUserId) {
      // TODO: Add admin check here
      return res.status(403).json({ error: 'Can only access your own permissions' });
    }
    
    const query = `
      SELECT 
        ksm.scope_id,
        kr.name as role_name,
        kr.permissions,
        kr.scope_level,
        ws.is_admin as workspace_admin,
        CASE WHEN ws.created_by = $1 THEN true ELSE false END as is_workspace_owner
      FROM knowledge_scope_members ksm
      JOIN knowledge_roles kr ON ksm.role_id = kr.id
      LEFT JOIN workspace_members ws ON ws.workspace_id = $2 AND ws.user_id = $1
      WHERE ksm.user_id = $1 AND ksm.is_active = true
    `;
    
    const result = await pool.query(query, [userId, workspaceId]);
    const permissions = result.rows;
    
    // Process permissions into a more usable format
    const processedPermissions = {
      workspace_admin: permissions.some(p => p.workspace_admin),
      global_admin: permissions.some(p => p.role_name === 'Global Admin'),
      is_workspace_owner: permissions.some(p => p.is_workspace_owner)
    };
    
    // Add scope-specific permissions
    permissions.forEach(perm => {
      if (perm.scope_id) {
        processedPermissions[perm.scope_id] = {
          role: perm.role_name,
          permissions: perm.permissions,
          scope_level: perm.scope_level
        };
      }
    });
    
    res.json({ permissions: processedPermissions });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

// Generate AI suggestions for categorization
router.post('/workspaces/:workspaceId/ai-suggestions', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { content, thread_context, message_type } = req.body;
    
    // Mock AI suggestions for now - can be replaced with actual AI service
    const suggestions = {
      recommended_scope: thread_context || 'General',
      recommended_category: message_type === 'code' ? 'Technical' : 'General Discussion',
      confidence: 0.85,
      suggested_title: content.length > 50 ? content.substring(0, 50) + '...' : content,
      suggested_summary: `Knowledge from ${thread_context || 'chat conversation'}`,
      suggested_tags: ['chat', 'bookmark', message_type].filter(Boolean)
    };
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    res.status(500).json({ error: 'Failed to generate AI suggestions' });
  }
});

// Get knowledge scopes for a workspace
router.get('/workspaces/:workspaceId/scopes', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.id;
    
    const query = `
      SELECT 
        ks.*,
        kr.name as role_name,
        kr.permissions,
        t.name as source_thread_name,
        COUNT(ki.id) as knowledge_count
      FROM knowledge_scopes ks
      LEFT JOIN knowledge_scope_members ksm ON ks.id = ksm.scope_id AND ksm.user_id = $1 AND ksm.is_active = true
      LEFT JOIN knowledge_roles kr ON ksm.role_id = kr.id
      LEFT JOIN threads t ON ks.source_thread_id = t.id
      LEFT JOIN knowledge_items ki ON ks.id = ki.primary_scope_id AND ki.is_archived = false
      WHERE ks.workspace_id = $2 AND ks.is_active = true
      GROUP BY ks.id, kr.name, kr.permissions, t.name
      ORDER BY ks.created_at DESC
    `;
    
    const result = await pool.query(query, [userId, workspaceId]);
    const scopes = result.rows;
    
    // Process permissions
    const processedScopes = scopes.map(scope => ({
      ...scope,
      permissions: scope.permissions ? scope.permissions : null,
      user_can_access: !!scope.role_name
    }));
    
    res.json({ scopes: processedScopes });
  } catch (error) {
    console.error('Error fetching knowledge scopes:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge scopes' });
  }
});

// Create a new knowledge scope
router.post('/workspaces/:workspaceId/scopes', checkKnowledgePermission('manage_permissions'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId } = req.params;
    const { name, description, scope_type, source_thread_id, settings } = req.body;
    const userId = req.user?.id;
    
    if (!name || !scope_type) {
      return res.status(400).json({ error: 'Name and scope_type are required' });
    }
    
    await client.query('BEGIN');
    
    // Create the scope
    const insertScopeQuery = `
      INSERT INTO knowledge_scopes (workspace_id, name, description, scope_type, source_thread_id, settings, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const scopeResult = await client.query(insertScopeQuery, [
      workspaceId, name, description, scope_type, 
      source_thread_id || null, 
      settings ? JSON.stringify(settings) : null,
      userId
    ]);
    
    const scopeId = scopeResult.rows[0].id;
    
    // Add the creator as a Scope Admin
    const adminRoleQuery = 'SELECT id FROM knowledge_roles WHERE name = $1 AND scope_level = $2';
    const adminRoleResult = await client.query(adminRoleQuery, ['Scope Admin', 'scope']);
    
    if (adminRoleResult.rows.length > 0) {
      const addMemberQuery = `
        INSERT INTO knowledge_scope_members (scope_id, user_id, role_id, granted_by)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(addMemberQuery, [scopeId, userId, adminRoleResult.rows[0].id, userId]);
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({ 
      id: scopeId, 
      message: 'Knowledge scope created successfully',
      scope: { id: scopeId, name, description, scope_type }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating knowledge scope:', error);
    res.status(500).json({ error: 'Failed to create knowledge scope' });
  } finally {
    client.release();
  }
});

// Get knowledge items with advanced filtering
router.get('/workspaces/:workspaceId/scopes/:scopeId/items', checkKnowledgePermission('read'), async (req, res) => {
  try {
    const { workspaceId, scopeId } = req.params;
    const { 
      category, 
      tags, 
      search, 
      featured, 
      approval_status = 'approved',
      content_type,
      created_by,
      sort_by = 'created_at',
      sort_order = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;
    
    let query = `
      SELECT 
        ki.*,
        kc.name as category_name,
        kc.color as category_color,
        kc.icon as category_icon,
        STRING_AGG(DISTINCT kt.name, ',') as tags,
        u.display_name as creator_name,
        ka_views.view_count,
        ka_saves.save_count
      FROM knowledge_items ki
      LEFT JOIN knowledge_categories kc ON ki.category_id = kc.id
      LEFT JOIN knowledge_item_tags kit ON ki.id = kit.knowledge_item_id
      LEFT JOIN knowledge_tags kt ON kit.tag_id = kt.id
      LEFT JOIN users u ON ki.created_by = u.id
      LEFT JOIN (
        SELECT knowledge_item_id, COUNT(*) as view_count 
        FROM knowledge_analytics 
        WHERE action_type = 'view' 
        GROUP BY knowledge_item_id
      ) ka_views ON ki.id = ka_views.knowledge_item_id
      LEFT JOIN (
        SELECT knowledge_item_id, COUNT(*) as save_count 
        FROM knowledge_analytics 
        WHERE action_type = 'save' 
        GROUP BY knowledge_item_id
      ) ka_saves ON ki.id = ka_saves.knowledge_item_id
      WHERE ki.workspace_id = $1 AND ki.primary_scope_id = $2 AND ki.is_archived = false
    `;
    
    const params = [workspaceId, scopeId];
    let paramIndex = 3;
    
    // Add filters
    if (approval_status) {
      query += ` AND ki.approval_status = $${paramIndex}`;
      params.push(approval_status);
      paramIndex++;
    }
    
    if (category && category !== 'all') {
      query += ` AND kc.name = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (featured === 'true') {
      query += ' AND ki.is_featured = true';
    }
    
    if (content_type) {
      query += ` AND ki.content_type = $${paramIndex}`;
      params.push(content_type);
      paramIndex++;
    }
    
    if (created_by) {
      query += ` AND ki.created_by = $${paramIndex}`;
      params.push(created_by);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (ki.title ILIKE $${paramIndex} OR ki.content ILIKE $${paramIndex + 1} OR ki.ai_summary ILIKE $${paramIndex + 2} OR kt.name ILIKE $${paramIndex + 3})`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      paramIndex += 4;
    }
    
    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim());
      query += ` AND kt.name = ANY($${paramIndex})`;
      params.push(tagList);
      paramIndex++;
    }
    
    query += ' GROUP BY ki.id, kc.name, kc.color, kc.icon, u.display_name, ka_views.view_count, ka_saves.save_count';
    
    // Add sorting
    const validSortFields = ['created_at', 'updated_at', 'title', 'views_count', 'upvotes_count'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ki.${sortField} ${sortDirection}`;
    
    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    const items = result.rows;
    
    // Process results
    const processedItems = items.map(item => ({
      ...item,
      tags: item.tags ? item.tags.split(',') : [],
      is_featured: Boolean(item.is_featured),
      is_archived: Boolean(item.is_archived),
      is_template: Boolean(item.is_template),
      ai_tags: item.ai_tags ? item.ai_tags : [],
      view_count: item.view_count || 0,
      save_count: item.save_count || 0
    }));
    
    res.json({ knowledge_items: processedItems });
  } catch (error) {
    console.error('Error fetching knowledge items:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge items' });
  }
});

// Create a new knowledge item
router.post('/workspaces/:workspaceId/scopes/:scopeId/items', checkKnowledgePermission('create'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { workspaceId, scopeId } = req.params;
    const { 
      title, 
      content, 
      content_type = 'markdown',
      category, 
      tags = [], 
      source_message_id,
      source_thread_id,
      source_type = 'manual',
      is_template = false,
      approval_status = 'approved',
      additional_scopes = [] // Other scopes to add this to
    } = req.body;
    const userId = req.user?.id;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    await client.query('BEGIN');
    
    // Get or create category
    let categoryId = null;
    if (category) {
      let categoryQuery = 'SELECT id FROM knowledge_categories WHERE workspace_id = $1 AND name = $2';
      let categoryResult = await client.query(categoryQuery, [workspaceId, category]);
      
      if (categoryResult.rows.length === 0) {
        const insertCategoryQuery = `
          INSERT INTO knowledge_categories (workspace_id, scope_id, name, created_by) 
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `;
        const newCategoryResult = await client.query(insertCategoryQuery, [workspaceId, scopeId, category, userId]);
        categoryId = newCategoryResult.rows[0].id;
      } else {
        categoryId = categoryResult.rows[0].id;
      }
    }
    
    // Create knowledge item
    const insertItemQuery = `
      INSERT INTO knowledge_items (
        workspace_id, primary_scope_id, created_by, title, content, content_type,
        category_id, source_message_id, source_thread_id, source_type, 
        is_template, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;
    
    const itemResult = await client.query(insertItemQuery, [
      workspaceId, scopeId, userId, title, content, content_type,
      categoryId, source_message_id || null, source_thread_id || null, 
      source_type, is_template, approval_status
    ]);
    
    const knowledgeItemId = itemResult.rows[0].id;
    
    // Add to primary scope
    const addToScopeQuery = `
      INSERT INTO knowledge_item_scopes (knowledge_item_id, scope_id, added_by, is_primary)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(addToScopeQuery, [knowledgeItemId, scopeId, userId, true]);
    
    // Add to additional scopes
    if (additional_scopes.length > 0) {
      for (const additionalScopeId of additional_scopes) {
        await client.query(addToScopeQuery, [knowledgeItemId, additionalScopeId, userId, false]);
      }
    }
    
    // Add tags
    if (tags.length > 0) {
      for (const tagName of tags) {
        if (tagName.trim()) {
          // Get or create tag
          let tagQuery = 'SELECT id FROM knowledge_tags WHERE workspace_id = $1 AND name = $2';
          let tagResult = await client.query(tagQuery, [workspaceId, tagName.trim()]);
          
          let tagId;
          if (tagResult.rows.length === 0) {
            const insertTagQuery = `
              INSERT INTO knowledge_tags (workspace_id, scope_id, name, created_by) 
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `;
            const newTagResult = await client.query(insertTagQuery, [workspaceId, scopeId, tagName.trim(), userId]);
            tagId = newTagResult.rows[0].id;
          } else {
            tagId = tagResult.rows[0].id;
          }
          
          // Link tag to knowledge item
          const linkTagQuery = `
            INSERT INTO knowledge_item_tags (knowledge_item_id, tag_id, added_by) 
            VALUES ($1, $2, $3)
            ON CONFLICT (knowledge_item_id, tag_id) DO NOTHING
          `;
          await client.query(linkTagQuery, [knowledgeItemId, tagId, userId]);
        }
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      id: knowledgeItemId,
      message: 'Knowledge item created successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating knowledge item:', error);
    res.status(500).json({ error: 'Failed to create knowledge item' });
  } finally {
    client.release();
  }
});

// Record analytics action
router.post('/items/:itemId/analytics', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { action_type, scope_id, metadata } = req.body;
    const userId = req.user?.id;
    
    if (!action_type || !userId) {
      return res.status(400).json({ error: 'Action type and user ID are required' });
    }
    
    const insertAnalyticsQuery = `
      INSERT INTO knowledge_analytics (knowledge_item_id, user_id, action_type, scope_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await pool.query(insertAnalyticsQuery, [
      itemId, 
      userId, 
      action_type, 
      scope_id || null, 
      metadata ? JSON.stringify(metadata) : null
    ]);
    
    res.json({ message: 'Analytics recorded successfully' });
  } catch (error) {
    console.error('Error recording analytics:', error);
    res.status(500).json({ error: 'Failed to record analytics' });
  }
});

// Get knowledge collections
router.get('/workspaces/:workspaceId/scopes/:scopeId/collections', checkKnowledgePermission('read'), async (req, res) => {
  try {
    const { workspaceId, scopeId } = req.params;
    
    const query = `
      SELECT 
        kc.*,
        COUNT(kci.knowledge_item_id) as item_count,
        u.display_name as creator_name
      FROM knowledge_collections kc
      LEFT JOIN knowledge_collection_items kci ON kc.id = kci.collection_id
      LEFT JOIN users u ON kc.created_by = u.id
      WHERE kc.workspace_id = $1 AND kc.scope_id = $2
      GROUP BY kc.id, u.display_name
      ORDER BY kc.created_at DESC
    `;
    
    const result = await pool.query(query, [workspaceId, scopeId]);
    const collections = result.rows;
    
    const processedCollections = collections.map(collection => ({
      ...collection,
      is_public: Boolean(collection.is_public),
      is_collaborative: Boolean(collection.is_collaborative),
      auto_include_rules: collection.auto_include_rules ? collection.auto_include_rules : null
    }));
    
    res.json({ collections: processedCollections });
  } catch (error) {
    console.error('Error fetching knowledge collections:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge collections' });
  }
});

// Get categories for a workspace
router.get('/workspaces/:workspaceId/categories', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    const query = `
      SELECT 
        kc.*,
        COUNT(ki.id) as item_count,
        u.display_name as creator_name
      FROM knowledge_categories kc
      LEFT JOIN knowledge_items ki ON kc.id = ki.category_id AND ki.is_archived = false
      LEFT JOIN users u ON kc.created_by = u.id
      WHERE kc.workspace_id = $1 AND kc.is_active = true
      GROUP BY kc.id, u.display_name
      ORDER BY kc.name ASC
    `;
    
    const result = await pool.query(query, [workspaceId]);
    const categories = result.rows;
    
    res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get tags for a workspace
router.get('/workspaces/:workspaceId/tags', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    
    const query = `
      SELECT 
        kt.*,
        COUNT(kit.knowledge_item_id) as item_count,
        u.display_name as creator_name
      FROM knowledge_tags kt
      LEFT JOIN knowledge_item_tags kit ON kt.id = kit.tag_id
      LEFT JOIN knowledge_items ki ON kit.knowledge_item_id = ki.id AND ki.is_archived = false
      LEFT JOIN users u ON kt.created_by = u.id
      WHERE kt.workspace_id = $1 AND kt.is_active = true
      GROUP BY kt.id, u.display_name
      ORDER BY kt.name ASC
    `;
    
    const result = await pool.query(query, [workspaceId]);
    const tags = result.rows;
    
    res.json({ data: tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// ===========================================
// DISCUSSION BOARD ENDPOINTS
// ===========================================

// Helper function to check if user can moderate
const checkModerationPermission = async (pool, workspaceId, userId, categoryId = null) => {
  // Check workspace admin status
  const adminQuery = `
    SELECT role FROM workspace_members
    WHERE workspace_id = $1 AND user_id = $2
  `;
  const adminResult = await pool.query(adminQuery, [workspaceId, userId]);

  if (adminResult.rows.length > 0 && adminResult.rows[0].role === 'admin') {
    return { canModerate: true, isWorkspaceAdmin: true };
  }

  // Check category moderator status
  if (categoryId) {
    const modQuery = `
      SELECT admin_level FROM knowledge_category_admins
      WHERE category_id = $1 AND user_id = $2
    `;
    const modResult = await pool.query(modQuery, [categoryId, userId]);

    if (modResult.rows.length > 0) {
      return {
        canModerate: true,
        isWorkspaceAdmin: false,
        isCategoryModerator: true,
        adminLevel: modResult.rows[0].admin_level
      };
    }
  }

  return { canModerate: false, isWorkspaceAdmin: false, isCategoryModerator: false };
};

// GET /workspaces/:wid/topics - List topics with filtering
router.get('/workspaces/:workspaceId/topics', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.id;
    const {
      category,
      pinned,
      search,
      sort_by = 'last_activity_at',
      sort_order = 'DESC',
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        ki.*,
        kc.name as category_name,
        kc.color as category_color,
        kc.icon as category_icon,
        u.display_name as creator_name,
        u.avatar_url as creator_avatar,
        kiv.vote_type as user_vote,
        CASE
          WHEN wm.role = 'admin' THEN true
          WHEN kca.id IS NOT NULL THEN true
          ELSE false
        END as user_can_moderate
      FROM knowledge_items ki
      LEFT JOIN knowledge_categories kc ON ki.category_id = kc.id
      LEFT JOIN users u ON ki.created_by = u.id
      LEFT JOIN knowledge_item_votes kiv ON ki.id = kiv.knowledge_item_id AND kiv.user_id = $1
      LEFT JOIN workspace_members wm ON ki.workspace_id = wm.workspace_id AND wm.user_id = $1
      LEFT JOIN knowledge_category_admins kca ON ki.category_id = kca.category_id AND kca.user_id = $1
      WHERE ki.workspace_id = $2 AND ki.is_archived = false AND ki.approval_status = 'approved'
    `;

    const params = [userId, workspaceId];
    let paramIndex = 3;

    // Filter by category
    if (category && category !== 'all') {
      query += ` AND kc.id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Filter by pinned
    if (pinned === 'true') {
      query += ' AND ki.is_pinned = true';
    }

    // Search in title/content
    if (search) {
      query += ` AND (ki.title ILIKE $${paramIndex} OR ki.content ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sorting: pinned items always first, then by sort criteria
    const validSortFields = ['last_activity_at', 'created_at', 'upvotes_count', 'comment_count', 'views_count'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'last_activity_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ki.is_pinned DESC, ki.${sortField} ${sortDirection}`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM knowledge_items ki
      LEFT JOIN knowledge_categories kc ON ki.category_id = kc.id
      WHERE ki.workspace_id = $1 AND ki.is_archived = false AND ki.approval_status = 'approved'
    `;
    const countParams = [workspaceId];
    let countParamIndex = 2;

    if (category && category !== 'all') {
      countQuery += ` AND kc.id = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }
    if (pinned === 'true') {
      countQuery += ' AND ki.is_pinned = true';
    }
    if (search) {
      countQuery += ` AND (ki.title ILIKE $${countParamIndex} OR ki.content ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      topics: result.rows,
      total: totalCount,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// POST /workspaces/:wid/topics - Create a new topic (Save to KB)
router.post('/workspaces/:workspaceId/topics', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.id;
    const {
      title,
      content,
      category_id,
      source_type,   // 'message', 'task', 'calendar'
      source_id,
      metadata
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Create the topic
    const insertQuery = `
      INSERT INTO knowledge_items (
        workspace_id,
        title,
        content,
        content_type,
        category_id,
        created_by,
        source_type,
        source_id,
        metadata,
        approval_status,
        last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      workspaceId,
      title,
      content,
      'text',
      category_id || null,
      userId,
      source_type || null,
      source_id || null,
      metadata ? JSON.stringify(metadata) : null
    ]);

    const topic = result.rows[0];

    // Fetch additional details for the response
    const detailQuery = `
      SELECT
        ki.*,
        kc.name as category_name,
        kc.color as category_color,
        u.display_name as creator_name,
        u.avatar_url as creator_avatar
      FROM knowledge_items ki
      LEFT JOIN knowledge_categories kc ON ki.category_id = kc.id
      LEFT JOIN users u ON ki.created_by = u.id
      WHERE ki.id = $1
    `;

    const detailResult = await pool.query(detailQuery, [topic.id]);

    res.status(201).json({
      topic: detailResult.rows[0],
      message: 'Topic created successfully'
    });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// GET /workspaces/:wid/topics/:id - Get single topic with details
router.get('/workspaces/:workspaceId/topics/:topicId', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const userId = req.user?.id;

    const query = `
      SELECT
        ki.*,
        kc.name as category_name,
        kc.color as category_color,
        kc.icon as category_icon,
        u.display_name as creator_name,
        u.avatar_url as creator_avatar,
        kiv.vote_type as user_vote,
        CASE
          WHEN wm.role = 'admin' THEN true
          WHEN kca.id IS NOT NULL THEN true
          ELSE false
        END as user_can_moderate,
        CASE WHEN ki.created_by = $1 THEN true ELSE false END as is_owner
      FROM knowledge_items ki
      LEFT JOIN knowledge_categories kc ON ki.category_id = kc.id
      LEFT JOIN users u ON ki.created_by = u.id
      LEFT JOIN knowledge_item_votes kiv ON ki.id = kiv.knowledge_item_id AND kiv.user_id = $1
      LEFT JOIN workspace_members wm ON ki.workspace_id = wm.workspace_id AND wm.user_id = $1
      LEFT JOIN knowledge_category_admins kca ON ki.category_id = kca.category_id AND kca.user_id = $1
      WHERE ki.id = $2 AND ki.workspace_id = $3
    `;

    const result = await pool.query(query, [userId, topicId, workspaceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Record view
    await pool.query(
      `INSERT INTO knowledge_analytics (knowledge_item_id, user_id, action_type) VALUES ($1, $2, 'view')`,
      [topicId, userId]
    );

    res.json({ topic: result.rows[0] });
  } catch (error) {
    console.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

// POST /workspaces/:wid/topics/:id/lock - Lock/unlock topic
router.post('/workspaces/:workspaceId/topics/:topicId/lock', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const { locked } = req.body;
    const userId = req.user?.id;

    // Get topic to check category
    const topicQuery = 'SELECT category_id FROM knowledge_items WHERE id = $1 AND workspace_id = $2';
    const topicResult = await pool.query(topicQuery, [topicId, workspaceId]);

    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const categoryId = topicResult.rows[0].category_id;
    const permissions = await checkModerationPermission(pool, workspaceId, userId, categoryId);

    if (!permissions.canModerate) {
      return res.status(403).json({ error: 'You do not have permission to lock/unlock this topic' });
    }

    const updateQuery = `
      UPDATE knowledge_items
      SET is_locked = $1, locked_by = $2, locked_at = $3, updated_at = NOW()
      WHERE id = $4 AND workspace_id = $5
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      locked,
      locked ? userId : null,
      locked ? new Date() : null,
      topicId,
      workspaceId
    ]);

    res.json({ topic: result.rows[0], message: locked ? 'Topic locked' : 'Topic unlocked' });
  } catch (error) {
    console.error('Error locking/unlocking topic:', error);
    res.status(500).json({ error: 'Failed to lock/unlock topic' });
  }
});

// POST /workspaces/:wid/topics/:id/pin - Pin/unpin topic
router.post('/workspaces/:workspaceId/topics/:topicId/pin', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const { pinned } = req.body;
    const userId = req.user?.id;

    // Get topic to check category
    const topicQuery = 'SELECT category_id FROM knowledge_items WHERE id = $1 AND workspace_id = $2';
    const topicResult = await pool.query(topicQuery, [topicId, workspaceId]);

    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const categoryId = topicResult.rows[0].category_id;
    const permissions = await checkModerationPermission(pool, workspaceId, userId, categoryId);

    if (!permissions.canModerate) {
      return res.status(403).json({ error: 'You do not have permission to pin/unpin this topic' });
    }

    const updateQuery = `
      UPDATE knowledge_items
      SET is_pinned = $1, pinned_by = $2, pinned_at = $3, updated_at = NOW()
      WHERE id = $4 AND workspace_id = $5
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      pinned,
      pinned ? userId : null,
      pinned ? new Date() : null,
      topicId,
      workspaceId
    ]);

    res.json({ topic: result.rows[0], message: pinned ? 'Topic pinned' : 'Topic unpinned' });
  } catch (error) {
    console.error('Error pinning/unpinning topic:', error);
    res.status(500).json({ error: 'Failed to pin/unpin topic' });
  }
});

// DELETE /workspaces/:wid/topics/:id - Delete topic
router.delete('/workspaces/:workspaceId/topics/:topicId', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const userId = req.user?.id;

    // Get topic to check ownership and category
    const topicQuery = 'SELECT category_id, created_by FROM knowledge_items WHERE id = $1 AND workspace_id = $2';
    const topicResult = await pool.query(topicQuery, [topicId, workspaceId]);

    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const topic = topicResult.rows[0];
    const isOwner = topic.created_by === userId;
    const permissions = await checkModerationPermission(pool, workspaceId, userId, topic.category_id);

    if (!isOwner && !permissions.canModerate) {
      return res.status(403).json({ error: 'You do not have permission to delete this topic' });
    }

    // Soft delete (archive) the topic
    await pool.query(
      'UPDATE knowledge_items SET is_archived = true, updated_at = NOW() WHERE id = $1',
      [topicId]
    );

    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// POST /workspaces/:wid/topics/:id/vote - Vote on topic
router.post('/workspaces/:workspaceId/topics/:topicId/vote', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const { vote_type } = req.body; // 'upvote' or 'downvote'
    const userId = req.user?.id;

    if (!['upvote', 'downvote'].includes(vote_type)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    // Verify topic exists
    const topicQuery = 'SELECT id FROM knowledge_items WHERE id = $1 AND workspace_id = $2';
    const topicResult = await pool.query(topicQuery, [topicId, workspaceId]);

    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Upsert vote (insert or update)
    const upsertQuery = `
      INSERT INTO knowledge_item_votes (knowledge_item_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (knowledge_item_id, user_id)
      DO UPDATE SET vote_type = $3, created_at = NOW()
      RETURNING *
    `;

    await pool.query(upsertQuery, [topicId, userId, vote_type]);

    // Get updated counts
    const countsQuery = `
      SELECT upvotes_count, downvotes_count FROM knowledge_items WHERE id = $1
    `;
    const countsResult = await pool.query(countsQuery, [topicId]);

    res.json({
      message: 'Vote recorded',
      vote_type,
      upvotes_count: countsResult.rows[0].upvotes_count,
      downvotes_count: countsResult.rows[0].downvotes_count
    });
  } catch (error) {
    console.error('Error voting on topic:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// DELETE /workspaces/:wid/topics/:id/vote - Remove vote from topic
router.delete('/workspaces/:workspaceId/topics/:topicId/vote', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const userId = req.user?.id;

    // Remove vote
    await pool.query(
      'DELETE FROM knowledge_item_votes WHERE knowledge_item_id = $1 AND user_id = $2',
      [topicId, userId]
    );

    // Get updated counts
    const countsQuery = `
      SELECT upvotes_count, downvotes_count FROM knowledge_items WHERE id = $1
    `;
    const countsResult = await pool.query(countsQuery, [topicId]);

    res.json({
      message: 'Vote removed',
      upvotes_count: countsResult.rows[0]?.upvotes_count || 0,
      downvotes_count: countsResult.rows[0]?.downvotes_count || 0
    });
  } catch (error) {
    console.error('Error removing vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// ===========================================
// COMMENT ENDPOINTS
// ===========================================

// GET /workspaces/:wid/topics/:id/comments - Get comments for topic
router.get('/workspaces/:workspaceId/topics/:topicId/comments', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const userId = req.user?.id;

    // Verify topic exists and belongs to workspace
    const topicQuery = 'SELECT id FROM knowledge_items WHERE id = $1 AND workspace_id = $2';
    const topicResult = await pool.query(topicQuery, [topicId, workspaceId]);

    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Get all comments with user info and vote status
    const query = `
      SELECT
        kc.*,
        u.display_name as user_name,
        u.avatar_url as user_avatar,
        kcv.vote_type as user_vote,
        CASE WHEN kc.user_id = $1 THEN true ELSE false END as is_owner
      FROM knowledge_comments kc
      LEFT JOIN users u ON kc.user_id = u.id
      LEFT JOIN knowledge_comment_votes kcv ON kc.id = kcv.comment_id AND kcv.user_id = $1
      WHERE kc.knowledge_item_id = $2
      ORDER BY kc.created_at ASC
    `;

    const result = await pool.query(query, [userId, topicId]);

    // Build threaded structure
    const commentMap = {};
    const rootComments = [];

    result.rows.forEach(comment => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    result.rows.forEach(comment => {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        commentMap[comment.parent_comment_id].replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    });

    res.json({ comments: rootComments, total: result.rows.length });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /workspaces/:wid/topics/:id/comments - Add comment to topic
router.post('/workspaces/:workspaceId/topics/:topicId/comments', async (req, res) => {
  try {
    const { workspaceId, topicId } = req.params;
    const { content, parent_comment_id } = req.body;
    const userId = req.user?.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify topic exists and is not locked
    const topicQuery = 'SELECT id, is_locked FROM knowledge_items WHERE id = $1 AND workspace_id = $2';
    const topicResult = await pool.query(topicQuery, [topicId, workspaceId]);

    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    if (topicResult.rows[0].is_locked) {
      return res.status(403).json({ error: 'This topic is locked. Comments are not allowed.' });
    }

    // Insert comment
    const insertQuery = `
      INSERT INTO knowledge_comments (knowledge_item_id, user_id, parent_comment_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      topicId,
      userId,
      parent_comment_id || null,
      content.trim()
    ]);

    // Get user info for response
    const userQuery = 'SELECT display_name, avatar_url FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);

    const comment = {
      ...result.rows[0],
      user_name: userResult.rows[0]?.display_name,
      user_avatar: userResult.rows[0]?.avatar_url,
      is_owner: true,
      user_vote: null,
      replies: []
    };

    res.status(201).json({ comment, message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// PUT /workspaces/:wid/comments/:id - Edit comment
router.put('/workspaces/:workspaceId/comments/:commentId', async (req, res) => {
  try {
    const { workspaceId, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify comment exists and user owns it
    const commentQuery = `
      SELECT kc.* FROM knowledge_comments kc
      JOIN knowledge_items ki ON kc.knowledge_item_id = ki.id
      WHERE kc.id = $1 AND ki.workspace_id = $2
    `;
    const commentResult = await pool.query(commentQuery, [commentId, workspaceId]);

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (commentResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    // Update comment
    const updateQuery = `
      UPDATE knowledge_comments
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [content.trim(), commentId]);

    res.json({ comment: result.rows[0], message: 'Comment updated successfully' });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /workspaces/:wid/comments/:id - Delete comment
router.delete('/workspaces/:workspaceId/comments/:commentId', async (req, res) => {
  try {
    const { workspaceId, commentId } = req.params;
    const userId = req.user?.id;

    // Get comment with topic info
    const commentQuery = `
      SELECT kc.*, ki.category_id, ki.workspace_id
      FROM knowledge_comments kc
      JOIN knowledge_items ki ON kc.knowledge_item_id = ki.id
      WHERE kc.id = $1 AND ki.workspace_id = $2
    `;
    const commentResult = await pool.query(commentQuery, [commentId, workspaceId]);

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];
    const isOwner = comment.user_id === userId;
    const permissions = await checkModerationPermission(pool, workspaceId, userId, comment.category_id);

    if (!isOwner && !permissions.canModerate) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }

    // Delete comment (cascades to child comments)
    await pool.query('DELETE FROM knowledge_comments WHERE id = $1', [commentId]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// POST /workspaces/:wid/comments/:id/vote - Vote on comment
router.post('/workspaces/:workspaceId/comments/:commentId/vote', async (req, res) => {
  try {
    const { workspaceId, commentId } = req.params;
    const { vote_type } = req.body;
    const userId = req.user?.id;

    if (!['upvote', 'downvote'].includes(vote_type)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    // Verify comment exists
    const commentQuery = `
      SELECT kc.id FROM knowledge_comments kc
      JOIN knowledge_items ki ON kc.knowledge_item_id = ki.id
      WHERE kc.id = $1 AND ki.workspace_id = $2
    `;
    const commentResult = await pool.query(commentQuery, [commentId, workspaceId]);

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Upsert vote
    const upsertQuery = `
      INSERT INTO knowledge_comment_votes (comment_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (comment_id, user_id)
      DO UPDATE SET vote_type = $3, created_at = NOW()
    `;

    await pool.query(upsertQuery, [commentId, userId, vote_type]);

    // Get updated counts
    const countsQuery = `
      SELECT upvotes_count, downvotes_count FROM knowledge_comments WHERE id = $1
    `;
    const countsResult = await pool.query(countsQuery, [commentId]);

    res.json({
      message: 'Vote recorded',
      vote_type,
      upvotes_count: countsResult.rows[0].upvotes_count,
      downvotes_count: countsResult.rows[0].downvotes_count
    });
  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// DELETE /workspaces/:wid/comments/:id/vote - Remove vote from comment
router.delete('/workspaces/:workspaceId/comments/:commentId/vote', async (req, res) => {
  try {
    const { workspaceId, commentId } = req.params;
    const userId = req.user?.id;

    await pool.query(
      'DELETE FROM knowledge_comment_votes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );

    // Get updated counts
    const countsQuery = `
      SELECT upvotes_count, downvotes_count FROM knowledge_comments WHERE id = $1
    `;
    const countsResult = await pool.query(countsQuery, [commentId]);

    res.json({
      message: 'Vote removed',
      upvotes_count: countsResult.rows[0]?.upvotes_count || 0,
      downvotes_count: countsResult.rows[0]?.downvotes_count || 0
    });
  } catch (error) {
    console.error('Error removing vote:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// ===========================================
// MODERATION ENDPOINTS
// ===========================================

// GET /workspaces/:wid/moderation/permissions - Get user's moderation permissions
router.get('/workspaces/:workspaceId/moderation/permissions', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.id;

    // Check workspace admin
    const adminQuery = `
      SELECT role FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `;
    const adminResult = await pool.query(adminQuery, [workspaceId, userId]);
    const isWorkspaceAdmin = adminResult.rows.length > 0 && adminResult.rows[0].role === 'admin';

    // Get category moderator assignments
    const modQuery = `
      SELECT kca.*, kc.name as category_name, kc.color as category_color
      FROM knowledge_category_admins kca
      JOIN knowledge_categories kc ON kca.category_id = kc.id
      WHERE kca.user_id = $1 AND kc.workspace_id = $2
    `;
    const modResult = await pool.query(modQuery, [userId, workspaceId]);

    res.json({
      is_workspace_admin: isWorkspaceAdmin,
      can_moderate_all: isWorkspaceAdmin,
      category_moderations: modResult.rows
    });
  } catch (error) {
    console.error('Error fetching moderation permissions:', error);
    res.status(500).json({ error: 'Failed to fetch moderation permissions' });
  }
});

// POST /workspaces/:wid/categories/:id/moderators - Assign category moderator
router.post('/workspaces/:workspaceId/categories/:categoryId/moderators', async (req, res) => {
  try {
    const { workspaceId, categoryId } = req.params;
    const { user_id, admin_level = 'moderator' } = req.body;
    const appointedBy = req.user?.id;

    // Verify workspace admin
    const adminQuery = `
      SELECT role FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `;
    const adminResult = await pool.query(adminQuery, [workspaceId, appointedBy]);

    if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admins can assign moderators' });
    }

    // Verify category exists
    const categoryQuery = 'SELECT id FROM knowledge_categories WHERE id = $1 AND workspace_id = $2';
    const categoryResult = await pool.query(categoryQuery, [categoryId, workspaceId]);

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Insert or update moderator
    const upsertQuery = `
      INSERT INTO knowledge_category_admins (category_id, user_id, admin_level, appointed_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (category_id, user_id)
      DO UPDATE SET admin_level = $3, appointed_by = $4, appointed_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(upsertQuery, [categoryId, user_id, admin_level, appointedBy]);

    res.status(201).json({ moderator: result.rows[0], message: 'Moderator assigned successfully' });
  } catch (error) {
    console.error('Error assigning moderator:', error);
    res.status(500).json({ error: 'Failed to assign moderator' });
  }
});

// DELETE /workspaces/:wid/categories/:id/moderators/:uid - Remove moderator
router.delete('/workspaces/:workspaceId/categories/:categoryId/moderators/:userId', async (req, res) => {
  try {
    const { workspaceId, categoryId, userId: targetUserId } = req.params;
    const requestingUserId = req.user?.id;

    // Verify workspace admin
    const adminQuery = `
      SELECT role FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `;
    const adminResult = await pool.query(adminQuery, [workspaceId, requestingUserId]);

    if (adminResult.rows.length === 0 || adminResult.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admins can remove moderators' });
    }

    await pool.query(
      'DELETE FROM knowledge_category_admins WHERE category_id = $1 AND user_id = $2',
      [categoryId, targetUserId]
    );

    res.json({ message: 'Moderator removed successfully' });
  } catch (error) {
    console.error('Error removing moderator:', error);
    res.status(500).json({ error: 'Failed to remove moderator' });
  }
});

// ===========================================
// EXISTING ANALYTICS ENDPOINT
// ===========================================

// Get knowledge analytics dashboard
  try {
    const { workspaceId } = req.params;
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    const days = timeframes[timeframe] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get analytics data
    const analyticsQuery = `
      SELECT 
        ka.action_type,
        DATE(ka.created_at) as date,
        COUNT(*) as count
      FROM knowledge_analytics ka
      JOIN knowledge_items ki ON ka.knowledge_item_id = ki.id
      WHERE ki.workspace_id = $1 AND ka.created_at >= $2
      GROUP BY ka.action_type, DATE(ka.created_at)
      ORDER BY date DESC
    `;
    
    const analyticsResult = await pool.query(analyticsQuery, [workspaceId, startDate.toISOString()]);
    const analytics = analyticsResult.rows;
    
    // Get top knowledge items
    const topItemsQuery = `
      SELECT 
        ki.id,
        ki.title,
        ki.views_count,
        ki.upvotes_count,
        COUNT(ka.id) as recent_activity
      FROM knowledge_items ki
      LEFT JOIN knowledge_analytics ka ON ki.id = ka.knowledge_item_id AND ka.created_at >= $1
      WHERE ki.workspace_id = $2 AND ki.is_archived = false
      GROUP BY ki.id, ki.title, ki.views_count, ki.upvotes_count
      ORDER BY recent_activity DESC, ki.views_count DESC
      LIMIT 10
    `;
    
    const topItemsResult = await pool.query(topItemsQuery, [startDate.toISOString(), workspaceId]);
    const topItems = topItemsResult.rows;
    
    res.json({ 
      analytics, 
      top_items: topItems,
      timeframe,
      start_date: startDate.toISOString()
    });
  } catch (error) {
    console.error('Error fetching knowledge analytics:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge analytics' });
  }
});

module.exports = router;
