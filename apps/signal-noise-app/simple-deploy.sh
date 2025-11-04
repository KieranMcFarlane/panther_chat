#!/bin/bash

# Simple deployment for MCP production system

echo "🚀 Deploying MCP System to Production"

# Build locally
echo "📦 Building locally..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Copy to server
echo "📁 Copying to server..."
scp -i ~/Downloads/panther_chat/yellowpanther.pem -o StrictHostKeyChecking=no -o ConnectTimeout=30 \
  -r .next \
  ec2-user@13.60.60.50:/home/ec2-user/yellow-panther-mcp/

# Start server
echo "🚀 Starting server..."
ssh -i ~/Downloads/panther_chat/yellowpanther.pem ec2-user@13.60.60.50 -o ConnectTimeout=30 \
  "cd /home/ec2-user/yellow-panther-mcp && pkill -f 'next' || true && NODE_ENV=production PORT=3005 nohup ./node_modules/.bin/next start > logs/nextjs.log 2>&1 &"

echo "✅ Deployment complete!"
echo "🌐 URL: http://13.60.60.50:3005/mcp-autonomous"

# Test
sleep 10
echo "🧪 Testing..."
curl -X POST http://13.60.60.50:3005/api/mcp-autonomous/test \
  -H 'Content-Type: application/json' \
  -d '{"testType":"neo4j"}' \
  --max-time 15 || echo "❌ Test failed"