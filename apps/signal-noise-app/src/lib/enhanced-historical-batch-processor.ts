/**
 * 🤖 Enhanced Historical Batch Processor with Claude Agent Integration
 * 
 * Advanced batch processing system that integrates with Claude Agent SDK for
 * AI-powered analysis of historical RFP and entity data
 */

import { rfpIntelligenceAgent } from './claude-agent-rfp-intelligence';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { batchRecoveryManager } from './batch-recovery-manager';

interface HistoricalEntity {
  id: string;
  name: string;
  type: string;
  industry: string;
  data: any;
  lastUpdated: string;
}

interface BatchAnalysisResult {
  entityId: string;
  entityName: string;
  analysis: any;
  insights: string[];
  opportunities: any[];
  risks: any[];
  recommendations: string[];
  confidence: number;
  processingTime: number;
  timestamp: string;
}

interface ClaudeBatchSummary {
  batchId: string;
  totalEntities: number;
  processedEntities: number;
  totalInsights: number;
  totalOpportunities: number;
  totalRisks: number;
  averageConfidence: number;
  totalProcessingTime: number;
  estimatedValue: string;
  keyFindings: string[];
  topOpportunities: any[];
  distribution: {
    byType: Record<string, number>;
    byConfidence: Record<string, number>;
    byIndustry: Record<string, number>;
  };
  timestamp: string;
}

class EnhancedHistoricalBatchProcessor {
  private claudeAgent: any;
  private batchSize = 3;  // Reduced from 10 to prevent RAM overload
  private maxConcurrent = 2;  // Reduced from 3 for safer memory usage
  private memoryThresholdMB = 512; // Memory threshold in MB
  private processingQueue: HistoricalEntity[] = [];
  private results: BatchAnalysisResult[] = [];
  private mcpConfig: any = {};
  private memoryStats = {
    peakUsage: 0,
    currentUsage: 0,
    batchMemories: [] as number[]
  };
  private enableRecovery = true;
  private checkpointInterval = 5; // Save checkpoint every 5 batches

  constructor() {
    this.initializeClaudeAgent();
    this.loadMCPConfig();
  }

  private async initializeClaudeAgent(): Promise<void> {
    try {
      // The Claude Agent is already initialized in rfpIntelligenceAgent
      this.claudeAgent = rfpIntelligenceAgent;
      console.log('✅ Claude Agent initialized for historical batch processing');
    } catch (error) {
      console.warn('⚠️ Failed to initialize Claude Agent:', error);
    }
  }

