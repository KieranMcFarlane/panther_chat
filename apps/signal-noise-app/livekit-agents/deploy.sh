#!/bin/bash

# Yellow Panther Voice Agent Deployment Script
# This script deploys the voice agent to LiveKit Cloud

echo "🚀 Deploying Yellow Panther Voice Agent to LiveKit Cloud..."

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY environment variable is required"
    echo "Please set: export OPENAI_API_KEY=your_openai_api_key"
    exit 1
fi

if [ -z "$LIVEKIT_API_SECRET" ]; then
    echo "❌ Error: LIVEKIT_API_SECRET environment variable is required"
    echo "Please set: export LIVEKIT_API_SECRET=your_livekit_api_secret"
    exit 1
fi

# Install dependencies
echo "📦 Installing agent dependencies..."
npm install

# Deploy the agent
echo "🌐 Deploying agent to LiveKit Cloud..."

# Using the LiveKit CLI to deploy
lk agent deploy \
    --name yellow-panther-voice-agent \
    --config agent.json \
    --environment LIVEKIT_API_KEY=APIioqpEJhEjDsE \
    --environment LIVEKIT_URL=wss://yellow-panther-8i644ma6.livekit.cloud \
    --environment CLAUDE_AGENT_URL=https://your-app-domain.com/api/claude-agent/activity \
    --region "us-central1" \
    --machine "e2-standard-4"

if [ $? -eq 0 ]; then
    echo "✅ Agent deployed successfully!"
    echo ""
    echo "📋 Agent Details:"
    echo "   - Name: yellow-panther-voice-agent"
    echo "   - URL: wss://yellow-panther-8i644ma6.livekit.cloud"
    echo "   - Region: us-central1"
    echo "   - Machine: e2-standard-4"
    echo ""
    echo "🔗 You can now use this agent in your Signal Noise App!"
    echo ""
    echo "📖 Usage:"
    echo "   1. Create a LiveKit room in your app"
    echo "   2. The agent will automatically join when users join"
    echo "   3. Users can talk naturally with Claude Agent via voice"
    echo ""
else
    echo "❌ Deployment failed!"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check your LiveKit Cloud credentials"
    echo "   - Verify your network connection"
    echo "   - Ensure you have sufficient permissions"
    echo ""
    echo "📞 For support, check LiveKit Cloud documentation"
    exit 1
fi