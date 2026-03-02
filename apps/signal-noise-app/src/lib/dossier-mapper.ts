/**
 * Premium Dossier Mapper
 *
 * Maps PREMIUM dossier JSON structure to the EnhancedClubDossier format
 * expected by the entity page tabs.
 */

export interface PremiumDossier {
  metadata: {
    entity_id: string
    generated_at: string
    tier: string
    priority_score: number
    hypothesis_count: number
    signal_count: number
    data_freshness?: number
    confidence_overall?: number
    priority_signals?: string[]
  }
  executive_summary: {
    overall_assessment: {
      digital_maturity: {
        score: number
        trend: string
        meaning: string
        why: string
        benchmark: string
        action: string
        key_strengths: string[]
        key_gaps: string[]
      }
      procurement_readiness: {
        budget_availability: string
        decision_horizon: string
        strategic_fit: number
      }
      yellow_panther_opportunity: {
        service_fit: string[]
        entry_point: string
        competitive_advantage: string
        estimated_probability: number
      }
    }
    quick_actions: Array<{
      action: string
      priority: string
      timeline: string
      owner: string
      success_criteria: string
    }>
    key_insights: Array<{
      insight: string
      signal_type: string
      confidence: number
      impact: string
      source: string
      hypothesis_ready: boolean
    }>
  }
  digital_infrastructure: {
    current_tech_stack: {
      website_platform: string
      crm_system: string
      analytics_platform: string
      mobile_apps: string
      ecommerce: string
      data_infrastructure: string
    }
    vendor_relationships: Array<{
      vendor: string
      services: string
      contract_duration: string
      renewal_window: string
      satisfaction_indicator: string
    }>
    digital_maturity_metrics: {
      transformation_score: number
      innovation_velocity: string
      data_sophistication: string
      customer_obsession: number
      integration_readiness: number
    }
    capability_gaps: Array<{
      gap: string
      urgency: string
      yellow_panther_fit: string
      procurement_likelihood: number
    }>
  }
  procurement_signals: {
    upcoming_opportunities: Array<{
      opportunity: string
      type: string
      estimated_budget: string
      timeline: string
      decision_makers: string[]
      rfp_probability: number
      yellow_panther_fit: {
        services: string[]
        competitive_positioning: string
        win_probability: number
      }
      next_actions: string[]
      hypothesis_id: string
    }>
    budget_indicators: Array<{
      indicator: string
      confidence: number
      relevance: string
      source: string
    }>
    strategic_initiatives: Array<{
      initiative: string
      description: string
      phase: string
      technology_needs: string[]
      partnership_opportunities: string[]
    }>
  }
  leadership_analysis: {
    decision_makers: Array<{
      name: string
      title: string
      responsibility_scope: string
      influence_level: string
      communication_style: string
      tech_savviness: string
      risk_appetite: string
      decision_criteria: string[]
      contact_preferences: {
        channel: string
        messaging: string
        timing: string
      }
      yellow_panther_angle: {
        value_proposition: string
        use_cases: string[]
        success_metrics: string[]
      }
    }>
    influence_network: {
      internal_champions: string[]
      blockers: string[]
      decision_process: string
      approval_chain: string[]
    }
  }
  timing_analysis: {
    contract_windows: Array<{
      contract: string
      vendor: string
      renewal_date: string
      rfp_window: string
      probability: number
      action_deadline: string
    }>
    strategic_cycles: {
      budget_cycle: string
      planning_horizon: string
      procurement_peaks: string[]
    }
    urgency_indicators: Array<{
      indicator: string
      type: string
      window: string
      action_required: string
    }>
  }
  risk_assessment: {
    implementation_risks: Array<{
      risk: string
      probability: number
      impact: string
      mitigation: string
      yellow_panther_differentiation: string
    }>
    competitive_landscape: {
      incumbent_vendors: string[]
      alternative_providers: string[]
      switching_costs: string
      yellow_panther_advantages: string[]
    }
  }
  recommended_approach: {
    immediate_actions: Array<{
      action: string
      priority: string
      timeline: string
      responsible: string
      success_criteria: string
      hypothesis_to_test: string
    }>
    hypothesis_generation: {
      primary_hypothesis: {
        statement: string
        confidence: number
        validation_strategy: string
        success_metrics: string[]
        next_signals: string[]
      }
      secondary_hypotheses: Array<{
        statement: string
        confidence: number
        relationship_to_primary: string
      }>
    }
    resource_allocation: {
      sales_effort: string
      technical_preparation: string
      partnership_leverage: string
      budget_required: string
    }
  }
  outreach_strategy: {
    connection_intelligence: {
      approach_type: string
      mutual_connections: string[]
      conversation_starters: Array<{
        topic: string
        relevance: string
        talking_points: string[]
        risk_level: string
      }>
      current_providers: Array<{
        provider: string
        service: string
        satisfaction_indicators: string
        replacement_opportunity: string
      }>
    }
    conversation_trees: Array<{
      scenario: string
      opening_message: {
        subject_line: string
        body: string
        personalization_tokens: string[]
        expected_response_rate: number
      }
      response_branches: Array<{
        response_type: string
        probability: number
        follow_up_strategy: {
          message: string
          timing: string
          channel: string
          goal: string
        }
      }>
      depth: number
      success_criteria: string
      anti_patterns: string[]
    }>
    recommended_approach: {
      primary_channel: string
      messaging_angle: string
      timing: string
      confidence: number
      confidence_explanation: string
      next_actions: string[]
    }
  }
  next_steps: {
    monitoring_triggers: Array<{
      signal: string
      source: string
      frequency: string
      alert_threshold: string
    }>
    data_gaps: Array<{
      missing_info: string
      importance: string
      collection_method: string
      priority: string
    }>
    engagement_sequence: Array<{
      step: number
      action: string
      timing: string
      channel: string
      messaging: string
      success_indicator: string
    }>
  }
  extracted_hypotheses: Array<{
    statement: string
    signal_type: string
    confidence: number
    impact?: string
    source: string
    entity_id: string
    type: string
    validation_strategy?: string
    success_metrics?: string[]
    next_signals?: string[]
    relationship_to_primary?: string
    opportunity_type?: string
    timeline?: string
    yellow_panther_fit?: any
  }>
  extracted_signals: Array<{
    type: string
    insight: string
    confidence: number
    impact?: string
    timeline?: string
    deadline?: string
    influence?: string
    urgency?: string
    channel?: string
    entity_id: string
    section: string
    source?: string
    yellow_panther_fit?: string
  }>
  generation_time_seconds: number
}