  private async loadMCPConfig(): Promise<void> {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.com' 
        : 'http://localhost:3005';
      
      const response = await fetch(`${baseUrl}/api/mcp-config`);
      if (response.ok) {
        const data = await response.json();
        this.mcpConfig = data.mcpServers || {};
        console.log('✅ MCP Config loaded for historical processing:', Object.keys(this.mcpConfig));
      }
    } catch (error) {
      console.warn('⚠️ Failed to load MCP config:', error);
      this.mcpConfig = {};
    }
  }

  /**
   * 📊 Process historical entities with Claude Agent analysis (Memory-Optimized)
   */
  async processHistoricalEntities(entities: HistoricalEntity[]): Promise<ClaudeBatchSummary> {
    const batchId = `hist_batch_${Date.now()}`;
    const startTime = Date.now();

    console.log(`🚀 Starting memory-optimized historical batch processing: ${batchId}`);
    console.log(`📊 Processing ${entities.length} entities with batch size ${this.batchSize}`);
    console.log(`💾 Memory threshold: ${this.memoryThresholdMB}MB`);

    this.processingQueue = [...entities];
    this.results = [];
    this.memoryStats = {
      peakUsage: 0,
      currentUsage: 0,
      batchMemories: []
    };

    // Process in smaller batches with memory management
    const batches = this.createBatches(entities, this.batchSize);
    let processedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = Date.now();
      
      console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} entities)`);
      
      // Check memory before processing batch
      const memoryBefore = this.getMemoryUsage();
      if (memoryBefore > this.memoryThresholdMB) {
        console.warn(`⚠️ High memory usage detected: ${memoryBefore}MB. Forcing garbage collection...`);
        await this.forceGarbageCollection();
      }

      const batchResults = await this.processBatchWithClaude(batch, batchId, i + 1);
      
      // Clear batch data from memory immediately after processing
      const batchMemoryUsed = this.getMemoryUsage() - memoryBefore;
      this.memoryStats.batchMemories.push(batchMemoryUsed);
      this.memoryStats.peakUsage = Math.max(this.memoryStats.peakUsage, batchMemoryUsed);
      
      this.results.push(...batchResults);
      processedCount += batch.length;

      console.log(`✅ Batch ${i + 1} completed. Processed ${processedCount}/${entities.length} entities`);
      console.log(`💾 Batch memory usage: ${batchMemoryUsed}MB, Peak: ${this.memoryStats.peakUsage}MB`);

      // Save checkpoint periodically for recovery
      if (this.enableRecovery && (i + 1) % this.checkpointInterval === 0) {
        await this.saveProgressCheckpoint(batchId, entities, processedCount, i + 1);
      }

      // Clear references to help garbage collection
      batch.length = 0; // Clear the batch array
      
      // Adaptive delay between batches based on memory usage
      if (i < batches.length - 1) {
        const delay = this.calculateAdaptiveDelay(batchMemoryUsed);
        console.log(`⏱️ Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const summary = this.generateBatchSummary(batchId, entities, this.results, totalProcessingTime);

    // Include memory statistics in the summary
    (summary as any).memoryStats = this.memoryStats;

    console.log(`🎉 Memory-optimized batch processing complete!`);
    console.log(`📈 Summary: ${summary.totalInsights} insights, ${summary.totalOpportunities} opportunities, ${summary.estimatedValue} estimated value`);
    console.log(`💾 Memory efficiency: Peak ${this.memoryStats.peakUsage}MB, Avg batch memory: ${this.getAverageBatchMemory()}MB`);

    // Final cleanup
    this.processingQueue.length = 0;
    await this.forceGarbageCollection();

    return summary;
  }

  /**
   * 🎯 Process individual batch with Claude Agent intelligence
   */
  private async processBatchWithClaude(batch: HistoricalEntity[], batchId: string, batchNumber: number): Promise<BatchAnalysisResult[]> {
    const results: BatchAnalysisResult[] = [];

    // Process entities concurrently (up to maxConcurrent)
    const chunks = this.createBatches(batch, this.maxConcurrent);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (entity) => {
        return await this.analyzeEntityWithClaude(entity, batchId, batchNumber);
      });

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ Failed to process entity:`, result.reason);
        }
      });
    }

    return results;
  }

  /**
   * 🧠 Analyze individual entity using Claude Agent with MCP tools
   */
  private async analyzeEntityWithClaude(entity: HistoricalEntity, batchId: string, batchNumber: number): Promise<BatchAnalysisResult> {
    const startTime = Date.now();

    try {
      const prompt = `Analyze this historical sports entity for comprehensive business intelligence:

Entity Details:
- Name: ${entity.name}
- Type: ${entity.type}
- Industry: ${entity.industry}
- Data: ${JSON.stringify(entity.data, null, 2)}

Using our Neo4j knowledge base and web search capabilities:

1. Search for ${entity.name} in our knowledge graph to understand their business context
2. Research recent developments and market conditions in ${entity.industry}
3. Identify key personnel, partnerships, and competitive positioning
4. Assess business opportunities and risks
5. Generate strategic recommendations

