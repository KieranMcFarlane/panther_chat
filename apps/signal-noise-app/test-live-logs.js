#!/usr/bin/env node

/**
 * Test script for Live Agent Logs page
 * This simulates some log activity to test the streaming functionality
 */

const testLiveLogs = async () => {
  console.log('🧪 Testing Live Agent Logs functionality...\n');
  
  try {
    // Test 1: Check if the logs stream endpoint responds
    console.log('1. Testing logs stream endpoint...');
    const response = await fetch('http://localhost:3005/api/logs/stream?run_id=test_run&category=all&source=all');
    
    if (response.ok) {
      console.log('✅ Logs stream endpoint is accessible');
    } else {
      console.log('❌ Logs stream endpoint returned error:', response.status, response.statusText);
      return;
    }
    
    // Test 2: Check if the Live Agent Logs page loads
    console.log('\n2. Testing Live Agent Logs page...');
    const pageResponse = await fetch('http://localhost:3005/agent-logs');
    
    if (pageResponse.ok) {
      console.log('✅ Live Agent Logs page loads successfully');
    } else {
      console.log('❌ Live Agent Logs page failed to load:', pageResponse.status);
      return;
    }
    
    // Test 3: Check if intelligent enrichment API works
    console.log('\n3. Testing intelligent enrichment API...');
    const statusResponse = await fetch('http://localhost:3005/api/intelligent-enrichment?view=status');
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ Intelligent enrichment API responds');
      console.log('   Status:', statusData.data?.claudeAgent?.isRunning ? 'Running' : 'Idle');
    } else {
      console.log('❌ Intelligent enrichment API error:', statusResponse.status);
    }
    
    console.log('\n🎉 Live Agent Logs setup test completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Open http://localhost:3005/agent-logs in your browser');
    console.log('   2. Click "🚀 Trigger Claude Agent" to see real-time logs');
    console.log('   3. Watch the terminal display live Claude Agent activity');
    console.log('   4. Try different category and source filters');
    console.log('   5. Use the pause/resume controls to manage log flow');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the development server is running on http://localhost:3005');
  }
};

// Run the test
testLiveLogs();