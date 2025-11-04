#!/bin/bash

# 🚀 Deploy Enhanced RFP Intelligence Backend to EC2
# This script deploys the PydanticAI-enhanced backend to your EC2 instance

echo "🚀 Starting deployment of Enhanced RFP Intelligence Backend..."

# Configuration
EC2_USER="ec2-user"
EC2_IP="13.60.60.50"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
LOCAL_BACKEND_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/backend"
REMOTE_BACKEND_DIR="/home/ec2-user/rfp-intelligence-backend"
SERVICE_NAME="rfp-intelligence-backend"
SERVICE_PORT="8002"

echo "📦 Configuration:"
echo "  EC2: $EC2_USER@$EC2_IP"
echo "  Remote Directory: $REMOTE_BACKEND_DIR"
echo "  Service Port: $SERVICE_PORT"
echo ""

# Create remote directory
echo "📁 Creating remote directory..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "mkdir -p $REMOTE_BACKEND_DIR"

# Copy backend files to EC2
echo "📋 Copying backend files..."
scp -i $PEM_FILE $LOCAL_BACKEND_DIR/advanced_rfp_backend.py $EC2_USER@$EC2_IP:$REMOTE_BACKEND_DIR/
scp -i $PEM_FILE $LOCAL_BACKEND_DIR/requirements.txt $EC2_USER@$EC2_IP:$REMOTE_BACKEND_DIR/

# Install dependencies on EC2
echo "🔧 Installing dependencies..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "cd $REMOTE_BACKEND_DIR && pip3 install -r requirements.txt --user"

# Create environment file
echo "📝 Creating environment file..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "cat > $REMOTE_BACKEND_DIR/.env << 'EOF'
# Claude Agent Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_BASE_URL=
ANTHROPIC_AUTH_TOKEN=

# Neo4j Configuration
NEO4J_URI=neo4j+s://e6bb5665.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=NeO4jPaSSworD!
NEO4J_DATABASE=neo4j

# BrightData Configuration
BRIGHTDATA_TOKEN=your_brightdata_token_here
BRIGHTDATA_ZONE=your_brightdata_zone_here

# Server Configuration
HOST=0.0.0.0
PORT=$SERVICE_PORT
ENVIRONMENT=production
EOF"

# Create systemd service
echo "🔧 Creating systemd service..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << 'EOF'
[Unit]
Description=RFP Intelligence Backend with PydanticAI
After=network.target

[Service]
Type=simple
User=$EC2_USER
WorkingDirectory=$REMOTE_BACKEND_DIR
Environment=PATH=$EC2_USER/.local/bin:/usr/bin:/usr/local/bin
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

# Reload systemd and start service
echo "🚀 Starting service..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "sudo systemctl daemon-reload"
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "sudo systemctl enable $SERVICE_NAME"
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "sudo systemctl start $SERVICE_NAME"

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 5

# Check service status
echo "📊 Checking service status..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "sudo systemctl status $SERVICE_NAME --no-pager"

# Test the service
echo "🧪 Testing service health..."
ssh -i $PEM_FILE $EC2_USER@$EC2_IP "curl -s http://localhost:$SERVICE_PORT/health | python3 -m json.tool"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Service URLs:"
echo "  Health Check: http://$EC2_IP:$SERVICE_PORT/health"
echo "  API Docs: http://$EC2_IP:$SERVICE_PORT/docs"
echo "  Statistics: http://$EC2_IP:$SERVICE_PORT/stats"
echo ""
echo "📋 Next steps:"
echo "  1. Update environment variables in $REMOTE_BACKEND_DIR/.env"
echo "  2. Restart service: sudo systemctl restart $SERVICE_NAME"
echo "  3. Check logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "🔍 Test commands:"
echo "  curl http://$EC2_IP:$SERVICE_PORT/"
echo "  curl http://$EC2_IP:$SERVICE_PORT/health"
echo "  curl http://$EC2_IP:$SERVICE_PORT/stats"