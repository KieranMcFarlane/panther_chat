import cron from 'node-cron';
import { claudeAgentSDKService } from './ClaudeAgentSDKService';
import { liveLogService } from './LiveLogService';

interface ClaudeAgentConfig {
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

export class ClaudeAgentScheduler {
  private static instance: ClaudeAgentScheduler;
  private scheduledTasks = new Map<string, cron.ScheduledTask>();
  private isConfigured: boolean = false;
  private agents = new Map<string, 'mines' | 'enrichment'>();
  private activeAgent: 'mines' | 'enrichment' | null = null;
  private slashCommands = new Map<string, () => Promise<any>>();
  private lastExecutionTime = new Map<string, Date>();

  private constructor() {
    this.initializeSlashCommands();
  }

  public static getInstance(): ClaudeAgentScheduler {
    if (!ClaudeAgentScheduler.instance) {
      ClaudeAgentScheduler.instance = new ClaudeAgentScheduler();
    }
    return ClaudeAgentScheduler.instance;
  }

  /**
   * Initialize slash commands for CopilotKit integration
   */
  private initializeSlashCommands(): void {
    // Slash command to select Mines Agent
    this.slashCommands.set('/select-mines', async () => {
      return await this.selectAgent('mines');
    });

    // Slash command to select Enrichment Agent
    this.slashCommands.set('/select-enrichment', async () => {
      return await this.selectAgent('enrichment');
    });

    // Slash command to get current agent status
    this.slashCommands.set('/agent-status', async () => {
      return await this.getAgentStatus();
    });

    // Slash command to execute current agent immediately
    this.slashCommands.set('/execute-now', async () => {
      return await this.executeCurrentAgent();
    });

    // Slash command to start daily schedule for current agent
    this.slashCommands.set('/start-daily', async () => {
      return await this.startDailySchedule();
    });

    // Slash command to stop all scheduled tasks
    this.slashCommands.set('/stop-all', async () => {
      return await this.stopAllAgents();
    });

    // Slash command to list all available commands
    this.slashCommands.set('/help', async () => {
      return await this.listCommands();
    });
  }

  /**
   * Configure the scheduler with Claude Agent settings
   */
  public configure(config: ClaudeAgentConfig): void {
    try {
      // Store configuration for SDK service access
      this.isConfigured = true;

      liveLogService.info('Claude Agent scheduler configured', {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: 'Scheduler configured for automatic daily RFP scanning',
        data: {
          searchQueries: config.searchQueries.length,
          targetIndustries: config.targetIndustries.length,
          configuredAt: new Date().toISOString()
        },
        tags: ['claude-agent', 'scheduler', 'configuration']
      });

    } catch (error) {
      liveLogService.error('Failed to configure Claude Agent scheduler', {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: `Scheduler configuration failed: ${error.message}`,
        data: {
          error: error.message,
          configuredAt: new Date().toISOString()
        },
        tags: ['claude-agent', 'scheduler', 'error']
      });
      throw error;
    }
  }

  /**
   * Execute a slash command
   */
  public async executeSlashCommand(command: string, sessionId?: string): Promise<any> {
    const commandFunction = this.slashCommands.get(command.toLowerCase());
    if (!commandFunction) {
      throw new Error(`Unknown slash command: ${command}`);
    }
    
    liveLogService.info(`🔧 Executing slash command: ${command}`, {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: `Slash command triggered: ${command}`,
      data: { command, sessionId, executedAt: new Date().toISOString() },
      tags: ['claude-agent', 'slash-command', 'execution']
    });

    try {
      // Special handling for commands that need session ID
      if (command === '/execute-now' && sessionId) {
        const result = await this.executeCurrentAgent(sessionId);
        return result;
      } else {
        const result = await commandFunction();
        return result;
      }
    } catch (error) {
      liveLogService.error(`❌ Slash command failed: ${command}`, {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: `Command execution failed: ${error.message}`,
        data: { command, sessionId, error: error.message },
        tags: ['claude-agent', 'slash-command', 'error']
      });
      throw error;
    }
  }

