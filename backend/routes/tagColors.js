const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Tag Colors API Routes
 * 
 * Based on react-staging TagInput.js approach with admin override system
 * Supports automatic algorithmic color generation + channel admin overrides
 */

// GET /api/workspaces/:workspaceId/threads/:threadId/tag-colors
// Get effective tag colors for a channel (includes algorithmic + overrides)
router.get('/workspaces/:workspaceId/threads/:threadId/tag-colors', async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    const { tags } = req.query; // Optional: specific tags to get colors for
    
    console.log('Getting tag colors:', { workspaceId, threadId, tags });

    // Get all tags used in this channel if none specified
    let tagsToProcess = [];
    if (tags) {
      tagsToProcess = Array.isArray(tags) ? tags : tags.split(',');
    } else {
      // Get all unique tags from tasks in this channel
      const tagQuery = `
        SELECT DISTINCT jsonb_array_elements_text(tags) as tag_name
        FROM channel_tasks 
        WHERE thread_id = $1 AND workspace_id = $2
        AND tags IS NOT NULL AND jsonb_array_length(tags) > 0
        ORDER BY tag_name
      `;
      const tagResult = await pool.query(tagQuery, [threadId, workspaceId]);
      tagsToProcess = tagResult.rows.map(row => row.tag_name);
    }

    console.log('Processing tags:', tagsToProcess);

    // Get effective colors for each tag
    const tagColors = {};
    
    for (const tag of tagsToProcess) {
      const colorQuery = `SELECT get_tag_color($1, $2, $3) as color`;
      const colorResult = await pool.query(colorQuery, [tag, threadId, workspaceId]);
      
      const colorData = colorResult.rows[0]?.color;
      if (colorData) {
        tagColors[tag] = colorData;
      }
    }

    console.log('Retrieved tag colors:', tagColors);

    res.json({
      success: true,
      tagColors,
      channel: threadId,
      workspace: workspaceId,
      tagsProcessed: tagsToProcess.length
    });

  } catch (error) {
    console.error('Error getting tag colors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tag colors',
      error: error.message
    });
  }
});

// PUT /api/workspaces/:workspaceId/threads/:threadId/tag-colors/:tagName
// Set channel admin color override for a tag
router.put('/workspaces/:workspaceId/threads/:threadId/tag-colors/:tagName', async (req, res) => {
  try {
    const { workspaceId, threadId, tagName } = req.params;
    const { color, userId } = req.body;
    
    console.log('Setting tag color override:', { 
      workspaceId, threadId, tagName, color, userId 
    });

    if (!color || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Color and userId are required'
      });
    }

    // Validate color format
    const validatedColor = {
      hex: color.hex || color.backgroundColor,
      name: color.name || 'custom',
      tailwind: color.tailwind || `bg-${color.name || 'blue'}-500 text-white`,
      google: color.google || '1'
    };

    // TODO: Add permission check - ensure user is channel admin

    // Set the color override using the database function
    const setColorQuery = `
      SELECT set_tag_color_override($1, $2, $3, $4, $5, $6, $7, $8) as result
    `;
    
    const result = await pool.query(setColorQuery, [
      tagName,
      threadId,
      workspaceId,
      validatedColor.hex,
      validatedColor.name,
      validatedColor.tailwind,
      validatedColor.google,
      userId
    ]);

    const setResult = result.rows[0]?.result;

    console.log('Tag color override set:', setResult);

    res.json({
      success: true,
      result: setResult,
      message: `Color override set for tag "${tagName}"`
    });

  } catch (error) {
    console.error('Error setting tag color override:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set tag color override',
      error: error.message
    });
  }
});

// DELETE /api/workspaces/:workspaceId/threads/:threadId/tag-colors/:tagName
// Remove channel admin color override (reset to algorithmic)
router.delete('/workspaces/:workspaceId/threads/:threadId/tag-colors/:tagName', async (req, res) => {
  try {
    const { workspaceId, threadId, tagName } = req.params;
    
    console.log('Removing tag color override:', { workspaceId, threadId, tagName });

    // TODO: Add permission check - ensure user is channel admin

    // Remove the color override using the database function
    const removeQuery = `SELECT remove_tag_color_override($1, $2) as result`;
    const result = await pool.query(removeQuery, [tagName, threadId]);

    const removeResult = result.rows[0]?.result;

    console.log('Tag color override removed:', removeResult);

    res.json({
      success: true,
      result: removeResult,
      message: `Color override removed for tag "${tagName}" - using algorithmic color`
    });

  } catch (error) {
    console.error('Error removing tag color override:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove tag color override',
      error: error.message
    });
  }
});

