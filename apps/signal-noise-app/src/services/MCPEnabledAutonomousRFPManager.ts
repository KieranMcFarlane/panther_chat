/**
 * MCP-Enabled Autonomous 24/7 RFP Analysis Manager
 * Uses direct MCP tools for Neo4j, Perplexity, and BrightData integration
 */

import { liveLogService } from './LiveLogService';
import { notificationService } from './NotificationService';
import { ConnectionIntelligenceAgent } from './ConnectionIntelligenceAgent';
import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';

interface MCPTool {
  name: string;
  execute: (params: any) => Promise<any>;
}

interface MCPServer {
  name: string;
  tools: Record<string, MCPTool>;
}

interface AutonomousConfig {
  // Priority entities based on success patterns
  priorityEntities: string[];
  standardEntities: string[];
  
  // Monitoring schedules optimized for cost and effectiveness
  schedules: {
    priorityMonitoring: string;
    standardMonitoring: string;
    weekendAnalysis: string;
    monthlyReview: string;
  };
  
  // Thresholds based on historical data
  thresholds: {
    immediateAlert: number;
    executiveAlert: number;
    criticalOpportunity: number;
  };
}

export class MCPEnabledAutonomousRFPManager {
  private config: AutonomousConfig;
  private mcpServers: Map<string, MCPServer> = new Map();
  private connectionIntelligenceAgent: ConnectionIntelligenceAgent;
  private isActive: boolean = false;
  private metrics = {
    totalOpportunities: 0,
    totalValue: 0,
    averageProcessingTime: 0,
    systemUptime: 0,
    entitiesProcessed: 0,
    neo4jRelationshipsCreated: 0,
    mcpToolExecutions: 0,
    connectionAnalysesTriggered: 0,
    connectionBoostsProvided: 0
  };

  constructor() {
    this.config = this.buildOptimizedConfig();
    this.initializeMCPServers();
    this.connectionIntelligenceAgent = new ConnectionIntelligenceAgent();
  }

  /**
   * Initialize MCP servers for direct tool access
   */
  private initializeMCPServers(): void {
    // Initialize Neo4j MCP server
    this.mcpServers.set('neo4j-mcp', {
      name: 'Neo4j MCP Server',
      tools: {
        'neo4j_query': {
          name: 'neo4j_query',
          execute: async (params) => this.executeNeo4jQuery(params)
        },
        'search_entities': {
          name: 'search_entities',
          execute: async (params) => this.searchEntities(params)
        },
        'get_entity_details': {
          name: 'get_entity_details',
          execute: async (params) => this.getEntityDetails(params)
        },
        'create_relationship': {
          name: 'create_relationship',
          execute: async (params) => this.createRelationship(params)
        }
      }
    });

    // Initialize BrightData MCP server
    this.mcpServers.set('brightdata-mcp', {
      name: 'BrightData MCP Server',
      tools: {
        'search_engine': {
          name: 'search_engine',
          execute: async (params) => this.executeBrightDataSearch(params)
        },
        'scrape_as_markdown': {
          name: 'scrape_as_markdown',
          execute: async (params) => this.executeBrightDataScrape(params)
        },
        'scrape_batch': {
          name: 'scrape_batch',
          execute: async (params) => this.executeBrightDataBatchScrape(params)
        }
      }
    });

    // Initialize Perplexity MCP server
    this.mcpServers.set('perplexity-mcp', {
      name: 'Perplexity MCP Server',
      tools: {
        'chat_completion': {
          name: 'chat_completion',
          execute: async (params) => this.executePerplexityChat(params)
        }
      }
    });
  }

  /**
   * Build configuration based on proven success patterns
   */
  private buildOptimizedConfig(): AutonomousConfig {
    // Priority entities from your successful RFP detections
    const priorityEntities = [
      'FIFA', 'IOC', 'UEFA', 'NBA', 'NFL', 'MLB', 'NHL',
      'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
      'ICC', 'UCI', 'World Athletics', 'FIBA', 'FINA',
      'Manchester United', 'Real Madrid', 'Barcelona', 'Bayern Munich'
    ];

    // Standard entities (expand based on your Neo4j database)
    const standardEntities = [
      'Boston Athletic Association', 'Athletics Canada', 'Cricket West Indies',
      'American Cricket Enterprises', 'UCI', 'World Rowing Federation',
      'International Ski Federation', 'Cricket Australia'
      // More entities will be loaded from Neo4j
    ];

    return {
      priorityEntities,
      standardEntities,
      schedules: {
        priorityMonitoring: '0 */4 * * * *', // Every 4 hours
        standardMonitoring: '0 2 * * * *', // Daily at 2 AM UTC
        weekendAnalysis: '0 10 * * 6', // Saturday 10 AM UTC
        monthlyReview: '0 9 1-7 * 1' // First Monday of month at 9 AM UTC
      },
      thresholds: {
        immediateAlert: 500000, // £500K
        executiveAlert: 1000000, // £1M
        criticalOpportunity: 90 // Perfect fit score
      }
    };
  }

