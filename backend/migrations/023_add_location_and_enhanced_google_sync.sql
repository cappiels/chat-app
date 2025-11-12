-- Migration 023: Add Location Field + Enhanced Google Sync Infrastructure
-- Based on expert developer feedback for Google Calendar & Tasks sync system

-- Add location field to channel_tasks table
ALTER TABLE channel_tasks 
ADD COLUMN location TEXT,
ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN google_task_id VARCHAR(255),
ADD COLUMN sync_strategy VARCHAR(20) DEFAULT 'smart',
ADD COLUMN sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_error TEXT,
ADD COLUMN sync_retry_count INTEGER DEFAULT 0,
ADD COLUMN google_calendar_etag VARCHAR(255),
ADD COLUMN google_task_etag VARCHAR(255),
ADD COLUMN source_key VARCHAR(255) UNIQUE; -- De-duplication key

-- Add indexes for Google sync performance
CREATE INDEX IF NOT EXISTS idx_channel_tasks_location ON channel_tasks(location);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_google_task_id ON channel_tasks(google_task_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_sync_strategy ON channel_tasks(sync_strategy);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_last_synced ON channel_tasks(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_source_key ON channel_tasks(source_key);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_tags ON channel_tasks USING gin(tags);

-- Add constraints for data integrity
ALTER TABLE channel_tasks
ADD CONSTRAINT check_sync_strategy_valid CHECK (
  sync_strategy IN ('smart', 'calendar', 'tasks', 'both', 'none')
),
ADD CONSTRAINT check_sync_retry_count_valid CHECK (sync_retry_count >= 0 AND sync_retry_count <= 10);

-- Workspace-level Google sync configuration table
CREATE TABLE IF NOT EXISTS workspace_google_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Google Calendar configuration
  google_calendar_enabled BOOLEAN DEFAULT false,
  primary_calendar_id VARCHAR(255) DEFAULT 'primary',
  secondary_calendar_id VARCHAR(255), -- Per-workspace calendar to avoid spam
  calendar_color_id VARCHAR(10) DEFAULT '1',
  
  -- Google Tasks configuration  
  google_tasks_enabled BOOLEAN DEFAULT false,
  primary_task_list_id VARCHAR(255) DEFAULT '@default',
  secondary_task_list_id VARCHAR(255), -- Per-workspace task list
  
  -- Sync settings
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 15,
  batch_sync_enabled BOOLEAN DEFAULT true,
  
  -- Advanced settings based on expert feedback
  prevent_email_notifications BOOLEAN DEFAULT true, -- No accidental attendee emails
  use_end_exclusive_dates BOOLEAN DEFAULT true,     -- Proper all-day event handling
  smart_strategy_enabled BOOLEAN DEFAULT true,      -- Auto-determine Calendar vs Tasks
  
  -- Operational data
  last_full_sync_at TIMESTAMP WITH TIME ZONE,
  sync_token VARCHAR(255), -- For incremental Calendar sync
  tasks_updated_min TIMESTAMP WITH TIME ZONE, -- For incremental Tasks sync
  
  -- Error tracking
  sync_errors JSONB DEFAULT '[]',
  error_count INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(workspace_id)
);

-- User-level Google sync preferences table
CREATE TABLE IF NOT EXISTS user_google_sync_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Google OAuth tokens (encrypted in production)
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expires_at TIMESTAMP WITH TIME ZONE,
  google_scope TEXT DEFAULT 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
  
  -- User preferences
  calendar_sync_enabled BOOLEAN DEFAULT true,
  tasks_sync_enabled BOOLEAN DEFAULT true,
  preferred_calendar_id VARCHAR(255) DEFAULT 'primary',
  preferred_task_list_id VARCHAR(255) DEFAULT '@default',
  
  -- Advanced user settings
  conflict_resolution_strategy VARCHAR(50) DEFAULT 'last_modified_wins',
  sync_personal_tasks BOOLEAN DEFAULT false,
  notification_preferences JSONB DEFAULT '{"sync_errors": true, "sync_success": false}',
  
  -- Location & Tags preferences
  sync_location_enabled BOOLEAN DEFAULT true,
  sync_tags_enabled BOOLEAN DEFAULT true,
  tag_to_color_mapping JSONB DEFAULT '{}', -- {"urgent": "11", "development": "1"}
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_authenticated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT check_conflict_resolution_valid CHECK (
    conflict_resolution_strategy IN ('last_modified_wins', 'our_system_wins', 'google_wins', 'manual')
  )
);