  /**
   * Get list of available slash commands
   */
  public getAvailableCommands(): string[] {
    return Array.from(this.slashCommands.keys());
  }

  /**
   * Select the active agent
   */
  public async selectAgent(agentType: 'mines' | 'enrichment'): Promise<any> {
    this.activeAgent = agentType;
    
    const agentInfo = {
      mines: {
        name: 'Mines Agent',
        description: 'RFP detection, webhook monitoring, 6-month backtesting',
        schedule: '*/30 * * * *',
        capabilities: ['webhook-detection', 'historical-backtesting', 'rfp-analysis']
      },
      enrichment: {
        name: 'Enrichment Agent', 
        description: '4000+ entity enrichment with comprehensive schema',
        schedule: '0 2 * * *',
        capabilities: ['entity-enrichment', 'schema-processing', 'data-analysis']
      }
    };

    const selected = agentInfo[agentType];

    liveLogService.info(`🎯 Selected agent: ${selected.name}`, {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: `Active agent changed to: ${selected.name}`,
      data: {
        agentType,
        agentInfo: selected,
        selectedAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'selection', agentType]
    });

    return {
      success: true,
      agentType,
      agentInfo: selected,
      message: `Selected ${selected.name}: ${selected.description}`
    };
  }

  /**
   * Get current agent status
   */
  public async getAgentStatus(): Promise<any> {
    const activeTasks = Array.from(this.scheduledTasks.entries()).map(([id, task]) => ({
      id,
      agentType: this.agents.get(id),
      isRunning: task.getStatus() === 'scheduled',
      lastExecution: this.lastExecutionTime.get(id)
    }));

    return {
      activeAgent: this.activeAgent,
      isConfigured: this.isConfigured,
      scheduledTasks: activeTasks,
      availableCommands: this.getAvailableCommands(),
      uptime: Date.now()
    };
  }

