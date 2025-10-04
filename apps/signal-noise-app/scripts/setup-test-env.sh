#!/bin/bash

# Test Environment Setup Script
echo "🚀 Setting up test environment for AG-UI + Claude Code SDK integration"

# Check required dependencies
echo "📋 Checking dependencies..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js v18+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required"
    exit 1
fi

# Install Claude Code SDK
echo "📦 Installing Claude Code SDK..."
npm install claude-code-sdk

# Check if package installation was successful
if npm list claude-code-sdk &> /dev/null; then
    echo "✅ Claude Code SDK installed successfully"
else
    echo "❌ Failed to install Claude Code SDK"
    exit 1
fi

# Create test environment file
echo "🔧 Creating test environment..."
cat > .env.test << EOF
# Test Configuration
ANTHROPIC_API_KEY=test_api_key_here
INBOUND_API_KEY=demoZddUekPUOokPVAIgILCUkljUXaLsKPWAKCSlYZBwyFntfqegGIsRBxVyjKvSkPjN
NEO4J_URI=neo4j+s://test.databases.neo4j.io
NEO4J_USERNAME=test_user
NEO4J_PASSWORD=test_password

# Test Mode
NODE_ENV=test
CLAUDE_SDK_TEST_MODE=true
AGUI_TEST_MODE=true
MOCK_EXTERNAL_APIS=true
EOF

echo "✅ Test environment created"
echo "📝 .env.test file created"
echo ""
echo "🎯 Next steps:"
echo "1. Update .env.test with your real API keys"
echo "2. Run: npm run test:setup"
echo "3. Run: npm run test:claude-agent"
echo "4. Run: npm run test:agui-integration"