import { NextRequest, NextResponse } from 'next/server'
import { Neo4jService } from '@/lib/neo4j'

const neo4jService = new Neo4jService()

// Sample sports conventions data with federation intelligence
const DEFAULT_CONVENTIONS = [
  {
    id: 'leaders-week-london-2025',
    title: 'Leaders Week London',
    start: '2025-03-11T09:00:00',
    end: '2025-03-13T18:00:00',
    location: 'Twickenham Stadium, London',
    type: 'c-level',
    description: 'The single best place to meet decision-makers in sports',
    targetAttendees: ['CEOs', 'CDOs', 'Commercial Directors', 'Heads of Digital'],
    federations: ['The FA', 'Premier League', 'UK Sport', 'ECB', 'RFU'],
    industries: ['Football', 'Rugby', 'Cricket', 'Sports Business'],
    networkingScore: 10,
    expectedAttendees: 2500,
    webUrl: 'https://www.leaders.com/events/leaders-week-london'
  },
  {
    id: 'sportel-monaco-2025',
    title: 'Sportel Monaco',
    start: '2025-09-22T09:00:00',
    end: '2025-09-25T18:00:00',
    location: 'Monaco',
    type: 'media-rights',
    description: 'Essential for federations + broadcasters',
    targetAttendees: ['Media Rights Directors', 'Heads of Innovation', 'Commercial Executives'],
    federations: ['World Rugby', 'FIFA', 'IOC', 'World Athletics', 'FIBA'],
    industries: ['Media Rights', 'Broadcasting', 'Sports Technology'],
    networkingScore: 9,
    expectedAttendees: 3000,
    webUrl: 'https://www.sportel.com'
  },
  {
    id: 'sportspro-ott-summit-2025',
    title: 'SportsPro OTT Summit',
    start: '2025-02-18T09:00:00',
    end: '2025-02-19T18:00:00',
    location: 'London',
    type: 'digital-ott',
    description: 'Digital-first federations showcase innovations',
    targetAttendees: ['Heads of Digital', 'OTT Managers', 'Fan Engagement Leads'],
    federations: ['LaLiga', 'MotoGP', 'Formula E', 'E-Sports organizations'],
    industries: ['OTT', 'Digital Media', 'Fan Engagement'],
    networkingScore: 8,
    expectedAttendees: 800,
    webUrl: 'https://www.sportspromedia.com/ott-summit'
  },
  {
    id: 'soccerex-global-2025',
    title: 'Soccerex Global Convention',
    start: '2025-11-03T09:00:00',
    end: '2025-11-06T18:00:00',
    location: 'Lisbon',
    type: 'football-business',
    description: 'Great for direct football federation leads',
    targetAttendees: ['Federation Executives', 'Club Directors', 'Technical Directors'],
    federations: ['FIFA', 'UEFA', 'CONMEBOL', 'CAF', 'AFC'],
    industries: ['Football', 'Sports Business', 'Infrastructure'],
    networkingScore: 8,
    expectedAttendees: 5000,
    webUrl: 'https://www.soccerex.com'
  },
  {
    id: 'stadium-business-summit-2025',
    title: 'TheStadiumBusiness Summit',
    start: '2025-06-03T09:00:00',
    end: '2025-06-05T18:00:00',
    location: 'Manchester',
    type: 'venue-stadium',
    description: 'Excellent for stadium / fan UX products',
    targetAttendees: ['Stadium Directors', 'Operations Managers', 'Experience Designers'],
    federations: ['Venue operators', 'Club stadium teams', 'Local authorities'],
    industries: ['Stadium Management', 'Fan Experience', 'Venue Technology'],
    networkingScore: 7,
    expectedAttendees: 1200,
    webUrl: 'https://www.stadium-business.com'
  },
  {
    id: 'sportaccord-2025',
    title: 'SportAccord Summit',
    start: '2025-04-27T09:00:00',
    end: '2025-05-02T18:00:00',
    location: 'Birmingham, UK',
    type: 'federation-official',
    description: 'The ultimate federation trade fair. All IF digital leads present',
    targetAttendees: ['Secretary Generals', 'Heads of Digital', 'Innovation Directors'],
    federations: ['All International Federations', 'IOC', 'GAISF', 'ASOIF'],
    industries: ['International Sports', 'Olympic Sports', 'Federation Management'],
    networkingScore: 10,
    expectedAttendees: 2000,
    webUrl: 'https://www.sportaccord.com'
  },
  {
    id: 'web-summit-sports-2025',
    title: 'Web Summit (Sports Track)',
    start: '2025-11-04T09:00:00',
    end: '2025-11-07T18:00:00',
    location: 'Lisbon',
    type: 'tech-innovation',
    description: 'Find innovation leads or federations experimenting with digital engagement',
    targetAttendees: ['Innovation Managers', 'Digital Leaders', 'Tech Partnerships'],
    federations: ['Tech-forward federations', 'Sports startups'],
    industries: ['Sports Tech', 'Innovation', 'Startups'],
    networkingScore: 6,
    expectedAttendees: 70000,
    webUrl: 'https://websummit.com'
  },
  {
    id: 'uk-sport-awards-2025',
    title: 'UK Sport Industry Awards',
    start: '2025-04-03T18:00:00',
    end: '2025-04-03T23:00:00',
    location: 'London',
    type: 'networking-social',
    description: 'More social but excellent for soft networking',
    targetAttendees: ['UK commercial + digital leaders'],
    federations: ['UK Sport bodies', 'British federations'],
    industries: ['UK Sports Business', 'Networking'],
    networkingScore: 5,
    expectedAttendees: 1500,
    webUrl: 'https://www.sportindustrygroup.com'
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month') // 0-indexed month
    const type = searchParams.get('type') || ''
    const location = searchParams.get('location') || ''
    const federation = searchParams.get('federation') || ''

    // Filter conventions based on parameters
    let filteredConventions = DEFAULT_CONVENTIONS.filter(convention => {
      const conventionDate = new Date(convention.start)
      
      // Year filter
      if (conventionDate.getFullYear().toString() !== year) return false
      
      // Month filter (if specified)
      if (month && conventionDate.getMonth() !== parseInt(month)) return false
      
      // Type filter
      if (type && convention.type !== type) return false
      
      // Location filter
      if (location && !convention.location.toLowerCase().includes(location.toLowerCase())) return false
      
      // Federation filter
      if (federation && !convention.federations.some(fed => 
        fed.toLowerCase().includes(federation.toLowerCase())
      )) return false
      
      return true
    })

    // Sort by start date
    filteredConventions.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    // Try to get additional data from Neo4j (optional, with timeout)
    let enhancedConventions = filteredConventions
    try {
      await neo4jService.initialize()
      const session = neo4jService.getDriver().session()
      
      try {
        // For each convention, try to find related entities in our database
        enhancedConventions = await Promise.all(
          filteredConventions.map(async (convention) => {
            let relatedEntities = []
            
            // Try to find federations mentioned in the convention data
            for (const federationName of convention.federations) {
              try {
                const result = await session.run(
                  'MATCH (n) WHERE toLower(n.name) CONTAINS toLower($fedName) RETURN n LIMIT 3',
                  { fedName: federationName }
                )
                
                const entities = result.records.map(record => {
                  const node = record.get('n')
                  return {
                    id: node.identity.toString(),
                    name: node.properties.name,
                    type: node.properties.type || node.labels[0],
                    labels: node.labels
                  }
                })
                
                relatedEntities.push(...entities)
              } catch (err) {
                console.warn('Error finding federation entities:', err)
              }
            }
            
            return {
              ...convention,
              relatedEntities: relatedEntities.slice(0, 10), // Limit to 10 related entities
              hasRelatedEntities: relatedEntities.length > 0
            }
          })
        )
      } finally {
        await session.close()
      }
    } catch (neo4jError) {
      console.warn('Neo4j enhancement failed, using base data:', neo4jError)
      // Continue with base convention data if Neo4j fails
    }

    return NextResponse.json({
      conventions: enhancedConventions,
      filters: {
        year,
        month,
        type,
        location,
        federation
      },
      meta: {
        total: enhancedConventions.length,
        year,
        source: 'api'
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch conventions:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch conventions',
        conventions: [] // Fallback to empty array
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['title', 'start', 'end', 'location', 'type']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Create new convention
    const newConvention = {
      id: `custom-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      source: 'user_added'
    }

    // In a real implementation, you'd save this to Neo4j or another database
    // For now, just return the created convention
    
    return NextResponse.json({
      convention: newConvention,
      message: 'Convention created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating convention:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create convention' },
      { status: 500 }
    )
  }
}