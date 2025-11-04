#!/bin/bash

# Local Docker MCP Development Launcher
echo "🐳 Starting MCP Local Development Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local with your actual API keys"
fi

# Stop existing container
echo "🔄 Stopping existing container..."
docker-compose -f docker-compose.local.yml down 2>/dev/null || true

# Build and start container
echo "🏗️  Building development container..."
docker-compose -f docker-compose.local.yml build

echo "🚀 Starting MCP development server..."
docker-compose -f docker-compose.local.yml up -d

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 30

# Check if container is running
if docker-compose -f docker-compose.local.yml ps | grep -q "Up"; then
    echo "✅ MCP Local Development is running!"
    echo ""
    echo "🌐 Access your MCP system at:"
    echo "   - Local: http://localhost:3005"
    echo "   - MCP Dashboard: http://localhost:3005/mcp-autonomous"
    echo "   - API Test: http://localhost:3005/api/mcp-autonomous/test"
    echo ""
    echo "📋 View logs: docker-compose -f docker-compose.local.yml logs -f"
    echo "🛑 Stop: docker-compose -f docker-compose.local.yml down"
    echo "🔄 Restart: docker-compose -f docker-compose.local.yml restart"
    echo ""
    echo "💡 Development tips:"
    echo "   - File changes auto-reload in the container"
    echo "   - No CORS issues with localhost"
    echo "   - Perfect for A2A testing"
else
    echo "❌ Container failed to start. Check logs:"
    docker-compose -f docker-compose.local.yml logs
fi