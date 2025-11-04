/**
 * Test enhanced webhook without reasoning service to isolate issues
 */

console.log('🧪 Testing Webhook Validation Only...\n');

const testCases = [
  {
    name: 'Valid LinkedIn webhook',
    data: {
      source: 'linkedin',
      content: 'Premier League seeking technology partner for digital transformation',
      keywords: ['premier league', 'technology partner'],
      timestamp: new Date().toISOString()
    }
  },
  {
    name: 'Valid procurement webhook',
    data: {
      source: 'procurement',
      content: 'Chelsea FC releases RFP for CRM system upgrade',
      keywords: ['chelsea fc', 'crm system', 'rfp'],
      timestamp: new Date().toISOString(),
      confidence: 0.95
    }
  },
  {
    name: 'Invalid source (should fail validation)',
    data: {
      source: 'invalid_source',
      content: 'Test content',
      keywords: ['test'],
      timestamp: new Date().toISOString()
    }
  }
];

async function runTests() {
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`📋 Test ${i + 1}: ${test.name}`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:3005/api/mines/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.data)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const result = await response.json();
      
      console.log(`   ⏱️  Response time: ${responseTime}ms`);
      console.log(`   📊 Status: ${response.status}`);
      
      if (response.ok) {
        console.log(`   ✅ Success: ${result.status}`);
        console.log(`   🎯 Keywords found: ${result.keywords_found}`);
        console.log(`   🚨 Alerts triggered: ${result.results?.alerts_triggered || 0}`);
        if (result.validation_errors?.length > 0) {
          console.log(`   ⚠️  Validation warnings: ${result.validation_errors.join(', ')}`);
        }
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        if (result.details) {
          console.log(`   📝 Details: ${result.details.substring(0, 100)}...`);
        }
      }
      
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
    }
    
    console.log('');
  }
}

runTests().then(() => {
  console.log('✅ Validation tests completed');
}).catch(error => {
  console.error('❌ Test suite failed:', error);
});