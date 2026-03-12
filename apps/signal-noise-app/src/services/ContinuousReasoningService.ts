/**
 * Continuous Reasoning Service - 24/7 AI-powered monitoring and analysis
 */

import { supabase } from '@/lib/supabase-client';
import { Anthropic } from '@anthropic-ai/sdk';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { keywordMinesService } from './KeywordMinesService';
import { EntityCacheService } from './EntityCacheService';
import { buildAnyGraphEntityLookupFilter, buildGraphEntityLookupFilter, resolveGraphId, withRelationshipGraphIds } from '@/lib/graph-id';
import { OptimizedPrompts, OptimizedPromptConfig, PromptOptimizer } from '@/lib/optimized-prompts';
import fs from 'fs/promises';
import path from 'path';

// Pydantic-style validation schemas using Zod
const WebhookPayloadSchema = z.object({
  source: z.enum(['linkedin', 'news', 'procurement', 'web', 'api']),
  content: z.string().min(1).max(5000),
  url: z.string().url().optional(),
  keywords: z.array(z.string().min(1)).max(50),
  timestamp: z.string().datetime(),
  entity_id: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional()
});

const AnalysisResultSchema = z.object({
  entity_id: z.string(),
  entity_name: z.string(),
  analysis_type: z.enum(['periodic_analysis', 'relationship_analysis', 'opportunity_scan', 'triggered_analysis']),
  insights: z.array(z.string()),
  opportunities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['partnership', 'procurement', 'technology', 'market', 'talent']),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    estimated_value: z.string().optional(),
    timeline: z.string().optional(),
    stakeholders: z.array(z.string()),
    required_actions: z.array(z.string())
  })),
  risks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['competitive', 'technological', 'market', 'operational', 'financial']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    probability: z.number().min(0).max(1),
    impact: z.string(),
    mitigation_strategies: z.array(z.string())
  })),
  recommendations: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    category: z.enum(['strategy', 'technology', 'partnership', 'marketing', 'operations']),
    expected_outcome: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    timeline: z.string()
  })),
  confidence_score: z.number().min(0).max(100),
  next_analysis: z.string().datetime(),
  created_at: z.string().datetime()
});

