/**
 * Debug test to isolate webhook hanging issue
 */

console.log('🔍 Debug: Testing webhook components...\n');

// Test 1: Simple health check
async function testHealthCheck() {
  console.log('📊 Test 1: Health Check');
  try {
    const response = await fetch('http://localhost:3005/api/mines/webhook');
    const result = await response.json();
    console.log('✅ Health check:', result.status);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return false;
  }
}

// Test 2: Minimal webhook payload
async function testMinimalWebhook() {
  console.log('\n📡 Test 2: Minimal Webhook');
  try {
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:3005/api/mines/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'linkedin',
        content: 'Test content',
        keywords: ['test'],
        timestamp: new Date().toISOString()
      })
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Response time: ${responseTime}ms`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook success:', result.status);
      console.log('🎯 Reasoning status:', result.reasoning_status);
      console.log('📧 Validation errors:', result.validation_errors || 'none');
      return true;
    } else {
      console.log('❌ Webhook failed:', response.status);
      try {
        const error = await response.json();
        console.log('📝 Error details:', error.error || error);
      } catch (e) {
        console.log('📝 Raw response:', await response.text());
      }
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook error:', error.message);
    return false;
  }
}

// Test 3: Test reasoning service directly
async function testReasoningService() {
  console.log('\n🧠 Test 3: Reasoning Service');
  try {
    const response = await fetch('http://localhost:3005/api/reasoning/service');
    const result = await response.json();
    console.log('✅ Reasoning service status:', result.service?.is_running ? 'running' : 'stopped');
    console.log('📊 Total entities:', result.service?.total_entities || 'unknown');
    console.log('🤖 Claude agent active:', result.service?.claude_agent_active || false);
    return true;
  } catch (error) {
    console.log('❌ Reasoning service test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runDebugTests() {
  console.log('🚀 WEBHOOK DEBUG TESTS');
  console.log('========================\n');
  
  const healthOk = await testHealthCheck();
  const reasoningOk = await testReasoningService();
  
  if (healthOk && reasoningOk) {
    console.log('\n🔧 Basic services are working, testing webhook...');
    const webhookOk = await testMinimalWebhook();
    
    if (webhookOk) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Webhook test failed - hanging issue detected');
    }
  } else {
    console.log('\n❌ Basic services are not working properly');
  }
}

runDebugTests().catch(console.error);