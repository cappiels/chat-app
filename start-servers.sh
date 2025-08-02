#!/bin/bash

echo "🚀 Starting Chat App Servers..."
echo "=============================="

# Function to check if port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
}

# Start Backend Server
echo "📡 Starting Backend API Server..."
if check_port 8080; then
    echo "⚠️  Backend already running on port 8080"
else
    echo "   Opening new terminal for backend..."
    osascript -e 'tell app "Terminal" to do script "cd '"$PWD"'/backend && npm start"'
    sleep 3
    if check_port 8080; then
        echo "✅ Backend started successfully on port 8080"
    else
        echo "❌ Backend failed to start"
    fi
fi

echo ""

# Start Frontend Server  
echo "🎨 Starting Frontend Dev Server..."
if check_port 5173; then
    echo "⚠️  Frontend already running on port 5173"
else
    echo "   Opening new terminal for frontend..."
    osascript -e 'tell app "Terminal" to do script "cd '"$PWD"'/frontend && npm run dev"'
    sleep 3
    if check_port 5173; then
        echo "✅ Frontend started successfully on port 5173"
    else
        echo "❌ Frontend failed to start"
    fi
fi

echo ""
echo "🎉 Server startup complete!"
echo ""
echo "🌐 Your chat app should be available at:"
echo "   👉 http://localhost:5173"
echo ""
echo "💡 Run './check-servers.sh' anytime to check status"
