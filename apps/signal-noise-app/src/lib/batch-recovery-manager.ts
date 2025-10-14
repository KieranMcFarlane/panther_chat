/**
 * 🔄 Batch Recovery and Progress Tracking System
 * 
 * Provides resilient batch processing with automatic recovery,
 * progress persistence, and checkpoint management.
 */

import { enhancedHistoricalBatchProcessor } from './enhanced-historical-batch-processor';

interface BatchCheckpoint {
  batchId: string;
  timestamp: string;
  totalEntities: number;
  processedEntities: number;
  completedBatches: number[];
  currentBatchIndex: number;
  results: any[];
  memoryStats: {
    peakUsage: number;
    averageBatchMemory: number;
  };
  configuration: {
    batchSize: number;
    maxConcurrent: number;
    memoryThreshold: number;
  };
}

interface RecoveryOptions {
  resumeFromCheckpoint?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackBatchSize?: number;
}

class BatchRecoveryManager {
  private checkpoints: Map<string, BatchCheckpoint> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds

  /**
   * 💾 Save checkpoint for current batch processing
   */
  async saveCheckpoint(
    batchId: string, 
    progress: any, 
    results: any[], 
    memoryStats: any
  ): Promise<void> {
    const checkpoint: BatchCheckpoint = {
      batchId,
      timestamp: new Date().toISOString(),
      totalEntities: progress.total,
      processedEntities: progress.processed,
      completedBatches: progress.completedBatches || [],
      currentBatchIndex: progress.currentBatchIndex || 0,
      results: [...results],
      memoryStats: {
        peakUsage: memoryStats.peakUsage || 0,
        averageBatchMemory: memoryStats.averageBatchMemory || 0
      },
      configuration: {
        batchSize: progress.batchSize || 3,
        maxConcurrent: progress.maxConcurrent || 2,
        memoryThreshold: progress.memoryThreshold || 512
      }
    };

    this.checkpoints.set(batchId, checkpoint);
    
    // In production, persist to database or file system
    console.log(`💾 Checkpoint saved for ${batchId}:`);
    console.log(`   - Processed: ${checkpoint.processedEntities}/${checkpoint.totalEntities}`);
    console.log(`   - Completed batches: ${checkpoint.completedBatches.length}`);
    console.log(`   - Memory peak: ${checkpoint.memoryStats.peakUsage}MB`);
  }

  /**
   * 📂 Load checkpoint for recovery
   */
  async loadCheckpoint(batchId: string): Promise<BatchCheckpoint | null> {
    const checkpoint = this.checkpoints.get(batchId);
    
    if (checkpoint) {
      console.log(`📂 Checkpoint loaded for ${batchId}:`);
      console.log(`   - Saved at: ${checkpoint.timestamp}`);
      console.log(`   - Progress: ${checkpoint.processedEntities}/${checkpoint.totalEntities}`);
      console.log(`   - Can resume from batch ${checkpoint.currentBatchIndex + 1}`);
      return checkpoint;
    }
    
    return null;
  }

  /**
   * 🔄 Resume processing from checkpoint
   */
  async resumeFromCheckpoint(
    checkpoint: BatchCheckpoint,
    entities: any[],
    options: RecoveryOptions = {}
  ): Promise<any> {
    console.log(`🔄 Resuming batch processing from checkpoint: ${checkpoint.batchId}`);
    console.log(`📊 Resuming from batch ${checkpoint.currentBatchIndex + 1}/${Math.ceil(entities.length / checkpoint.configuration.batchSize)}`);

    const maxRetries = options.maxRetries || this.maxRetries;
    const retryDelay = options.retryDelay || this.retryDelay;
    
    try {
      // Filter out already processed entities
      const startIndex = checkpoint.currentBatchIndex * checkpoint.configuration.batchSize;
      const remainingEntities = entities.slice(startIndex);
      
      console.log(`📈 Processing ${remainingEntities.length} remaining entities`);
      
      // Resume processing with smaller batch size if memory issues occurred
      const batchSize = checkpoint.memoryStats.peakUsage > 400 
        ? Math.min(checkpoint.configuration.batchSize, 2) 
        : checkpoint.configuration.batchSize;
      
      console.log(`🎯 Using ${batchSize} batch size for resumed processing`);
      
      // Create new processing context
      const resumeContext = {
        batchId: `${checkpoint.batchId}_resume_${Date.now()}`,
        totalEntities: entities.length,
        processedEntities: checkpoint.processedEntities,
        originalCheckpoint: checkpoint,
        resumedAt: new Date().toISOString()
      };
      
      // Process remaining entities
      const resumeResults = await this.processWithRecovery(
        remainingEntities,
        batchSize,
        checkpoint.maxConcurrent,
        maxRetries,
        retryDelay,
        resumeContext
      );
      
      // Combine original and new results
      const combinedResults = [...checkpoint.results, ...resumeResults];
      
      console.log(`✅ Resume processing completed: ${resumeContext.batchId}`);
      console.log(`📈 Combined results: ${combinedResults.length} total entities processed`);
      
      return {
        ...resumeResults,
        originalResults: checkpoint.results,
        combinedResults,
        resumedFrom: checkpoint,
        recoveryStats: {
          originalProcessed: checkpoint.processedEntities,
          resumedProcessed: resumeResults.length,
          totalProcessed: combinedResults.length,
          checkpointAge: Date.now() - new Date(checkpoint.timestamp).getTime()
        }
      };
      
    } catch (error) {
      console.error(`❌ Resume processing failed for ${checkpoint.batchId}:`, error);
      
      // Save failed checkpoint for manual recovery
      await this.saveFailedCheckpoint(checkpoint, error);
      
      throw error;
    }
  }

