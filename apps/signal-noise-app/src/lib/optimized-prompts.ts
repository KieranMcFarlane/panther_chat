/**
 * 🚀 OPTIMIZED PROMPT SYSTEM FOR ENHANCED AI REASONING
 * 
 * This file contains optimized prompts designed for:
 * - Better structured outputs
 * - Improved accuracy and consistency
 * - Reduced token usage
 * - Enhanced business intelligence
 * - Faster processing times
 */

export interface OptimizedPromptConfig {
  temperature: number;
  maxTokens: number;
  responseFormat: 'json' | 'text';
  includeExamples: boolean;
  verbosity: 'concise' | 'detailed' | 'comprehensive';
}

export class OptimizedPrompts {
  /**
   * OPTIMIZED ENTITY ANALYSIS PROMPT
   * 
   * Improvements:
   * - Structured with clear sections
   * - Specific constraints for better outputs
   * - Reduced ambiguity
   * - Enhanced business focus
   */
  static getOptimizedEntityAnalysisPrompt(entityData: any, context: any, trends: any, config: Partial<OptimizedPromptConfig> = {}): string {
    const {
      temperature = 0.2,
      maxTokens = 2000,
      verbosity = 'detailed'
    } = config;

    const verbosityLevel = {
      concise: 'Provide 2-3 key insights per section',
      detailed: 'Provide 3-5 key insights per section with specific examples',
      comprehensive: 'Provide 5-7 detailed insights per section with quantitative analysis'
    };

    return `You are an elite business intelligence analyst specializing in sports industry partnerships and technology procurement. Analyze the following entity for strategic opportunities.

ENTITY PROFILE:
- Name: ${entityData.name}
- Type: ${entityData.type || 'Unknown'}
- Sport: ${entityData.sport || 'N/A'}
- Country: ${entityData.country || 'N/A'}
- Priority: ${entityData.priorityScore || 'N/A'}

CONTEXTUAL DATA:
${JSON.stringify(context, null, 2)}

RECENT TRENDS:
${JSON.stringify(trends, null, 2)}

ANALYSIS REQUIREMENTS:
${verbosityLevel[verbosity]}

Generate structured analysis with these exact sections:

1. EXECUTIVE SUMMARY:
   - Current business status (1-2 sentences)
   - Top opportunity (specific and actionable)
   - Urgency level (high/medium/low) with rationale

2. TECHNOLOGY LANDSCAPE:
   - Current technology stack and capabilities
   - Identified gaps and modernization needs
   - Digital transformation readiness (1-10 scale)

3. PROCUREMENT OPPORTUNITIES:
   - High-probability technology needs in next 6-12 months
   - Budget cycle timing and procurement patterns
   - Decision-making process and key stakeholders

4. PARTNERSHIP POTENTIAL:
   - Strategic partnership opportunities with revenue potential
   - Brand alignment and market positioning benefits
   - Competitive differentiation opportunities

5. ACTIONABLE INTELLIGENCE:
   - 3 specific immediate actions (next 30 days)
   - 2 medium-term strategies (3-6 months)
   - 1 long-term positioning play (6-12 months)

RESPONSE FORMAT (Strict JSON):
{
  "executive_summary": {
    "status": "Brief status description",
    "top_opportunity": "Specific opportunity with estimated value",
    "urgency": "high|medium|low",
    "urgency_rationale": "Why this timing matters"
  },
  "technology_landscape": {
    "current_capabilities": ["Current tech 1", "Current tech 2"],
    "identified_gaps": ["Gap 1", "Gap 2"],
    "transformation_readiness": 7.5,
    "modernization_priority": "high|medium|low"
  },
  "procurement_opportunities": [{
    "technology_need": "Specific technology",
    "probability": 0.8,
    "timeline": "Q1 2024|Q2 2024|etc",
    "estimated_budget": "£X-Y",
    "decision_makers": ["Role 1", "Role 2"],
    "procurement_stage": "awareness|evaluation|procurement"
  }],
  "partnership_potential": [{
    "type": "technology|sponsorship|content",
    "description": "Specific partnership opportunity",
    "revenue_potential": "£X-Y annually",
    "strategic_value": "high|medium|low",
    "market_impact": "Description of market impact"
  }],
  "actionable_intelligence": {
    "immediate_actions": [
      {
        "action": "Specific action item",
        "owner": "Who should execute",
        "timeline": "Specific timeframe",
        "success_metric": "How to measure success"
      }
    ],
    "medium_term_strategies": [
      {
        "strategy": "Specific strategy",
        "resources_required": "What's needed",
        "expected_outcome": "Specific result"
      }
    ],
    "long_term_positioning": {
      "strategy": "Long-term play",
      "investment_required": "Time/money/resources",
      "competitive_advantage": "Why this matters"
    }
  },
  "confidence_score": 85,
  "analysis_date": "${new Date().toISOString()}"
}

Constraints:
- Respond ONLY with valid JSON
- Be specific and actionable, not theoretical
- Include realistic financial estimates where possible
- Focus on opportunities within 12-month horizon
- Confidence score reflects data quality and certainty level`;
  }

