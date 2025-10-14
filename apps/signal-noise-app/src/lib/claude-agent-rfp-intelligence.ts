/**
 * 🤖 Claude Agent for RFP Intelligence
 * 
 * Advanced AI agent using Claude Agent SDK with CopilotKit integration
 * for sophisticated RFP analysis and business intelligence reasoning
 */

import { query, tool } from '@anthropic-ai/claude-agent-sdk';
import { copilotKitAgent } from './copilotkit-claude-agent';

interface Entity {
  id: string;
  name: string;
  type: 'company' | 'person';
  industry: string;
  size: string;
  location: string;
  description?: string;
  recentActivity?: any[];
}

interface RFPData {
  id: string;
  title: string;
  organization: string;
  description: string;
  value?: string;
  deadline?: string;
  category: string;
  source: string;
  published: string;
  location?: string;
  requirements?: string[];
  budget?: string;
  duration?: string;
}

interface AlertData {
  id: string;
  type: 'hiring' | 'promotion' | 'departure' | 'post' | 'traffic' | 'expansion' | 'funding';
  entity: string;
  description: string;
  impact: number;
  source: string;
  timestamp: string;
  context?: any;
}

interface BatchJob {
  id: string;
  type: string;
  data: any[];
  priority: 'high' | 'medium' | 'low';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  results?: any;
  metadata?: {
    source: string;
    requiresUpdate: boolean;
    lastUpdate?: string;
    tokenOptimized?: boolean;
    cachedFields?: string[];
  };
}

interface BatchCache {
  entityId: string;
  fieldType: string;
  data: any;
  lastProcessed: string;
  checksum: string;
  tokenCost: number;
}

interface TokenOptimizedBatch {
  entities: Map<string, BatchCache>;
  processingThreshold: number;
  lastBatchTime: string;
  totalTokensSaved: number;
}

class RFPIntelligenceAgent {
  private processingQueue: BatchJob[] = [];
  private webhookHandlers: Map<string, Function> = new Map();
  private mcpConfig: any = {};
  private batchCache: TokenOptimizedBatch = {
    entities: new Map(),
    processingThreshold: 10, // Process when 10 entities need updates
    lastBatchTime: new Date().toISOString(),
    totalTokensSaved: 0
  };

  constructor() {
    this.initializeWebhookHandlers();
    this.loadMCPConfig();
  }

  /**
   * 🔄 Load MCP configuration for enhanced batching capabilities
   */
  private async loadMCPConfig(): Promise<void> {
    try {
      // Use absolute URL to fix server-side rendering issue
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-domain.com' 
        : 'http://localhost:3005';
      
      const response = await fetch(`${baseUrl}/api/mcp-config`);
      if (response.ok) {
        const data = await response.json();
        this.mcpConfig = data.mcpServers || {};
        console.log('✅ MCP Config loaded for RFP Intelligence:', Object.keys(this.mcpConfig));
      }
    } catch (error) {
      console.warn('⚠️ Failed to load MCP config:', error);
      this.mcpConfig = {};
    }
  }

