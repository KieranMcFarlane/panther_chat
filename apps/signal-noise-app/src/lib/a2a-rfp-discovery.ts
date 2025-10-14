import { EventEmitter } from 'events'
import { Neo4jService } from '@/lib/neo4j'
import { createClient } from '@supabase/supabase-js'
import { EntityCacheService, CachedEntity } from '@/services/EntityCacheService'

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export interface RFPDiscoveryAgent extends EventEmitter {
  id: string
  name: string
  type: 'linkedin_scanner' | 'neo4j_analyzer' | 'entity_matcher' | 'opportunity_generator'
  status: 'idle' | 'scanning' | 'analyzing' | 'generating' | 'completed' | 'error'
  capabilities: string[]
  lastActivity: Date
  metrics: {
    entitiesProcessed: number
    opportunitiesFound: number
    errors: number
    processingTimeMs: number
  }
}

export interface DiscoveredRFP {
  id: string
  title: string
  description: string
  source: string
  sourceUrl: string
  entity: CachedEntity
  fitScore: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  discoveredAt: Date
  keywords: string[]
  estimatedValue?: string
  deadline?: string
  category: 'RFP' | 'TENDER' | 'PARTNERSHIP' | 'SPONSORSHIP' | 'TECHNOLOGY' | 'CONSULTING'
  relatedEntities: CachedEntity[]
  evidenceLinks: Array<{
    title: string
    url: string
    type: 'news' | 'press_release' | 'job_posting' | 'procurement' | 'social_media'
    confidence: number
  }>
}

export interface RFPDiscoveryCard {
  id: string
  rfp: DiscoveredRFP
  status: 'discovered' | 'analyzing' | 'qualified' | 'rejected'
  processingNotes: string[]
  aiAnalysis?: {
    fitScore: number
    feasibilityScore: number
    marketFit: string
    recommendedActions: string[]
    risks: string[]
    opportunities: string[]
  }
  nextSteps: string[]
  assignedTo?: string
  createdAt: Date
}

// Main A2A RFP Discovery System
export class A2ARFPDiscoverySystem extends EventEmitter {
  private agents: Map<string, RFPDiscoveryAgent> = new Map()
  private neo4jService: Neo4jService
  private entityCacheService: EntityCacheService
  private discoveryInterval: NodeJS.Timeout | null = null
  private isRunning = false

  constructor() {
    super()
    this.neo4jService = new Neo4jService()
    this.entityCacheService = new EntityCacheService()
    this.initializeAgents()
  }

  private initializeAgents() {
    // LinkedIn Scanner Agent
    const linkedinScanner: RFPDiscoveryAgent = {
      id: 'linkedin-scanner-001',
      name: 'LinkedIn Opportunity Scanner',
      type: 'linkedin_scanner',
      status: 'idle',
      capabilities: ['linkedin_search', 'job_posting_analysis', 'company_monitoring', 'keyword_tracking'],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0
      }
    }

