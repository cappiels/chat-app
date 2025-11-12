-- Emergency Migration 025: Fix UUID parameter mismatch in database functions
-- This fixes the 500 errors in calendar/timeline views caused by functions expecting integer instead of UUID

-- Fix mark_task_complete_individual function to accept UUID parameter
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
  
  -- Check if user is assignee (handle null values gracefully)
  IF NOT is_task_assignee(
    COALESCE(task_record.assignees, '[]'::jsonb), 
    COALESCE(task_record.assigned_teams, '[]'::jsonb), 
    user_id_param
  ) THEN
    RETURN json_build_object('success', false, 'error', 'User not assigned to this task');
  END IF;
  
  -- Update individual completions
  updated_completions := COALESCE(task_record.individual_completions, '{}'::jsonb) || 
    jsonb_build_object(user_id_param, completion_timestamp_param);
  
  -- Count completions
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN COALESCE(assignment_mode, 'collaborative') = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(
          COALESCE(assignees, '[]'::jsonb), 
          COALESCE(assigned_teams, '[]'::jsonb), 
          updated_completions
        )->>'total')::integer
        THEN completion_timestamp_param
        ELSE completed_at END
      ELSE completion_timestamp_param
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(
    COALESCE(assignees, '[]'::jsonb), 
    COALESCE(assigned_teams, '[]'::jsonb), 
    individual_completions
  ) 
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

-- Fix mark_task_incomplete_individual function to accept UUID parameter
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
  updated_completions := COALESCE(task_record.individual_completions, '{}'::jsonb) - user_id_param;
  new_completion_count := jsonb_object_length(updated_completions);
  
  -- Update task
  UPDATE channel_tasks 
  SET 
    individual_completions = updated_completions,
    completion_count = new_completion_count,
    completed_at = CASE 
      WHEN new_completion_count = 0 THEN NULL
      WHEN COALESCE(assignment_mode, 'collaborative') = 'individual_response' THEN
        CASE WHEN new_completion_count = (get_task_completion_progress(
          COALESCE(assignees, '[]'::jsonb), 
          COALESCE(assigned_teams, '[]'::jsonb), 
          updated_completions
        )->>'total')::integer
        THEN completed_at
        ELSE NULL END
      ELSE completed_at
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = task_id_param;
  
  -- Get updated progress info
  SELECT get_task_completion_progress(
    COALESCE(assignees, '[]'::jsonb), 
    COALESCE(assigned_teams, '[]'::jsonb), 
    individual_completions
  ) 
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

-- Ensure essential multi-assignee columns exist with safe defaults
DO $$
BEGIN
  -- Add assignees column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'assignees') THEN
    ALTER TABLE channel_tasks ADD COLUMN assignees JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- Add assigned_teams column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'assigned_teams') THEN
    ALTER TABLE channel_tasks ADD COLUMN assigned_teams JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- Add assignment_mode column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'assignment_mode') THEN
    ALTER TABLE channel_tasks ADD COLUMN assignment_mode VARCHAR(50) DEFAULT 'collaborative';
  END IF;
  
  -- Add individual_completions column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'individual_completions') THEN
    ALTER TABLE channel_tasks ADD COLUMN individual_completions JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Add completion_count column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'completion_count') THEN
    ALTER TABLE channel_tasks ADD COLUMN completion_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add requires_individual_response column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'requires_individual_response') THEN
    ALTER TABLE channel_tasks ADD COLUMN requires_individual_response BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update existing tasks to have proper defaults (safe operation)
UPDATE channel_tasks 
SET 
  assignees = CASE 
    WHEN assignees IS NULL THEN 
      CASE WHEN assigned_to IS NOT NULL THEN jsonb_build_array(assigned_to) ELSE '[]'::jsonb END
    ELSE assignees
  END,
  assigned_teams = COALESCE(assigned_teams, '[]'::jsonb),
  assignment_mode = COALESCE(assignment_mode, 'collaborative'),
  individual_completions = COALESCE(individual_completions, '{}'::jsonb),
  completion_count = COALESCE(completion_count, 0),
  requires_individual_response = COALESCE(requires_individual_response, false)
WHERE assignees IS NULL OR assigned_teams IS NULL OR assignment_mode IS NULL 
   OR individual_completions IS NULL OR completion_count IS NULL 
   OR requires_individual_response IS NULL;

-- Add missing indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_channel_tasks_assignees') THEN
    CREATE INDEX CONCURRENTLY idx_channel_tasks_assignees ON channel_tasks USING gin(assignees);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Index creation failed, continue
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_channel_tasks_assigned_teams') THEN
    CREATE INDEX CONCURRENTLY idx_channel_tasks_assigned_teams ON channel_tasks USING gin(assigned_teams);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Index creation failed, continue
  NULL;
END $$;

-- Ensure helper functions exist and are properly defined
CREATE OR REPLACE FUNCTION is_task_assignee(task_assignees jsonb, task_teams jsonb, user_id varchar)
RETURNS boolean AS $$
DECLARE
  team_record RECORD;
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  
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

CREATE OR REPLACE FUNCTION get_task_completion_progress(task_assignees jsonb, task_teams jsonb, individual_completions jsonb)
RETURNS json AS $$
DECLARE
  all_users text[] := ARRAY[]::text[];
  individual_users text[];
  team_users text[];
  team_record RECORD;
  total_assignees integer;
  completed_count integer;
  completed_assignees text[];
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  individual_completions := COALESCE(individual_completions, '{}'::jsonb);
  
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
  
  -- Remove duplicates
  SELECT array_agg(DISTINCT user_id) INTO all_users FROM unnest(all_users) as user_id;
  total_assignees := array_length(all_users, 1);
  IF total_assignees IS NULL THEN
    total_assignees := 0;
  END IF;
  
  -- Get completed assignees
  SELECT ARRAY(SELECT jsonb_object_keys(individual_completions)) INTO completed_assignees;
  completed_count := array_length(completed_assignees, 1);
  IF completed_count IS NULL THEN
    completed_count := 0;
  END IF;
  
  RETURN json_build_object(
    'total', total_assignees,
    'completed', completed_count,
    'percentage', CASE 
      WHEN total_assignees > 0 THEN ROUND((completed_count::decimal / total_assignees) * 100, 1)
      ELSE 0
    END,
    'all_assignees', all_users,
    'individual_assignees', (SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees))),
    'completed_by', completed_assignees,
    'is_fully_complete', completed_count = total_assignees AND total_assignees > 0
  );
END;
$$ LANGUAGE plpgsql;