  /**
   * OPTIMIZED WEBHOOK CONTENT ANALYSIS PROMPT
   * 
   * Improvements:
   * - Faster processing with focused analysis
   * - Better urgency detection
   * - Improved relevance scoring
   * - Enhanced actionability
   */
  static getOptimizedWebhookAnalysisPrompt(content: string, keywords: string[], entityContext: string, config: Partial<OptimizedPromptConfig> = {}): string {
    const {
      temperature = 0.1,
      maxTokens = 800,
      verbosity = 'concise'
    } = config;

    return `You are an intelligent content analyst for sports business opportunities. Analyze this content quickly and accurately.

CONTENT: "${content}"
MATCHED KEYWORDS: ${keywords.join(', ')}
ENTITY CONTEXT: ${entityContext}

ANALYSIS FOCUS:
- Is this a relevant business opportunity?
- How urgent is this opportunity?
- What immediate actions should be taken?

RESPOND WITH JSON ONLY:
{
  "relevance_score": 0-100,
  "urgency_level": "low|medium|high|critical",
  "opportunity_type": "partnership|procurement|intelligence|threat",
  "business_impact": "Brief impact description (max 50 words)",
  "recommended_actions": [
    {
      "action": "Specific immediate action",
      "priority": "high|medium|low",
      "deadline": "24h|48h|1w|flexible"
    }
  ],
  "key_stakeholders": ["Stakeholder 1", "Stakeholder 2"],
  "estimated_value": "£X-Y" | "unknown",
  "confidence_score": 0-100,
  "processing_notes": "Any relevant context for team"
}

Scoring criteria:
- Relevance: Direct business opportunity alignment (0-100)
- Urgency: Time sensitivity and competition level
- Confidence: Data quality and clarity assessment`;
  }

  /**
   * OPTIMIZED TREND ANALYSIS PROMPT
   * 
   * Improvements:
   * - Pattern recognition focus
   * - Predictive insights
   * - Competitive intelligence
   */
  static getOptimizedTrendAnalysisPrompt(historicalData: any, timeHorizon: string = '6months'): string {
    return `You are a strategic trends analyst for the sports industry. Analyze patterns and predict future developments.

HISTORICAL DATA:
${JSON.stringify(historicalData, null, 2)}

TIME HORIZON: ${timeHorizon}

ANALYSIS REQUIREMENTS:
1. Identify significant patterns and trends
2. Predict future developments with confidence levels
3. Highlight competitive implications
4. Recommend strategic positioning

RESPONSE FORMAT (JSON):
{
  "identified_patterns": [
    {
      "pattern": "Specific pattern description",
      "frequency": "increasing|stable|decreasing",
      "impact_level": "high|medium|low",
      "confidence": 0.8
    }
  ],
  "predictions": [
    {
      "prediction": "Specific future development",
      "timeline": "1-3mo|3-6mo|6-12mo",
      "probability": 0.7,
      "impact_description": "Why this matters"
    }
  ],
  "competitive_intelligence": {
    "market_shifts": ["Shift 1", "Shift 2"],
    "threat_level": "high|medium|low",
    "opportunity_gaps": ["Gap 1", "Gap 2"]
  },
  "strategic_recommendations": [
    {
      "recommendation": "Specific action",
      "timing": "immediate|planned|future",
      "resource_impact": "low|medium|high"
    }
  ],
  "confidence_overall": 75
}`;
  }

