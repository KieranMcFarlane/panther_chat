#!/usr/bin/env node

// Test script to get the actual response from Claude about Arsenal
const fetch = require('node-fetch');

async function testArsenalQuery() {
  console.log('🔍 Testing Arsenal knowledge graph query...');
  
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
                id: 'arsenal_test_' + Date.now(),
                textMessage: {
                  role: 'user',
                  content: 'What does the knowledge graph say about Arsenal?'
                }
              }
            ],
            threadId: 'arsenal_test_' + Date.now()
          }
        }
      })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const responseText = await response.text();
      
      // Try to parse as JSON
      try {
        const responseJson = JSON.parse(responseText);
        
        // Extract the actual message content
        if (responseJson.data && responseJson.data.generateCopilotResponse && responseJson.data.generateCopilotResponse.messages) {
          const messages = responseJson.data.generateCopilotResponse.messages;
          for (const msg of messages) {
            if (msg.content && msg.content.length > 0) {
              console.log('\n🤖 Claude Response:');
              console.log(msg.content[0]); // First element of content array
              break;
            }
          }
        } else {
          console.log('Response structure:', JSON.stringify(responseJson, null, 2).substring(0, 1000) + '...');
        }
      } catch (parseError) {
        console.log('Raw response (first 1000 chars):');
        console.log(responseText.substring(0, 1000) + '...');
      }
    } else {
      const error = await response.text();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testArsenalQuery().catch(console.error);