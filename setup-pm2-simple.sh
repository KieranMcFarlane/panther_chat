#!/bin/bash

REMOTE_HOST="212.86.105.190"

echo "🔧 Setting up PM2 for Yellow Panther AI..."

# Create a simple remote setup script
cat > /tmp/pm2-setup.sh << 'REMOTE_SCRIPT'
#!/bin/bash

echo "🚀 Setting up PM2 for Yellow Panther AI..."

# Navigate to the project directory
cd /opt/yellow-panther-ai

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Kill any existing processes
echo "🔄 Stopping existing processes..."
pkill -f "next.*3217" || true
pkill -f "node.*3217" || true
sleep 3

# Stop any existing PM2 processes
pm2 stop yellow-panther-ai 2>/dev/null || true
pm2 delete yellow-panther-ai 2>/dev/null || true

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start with PM2
echo "🎯 Starting Yellow Panther AI with PM2..."
pm2 start npm --name "yellow-panther-ai" -- run dev -- -p 3217 -H 0.0.0.0

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
echo "✅ PM2 startup configured"

# Wait for startup
echo "⏳ Waiting for application to start..."
sleep 10

# Test the application
echo "🧪 Testing application..."
if curl -s http://localhost:3217 > /dev/null; then
    echo "✅ Application is running successfully!"
else
    echo "❌ Application failed to start"
    pm2 logs yellow-panther-ai --lines 10
fi

# Show status
echo "📊 PM2 Status:"
pm2 status

echo "🎉 PM2 setup complete!"
REMOTE_SCRIPT

# Copy and execute the script
echo "📤 Copying PM2 setup script..."
scp /tmp/pm2-setup.sh root@$REMOTE_HOST:/tmp/

echo "🚀 Executing PM2 setup..."
ssh root@$REMOTE_HOST "chmod +x /tmp/pm2-setup.sh && /tmp/pm2-setup.sh"

# Test the deployment
echo "🧪 Testing external access..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://$REMOTE_HOST:3217 | grep -q "200"; then
    echo "✅ External access successful!"
else
    echo "❌ External access failed"
fi

echo ""
echo "🎉 PM2 Setup Complete!"
echo "🌐 Yellow Panther AI Dashboard: http://$REMOTE_HOST:3217"
echo ""
echo "🔧 PM2 Commands:"
echo "   • Status: ssh root@$REMOTE_HOST 'pm2 status'"
echo "   • Logs: ssh root@$REMOTE_HOST 'pm2 logs yellow-panther-ai'"
echo "   • Restart: ssh root@$REMOTE_HOST 'pm2 restart yellow-panther-ai'"
echo "   • Monitor: ssh root@$REMOTE_HOST 'pm2 monit'" 