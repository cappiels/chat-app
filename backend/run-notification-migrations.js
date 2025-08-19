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

async function runNotificationMigrations() {
  try {
    console.log('🚀 Running read tracking migration...');

    // Read and run migration 012 (read tracking system)
    const migration012 = fs.readFileSync(path.join(__dirname, 'migrations/012_create_read_tracking.sql'), 'utf8');
    console.log('📄 Running 012_create_read_tracking.sql...');
    await pool.query(migration012);
    console.log('✅ Migration 012 completed successfully');

    console.log('🎉 Read tracking migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  } finally {
    await pool.end();
  }
}

runNotificationMigrations();
