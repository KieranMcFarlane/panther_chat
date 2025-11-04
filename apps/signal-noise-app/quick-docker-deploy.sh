#!/bin/bash

# Quick Docker Deployment for MCP System
# Run this on your server after copying the files

echo "🐳 MCP Docker Quick Deploy"

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    newgrp docker
fi

# 2. Kill existing processes
echo "Cleaning up existing processes..."
pkill -f "next" || true
sudo lsof -ti:3005 | xargs sudo kill -9 2>/dev/null || true

# 3. Create simple Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3005
CMD ["sh", "-c", "npx next start -p 3005 -H 0.0.0.0"]
EOF

# 4. Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  mcp:
    build: .
    ports:
      - "3005:3005"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    container_name: mcp-system
EOF

# 5. Build and run
echo "Building container..."
docker-compose build

echo "Starting MCP system..."
docker-compose up -d

# 6. Check status
sleep 20
echo "Container status:"
docker-compose ps

echo ""
echo "🌐 MCP System should be available at:"
echo "   http://13.60.60.50:3005/mcp-autonomous"
echo ""
echo "📋 Logs: docker-compose logs -f"
echo "🛑 Stop: docker-compose down"