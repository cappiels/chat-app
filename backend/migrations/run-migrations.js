const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Migration tracking table
const createMigrationsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(query);
};

// Get executed migrations
const getExecutedMigrations = async () => {
  const result = await pool.query('SELECT migration_name FROM migrations ORDER BY id');
  return result.rows.map(row => row.migration_name);
};

// Mark migration as executed
const markMigrationExecuted = async (migrationName) => {
  await pool.query('INSERT INTO migrations (migration_name) VALUES ($1)', [migrationName]);
};

// Run a single migration
const runMigration = async (migrationFile) => {
  const filePath = path.join(__dirname, migrationFile);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Extract UP script (before DOWN comment)
  const upScript = sql.split('-- DOWN:')[0].replace(/-- Migration.*\n-- UP:.*\n/, '');
  
  console.log(`Running migration: ${migrationFile}`);
  
  try {
    await pool.query('BEGIN');
    await pool.query(upScript);
    await markMigrationExecuted(migrationFile);
    await pool.query('COMMIT');
    console.log(`✅ Migration ${migrationFile} completed successfully`);
  } catch (error) {
    await pool.query('ROLLBACK');
    
    // Handle "already exists" errors gracefully
    if (error.message.includes('already exists')) {
      console.log(`⏭️ Migration ${migrationFile} skipped (table already exists)`);
      await markMigrationExecuted(migrationFile);
      return;
    }
    
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    throw error;
  }
};

// Main migration runner
const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Get all migration files
    const migrationFiles = fs.readdirSync(__dirname)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Get already executed migrations
    const executedMigrations = await getExecutedMigrations();
    
    // Run pending migrations
    const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations to run');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach(file => console.log(`  - ${file}`));
    
    for (const migrationFile of pendingMigrations) {
      await runMigration(migrationFile);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run migrations if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
