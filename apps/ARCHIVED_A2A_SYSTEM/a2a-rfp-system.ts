/**
 * 🤖 A2A RFP Intelligence System - Core Implementation
 * Agent-to-Agent communication with Claude SDK and MCP integration
 */

import { query, tool } from '@anthropic-ai/claude-agent-sdk';
import EventEmitter from 'events';

// ==================== AGENT COMMUNICATION PROTOCOL ====================

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'result' | 'request' | 'update' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  contextId: string;
  timestamp: string;
  requiresResponse?: boolean;
  ttl?: number; // Time to live in milliseconds
}

export interface AgentCapability {
  name: string;
  description: string;
  mcpTools: string[];
  canHandle: string[]; // Message types this agent can handle
  maxConcurrentTasks: number;
}

// ==================== BASE AGENT CLASS ====================

export abstract class BaseAgent extends EventEmitter {
  protected agentId: string;
  protected agentType: string;
  protected capabilities: AgentCapability[];
  protected activeTasks: Map<string, any> = new Map();
  protected mcpConfig: any;
  protected claudeConfig: any;
  
  constructor(agentId: string, agentType: string, capabilities: AgentCapability[]) {
    super();
    this.agentId = agentId;
    this.agentType = agentType;
    this.capabilities = capabilities;
    this.setupMessageHandling();
  }

  abstract getSystemPrompt(): string;
  abstract getMCPTools(): string[];

  protected setupMessageHandling() {
    this.on('message', this.handleMessage.bind(this));
  }

  protected async handleMessage(message: AgentMessage) {
    console.log(`🤖 ${this.agentId} received message from ${message.from}: ${message.type}`);
    
    // Check if we can handle this message type
    if (!this.canHandleMessageType(message.type)) {
      console.log(`⚠️  ${this.agentId} cannot handle message type: ${message.type}`);
      return;
    }

    // Check capacity
    if (this.activeTasks.size >= this.getMaxConcurrentTasks()) {
      console.log(`⚠️  ${this.agentId} at capacity, queuing task`);
      this.queueTask(message);
      return;
    }

    // Process the message
    try {
      const result = await this.processMessage(message);
      
      // Send result back
      if (message.requiresResponse !== false) {
        this.sendMessage({
          id: this.generateMessageId(),
          from: this.agentId,
          to: message.from,
          type: 'result',
          priority: message.priority,
          data: result,
          contextId: message.contextId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`❌ ${this.agentId} failed to process message:`, error);
      
      // Send error back
      this.sendMessage({
        id: this.generateMessageId(),
        from: this.agentId,
        to: message.from,
        type: 'result',
        priority: 'high',
        data: { error: error.message, originalMessage: message },
        contextId: message.contextId,
        timestamp: new Date().toISOString()
      });
    }
  }

  protected abstract processMessage(message: AgentMessage): Promise<any>;

  protected canHandleMessageType(type: string): boolean {
    return this.capabilities.some(cap => cap.canHandle.includes(type));
  }

  protected getMaxConcurrentTasks(): number {
    return Math.max(...this.capabilities.map(cap => cap.maxConcurrentTasks));
  }

  protected async useClaudeSDK(prompt: string, tools?: string[]): Promise<any> {
    try {
      const result = await query({
        prompt,
        options: {
          mcpServers: this.mcpConfig,
          allowedTools: tools || this.getMCPTools(),
          maxTurns: 5,
          systemPrompt: {
            type: "text",
            prompt: this.getSystemPrompt()
          }
        }
      });

      return this.parseClaudeResponse(result);
    } catch (error) {
      console.error(`❌ ${this.agentId} Claude SDK error:`, error);
      throw error;
    }
  }

  protected parseClaudeResponse(result: any): any {
    if (result.type === 'result' && result.subtype === 'success') {
      const content = result.result?.content || result.message?.content || '';
      
      // Try to parse as JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { content, type: 'text' };
    }
    
    throw new Error('Invalid Claude SDK response format');
  }

  protected sendMessage(message: AgentMessage) {
    this.emit('outbound', message);
  }

  protected queueTask(message: AgentMessage) {
    setTimeout(() => {
      this.emit('message', message);
    }, 1000); // Retry after 1 second
  }

  protected generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Agent lifecycle methods
  async initialize(mcpConfig: any, claudeConfig: any) {
    this.mcpConfig = mcpConfig;
    this.claudeConfig = claudeConfig;
    console.log(`🚀 Agent ${this.agentId} initialized`);
  }

  async shutdown() {
    this.activeTasks.clear();
    this.removeAllListeners();
    console.log(`🛑 Agent ${this.agentId} shutdown`);
  }

  getStatus() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      activeTasks: this.activeTasks.size,
      capabilities: this.capabilities,
      status: 'active'
    };
  }
}

