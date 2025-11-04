import { EventEmitter } from 'events'
import { ClaudeAgentSDKService } from '@/services/ClaudeAgentSDKService'
import { DiscoveredRFP, RFPDiscoveryCard } from './a2a-rfp-discovery'

// MCP Tool interface for A2A integration
export interface MCPTool {
  name: string
  description: string
  server: string
  parameters: Record<string, any>
}

export interface MCPEnabledAgent extends EventEmitter {
  id: string
  name: string
  type: string
  status: 'idle' | 'scanning' | 'analyzing' | 'generating' | 'completed' | 'error'
  capabilities: string[]
  mcpTools: MCPTool[]
  lastActivity: Date
  metrics: {
    entitiesProcessed: number
    opportunitiesFound: number
    errors: number
    processingTimeMs: number
    mcpCalls: number
  }
}

// Enhanced A2A System with MCP Integration
export class MCPEnabledA2ASystem extends EventEmitter {
  private claudeSDK: ClaudeAgentSDKService
  private agents: Map<string, MCPEnabledAgent> = new Map()
  private mcpSessions = new Map<string, string>() // agentId -> sessionId

  constructor() {
    super()
    this.claudeSDK = new ClaudeAgentSDKService()
    this.initializeMCPEnabledAgents()
  }

  private initializeMCPEnabledAgents() {
    // LinkedIn Scanner with BrightData MCP
    const linkedinScanner: MCPEnabledAgent = {
      id: 'linkedin-scanner-mcp-001',
      name: 'LinkedIn Scanner (MCP)',
      type: 'linkedin_scanner',
      status: 'idle',
      capabilities: ['linkedin_search', 'job_posting_analysis', 'company_monitoring', 'keyword_tracking'],
      mcpTools: [
        {
          name: 'search_engine',
          description: 'Search LinkedIn for RFP opportunities using BrightData',
          server: 'brightdata-mcp',
          parameters: { engine: 'linkedin', keywords: ['RFP', 'tender', 'procurement'] }
        },
        {
          name: 'scrape_as_markdown',
          description: 'Scrape LinkedIn company profiles and job postings',
          server: 'brightdata-mcp',
          parameters: { include_metadata: true }
        }
      ],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0,
        mcpCalls: 0
      }
    }

