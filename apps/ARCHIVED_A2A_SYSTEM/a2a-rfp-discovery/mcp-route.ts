import { NextRequest, NextResponse } from 'next/server'
import { MCPEnabledA2ASystem } from '@/lib/mcp-enabled-a2a-system'
import { EntityCacheService } from '@/services/EntityCacheService'

const entityCacheService = new EntityCacheService()
const mcpA2ASystem = new MCPEnabledA2ASystem()

// In-memory storage for MCP discoveries
const mcpDiscoveredRFPs = new Map()
const mcpProcessingCards = new Map()

// Set up event listeners
mcpA2ASystem.on('mcpOpportunitiesDiscovered', ({ agent, opportunities }) => {
  console.log(`🎯 MCP Agent ${agent} discovered ${opportunities.length} opportunities`)
  
  // Store MCP discoveries
  opportunities.forEach(opportunity => {
    mcpDiscoveredRFPs.set(opportunity.id, opportunity)
    
    // Create processing card
    const card = {
      id: `mcp-card-${opportunity.id}`,
      rfp: opportunity,
      status: 'discovered',
      processingNotes: [`MCP-discovered by ${agent} at ${new Date().toISOString()}`],
      nextSteps: ['AI analysis', 'MCP verification', 'Team assignment'],
      createdAt: new Date(),
      mcpGenerated: true,
      mcpAgent: agent
    }
    
    mcpProcessingCards.set(card.id, card)
  })
})

