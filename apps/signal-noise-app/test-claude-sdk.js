#!/usr/bin/env node

// Test script to verify Claude Agent SDK integration with Z.AI API
const fetch = require('node-fetch');

async function testClaudeSDK() {
  console.log('🚀 Testing Claude Agent SDK with Z.AI API...');
  
  // Test the CopilotKit endpoint directly
  console.log('\n1. Testing CopilotKit endpoint...');
  try {
    const response = await fetch('http://localhost:3005/api/copilotkit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variables: {
          data: {
            messages: [
              {
                id: 'test_msg_' + Date.now(),
                textMessage: {
                  role: 'user',
                  content: 'What does the knowledge graph say about Arsenal?'
                }
              }
            ],
            threadId: 'test_thread_' + Date.now()
          }
        }
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const text = await response.text();
      console.log('Response length:', text.length);
      console.log('Response preview:', text.substring(0, 200) + '...');
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('CopilotKit test failed:', error.message);
  }

  // Test the activity endpoint
  console.log('\n2. Testing Claude Agent activity endpoint...');
  try {
    const response = await fetch('http://localhost:3005/api/claude-agent/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What does the knowledge graph say about Arsenal?',
        sessionId: 'test_session_' + Date.now()
      })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Activity response:', result);
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('Activity endpoint test failed:', error.message);
  }

  // Test if we can get a simple response from the Z.AI API through our system
  console.log('\n3. Testing basic Claude API functionality...');
  try {
    const response = await fetch('http://localhost:3005/api/claude-agents/test-z-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello, this is a test message'
      })
    });

    console.log('Test API status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Test API response:', result);
    } else {
      const error = await response.text();
      console.log('Test API error:', error);
    }
  } catch (error) {
    console.error('Test API failed:', error.message);
  }
}

testClaudeSDK().catch(console.error);