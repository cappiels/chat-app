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

# Run complete migration suite to mirror production
echo "📄 Running complete migration suite to mirror production..."
cd backend
# Temporarily copy local env for migrations
cp .env.local .env
DATABASE_URL="postgresql://localhost:5432/chat_app_dev?sslmode=disable" node migrations/run-migrations.js

# Return to root
cd ..

echo ""
echo "🎯 Local Development Environment Ready!"
echo ""

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo "✅ Servers stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Kill any existing process on port 8080 to prevent conflicts
echo "🧹 Cleaning up existing processes on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 1

echo "🚀 Starting backend server with local environment..."
cd backend
# Use local environment file for development
cp .env.local .env
npm start &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

echo "🚀 Starting frontend dev server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

echo ""
echo "🎉 Development servers started!"
echo ""
echo "📍 Running Services:"
echo "  • Backend:  http://localhost:8080 (PID: $BACKEND_PID)"
echo "  • Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"
echo ""
echo "🌐 Opening browser..."
open http://localhost:5173

echo ""
echo "✅ Development environment is running!"
echo "💡 Press Ctrl+C to stop all servers"
echo ""

# Keep script running and wait for user to stop
wait
