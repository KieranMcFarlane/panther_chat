/**
 * 🚀 Real-Time Historical Batch Processor API
 * 
 * Enhanced API endpoint for processing historical entity data with Claude Agent integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedHistoricalBatchProcessor } from '@/lib/enhanced-historical-batch-processor';

interface HistoricalBatchRequest {
  entities: Array<{
    id: string;
    name: string;
    type: string;
    industry: string;
    data: any;
    lastUpdated: string;
  }>;
  options?: {
    batchSize?: number;
    maxConcurrent?: number;
    useClaudeAgent?: boolean;
    storeResults?: boolean;
    mcpTools?: string[];
    memoryOptimized?: boolean;
    memoryThresholdMB?: number;
  };
  metadata?: {
    source: string;
    userId?: string;
    projectId?: string;
    priority?: 'high' | 'medium' | 'low';
  };
}

interface BatchProcessingStatus {
  batchId?: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: {
    total: number;
    processed: number;
    percentage: number;
  };
  results: {
    insights: number;
    opportunities: number;
    risks: number;
    estimatedValue: string;
    averageConfidence: number;
  };
  timing: {
    startTime?: string;
    estimatedCompletion?: string;
    totalProcessingTime?: number;
  };
  memory?: {
    currentUsageMB?: number;
    thresholdMB?: number;
    peakUsageMB?: number;
    averageBatchMemoryMB?: number;
    memoryUtilization?: number;
  };
  configuration?: {
    batchSize?: number;
    maxConcurrent?: number;
    memoryOptimized?: boolean;
  };
}

// Global processing state (in production, use Redis or database)
let currentProcessing: BatchProcessingStatus = {
  status: 'idle',
  progress: { total: 0, processed: 0, percentage: 0 },
  results: { insights: 0, opportunities: 0, risks: 0, estimatedValue: '£0', averageConfidence: 0 },
  timing: {}
};

export async function POST(request: NextRequest) {
  try {
    const body: HistoricalBatchRequest = await request.json();
    
    // Validate request
    if (!body.entities || !Array.isArray(body.entities)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: entities (array)',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (body.entities.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Entities array cannot be empty',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Check if already processing
    if (currentProcessing.status === 'processing') {
      return NextResponse.json({
        success: false,
        error: 'Batch processing already in progress',
        currentBatch: currentProcessing.batchId,
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }

    // Apply memory optimization settings
    const memoryOptimized = body.options?.memoryOptimized !== false; // Default to true
    const batchSize = body.options?.batchSize || (memoryOptimized ? 3 : 10);
    const memoryThreshold = body.options?.memoryThresholdMB || 512;

    console.log(`🚀 Starting memory-optimized historical batch processing with Claude Agent`);
    console.log(`📊 Processing ${body.entities.length} entities with batch size ${batchSize}`);
    console.log(`💾 Memory optimization: ${memoryOptimized ? 'ENABLED' : 'DISABLED'}, Threshold: ${memoryThreshold}MB`);

    // Initialize processing state
    const batchId = `enhanced_hist_${Date.now()}`;
    currentProcessing = {
      batchId,
      status: 'processing',
      progress: {
        total: body.entities.length,
        processed: 0,
        percentage: 0
      },
      results: {
        insights: 0,
        opportunities: 0,
        risks: 0,
        estimatedValue: '£0',
        averageConfidence: 0
      },
      timing: {
        startTime: new Date().toISOString()
      },
      configuration: {
        batchSize,
        maxConcurrent: body.options?.maxConcurrent || 2,
        memoryOptimized
      },
      memory: {
        thresholdMB: memoryThreshold,
        currentUsageMB: 0,
        peakUsageMB: 0,
        averageBatchMemoryMB: 0,
        memoryUtilization: 0
      }
    };

    // Start processing in background
    processBatchAsync(body, batchId);

    return NextResponse.json({
      success: true,
      batchId,
      message: `Started memory-optimized processing of ${body.entities.length} entities with Claude Agent analysis`,
      estimatedDuration: Math.ceil(body.entities.length * 12), // 12 seconds per entity
      configuration: {
        batchSize,
        memoryOptimized,
        memoryThresholdMB: memoryThreshold,
        maxConcurrent: body.options?.maxConcurrent || 2
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Enhanced batch processing failed to start:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        // Get current processing status
        return NextResponse.json({
          success: true,
          data: currentProcessing,
          processorStatus: enhancedHistoricalBatchProcessor.getProcessingStatus(),
          timestamp: new Date().toISOString()
        });

      case 'checkpoints':
        // List available checkpoints for recovery
        try {
          const checkpoints = await enhancedHistoricalBatchProcessor.listCheckpoints();
          return NextResponse.json({
            success: true,
            data: checkpoints,
            count: checkpoints.length,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list checkpoints',
            timestamp: new Date().toISOString()
          }, { status: 500 });
        }

      case 'resume':
        // Resume processing from checkpoint
        const resumeBatchId = searchParams.get('batchId');
        if (!resumeBatchId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required parameter: batchId',
            timestamp: new Date().toISOString()
          }, { status: 400 });
        }

        try {
          // For demo purposes, we'll need the entity data
          // In production, this would be stored with the checkpoint
          return NextResponse.json({
            success: true,
            message: `Resume functionality available for batch: ${resumeBatchId}`,
            note: 'Full resume implementation requires entity data to be stored with checkpoints',
            availableOptions: {
              maxRetries: 3,
              retryDelay: 5000,
              fallbackBatchSize: 2
            },
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to resume processing',
            timestamp: new Date().toISOString()
          }, { status: 500 });
        }

      case 'cleanup':
        // Cleanup old checkpoints
        const maxAge = parseInt(searchParams.get('maxAge') || '24');
        try {
          await enhancedHistoricalBatchProcessor.cleanupCheckpoints(maxAge);
          return NextResponse.json({
            success: true,
            message: `Cleaned up checkpoints older than ${maxAge} hours`,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cleanup checkpoints',
            timestamp: new Date().toISOString()
          }, { status: 500 });
        }

      case 'history':
        // Get processing history (mock data for now)
        return NextResponse.json({
          success: true,
          data: {
            recentBatches: [
              {
                batchId: 'enhanced_hist_1234567890',
                status: 'completed',
                entityCount: 50,
                insights: 156,
                opportunities: 89,
                estimatedValue: '£12.4M',
                averageConfidence: 87,
                completedAt: new Date(Date.now() - 3600000).toISOString()
              }
            ]
          },
          timestamp: new Date().toISOString()
        });

      case 'claude-status':
        // Check Claude Agent and MCP tools status
        const processorStatus = enhancedHistoricalBatchProcessor.getProcessingStatus();
        return NextResponse.json({
          success: true,
          data: {
            claudeAgent: processorStatus.claudeAgentStatus,
            mcpTools: processorStatus.mcpToolsAvailable,
            memoryStatus: processorStatus.memoryStatus,
            batchConfiguration: processorStatus.batchConfiguration,
            systemStatus: 'operational',
            lastUpdated: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: true,
          message: 'Memory-Optimized Historical Batch Processor API with Claude Agent',
          endpoints: {
            'POST /': 'Start memory-optimized historical batch processing',
            'GET /?action=status': 'Get current processing status',
            'GET /?action=checkpoints': 'List available checkpoints for recovery',
            'GET /?action=resume&batchId=XYZ': 'Resume processing from checkpoint',
            'GET /?action=cleanup&maxAge=24': 'Cleanup old checkpoints',
            'GET /?action=history': 'Get processing history',
            'GET /?action=claude-status': 'Check Claude Agent and MCP status'
          },
          features: [
            'Memory-optimized batch processing (3 entities per batch)',
            'Automatic checkpoint and recovery system',
            'Claude Agent SDK integration for advanced analysis',
            'MCP tools: Neo4j, BrightData, Perplexity, Better Auth',
            'Real-time memory monitoring and adaptive delays',
            'Progress tracking with automatic resumption',
            'Garbage collection and memory cleanup',
            'Configurable batch sizes and memory thresholds',
            'Risk assessment and strategic recommendations',
            'Knowledge graph integration and storage'
          ],
          configuration: {
            defaultBatchSize: 3,
            maxConcurrent: 2,
            memoryThreshold: '512MB',
            checkpointInterval: '5 batches',
            recoveryRetries: 3,
            adaptiveDelays: true
          },
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('❌ Enhanced batch API GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * 🔄 Process batch asynchronously with Claude Agent (Memory-Optimized)
 */