  /**
   * OPTIMIZED RISK ASSESSMENT PROMPT
   * 
   * Improvements:
   * - Quantified risk analysis
   * - Mitigation strategies
   * - Business impact focus
   */
  static getOptimizedRiskAssessmentPrompt(entityData: any, opportunityData: any): string {
    return `You are a risk assessment specialist for sports business partnerships. Conduct comprehensive risk analysis.

ENTITY: ${JSON.stringify(entityData, null, 2)}
OPPORTUNITY: ${JSON.stringify(opportunityData, null, 2)}

RISK CATEGORIES TO ASSESS:
1. Market risks (competition, demand changes)
2. Financial risks (budget, ROI uncertainty)
3. Operational risks (implementation, resources)
4. Reputational risks (brand alignment, PR)
5. Technical risks (integration, capabilities)

RESPONSE FORMAT (JSON):
{
  "overall_risk_score": 0-100,
  "risk_categories": [
    {
      "category": "market|financial|operational|reputational|technical",
      "risk_level": "high|medium|low",
      "probability": 0.0-1.0,
      "impact": "high|medium|low",
      "specific_risks": [
        {
          "risk": "Specific risk description",
          "mitigation_strategy": "How to address this risk",
          "contingency_plan": "Backup plan if risk materializes"
        }
      ]
    }
  ],
  "success_factors": [
    "Critical success factor 1",
    "Critical success factor 2"
  ],
  "deal_breakers": [
    "Condition that would invalidate this opportunity"
  ],
  "recommendation": "pursue|modify|reject|gather_more_info",
  "confidence_score": 0-100
}`;
  }

  /**
   * OPTIMIZED COMPETITIVE INTELLIGENCE PROMPT
   * 
   * Improvements:
   * - Competitive landscape mapping
   - - Differentiation strategies
   * - Market positioning insights
   */
  static getOptimizedCompetitiveIntelligencePrompt(entity: string, marketSegment: string): string {
    return `You are a competitive intelligence analyst for the sports technology sector. Analyze competitive landscape and positioning.

TARGET ENTITY: ${entity}
MARKET SEGMENT: ${marketSegment}

ANALYSIS FRAMEWORK:
1. Competitive landscape mapping
2. Market positioning analysis
3. Differentiation opportunities
4. Threat assessment

RESPONSE FORMAT (JSON):
{
  "competitive_landscape": {
    "direct_competitors": [
      {
        "name": "Competitor name",
        "strengths": ["Strength 1", "Strength 2"],
        "weaknesses": ["Weakness 1", "Weakness 2"],
        "market_share": "X%"
      }
    ],
    "indirect_competitors": [
      {
        "name": "Indirect competitor",
        "threat_level": "high|medium|low"
      }
    ]
  },
  "market_positioning": {
    "current_position": "leader|challenger|follower|niche",
    "positioning_strength": 0-100,
    "differentiation_opportunities": [
      "Opportunity 1 with strategic value"
    ]
  },
  "competitive_advantages": [
    {
      "advantage": "Specific advantage",
      "sustainability": "sustainable|temporary|copyable",
      "value": "high|medium|low"
    }
  ],
  "threat_assessment": {
    "primary_threats": ["Threat 1", "Threat 2"],
    "threat_level": "high|medium|low",
    "vulnerabilities": ["Vulnerability 1", "Vulnerability 2"]
  },
  "strategic_recommendations": [
    {
      "recommendation": "Specific strategic action",
      "priority": "high|medium|low",
      "expected_impact": "Description of expected outcome"
    }
  ]
}`;
  }

