#!/bin/bash

echo "🔍 Checking Chat App Server Status..."
echo "=================================="

# Check Backend (Port 8080)
if lsof -i :8080 >/dev/null 2>&1; then
    echo "✅ Backend API Server: RUNNING (Port 8080)"
    PID=$(lsof -ti :8080 | head -1)
    echo "   Process ID: $PID"
else
    echo "❌ Backend API Server: NOT RUNNING (Port 8080)"
fi

echo ""

# Check Frontend (Port 5173)
if lsof -i :5173 >/dev/null 2>&1; then
    echo "✅ Frontend Dev Server: RUNNING (Port 5173)"
    PID=$(lsof -ti :5173 | head -1)
    echo "   Process ID: $PID"
else
    echo "❌ Frontend Dev Server: NOT RUNNING (Port 5173)"
fi

echo ""
echo "🌐 Quick URLs:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8080"
echo ""

# Test if they're actually responding
echo "🧪 Testing server responses..."
if curl -s http://localhost:8080 >/dev/null 2>&1; then
    echo "✅ Backend responding to requests"
else
    echo "❌ Backend not responding"
fi

if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo "✅ Frontend responding to requests"
else
    echo "❌ Frontend not responding"
fi
