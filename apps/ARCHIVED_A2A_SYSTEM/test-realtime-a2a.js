#!/usr/bin/env node

/**
 * Real-time A2A Full Scan Simulation Test
 * Tests the complete real-time feedback system
 */

const BASE_URL = 'http://localhost:3005';
const TEST_SESSION_ID = `realtime_test_${Date.now()}`;

class RealTimeA2ATest {
  constructor() {
    this.sessionId = TEST_SESSION_ID;
    this.totalEntities = 1000;
    this.batchSize = 250;
    this.totalBatches = Math.ceil(this.totalEntities / this.batchSize);
    this.currentBatch = 0;
    this.processedEntities = 0;
    this.opportunitiesFound = 0;
    this.testEntities = [
      'Test Sports Club Alpha',
      'Test Football Club Beta', 
      'Test Basketball Team Gamma',
      'Test Rugby Union Delta',
      'Test Cricket Club Epsilon'
    ];
  }

  async simulateRealtimeScan() {
    console.log('🚀 Starting Real-Time A2A Full Scan Simulation...');
    console.log(`📊 Session: ${this.sessionId}`);
    console.log(`📈 Total Entities: ${this.totalEntities}`);
    console.log(`📦 Batch Size: ${this.batchSize}`);
    console.log(`🔢 Total Batches: ${this.totalBatches}`);
    console.log('');

    // Initialize the scan
    await this.updateProgress({
      status: 'starting',
      startTime: new Date().toISOString(),
      currentEntity: 'Initializing scan...'
    });

    // Simulate batch processing
    for (let batch = 1; batch <= this.totalBatches; batch++) {
      await this.processBatch(batch);
      
      // Small delay between batches to simulate real processing
      await this.sleep(1000);
    }

    // Mark as completed
    await this.updateProgress({
      status: 'completed',
      endTime: new Date().toISOString(),
      currentEntity: '✅ Real-time test scan completed successfully!'
    });

    console.log('\n🎉 Real-Time A2A Scan Simulation Complete!');
    console.log(`✅ Total Entities Processed: ${this.processedEntities}`);
    console.log(`🎯 Total Opportunities Found: ${this.opportunitiesFound}`);
    console.log(`⏱️ Total Time: ${this.totalBatches} seconds (simulated)`);
  }

  async processBatch(batchNumber) {
    console.log(`🔄 Processing Batch ${batchNumber}/${this.totalBatches}`);
    
    await this.updateProgress({
      currentBatch: batchNumber,
      currentEntity: `Starting batch ${batchNumber}...`
    });

    // Simulate processing entities in this batch
    const batchEntities = Math.min(this.batchSize, this.totalEntities - this.processedEntities);
    let batchOpportunities = 0;

    for (let i = 0; i < batchEntities; i += 3) {
      // Process 3 entities at a time (like the real system)
      const currentEntityNames = this.testEntities.slice(0, 3);
      const currentEntity = currentEntityNames.join(', ');
      
      await this.updateProgress({
        processedEntities: this.processedEntities + i,
        currentEntity: `🔍 Processing: ${currentEntity}`
      });

      // Simulate entity processing time
      await this.sleep(200);

      // Randomly find opportunities (20% chance per entity)
      if (Math.random() < 0.2) {
        batchOpportunities += Math.floor(Math.random() * 3) + 1;
        console.log(`  🎯 Found ${batchOpportunities} opportunities!`);
      }
    }

    // Update batch completion
    this.processedEntities += batchEntities;
    this.opportunitiesFound += batchOpportunities;

    await this.updateProgress({
      processedEntities: this.processedEntities,
      opportunitiesFound: this.opportunitiesFound,
      currentEntity: `✅ Batch ${batchNumber} completed - ${batchOpportunities} opportunities found`
    });

    const progress = Math.round((this.processedEntities / this.totalEntities) * 100);
    console.log(`  ✅ Batch ${batchNumber} Complete: ${progress}% (${this.processedEntities}/${this.totalEntities})`);
  }

  async updateProgress(updates) {
    const progressData = {
      sessionId: this.sessionId,
      totalEntities: this.totalEntities,
      processedEntities: this.processedEntities,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
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
        console.log(`  📊 Progress: ${percentage}% | 🏭 Batch: ${data.progress.currentBatch}/${data.progress.totalBatches} | 🎯 RFPs: ${data.progress.opportunitiesFound}`);
      } else {
        console.log(`  ❌ Update failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`  💥 Network error: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the real-time test
const test = new RealTimeA2ATest();
test.simulateRealtimeScan().catch(console.error);