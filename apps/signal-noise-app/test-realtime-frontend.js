#!/usr/bin/env node

/**
 * Real-time progress test that simulates the actual A2A scan behavior
 * Tests if the frontend will receive proper progress updates
 */

const BASE_URL = 'http://localhost:3005';
const TEST_SESSION_ID = `realtime_frontend_test_${Date.now()}`;

class RealTimeProgressTest {
  constructor() {
    this.sessionId = TEST_SESSION_ID;
    this.totalEntities = 1122;
    this.currentBatch = 0;
    this.processedEntities = 0;
    this.opportunitiesFound = 0;
    this.isRunning = false;
  }

  async startRealtimeSimulation() {
    console.log('🚀 Starting Real-Time Progress Simulation for Frontend Testing...');
    console.log(`📊 Session: ${this.sessionId}`);
    console.log(`📈 Total Entities: ${this.totalEntities}`);
    console.log('');

    this.isRunning = true;

    // Initialize the scan
    await this.updateProgress({
      status: 'starting',
      startTime: new Date().toISOString(),
      currentEntity: 'Initializing real-time scan...'
    });

    console.log('✅ Scan initialized! Starting real-time updates...');

    // Simulate the actual batch processing like the real system
    const batches = 5; // Same as real system
    const batchSize = Math.ceil(this.totalEntities / batches);

    for (let batch = 1; batch <= batches; batch++) {
      console.log(`\n🔄 Processing Batch ${batch}/${batches}`);
      
      await this.processBatch(batch, batchSize);
      
      // Delay between batches to simulate real processing time
      if (batch < batches) {
        await this.sleep(3000);
      }
    }

    // Mark as completed
    await this.updateProgress({
      status: 'completed',
      endTime: new Date().toISOString(),
      currentEntity: '✅ Real-time simulation completed successfully!'
    });

    console.log('\n🎉 Real-Time Progress Simulation Complete!');
    console.log(`✅ Total Entities Processed: ${this.processedEntities}`);
    console.log(`🎯 Total Opportunities Found: ${this.opportunitiesFound}`);
    console.log(`⏱️ Total Time: ${(batches * 3)} seconds (simulated)`);
    console.log('\n📋 Frontend should now show:');
    console.log('   - Real-time entity count updates');
    console.log('   - Batch progress tracking');
    console.log('   - Opportunity count');
    console.log('   - "COMPLETED" status');
  }

  async processBatch(batchNumber, batchSize) {
    this.currentBatch = batchNumber;
    await this.updateProgress({
      currentEntity: `🔄 Starting batch ${batchNumber} of ${batchSize} entities...`
    });

    // Simulate processing entities in this batch (like real system processes 3 at a time)
    const entitiesToProcess = Math.min(batchSize, this.totalEntities - this.processedEntities);
    let batchOpportunities = 0;

    for (let i = 0; i < entitiesToProcess; i += 3) {
      const processedInThisChunk = Math.min(3, entitiesToProcess - i);
      
      await this.updateProgress({
        processedEntities: this.processedEntities + i,
        currentEntity: `🔍 Processing entity ${this.processedEntities + i + 1}-${Math.min(this.processedEntities + i + processedInThisChunk, this.totalEntities)} (BrightData search running...)`
      });

      // Simulate entity search time (like real BrightData searches)
      await this.sleep(2000);

      // Randomly find opportunities (simulate real RFP discovery)
      if (Math.random() < 0.15) { // 15% chance per entity
        const foundCount = Math.floor(Math.random() * 3) + 1;
        batchOpportunities += foundCount;
        console.log(`  🎯 Found ${foundCount} RFP opportunities!`);
      }

      // Small delay between entities
      await this.sleep(500);
    }

    // Update batch completion
    this.processedEntities += entitiesToProcess;
    this.opportunitiesFound += batchOpportunities;

    await this.updateProgress({
      processedEntities: this.processedEntities,
      opportunitiesFound: this.opportunitiesFound,
      currentEntity: `✅ Batch ${batchNumber} completed - ${batchOpportportunities} opportunities found`
    });

    const progress = Math.round((this.processedEntities / this.totalEntities) * 100);
    console.log(`  ✅ Batch ${batchNumber} Complete: ${progress}% (${this.processedEntities}/${this.totalEntities})`);
  }

  async updateProgress(updates) {
    const progressData = {
      sessionId: this.sessionId,
      totalEntities: this.totalEntities,
      processedEntities: this.processedEntities,
      currentBatch: updates.currentBatch || this.currentBatch,
      totalBatches: Math.ceil(this.totalEntities / 250),
      opportunitiesFound: this.opportunitiesFound,
      status: 'running',
      currentEntity: null,
      ...updates
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
        const timeElapsed = this.calculateTimeElapsed(data.progress.startTime);
        
        console.log(`  📊 [REAL-TIME UPDATE]: ${percentage}% | 🏭 Batch ${data.progress.currentBatch}/${data.progress.totalBatches} | 🎯 RFPs: ${data.progress.opportunitiesFound} | ⏱️ ${timeElapsed}`);
      } else {
        console.log(`  ❌ Update failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`  💥 Network error: ${error.message}`);
    }
  }

  calculateTimeElapsed(startTime) {
    if (!startTime) return '00:00:00';
    
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the real-time test
const test = new RealTimeProgressTest();
test.startRealtimeSimulation().catch(console.error);