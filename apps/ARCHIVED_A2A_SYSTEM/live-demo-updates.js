#!/usr/bin/env node

/**
 * Live A2A progress updates for frontend demo
 * Simulates ongoing A2A scan with real-time updates
 */

const BASE_URL = 'http://localhost:3005';
const SESSION_ID = 'live_demo_session';

let processedEntities = 567;
let currentBatch = 12;
let opportunitiesFound = 34;
const totalEntities = 1122;
const totalBatches = 23;

const entities = [
  '🔍 Processing: Getafe CF (La Liga) - BrightData search running...',
  '🔍 Processing: Gil Vicente FC (Primeira Liga) - MCP analysis in progress...',
  '🔍 Processing: Burkina Faso Rugby Federation - Searching government procurement portals...',
  '🔍 Processing: Barbados Olympic Committee - Caribbean tenders analysis...',
  '🔍 Processing: Basketball Federation of Serbia - European sports grants research...',
  '✅ Batch 12 completed - Found 3 new RFP opportunities',
  '🔄 Starting batch 13/23 - Processing next 50 entities...',
  '🔍 Processing: Antonians Sports Club - Sri Lanka sports infrastructure...',
  '🔍 Processing: Anwil Włocławek - Polish basketball equipment tenders...',
  '🔍 Processing: Antwerp Giants - Belgian sports technology procurement...'
];

let entityIndex = 0;

async function updateProgress() {
  // Update entity being processed
  const currentEntity = entities[entityIndex % entities.length];
  entityIndex++;
  
  // Occasionally increment progress
  if (Math.random() < 0.3) {
    processedEntities += Math.floor(Math.random() * 20) + 5;
    if (Math.random() < 0.4) {
      opportunitiesFound += Math.floor(Math.random() * 3) + 1;
    }
    if (processedEntities % 50 === 0) {
      currentBatch++;
    }
  }
  
  // Ensure we don't exceed totals
  processedEntities = Math.min(processedEntities, totalEntities - 10);
  currentBatch = Math.min(currentBatch, totalBatches - 1);
  
  const progressData = {
    sessionId: SESSION_ID,
    processedEntities,
    currentBatch,
    opportunitiesFound,
    currentEntity,
    status: 'running'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/a2a-full-scan/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progressData)
    });
    
    const data = await response.json();
    if (data.success) {
      const percentage = Math.round((data.progress.processedEntities / data.progress.totalEntities) * 100);
      console.log(`✅ Live Update: ${percentage}% | ${data.progress.opportunitiesFound} RFPs | Batch ${data.progress.currentBatch}/${data.progress.totalBatches}`);
      console.log(`   📊 ${data.progress.currentEntity}`);
    } else {
      console.log(`❌ Update failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`💥 Network error: ${error.message}`);
  }
}

console.log('🎬 Starting Live A2A Progress Updates...');
console.log(`📊 Session: ${SESSION_ID}`);
console.log(`🌐 Frontend: http://localhost:3005/a2a-progress`);
console.log('⏰ Updates every 3 seconds - Press Ctrl+C to stop');
console.log('');

// Update every 3 seconds
const interval = setInterval(updateProgress, 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\\n🛑 Live updates stopped');
  process.exit(0);
});