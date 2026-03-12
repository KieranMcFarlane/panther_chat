import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { resolveGraphId } from '@/lib/graph-id'

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

async function findRelatedEntitiesForConvention(convention: typeof DEFAULT_CONVENTIONS[number]) {
  const federationTerms = convention.federations
    .map((name) => name.trim())
    .filter(Boolean)

  if (federationTerms.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('cached_entities')
    .select('id, graph_id, neo4j_id, labels, properties')
    .limit(150)

  if (error) {
    throw error
  }

  const matches = (data || []).filter((entity: any) => {
    const name = String(entity.properties?.name || '').toLowerCase()
    return federationTerms.some((term) => name.includes(term.toLowerCase()) || term.toLowerCase().includes(name))
  })

  return matches.slice(0, 10).map((entity: any) => {
    const stableId = resolveGraphId(entity) || entity.id
    return ({
    id: stableId,
    graph_id: stableId,
    name: entity.properties?.name || stableId,
    type: entity.properties?.type || entity.labels?.[0] || 'Entity',
    labels: entity.labels || []
  })})
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const type = searchParams.get('type') || ''
    const location = searchParams.get('location') || ''
    const federation = searchParams.get('federation') || ''

    let filteredConventions = DEFAULT_CONVENTIONS.filter(convention => {
      const conventionDate = new Date(convention.start)

      if (year && conventionDate.getFullYear().toString() !== year) return false
      if (month && conventionDate.getMonth() !== parseInt(month)) return false
      if (type && convention.type !== type) return false
      if (location && !convention.location.toLowerCase().includes(location.toLowerCase())) return false
      if (federation && !convention.federations.some(fed => fed.toLowerCase().includes(federation.toLowerCase()))) return false

      return true
    })

    filteredConventions.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    const enhancedConventions = await Promise.all(
      filteredConventions.map(async (convention) => {
        const relatedEntities = await findRelatedEntitiesForConvention(convention)
        return {
          ...convention,
          relatedEntities,
          hasRelatedEntities: relatedEntities.length > 0
        }
      })
    )

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
        year: year || 'all',
        source: 'api'
      }
    })
  } catch (error) {
    console.error('❌ Failed to fetch conventions:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch conventions',
        conventions: []
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const requiredFields = ['title', 'start', 'end', 'location', 'type']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const newConvention = {
      id: `custom-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      source: 'user_added'
    }

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
