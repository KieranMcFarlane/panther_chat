#!/usr/bin/env node

const http = require('http');

// Function to test sending a message to the API
async function testRequest(messageText, testName) {
  console.log(`\n🧪 Testing ${testName}: "${messageText}"`);
  
  const requestData = JSON.stringify({
    variables: {
      data: {
        messages: [
          {
            id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            textMessage: {
              role: 'user',
              content: messageText
            }
          }
        ],
        threadId: `minimal_test_${Date.now()}`
      }
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3005,
    path: '/api/copilotkit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`✅ ${testName} - Status: ${res.statusCode}`);
      console.log(`✅ ${testName} - Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ ${testName} - Response length: ${data.length} characters`);
        if (data.length > 0 && data.length < 500) {
          console.log(`✅ ${testName} - Response preview:`, data.substring(0, 200) + '...');
        }
        resolve({ status: res.statusCode, success: res.statusCode === 200, responseLength: data.length });
      });
    });

    req.on('error', (error) => {
      console.error(`❌ ${testName} - Request error:`, error);
      reject(error);
    });

    req.on('timeout', () => {
      console.error(`❌ ${testName} - Request timeout`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(60000); // 60 second timeout
    req.write(requestData);
    req.end();
  });
}

// Test sequence
async function runTests() {
  console.log('🚀 Starting API request tests...\n');
  
  try {
    // Test 1: First request
    await testRequest('hi', 'First Request');
    
    // Wait 2 seconds
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Second request (this is where the 404 was reported)
    await testRequest('how is arsenal doing?', 'Second Request');
    
    // Wait 2 seconds
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Third request
    await testRequest('tell me about chelsea', 'Third Request');
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n💥 Test sequence failed:', error);
  }
}

// Run the tests
runTests();