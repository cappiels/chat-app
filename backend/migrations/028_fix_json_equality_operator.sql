-- Migration 028: Fix JSON equality operator issue in user_task_assignments view
-- This addresses the PostgreSQL error: could not identify an equality operator for type json

-- Drop the problematic view
DROP VIEW IF EXISTS user_task_assignments;

-- Recreate the view without the problematic json column that breaks DISTINCT
-- The progress_info can be computed on demand instead of being stored in the view
CREATE VIEW user_task_assignments AS
SELECT DISTINCT
  ct.id as task_id,
  ct.title,
  ct.thread_id,
  u.id as user_id,
  'individual' as assignment_type,
  NULL::integer as team_id,
  NULL::varchar(100) as team_name,
  ct.assignment_mode,
  ct.requires_individual_response,
  CASE 
    WHEN ct.individual_completions ? u.id THEN true
    ELSE false
  END as user_completed,
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
  ct.is_complete
FROM channel_tasks_with_progress ct
CROSS JOIN LATERAL jsonb_array_elements_text(ct.assigned_teams) as t(id)
JOIN workspace_teams wt ON wt.id = t.id::integer
JOIN workspace_team_members wtm ON wtm.team_id = wt.id AND wtm.is_active = true;

-- Also fix the get_task_completion_progress function to handle empty/null arrays better
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
  team_info json[] := ARRAY[]::json[];
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  individual_completions := COALESCE(individual_completions, '{}'::jsonb);
  
  -- Get individual assignees
  IF jsonb_array_length(task_assignees) > 0 THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees)) INTO individual_users;
    IF individual_users IS NOT NULL THEN
      all_users := all_users || individual_users;
    END IF;
  END IF;
  
  -- Get team members
  IF jsonb_array_length(task_teams) > 0 THEN
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
      
      -- Get team info for response
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
  END IF;
  
  -- Remove duplicates and count
  SELECT array_agg(DISTINCT user_id) INTO all_users FROM unnest(all_users) as user_id;
  total_assignees := COALESCE(array_length(all_users, 1), 0);
  
  -- Get completed assignees
  SELECT ARRAY(SELECT jsonb_object_keys(individual_completions)) INTO completed_assignees;
  completed_count := COALESCE(array_length(completed_assignees, 1), 0);
  
  RETURN json_build_object(
    'total', total_assignees,
    'completed', completed_count,
    'percentage', CASE 
      WHEN total_assignees > 0 THEN ROUND((completed_count::decimal / total_assignees) * 100, 1)
      ELSE 0
    END,
    'all_assignees', COALESCE(all_users, ARRAY[]::text[]),
    'individual_assignees', COALESCE((
      SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees))
    ), ARRAY[]::text[]),
    'teams', COALESCE(team_info, ARRAY[]::json[]),
    'completed_by', COALESCE(completed_assignees, ARRAY[]::text[]),
    'is_fully_complete', completed_count = total_assignees AND total_assignees > 0
  );
END;
$$ LANGUAGE plpgsql;

-- Also ensure the get_all_task_assignees function handles nulls properly
CREATE OR REPLACE FUNCTION get_all_task_assignees(task_assignees jsonb, task_teams jsonb)
RETURNS json AS $$
DECLARE
  all_users text[] := ARRAY[]::text[];
  individual_users text[];
  team_users text[];
  team_record RECORD;
BEGIN
  -- Handle null inputs gracefully
  task_assignees := COALESCE(task_assignees, '[]'::jsonb);
  task_teams := COALESCE(task_teams, '[]'::jsonb);
  
  -- Get individual assignees
  IF jsonb_array_length(task_assignees) > 0 THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(task_assignees)) INTO individual_users;
    IF individual_users IS NOT NULL THEN
      all_users := all_users || individual_users;
    END IF;
  END IF;
  
  -- Get team members
  IF jsonb_array_length(task_teams) > 0 THEN
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
  END IF;
  
  -- Remove duplicates and return as JSON
  SELECT array_agg(DISTINCT user_id) INTO all_users FROM unnest(all_users) as user_id;
  
  RETURN json_build_object(
    'all_assignees', COALESCE(all_users, ARRAY[]::text[]),
    'count', COALESCE(array_length(all_users, 1), 0)
  );
END;
$$ LANGUAGE plpgsql;
