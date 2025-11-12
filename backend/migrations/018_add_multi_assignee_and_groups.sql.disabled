-- Migration 018: Add Multi-Assignee Support AND Team Groups
-- Revolutionary features:
-- 1. Multi-assignee tasks with collaborative/individual modes
-- 2. Team/Group system with @mention support
-- 3. Combined assignment to individuals AND groups
-- 4. Individual progress tracking per person

-- Create teams/groups table
CREATE TABLE workspace_teams (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g. "kitchen-team", "frontend-dev", "marketing"
  display_name VARCHAR(100) NOT NULL, -- e.g. "Kitchen Team", "Frontend Dev", "Marketing"
  description TEXT,
  color VARCHAR(20) DEFAULT 'blue', -- Channel color for team
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(workspace_id, name)
);

-- Create team memberships table
CREATE TABLE workspace_team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- 'member', 'lead', 'admin'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  joined_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(team_id, user_id)
);

-- Add multi-assignee columns to channel_tasks table
ALTER TABLE channel_tasks 
ADD COLUMN assignees JSONB DEFAULT '[]'::jsonb,
ADD COLUMN assigned_teams JSONB DEFAULT '[]'::jsonb,
ADD COLUMN assignment_mode VARCHAR(50) DEFAULT 'collaborative',
ADD COLUMN individual_completions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN completion_count INTEGER DEFAULT 0,
ADD COLUMN requires_individual_response BOOLEAN DEFAULT false,
ADD COLUMN assignee_count INTEGER GENERATED ALWAYS AS (
  jsonb_array_length(assignees) + 
  jsonb_array_length(assigned_teams)
) STORED;

-- Create indexes for performance
CREATE INDEX idx_channel_tasks_assignees ON channel_tasks USING gin(assignees);
CREATE INDEX idx_channel_tasks_assigned_teams ON channel_tasks USING gin(assigned_teams);
CREATE INDEX idx_channel_tasks_assignment_mode ON channel_tasks(assignment_mode);
CREATE INDEX idx_channel_tasks_individual_completions ON channel_tasks USING gin(individual_completions);
CREATE INDEX idx_channel_tasks_completion_progress ON channel_tasks(completion_count, assignee_count);
CREATE INDEX idx_workspace_teams_workspace_id ON workspace_teams(workspace_id);
CREATE INDEX idx_workspace_teams_name ON workspace_teams(workspace_id, name);
CREATE INDEX idx_workspace_team_members_team_id ON workspace_team_members(team_id);
CREATE INDEX idx_workspace_team_members_user_id ON workspace_team_members(user_id);

-- Update existing tasks to use new multi-assignee system
UPDATE channel_tasks 
SET assignees = CASE 
  WHEN assigned_to IS NOT NULL 
  THEN jsonb_build_array(assigned_to)
  ELSE '[]'::jsonb
END,
completion_count = CASE 
  WHEN completed_at IS NOT NULL THEN 1
  ELSE 0
END
WHERE assignees IS NULL;

-- Create helper functions

-- Function to check if user is assignee (individual or through team)
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

-- Function to get all assignee user IDs (individuals + team members)
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

-- Enhanced completion progress function with team support
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
    SELECT json_build_object(
      'id', wt.id,
      'name', wt.name,
      'display_name', wt.display_name,
      'color', wt.color,
      'member_count', (
        SELECT count(*) 
        FROM workspace_team_members wtm 
        WHERE wtm.team_id = wt.id AND wtm.is_active = true
      )
    ) INTO team_info[array_length(team_info, 1) + 1]
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

-- Function to check if user can edit task (with team support)
CREATE OR REPLACE FUNCTION can_user_edit_task(task_assignees jsonb, task_teams jsonb, task_created_by varchar, current_user_id varchar)
RETURNS boolean AS $$
BEGIN
  -- User can edit if:
  -- 1. They created the task
  -- 2. They are directly assigned to the task
  -- 3. They are a member of an assigned team
  -- 4. They have admin permissions (to be checked at application level)
  
  RETURN (
    task_created_by = current_user_id OR 
    is_task_assignee(task_assignees, task_teams, current_user_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced view with team support
CREATE VIEW channel_tasks_with_progress AS
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

-- Create sample teams for testing
INSERT INTO workspace_teams (workspace_id, name, display_name, description, color, created_by) VALUES
(
  (SELECT id FROM workspaces LIMIT 1),
  'kitchen-team',
  'Kitchen Team',
  'Culinary and food service team members',
  'orange',
  'system'
),
(
  (SELECT id FROM workspaces LIMIT 1),
  'frontend-dev',
  'Frontend Developers',
  'Frontend development team',
  'blue',
  'system'
),
(
  (SELECT id FROM workspaces LIMIT 1),
  'backend-dev',
  'Backend Developers', 
  'Backend development team',
  'green',
  'system'
),
(
  (SELECT id FROM workspaces LIMIT 1),
  'design-team',
  'Design Team',
  'UI/UX designers and design system maintainers',
  'purple',
  'system'
),
(
  (SELECT id FROM workspaces LIMIT 1),
  'marketing',
  'Marketing Team',
  'Marketing, content, and outreach team',
  'pink',
  'system'
);

-- Add sample team memberships (using placeholder user IDs)
INSERT INTO workspace_team_members (team_id, user_id, role, joined_by) VALUES
-- Kitchen Team
((SELECT id FROM workspace_teams WHERE name = 'kitchen-team'), 'chef1', 'lead', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'kitchen-team'), 'cook1', 'member', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'kitchen-team'), 'cook2', 'member', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'kitchen-team'), 'server1', 'member', 'system'),