  /**
   * 🔄 Process entities with automatic retry and recovery
   */
  private async processWithRecovery(
    entities: any[],
    batchSize: number,
    maxConcurrent: number,
    maxRetries: number,
    retryDelay: number,
    context: any
  ): Promise<any[]> {
    const batches = this.createBatches(entities, batchSize);
    const results: any[] = [];
    let retryCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      let batchSuccess = false;
      let attemptCount = 0;

      while (!batchSuccess && attemptCount <= maxRetries) {
        attemptCount++;
        
        try {
          console.log(`🔄 Processing batch ${i + 1}/${batches.length} (attempt ${attemptCount}/${maxRetries + 1})`);
          
          // Process batch with timeout and memory monitoring
          const batchResults = await this.processBatchWithTimeout(
            batch,
            context,
            30000, // 30 second timeout per batch
            maxConcurrent
          );
          
          results.push(...batchResults);
          batchSuccess = true;
          
          console.log(`✅ Batch ${i + 1} completed successfully`);
          
          // Clear batch from memory
          batch.length = 0;
          
          // Add delay between batches
          if (i < batches.length - 1) {
            await this.calculateDelay(retryCount, attemptCount);
          }
          
        } catch (error) {
          console.warn(`⚠️ Batch ${i + 1} failed (attempt ${attemptCount}):`, error instanceof Error ? error.message : error);
          
          if (attemptCount <= maxRetries) {
            console.log(`🔄 Retrying batch ${i + 1} in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // Exponential backoff for retries
            retryDelay = Math.min(retryDelay * 2, 30000); // Cap at 30 seconds
          } else {
            console.error(`❌ Batch ${i + 1} failed after ${maxRetries + 1} attempts`);
            throw new Error(`Batch ${i + 1} failed after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }

    return results;
  }

  /**
   * ⏱️ Process batch with timeout and memory monitoring
   */
  private async processBatchWithTimeout(
    batch: any[],
    context: any,
    timeoutMs: number,
    maxConcurrent: number
  ): Promise<any[]> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Batch processing timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const results = await enhancedHistoricalBatchProcessor.processBatchWithClaude(batch, context.batchId, 1);
        clearTimeout(timeout);
        resolve(results);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * ⏱️ Calculate adaptive delay between operations
   */
  private async calculateDelay(retryCount: number, attemptCount: number): Promise<void> {
    const baseDelay = 2000;
    const retryMultiplier = Math.max(1, retryCount * 0.5);
    const attemptMultiplier = Math.max(1, attemptCount * 0.3);
    const delay = baseDelay * retryMultiplier * attemptMultiplier;
    
    console.log(`⏱️ Waiting ${Math.round(delay)}ms before next batch...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 💾 Save failed checkpoint for manual recovery
   */
  private async saveFailedCheckpoint(checkpoint: BatchCheckpoint, error: any): Promise<void> {
    const failedCheckpoint = {
      ...checkpoint,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };

    // Store with special prefix for failed checkpoints
    this.checkpoints.set(`failed_${checkpoint.batchId}`, failedCheckpoint);
    
    console.error(`💾 Failed checkpoint saved: failed_${checkpoint.batchId}`);
  }

  /**
   * 📦 Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 🧹 Cleanup old checkpoints
   */
  cleanupOldCheckpoints(maxAgeHours: number = 24): void {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [batchId, checkpoint] of this.checkpoints.entries()) {
      const checkpointTime = new Date(checkpoint.timestamp).getTime();
      if (checkpointTime < cutoffTime) {
        this.checkpoints.delete(batchId);
        cleanedCount++;
      }
    }

    console.log(`🧹 Cleaned up ${cleanedCount} old checkpoints (older than ${maxAgeHours} hours)`);
  }

  /**
   * 📊 Get recovery statistics
   */
  getRecoveryStats(): any {
    const totalCheckpoints = this.checkpoints.size;
    const failedCheckpoints = Array.from(this.checkpoints.keys()).filter(id => id.startsWith('failed_')).length;
    const activeCheckpoints = totalCheckpoints - failedCheckpoints;

    return {
      totalCheckpoints,
      activeCheckpoints,
      failedCheckpoints,
      activeBatchIds: Array.from(this.checkpoints.keys()).filter(id => !id.startsWith('failed_')),
      failedBatchIds: Array.from(this.checkpoints.keys()).filter(id => id.startsWith('failed_')),
      lastCleanup: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const batchRecoveryManager = new BatchRecoveryManager();
export default BatchRecoveryManager;