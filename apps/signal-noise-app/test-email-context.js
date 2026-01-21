#!/usr/bin/env node

/**
 * TDD Test: Email Context Request
 * Test that our system properly handles email improvement requests with context
 */

const http = require('http');

// This simulates what CopilotKit sends when user is on compose page
// and asks to improve an email
const emailContextTestData = {
  variables: {
    data: {
      messages: [
        {
          id: 'email-msg-1',
          textMessage: {
            role: 'user',
            content: 'make this email more professional'
          }
        }
      ],
      threadId: 'email-thread-456',
      // This is the key - email context from the compose page
      context: {
        emailState: {
          to: 'john.doe@company.com',
          subject: 'meeting tomorrow',
          content: 'hey john, wanna meet tomorrow to talk about the project? let me know what time works. cheers, alex'
        }
      }
    }
  }
};

console.log('🧪 Testing Email Context Processing\n');
console.log('Sending email context request to /api/copilotkit...');
console.log('Test data:', JSON.stringify(emailContextTestData, null, 2));

const postData = JSON.stringify(emailContextTestData);

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
  
  let responseData = '';
  let fullTextResponse = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    
    // Parse streaming data for text responses
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text' && data.text) {
            fullTextResponse += data.text;
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n✅ Email Context Request Completed');
    console.log('\n📧 Full AI Response:');
    console.log(fullTextResponse || 'No text response found');
    
    console.log('\n🔍 Expected Behavior:');
    console.log('✅ Message parsing should extract email context');
    console.log('✅ Claude Agent SDK should improve the email');
    console.log('✅ Response should contain professional email version');
    console.log('✅ Should maintain original meaning but improve tone');
    
    console.log('\n📊 Success Criteria:');
    if (fullTextResponse.includes('Dear') || fullTextResponse.includes('Sincerely') || 
        fullTextResponse.includes('Best regards') || fullTextResponse.includes('I would')) {
      console.log('🎉 PASSED: Response shows professional language');
    } else {
      console.log('❌ FAILED: Response doesn\'t show professional improvements');
    }
    
    if (fullTextResponse.length > 100) {
      console.log('🎉 PASSED: Response provides substantial content');
    } else {
      console.log('❌ FAILED: Response too short');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.setTimeout(60000); // 60 second timeout for email processing
req.write(postData);
req.end();

console.log('\n⏳ Processing email improvement request (this may take 30-60 seconds)...');