-- Frontend Dev Team
((SELECT id FROM workspace_teams WHERE name = 'frontend-dev'), 'dev1', 'lead', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'frontend-dev'), 'dev2', 'member', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'frontend-dev'), 'dev3', 'member', 'system'),

-- Backend Dev Team  
((SELECT id FROM workspace_teams WHERE name = 'backend-dev'), 'dev4', 'lead', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'backend-dev'), 'dev5', 'member', 'system'),

-- Design Team
((SELECT id FROM workspace_teams WHERE name = 'design-team'), 'designer1', 'lead', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'design-team'), 'designer2', 'member', 'system'),

-- Marketing Team
((SELECT id FROM workspace_teams WHERE name = 'marketing'), 'marketer1', 'lead', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'marketing'), 'marketer2', 'member', 'system'),
((SELECT id FROM workspace_teams WHERE name = 'marketing'), 'marketer3', 'member', 'system');

-- Add sample multi-assignee and team-assigned tasks
INSERT INTO channel_tasks (
  thread_id, 
  title, 
  description, 
  assignees, 
  assigned_teams,
  assignment_mode, 
  requires_individual_response,
  status, 
  priority, 
  created_by,
  start_date,
  end_date
) VALUES 
-- Individual multi-assignee task with individual responses required
(
  (SELECT id FROM threads WHERE name = 'general' LIMIT 1),
  'Code Review: Authentication System',
  'Each developer must review and approve the new authentication system individually.',
  '["dev1", "dev2", "dev3"]'::jsonb,
  '[]'::jsonb,
  'individual_response',
  true,
  'in_progress',
  'high',
  'system',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '3 days'
),
-- Team assignment with collaborative mode
(
  (SELECT id FROM threads WHERE name = 'general' LIMIT 1),
  '@frontend-dev: New Component Library',
  'Frontend team to build the new component library. Any team member can mark complete.',
  '[]'::jsonb,
  (SELECT jsonb_build_array(id::text) FROM workspace_teams WHERE name = 'frontend-dev'),
  'collaborative',
  false,
  'pending',
  'medium',
  'system',
  CURRENT_DATE + INTERVAL '1 day',
  CURRENT_DATE + INTERVAL '5 days'
),
-- Mixed assignment: individuals + team with individual responses
(
  (SELECT id FROM threads WHERE name = 'general' LIMIT 1),
  'Menu Planning: @kitchen-team + Individual Contributors',
  'Kitchen team and individual contributors must each approve the new menu.',
  '["manager1", "nutritionist1"]'::jsonb,
  (SELECT jsonb_build_array(id::text) FROM workspace_teams WHERE name = 'kitchen-team'),
  'individual_response',
  true,
  'pending',
  'high',
  'system',
  CURRENT_DATE + INTERVAL '2 days',
  CURRENT_DATE + INTERVAL '1 week'
),
-- Team collaboration task
(
  (SELECT id FROM threads WHERE name = 'general' LIMIT 1),
  '@design-team: Brand Guidelines Update',
  'Design team to update brand guidelines. Collaborative effort.',
  '[]'::jsonb,
  (SELECT jsonb_build_array(id::text) FROM workspace_teams WHERE name = 'design-team'),
  'collaborative',
  false,
  'in_progress',
  'medium',
  'system',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '4 days'
);

-- Simulate some individual completions for demo
UPDATE channel_tasks 
SET 
  individual_completions = '{"dev1": "2024-11-08T10:00:00Z", "dev2": "2024-11-08T11:30:00Z"}'::jsonb,
  completion_count = 2
WHERE title LIKE 'Code Review: Authentication System%';

-- Add team completion for mixed assignment task
UPDATE channel_tasks 
SET 
  individual_completions = '{"chef1": "2024-11-08T09:00:00Z", "cook1": "2024-11-08T09:30:00Z", "manager1": "2024-11-08T10:15:00Z"}'::jsonb,
  completion_count = 3
