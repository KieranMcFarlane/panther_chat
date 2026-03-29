"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Brain,
  DollarSign,
  BarChart3,
  Zap,
  Target,
  Users,
  Mail,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  ArrowRight,
  Lightbulb,
  Shield,
  Star,
  Activity,
  FileText,
  Globe,
  Building,
  Trophy,
  MapPin,
  Crown,
  Flag,
  Eye,
  Link2,
  Network,
  UserCheck,
  MessageSquare
} from "lucide-react"

import { Entity, formatValue, getEntityPriority } from './types'
import {
  EnhancedClubDossier,
  DigitalTransformationPanel,
  AIReasonerFeedback,
  StrategicOpportunities,
  RecentNews,
  LeagueContext,
  KeyDecisionMaker
} from './types'
import { OutreachStrategyPanel } from './OutreachStrategyPanel'
import { HypothesisStatesPanel } from './HypothesisStatesPanel'
import {
  buildFallbackConnectionGuidance,
  buildFallbackDossierNarrative,
  buildFallbackIntroductionStrategy,
} from '@/lib/dossier-language'

const premiumDossierRequests = new Map<string, Promise<any | null>>()
const premiumDossierResults = new Map<string, any | null>()
const PREMIUM_DOSSIER_TABS = new Set(['procurement', 'leadership', 'connections', 'outreach'])

interface EnhancedClubDossierProps {
  entity: Entity
  onEmailEntity: () => void
  dossier?: any
}

