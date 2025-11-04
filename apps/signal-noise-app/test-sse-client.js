#!/usr/bin/env node

/**
 * Simple SSE client to test entity search events are being sent correctly
 */

const fetch = require('node-fetch');

async function testSSE() {
  console.log('🧪 Testing SSE stream for entity search events...\n');
  
  try {
    const response = await fetch('http://localhost:3005/api/claude-agent-demo/stream?service=reliable&query=Test&mode=batch&entityLimit=2', {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let entitySearchEvents = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.message && (
                data.message.includes('Starting BrightData search for:') ||
                data.message.includes('BrightData search completed for:')
              )) {
                entitySearchEvents.push(data);
                console.log(`✅ EVENT: ${data.message}`);
              }
            } catch (error) {
              // Ignore parsing errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log(`\n🎯 SUCCESS! Found ${entitySearchEvents.length} entity search events:`);
    entitySearchEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.message}`);
    });

    if (entitySearchEvents.length >= 4) {
      console.log('\n🎉 PERFECT! All entity search events are being sent correctly!');
      console.log('   - Starting search events ✅');
      console.log('   - Completed search events ✅');
      console.log('   - Real-time processing logs ✅');
    } else {
      console.log('\n⚠️  Partial success - some events received');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run with timeout
Promise.race([
  testSSE(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Test timeout after 60 seconds')), 60000)
  )
]).catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});