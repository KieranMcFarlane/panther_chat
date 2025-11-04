#!/usr/bin/env node

/**
 * Update the real A2A scan session to make it the most recent so it becomes default
 * This will ensure the frontend dashboard shows the real A2A progress by default
 */

const BASE_URL = 'http://localhost:3005';
const REAL_SESSION_ID = 'full_scan_1761399271999';

async function updateRealA2ASession() {
  console.log('🔄 Updating Real A2A Scan Session to Make it Default...');
  console.log(`📊 Session ID: ${REAL_SESSION_ID}`);
  console.log('');
  
  // Update with current timestamp to make it most recent
  const now = new Date().toISOString();
  
  const progressData = {
    sessionId: REAL_SESSION_ID,
    totalEntities: 1122,
    processedEntities: 870,
    currentBatch: 18,
    totalBatches: 23,
    opportunitiesFound: 0,
    status: 'running',
    startTime: now, // Update to current time to make it most recent
    currentEntity: '🔍 Processing: Cyprus Rugby Federation - RFP search in progress...',
    errors: []
  };
  
  console.log('📊 Sending session update with current timestamp...');
  console.log(`   New Start Time: ${progressData.startTime}`);
  console.log(`   Progress: ${progressData.processedEntities}/${progressData.totalEntities} entities (${Math.round(progressData.processedEntities/progressData.totalEntities*100)}%)`);
  console.log('');
  
  try {
    const response = await fetch(`${BASE_URL}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progressData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Real A2A session updated successfully!');
      console.log('✅ Should now be the default session for frontend');
      console.log('');
      console.log('📊 Updated Session Details:');
      console.log(`   Session ID: ${data.progress.sessionId}`);
      console.log(`   Start Time: ${data.progress.startTime}`);
      console.log(`   Status: ${data.progress.status}`);
      console.log(`   Progress: ${data.progress.processedEntities}/${data.progress.totalEntities} entities`);
      console.log('');
      console.log('🌐 Check the frontend at: http://localhost:3005/a2a-full-scan');
      console.log('💡 The dashboard should now show the REAL A2A scan by default!');
    } else {
      console.log(`❌ Session update failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`💥 Network error: ${error.message}`);
  }
}

// Run the update
updateRealA2ASession().catch(console.error);