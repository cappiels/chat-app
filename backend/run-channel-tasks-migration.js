const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runChannelTasksMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Channel Tasks Migration 017...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '017_create_channel_tasks.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Channel Tasks Migration 017 completed successfully!');
    
    // Verify the tables were created
    console.log('🔍 Verifying table creation...');
    
    const tableCheck = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'channel_tasks' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Channel Tasks table structure:');
    console.table(tableCheck.rows);
    
    // Check if sample tasks were created
    const sampleTasksCheck = await client.query(`
      SELECT ct.id, ct.title, ct.status, t.name as channel_name 
      FROM channel_tasks ct
      JOIN threads t ON ct.thread_id = t.id
      LIMIT 5;
    `);
    
    console.log('📋 Sample tasks created:');
    console.table(sampleTasksCheck.rows);
    
    // Check if threads table was extended
    const threadsCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'threads' 
      AND column_name IN ('google_calendar_id', 'google_drive_folder_id', 'calendar_settings')
      ORDER BY column_name;
    `);
    
    console.log('📊 Threads table extensions:');
    console.table(threadsCheck.rows);
    
    console.log('🎉 Migration verification complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runChannelTasksMigration().catch(console.error);