const ReasoningTaskSchema = z.object({
  id: z.string(),
  entity_id: z.string(),
  entity_name: z.string(),
  task_type: z.enum(['periodic_analysis', 'triggered_analysis', 'relationship_analysis', 'opportunity_scan']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  data: z.record(z.any()),
  scheduled_at: z.string().datetime(),
  retry_count: z.number().min(0),
  max_retries: z.number().min(0).max(5)
});

interface ReasoningTask {
  id: string;
  entity_id: string;
  entity_name: string;
  task_type: 'periodic_analysis' | 'triggered_analysis' | 'relationship_analysis' | 'opportunity_scan';
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  scheduled_at: string;
  retry_count: number;
  max_retries: number;
}

interface AnalysisResult {
  entity_id: string;
  entity_name: string;
  analysis_type: string;
  insights: string[];
  opportunities: Opportunity[];
  risks: Risk[];
  recommendations: Recommendation[];
  confidence_score: number;
  next_analysis: string;
  created_at: string;
}

interface Opportunity {
  title: string;
  description: string;
  type: 'partnership' | 'procurement' | 'technology' | 'market' | 'talent';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimated_value?: string;
  timeline?: string;
  stakeholders: string[];
  required_actions: string[];
}

interface Risk {
  title: string;
  description: string;
  type: 'competitive' | 'technological' | 'market' | 'operational' | 'financial';
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  impact: string;
  mitigation_strategies: string[];
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'strategy' | 'technology' | 'partnership' | 'marketing' | 'operations';
  expected_outcome: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

interface CachedEntityRecord {
  graph_id?: string;
  neo4j_id?: string;
  labels: string[];
  properties: Record<string, any>;
  updated_at?: string;
}

export class ContinuousReasoningService {
  private entityCacheService: EntityCacheService;
  private anthropic: Anthropic;
  private claudeAgent: any;
  private isRunning = false;
  private processingQueue: ReasoningTask[] = [];
  private analysisHistory = new Map<string, string>(); // entity_id -> last_analysis_time
  private totalEntities = 4422; // Updated from 3,311 to 4,422 total entities

  constructor() {
    this.entityCacheService = new EntityCacheService();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
    this.initializeClaudeAgent();
  }

  /**
   * Initialize Claude Agent SDK with MCP configuration
   */
  private async initializeClaudeAgent(): Promise<void> {
    try {
      const mcpConfig = await this.getMCPConfig();
      this.claudeAgent = {
        query: (prompt: string, options: any = {}) => query({
          prompt,
          options: {
            mcpServers: mcpConfig,
            maxTurns: 5,
            systemPrompt: {
              type: 'preset',
              preset: 'claude_code',
              append: `You are an advanced Sports Intelligence AI assistant with access to a FalkorDB-backed graph and Supabase cache containing ${this.totalEntities}+ sports entities. 
              
              Your capabilities include:
              - Analyzing sports entities for business opportunities
              - Identifying procurement needs and digital transformation potential
              - Mapping decision makers and organizational structures
              - Providing strategic recommendations for market entry
              - Assessing competitive landscapes and partnership opportunities
              
              Always provide structured, actionable insights with confidence scores and specific next steps.`
            },
            ...options
          }
        })
      };
      console.log('✅ Claude Agent SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Claude Agent:', error);
      this.claudeAgent = null;
    }
  }

  /**
   * Load MCP configuration
   */
  private async getMCPConfig(): Promise<any> {
    try {
      const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
      const mcpConfig = JSON.parse(await fs.readFile(mcpConfigPath, 'utf-8'));
      return mcpConfig.mcpServers || {};
    } catch (error) {
      console.warn('Failed to load MCP config:', error);
      return {};
    }
  }

  /**
   * Validate webhook payload using Zod schema
   */
  validateWebhookPayload(data: any): any {
    try {
      return WebhookPayloadSchema.parse(data);
    } catch (error) {
      console.error('❌ Invalid webhook payload:', error);
      throw new Error(`Invalid webhook payload: ${error.message}`);
    }
  }

  /**
   * Validate analysis result using Zod schema
   */
  validateAnalysisResult(data: any): any {
    try {
      return AnalysisResultSchema.parse(data);
    } catch (error) {
      console.error('❌ Invalid analysis result:', error);
      throw new Error(`Invalid analysis result: ${error.message}`);
    }
  }

  /**
   * Validate reasoning task using Zod schema
   */
  validateReasoningTask(data: any): any {
    try {
      return ReasoningTaskSchema.parse(data);
    } catch (error) {
      console.error('❌ Invalid reasoning task:', error);
      throw new Error(`Invalid reasoning task: ${error.message}`);
    }
  }

  /**
   * Start the continuous reasoning service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Continuous reasoning service already running');
      return;
    }

    console.log(`🚀 Starting continuous reasoning service for ${this.totalEntities} entities...`);
    this.isRunning = true;

    // Initialize services
    await this.entityCacheService.initialize();
    await this.refreshTotalEntities();
    await this.initializeClaudeAgent();
    
    // Schedule periodic tasks
    this.schedulePeriodicAnalysis();
    
    // Start processing queue
    this.startQueueProcessor();
    
    console.log('✅ Continuous reasoning service started');
  }

  /**
   * Stop the continuous reasoning service
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping continuous reasoning service...');
    this.isRunning = false;
    this.processingQueue = [];
    console.log('✅ Continuous reasoning service stopped');
  }

  /**
   * Schedule periodic analysis for all entities
   */
  private schedulePeriodicAnalysis(): void {
    // Schedule different types of analysis at different intervals
    setInterval(async () => {
      if (this.isRunning) {
        await this.scheduleHighPriorityEntityAnalysis();
      }
    }, 15 * 60 * 1000); // Every 15 minutes for high priority

    setInterval(async () => {
      if (this.isRunning) {
        await this.scheduleMediumPriorityEntityAnalysis();
      }
    }, 1 * 60 * 60 * 1000); // Every hour for medium priority

    setInterval(async () => {
      if (this.isRunning) {
        await this.scheduleLowPriorityEntityAnalysis();
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours for low priority

    setInterval(async () => {
      if (this.isRunning) {
        await this.scheduleRelationshipAnalysis();
      }
    }, 4 * 60 * 60 * 1000); // Every 4 hours for relationship analysis
  }

  /**
   * Start processing the reasoning task queue
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isRunning && this.processingQueue.length > 0) {
        await this.processQueue();
      }
    }, 30 * 1000); // Process queue every 30 seconds
  }

  /**
   * Schedule high priority entities for analysis
   */
  private async scheduleHighPriorityEntityAnalysis(): Promise<void> {
    try {
      const entities = await this.getSchedulableEntities({
        minPriority: 8,
        limit: 25
      });

      for (const entity of entities) {
        const entityId = resolveGraphId(entity);
        if (!entityId) continue;
        const lastAnalysis = this.analysisHistory.get(entityId);
        const now = new Date();

        if (!lastAnalysis || (now.getTime() - new Date(lastAnalysis).getTime()) > 15 * 60 * 1000) {
          await this.queueAnalysisTask({
            id: `task_${entityId}_${Date.now()}`,
            entity_id: entityId,
            entity_name: entity.properties?.name || 'Unknown',
            task_type: 'periodic_analysis',
            priority: 'high',
            data: { entity: entity.properties || {}, labels: entity.labels || [] },
            scheduled_at: new Date().toISOString(),
            retry_count: 0,
            max_retries: 3
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to schedule high priority analysis:', error);
    }
  }

  /**
   * Schedule medium priority entities for analysis
   */
  private async scheduleMediumPriorityEntityAnalysis(): Promise<void> {
    try {
      const entities = await this.getSchedulableEntities({
        minPriority: 5,
        maxPriorityExclusive: 8,
        limit: 75
      });

      for (const entity of entities) {
        const entityId = resolveGraphId(entity);
        if (!entityId) continue;
        const lastAnalysis = this.analysisHistory.get(entityId);
        const now = new Date();

        if (!lastAnalysis || (now.getTime() - new Date(lastAnalysis).getTime()) > 1 * 60 * 60 * 1000) {
          await this.queueAnalysisTask({
            id: `task_${entityId}_${Date.now()}`,
            entity_id: entityId,
            entity_name: entity.properties?.name || 'Unknown',
            task_type: 'periodic_analysis',
            priority: 'medium',
            data: { entity: entity.properties || {}, labels: entity.labels || [] },
            scheduled_at: new Date().toISOString(),
            retry_count: 0,
            max_retries: 2
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to schedule medium priority analysis:', error);
    }
  }

  /**
   * Schedule low priority entities for analysis
   */
  private async scheduleLowPriorityEntityAnalysis(): Promise<void> {
    try {
      const entities = await this.getSchedulableEntities({
        maxPriorityExclusive: 5,
        includeNullPriority: true,
        limit: 150
      });

      for (const entity of entities) {
        const entityId = resolveGraphId(entity);
        if (!entityId) continue;
        const lastAnalysis = this.analysisHistory.get(entityId);
        const now = new Date();

        if (!lastAnalysis || (now.getTime() - new Date(lastAnalysis).getTime()) > 6 * 60 * 60 * 1000) {
          await this.queueAnalysisTask({
            id: `task_${entityId}_${Date.now()}`,
            entity_id: entityId,
            entity_name: entity.properties?.name || 'Unknown',
            task_type: 'periodic_analysis',
            priority: 'low',
            data: { entity: entity.properties || {}, labels: entity.labels || [] },
            scheduled_at: new Date().toISOString(),
            retry_count: 0,
            max_retries: 1
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to schedule low priority analysis:', error);
    }
  }

  /**
   * Schedule relationship analysis for entities
   */
  private async scheduleRelationshipAnalysis(): Promise<void> {
    try {
      const entities = await this.getEntitiesWithRelationshipActivity(30);

      for (const entity of entities) {
        const entityId = resolveGraphId(entity);
        if (!entityId) continue;

        await this.queueAnalysisTask({
          id: `rel_task_${entityId}_${Date.now()}`,
          entity_id: entityId,
          entity_name: entity.properties?.name || 'Unknown',
          task_type: 'relationship_analysis',
          priority: 'medium',
          data: { entity: entity.properties || {}, labels: entity.labels || [] },
          scheduled_at: new Date().toISOString(),
          retry_count: 0,
          max_retries: 2
        });
      }
    } catch (error) {
      console.error('❌ Failed to schedule relationship analysis:', error);
    }
  }

  /**
   * Queue an analysis task for processing with validation
   */
  private async queueAnalysisTask(taskData: any): Promise<void> {
    try {
      // Validate task data
      const task = this.validateReasoningTask(taskData);
      
      // Store task in database for persistence
      await supabase
        .from('reasoning_tasks')
        .insert(task);

      this.processingQueue.push(task);
      
      // Sort queue by priority
      this.processingQueue.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      console.log(`📋 Queued ${task.task_type} task for ${task.entity_name} (${task.priority} priority)`);

    } catch (error) {
      console.error('❌ Failed to queue analysis task:', error);
    }
  }

  /**
   * Process the reasoning task queue
   */
  private async processQueue(): Promise<void> {
    const batchSize = 3; // Process up to 3 tasks simultaneously
    const tasksToProcess = this.processingQueue.splice(0, batchSize);

    console.log(`🔄 Processing ${tasksToProcess.length} reasoning tasks...`);

    const promises = tasksToProcess.map(task => this.processTask(task));
    const results = await Promise.allSettled(promises);

    // Handle results
    results.forEach((result, index) => {
      const task = tasksToProcess[index];
      if (result.status === 'fulfilled') {
        console.log(`✅ Completed analysis for ${task.entity_name}`);
      } else {
        console.error(`❌ Failed analysis for ${task.entity_name}:`, result.reason);
        this.handleTaskFailure(task, result.reason);
      }
    });
  }

  /**
   * Process a single reasoning task
   */
  private async processTask(task: ReasoningTask): Promise<AnalysisResult> {
    try {
      let analysisResult: AnalysisResult;

      switch (task.task_type) {
        case 'periodic_analysis':
          analysisResult = await this.performPeriodicAnalysis(task);
          break;
        case 'relationship_analysis':
          analysisResult = await this.performRelationshipAnalysis(task);
          break;
        case 'opportunity_scan':
          analysisResult = await this.performOpportunityScan(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.task_type}`);
      }

      // Store results in database
      await this.storeAnalysisResult(analysisResult);
      
      // Update analysis history
      this.analysisHistory.set(task.entity_id, new Date().toISOString());
      
      // Trigger notifications for critical findings
      await this.triggerNotificationsIfNeeded(analysisResult);

      return analysisResult;

    } catch (error) {
      console.error(`❌ Task processing failed for ${task.entity_name}:`, error);
      throw error;
    }
  }

  /**
   * Perform periodic analysis on an entity using enhanced Claude Agent SDK
   */
  private async performPeriodicAnalysis(task: ReasoningTask): Promise<AnalysisResult> {
    const { entity, labels } = task.data;
    const entityId = task.entity_id;
    const entityName = task.entity_name;

    // Gather entity context
    const entityContext = await this.gatherEntityContext(entityId);
    
    // Get recent trends and changes
    const trends = await this.getEntityTrends(entityId);
    
    // Use optimized prompt system
    const promptConfig: Partial<OptimizedPromptConfig> = {
      temperature: 0.2,
      maxTokens: 2000,
      verbosity: entity.priorityScore > 80 ? 'comprehensive' : 'detailed'
    };

    const analysisPrompt = OptimizedPrompts.getOptimizedEntityAnalysisPrompt(
      {
        name: entityName,
        type: this.determineEntityType(labels),
        sport: entity.sport,
        country: entity.country,
        priorityScore: entity.priorityScore
      },
      entityContext,
      trends,
      promptConfig
    );

    try {
      let analysis: any;
      
      // Use Claude Agent SDK if available, fallback to regular Anthropic SDK
      if (this.claudeAgent) {
        console.log(`🤖 Using Claude Agent SDK for ${entityName} analysis`);
        
        const agentResponses = [];
        for await (const response of this.claudeAgent.query(analysisPrompt, {
          maxTurns: 3,
          temperature: 0.3
        })) {
          agentResponses.push(response);
        }
        
        // Extract and parse the final response
        const finalResponse = agentResponses[agentResponses.length - 1];
        if (finalResponse.type === 'text' || finalResponse.content) {
          const content = finalResponse.content || finalResponse;
          analysis = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
        } else {
          throw new Error('Unexpected response format from Claude Agent');
        }
      } else {
        // Fallback to regular Anthropic SDK
        console.log(`🔄 Using fallback Anthropic SDK for ${entityName}`);
        const response = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: [{ role: 'user', content: analysisPrompt }]
        });
        
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
        analysis = JSON.parse(responseText);
      }

      // Validate and create the analysis result
      const analysisResult = {
        entity_id: entityId,
        entity_name: entityName,
        analysis_type: 'periodic_analysis',
        insights: analysis.insights || [],
        opportunities: analysis.opportunities || [],
        risks: analysis.risks || [],
        recommendations: analysis.recommendations || [],
        confidence_score: analysis.confidence_score || 50,
        next_analysis: this.calculateNextAnalysis(entity.priorityScore, task.priority),
        created_at: new Date().toISOString()
      };

      // Validate the result using Zod schema
      return this.validateAnalysisResult(analysisResult);

    } catch (error) {
      console.error(`❌ Analysis failed for ${entityName}:`, error);
      
      // Return a minimal valid result on failure
      return this.validateAnalysisResult({
        entity_id: entityId,
        entity_name: entityName,
        analysis_type: 'periodic_analysis',
        insights: [`Analysis encountered an error: ${error.message}`],
        opportunities: [],
        risks: [],
        recommendations: [],
        confidence_score: 0,
        next_analysis: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      });
    }
  }

  /**
   * Perform relationship analysis on an entity
   */
  private async performRelationshipAnalysis(task: ReasoningTask): Promise<AnalysisResult> {
    const entityId = task.entity_id;
    const entityName = task.entity_name;

    // Get relationship network
    const relationships = await this.entityCacheService.getRelationshipsForEntity(entityId);
    
    // Analyze network patterns
    const networkAnalysis = await this.analyzeRelationshipNetwork(entityId, relationships);

    return {
      entity_id: entityId,
      entity_name: entityName,
      analysis_type: 'relationship_analysis',
      insights: networkAnalysis.insights,
      opportunities: networkAnalysis.opportunities,
      risks: networkAnalysis.risks,
      recommendations: networkAnalysis.recommendations,
      confidence_score: networkAnalysis.confidence_score,
      next_analysis: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      created_at: new Date().toISOString()
    };
  }

  /**
   * Perform opportunity scan for an entity
   */
  private async performOpportunityScan(task: ReasoningTask): Promise<AnalysisResult> {
    // Implementation for scanning specific opportunities
    // This would integrate with external data sources
    
    return {
      entity_id: task.entity_id,
      entity_name: task.entity_name,
      analysis_type: 'opportunity_scan',
      insights: ['Opportunity scan completed'],
      opportunities: [],
      risks: [],
      recommendations: [],
      confidence_score: 70,
      next_analysis: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      created_at: new Date().toISOString()
    };
  }

  /**
   * Store analysis result in database with validation
   */
  private async storeAnalysisResult(resultData: any): Promise<void> {
    try {
      // Validate result before storing
      const result = this.validateAnalysisResult(resultData);
      
      await supabase
        .from('analysis_results')
        .insert(result);

      console.log(`💾 Stored validated analysis result for ${result.entity_name}`);

    } catch (error) {
      console.error('❌ Failed to store analysis result:', error);
      
      // Try to store without validation for debugging
      try {
        await supabase
          .from('analysis_results')
          .insert({
            ...resultData,
            validation_error: error.message,
            stored_as_invalid: true
          });
        console.log(`⚠️ Stored result with validation error for debugging`);
      } catch (fallbackError) {
        console.error('❌ Complete storage failure:', fallbackError);
      }
    }
  }

  /**
   * Handle task failure and retry logic
   */
  private handleTaskFailure(task: ReasoningTask, error: any): void {
    task.retry_count++;
    
    if (task.retry_count <= task.max_retries) {
      console.log(`🔄 Retrying task for ${task.entity_name} (attempt ${task.retry_count}/${task.max_retries})`);
      
      // Schedule retry with exponential backoff
      const delay = Math.min(30 * Math.pow(2, task.retry_count), 300); // Max 5 minutes
      setTimeout(() => {
        this.processingQueue.push(task);
      }, delay * 1000);
    } else {
      console.error(`❌ Task failed permanently for ${task.entity_name} after ${task.max_retries} retries`);
      
      // Log permanent failure
      supabase
        .from('reasoning_failures')
        .insert({
          task_id: task.id,
          entity_id: task.entity_id,
          entity_name: task.entity_name,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          failed_at: new Date().toISOString()
        });
    }
  }

  /**
   * Helper methods
   */
  private async gatherEntityContext(entityId: string): Promise<any> {
    try {
      const entity = await this.getEntityById(entityId);
      const relationships = await this.entityCacheService.getRelationshipsForEntity(entityId);

      return entity ? {
        entity: entity.properties,
        relationships: relationships.map((rawRelationship) => {
          const relationship = withRelationshipGraphIds(rawRelationship);
          return ({
          relationship: relationship.relationship_type,
          target: relationship.source_graph_id === entityId
            ? relationship.target_name
            : relationship.source_name,
          type: relationship.source_graph_id === entityId
            ? relationship.target_labels?.[0]
            : relationship.source_labels?.[0]
        })})
      } : {};
    } catch (error) {
      console.error('Failed to gather entity context:', error);
      return {};
    }
  }

  private async getEntityTrends(entityId: string): Promise<any> {
    // Implementation would analyze historical data for trends
    return {
      trend_direction: 'stable',
      recent_changes: [],
      growth_indicators: []
    };
  }

  private async analyzeRelationshipNetwork(entityId: string, relationships: any[]): Promise<any> {
    // Implementation would analyze network patterns
    return {
      insights: ['Network analysis completed'],
      opportunities: [],
      risks: [],
      recommendations: [],
      confidence_score: 75
    };
  }

  private determineEntityType(labels: string[]): string {
    if (labels.includes('RFP')) return 'RFP';
    if (labels.includes('Person')) return 'Person';
    if (labels.includes('Organization')) return 'Organization';
    return 'Entity';
  }

  private calculateNextAnalysis(priorityScore: number, taskPriority: string): string {
    const now = new Date();
    let hours = 24; // Default

    if (taskPriority === 'critical') hours = 1;
    else if (taskPriority === 'high') hours = 4;
    else if (taskPriority === 'medium') hours = 12;
    else if (priorityScore >= 8) hours = 6;
    else if (priorityScore >= 5) hours = 18;

    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  }

  private async triggerNotificationsIfNeeded(result: AnalysisResult): Promise<void> {
    // Check for critical findings that need immediate notification
    const criticalRisks = result.risks.filter(risk => risk.severity === 'critical');
    const criticalOpportunities = result.opportunities.filter(opp => opp.urgency === 'critical');

    if (criticalRisks.length > 0 || criticalOpportunities.length > 0) {
      // Trigger notifications through keyword mines service
      console.log(`🚨 Critical findings detected for ${result.entity_name} - triggering notifications`);
      // Implementation would call notification service
    }
  }

  /**
   * Get service status including entity count
   */
  getStatus(): {
    is_running: boolean;
    queue_size: number;
    analysis_history_size: number;
    total_entities: number;
    claude_agent_active: boolean;
    last_activity: string;
  } {
    return {
      is_running: this.isRunning,
      queue_size: this.processingQueue.length,
      analysis_history_size: this.analysisHistory.size,
      total_entities: this.totalEntities,
      claude_agent_active: !!this.claudeAgent,
      last_activity: new Date().toISOString()
    };
  }

  /**
   * Process webhook data with enhanced validation
   */
  async processWebhookData(webhookData: any): Promise<{
    status: string;
    message: string;
    processed_tasks: number;
    validation_errors?: string[];
  }> {
    try {
      // Validate webhook payload
      const validatedData = this.validateWebhookPayload(webhookData);
      
      // Find relevant entities for the webhook data
      const relevantEntities = await this.findEntitiesForKeywords(validatedData.keywords);
      
      if (relevantEntities.length === 0) {
        return {
          status: 'no_matches',
          message: 'No relevant entities found for the provided keywords',
          processed_tasks: 0
        };
      }

      // Create analysis tasks for matched entities
      let processedTasks = 0;
      const validationErrors: string[] = [];

      for (const entity of relevantEntities) {
        try {
          await this.queueAnalysisTask({
            id: `webhook_${entity.id}_${Date.now()}`,
            entity_id: entity.id,
            entity_name: entity.name,
            task_type: 'triggered_analysis',
            priority: this.determinePriorityFromWebhook(validatedData),
            data: {
              entity: entity,
              webhook_data: validatedData,
              trigger_source: validatedData.source
            },
            scheduled_at: new Date().toISOString(),
            retry_count: 0,
            max_retries: 2
          });
          
          processedTasks++;
        } catch (error) {
          validationErrors.push(`Entity ${entity.name}: ${error.message}`);
        }
      }

      return {
        status: 'success',
        message: `Processed ${processedTasks} tasks for ${relevantEntities.length} entities`,
        processed_tasks: processedTasks,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined
      };

    } catch (error) {
      return {
        status: 'validation_error',
        message: `Webhook validation failed: ${error.message}`,
        processed_tasks: 0
      };
    }
  }

  /**
   * Find entities that match the given keywords
   */
  private async findEntitiesForKeywords(keywords: string[]): Promise<any[]> {
    try {
      const normalizedKeywords = keywords
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean);

      const { data, error } = await supabase
        .from('cached_entities')
        .select('graph_id, neo4j_id, labels, properties')
        .limit(200);

      if (error) {
        throw error;
      }

      return (data || [])
        .filter((entity: CachedEntityRecord) => {
          const haystack = [
            entity.properties?.name,
            entity.properties?.sport,
            entity.properties?.country,
            entity.properties?.type
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return normalizedKeywords.some((keyword) => haystack.includes(keyword));
        })
        .sort((left: CachedEntityRecord, right: CachedEntityRecord) => {
          const leftPriority = Number(left.properties?.priorityScore ?? 0);
          const rightPriority = Number(right.properties?.priorityScore ?? 0);
          if (leftPriority !== rightPriority) {
            return rightPriority - leftPriority;
          }

          return String(left.properties?.name || '').localeCompare(String(right.properties?.name || ''));
        })
        .slice(0, 20)
        .map((entity: CachedEntityRecord) => ({
          id: entity.graph_id || entity.neo4j_id,
          graph_id: entity.graph_id || entity.neo4j_id,
          name: entity.properties?.name || entity.graph_id || entity.neo4j_id,
          properties: entity.properties || {},
          labels: entity.labels || []
        }));
    } catch (error) {
      console.error('❌ Failed to find entities for keywords:', error);
      return [];
    }
  }

  /**
   * Determine task priority from webhook data
   */
  private determinePriorityFromWebhook(webhookData: any): 'low' | 'medium' | 'high' | 'critical' {
    const urgencyKeywords = ['urgent', 'immediate', 'critical', 'deadline', 'asap'];
    const highValueKeywords = ['million', 'major', 'transform', 'strategic'];
    
    const content = (webhookData.content || '').toLowerCase();
    const hasUrgency = urgencyKeywords.some(keyword => content.includes(keyword));
    const hasHighValue = highValueKeywords.some(keyword => content.includes(keyword));
    
    if (hasUrgency || hasHighValue) return 'critical';
    if (webhookData.confidence && webhookData.confidence > 0.8) return 'high';
    if (webhookData.source === 'procurement') return 'high';
    return 'medium';
  }

  private async refreshTotalEntities(): Promise<void> {
    const { count, error } = await supabase
      .from('cached_entities')
      .select('*', { count: 'exact', head: true });

    if (!error && typeof count === 'number') {
      this.totalEntities = count;
    }
  }

  private async getSchedulableEntities(options: {
    minPriority?: number;
    maxPriorityExclusive?: number;
    includeNullPriority?: boolean;
    limit: number;
  }): Promise<CachedEntityRecord[]> {
    const { limit, minPriority, maxPriorityExclusive, includeNullPriority = false } = options;
    const { data, error } = await supabase
      .from('cached_entities')
      .select('graph_id, neo4j_id, labels, properties, updated_at')
      .limit(Math.max(limit * 3, limit));

    if (error) {
      throw error;
    }

    return (data || [])
      .filter((entity: CachedEntityRecord) => this.isSchedulableEntity(entity))
      .filter((entity: CachedEntityRecord) => {
        const priority = this.getEntityPriorityScore(entity);

        if (priority === null) {
          return includeNullPriority;
        }

        if (typeof minPriority === 'number' && priority < minPriority) {
          return false;
        }

        if (typeof maxPriorityExclusive === 'number' && priority >= maxPriorityExclusive) {
          return false;
        }

        return true;
      })
      .sort((left: CachedEntityRecord, right: CachedEntityRecord) => {
        const priorityDiff = (this.getEntityPriorityScore(right) ?? -1) - (this.getEntityPriorityScore(left) ?? -1);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
      })
      .slice(0, limit);
  }

  private async getEntitiesWithRelationshipActivity(limit: number): Promise<CachedEntityRecord[]> {
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('entity_relationships')
      .select('source_graph_id, target_graph_id, source_neo4j_id, target_neo4j_id')
      .eq('is_active', true)
      .or(`updated_at.gte.${cutoff},last_synced_at.gte.${cutoff}`)
      .limit(limit * 4);

    if (error) {
      throw error;
    }

    const entityIds = Array.from(new Set(
      (data || [])
        .map((relationship: any) => withRelationshipGraphIds(relationship))
        .flatMap((relationship: any) => [
          relationship.source_graph_id,
          relationship.target_graph_id,
        ])
        .filter(Boolean)
    ));

    if (entityIds.length === 0) {
      return [];
    }

    const { data: entities, error: entitiesError } = await supabase
      .from('cached_entities')
      .select('graph_id, neo4j_id, labels, properties, updated_at')
      .or(buildAnyGraphEntityLookupFilter(entityIds.slice(0, limit * 2)));

    if (entitiesError) {
      throw entitiesError;
    }

    return (entities || [])
      .filter((entity: CachedEntityRecord) => this.isSchedulableEntity(entity))
      .slice(0, limit);
  }

  private async getEntityById(entityId: string): Promise<CachedEntityRecord | null> {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('graph_id, neo4j_id, labels, properties, updated_at')
      .or(buildGraphEntityLookupFilter(entityId))
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  }

  private isSchedulableEntity(entity: CachedEntityRecord): boolean {
    const labels = entity.labels || [];
    return labels.includes('Entity') || labels.includes('Organization') || labels.includes('RFP');
  }

  private getEntityPriorityScore(entity: CachedEntityRecord): number | null {
    const rawPriority = entity.properties?.priorityScore;
    if (rawPriority === null || rawPriority === undefined || rawPriority === '') {
      return null;
    }

    const numericPriority = Number(rawPriority);
    return Number.isFinite(numericPriority) ? numericPriority : null;
  }
}

// Export singleton
export const continuousReasoningService = new ContinuousReasoningService();
