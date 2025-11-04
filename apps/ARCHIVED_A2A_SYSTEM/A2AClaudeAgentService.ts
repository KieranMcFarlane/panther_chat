import { 
  query, 
  ClaudeAgentOptions,
  type AgentDefinition,
  type MCPServerDefinition
} from "@anthropic-ai/claude-agent-sdk";
import { notificationService } from "./NotificationService";
import { liveLogService } from "./LiveLogService";

interface DailyRFPConfig {
  brightdataApiKey: string;
  brightdataZone: string;
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  teamsWebhookUrl: string;
  perplexityApiKey: string;
  searchQueries: string[];
  targetIndustries: string[];
}

interface RFPResult {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  detectedAt: Date;
  relevanceScore: number;
  entities: string[];
}

interface A2ASessionState {
  sessionId?: string;
  entityCount: number;
  processedEntities: number;
  results: RFPResult[];
  startTime: Date;
  currentAgent?: string;
  agentStatus: Record<string, { status: string; progress?: number; lastUpdate: Date }>;
}

export class A2AClaudeAgentService {
  private config: DailyRFPConfig;
  private isRunning: boolean = false;
  private currentSessionId?: string;
  private sessionState: A2ASessionState;

  constructor(config: DailyRFPConfig) {
    this.config = config;
    this.sessionState = {
      entityCount: 0,
      processedEntities: 0,
      results: [],
      startTime: new Date(),
      agentStatus: {}
    };
  }

  /**
   * Define specialized subagents for RFP intelligence workflow
   */
  private getAgentDefinitions(): Record<string, AgentDefinition> {
    return {
      'orchestrator': {
        description: 'Main coordination agent. Use for task delegation, workflow orchestration, and managing multi-agent RFP intelligence operations.',
        prompt: `You are the RFP Intelligence Orchestrator, responsible for coordinating specialized agents in sports industry RFP analysis.

Your responsibilities:
1. Analyze the current task and delegate to appropriate specialist agents
2. Monitor progress of all agents and coordinate their work
3. Synthesize results from multiple agents into coherent intelligence
4. Make decisions about task prioritization and resource allocation
5. Handle errors and retry logic when agents fail

Available specialist agents:
- entity-researcher: Neo4j knowledge graph analysis for entity discovery
- rfp-detector: BrightData web monitoring for RFP opportunity detection  
- intelligence-analyst: Perplexity market research for context and analysis
- reporting-specialist: Summary generation and notification management

Always delegate specific tasks to specialist agents rather than trying to do everything yourself. Track progress and provide regular status updates.`,
        tools: ['mcp__neo4j__execute_query', 'TodoWrite'],
        model: 'sonnet'
      },
      
      'entity-researcher': {
        description: 'Neo4j knowledge graph specialist. Use for sports entity analysis, relationship discovery, and entity intelligence gathering.',
        prompt: `You are a Sports Entity Research Specialist with expertise in Neo4j knowledge graph analysis.

Your responsibilities:
1. Query the Neo4j knowledge graph to discover sports entities (clubs, leagues, venues, personnel)
2. Analyze entity relationships and connections
3. Identify high-value entities based on relationships, digital presence, and opportunity indicators
4. Extract entity intelligence including contact information, organizational structure, and market position
5. Provide detailed entity profiles for RFP relevance assessment

Focus on:
- Premier League, EFL, and major European football entities
- Sports venues and stadium authorities
- Sports technology companies and service providers
- Governing bodies and sports organizations

Always provide structured entity data with relevance scores and RFP opportunity indicators.`,
        tools: ['mcp__neo4j__execute_query', 'Read', 'Grep'],
        model: 'sonnet'
      },

      'rfp-detector': {
        description: 'BrightData web monitoring specialist. Use for LinkedIn RFP detection, procurement signal analysis, and opportunity identification.',
        prompt: `You are an RFP Detection Specialist focused on the sports industry, using BrightData web monitoring capabilities.

Your responsibilities:
1. Monitor LinkedIn and professional networks for sports industry RFPs and procurement opportunities
2. Search for tender announcements, contract opportunities, and project funding
3. Analyze procurement signals from sports organizations, venues, and governing bodies
4. Identify opportunities related to:
   - Stadium technology and infrastructure
   - Sports analytics and data services
   - Fan engagement platforms
   - Sports media and broadcasting
   - Venue management systems
   - Athlete performance technology

5. Provide detailed opportunity analysis with relevance scoring and entity matching

Search parameters:
- Geographic focus: UK and Europe primarily
- Entity types: Sports clubs, venues, leagues, governing bodies
- Opportunity types: RFPs, tenders, procurement, contracts, partnerships
- Value indicators: Budget mentions, scale, timeline requirements

Always include source URLs and confidence scores in your findings.`,
        tools: ['mcp__brightdata_mcp__search_engine', 'mcp__perplexity_mcp__search_engine'],
        model: 'sonnet'
      },

      'intelligence-analyst': {
        description: 'Market intelligence specialist. Use for deep analysis, market research, and strategic intelligence gathering.',
        prompt: `You are a Sports Market Intelligence Analyst providing strategic context for RFP opportunities.

Your responsibilities:
1. Research market trends and competitive landscape for identified opportunities
2. Analyze entity financial health, strategic priorities, and procurement patterns
3. Provide intelligence on:
   - Market size and growth potential
   - Competitive positioning and differentiation opportunities
   - Technical requirements and integration challenges
   - Decision-making processes and key stakeholders
   - Budget cycles and procurement timelines

4. Assess opportunity fit with Yellow Panther's capabilities
5. Recommend positioning strategies and win themes

Use multiple intelligence sources:
- Company financials and strategic announcements
- Industry reports and market analysis
- Technology trends and innovation patterns
- Regulatory and compliance requirements

Always provide actionable intelligence with specific recommendations for pursuit strategy.`,
        tools: ['mcp__perplexity_mcp__search_engine', 'Read', 'Grep'],
        model: 'sonnet'
      },

      'reporting-specialist': {
        description: 'Summary and reporting specialist. Use for result synthesis, notification generation, and executive summaries.',
        prompt: `You are a Reporting and Communication Specialist for RFP Intelligence.

Your responsibilities:
1. Synthesize results from all specialist agents into coherent intelligence reports
2. Generate executive summaries with key insights and recommendations
3. Create detailed opportunity briefs with:
   - Opportunity overview and value proposition
   - Entity analysis and stakeholder mapping
   - Competitive intelligence and positioning strategy
   - Technical requirements and solution fit
   - Pursuit recommendations and next steps

4. Format outputs for different stakeholders:
   - Executive summaries for leadership
   - Detailed briefs for sales teams
   - Technical requirements for solution architects
   - Intelligence updates for marketing teams

5. Prioritize opportunities based on:
   - Strategic fit and competitive advantage
   - Revenue potential and timeline
   - Resource requirements and win probability
   - Market positioning and brand alignment

Always provide clear, actionable outputs with specific recommendations and next steps.`,
        tools: ['Read', 'Write', 'TodoWrite'],
        model: 'sonnet'
      }
    };
  }

