const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runProjectsMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting projects migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '016_create_projects.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Running migration 016_create_projects.sql...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Test that tables were created
    console.log('🔍 Verifying table creation...');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('projects', 'project_members', 'project_tasks')
      ORDER BY table_name;
    `);
    
    console.log(`📋 Created tables: ${tables.rows.map(r => r.table_name).join(', ')}`);
    
    // Check if sample project was created
    const sampleProject = await client.query(`
      SELECT p.*, u.display_name as created_by_name
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.name = 'Syncup Migration'
      LIMIT 1;
    `);
    
    if (sampleProject.rows.length > 0) {
      const project = sampleProject.rows[0];
      console.log('✅ Sample project created successfully:');
      console.log(`   📊 Project: ${project.name} (${project.id})`);
      console.log(`   👤 Created by: ${project.created_by_name}`);
      console.log(`   📅 Created at: ${project.created_at}`);
      
      // Check project member
      const members = await client.query(`
        SELECT pm.*, u.display_name
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = $1;
      `, [project.id]);
      
      console.log(`   👥 Members: ${members.rows.length}`);
      members.rows.forEach(member => {
        console.log(`      - ${member.display_name} (${member.role})`);
      });
    } else {
      console.log('⚠️  Sample project not created - this may be expected if no users/workspaces exist yet');
    }
    
    // Check knowledge_articles extension
    const knowledgeColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_articles' 
      AND column_name = 'project_id';
    `);
    
    if (knowledgeColumns.rows.length > 0) {
      console.log('✅ Knowledge articles extended with project_id column');
    } else {
      console.log('⚠️  Knowledge articles table may not exist yet');
    }
    
    console.log('🎉 Projects migration verification complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runProjectsMigration()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runProjectsMigration };
