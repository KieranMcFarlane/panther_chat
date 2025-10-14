#!/bin/bash

# Quick Production Deployment Script
set -e

SERVER_IP="13.60.60.50"
SSH_KEY="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/yellow-panther-mcp"

echo "🚀 Quick Deploy to Production Server"

# Build locally first
echo "📦 Building locally..."
npm run build

# Test SSH connection
echo "🔐 Testing SSH..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$REMOTE_USER@$SERVER_IP" "echo 'SSH OK'"

# Copy essential files
echo "📁 Copying files..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  .next/package.json \
  .next/next.config.js \
  "$REMOTE_USER@$SERVER_IP:$REMOTE_DIR/"

scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -r \
  .next \
  "$REMOTE_USER@$SERVER_IP:$REMOTE_DIR/"

# Start server
echo "🚀 Starting server..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
  "$REMOTE_USER@$SERVER_IP" \
  "cd $REMOTE_DIR && pkill -f 'next-server' || true && NODE_ENV=production PORT=3005 nohup npm start > logs/nextjs.log 2>&1 & echo 'Server started'"

echo "✅ Deployment complete!"
echo "🌐 URL: http://13.60.60.50:3005/mcp-autonomous"