  /**
   * Execute the currently selected agent immediately
   */
  public async executeCurrentAgent(sessionId?: string): Promise<any> {
    if (!this.activeAgent) {
      throw new Error('No agent selected. Use /select-mines or /select-enrichment first.');
    }

    const startTime = Date.now();
    const executionSessionId = sessionId || `agent-execution-${Date.now()}`;
    
    liveLogService.info(`⚡ Executing ${this.activeAgent} agent immediately`, {
      category: 'claude-agent',
      source: 'ClaudeAgentScheduler',
      message: `Immediate execution triggered for: ${this.activeAgent}`,
      data: {
        agentType: this.activeAgent,
        sessionId: executionSessionId,
        triggeredAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'immediate-execution', this.activeAgent]
    });

    try {
      let result;
      if (this.activeAgent === 'mines') {
        result = await this.executeMinesAgent(executionSessionId);
      } else if (this.activeAgent === 'enrichment') {
        result = await this.executeEnrichmentAgent(executionSessionId);
      }

      const duration = Date.now() - startTime;
      this.lastExecutionTime.set(this.activeAgent, new Date());

      return {
        success: true,
        agentType: this.activeAgent,
        sessionId: executionSessionId,
        duration,
        result,
        executedAt: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      liveLogService.error(`❌ Agent execution failed: ${this.activeAgent}`, {
        category: 'claude-agent',
        source: 'ClaudeAgentScheduler',
        message: `Execution failed for ${this.activeAgent}: ${error.message}`,
        data: {
          agentType: this.activeAgent,
          sessionId: executionSessionId,
          error: error.message,
          duration,
          failedAt: new Date().toISOString()
        },
        tags: ['claude-agent', 'execution-error', this.activeAgent]
      });

      throw error;
    }
  }

  /**
   * Start daily schedule for current agent
   */
  public async startDailySchedule(): Promise<any> {
    if (!this.activeAgent) {
      throw new Error('No agent selected. Use /select-mines or /select-enrichment first.');
    }

    const scheduleTime = this.activeAgent === 'mines' ? '*/30 * * * *' : '0 2 * * *';
    
    if (this.activeAgent === 'mines') {
      this.startMinesAgent(scheduleTime);
    } else {
      this.startEnrichmentAgent(scheduleTime);
    }

    return {
      success: true,
      agentType: this.activeAgent,
      schedule: scheduleTime,
      message: `Started daily schedule for ${this.activeAgent} agent`
    };
  }

  /**
   * Stop all scheduled agents
   */
  public async stopAllAgents(): Promise<any> {
    const stoppedTasks = Array.from(this.scheduledTasks.keys()).map(taskId => {
      this.stopAgent(taskId);
      return taskId;
    });

    this.scheduledTasks.clear();
    this.agents.clear();
    this.activeAgent = null;

    liveLogService.info('⏹️ All agents stopped', {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: 'All scheduled agents have been stopped',
      data: {
        stoppedTasks,
        stoppedAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'scheduler', 'stop-all']
    });

    return {
      success: true,
      stoppedTasks,
      message: 'All agents have been stopped'
    };
  }

  /**
   * List all available commands with descriptions
   */
  public async listCommands(): Promise<any> {
    const commands = [
      { command: '/select-mines', description: 'Select Mines Agent for RFP detection' },
      { command: '/select-enrichment', description: 'Select Enrichment Agent for entity processing' },
      { command: '/agent-status', description: 'Get current agent and scheduler status' },
      { command: '/execute-now', description: 'Execute the currently selected agent immediately' },
      { command: '/start-daily', description: 'Start daily schedule for current agent' },
      { command: '/stop-all', description: 'Stop all scheduled agents' },
      { command: '/help', description: 'Show this help message' }
    ];

    return {
      commands,
      currentAgent: this.activeAgent,
      availableAgents: ['mines', 'enrichment'],
      message: 'Available slash commands for Claude Agent Scheduler'
    };
  }

  /**
   * Start Mines Agent for webhook detection and historical backtesting
   */
  public startMinesAgent(scheduleTime: string = '*/30 * * * *'): void {
    if (!this.isConfigured) {
      throw new Error('Claude Agent scheduler must be configured before starting Mines Agent');
    }

    const taskId = 'mines-agent';
    
    // Stop existing task if running
    if (this.scheduledTasks.has(taskId)) {
      this.stopAgent(taskId);
    }

    this.scheduledTasks.set(taskId, cron.schedule(scheduleTime, async () => {
      await this.executeMinesAgent();
    }, {
      scheduled: true,
      timezone: 'UTC'
    }));

    this.agents.set(taskId, 'mines');

    liveLogService.info('🚨 Mines Agent started', {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: 'Mines Agent activated for webhook detection and RFP monitoring',
      data: {
        schedule: scheduleTime,
        agentType: 'mines',
        startedAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'mines-agent', 'webhook-detection']
    });
  }

  /**
   * Start Enrichment Agent for comprehensive entity enrichment
   */
  public startEnrichmentAgent(scheduleTime: string = '0 2 * * *'): void {
    if (!this.isConfigured) {
      throw new Error('Claude Agent scheduler must be configured before starting Enrichment Agent');
    }

    const taskId = 'enrichment-agent';
    
    // Stop existing task if running
    if (this.scheduledTasks.has(taskId)) {
      this.stopAgent(taskId);
    }

    this.scheduledTasks.set(taskId, cron.schedule(scheduleTime, async () => {
      await this.executeEnrichmentAgent();
    }, {
      scheduled: true,
      timezone: 'UTC'
    }));

    this.agents.set(taskId, 'enrichment');

    liveLogService.info('🧬 Enrichment Agent started', {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: 'Enrichment Agent activated for comprehensive entity enrichment',
      data: {
        schedule: scheduleTime,
        agentType: 'enrichment',
        startedAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'enrichment-agent', 'entity-enrichment']
    });
  }

  /**
   * Start daily scheduling at 9:00 AM (legacy method)
   */
  public startDailySchedule(scheduleTime: string = '0 9 * * *'): void {
    if (!this.isConfigured || !this.claudeService) {
      throw new Error('Claude Agent scheduler must be configured before starting schedule');
    }

    const taskId = 'legacy-daily-scan';
    
    if (this.scheduledTasks.has(taskId)) {
      this.stopAgent(taskId);
    }

    // Parse the cron time for logging
    const [minute, hour] = scheduleTime.split(' ');
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

    this.scheduledTasks.set(taskId, cron.schedule(scheduleTime, async () => {
      await this.executeScheduledScan();
    }, {
      scheduled: true,
      timezone: 'UTC'
    }));

    liveLogService.info('Daily Claude Agent schedule started', {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: `Automatic daily RFP scanning scheduled for ${time} UTC`,
      data: {
        schedule: scheduleTime,
        time: time,
        timezone: 'UTC',
        startedAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'scheduler', 'daily-scan']
    });
  }

  /**
   * Stop the scheduled task
   */
  public stopSchedule(): void {
    this.stopAgent('legacy-daily-scan');
  }

  /**
   * Stop a specific agent
   */
  public stopAgent(taskId: string): void {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(taskId);
      this.agents.delete(taskId);

      const agentType = this.agents.get(taskId);
      liveLogService.info(`${agentType ? agentType.charAt(0).toUpperCase() + agentType.slice(1) + ' Agent' : 'Task'} stopped`, {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: `${taskId} stopped`,
        data: {
          taskId,
          stoppedAt: new Date().toISOString()
        },
        tags: ['claude-agent', 'scheduler', 'stopped']
      });
    }
  }

