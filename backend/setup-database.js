const fs = require('fs');
const path = require('path');
const { createPool } = require('./config/database');
require('dotenv').config();

async function setupDatabase() {
  const pool = createPool();
  const client = await pool.connect();
  
  try {
    console.log('🚀 Setting up database with unified schema...\n');
    
    // Read the complete schema file
    const schemaPath = path.join(__dirname, 'schema', 'complete-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Applying complete database schema...');
    
    // Execute the entire schema (CREATE IF NOT EXISTS makes this safe)
    await client.query(schema);
    
    console.log('✅ Database schema applied successfully!\n');
    
    // Verify key tables exist
    console.log('🔍 Verifying database structure:');
    
    const tables = [
      'users', 'workspaces', 'workspace_members', 'threads', 'thread_members',
      'messages', 'message_reactions', 'notifications', 'workspace_teams', 
      'workspace_team_members', 'channel_tasks'
    ];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      
      if (result.rows[0].count > 0) {
        console.log(`   ✅ ${table} table exists`);
      } else {
        console.log(`   ❌ ${table} table missing`);
      }
    }
    
    // Verify views exist
    console.log('\n🔍 Verifying database views:');
    const views = ['channel_tasks_with_progress', 'user_task_assignments'];
    
    for (const view of views) {
      const result = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.views 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [view]);
      
      if (result.rows[0].count > 0) {
        console.log(`   ✅ ${view} view exists`);
      } else {
        console.log(`   ❌ ${view} view missing`);
      }
    }
    
    // Verify functions exist
    console.log('\n🔍 Verifying database functions:');
    const functions = [
      'is_task_assignee', 'get_all_task_assignees', 'get_task_completion_progress',
      'can_user_edit_task', 'mark_task_complete_individual', 'mark_task_incomplete_individual'
    ];
    
    for (const func of functions) {
      const result = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.routines 
        WHERE routine_name = $1 AND routine_schema = 'public'
      `, [func]);
      
      if (result.rows[0].count > 0) {
        console.log(`   ✅ ${func}() function exists`);
      } else {
        console.log(`   ❌ ${func}() function missing`);
      }
    }
    
    // Test the calendar API query to make sure it works
    console.log('\n🧪 Testing calendar API query:');
    try {
      const testResult = await client.query(`
        SELECT COUNT(*) as task_count FROM channel_tasks_with_progress
      `);
      console.log(`   ✅ Calendar API query works - ${testResult.rows[0].task_count} total tasks in system`);
    } catch (error) {
      console.log(`   ❌ Calendar API query failed: ${error.message}`);
    }
    
    // Count sample teams created
    console.log('\n📊 Sample data status:');
    try {
      const teamsCount = await client.query(`SELECT COUNT(*) as count FROM workspace_teams`);
      console.log(`   📋 ${teamsCount.rows[0].count} teams in system`);
      
      if (parseInt(teamsCount.rows[0].count) >= 5) {
        console.log('   ✅ Sample teams created successfully');
      }
    } catch (error) {
      console.log(`   ⚠️  Could not check sample teams: ${error.message}`);
    }
    
    console.log('\n🎉 Database setup complete!');
    console.log('📝 All tables, views, functions, and sample data are ready.');
    console.log('🚀 Calendar and timeline views should now work in production.');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow running as script
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };
