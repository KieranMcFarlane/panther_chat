import { NextRequest, NextResponse } from 'next/server'
import { a2aRFPDiscoverySystem, DiscoveredRFP, RFPDiscoveryCard } from '@/lib/a2a-rfp-discovery'
import { EntityCacheService } from '@/services/EntityCacheService'

const entityCacheService = new EntityCacheService()

// In-memory storage for discovered RFPs (in production, use Supabase)
const discoveredRFPs: Map<string, DiscoveredRFP> = new Map()
const rfpCards: Map<string, RFPDiscoveryCard> = new Map()

// Set up event listeners for the A2A system
a2aRFPDiscoverySystem.on('rfpDiscovered', ({ agent, rfp }: { agent: any, rfp: DiscoveredRFP }) => {
  console.log(`🎯 RFP Discovered by ${agent.name}: ${rfp.title}`)
  
  // Store the RFP
  discoveredRFPs.set(rfp.id, rfp)
  
  // Create a discovery card
  const card: RFPDiscoveryCard = {
    id: `card-${rfp.id}`,
    rfp,
    status: 'discovered',
    processingNotes: [`Discovered by ${agent.name} at ${new Date().toISOString()}`],
    nextSteps: ['Initial AI analysis', 'Fit scoring', 'Entity relationship mapping'],
    createdAt: new Date()
  }
  
  rfpCards.set(card.id, card)
})

a2aRFPDiscoverySystem.on('agentStatusUpdate', ({ agent, status }: { agent: any, status: string }) => {
  console.log(`🤖 Agent ${agent.name} status: ${status}`)
})