-- Google sync operations logging table (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS google_sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES channel_tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Operation details
  operation_type VARCHAR(50) NOT NULL,
  google_service VARCHAR(20) NOT NULL,
  google_id VARCHAR(255),
  sync_direction VARCHAR(20) NOT NULL, -- 'to_google', 'from_google', 'bidirectional'
  
  -- Request/Response data
  request_payload JSONB,
  response_payload JSONB,
  
  -- Execution details
  operation_status VARCHAR(20) NOT NULL,
  error_message TEXT,
  error_code VARCHAR(50),
  execution_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  api_quota_used INTEGER DEFAULT 1,
  rate_limit_hit BOOLEAN DEFAULT false,
  conflict_detected BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT check_operation_type_valid CHECK (
    operation_type IN ('create', 'update', 'delete', 'sync_from_google', 'conflict_resolution', 'batch_sync')
  ),
  CONSTRAINT check_google_service_valid CHECK (
    google_service IN ('calendar', 'tasks')
  ),
  CONSTRAINT check_sync_direction_valid CHECK (
    sync_direction IN ('to_google', 'from_google', 'bidirectional')
  ),
  CONSTRAINT check_operation_status_valid CHECK (
    operation_status IN ('success', 'failed', 'retry', 'skipped', 'conflict')
  )
);

