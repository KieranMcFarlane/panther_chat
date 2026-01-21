#!/bin/bash

# Local testing script for Yellow Panther Voice Agent

echo "🧪 Testing Yellow Panther Voice Agent locally..."

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Error: OPENAI_API_KEY environment variable is required"
    echo "Please set: export OPENAI_API_KEY=your_openai_api_key"
    exit 1
fi

# Set required environment variables for local testing
export LIVEKIT_URL="wss://yellow-panther-8i644ma6.livekit.cloud"
export LIVEKIT_API_KEY="APIioqpEJhEjDsE"
export LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-your_livekit_api_secret}"
export CLAUDE_AGENT_URL="http://localhost:3005/api/claude-agent/activity"

echo "🔧 Configuration:"
echo "   - LiveKit URL: $LIVEKIT_URL"
echo "   - API Key: $LIVEKIT_API_KEY"
echo "   - Claude Agent URL: $CLAUDE_AGENT_URL"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start the agent locally
echo "🚀 Starting agent locally..."
echo ""
echo "📝 Agent will join room: ${1:-yellow-panther-test-room}"
echo "👤 Agent participant name: ${2:-claude-voice-agent}"
echo ""
echo "💡 To test:"
echo "   1. Make sure your Signal Noise App is running (npm run dev)"
echo "   2. Create a LiveKit room in your app"
echo "   3. Join the room to start talking with the agent"
echo ""
echo "⏹️  Press Ctrl+C to stop the agent"
echo ""

# Start the agent with command line arguments
node agent.js "${1:-yellow-panther-test-room}" "${2:-claude-voice-agent}"