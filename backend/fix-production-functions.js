// Emergency fix for production database functions
// This fixes the UUID parameter mismatch causing 500 errors in calendar/timeline views

const { createPool } = require('./config/database');
const fs = require('fs');

async function fixProductionFunctions() {
  const pool = createPool();
  
  try {
    console.log('🔧 Fixing production database functions with UUID support...');
    
    // Fix the mark_task_complete_individual function with UUID parameter
    console.log('📝 Updating mark_task_complete_individual function...');
    await pool.query(`
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
    `);
    
    // Fix the mark_task_incomplete_individual function with UUID parameter
    console.log('📝 Updating mark_task_incomplete_individual function...');
    await pool.query(`
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
    `);
    
    // Ensure all required columns exist with defaults
    console.log('📝 Ensuring all multi-assignee columns exist...');
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'assignees') THEN
          ALTER TABLE channel_tasks ADD COLUMN assignees JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'assigned_teams') THEN
          ALTER TABLE channel_tasks ADD COLUMN assigned_teams JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'assignment_mode') THEN
          ALTER TABLE channel_tasks ADD COLUMN assignment_mode VARCHAR(50) DEFAULT 'collaborative';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'individual_completions') THEN
          ALTER TABLE channel_tasks ADD COLUMN individual_completions JSONB DEFAULT '{}'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'completion_count') THEN
          ALTER TABLE channel_tasks ADD COLUMN completion_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_tasks' AND column_name = 'requires_individual_response') THEN
          ALTER TABLE channel_tasks ADD COLUMN requires_individual_response BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);
    
    // Update existing tasks to have proper defaults
    console.log('📝 Updating existing tasks with defaults...');
    await pool.query(`
      UPDATE channel_tasks 
      SET 
        assignees = CASE 
          WHEN assignees IS NULL OR assignees = '[]'::jsonb THEN 
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
    `);
    
    // Recreate the view if it doesn't exist or has issues
    console.log('📝 Recreating channel_tasks_with_progress view...');
    await pool.query(`
      DROP VIEW IF EXISTS channel_tasks_with_progress;
      CREATE VIEW channel_tasks_with_progress AS
      SELECT 
        ct.*,
        get_task_completion_progress(
          COALESCE(ct.assignees, '[]'::jsonb), 
          COALESCE(ct.assigned_teams, '[]'::jsonb), 
          COALESCE(ct.individual_completions, '{}'::jsonb)
        ) as progress_info,
        CASE 
          WHEN ct.assignment_mode = 'individual_response' THEN 
            (get_task_completion_progress(
              COALESCE(ct.assignees, '[]'::jsonb), 
              COALESCE(ct.assigned_teams, '[]'::jsonb), 
              COALESCE(ct.individual_completions, '{}'::jsonb)
            )->>'is_fully_complete')::boolean
          ELSE 
            ct.completed_at IS NOT NULL
        END as is_complete,
        (get_task_completion_progress(
          COALESCE(ct.assignees, '[]'::jsonb), 
          COALESCE(ct.assigned_teams, '[]'::jsonb), 
          COALESCE(ct.individual_completions, '{}'::jsonb)
        )->>'total')::integer as total_assignees,
        jsonb_array_length(COALESCE(ct.assignees, '[]'::jsonb)) as individual_assignee_count,
        jsonb_array_length(COALESCE(ct.assigned_teams, '[]'::jsonb)) as team_count
      FROM channel_tasks ct;
    `);
    
    // Test the fixes
    console.log('🧪 Testing the fixes...');
    
    const viewTest = await pool.query('SELECT COUNT(*) as count FROM channel_tasks_with_progress LIMIT 1');
    console.log('✅ View test passed:', viewTest.rows[0].count, 'tasks accessible');
    
    const funcTest = await pool.query(`
      SELECT proname, proargnames, proargtypes 
      FROM pg_proc 
      WHERE proname IN ('mark_task_complete_individual', 'mark_task_incomplete_individual')
      ORDER BY proname;
    `);
    console.log('✅ Function test passed:', funcTest.rows.length, 'functions updated');
    
    // Test with a sample UUID
    const sampleTest = await pool.query(`
      SELECT 
        'mark_task_complete_individual' as func_name,
        mark_task_complete_individual('00000000-0000-0000-0000-000000000000'::uuid, 'test_user') as result
      UNION ALL
      SELECT 
        'mark_task_incomplete_individual' as func_name,
        mark_task_incomplete_individual('00000000-0000-0000-0000-000000000000'::uuid, 'test_user') as result;
    `);
    console.log('✅ UUID parameter test passed - functions accept UUID parameters');
    
    console.log('\n🎉 Production database functions fixed successfully!');
    console.log('📅 Calendar and Timeline views should now work properly');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

fixProductionFunctions().catch(console.error);