// ==================== DISCOVERY LAYER AGENTS ====================

export class LinkedInMonitorAgent extends BaseAgent {
  constructor() {
    super('linkedin-monitor-001', 'discovery', [{
      name: 'LinkedIn Procurement Monitoring',
      description: 'Monitors LinkedIn for procurement opportunities in sports industry',
      mcpTools: ['brightdata-mcp', 'perplexity-mcp'],
      canHandle: ['task', 'alert'],
      maxConcurrentTasks: 5
    }]);
  }

  getSystemPrompt(): string {
    return `You are a LinkedIn Procurement Monitor, specialized in discovering RFP and procurement opportunities in the sports industry.

Your responsibilities:
- Monitor LinkedIn for sports organizations seeking technology solutions
- Identify procurement signals, digital transformation projects, and partnership opportunities
- Extract key details: organization, requirements, timeline, budget indicators
- Filter for relevant opportunities (sports tech, analytics, digital platforms)
- Provide structured opportunity data for downstream analysis

You have access to BrightData for web research and Perplexity for market intelligence.
Always return structured data in JSON format with opportunity details.`;
  }

  getMCPTools(): string[] {
    return ['brightdata-mcp__search_engine', 'perplexity-mcp__chat_completion'];
  }

  protected async processMessage(message: AgentMessage): Promise<any> {
    const { task } = message.data;
    
    switch (task.type) {
      case 'monitor_keywords':
        return await this.monitorKeywords(task.keywords);
      case 'analyze_post':
        return await this.analyzePost(task.postUrl);
      case 'search_opportunities':
        return await this.searchOpportunities(task.query);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async monitorKeywords(keywords: string[]): Promise<any> {
    const prompt = `Search LinkedIn for recent procurement opportunities in the sports industry using these keywords: ${keywords.join(', ')}

For each opportunity found, provide:
1. Organization name and size
2. Project requirements (what they're seeking)
3. Timeline and deadline indicators
4. Budget range if mentioned
5. Contact persons or decision makers
6. Relevance score (0-100) for Yellow Panther

Return structured JSON with all opportunities discovered.`;

    return await this.useClaudeSDK(prompt, ['brightdata-mcp__search_engine']);
  }

  private async analyzePost(postUrl: string): Promise<any> {
    const prompt = `Analyze this LinkedIn post for procurement opportunity signals: ${postUrl}

Extract:
- Is this a procurement opportunity? (yes/no)
- Organization details
- Project scope and requirements
- Value/timeline indicators
- Decision makers mentioned
- Next steps recommended

Return structured JSON analysis.`;

    return await this.useClaudeSDK(prompt, ['brightdata-mcp__scrape_as_markdown']);
  }

  private async searchOpportunities(query: string): Promise<any> {
    const prompt = `Search for sports industry procurement opportunities matching: ${query}

Use web search to find recent RFPs, tenders, or project announcements.
Focus on UK and European sports organizations.

Return structured list of opportunities with relevance scoring.`;

    return await this.useClaudeSDK(prompt, ['brightdata-mcp__search_engine', 'perplexity-mcp__chat_completion']);
  }
}

export class GovernmentPortalAgent extends BaseAgent {
  constructor() {
    super('gov-portal-001', 'discovery', [{
      name: 'Government Tender Monitoring',
      description: 'Monitors government procurement portals for sports-related opportunities',
      mcpTools: ['brightdata-mcp'],
      canHandle: ['task'],
      maxConcurrentTasks: 3
    }]);
  }

  getSystemPrompt(): string {
    return `You are a Government Tender Monitor, specialized in discovering public sector procurement opportunities in sports and recreation.

Your responsibilities:
- Monitor government procurement portals (UK and EU)
- Identify sports facilities, technology, and service contracts
- Extract tender requirements, deadlines, and evaluation criteria
- Assess suitability for Yellow Panther's capabilities
- Track tender timelines and submission requirements

Always return structured tender data in JSON format.`;
  }

  getMCPTools(): string[] {
    return ['brightdata-mcp__search_engine'];
  }

  protected async processMessage(message: AgentMessage): Promise<any> {
    const { task } = message.data;
    
    const prompt = `Search for government tenders related to sports technology, analytics, or digital services.

Look for opportunities involving:
- Sports management systems
- Analytics platforms
- Digital transformation
- Venue management
- Fan engagement technology

Return structured list with tender details, deadlines, and requirements.`;

    return await this.useClaudeSDK(prompt);
  }
}

// ==================== INTELLIGENCE LAYER AGENTS ====================

export class RFPAnalysisAgent extends BaseAgent {
  constructor() {
    super('rfp-analyst-001', 'intelligence', [{
      name: 'RFP Intelligence Analysis',
      description: 'Analyzes RFPs for fit scoring, competitive positioning, and strategy',
      mcpTools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp'],
      canHandle: ['task', 'request'],
      maxConcurrentTasks: 8
    }]);
  }

  getSystemPrompt(): string {
    return `You are an elite RFP Intelligence Analyst for Yellow Panther, specializing in sports technology opportunities.

Your analytical framework:
1. **Fit Score (0-100)**: Technical capability, cultural fit, resource requirements
2. **Competitive Analysis**: Market positioning, competitor landscape, differentiation opportunities
3. **Risk Assessment**: Implementation complexity, timeline risks, resource constraints
4. **Strategic Value**: Market entry, reference case, revenue potential
5. **Recommended Actions**: Pursuit strategy, team composition, timeline

Use Neo4j for relationship intelligence, web research for company context, and market analysis for competitive insights.

Always return structured JSON analysis with confidence scoring.`;
  }

  getMCPTools(): string[] {
    return [
      'neo4j-mcp__execute_query',
      'brightdata-mcp__search_engine',
      'perplexity-mcp__chat_completion'
    ];
  }

  protected async processMessage(message: AgentMessage): Promise<any> {
    const { rfp, entity, context } = message.data;
    
    const prompt = `Analyze this RFP opportunity for Yellow Panther:

**RFP Details:**
- Organization: ${rfp.organization}
- Title: ${rfp.title}
- Value: ${rfp.value}
- Description: ${rfp.description}
- Deadline: ${rfp.deadline}
- Category: ${rfp.category}

**Entity Context:**
- Name: ${entity?.name}
- Industry: ${entity?.industry}
- Size: ${entity?.size}

**Analysis Required:**
1. Query Neo4j for organization relationships and past projects
2. Research current company situation and decision makers
3. Analyze competitive landscape
4. Assess technical fit and implementation requirements
5. Calculate fit score and strategic value

Provide comprehensive analysis with specific recommendations and confidence levels.`;

    return await this.useClaudeSDK(prompt);
  }
}

export class MarketResearchAgent extends BaseAgent {
  constructor() {
    super('market-researcher-001', 'intelligence', [{
      name: 'Market Intelligence Research',
      description: 'Conducts deep market research and company profiling',
      mcpTools: ['brightdata-mcp', 'perplexity-mcp', 'neo4j-mcp'],
      canHandle: ['task', 'request'],
      maxConcurrentTasks: 6
    }]);
  }

  getSystemPrompt(): string {
    return `You are a Market Intelligence Researcher specializing in the sports industry.

Your research methodology:
1. **Company Profiling**: Financial health, recent initiatives, decision makers
2. **Market Positioning**: Competitive landscape, market share, growth trajectory
3. **Technology Stack**: Current systems, integration points, technical debt
4. **Strategic Priorities**: Recent investments, partnership patterns, pain points
5. **Opportunity Mapping: Budget cycles, procurement patterns, key influencers

Use web research, market intelligence, and relationship mapping to build comprehensive profiles.

Return structured research data with source attribution and confidence levels.`;
  }

  getMCPTools(): string[] {
    return [
      'brightdata-mcp__search_engine',
      'perplexity-mcp__chat_completion',
      'neo4j-mcp__execute_query'
    ];
  }

  protected async processMessage(message: AgentMessage): Promise<any> {
    const { company, researchScope } = message.data;
    
    const prompt = `Conduct comprehensive market research on: ${company}

Research Scope: ${researchScope || 'full'}

Required Intelligence:
1. Company overview and recent performance
2. Key decision makers and influencers
3. Current technology infrastructure
4. Recent initiatives and strategic priorities
5. Competitive positioning and market challenges
6. Budget indicators and procurement patterns

Use all available research tools to build detailed intelligence profile.`;

    return await this.useClaudeSDK(prompt);
  }
}

// ==================== ACTION LAYER AGENTS ====================

export class ResponseGeneratorAgent extends BaseAgent {
  constructor() {
    super('response-generator-001', 'action', [{
      name: 'Proposal Response Generation',
      description: 'Generates tailored RFP responses and proposals',
      mcpTools: ['neo4j-mcp', 'perplexity-mcp'],
      canHandle: ['task', 'request'],
      maxConcurrentTasks: 4
    }]);
  }

  getSystemPrompt(): string {
    return `You are a Proposal Response Generator for Yellow Panther, creating compelling, tailored RFP responses.

Your response methodology:
1. **Executive Summary**: Value proposition alignment, key differentiators
2. **Technical Approach**: Solution architecture, implementation methodology
3. **Team Composition**: Relevant experience, role assignments
4. **Timeline & Milestones**: Realistic delivery schedule, risk mitigation
5. **Pricing Strategy**: Value-based pricing, optional phases
6. **Differentiation**: Why Yellow Panther vs competitors

Use company intelligence to tailor messaging and solution approach.

Generate professional, persuasive responses in structured format.`;
  }

  getMCPTools(): string[] {
    return ['neo4j-mcp__execute_query', 'perplexity-mcp__chat_completion'];
  }

  protected async processMessage(message: AgentMessage): Promise<any> {
    const { rfp, analysis, companyIntel } = message.data;
    
    const prompt = `Generate a tailored RFP response for Yellow Panther:

**Opportunity:**
- ${rfp.title} at ${rfp.organization}
- Value: ${rfp.value}
- Deadline: ${rfp.deadline}

**Analysis Insights:**
- Fit Score: ${analysis?.fitScore}
- Key Requirements: ${rfp.description}
- Risk Factors: ${analysis?.riskAssessment}

**Company Intelligence:**
- ${companyIntel?.decisionMakers?.join(', ')}
- Recent Initiatives: ${companyIntel?.priorities?.join(', ')}

Generate comprehensive response including executive summary, technical approach, team, timeline, and pricing strategy.`;

    return await this.useClaudeSDK(prompt);
  }
}

export class OutreachCoordinatorAgent extends BaseAgent {
  constructor() {
    super('outreach-coordinator-001', 'action', [{
      name: 'Outreach Coordination',
      description: 'Manages stakeholder outreach and meeting scheduling',
      mcpTools: ['brightdata-mcp', 'email-mcp', 'calendar-mcp'],
      canHandle: ['task', 'request'],
      maxConcurrentTasks: 6
    }]);
  }

  getSystemPrompt(): string {
    return `You are an Outreach Coordinator for Yellow Panther, managing stakeholder engagement and meeting scheduling.

Your coordination methodology:
1. **Stakeholder Mapping**: Identify key decision makers and influencers
2. **Outreach Strategy**: Personalized messaging, timing, channel selection
3. **Meeting Scheduling**: Calendar coordination, agenda preparation
4. **Follow-up Management**: Timely follow-ups, relationship building
5. **Opportunity Tracking**: Engagement status, next steps, closure

Use research tools to find contact information and preferences.

Generate structured outreach plans with specific actions and timelines.`;
  }

  getMCPTools(): string[] {
    return [
      'brightdata-mcp__search_engine',
      'email-mcp__send_email',
      'calendar-mcp__schedule_meeting'
    ];
  }

  protected async processMessage(message: AgentMessage): Promise<any> {
    const { opportunity, stakeholders, strategy } = message.data;
    
    const prompt = `Create outreach coordination plan for:

**Opportunity:** ${opportunity.title} at ${opportunity.organization}
**Value:** ${opportunity.value}
**Timeline:** ${opportunity.deadline}

**Key Stakeholders:** ${stakeholders?.map(s => s.name + ' (' + s.role + ')').join(', ')}

Generate comprehensive outreach plan including:
1. Stakeholder prioritization and messaging
2. Contact strategy and timing
3. Meeting preparation and agenda
4. Follow-up sequence
5. Success metrics and tracking`;

    return await this.useClaudeSDK(prompt);
  }
}

// ==================== AGENT ORCHESTRATOR ====================

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private activeContexts: Map<string, any> = new Map();
  private mcpConfig: any;
  private claudeConfig: any;

  constructor() {
    super();
    this.setupAgents();
    this.setupMessageRouting();
  }

  private setupAgents() {
    // Initialize all agents
    const agents = [
      new LinkedInMonitorAgent(),
      new GovernmentPortalAgent(),
      new RFPAnalysisAgent(),
      new MarketResearchAgent(),
      new ResponseGeneratorAgent(),
      new OutreachCoordinatorAgent()
    ];

    agents.forEach(agent => {
      this.agents.set(agent.agentId, agent);
      
      // Route agent messages
      agent.on('outbound', (message: AgentMessage) => {
        this.routeMessage(message);
      });
    });
  }

  private setupMessageRouting() {
    this.on('route', (message: AgentMessage) => {
      this.routeMessage(message);
    });
  }

  private routeMessage(message: AgentMessage) {
    const targetAgent = this.agents.get(message.to);
    
    if (!targetAgent) {
      console.error(`❌ Target agent not found: ${message.to}`);
      return;
    }

    // Update context
    this.updateContext(message.contextId, message);
    
    // Route to target agent
    targetAgent.emit('message', message);
  }

  private updateContext(contextId: string, message: AgentMessage) {
    if (!this.activeContexts.has(contextId)) {
      this.activeContexts.set(contextId, {
        messages: [],
        startTime: new Date().toISOString(),
        status: 'active'
      });
    }

    const context = this.activeContexts.get(contextId);
    context.messages.push(message);
    context.lastUpdate = new Date().toISOString();
  }

  async initialize(mcpConfig: any, claudeConfig: any) {
    this.mcpConfig = mcpConfig;
    this.claudeConfig = claudeConfig;

    // Initialize all agents
    for (const agent of this.agents.values()) {
      await agent.initialize(mcpConfig, claudeConfig);
    }

    console.log('🚀 Agent Orchestrator initialized with', this.agents.size, 'agents');
  }

  // Start automated RFP discovery workflow
  async startDiscoveryWorkflow() {
    console.log('🔍 Starting automated RFP discovery workflow...');

    const contextId = this.generateContextId();
    
    // Task LinkedIn Monitor
    this.sendMessage({
      id: this.generateMessageId(),
      from: 'orchestrator',
      to: 'linkedin-monitor-001',
      type: 'task',
      priority: 'high',
      data: {
        task: {
          type: 'monitor_keywords',
          keywords: [
            'sports analytics RFP',
            'football technology procurement',
            'sports digital transformation',
            'venue management system',
            'fan engagement platform'
          ]
        }
      },
      contextId,
      timestamp: new Date().toISOString(),
      requiresResponse: true
    });

    // Task Government Portal Agent
    this.sendMessage({
      id: this.generateMessageId(),
      from: 'orchestrator',
      to: 'gov-portal-001',
      type: 'task',
      priority: 'medium',
      data: {
        task: {
          type: 'search_opportunities',
          query: 'sports technology analytics platform'
        }
      },
      contextId,
      timestamp: new Date().toISOString(),
      requiresResponse: true
    });
  }

  // Process discovered opportunity
  async processOpportunity(opportunity: any) {
    console.log('📊 Processing discovered opportunity:', opportunity.title);

    const contextId = this.generateContextId();

    // Analyze RFP
    this.sendMessage({
      id: this.generateMessageId(),
      from: 'orchestrator',
      to: 'rfp-analyst-001',
      type: 'task',
      priority: 'high',
      data: {
        rfp: opportunity,
        entity: { name: opportunity.organization, industry: 'Sports' }
      },
      contextId,
      timestamp: new Date().toISOString(),
      requiresResponse: true
    });

    // Market research (parallel)
    this.sendMessage({
      id: this.generateMessageId(),
      from: 'orchestrator',
      to: 'market-researcher-001',
      type: 'task',
      priority: 'high',
      data: {
        company: opportunity.organization,
        researchScope: 'procurement_intelligence'
      },
      contextId,
      timestamp: new Date().toISOString(),
      requiresResponse: true
    });
  }

  // Generate response for high-fit opportunities
  async generateResponse(opportunity: any, analysis: any, companyIntel: any) {
    console.log('📝 Generating response for high-fit opportunity...');

    if (analysis.fitScore < 70) {
      console.log('⚠️  Fit score too low, skipping response generation');
      return;
    }

    const contextId = this.generateContextId();

    // Generate proposal response
    this.sendMessage({
      id: this.generateMessageId(),
      from: 'orchestrator',
      to: 'response-generator-001',
      type: 'task',
      priority: 'high',
      data: {
        rfp: opportunity,
        analysis,
        companyIntel
      },
      contextId,
      timestamp: new Date().toISOString(),
      requiresResponse: true
    });

    // Plan outreach (parallel)
    this.sendMessage({
      id: this.generateMessageId(),
      from: 'orchestrator',
      to: 'outreach-coordinator-001',
      type: 'task',
      priority: 'high',
      data: {
        opportunity,
        stakeholders: companyIntel.decisionMakers,
        strategy: 'high_fit_urgency'
      },
      contextId,
      timestamp: new Date().toISOString(),
      requiresResponse: true
    });
  }

  private sendMessage(message: AgentMessage) {
    this.emit('route', message);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSystemStatus() {
    return {
      orchestrator: 'active',
      agents: Array.from(this.agents.values()).map(agent => agent.getStatus()),
      activeContexts: this.activeContexts.size,
      queuedMessages: this.messageQueue.length
    };
  }

  async shutdown() {
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }
    this.removeAllListeners();
    console.log('🛑 Agent Orchestrator shutdown complete');
  }
}

// ==================== EXPORTS ====================

// Singleton instance
export const orchestrator = new AgentOrchestrator();