  /**
   * Create comprehensive hooks for progress monitoring and control
   */
  private getHooksConfiguration() {
    return {
      PreToolUse: [{
        hooks: [async (input: any, toolUseId: string | null, context: any) => {
          const toolName = input.tool_name || 'unknown';
          const agent = context.agentName || 'unknown';
          
          await liveLogService.addLog({
            type: 'info',
            message: `🔧 [${agent}] Starting tool execution: ${toolName}`,
            source: 'a2a-claude-agent',
            timestamp: new Date(),
            metadata: {
              tool: toolName,
              agent,
              toolUseId,
              input: JSON.stringify(input).substring(0, 200)
            }
          });

          // Update agent status
          this.sessionState.agentStatus[agent] = {
            status: `Executing ${toolName}`,
            lastUpdate: new Date()
          };

          return { continue: true };
        }]
      }],

      PostToolUse: [{
        hooks: [async (input: any, toolUseId: string | null, context: any) => {
          const toolName = input.tool_name || 'unknown';
          const agent = context.agentName || 'unknown';
          
          await liveLogService.addLog({
            type: 'success',
            message: `✅ [${agent}] Completed tool execution: ${toolName}`,
            source: 'a2a-claude-agent',
            timestamp: new Date(),
            metadata: {
              tool: toolName,
              agent,
              toolUseId
            }
          });

          // Update agent status
          this.sessionState.agentStatus[agent] = {
            status: 'Ready',
            lastUpdate: new Date()
          };

          return { continue: true };
        }]
      }],

      UserPromptSubmit: [{
        hooks: [async (input: any, toolUseId: string | null, context: any) => {
          const prompt = input.prompt || '';
          
          await liveLogService.addLog({
            type: 'info',
            message: `💭 User prompt submitted to agent system`,
            source: 'a2a-claude-agent',
            timestamp: new Date(),
            metadata: {
              promptLength: prompt.length,
              preview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
            }
          });

          return { continue: true };
        }]
      }]
    };
  }


