#!/usr/bin/env node

/**
 * Quick TDD Test: Verify CopilotKit Fix Status
 */

const fetch = require('node-fetch');

async function quickTest() {
  console.log('🚀 Quick test: CopilotKit response after fix...\n');
  
  const testPayload = {
    variables: {
      data: {
        messages: [{
          id: `quick-test-${Date.now()}`,
          textMessage: {
            role: 'user',
            content: 'who are arsenal?'
          }
        }],
        threadId: `quick-thread-${Date.now()}`
      }
    }
  };

  try {
    const response = await fetch('http://localhost:3005/api/copilotkit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      const responseText = await response.text();
      
      if (responseText.includes('tell me about arsenal') || responseText.includes('Arsenal')) {
        console.log('✅ SUCCESS: Claude Agent SDK response is coming through!');
        console.log('Response preview:', responseText.substring(0, 200) + '...');
      } else if (responseText.includes('Hello! I\'m ready to help you with sports intelligence')) {
        console.log('❌ ISSUE: Still getting generic response');
        console.log('This means the fix didn\'t work or there\'s a caching issue.');
      } else {
        console.log('⚠️  Unexpected response:', responseText.substring(0, 200) + '...');
      }
    } else {
      console.log(`❌ HTTP Error: ${response.status}`);
    }
      
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏰ Request timed out - server might be processing or stuck');
    } else {
      console.log('❌ Request failed:', error.message);
    }
  }
}

quickTest();