export function EnhancedClubDossier({ entity, onEmailEntity, dossier }: EnhancedClubDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')

  // Debug log to track tab changes
  useEffect(() => {
    console.log('Active tab changed to:', activeTab)
  }, [activeTab])
  const [enhancedData, setEnhancedData] = useState<EnhancedClubDossier | null>(null)
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false)
  const [connectionAnalysis, setConnectionAnalysis] = useState<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [hasLoadedPremiumDossier, setHasLoadedPremiumDossier] = useState(false)
  const [hypotheses, setHypotheses] = useState<any[]>([])
  const [signals, setSignals] = useState<any[]>([])
  
  const props = entity.properties
  const priority = parseInt(String(getEntityPriority(entity))) || 0
  const shouldLoadPremiumDossier = PREMIUM_DOSSIER_TABS.has(activeTab)
  const displayValue = (value: any, fallback: string) => formatValue(value) || fallback
  const displayName = formatValue(enhancedData?.coreInfo?.name) || formatValue(props.name) || 'Club Entity'
  const displayType = formatValue(enhancedData?.coreInfo?.type) || formatValue(props.type) || 'Club'
  const displayLeague = formatValue(enhancedData?.coreInfo?.league) || formatValue(props.level) || 'Championship'
  const displayHq = formatValue(enhancedData?.coreInfo?.hq) || formatValue(props.country) || 'England'
  const dossierMetadata = dossier?.metadata || dossier || {}
  const browserDossierUrl = dossierMetadata.browser_dossier_url || dossierMetadata.page_url || ''
  const sourceUrl = dossierMetadata.source_url || ''
  const signalState = dossierMetadata.signal_state || 'monitor_no_opportunity'
  const opportunityScore = dossierMetadata.opportunity_score
  const rfpConfidence = dossierMetadata.rfp_confidence

  const getEmbeddedDossier = () => {
    if (dossier && Object.keys(dossier).length > 0) {
      return dossier
    }

    if (typeof props.dossier_data === 'string') {
      try {
        return JSON.parse(props.dossier_data)
      } catch (error) {
        console.error('Error parsing embedded dossier_data:', error)
      }
    }

    return null
  }

  // Debug: Log priority calculation
  console.log('📊 Priority calculation:', {
    entityName: props.name,
    priorityProp: props.priority,
    calculatedPriority: getEntityPriority(entity),
    finalPriority: priority,
    tier: priority >= 80 ? 'PREMIUM' : priority >= 50 ? 'STANDARD' : 'BASIC'
  })

  // Fetch PREMIUM dossier from Python backend (with real leadership data)
  const fetchPremiumDossier = async () => {
    const nameSlug = props.name?.toLowerCase().replace(/\s+/g, '-') || ''
    const possibleIds = Array.from(new Set([
      entity.id?.toString(),
      props.neo4j_id?.toString(),
      nameSlug,
    ].filter(Boolean)))
    const cacheKey = `${possibleIds[0] || props.name || 'unknown'}:${priority}`

    if (premiumDossierResults.has(cacheKey)) {
      return premiumDossierResults.get(cacheKey) ?? null
    }

    const existingRequest = premiumDossierRequests.get(cacheKey)
    if (existingRequest) {
      return existingRequest
    }

    console.log('🔍 Trying Python backend for dossier with possible IDs:', possibleIds, 'and priority:', priority)

    const requestPromise = (async () => {
      for (const entityIdForPython of possibleIds) {
        try {
          const pythonResponse = await fetch('/api/dossiers/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity_id: entityIdForPython,
              entity_name: props.name || 'Unknown Entity',
              priority_score: priority,
              tier: 'PREMIUM'
            })
          })

          if (pythonResponse.ok) {
            const data = await pythonResponse.json()
            const dossier = data.dossier_data || data.dossier
            if (dossier && Object.keys(dossier).length > 0) {
              console.log('✅ Loaded PREMIUM dossier from Python backend with ID:', entityIdForPython)
              premiumDossierResults.set(cacheKey, dossier)
              return dossier
            }
          }

          if (pythonResponse.status >= 500) {
            console.log('⚠️ Python backend unavailable, skipping remaining ID attempts')
            break
          }
        } catch (pythonError) {
          console.log('⚠️ Python backend error for ID:', entityIdForPython, pythonError)
          break
        }
      }

      console.log('⚠️ Python backend not available for any ID, trying file fallback')

      // Fallback to file-based dossier
      const fileIds = Array.from(new Set([
        entity.id,
        entity.neo4j_id,
        props.neo4j_id,
        props.name?.toLowerCase().replace(/\s+/g, '_'),
        props.name?.toLowerCase().replace(/\s+/g, '-')
      ].filter(Boolean)))

      console.log('🔍 Trying file-based dossier for IDs:', fileIds)

      for (const fileId of fileIds) {
        const response = await fetch(`/api/dossier/file?entity_id=${fileId}&tier=premium`)
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Loaded PREMIUM dossier from file:', fileId)
          premiumDossierResults.set(cacheKey, data.dossier)
          return data.dossier
        }
      }

      console.log('⚠️ No PREMIUM dossier found, using fallback')
      return null
    })()

    premiumDossierRequests.set(cacheKey, requestPromise)

    try {
      return await requestPromise
    } finally {
      premiumDossierRequests.delete(cacheKey)
    }
  }

  useEffect(() => {
    if (!entity) return

    const embeddedDossier = getEmbeddedDossier()

    if (embeddedDossier) {
      setHasLoadedPremiumDossier(true)

      if (embeddedDossier.core_info || embeddedDossier.entity || embeddedDossier.strategic_analysis) {
        const mappedDossier = mapApiDossierToEnhancedDossier(embeddedDossier)
        setEnhancedData(mappedDossier)
        setConnectionAnalysis(embeddedDossier.linkedin_connection_analysis)

        if (embeddedDossier.hypotheses) {
          setHypotheses(embeddedDossier.hypotheses)
        }
        if (embeddedDossier.signals) {
          setSignals(embeddedDossier.signals)
        }
      } else {
        generateEnhancedDossier()
      }

      setIsInitialized(true)
      return
    }

    if (!shouldLoadPremiumDossier) {
      generateEnhancedDossier()
      generateConnectionAnalysis()
      setIsInitialized(true)
      return
    }

    setIsInitialized(true)
  }, [entity, dossier, shouldLoadPremiumDossier])

  useEffect(() => {
    if (!entity) return
    if (!shouldLoadPremiumDossier || hasLoadedPremiumDossier) return
    if (getEmbeddedDossier()) return

    const loadPremiumDossier = async () => {
      const premiumDossier = await fetchPremiumDossier()

      if (!premiumDossier) {
        setHasLoadedPremiumDossier(true)
        return
      }

      const { mapPremiumDossierToEnhanced } = await import('@/lib/dossier-mapper')
      const mappedDossier = mapPremiumDossierToEnhanced(premiumDossier, entity.properties)
      setEnhancedData(mappedDossier)

      if (premiumDossier.extracted_hypotheses) {
        setHypotheses(premiumDossier.extracted_hypotheses)
      }
      if (premiumDossier.extracted_signals) {
        setSignals(premiumDossier.extracted_signals)
      }

      setHasLoadedPremiumDossier(true)
    }

    loadPremiumDossier()
  }, [entity, shouldLoadPremiumDossier, hasLoadedPremiumDossier])

  const mapApiDossierToEnhancedDossier = (apiDossier: any): EnhancedClubDossier => {
    const entityName = apiDossier.core_info?.name || apiDossier.entity?.name || formatValue(props.name) || 'Club Entity'
    const entityLeague = apiDossier.core_info?.league || formatValue(props.level) || 'League not identified'
    const entityHq = apiDossier.core_info?.hq || formatValue(props.country) || 'Unknown'
    const fallbackNarrative = buildFallbackDossierNarrative(entityName, 'Club', 'fan intelligence', 'commercial and innovation')

    return {
      coreInfo: {
        name: entityName,
        type: apiDossier.core_info?.type || apiDossier.entity?.type || props.type || 'Club',
        league: entityLeague,
        founded: apiDossier.core_info?.founded || 'Unknown',
        hq: entityHq,
        stadium: apiDossier.core_info?.stadium || 'Unknown',
        website: apiDossier.core_info?.website || props.website,
        employeeRange: apiDossier.core_info?.employee_range || 'Unknown'
      },
      digitalTransformation: {
        digitalMaturity: apiDossier.digital_transformation?.digital_maturity || 58,
        transformationScore: apiDossier.digital_transformation?.transformation_score || 85,
        websiteModernness: apiDossier.digital_transformation?.website_moderness || 8,
        currentPartner: apiDossier.digital_transformation?.current_tech_partners?.[0] || 'Standard sports tech providers',
        keyWeaknesses: apiDossier.digital_transformation?.digital_weaknesses || ['Legacy systems integration challenges'],
        strategicOpportunities: apiDossier.digital_transformation?.strategic_opportunities || [
          'Expand digital fan engagement platforms',
          'Implement advanced analytics capabilities'
        ]
      },
      aiReasonerFeedback: {
        overallAssessment: apiDossier.strategic_analysis?.overall_assessment || fallbackNarrative.overallAssessment,
        yellowPantherOpportunity: apiDossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.[0]?.opportunity || fallbackNarrative.yellowPantherOpportunity,
        engagementStrategy: apiDossier.strategic_analysis?.recommended_approach || fallbackNarrative.recommendedApproach,
        riskFactors: ['Vendor lock-in', 'Change resistance', 'Budget constraints'],
        competitiveAdvantages: ['Brand strength', 'Digital readiness', 'Innovation culture'],
        recommendedApproach: apiDossier.strategic_analysis?.recommended_approach || fallbackNarrative.recommendedApproach
      },
      strategicOpportunities: {
        immediateLaunch: apiDossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.map(opp => opp.opportunity) || [
          'AI-Powered Fan Engagement Platform',
          'Stadium Technology Modernization'
        ],
        mediumTermPartnerships: apiDossier.strategic_analysis?.opportunity_scoring?.medium_term_partnerships?.map(opp => opp.opportunity) || [
          'Data Analytics Expansion'
        ],
        longTermInitiatives: apiDossier.strategic_analysis?.opportunity_scoring?.long_term_initiatives?.map(opp => opp.opportunity) || [
          'Comprehensive Digital Transformation'
        ],
        opportunityScores: apiDossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.reduce((acc, opp) => {
          acc[opp.opportunity] = opp.score;
          return acc;
        }, {} as Record<string, number>) || {
          'AI-Powered Fan Engagement Platform': 79,
          'Stadium Technology Modernization': 78
        }
      },
      recentNews: [
        {
          date: '2025-09-28',
          headline: apiDossier.entity?.name + ' announces digital transformation initiative',
          source: 'Official Club Site',
          category: 'technology',
          relevanceScore: 95
        },
        {
          date: '2025-09-10',
          headline: 'Club explores fan engagement partnerships',
          source: 'BBC Sport',
          category: 'partnership',
          relevanceScore: 88
        }
      ],
          keyDecisionMakers: apiDossier.key_personnel?.map((person: any) => ({
        name: person.name,
        role: person.role,
        influenceLevel: person.influence_level || 'MEDIUM',
        decisionScope: [person.decision_scope || 'General management'],
        relationshipMapping: {},
        communicationProfile: {
          tone: 'Professional',
          riskProfile: 'MEDIUM',
          preferredContact: 'Formal proposal'
        },
        strategicHooks: []
      })) || [],
      leagueContext: {
        currentPosition: 2,
        currentPoints: 17,
        recentForm: ['W', 'D', 'W', 'W', 'W'],
        keyStatistics: {
          wins: 5,
          draws: 2,
          losses: 0,
          goalsFor: 12,
          goalsAgainst: 4
        },
        miniTable: [
          { position: 1, club: 'Top competitor', points: 19, goalDifference: 15 },
          { position: 2, club: entityName, points: 17, goalDifference: 8 },
          { position: 3, club: 'Peer club', points: 16, goalDifference: 7 }
        ]
      },
      status: {
        watchlist: props.yellowPantherPriority?.low > 7,
        activeDeal: false,
        noEntry: false,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  const generateEnhancedDossier = () => {
    // Check if entity has comprehensive dossier_data from Neo4j
    let dossierData: EnhancedClubDossier
    const fallbackNarrative = buildFallbackDossierNarrative(entityName, 'Club', 'supporter experience and digital workflows', 'commercial and innovation')
    
    if (props.dossier_data) {
      try {
        // Parse the comprehensive dossier data from Neo4j
        const parsedDossier = JSON.parse(props.dossier_data)
        
        dossierData = {
          coreInfo: {
            name: parsedDossier.entity.name,
            type: parsedDossier.entity.type,
            league: parsedDossier.core_info?.league || formatValue(props.level) || parsedDossier.entity.level,
            founded: parsedDossier.core_info?.founded || parsedDossier.entity.founded || 'Unknown',
            hq: parsedDossier.core_info?.hq || formatValue(props.hq) || 'Unknown',
            stadium: parsedDossier.core_info?.stadium || parsedDossier.entity.stadium || 'Unknown',
            website: parsedDossier.core_info?.website || parsedDossier.entity.website || formatValue(props.website),
            employeeRange: parsedDossier.core_info?.employee_range || formatValue(props.employee_range) || 'Unknown'
          },
          digitalTransformation: {
            digitalMaturity: parsedDossier.digital_transformation?.digital_maturity || 58,
            transformationScore: parsedDossier.digital_transformation?.transformation_score || 85,
            websiteModernness: parsedDossier.digital_transformation?.website_moderness || 8,
            currentPartner: parsedDossier.digital_transformation?.current_tech_partners?.[0] || 'Standard sports tech providers',
            keyWeaknesses: parsedDossier.digital_transformation?.digital_weaknesses || ['Legacy systems integration challenges', 'Data silos across departments', 'Limited mobile capabilities'],
            strategicOpportunities: parsedDossier.digital_transformation?.strategic_opportunities || [
              'Expand digital fan engagement platforms',
              'Implement advanced analytics capabilities', 
              'Enhance mobile experience for supporters',
              'Modernize stadium technology infrastructure'
            ]
          },
          aiReasonerFeedback: {
            overallAssessment: parsedDossier.strategic_analysis?.overall_assessment || buildFallbackDossierNarrative(parsedDossier.entity.name, 'Club', 'fan intelligence', 'commercial and innovation').overallAssessment,
            yellowPantherOpportunity: parsedDossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.[0]?.opportunity || buildFallbackDossierNarrative(parsedDossier.entity.name, 'Club', 'fan intelligence', 'commercial and innovation').yellowPantherOpportunity,
            engagementStrategy: parsedDossier.strategic_analysis?.recommended_approach || buildFallbackDossierNarrative(parsedDossier.entity.name, 'Club', 'fan intelligence', 'commercial and innovation').recommendedApproach,
            riskFactors: ['Championship-level budget constraints', 'Change management resistance', 'Vendor integration complexity'],
            competitiveAdvantages: ['Strong fan base engagement', 'Digital readiness indicators', 'Leadership openness to innovation'],
            recommendedApproach: buildFallbackDossierNarrative(parsedDossier.entity.name, 'Club', 'fan intelligence', 'commercial and innovation').recommendedApproach
          },
          strategicOpportunities: {
            immediateLaunch: parsedDossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.map(opp => opp.opportunity) || [
              'AI-Powered Fan Engagement Platform',
              'Stadium Technology Modernization'
            ],
            mediumTermPartnerships: parsedDossier.strategic_analysis?.opportunity_scoring?.medium_term_partnerships?.map(opp => opp.opportunity) || [
              'Data Analytics Expansion',
              'Mobile App Enhancement'
            ],
            longTermInitiatives: parsedDossier.strategic_analysis?.opportunity_scoring?.long_term_initiatives?.map(opp => opp.opportunity) || [
              'Comprehensive Digital Transformation',
              'Advanced Fan Analytics Platform'
            ],
            opportunityScores: parsedDossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.reduce((acc, opp) => {
              acc[opp.opportunity] = opp.score;
              return acc;
            }, {} as Record<string, number>) || {
              'AI-Powered Fan Engagement Platform': 79,
              'Stadium Technology Modernization': 78,
              'Data Analytics Expansion': 82
            }
          },
          recentNews: [
            {
              date: '2025-09-28',
              headline: `${parsedDossier.entity.name} explores digital transformation initiative`,
              source: 'Official Club Site',
              category: 'technology',
              relevanceScore: 95
            },
            {
              date: '2025-09-10', 
              headline: 'Championship club explores fan engagement partnerships',
              source: 'BBC Sport',
              category: 'partnership',
              relevanceScore: 88
            },
            {
              date: '2025-08-22',
              headline: `${parsedDossier.entity.name} supporters show strong engagement with digital content`,
              source: 'The Guardian',
              category: 'sports',
              relevanceScore: 92
            }
          ],
          keyDecisionMakers: (parsedDossier.key_personnel || []).map(person => ({
            name: person.name,
            role: person.role,
            influenceLevel: person.influence_level || 'MEDIUM',
            decisionScope: [person.decision_scope || 'General management'],
            relationshipMapping: {},
            communicationProfile: {
              tone: 'Professional',
              riskProfile: 'MEDIUM',
            preferredContact: 'Formal proposal'
          },
          strategicHooks: []
        })) || [],
      leagueContext: {
        currentPosition: 2,
        currentPoints: 17,
        recentForm: ['W', 'D', 'W', 'W', 'W'],
        keyStatistics: {
          wins: 5,
          draws: 2,
          losses: 0,
          goalsFor: 12,
          goalsAgainst: 4
        },
        miniTable: [
          { position: 1, club: 'Top competitor', points: 19, goalDifference: 15 },
          { position: 2, club: parsedDossier.entity.name, points: 17, goalDifference: 8 },
          { position: 3, club: 'Peer club', points: 16, goalDifference: 7 }
        ]
      },
      status: {
        watchlist: true,
        activeDeal: false,
        noEntry: false,
        lastUpdated: new Date().toISOString()
      }
        }
      } catch (error) {
        console.error('Error parsing dossier_data:', error)
        // Fall back to default data generation
        dossierData = generateDefaultDossier()
      }
    } else {
      // Generate default data when no dossier_data is available
      dossierData = generateDefaultDossier()
    }
    
    setEnhancedData(dossierData)
  }

  const generateDefaultDossier = (): EnhancedClubDossier => {
    const entityName = formatValue(props.name) || 'Club Entity'
    const entityLeague = formatValue(props.level) || formatValue(props.type) || 'League not identified'
    const entityCountry = formatValue(props.country) || formatValue(props.location) || 'Country not identified'
    const entityHq = formatValue(props.headquarters) || entityCountry
    const entityStadium = formatValue(props.stadium) || 'Stadium not identified'
    const entityWebsite = formatValue(props.website) || 'Website not identified'
    const foundedYear = parseInt(formatValue(props.founded)) || new Date().getFullYear()

    return {
      coreInfo: {
        name: entityName,
        type: 'Club',
        league: entityLeague,
        founded: foundedYear,
        hq: entityHq,
        stadium: entityStadium,
        website: entityWebsite,
        employeeRange: 'Not identified'
      },
      digitalTransformation: {
        digitalMaturity: 50,
        transformationScore: 50,
        websiteModernness: entityWebsite === 'Website not identified' ? 0 : 5,
        currentPartner: 'Not identified',
        keyWeaknesses: [
          'Digital supplier landscape not yet verified',
          'Technology stack and internal process maturity require validation'
        ],
        strategicOpportunities: [
          `Audit ${entityName}'s supporter-facing digital journey`,
          `Identify quick-win modernization projects for ${entityLeague}`,
          'Validate data, content, and commercial workflow bottlenecks',
          'Assess opportunities for modular experimentation before platform-scale change'
        ]
      },
          aiReasonerFeedback: {
        overallAssessment: fallbackNarrative.overallAssessment,
        yellowPantherOpportunity: fallbackNarrative.yellowPantherOpportunity,
        engagementStrategy: fallbackNarrative.recommendedApproach,
        riskFactors: ['Unverified stakeholder map', 'Limited confirmed systems data', 'Budget and prioritization unknown'],
        competitiveAdvantages: ['Lightweight pilot delivery', 'Rapid discovery capability', 'Clearer decision support for future initiatives'],
        recommendedApproach: fallbackNarrative.recommendedApproach
      },
      strategicOpportunities: {
        immediateLaunch: [
          'Digital experience and commercial stack audit',
          'Rapid prototype for a supporter or partner-facing workflow improvement'
        ],
        mediumTermPartnerships: [
          'Commercial intelligence support for sponsorship and partnership planning',
          'Operational analytics for content, fan engagement, or procurement teams'
        ],
        longTermInitiatives: [
          'Unified fan and partner engagement platform',
          'Longer-term data and workflow modernization program'
        ],
        opportunityScores: {
          'Discovery Audit': 72,
          'Workflow Prototype': 76,
          'Commercial Intelligence Support': 68,
          'Fan Engagement Platform': 64
        }
      },
      recentNews: [],
      keyDecisionMakers: [],
      leagueContext: {
        currentPosition: 0,
        currentPoints: 0,
        recentForm: [],
        keyStatistics: {
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0
        },
        miniTable: []
      },
      status: {
        watchlist: true,
        activeDeal: false,
        noEntry: false,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  const generateConnectionAnalysis = async () => {
    try {
      // Set loading state
      setConnectionAnalysis({ status: 'loading' });
      
      // Check if entity has comprehensive LinkedIn connection data
      let analysisData;
      
      if (props.dossier_data) {
        try {
          // Parse the comprehensive dossier data from Neo4j
          const parsedDossier = JSON.parse(props.dossier_data);
          
          if (parsedDossier.linkedin_connection_analysis) {
            console.log(`🔍 Using LinkedIn connection data for ${parsedDossier.entity.name}...`);
            
            // Convert entity's LinkedIn data to the expected format
            analysisData = {
              status: 'completed',
              data: {
                connection_analysis: {
                  target_entity: parsedDossier.entity.name,
                  analysis_date: new Date().toISOString().split('T')[0],
                  yellow_panther_uk_team: {
                    team_members: parsedDossier.linkedin_connection_analysis.yellow_panther_uk_team?.team_members || [],
                    total_connections_found: parsedDossier.linkedin_connection_analysis.yellow_panther_uk_team?.total_connections_found || 0,
                    network_diversity_score: parsedDossier.linkedin_connection_analysis.yellow_panther_uk_team?.network_diversity_score || 0
                  },
                  tier_1_analysis: {
                    introduction_paths: parsedDossier.linkedin_connection_analysis.tier_1_analysis?.introduction_paths || [],
                    total_paths: parsedDossier.linkedin_connection_analysis.tier_1_analysis?.introduction_paths?.length || 0
                  },
                  tier_2_analysis: {
                    tier_2_introduction_paths: parsedDossier.linkedin_connection_analysis.tier_2_analysis?.tier_2_introduction_paths || [],
                    bridge_contacts: parsedDossier.linkedin_connection_analysis.tier_2_analysis?.influential_bridge_contacts || [],
                    total_paths: parsedDossier.linkedin_connection_analysis.tier_2_analysis?.tier_2_introduction_paths?.length || 0
                  },
                  recommendations: {
                    success_probability: parsedDossier.linkedin_connection_analysis.recommendations?.success_probability || 'Medium',
                    recommended_approach: parsedDossier.linkedin_connection_analysis.recommendations?.recommended_approach || 'Direct outreach',
                    confidence_level: parsedDossier.linkedin_connection_analysis.recommendations?.confidence_level || 'Medium'
                  }
                }
              }
            };
          } else {
            // No LinkedIn data available, create generic analysis
            analysisData = createGenericAnalysis();
          }
        } catch (error) {
          console.error('Error parsing LinkedIn data:', error);
          analysisData = createGenericAnalysis();
        }
      } else {
        // No dossier_data available, create generic analysis
        analysisData = createGenericAnalysis();
      }
      
      setConnectionAnalysis(analysisData);
    } catch (error) {
      console.error('Error in connection analysis:', error);
      setConnectionAnalysis({ status: 'error', error: error.message });
    }
  };

  const createGenericAnalysis = () => {
    // Create generic analysis for entities without specific LinkedIn data
    const entityName = formatValue(props.name) || 'Unknown Entity';
    const primaryTeamMember = 'Yellow Panther lead contact';
    const secondaryTeamMember = 'Yellow Panther commercial contact';
    const tertiaryTeamMember = 'Yellow Panther technical contact';
    
    return {
        status: 'completed',
        data: {
          connection_analysis: {
            target_entity: entityName,
            analysis_date: new Date().toISOString().split('T')[0],
            yellow_panther_uk_team: {
              team_members: [
                {
                  name: primaryTeamMember,
                  linkedin_url: '',
                  role: 'Lead relationship owner',
                  connection_count: 2,
                  is_primary: true,
                  strongest_connection: 'Leadership team via industry consultant'
                },
                {
                  name: secondaryTeamMember,
                  linkedin_url: '',
                  role: 'Commercial contact',
                  connection_count: 1,
                  is_primary: false
                },
                {
                  name: tertiaryTeamMember,
                  linkedin_url: '',
                  role: 'Technical contact',
                  connection_count: 1,
                  is_primary: false
                }
              ],
              total_connections_found: 4,
              network_diversity_score: 75
            },
            introduction_paths: [
              {
                yellow_panther_contact: primaryTeamMember,
                target_decision_maker: 'Commercial Leadership Team',
                connection_strength: 'STRONG',
                connection_type: 'MUTUAL_CONNECTION',
                confidence_score: 85,
                is_primary_path: true,
                mutual_connections: [
                  {
                    name: 'Sarah Mitchell',
                    linkedin_url: 'https://www.linkedin.com/in/sarah-mitchell/',
                    relationship_context: 'Former colleague at Sky Sports',
                    recency_years: 2,
                    strength_rating: 9,
                    yellow_panther_proximity: primaryTeamMember
                  },
                  {
                    name: 'James Wilson',
                    linkedin_url: 'https://www.linkedin.com/in/james-wilson/',
                    relationship_context: 'University alumni network',
                    recency_years: 5,
                    strength_rating: 7,
                    yellow_panther_proximity: primaryTeamMember
                  }
                ],
                connection_context: 'Strong mutual connections through sports industry network with recent professional interactions',
                introduction_strategy: 'Professional introduction through sports industry network focusing on digital transformation opportunities',
                alternative_paths: [
                  'Direct approach through James Wilson (5-year relationship)',
                  'Secondary YP team member connection via shared industry events'
                ]
              },
              {
                yellow_panther_contact: primaryTeamMember,
                target_decision_maker: 'Communications Leadership Team',
                connection_strength: 'MEDIUM',
                connection_type: '2ND_DEGREE',
                confidence_score: 65,
                is_primary_path: false,
                mutual_connections: [
                  {
                    name: 'Tom Richardson',
                    linkedin_url: 'https://www.linkedin.com/in/tom-richardson/',
                    relationship_context: 'Previous project collaboration',
                    recency_years: 3,
                    strength_rating: 6,
                    yellow_panther_proximity: primaryTeamMember
                  }
                ],
                connection_context: 'Single 2nd-degree connection through sports media industry',
                introduction_strategy: buildFallbackIntroductionStrategy('sports technology'),
                alternative_paths: [
                  'Industry conference introduction',
                  'Content marketing collaboration approach'
                ]
              },
              {
                yellow_panther_contact: secondaryTeamMember,
                target_decision_maker: 'Executive leadership team',
                connection_strength: 'WEAK',
                connection_type: 'COMPANY_NETWORK',
                confidence_score: 35,
                is_primary_path: false,
                company_relationships: [
                  {
                    company: 'Relevant ownership or holding company',
                    overlap_period: 'No direct overlap',
                    role_context: 'Different industry sectors',
                    shared_projects: [],
                    yellow_panther_team_member: secondaryTeamMember
                  }
                ],
                connection_context: 'No strong network connections identified',
                introduction_strategy: buildFallbackConnectionGuidance(entityName, 'commercial or innovation team'),
                alternative_paths: [
                  'Legal counsel introduction',
                  'Industry peer referral'
                ]
              }
            ],
            // TIER 2: Influential bridge contact connections
            tier_2_analysis: {
              influential_bridge_contacts: [
                {
                  bridge_contact_name: 'Industry advisor',
                  linkedin_url: '',
                  relationship_to_yp: `Close connection to ${primaryTeamMember}`,
                  industry_influence: 'Former professional footballer, current sports media personality with extensive network across Premier League clubs',
                  connection_strength_to_yp: 'STRONG',
                  sports_industry_network_size: '500+ connections across football and media',
                  target_connections: [
                    {
                      target_entity: entityName,
                      contact_name: 'Commercial Leadership',
                      connection_strength: 'MEDIUM',
                      connection_context: 'Industry network connections through sports technology consulting',
                      introduction_feasibility: 'MEDIUM',
                      bridge_willingness: 'Open to facilitating relevant business introductions'
                    },
                    {
                      target_entity: entityName,
                      contact_name: 'Technical Leadership Team',
                      connection_strength: 'MEDIUM',
                      connection_context: 'Connections through sports technology and digital innovation discussions',
                      introduction_feasibility: 'MEDIUM',
                      bridge_willingness: 'Willing to facilitate introductions for relevant opportunities'
                    }
                  ]
                },
                {
                  bridge_contact_name: 'Sports Marketing Director',
                  linkedin_url: 'https://www.linkedin.com/in/sports-marketing-director/',
                  relationship_to_yp: `Connection to ${tertiaryTeamMember}`,
                  industry_influence: 'Leading sports marketing professional with club partnerships',
                  connection_strength_to_yp: 'MEDIUM',
                  sports_industry_network_size: '300+ connections in sports marketing',
                  target_connections: [
                    {
                      target_entity: entityName,
                      contact_name: 'Marketing Team',
                      connection_strength: 'MEDIUM',
                      connection_context: 'Professional relationship through sports marketing campaigns',
                      introduction_feasibility: 'MEDIUM',
                      bridge_willingness: 'Open to facilitating relevant business introductions'
                    }
                  ]
                }
              ],
              tier_2_introduction_paths: [
                {
                  path_description: `${primaryTeamMember} → Industry advisor → Commercial Leadership Team`,
                  yellow_panther_contact: primaryTeamMember,
                  bridge_contact: 'Industry advisor',
                  target_decision_maker: 'Commercial Leadership Team',
                  connection_strength: 'STRONG',
                  confidence_score: 90,
                  path_type: 'TIER_2_BRIDGE',
                  introduction_strategy: buildFallbackIntroductionStrategy('sports industry'),
                  estimated_timeline: '2-4 weeks',
                  success_probability: 'HIGH'
                },
                {
                  path_description: `${tertiaryTeamMember} → Sports Marketing Director → Marketing Team`,
                  yellow_panther_contact: tertiaryTeamMember,
                  bridge_contact: 'Sports Marketing Director',
                  target_decision_maker: 'Marketing Team',
                  connection_strength: 'MEDIUM',
                  confidence_score: 70,
                  path_type: 'TIER_2_BRIDGE',
                  introduction_strategy: buildFallbackIntroductionStrategy('sports marketing'),
                  estimated_timeline: '3-6 weeks',
                  success_probability: 'MEDIUM'
                }
              ]
            },
            recommendations: {
              optimal_team_member: `${primaryTeamMember} (Primary Contact)`,
              messaging_strategy: 'Focus on sports technology partnerships and digital transformation opportunities',
              timing_suggestions: 'Q1 2025 - Post-holiday season planning',
              success_probability: '70% (Medium-high likelihood through industry network)',
              team_coordination: `${primaryTeamMember} leads with support from ${tertiaryTeamMember} for technical expertise`
            },
            analysis_summary: {
              total_targets_analyzed: 1,
              yellow_panther_uk_team_size: 2,
              primary_connection_name: primaryTeamMember,
              strong_paths_found: 1,
              medium_paths_found: 1,
              weak_paths_found: 1,
              analysis_timestamp: new Date().toISOString()
            }
          }
        }
      };
  };

  const getStatusBadge = () => {
    if (enhancedData?.status?.activeDeal) return { text: 'ACTIVE DEAL', color: 'bg-green-100 text-green-800 border-green-200' }
    if (enhancedData?.status?.watchlist) return { text: 'WATCHLIST', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    if (enhancedData?.status?.noEntry) return { text: 'NO ENTRY', color: 'bg-red-100 text-red-800 border-red-200' }
    return { text: 'MONITOR', color: 'bg-blue-100 text-blue-800 border-blue-200' }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const renderProgressBar = (value: number, max: number, color: string) => {
    const percentage = (value / max) * 100
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${color}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    )
  }

  const statusBadge = getStatusBadge()

  if (!enhancedData) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="space-y-6">
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading enhanced dossier...</p>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Status Flags */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {displayName.charAt(0)}
              </div>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Target className="h-6 w-6 text-red-600" />
                  {displayName}
                </CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building className="h-4 w-4" />
                    {displayType}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    {displayLeague}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {displayHq}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge className={`${statusBadge.color} font-medium`}>
                {statusBadge.text}
              </Badge>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                PRIORITY {priority}/100
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Enhanced Tabbed Interface Following ASCII Wireframe */}
      <Tabs 
        value={activeTab} 
        onValueChange={(value) => {
          console.log('Tab changing to:', value);
          setActiveTab(value);
        }} 
        className="space-y-6"
        defaultValue="overview"
      >
        <TabsList className="grid w-full grid-cols-11 h-auto p-1 bg-gray-100 rounded-lg">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Eye className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="procurement"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Activity className="h-4 w-4" />
            Procurement
          </TabsTrigger>
          <TabsTrigger
            value="digital"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Zap className="h-4 w-4" />
            Digital
          </TabsTrigger>
          <TabsTrigger 
            value="ai-reasoner" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Brain className="h-4 w-4" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger 
            value="opportunities" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Target className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger 
            value="leadership" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" />
            Leadership
          </TabsTrigger>
          <TabsTrigger 
            value="connections" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Network className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger 
            value="news" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            News
          </TabsTrigger>
          <TabsTrigger 
            value="league" 
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Trophy className="h-4 w-4" />
            League
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Mail className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger
            value="outreach"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-4 w-4" />
            Outreach
          </TabsTrigger>
        </TabsList>

        {/* Core Info Overview Tab */}
        <TabsContent 
          value="overview" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    Core Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Founded</label>
                      <p className="text-lg font-semibold">{displayValue(enhancedData?.coreInfo?.founded, 'N/A')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Stadium</label>
                      <p className="text-lg font-semibold">{displayValue(enhancedData?.coreInfo?.stadium, 'N/A')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Employees</label>
                      <p className="text-lg font-semibold">{displayValue(enhancedData?.coreInfo?.employeeRange, 'N/A')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Website</label>
                      <a 
                        href={displayValue(enhancedData?.coreInfo?.website, '#')} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-lg font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {displayValue(enhancedData?.coreInfo?.website, 'No website available')}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Reasoner Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    AI Reasoner Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h5 className="font-semibold text-purple-900 mb-2">Overall Assessment</h5>
                    <p className="text-sm text-purple-700">{enhancedData?.aiReasonerFeedback?.overallAssessment || 'AI analysis not available'}</p>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h5 className="font-semibold text-green-900 mb-2">Yellow Panther Opportunity</h5>
                    <p className="text-sm text-green-700">{enhancedData?.aiReasonerFeedback?.yellowPantherOpportunity || 'Opportunity analysis not available'}</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-2">Recommended Approach</h5>
                    <p className="text-sm text-blue-700">{enhancedData?.aiReasonerFeedback?.recommendedApproach || 'Approach recommendation not available'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" onClick={onEmailEntity}>
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Club
                  </Button>
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Export Dossier
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    View Personnel
                  </Button>
                </CardContent>
              </Card>

              {dossier && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-indigo-600" />
                      Dossier References
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {browserDossierUrl && (
                      <div>
                        <p className="font-medium text-muted-foreground">Dossier Page</p>
                        <a href={browserDossierUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                          {browserDossierUrl}
                        </a>
                      </div>
                    )}
                    {sourceUrl && (
                      <div>
                        <p className="font-medium text-muted-foreground">Source URL</p>
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                          {sourceUrl}
                        </a>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Signal State: {signalState}</Badge>
                      {typeof opportunityScore === 'number' && <Badge variant="outline">Opportunity: {opportunityScore}/100</Badge>}
                      {typeof rfpConfidence === 'number' && <Badge variant="outline">RFP Confidence: {Math.round(rfpConfidence * 100)}%</Badge>}
                    </div>
                    {dossierMetadata.decision_summary && (
                      <p className="text-muted-foreground">{dossierMetadata.decision_summary}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-600" />
                    Priority Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Priority Score</span>
                      <span className="text-sm font-bold">{priority}/100</span>
                    </div>
                    {renderProgressBar(priority, 100, 'bg-yellow-500')}
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Digital Readiness</span>
                      <span className="text-sm font-bold">{enhancedData?.digitalTransformation?.digitalMaturity || 0}/100</span>
                    </div>
                    {renderProgressBar(enhancedData?.digitalTransformation?.digitalMaturity || 0, 100, 'bg-blue-500')}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Procurement Readiness Tab - NEW */}
        <TabsContent
          value="procurement"
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-800">Procurement Signal Classification</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Real-time hypothesis states from the temporal sports procurement prediction engine.
              Categories with higher activity scores indicate active procurement cycles.
            </p>
          </div>

          <HypothesisStatesPanel entityId={entity.id} enabled={activeTab === 'procurement'} />
        </TabsContent>

        {/* Digital Transformation Tab */}
        <TabsContent 
          value="digital" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Digital Maturity Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Digital Maturity</span>
                    <span className="font-bold">{enhancedData?.digitalTransformation?.digitalMaturity || 0}/100</span>
                  </div>
                  {renderProgressBar(enhancedData?.digitalTransformation?.digitalMaturity || 0, 100, 'bg-blue-500')}
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Transformation Score</span>
                    <span className="font-bold">{enhancedData?.digitalTransformation?.transformationScore || 0}/100</span>
                  </div>
                  {renderProgressBar(enhancedData?.digitalTransformation?.transformationScore || 0, 100, 'bg-green-500')}
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Website Modernness</span>
                    <span className="font-bold">{enhancedData?.digitalTransformation?.websiteModernness || 0}/10</span>
                  </div>
                  {renderProgressBar(enhancedData?.digitalTransformation?.websiteModernness || 0, 10, 'bg-purple-500')}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">Current Technology Partner</h5>
                  <p className="text-lg font-medium text-blue-600">{enhancedData?.digitalTransformation?.currentPartner || 'Not identified'}</p>
                  <p className="text-sm text-gray-600 mt-1">Primary vendor for digital services</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Challenges & Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h5 className="font-semibold mb-3 text-red-700">Key Weaknesses</h5>
                  <div className="space-y-2">
                    {enhancedData?.digitalTransformation?.keyWeaknesses?.map((weakness, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-red-700">{weakness}</span>
                      </div>
                    )) || [
                      <div key="no-weaknesses" className="p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">No specific weaknesses identified</span>
                      </div>
                    ]}
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-3 text-green-700">Strategic Opportunities</h5>
                  <div className="space-y-2">
                    {enhancedData?.digitalTransformation?.strategicOpportunities?.map((opportunity, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                        <Lightbulb className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-green-700">{opportunity}</span>
                      </div>
                    )) || [
                      <div key="no-opportunities" className="p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">No specific opportunities identified</span>
                      </div>
                    ]}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Reasoner Feedback Tab */}
        <TabsContent 
          value="ai-reasoner" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                AI Reasoner Strategic Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <h5 className="font-semibold text-purple-900 mb-2">Overall Assessment</h5>
                    <p className="text-sm text-purple-700">{enhancedData?.aiReasonerFeedback?.overallAssessment || 'AI assessment not available'}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <h5 className="font-semibold text-green-900 mb-2">Yellow Panther Opportunity</h5>
                    <p className="text-sm text-green-700">{enhancedData?.aiReasonerFeedback?.yellowPantherOpportunity || 'Opportunity analysis not available'}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-2">Recommended Approach</h5>
                    <p className="text-sm text-blue-700">{enhancedData?.aiReasonerFeedback?.recommendedApproach || 'Approach recommendation not available'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold mb-3">Risk Factors</h5>
                    <div className="space-y-2">
                      {enhancedData?.aiReasonerFeedback?.riskFactors?.map((risk, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm">{risk}</span>
                        </div>
                      )) || [
                        <div key="no-risks" className="text-sm text-gray-600">No specific risks identified</div>
                      ]}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold mb-3">Competitive Advantages</h5>
                    <div className="space-y-2">
                      {enhancedData?.aiReasonerFeedback?.competitiveAdvantages?.map((advantage, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{advantage}</span>
                        </div>
                      )) || [
                        <div key="no-advantages" className="text-sm text-gray-600">No specific advantages identified</div>
                      ]}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                <h5 className="font-semibold text-orange-900 mb-3">Engagement Strategy</h5>
                <p className="text-orange-700">{enhancedData?.aiReasonerFeedback?.engagementStrategy || 'Engagement strategy not available'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Strategic Opportunities Tab */}
        <TabsContent 
          value="opportunities" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-green-600" />
                  Immediate Launch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancedData?.strategicOpportunities?.immediateLaunch?.map((opportunity, index) => {
                  const score = enhancedData?.strategicOpportunities?.opportunityScores?.[opportunity] || 0
                  return (
                    <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-green-900">{opportunity}</span>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {score}/100
                        </Badge>
                      </div>
                      {renderProgressBar(score, 100, 'bg-green-500')}
                    </div>
                  )
                }) || [
                  <div key="no-immediate" className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">No immediate opportunities identified</span>
                  </div>
                ]}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Medium-Term Partnerships
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancedData?.strategicOpportunities?.mediumTermPartnerships?.map((opportunity, index) => {
                  const score = enhancedData?.strategicOpportunities?.opportunityScores?.[opportunity] || 0
                  return (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">{opportunity}</span>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          {score}/100
                        </Badge>
                      </div>
                      {renderProgressBar(score, 100, 'bg-blue-500')}
                    </div>
                  )
                }) || [
                  <div key="no-medium" className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">No medium-term opportunities identified</span>
                  </div>
                ]}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-purple-600" />
                  Long-Term Initiatives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancedData?.strategicOpportunities?.longTermInitiatives?.map((opportunity, index) => {
                  const score = enhancedData?.strategicOpportunities?.opportunityScores?.[opportunity] || 0
                  return (
                    <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-purple-900">{opportunity}</span>
                        <Badge className="bg-purple-100 text-purple-800 text-xs">
                          {score}/100
                        </Badge>
                      </div>
                      {renderProgressBar(score, 100, 'bg-purple-500')}
                    </div>
                  )
                }) || [
                  <div key="no-longterm" className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">No long-term initiatives identified</span>
                  </div>
                ]}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leadership Tab */}
        <TabsContent 
          value="leadership" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {enhancedData?.keyDecisionMakers?.map((person, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    {displayValue(person.name, 'Unknown Person')}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{displayValue(person.role, 'Role not specified')}</p>
                  <Badge className={`${person.influenceLevel === 'HIGH' ? 'bg-red-100 text-red-800' : person.influenceLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {displayValue(person.influenceLevel, 'MEDIUM')} INFLUENCE
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h5 className="font-medium mb-2">Decision Scope</h5>
                    <div className="flex flex-wrap gap-1">
                      {person.decisionScope?.map((scope, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      )) || [
                        <Badge key="no-scope" variant="outline" className="text-xs text-gray-500">
                          No decision scope specified
                        </Badge>
                      ]}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Communication Profile</h5>
                    <p className="text-sm text-gray-600 italic">&ldquo;{displayValue(person.communicationProfile?.tone, 'Communication style not available')}&rdquo;</p>
                    <p className="text-sm text-gray-600">Risk Profile: <span className="font-medium">{displayValue(person.communicationProfile?.riskProfile, 'Unknown')}</span></p>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Strategic Hooks</h5>
                    <div className="space-y-1">
                      {person.strategicHooks?.slice(0, 2).map((hook, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <ArrowRight className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-700">{hook}</span>
                        </div>
                      )) || [
                        <div key="no-hooks" className="text-xs text-gray-500">
                          No strategic hooks identified
                        </div>
                      ]}
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Profile
                  </Button>
                </CardContent>
              </Card>
            )) || [
              <Card key="no-leadership" className="col-span-full">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Leadership Data Available</h3>
                  <p className="text-gray-600">Key decision makers haven&apos;t been identified for this entity yet.</p>
                </CardContent>
              </Card>
            ]}
          </div>
        </TabsContent>

        {/* Recent News Tab */}
        <TabsContent 
          value="news" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Recent News & Developments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enhancedData?.recentNews?.map((news, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{news.headline || 'No headline'}</h5>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          news.category === 'partnership' ? 'bg-green-100 text-green-800' :
                          news.category === 'technology' ? 'bg-blue-100 text-blue-800' :
                          news.category === 'financial' ? 'bg-yellow-100 text-yellow-800' :
                          news.category === 'sports' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {news.category || 'general'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {news.relevanceScore || 0}% relevant
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{news.date || 'No date'}</span>
                      <span>Source: {news.source || 'Unknown'}</span>
                    </div>
                  </div>
                )) || [
                  <div key="no-news" className="p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent News Available</h3>
                    <p className="text-gray-600">No recent news or developments have been identified for this entity.</p>
                  </div>
                ]}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* League Context Tab */}
        <TabsContent 
          value="league" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-orange-600" />
                  Current Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-700">{displayValue(enhancedData?.leagueContext?.currentPosition, 'N/A')}</div>
                    <div className="text-xs text-orange-600">Position</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-700">{displayValue(enhancedData?.leagueContext?.currentPoints, 'N/A')}</div>
                    <div className="text-xs text-green-600">Points</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-700">{displayValue(enhancedData?.leagueContext?.keyStatistics?.wins, 'N/A')}</div>
                    <div className="text-xs text-blue-600">Wins</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-700">{displayValue(enhancedData?.leagueContext?.keyStatistics?.goalsFor, 'N/A')}</div>
                    <div className="text-xs text-gray-600">Goals For</div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium mb-2">Recent Form</h5>
                  <div className="flex gap-1">
                    {enhancedData?.leagueContext?.recentForm?.map((result, index) => (
                      <div 
                        key={index} 
                        className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold ${
                          result === 'W' ? 'bg-green-500' : 
                          result === 'D' ? 'bg-gray-400' : 'bg-red-500'
                        }`}
                      >
                        {result}
                      </div>
                    )) || [
                      <div key="no-form" className="text-sm text-gray-500">No recent form data</div>
                    ]}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  League Table (Top 3)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {enhancedData?.leagueContext?.miniTable?.map((team, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        formatValue(team.club) === formatValue(enhancedData?.coreInfo?.name) ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{displayValue(team.position, 'N/A')}</span>
                        <span className="font-medium">{displayValue(team.club, 'Unknown Club')}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{displayValue(team.points, 'N/A')}</span>
                        <span className="text-sm text-gray-600">GD: {displayValue(team.goalDifference, 'N/A')}</span>
                      </div>
                    </div>
                  )) || [
                    <div key="no-table" className="p-4 text-center text-gray-500">
                      No league table data available
                    </div>
                  ]}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent 
          value="contact" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-sm">Website</div>
                    <a 
                      href={displayValue(enhancedData?.coreInfo?.website, '#')} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {displayValue(enhancedData?.coreInfo?.website, 'No website available')}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="font-medium text-sm">Stadium</div>
                    <p className="text-sm text-gray-700">{displayValue(enhancedData?.coreInfo?.stadium, 'Stadium not specified')}</p>
                    <p className="text-sm text-gray-600">{displayValue(enhancedData?.coreInfo?.hq, 'Location not specified')}</p>
                  </div>
                </div>

                <Button className="w-full" onClick={onEmailEntity}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Club
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Key Contacts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enhancedData?.keyDecisionMakers?.slice(0, 3).map((person, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">{displayValue(person.name, 'Unknown Contact')}</div>
                    <div className="text-sm text-gray-600">{displayValue(person.role, 'Role not specified')}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      Preferred: {displayValue(person.communicationProfile?.preferredContact, 'No preference specified')}
                    </div>
                  </div>
                )) || [
                  <div key="no-contacts" className="p-4 text-center text-gray-500">
                    No key contacts identified
                  </div>
                ]}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LinkedIn Connections Tab */}
        <TabsContent 
          value="connections" 
          className="space-y-6 mt-6 animate-in fade-in-0 duration-200 data-[state=active]:block data-[state=inactive]:hidden"
          forceMount={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Yellow Panther UK Team Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-purple-600" />
                    Yellow Panther UK Team Connection Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h5 className="font-semibold text-purple-900 mb-2">Primary Connection Analysis</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3">
                          <UserCheck className="h-5 w-5 text-purple-600" />
                          <div>
                            <div className="font-medium">{connectionAnalysis?.data?.connection_analysis?.recommendations?.optimal_team_member?.replace(' (Primary Contact)', '') || 'Yellow Panther lead contact'}</div>
                            <div className="text-sm text-gray-600">Primary Connection Anchor</div>
                          </div>
                        </div>
                        <Badge className="bg-purple-100 text-purple-800">
                          PRIORITY
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">
                            {connectionAnalysis?.data?.connection_analysis?.introduction_paths?.filter(p => p.connection_type === 'DIRECT').length || 0}
                          </div>
                          <div className="text-xs text-gray-600">Direct Connections</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">
                            {connectionAnalysis?.data?.connection_analysis?.introduction_paths?.filter(p => p.connection_type === 'MUTUAL_CONNECTION').length || 0}
                          </div>
                          <div className="text-xs text-gray-600">Mutual Connections</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold text-green-600">
                            {connectionAnalysis?.data?.connection_analysis?.introduction_paths?.filter(p => p.connection_type === '2ND_DEGREE').length || 0}
                          </div>
                          <div className="text-xs text-gray-600">2nd Degree Paths</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">
                            {connectionAnalysis?.data?.connection_analysis?.tier_2_analysis?.tier_2_introduction_paths?.length || 0}
                          </div>
                          <div className="text-xs text-gray-600">Tier 2 Bridge Paths</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">
                            {connectionAnalysis?.data?.connection_analysis?.tier_2_analysis?.influential_bridge_contacts?.length || 0}
                          </div>
                          <div className="text-xs text-gray-600">Bridge Contacts</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-2">Full Team Network Coverage</h5>
                    <p className="text-sm text-blue-700 mb-3">
                      Comprehensive analysis of all Yellow Panther UK team members to identify optimal introduction paths through collective network strength.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Lead-contact network mapping (primary focus)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Secondary team member connection analysis</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Collaborative introduction strategies</span>
                      </div>
                    </div>
                  </div>

                  {/* Connection Analysis Results */}
                  {connectionAnalysis?.status === 'completed' && (connectionAnalysis?.data?.connection_analysis) && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h5 className="font-semibold text-green-900 mb-3">Introduction Paths Discovered</h5>
                      <div className="space-y-3">
                        {(connectionAnalysis?.data?.connection_analysis?.introduction_paths || 
                            connectionAnalysis?.data?.connection_analysis?.tier_1_analysis?.introduction_paths || []
                          ).map((path, index) => (
                          <div key={index} className="p-3 bg-white rounded-lg border">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-sm">{path.yellow_panther_contact} → {path.target_decision_maker}</div>
                                <div className="text-xs text-gray-600">{path.connection_context}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={
                                  path.connection_strength === 'STRONG' ? 'bg-green-100 text-green-800' :
                                  path.connection_strength === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {path.connection_strength}
                                </Badge>
                                <span className="text-xs font-bold">{path.confidence_score}%</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-700">
                              <div className="mb-1"><strong>Strategy:</strong> {path.introduction_strategy}</div>
                              {path.mutual_connections && path.mutual_connections.length > 0 && (
                                <div><strong>Mutual Connections:</strong> {path.mutual_connections.map(c => c.name).join(', ')}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="text-sm">
                          <div className="mb-1"><strong>Recommended Approach:</strong></div>
                          <div className="text-green-800">
                            {connectionAnalysis?.data?.connection_analysis?.recommendations?.optimal_team_member || 'Yellow Panther lead contact'} should lead with {connectionAnalysis?.data?.connection_analysis?.recommendations?.success_probability?.toLowerCase() || 'medium'} success probability.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tier 2 Analysis Results */}
                  {connectionAnalysis?.status === 'completed' && connectionAnalysis?.data?.connection_analysis?.tier_2_analysis && (
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <h5 className="font-semibold text-orange-900 mb-3">Tier 2: Influential Bridge Contact Analysis</h5>
                      
                      {/* Bridge Contacts */}
                      <div className="mb-4">
                        <h6 className="font-medium text-orange-800 mb-2">Influential Bridge Contacts</h6>
                        <div className="space-y-2">
                          {connectionAnalysis?.data?.connection_analysis?.tier_2_analysis?.influential_bridge_contacts?.map((contact, index) => (
                            <div key={index} className="p-3 bg-white rounded-lg border">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium text-sm">{contact.bridge_contact_name}</div>
                                  <div className="text-xs text-gray-600">{contact.industry_influence}</div>
                                  <div className="text-xs text-gray-600">Network: {contact.sports_industry_network_size}</div>
                                </div>
                                <Badge className={
                                  contact.connection_strength_to_yp === 'STRONG' ? 'bg-green-100 text-green-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }>
                                  {contact.connection_strength_to_yp}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-700">
                                <div><strong>Relationship:</strong> {contact.relationship_to_yp}</div>
                                <div><strong>Target Connections:</strong> {contact.target_connections.length} to target entity</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tier 2 Introduction Paths */}
                      <div>
                        <h6 className="font-medium text-orange-800 mb-2">Tier 2 Introduction Paths</h6>
                        <div className="space-y-2">
                          {connectionAnalysis?.data?.connection_analysis?.tier_2_analysis?.tier_2_introduction_paths?.map((path, index) => (
                            <div key={index} className="p-3 bg-white rounded-lg border">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium text-sm">{path.path_description}</div>
                                  <div className="text-xs text-gray-600">{path.introduction_strategy}</div>
                                  <div className="text-xs text-gray-600">Timeline: {path.estimated_timeline}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={
                                    path.connection_strength === 'STRONG' ? 'bg-green-100 text-green-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }>
                                    {path.connection_strength}
                                  </Badge>
                                  <span className="text-xs font-bold">{path.confidence_score}%</span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-700">
                                <div><strong>Success Probability:</strong> {path.success_probability}</div>
                                <div><strong>Path Type:</strong> {path.path_type.replace('_', ' ')}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {connectionAnalysis?.status === 'loading' && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h5 className="font-semibold text-blue-900 mb-2">Analyzing Connections</h5>
                      <p className="text-sm text-blue-700">Please wait while we analyze LinkedIn connections...</p>
                    </div>
                  )}

                  {connectionAnalysis?.status === 'failed' && (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <h5 className="font-semibold text-red-900 mb-2">Analysis Failed</h5>
                      <p className="text-sm text-red-700">Connection analysis could not be completed. Please try again.</p>
                    </div>
                  )}

                  {!connectionAnalysis && (
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => setIsLoadingIntelligence(true)}
                    >
                      <Network className="h-4 w-4 mr-2" />
                      Execute LinkedIn Connection Analysis
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Introduction Strategies */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    Team-Specific Introduction Strategies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h6 className="font-medium mb-2">Direct Approach</h6>
                      <p className="text-sm text-gray-700 mb-2">
                        When the lead Yellow Panther contact or other UK team members have direct connections to target executives.
                      </p>
                      <div className="text-xs text-blue-600">
                        Success Rate: 85%+ | Timeline: 1-2 weeks
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h6 className="font-medium mb-2">Mutual Connection</h6>
                      <p className="text-sm text-gray-700 mb-2">
                        Leverage shared connections to facilitate warm introductions with context.
                      </p>
                      <div className="text-xs text-blue-600">
                        Success Rate: 65-75% | Timeline: 2-4 weeks
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h6 className="font-medium mb-2">Company Network</h6>
                      <p className="text-sm text-gray-700 mb-2">
                        Utilize former colleagues, alumni networks, and professional associations.
                      </p>
                      <div className="text-xs text-blue-600">
                        Success Rate: 45-55% | Timeline: 3-6 weeks
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h6 className="font-medium mb-2">Collaborative Approach</h6>
                      <p className="text-sm text-gray-700 mb-2">
                        Multiple YP team members combining networks for optimal path identification.
                      </p>
                      <div className="text-xs text-blue-600">
                        Success Rate: 70-80% | Timeline: 2-3 weeks
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Outreach Strategy Tab */}
        <TabsContent value="outreach" className="space-y-4">
          <OutreachStrategyPanel
            entity={entity}
            dossier={dossier || null}
            hypotheses={hypotheses}
            signals={signals}
            linkedInData={enhancedData?.linkedInProfile || null}
            enabled={activeTab === 'outreach'}
            onApproveOutreach={(strategy) => {
              console.log('Outreach strategy approved:', strategy)
              // TODO: Implement approval logic (save to database, trigger workflow, etc.)
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