Provide structured analysis in JSON format:
{
  "entityOverview": {
    "businessModel": "string",
    "marketPosition": "string",
    "keyStrengths": ["string"],
    "knownChallenges": ["string"]
  },
  "opportunities": [
    {
      "type": "RFP|Partnership|Investment|Expansion",
      "title": "string",
      "description": "string",
      "estimatedValue": "string",
      "confidence": number,
      "timeline": "string"
    }
  ],
  "risks": [
    {
      "type": "Competitive|Financial|Operational|Market",
      "description": "string",
      "impact": "low|medium|high",
      "probability": number
    }
  ],
  "insights": [
    {
      "category": "Strategic|Operational|Financial|Market",
      "insight": "string",
      "dataPoints": ["string"]
    }
  ],
  "recommendations": [
    {
      "action": "string",
      "priority": "high|medium|low",
      "timeline": "string",
      "expectedOutcome": "string"
    }
  ],
  "marketAnalysis": {
    "marketSize": "string",
    "growthPotential": "string",
    "competitorCount": number,
    "marketTrends": ["string"]
  },
  "confidenceScore": number,
  "dataQuality": "high|medium|low",
  "lastUpdateSignificance": "string"
}`;

      const result = await query({
        prompt,
        options: {
          mcpServers: this.mcpConfig,
          allowedTools: [
            'mcp__neo4j-mcp__execute_query',
            'mcp__brightdata-mcp__search_engine',
            'mcp__perplexity-mcp__chat_completion',
            'mcp__better-auth__search'
          ],
          maxTurns: 6,
          systemPrompt: {
            type: "preset",
            name: "claude-3-5-sonnet-20241022",
            prompt: "You are an expert business intelligence analyst specializing in the sports industry. Provide comprehensive, actionable insights with confidence scoring and strategic recommendations."
          }
        }
      });

      const analysis = this.parseClaudeResponse(result);
      const processingTime = Date.now() - startTime;

      return {
        entityId: entity.id,
        entityName: entity.name,
        analysis,
        insights: analysis.insights?.map((i: any) => i.insight) || [],
        opportunities: analysis.opportunities || [],
        risks: analysis.risks || [],
        recommendations: analysis.recommendations?.map((r: any) => r.action) || [],
        confidence: analysis.confidenceScore || 75,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Claude analysis failed for ${entity.name}:`, error);
      
      // Fallback analysis
      return {
        entityId: entity.id,
        entityName: entity.name,
        analysis: {
          entityOverview: {
            businessModel: 'Unknown',
            marketPosition: 'Analysis failed',
            keyStrengths: [],
            knownChallenges: ['Analysis unavailable']
          },
          opportunities: [],
          risks: [],
          insights: [],
          recommendations: [],
          marketAnalysis: {
            marketSize: 'Unknown',
            growthPotential: 'Unknown',
            competitorCount: 0,
            marketTrends: []
          },
          confidenceScore: 0,
          dataQuality: 'low',
          lastUpdateSignificance: 'Analysis failed'
        },
        insights: [],
        opportunities: [],
        risks: [],
        recommendations: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 📊 Generate comprehensive batch summary
   */
  private generateBatchSummary(batchId: string, entities: HistoricalEntity[], results: BatchAnalysisResult[], totalProcessingTime: number): ClaudeBatchSummary {
    const totalInsights = results.reduce((sum, r) => sum + r.insights.length, 0);
    const totalOpportunities = results.reduce((sum, r) => sum + r.opportunities.length, 0);
    const totalRisks = results.reduce((sum, r) => sum + r.risks.length, 0);
    
    const validResults = results.filter(r => r.confidence > 0);
    const averageConfidence = validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
      : 0;

    // Calculate estimated value from opportunities
    const totalEstimatedValue = results.reduce((sum, r) => {
      return sum + r.opportunities.reduce((oppSum: number, opp: any) => {
        const value = parseFloat(opp.estimatedValue?.replace(/[^0-9.]/g, '') || '0');
        return oppSum + value;
      }, 0);
    }, 0);

    // Get top opportunities by confidence and value
    const allOpportunities = results.flatMap(r => r.opportunities);
    const topOpportunities = allOpportunities
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 10);

    // Generate key findings
    const keyFindings = [
      `Processed ${results.length} historical entities with AI analysis`,
      `Discovered ${totalOpportunities} business opportunities`,
      `Identified ${totalRisks} potential risks`,
      `Generated ${totalInsights} strategic insights`,
      `Average confidence score: ${Math.round(averageConfidence)}%`,
      `Estimated total value: £${totalEstimatedValue.toFixed(1)}M`
    ];

    // Analyze distribution
    const distribution = {
      byType: {} as Record<string, number>,
      byConfidence: {} as Record<string, number>,
      byIndustry: {} as Record<string, number>
    };

    results.forEach(result => {
      // By confidence level
      const confidenceRange = result.confidence >= 80 ? 'high' : result.confidence >= 50 ? 'medium' : 'low';
      distribution.byConfidence[confidenceRange] = (distribution.byConfidence[confidenceRange] || 0) + 1;

      // By industry
      const entity = entities.find(e => e.id === result.entityId);
      if (entity) {
        distribution.byIndustry[entity.industry] = (distribution.byIndustry[entity.industry] || 0) + 1;
      }

      // By entity type
      distribution.byType[result.analysis?.entityOverview?.businessModel || 'unknown'] = 
        (distribution.byType[result.analysis?.entityOverview?.businessModel || 'unknown'] || 0) + 1;
    });

    return {
      batchId,
      totalEntities: entities.length,
      processedEntities: results.length,
      totalInsights,
      totalOpportunities,
      totalRisks,
      averageConfidence: Math.round(averageConfidence),
      totalProcessingTime,
      estimatedValue: `£${totalEstimatedValue.toFixed(1)}M`,
      keyFindings,
      topOpportunities,
      distribution,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 📝 Store batch results in Neo4j and cache
   */
  async storeBatchResults(summary: ClaudeBatchSummary, results: BatchAnalysisResult[]): Promise<void> {
    try {
      // Store summary in cache for quick retrieval
      const cacheKey = `batch_summary_${summary.batchId}`;
      const cacheData = {
        summary,
        results,
        storedAt: new Date().toISOString()
      };

      // In production, this would be stored in Redis or database
      console.log(`💾 Storing batch results for ${summary.batchId}:`);
      console.log(`   - ${summary.totalInsights} insights`);
      console.log(`   - ${summary.totalOpportunities} opportunities`);
      console.log(`   - ${summary.estimatedValue} estimated value`);

      // Store individual entity analyses in Neo4j via MCP
      if (this.mcpConfig['neo4j-mcp']) {
        await this.storeAnalysesInNeo4j(results);
      }

    } catch (error) {
      console.error('❌ Failed to store batch results:', error);
    }
  }

  /**
   * 🗃️ Store individual analyses in Neo4j knowledge graph
   */
  private async storeAnalysesInNeo4j(results: BatchAnalysisResult[]): Promise<void> {
    try {
      for (const result of results) {
        const prompt = `Update the Neo4j knowledge graph with this AI analysis:

Entity: ${result.entityName} (ID: ${result.entityId})
Analysis: ${JSON.stringify(result.analysis, null, 2)}
Opportunities: ${JSON.stringify(result.opportunities, null, 2)}
Risks: ${JSON.stringify(result.risks, null, 2)}
Insights: ${JSON.stringify(result.insights, null, 2)}

Please:
1. Find or create the entity node
2. Add/update properties with the analysis results
3. Create relationships for opportunities and risks
4. Store insights as connected nodes
5. Update the entity's last_analyzed timestamp`;

        await query({
          prompt,
          options: {
            mcpServers: this.mcpConfig,
            allowedTools: ['mcp__neo4j-mcp__execute_query'],
            maxTurns: 2
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to store analyses in Neo4j:', error);
    }
  }

  /**
   * 🔧 Parse Claude Agent response
   */
  private parseClaudeResponse(result: any): any {
    try {
      if (result.type === 'result' && result.subtype === 'success') {
        const content = result.result?.content || result.message?.content || '';
        
        // Try to parse as JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      // Fallback
      return {
        entityOverview: { businessModel: 'Unknown', marketPosition: 'Analysis incomplete' },
        opportunities: [],
        risks: [],
        insights: [],
        recommendations: [],
        confidenceScore: 50,
        error: 'Failed to parse response'
      };
      
    } catch (error) {
      return {
        entityOverview: { businessModel: 'Error', marketPosition: 'Parse failed' },
        opportunities: [],
        risks: [],
        insights: [],
        recommendations: [],
        confidenceScore: 0,
        error: 'Parse error'
      };
    }
  }

  /**
   * 📦 Create batches from array (Memory-Optimized)
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 💾 Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100;
    }
    
    // Browser fallback - estimate based on performance memory API if available
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100;
    }
    
    return 0; // Unknown environment
  }

  /**
   * 🧹 Force garbage collection if available
   */
  private async forceGarbageCollection(): Promise<void> {
    return new Promise(resolve => {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        console.log('🧹 Forced garbage collection');
      }
      // Small delay to allow GC to complete
      setTimeout(resolve, 100);
    });
  }

  /**
   * ⏱️ Calculate adaptive delay based on memory usage
   */
  private calculateAdaptiveDelay(memoryUsedMB: number): number {
    const baseDelay = 2000; // Base 2 second delay
    const memoryMultiplier = Math.max(1, memoryUsedMB / 100); // Scale based on memory usage
    return Math.min(baseDelay * memoryMultiplier, 10000); // Cap at 10 seconds
  }

  /**
   * 📊 Get average batch memory usage
   */
  private getAverageBatchMemory(): number {
    if (this.memoryStats.batchMemories.length === 0) return 0;
    const sum = this.memoryStats.batchMemories.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.memoryStats.batchMemories.length * 100) / 100;
  }

  /**
   * 💾 Save progress checkpoint for recovery
   */
  private async saveProgressCheckpoint(
    batchId: string, 
    entities: HistoricalEntity[], 
    processedCount: number, 
    completedBatches: number
  ): Promise<void> {
    try {
      const progress = {
        total: entities.length,
        processed: processedCount,
        completedBatches: Array.from({length: completedBatches}, (_, i) => i),
        currentBatchIndex: completedBatches,
        batchSize: this.batchSize,
        maxConcurrent: this.maxConcurrent,
        memoryThreshold: this.memoryThresholdMB
      };

      await batchRecoveryManager.saveCheckpoint(
        batchId, 
        progress, 
        this.results, 
        this.memoryStats
      );
      
      console.log(`💾 Progress checkpoint saved: ${processedCount}/${entities.length} entities processed`);
    } catch (error) {
      console.warn('⚠️ Failed to save checkpoint:', error);
    }
  }

  /**
   * 🔄 Resume processing from checkpoint
   */
  async resumeFromCheckpoint(
    originalBatchId: string, 
    entities: HistoricalEntity[],
    options: {
      maxRetries?: number;
      retryDelay?: number;
      fallbackBatchSize?: number;
    } = {}
  ): Promise<ClaudeBatchSummary> {
    console.log(`🔄 Attempting to resume processing from checkpoint: ${originalBatchId}`);
    
    try {
      const checkpoint = await batchRecoveryManager.loadCheckpoint(originalBatchId);
      
      if (!checkpoint) {
        throw new Error(`No checkpoint found for batch ID: ${originalBatchId}`);
      }

      console.log(`📂 Checkpoint found: ${checkpoint.timestamp}`);
      console.log(`📊 Progress: ${checkpoint.processedEntities}/${checkpoint.totalEntities} entities`);
      
      // Resume with recovery manager
      const recoveryResult = await batchRecoveryManager.resumeFromCheckpoint(
        checkpoint,
        entities,
        options
      );

      // Generate summary for resumed processing
      const totalProcessingTime = Date.now() - new Date(checkpoint.timestamp).getTime();
      const summary = this.generateBatchSummary(
        recoveryResult.batchId || `${originalBatchId}_resumed`,
        entities,
        recoveryResult.combinedResults,
        totalProcessingTime
      );

      // Include recovery statistics
      (summary as any).recoveryStats = recoveryResult.recoveryStats;
      (summary as any).memoryStats = {
        ...this.memoryStats,
        ...checkpoint.memoryStats
      };

      console.log(`✅ Resumed processing completed successfully!`);
      console.log(`📈 Recovery stats: +${recoveryResult.recoveryStats.resumedProcessed} entities resumed`);

      return summary;

    } catch (error) {
      console.error(`❌ Failed to resume from checkpoint: ${originalBatchId}`, error);
      throw error;
    }
  }

  /**
   * 📋 List available checkpoints
   */
  async listCheckpoints(): Promise<any[]> {
    const stats = batchRecoveryManager.getRecoveryStats();
    const checkpoints = [];

    for (const batchId of stats.activeBatchIds) {
      const checkpoint = await batchRecoveryManager.loadCheckpoint(batchId);
      if (checkpoint) {
        checkpoints.push({
          batchId,
          timestamp: checkpoint.timestamp,
          progress: `${checkpoint.processedEntities}/${checkpoint.totalEntities}`,
          completion: Math.round((checkpoint.processedEntities / checkpoint.totalEntities) * 100),
          memoryPeak: checkpoint.memoryStats.peakUsage,
          age: Math.round((Date.now() - new Date(checkpoint.timestamp).getTime()) / 1000 / 60) // minutes
        });
      }
    }

    return checkpoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * 🧹 Cleanup old checkpoints
   */
  async cleanupCheckpoints(maxAgeHours: number = 24): Promise<void> {
    batchRecoveryManager.cleanupOldCheckpoints(maxAgeHours);
  }

  /**
   * ⚙️ Configure recovery settings
   */
  configureRecovery(settings: {
    enableRecovery?: boolean;
    checkpointInterval?: number;
    memoryThreshold?: number;
  }): void {
    if (settings.enableRecovery !== undefined) {
      this.enableRecovery = settings.enableRecovery;
    }
    if (settings.checkpointInterval !== undefined) {
      this.checkpointInterval = settings.checkpointInterval;
    }
    if (settings.memoryThreshold !== undefined) {
      this.memoryThresholdMB = settings.memoryThreshold;
    }

    console.log('⚙️ Recovery configuration updated:', {
      enableRecovery: this.enableRecovery,
      checkpointInterval: this.checkpointInterval,
      memoryThreshold: this.memoryThresholdMB
    });
  }

  /**
   * 📊 Get processing status (Memory-Optimized)
   */
  getProcessingStatus() {
    const currentMemory = this.getMemoryUsage();
    return {
      queueLength: this.processingQueue.length,
      processedCount: this.results.length,
      averageConfidence: this.results.length > 0 
        ? Math.round(this.results.reduce((sum, r) => sum + r.confidence, 0) / this.results.length)
        : 0,
      totalInsights: this.results.reduce((sum, r) => sum + r.insights.length, 0),
      totalOpportunities: this.results.reduce((sum, r) => sum + r.opportunities.length, 0),
      claudeAgentStatus: this.claudeAgent ? 'active' : 'inactive',
      mcpToolsAvailable: Object.keys(this.mcpConfig),
      memoryStatus: {
        currentUsageMB: currentMemory,
        thresholdMB: this.memoryThresholdMB,
        peakUsageMB: this.memoryStats.peakUsage,
        averageBatchMemoryMB: this.getAverageBatchMemory(),
        memoryUtilization: Math.round((currentMemory / this.memoryThresholdMB) * 100),
        batchCount: this.memoryStats.batchMemories.length
      },
      batchConfiguration: {
        batchSize: this.batchSize,
        maxConcurrent: this.maxConcurrent,
        memoryOptimized: true
      }
    };
  }
}

// Export singleton instance
export const enhancedHistoricalBatchProcessor = new EnhancedHistoricalBatchProcessor();
export default EnhancedHistoricalBatchProcessor;