export interface EnhancedClubDossier {
  coreInfo: {
    name: string
    type: string
    league: string
    founded: string
    hq: string
    stadium: string
    website: string
    employeeRange: string
  }
  digitalTransformation: {
    digitalMaturity: number
    transformationScore: number
    websiteModernness: number
    currentPartner: string
    keyWeaknesses: string[]
    strategicOpportunities: string[]
  }
  aiReasonerFeedback: {
    overallAssessment: string
    yellowPantherOpportunity: string
    engagementStrategy: string
    riskFactors: string[]
    competitiveAdvantages: string[]
    recommendedApproach: string
  }
  strategicOpportunities: {
    immediateLaunch: string[]
    mediumTermPartnerships: string[]
    longTermInitiatives: string[]
    opportunityScores: Record<string, number>
  }
  recentNews: Array<{
    date: string
    headline: string
    source: string
    category: string
    relevanceScore: number
  }>
  keyDecisionMakers: Array<{
    name: string
    role: string
    influenceLevel: string
    decisionScope: string[]
    relationshipMapping: Record<string, any>
    communicationProfile: {
      tone: string
      riskProfile: string
      preferredContact: string
    }
    strategicHooks: string[]
  }>
  leagueContext?: {
    currentPosition: number
    currentPoints: number
    recentForm: string[]
    keyStatistics: {
      wins: number
      draws: number
      losses: number
      goalsFor: number
      goalsAgainst: number
    }
    miniTable: Array<{
      position: number
      club: string
      points: number
      goalDifference: number
    }>
  }
  status: {
    watchlist: boolean
    activeDeal: boolean
    noEntry: boolean
    lastUpdated: string
  }
  hypotheses?: any[]
  signals?: any[]
}

/**
 * Maps a PREMIUM dossier to EnhancedClubDossier format
 * Handles incomplete data (e.g., STANDARD tier responses) gracefully
 * Also handles flat dossier structure from backend dossier generation
 */
