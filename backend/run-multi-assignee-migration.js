#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMultiAssigneeMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Multi-Assignee and Teams Migration (018)...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '018_add_multi_assignee_and_groups.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Run migration
    await client.query('BEGIN');
    console.log('📦 Executing migration...');
    
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration 018 completed successfully!');
    console.log('');
    console.log('🎉 REVOLUTIONARY FEATURES ADDED:');
    console.log('  ✅ Multi-assignee tasks with progress tracking');
    console.log('  ✅ Team/Group system with @mention support'); 
    console.log('  ✅ Collaborative vs Individual Response modes');
    console.log('  ✅ Combined individual + team assignments');
    console.log('  ✅ Visual progress tracking (e.g. "2/7 done")');
    console.log('');
    console.log('📊 Sample data created:');
    console.log('  - 5 workspace teams (kitchen-team, frontend-dev, etc.)');
    console.log('  - Sample team memberships');
    console.log('  - Demo multi-assignee tasks');
    console.log('');
    console.log('🔗 New Database Objects:');
    console.log('  - workspace_teams table');
    console.log('  - workspace_team_members table');  
    console.log('  - Enhanced channel_tasks with assignees/assigned_teams');
    console.log('  - channel_tasks_with_progress view');
    console.log('  - user_task_assignments view');
    console.log('  - Helper functions for team operations');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('  1. Update backend API for multi-assignee support');
    console.log('  2. Add team management endpoints');
    console.log('  3. Update frontend components with progress indicators');
    console.log('  4. Add @team mention support to chat');
    
    // Query to show sample data
    console.log('');
    console.log('📋 Sample Tasks with Progress:');
    const sampleQuery = await client.query(`
      SELECT 
        title,
        assignment_mode,
        total_assignees,
        completion_count,
        (progress_info->>'percentage')::text || '%' as progress,
        is_complete
      FROM channel_tasks_with_progress 
      WHERE title LIKE '%demo%' OR title LIKE '%@%'
      ORDER BY created_at DESC
    `);
    
    sampleQuery.rows.forEach(row => {
      console.log(`  📝 ${row.title}`);
      console.log(`     Mode: ${row.assignment_mode} | Progress: ${row.completion_count}/${row.total_assignees} (${row.progress}) | Complete: ${row.is_complete}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
runMultiAssigneeMigration()
  .then(() => {
    console.log('');
    console.log('🎉 Ready for Phase 2C: Multi-assignee implementation!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