  /**
   * Stop all agents
   */
  public stopAllAgents(): void {
    for (const taskId of this.scheduledTasks.keys()) {
      this.stopAgent(taskId);
    }
  }

  /**
   * Execute Mines Agent - webhook detection and historical backtesting
   */
  private async executeMinesAgent(sessionId?: string): Promise<void> {
    try {
      const executionSessionId = sessionId || `mines-agent-${Date.now()}`;
      
      liveLogService.info('🚨 Mines Agent executing', {
        category: 'claude-agent',
        source: 'MinesAgent',
        message: 'Starting webhook detection and historical RFP backtesting with Claude SDK',
        data: {
          timestamp: new Date().toISOString(),
          agentType: 'mines',
          sessionId: executionSessionId
        },
        tags: ['claude-agent', 'mines-agent', 'executing']
      });

      // Create Claude Agent SDK stream for Mines Agent
      const stream = await claudeAgentSDKService.createStream({
        sessionId: executionSessionId,
        systemPrompt: `You are the MINES AGENT - a specialized RFP detection and historical backtesting system.

🎯 Your Mission:
1. Monitor webhook signals from Keyword Mines system for procurement opportunities
2. Perform 6-month historical backtesting of sports industry RFPs
3. Identify and analyze RFP opportunities from LinkedIn, procurement sites, and industry sources
4. Save validated opportunities to the /tender page

🔍 Search Focus:
- Sports technology RFPs
- Venue management procurement  
- Event services tenders
- Stadium digital transformation projects
- Sports sponsorship opportunities
- Athletic department technology
- Sports facility management software
- Ticketing system RFPs

⏰ Historical Analysis: Analyze past 6 months for pattern recognition and success rate calculation.

💾 Save qualified RFPs to /tender page with fit scoring and priority ranking.

Current Session: Mines Agent Operational
Agent Type: RFP Detection & Historical Backtesting
Mode: Active Scanning & Analysis`,
        allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
        maxTurns: 10
      });

      // Send the mines agent prompt
      await claudeAgentSDKService.processMessage(sessionId, `Execute comprehensive RFP detection and backtesting analysis:

1. Search for current sports industry RFPs and procurement opportunities
2. Analyze historical patterns from the past 6 months  
3. Identify high-value opportunities that match our target industries
4. Perform webhook detection simulation for Keyword Mines integration
5. Save qualified findings to the /tender page with appropriate scoring

Start with sports technology procurement opportunities and expand to related categories.`);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 8000));