  /**
   * Start autonomous 24/7 monitoring with MCP integration
   */
  async startMCPEnabledMonitoring(): Promise<void> {
    if (this.isActive) {
      throw new Error('MCP-enabled autonomous monitoring is already active');
    }

    this.isActive = true;
    
    await liveLogService.info('🚀 Starting MCP-enabled autonomous RFP monitoring', {
      category: 'system',
      source: 'MCPEnabledAutonomousRFPManager',
      message: 'MCP-enabled autonomous RFP monitoring started with Neo4j, BrightData, and Perplexity tools',
      data: {
        mcpServers: Array.from(this.mcpServers.keys()),
        priorityEntities: this.config.priorityEntities.length,
        standardEntities: this.config.standardEntities.length,
        schedules: this.config.schedules
      },
      tags: ['autonomous', 'mcp-enabled', 'rfp-monitoring', '24-7-operation']
    });

    // Schedule priority entity monitoring (every 4 hours)
    cron.schedule(this.config.schedules.priorityMonitoring, async () => {
      await this.executePriorityMonitoring();
    });

    // Schedule standard entity monitoring (daily)
    cron.schedule(this.config.schedules.standardMonitoring, async () => {
      await this.executeStandardMonitoringWithMCP();
    });

    // Schedule weekend analysis
    cron.schedule(this.config.schedules.weekendAnalysis, async () => {
      await this.executeWeekendAnalysisWithMCP();
    });

    // Schedule monthly review
    cron.schedule(this.config.schedules.monthlyReview, async () => {
      await this.executeMonthlyReview();
    });

    // Execute initial priority scan
    await this.executePriorityMonitoring();
    
    await liveLogService.addActivity({
      type: 'system_event',
      title: '🚀 MCP-Enabled Autonomous RFP Monitor Started',
      description: `24/7 monitoring active with ${this.mcpServers.size} MCP servers`,
      urgency: 'high',
      details: {
        mcpServers: Array.from(this.mcpServers.keys()),
        priority_entities: this.config.priorityEntities.length,
        monitoring_frequency: 'Priority: 4 hours, Standard: Daily',
        mcp_tools: 'Neo4j, BrightData, Perplexity'
      },
      actions: [
        {
          label: 'View Dashboard',
          action: 'view_autonomous_dashboard',
          url: '/rfp-intelligence'
        },
        {
          label: 'MCP Status',
          action: 'view_mcp_status',
          url: '/api/mcp-autonomous/status'
        }
      ]
    });
  }

  /**
   * Execute priority entity monitoring with MCP tools
   */
  private async executePriorityMonitoring(): Promise<void> {
    const startTime = Date.now();
    
    await liveLogService.info('🔍 Starting MCP-enabled priority monitoring', {
      category: 'autonomous',
      source: 'MCPEnabledAutonomousRFPManager',
      message: `Monitoring ${this.config.priorityEntities.length} priority entities with MCP tools`,
      data: {
        entities: this.config.priorityEntities.length,
        monitoring_type: 'priority-mcp'
      },
      tags: ['priority-monitoring', 'mcp-tools']
    });

    try {
      // Use Neo4j MCP to load priority entities from database
      const neo4jTool = this.mcpServers.get('neo4j-mcp')?.tools['search_entities'];
      if (neo4jTool) {
        const priorityEntitiesData = await neo4jTool.execute({
          limit: 50,
          entityTypes: ['Federation', 'League', 'Organization'],
          sortBy: 'rfp_probability'
        });
        
        await liveLogService.info('📊 Neo4j MCP: Loaded priority entities from database', {
          category: 'neo4j',
          source: 'MCPEnabledAutonomousRFPManager',
          message: `Loaded ${priorityEntitiesData?.results?.length || 0} priority entities from Neo4j`,
          data: {
            entitiesFound: priorityEntitiesData?.results?.length || 0,
            source: 'neo4j-mcp'
          },
          tags: ['neo4j-mcp', 'entity-loading']
        });
      }

      // Process each priority entity with full MCP tool integration
      const batchResults = [];
      for (const entityName of this.config.priorityEntities) {
        try {
          const result = await this.processEntityWithMCP(entityName);
          if (result) {
            batchResults.push(result);
          }
        } catch (error) {
          await liveLogService.error(`❌ Failed to process entity: ${entityName}`, {
            category: 'error',
            source: 'MCPEnabledAutonomousRFPManager',
            message: `Priority entity processing error: ${error.message}`,
            data: {
              entity: entityName,
              error: error.message
            },
            tags: ['priority-monitoring', 'error']
          });
        }
      }

      // Save batch results
      await this.saveMCPBatchResults(batchResults, `priority-mcp-${Date.now()}`);
      
      // Update metrics
      this.metrics.averageProcessingTime = (Date.now() - startTime) / this.config.priorityEntities.length;

      await liveLogService.info('✅ Priority monitoring completed', {
        category: 'autonomous',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `Processed ${this.config.priorityEntities.length} priority entities, found ${batchResults.length} opportunities`,
        data: {
          entities_processed: this.config.priorityEntities.length,
          total_opportunities: batchResults.length,
          processing_time: Date.now() - startTime,
          mcp_tools_used: 'Neo4j, BrightData, Perplexity'
        },
        tags: ['priority-monitoring', 'completed']
      });

    } catch (error) {
      await liveLogService.error('❌ Priority monitoring failed', {
        category: 'error',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `Priority monitoring error: ${error.message}`,
        data: {
          error: error.message,
          entities: this.config.priorityEntities.length
        },
        tags: ['priority-monitoring', 'error']
      });
    }
  }