// GET /api/workspaces/:workspaceId/threads/:threadId/tag-colors/overrides
// Get all channel admin color overrides
router.get('/workspaces/:workspaceId/threads/:threadId/tag-colors/overrides', async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    
    console.log('Getting tag color overrides:', { workspaceId, threadId });

    const overridesQuery = `
      SELECT 
        tag_name,
        color_hex,
        color_name,
        color_tailwind,
        color_google_calendar,
        created_by,
        created_at,
        updated_at
      FROM channel_tag_colors
      WHERE thread_id = $1 AND workspace_id = $2 AND is_active = true
      ORDER BY tag_name
    `;

    const result = await pool.query(overridesQuery, [threadId, workspaceId]);

    const overrides = {};
    result.rows.forEach(row => {
      overrides[row.tag_name] = {
        hex: row.color_hex,
        name: row.color_name,
        tailwind: row.color_tailwind,
        google: row.color_google_calendar,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isOverride: true
      };
    });

    console.log('Retrieved overrides:', overrides);

    res.json({
      success: true,
      overrides,
      channel: threadId,
      workspace: workspaceId,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting tag color overrides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tag color overrides',
      error: error.message
    });
  }
});

// GET /api/workspaces/:workspaceId/tag-colors/preview/:tagName
// Preview algorithmic color for a tag (without setting override)
router.get('/workspaces/:workspaceId/tag-colors/preview/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;
    
    console.log('Getting algorithmic color preview:', { tagName });

    // Get algorithmic color using the database function
    const previewQuery = `SELECT generate_algorithmic_tag_color($1) as color`;
    const result = await pool.query(previewQuery, [tagName]);

    const colorData = result.rows[0]?.color;

    console.log('Generated preview color:', colorData);

    res.json({
      success: true,
      tag: tagName,
      color: colorData,
      source: 'algorithmic'
    });

  } catch (error) {
    console.error('Error generating color preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate color preview',
      error: error.message
    });
  }
});

// GET /api/workspaces/:workspaceId/threads/:threadId/tags/suggestions
// Get tag suggestions for a channel (for TagsInput component)
router.get('/workspaces/:workspaceId/threads/:threadId/tags/suggestions', async (req, res) => {
  try {
    const { workspaceId, threadId } = req.params;
    
    console.log('Getting tag suggestions:', { workspaceId, threadId });

    // Get all unique tags from this channel
    const channelTagsQuery = `
      SELECT DISTINCT jsonb_array_elements_text(tags) as tag_name,
             COUNT(*) as usage_count
      FROM channel_tasks 
      WHERE thread_id = $1 AND workspace_id = $2
      AND tags IS NOT NULL AND jsonb_array_length(tags) > 0
      GROUP BY tag_name
      ORDER BY usage_count DESC, tag_name ASC
      LIMIT 20
    `;

    const channelResult = await pool.query(channelTagsQuery, [threadId, workspaceId]);

    // Get popular tags from the workspace for additional suggestions
    const workspaceTagsQuery = `
      SELECT DISTINCT jsonb_array_elements_text(tags) as tag_name,
             COUNT(*) as usage_count
      FROM channel_tasks 
      WHERE workspace_id = $1
      AND tags IS NOT NULL AND jsonb_array_length(tags) > 0
      GROUP BY tag_name
      ORDER BY usage_count DESC, tag_name ASC
      LIMIT 10
    `;

    const workspaceResult = await pool.query(workspaceTagsQuery, [workspaceId]);

    // Combine and deduplicate suggestions
    const channelTags = channelResult.rows.map(row => row.tag_name);
    const workspaceTags = workspaceResult.rows.map(row => row.tag_name);
    
    const suggestions = [
      ...channelTags,
      ...workspaceTags.filter(tag => !channelTags.includes(tag))
    ];

    console.log('Generated tag suggestions:', suggestions);

    res.json({
      success: true,
      suggestions,
      channelTags,
      workspaceTags: workspaceTags.filter(tag => !channelTags.includes(tag)),
      channel: threadId,
      workspace: workspaceId
    });

  } catch (error) {
    console.error('Error getting tag suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tag suggestions',
      error: error.message
    });
  }
});

module.exports = router;