-- Create indexes for sync operations table
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_task_id ON google_sync_operations(task_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_user_id ON google_sync_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_workspace_id ON google_sync_operations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_status ON google_sync_operations(operation_status);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_created_at ON google_sync_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_google_service ON google_sync_operations(google_service);
CREATE INDEX IF NOT EXISTS idx_google_sync_ops_operation_type ON google_sync_operations(operation_type);

-- Create indexes for sync config and preferences
CREATE INDEX IF NOT EXISTS idx_workspace_google_sync_config_workspace_id ON workspace_google_sync_config(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_google_sync_preferences_user_id ON user_google_sync_preferences(user_id);

-- Enhanced view with location and Google sync data
CREATE OR REPLACE VIEW channel_tasks_with_sync_info AS
SELECT 
  ct.*,
  
  -- Progress information (from existing function)
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

-- Function to generate unique source key for de-duplication
CREATE OR REPLACE FUNCTION generate_task_source_key(
  workspace_id_param UUID,
  thread_id_param UUID, 
  task_id_param UUID
)
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'syncup-' || workspace_id_param::text || '-' || thread_id_param::text || '-' || task_id_param::text;
END;
$$ LANGUAGE plpgsql;

-- Function to determine Google sync strategy based on task attributes
CREATE OR REPLACE FUNCTION determine_google_sync_strategy(
  task_start_date TIMESTAMP WITH TIME ZONE,
  task_end_date TIMESTAMP WITH TIME ZONE,
  task_due_date TIMESTAMP WITH TIME ZONE,
  task_start_time TIME,
  task_end_time TIME,
  task_is_all_day BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  has_time_span BOOLEAN;
  has_specific_times BOOLEAN;
  has_due_date BOOLEAN;
  is_multi_day BOOLEAN;
  strategy_result JSON;
BEGIN
  -- Determine task characteristics
  has_time_span := task_start_date IS NOT NULL AND task_end_date IS NOT NULL;
  has_specific_times := task_start_time IS NOT NULL AND task_end_time IS NOT NULL;
  has_due_date := task_due_date IS NOT NULL;
  is_multi_day := has_time_span AND (task_start_date::date != task_end_date::date);
  
  -- Apply expert-reviewed strategy algorithm
  IF has_specific_times THEN
    -- Priority 1: Timed events → Calendar only
    strategy_result := json_build_object(
      'calendar', true,
      'tasks', false,
      'reason', 'Timed event with specific start/end times',
      'confidence', 'high'
    );
  ELSIF is_multi_day AND NOT has_due_date THEN
    -- Priority 2: Multi-day without due date → Calendar only
    strategy_result := json_build_object(
      'calendar', true,
      'tasks', false,
      'reason', 'Multi-day event without specific deliverable',
      'confidence', 'high'
    );
  ELSIF has_due_date AND NOT has_time_span THEN
    -- Priority 3: Due date without time span → Tasks only
    strategy_result := json_build_object(
      'calendar', false,
      'tasks', true,
      'reason', 'Deadline-focused task without time blocking',
      'confidence', 'high'
    );
  ELSIF NOT has_time_span AND NOT has_specific_times AND NOT has_due_date THEN
    -- Priority 4: No scheduling → Tasks only
    strategy_result := json_build_object(
      'calendar', false,
      'tasks', true,
      'reason', 'Unscheduled actionable item',
      'confidence', 'medium'
    );
  ELSIF has_time_span AND has_due_date THEN
    -- Priority 5: Time span + Due date → Both services
    strategy_result := json_build_object(
      'calendar', true,
      'tasks', true,
      'reason', 'Project with both time allocation and completion requirement',
      'confidence', 'high'
    );
  ELSIF has_time_span THEN
    -- Default: Time span without due date → Calendar
    strategy_result := json_build_object(
      'calendar', true,
      'tasks', false,
      'reason', 'Scheduled event without completion requirement',
      'confidence', 'medium'
    );
  ELSE
    -- Fallback → Tasks
    strategy_result := json_build_object(
      'calendar', false,
      'tasks', true,
      'reason', 'Default to tasks for unclassified items',
      'confidence', 'low'
    );
  END IF;
  
  RETURN strategy_result;
END;
$$ LANGUAGE plpgsql;

-- Function to map tags to Google Calendar color IDs
CREATE OR REPLACE FUNCTION map_tags_to_color_id(task_tags JSONB, task_priority VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  tag_text TEXT;
  color_mapping JSONB;
BEGIN
  -- Default color mapping based on priority and common tags
  color_mapping := '{
    "urgent": "11",
    "high": "6", 
    "critical": "11",
    "bug": "11",
    "development": "1",
    "frontend": "1",
    "backend": "2",
    "design": "9",
    "marketing": "5",
    "meeting": "10",
    "review": "3",
    "testing": "7",
    "deployment": "4"
  }'::jsonb;
  
  -- Check tags for color matches (first match wins)
  IF task_tags IS NOT NULL THEN
    FOR tag_text IN SELECT jsonb_array_elements_text(task_tags) LOOP
      IF color_mapping ? lower(tag_text) THEN
        RETURN color_mapping->>lower(tag_text);
      END IF;
    END LOOP;
  END IF;
  
  -- Fallback to priority-based colors
  RETURN CASE lower(task_priority)
    WHEN 'urgent' THEN '11'  -- Red
    WHEN 'high' THEN '6'     -- Orange  
    WHEN 'medium' THEN '1'   -- Blue
    WHEN 'low' THEN '2'      -- Green
    ELSE '1'                 -- Default blue
  END;
END;
$$ LANGUAGE plpgsql;

-- Update existing tasks with source keys and enhanced sync data
UPDATE channel_tasks 
SET 
  source_key = generate_task_source_key(workspace_id, thread_id, id),
  sync_strategy = 'smart',
  timezone = COALESCE(timezone, 'UTC')
WHERE source_key IS NULL;

-- Insert default workspace sync configurations
INSERT INTO workspace_google_sync_config (workspace_id, google_calendar_enabled, google_tasks_enabled)
SELECT DISTINCT workspace_id, false, false
FROM channel_tasks
WHERE workspace_id NOT IN (SELECT workspace_id FROM workspace_google_sync_config);

-- Add comments for documentation
COMMENT ON TABLE workspace_google_sync_config IS 'Per-workspace Google Calendar and Tasks sync configuration';
COMMENT ON TABLE user_google_sync_preferences IS 'Per-user Google sync preferences and OAuth tokens';
COMMENT ON TABLE google_sync_operations IS 'Audit log of all Google sync operations for debugging and monitoring';

COMMENT ON COLUMN channel_tasks.location IS 'Geographic location or meeting place for the task/event';
COMMENT ON COLUMN channel_tasks.timezone IS 'Timezone for the task (IANA format like Europe/London)';
COMMENT ON COLUMN channel_tasks.source_key IS 'Unique identifier for de-duplication across sync operations';
COMMENT ON COLUMN channel_tasks.sync_strategy IS 'Determined sync strategy: smart, calendar, tasks, both, none';
COMMENT ON COLUMN channel_tasks.google_task_id IS 'Google Tasks ID for bidirectional sync';
COMMENT ON COLUMN channel_tasks.google_calendar_etag IS 'Google Calendar ETag for conflict detection';
COMMENT ON COLUMN channel_tasks.google_task_etag IS 'Google Tasks ETag for conflict detection';

-- Create sample tasks with location and enhanced tags for testing
DO $$
DECLARE
    general_thread_id UUID;
    sample_user_id VARCHAR(128);
    sample_workspace_id UUID;
BEGIN
    -- Find a channel and user for testing
    SELECT t.id, t.workspace_id INTO general_thread_id, sample_workspace_id
    FROM threads t 
    WHERE t.type = 'channel'
    LIMIT 1;
    
    SELECT id INTO sample_user_id
    FROM users
    LIMIT 1;
    
    IF general_thread_id IS NOT NULL AND sample_user_id IS NOT NULL THEN
        -- Insert enhanced sample tasks with location and tags
        INSERT INTO channel_tasks (
            thread_id, workspace_id, title, description, 
            start_date, end_date, location, assigned_to, 
            status, priority, created_by, tags, timezone,
            sync_strategy, source_key
        ) VALUES
        (
            general_thread_id,
            sample_workspace_id,
            'Team Standup Meeting',
            'Daily standup meeting to discuss progress and blockers',
            CURRENT_DATE + INTERVAL '1 day' + TIME '09:00:00',
            CURRENT_DATE + INTERVAL '1 day' + TIME '09:30:00',
            'Conference Room A, 2nd Floor',
            sample_user_id,
            'pending',
            'medium',
            sample_user_id,
            '["meeting", "standup", "daily", "team"]',
            'America/New_York',
            'calendar',
            generate_task_source_key(sample_workspace_id, general_thread_id, gen_random_uuid())
        ),
        (
            general_thread_id,
            sample_workspace_id,
            'Client Presentation Prep',
            'Prepare slides and demo for upcoming client presentation',
            CURRENT_DATE + INTERVAL '2 days',
            CURRENT_DATE + INTERVAL '4 days',
            'Home Office',
            sample_user_id,
            'pending',
            'high',
            sample_user_id,
            '["presentation", "client", "urgent", "sales"]',
            'America/New_York',
            'both',
            generate_task_source_key(sample_workspace_id, general_thread_id, gen_random_uuid())
        ),
        (
            general_thread_id,
            sample_workspace_id,
            'Bug Fix: Calendar Sync',
            'Fix the calendar sync issue reported by users',
            NULL,
            NULL,
            NULL,
            sample_user_id,
            'in_progress',
            'urgent',
            sample_user_id,
            '["bug", "development", "calendar", "urgent", "backend"]',
            'UTC',
            'tasks',
            generate_task_source_key(sample_workspace_id, general_thread_id, gen_random_uuid())
        );
        
        RAISE NOTICE 'Enhanced sample tasks with location and tags created successfully';
    END IF;
END $$;