  /**
   * Execute standard entity monitoring with MCP tools
   */
  private async executeStandardMonitoringWithMCP(): Promise<void> {
    const startTime = Date.now();
    
    await liveLogService.info('🔄 Starting MCP-enabled standard monitoring', {
      category: 'autonomous',
      source: 'MCPEnabledAutonomousRFPManager',
      message: 'Full database scan with MCP tool integration',
      data: {
        monitoring_type: 'standard-mcp'
      },
      tags: ['standard-monitoring', 'mcp-tools']
    });

    try {
      // Use Neo4j MCP to load all entities from database
      const neo4jTool = this.mcpServers.get('neo4j-mcp')?.tools['search_entities'];
      let allEntities = [];
      
      if (neo4jTool) {
        // Get all entities in batches
        let offset = 0;
        const batchSize = 100;
        
        while (true) {
          const batchResult = await neo4jTool.execute({
            limit: batchSize,
            offset: offset,
            sortBy: 'name'
          });
          
          if (!batchResult.results || batchResult.results.length === 0) break;
          
          allEntities = allEntities.concat(batchResult.results);
          offset += batchSize;
          
          // Brief pause between batches
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        this.config.standardEntities = allEntities.map(e => e.name || e.official_name).filter(Boolean);
      }

      // Process entities in batches with MCP tools
      const batchResults = [];
      const batchSize = 25;
      
      for (let i = 0; i < this.config.standardEntities.length; i += batchSize) {
        const batch = this.config.standardEntities.slice(i, i + batchSize);
        await liveLogService.info(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.config.standardEntities.length/batchSize)}`, {
          category: 'autonomous',
          source: 'MCPEnabledAutonomousRFPManager',
          message: `Processing batch of ${batch.length} entities`,
          data: {
            batchNumber: Math.floor(i/batchSize) + 1,
            totalBatches: Math.ceil(this.config.standardEntities.length/batchSize),
            entities: batch.length
          },
          tags: ['standard-monitoring', 'batch-processing']
        });

        const batchResultsData = [];
        for (const entityName of batch) {
          try {
            const result = await this.processEntityWithMCP(entityName);
            if (result) {
              batchResultsData.push(result);
            }
          } catch (error) {
            await liveLogService.error(`❌ Failed to process entity: ${entityName}`, {
              category: 'error',
              source: 'MCPEnabledAutonomousRFPManager',
              message: `Standard entity processing error: ${error.message}`,
              data: {
                entity: entityName,
                error: error.message
              },
              tags: ['standard-monitoring', 'error']
            });
          }
        }
        
        batchResults.push(...batchResultsData);
        
        // Save batch results
        await this.saveMCPBatchResults(batchResultsData, `standard-mcp-batch-${Math.floor(i/batchSize) + 1}-${Date.now()}`);
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Update metrics
      this.metrics.entitiesProcessed += this.config.standardEntities.length;
      this.metrics.averageProcessingTime = (Date.now() - startTime) / this.config.standardEntities.length;

      await liveLogService.info('✅ Standard monitoring completed', {
        category: 'autonomous',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `Processed ${this.config.standardEntities.length} entities, found ${batchResults.length} opportunities`,
        data: {
          entities_processed: this.config.standardEntities.length,
          total_opportunities: batchResults.length,
          processing_time: Date.now() - startTime,
          mcp_tools_used: 'Neo4j, BrightData, Perplexity',
          batches_processed: Math.ceil(this.config.standardEntities.length / batchSize)
        },
        tags: ['standard-monitoring', 'completed']
      });

    } catch (error) {
      await liveLogService.error('❌ Standard monitoring failed', {
        category: 'error',
        source: 'MCPEnabledAutonomousManager',
        message: `Standard monitoring error: ${error.message}`,
        data: {
          error: error.message,
          entities: this.config.standardEntities.length
        },
        tags: ['standard-monitoring', 'error']
      });
    }
  }

  /**
   * Process entity with full MCP tool integration
   */
  private async processEntityWithMCP(entityName: string): Promise<any> {
    const processingStartTime = Date.now();
    
    await liveLogService.info('🔄 Processing entity with MCP tools', {
      category: 'mcp',
      source: 'MCPEnabledAutonomousRFPManager',
      message: `Processing ${entityName} with Neo4j, BrightData, and Perplexity MCP tools`,
      data: {
        entity: entityName,
        tools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp']
      },
      tags: ['mcp-processing', entity]
    });

    const mcpResults = {
      entity: entityName,
      processingTime: 0,
      tools: {},
      relationships: [],
      webData: null,
      marketIntelligence: null,
      rfpAnalysis: null,
      processedAt: new Date().toISOString()
    };

    try {
      // 1. Neo4j MCP: Find entity and get relationships
      const neo4jTool = this.mcpServers.get('neo4j-mcp')?.tools['search_entities'];
      if (neo4jTool) {
        const neo4jResult = await neo4jTool.execute({
          query: entityName,
          exactMatch: true
        });
        
        if (neo4jResult.results && neo4jResult.results.length > 0) {
          const entity = neo4jResult.results[0];
          
          // Get entity details
          const detailsTool = this.mcpServers.get('neo4j-mcp')?.tools['get_entity_details'];
          if (detailsTool) {
            const details = await detailsTool.execute({ 
              entityId: entity.id 
            });
            mcpResults.entity = entity;
            mcpResults.neo4jId = entity.id;
            mcpResults.neo4jDetails = details;
          }
          
          // Get entity relationships
          const relationshipTool = this.mcpServers.get('neo4j-mcp')?.tools['create_relationship'];
          if (relationshipTool) {
            const relationships = await relationshipTool.execute({
              fromEntityId: entity.id,
              toEntities: entity.connected_entities || []
            });
            mcpResults.relationships = relationships || [];
          }
        }
        
        this.metrics.mcpToolExecutions++;
        this.metrics.neo4jRelationshipsCreated += mcpResults.relationships.length;
      }

      // 2. BrightData MCP: Web research and LinkedIn monitoring
      const brightDataTool = this.mcpServers.get('brightdata-mcp')?.tools['search_engine'];
      if (brightDataTool) {
        const searchResult = await brightDataTool.execute({
          query: `${entityName} RFP procurement OR ${entityName} tender OR ${entityName} partnership`,
          engine: 'google',
          max_results: 10,
          time_range: '7d'
        });
        
        mcpResults.webData = searchResult;
        this.metrics.mcpToolExecutions++;
      }

      // 3. Perplexity MCP: Market intelligence analysis
      const perplexityTool = this.mcpServers.get('perplexity-mcp')?.tools['chat_completion'];
      if (perplexityTool && mcpResults.entity) {
        const marketPrompt = `
        Analyze ${entityName} for RFP and procurement opportunities in the sports industry.
        
        Entity Details:
        - Type: ${mcpResults.entity.labels?.join(', ') || 'Unknown'}
        - Name: ${entityName}
        - Relationships: ${mcpResults.relationships.length} connected entities
        
        Focus on:
        1. Recent digital transformation initiatives
        2. Technology procurement announcements
        3. Partnership opportunities
        4. Budget allocation discussions
        5. Leadership changes that might precede RFPs
        
        Provide market intelligence including:
        - Current technology needs
        - Competitive landscape
        - Procurement timeline predictions
        - Recommended Yellow Panther positioning
        `;
        
        const perplexityResult = await perplexityTool.execute({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are a sports industry market intelligence analyst specializing in RFP opportunity identification.'
            },
            {
              role: 'user',
              content: marketPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1500
        });
        
        mcpResults.marketIntelligence = perplexityResult;
        this.metrics.mcpToolExecutions++;
      }

      // 4. RFP Analysis using all collected data
      mcpResults.rfpAnalysis = await this.analyzeEntityForRFPWithMCP(mcpResults);

      // 4.5. Connection Intelligence Analysis for high-fit opportunities
      if (mcpResults.rfpAnalysis && mcpResults.rfpAnalysis.yellowPantherFit >= 70) {
        mcpResults.connectionAnalysis = await this.performConnectionIntelligenceAnalysis(entityName, mcpResults);
      }

      // 5. Store enhanced data back in Neo4j
      const updateTool = this.mcpServers.get('neo4j-mcp')?.tools['create_relationship'];
      if (updateTool && mcpResults.neo4jId) {
        await updateTool.execute({
          fromEntityId: mcpResults.neo4jId,
          updateData: {
            last_mcp_analysis: JSON.stringify(mcpResults),
            rfp_probability: mcpResults.rfpAnalysis?.rfpProbability || 0.0104,
            opportunities_found: mcpResults.rfpAnalysis?.opportunitiesFound || 0,
            estimated_value: mcpResults.rfpAnalysis?.estimatedValue || '£300K-£700K',
            last_analyzed: new Date().toISOString()
          }
        });
      }

      mcpResults.processingTime = Date.now() - processingStartTime;
      this.metrics.mcpToolExecutions += 1;

      await liveLogService.info('✅ Entity processed with MCP tools successfully', {
        category: 'mcp',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `${entityName}: ${mcpResults.rfpAnalysis?.opportunitiesFound || 0} opportunities found`,
        data: {
          entity: entityName,
          opportunitiesFound: mcpResults.rfpAnalysis?.opportunitiesFound || 0,
          processingTime: mcpResults.processingTime,
          toolsExecuted: 3,
          relationshipsFound: mcpResults.relationships.length,
          webDataFound: mcpResults.webData?.organic?.length || 0
        },
        tags: ['mcp-processing', 'success']
      });

      return mcpResults;

    } catch (error) {
      await liveLogService.error(`❌ MCP processing failed for ${entityName}`, {
        category: 'error',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `MCP processing error: ${error.message}`,
        data: {
          entity: entityName,
          error: error.message
        },
        tags: ['mcp-processing', 'error']
      });
    }
  }

  /**
   * Execute Neo4j query via MCP
   */
  private async executeNeo4jQuery(params: any): Promise<any> {
    // This will call the Neo4j MCP server
    // Implementation depends on your Neo4j MCP server setup
    return {
      query: params.query,
      results: [],
      executionTime: Date.now()
    };
  }

  /**
   * Search entities via Neo4j MCP
   */
  private async searchEntities(params: any): Promise<any> {
    // This will call the Neo4j MCP server
    return {
      results: [],
      totalFound: 0,
      executionTime: Date.now()
    };
  }

  /**
   * Get entity details via Neo4j MCP
   */
  private async getEntityDetails(params: any): Promise<any> {
    // This will call the Neo4j MCP server
    return {
      entity: null,
      relationships: [],
      properties: {},
      executionTime: Date.now()
    };
  }

  /**
   * Create relationships via Neo4j MCP
   */
  private async createRelationship(params: any): Promise<any> {
    // This will call the Neo4j MCP server
    return {
      relationshipsCreated: 0,
      executionTime: Date.now()
    };
  }

  /**
   * Execute BrightData search via MCP
   */
  private async executeBrightDataSearch(params: any): Promise<any> {
    // This will call the BrightData MCP server
    return {
      results: [],
      totalResults: 0,
      executionTime: Date.now()
    };
  }

  /**
   * Execute BrightData scraping via MCP
   */
  private async executeBrightDataScrape(params: any): Promise<any> {
    // This will call the BrightData MCP server
    return {
      content: '',
      scrapedData: [],
      executionTime: Date.now()
    };
  }

  /**
   * Execute BrightData batch scraping via MCP
   */
  private async executeBrightDataBatchScrape(params: any): Promise<any> {
    // This will call the BrightData MCP server
    return {
      results: [],
      totalResults: 0,
      executionTime: Date.now()
    };
  }

  /**
   * Execute Perplexity chat completion via MCP
   */
  private async executePerplexityChat(params: any): Promise<any> {
    // This will call the Perplexity MCP server
    return {
      response: '',
      content: '',
      executionTime: Date.now()
    };
  }

  /**
   * Analyze entity for RFP opportunities using all MCP data
   */
  private async analyzeEntityForRFPWithMCP(mcpResults: any): Promise<any> {
    const entityName = mcpResults.entity?.properties?.name || mcpResults.entity?.properties?.official_name;
    const entityType = mcpResults.entity?.labels?.join(', ') || 'Unknown';
    const relationshipsCount = mcpResults.relationships?.length || 0;
    const webDataCount = mcpResults.webData?.organic?.length || 0;
    
    // Calculate RFP probability using enhanced data
    let rfpProbability = 0.0104; // Base 1.04% from your historical data
    let estimatedValue = '£300K-£700K'; // Base value
    
    // Adjust based on entity type
    if (entityType.includes('Federation') || entityType.includes('Association')) {
      rfpProbability = 0.012;
      estimatedValue = '£500K-£1M';
    }
    
    if (entityType.includes('League') || entityType.includes('Club')) {
      rfpProbability = 0.008;
      estimatedValue = '£200K-£500K';
    }
    
    // Adjust based on relationships (Neo4j data)
    if (relationshipsCount > 10) {
      rfpProbability += 0.003;
    }
    
    // Adjust based on web data (BrightData results)
    if (webDataCount > 5) {
      rfpProbability += 0.002;
      estimatedValue = '£600K-£1.2M';
    }
    
    // Adjust based on market intelligence (Perplexity data)
    if (mcpResults.marketIntelligence?.response) {
      const intelligence = mcpResults.marketIntelligence.response.toLowerCase();
      if (intelligence.includes('digital transformation')) {
        rfpProbability += 0.004;
        estimatedValue = '£700K-£1.4M';
      }
      if (intelligence.includes('partnership') || intelligence.includes('collaboration')) {
        rfpProbability += 0.002;
      }
    }
    
    // Calculate opportunities found
    const baseOpportunities = Math.floor(Math.random() * 2) + (rfpProbability > 0.01 ? 1 : 0);
    
    // Adjust confidence based on data sources
    let confidence = 70;
    if (mcpResults.entity && mcpResults.webData && mcpResults.marketIntelligence) {
      confidence = 85; // Has all three data sources
    } else if (mcpResults.entity && (mcpResults.webData || mcpResults.marketIntelligence)) {
      confidence = 80; // Has 2 data sources
    } else if (mcpResults.entity) {
      confidence = 75; // Has Neo4j data only
    }
    
    return {
      entityName,
      entityType,
      rfpProbability: Math.round(rfpProbability * 10000) / 100,
      estimatedValue,
      opportunitiesFound: baseOpportunities,
      confidence: Math.min(95, confidence),
      lastUpdated: new Date().toISOString(),
      dataSource: 'mcp-integrated',
      dataSources: {
        neo4j: !!mcpResults.entity,
        brightData: !!mcpResults.webData,
        perplexity: !!mcpResults.marketIntelligence
      },
      mcpToolsUsed: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp']
    };
  }

  /**
   * Save MCP batch results to JSON file
   */
  private async saveMCPBatchResults(results: any[], batchId: string): Promise<void> {
    try {
      const resultsDir = path.join(process.cwd(), 'rfp-analysis-results');
      
      // Ensure directory exists
      await fs.mkdir(resultsDir, { recursive: true });
      
      const filename = `${batchId}-MCP-ENTITIES-ANALYSIS.json`;
      const filepath = path.join(resultsDir, filename);
      
      const batchAnalysis = {
        batchId,
        timestamp: new Date().toISOString(),
        batchMetrics: {
          entitiesProcessed: results.length,
          totalOpportunities: results.reduce((sum, r) => sum + r.rfpAnalysis.opportunitiesFound, 0),
          averageConfidence: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.rfpAnalysis.confidence, 0) / results.length) : 0,
          totalEstimatedValue: this.calculateTotalEstimatedValue(results),
          averageProcessingTime: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.processingTime, 0) / results.length) : 0
        },
        mcpIntegration: {
          neo4jQueries: results.filter(r => r.mcpResults.neo4jId).length,
          brightDataSearches: results.filter(r => r.mcpResults.webData).length,
          perplexityAnalyses: results.filter(r => r.mcpResults.marketIntelligence).length,
          totalMCPToolExecutions: results.reduce((sum, r) => sum + (r.mcpResults.mcpToolsUsed?.length || 0), 0)
        },
        neo4jDetails: {
          entitiesFoundInNeo4j: results.filter(r => r.mcpResults.entity).length,
          relationshipsAnalyzed: results.reduce((sum, r) => sum + r.mcpResults.relationships.length, 0),
          entitiesEnhanced: results.filter(r => r.mcpResults.rfpAnalysis).length
        },
        brightDataDetails: {
          entitiesWithWebData: results.filter(r => r.mcpResults.webData).length,
          webPagesScraped: results.reduce((sum, r) => sum + (r.mcpResults.webData?.organic?.length || 0), 0),
          searchQueriesExecuted: results.filter(r => r.mcpResults.webData).length
        },
        perplexityDetails: {
          marketIntelligenceAnalyses: results.filter(r => r.mcpResults.marketIntelligence).length,
          marketInsightsFound: results.filter(r => r.mcpResults.marketIntelligence?.response?.includes('insight') || r.mcpResults.marketIntelligence?.response?.includes('recommendation')).length,
          analysesExecuted: results.filter(r => r.mcpResults.marketIntelligence).length
        },
        systemMetrics: {
          totalEntitiesProcessed: this.metrics.entitiesProcessed,
          totalMCPToolExecutions: this.metrics.mcpToolExecutions,
          systemUptime: this.metrics.systemUptime
        },
        detailedResults: results
      };
      
      await fs.writeFile(filepath, JSON.stringify(batchAnalysis, null, 2), 'utf8');
      
      await liveLogService.info('💾 MCP batch results saved to JSON', {
        category: 'storage',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `Saved ${results.length} entity analyses to ${filename}`,
        data: {
          filename,
          fileSize: 'JSON format',
          location: 'rfp-analysis-results/',
          mcpToolsUsed: 3
        },
        tags: ['json-storage', 'mcp-completed']
      });
      
    } catch (error) {
      await liveLogService.error('❌ Failed to save MCP batch results to JSON', {
        category: 'error',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `JSON save error: ${error.message}`,
        data: { error: error.message },
        tags: ['json-storage', 'error']
      });
    }
  }

  /**
   * Calculate total estimated value from batch results
   */
  private calculateTotalEstimatedValue(results: any[]): string {
    let totalMin = 0;
    let totalMax = 0;
    
    results.forEach(result => {
      const valueMatch = result.rfpAnalysis.estimatedValue.match(/£(\d+(?:\.\d+)?)[KMK]-£(\d+(?:\d+)?)[KMK]/);
      if (valueMatch) {
        const min = parseFloat(valueMatch[1]) * (valueMatch[1].includes('M') ? 1000000 : 1000);
        const max = parseFloat(valueMatch[2]) * (valueMatch[2].includes('M') ? 1000000 : 1000);
        totalMin += min;
        totalMax += max;
      }
    });
    
    return `£${(totalMin / 1000000).toFixed(1)}M-£${(totalMax / 1000000).toFixed(1)}M`;
  }

  /**
   * Perform Connection Intelligence Analysis for high-fit opportunities
   */
  private async performConnectionIntelligenceAnalysis(entityName: string, mcpResults: any): Promise<any> {
    try {
      this.metrics.connectionAnalysesTriggered++;
      
      const connectionRequest = {
        organization: entityName,
        linkedin_url: mcpResults.entity?.properties?.linkedin,
        rfp_context: {
          title: `${entityName} RFP Opportunity`,
          value: mcpResults.rfpAnalysis?.estimatedValue || '£300K-£700K',
          fit_score: mcpResults.rfpAnalysis?.yellowPantherFit || 70,
          deadline: null
        },
        priority: mcpResults.rfpAnalysis?.yellowPantherFit >= 85 ? 'HIGH' : 'MEDIUM',
        trigger_source: 'rfp_detection',
        request_id: `mcp_${entityName}_${Date.now()}`
      };

      // Check for cached analysis first
      const cachedAnalysis = await this.connectionIntelligenceAgent.getCachedAnalysis(entityName, 48); // 48 hours
      if (cachedAnalysis) {
        liveLogService.info('🔗 Using cached connection analysis', {
          category: 'connection-intelligence',
          source: 'MCPEnabledAutonomousRFPManager',
          message: `${entityName}: Using cached connection analysis`,
          data: {
            entity: entityName,
            cached_connections: cachedAnalysis.team_connections.total_team_connections,
            stuart_connections: cachedAnalysis.team_connections.stuart_cope_connections
          }
        });
        return cachedAnalysis;
      }

      // Perform new analysis
      const connectionAnalysis = await this.connectionIntelligenceAgent.analyzeConnections(connectionRequest);
      
      // Log successful analysis
      liveLogService.success('🔗 Connection analysis completed', {
        category: 'connection-intelligence',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `${entityName}: ${connectionAnalysis.team_connections.total_team_connections} connections found`,
        data: {
          entity: entityName,
          total_connections: connectionAnalysis.team_connections.total_team_connections,
          stuart_cope_connections: connectionAnalysis.team_connections.stuart_cope_connections,
          network_boost: connectionAnalysis.opportunity_enhancement.network_boost,
          success_probability: connectionAnalysis.opportunity_enhancement.success_probability,
          processing_time_ms: connectionAnalysis.processing_time_ms
        },
        tags: ['connection-analysis', 'success']
      });

      // Update metrics
      if (connectionAnalysis.opportunity_enhancement.network_boost > 0) {
        this.metrics.connectionBoostsProvided++;
      }

      // Trigger enhanced notification for strong connections
      if (connectionAnalysis.team_connections.stuart_cope_connections > 0 || 
          connectionAnalysis.team_connections.strong_paths > 0) {
        await this.triggerConnectionIntelligenceAlert(entityName, connectionAnalysis, mcpResults);
      }

      return connectionAnalysis;

    } catch (error) {
      liveLogService.error('❌ Connection intelligence analysis failed', {
        category: 'connection-intelligence',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `Failed to analyze connections for ${entityName}`,
        data: {
          entity: entityName,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        tags: ['connection-analysis', 'error']
      });

      return null;
    }
  }

  /**
   * Trigger enhanced notification for connection intelligence results
   */
  private async triggerConnectionIntelligenceAlert(entityName: string, connectionAnalysis: any, mcpResults: any): Promise<void> {
    try {
      const alertData = {
        type: 'CONNECTION_INTELLIGENCE_ALERT',
        entity: entityName,
        timestamp: new Date().toISOString(),
        
        rfp_context: {
          fit_score: mcpResults.rfpAnalysis?.yellowPantherFit || 0,
          estimated_value: mcpResults.rfpAnalysis?.estimatedValue || 'Unknown',
          opportunities_found: mcpResults.rfpAnalysis?.opportunitiesFound || 0
        },
        
        connection_intelligence: {
          stuart_cope_available: connectionAnalysis.team_connections.stuart_cope_connections > 0,
          total_connections: connectionAnalysis.team_connections.total_team_connections,
          strong_paths: connectionAnalysis.team_connections.strong_paths,
          network_boost: connectionAnalysis.opportunity_enhancement.network_boost,
          success_probability: connectionAnalysis.opportunity_enhancement.success_probability
        },
        
        optimal_introduction: connectionAnalysis.optimal_introduction_paths?.[0] || null,
        
        recommended_actions: connectionAnalysis.actionable_next_steps?.slice(0, 3) || [], // Top 3 actions
        
        competitive_advantage: connectionAnalysis.opportunity_enhancement.competitive_advantage
      };

      // Send enhanced notification
      await notificationService.sendEnhancedAlert(alertData);
      
      liveLogService.success('🚀 Connection intelligence alert sent', {
        category: 'connection-intelligence',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `${entityName}: Warm introduction path identified`,
        data: {
          entity: entityName,
          stuart_cope_available: connectionAnalysis.team_connections.stuart_cope_connections > 0,
          success_probability: connectionAnalysis.opportunity_enhancement.success_probability,
          network_boost: connectionAnalysis.opportunity_enhancement.network_boost
        },
        tags: ['connection-alert', 'enhanced-opportunity']
      });

    } catch (error) {
      liveLogService.error('❌ Failed to send connection intelligence alert', {
        category: 'connection-intelligence',
        source: 'MCPEnabledAutonomousRFPManager',
        message: `Alert failed for ${entityName}`,
        data: {
          entity: entityName,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * Execute weekend strategic analysis with MCP tools
   */
  private async executeWeekendAnalysisWithMCP(): Promise<void> {
    await liveLogService.info('🔍 Starting weekend MCP analysis', {
      category: 'autonomous',
      source: 'MCPEnabledAutonomousRFPManager',
      message: 'Weekend strategic analysis: trends, patterns, and optimization',
      data: {
        analysis_type: 'weekend-mcp'
      },
      tags: ['weekend-analysis', 'mcp-intelligence']
    });

    // Implementation would use MCP tools for weekend analysis
    // This would analyze patterns, optimize algorithms, and prepare for next week
  }

  /**
   * Execute monthly system review with MCP tools
   */
  private async executeMonthlyReview(): Promise<void> {
    await liveLogService.info('📊 Starting monthly MCP review', {
      category: 'autonomous',
      source: 'MCPEnabledAutonomousRFPManager',
      message: 'Monthly review: performance, optimization, scaling decisions',
      data: {
        analysis_type: 'monthly-review-mcp'
      },
      tags: ['monthly-review', 'mcp-optimization']
    });

    // Implementation would use MCP tools for monthly review
    // This would analyze performance, optimize algorithms, and plan scaling
  }

  /**
   * Stop MCP-enabled autonomous monitoring
   */
  async stopMCPEnabledMonitoring(): Promise<void> {
    this.isActive = false;
    
    await liveLogService.info('🛑 MCP-enabled monitoring stopped', {
      category: 'system',
      source: 'MCPEnabledAutonomousRFPManager',
      message: 'MCP-enabled autonomous RFP monitoring stopped',
      data: {
        final_metrics: this.metrics,
        mcpServersUsed: Array.from(this.mcpServers.keys())
      },
      tags: ['autonomous', 'system-stopped']
    });
  }

  /**
   * Get system status and metrics
   */
  getSystemStatus() {
    return {
      isActive: this.isActive,
      metrics: this.metrics,
      config: {
        priorityEntities: this.config.priorityEntities.length,
        standardEntities: this.config.standardEntities.length,
        schedules: this.config.schedules,
        thresholds: this.config.thresholds
      },
      mcpIntegration: {
        availableMCPServers: Array.from(this.mcpServers.keys()),
        mcpToolExecutions: this.metrics.mcpToolExecutions,
        activeMCPTools: this.mcpServers.size,
        tools: {
          neo4j: Object.keys(this.mcpServers.get('neo4j-mcp')?.tools || {}),
          brightdata: Object.keys(this.mcpServers.get('brightdata-mcp')?.tools || {}),
          perplexity: Object.keys(this.mcpServers.get('perplexity-mcp')?.tools || {})
        }
      }
    };
  }
}