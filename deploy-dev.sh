#!/bin/bash
# 🧪 Local Development Deployment Script
# Sets up and starts local development environment with local PostgreSQL

set -e  # Exit on any error

echo "🚀 Starting Local Development Setup..."

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    echo "📦 Starting PostgreSQL service..."
    brew services start postgresql@15
    sleep 2
fi

# Check if local database exists
if ! /opt/homebrew/opt/postgresql@15/bin/psql -lqt | cut -d \| -f 1 | grep -qw chat_app_dev; then
    echo "🗄️ Creating local database: chat_app_dev"
    /opt/homebrew/opt/postgresql@15/bin/createdb chat_app_dev
fi

# Run migrations on local database
echo "📄 Running migrations on local database..."
cd backend
DATABASE_URL="postgresql://localhost:5432/chat_app_dev" node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/chat_app_dev' });

async function runBasicMigrations() {
  try {
    console.log('🔧 Setting up local database schema...');
    
    // Create basic tables for development
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        owner_user_id VARCHAR(128) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        settings JSONB DEFAULT '{}'
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(128) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id),
        name VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        created_by VARCHAR(128) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS channel_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id),
        thread_id UUID NOT NULL REFERENCES threads(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date TIMESTAMP WITH TIME ZONE,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        assigned_to VARCHAR(128) REFERENCES users(id),
        created_by VARCHAR(128) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_all_day BOOLEAN DEFAULT false
      );
    \`);
    
    console.log('✅ Local database ready!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

runBasicMigrations();
"

# Return to root
cd ..

echo ""
echo "🎯 Local Development Environment Ready!"
echo ""
echo "📍 Next Steps:"
echo "  1. Terminal 1: cd backend && DATABASE_URL='postgresql://localhost:5432/chat_app_dev' npm start"
echo "  2. Terminal 2: cd frontend && npm run dev"
echo "  3. Open: http://localhost:5173"
echo ""
echo "✅ Safe local testing with empty database - no production risk!"
echo ""
