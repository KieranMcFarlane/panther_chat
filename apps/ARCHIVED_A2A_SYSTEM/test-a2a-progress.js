#!/usr/bin/env node

/**
 * Simple test to verify A2A progress API functionality
 * Tests the theory that progress updates are failing due to sessionId conflicts
 */

const BASE_URL = 'http://localhost:3005';

async function testProgressAPI() {
  console.log('🧪 Testing A2A Progress API...');
  
  // Test 1: Get current progress
  console.log('\n1️⃣ Testing GET /api/a2a-full-scan/progress');
  try {
    const response = await fetch(`${BASE_URL}/api/a2a-full-scan/progress`);
    const data = await response.json();
    console.log('✅ GET Success:', data.success);
    console.log('📊 Current Progress:', data.progress);
  } catch (error) {
    console.log('❌ GET Error:', error.message);
  }

  // Test 2: Update progress with simple test session
  console.log('\n2️⃣ Testing POST /api/a2a-full-scan/progress');
  const testSessionId = `test_session_${Date.now()}`;
  const testProgress = {
    sessionId: testSessionId,
    totalEntities: 100,
    processedEntities: 25,
    currentBatch: 1,
    totalBatches: 4,
    opportunitiesFound: 3,
    status: 'running',
    currentEntity: 'Test Entity Processing'
  };

  try {
    const response = await fetch(`${BASE_URL}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProgress)
    });
    const data = await response.json();
    console.log('✅ POST Success:', data.success);
    console.log('📝 Response:', data.message);
  } catch (error) {
    console.log('❌ POST Error:', error.message);
  }

  // Test 3: Verify the progress was stored
  console.log('\n3️⃣ Testing progress persistence...');
  try {
    const response = await fetch(`${BASE_URL}/api/a2a-full-scan/progress?sessionId=${testSessionId}`);
    const data = await response.json();
    console.log('✅ Verification Success:', data.success);
    console.log('📊 Stored Progress:', data.progress);
  } catch (error) {
    console.log('❌ Verification Error:', error.message);
  }

  // Test 4: Test with existing running session
  console.log('\n4️⃣ Testing with existing running session...');
  try {
    const response = await fetch(`${BASE_URL}/api/a2a-full-scan/progress`);
    const data = await response.json();
    if (data.progress && data.progress.sessionId) {
      const existingSessionId = data.progress.sessionId;
      console.log('🔍 Found existing session:', existingSessionId);
      
      const updateResponse = await fetch(`${BASE_URL}/api/a2a-full-scan/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: existingSessionId,
          processedEntities: 999,
          currentEntity: 'Test Update from Simple Test'
        })
      });
      const updateData = await updateResponse.json();
      console.log('✅ Existing Session Update Success:', updateData.success);
      console.log('📝 Update Response:', updateData.message);
    } else {
      console.log('ℹ️ No existing session found');
    }
  } catch (error) {
    console.log('❌ Existing Session Test Error:', error.message);
  }

  console.log('\n🎯 Test Results:');
  console.log('- If all tests pass: Progress API is working, issue is elsewhere');
  console.log('- If tests fail: Progress API has fundamental issues');
  console.log('- Check the browser console and server logs for details');
}

// Run the test
testProgressAPI().catch(console.error);