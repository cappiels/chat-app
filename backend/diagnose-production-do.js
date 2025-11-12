const { Pool } = require('pg');
require('dotenv').config();

// Use production DATABASE_URL (should be DigitalOcean PostgreSQL cluster)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function diagnoseProductionSchema() {
  const client = await pool.connect();
  
  try {
    console.log('=== DIGITALOCEAN PRODUCTION SCHEMA DIAGNOSIS ===\n');
    console.log('🌐 Database URL:', process.env.DATABASE_URL ? 'Connected to DigitalOcean' : 'ERROR: No DATABASE_URL');
    
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
    
    // Check for multi-assignee columns specifically (added in migration 018)
    console.log('\n2. Checking for multi-assignee columns (Migration 018):');
    const multiAssigneeColumns = ['assignees', 'assigned_teams', 'assignment_mode', 'individual_completions'];
    let missingColumns = [];
    
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
        missingColumns.push(col);
      }
    }
    
    // Check newer columns from migrations 020, 021, 022
    console.log('\n3. Checking newer columns (Migrations 020-022):');
    const newerChecks = [
      { table: 'messages', column: 'is_pinned', migration: '020' },
      { table: 'thread_members', column: 'role', migration: '021' },
      { table: 'message_reactions', column: 'id', migration: '022' }
    ];
    
    for (const check of newerChecks) {
      try {
        const colCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2 AND table_schema = 'public';
        `, [check.table, check.column]);
        
        if (colCheck.rows.length > 0) {
          console.log(`   ✅ ${check.table}.${check.column} exists (Migration ${check.migration})`);
        } else {
          console.log(`   ❌ ${check.table}.${check.column} missing (Migration ${check.migration})`);
        }
      } catch (error) {
        console.log(`   ❌ ${check.table} table doesn't exist (Migration ${check.migration})`);
      }
    }
    
    // Check if channel_tasks_with_progress view exists
    console.log('\n4. Checking for channel_tasks_with_progress view:');
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
    
    // Check for required functions from migration 018
    console.log('\n5. Checking for required functions:');
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
    console.log('\n6. Checking for workspace_teams table:');
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
    
    // Test the exact failing API query
    console.log('\n7. Testing the exact failing API query:');
    try {
      // This is the query that's causing the 500 error
      const testQuery = await client.query(`
        SELECT ct.id
        FROM channel_tasks_with_progress ct
        WHERE ct.thread_id = '02f189a6-6759-41f9-9283-db833f7133ac'
        LIMIT 1;
      `);
      console.log(`   ✅ Failing API query would work - found ${testQuery.rows.length} tasks`);
    } catch (error) {
      console.log(`   ❌ Failing API query error: ${error.message}`);
    }
    
    // Test basic fallback query (what we should use if advanced features missing)
    console.log('\n8. Testing basic fallback query:');
    try {
      const fallbackQuery = await client.query(`
        SELECT 
          ct.*,
          u2.display_name as created_by_name
        FROM channel_tasks ct
        LEFT JOIN users u2 ON ct.created_by = u2.id
        WHERE ct.thread_id = '02f189a6-6759-41f9-9283-db833f7133ac'
        LIMIT 1;
      `);
      console.log(`   ✅ Basic fallback query works - found ${fallbackQuery.rows.length} tasks`);
    } catch (error) {
      console.log(`   ❌ Basic fallback query error: ${error.message}`);
    }
    
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    if (missingColumns.length > 0) {
      console.log('❌ CRITICAL: Multi-assignee features not deployed to production');
      console.log('🔧 SOLUTION: Need to run migrations 018+ on production database');
    } else {
      console.log('✅ Multi-assignee schema appears complete');
    }
    
  } catch (error) {
    console.error('❌ Production diagnosis failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseProductionSchema().catch(console.error);
