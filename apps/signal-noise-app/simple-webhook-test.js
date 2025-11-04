/**
 * Simple test for enhanced webhook
 */

const testData = {
  source: 'linkedin',
  content: 'Premier League is seeking a technology partner for next-generation digital fan engagement platform',
  keywords: ['premier league', 'technology partner', 'digital fan engagement'],
  timestamp: new Date().toISOString()
};

console.log('🧪 Testing Enhanced Webhook...');
console.log('Payload:', JSON.stringify(testData, null, 2));

fetch('http://localhost:3005/api/mines/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(result => {
  console.log('✅ Response:', JSON.stringify(result, null, 2));
})
.catch(error => {
  console.error('❌ Error:', error.message);
});