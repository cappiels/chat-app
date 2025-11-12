const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function diagnoseSchema() {
  const client = await pool.connect();
  
  try {
    console.log('=== PRODUCTION SCHEMA DIAGNOSIS ===\n');
    
    // Check if channel_tasks table exists and what columns it has
    console.log('1. Checking channel_tasks table structure:');
    const tableResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'channel_tasks' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    if (tableResult.rows.length > 0) {
      console.log('✅ channel_tasks table exists with columns:');
      tableResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
      });
    } else {
      console.log('❌ channel_tasks table not found');
    }
    
    // Check for multi-assignee columns specifically
    console.log('\n2. Checking for multi-assignee columns:');
    const multiAssigneeColumns = ['assignees', 'assigned_teams', 'assignment_mode', 'individual_completions'];
    for (const col of multiAssigneeColumns) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = 'channel_tasks' AND column_name = $1 AND table_schema = 'public';
      `, [col]);
      
      if (colCheck.rows.length > 0) {
        console.log(`   ✅ ${col} exists`);
      } else {
        console.log(`   ❌ ${col} missing`);
      }
    }
    
    // Check if channel_tasks_with_progress view exists
    console.log('\n3. Checking for channel_tasks_with_progress view:');
    const viewResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views
      WHERE table_name = 'channel_tasks_with_progress' AND table_schema = 'public';
    `);
    
    if (viewResult.rows.length > 0) {
      console.log('   ✅ channel_tasks_with_progress view exists');
    } else {
      console.log('   ❌ channel_tasks_with_progress view missing');
    }
    
    // Check for required functions
    console.log('\n4. Checking for required functions:');
    const functions = [
      'is_task_assignee', 
      'can_user_edit_task', 
      'get_task_completion_progress',
      'mark_task_complete_individual',
      'mark_task_incomplete_individual'
    ];
    
    for (const func of functions) {
      const funcCheck = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines
        WHERE routine_name = $1 AND routine_schema = 'public';
      `, [func]);
      
      if (funcCheck.rows.length > 0) {
        console.log(`   ✅ ${func}() exists`);
      } else {
        console.log(`   ❌ ${func}() missing`);
      }
    }
    
    // Check for workspace_teams table
    console.log('\n5. Checking for workspace_teams table:');
    const teamsTableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_name = 'workspace_teams' AND table_schema = 'public';
    `);
    
    if (teamsTableResult.rows.length > 0) {
      console.log('   ✅ workspace_teams table exists');
      
      // Count teams
      const teamsCount = await client.query('SELECT COUNT(*) FROM workspace_teams');
      console.log(`   📊 ${teamsCount.rows[0].count} teams found`);
    } else {
      console.log('   ❌ workspace_teams table missing');
    }
    
    // Try a simple query on channel_tasks to see what basic data exists
    console.log('\n6. Testing basic channel_tasks query:');
    try {
      const basicQuery = await client.query(`
        SELECT COUNT(*) as task_count, 
               COUNT(DISTINCT thread_id) as thread_count
        FROM channel_tasks;
      `);
      console.log(`   ✅ Basic query works: ${basicQuery.rows[0].task_count} tasks in ${basicQuery.rows[0].thread_count} threads`);
    } catch (error) {
      console.log(`   ❌ Basic query failed: ${error.message}`);
    }
    
    // Test the specific query that's failing in the API
    console.log('\n7. Testing the API query that\'s failing:');
    try {
      const apiQuery = await client.query(`
        SELECT COUNT(*) FROM channel_tasks_with_progress ct
        WHERE ct.thread_id = '02f189a6-6759-41f9-9283-db833f7133ac';
      `);
      console.log(`   ✅ API query structure works`);
    } catch (error) {
      console.log(`   ❌ API query failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseSchema().catch(console.error);