a2aRFPDiscoverySystem.on('discoveryCycleCompleted', () => {
  console.log('✅ RFP Discovery cycle completed')
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'start':
        await startDiscovery()
        break
        
      case 'stop':
        await stopDiscovery()
        break
        
      case 'status':
        return NextResponse.json(await getSystemStatus())
        
      case 'rfps':
        return NextResponse.json(await getDiscoveredRFPs(searchParams))
        
      case 'cards':
        return NextResponse.json(await getRFPCards(searchParams))
        
      case 'demo':
        return NextResponse.json(await generateDemoData())
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ A2A API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { action, data } = await request.json()

  try {
    switch (action) {
      case 'analyze':
        return NextResponse.json(await analyzeRFP(data.rfpId))
        
      case 'qualify':
        return NextResponse.json(await qualifyRFP(data.cardId, data.decision, data.notes))
        
      case 'assign':
        return NextResponse.json(await assignRFP(data.cardId, data.assignedTo))
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ A2A POST Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function startDiscovery() {
  await entityCacheService.initialize()
  await a2aRFPDiscoverySystem.startDiscovery(15) // Run every 15 minutes
  
  return { 
    success: true, 
    message: 'A2A RFP Discovery started',
    systemStatus: a2aRFPDiscoverySystem.getSystemStatus()
  }
}

async function stopDiscovery() {
  await a2aRFPDiscoverySystem.stopDiscovery()
  
  return { 
    success: true, 
    message: 'A2A RFP Discovery stopped',
    systemStatus: a2aRFPDiscoverySystem.getSystemStatus()
  }
}

async function getSystemStatus() {
  const systemStatus = a2aRFPDiscoverySystem.getSystemStatus()
  
  return {
    ...systemStatus,
    totalRFPsDiscovered: discoveredRFPs.size,
    totalCardsCreated: rfpCards.size,
    lastDiscovery: Array.from(discoveredRFPs.values()).sort((a, b) => 
      b.discoveredAt.getTime() - a.discoveredAt.getTime()
    )[0]?.discoveredAt || null
  }
}

async function getDiscoveredRFPs(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '20')
  const entityIds = searchParams.get('entityIds')?.split(',').filter(Boolean)
  const categories = searchParams.get('categories')?.split(',').filter(Boolean)
  const priorities = searchParams.get('priorities')?.split(',').filter(Boolean)

  let rfps = Array.from(discoveredRFPs.values())

  // Apply filters
  if (entityIds && entityIds.length > 0) {
    rfps = rfps.filter(rfp => entityIds.includes(rfp.entity.id))
  }

  if (categories && categories.length > 0) {
    rfps = rfps.filter(rfp => categories.includes(rfp.category))
  }

  if (priorities && priorities.length > 0) {
    rfps = rfps.filter(rfp => priorities.includes(rfp.priority))
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
    filters: { limit, entityIds, categories, priorities }
  }
}

async function getRFPCards(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')

  let cards = Array.from(rfpCards.values())

  if (status) {
    cards = cards.filter(card => card.status === status)
  }

  // Sort by creation date (newest first)
  cards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return {
    cards: cards.slice(0, limit),
    total: cards.length,
    filters: { limit, status }
  }
}

async function analyzeRFP(rfpId: string) {
  const rfp = discoveredRFPs.get(rfpId)
  if (!rfp) {
    throw new Error('RFP not found')
  }

  // Simulate AI analysis (in production, this would use Claude Agent SDK)
  const analysis = {
    fitScore: rfp.fitScore + (Math.random() * 10 - 5), // Add some variance
    feasibilityScore: 60 + Math.random() * 30,
    marketFit: `Strong market fit for ${rfp.entity.properties.sport || 'sports'} industry`,
    recommendedActions: [
      'Conduct detailed market research',
      'Identify key decision makers',
      'Prepare tailored proposal',
      'Leverage similar project experience'
    ],
    risks: [
      'Competitive bidding process',
      'Tight timeline requirements',
      'Price sensitivity'
    ],
    opportunities: [
      'Long-term partnership potential',
      'Expand service offerings',
      'Industry case study opportunity'
    ]
  }

  // Update the corresponding card
  const card = Array.from(rfpCards.values()).find(c => c.rfp.id === rfpId)
  if (card) {
    card.aiAnalysis = analysis
    card.status = 'analyzing'
    card.processingNotes.push(`AI analysis completed at ${new Date().toISOString()}`)
    card.nextSteps = ['Review AI analysis', 'Qualification decision', 'Assignment preparation']
  }

  return { success: true, analysis, rfpId }
}

async function qualifyRFP(cardId: string, decision: 'qualified' | 'rejected', notes: string) {
  const card = rfpCards.get(cardId)
  if (!card) {
    throw new Error('RFP card not found')
  }

  card.status = decision
  card.processingNotes.push(`Qualified as ${decision} at ${new Date().toISOString()}: ${notes}`)
  
  if (decision === 'qualified') {
    card.nextSteps = ['Assign to team member', 'Begin proposal preparation', 'Schedule kickoff meeting']
  } else {
    card.nextSteps = ['Archive opportunity', 'Document rejection reasons', 'Update entity scoring']
  }

  return { success: true, card }
}

async function assignRFP(cardId: string, assignedTo: string) {
  const card = rfpCards.get(cardId)
  if (!card) {
    throw new Error('RFP card not found')
  }

  card.assignedTo = assignedTo
  card.processingNotes.push(`Assigned to ${assignedTo} at ${new Date().toISOString()}`)
  card.nextSteps = ['Begin proposal development', 'Schedule discovery call', 'Prepare timeline']

  return { success: true, card }
}

async function generateDemoData() {
  // Initialize entity cache service
  await entityCacheService.initialize()
  
  // Get some sample entities
  const entities = await entityCacheService.getCachedEntities({ limit: 5 })
  
  if (entities.entities.length === 0) {
    return { 
      success: false, 
      message: 'No cached entities found. Please run entity sync first.' 
    }
  }

  // Generate demo RFPs for each entity
  for (const entity of entities.entities) {
    const demoRFPs: DiscoveredRFP[] = [
      {
        id: `demo-${entity.id}-${Date.now()}-1`,
        title: `Digital Transformation RFP: ${entity.properties.name}`,
        description: `${entity.properties.name} is seeking comprehensive digital transformation services including fan engagement platforms, data analytics, and operational efficiency improvements.`,
        source: 'demo',
        sourceUrl: entity.properties.website || `https://example.com/rfp/${entity.id}`,
        entity: {
          id: entity.id,
          neo4j_id: entity.neo4j_id,
          labels: entity.labels,
          properties: entity.properties
        },
        fitScore: 75 + Math.random() * 20,
        priority: 'HIGH',
        discoveredAt: new Date(),
        keywords: ['digital transformation', 'fan engagement', 'data analytics', 'sports technology'],
        category: 'TECHNOLOGY',
        estimatedValue: '£250,000 - £500,000',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        relatedEntities: [entity],
        evidenceLinks: [
          {
            title: 'Official RFP Document',
            url: entity.properties.website || '',
            type: 'procurement',
            confidence: 0.95
          },
          {
            title: 'Industry Analysis Report',
            url: 'https://example.com/analysis',
            type: 'news',
            confidence: 0.85
          }
        ]
      },
      {
        id: `demo-${entity.id}-${Date.now()}-2`,
        title: `Strategic Partnership Opportunity: ${entity.properties.name}`,
        description: `Partnership opportunity for technology services and strategic consulting with ${entity.properties.name}, focusing on long-term growth and innovation initiatives.`,
        source: 'demo',
        sourceUrl: entity.properties.linkedin_url || `https://linkedin.com/company/${entity.id}`,
        entity: {
          id: entity.id,
          neo4j_id: entity.neo4j_id,
          labels: entity.labels,
          properties: entity.properties
        },
        fitScore: 70 + Math.random() * 25,
        priority: 'MEDIUM',
        discoveredAt: new Date(),
        keywords: ['strategic partnership', 'technology services', 'innovation', 'consulting'],
        category: 'PARTNERSHIP',
        estimatedValue: '£100,000 - £300,000 annually',
        relatedEntities: [entity],
        evidenceLinks: [
          {
            title: 'Partnership Inquiry',
            url: entity.properties.linkedin_url || '',
            type: 'social_media',
            confidence: 0.8
          }
        ]
      }
    ]

    // Store demo RFPs and create cards
    for (const rfp of demoRFPs) {
      discoveredRFPs.set(rfp.id, rfp)
      
      const card: RFPDiscoveryCard = {
        id: `card-${rfp.id}`,
        rfp,
        status: 'discovered',
        processingNotes: [`Demo RFP generated at ${new Date().toISOString()}`],
        nextSteps: ['Initial review', 'Fit assessment', 'Team assignment'],
        createdAt: new Date()
      }
      
      rfpCards.set(card.id, card)
    }
  }

  return {
    success: true,
    message: `Generated ${discoveredRFPs.size} demo RFPs from ${entities.entities.length} entities`,
    rfps: Array.from(discoveredRFPs.values()),
    cards: Array.from(rfpCards.values())
  }
}