// Database setup using migration system
// Reverted from complete schema due to incomplete/buggy schema file

const { runMigrations } = require('./migrations/run-migrations');

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database using migration system...');
    
    // Run all pending migrations
    await runMigrations();
    
    console.log('✅ Database schema setup complete via migrations');
    console.log('📋 All tables, functions, views, and sample data created');
    
    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    throw error;
  }
}

// Allow running this script directly
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };
