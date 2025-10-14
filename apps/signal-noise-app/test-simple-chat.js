#!/usr/bin/env node

// Test script to verify the simple Claude Agent SDK integration
const fetch = require('node-fetch');

async function testSimpleChat() {
  console.log('🚀 Testing simple Claude Agent SDK chat integration...');
  
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
                id: 'simple_test_' + Date.now(),
                textMessage: {
                  role: 'user',
                  content: 'Hello! Can you help me understand how this works?'
                }
              }
            ],
            threadId: 'simple_test_' + Date.now()
          }
        }
      })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('Response length:', responseText.length);
      
      // Look for the actual content in the streaming response
      const contentMatch = responseText.match(/"content":\s*\["([^"]+)"\]/);
      if (contentMatch) {
        console.log('\n🤖 Claude Response (first 200 chars):');
        console.log(contentMatch[1].substring(0, 200) + (contentMatch[1].length > 200 ? '...' : ''));
      } else {
        console.log('Response preview (first 500 chars):');
        console.log(responseText.substring(0, 500) + '...');
      }
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSimpleChat().catch(console.error);