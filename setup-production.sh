#!/bin/bash

# 🔐 SSH Setup and Production Deployment for Level 3 Autonomous System
# Server: 13.60.60.50 | User: kieranmcfarlane

echo "🔐 SSH Setup and Production Deployment"
echo "======================================="
echo "Server: 13.60.60.50"
echo "User: kieranmcfarlane"
echo "System: Level 3 Autonomous RFP Intelligence"
echo ""

# Step 1: Test SSH Connection
echo "📡 Step 1: Testing SSH Connection..."
echo "Command: ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem kieranmcfarlane@13.60.60.50"
echo ""

# SSH command to test connection
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem -o ConnectTimeout=10 -o StrictHostKeyChecking=no kieranmcfarlane@13.60.60.50 "echo 'SSH Connection Successful!' && whoami && pwd && date"