async function processBatchAsync(request: HistoricalBatchRequest, batchId: string) {
  try {
    console.log(`🔄 Starting memory-optimized async batch processing: ${batchId}`);
    
    // Monitor memory during processing
    const updateMemoryStatus = () => {
      const status = enhancedHistoricalBatchProcessor.getProcessingStatus();
      if (currentProcessing.memory) {
        currentProcessing.memory = {
          ...currentProcessing.memory,
          currentUsageMB: status.memoryStatus.currentUsageMB,
          peakUsageMB: status.memoryStatus.peakUsageMB,
          averageBatchMemoryMB: status.memoryStatus.averageBatchMemoryMB,
          memoryUtilization: status.memoryStatus.memoryUtilization
        };
      }
    };

    // Update memory status periodically during processing
    const memoryMonitor = setInterval(updateMemoryStatus, 5000); // Every 5 seconds
    
    try {
      // Process entities with enhanced Claude Agent analysis
      const summary = await enhancedHistoricalBatchProcessor.processHistoricalEntities(request.entities);
      
      // Clear memory monitor
      clearInterval(memoryMonitor);
      updateMemoryStatus(); // Final update
      
      // Update final status
      currentProcessing.status = 'completed';
      currentProcessing.progress.processed = currentProcessing.progress.total;
      currentProcessing.progress.percentage = 100;
      currentProcessing.results = {
        insights: summary.totalInsights,
        opportunities: summary.totalOpportunities,
        risks: summary.totalRisks,
        estimatedValue: summary.estimatedValue,
        averageConfidence: summary.averageConfidence
      };
      currentProcessing.timing.totalProcessingTime = summary.totalProcessingTime;
      currentProcessing.timing.estimatedCompletion = new Date().toISOString();

      // Store results if requested
      if (request.options?.storeResults !== false) {
        await enhancedHistoricalBatchProcessor.storeBatchResults(summary, []);
      }

      console.log(`✅ Memory-optimized batch processing completed: ${batchId}`);
      console.log(`📈 Results: ${summary.totalInsights} insights, ${summary.totalOpportunities} opportunities, ${summary.estimatedValue} value`);
      
      const memoryStats = (summary as any).memoryStats;
      if (memoryStats) {
        console.log(`💾 Memory efficiency: Peak ${memoryStats.peakUsage}MB, Avg ${memoryStats.averageBatchMemory}MB per batch`);
      }

    } catch (processingError) {
      clearInterval(memoryMonitor);
      throw processingError;
    }

  } catch (error) {
    console.error(`❌ Memory-optimized batch processing failed: ${batchId}`, error);
    
    currentProcessing.status = 'error';
    currentProcessing.timing.estimatedCompletion = new Date().toISOString();
    
    // Keep error details for debugging
    (currentProcessing as any).error = error instanceof Error ? error.message : 'Unknown error';
  }
}

/**
 * 📊 Calculate estimated processing time
 */
function calculateEstimatedDuration(entityCount: number, options?: any): number {
  const baseTimePerEntity = 12; // 12 seconds per entity with Claude Agent
  const concurrentMultiplier = options?.maxConcurrent ? (3 / options.maxConcurrent) : 1;
  
  return Math.ceil(entityCount * baseTimePerEntity * concurrentMultiplier);
}