export function mapPremiumDossierToEnhanced(
  premiumDossier: any, // Allow any structure since we have multiple formats
  entityProperties?: Record<string, any>
): EnhancedClubDossier {

  // Handle flat dossier structure (from backend dossier generation)
  if (premiumDossier.core_information || premiumDossier.leadership_profile) {
    const coreInfo = premiumDossier.core_information || {};
    const leadership = premiumDossier.leadership_profile || {};

    const mappedCoreInfo = {
      name: premiumDossier.entity_name || entityProperties?.name || 'Unknown',
      type: premiumDossier.entity_type || 'CLUB',
      league: coreInfo.league || entityProperties?.league || entityProperties?.level || 'Unknown',
      founded: coreInfo.founded || entityProperties?.founded || 'Unknown',
      hq: coreInfo.location || entityProperties?.country || entityProperties?.hq || 'Unknown',
      stadium: coreInfo.stadium || entityProperties?.stadium || 'Unknown',
      website: coreInfo.website || entityProperties?.website || 'Unknown',
      employeeRange: coreInfo.employees || entityProperties?.employee_range || 'Unknown'
    };

    console.log('📊 [dossier-mapper] Mapped flat dossier:', {
      entity: mappedCoreInfo.name,
      founded: mappedCoreInfo.founded,
      stadium: mappedCoreInfo.stadium,
      website: mappedCoreInfo.website,
      source: 'flat_dossier_structure'
    });

    return {
      coreInfo: mappedCoreInfo,

      digitalTransformation: {
        digitalMaturity: premiumDossier.digital_transformation?.digital_maturity_score || 50,
        transformationScore: (premiumDossier.digital_transformation?.digital_maturity_score || 50) + 10,
        websiteModernness: premiumDossier.digital_transformation?.digital_maturity_score || 5,
        currentPartner: premiumDossier.partnerships?.technical_partners?.[0] || 'Unknown',
        keyWeaknesses: premiumDossier.digital_transformation?.key_gaps || ['Data gaps - full analysis pending'],
        strategicOpportunities: premiumDossier.digital_transformation?.strategic_opportunities || ['Partnership opportunities']
      },

      aiReasonerFeedback: {
        overallAssessment: `${premiumDossier.entity_name || 'This club'} presents partnership opportunities`,
        yellowPantherOpportunity: 'Partnership opportunities available',
        engagementStrategy: 'Direct engagement recommended',
        riskFactors: ['Budget constraints', 'Change management', 'Vendor integration'],
        competitiveAdvantages: ['Brand strength', 'Fan base', 'Market position'],
        recommendedApproach: 'Contact for partnership discussion'
      },

      strategicOpportunities: {
        immediateLaunch: premiumDossier.strategic_opportunities?.immediate || [],
        mediumTermPartnerships: premiumDossier.strategic_opportunities?.medium_term || [],
        longTermInitiatives: [],
        opportunityScores: {}
      },

      recentNews: premiumDossier.recent_news?.headlines?.map((h: string, i: number) => ({
        date: premiumDossier.recent_news.date || new Date().toISOString().split('T')[0],
        headline: h,
        source: 'Club sources',
        category: 'general',
        relevanceScore: 80 - (i * 5)
      })) || [],

      keyDecisionMakers: leadership.decision_makers?.map((dm: any) => ({
        name: dm.name,
        role: dm.role,
        influenceLevel: dm.influence_level || 'MEDIUM',
        decisionScope: [dm.role],
        relationshipMapping: {},
        communicationProfile: {
          tone: 'Professional',
          riskProfile: 'MEDIUM',
          preferredContact: 'Direct contact'
        },
        strategicHooks: []
      })) || [],

      status: {
        watchlist: (premiumDossier.priority_score || 50) > 70,
        activeDeal: false,
        noEntry: false,
        lastUpdated: premiumDossier.generated_at || new Date().toISOString()
      }
    };
  }

  // Original structure (from Python backend with full analysis)
  const { metadata, executive_summary, digital_infrastructure, procurement_signals, leadership_analysis, outreach_strategy, extracted_hypotheses, extracted_signals } = premiumDossier;

  // Try to get flat dossier data from entityProperties.dossier_data
  let flatDossier = null;
  if (entityProperties?.dossier_data) {
    try {
      flatDossier = JSON.parse(entityProperties.dossier_data);
    } catch (e) {
      console.log('Could not parse dossier_data from entityProperties:', e);
    }
  }

  // Extract digital maturity score with safe defaults
  const digitalMaturity = executive_summary?.overall_assessment?.digital_maturity?.score || 50;
  const transformationScore = digitalMaturity + 10;
  const digitalMaturityData = executive_summary?.overall_assessment?.digital_maturity || {};

  // Use flat dossier data if available, otherwise fall back to old structure
  const coreInfoFromFlat = flatDossier?.core_information || {};

  return {
    coreInfo: {
      name: entityProperties?.name || flatDossier?.entity_name || metadata?.entity_id || 'Unknown',
      type: entityProperties?.type || flatDossier?.entity_type || 'Professional Football Club',
      league: coreInfoFromFlat.league || entityProperties?.league || entityProperties?.level || metadata?.league_or_competition || 'Unknown',
      founded: coreInfoFromFlat.founded || entityProperties?.founded_year || entityProperties?.founded || metadata?.founded || 'Unknown',
      hq: coreInfoFromFlat.location || entityProperties?.country || entityProperties?.hq || metadata?.country || 'Unknown',
      stadium: coreInfoFromFlat.stadium || entityProperties?.stadium || metadata?.stadium || 'Unknown',
      website: coreInfoFromFlat.website || entityProperties?.website || 'Unknown',
      employeeRange: coreInfoFromFlat.employees || entityProperties?.employee_range || 'Unknown'
    },

    digitalTransformation: {
      digitalMaturity,
      transformationScore,
      websiteModernness: Math.round(digitalMaturity / 10),
      currentPartner: flatDossier?.partnerships?.technical_partners?.[0] || digital_infrastructure?.vendor_relationships?.[0]?.vendor || 'Unknown',
      keyWeaknesses: digitalMaturityData.key_gaps || ['Data gaps - upgrade to PREMIUM tier for full analysis'],
      strategicOpportunities: digitalMaturityData.key_strengths || ['Digital partnership opportunities']
    },

    aiReasonerFeedback: {
      overallAssessment: digitalMaturityData.meaning || 'Intelligence dossier available',
      yellowPantherOpportunity: executive_summary?.overall_assessment?.yellow_panther_opportunity?.service_fit?.join(', ') || 'Partnership opportunities available',
      engagementStrategy: executive_summary?.overall_assessment?.yellow_panther_opportunity?.entry_point || 'Direct engagement recommended',
      riskFactors: premiumDossier.risk_assessment?.implementation_risks?.map(r => r.risk) || [],
      competitiveAdvantages: premiumDossier.risk_assessment?.competitive_landscape?.yellow_panther_advantages || [],
      recommendedApproach: executive_summary?.overall_assessment?.yellow_panther_opportunity?.competitive_advantage || 'Contact for partnership discussion'
    },

    strategicOpportunities: {
      immediateLaunch: flatDossier?.strategic_opportunities?.immediate || procurement_signals?.upcoming_opportunities?.map(o => o.opportunity) || [],
      mediumTermPartnerships: flatDossier?.strategic_opportunities?.medium_term || procurement_signals?.strategic_initiatives?.map(i => i.initiative) || [],
      longTermInitiatives: [],
      opportunityScores: {}
    },

    recentNews: (flatDossier?.recent_news?.headlines || []).map((h: string, i: number) => ({
      date: flatDossier?.recent_news?.date || new Date().toISOString().split('T')[0],
      headline: h,
      source: 'Club sources',
      category: 'general',
      relevanceScore: 80 - (i * 5)
    })),

    keyDecisionMakers: (flatDossier?.leadership_profile?.decision_makers || leadership_analysis?.decision_makers || []).map((dm: any) => ({
      name: dm.name,
      role: dm.role,
      influenceLevel: dm.influence_level || dm.influence_level || 'MEDIUM',
      decisionScope: [dm.role],
      relationshipMapping: {},
      communicationProfile: {
        tone: dm.communication_style || 'Professional',
        riskProfile: dm.risk_appetite || 'MEDIUM',
        preferredContact: dm.contact_preferences?.channel || 'Direct contact'
      },
      strategicHooks: dm.yellow_panther_angle?.use_cases || []
    })) || [],

    status: {
      watchlist: (metadata.priority_score || 0) > 70,
      activeDeal: executive_summary?.overall_assessment?.yellow_panther_opportunity?.estimated_probability > 60,
      noEntry: executive_summary?.overall_assessment?.yellow_panther_opportunity?.estimated_probability < 30,
      lastUpdated: metadata.generated_at
    },

    hypotheses: extracted_hypotheses || [],
    signals: extracted_signals || []
  };
}

