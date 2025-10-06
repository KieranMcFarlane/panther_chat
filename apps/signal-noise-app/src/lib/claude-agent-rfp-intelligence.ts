/**
 * 🤖 Claude Agent for RFP Intelligence
 * 
 * Advanced AI agent using Claude Agent SDK with CopilotKit integration
 * for sophisticated RFP analysis and business intelligence reasoning
 */

import { Agent, Task, query } from '@anthropic-ai/claude-agent-sdk';
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
  type: 'enrichment' | 'analysis' | 'reasoning' | 'classification';
  status: 'pending' | 'running' | 'completed' | 'failed';
  data: any[];
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  processedAt?: string;
  results?: any;
}

class RFPIntelligenceAgent {
  private agent: Agent;
  private processingQueue: BatchJob[] = [];
  private webhookHandlers: Map<string, Function> = new Map();

  constructor() {
    this.agent = new Agent({
      name: 'RFP Intelligence Analyst',
      instructions: `You are an elite RFP intelligence analyst with expertise in:
- Sports technology market analysis
- Government procurement and RFP analysis
- Competitive intelligence and business development
- Company strategy and organizational analysis

Your core responsibilities:
1. Analyze RFPs for strategic fit and opportunity assessment
2. Evaluate company changes and market signals for business opportunities
3. Provide actionable intelligence with confidence scoring
4. Assess significance, urgency, and business impact of alerts
5. Recommend specific actions and strategies

Always provide:
- Significance assessment (critical/high/medium/low)
- Urgency evaluation (immediate/high/medium/low)
- Business impact analysis
- Strategic recommendations
- Confidence scores (0-100)
- Opportunity ratings (0-100)`,
      model: 'claude-3-5-sonnet-20241022',
      tools: {
        analyzeRFP: this.analyzeRFP.bind(this),
        reasonAboutAlert: this.reasonAboutAlert.bind(this),
        enrichEntity: this.enrichEntity.bind(this),
        assessMarketContext: this.assessMarketContext.bind(this)
      }
    });

    this.initializeWebhookHandlers();
  }