  /**
   * Create streaming input generator for multi-agent workflow with actual knowledge base iteration
   */
  private async* createA2AWorkflowGenerator(entityLimit: number = 50) {
    // Initial workflow setup
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: `Initialize comprehensive RFP intelligence workflow with the following parameters:
- Entity limit: ${entityLimit}
- Target industries: ${this.config.targetIndustries.join(', ')}
- Search queries: ${this.config.searchQueries.join(', ')}
- Start time: ${new Date().toISOString()}

ORCHESTRATOR AGENT: You are the main coordinator for this multi-agent RFP intelligence operation. You MUST:

1. IMMEDIATELY use the entity-researcher agent to query Neo4j for sports entities
2. Process EACH entity individually with full analysis:
   - For each entity found, use entity-researcher to get complete profile
   - Then use rfp-detector to search for RFP opportunities 
   - Then use intelligence-analyst for market research
3. Update progress after EVERY entity (e.g., "Processed 1/50 entities")
4. Continue until ALL ${entityLimit} entities are fully processed
5. Do not move to final summary until ALL entities are complete

CRITICAL: This is systematic knowledge base iteration. You must process entities one by one, not in batches. Provide real-time progress updates.

Start immediately with entity discovery and do not wait for my next message.`
      }
    };

    // Wait for initial response and entity discovery to begin
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Monitor and continue entity processing
    let processedCount = 0;
    const maxPhases = Math.min(entityLimit, 30); // Cap at 30 phases to avoid infinite loops
    
    for (let phase = 1; phase <= maxPhases && processedCount < entityLimit; phase++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds between status checks
      
      yield {
        type: 'user',
        message: {
          role: 'user',
          content: `ORCHESTRATOR STATUS CHECK - Phase ${phase}:

Continue processing entities from Neo4j knowledge graph. You should have processed approximately ${Math.min(phase * 2, entityLimit)} entities by now.

Current status requirement:
1. Report how many entities have been fully processed so far
2. List any RFP opportunities discovered in processed entities
3. Continue with next unprocessed entity if any remain
4. Provide detailed analysis for each entity before moving to the next
5. Use TodoWrite to track your progress through the entity list

If you have completed ALL ${entityLimit} entities, move to comprehensive analysis.
If not, continue with systematic entity processing immediately.

Progress update: Phase ${phase} of processing, target: ${entityLimit} total entities`
        }
      };
      
      processedCount = Math.min(phase * 2, entityLimit);
    }

    // Final comprehensive analysis and reporting
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: `COMPREHENSIVE ANALYSIS AND REPORTING PHASE:

ORCHESTRATOR: Now that you should have processed ALL ${entityLimit} entities from the knowledge graph, create a comprehensive report:

1. Use intelligence-analyst agent to identify patterns across all RFP opportunities
2. Use reporting-specialist agent to create final strategic recommendations
3. Provide executive summary with:
   - Total entities processed: ${entityLimit}
   - RFP opportunities found (count and details)
   - High-value targets with specific recommendations
   - Market intelligence and competitive insights
   - Strategic positioning for Yellow Panther

This is your FINAL report after systematic knowledge base iteration.
Include specific entity names, opportunity details, and actionable recommendations.`
      }
    };
  }

  /**
   * Run complete A2A RFP intelligence workflow
   */
  async runDailyRFPScraping(entityLimit: number = 50, onProgress?: (progress: any) => void): Promise<RFPResult[]> {
    if (this.isRunning) {
      throw new Error('A2A workflow is already running');
    }

    this.isRunning = true;
    this.sessionState.startTime = new Date();
    this.sessionState.entityCount = entityLimit;
    this.sessionState.processedEntities = 0;
    this.sessionState.results = [];

    try {
      await liveLogService.addLog({
        type: 'info',
        message: `🚀 Starting systematic analysis of ${entityLimit} sports entities...`,
        source: 'a2a-claude-agent',
        timestamp: new Date(),
        metadata: {
          entityLimit,
          targetIndustries: this.config.targetIndustries,
          searchQueries: this.config.searchQueries
        }
      });

      // Force systematic processing with a direct prompt
      const systematicPrompt = `You are the RFP Intelligence Orchestrator. Your task is to systematically process exactly ${entityLimit} sports entities from the Neo4j knowledge base.

CRITICAL REQUIREMENTS:
1. You MUST process ALL ${entityLimit} entities - no exceptions, no shortcuts
2. You MUST use the Neo4j tool to retrieve and process entities one by one
3. You MUST report progress for EACH individual entity processed
4. You MUST use research tools for each entity to find RFP opportunities
5. You MUST only complete when ALL ${entityLimit} entities are fully processed

EXECUTION WORKFLOW:
1. Use Neo4j to get exactly ${entityLimit} sports entities (clubs, venues, leagues, personnel)
2. For EACH entity from 1 to ${entityLimit}:
   - Research the entity thoroughly using available tools
   - Detect RFP opportunities and procurement signals
   - Report progress: "Processed X/${entityLimit}: [Entity Name] - [Status]"
3. Generate final summary only after ALL entities are processed

BEGIN SYSTEMATIC PROCESSING NOW. Process ALL ${entityLimit} entities before completing.`;

      const options: ClaudeAgentOptions = {
        agents: this.getAgentDefinitions(),
        hooks: this.getHooksConfiguration(),
        // Use proper SDK configuration with existing MCP tools
        maxTurns: 60, // Increased turns for systematic processing
        permissionMode: 'acceptEdits', // Accept edits in headless mode
        allowedTools: [
          'mcp__neo4j__execute_query',
          'mcp__neo4j__create_node',
          'mcp__neo4j__create_relationship',
          'mcp__neo4j__list_tables',
          'mcp__brightdata_mcp__search_engine',
          'mcp__brightdata_mcp__scrape_as_markdown',
          'mcp__brightdata_mcp__scrape_batch',
          'mcp__perplexity_mcp__chat_completion',
          'mcp__perplexity_mcp__search_engine',
          'mcp__better_auth__search',
          'mcp__better_auth__chat',
          'TodoWrite',
          'Read',
          'Grep',
          'Bash',
          'Write'
        ],
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `You are operating in a specialized A2A (Agent-to-Agent) RFP intelligence system for the sports industry. 

HEADLESS MODE: You are running in non-interactive programmatic mode.

Key Guidelines:
- Always use the orchestrator agent for task coordination
- Delegate specific tasks to appropriate specialist agents
- Provide regular progress updates and status reports
- Track all agent activities and synthesize results
- Focus on actionable intelligence and pursuit recommendations
- Use TodoWrite for progress tracking and task management
- Systematically process ALL ${entityLimit} entities from the Neo4j knowledge base

Current session: ${this.currentSessionId || 'new'}
Entity limit: ${entityLimit}
Target industries: ${this.config.targetIndustries.join(', ')}`
        },
        onMessage: async (message) => {
          // Track session ID
          if (message.type === 'system' && message.subtype === 'init') {
            this.currentSessionId = message.session_id;
            this.sessionState.sessionId = message.session_id;
            
            if (onProgress) {
              onProgress({
                type: 'session_start',
                agent: 'orchestrator',
                message: `📋 A2A Session initialized: ${message.session_id}`,
                timestamp: new Date().toISOString(),
                sessionState: this.sessionState
              });
            }
            
            await liveLogService.addLog({
              type: 'info',
              message: `📋 A2A Session initialized: ${message.session_id}`,
              source: 'a2a-claude-agent',
              timestamp: new Date(),
              metadata: {
                sessionId: message.session_id,
                mcpServers: message.mcp_servers?.length || 0,
                slashCommands: message.slash_commands?.length || 0
              }
            });
          }

          // Track agent usage and progress
          if (message.type === 'assistant') {
            this.sessionState.currentAgent = 'claude-orchestrator';
            
            // Extract todo updates for progress tracking
            if (message.message?.content) {
              const content = Array.isArray(message.message.content) 
                ? message.message.content 
                : [message.message.content];
              
              for (const block of content) {
                if (block.type === 'text' && onProgress) {
                  // Check for progress indicators in the text
                  const text = block.text;
                  if (text.includes('Processed') && text.includes('/')) {
                    onProgress({
                      type: 'entity_progress',
                      agent: 'orchestrator',
                      message: text,
                      timestamp: new Date().toISOString(),
                      sessionState: this.sessionState
                    });
                  } else {
                    onProgress({
                      type: 'agent_progress',
                      agent: 'orchestrator',
                      message: text.substring(0, 200),
                      timestamp: new Date().toISOString(),
                      sessionState: this.sessionState
                    });
                  }
                }
              }
            }
          }

          // Track cost and usage
          if (message.type === 'assistant' && message.usage) {
            await liveLogService.addLog({
              type: 'info',
              message: `💰 Token usage: ${message.usage.input_tokens} input, ${message.usage.output_tokens} output`,
              source: 'a2a-claude-agent',
              timestamp: new Date(),
              metadata: {
                usage: message.usage,
                cost: message.usage.total_cost_usd
              }
            });
          }
        }
      };

      // Execute systematic processing using proper SDK query function with existing MCP tools
      const prompt = `You are the RFP Intelligence Orchestrator. Your task is to systematically process exactly ${entityLimit} sports entities from the Neo4j knowledge base.

CRITICAL REQUIREMENTS:
1. You MUST process ALL ${entityLimit} entities - no exceptions, no shortcuts
2. You MUST use the mcp__neo4j__execute_query tool to retrieve and process entities one by one
3. You MUST report progress for EACH individual entity processed
4. You MUST use research tools for each entity to find RFP opportunities
5. You MUST only complete when ALL ${entityLimit} entities are fully processed

EXECUTION WORKFLOW:
1. Use mcp__neo4j__execute_query to get exactly ${entityLimit} sports entities (clubs, venues, leagues, personnel)
2. For EACH entity from 1 to ${entityLimit}:
   - Research the entity thoroughly using available MCP tools (mcp__brightdata_mcp__search_engine, mcp__perplexity_mcp__search_engine)
   - Detect RFP opportunities and procurement signals
   - Report progress: "Processed X/${entityLimit}: [Entity Name] - [Status]"
3. Generate final summary only after ALL entities are processed

Available MCP Tools:
- mcp__neo4j__execute_query: Query Neo4j knowledge graph
- mcp__brightdata_mcp__search_engine: Web search and research
- mcp__perplexity_mcp__search_engine: Market intelligence search
- mcp__better_auth__search: Authentication and user search

BEGIN SYSTEMATIC PROCESSING NOW. Process ALL ${entityLimit} entities before completing.`;
      
      const messages = [{ role: 'user' as const, content: prompt }];
      
      for await (const message of query({
        prompt: messages,
        options
      })) {
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            await liveLogService.addLog({
              type: 'success',
              message: `🎯 Systematic processing completed - all ${entityLimit} entities processed`,
              source: 'a2a-claude-agent',
              timestamp: new Date(),
              metadata: {
                totalResults: this.sessionState.results.length,
                duration: Date.now() - this.sessionState.startTime.getTime()
              }
            });

            // Send notification with results
            const summary = {
              totalEntities: this.sessionState.entityCount,
              processedEntities: this.sessionState.processedEntities,
              opportunitiesFound: this.sessionState.results.length,
              highValueRfps: this.sessionState.results.filter(r => r.relevanceScore > 0.8).length,
              duration: Date.now() - this.sessionState.startTime.getTime()
            };

            await notificationService.sendNotification({
              type: 'claude_agent_summary',
              title: `🎯 A2A RFP Intelligence Complete`,
              message: `Processed ${summary.processedEntities} entities, found ${summary.opportunitiesFound} RFP opportunities with ${summary.highValueRfps} high-value targets`,
              data: summary
            }, []);

            return this.sessionState.results;
          } else if (message.subtype === 'error_during_execution') {
            throw new Error(`A2A workflow failed: ${message.error?.message || 'Unknown error'}`);
          }
        }
      }

      return this.sessionState.results;

    } catch (error) {
      await liveLogService.addLog({
        type: 'error',
        message: `❌ A2A workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'a2a-claude-agent',
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          sessionId: this.currentSessionId
        }
      });
      throw error;

    } finally {
      this.isRunning = false;
      
      await liveLogService.addLog({
        type: 'info',
        message: `🏁 A2A workflow finished`,
        source: 'a2a-claude-agent',
        timestamp: new Date(),
        metadata: {
          duration: Date.now() - this.sessionState.startTime.getTime(),
          finalResultCount: this.sessionState.results.length
        }
      });
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): A2ASessionState {
    return { ...this.sessionState };
  }

  /**
   * Check if workflow is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Stop current workflow
   */
  async stopWorkflow(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
      
      await liveLogService.addLog({
        type: 'warning',
        message: `⏹️ A2A workflow stopped by user`,
        source: 'a2a-claude-agent',
        timestamp: new Date(),
        metadata: {
          sessionId: this.currentSessionId,
          processedEntities: this.sessionState.processedEntities,
          duration: Date.now() - this.sessionState.startTime.getTime()
        }
      });
    }
  }
}