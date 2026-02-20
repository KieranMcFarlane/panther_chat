/**
 * Universal Entity Dossier Prompts for Hypothesis-Driven Discovery
 *
 * STRATEGIC PURPOSE:
 * 1. Scale across 3,000+ entities with tiered generation
 * 2. Surface procurement/capability signals for RFP detection
 * 3. Provide structured intelligence for AI reasoning + human decision-making
 * 4. Identify Yellow Panther service fit with actionable confidence scores
 *
 * OUTPUT STRUCTURE:
 * - Designed to feed directly into hypothesis generation
 * - Each section includes: signals, confidence, recommendations, next_steps
 * - Metadata tags for filtering and prioritization
 */

export const UNIVERSAL_CLUB_DOSSIER_PROMPT = `
You are a business intelligence analyst generating entity dossiers for an automated RFP discovery system.

TARGET ENTITY:
Name: {name}
Type: {type}
Industry: {industry}
Current Data: {currentData}

OBJECTIVE:
Generate a comprehensive dossier that identifies:
1. PROCUREMENT SIGNALS: Indicators of upcoming purchasing decisions
2. CAPABILITY SIGNALS: Technology gaps and digital maturity levels
3. TIMING SIGNALS: Contract windows, strategic cycles, budget availability
4. CONTACT SIGNALS: Decision makers, influence mapping, optimal introduction paths

CRITICAL REQUIREMENTS:
- DO NOT copy example content literally
- Generate entity-specific analysis using ONLY the provided entity data
- Use placeholders when specific information is unavailable
- Assign confidence scores (0-100) to all assertions
- Tag each insight with signal type: [PROCUREMENT] [CAPABILITY] [TIMING] [CONTACT]

OUTPUT STRUCTURE:
{
  "metadata": {
    "entity_id": "{name}",
    "generated_at": "timestamp",
    "data_freshness": "score_0_100",
    "confidence_overall": "score_0_100",
    "priority_signals": ["array of signal tags"]
  },
  "executive_summary": {
    "overall_assessment": {
      "digital_maturity": {
        "score": 0-100,
        "trend": "improving|stable|declining",
        "key_strengths": ["specific to entity"],
        "key_gaps": ["specific to entity"]
      },
      "procurement_readiness": {
        "budget_availability": "unknown|low|medium|high",
        "decision_horizon": "immediate|0-3months|3-6months|6-12months|12+months",
        "strategic_fit": "score_0_100"
      },
      "yellow_panther_opportunity": {
        "service_fit": ["specific Yellow Panther services that match entity needs"],
        "entry_point": "pilot|partnership|vendor replacement|new initiative",
        "competitive_advantage": "why Yellow Panther vs alternatives",
        "estimated_probability": "score_0_100"
      }
    },
    "quick_actions": [
      {
        "action": "specific next step",
        "priority": "HIGH|MEDIUM|LOW",
        "timeline": "specific timeframe",
        "owner": "who should act",
        "success_criteria": "measurable outcome"
      }
    ],
    "key_insights": [
      {
        "insight": "specific observation about entity",
        "signal_type": "[PROCUREMENT]|[CAPABILITY]|[TIMING]|[CONTACT]",
        "confidence": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "source": "specific data point or observation",
        "hypothesis_ready": true/false
      }
    ]
  },
  "digital_infrastructure": {
    "current_tech_stack": {
      "website_platform": "specific if known, otherwise 'unknown'",
      "crm_system": "specific if known, otherwise 'unknown'",
      "analytics_platform": "specific if known, otherwise 'unknown'",
      "mobile_apps": "yes/no/partial",
      "ecommerce": "yes/no/partial",
      "data_infrastructure": "description if available"
    },
    "vendor_relationships": [
      {
        "vendor": "specific company name if known",
        "services": "what they provide",
        "contract_duration": "if known",
        "renewal_window": "estimated if available",
        "satisfaction_indicator": "signs of satisfaction or friction"
      }
    ],
    "digital_maturity_metrics": {
      "transformation_score": 0-100,
      "innovation_velocity": "low|medium|high",
      "data_sophistication": "basic|intermediate|advanced",
      "customer_obsession": "score_0_100",
      "integration_readiness": "score_0_100"
    },
    "capability_gaps": [
      {
        "gap": "specific missing capability",
        "urgency": "immediate|near-term|long-term",
        "yellow_panther_fit": "which Yellow Panther service addresses this",
        "procurement_likelihood": "score_0_100"
      }
    ]
  },
  "procurement_signals": {
    "upcoming_opportunities": [
      {
        "opportunity": "specific initiative or project",
        "type": "new_project|renewal|expansion|replacement",
        "estimated_budget": "unknown|low|medium|high|specific",
        "timeline": "specific window",
        "decision_makers": ["roles"],
        "rfp_probability": 0-100,
        "yellow_panther_fit": {
          "services": ["relevant offerings"],
          "competitive_positioning": "why Yellow Panther",
          "win_probability": 0-100
        },
        "next_actions": ["concrete steps"],
        "hypothesis_id": "auto-generated unique identifier"
      }
    ],
    "budget_indicators": [
      {
        "indicator": "specific sign of budget allocation",
        "confidence": 0-100,
        "relevance": "HIGH|MEDIUM|LOW",
        "source": "where observed"
      }
    ],
    "strategic_initiatives": [
      {
        "initiative": "named strategic effort",
        "description": "what it entails",
        "phase": "announcement|planning|execution|expansion",
        "technology_needs": ["specific requirements"],
        "partnership_opportunities": ["vendor types needed"]
      }
    ]
  },
  "leadership_analysis": {
    "decision_makers": [
      {
        "name": "specific if known, else {ROLE}",
        "title": "specific title",
        "responsibility_scope": "what they control",
        "influence_level": "HIGH|MEDIUM|LOW",
        "communication_style": "analytical|relationship|story-driven|direct",
        "tech_savviness": "low|medium|high",
        "risk_appetite": "conservative|moderate|aggressive",
        "decision_criteria": ["what matters to them"],
        "contact_preferences": {
          "channel": "email|linkedin|intro|cold|conference",
          "messaging": "what resonates",
          "timing": "when to approach"
        },
        "yellow_panther_angle": {
          "value_proposition": "how to frame YP value",
          "use_cases": ["relevant examples"],
          "success_metrics": ["what they care about"]
        }
      }
    ],
    "influence_network": {
      "internal_champions": ["roles who would advocate"],
      "blockers": ["roles who might resist"],
      "decision_process": "how decisions get made",
      "approval_chain": ["roles in order"]
    }
  },
  "timing_analysis": {
    "contract_windows": [
      {
        "contract": "specific if known",
        "vendor": "current provider if known",
        "renewal_date": "estimated if known",
        "rfp_window": "when RFP likely",
        "probability": 0-100,
        "action_deadline": "when to engage"
      }
    ],
    "strategic_cycles": {
      "budget_cycle": "when fiscal planning happens",
      "planning_horizon": "how far out they plan",
      "procurement_peaks": ["times of year with more activity"]
    },
    "urgency_indicators": [
      {
        "indicator": "specific urgency signal",
        "type": "deadline|pressure|opportunity|threat",
        "window": "timeframe",
        "action_required": "what to do"
      }
    ]
  },
  "risk_assessment": {
    "implementation_risks": [
      {
        "risk": "specific challenge",
        "probability": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "mitigation": "how to address",
        "yellow_panther_differentiation": "how YP mitigates this"
      }
    ],
    "competitive_landscape": {
      "incumbent_vendors": ["who already has relationships"],
      "alternative_providers": ["who else competes"],
      "switching_costs": "barriers to change",
      "yellow_panther_advantages": ["where YP wins"]
    }
  },
  "recommended_approach": {
    "immediate_actions": [
      {
        "action": "specific step",
        "priority": "HIGH|MEDIUM|LOW",
        "timeline": "when",
        "responsible": "who",
        "success_criteria": "measurable outcome",
        "hypothesis_to_test": "what this validates"
      }
    ],
    "hypothesis_generation": {
      "primary_hypothesis": {
        "statement": "testable assertion about procurement likelihood",
        "confidence": 0-100,
        "validation_strategy": "how to test",
        "success_metrics": ["what to measure"],
        "next_signals": ["what to look for next"]
      },
      "secondary_hypotheses": [
        {
          "statement": "alternative hypothesis",
          "confidence": 0-100,
          "relationship_to_primary": "support|contradict|independent"
        }
      ]
    },
    "resource_allocation": {
      "sales_effort": "hours_per_week",
      "technical_preparation": "what needs building",
      "partnership_leverage": "who else can help",
      "budget_required": "estimated investment"
    }
  },
  "next_steps": {
    "monitoring_triggers": [
      {
        "signal": "what event to watch for",
        "source": "where to look",
        "frequency": "how often to check",
        "alert_threshold": "when to take action"
      }
    ],
    "data_gaps": [
      {
        "missing_info": "what we don't know",
        "importance": "why it matters",
        "collection_method": "how to get it",
        "priority": "HIGH|MEDIUM|LOW"
      }
    ],
    "engagement_sequence": [
      {
        "step": 1,
        "action": "specific outreach or activity",
        "timing": "when",
        "channel": "how",
        "messaging": "key points",
        "success_indicator": "what constitutes progress"
      }
    ]
  }
}

GENERATION RULES:

1. ENTITY-SPECIFIC CONTENT:
   - Every insight must be about THIS entity, not a template
   - Use "unknown" or "not available" when data is missing
   - Never copy Arsenal or any other club's data literally
   - Reference actual observations from the entity data provided

2. CONFIDENCE SCORING:
   - Base confidence on data availability and recency
   - Explicitly state uncertainty
   - Distinguish between "observed" vs "inferred" insights
   - Flag assumptions requiring validation

3. SIGNAL TAGGING:
   - [PROCUREMENT]: Active buying signals, RFP likelihood, budget movement
   - [CAPABILITY]: Tech gaps, digital maturity, infrastructure needs
   - [TIMING]: Contract windows, strategic cycles, urgency indicators
   - [CONTACT]: Decision makers, influence mapping, introduction paths

4. HYPOTHESIS GENERATION:
   - Each dossier should produce 3-5 testable hypotheses
   - Hypotheses must be specific, measurable, and actionable
   - Include validation strategies and success metrics
   - Link hypotheses to specific signal types

5. HUMAN-AI COLLABORATION:
   - Include both structured data (for AI) and narrative summaries (for humans)
   - Provide clear next steps with ownership and timelines
   - Flag areas requiring human judgment vs. automated monitoring
   - Balance comprehensive analysis with actionable brevity

Remember: This dossier will feed into an automated hypothesis-driven discovery system that scans 3,000+ entities for RFP opportunities. Every insight should help prioritize which entities deserve human sales attention and automated monitoring.

Generate the dossier now for {name}.
`;

