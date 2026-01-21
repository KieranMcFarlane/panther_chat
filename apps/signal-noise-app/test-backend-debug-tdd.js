#!/usr/bin/env node

/**
 * Targeted Test: Debug CopilotKit Backend Response Processing
 * 
 * This test will help us understand why the backend isn't streaming Claude Agent SDK responses
 */

const fetch = require('node-fetch');

async function testBackendProcessing() {
  console.log('🔍 Testing Backend CopilotKit Response Processing...\n');
  
  const testPayload = {
    data: {
      messages: [{
        id: `debug-test-${Date.now()}`,
        textMessage: {
          role: 'user',
          content: 'tell me about arsenal football club'
        }
      }],
      threadId: `debug-thread-${Date.now()}`,
      context: {
        emailState: {
          to: '',
          subject: '',
          content: ''
        }
      }
    }
  };

  console.log('📤 Sending test payload:', JSON.stringify(testPayload, null, 2));
  console.log('\n');

  try {
    const response = await fetch('http://localhost:3005/api/copilotkit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📄 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`\n📝 Raw Response Text (${responseText.length} chars):`);
    console.log('─'.repeat(80));
    console.log(responseText);
    console.log('─'.repeat(80));
    
    // Analyze the response
    const lines = responseText.split('\n').filter(line => line.trim());
    console.log(`\n📊 Response Analysis:`);
    console.log(`Total lines: ${lines.length}`);
    
    let textChunks = 0;
    let agentEvents = 0;
    let errorChunks = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`\nLine ${i + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
      
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          console.log(`  ✅ Valid JSON - Type: ${data.type || 'no-type'}`);
          
          if (data.type === 'text') textChunks++;
          else if (data.type.startsWith('agent')) agentEvents++;
          else if (data.type === 'error') errorChunks++;
          
        } catch (e) {
          console.log(`  ❌ Invalid JSON: ${e.message}`);
        }
      } else {
        console.log(`  ⚠️  Not a data line`);
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`- Text chunks: ${textChunks}`);
    console.log(`- Agent events: ${agentEvents}`);
    console.log(`- Error chunks: ${errorChunks}`);
    
    // Check if this is the generic response
    const isGenericResponse = responseText.includes('Hello! I\'m ready to help you with sports intelligence');
    if (isGenericResponse) {
      console.log(`\n🚨 ISSUE DETECTED: Generic response detected!`);
      console.log(`   This suggests the backend is not reaching the Claude Agent SDK processing logic.`);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Run the test
testBackendProcessing();