    // Neo4j Analyzer with Neo4j MCP
    const neo4jAnalyzer: MCPEnabledAgent = {
      id: 'neo4j-analyzer-mcp-001',
      name: 'Neo4j Analyzer (MCP)',
      type: 'neo4j_analyzer',
      status: 'idle',
      capabilities: ['relationship_mapping', 'entity_analysis', 'pattern_recognition', 'network_analysis'],
      mcpTools: [
        {
          name: 'execute_query',
          description: 'Query Neo4j for entity relationships and patterns',
          server: 'neo4j-mcp',
          parameters: { query_type: 'relationship_analysis' }
        },
        {
          name: 'create_node',
          description: 'Create discovered opportunity nodes in Neo4j',
          server: 'neo4j-mcp',
          parameters: { labels: ['Opportunity', 'RFP'] }
        },
        {
          name: 'create_relationship',
          description: 'Create relationships between entities and opportunities',
          server: 'neo4j-mcp',
          parameters: { type: 'HAS_OPPORTUNITY' }
        }
      ],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0,
        mcpCalls: 0
      }
    }

    // Entity Pattern Matcher with Supabase MCP
    const entityMatcher: MCPEnabledAgent = {
      id: 'entity-matcher-mcp-001',
      name: 'Entity Pattern Matcher (MCP)',
      type: 'entity_matcher',
      capabilities: ['pattern_matching', 'similarity_scoring', 'opportunity_prediction', 'entity_enrichment'],
      mcpTools: [
        {
          name: 'search_docs',
          description: 'Search cached_entities for opportunity patterns',
          server: 'supabase-mcp',
          parameters: { table: 'cached_entities', search_mode: 'pattern' }
        },
        {
          name: 'get_file',
          description: 'Retrieve entity enrichment data',
          server: 'supabase-mcp',
          parameters: { bucket: 'entity-data' }
        }
      ],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0,
        mcpCalls: 0
      }
    }

    // Opportunity Generator with Byterover MCP
    const opportunityGenerator: MCPEnabledAgent = {
      id: 'opportunity-generator-mcp-001',
      name: 'Opportunity Generator (MCP)',
      type: 'opportunity_generator',
      capabilities: ['opportunity_creation', 'value_estimation', 'priority_scoring', 'recommendation_generation'],
      mcpTools: [
        {
          name: 'chat_completion',
          description: 'Generate AI-powered opportunity analysis',
          server: 'byterover-mcp',
          parameters: { model: 'sonar-pro', prompt_template: 'technical_docs' }
        }
      ],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0,
        mcpCalls: 0
      }
    }

    // Register agents
    this.agents.set(linkedinScanner.id, linkedinScanner)
    this.agents.set(neo4jAnalyzer.id, neo4jAnalyzer)
    this.agents.set(entityMatcher.id, entityMatcher)
    this.agents.set(opportunityGenerator.id, opportunityGenerator)
  }

  // Start MCP-enabled discovery
  async startMCPDiscovery(entities: any[]) {
    console.log('🚀 Starting MCP-enabled A2A Discovery...')
    
    // Create Claude session for each agent
    for (const [agentId, agent] of this.agents) {
      const sessionId = `a2a-${agentId}-${Date.now()}`
      this.mcpSessions.set(agentId, sessionId)
      
      // Initialize Claude stream with MCP tools
      const stream = await this.claudeSDK.createStream({
        sessionId,
        systemPrompt: this.getAgentSystemPrompt(agent),
        allowedTools: agent.mcpTools.map(tool => tool.name),
        maxTurns: 10
      })

      // Process entities with MCP tools
      this.processEntitiesWithMCP(agent, entities, sessionId, stream)
    }
  }

  private getAgentSystemPrompt(agent: MCPEnabledAgent): string {
    return `You are ${agent.name}, an AI agent specialized in ${agent.capabilities.join(', ')}. 

Your available MCP tools:
${agent.mcpTools.map(tool => `- ${tool.name}: ${tool.description} (${tool.server})`).join('\n')}

Your task is to analyze entities and discover RFP opportunities using these MCP tools. 

Process:
1. Use appropriate MCP tools to gather intelligence
2. Analyze findings for RFP signals
3. Generate structured opportunity data
4. Report discoveries in JSON format

Focus on sports industry entities: clubs, leagues, venues, and organizations.`
  }

  private async processEntitiesWithMCP(agent: MCPEnabledAgent, entities: any[], sessionId: string, stream: ReadableStream) {
    agent.status = 'scanning'
    agent.lastActivity = new Date()
    
    const startTime = Date.now()
    const opportunities = []

    try {
      for (const entity of entities) {
        const prompt = this.buildEntityPrompt(agent, entity)
        
        // Send to Claude with MCP tools
        await this.claudeSDK.processMessage(sessionId, prompt)
        
        // Listen for MCP tool responses
        const results = await this.listenForMCPResponses(stream)
        
        // Process results and create opportunities
        const entityOpportunities = this.processMCPResults(agent, entity, results)
        opportunities.push(...entityOpportunities)
        
        agent.metrics.entitiesProcessed++
        agent.metrics.mcpCalls += results.length
      }

      agent.metrics.opportunitiesFound = opportunities.length
      agent.metrics.processingTimeMs = Date.now() - startTime
      agent.status = 'completed'

      // Emit discovered opportunities
      this.emit('mcpOpportunitiesDiscovered', {
        agent: agent.name,
        opportunities
      })

    } catch (error) {
      console.error(`❌ MCP Agent ${agent.name} failed:`, error)
      agent.status = 'error'
      agent.metrics.errors++
    }
  }

  private buildEntityPrompt(agent: MCPEnabledAgent, entity: any): string {
    return `Analyze this sports entity for RFP opportunities:

Entity: ${entity.properties.name}
Type: ${entity.properties.type}
Sport: ${entity.properties.sport}
Website: ${entity.properties.website}
Description: ${entity.properties.description || 'No description available'}

Available MCP tools: ${agent.mcpTools.map(t => t.name).join(', ')}

Use your MCP tools to:
1. Search for recent procurement signals
2. Analyze entity relationships and partnerships  
3. Identify technology needs and digital transformation opportunities
4. Look for sponsorship and partnership possibilities

Return findings as JSON opportunities with: title, description, source, fitScore, priority, estimatedValue, evidenceLinks`
  }

  private async listenForMCPResponses(stream: ReadableStream): Promise<any[]> {
    return new Promise((resolve) => {
      const responses: any[] = []
      const reader = stream.getReader()
      
      const processStream = async () => {
        const { done, value } = await reader.read()
        
        if (done) {
          resolve(responses)
          return
        }
        
        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'tool' || data.type === 'result') {
                responses.push(data)
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
        
        processStream()
      }
      
      processStream()
    })
  }

  private processMCPResults(agent: MCPEnabledAgent, entity: any, mcpResults: any[]): DiscoveredRFP[] {
    const opportunities: DiscoveredRFP[] = []
    
    for (const result of mcpResults) {
      if (result.data?.type === 'tool_result') {
        // Extract opportunity data from MCP tool results
        const toolResult = result.data.result
        
        if (this.isOpportunityData(toolResult)) {
          opportunities.push({
            id: `mcp-${agent.id}-${entity.id}-${Date.now()}`,
            title: toolResult.title || 'Opportunity Detected',
            description: toolResult.description || 'MCP-discovered opportunity',
            source: 'mcp',
            sourceUrl: toolResult.url || entity.properties.website,
            entity,
            fitScore: toolResult.fitScore || 75,
            priority: this.determinePriority(toolResult),
            discoveredAt: new Date(),
            keywords: toolResult.keywords || [],
            category: this.categorizeOpportunity(toolResult),
            estimatedValue: toolResult.estimatedValue,
            deadline: toolResult.deadline,
            relatedEntities: [entity],
            evidenceLinks: toolResult.evidenceLinks || []
          })
        }
      }
    }
    
    return opportunities
  }

  private isOpportunityData(data: any): boolean {
    return data && (
      data.title?.includes('RFP') ||
      data.title?.includes('tender') ||
      data.title?.includes('procurement') ||
      data.category === 'TECHNOLOGY' ||
      data.category === 'PARTNERSHIP'
    )
  }

  private determinePriority(data: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    const score = data.fitScore || 75
    if (score >= 90) return 'HIGH'
    if (score >= 80) return 'MEDIUM'
    return 'LOW'
  }

  private categorizeOpportunity(data: any): string {
    if (data.category) return data.category
    
    const title = (data.title || '').toLowerCase()
    if (title.includes('digital') || title.includes('technology')) return 'TECHNOLOGY'
    if (title.includes('partnership') || title.includes('sponsorship')) return 'PARTNERSHIP'
    if (title.includes('rfp') || title.includes('tender')) return 'RFP'
    
    return 'OPPORTUNITY'
  }

  // Get system status
  getMCPSystemStatus() {
    return {
      isRunning: Array.from(this.agents.values()).some(agent => agent.status !== 'idle'),
      agents: Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        capabilities: agent.capabilities,
        mcpTools: agent.mcpTools.length,
        lastActivity: agent.lastActivity,
        metrics: agent.metrics
      })),
      mcpSessions: this.mcpSessions.size,
      totalMCPCalls: Array.from(this.agents.values()).reduce((sum, agent) => sum + agent.metrics.mcpCalls, 0)
    }
  }

  // Stop all MCP agents
  async stopMCPDiscovery() {
    console.log('🛑 Stopping MCP-enabled A2A Discovery...')
    
    for (const [agentId, sessionId] of this.mcpSessions) {
      // Close Claude sessions
      this.mcpSessions.delete(agentId)
    }
    
    for (const agent of this.agents.values()) {
      agent.status = 'idle'
    }
    
    this.emit('mcpDiscoveryStopped')
  }
}

export { MCPEnabledAgent, MCPTool }