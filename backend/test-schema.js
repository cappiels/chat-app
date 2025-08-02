const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const testSchema = async () => {
  try {
    console.log('🔍 Testing database schema...');
    
    // Test 1: Check all tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const tables = await pool.query(tablesQuery);
    console.log('📋 Tables created:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Test 2: Check foreign key constraints
    const constraintsQuery = `
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table
      FROM pg_constraint 
      WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
      ORDER BY table_name, constraint_name;
    `;
    const constraints = await pool.query(constraintsQuery);
    console.log('\n🔗 Foreign key constraints:');
    constraints.rows.forEach(row => {
      console.log(`  - ${row.table_name} → ${row.referenced_table} (${row.constraint_name})`);
    });
    
    // Test 3: Check indexes
    const indexesQuery = `
      SELECT 
        indexname,
        tablename
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `;
    const indexes = await pool.query(indexesQuery);
    console.log('\n📊 Performance indexes:');
    indexes.rows.forEach(row => {
      console.log(`  - ${row.tablename}.${row.indexname}`);
    });
    
    // Test 4: Simple data insertion test
    console.log('\n🧪 Testing data relationships...');
    
    // Create a test user (if not exists)
    await pool.query(`
      INSERT INTO users (id, email, display_name) 
      VALUES ('test-user-123', 'test@example.com', 'Test User')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    // Create a test workspace
    const workspace = await pool.query(`
      INSERT INTO workspaces (name, owner_user_id) 
      VALUES ('Test Workspace', 'test-user-123')
      RETURNING id, name;
    `);
    
    const workspaceId = workspace.rows[0].id;
    console.log(`  ✅ Created workspace: ${workspace.rows[0].name} (${workspaceId})`);
    
    // Add user to workspace
    await pool.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, 'test-user-123', 'admin')
      ON CONFLICT DO NOTHING;
    `, [workspaceId]);
    console.log(`  ✅ Added user to workspace as admin`);
    
    // Create a test channel
    const thread = await pool.query(`
      INSERT INTO threads (workspace_id, name, type, created_by)
      VALUES ($1, 'general', 'channel', 'test-user-123')
      RETURNING id, name;
    `, [workspaceId]);
    
    const threadId = thread.rows[0].id;
    console.log(`  ✅ Created channel: ${thread.rows[0].name} (${threadId})`);
    
    // Add user to thread
    await pool.query(`
      INSERT INTO thread_members (thread_id, user_id)
      VALUES ($1, 'test-user-123')
      ON CONFLICT DO NOTHING;
    `, [threadId]);
    console.log(`  ✅ Added user to channel`);
    
    // Create a test message
    const message = await pool.query(`
      INSERT INTO messages (thread_id, sender_id, content)
      VALUES ($1, 'test-user-123', 'Hello, this is a test message!')
      RETURNING id, content;
    `, [threadId]);
    
    console.log(`  ✅ Created message: "${message.rows[0].content}"`);
    
    // Test complex query - get workspace with channels and recent messages
    const workspaceData = await pool.query(`
      SELECT 
        w.name as workspace_name,
        t.name as channel_name,
        t.type as channel_type,
        m.content as latest_message,
        u.display_name as sender_name,
        m.created_at as message_time
      FROM workspaces w
      JOIN threads t ON w.id = t.workspace_id
      LEFT JOIN messages m ON t.id = m.thread_id
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE w.id = $1
      ORDER BY m.created_at DESC
      LIMIT 5;
    `, [workspaceId]);
    
    console.log('\n📊 Test query result:');
    workspaceData.rows.forEach(row => {
      console.log(`  - ${row.workspace_name}/${row.channel_name}: "${row.latest_message}" by ${row.sender_name}`);
    });
    
    console.log('\n🎉 Schema test completed successfully!');
    console.log('💾 Database is ready for the chat application.');
    
  } catch (error) {
    console.error('❌ Schema test failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  testSchema();
}

module.exports = { testSchema };