  /**
   * Get configuration for different use cases
   */
  static getConfigurations(): Record<string, OptimizedPromptConfig> {
    return {
      // Fast, efficient processing for webhook analysis
      webhook_analysis: {
        temperature: 0.1,
        maxTokens: 800,
        responseFormat: 'json',
        includeExamples: false,
        verbosity: 'concise'
      },

      // Comprehensive entity analysis
      entity_analysis: {
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: 'json',
        includeExamples: true,
        verbosity: 'detailed'
      },

      // Quick trend identification
      trend_analysis: {
        temperature: 0.3,
        maxTokens: 1500,
        responseFormat: 'json',
        includeExamples: false,
        verbosity: 'detailed'
      },

      // Conservative risk assessment
      risk_assessment: {
        temperature: 0.1,
        maxTokens: 1200,
        responseFormat: 'json',
        includeExamples: false,
        verbosity: 'comprehensive'
      },

      // Competitive intelligence
      competitive_intel: {
        temperature: 0.2,
        maxTokens: 1800,
        responseFormat: 'json',
        includeExamples: true,
        verbosity: 'detailed'
      }
    };
  }
}

/**
 * Prompt performance metrics
 */
export interface PromptMetrics {
  tokenUsage: number;
  responseTime: number;
  accuracy: number;
  completionRate: number;
  userSatisfaction: number;
}

/**
 * Prompt optimization utilities
 */
export class PromptOptimizer {
  /**
   * Analyze prompt performance and suggest optimizations
   */
  static analyzePromptPerformance(prompt: string, metrics: PromptMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.tokenUsage > 2000) {
      suggestions.push("Consider reducing prompt length to lower token costs");
    }

    if (metrics.responseTime > 5000) {
      suggestions.push("Optimize for faster processing - reduce complexity");
    }

    if (metrics.accuracy < 80) {
      suggestions.push("Add more specific examples and constraints");
    }

    if (metrics.completionRate < 90) {
      suggestions.push("Simplify output format requirements");
    }

    return suggestions;
  }

  /**
   * Token usage estimator
   */
  static estimateTokenUsage(prompt: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(metrics: PromptMetrics): string {
    return `
Prompt Performance Report:
- Token Usage: ${metrics.tokenUsage} (${metrics.tokenUsage > 2000 ? 'HIGH' : 'OK'})
- Response Time: ${metrics.responseTime}ms (${metrics.responseTime > 5000 ? 'SLOW' : 'OK'})
- Accuracy: ${metrics.accuracy}% (${metrics.accuracy < 80 ? 'NEEDS IMPROVEMENT' : 'GOOD'})
- Completion Rate: ${metrics.completionRate}% (${metrics.completionRate < 90 ? 'CONCERNING' : 'GOOD'})
- User Satisfaction: ${metrics.userSatisfaction}/100
    `.trim();
  }

  /**
   * OPTIMIZED ENTITY CONTEXTUAL KEYWORDS PROMPT
   * 
   * Generates contextual keywords for entity monitoring with RFP/tender focus
   */
  static getEntityContextualKeywordsPrompt(entityName: string, entityType: string, sport: string, existingKeywords: string[]): string {
    return `Generate 10-15 specific contextual monitoring keywords for enhanced RFP/tender detection.

ENTITY DETAILS:
- Name: ${entityName}
- Type: ${entityType}
- Sport: ${sport || 'N/A'}
- Existing Keywords: ${existingKeywords.slice(0, 10).join(', ')}

KEYWORD REQUIREMENTS:
1. Technology procurement terms (digital, software, infrastructure)
2. Business partnership indicators (sponsorship, collaboration, joint venture)
3. RFP/tender signals (procurement, bidding, contract, proposal)
4. Sports-specific opportunities (fan engagement, stadium, broadcasting)
5. Innovation and transformation terms (AI, analytics, cloud, modernization)

OUTPUT FORMAT:
Return as a JSON array of lowercase keywords, maximum 15 terms.
Focus on terms that indicate procurement opportunities or partnership needs.

EXAMPLE: ["digital transformation", "crm system", "fan engagement platform", "data analytics"]`;

  }
}