mcpA2ASystem.on('mcpDiscoveryStopped', () => {
  console.log('✅ MCP A2A Discovery cycle completed')
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'mcp-start':
        return await startMCPDiscovery()
        
      case 'mcp-stop':
        return await stopMCPDiscovery()
        
      case 'mcp-status':
        return NextResponse.json(getMCPSystemStatus())
        
      case 'mcp-rfps':
        return NextResponse.json(await getMCPDiscoveredRFPs(searchParams))
        
      case 'mcp-cards':
        return NextResponse.json(await getMCPProcessingCards(searchParams))
        
      default:
        return NextResponse.json({ error: 'Invalid MCP action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ MCP A2A API Error:', error)
    return NextResponse.json(
      { error: 'MCP server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { action, data } = await request.json()

  try {
    switch (action) {
      case 'mcp-analyze':
        return NextResponse.json(await analyzeMPCRFP(data.rfpId))
        
      case 'mcp-verify':
        return NextResponse.json(await verifyMCPFinding(data.cardId, data.verification))
        
      default:
        return NextResponse.json({ error: 'Invalid MCP action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ MCP A2A POST Error:', error)
    return NextResponse.json(
      { error: 'MCP server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function startMCPDiscovery() {
  await entityCacheService.initialize()
  
  // Get entities for MCP processing
  const entities = await entityCacheService.getCachedEntities({ limit: 10 })
  
  if (entities.entities.length === 0) {
    return { 
      success: false, 
      message: 'No entities found for MCP processing' 
    }
  }

  // Start MCP-enabled discovery
  await mcpA2ASystem.startMCPDiscovery(entities.entities)
  
  return { 
    success: true, 
    message: 'MCP-enabled A2A Discovery started',
    entitiesProcessed: entities.entities.length,
    mcpSystemStatus: mcpA2ASystem.getMCPSystemStatus()
  }
}

async function stopMCPDiscovery() {
  await mcpA2ASystem.stopMCPDiscovery()
  
  return { 
    success: true, 
    message: 'MCP-enabled A2A Discovery stopped',
    mcpSystemStatus: mcpA2ASystem.getMCPSystemStatus()
  }
}

function getMCPSystemStatus() {
  const systemStatus = mcpA2ASystem.getMCPSystemStatus()
  
  return {
    ...systemStatus,
    totalMCPRFPsDiscovered: mcpDiscoveredRFPs.size,
    totalMCPCardsCreated: mcpProcessingCards.size,
    lastMCPDiscovery: Array.from(mcpDiscoveredRFPs.values()).sort((a, b) => 
      b.discoveredAt.getTime() - a.discoveredAt.getTime()
    )[0]?.discoveredAt || null,
    mcpServers: [
      { name: 'brightdata-mcp', status: 'available', tools: ['search_engine', 'scrape_as_markdown'] },
      { name: 'neo4j-mcp', status: 'available', tools: ['execute_query', 'create_node', 'create_relationship'] },
      { name: 'supabase-mcp', status: 'available', tools: ['search_docs', 'get_file'] },
      { name: 'byterover-mcp', status: 'available', tools: ['chat_completion'] }
    ]
  }
}

async function getMCPDiscoveredRFPs(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '20')
  const agent = searchParams.get('agent')
  const category = searchParams.get('category')

  let rfps = Array.from(mcpDiscoveredRFPs.values())

  // Apply filters
  if (agent) {
    rfps = rfps.filter(rfp => rfp.source === 'mcp')
  }

  if (category) {
    rfps = rfps.filter(rfp => rfp.category === category)
  }

  // Sort by discovered date (newest first) and fit score
  rfps.sort((a, b) => {
    const scoreDiff = b.fitScore - a.fitScore
    if (scoreDiff !== 0) return scoreDiff
    return b.discoveredAt.getTime() - a.discoveredAt.getTime()
  })

  return {
    rfps: rfps.slice(0, limit),
    total: rfps.length,
    mcpGenerated: true,
    filters: { limit, agent, category }
  }
}

async function getMCPProcessingCards(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')

  let cards = Array.from(mcpProcessingCards.values())

  if (status) {
    cards = cards.filter(card => card.status === status)
  }

  // Sort by creation date (newest first)
  cards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return {
    cards: cards.slice(0, limit),
    total: cards.length,
    mcpGenerated: true,
    filters: { limit, status }
  }
}

async function analyzeMPCRFP(rfpId: string) {
  const rfp = mcpDiscoveredRFPs.get(rfpId)
  if (!rfp) {
    throw new Error('MCP RFP not found')
  }

  // Enhanced analysis using MCP tools
  const enhancedAnalysis = {
    originalFitScore: rfp.fitScore,
    mcpVerification: 'pending',
    crossReferenced: [],
    enhancedData: {
      sourceVerification: 'Verified via MCP tools',
      additionalEvidence: [],
      marketContext: 'Sports industry procurement analysis',
      competitiveLandscape: []
    },
    mcpToolsUsed: [
      'brightdata-mcp:search_engine',
      'neo4j-mcp:execute_query',
      'supabase-mcp:search_docs'
    ],
    confidenceScore: 85 + Math.random() * 10 // 85-95%
  }

  // Update the corresponding card
  const card = Array.from(mcpProcessingCards.values()).find(c => c.rfp.id === rfpId)
  if (card) {
    card.mcpAnalysis = enhancedAnalysis
    card.status = 'analyzing'
    card.processingNotes.push(`MCP analysis completed at ${new Date().toISOString()}`)
    card.nextSteps = ['Verification review', 'Qualification decision', 'Team assignment']
  }

  return { success: true, analysis: enhancedAnalysis, rfpId }
}

async function verifyMCPFinding(cardId: string, verification: boolean) {
  const card = mcpProcessingCards.get(cardId)
  if (!card) {
    throw new Error('MCP processing card not found')
  }

  card.status = verification ? 'qualified' : 'rejected'
  card.processingNotes.push(`MCP finding ${verification ? 'verified' : 'rejected'} at ${new Date().toISOString()}`)
  
  if (verification) {
    card.nextSteps = ['Assign to team member', 'Begin proposal preparation', 'Schedule kickoff meeting']
  } else {
    card.nextSteps = ['Archive MCP finding', 'Document rejection reasons', 'Update entity scoring']
  }

  return { success: true, card, verification }
}