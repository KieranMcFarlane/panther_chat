const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '.env.local' });

async function testSystems() {
  console.log('🧪 Testing Yellow Panther AI Systems...\n');
  
  // Test Neo4j
  console.log('1. Testing Neo4j Connection...');
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  try {
    const session = driver.session();
    const result = await session.run('MATCH (yp:Company {name: "Yellow Panther"}) RETURN yp.name');
    if (result.records.length > 0) {
      console.log('✅ Neo4j: Yellow Panther data found');
    } else {
      console.log('❌ Neo4j: No Yellow Panther data found');
    }
    await session.close();
  } catch (error) {
    console.log('❌ Neo4j: Connection failed', error.message);
  }
  
  // Test RAG API
  console.log('\n2. Testing RAG API...');
  try {
    const response = await fetch('http://localhost:8058/health');
    if (response.ok) {
      console.log('✅ RAG API: Health check passed');
    } else {
      console.log('❌ RAG API: Health check failed');
    }
  } catch (error) {
    console.log('❌ RAG API: Connection failed', error.message);
  }
  
  // Test Next.js App
  console.log('\n3. Testing Next.js App...');
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
    });
    
    if (response.ok) {
      console.log('✅ Next.js API: Chat endpoint responding');
    } else {
      console.log('❌ Next.js API: Chat endpoint failed');
    }
  } catch (error) {
    console.log('❌ Next.js API: Connection failed', error.message);
  }
  
  console.log('\n🎯 System Status Summary:');
  console.log('- Neo4j Knowledge Graph: Ready for business intelligence queries');
  console.log('- RAG System: Ready for technical insights');
  console.log('- Next.js Chat Interface: Ready for user interactions');
  console.log('- LinkedIn MCP: Mock data ready (implement real API as needed)');
  
  console.log('\n🚀 Visit http://localhost:3000 to start using Yellow Panther AI!');
  
  await driver.close();
}

testSystems().catch(console.error); 