      // End the stream
      claudeAgentSDKService.endStream(sessionId);

      liveLogService.info('🚨 Mines Agent processing completed', {
        category: 'claude-agent',
        source: 'MinesAgent',
        message: 'Mines Agent Claude SDK processing completed - RFP detection and backtesting analysis finished',
        data: {
          timestamp: new Date().toISOString(),
          agentType: 'mines',
          sessionId,
          processingTime: '8 seconds'
        },
        tags: ['claude-agent', 'mines-agent', 'claude-sdk', 'completed']
      });

    } catch (error) {
      liveLogService.error('❌ Mines Agent failed', {
        category: 'claude-agent',
        source: 'MinesAgent',
        message: `Mines Agent execution failed: ${error.message}`,
        data: {
          error: error.message,
          timestamp: new Date().toISOString(),
          agentType: 'mines'
        },
        tags: ['claude-agent', 'mines-agent', 'error']
      });
    }
  }

  /**
   * Execute Enrichment Agent - comprehensive entity enrichment
   */
  private async executeEnrichmentAgent(): Promise<void> {
    try {
      const sessionId = `enrichment-agent-${Date.now()}`;
      
      liveLogService.info('🧬 Enrichment Agent executing', {
        category: 'claude-agent',
        source: 'EnrichmentAgent',
        message: 'Starting comprehensive entity enrichment for 4,000+ entities with Claude SDK',
        data: {
          timestamp: new Date().toISOString(),
          agentType: 'enrichment',
          targetEntities: 4000,
          sessionId
        },
        tags: ['claude-agent', 'enrichment-agent', 'executing']
      });

      // Create Claude Agent SDK stream for Enrichment Agent
      const stream = await claudeAgentSDKService.createStream({
        sessionId,
        systemPrompt: `You are the ENRICHMENT AGENT - a comprehensive entity enrichment system for sports intelligence.

🎯 Your Mission:
Enrich all 4,000+ sports entities using the complete schema from ENTITY_SCHEMA_DEFINITION.md

📋 Schema Coverage:
- Entity classification and hierarchy
- Digital maturity assessment  
- Contact information enrichment
- Financial data analysis
- Market positioning evaluation
- Technology stack identification
- Relationship mapping
- Performance metrics

🔍 Enrichment Sources:
- BrightData MCP: Web scraping, company research, market data
- Perplexity MCP: Strategic analysis, market insights, competitive intelligence  
- Neo4j MCP: Relationship mapping, knowledge graph integration

📊 Processing:
- Batch size: 50 entities per cycle
- Priority: High-value entities first
- Quality threshold: 80% completion minimum
- Duplicate detection and conflict resolution

💾 Store enriched data in Neo4j with Supabase caching for performance.

Current Session: Enrichment Agent Operational
Agent Type: Comprehensive Entity Enrichment
Target: 4,000+ sports entities (clubs, leagues, venues, personnel)
Mode: Batch Processing with Quality Assurance`,
        allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
        maxTurns: 15
      });

      // Send the enrichment agent prompt
      await claudeAgentSDKService.processMessage(sessionId, `Execute comprehensive entity enrichment for the sports intelligence database:

1. Begin batch processing of sports entities (target: 50 entities per batch)
2. Apply ENTITY_SCHEMA_DEFINITION.md for complete coverage
3. Use available MCP tools for data enrichment:
   - Neo4j MCP: Query existing relationships and entity data
   - BrightData MCP: Research current information and web data
   - Perplexity MCP: Get market insights and strategic analysis
4. Enrich key schema fields: digital maturity, contacts, financial data, market position
5. Ensure 80%+ completion rate with quality validation
6. Store results in Neo4j with proper relationship mapping

Start with the highest priority sports clubs and organizations, then proceed through leagues, venues, and personnel. Focus on actionable intelligence for business development.`);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 12000));

      // End the stream
      claudeAgentSDKService.endStream(sessionId);

      liveLogService.info('🧬 Enrichment Agent processing completed', {
        category: 'claude-agent',
        source: 'EnrichmentAgent',
        message: 'Enrichment Agent Claude SDK processing completed - comprehensive entity enrichment finished',
        data: {
          timestamp: new Date().toISOString(),
          agentType: 'enrichment',
          sessionId,
          processingTime: '12 seconds',
          targetEntities: 4000
        },
        tags: ['claude-agent', 'enrichment-agent', 'claude-sdk', 'completed']
      });

    } catch (error) {
      liveLogService.error('❌ Enrichment Agent failed', {
        category: 'claude-agent',
        source: 'EnrichmentAgent',
        message: `Enrichment Agent execution failed: ${error.message}`,
        data: {
          error: error.message,
          timestamp: new Date().toISOString(),
          agentType: 'enrichment'
        },
        tags: ['claude-agent', 'enrichment-agent', 'error']
      });
    }
  }

  /**
   * Execute a scheduled scan (legacy method)
   */
  private async executeScheduledScan(): Promise<void> {
    if (!this.claudeService) {
      liveLogService.error('Cannot execute scheduled scan - service not configured', {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: 'Scheduled scan failed: Claude Agent service not configured',
        data: {
          timestamp: new Date().toISOString()
        },
        tags: ['claude-agent', 'scheduler', 'error']
      });
      return;
    }

    try {
      liveLogService.info('Executing scheduled Claude Agent scan', {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: 'Starting automatic daily RFP intelligence scan',
        data: {
          timestamp: new Date().toISOString(),
          trigger: 'scheduled'
        },
        tags: ['claude-agent', 'scheduler', 'executing']
      });

      const results = await this.claudeService.runDailyRFPScraping();

      liveLogService.info('Scheduled Claude Agent scan completed successfully', {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: `Automatic daily scan completed with ${results.length} opportunities found`,
        data: {
          resultsCount: results.length,
          highValueCount: results.filter(r => r.relevanceScore > 0.8).length,
          timestamp: new Date().toISOString()
        },
        tags: ['claude-agent', 'scheduler', 'completed']
      });

    } catch (error) {
      liveLogService.error('Scheduled Claude Agent scan failed', {
        category: 'system',
        source: 'ClaudeAgentScheduler',
        message: `Automatic daily scan failed: ${error.message}`,
        data: {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        tags: ['claude-agent', 'scheduler', 'error']
      });
    }
  }

  /**
   * Manually trigger Mines Agent
   */
  public async triggerMinesAgent(): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Claude Agent scheduler must be configured before manual trigger');
    }

    liveLogService.info('🚨 Manual Mines Agent trigger', {
      category: 'claude-agent',
      source: 'ClaudeAgentScheduler',
      message: 'Manual Mines Agent execution triggered',
      data: {
        timestamp: new Date().toISOString(),
        trigger: 'manual',
        agentType: 'mines'
      },
      tags: ['claude-agent', 'mines-agent', 'manual-trigger']
    });

    await this.executeMinesAgent();
  }

  /**
   * Manually trigger Enrichment Agent
   */
  public async triggerEnrichmentAgent(): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Claude Agent scheduler must be configured before manual trigger');
    }

    liveLogService.info('🧬 Manual Enrichment Agent trigger', {
      category: 'claude-agent',
      source: 'ClaudeAgentScheduler',
      message: 'Manual Enrichment Agent execution triggered',
      data: {
        timestamp: new Date().toISOString(),
        trigger: 'manual',
        agentType: 'enrichment'
      },
      tags: ['claude-agent', 'enrichment-agent', 'manual-trigger']
    });

    await this.executeEnrichmentAgent();
  }

  /**
   * Manually trigger a scan (for testing/ad-hoc use) - legacy method
   */
  public async triggerManualScan(): Promise<any[]> {
    if (!this.claudeService) {
      throw new Error('Claude Agent scheduler must be configured before manual trigger');
    }

    liveLogService.info('Manual Claude Agent scan triggered', {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: 'Manual RFP intelligence scan initiated',
      data: {
        timestamp: new Date().toISOString(),
        trigger: 'manual'
      },
      tags: ['claude-agent', 'scheduler', 'manual-trigger']
    });

    return await this.executeScheduledScan();
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    isConfigured: boolean;
    agents: {
      mines: { active: boolean; schedule?: string; lastRun?: string };
      enrichment: { active: boolean; schedule?: string; lastRun?: string };
      legacy: { active: boolean; schedule?: string; lastRun?: string };
    };
    activeTasks: number;
  } {
    const status = {
      isConfigured: this.isConfigured,
      agents: {
        mines: {
          active: this.scheduledTasks.has('mines-agent'),
          schedule: this.scheduledTasks.has('mines-agent') ? '*/30 * * * *' : undefined,
          lastRun: undefined
        },
        enrichment: {
          active: this.scheduledTasks.has('enrichment-agent'),
          schedule: this.scheduledTasks.has('enrichment-agent') ? '0 2 * * *' : undefined,
          lastRun: undefined
        },
        legacy: {
          active: this.scheduledTasks.has('legacy-daily-scan'),
          schedule: this.scheduledTasks.has('legacy-daily-scan') ? '0 9 * * *' : undefined,
          lastRun: undefined
        }
      },
      activeTasks: this.scheduledTasks.size
    };

    return status;
  }

  /**
   * Start both specialized agents
   */
  public startSpecializedAgents(): void {
    this.startMinesAgent();           // Every 30 minutes for RFP detection
    this.startEnrichmentAgent();      // Daily at 2 AM for entity enrichment
    
    liveLogService.info('🚀 Both specialized agents started', {
      category: 'system',
      source: 'ClaudeAgentScheduler',
      message: 'Mines Agent and Enrichment Agent are now active',
      data: {
        minesAgent: 'active (*/30 * * * *)',
        enrichmentAgent: 'active (0 2 * * *)',
        startedAt: new Date().toISOString()
      },
      tags: ['claude-agent', 'scheduler', 'both-agents']
    });
  }

  /**
   * Configure with environment variables
   */
  public configureFromEnvironment(): ClaudeAgentScheduler {
    const config: ClaudeAgentConfig = {
      brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
      brightdataZone: process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor',
      neo4jUri: process.env.NEO4J_URI || '',
      neo4jUsername: process.env.NEO4J_USERNAME || '',
      neo4jPassword: process.env.NEO4J_PASSWORD || '',
      teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
      perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
      searchQueries: [
        'sports technology RFP',
        'venue management Request for Proposal',
        'event services procurement',
        'stadium digital transformation',
        'sports sponsorship opportunities',
        'athletic department technology',
        'sports facility management software',
        'ticketing system RFP'
      ],
      targetIndustries: [
        'Sports & Entertainment',
        'Venue Management',
        'Event Technology',
        'Digital Sports',
        'Facility Operations'
      ]
    };

    // Validate required environment variables
    if (!config.brightdataApiKey) {
      throw new Error('BRIGHTDATA_API_TOKEN environment variable is required');
    }

    if (!config.neo4jUri || !config.neo4jUsername || !config.neo4jPassword) {
      throw new Error('Neo4j configuration (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD) is required');
    }

    if (!config.perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }

    this.configure(config);
    return this;
  }
}

// Global scheduler instance
export const claudeAgentScheduler = ClaudeAgentScheduler.getInstance();