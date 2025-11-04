#!/bin/bash

# Minimal MCP Production Deployment
set -e

echo "🚀 Starting Minimal MCP Deployment..."

# Kill any existing processes
pkill -f "next" || true
pkill -f "node" || true

# Build in background
echo "📦 Building application..."
npm run build > build.log 2>&1 &
BUILD_PID=$!

# Wait for build to complete or timeout
timeout=300
echo "⏳ Waiting for build to complete (max ${timeout}s)..."
for i in $(seq 1 $timeout); do
    if kill -0 $BUILD_PID 2>/dev/null; then
        echo -n "."
        sleep 1
    else
        echo ""
        echo "✅ Build completed!"
        break
    fi
done

# Check if build succeeded
if kill -0 $BUILD_PID 2>/dev/null; then
    echo "❌ Build timeout, killing process..."
    kill $BUILD_PID 2>/dev/null || true
    exit 1
fi

# Start the application
echo "🎯 Starting production server..."
npm run start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Check if server is running
if curl -s http://localhost:3005 > /dev/null; then
    echo "✅ MCP Server is running on http://13.60.60.50:3005"
    echo "📊 Dashboard: http://13.60.60.50:3005/mcp-autonomous"
    echo "🔗 API Test: http://13.60.60.50:3005/api/mcp-autonomous/test"
    echo "📝 Server PID: $SERVER_PID"
    echo "📋 View logs: tail -f server.log"
else
    echo "❌ Server failed to start"
    cat server.log
    exit 1
fi