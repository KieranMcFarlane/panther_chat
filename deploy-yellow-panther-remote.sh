#!/bin/bash

echo "🚀 Deploying Yellow Panther AI to Remote Server (Port 3217)"
echo "============================================================="

# Configuration
REMOTE_HOST="212.86.105.190"
REMOTE_PORT="3217"
REMOTE_DIR="/opt/yellow-panther-ai"
LOCAL_DIR="yellow-panther-ai"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📋 Deployment Details:${NC}"
echo "• Remote Host: $REMOTE_HOST"
echo "• Remote Port: $REMOTE_PORT"
echo "• Remote Directory: $REMOTE_DIR"
echo "• Local Directory: $LOCAL_DIR"

# Step 1: Create deployment package
echo -e "\n${YELLOW}📦 Creating deployment package...${NC}"
tar -czf yellow-panther-deployment.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=*.log \
  --exclude=dist \
  --exclude=build \
  --exclude=venv \
  --exclude=__pycache__ \
  --exclude=*.pyc \
  -C $LOCAL_DIR .

# Step 2: Upload to server
echo -e "\n${YELLOW}📤 Uploading to server...${NC}"
scp yellow-panther-deployment.tar.gz root@$REMOTE_HOST:/tmp/

# Step 3: Deploy on server
echo -e "\n${YELLOW}🔧 Deploying on server...${NC}"
ssh root@$REMOTE_HOST << 'EOF'
  set -e
  
  echo "🏗️ Setting up project directory..."
  sudo mkdir -p /opt/yellow-panther-ai
  cd /opt/yellow-panther-ai
  
  echo "📦 Extracting deployment package..."
  sudo tar -xzf /tmp/yellow-panther-deployment.tar.gz
  
  echo "📦 Installing Node.js dependencies..."
  sudo npm install
  
  echo "🔧 Killing any existing processes on port 3217..."
  sudo pkill -f "next.*3217" || true
  sudo pkill -f "node.*3217" || true
  sleep 2
  
  echo "🚀 Starting Yellow Panther AI on port 3217..."
  export PORT=3217
  sudo nohup npm run dev -- -p 3217 -H 0.0.0.0 > yellow-panther-3217.log 2>&1 &
  echo $! > yellow-panther-3217.pid
  echo "✅ Started with PID: $(cat yellow-panther-3217.pid)"
  
  echo "⏳ Waiting for service to start..."
  sleep 15
  
  echo "🧪 Testing service..."
  if curl -s http://localhost:3217 > /dev/null; then
    echo "✅ Yellow Panther AI is running on port 3217"
  else
    echo "❌ Service failed to start"
    echo "📋 Checking logs..."
    tail -20 yellow-panther-3217.log
  fi
  
  echo "🔓 Checking firewall..."
  if ufw status | grep -q "3217"; then
    echo "✅ Port 3217 is already open in firewall"
  else
    echo "🔓 Opening port 3217 in firewall..."
    ufw allow 3217/tcp
  fi
  
  echo "🎉 Deployment completed!"
  echo ""
  echo "📊 Service URLs:"
  echo "• Yellow Panther AI: http://212.86.105.190:3217"
  echo "• Global Sports DB: http://212.86.105.190:3217/premier-league-intel/global-sports"
  echo ""
  echo "🔧 Useful commands:"
  echo "   • View logs: tail -f yellow-panther-3217.log"
  echo "   • Stop service: kill \$(cat yellow-panther-3217.pid)"
  echo "   • Restart service: cd /opt/yellow-panther-ai && npm run dev -- -p 3217 -H 0.0.0.0"
EOF

# Step 4: Test the deployment
echo -e "\n${YELLOW}🧪 Testing remote deployment...${NC}"
sleep 5

if curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:$REMOTE_PORT | grep -q "200"; then
    echo -e "${GREEN}✅ Yellow Panther AI is now running successfully on port $REMOTE_PORT${NC}"
    echo -e "${GREEN}🌐 Access URL: http://$REMOTE_HOST:$REMOTE_PORT${NC}"
    echo -e "${GREEN}🌍 Global Sports DB: http://$REMOTE_HOST:$REMOTE_PORT/premier-league-intel/global-sports${NC}"
else
    echo -e "${RED}❌ Service not responding on port $REMOTE_PORT${NC}"
    echo "📋 Checking remote logs..."
    ssh root@$REMOTE_HOST "tail -20 $REMOTE_DIR/yellow-panther-3217.log"
fi

# Step 5: Cleanup
echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
rm yellow-panther-deployment.tar.gz

echo -e "\n${GREEN}✅ Deployment completed!${NC}"
echo ""
echo "🌐 Access your services:"
echo "• Yellow Panther AI: http://$REMOTE_HOST:$REMOTE_PORT"
echo "• Global Sports DB: http://$REMOTE_HOST:$REMOTE_PORT/premier-league-intel/global-sports"
echo ""
echo "🔗 Everything is now deployed and accessible!" 