/**
 * Tiered Generation Prompts for Priority-Based Processing
 */

export const BASIC_DOSSIER_PROMPT = `
Generate BASIC tier dossier for {name} (3 sections, ~5s, ~$0.0004):

Focus on:
1. Core entity information (name, type, industry, website, size)
2. Quick opportunity assessment (priority score 0-100, key signals)
3. Immediate next steps (1-2 actions, monitoring triggers)

Use UNIVERSAL_CLUB_DOSSIER_PROMPT structure but limit to:
- metadata
- executive_summary.overall_assessment (brief)
- executive_summary.quick_actions (top 3 only)
- next_steps.monitoring_triggers (5 high-priority signals)

Confidence scores required. Skip unavailable data - use "unknown".
`;

export const STANDARD_DOSSIER_PROMPT = `
Generate STANDARD tier dossier for {name} (7 sections, ~15s, ~$0.0095):

Include:
1. Core entity information
2. Executive summary with key insights
3. Digital infrastructure overview
4. Procurement signals (opportunities + budget indicators)
5. Leadership analysis (top 3 decision makers)
6. Risk assessment (major risks only)
7. Recommended approach (primary hypothesis + next steps)

Use UNIVERSAL_CLUB_DOSSIER_PROMPT structure. Skip unavailable data.
`;