  /**
   * 🎯 Analyze RFP for strategic fit and opportunity using Claude Agent with MCP tools
   */
  async analyzeRFP(rfp: RFPData, entityContext?: Entity): Promise<any> {
    const prompt = `Analyze this RFP for Yellow Panther strategic fit and business opportunity:
      
Title: ${rfp.title}
Organization: ${rfp.organization}
Description: ${rfp.description}
Value: ${rfp.value || 'Not specified'}
Category: ${rfp.category}
Deadline: ${rfp.deadline || 'Not specified'}
Location: ${rfp.location || 'Not specified'}
Source: ${rfp.source}

${entityContext ? `Entity Context:
Name: ${entityContext.name}
Industry: ${entityContext.industry}
Size: ${entityContext.size}
Description: ${entityContext.description || 'N/A'}` : ''}

First, search our Neo4j database for information about ${rfp.organization} and similar companies in the ${rfp.category} sector.

Then provide comprehensive analysis including:
1. Yellow Panther fit score (0-100) and reasoning
2. Competitive landscape assessment 
3. Technical requirements evaluation
4. Market opportunity analysis
5. Recommended actions and timeline

Format your response as structured JSON with the following schema:
{
  "fitScore": number,
  "significance": "critical"|"high"|"medium"|"low",
  "urgency": "immediate"|"high"|"medium"|"low", 
  "businessImpact": "string",
  "competitiveAdvantage": "string",
  "technicalRequirements": ["string"],
  "riskAssessment": "string",
  "recommendedActions": ["string"],
  "opportunityScore": number,
  "confidenceLevel": number,
  "marketAnalysis": {
    "marketSize": "string",
    "growthPotential": "string",
    "competitorCount": number
  },
  "nextSteps": ["string"]
}`;

    try {
      // First, get advanced validation from our RFP Intelligence backend
      let backendAnalysis = null;
      try {
        const backendResponse = await fetch('http://13.60.60.50:8002/analyze/rfp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rfp_data: {
              id: rfp.id,
              title: rfp.title,
              organization: rfp.organization,
              description: rfp.description,
              value: rfp.value,
              deadline: rfp.deadline,
              category: rfp.category,
              source: rfp.source,
              published: rfp.published
            },
            entity_context: entityContext ? {
              id: entityContext.id,
              name: entityContext.name,
              type: entityContext.type,
              industry: entityContext.industry,
              description: entityContext.description,
              location: entityContext.location
            } : undefined
          })
        });
        
        if (backendResponse.ok) {
          const backendResult = await backendResponse.json();
          if (backendResult.success) {
            backendAnalysis = backendResult.analysis;
            console.log('✅ RFP backend analysis completed:', backendAnalysis);
          }
        }
      } catch (backendError) {
        console.warn('RFP backend analysis failed, proceeding with Claude Agent:', backendError);
      }

      // Then get comprehensive analysis from Claude Agent with MCP tools
      const claudeResult = await query({
        prompt,
        options: {
          mcpServers: this.mcpConfig,
          allowedTools: ['mcp__neo4j-mcp__execute_query', 'mcp__brightdata-mcp__search_engine', 'mcp__byterover-mcp__byterover-retrieve-knowledge'],
          maxTurns: 5,
          systemPrompt: {
            type: "preset",
            name: "claude-3-5-sonnet-20241022",
            prompt: "You are an elite RFP intelligence analyst with expertise in sports technology, government procurement, and competitive intelligence. Always provide structured, actionable insights with confidence scoring."
          }
        }
      });

      // Parse and structure the Claude Agent response
      const claudeAnalysis = this.parseAnalysisResult(claudeResult, 'rfp_analysis');
      
      // Merge backend analysis with Claude Agent analysis
      if (backendAnalysis) {
        return {
          ...claudeAnalysis,
          backendValidation: {
            fitScore: backendAnalysis.fitScore,
            confidenceLevel: backendAnalysis.confidenceLevel,
            opportunityScore: backendAnalysis.opportunityScore,
            winProbability: backendAnalysis.winProbability,
            significance: backendAnalysis.significance,
            urgency: backendAnalysis.urgency,
            businessImpact: backendAnalysis.businessImpact,
            recommendedActions: backendAnalysis.recommendedActions
          },
          combinedInsights: {
            averageFitScore: Math.round((claudeAnalysis.fitScore + backendAnalysis.fitScore) / 2),
            confidenceAlignment: Math.abs(claudeAnalysis.confidenceLevel - backendAnalysis.confidenceLevel) < 20,
            hasHighConfidence: claudeAnalysis.confidenceLevel > 80 && backendAnalysis.confidenceLevel > 80
          }
        };
      }
      
      return claudeAnalysis;
      
    } catch (error) {
      console.warn('Claude Agent RFP analysis failed, using fallback:', error);
      return this.getFallbackRFPAnalysis(rfp, entityContext);
    }
  }

  /**
   * 🧠 Reason about alerts using Claude Agent with MCP tools for context
   */
  async reasonAboutAlert(alert: AlertData, entityContext: Entity): Promise<any> {
    const prompt = `Analyze this business alert for strategic significance and opportunity:

Alert Details:
- Type: ${alert.type}
- Entity: ${alert.entity}
- Description: ${alert.description}
- Impact: ${alert.impact}%
- Source: ${alert.source}
- Timestamp: ${alert.timestamp}

Entity Context:
- Name: ${entityContext.name}
- Industry: ${entityContext.industry}
- Size: ${entityContext.size}
- Location: ${entityContext.location}
- Description: ${entityContext.description || 'N/A'}

Using our Neo4j knowledge base and web search capabilities:

1. Search for ${alert.entity} in our database to understand their business context
2. Research recent market trends in ${entityContext.industry}
3. Analyze competitive landscape
4. Assess strategic implications of this ${alert.type}

Provide structured analysis in JSON format:
{
  "significance": "critical"|"high"|"medium"|"low",
  "urgency": "immediate"|"high"|"medium"|"low",
  "businessImpact": "string",
  "recommendedActions": ["string"],
  "riskAssessment": "string",
  "opportunityScore": number (0-100),
  "confidenceLevel": number (0-100),
  "strategicImplications": ["string"],
  "tacticalRecommendations": ["string"],
  "timingConsiderations": "string",
  "relatedOpportunities": [
    {
      "type": "RFP"|"Partnership"|"Acquisition"|"Investment",
      "title": "string",
      "confidence": number,
      "timeline": "string"
    }
  ]
}`;

    try {
      const result = await query({
        prompt,
        options: {
          mcpServers: this.mcpConfig,
          allowedTools: ['mcp__neo4j-mcp__execute_query', 'mcp__brightdata-mcp__search_engine', 'mcp__byterover-mcp__byterover-retrieve-knowledge', 'mcp__byterover-mcp__byterover-store-knowledge'],
          maxTurns: 4,
          systemPrompt: {
            type: "preset",
            name: "claude-3-5-sonnet-20241022",
            prompt: "You are a business intelligence analyst specializing in strategic opportunity assessment and market analysis. Provide structured insights with confidence scoring."
          }
        }
      });

      return this.parseAnalysisResult(result, 'alert_reasoning');
      
    } catch (error) {
      console.warn('Claude Agent alert reasoning failed, using fallback:', error);
      return this.getFallbackAlertReasoning(alert, entityContext);
    }
  }

  /**
   * 🔄 Process webhooks with Claude Agent intelligence
   */
  async processWebhook(webhookType: string, payload: any): Promise<any> {
    console.log(`🔄 Processing webhook: ${webhookType}`, payload);
    
    const handler = this.webhookHandlers.get(webhookType);
    if (!handler) {
      throw new Error(`No handler found for webhook type: ${webhookType}`);
    }

    try {
      const result = await handler(payload);
      
      // Store learning insights using Byterover MCP
      if (this.mcpConfig['byterover-mcp']) {
        this.storeInsight(webhookType, payload, result).catch(console.warn);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Webhook processing failed for ${webhookType}:`, error);
      throw error;
    }
  }

  /**
   * 📦 Add token-optimized batch processing job
   */
  addBatchJob(data: any[], type: string, priority: 'high' | 'medium' | 'low' = 'medium'): string {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if data requires updates based on cache
    const optimizedData = this.optimizeBatchData(data, type);
    
    const job: BatchJob = {
      id: jobId,
      type,
      data: optimizedData.items,
      priority,
      status: 'queued',
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'webhook_or_manual',
        requiresUpdate: optimizedData.requiresUpdate,
        tokenOptimized: true,
        cachedFields: optimizedData.cachedFields
      }
    };

    // Only add to queue if updates are needed
    if (optimizedData.requiresUpdate) {
      const insertIndex = this.getInsertIndexByPriority(job);
      this.processingQueue.splice(insertIndex, 0, job);
      console.log(`📦 Batch job added: ${jobId} (${type}) - ${optimizedData.items.length} items needing updates`);
    } else {
      console.log(`💰 Tokens saved: ${optimizedData.items.length} items cached, no processing needed`);
      this.batchCache.totalTokensSaved += this.calculateTokenSavings(optimizedData.items.length);
    }
    
    // Check if we should trigger batch processing
    this.checkBatchThreshold();
    
    return jobId;
  }

  /**
   * 📊 Get token-optimized batch processing status
   */
  getBatchStatus() {
    const cacheHitRate = this.batchCache.entities.size > 0 
      ? (this.batchCache.totalTokensSaved / (this.batchCache.entities.size * 1000)) * 100 
      : 0;

    return {
      queue: this.processingQueue,
      totalInQueue: this.processingQueue.filter(job => job.status === 'queued').length,
      processing: this.processingQueue.filter(job => job.status === 'processing').length,
      completed: this.processingQueue.filter(job => job.status === 'completed').length,
      failed: this.processingQueue.filter(job => job.status === 'failed').length,
      availableHandlers: 3,
      tokenOptimization: {
        cachedEntities: this.batchCache.entities.size,
        tokensSaved: Math.round(this.batchCache.totalTokensSaved),
        cacheHitRate: Math.round(cacheHitRate),
        processingThreshold: this.batchCache.processingThreshold,
        lastBatchTime: this.batchCache.lastBatchTime
      }
    };
  }

  /**
   * 🎯 Enhanced batch processing using MCP tools
   */
  private async processBatchQueue(): Promise<void> {
    const processingJobs = this.processingQueue.filter(job => job.status === 'processing');
    
    if (processingJobs.length >= 3) return; // Max concurrent jobs

    const nextJob = this.processingQueue.find(job => job.status === 'queued');
    if (!nextJob) return;

    nextJob.status = 'processing';
    console.log(`🔄 Processing batch job: ${nextJob.id}`);

    try {
      const results = await this.processBatchJob(nextJob);
      nextJob.status = 'completed';
      nextJob.processedAt = new Date().toISOString();
      nextJob.results = results;
      
      console.log(`✅ Batch job completed: ${nextJob.id}`);
    } catch (error) {
      console.error(`❌ Batch job failed: ${nextJob.id}`, error);
      nextJob.status = 'failed';
      nextJob.processedAt = new Date().toISOString();
      nextJob.results = { error: error.message };
    }

    // Continue processing queue
    setTimeout(() => this.processBatchQueue(), 1000);
  }

  /**
   * 🔧 Process individual batch job with type-specific MCP tool usage
   */
  private async processBatchJob(job: BatchJob): Promise<any> {
    const { type, data } = job;
    
    switch (type) {
      case 'enrichment':
        return await this.batchEnrichEntities(data);
      case 'analysis':
        return await this.batchAnalyzeRFPs(data);
      case 'reasoning':
        return await this.batchReasonAlerts(data);
      case 'market_intelligence':
        return await this.batchMarketIntelligence(data);
      default:
        throw new Error(`Unknown batch job type: ${type}`);
    }
  }

  /**
   * 🏢 Batch entity enrichment using Neo4j and web research MCPs
   */
  private async batchEnrichEntities(entities: Entity[]): Promise<any[]> {
    const results = [];
    
    for (const entity of entities) {
      try {
        const prompt = `Enrich this entity with comprehensive business intelligence:
        
Entity: ${entity.name}
Industry: ${entity.industry}
Size: ${entity.size}
Location: ${entity.location}

Using Neo4j database and web search:
1. Find entity in our knowledge base
2. Research recent company developments 
3. Identify key decision makers
4. Analyze market position
5. Assess partnership/sales opportunities

Return structured enrichment data in JSON format with:
- Company overview
- Key personnel
- Recent developments
- Market opportunities
- Recommended engagement strategies`;

        const result = await query({
          prompt,
          options: {
            mcpServers: this.mcpConfig,
            allowedTools: ['mcp__neo4j-mcp__execute_query', 'mcp__brightdata-mcp__search_engine', 'mcp__byterover-mcp__byterover-retrieve-knowledge'],
            maxTurns: 3
          }
        });

        results.push({
          entityId: entity.id,
          enrichment: this.parseAnalysisResult(result, 'entity_enrichment'),
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        results.push({
          entityId: entity.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * 📋 Batch RFP analysis using MCP tools for market intelligence
   */
  private async batchAnalyzeRFPs(rfps: RFPData[]): Promise<any[]> {
    const results = [];
    
    for (const rfp of rfps) {
      try {
        const analysis = await this.analyzeRFP(rfp);
        results.push({
          rfpId: rfp.id,
          analysis,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          rfpId: rfp.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * 🧠 Batch alert reasoning using MCP tools for context
   */
  private async batchReasonAlerts(alerts: AlertData[]): Promise<any[]> {
    const results = [];
    
    for (const alert of alerts) {
      try {
        // Mock entity context - in production this would be fetched
        const entityContext = {
          id: alert.entity,
          name: alert.entity,
          type: 'company' as const,
          industry: 'Technology',
          size: 'medium',
          location: 'Unknown'
        };

        const reasoning = await this.reasonAboutAlert(alert, entityContext);
        results.push({
          alertId: alert.id,
          reasoning,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          alertId: alert.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * 🌐 Batch market intelligence using web search and knowledge retrieval
   */
  private async batchMarketIntelligence(targets: any[]): Promise<any[]> {
    const results = [];
    
    for (const target of targets) {
      try {
        const prompt = `Gather comprehensive market intelligence for:
        
Target: ${target.name || target.entity}
Industry: ${target.industry || 'Technology'}
Focus: ${target.focus || 'Strategic opportunities'}

Using web search and knowledge base:
1. Research market conditions and trends
2. Identify competitive landscape
3. Analyze growth opportunities
4. Assess risk factors
5. Provide strategic recommendations

Return structured intelligence in JSON format.`;

        const result = await query({
          prompt,
          options: {
            mcpServers: this.mcpConfig,
            allowedTools: ['mcp__brightdata-mcp__search_engine', 'mcp__byterover-mcp__byterover-retrieve-knowledge'],
            maxTurns: 3
          }
        });

        results.push({
          targetId: target.id || target.entity,
          intelligence: this.parseAnalysisResult(result, 'market_intelligence'),
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        results.push({
          targetId: target.id || target.entity,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * 💾 Store insights using Byterover MCP for learning
   */
  private async storeInsight(webhookType: string, payload: any, result: any): Promise<void> {
    try {
      const insight = {
        type: webhookType,
        payload,
        result,
        timestamp: new Date().toISOString(),
        learned: true
      };

      await query({
        prompt: `Store this business intelligence insight in the knowledge base:
        
${JSON.stringify(insight, null, 2)}

Extract key learnings and patterns for future reference.`,
        options: {
          mcpServers: this.mcpConfig,
          allowedTools: ['mcp__byterover-mcp__byterover-store-knowledge'],
          maxTurns: 1
        }
      });

    } catch (error) {
      console.warn('Failed to store insight:', error);
    }
  }

  /**
   * 🔧 Parse analysis result from Claude Agent
   */
  private parseAnalysisResult(result: any, type: string): any {
    try {
      // Extract the content from Claude Agent response
      if (result.type === 'result' && result.subtype === 'success') {
        const content = result.result?.content || result.message?.content || '';
        
        // Try to parse as JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      // Fallback: return structured version of text content
      return {
        type,
        content: result.result?.content || result.message?.content || 'Analysis completed',
        timestamp: new Date().toISOString(),
        confidence: 75
      };
      
    } catch (error) {
      return {
        type,
        error: 'Failed to parse analysis result',
        rawResult: result,
        timestamp: new Date().toISOString(),
        confidence: 0
      };
    }
  }

  // Helper methods for token optimization
  private optimizeBatchData(data: any[], type: string): { items: any[]; requiresUpdate: boolean; cachedFields: string[] } {
    const itemsNeedingUpdate: any[] = [];
    const cachedFields: string[] = [];
    let requiresUpdate = false;

    for (const item of data) {
      const entityId = item.id || item.entity || item.name;
      const checksum = this.generateChecksum(item);
      
      // Check cache for this entity and field type
      const cacheKey = `${entityId}_${type}`;
      const cached = this.batchCache.entities.get(cacheKey);
      
      if (cached && cached.checksum === checksum) {
        // Use cached data
        cachedFields.push(entityId);
        console.log(`💾 Cache hit for ${entityId} (${type})`);
      } else {
        // Item needs processing
        itemsNeedingUpdate.push(item);
        requiresUpdate = true;
        
        // Update cache
        this.batchCache.entities.set(cacheKey, {
          entityId,
          fieldType: type,
          data: item,
          lastProcessed: new Date().toISOString(),
          checksum,
          tokenCost: this.estimateTokenCost(item)
        });
      }
    }

    return {
      items: itemsNeedingUpdate,
      requiresUpdate,
      cachedFields
    };
  }

  private checkBatchThreshold(): void {
    const pendingUpdates = Array.from(this.batchCache.entities.values())
      .filter(cache => Date.now() - new Date(cache.lastProcessed).getTime() > 60000) // 1 minute old
      .length;

    if (pendingUpdates >= this.batchCache.processingThreshold) {
      console.log(`🚀 Batch threshold reached: ${pendingUpdates} entities ready for processing`);
      this.processBatchQueue();
    }
  }

  private generateChecksum(item: any): string {
    // Simple checksum based on key fields
    const keyFields = JSON.stringify({
      id: item.id,
      name: item.name || item.entity,
      timestamp: item.timestamp || Date.now(),
      type: item.type,
      description: item.description?.substring(0, 100) || ''
    });
    return Buffer.from(keyFields).toString('base64').substring(0, 16);
  }

  private estimateTokenCost(item: any): number {
    // Rough token estimation (1 token ≈ 4 characters)
    const text = JSON.stringify(item);
    return Math.ceil(text.length / 4);
  }

  private calculateTokenSavings(itemCount: number): number {
    // Average processing is ~2000 tokens per item
    return itemCount * 2000;
  }

  private getInsertIndexByPriority(job: BatchJob): number {
    const priorities = { high: 0, medium: 1, low: 2 };
    const jobPriority = priorities[job.priority];
    
    const index = this.processingQueue.findIndex(queuedJob => 
      priorities[queuedJob.priority] > jobPriority
    );
    
    return index === -1 ? this.processingQueue.length : index;
  }

  private initializeWebhookHandlers(): void {
    this.webhookHandlers.set('entity_alert', async (payload: any) => {
      // Validate payload structure
      if (!payload.data || !payload.data.alert) {
        throw new Error('Invalid entity alert payload: missing alert data');
      }
      
      return await this.reasonAboutAlert(payload.data.alert, payload.data.entity);
    });

    this.webhookHandlers.set('rfp_detected', async (payload: any) => {
      // Validate payload structure
      if (!payload.data || !payload.data.rfp) {
        throw new Error('Invalid RFP detected payload: missing rfp data');
      }
      
      const rfpData = payload.data.rfp;
      if (!rfpData.title || !rfpData.organization) {
        throw new Error('Invalid RFP data: missing required fields (title, organization)');
      }
      
      return await this.analyzeRFP(rfpData, payload.data.entity);
    });

    this.webhookHandlers.set('rfp_alert', async (payload: any) => {
      // Validate payload structure
      if (!payload.data || !payload.data.rfp) {
        throw new Error('Invalid RFP alert payload: missing rfp data');
      }
      
      const rfpData = payload.data.rfp;
      if (!rfpData.title || !rfpData.organization) {
        throw new Error('Invalid RFP data: missing required fields (title, organization)');
      }
      
      return await this.analyzeRFP(rfpData, payload.data.entity);
    });

    this.webhookHandlers.set('entity_enrichment', async (payload: any) => {
      // Validate payload structure
      if (!payload.data || !payload.data.entity) {
        throw new Error('Invalid entity enrichment payload: missing entity data');
      }
      
      return await this.processEntityEnrichment(payload.data.entity, payload.data.enrichment_data);
    });

    this.webhookHandlers.set('market_intelligence', async (payload: any) => {
      // Validate payload structure
      if (!payload.data) {
        throw new Error('Invalid market intelligence payload: missing data');
      }
      
      return await this.processMarketIntelligence(payload.data);
    });

    this.webhookHandlers.set('market_update', async (payload: any) => {
      // Validate payload structure
      if (!payload.data) {
        throw new Error('Invalid market update payload: missing data');
      }
      
      return await this.processMarketUpdate(payload.data);
    });
  }

  private async processEntityEnrichment(entity: any, enrichmentData?: any): Promise<any> {
    return {
      entity_id: entity.id,
      entity_name: entity.name,
      enrichment_type: 'automatic',
      enrichment_applied: enrichmentData || {},
      confidence_score: 85,
      processing_time: Date.now(),
      timestamp: new Date().toISOString()
    };
  }

  private async processMarketIntelligence(data: any): Promise<any> {
    return {
      intelligence_type: 'market_analysis',
      insights: data.insights || [],
      market_trends: data.trends || [],
      recommendations: data.recommendations || [],
      confidence_level: 75,
      timestamp: new Date().toISOString()
    };
  }

  private async processMarketUpdate(data: any): Promise<any> {
    return {
      significance: 'medium',
      impact: data.change || 'Market conditions updated',
      recommendedActions: ['Review positioning', 'Monitor competitor response'],
      timestamp: new Date().toISOString()
    };
  }

  // Fallback methods when Claude Agent is unavailable
  private getFallbackRFPAnalysis(rfp: RFPData, entityContext?: Entity): any {
    return {
      fitScore: 75,
      significance: 'medium',
      urgency: 'medium',
      businessImpact: `Potential opportunity with ${rfp.organization}`,
      recommendedActions: ['Research organization', 'Assess requirements'],
      opportunityScore: 70,
      confidenceLevel: 60,
      fallback: true
    };
  }

  private getFallbackAlertReasoning(alert: AlertData, entityContext: Entity): any {
    return {
      significance: 'medium',
      urgency: 'medium',
      businessImpact: `${alert.type} at ${alert.entity} may present opportunities`,
      recommendedActions: ['Monitor for further developments'],
      opportunityScore: 65,
      confidenceLevel: 55,
      fallback: true
    };
  }
}

// Export singleton instance
export const rfpIntelligenceAgent = new RFPIntelligenceAgent();
export default RFPIntelligenceAgent;