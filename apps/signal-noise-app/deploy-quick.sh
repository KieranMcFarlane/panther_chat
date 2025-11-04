#!/bin/bash
# Quick deploy with better exclusions
set -e

EC2_USER="ec2-user"
EC2_HOST="13.60.60.50"
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
LOCAL_DIR="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app"
REMOTE_DIR="/home/ec2-user/signal-noise-app"

echo "🚀 Quick deploy starting..."

# Test SSH
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "echo '✅ SSH OK'"

# Copy only what's needed
rsync -avz --progress \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude='venv*' \
  --exclude='pydantic*' \
  --exclude=logs \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude=__pycache__ \
  --exclude='*.pyc' \
  -e "ssh -i $PEM_FILE -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/" "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

echo "✅ Files copied!"
