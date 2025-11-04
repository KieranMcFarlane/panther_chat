// Test EC2 connection script
// Run with: node test-ec2-connection.js

const http = require('http');

const EC2_IP = '13.60.60.50';
const WEBHOOK_URL = `http://${EC2_IP}:8001/health`;

console.log('🧪 Testing EC2 connection...');
console.log(`📡 Testing: ${WEBHOOK_URL}`);

const options = {
  hostname: EC2_IP,
  port: 8001,
  path: '/health',
  method: 'GET',
  timeout: 15000
};

const req = http.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ EC2 server is running!');
      console.log(`   Status: ${result.status}`);
      console.log(`   MCP Servers: ${result.mcp_servers || 0}`);
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
