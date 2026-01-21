// Browser console test script for debugging 404 errors
// Copy and paste this into the browser console on http://localhost:3005/minimal-test

async function testMinimalAPI() {
  console.log('🧪 Starting browser API test...');
  
  // Test message sequence
  const messages = [
    'hi',
    'how is arsenal doing?',
    'tell me about chelsea'
  ];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    console.log(`\n📤 Test ${i + 1}: Sending "${message}"`);
    
    try {
      const response = await fetch('/api/copilotkit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables: {
            data: {
              messages: [
                {
                  id: `test_${Date.now()}_${i}`,
                  textMessage: {
                    role: 'user',
                    content: message
                  }
                }
              ],
              threadId: `browser_test_${i}`
            }
          }
        })
      });

      console.log(`✅ Response status: ${response.status}`);
      console.log(`✅ Response ok: ${response.ok}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`❌ HTTP Error! status: ${response.status}`);
        console.error(`❌ Status text: ${response.statusText}`);
        
        // Try to get error body
        try {
          const errorText = await response.text();
          console.error(`❌ Error body:`, errorText);
        } catch (e) {
          console.error(`❌ Could not read error body:`, e);
        }
        
        continue;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        console.error('❌ No response body reader available');
        continue;
      }

      let buffer = '';
      let chunkCount = 0;
      
      console.log('🔄 Starting to read stream...');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`🏁 Stream ${i + 1} completed`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              chunkCount++;
              const chunk = JSON.parse(line.slice(6));
              console.log(`📦 Chunk ${chunkCount}:`, chunk.type);
            } catch (parseError) {
              console.error('❌ Parse error:', parseError);
            }
          }
        }
      }
      
      console.log(`📊 Stream ${i + 1} summary: ${chunkCount} chunks processed`);
      
    } catch (error) {
      console.error(`❌ Request ${i + 1} failed:`, error);
      console.error(`❌ Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Wait between requests
    if (i < messages.length - 1) {
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log('🎉 Browser test completed!');
}

// Auto-run the test
testMinimalAPI();

console.log('📝 Test script loaded. Check console for results...');