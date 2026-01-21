#!/usr/bin/env node

/**
 * TDD Test: Server Message Parsing
 * Test that our actual server correctly parses CopilotKit requests
 */

const http = require('http');

const testData = {
  variables: {
    data: {
      messages: [
        {
          id: 'test-msg-1',
          textMessage: {
            role: 'user',
            content: 'make this email more professional'
          }
        }
      ],
      threadId: 'test-thread-123'
    }
  }
};

console.log('🧪 Testing Server Message Parsing\n');
console.log('Sending test request to /api/copilotkit...');
console.log('Test data:', JSON.stringify(testData, null, 2));

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/copilotkit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`\n📡 Response Status: ${res.statusCode}`);
  console.log('Response Headers:', res.headers);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    process.stdout.write(chunk);
  });
  
  res.on('end', () => {
    console.log('\n\n✅ Request completed');
    console.log('Check server logs for:');
    console.log('- 🔍 Raw CopilotKit request body');
    console.log('- Message parsing success');
    console.log('- Claude Agent SDK processing');
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  if (error.code === 'ECONNREFUSED') {
    console.log('\n💡 Make sure the dev server is running on port 3005');
    console.log('   Run: npm run dev');
  }
});

req.on('timeout', () => {
  console.error('❌ Request timed out');
  req.destroy();
});

req.setTimeout(30000); // 30 second timeout
req.write(postData);
req.end();

console.log('\n⏳ Waiting for response...');