export const PREMIUM_DOSSIER_PROMPT = UNIVERSAL_CLUB_DOSSIER_PROMPT;

/**
 * Prompt Interpolation Helper
 */
export const generateDossierPrompt = (
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM',
  entityName: string,
  entityType: string,
  industry: string,
  currentData: any
): string => {
  const prompts = {
    BASIC: BASIC_DOSSIER_PROMPT,
    STANDARD: STANDARD_DOSSIER_PROMPT,
    PREMIUM: PREMIUM_DOSSIER_PROMPT
  };

  return prompts[tier]
    .replace(/{name}/g, entityName)
    .replace(/{type}/g, entityType)
    .replace(/{industry}/g, industry)
    .replace(/{currentData}/g, JSON.stringify(currentData, null, 2));
};

/**
 * Hypothesis Generation Helper
 * Extracts hypothesis-ready insights from completed dossier
 */
export const extractHypothesesFromDossier = (dossier: any) => {
  const hypotheses: any[] = [];

  // Extract from executive summary insights marked as hypothesis_ready
  dossier.executive_summary?.key_insights?.forEach((insight: any) => {
    if (insight.hypothesis_ready) {
      hypotheses.push({
        statement: insight.insight,
        signal_type: insight.signal_type,
        confidence: insight.confidence,
        impact: insight.impact,
        source: insight.source,
        entity_id: dossier.metadata.entity_id
      });
    }
  });

  // Extract primary and secondary hypotheses
  if (dossier.recommended_approach?.hypothesis_generation) {
    const hg = dossier.recommended_approach.hypothesis_generation;

    if (hg.primary_hypothesis) {
      hypotheses.push({
        ...hg.primary_hypothesis,
        entity_id: dossier.metadata.entity_id,
        type: 'PRIMARY'
      });
    }

    hg.secondary_hypotheses?.forEach((h: any) => {
      hypotheses.push({
        ...h,
        entity_id: dossier.metadata.entity_id,
        type: 'SECONDARY'
      });
    });
  }

  // Extract from procurement opportunities
  dossier.procurement_signals?.upcoming_opportunities?.forEach((opp: any) => {
    if (opp.rfp_probability > 50) {
      hypotheses.push({
        statement: `RFP likely for ${opp.opportunity} (${opp.type})`,
        signal_type: '[PROCUREMENT]',
        confidence: opp.rfp_probability,
        opportunity_type: opp.type,
        timeline: opp.timeline,
        yellow_panther_fit: opp.yellow_panther_fit,
        entity_id: dossier.metadata.entity_id,
        type: 'OPPORTUNITY'
      });
    }
  });

  return hypotheses;
};

