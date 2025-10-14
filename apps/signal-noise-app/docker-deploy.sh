#!/bin/bash

# MCP Docker Deployment Script
set -e

echo "🐳 Starting MCP Docker Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker ec2-user
    echo "✅ Docker installed"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed"
fi

# Kill any existing Next.js processes
echo "🔄 Stopping existing processes..."
pkill -f "next" || true
sudo lsof -ti:3005 | xargs sudo kill -9 2>/dev/null || true

# Create logs directory
mkdir -p logs

# Build and start containers
echo "🏗️  Building MCP Docker container..."
docker-compose build

echo "🚀 Starting MCP production system..."
docker-compose up -d

# Wait for container to start
echo "⏳ Waiting for MCP system to initialize..."
sleep 30

# Check if container is running
if docker-compose ps | grep -q "Up"; then
    echo "✅ MCP Production System is running!"
    echo ""
    echo "🌐 Access your MCP system at:"
    echo "   - Direct: http://13.60.60.50:3005"
    echo "   - Via Nginx: http://13.60.60.50"
    echo ""
    echo "📊 MCP Dashboard: http://13.60.60.50:3005/mcp-autonomous"
    echo "🔗 API Test: http://13.60.60.50:3005/api/mcp-autonomous/test"
    echo ""
    echo "📋 View logs: docker-compose logs -f"
    echo "🛑 Stop: docker-compose down"
else
    echo "❌ Container failed to start. Check logs:"
    docker-compose logs
fi

# Show container status
echo ""
echo "📊 Container Status:"
docker-compose ps