#!/usr/bin/env node

/**
 * Debug the message filtering logic in CopilotKit route
 */

const testMessages = [
  'tell me about arsenal football club',
  'who are arsenal?',
  'make my email more professional',
  'query availableAgents {\n  availableAgents {\n    agents {\n      name\n      id\n      description\n      __typename\n    }\n    __typename\n  }\n}'
];

function testMessageFiltering() {
  console.log('🔍 Testing message filtering logic...\n');
  
  for (const testContent of testMessages) {
    console.log(`📝 Testing message: "${testContent.substring(0, 50)}${testContent.length > 50 ? '...' : ''}"`);
    
    // Simulate the filtering logic from the backend
    const msg = {
      role: 'user',
      content: testContent,
      id: 'test-id'
    };
    
    // Check if passes basic user message validation
    const basicUserCheck = msg.role === 'user' && msg.content.trim();
    console.log(`   ✅ Basic user check: ${basicUserCheck}`);
    
    if (!basicUserCheck) {
      console.log(`   ❌ FAILED: Not a valid user message or empty content\n`);
      continue;
    }
    
    // Check if identified as GraphQL query
    const content = msg.content.trim();
    const isGraphQLQuery1 = /^(query|mutation|subscription)\s+/i.test(content);
    const isGraphQLQuery2 = /\{\s*\w+\s*\{/.test(content);
    const isGraphQLQuery = isGraphQLQuery1 || isGraphQLQuery2;
    
    console.log(`   🔍 GraphQL regex 1: ${isGraphQLQuery1}`);
    console.log(`   🔍 GraphQL regex 2: ${isGraphQLQuery2}`);
    console.log(`   🔍 Is GraphQL query: ${isGraphQLQuery}`);
    
    const passesFilter = !isGraphQLQuery;
    console.log(`   ✅ Passes filter: ${passesFilter}`);
    
    if (passesFilter) {
      console.log(`   🎉 MESSAGE WOULD BE PROCESSED BY CLAUDE AGENT SDK`);
    } else {
      console.log(`   🚫 MESSAGE WOULD BE FILTERED OUT - RETURN GENERIC GREETING`);
    }
    
    console.log('');
  }
}

testMessageFiltering();