const { MemoryClient } = require('mem0ai');
require('dotenv').config({ path: '.env.local' });

async function testMemoryIntegration() {
  try {
    console.log('🧠 Testing Mem0 Integration...');
    
    const memoryClient = new MemoryClient({
      apiKey: process.env.MEM0_API_KEY || 'm0-v08M6MKKztyngCm9FlNukXHbLlhaOx2lWyGQuPn7'
    });
    
    const userId = process.env.MEM0_USER_ID || 'user001';
    
    // Test adding a memory
    console.log('📝 Adding test memory...');
    const messages = [
      {
        role: 'user',
        content: 'Yellow Panther successfully integrated Mem0 for long-term memory capabilities'
      }
    ];
    
    await memoryClient.add(messages, {
      user_id: userId,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'yellow_panther_ai',
        type: 'system_integration'
      }
    });
    
    // Test searching memories
    console.log('🔍 Searching memories...');
    const searchResult = await memoryClient.search('Yellow Panther', {
      user_id: userId,
      limit: 5
    });
    
    console.log('✅ Memory integration test successful!');
    console.log(`Found ${searchResult.results?.length || 0} memories`);
    
    if (searchResult.results && searchResult.results.length > 0) {
      console.log('\n📋 Recent memories:');
      searchResult.results.forEach((memory, index) => {
        console.log(`${index + 1}. ${memory.memory}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Memory integration test failed:', error.message);
  }
}

testMemoryIntegration(); 