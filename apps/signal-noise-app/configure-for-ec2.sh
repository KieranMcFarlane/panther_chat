#!/bin/bash

# Update Next.js configuration to use EC2 backend
# Usage: ./configure-for-ec2.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Your AWS EC2 Configuration
VPS_IP="13.60.60.50"
COPILOTKIT_ROUTE_FILE="src/app/api/copilotkit/route.ts"

echo -e "${BLUE}🔧 Configuring Next.js to use EC2 Backend${NC}"
echo "=" * 50
echo -e "${BLUE}EC2 IP:${NC} $VPS_IP"
echo "=" * 50

# Check if the CopilotKit route file exists
if [ ! -f "$COPILOTKIT_ROUTE_FILE" ]; then
    echo -e "${RED}❌ CopilotKit route file not found: $COPILOTKIT_ROUTE_FILE${NC}"
    exit 1
fi

# Backup the original file
cp "$COPILOTKIT_ROUTE_FILE" "${COPILOTKIT_ROUTE_FILE}.backup.$(date +%s)"
echo -e "${BLUE}📁 Backup created: ${COPILOTKIT_ROUTE_FILE}.backup.$(date +%s)${NC}"

# Update the webhook URL in the CopilotKit route
echo -e "${BLUE}🔄 Updating webhook URL to EC2...${NC}"

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

# Create a test script to verify the EC2 connection
cat > "test-ec2-connection.js" << EOF
// Test EC2 connection script
// Run with: node test-ec2-connection.js

const http = require('http');

const EC2_IP = '$VPS_IP';
const WEBHOOK_URL = \`http://\${EC2_IP}:8001/health\`;

console.log('🧪 Testing EC2 connection...');
console.log(\`📡 Testing: \${WEBHOOK_URL}\`);

const options = {
  hostname: EC2_IP,
  port: 8001,
  path: '/health',
  method: 'GET',
  timeout: 15000
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
      console.log('✅ EC2 server is running!');
      console.log(\`   Status: \${result.status}\`);
      console.log(\`   MCP Servers: \${result.mcp_servers || 0}\`);
      console.log('');
      console.log('🚀 Ready to integrate with Next.js!');
    } catch (e) {
      console.log('⚠️  Unexpected response format:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('');
  console.log('🔧 AWS EC2 Troubleshooting:');
  console.log('   • Check if EC2 instance is running');
  console.log('   • Check security group allows port 8001');
  console.log('   • Verify service status: ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo systemctl status claude-webhook"');
  console.log('   • Check logs: ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo journalctl -u claude-webhook -f"');
  console.log('');
  console.log('💡 AWS Security Group Configuration:');
  console.log('   1. Go to AWS Console → EC2 → Security Groups');
  console.log('   2. Select your instance\'s security group');
  console.log('   3. Add inbound rule:');
  console.log('      - Type: HTTP');
  console.log('      - Port: 8001');
  console.log('      - Source: 0.0.0.0/0 (or your IP)');
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
echo -e "${BLUE}📋 EC2 Configuration Summary:${NC}"
echo -e "   • EC2 Backend: ${GREEN}http://$VPS_IP:8001${NC}"
echo -e "   • Webhook URL: ${GREEN}http://$VPS_IP:8001/webhook/chat${NC}"
echo -e "   • Health Check: ${GREEN}http://$VPS_IP:8001/health${NC}"
echo ""
echo -e "${BLUE}🧪 Test the connection:${NC}"
echo -e "   ${YELLOW}node test-ec2-connection.js${NC}"
echo ""
echo -e "${BLUE}🚀 Start your Next.js app:${NC}"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo -e "${BLUE}🔄 Integration Flow:${NC}"
echo -e "   CopilotKit Chat → Next.js (localhost:3005) → EC2 Backend ($VPS_IP:8001) → Claude Agent SDK → Custom API"
echo ""
echo -e "${YELLOW}⚠️  Remember to configure AWS Security Group:${NC}"
echo -e "   Allow inbound traffic on port 8001 for HTTP access"
echo ""