require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runEmailNotificationMigrations() {
  console.log('🚀 Starting email notification migrations...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    
    // Read the email notification migration file
    const migrationPath = path.join(__dirname, 'migrations', '015_create_email_notification_preferences.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running email notification migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Email notification migration completed successfully');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('email_notification_preferences', 'user_activity', 'email_notification_queue', 'daily_digest_cache')
      ORDER BY table_name;
    `);
    
    console.log('📋 Created email notification tables:', result.rows.map(r => r.table_name));
    
    client.release();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runEmailNotificationMigrations()
  .then(() => {
    console.log('🎉 Email notification system ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration runner failed:', error);
    process.exit(1);
  });
