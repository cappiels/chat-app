-- Migration 024: Add Automatic Tag Color System with Admin Override
-- Inspired by react-staging TagsInput and GV2.js
-- Features: Algorithmic color generation + channel admin overrides

-- Channel-level tag color overrides table
CREATE TABLE IF NOT EXISTS channel_tag_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  
  -- Color definition (multiple formats supported)
  color_hex VARCHAR(7), -- #FF5733
  color_name VARCHAR(50), -- 'red', 'blue', 'green'
  color_tailwind VARCHAR(50), -- 'bg-red-500', 'bg-blue-600'
  color_google_calendar VARCHAR(2), -- '1'-'11' for Google Calendar sync
  
  -- Admin control
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  -- Ensure one color override per tag per channel
  UNIQUE(thread_id, tag_name)
);

-- Workspace-level default tag colors (fallback for channels without overrides)
CREATE TABLE IF NOT EXISTS workspace_tag_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  
  -- Color definition
  color_hex VARCHAR(7),
  color_name VARCHAR(50),
  color_tailwind VARCHAR(50), 
  color_google_calendar VARCHAR(2),
  
  -- Admin control
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(workspace_id, tag_name)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_thread_id ON channel_tag_colors(thread_id);
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_workspace_id ON channel_tag_colors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_tag_name ON channel_tag_colors(tag_name);
CREATE INDEX IF NOT EXISTS idx_channel_tag_colors_active ON channel_tag_colors(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workspace_tag_colors_workspace_id ON workspace_tag_colors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tag_colors_tag_name ON workspace_tag_colors(tag_name);
CREATE INDEX IF NOT EXISTS idx_workspace_tag_colors_active ON workspace_tag_colors(is_active) WHERE is_active = true;

-- Function to generate algorithmic color for a tag (deterministic)
CREATE OR REPLACE FUNCTION generate_algorithmic_tag_color(tag_name_param VARCHAR)
RETURNS JSON AS $$
DECLARE
  tag_hash BIGINT;
  color_index INTEGER;
  color_palette JSON[];
  selected_color JSON;
BEGIN
  -- Create a deterministic hash of the tag name
  tag_hash := ABS(('x' || SUBSTR(MD5(LOWER(tag_name_param)), 1, 8))::bit(32)::int);
  
  -- Define color palette (inspired by react-staging)
  color_palette := ARRAY[
    '{"name": "red", "hex": "#EF4444", "tailwind": "bg-red-500 text-white", "google": "11"}'::json,
    '{"name": "orange", "hex": "#F97316", "tailwind": "bg-orange-500 text-white", "google": "6"}'::json,
    '{"name": "amber", "hex": "#F59E0B", "tailwind": "bg-amber-500 text-white", "google": "5"}'::json,
    '{"name": "yellow", "hex": "#EAB308", "tailwind": "bg-yellow-500 text-black", "google": "5"}'::json,
    '{"name": "lime", "hex": "#84CC16", "tailwind": "bg-lime-500 text-black", "google": "2"}'::json,
    '{"name": "green", "hex": "#22C55E", "tailwind": "bg-green-500 text-white", "google": "2"}'::json,
    '{"name": "emerald", "hex": "#10B981", "tailwind": "bg-emerald-500 text-white", "google": "10"}'::json,
    '{"name": "teal", "hex": "#14B8A6", "tailwind": "bg-teal-500 text-white", "google": "7"}'::json,
    '{"name": "cyan", "hex": "#06B6D4", "tailwind": "bg-cyan-500 text-white", "google": "7"}'::json,
    '{"name": "sky", "hex": "#0EA5E9", "tailwind": "bg-sky-500 text-white", "google": "1"}'::json,
    '{"name": "blue", "hex": "#3B82F6", "tailwind": "bg-blue-500 text-white", "google": "1"}'::json,
    '{"name": "indigo", "hex": "#6366F1", "tailwind": "bg-indigo-500 text-white", "google": "9"}'::json,
    '{"name": "violet", "hex": "#8B5CF6", "tailwind": "bg-violet-500 text-white", "google": "3"}'::json,
    '{"name": "purple", "hex": "#A855F7", "tailwind": "bg-purple-500 text-white", "google": "3"}'::json,
    '{"name": "fuchsia", "hex": "#D946EF", "tailwind": "bg-fuchsia-500 text-white", "google": "4"}'::json,
    '{"name": "pink", "hex": "#EC4899", "tailwind": "bg-pink-500 text-white", "google": "4"}'::json,
    '{"name": "rose", "hex": "#F43F5E", "tailwind": "bg-rose-500 text-white", "google": "11"}'::json,
    '{"name": "slate", "hex": "#64748B", "tailwind": "bg-slate-500 text-white", "google": "8"}'::json,
    '{"name": "gray", "hex": "#6B7280", "tailwind": "bg-gray-500 text-white", "google": "8"}'::json,
    '{"name": "neutral", "hex": "#737373", "tailwind": "bg-neutral-500 text-white", "google": "8"}'::json
  ];
  
  -- Select color based on hash
  color_index := (tag_hash % array_length(color_palette, 1)) + 1;
  selected_color := color_palette[color_index];
  
  RETURN selected_color;
END;
$$ LANGUAGE plpgsql;

-- Function to get effective tag color (override -> workspace default -> algorithmic)
CREATE OR REPLACE FUNCTION get_tag_color(
  tag_name_param VARCHAR,
  thread_id_param UUID DEFAULT NULL,
  workspace_id_param UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  override_color JSON;
  workspace_color JSON;
  algorithmic_color JSON;
BEGIN
  -- Priority 1: Channel-level override
  IF thread_id_param IS NOT NULL THEN
    SELECT json_build_object(
      'name', color_name,
      'hex', color_hex,
      'tailwind', color_tailwind,
      'google', color_google_calendar,
      'source', 'channel_override'
    ) INTO override_color
    FROM channel_tag_colors
    WHERE thread_id = thread_id_param 
      AND tag_name = tag_name_param
      AND is_active = true;
    
    IF override_color IS NOT NULL THEN
      RETURN override_color;
    END IF;
  END IF;
  
  -- Priority 2: Workspace-level default
  IF workspace_id_param IS NOT NULL THEN
    SELECT json_build_object(
      'name', color_name,
      'hex', color_hex,
      'tailwind', color_tailwind,
      'google', color_google_calendar,
      'source', 'workspace_default'
    ) INTO workspace_color
    FROM workspace_tag_colors
    WHERE workspace_id = workspace_id_param
      AND tag_name = tag_name_param
      AND is_active = true;
    
    IF workspace_color IS NOT NULL THEN
      RETURN workspace_color || json_build_object('source', 'workspace_default');
    END IF;
  END IF;
  
  -- Priority 3: Algorithmic generation
  algorithmic_color := generate_algorithmic_tag_color(tag_name_param);
  RETURN algorithmic_color || json_build_object('source', 'algorithmic');
END;
$$ LANGUAGE plpgsql;

-- Enhanced view to include tag colors for tasks
CREATE OR REPLACE VIEW channel_tasks_with_tag_colors AS
SELECT 
  ct.*,
  
  -- Existing progress information
  get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions) as progress_info,
  
  -- Completion status
  CASE 
    WHEN ct.assignment_mode = 'individual_response' THEN 
      (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'is_fully_complete')::boolean
    ELSE 
      ct.completed_at IS NOT NULL
  END as is_complete,
  
  -- Assignee counts
  (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'total')::integer as total_assignees,
  jsonb_array_length(ct.assignees) as individual_assignee_count,
  jsonb_array_length(ct.assigned_teams) as team_count,
  
  -- Tag colors (NEW)
  CASE 
    WHEN ct.tags IS NOT NULL AND jsonb_array_length(ct.tags) > 0 THEN
      (SELECT json_agg(
        json_build_object(
          'tag', tag_elem,
          'color', get_tag_color(tag_elem::text, ct.thread_id, ct.workspace_id)
        )
      )
      FROM jsonb_array_elements_text(ct.tags) AS tag_elem)
    ELSE NULL
  END as tag_colors,
  
  -- Google sync status
  CASE 
    WHEN ct.google_calendar_event_id IS NOT NULL AND ct.google_task_id IS NOT NULL THEN 'both'
    WHEN ct.google_calendar_event_id IS NOT NULL THEN 'calendar'
    WHEN ct.google_task_id IS NOT NULL THEN 'tasks'
    ELSE 'none'
  END as current_sync_status,
  
  -- Sync health
  CASE
    WHEN ct.sync_error IS NOT NULL THEN 'error'
    WHEN ct.last_synced_at IS NULL THEN 'never_synced'
    WHEN ct.last_synced_at < ct.updated_at THEN 'needs_sync'
    ELSE 'synced'
  END as sync_health,
  
  -- Location and tags for filtering
  COALESCE(ct.location, '') as location_text,
  jsonb_array_length(ct.tags) as tag_count,
  
  -- Workspace sync config
  wgsc.google_calendar_enabled,
  wgsc.google_tasks_enabled,
  wgsc.auto_sync_enabled
  
FROM channel_tasks ct
LEFT JOIN workspace_google_sync_config wgsc ON wgsc.workspace_id = ct.workspace_id;

-- Function to set tag color override (admin interface)
CREATE OR REPLACE FUNCTION set_tag_color_override(
  tag_name_param VARCHAR,
  thread_id_param UUID,
  workspace_id_param UUID,
  color_hex_param VARCHAR,
  color_name_param VARCHAR,
  color_tailwind_param VARCHAR,
  color_google_param VARCHAR,
  user_id_param VARCHAR
)
RETURNS JSON AS $$
DECLARE
  result_record channel_tag_colors%ROWTYPE;
BEGIN
  -- Insert or update tag color override
  INSERT INTO channel_tag_colors (
    thread_id, workspace_id, tag_name,
    color_hex, color_name, color_tailwind, color_google_calendar,
    created_by
  ) VALUES (
    thread_id_param, workspace_id_param, tag_name_param,
    color_hex_param, color_name_param, color_tailwind_param, color_google_param,
    user_id_param
  )
  ON CONFLICT (thread_id, tag_name) 
  DO UPDATE SET
    color_hex = color_hex_param,
    color_name = color_name_param,
    color_tailwind = color_tailwind_param,
    color_google_calendar = color_google_param,
    updated_at = CURRENT_TIMESTAMP,
    is_active = true
  RETURNING * INTO result_record;
  
  RETURN json_build_object(
    'success', true,
    'tag_name', result_record.tag_name,
    'color', json_build_object(
      'hex', result_record.color_hex,
      'name', result_record.color_name,
      'tailwind', result_record.color_tailwind,
      'google', result_record.color_google_calendar
    ),
    'created_at', result_record.created_at,
    'updated_at', result_record.updated_at
  );
END;
$$ LANGUAGE plpgsql;

-- Function to remove tag color override (reset to algorithmic)
CREATE OR REPLACE FUNCTION remove_tag_color_override(
  tag_name_param VARCHAR,
  thread_id_param UUID
)
RETURNS JSON AS $$
BEGIN
  UPDATE channel_tag_colors 
  SET is_active = false, updated_at = CURRENT_TIMESTAMP
  WHERE thread_id = thread_id_param AND tag_name = tag_name_param;
  
  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Tag color override removed - will use algorithmic color',
      'new_color', get_tag_color(tag_name_param, thread_id_param, NULL)
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'No color override found for this tag'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert sample tag color overrides for demonstration
DO $$
DECLARE
    sample_thread_id UUID;
    sample_workspace_id UUID;
    sample_user_id VARCHAR(128);
BEGIN
    -- Find a channel and workspace for testing
    SELECT t.id, t.workspace_id INTO sample_thread_id, sample_workspace_id
    FROM threads t 
    WHERE t.type = 'channel'
    LIMIT 1;
    
    SELECT id INTO sample_user_id
    FROM users
    LIMIT 1;
    
    IF sample_thread_id IS NOT NULL AND sample_user_id IS NOT NULL THEN
        -- Insert sample tag color overrides
        INSERT INTO channel_tag_colors (
            thread_id, workspace_id, tag_name,
            color_hex, color_name, color_tailwind, color_google_calendar,
            created_by
        ) VALUES
        (
            sample_thread_id, sample_workspace_id, 'urgent',
            '#DC2626', 'red', 'bg-red-600 text-white', '11',
            sample_user_id
        ),
        (
            sample_thread_id, sample_workspace_id, 'meeting',
            '#059669', 'emerald', 'bg-emerald-600 text-white', '10', 
            sample_user_id
        ),
        (
            sample_thread_id, sample_workspace_id, 'development',
            '#2563EB', 'blue', 'bg-blue-600 text-white', '1',
            sample_user_id
        )
        ON CONFLICT (thread_id, tag_name) DO NOTHING;
        
        RAISE NOTICE 'Sample tag color overrides created successfully';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE channel_tag_colors IS 'Channel-level tag color overrides set by channel admins';
COMMENT ON TABLE workspace_tag_colors IS 'Workspace-level default tag colors (fallback for channels)';

COMMENT ON COLUMN channel_tag_colors.color_hex IS 'Hex color code for UI display (#FF5733)';
COMMENT ON COLUMN channel_tag_colors.color_name IS 'Human-readable color name (red, blue, etc.)';
COMMENT ON COLUMN channel_tag_colors.color_tailwind IS 'Tailwind CSS classes for styling';
COMMENT ON COLUMN channel_tag_colors.color_google_calendar IS 'Google Calendar color ID (1-11)';

COMMENT ON FUNCTION generate_algorithmic_tag_color(VARCHAR) IS 'Generates deterministic colors for tags based on tag name hash';
COMMENT ON FUNCTION get_tag_color(VARCHAR, UUID, UUID) IS 'Gets effective tag color: override > workspace default > algorithmic';
COMMENT ON FUNCTION set_tag_color_override IS 'Admin function to set custom tag colors for channels';
COMMENT ON FUNCTION remove_tag_color_override IS 'Admin function to remove tag color overrides';
