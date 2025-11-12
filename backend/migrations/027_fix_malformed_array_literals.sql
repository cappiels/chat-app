-- Migration 027: Fix malformed array literals in get_task_completion_progress function
-- This addresses the PostgreSQL error: malformed array literal

-- Drop and recreate get_task_completion_progress function with robust JSON handling
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
  assignees_safe jsonb;
  teams_safe jsonb;
  completions_safe jsonb;
BEGIN
  -- Handle null inputs gracefully and ensure proper JSONB format
  assignees_safe := COALESCE(task_assignees, '[]'::jsonb);
  teams_safe := COALESCE(task_teams, '[]'::jsonb);
  completions_safe := COALESCE(individual_completions, '{}'::jsonb);
  
  -- Robust handling for assignees that might be double-encoded as strings
  BEGIN
    -- If assignees_safe is a string that looks like JSON, parse it
    IF jsonb_typeof(assignees_safe) = 'string' THEN
      assignees_safe := (assignees_safe #>> '{}')::jsonb;
    END IF;
    
    -- Ensure it's an array
    IF jsonb_typeof(assignees_safe) != 'array' THEN
      assignees_safe := '[]'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If any JSON parsing fails, default to empty array
    assignees_safe := '[]'::jsonb;
  END;
  
  -- Robust handling for teams that might be double-encoded as strings
  BEGIN
    -- If teams_safe is a string that looks like JSON, parse it
    IF jsonb_typeof(teams_safe) = 'string' THEN
      teams_safe := (teams_safe #>> '{}')::jsonb;
    END IF;
    
    -- Ensure it's an array
    IF jsonb_typeof(teams_safe) != 'array' THEN
      teams_safe := '[]'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If any JSON parsing fails, default to empty array
    teams_safe := '[]'::jsonb;
  END;
  
  -- Robust handling for completions that might be double-encoded as strings
  BEGIN
    -- If completions_safe is a string that looks like JSON, parse it
    IF jsonb_typeof(completions_safe) = 'string' THEN
      completions_safe := (completions_safe #>> '{}')::jsonb;
    END IF;
    
    -- Ensure it's an object
    IF jsonb_typeof(completions_safe) != 'object' THEN
      completions_safe := '{}'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If any JSON parsing fails, default to empty object
    completions_safe := '{}'::jsonb;
  END;
  
  -- Get individual assignees with safe array handling
  BEGIN
    IF jsonb_array_length(assignees_safe) > 0 THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(assignees_safe)) INTO individual_users;
    ELSE
      individual_users := ARRAY[]::text[];
    END IF;
    
    IF individual_users IS NOT NULL THEN
      all_users := all_users || individual_users;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If array processing fails, continue with empty array
    individual_users := ARRAY[]::text[];
  END;
  
  -- Get team members with safe processing
  BEGIN
    FOR team_record IN 
      SELECT jsonb_array_elements_text(teams_safe) as team_id
    LOOP
      BEGIN
        SELECT ARRAY(
          SELECT wtm.user_id 
          FROM workspace_team_members wtm 
          WHERE wtm.team_id = team_record.team_id::integer 
          AND wtm.is_active = true
        ) INTO team_users;
        
        IF team_users IS NOT NULL THEN
          all_users := all_users || team_users;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- If team processing fails, continue with next team
        CONTINUE;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- If team processing fails completely, continue without team members
    NULL;
  END;
  
  -- Remove duplicates safely
  BEGIN
    SELECT array_agg(DISTINCT user_id) INTO all_users FROM unnest(all_users) as user_id;
  EXCEPTION WHEN OTHERS THEN
    all_users := ARRAY[]::text[];
  END;
  
  total_assignees := COALESCE(array_length(all_users, 1), 0);
  
  -- Get completed assignees safely
  BEGIN
    SELECT ARRAY(SELECT jsonb_object_keys(completions_safe)) INTO completed_assignees;
  EXCEPTION WHEN OTHERS THEN
    completed_assignees := ARRAY[]::text[];
  END;
  
  completed_count := COALESCE(array_length(completed_assignees, 1), 0);
  
  RETURN json_build_object(
    'total', total_assignees,
    'completed', completed_count,
    'percentage', CASE 
      WHEN total_assignees > 0 THEN ROUND((completed_count::decimal / total_assignees) * 100, 1)
      ELSE 0
    END,
    'all_assignees', all_users,
    'individual_assignees', COALESCE((SELECT ARRAY(SELECT jsonb_array_elements_text(assignees_safe))), ARRAY[]::text[]),
    'completed_by', completed_assignees,
    'is_fully_complete', completed_count = total_assignees AND total_assignees > 0
  );
EXCEPTION WHEN OTHERS THEN
  -- Ultimate fallback if everything fails
  RETURN json_build_object(
    'total', 0,
    'completed', 0,
    'percentage', 0,
    'all_assignees', ARRAY[]::text[],
    'individual_assignees', ARRAY[]::text[],
    'completed_by', ARRAY[]::text[],
    'is_fully_complete', false,
    'error', 'Function execution failed, using defaults'
  );
END;
$$ LANGUAGE plpgsql;

-- Also update is_task_assignee function to be more robust
CREATE OR REPLACE FUNCTION is_task_assignee(task_assignees jsonb, task_teams jsonb, user_id varchar)
RETURNS boolean AS $$
DECLARE
  team_record RECORD;
  assignees_safe jsonb;
  teams_safe jsonb;
BEGIN
  -- Handle null inputs gracefully and ensure proper JSONB format
  assignees_safe := COALESCE(task_assignees, '[]'::jsonb);
  teams_safe := COALESCE(task_teams, '[]'::jsonb);
  
  -- Robust handling for assignees that might be double-encoded as strings
  BEGIN
    IF jsonb_typeof(assignees_safe) = 'string' THEN
      assignees_safe := (assignees_safe #>> '{}')::jsonb;
    END IF;
    
    IF jsonb_typeof(assignees_safe) != 'array' THEN
      assignees_safe := '[]'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    assignees_safe := '[]'::jsonb;
  END;
  
  -- Robust handling for teams that might be double-encoded as strings
  BEGIN
    IF jsonb_typeof(teams_safe) = 'string' THEN
      teams_safe := (teams_safe #>> '{}')::jsonb;
    END IF;
    
    IF jsonb_typeof(teams_safe) != 'array' THEN
      teams_safe := '[]'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    teams_safe := '[]'::jsonb;
  END;
  
  -- Check direct assignment safely
  BEGIN
    IF assignees_safe ? user_id THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If assignee check fails, continue to team check
    NULL;
  END;
  
  -- Check team assignments safely
  BEGIN
    FOR team_record IN 
      SELECT jsonb_array_elements_text(teams_safe) as team_id
    LOOP
      BEGIN
        IF EXISTS (
          SELECT 1 FROM workspace_team_members wtm 
          WHERE wtm.team_id = team_record.team_id::integer 
          AND wtm.user_id = user_id 
          AND wtm.is_active = true
        ) THEN
          RETURN true;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- If team check fails, continue with next team
        CONTINUE;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- If team processing fails completely, return false
    RETURN false;
  END;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Also add a function to clean up any malformed JSON data in existing records
CREATE OR REPLACE FUNCTION fix_malformed_task_json()
RETURNS integer AS $$
DECLARE
  task_record RECORD;
  fixed_count integer := 0;
  cleaned_assignees jsonb;
  cleaned_teams jsonb;
  cleaned_completions jsonb;
BEGIN
  FOR task_record IN 
    SELECT id, assignees, assigned_teams, individual_completions 
    FROM channel_tasks 
    WHERE assignees IS NOT NULL OR assigned_teams IS NOT NULL OR individual_completions IS NOT NULL
  LOOP
    cleaned_assignees := task_record.assignees;
    cleaned_teams := task_record.assigned_teams;
    cleaned_completions := task_record.individual_completions;
    
    -- Fix assignees if it's a string
    BEGIN
      IF jsonb_typeof(cleaned_assignees) = 'string' THEN
        cleaned_assignees := (cleaned_assignees #>> '{}')::jsonb;
        IF jsonb_typeof(cleaned_assignees) != 'array' THEN
          cleaned_assignees := '[]'::jsonb;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      cleaned_assignees := '[]'::jsonb;
    END;
    
    -- Fix teams if it's a string
    BEGIN
      IF jsonb_typeof(cleaned_teams) = 'string' THEN
        cleaned_teams := (cleaned_teams #>> '{}')::jsonb;
        IF jsonb_typeof(cleaned_teams) != 'array' THEN
          cleaned_teams := '[]'::jsonb;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      cleaned_teams := '[]'::jsonb;
    END;
    
    -- Fix completions if it's a string
    BEGIN
      IF jsonb_typeof(cleaned_completions) = 'string' THEN
        cleaned_completions := (cleaned_completions #>> '{}')::jsonb;
        IF jsonb_typeof(cleaned_completions) != 'object' THEN
          cleaned_completions := '{}'::jsonb;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      cleaned_completions := '{}'::jsonb;
    END;
    
    -- Update if any changes were made
    IF cleaned_assignees != COALESCE(task_record.assignees, '[]'::jsonb) OR 
       cleaned_teams != COALESCE(task_record.assigned_teams, '[]'::jsonb) OR 
       cleaned_completions != COALESCE(task_record.individual_completions, '{}'::jsonb) THEN
      
      UPDATE channel_tasks 
      SET 
        assignees = cleaned_assignees,
        assigned_teams = cleaned_teams,
        individual_completions = cleaned_completions,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = task_record.id;
      
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;
  
  RETURN fixed_count;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup function to fix any existing malformed data
SELECT fix_malformed_task_json() as records_fixed;

-- Drop the cleanup function as it's no longer needed
DROP FUNCTION fix_malformed_task_json();
