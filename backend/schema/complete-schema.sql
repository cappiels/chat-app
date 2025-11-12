-- Complete Database Schema for Chat App
-- This file contains the entire database structure in one place
-- No more migration headaches - dev and prod are always identical

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,  -- Firebase UID
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create workspaces table  
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invited_by VARCHAR(255) REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(workspace_id, user_id)
);

-- Create threads table (channels)
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'channel', -- channel, direct_message, group
  created_by VARCHAR(255) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_archived BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false
);

-- Create thread_members table
CREATE TABLE IF NOT EXISTS thread_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member', -- owner, admin, moderator, member
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(thread_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- text, file, image, system
  parent_message_id UUID REFERENCES messages(id),
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_pinned BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create message_reactions table  
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- mention, direct_message, channel_message, workspace_invite
  title VARCHAR(255) NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Create email_notification_preferences table
CREATE TABLE IF NOT EXISTS email_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  direct_messages BOOLEAN DEFAULT true,
  mentions BOOLEAN DEFAULT true,
  all_messages BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(20) DEFAULT 'daily', -- none, daily, weekly
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);

-- Create workspace_teams table (groups)
CREATE TABLE IF NOT EXISTS workspace_teams (
  id SERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g. "kitchen-team", "frontend-dev"
  display_name VARCHAR(100) NOT NULL, -- e.g. "Kitchen Team", "Frontend Dev"
  description TEXT,
  color VARCHAR(20) DEFAULT 'blue',
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(workspace_id, name)
);

-- Create workspace_team_members table
CREATE TABLE IF NOT EXISTS workspace_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- member, lead, admin
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  joined_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(team_id, user_id)
);

