#!/bin/bash
# 🧪 Backend-Only Development Script
# Sets up and starts ONLY the backend for Flutter mobile development

set -e  # Exit on any error

echo "🚀 Starting Backend-Only Development Setup..."

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

# Run complete migration suite to mirror production
echo "📄 Running complete migration suite to mirror production..."
cd backend
# Temporarily copy local env for migrations
cp .env.local .env
DATABASE_URL="postgresql://localhost:5432/chat_app_dev?sslmode=disable" node migrations/run-migrations.js

# Kill any existing process on port 8080 to prevent conflicts
echo "🧹 Cleaning up existing processes on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

echo "🚀 Starting backend server with local environment..."
# Use local environment file for development
cp .env.local .env

# Start backend server in background
echo "📡 Starting backend server in background..."
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo ""
    echo "✅ Backend server running in background!"
    echo "📍 Server: http://localhost:8080 (PID: $BACKEND_PID)"
    echo "📋 Logs: logs/backend.log"
    echo ""
    echo "🎯 Ready for Flutter development!"
    echo "💡 To stop backend: kill $BACKEND_PID"
    echo ""
    echo "➡️  Now run Flutter in this same terminal:"
    echo "    cd mobile && flutter run -d chrome --web-port 8082"
    echo ""
else
    echo "❌ Failed to start backend server"
    exit 1
fi