/**
 * Formats a raw dossier for display in tabs
 */
export function formatDossierForTabs(dossier: PremiumDossier) {
  return {
    // Overview tab
    overview: {
      digitalMaturity: dossier.executive_summary.overall_assessment.digital_maturity,
      yellowPantherOpportunity: dossier.executive_summary.overall_assessment.yellow_panther_opportunity,
      quickActions: dossier.executive_summary.quick_actions,
      keyInsights: dossier.executive_summary.key_insights
    },

    // Digital tab
    digital: dossier.digital_infrastructure,

    // Procurement tab
    procurement: dossier.procurement_signals,

    // AI Insights tab
    aiReasoner: {
      overallAssessment: dossier.executive_summary.overall_assessment,
      yellowPantherOpportunity: dossier.executive_summary.overall_assessment.yellow_panther_opportunity,
      riskAssessment: dossier.risk_assessment,
      recommendedApproach: dossier.recommended_approach
    },

    // Opportunities tab
    opportunities: dossier.procurement_signals.upcoming_opportunities,

    // Leadership tab
    leadership: dossier.leadership_analysis,

    // Outreach tab
    outreach: dossier.outreach_strategy,

    // Next Steps tab
    nextSteps: dossier.next_steps,

    // Raw hypotheses and signals
    hypotheses: dossier.extracted_hypotheses,
    signals: dossier.extracted_signals,

    // Metadata
    metadata: dossier.metadata
  };
}