-- Create channel_tasks table (with full multi-assignee support)
CREATE TABLE IF NOT EXISTS channel_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  due_date TIMESTAMP,
  -- Legacy single assignee (for backward compatibility)
  assigned_to VARCHAR(255),
  -- New multi-assignee system
  assignees JSONB DEFAULT '[]'::jsonb,
  assigned_teams JSONB DEFAULT '[]'::jsonb,
  assignment_mode VARCHAR(50) DEFAULT 'collaborative', -- collaborative, individual_response
  individual_completions JSONB DEFAULT '{}'::jsonb, -- {"user_id": "timestamp"}
  completion_count INTEGER DEFAULT 0,
  requires_individual_response BOOLEAN DEFAULT false,
  assignee_count INTEGER GENERATED ALWAYS AS (
    jsonb_array_length(assignees) + jsonb_array_length(assigned_teams)
  ) STORED,
  -- Task properties
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  tags JSONB DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  is_all_day BOOLEAN DEFAULT false,
  start_time TIME,
  end_time TIME,
  parent_task_id UUID REFERENCES channel_tasks(id),
  dependencies JSONB DEFAULT '[]'::jsonb,
  -- Google sync fields
  google_calendar_event_id VARCHAR(255),
  google_task_id VARCHAR(255),
  sync_strategy VARCHAR(20), -- 'calendar', 'tasks', 'both', 'none'
  sync_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  sync_error TEXT,
  sync_retry_count INTEGER DEFAULT 0,
  google_calendar_etag VARCHAR(255),
  google_task_etag VARCHAR(255),
  source_key VARCHAR(255), -- For deduplication: "syncup:task_id"
  -- Enhanced fields
  location TEXT,
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  calendar_type VARCHAR(50) DEFAULT 'event',
  -- Audit fields
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_workspace_id ON threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_thread_id ON thread_members(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_user_id ON thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_teams_workspace_id ON workspace_teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_team_members_team_id ON workspace_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_workspace_team_members_user_id ON workspace_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_thread_id ON channel_tasks(thread_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_workspace_id ON channel_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assigned_to ON channel_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assignees ON channel_tasks USING gin(assignees);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_assigned_teams ON channel_tasks USING gin(assigned_teams);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_created_at ON channel_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_due_date ON channel_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_channel_tasks_status ON channel_tasks(status);

-- Create helper functions for multi-assignee tasks
CREATE OR REPLACE FUNCTION is_task_assignee(task_assignees jsonb, task_teams jsonb, user_id varchar)
RETURNS boolean AS $$
DECLARE
  team_record RECORD;
BEGIN
  -- Check direct assignment
  IF task_assignees ? user_id THEN
    RETURN true;
  END IF;
  
  -- Check team assignments
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM workspace_team_members wtm 
      WHERE wtm.team_id = team_record.team_id::integer 
      AND wtm.user_id = user_id 
      AND wtm.is_active = true
    ) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_all_task_assignees(task_assignees jsonb, task_teams jsonb)
RETURNS json AS $$
DECLARE
  all_users text[] := ARRAY[]::text[];
  individual_users text[];
  team_users text[];
  team_record RECORD;
BEGIN
  -- Get individual assignees
  SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees)) INTO individual_users;
  IF individual_users IS NOT NULL THEN
    all_users := all_users || individual_users;
  END IF;
  
  -- Get team members
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    SELECT ARRAY(
      SELECT wtm.user_id 
      FROM workspace_team_members wtm 
      WHERE wtm.team_id = team_record.team_id::integer 
      AND wtm.is_active = true
    ) INTO team_users;
    
    IF team_users IS NOT NULL THEN
      all_users := all_users || team_users;
    END IF;
  END LOOP;
  
  -- Remove duplicates and return as JSON
  SELECT array_agg(DISTINCT user_id) INTO all_users FROM unnest(all_users) as user_id;
  
  RETURN json_build_object(
    'all_assignees', all_users,
    'count', array_length(all_users, 1)
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_task_completion_progress(task_assignees jsonb, task_teams jsonb, individual_completions jsonb)
RETURNS json AS $$
DECLARE
  all_assignees_info json;
  total_assignees integer;
  completed_count integer;
  assignee_list text[];
  completed_assignees text[];
  team_info json[] := ARRAY[]::json[];
  team_record RECORD;
BEGIN
  -- Get all assignees (individuals + team members)
  all_assignees_info := get_all_task_assignees(task_assignees, task_teams);
  assignee_list := (all_assignees_info->>'all_assignees')::text[];
  total_assignees := (all_assignees_info->>'count')::integer;
  
  IF total_assignees IS NULL THEN
    total_assignees := 0;
  END IF;
  
  -- Get completed assignees
  SELECT ARRAY(SELECT jsonb_object_keys(individual_completions)) INTO completed_assignees;
  completed_count := array_length(completed_assignees, 1);
  IF completed_count IS NULL THEN
    completed_count := 0;
  END IF;
  
  -- Get team information
  FOR team_record IN 
    SELECT jsonb_array_elements_text(task_teams) as team_id
  LOOP
    SELECT array_append(team_info, json_build_object(
      'id', wt.id,
      'name', wt.name,
      'display_name', wt.display_name,
      'color', wt.color,
      'member_count', (
        SELECT count(*) 
        FROM workspace_team_members wtm 
        WHERE wtm.team_id = wt.id AND wtm.is_active = true
      )
    )) INTO team_info
    FROM workspace_teams wt
    WHERE wt.id = team_record.team_id::integer;
  END LOOP;
  
  RETURN json_build_object(
    'total', total_assignees,
    'completed', completed_count,
    'percentage', CASE 
      WHEN total_assignees > 0 THEN ROUND((completed_count::decimal / total_assignees) * 100, 1)
      ELSE 0
    END,
    'all_assignees', assignee_list,
    'individual_assignees', (SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees))),
    'teams', team_info,
    'completed_by', completed_assignees,
    'is_fully_complete', completed_count = total_assignees AND total_assignees > 0
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_user_edit_task(task_assignees jsonb, task_teams jsonb, task_created_by varchar, current_user_id varchar)
RETURNS boolean AS $$
BEGIN
  RETURN (
    task_created_by = current_user_id OR 
    is_task_assignee(task_assignees, task_teams, current_user_id)
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_task_complete_individual(
  task_id_param uuid,
  user_id_param varchar,
  completion_timestamp_param timestamp DEFAULT CURRENT_TIMESTAMP
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Check if user is assignee
  IF NOT is_task_assignee(task_record.assignees, task_record.assigned_teams, user_id_param) THEN
    RETURN json_build_object('success', false, 'error', 'User not assigned to this task');
  END IF;
  
  -- Update individual completions
  updated_completions := task_record.individual_completions || 
    jsonb_build_object(user_id_param, completion_timestamp_param);
  
  -- Count completions
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN assignment_mode = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(assignees, assigned_teams, updated_completions)->>'total')::integer
        THEN completion_timestamp_param
        ELSE completed_at END
      ELSE completion_timestamp_param
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(assignees, assigned_teams, individual_completions) 
  INTO progress_result
  FROM channel_tasks 
  WHERE id = task_id_param;
  
  RETURN json_build_object(
    'success', true,
    'progress', progress_result,
    'completed_by_user', user_id_param,
    'timestamp', completion_timestamp_param
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_task_incomplete_individual(
  task_id_param uuid,
  user_id_param varchar
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks WHERE id = task_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Remove user from completions
  updated_completions := task_record.individual_completions - user_id_param;
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN new_completion_count = 0 THEN NULL
      WHEN assignment_mode = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(assignees, assigned_teams, updated_completions)->>'total')::integer
        THEN completed_at
        ELSE NULL END
      ELSE completed_at
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(assignees, assigned_teams, individual_completions) 
  INTO progress_result
  FROM channel_tasks 
  WHERE id = task_id_param;
  
  RETURN json_build_object(
    'success', true,
    'progress', progress_result,
    'uncompleted_by_user', user_id_param
  );
END;
$$ LANGUAGE plpgsql;

-- Create enhanced view with multi-assignee support
CREATE OR REPLACE VIEW channel_tasks_with_progress AS
SELECT 
  ct.*,
  get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions) as progress_info,
  CASE 
    WHEN ct.assignment_mode = 'individual_response' THEN 
      (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'is_fully_complete')::boolean
    ELSE 
      ct.completed_at IS NOT NULL
  END as is_complete,
  (get_task_completion_progress(ct.assignees, ct.assigned_teams, ct.individual_completions)->>'total')::integer as total_assignees,
  jsonb_array_length(ct.assignees) as individual_assignee_count,
  jsonb_array_length(ct.assigned_teams) as team_count
FROM channel_tasks ct;

-- Create user task assignments view
CREATE OR REPLACE VIEW user_task_assignments AS
SELECT DISTINCT
  ct.id as task_id,
  ct.title,
  ct.thread_id,
  u.id as user_id,
  'individual' as assignment_type,
  NULL as team_id,
  NULL as team_name,
  ct.assignment_mode,
  ct.requires_individual_response,
  CASE 
    WHEN ct.individual_completions ? u.id THEN true
    ELSE false
  END as user_completed,
  ct.progress_info,
  ct.is_complete
FROM channel_tasks_with_progress ct
CROSS JOIN LATERAL jsonb_array_elements_text(ct.assignees) as u(id)

UNION ALL

SELECT DISTINCT
  ct.id as task_id,
  ct.title,
  ct.thread_id,
  wtm.user_id,
  'team' as assignment_type,
  wt.id as team_id,
  wt.display_name as team_name,
  ct.assignment_mode,
  ct.requires_individual_response,
  CASE 
    WHEN ct.individual_completions ? wtm.user_id THEN true
    ELSE false
  END as user_completed,
  ct.progress_info,
  ct.is_complete
FROM channel_tasks_with_progress ct
CROSS JOIN LATERAL jsonb_array_elements_text(ct.assigned_teams) as t(id)
JOIN workspace_teams wt ON wt.id = t.id::integer
JOIN workspace_team_members wtm ON wtm.team_id = wt.id AND wtm.is_active = true;

-- Add constraints (use DO block for safe constraint addition)
DO $$ 
BEGIN
  -- Add team name format constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_team_name_format'
  ) THEN
    ALTER TABLE workspace_teams ADD CONSTRAINT check_team_name_format CHECK (name ~ '^[a-z0-9-]+$');
  END IF;
  
  -- Add team color constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_team_color_valid'
  ) THEN
    ALTER TABLE workspace_teams ADD CONSTRAINT check_team_color_valid CHECK (color IN ('blue', 'green', 'purple', 'orange', 'pink', 'teal', 'indigo', 'red', 'yellow', 'cyan', 'rose', 'violet'));
  END IF;
  
  -- Add member role constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_member_role_valid'
  ) THEN
    ALTER TABLE workspace_team_members ADD CONSTRAINT check_member_role_valid CHECK (role IN ('member', 'lead', 'admin'));
  END IF;
  
  -- Add assignment mode constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_assignment_mode_valid'
  ) THEN
    ALTER TABLE channel_tasks ADD CONSTRAINT check_assignment_mode_valid CHECK (assignment_mode IN ('collaborative', 'individual_response'));
  END IF;
  
  -- Add completion count constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_completion_count_valid'
  ) THEN
    ALTER TABLE channel_tasks ADD CONSTRAINT check_completion_count_valid CHECK (completion_count >= 0);
  END IF;
END $$;

-- Insert sample data if tables are empty
INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'kitchen-team',
  'Kitchen Team',
  'Culinary and food service team members',
  'orange',
  'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'kitchen-team')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'frontend-dev',
  'Frontend Developers',
  'Frontend development team',
  'blue',
  'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'frontend-dev')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'backend-dev',
  'Backend Developers',
  'Backend development team',
  'green',
  'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'backend-dev')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'design-team',
  'Design Team',
  'UI/UX designers and design system maintainers',
  'purple',
  'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'design-team')
AND EXISTS (SELECT 1 FROM workspaces);

INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by)
SELECT 
  (SELECT id FROM workspaces ORDER BY created_at LIMIT 1),
  'marketing',
  'Marketing Team',
  'Marketing, content, and outreach team',
  'pink',
  'system'
WHERE NOT EXISTS (SELECT 1 FROM workspace_teams WHERE name = 'marketing')
AND EXISTS (SELECT 1 FROM workspaces);
