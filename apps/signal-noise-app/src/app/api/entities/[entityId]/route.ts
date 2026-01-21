import { NextRequest, NextResponse } from 'next/server'
import { Neo4jService } from '@/lib/neo4j'
import { createClient } from '@supabase/supabase-js'

// Dynamic dossier generation function
async function generateComprehensiveDossier(entity: any, supabase: any) {
  try {
    const entityName = entity.properties.name || 'Unknown Entity'
    const entityType = entity.properties.type || 'Unknown'
    
    console.log(`🔄 Generating comprehensive dossier for ${entityName}...`)
    
    // Base dossier structure
    const dossier = {
      entity: {
        neo4j_id: entity.neo4j_id,
        name: entityName,
        type: entityType,
        sport: entity.properties.sport || 'Unknown',
        country: entity.properties.country || 'Unknown',
        level: entity.properties.level || 'Unknown',
        website: entity.properties.website || '',
        founded: entity.properties.founded || null,
        stadium: entity.properties.stadium || '',
        last_updated: new Date().toISOString(),
        confidence_score: 0.85
      },
      
      core_info: {
        name: entityName,
        type: entityType,
        league: entity.properties.level || 'Unknown',
        founded: entity.properties.founded || 'Unknown',
        hq: entity.properties.headquarters || entity.properties.country || 'Unknown',
        stadium: entity.properties.stadium || 'Unknown',
        website: entity.properties.website || '',
        employee_range: entity.properties.company_size || 'Unknown',
        ownership: entity.properties.ownership || 'Private'
      },
      
      digital_transformation: {
        digital_maturity: Math.floor(Math.random() * 30) + 50, // 50-80
        transformation_score: Math.floor(Math.random() * 20) + 70, // 70-90
        website_moderness: Math.floor(Math.random() * 3) + 6, // 6-8
        current_tech_partners: entity.properties.technology_partners || ['Standard sports tech providers'],
        mobile_app: Math.random() > 0.3,
        social_media_followers: Math.floor(Math.random() * 900000) + 100000, // 100K-1M
        data_integration_level: 'Advanced',
        fan_analytics_quality: 'Good'
      },
      
      linkedin_connection_analysis: await generateLinkedInAnalysis(entityName, entityType),
      
      strategic_analysis: {
        overall_assessment: `${entityName} presents significant partnership opportunities with strong digital transformation potential and market position.`,
        opportunity_scoring: {
          immediate_launch: [
            {
              opportunity: 'AI-Powered Fan Engagement Platform',
              score: Math.floor(Math.random() * 15) + 75, // 75-90
              timeline: '3-4 months',
              revenue_potential: `£${Math.floor(Math.random() * 3) + 1}-${Math.floor(Math.random() * 3) + 4}M annual`
            },
            {
              opportunity: 'Stadium Technology Modernization',
              score: Math.floor(Math.random() * 15) + 70, // 70-85
              timeline: '4-6 months', 
              revenue_potential: `£${Math.floor(Math.random() * 2) + 1}-${Math.floor(Math.random() * 2) + 2}M annual`
            }
          ],
          medium_term_partnerships: [
            {
              opportunity: 'Data Analytics Expansion',
              score: Math.floor(Math.random() * 15) + 70, // 70-85
              timeline: '6-12 months',
              revenue_potential: `£${Math.floor(Math.random() * 2) + 1}-${Math.floor(Math.random() * 2) + 2}M annual`
            }
          ]
        }
      },
      
      implementation_roadmap: {
        phase_1_engagement: {
          timeline: 'Weeks 1-4',
          objectives: [
            'Discovery meetings with leadership',
            'Needs assessment and opportunity identification',
            'Pilot project proposal'
          ]
        },
        phase_2_pilot: {
          timeline: 'Weeks 5-16',
          objectives: [
            'Fan Analytics Platform pilot',
            'Regular progress reviews',
            'Success metrics tracking'
          ]
        },
        phase_3_partnership: {
          timeline: 'Months 5-12',
          objectives: [
            'Stadium Technology modernization',
            'Mobile App Enhancement',
            'Ongoing optimization'
          ]
        }
      },
      
      metadata: {
        generated_date: new Date().toISOString(),
        analyst: 'Yellow Panther Intelligence System',
        schema_version: '2.0',
        data_sources: ['Neo4j Database', 'Industry Analysis', 'Dynamic Generation'],
        confidence_score: 0.85,
        information_freshness: 'Current as of ' + new Date().toISOString().split('T')[0],
        next_review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
    
    console.log(`✅ Generated comprehensive dossier for ${entityName}`)
    return dossier
    
  } catch (error) {
    console.error('❌ Failed to generate dossier:', error)
    return null
  }
}

// Generate LinkedIn connection analysis
async function generateLinkedInAnalysis(entityName: string, entityType: string) {
  return {
    target_entity: entityName,
    analysis_date: new Date().toISOString().split('T')[0],
    yellow_panther_uk_team: {
      team_members: [
        {
          name: 'Stuart Cope',
          linkedin_url: 'https://uk.linkedin.com/in/stuart-cope-54392b16/',
          role: 'Co-Founder & COO',
          connection_count: 2,
          is_primary: true,
          strongest_connection: 'Leadership team via industry consultant'
        },
        {
          name: 'Gunjan Parikh',
          linkedin_url: 'https://www.linkedin.com/in/gunjan-parikh-a26a1ba9/',
          role: 'Founder & CEO',
          connection_count: 1,
          is_primary: false
        },
        {
          name: 'Elliott Hillman',
          linkedin_url: 'https://uk.linkedin.com/in/elliott-rj-hillman/',
          role: 'Senior Client Partner',
          connection_count: 1,
          is_primary: false
        }
      ],
      total_connections_found: 4,
      network_diversity_score: 75
    },
    
    tier_1_analysis: {
      introduction_paths: [
        {
          yellow_panther_contact: 'Stuart Cope',
          target_decision_maker: 'Commercial Leadership Team',
          connection_strength: 'MEDIUM',
          connection_type: 'INDUSTRY_NETWORK',
          confidence_score: 70,
          is_primary_path: true,
          mutual_connections: [
            {
              name: 'Sports Industry Consultant',
              linkedin_url: 'https://www.linkedin.com/in/sports-industry-consultant/',
              relationship_context: 'Sports technology consulting network',
              recency_years: 2,
              strength_rating: 7,
              yellow_panther_proximity: 'Stuart Cope'
            }
          ],
          connection_context: 'Industry network connections through sports technology consulting',
          introduction_strategy: 'Professional introduction through sports industry network focusing on digital transformation opportunities',
          alternative_paths: ['Direct outreach through LinkedIn professional network']
        }
      ],
      total_paths: 1
    },
    
    tier_2_analysis: {
      influential_bridge_contacts: [
        {
          bridge_contact_name: 'Sports Technology Executive',
          linkedin_url: 'https://www.linkedin.com/in/sports-tech-executive/',
          relationship_to_yp: 'Connection to Elliott Hillman',
          industry_influence: 'High - works with multiple sports organizations on technology solutions',
          connection_strength_to_yp: 'MEDIUM',
          sports_industry_network_size: '400+ connections across sports technology sector',
          target_connections: [
            {
              target_entity: entityName,
              contact_name: 'Commercial Leadership',
              connection_strength: 'MEDIUM',
              connection_context: 'Industry network connections through sports technology consulting',
              introduction_feasibility: 'MEDIUM',
              bridge_willingness: 'Open to facilitating relevant business introductions'
            }
          ]
        }
      ],
      tier_2_introduction_paths: [
        {
          path_description: `Stuart Cope → Sports Industry Consultant → Commercial Leadership at ${entityName}`,
          yellow_panther_contact: 'Stuart Cope',
          bridge_contact: 'Sports Industry Consultant',
          target_decision_maker: 'Commercial Leadership Team',
          connection_strength: 'MEDIUM',
          confidence_score: 75,
          path_type: 'TIER_2_BRIDGE',
          introduction_strategy: 'Professional introduction through sports industry network focusing on digital transformation partnerships',
          estimated_timeline: '3-5 weeks',
          success_probability: 'MEDIUM-HIGH'
        }
      ]
    },
    
    recommendations: {
      optimal_team_member: 'Stuart Cope (Primary Contact)',
      messaging_strategy: `Focus on sports technology partnerships and digital transformation opportunities for ${entityName}`,
      timing_suggestions: 'Q1 2025 - Post-holiday season planning',
      success_probability: '70% (Medium-high likelihood through industry network)',
      team_coordination: 'Stuart Cope leads with secondary support from Elliott Hillman for technical expertise'
    }
  }
}

const supabaseUrl = 'https://itlcuazbybqlkicsaola.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bGN1YXpieWJxbGtpY3Nhb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTc0MTQsImV4cCI6MjA3NDY3MzQxNH0.UXXSbe1Kk0CH7NkIGnwo3_qmJVV3VUbJz4Dw8lBGcKU'
const supabase = createClient(supabaseUrl, supabaseKey)

interface Entity {
  id: string
  neo4j_id: string | number
  labels: string[]
  properties: Record<string, any>
}

interface Connection {
  relationship: string
  target: string
  target_type: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params
    
    // Validate entityId parameter
    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      )
    }
    const { searchParams } = new URL(request.url)
    const useCache = searchParams.get('useCache') !== 'false' // Default to true
    
    let entity: Entity | null = null
    let connections: Connection[] = []
    let source: 'cache' | 'neo4j' | null = null

    // Try to get from Supabase teams and leagues tables first (new structure)
    if (useCache) {
      try {
        // First check if it's a team
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select(`
            *,
            leagues:league_id (
              id,
              name,
              badge_path,
              badge_s3_url
            )
          `)
          .or(`id.eq.${entityId},neo4j_id.eq.${entityId}`)
          .single()

        if (!teamError && teamData) {
          // Convert team data to entity format
          entity = {
            id: teamData.id,
            neo4j_id: teamData.neo4j_id || teamData.id,
            labels: ['Team'],
            properties: {
              name: teamData.name,
              type: 'Team',
              sport: teamData.sport,
              country: teamData.country,
              founded: teamData.founded,
              headquarters: teamData.headquarters,
              website: teamData.website,
              linkedin: teamData.linkedin,
              about: teamData.about,
              company_size: teamData.company_size,
              priority: teamData.priority,
              estimated_value: teamData.estimated_value,
              opportunity_score: teamData.opportunity_score,
              digital_maturity_score: teamData.digital_maturity_score,
              website_moderness_score: teamData.website_moderness_score,
              digital_transformation_score: teamData.digital_transformation_score,
              procurement_status: teamData.procurement_status,
              enrichment_status: teamData.enrichment_status,
              badge_path: teamData.badge_path,
              badge_s3_url: teamData.badge_s3_url,
              level: teamData.level,
              tier: teamData.tier,
              league_id: teamData.league_id,
              league_name: teamData.leagues?.name,
              league_badge_path: teamData.leagues?.badge_path,
              league_badge_s3_url: teamData.leagues?.badge_s3_url
            }
          }
          source = 'cache'
        } else {
          // Check if it's a league
          const { data: leagueData, error: leagueError } = await supabase
            .from('leagues')
            .select('*')
            .or(`id.eq.${entityId},neo4j_id.eq.${entityId}`)
            .single()

          if (!leagueError && leagueData) {
            // Convert league data to entity format
            entity = {
              id: leagueData.id,
              neo4j_id: leagueData.neo4j_id || leagueData.id,
              labels: ['League'],
              properties: {
                name: leagueData.name,
                type: 'League',
                sport: leagueData.sport,
                country: leagueData.country,
                website: leagueData.website,
                linkedin: leagueData.linkedin,
                description: leagueData.description,
                digital_maturity_score: leagueData.digital_maturity_score,
                estimated_value: leagueData.estimated_value,
                priority_score: leagueData.priority_score,
                badge_path: leagueData.badge_path,
                badge_s3_url: leagueData.badge_s3_url,
                tier: leagueData.tier,
                original_name: leagueData.original_name,
                league_id: leagueData.league_id
              }
            }
            source = 'cache'
          } else {
            // Fallback to cached_entities for other entity types
            // Try UUID first, then Neo4j ID
            let { data: cachedEntity, error: cacheError } = await supabase
              .from('cached_entities')
              .select('*')
              .eq('id', entityId)
              .single()

            // If not found by UUID, try by Neo4j ID
            if (cacheError) {
              const result = await supabase
                .from('cached_entities')
                .select('*')
                .eq('neo4j_id', entityId)
                .single()
              cachedEntity = result.data
              cacheError = result.error
            }

            // If still not found, try Neo4j ID as number
            if (cacheError) {
              const result = await supabase
                .from('cached_entities')
                .select('*')
                .eq('neo4j_id', parseInt(entityId))
                .single()
              cachedEntity = result.data
              cacheError = result.error
            }

            if (!cacheError && cachedEntity) {
              entity = {
                id: cachedEntity.id,
                neo4j_id: cachedEntity.neo4j_id,
                labels: cachedEntity.labels,
                properties: cachedEntity.properties
              }
              source = 'cache'
            }
          }
        }
      } catch (cacheError) {
        console.log('Cache miss, falling back to Neo4j:', cacheError)
      }
    }

    // If not found in cache or cache disabled, get from Neo4j
    if (!entity) {
      let session;
      try {
        const neo4jService = new Neo4jService()
        await neo4jService.initialize()
        session = neo4jService.driver.session()
      } catch (neo4jError) {
        console.error('Failed to initialize Neo4j:', neo4jError)
        return NextResponse.json(
          { error: neo4jError instanceof Error ? neo4jError.message : 'Failed to connect to database' },
          { status: 500 }
        )
      }
      try {
        // Get entity details
        const entityResult = await session.run(`
          MATCH (n) 
          WHERE n.neo4j_id = $entityId
          RETURN n
        `, { entityId: entityId })

        if (entityResult.records.length > 0) {
          const node = entityResult.records[0].get('n')
          entity = {
            id: node.identity.toString(),
            neo4j_id: node.properties.neo4j_id?.toString() || node.identity.toString(),
            labels: node.labels,
            properties: node.properties
          }
          source = 'neo4j'

          // Get connections
          const connectionResult = await session.run(`
            MATCH (n)-[r]-(related)
            WHERE n.neo4j_id = $entityId
            RETURN type(r) as relationship, 
                   related.name as target, 
               labels(related)[0] as target_type
            LIMIT 50
          `, { entityId: entityId })

          connections = connectionResult.records.map(record => ({
            relationship: record.get('relationship'),
            target: record.get('target') || 'Unnamed',
            target_type: record.get('target_type') || 'Unknown'
          }))
        }
      } finally {
        if (session) {
          await session.close()
        }
      }
    }

    if (!entity) {
      // Provide more context for missing entities
      return NextResponse.json(
        { 
          error: 'Entity not found',
          entityId: entityId,
          suggestion: 'This entity may have been removed or the ID is incorrect. Please verify the entity ID or refresh the entity list.',
          availableSources: ['Supabase cache', 'Neo4j database']
        },
        { status: 404 }
      )
    }

    // Skip automatic dossier generation for performance
    let comprehensiveDossier = null
    
    // Only return existing dossier_data if it exists, don't generate new ones
    if (entity.properties.dossier_data) {
      try {
        comprehensiveDossier = JSON.parse(entity.properties.dossier_data)
        console.log(`✅ Using existing dossier for ${entity.properties.name}`)
      } catch (error) {
        console.log('⚠️ Invalid dossier_data, skipping dossier generation')
      }
    }

    return NextResponse.json({
      entity,
      connections,
      source,
      dossier: comprehensiveDossier
    })

  } catch (error) {
    console.error('❌ Failed to fetch entity details:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entity details' },
      { status: 500 }
    )
  }
}