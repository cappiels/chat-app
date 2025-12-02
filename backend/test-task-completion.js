#!/usr/bin/env node
/**
 * Test script to debug task completion API
 * Run: node backend/test-task-completion.js
 */

require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('🔗 Connecting to database...');
    
    // 1. List some tasks with their workspace/thread info
    console.log('\n📋 Recent tasks:');
    const tasksResult = await pool.query(`
      SELECT 
        ct.id,
        ct.title,
        ct.thread_id,
        ct.workspace_id,
        ct.status,
        ct.created_by,
        t.name as channel_name,
        w.name as workspace_name
      FROM channel_tasks ct
      JOIN threads t ON ct.thread_id = t.id
      JOIN workspaces w ON ct.workspace_id = w.id
      ORDER BY ct.created_at DESC
      LIMIT 5
    `);
    
    console.log('Tasks found:', tasksResult.rows.length);
    tasksResult.rows.forEach(task => {
      console.log(`  - Task "${task.title}" (ID: ${task.id})`);
      console.log(`    workspace_id: ${task.workspace_id}, thread_id: ${task.thread_id}`);
      console.log(`    Status: ${task.status}`);
      console.log(`    Channel: ${task.channel_name}, Workspace: ${task.workspace_name}`);
      console.log('');
    });
    
    // 2. List some users
    console.log('\n👤 Users:');
    const usersResult = await pool.query(`
      SELECT id, display_name, email FROM users LIMIT 5
    `);
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.display_name} (${user.id})`);
    });
    
    // 3. List thread_members for the first task's thread
    if (tasksResult.rows.length > 0) {
      const firstTask = tasksResult.rows[0];
      console.log(`\n🔐 Thread members for thread ${firstTask.thread_id}:`);
      const membersResult = await pool.query(`
        SELECT tm.user_id, tm.role, u.display_name
        FROM thread_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.thread_id = $1
      `, [firstTask.thread_id]);
      membersResult.rows.forEach(member => {
        console.log(`  - ${member.display_name} (${member.user_id}) - role: ${member.role}`);
      });
      
      // 4. Construct a test curl command
      console.log('\n🧪 TEST CURL COMMAND:');
      console.log('Replace YOUR_TOKEN with a valid Firebase ID token from the Flutter app console logs');
      console.log('');
      console.log(`curl -X POST "https://coral-app-rgki8.ondigitalocean.app/api/workspaces/${firstTask.workspace_id}/threads/${firstTask.thread_id}/tasks/${firstTask.id}/complete" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_TOKEN" \\`);
      console.log(`  -H "Content-Type: application/json" -v`);
    }
    
    // 5. Check column types
    console.log('\n📊 Table column types for channel_tasks:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'channel_tasks'
      AND column_name IN ('id', 'thread_id', 'workspace_id')
    `);
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });
    
    console.log('\n📊 Table column types for threads:');
    const threadsColumnsResult = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'threads'
      AND column_name IN ('id', 'workspace_id')
    `);
    threadsColumnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

main();
