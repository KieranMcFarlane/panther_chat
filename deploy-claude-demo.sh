#!/bin/bash

# Claude Agent Demo Deployment Script
# Run this on your server after SSH connection

echo "🚀 Deploying Claude Agent SDK Demo to Server..."

# Create demo directory
mkdir -p /home/ubuntu/claude-agent-demo
cd /home/ubuntu/claude-agent-demo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create package.json
cat > package.json << 'EOF'
{
  "name": "claude-agent-demo",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev -p 3005",
    "build": "next build",
    "start": "next start -p 3005"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@anthropic-ai/claude-agent-sdk": "latest",
    "tailwindcss": "^3.0.0",
    "lucide-react": "^0.263.1"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set environment variables (update these with your actual values)
cat > .env << 'EOF'
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
BRIGHTDATA_API_TOKEN=your-brightdata-token
BRIGHTDATA_ZONE=linkedin_posts_monitor
PERPLEXITY_API_KEY=your-perplexity-key
NEXTAUTH_URL=http://13.60.60.50:3005
NEXTAUTH_SECRET=your-secret-key
EOF

echo "✅ Claude Agent Demo deployed successfully!"
echo "🔗 Update .env file with your actual API keys"
echo "🌐 Start with: npm run dev"  
echo "📍 Access at: http://13.60.60.50:3005/claude-agent-demo"
echo ""
echo "📝 To upload the demo files from your local machine:"
echo "scp -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem -r /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/ ubuntu@13.60.60.50:/home/ubuntu/claude-agent-demo/"