  /**
   * 🔄 Get MCP configuration from existing CopilotKit setup
   */
  private async getMCPConfig(): Promise<any> {
    try {
      // Use the same MCP config as CopilotKit for consistency
      const response = await fetch('/api/mcp-config');
      if (!response.ok) {
        throw new Error('Failed to fetch MCP config');
      }
      const data = await response.json();
      return data.mcpServers || {};
    } catch (error) {
      console.warn('Failed to load MCP config:', error);
      return {};
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
4. Risk assessment and mitigation strategies
5. Recommended approach and timeline
6. Confidence level in analysis (0-100)

Return your response as structured JSON with all these fields.`;

    try {
      const mcpConfig = await this.getMCPConfig();
      
      const result = await query({
        prompt,
        options: {
          mcpServers: mcpConfig,
          maxTurns: 5,
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: "You are an elite RFP intelligence analyst. Always provide structured JSON responses with confidence scores and strategic recommendations."
          },
          allowedTools: [
            'mcp__neo4j-mcp__execute_query',
            'mcp__brightdata-mcp__search_engine',
            'mcp__byterover-mcp__byterover-retrieve-knowledge',
            'Read', 'Grep', 'Glob'
          ],
          settingSources: ['project']
        }
      });

      // Extract the analysis from the Claude response
      const analysis = await this.extractAnalysisFromStream(result);
      return this.parseAnalysisResult(analysis, 'rfp_analysis');

    } catch (error) {
      console.error('RFP analysis failed:', error);
      return this.generateFallbackAnalysis(rfp, entityContext);
    }
  }

  /**
   * 📤 Extract analysis from Claude Agent response stream
   */
  private async extractAnalysisFromStream(stream: AsyncIterable<any>): Promise<any> {
    let analysisText = '';
    let toolResults: any[] = [];

    for await (const response of stream) {
      if (response.type === 'assistant') {
        const textContent = response.message.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
        analysisText += textContent;
      }
      
      if (response.type === 'tool_result') {
        toolResults.push({
          tool: response.tool,
          result: response.result
        });
      }
    }

    // Try to parse JSON from the response
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          toolResults,
          rawAnalysis: analysisText
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON from Claude response:', error);
    }

    // Fallback: return the raw text with tool results
    return {
      analysis: analysisText,
      toolResults,
      structured: false
    };
  }

  /**
   * 🧠 Advanced reasoning about alerts and business signals using Claude Agent with MCP tools
   */
  async reasonAboutAlert(alert: AlertData, entityContext?: Entity): Promise<any> {
    const prompt = `Provide sophisticated business intelligence analysis for this alert:

Alert Details:
Type: ${alert.type}
Entity: ${alert.entity}
Description: ${alert.description}
Impact: ${alert.impact}%
Source: ${alert.source}
Timestamp: ${alert.timestamp}

${entityContext ? `Entity Context:
Industry: ${entityContext.industry}
Size: ${entityContext.size}
Location: ${entityContext.location}
Recent Activity: ${entityContext.recentActivity?.length || 0} recent changes` : ''}

First, search our knowledge base and Neo4j database for information about ${alert.entity}.

Then analyze and provide:
1. Significance assessment (critical/high/medium/low) with detailed reasoning
2. Urgency evaluation (immediate/high/medium/low) with timeline recommendations  
3. Business impact analysis with specific implications
4. Strategic implications for Yellow Panther
5. Recommended actions (prioritized)
6. Opportunity score (0-100) with explanation
7. Confidence level (0-100)
8. Risk assessment and mitigation strategies
9. Related opportunities or follow-up actions

Return your response as structured JSON with all these fields.`;

    try {
      const mcpConfig = await this.getMCPConfig();
      
      const result = await query({
        prompt,
        options: {
          mcpServers: mcpConfig,
          maxTurns: 5,
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: "You are an elite business intelligence analyst. Always provide structured JSON responses with significance assessments, urgency evaluations, and strategic recommendations."
          },
          allowedTools: [
            'mcp__neo4j-mcp__execute_query',
            'mcp__brightdata-mcp__search_engine',
            'mcp__byterover-mcp__byterover-retrieve-knowledge',
            'Read', 'Grep', 'Glob'
          ],
          settingSources: ['project']
        }
      });

      // Extract the reasoning from the Claude response
      const reasoning = await this.extractAnalysisFromStream(result);
      return this.parseAnalysisResult(reasoning, 'alert_reasoning');

    } catch (error) {
      console.error('Alert reasoning failed:', error);
      return this.generateFallbackReasoning(alert);
    }
  }

  /**
   * 🔍 Enrich entity data with comprehensive intelligence
   */
  async enrichEntity(entity: Entity): Promise<any> {
    const task = new Task({
      description: `Enrich this entity with comprehensive business intelligence:

Entity Information:
Name: ${entity.name}
Type: ${entity.type}
Industry: ${entity.industry}
Size: ${entity.size}
Location: ${entity.location}
Description: ${entity.description || 'Not provided'}

Provide comprehensive enrichment including:
1. Company background and history
2. Key executives and decision makers
3. Recent strategic initiatives and changes
4. Market position and competitive landscape
5. Technology stack and infrastructure
6. Business model and revenue streams
7. Recent news and market signals
8. Yellow Panther opportunity assessment
9. Recommended engagement strategies
10. Risk factors and considerations`,
      expectedOutput: 'structured JSON with enriched entity intelligence',
      context: {
        entityData: entity,
        analysisType: 'entity_enrichment'
      }
    });

    try {
      const result = await this.agent.execute(task);
      return this.parseAnalysisResult(result, 'entity_enrichment');
    } catch (error) {
      console.error('Entity enrichment failed:', error);
      return this.generateFallbackEnrichment(entity);
    }
  }

  /**
   * 🌐 Assess market context and competitive landscape
   */
  async assessMarketContext(industry: string, region?: string): Promise<any> {
    const task = new Task({
      description: `Provide comprehensive market intelligence analysis:

Industry: ${industry}
Region: ${region || 'Global'}

Analyze and provide:
1. Market size and growth projections
2. Key trends and drivers
3. Competitive landscape analysis
4. Regulatory environment considerations
5. Technology adoption trends
6. Opportunity hotspots and timing
7. Threats and challenges
8. Yellow Panther positioning strategy
9. Recommended market entry or expansion approaches
10. Risk assessment and mitigation strategies`,
      expectedOutput: 'structured JSON with comprehensive market intelligence',
      context: {
        industry,
        region,
        analysisType: 'market_intelligence'
      }
    });

    try {
      const result = await this.agent.execute(task);
      return this.parseAnalysisResult(result, 'market_intelligence');
    } catch (error) {
      console.error('Market analysis failed:', error);
      return this.generateFallbackMarketAnalysis(industry, region);
    }
  }

  /**
   * 🔄 Process batch jobs for bulk data analysis
   */
  async processBatchJob(job: BatchJob): Promise<any> {
    job.status = 'running';
    
    try {
      let results: any[] = [];

      switch (job.type) {
        case 'enrichment':
          for (const entity of job.data) {
            const enriched = await this.enrichEntity(entity);
            results.push(enriched);
          }
          break;

        case 'analysis':
          for (const rfp of job.data) {
            const analyzed = await this.analyzeRFP(rfp);
            results.push(analyzed);
          }
          break;

        case 'reasoning':
          for (const alert of job.data) {
            const reasoned = await this.reasonAboutAlert(alert);
            results.push(reasoned);
          }
          break;

        case 'classification':
          for (const item of job.data) {
            const classified = await this.classifyItem(item);
            results.push(classified);
          }
          break;
      }

      job.status = 'completed';
      job.processedAt = new Date().toISOString();
      job.results = results;

      return {
        success: true,
        jobId: job.id,
        processed: job.data.length,
        results
      };

    } catch (error) {
      job.status = 'failed';
      console.error(`Batch job ${job.id} failed:`, error);
      
      return {
        success: false,
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 📦 Add batch job to processing queue
   */
  addBatchJob(data: any[], type: BatchJob['type'], priority: BatchJob['priority'] = 'medium'): string {
    const job: BatchJob = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'pending',
      data,
      priority,
      createdAt: new Date().toISOString()
    };

    this.processingQueue.push(job);
    
    // Process queue asynchronously
    this.processQueue();
    
    return job.id;
  }

  /**
   * 🔄 Process batch queue with priority handling
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue.length === 0) return;

    // Sort by priority
    const sortedJobs = this.processingQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Process next job
    const nextJob = sortedJobs[0];
    if (nextJob.status === 'pending') {
      // Remove from queue and process
      this.processingQueue = this.processingQueue.filter(job => job.id !== nextJob.id);
      await this.processBatchJob(nextJob);
    }
  }

  /**
   * 🎣 Initialize webhook handlers for real-time processing
   */
  private initializeWebhookHandlers(): void {
    // Webhook for new RFP alerts
    this.webhookHandlers.set('rfp_alert', async (data: any) => {
      const analysis = await this.analyzeRFP(data.rfp, data.entity);
      return {
        type: 'rfp_analysis',
        data: analysis,
        processedAt: new Date().toISOString()
      };
    });

    // Webhook for entity alerts
    this.webhookHandlers.set('entity_alert', async (data: any) => {
      const reasoning = await this.reasonAboutAlert(data.alert, data.entity);
      return {
        type: 'alert_reasoning',
        data: reasoning,
        processedAt: new Date().toISOString()
      };
    });

    // Webhook for entity enrichment
    this.webhookHandlers.set('entity_enrichment', async (data: any) => {
      const enriched = await this.enrichEntity(data.entity);
      return {
        type: 'entity_enrichment',
        data: enriched,
        processedAt: new Date().toISOString()
      };
    });

    // Webhook for market intelligence
    this.webhookHandlers.set('market_intelligence', async (data: any) => {
      const analysis = await this.assessMarketContext(data.industry, data.region);
      return {
        type: 'market_intelligence',
        data: analysis,
        processedAt: new Date().toISOString()
      };
    });
  }

  /**
   * 🌐 Process webhook with Claude Agent analysis
   */
  async processWebhook(webhookType: string, data: any): Promise<any> {
    const handler = this.webhookHandlers.get(webhookType);
    
    if (!handler) {
      throw new Error(`Unknown webhook type: ${webhookType}`);
    }

    try {
      const result = await handler(data);
      
      // Log processing for audit trail
      console.log(`Webhook processed: ${webhookType}`, {
        timestamp: new Date().toISOString(),
        webhookType,
        dataType: data.type || 'unknown',
        success: true
      });

      return result;
    } catch (error) {
      console.error(`Webhook processing failed: ${webhookType}`, error);
      throw error;
    }
  }

  /**
   * 📊 Get batch processing status
   */
  getBatchStatus(): any {
    return {
      queue: this.processingQueue.map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        priority: job.priority,
        itemCount: job.data.length,
        createdAt: job.createdAt,
        processedAt: job.processedAt
      })),
      totalInQueue: this.processingQueue.length,
      availableHandlers: Array.from(this.webhookHandlers.keys())
    };
  }

  /**
   * 🔧 Parse analysis result from Claude Agent
   */
  private parseAnalysisResult(result: any, analysisType: string): any {
    try {
      // Handle different response formats from Claude Agent
      if (typeof result === 'string') {
        // Try to parse JSON from string response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      if (typeof result === 'object') {
        return result;
      }

      // Fallback: structure the raw result
      return {
        analysisType,
        rawResult: result,
        timestamp: new Date().toISOString(),
        confidence: 75, // Default confidence for parsed results
        success: true
      };
    } catch (error) {
      console.error('Failed to parse analysis result:', error);
      return {
        analysisType,
        error: 'Failed to parse result',
        rawResult: result,
        timestamp: new Date().toISOString(),
        confidence: 0,
        success: false
      };
    }
  }

  /**
   * 🔄 Fallback methods when Claude Agent is unavailable
   */
  private generateFallbackAnalysis(rfp: RFPData, entityContext?: Entity): any {
    return {
      analysisType: 'rfp_analysis',
      yellowPantherFit: {
        score: 75,
        reasoning: 'Standard RFP with potential Yellow Panther fit',
        strengths: ['Technology alignment', 'Sports industry relevance'],
        challenges: ['Competitive landscape', 'Timeline constraints']
      },
      strategicAssessment: {
        value: 'Medium',
        complexity: 'Moderate',
        timeline: '3-6 months',
        riskLevel: 'Medium'
      },
      recommendations: [
        'Review technical requirements in detail',
        'Assess competitive positioning',
        'Prepare Yellow Panther value proposition'
      ],
      confidence: 60,
      opportunityScore: 70,
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  private generateFallbackReasoning(alert: AlertData): any {
    const significanceScores = {
      'promotion': 'high',
      'departure': 'critical',
      'hiring': 'medium',
      'funding': 'high',
      'expansion': 'high',
      'traffic': 'low',
      'post': 'low'
    };

    const urgencyScores = {
      'departure': 'immediate',
      'funding': 'high',
      'expansion': 'high',
      'promotion': 'medium',
      'hiring': 'medium',
      'traffic': 'low',
      'post': 'low'
    };

    return {
      analysisType: 'alert_reasoning',
      reasoning: {
        significance: significanceScores[alert.type] || 'medium',
        urgency: urgencyScores[alert.type] || 'medium',
        businessImpact: `${alert.entity} ${alert.description} may present opportunities for Yellow Panther engagement`,
        recommendedActions: ['Monitor for further developments', 'Research entity background'],
        riskAssessment: 'Standard business risk levels apply',
        opportunityScore: 65,
        confidenceLevel: 70
      },
      insights: {
        strategicImplications: [`Alert from ${alert.entity} may indicate strategic direction`],
        tacticalRecommendations: ['Monitor for engagement opportunities']
      },
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  private generateFallbackEnrichment(entity: Entity): any {
    return {
      analysisType: 'entity_enrichment',
      enrichedData: {
        background: `${entity.name} is a ${entity.size} ${entity.industry} organization based in ${entity.location}.`,
        marketPosition: 'Established player in respective market',
        recentActivity: entity.recentActivity || [],
        opportunityAssessment: {
          score: 70,
          reasoning: 'Standard opportunity assessment based on available data'
        }
      },
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  private generateFallbackMarketAnalysis(industry: string, region?: string): any {
    return {
      analysisType: 'market_intelligence',
      marketContext: {
        industry,
        region: region || 'Global',
        conditions: 'stable',
        growthRate: 0.05,
        trends: ['Digital transformation', 'Increased competition'],
        opportunities: ['Technology adoption', 'Market expansion']
      },
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  private async classifyItem(item: any): Promise<any> {
    // Basic classification logic
    return {
      type: 'classification',
      item,
      category: 'business_intelligence',
      confidence: 80,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const rfpIntelligenceAgent = new RFPIntelligenceAgent();
export default RFPIntelligenceAgent;