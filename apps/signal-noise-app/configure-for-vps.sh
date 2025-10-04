#!/bin/bash

# Update Next.js configuration to use VPS backend
# Usage: ./configure-for-vps.sh [VPS_IP]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VPS_IP=${1:-"YOUR_VPS_IP"}
COPILOTKIT_ROUTE_FILE="src/app/api/copilotkit/route.ts"

echo -e "${BLUE}🔧 Configuring Next.js to use VPS Backend${NC}"
echo "=" * 50
echo -e "${BLUE}VPS IP:${NC} $VPS_IP"
echo "=" * 50

if [ "$VPS_IP" = "YOUR_VPS_IP" ]; then
    echo -e "${RED}❌ Please provide your VPS IP address${NC}"
    echo -e "${YELLOW}Usage: ./configure-for-vps.sh YOUR_VPS_IP${NC}"
    exit 1
fi

# Check if the CopilotKit route file exists
if [ ! -f "$COPILOTKIT_ROUTE_FILE" ]; then
    echo -e "${RED}❌ CopilotKit route file not found: $COPILOTKIT_ROUTE_FILE${NC}"
    exit 1
fi

# Backup the original file
cp "$COPILOTKIT_ROUTE_FILE" "${COPILOTKIT_ROUTE_FILE}.backup.$(date +%s)"
echo -e "${BLUE}📁 Backup created: ${COPILOTKIT_ROUTE_FILE}.backup.$(date +%s)${NC}"

# Update the webhook URL in the CopilotKit route
echo -e "${BLUE}🔄 Updating webhook URL to VPS...${NC}"

# Using sed to replace the webhook URL
sed -i.tmp "s|const CLAUDE_WEBHOOK_URL = \"http://localhost:8001/webhook/chat\"|const CLAUDE_WEBHOOK_URL = \"http://${VPS_IP}:8001/webhook/chat\"|g" "$COPILOTKIT_ROUTE_FILE"

# Remove temporary file
rm -f "${COPILOTKIT_ROUTE_FILE}.tmp"

echo -e "${GREEN}✅ Updated webhook URL to: http://${VPS_IP}:8001/webhook/chat${NC}"

# Verify the change
if grep -q "http://${VPS_IP}:8001/webhook/chat" "$COPILOTKIT_ROUTE_FILE"; then
    echo -e "${GREEN}✅ Configuration updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to update configuration${NC}"
    echo -e "${YELLOW}Please manually update the CLAUDE_WEBHOOK_URL in $COPILOTKIT_ROUTE_FILE${NC}"
    exit 1
fi

# Create a test script to verify the VPS connection
cat > "test-vps-connection.js" << EOF
// Test VPS connection script
// Run with: node test-vps-connection.js

const http = require('http');

const VPS_IP = '$VPS_IP';
const WEBHOOK_URL = \`http://\${VPS_IP}:8001/health\`;

console.log('🧪 Testing VPS connection...');
console.log(\`📡 Testing: \${WEBHOOK_URL}\`);

const options = {
  hostname: VPS_IP,
  port: 8001,
  path: '/health',
  method: 'GET',
  timeout: 10000
};

const req = http.request(options, (res) => {
  console.log(\`📊 Status: \${res.statusCode}\`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ VPS server is running!');
      console.log(\`   Status: \${result.status}\`);
      console.log(\`   MCP Servers: \${result.mcp_servers || 0}\`);
    } catch (e) {
      console.log('⚠️  Unexpected response format:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('   • Check if VPS is running: ssh -i yellowpanther.pem root@VPS_IP "sudo systemctl status claude-webhook"');
  console.log('   • Check firewall: ssh -i yellowpanther.pem root@VPS_IP "sudo ufw status"');
  console.log('   • Check port: ssh -i yellowpanther.pem root@VPS_IP "netstat -tlnp | grep 8001"');
});

req.on('timeout', () => {
  console.error('❌ Connection timeout');
  req.destroy();
});

req.end();
EOF

echo ""
echo -e "${GREEN}🎉 Configuration updated successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Configuration Summary:${NC}"
echo -e "   • VPS Backend: ${GREEN}http://${VPS_IP}:8001${NC}"
echo -e "   • Webhook URL: ${GREEN}http://${VPS_IP}:8001/webhook/chat${NC}"
echo -e "   • Health Check: ${GREEN}http://${VPS_IP}:8001/health${NC}"
echo ""
echo -e "${BLUE}🧪 Test the connection:${NC}"
echo -e "   ${YELLOW}node test-vps-connection.js${NC}"
echo ""
echo -e "${BLUE}🚀 Start your Next.js app:${NC}"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo -e "${BLUE}🔄 Integration Flow:${NC}"
echo -e "   CopilotKit Chat → Next.js → VPS Backend (${VPS_IP}:8001) → Claude Agent SDK"
echo ""