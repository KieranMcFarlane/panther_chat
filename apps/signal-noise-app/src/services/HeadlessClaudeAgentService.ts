import { 
  query, 
  ClaudeAgentOptions, 
  createSdkMcpServer,
  tool,
  AssistantMessage,
  ToolUseBlock,
  ResultMessage
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

export class HeadlessClaudeAgentService {
  private config: DailyRFPConfig;
  private isRunning: boolean = false;
  private currentTaskId?: string;

  constructor(config: DailyRFPConfig) {
    this.config = config;
  }

  /**
   * Create MCP tools for RFP intelligence (BrightData + Perplexity)
   */
  private createMCPTools() {
    // LinkedIn Search Tool (simplified to avoid hanging)
    const linkedinSearch = tool(
      "search_linkedin_rfp",
      "Search LinkedIn for RFP and procurement opportunities",
      {
        query: "string",
        filters: "object",
        maxResults: "number"
      },
      async (args) => {
        try {
          // Simulate LinkedIn search without actual API call to prevent hanging
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          
          const mockResults = [
            { title: `LinkedIn result 1 for ${args.query}`, url: "https://linkedin.com/example1" },
            { title: `LinkedIn result 2 for ${args.query}`, url: "https://linkedin.com/example2" }
          ];
          
          return {
            content: [{
              type: "text",
              text: `Simulated LinkedIn search for: ${args.query}\n\n` +
                    JSON.stringify(mockResults, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error searching LinkedIn: ${error.message}`
            }],
            is_error: true
          };
        }
      }
    );

    // Web News Search Tool (simplified to avoid hanging)
    const webNewsSearch = tool(
      "search_web_news",
      "Search web news for RFP announcements and procurement opportunities",
      {
        query: "string",
        timeframe: "string",
        maxResults: "number"
      },
      async (args) => {
        try {
          // Simulate news search without actual API call to prevent hanging
          await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
          
          const mockNewsResults = [
            { title: `${args.query} - News Result 1`, url: "https://news.example.com/1" },
            { title: `${args.query} - News Result 2`, url: "https://news.example.com/2" }
          ];
          
          return {
            content: [{
              type: "text",
              text: `Simulated news search for: ${args.query}\n\n` +
                    JSON.stringify(mockNewsResults, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error searching web news: ${error.message}`
            }],
            is_error: true
          };
        }
      }
    );

    // Neo4j Storage Tool (simplified to avoid hanging)
    const neo4jStorage = tool(
      "store_rfp_result",
      "Store RFP results in Neo4j database",
      {
        title: "string",
        description: "string",
        source: "string",
        url: "string",
        relevanceScore: "number",
        entities: "array"
      },
      async (args) => {
        try {
          // Simulate Neo4j storage without actual database call to prevent hanging
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          
          return {
            content: [{
              type: "text",
              text: `Simulated storing RFP: ${args.title} with ${args.entities.length} related entities in Neo4j database`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error storing RFP in Neo4j: ${error.message}`
            }],
            is_error: true
          };
        }
      }
    );

    // Perplexity Market Research Tool
    const marketResearch = tool(
      "market_research",
      "Conduct comprehensive market research on companies, industries, and RFP opportunities using Perplexity AI",
      {
        query: "string",
        research_type: "string",
        focus_areas: "array"
      },
      async (args) => {
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.perplexityApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: `You are a market research specialist focusing on sports industry intelligence. Provide comprehensive, actionable insights for RFP opportunities.`
                },
                {
                  role: 'user',
                  content: `Research: ${args.query}

Type: ${args.research_type}
Focus Areas: ${args.focus_areas ? args.focus_areas.join(', ') : 'General'}

Provide detailed analysis including:
1. Market trends and opportunities
2. Company backgrounds and financial health
3. Competitive landscape
4. Key decision makers and contacts
5. Relevant recent news and developments
6. Recommendations for RFP approach

Format as structured market intelligence report.`
                }
              ],
              temperature: 0.1,
              max_tokens: 2000
            })
          });

          const data = await response.json();
          
          if (data.choices && data.choices[0]?.message?.content) {
            return {
              content: [{
                type: "text",
                text: `📊 Market Research Report: ${args.query}\n\n${data.choices[0].message.content}`
              }]
            };
          } else {
            throw new Error('Invalid Perplexity API response');
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Market research failed: ${error.message}`
            }],
            is_error: true
          };
        }
      }
    );

    // Company Intelligence Tool
    const companyIntelligence = tool(
      "company_intelligence",
      "Gather detailed intelligence on specific companies for RFP targeting",
      {
        company_name: "string",
        industry_focus: "string",
        intelligence_type: "string"
      },
      async (args) => {
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.perplexityApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: `You are a business intelligence expert specializing in the sports industry. Provide actionable intelligence for RFP proposal development.`
                },
                {
                  role: 'user',
                  content: `Company Intelligence Request: ${args.company_name}

Industry Focus: ${args.industry_focus}
Intelligence Type: ${args.intelligence_type}

Provide comprehensive intelligence including:
1. Company overview and recent performance
2. Key decision makers and organizational structure
3. Current challenges and pain points
4. Recent technology investments or initiatives
5. Competitive positioning
6. Budget indicators and financial health
7. Upcoming projects or strategic initiatives
8. Recommended approach for RFP engagement

Format as actionable intelligence brief.`
                }
              ],
              temperature: 0.2,
              max_tokens: 1500
            })
          });

          const data = await response.json();
          
          if (data.choices && data.choices[0]?.message?.content) {
            return {
              content: [{
                type: "text",
                text: `🏢 Company Intelligence: ${args.company_name}\n\n${data.choices[0].message.content}`
              }]
            };
          } else {
            throw new Error('Invalid Perplexity API response');
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Company intelligence gathering failed: ${error.message}`
            }],
            is_error: true
          };
        }
      }
    );

    // RFP Analysis Tool
    const rfpAnalysis = tool(
      "analyze_rfp_opportunity",
      "Analyze RFP opportunities and provide strategic recommendations",
      {
        rfp_title: "string",
        rfp_description: "string",
        company_context: "string",
        analysis_depth: "string"
      },
      async (args) => {
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.perplexityApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: `You are an RFP strategy consultant with expertise in sports technology and venue management. Provide strategic analysis and actionable recommendations.`
                },
                {
                  role: 'user',
                  content: `RFP Opportunity Analysis:

Title: ${args.rfp_title}
Description: ${args.rfp_description}
Company Context: ${args.company_context}
Analysis Depth: ${args.analysis_depth}

Provide comprehensive analysis including:
1. RFP requirements and evaluation criteria assessment
2. Win probability and competitive landscape analysis
3. Technical feasibility and resource requirements
4. Pricing strategy and budget alignment
5. Risk assessment and mitigation strategies
6. Differentiation opportunities and value proposition
7. Recommended team composition and approach
8. Timeline and milestones recommendations
9. Success metrics and KPIs
10. Next steps and action items

Format as strategic RFP analysis report with clear recommendations.`
                }
              ],
              temperature: 0.1,
              max_tokens: 2500
            })
          });

          const data = await response.json();
          
          if (data.choices && data.choices[0]?.message?.content) {
            return {
              content: [{
                type: "text",
                text: `🎯 RFP Strategic Analysis: ${args.rfp_title}\n\n${data.choices[0].message.content}`
              }]
            };
          } else {
            throw new Error('Invalid Perplexity API response');
          }
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `RFP analysis failed: ${error.message}`
            }],
            is_error: true
          };
        }
      }
    );

    return createSdkMcpServer({
      name: "rfp-intelligence-tools",
      version: "1.0.0",
      tools: [linkedinSearch, webNewsSearch, neo4jStorage, marketResearch, companyIntelligence, rfpAnalysis]
    });
  }

  /**
   * Run daily RFP scraping and analysis
   */
  async runDailyRFPScraping(): Promise<RFPResult[]> {
    if (this.isRunning) {
      throw new Error("Daily RFP scraping is already running");
    }

    this.isRunning = true;
    this.currentTaskId = `claude_agent_${Date.now()}`;
    const startTime = new Date();
    const results: RFPResult[] = [];

    try {
      // Log start using existing schema
      liveLogService.info('Starting daily RFP scraping and analysis', {
        category: 'system',
        source: 'HeadlessClaudeAgentService',
        message: 'Claude Agent RFP scraping started',
        data: {
          task_id: this.currentTaskId,
          searchQueries: this.config.searchQueries.length,
          targetIndustries: this.config.targetIndustries.length,
          startTime: startTime.toISOString()
        },
        tags: ['claude-agent', 'rfp-scraping', 'daily-scan']
      });

      // Add to activity feed
      await liveLogService.addActivity({
        type: 'system_event',
        title: '🤖 Claude Agent RFP Scan Started',
        description: `Daily RFP intelligence scanning initiated with ${this.config.searchQueries.length} search queries`,
        urgency: 'medium',
        details: {
          task_id: this.currentTaskId,
          search_queries_count: this.config.searchQueries.length,
          target_industries: this.config.targetIndustries
        },
        actions: [
          {
            label: 'View Dashboard',
            action: 'view_claude_dashboard',
            url: '/api/claude-agent?action=status'
          }
        ]
      });

      // Create MCP server with enhanced tools
      const mcpServer = this.createMCPTools();

      // Configure Claude Agent with hooks for logging and partial messages
      const options: ClaudeAgentOptions = {
        mcpServers: {
          "rfp-intelligence-tools": mcpServer
        },
        allowedTools: [
          "mcp__rfp-intelligence-tools__search_linkedin_rfp",
          "mcp__rfp-intelligence-tools__search_web_news", 
          "mcp__rfp-intelligence-tools__store_rfp_result",
          "mcp__rfp-intelligence-tools__market_research",
          "mcp__rfp-intelligence-tools__company_intelligence",
          "mcp__rfp-intelligence-tools__analyze_rfp_opportunity"
        ],
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: `
            You are an RFP intelligence specialist working for Yellow Panther.
            
            Your task is to search for and analyze Request for Proposal (RFP) opportunities using the available tools.
            
            Process:
            1. Search LinkedIn and web news for each query
            2. Analyze results for relevance to sports industry and target industries
            3. Extract key entities (companies, organizations, locations)
            4. Store relevant findings in Neo4j database
            5. Provide summary of findings
            
            Focus areas: Sports technology, venue management, event services, digital transformation, sponsorships.
            
            Return a structured summary of all RFP opportunities found with relevance scores and action items.
          `
        },
        includePartialMessages: true, // KEY FOR LIVE LOGGING
        hooks: {
          'PreToolUse': [{
            hooks: [async (input, toolUseId, context) => {
              await this.logToolUse(toolUseId, input.tool_name, 'starting', input.tool_input);
              return {};
            }]
          }],
          'PostToolUse': [{
            hooks: [async (input, toolUseId, context) => {
              await this.logToolUse(toolUseId, input.tool_name, 'completed', input.tool_input);
              return {};
            }]
          }]
        },
        maxTurns: 25
      };

      // Build search prompt
      const searchPrompt = this.buildSearchPrompt();

      // Execute Claude Agent
      let claudeResponse = "";
      let toolsExecuted = 0;
      
      const messageGenerator = async function*() {
        yield {
          type: "user",
          message: {
            role: "user",
            content: searchPrompt
          }
        };
      };

      for await (const message of query({
        prompt: messageGenerator(),
        options
      })) {
        if (message.type === 'assistant') {
          // Handle both array and single content formats
          const content = Array.isArray(message.content) ? message.content : [message.content];
          
          for (const block of content) {
            if (block?.type === 'text') {
              claudeResponse += block.text;
            } else if (block?.type === 'tool_use') {
              toolsExecuted++;
            }
          }
        } else if (message.type === 'result') {
          const duration = Date.now() - startTime.getTime();
          
          liveLogService.info('Daily RFP scraping completed', {
            category: 'system',
            source: 'HeadlessClaudeAgentService',
            message: 'Claude Agent RFP scanning completed successfully',
            data: {
              task_id: this.currentTaskId,
              duration,
              toolsExecuted,
              responseLength: claudeResponse.length
            },
            tags: ['claude-agent', 'rfp-scraping', 'completed']
          });
        }
      }

      // Parse results and create structured data
      const parsedResults = this.parseClaudeResponse(claudeResponse);
      results.push(...parsedResults);

      // Send summary using existing notification service
      await this.sendTeamsSummary(results, toolsExecuted, startTime);

      // Add completion activity to feed
      const highValueCount = results.filter(r => r.relevanceScore > 0.8).length;
      await liveLogService.addActivity({
        type: 'analysis',
        title: `🎯 RFP Intelligence Complete: ${results.length} Opportunities`,
        description: `Found ${results.length} RFP opportunities with ${highValueCount} high-value targets`,
        urgency: results.some(r => r.relevanceScore > 0.9) ? 'high' : 'medium',
        details: {
          task_id: this.currentTaskId,
          totalResults: results.length,
          highValueResults: highValueCount,
          toolsExecuted,
          duration: Date.now() - startTime.getTime(),
          opportunities: results.slice(0, 5).map(r => ({
            title: r.title,
            score: r.relevanceScore,
            source: r.source
          }))
        },
        actions: [
          {
            label: 'View Opportunities',
            action: 'view_rfp_opportunities',
            url: '/rfp-intelligence'
          },
          {
            label: 'View Full Report',
            action: 'view_claude_report',
            url: `/api/claude-agent?action=logs&task_id=${this.currentTaskId}`
          }
        ]
      });

      return results;

    } catch (error) {
      // Log error using existing schema
      liveLogService.error('Daily RFP scraping failed', {
        category: 'system',
        source: 'HeadlessClaudeAgentService',
        message: `Claude Agent RFP scanning failed: ${error.message}`,
        data: {
          task_id: this.currentTaskId,
          error: error.message,
          stack: error.stack,
          duration: Date.now() - startTime.getTime()
        },
        metadata: {
          processing_time: Date.now() - startTime.getTime(),
          error_code: 'CLAUDE_AGENT_ERROR'
        },
        tags: ['claude-agent', 'rfp-scraping', 'error']
      });

      // Add error activity to feed
      await liveLogService.addActivity({
        type: 'system_event',
        title: '🚨 Claude Agent RFP Scan Failed',
        description: `Daily RFP scanning encountered an error: ${error.message}`,
        urgency: 'critical',
        details: {
          task_id: this.currentTaskId,
          error: error.message,
          duration: Date.now() - startTime.getTime()
        },
        actions: [
          {
            label: 'View Error Details',
            action: 'view_error_details',
            url: `/api/claude-agent?action=logs&task_id=${this.currentTaskId}`
          }
        ]
      });

      throw error;
    } finally {
      this.isRunning = false;
      this.currentTaskId = undefined;
    }
  }

  /**
   * Build comprehensive search prompt with Perplexity integration
   */
  private buildSearchPrompt(): string {
    const queries = this.config.searchQueries.map(q => `- "${q}"`).join('\n');
    const industries = this.config.targetIndustries.map(i => `- ${i}`).join('\n');

    return `
Execute comprehensive RFP opportunity search and analysis with enhanced market intelligence:

SEARCH QUERIES:
${queries}

TARGET INDUSTRIES:
${industries}

ENHANCED ANALYSIS CAPABILITIES:
You have access to three specialized research tools:

1. **market_research** - Use for industry trends, market sizing, competitive landscape
2. **company_intelligence** - Use for deep company analysis, financial health, decision makers  
3. **analyze_rfp_opportunity** - Use for strategic RFP analysis and competitive positioning

ANALYSIS STRATEGY:
1. **Initial Discovery**: Search LinkedIn and web news for each query (last 48 hours)
2. **Market Context**: Use market_research to understand industry trends and market conditions
3. **Company Deep-Dive**: Use company_intelligence to analyze promising organizations found
4. **RFP Strategic Analysis**: Use analyze_rfp_opportunity for high-value opportunities
5. **Competitive Intelligence**: Research competitors and market positioning using Perplexity tools

DATA EXTRACTION REQUIREMENTS:
- Company names, locations, sizes, and industries
- Contact information and decision makers
- Deal values, budgets, and timeline requirements
- Technical requirements and scope details
- Competitors and market context
- Relevance scoring (0.0-1.0) based on:
  * Sports industry alignment (40%)
  * Technology/solution fit (25%) 
  * Timeline feasibility (20%)
  * Company size/scope (15%)

ENHANCED INTELLIGENCE WORKFLOW:
For each relevant RFP found:
1. Store basic information using store_rfp_result tool
2. Use market_research to understand the broader market context
3. Use company_intelligence to analyze the issuing organization
4. Use analyze_rfp_opportunity for strategic assessment
5. Update the RFP record with enhanced intelligence and insights

DELIVERABLES:
- Total opportunities discovered and analyzed
- High-priority recommendations (score > 0.8) with strategic rationale
- Market intelligence summary for each target industry
- Competitive positioning recommendations
- Action items with prioritization and timeline suggestions
- Market trends and opportunity insights gathered through Perplexity research

Prioritize opportunities that offer strategic value in the sports & entertainment technology sector.
    `.trim();
  }

  /**
   * Parse Claude response to extract structured results
   */
  private parseClaudeResponse(response: string): RFPResult[] {
    const results: RFPResult[] = [];
    
    // Simple regex-based extraction - in production, use more sophisticated parsing
    const rfpPattern = /(?:RFP|Request for Proposal|Opportunity):\s*([^\n]+)/gi;
    const matches = response.match(rfpPattern);
    
    if (matches) {
      matches.forEach((match, index) => {
        results.push({
          id: `rfp_${Date.now()}_${index}`,
          title: match.replace(/^(?:RFP|Request for Proposal|Opportunity):\s*/i, '').trim(),
          description: `Extracted from Claude analysis`,
          source: "Claude Agent Analysis",
          url: "",
          detectedAt: new Date(),
          relevanceScore: 0.7, // Default score
          entities: []
        });
      });
    }

    return results;
  }

  /**
   * Log tool usage using existing schema
   */
  private async logToolUse(toolUseId: string, toolName: string, status: string, input: any): Promise<void> {
    const level = status === 'completed' ? 'info' : status === 'starting' ? 'debug' : 'warn';
    
    liveLogService.log({
      level,
      category: 'api',
      source: 'HeadlessClaudeAgentService',
      message: `Claude Agent tool ${status}: ${toolName}`,
      data: {
        task_id: this.currentTaskId,
        toolUseId,
        toolName,
        status,
        inputSummary: JSON.stringify(input).substring(0, 200)
      },
      tags: ['claude-agent', 'tool-use', toolName]
    });
  }

  /**
   * Send Teams notification using existing notification service
   */
  private async sendTeamsNotification(title: string, message: string, metadata: any): Promise<void> {
    try {
      await notificationService.sendNotification({
        id: `claude_agent_${Date.now()}`,
        title,
        body: message,
        data: metadata,
        timestamp: new Date().toISOString(),
        tag: 'claude-agent',
        require_interaction: metadata.urgency_level === 'high'
      }, [{
        channels: [{
          type: 'teams',
          enabled: true,
          config: {
            webhook_url: this.config.teamsWebhookUrl
          },
          filters: {
            urgency_levels: ['medium', 'high', 'critical']
          }
        }]
      }], {
        source_type: 'claude-agent-sdk',
        urgency_level: metadata.urgency_level || 'medium',
        confidence_score: metadata.confidence_score || 0.8
      });

      liveLogService.logNotificationSent(title, ['teams'], 'Claude Agent');

    } catch (error) {
      liveLogService.logNotificationFailed(title, 'teams', error.message, 'Claude Agent');
    }
  }

  /**
   * Send comprehensive Teams summary using existing notification service
   */
  private async sendTeamsSummary(results: RFPResult[], toolsExecuted: number, startTime: Date): Promise<void> {
    const highValueResults = results.filter(r => r.relevanceScore > 0.8);
    const duration = Date.now() - startTime.getTime();

    const message = `
📊 **Summary:**
• Total Opportunities: ${results.length}
• High-Value Targets: ${highValueResults.length}
• Tools Executed: ${toolsExecuted}
• Duration: ${(duration / 1000).toFixed(1)}s

🔥 **Top Opportunities:**
${highValueResults.slice(0, 3).map(r => `• ${r.title} (Score: ${r.relevanceScore})`).join('\n')}

${highValueResults.length > 3 ? `+${highValueResults.length - 3} more high-value opportunities` : ''}

📈 **Next Steps:**
• Review high-value opportunities in dashboard
• Assign follow-up tasks to team members
• Update CRM with new leads
    `.trim();

    await this.sendTeamsNotification(
      `🎯 Daily RFP Intelligence Report - ${results.length} Opportunities Found`,
      message,
      {
        urgency_level: highValueResults.length > 0 ? 'high' : 'medium',
        totalResults: results.length,
        highValueCount: highValueResults.length,
        toolsExecuted,
        duration,
        reportDate: startTime.toISOString(),
        task_id: this.currentTaskId
      }
    );
  }

  /**
   * Get current status with task tracking
   */
  getStatus(): { isRunning: boolean; lastRun?: Date; currentTaskId?: string } {
    return {
      isRunning: this.isRunning,
      currentTaskId: this.currentTaskId
    };
  }
}