// Test the full integration from Next.js to EC2 backend
// Run with: node test-full-integration.js

const http = require('http');

const EC2_IP = '13.60.60.50';
const WEBHOOK_URL = `http://${EC2_IP}:8001/webhook/chat/no-stream`;

console.log('🧪 Testing full integration: Next.js → EC2 Backend → Claude API');
console.log(`📡 Testing: ${WEBHOOK_URL}`);
console.log('');

const testRequest = {
  messages: [
    { role: 'user', content: 'Hello! Can you tell me a short joke?' }
  ],
  context: {},
  userId: 'test-user',
  stream: false
};

const postData = JSON.stringify(testRequest);

const options = {
  hostname: EC2_IP,
  port: 8001,
  path: '/webhook/chat/no-stream',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 30000
};

console.log('📤 Sending test request...');
console.log('💬 Message: "Hello! Can you tell me a short joke?"');
console.log('');

const req = http.request(options, (res) => {
  console.log(`📊 Response Status: ${res.statusCode}`);
  console.log(`📋 Response Headers:`, res.headers);
  console.log('');
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ Full integration test successful!');
      console.log('');
      console.log('🤖 Claude Response:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
      console.log('🎉 Your Next.js + CopilotKit + EC2 + Claude Agent SDK setup is working!');
      console.log('');
      console.log('🚀 Next Steps:');
      console.log('1. Open http://localhost:3005 in your browser');
      console.log('2. Navigate to a page with CopilotKit integration');
      console.log('3. Start chatting with Claude using your custom API!');
    } catch (e) {
      console.log('⚠️  Unexpected response format:', data);
      console.log('');
      console.log('🔧 Response details:');
      console.log(data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('• Check EC2 service status: ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo systemctl status claude-webhook"');
  console.log('• Check service logs: ssh -i yellowpanther.pem ec2-user@13.60.60.50 "sudo journalctl -u claude-webhook -n 20"');
});

req.on('timeout', () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.write(postData);
req.end();