#!/usr/bin/env node

/**
 * Test different request formats to find one that works with our fix
 */

const fetch = require('node-fetch');

async function testRequestFormats() {
  console.log('🧪 Testing different request formats...\n');
  
  const formats = [
    {
      name: 'GraphQL Format (from frontend)',
      payload: {
        variables: {
          data: {
            messages: [{
              id: `test-gql-${Date.now()}`,
              textMessage: {
                role: 'user',
                content: 'who are arsenal?'
              }
            }],
            threadId: `thread-gql-${Date.now()}`,
            context: {
              emailState: {
                to: '',
                subject: '',
                content: ''
              }
            }
          }
        }
      }
    },
    {
      name: 'REST Format',
      payload: {
        messages: [{
          role: 'user',
          content: 'who are arsenal?',
          id: `test-rest-${Date.now()}`
        }],
        userId: `user-rest-${Date.now()}`,
        stream: true,
        context: {
          emailState: {
            to: '',
            subject: '',
            content: ''
          }
        }
      }
    },
    {
      name: 'Simple Prompt Format',
      payload: {
        prompt: 'who are arsenal?',
        userId: `user-simple-${Date.now()}`
      }
    }
  ];

  for (const format of formats) {
    console.log(`📤 Testing: ${format.name}`);
    
    try {
      const response = await fetch('http://localhost:3005/api/copilotkit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(format.payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        const responseText = await response.text();
        console.log(`   ✅ Success (${response.status}) - ${responseText.length} chars`);
        
        if (responseText.includes('Arsenal') || responseText.includes('football club')) {
          console.log(`   🎉 CLAUDE RESPONSE DETECTED!`);
          console.log(`   Preview: ${responseText.substring(0, 150)}...`);
          return format.name; // Found working format
        } else if (responseText.includes('Hello! I\'m ready to help')) {
          console.log(`   ⚠️  Generic response - fix not working`);
        } else {
          console.log(`   ❓ Unknown response format`);
        }
      } else {
        console.log(`   ❌ HTTP Error: ${response.status}`);
      }
        
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`   ⏰ Timeout - server might be processing`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('🏁 Test completed');
}

testRequestFormats();