WHERE title LIKE 'Menu Planning:%';

-- Create view for easy querying of user assignments
CREATE VIEW user_task_assignments AS
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

-- Function to mention-expand teams (for @ mentions in chat)
CREATE OR REPLACE FUNCTION expand_team_mentions(text_content text, workspace_id_param integer)
RETURNS json AS $$
DECLARE
  team_record RECORD;
  mentioned_teams json[] := ARRAY[]::json[];
  mentioned_users text[] := ARRAY[]::text[];
BEGIN
  -- Find all @team mentions in the text
  FOR team_record IN 
    SELECT wt.*, 
           array_agg(wtm.user_id) as member_ids
    FROM workspace_teams wt
    JOIN workspace_team_members wtm ON wtm.team_id = wt.id AND wtm.is_active = true
    WHERE wt.workspace_id = workspace_id_param 
    AND wt.is_active = true
    AND text_content ~* ('@' || wt.name || '\b')
    GROUP BY wt.id
  LOOP
    -- Add team info
    mentioned_teams := mentioned_teams || json_build_object(
      'team_id', team_record.id,
      'team_name', team_record.name,
      'display_name', team_record.display_name,
      'color', team_record.color,
      'member_count', array_length(team_record.member_ids, 1),
      'members', team_record.member_ids
    );
    
    -- Add all team members to mentioned users list
    mentioned_users := mentioned_users || team_record.member_ids;
  END LOOP;
  
  -- Remove duplicate users
  SELECT array_agg(DISTINCT user_id) INTO mentioned_users FROM unnest(mentioned_users) as user_id;
  
  RETURN json_build_object(
    'mentioned_teams', mentioned_teams,
    'all_mentioned_users', mentioned_users,
    'total_mentioned_users', array_length(mentioned_users, 1)
  );
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE workspace_teams IS 'Teams/groups that can be assigned tasks and mentioned in chat';
COMMENT ON TABLE workspace_team_members IS 'Membership relationships between users and teams';
COMMENT ON COLUMN channel_tasks.assignees IS 'Array of individual user IDs assigned to this task';
COMMENT ON COLUMN channel_tasks.assigned_teams IS 'Array of team IDs assigned to this task';
COMMENT ON COLUMN channel_tasks.assignment_mode IS 'collaborative: any assignee can complete | individual_response: each assignee must complete separately';
COMMENT ON COLUMN channel_tasks.individual_completions IS 'Object tracking individual completion status: {"user_id": "completion_timestamp"}';
COMMENT ON COLUMN channel_tasks.completion_count IS 'Number of assignees who have marked this task complete';
COMMENT ON COLUMN channel_tasks.requires_individual_response IS 'True if task requires individual responses from each assignee';
COMMENT ON COLUMN channel_tasks.assignee_count IS 'Total count of all assignees (individuals + team members)';

-- Create function to handle individual task completion
CREATE OR REPLACE FUNCTION mark_task_complete_individual(
  task_id_param integer,
  user_id_param varchar,
  completion_timestamp_param timestamp DEFAULT CURRENT_TIMESTAMP
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks_with_progress%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks_with_progress WHERE id = task_id_param;
  
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
      -- For individual_response mode, mark complete when all assignees done
      WHEN assignment_mode = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(assignees, assigned_teams, updated_completions)->>'total')::integer
        THEN completion_timestamp_param
        ELSE completed_at END
      -- For collaborative mode, mark complete immediately  
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

-- Create function to handle individual task un-completion
CREATE OR REPLACE FUNCTION mark_task_incomplete_individual(
  task_id_param integer,
  user_id_param varchar
)
RETURNS json AS $$
DECLARE
  task_record channel_tasks_with_progress%ROWTYPE;
  updated_completions jsonb;
  new_completion_count integer;
  progress_result json;
BEGIN
  -- Get current task
  SELECT * INTO task_record FROM channel_tasks_with_progress WHERE id = task_id_param;
  
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

-- Add constraints for data integrity
ALTER TABLE workspace_teams 
ADD CONSTRAINT check_team_name_format CHECK (name ~ '^[a-z0-9-]+$'),
ADD CONSTRAINT check_team_color_valid CHECK (color IN ('blue', 'green', 'purple', 'orange', 'pink', 'teal', 'indigo', 'red', 'yellow', 'cyan', 'rose', 'violet'));

ALTER TABLE workspace_team_members
ADD CONSTRAINT check_member_role_valid CHECK (role IN ('member', 'lead', 'admin'));

ALTER TABLE channel_tasks
ADD CONSTRAINT check_assignment_mode_valid CHECK (assignment_mode IN ('collaborative', 'individual_response')),
ADD CONSTRAINT check_completion_count_valid CHECK (completion_count >= 0);
