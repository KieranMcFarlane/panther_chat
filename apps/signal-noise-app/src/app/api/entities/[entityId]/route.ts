import { NextRequest, NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'
import { getDossierLookupEntityIds, resolveEntityForDossier } from '@/lib/dossier-entity'
import { resolveGraphId } from '@/lib/graph-id'

export const dynamic = 'force-dynamic';

// Dynamic dossier generation function
async function generateComprehensiveDossier(entity: any, supabase: any) {
  try {
    const entityName = entity.properties.name || 'Unknown Entity'
    const entityType = entity.properties.type || 'Unknown'
    
    console.log(`🔄 Generating comprehensive dossier for ${entityName}...`)
    
    // Base dossier structure
    const dossier = {
      entity: {
        graph_id: entity.graph_id || entity.id,
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
        data_sources: ['FalkorDB Graph Store', 'Industry Analysis', 'Dynamic Generation'],
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

async function getPersistedDossier(entityIds: string[]) {
  try {
    if (!entityIds || entityIds.length === 0) {
      return null
    }

    const { data, error } = await supabase
      .from('entity_dossiers')
      .select('dossier_data')
      .in('entity_id', entityIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data?.dossier_data) {
      return null
    }

    return data.dossier_data
  } catch (error) {
    console.log('⚠️ Persisted dossier lookup failed:', error)
    return null
  }
}

interface Entity {
  id: string
  graph_id?: string | number
  labels: string[]
  properties: Record<string, any>
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
    let source: 'supabase' | null = null

    console.log(`📖 Fetching entity ${entityId} from Supabase`)

    if (useCache) {
      entity = await resolveEntityForDossier(entityId) as Entity | null
      source = entity ? 'supabase' : null
    }

    if (!entity) {
      // Entity not found in Supabase
      return NextResponse.json(
        {
          error: 'Entity not found',
          entityId: entityId,
          suggestion: 'This entity may have been removed or the ID is incorrect. Please verify the entity ID or refresh the entity list.',
          availableSources: ['Supabase cached_entities, teams, and leagues tables']
        },
        { status: 404 }
      )
    }

    const dossierLookupIds = getDossierLookupEntityIds(entity, entityId)
    const comprehensiveDossier = await getPersistedDossier(dossierLookupIds)

    return NextResponse.json({
      entity: {
        ...entity,
        graph_id: resolveGraphId(entity) || entity.id,
      },
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