/**
 * Signal Extraction Helper
 * Pulls tagged signals for filtering and prioritization
 */
export const extractSignalsFromDossier = (dossier: any) => {
  const signals: any[] = [];

  // Executive summary signals
  dossier.executive_summary?.key_insights?.forEach((insight: any) => {
    signals.push({
      type: insight.signal_type,
      insight: insight.insight,
      confidence: insight.confidence,
      impact: insight.impact,
      source: insight.source,
      entity_id: dossier.metadata.entity_id,
      section: 'executive_summary'
    });
  });

  // Procurement signals
  dossier.procurement_signals?.upcoming_opportunities?.forEach((opp: any) => {
    signals.push({
      type: '[PROCUREMENT]',
      insight: `Opportunity: ${opp.opportunity}`,
      confidence: opp.rfp_probability,
      timeline: opp.timeline,
      entity_id: dossier.metadata.entity_id,
      section: 'procurement'
    });
  });

  // Timing signals
  dossier.timing_analysis?.contract_windows?.forEach((window: any) => {
    signals.push({
      type: '[TIMING]',
      insight: `Contract renewal: ${window.contract}`,
      confidence: window.probability,
      deadline: window.action_deadline,
      entity_id: dossier.metadata.entity_id,
      section: 'timing'
    });
  });

  // Contact signals
  dossier.leadership_analysis?.decision_makers?.forEach((leader: any) => {
    signals.push({
      type: '[CONTACT]',
      insight: `Decision maker: ${leader.name} - ${leader.title}`,
      influence: leader.influence_level,
      channel: leader.contact_preferences?.channel,
      entity_id: dossier.metadata.entity_id,
      section: 'leadership'
    });
  });

  return signals;
};

/**
 * Priority Calculation Helper
 * Determines dossier tier based on entity priority score
 */
export const calculateDossierTier = (
  priorityScore: number
): 'BASIC' | 'STANDARD' | 'PREMIUM' => {
  if (priorityScore <= 20) return 'BASIC';      // 3 sections, ~5s
  if (priorityScore <= 50) return 'STANDARD';   // 7 sections, ~15s
  return 'PREMIUM';                              // 11 sections, ~30s
};

/**
 * Cost Estimation Helper
 */
export const estimateDossierCost = (tier: 'BASIC' | 'STANDARD' | 'PREMIUM') => {
  const costs = {
    BASIC: 0.0004,
    STANDARD: 0.0095,
    PREMIUM: 0.057
  };
  return costs[tier];
};

/**
 * Batch Processing Configuration
 * For processing 3,000 entities efficiently
 */
export const BATCH_CONFIG = {
  // Cost per tier (in USD)
  tier_costs: {
    BASIC: 0.0004,
    STANDARD: 0.0095,
    PREMIUM: 0.057
  },

  // Time per tier (in seconds)
  tier_times: {
    BASIC: 5,
    STANDARD: 15,
    PREMIUM: 30
  },

  // Batch size limits (for parallel processing)
  max_concurrent: 10,
  batch_size: 50,

  // Priority distribution (estimate for 3,000 entities)
  priority_distribution: {
    BASIC: 0.60,      // 1,800 entities @ $0.72 total
    STANDARD: 0.30,   // 900 entities @ $8.55 total
    PREMIUM: 0.10     // 300 entities @ $17.10 total
  },

  // Total estimated cost for 3,000 entities
  total_cost_estimate: 26.37, // USD
  total_time_estimate: 14.5   // hours (assuming 10 concurrent)
};

export default UNIVERSAL_CLUB_DOSSIER_PROMPT;
