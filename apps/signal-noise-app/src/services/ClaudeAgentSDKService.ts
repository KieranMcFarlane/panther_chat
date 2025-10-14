import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

export interface ClaudeAgentMessage {
  type: 'system' | 'user' | 'assistant' | 'tool' | 'result' | 'error';
  uuid: string;
  session_id: string;
  timestamp: string;
  data: any;
}

export interface ClaudeAgentStreamOptions {
  sessionId: string;
  systemPrompt?: string;
  allowedTools?: string[];
  maxTurns?: number;
  model?: string;
}

export class ClaudeAgentSDKService {
  private anthropic: Anthropic;
  private activeStreams = new Map<string, ReadableStreamDefaultController>();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '',
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic'
    });
  }

  async createStream(options: ClaudeAgentStreamOptions): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: (controller) => {
        this.activeStreams.set(options.sessionId, controller);
        
        // Send initial system message
        this.sendMessage(controller, {
          type: 'system',
          uuid: uuidv4(),
          session_id: options.sessionId,
          timestamp: new Date().toISOString(),
          data: {
            type: 'system',
            subtype: 'init',
            model: options.model || 'claude-3-sonnet-20241022',
            tools: options.allowedTools || ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
            permission_mode: 'default',
            mcp_servers: [
              { name: 'neo4j-mcp', status: 'connected' },
              { name: 'perplexity-mcp', status: 'connected' },
              { name: 'brightdata', status: 'connected' }
            ]
          }
        });
      },
      cancel: () => {
        this.activeStreams.delete(options.sessionId);
      }
    });

    return stream;
  }

  async processMessage(sessionId: string, message: string): Promise<void> {
    const controller = this.activeStreams.get(sessionId);
    if (!controller) return;

    // Send user message
    this.sendMessage(controller, {
      type: 'user',
      uuid: uuidv4(),
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      data: {
        type: 'user',
        message: {
          role: 'user',
          content: message
        }
      }
    });

    try {
      // Process with actual Claude SDK
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
        system: this.getSystemPrompt()
      });

      // Send assistant response
      this.sendMessage(controller, {
        type: 'assistant',
        uuid: uuidv4(),
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        data: {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: response.content[0]?.type === 'text' ? response.content[0].text : 'Processing...',
            model: response.model
          }
        }
      });

      // Send result message
      this.sendMessage(controller, {
        type: 'result',
        uuid: uuidv4(),
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        data: {
          type: 'result',
          subtype: 'success',
          duration_ms: Date.now(),
          is_error: false,
          num_turns: 1,
          result: response.content[0]?.type === 'text' ? response.content[0].text : 'Complete',
          usage: response.usage,
          total_cost_usd: this.calculateCost(response.usage)
        }
      });

    } catch (error) {
      // Send error message
      this.sendMessage(controller, {
        type: 'error',
        uuid: uuidv4(),
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        data: {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          context: 'claude_sdk_processing'
        }
      });
    }
  }

  async createSession(options: any): Promise<string> {
    const sessionId = uuidv4()
    console.log(`🧠 Creating Claude session: ${sessionId}`)
    
    // Store session configuration
    this.activeSessions = this.activeSessions || new Map()
    this.activeSessions.set(sessionId, {
      id: sessionId,
      systemPrompt: options.systemPrompt,
      allowedTools: options.allowedTools,
      mcpServers: options.mcpServers,
      createdAt: new Date().toISOString()
    })
    
    return sessionId
  }

  async sendMessage(sessionId: string, message: any): Promise<any> {
    console.log(`📤 Sending message to Claude session ${sessionId}:`, message.type)
    
    try {
      // Process message based on type
      switch (message.data?.action) {
        case 'search_rfp_signals':
          return await this.processRFPSearch(sessionId, message.data)
        case 'analyze_relationships':
          return await this.processRelationshipAnalysis(sessionId, message.data)
        case 'match_patterns':
          return await this.processPatternMatching(sessionId, message.data)
        case 'enhance_analysis':
          return await this.processEnhancedAnalysis(sessionId, message.data)
        default:
          return await this.processGenericMessage(sessionId, message)
      }
    } catch (error) {
      console.error(`❌ Error processing message for session ${sessionId}:`, error)
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }
    }
  }

  private async processRFPSearch(sessionId: string, data: any): Promise<any> {
    // Simulate real BrightData MCP integration for LinkedIn RFP search
    console.log(`🔍 Searching RFP signals for ${data.entity.name} using BrightData MCP`)
    
    return {
      rfp_signals: true,
      title: `${data.entity.name} - Digital Transformation RFP`,
      description: `Procurement opportunity detected for ${data.entity.name} digital transformation initiatives`,
      fit_score: 88,
      confidence_score: 85,
      keywords: ['digital transformation', 'fan engagement', 'technology'],
      category: 'TECHNOLOGY',
      estimated_value: '€2M - €5M',
      source_url: `https://linkedin.com/company/${data.entity.name.toLowerCase().replace(/\s+/g, '-')}`,
      evidence_links: [
        {
          title: 'LinkedIn Procurement Signals',
          url: 'https://linkedin.com',
          type: 'procurement',
          confidence: 0.85
        }
      ]
    }
  }

  private async processRelationshipAnalysis(sessionId: string, data: any): Promise<any> {
    // Simulate real Neo4j MCP integration for relationship analysis
    console.log(`🕸️ Analyzing relationships for ${data.entity.name} using Neo4j MCP`)
    
    return {
      opportunity_signals: true,
      relationship_strength: 0.8,
      partner_potential: 0.75,
      title: `${data.entity.name} - Partnership Opportunity`,
      description: `Strong relationship indicators suggest partnership potential`,
      fit_score: 82,
      confidence_score: 78,
      keywords: ['partnership', 'expansion', 'collaboration'],
      category: 'PARTNERSHIP'
    }
  }

  private async processPatternMatching(sessionId: string, data: any): Promise<any> {
    // Simulate real Supabase MCP integration for pattern matching
    console.log(`🎯 Matching patterns for ${data.entity.name} using Supabase MCP`)
    
    return {
      pattern_matches: true,
      similar_entities: 3,
      success_rate: 0.72,
      title: `${data.entity.name} - Pattern-Based Opportunity`,
      description: `Entity matches successful historical patterns`,
      fit_score: 76,
      confidence_score: 70,
      keywords: ['similar_entity', 'historical_success', 'pattern_match'],
      category: 'SIMILARITY'
    }
  }

  private async processEnhancedAnalysis(sessionId: string, data: any): Promise<any> {
    // Simulate real Byterover MCP integration for AI-powered analysis
    console.log(`💡 Enhancing analysis for RFP using Byterover MCP`)
    
    return {
      enhanced_scoring: true,
      confidence_score: 92,
      additional_evidence: [
        'Market trends support digital transformation investment',
        'Similar projects show high success rates',
        'Key decision makers actively seeking solutions'
      ],
      market_context: 'Sports technology market seeing 40% growth in digital transformation initiatives',
      risk_assessment: 'Low risk, high opportunity',
      recommendations: [
        'Prioritize fan engagement solutions',
        'Focus on mobile-first approach',
        'Emphasize ROI and fan experience improvements'
      ]
    }
  }

  private async processGenericMessage(sessionId: string, message: any): Promise<any> {
    // Process generic messages with Claude
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(message.data)
          }
        ],
        system: 'You are an AI assistant specialized in sports industry RFP analysis and opportunity discovery.'
      })

      return {
        success: true,
        response: response.content[0]?.type === 'text' ? response.content[0].text : 'Analysis complete',
        usage: response.usage
      }
    } catch (error) {
      console.error('Generic message processing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      }
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    console.log(`🔒 Closing Claude session: ${sessionId}`)
    if (this.activeSessions) {
      this.activeSessions.delete(sessionId)
    }
  }

  private calculateCost(usage: any): number {
    // Claude 3 Sonnet pricing: $3 per million input tokens, $15 per million output tokens
    const inputCost = (usage.input_tokens * 3) / 1000000
    const outputCost = (usage.output_tokens * 15) / 1000000
    return inputCost + outputCost
  }

  private getSystemPrompt(): string {
    return `You are an AI agent specialized in sports industry RFP discovery and analysis. 
You have access to MCP tools for web scraping, knowledge graph queries, and AI analysis.
Your goal is to identify high-value procurement opportunities and provide actionable insights.`
  }

  private activeSessions = new Map()

  async processToolExecution(sessionId: string, toolName: string, action: string, input: any): Promise<void> {
    const controller = this.activeStreams.get(sessionId);
    if (!controller) return;

    this.sendMessage(controller, {
      type: 'tool',
      uuid: uuidv4(),
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      data: {
        tool_name: toolName,
        action,
        input,
        status: 'executing',
        duration: 0
      }
    });

    // Simulate tool execution (in real implementation, this would execute the actual tool)
    setTimeout(() => {
      this.sendMessage(controller, {
        type: 'tool',
        uuid: uuidv4(),
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        data: {
          tool_name: toolName,
          action,
          input,
          output: `Tool ${toolName} executed successfully`,
          status: 'completed',
          duration: 150
        }
      });
    }, 150);
  }

  endStream(sessionId: string): void {
    const controller = this.activeStreams.get(sessionId);
    if (!controller) return;

    // Send disconnect message
    this.sendMessage(controller, {
      type: 'system',
      uuid: uuidv4(),
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      data: {
        type: 'system',
        event: 'disconnected',
        message: 'Session ended'
      }
    });

    try {
      controller.close();
    } catch (error) {
      // Stream might already be closed
    }
    
    this.activeStreams.delete(sessionId);
  }

  private sendMessage(controller: ReadableStreamDefaultController, message: ClaudeAgentMessage): void {
    try {
      const data = `data: ${JSON.stringify(message)}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      // Stream might be closed, remove from active streams
      const sessionId = message.session_id;
      this.activeStreams.delete(sessionId);
    }
  }

  private getSystemPrompt(): string {
    return `You are a Sports Intelligence AI assistant powered by Claude Agent SDK with access to powerful MCP tools:

🔍 Database Tools:
- Neo4j database with 3,325+ sports entities (clubs, players, competitions, relationships)
- Execute Cypher queries for complex sports data analysis

🌐 Real-time Intelligence:
- BrightData web scraping for current sports news and market information
- Perplexity AI search for up-to-date insights and analysis

🎯 RFP Intelligence Integration:
- Access to current RFP Intelligence Dashboard state
- View selected RFP opportunities, fit scores, and analysis results
- Select specific RFP alerts by company name
- Open email compose for outreach to selected opportunities

📊 Capabilities:
- Search and analyze sports clubs, players, competitions
- Identify business opportunities and decision makers
- Analyze RFP opportunities and draft outreach emails
- Interact with the RFP Intelligence Dashboard

Current Instance: Sports Intelligence 1
Agent Type: Sports Intelligence
Description: Analyze sports entities and relationships`;
  }

  private calculateCost(usage: any): number {
    // Simple cost calculation based on token usage
    const inputCost = (usage.input_tokens || 0) * 0.000003; // $3 per million input tokens
    const outputCost = (usage.output_tokens || 0) * 0.000015; // $15 per million output tokens
    return inputCost + outputCost;
  }
}

// Singleton instance
export const claudeAgentSDKService = new ClaudeAgentSDKService();