    // Neo4j Analyzer Agent
    const neo4jAnalyzer: RFPDiscoveryAgent = {
      id: 'neo4j-analyzer-001',
      name: 'Neo4j Relationship Analyzer',
      type: 'neo4j_analyzer',
      status: 'idle',
      capabilities: ['relationship_mapping', 'entity_analysis', 'pattern_recognition', 'network_analysis'],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0
      }
    }

    // Entity Matcher Agent
    const entityMatcher: RFPDiscoveryAgent = {
      id: 'entity-matcher-001',
      name: 'Entity Pattern Matcher',
      type: 'entity_matcher',
      status: 'idle',
      capabilities: ['pattern_matching', 'similarity_scoring', 'opportunity_prediction', 'entity_enrichment'],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0
      }
    }

    // Opportunity Generator Agent
    const opportunityGenerator: RFPDiscoveryAgent = {
      id: 'opportunity-generator-001',
      name: 'Opportunity Generator',
      type: 'opportunity_generator',
      status: 'idle',
      capabilities: ['opportunity_creation', 'value_estimation', 'priority_scoring', 'recommendation_generation'],
      lastActivity: new Date(),
      metrics: {
        entitiesProcessed: 0,
        opportunitiesFound: 0,
        errors: 0,
        processingTimeMs: 0
      }
    }

    this.agents.set(linkedinScanner.id, linkedinScanner)
    this.agents.set(neo4jAnalyzer.id, neo4jAnalyzer)
    this.agents.set(entityMatcher.id, entityMatcher)
    this.agents.set(opportunityGenerator.id, opportunityGenerator)

    // Set up agent event listeners
    this.agents.forEach(agent => {
      this.setupAgentEventListeners(agent)
    })
  }

  private setupAgentEventListeners(agent: RFPDiscoveryAgent) {
    // Agent status changes
    this.on(`agent:${agent.id}:status`, (newStatus: string) => {
      agent.status = newStatus as any
      agent.lastActivity = new Date()
      this.emit('agentStatusUpdate', { agent, status: newStatus })
    })

    // Agent metrics updates
    this.on(`agent:${agent.id}:metrics`, (metrics: any) => {
      agent.metrics = { ...agent.metrics, ...metrics }
      this.emit('agentMetricsUpdate', { agent, metrics })
    })

    // RFP discovery events
    this.on(`agent:${agent.id}:rfp_discovered`, (rfp: DiscoveredRFP) => {
      this.emit('rfpDiscovered', { agent, rfp })
    })

    // Error events
    this.on(`agent:${agent.id}:error`, (error: Error) => {
      agent.metrics.errors++
      this.emit('agentError', { agent, error })
    })
  }

  async startDiscovery(intervalMinutes: number = 15) {
    if (this.isRunning) {
      console.log('🔄 RFP Discovery system already running')
      return
    }

    console.log(`🚀 Starting A2A RFP Discovery System (${intervalMinutes}min intervals)`)
    this.isRunning = true

    // Initialize services
    await this.entityCacheService.initialize()

    // Run initial discovery
    await this.runDiscoveryCycle()

    // Set up recurring discovery
    this.discoveryInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runDiscoveryCycle()
      }
    }, intervalMinutes * 60 * 1000)

    this.emit('systemStarted')
  }

  async stopDiscovery() {
    console.log('🛑 Stopping A2A RFP Discovery System')
    this.isRunning = false

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval)
      this.discoveryInterval = null
    }

    this.emit('systemStopped')
  }

  private async runDiscoveryCycle() {
    console.log('🔄 Starting RFP Discovery Cycle')
    
    try {
      // Step 1: Get all cached entities from Supabase
      const entities = await this.getCachedEntitiesForDiscovery()
      console.log(`📊 Processing ${entities.length} entities for RFP opportunities`)

      // Step 2: LinkedIn Scanner Agent
      await this.runLinkedInScanner(entities)

      // Step 3: Neo4j Analyzer Agent  
      await this.runNeo4jAnalyzer(entities)

      // Step 4: Entity Matcher Agent
      await this.runEntityMatcher(entities)

      // Step 5: Opportunity Generator Agent
      await this.runOpportunityGenerator(entities)

      console.log('✅ RFP Discovery Cycle completed')
      this.emit('discoveryCycleCompleted')

    } catch (error) {
      console.error('❌ RFP Discovery Cycle failed:', error)
      this.emit('discoveryCycleError', error)
    }
  }

  private async getCachedEntitiesForDiscovery(): Promise<CachedEntity[]> {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('*')
      .or('labels.cs.{Club,Organization,League,Partner}')
      .order('properties->>opportunity_score', { ascending: false })
      .limit(50) // Process top 50 entities by opportunity score

    if (error) {
      throw new Error(`Failed to fetch cached entities: ${error.message}`)
    }

    return data?.map(entity => ({
      id: entity.neo4j_id,
      neo4j_id: entity.neo4j_id,
      labels: entity.labels,
      properties: entity.properties
    })) || []
  }

  private async runLinkedInScanner(entities: CachedEntity[]) {
    const agent = this.agents.get('linkedin-scanner-001')!
    this.updateAgentStatus(agent, 'scanning')

    const startTime = Date.now()
    let opportunitiesFound = 0

    try {
      for (const entity of entities) {
        // Search for RFP-related content on LinkedIn
        const rfpKeywords = [
          'request for proposal', 'RFP', 'tender', 'procurement', 
          'bidding', 'contract opportunity', 'vendor', 'supplier',
          'service provider', 'consulting services', 'technology partnership'
        ]

        const entityName = entity.properties.name || ''
        const entityIndustry = entity.properties.industry || ''
        const entitySport = entity.properties.sport || ''

        // Build search queries for each entity
        const searchQueries = [
          `${entityName} ${rfpKeywords.join(' OR ')}`,
          `${entityIndustry} ${rfpKeywords.join(' OR ')}`,
          `${entitySport} ${rfpKeywords.join(' OR ')}`,
          `${entityName} seeking vendors`,
          `${entityName} technology partners`,
          `${entityName} consulting opportunities`
        ]

        for (const query of searchQueries) {
          const discoveredRFPs = await this.searchLinkedInForRFPs(query, entity)
          
          for (const rfp of discoveredRFPs) {
            this.emit(`agent:${agent.id}:rfp_discovered`, rfp)
            opportunitiesFound++
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        agent.metrics.entitiesProcessed++
      }

      const processingTime = Date.now() - startTime
      this.updateAgentMetrics(agent, { 
        opportunitiesFound, 
        processingTimeMs: agent.metrics.processingTimeMs + processingTime 
      })
      this.updateAgentStatus(agent, 'completed')

    } catch (error) {
      this.emit(`agent:${agent.id}:error`, error)
      this.updateAgentStatus(agent, 'error')
    }
  }

  private async runNeo4jAnalyzer(entities: CachedEntity[]) {
    const agent = this.agents.get('neo4j-analyzer-001')!
    this.updateAgentStatus(agent, 'analyzing')

    const startTime = Date.now()
    let opportunitiesFound = 0

    try {
      const session = await this.neo4jService.getDriver().session()

      for (const entity of entities) {
        // Analyze entity relationships for RFP indicators
        const relationshipQuery = `
          MATCH (e {neo4j_id: $neo4jId})-[r]-(related)
          WHERE related.type IN ['Opportunity', 'Tender', 'Partnership']
          RETURN e, r, related, 
                 type(r) as relationshipType,
                 properties(r) as relationshipProperties
        `

        const result = await session.run(relationshipQuery, { neo4jId: entity.neo4j_id })

        for (const record of result.records) {
          const relatedEntity = record.get('related')
          const relationshipType = record.get('relationshipType')
          
          // Create RFP opportunity from relationship
          const rfp: DiscoveredRFP = {
            id: `neo4j-${entity.neo4j_id}-${Date.now()}`,
            title: `Opportunity: ${relatedEntity.properties.title || 'Untitled'}`,
            description: relatedEntity.properties.description || `Discovered through ${relationshipType} relationship`,
            source: 'neo4j',
            sourceUrl: relatedEntity.properties.sourceUrl || '',
            entity,
            fitScore: this.calculateFitScore(entity, relatedEntity.properties),
            priority: this.determinePriority(relatedEntity.properties),
            discoveredAt: new Date(),
            keywords: this.extractKeywords(relatedEntity.properties),
            estimatedValue: relatedEntity.properties.estimatedValue,
            deadline: relatedEntity.properties.deadline,
            category: relatedEntity.properties.category || 'PARTNERSHIP',
            relatedEntities: [entity],
            evidenceLinks: [{
              title: 'Neo4j Relationship',
              url: relatedEntity.properties.sourceUrl || '',
              type: 'procurement',
              confidence: 0.8
            }]
          }

          this.emit(`agent:${agent.id}:rfp_discovered`, rfp)
          opportunitiesFound++
        }

        agent.metrics.entitiesProcessed++
      }

      await session.close()

      const processingTime = Date.now() - startTime
      this.updateAgentMetrics(agent, { 
        opportunitiesFound, 
        processingTimeMs: agent.metrics.processingTimeMs + processingTime 
      })
      this.updateAgentStatus(agent, 'completed')

    } catch (error) {
      this.emit(`agent:${agent.id}:error`, error)
      this.updateAgentStatus(agent, 'error')
    }
  }

  private async runEntityMatcher(entities: CachedEntity[]) {
    const agent = this.agents.get('entity-matcher-001')!
    this.updateAgentStatus(agent, 'analyzing')

    const startTime = Date.now()
    let opportunitiesFound = 0

    try {
      // Look for patterns that indicate RFP opportunities
      const rfpPatterns = [
        { pattern: /technology.*upgrade/gi, category: 'TECHNOLOGY' },
        { pattern: /digital.*transformation/gi, category: 'CONSULTING' },
        { pattern: /stadium.*renovation/gi, category: 'PARTNERSHIP' },
        { pattern: /sponsorship.*deal/gi, category: 'SPONSORSHIP' },
        { pattern: /seeking.*partners/gi, category: 'PARTNERSHIP' },
        { pattern: /vendor.*procurement/gi, category: 'RFP' },
        { pattern: /consulting.*services/gi, category: 'CONSULTING' }
      ]

      for (const entity of entities) {
        const props = entity.properties
        const searchText = [
          props.description || '',
          props.notes || '',
          props.recent_initiatives?.join(' ') || '',
          props.current_tech_stack?.join(' ') || ''
        ].join(' ').toLowerCase()

        for (const pattern of rfpPatterns) {
          if (pattern.pattern.test(searchText)) {
            const rfp: DiscoveredRFP = {
              id: `pattern-${entity.neo4j_id}-${Date.now()}`,
              title: `Potential ${pattern.category} Opportunity: ${props.name}`,
              description: `Pattern detected: ${pattern.pattern.source} in entity data`,
              source: 'pattern_analysis',
              sourceUrl: props.website || props.linkedin_url || '',
              entity,
              fitScore: this.calculatePatternFitScore(entity, pattern),
              priority: this.determinePriorityFromPattern(pattern),
              discoveredAt: new Date(),
              keywords: [pattern.pattern.source, props.type, props.sport, props.industry].filter(Boolean),
              category: pattern.category as any,
              relatedEntities: [entity],
              evidenceLinks: [{
                title: 'Pattern Match',
                url: props.website || '',
                type: 'news',
                confidence: 0.7
              }]
            }

            this.emit(`agent:${agent.id}:rfp_discovered`, rfp)
            opportunitiesFound++
          }
        }

        agent.metrics.entitiesProcessed++
      }

      const processingTime = Date.now() - startTime
      this.updateAgentMetrics(agent, { 
        opportunitiesFound, 
        processingTimeMs: agent.metrics.processingTimeMs + processingTime 
      })
      this.updateAgentStatus(agent, 'completed')

    } catch (error) {
      this.emit(`agent:${agent.id}:error`, error)
      this.updateAgentStatus(agent, 'error')
    }
  }

  private async runOpportunityGenerator(entities: CachedEntity[]) {
    const agent = this.agents.get('opportunity-generator-001')!
    this.updateAgentStatus(agent, 'generating')

    const startTime = Date.now()
    let opportunitiesFound = 0

    try {
      // Generate proactive opportunities based on entity characteristics
      for (const entity of entities) {
        const props = entity.properties
        const opportunityScore = props.opportunity_score || 0

        if (opportunityScore > 60) { // Only generate for high-opportunity entities
          // Generate technology opportunities
          if (props.digital_maturity === 'LOW' || props.digital_maturity === 'MEDIUM') {
            const rfp: DiscoveredRFP = {
              id: `generated-tech-${entity.neo4j_id}-${Date.now()}`,
              title: `Digital Transformation Opportunity: ${props.name}`,
              description: `Entity with low/medium digital maturity and high opportunity score (${opportunityScore}) likely needs technology consulting services`,
              source: 'proactive_generation',
              sourceUrl: props.website || '',
              entity,
              fitScore: Math.min(opportunityScore + 10, 100),
              priority: opportunityScore > 80 ? 'HIGH' : 'MEDIUM',
              discoveredAt: new Date(),
              keywords: ['digital transformation', 'technology consulting', props.sport, props.type],
              category: 'CONSULTING',
              estimatedValue: this.estimateValue(props, 'CONSULTING'),
              relatedEntities: [entity],
              evidenceLinks: [{
                title: 'Opportunity Analysis',
                url: props.website || '',
                type: 'press_release',
                confidence: 0.6
              }]
            }

            this.emit(`agent:${agent.id}:rfp_discovered`, rfp)
            opportunitiesFound++
          }

          // Generate partnership opportunities for high-value entities
          if (props.estimated_value && parseInt(props.estimated_value.replace(/[^0-9]/g, '')) > 1000000) {
            const rfp: DiscoveredRFP = {
              id: `generated-partnership-${entity.neo4j_id}-${Date.now()}`,
              title: `Strategic Partnership Opportunity: ${props.name}`,
              description: `High-value entity ($${props.estimated_value}) seeking strategic partnerships for growth initiatives`,
              source: 'proactive_generation',
              sourceUrl: props.website || '',
              entity,
              fitScore: Math.min(opportunityScore + 15, 100),
              priority: 'HIGH',
              discoveredAt: new Date(),
              keywords: ['strategic partnership', 'growth initiative', props.sport, props.type],
              category: 'PARTNERSHIP',
              estimatedValue: this.estimateValue(props, 'PARTNERSHIP'),
              relatedEntities: [entity],
              evidenceLinks: [{
                title: 'Value Analysis',
                url: props.website || '',
                type: 'news',
                confidence: 0.65
              }]
            }

            this.emit(`agent:${agent.id}:rfp_discovered`, rfp)
            opportunitiesFound++
          }
        }

        agent.metrics.entitiesProcessed++
      }

      const processingTime = Date.now() - startTime
      this.updateAgentMetrics(agent, { 
        opportunitiesFound, 
        processingTimeMs: agent.metrics.processingTimeMs + processingTime 
      })
      this.updateAgentStatus(agent, 'completed')

    } catch (error) {
      this.emit(`agent:${agent.id}:error`, error)
      this.updateAgentStatus(agent, 'error')
    }
  }

  // Helper methods
  private async searchLinkedInForRFPs(query: string, entity: CachedEntity): Promise<DiscoveredRFP[]> {
    // This would integrate with BrightData or LinkedIn API
    // For now, return mock data
    const rfps: DiscoveredRFP[] = []
    
    // Mock RFP discovery logic
    if (Math.random() > 0.8) { // 20% chance of finding RFP
      rfps.push({
        id: `linkedin-${entity.neo4j_id}-${Date.now()}`,
        title: `LinkedIn Discovered Opportunity: ${entity.properties.name}`,
        description: `RFP opportunity discovered through LinkedIn search: ${query}`,
        source: 'linkedin',
        sourceUrl: `https://linkedin.com/search?q=${encodeURIComponent(query)}`,
        entity,
        fitScore: 70 + Math.random() * 20,
        priority: 'MEDIUM',
        discoveredAt: new Date(),
        keywords: query.split(' '),
        category: 'RFP',
        relatedEntities: [entity],
        evidenceLinks: [{
          title: 'LinkedIn Search',
          url: `https://linkedin.com/search?q=${encodeURIComponent(query)}`,
          type: 'social_media',
          confidence: 0.75
        }]
      })
    }

    return rfps
  }

  private calculateFitScore(entity: CachedEntity, opportunity: any): number {
    let score = 50 // Base score

    // Boost based on entity opportunity score
    const entityOpportunityScore = entity.properties.opportunity_score || 0
    score += entityOpportunityScore * 0.3

    // Boost based on relationship strength
    if (opportunity.priority === 'HIGH') score += 20
    else if (opportunity.priority === 'MEDIUM') score += 10

    // Boost based on entity type
    if (entity.labels.includes('Club')) score += 10
    else if (entity.labels.includes('Organization')) score += 5

    return Math.min(Math.round(score), 100)
  }

  private determinePriority(opportunity: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (opportunity.urgency_level === 'CRITICAL' || opportunity.priority === 'HIGH') return 'HIGH'
    if (opportunity.urgency_level === 'HIGH' || opportunity.priority === 'MEDIUM') return 'MEDIUM'
    return 'LOW'
  }

  private extractKeywords(properties: any): string[] {
    const keywords = []
    
    if (properties.name) keywords.push(properties.name.toLowerCase())
    if (properties.type) keywords.push(properties.type.toLowerCase())
    if (properties.sport) keywords.push(properties.sport.toLowerCase())
    if (properties.industry) keywords.push(properties.industry.toLowerCase())
    if (properties.country) keywords.push(properties.country.toLowerCase())
    
    return keywords.filter((k, i, a) => a.indexOf(k) === i) // Remove duplicates
  }

  private calculatePatternFitScore(entity: CachedEntity, pattern: any): number {
    let score = 60 // Base pattern match score

    const opportunityScore = entity.properties.opportunity_score || 0
    score += opportunityScore * 0.2

    if (pattern.category === 'TECHNOLOGY' && entity.properties.digital_maturity === 'LOW') {
      score += 20
    }

    return Math.min(Math.round(score), 100)
  }

  private determinePriorityFromPattern(pattern: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (pattern.category === 'TECHNOLOGY' || pattern.category === 'RFP') return 'HIGH'
    if (pattern.category === 'CONSULTING' || pattern.category === 'PARTNERSHIP') return 'MEDIUM'
    return 'LOW'
  }

  private estimateValue(properties: any, category: string): string {
    const revenue = properties.revenue || properties.estimated_value || '0'
    const revenueNum = parseInt(revenue.replace(/[^0-9]/g, '')) || 0

    if (category === 'CONSULTING') {
      return `£${Math.round(revenueNum * 0.05)}-£${Math.round(revenueNum * 0.1)}`
    } else if (category === 'PARTNERSHIP') {
      return `£${Math.round(revenueNum * 0.1)}-£${Math.round(revenueNum * 0.2)}`
    } else if (category === 'TECHNOLOGY') {
      return `£${Math.round(revenueNum * 0.03)}-£${Math.round(revenueNum * 0.07)}`
    }

    return 'TBD'
  }

  private updateAgentStatus(agent: RFPDiscoveryAgent, status: RFPDiscoveryAgent['status']) {
    agent.status = status
    agent.lastActivity = new Date()
    this.emit(`agent:${agent.id}:status`, status)
  }

  private updateAgentMetrics(agent: RFPDiscoveryAgent, metrics: Partial<RFPDiscoveryAgent['metrics']>) {
    agent.metrics = { ...agent.metrics, ...metrics }
    this.emit(`agent:${agent.id}:metrics`, metrics)
  }

  // Public API methods
  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      agents: Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        capabilities: agent.capabilities,
        lastActivity: agent.lastActivity,
        metrics: agent.metrics
      })),
      uptime: this.isRunning ? Date.now() - (this as any).startTime : 0
    }
  }

  async getDiscoveredRFPs(options: {
    limit?: number
    entityIds?: string[]
    categories?: string[]
    priorities?: string[]
  } = {}) {
    const { limit = 50, entityIds, categories, priorities } = options

    // This would query from a discovered_opportunities table
    // For now, return mock data
    return {
      rfps: [],
      total: 0,
      filters: options
    }
  }
}

export const a2aRFPDiscoverySystem = new A2ARFPDiscoverySystem()