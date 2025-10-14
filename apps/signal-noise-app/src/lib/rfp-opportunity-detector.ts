/**
 * 🎯 COMPREHENSIVE RFP/TENDER OPPORTUNITY DETECTION SYSTEM
 * 
 * Advanced terminology patterns and detection mechanisms for Yellow Panther
 * to identify procurement opportunities, RFPs, tenders, and potential needs
 */

export interface RFPTerminology {
  category: 'direct_rfp' | 'tender' | 'procurement' | 'upcoming_need' | 'potential_opportunity' | 'budget_indicator';
  terms: string[];
  patterns: RegExp[];
  urgency_level: 'high' | 'medium' | 'low';
  confidence_weight: number;
  business_context: string[];
}

export interface OpportunitySignal {
  type: string;
  confidence: number;
  urgency: string;
  estimated_value?: string;
  timeline?: string;
  stakeholders?: string[];
  required_actions: string[];
  source_indicators: string[];
}

export class RFPOpportunityDetector {
  
  /**
   * COMPREHENSIVE RFP/PROCUREMENT TERMINOLOGY
   */
  static readonly RFPTERMINOLOGY: RFPTerminology[] = [
    {
      category: 'direct_rfp',
      terms: [
        'request for proposal', 'RFP', 'request for tender', 'RFT', 
        'invitation to tender', 'ITT', 'request for quotation', 'RFQ',
        'request for information', 'RFI', 'solicitation', 'bid invitation',
        'procurement notice', 'tender notice', 'contract opportunity',
        'supplier tender', 'vendor solicitation', 'service contract',
        'competitive bidding', 'public tender', 'government contract'
      ],
      patterns: [
        /\b(RFP|RFQ|RFT|ITT|RFI)\s+(is\s+)?(now\s+)?(open|available|released|issued|published)\b/gi,
        /\b(request\s+for\s+(proposal|tender|quotation|information))\b/gi,
        /\b(invitation\s+to\s+tender)\b/gi,
        /\b(procurement\s+notice|tender\s+notice)\b/gi,
        /\b(contract\s+opportunity|service\s+contract)\b/gi
      ],
      urgency_level: 'high',
      confidence_weight: 0.95,
      business_context: ['procurement', 'bidding', 'supplier selection', 'contract award']
    },
    {
      category: 'tender',
      terms: [
        'tender submission', 'bid submission', 'proposal deadline',
        'bidding process', 'tender process', 'bid evaluation',
        'supplier selection', 'vendor selection', 'contract award',
        'tender award', 'bid award', 'successful bidder',
        'pre-qualification', 'vendor pre-qualification', 'supplier registration'
      ],
      patterns: [
        /\b(tender\s+(submission|deadline|process))\b/gi,
        /\b(bid\s+(submission|evaluation|process))\b/gi,
        /\b(supplier|vendor)\s+(selection|pre-qualification)\b/gi,
        /\b(contract\s+award|tender\s+award)\b/gi,
        /\b(pre[-\s]?qualification|vendor\s+registration)\b/gi
      ],
      urgency_level: 'high',
      confidence_weight: 0.90,
      business_context: ['procurement cycle', 'bidding', 'supplier management']
    },
    {
      category: 'procurement',
      terms: [
        'procurement process', 'sourcing initiative', 'supplier evaluation',
        'market testing', 'supplier discovery', 'vendor assessment',
        'procurement strategy', 'sourcing strategy', 'make or buy',
        'outsourcing opportunity', 'service provider selection',
        'partner selection', 'strategic sourcing', 'category management'
      ],
      patterns: [
        /\b(procurement\s+(process|strategy|initiative))\b/gi,
        /\b(sourcing\s+(strategy|initiative|process))\b/gi,
        /\b(supplier\s+(evaluation|assessment|discovery))\b/gi,
        /\b(market\s+testing|vendor\s+assessment)\b/gi,
        /\b(outsourcing\s+opportunity|partner\s+selection)\b/gi
      ],
      urgency_level: 'medium',
      confidence_weight: 0.75,
      business_context: ['strategic sourcing', 'supplier management', 'procurement planning']
    },
    {
      category: 'upcoming_need',
      terms: [
        'upcoming requirement', 'future need', 'planned procurement',
        'budget allocation', 'capital expenditure', 'CAPEX',
        'operational expenditure', 'OPEX', 'investment plan',
        'replacement cycle', 'technology refresh', 'system upgrade',
        'expansion plan', 'growth initiative', 'strategic initiative',
        'digital transformation', 'modernization program'
      ],
      patterns: [
        /\b(upcoming\s+(requirement|need|procurement))\b/gi,
        /\b(planned\s+(procurement|investment|upgrade))\b/gi,
        /\b(budget\s+(allocation|approval|planned))\b/gi,
        /\b(capital\s+expenditure|CAPEX)\b/gi,
        /\b(technology\s+refresh|system\s+upgrade|modernization)\b/gi,
        /\b(replacement\s+cycle|expansion\s+plan)\b/gi
      ],
      urgency_level: 'medium',
      confidence_weight: 0.65,
      business_context: ['planning', 'budgeting', 'strategic initiatives']
    },
    {
      category: 'potential_opportunity',
      terms: [
        'exploring options', 'market research', 'feasibility study',
        'requirements gathering', 'needs assessment', 'gap analysis',
        'solution evaluation', 'proof of concept', 'pilot program',
        'request for information', 'market scan', 'vendor landscape',
        'solution discovery', 'innovation challenge', 'digital strategy'
      ],
      patterns: [
        /\b(exploring\s+(options|solutions|alternatives))\b/gi,
        /\b(market\s+(research|scan|analysis))\b/gi,
        /\b(feasibility\s+study|needs\s+assessment)\b/gi,
        /\b(gap\s+analysis|requirements\s+gathering)\b/gi,
        /\b(proof\s+of\s+concept|pilot\s+program)\b/gi,
        /\b(innovation\s+(challenge|initiative))\b/gi
      ],
      urgency_level: 'low',
      confidence_weight: 0.45,
      business_context: ['early stage', 'research', 'exploration']
    },
    {
      category: 'budget_indicator',
      terms: [
        'budget approved', 'funding secured', 'investment approved',
        'financial commitment', 'spending plan', 'fiscal year budget',
        'quarterly budget', 'annual budget', 'capital budget',
        'project funding', 'program budget', 'initiative funding',
        'approved spend', 'allocated budget', 'investment commitment'
      ],
      patterns: [
        /\b(budget\s+(approved|allocated|secured))\b/gi,
        /\b(funding\s+(secured|approved|committed))\b/gi,
        /\b(investment\s+(approved|committed|planned))\b/gi,
        /\b(capital\s+budget|project\s+funding)\b/gi,
        /\b(approved\s+(spend|expenditure))\b/gi
      ],
      urgency_level: 'medium',
      confidence_weight: 0.80,
      business_context: ['financial planning', 'budget approval', 'investment decisions']
    }
  ];

  /**
   * YELLOW PANTHER SPORTS-SPECIFIC OPPORTUNITY INDICATORS
   * 
   * Tailored specifically for Yellow Panther's expertise in:
   * - Websites, Mobile Apps, E-commerce, Gamification, UI/UX Design
   * - Sports technology platforms and digital transformation
   * - High-value (£500K-£5M+) digital projects
   */
  static readonly SPORTS_OPPORTUNITY_INDICATORS = {
    // Yellow Panther Core Digital Services
    digital_platforms: [
      'website development', 'mobile app development', 'e-commerce platform',
      'UI/UX design', 'user experience design', 'responsive design',
      'progressive web app', 'cross-platform development', 'React/Next.js development',
      'digital platform modernization', 'custom software development', 'full-stack development',
      'progressive web app', 'React development', 'Next.js development', 'Node.js backend'
    ],
    
    // Fan Engagement & Gamification (Yellow Panther Specialty)
    fan_engagement: [
      'fan engagement platform', 'gamification system', 'digital fan experience',
      'mobile app for fans', 'fan loyalty program', 'season ticket digitalization',
      'matchday experience app', 'fan voting systems', 'virtual fan experiences',
      'AR fan interactions', 'live streaming platform', 'social media integration',
      'fan community platform', 'gamified loyalty system', 'interactive content',
      'gamification mechanics', 'reward system', 'fan challenges', 'leaderboards'
    ],
    
    // AI-Powered Analytics (Yellow Panther Advanced)
    ai_analytics: [
      'AI-powered analytics', 'performance analytics platform', 'player tracking system',
      'sports data analytics', 'match analysis software', 'biometric monitoring',
      'tactical analysis tools', 'recruitment analytics', 'injury prediction systems',
      'training optimization', 'sports science platform', 'performance metrics dashboard',
      'machine learning sports', 'predictive analytics', 'real-time data processing',
      'artificial intelligence', 'data visualization', 'business intelligence'
    ],
    
    // E-commerce & Digital Commerce (Yellow Panther Core)
    ecommerce: [
      'e-commerce platform', 'online merchandise store', 'ticketing system',
      'membership program', 'hospitality booking', 'digital marketplace',
      'sports retail platform', 'subscription services', 'digital collectibles',
      'merchandise personalization', 'global shipping solution', 'mobile commerce',
      'payment integration', 'inventory management', 'customer relationship management',
      'CRM system', 'customer data platform', 'personalization engine'
    ],
    
    // Content & Media Platforms
    content_platforms: [
      'content management system', 'live streaming solution', 'digital rights management',
      'sports production platform', 'multi-camera integration', 'commentator tools',
      'highlight generation', 'media asset management', 'broadcast automation',
      'sports content delivery', 'video platform', 'digital media solution',
      'streaming platform', 'video on demand', 'content personalization'
    ],
    
    // Stadium & Smart Venue Technology
    stadium_tech: [
      'stadium Wi-Fi upgrade', 'digital signage', 'smart stadium systems',
      'venue technology', 'stadium app', 'cashless payments', 'turnstile systems',
      'stadium analytics', 'crowd management', 'digital ticketing', 'in-seat services',
      'smart venue solutions', 'connected stadium', 'venue management system',
      'venue app development', 'stadium digital experience'
    ],
    
    // Digital Transformation (Yellow Panther Strategic)
    digital_transformation: [
      'digital transformation partner', 'technology modernization', 'cloud migration',
      'digital strategy consulting', 'system integration', 'API development',
      'legacy system upgrade', 'technology roadmap', 'innovation consulting',
      'digital readiness assessment', 'technology implementation', 'change management',
      'digital strategy', 'technology consulting', 'innovation partner'
    ],
    
    // High-Value Partnerships (Yellow Panther Target)
    commercial_tech: [
      'sponsorship activation platform', 'commercial partnership technology',
      'brand integration systems', 'advertising technology', 'revenue management',
      'commercial analytics', 'partnership tracking', 'brand activation tools',
      'sponsorship ROI analysis', 'commercial dashboard', 'partnership management system',
      'commercial digital platform', 'revenue optimization', 'brand experience platform'
    ]
  };

  /**
   * Detect RFP/tender opportunities in text content
   */
  static detectOpportunities(content: string, entityType: string = 'general'): OpportunitySignal[] {
    const opportunities: OpportunitySignal[] = [];
    const contentLower = content.toLowerCase();

    // Check each terminology category
    for (const terminology of this.RFPTERMINOLOGY) {
      const signals = this.detectTerminologySignals(content, contentLower, terminology, entityType);
      opportunities.push(...signals);
    }

    // Detect sports-specific opportunities if relevant
    if (this.isSportsEntity(entityType)) {
      const sportsOpportunities = this.detectSportsOpportunities(content, contentLower);
      opportunities.push(...sportsOpportunities);
    }

    // Remove duplicates and sort by confidence
    const uniqueOpportunities = this.deduplicateOpportunities(opportunities);
    return uniqueOpportunities.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect signals from specific terminology
   */
  private static detectTerminologySignals(
    content: string, 
    contentLower: string, 
    terminology: RFPTerminology, 
    entityType: string
  ): OpportunitySignal[] {
    const signals: OpportunitySignal[] = [];
    let matchCount = 0;
    const matchedTerms: string[] = [];

    // Check for exact term matches
    for (const term of terminology.terms) {
      if (contentLower.includes(term.toLowerCase())) {
        matchCount++;
        matchedTerms.push(term);
      }
    }

    // Check for pattern matches
    for (const pattern of terminology.patterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        matchCount += matches.length;
        matchedTerms.push(...matches);
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(0.95, matchCount * terminology.confidence_weight);
      
      signals.push({
        type: terminology.category,
        confidence: confidence,
        urgency: terminology.urgency_level,
        source_indicators: matchedTerms,
        required_actions: this.generateRequiredActions(terminology.category, entityType)
      });
    }

    return signals;
  }

  /**
   * Detect sports-specific opportunities
   */
  private static detectSportsOpportunities(content: string, contentLower: string): OpportunitySignal[] {
    const opportunities: OpportunitySignal[] = [];

    for (const [category, indicators] of Object.entries(this.SPORTS_OPPORTUNITY_INDICATORS)) {
      let matchCount = 0;
      const matchedIndicators: string[] = [];

      for (const indicator of indicators) {
        if (contentLower.includes(indicator.toLowerCase())) {
          matchCount++;
          matchedIndicators.push(indicator);
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(0.85, matchCount * 0.15);
        
        opportunities.push({
          type: `sports_${category}`,
          confidence: confidence,
          urgency: this.calculateUrgency(category, contentLower),
          source_indicators: matchedIndicators,
          required_actions: this.generateSportsActions(category)
        });
      }
    }

    return opportunities;
  }

  /**
   * Calculate urgency based on content context
   */
  private static calculateUrgency(category: string, content: string): string {
    const urgentIndicators = [
      'immediate', 'urgent', 'asap', 'deadline', 'closing soon',
      'expedited', 'fast track', 'priority', 'critical', 'time sensitive'
    ];

    const hasUrgentIndicators = urgentIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    );

    if (hasUrgentIndicators) return 'high';
    if (category === 'technology' || category === 'infrastructure') return 'medium';
    return 'low';
  }

  /**
   * Generate required actions based on opportunity type
   */
  private static generateRequiredActions(category: string, entityType: string): string[] {
    const actionMap: Record<string, string[]> = {
      direct_rfp: [
        'Review RFP requirements immediately',
        'Assess qualification criteria',
        'Prepare bid submission timeline',
        'Identify key decision makers',
        'Evaluate competitive positioning'
      ],
      tender: [
        'Monitor tender process',
        'Prepare bid documentation',
        'Assess compliance requirements',
        'Develop partnership strategy'
      ],
      procurement: [
        'Understand procurement timeline',
        'Identify decision influencers',
        'Prepare solution proposal',
        'Establish relationship with procurement team'
      ],
      upcoming_need: [
        'Monitor for formal announcement',
        'Build relationship early',
        'Understand requirements development',
        'Position as preferred solution provider'
      ],
      potential_opportunity: [
        'Engage in needs discussion',
        'Provide thought leadership',
        'Demonstrate solution capabilities',
        'Build strategic relationship'
      ],
      budget_indicator: [
        'Confirm budget allocation details',
        'Understand procurement timeline',
        'Identify decision makers',
        'Prepare solution proposal'
      ]
    };

    return actionMap[category] || ['Monitor opportunity development'];
  }

  /**
   * Generate sports-specific actions
   */
  private static generateSportsActions(category: string): string[] {
    const sportsActionMap: Record<string, string[]> = {
      technology: [
        'Assess current technology stack',
        'Propose digital transformation roadmap',
        'Demonstrate fan engagement capabilities',
        'Showcase analytics and data insights'
      ],
      infrastructure: [
        'Review facility requirements',
        'Propose modernization plans',
        'Demonstrate project management expertise',
        'Showcase similar sports projects'
      ],
      partnerships: [
        'Understand partnership objectives',
        'Prepare commercial proposal',
        'Demonstrate brand alignment',
        'Showcase marketing capabilities'
      ],
      services: [
        'Understand service requirements',
        'Prepare capability statement',
        'Demonstrate relevant experience',
        'Showcase team expertise'
      ]
    };

    return sportsActionMap[category] || ['Assess opportunity fit'];
  }

  /**
   * Remove duplicate opportunities
   */
  private static deduplicateOpportunities(opportunities: OpportunitySignal[]): OpportunitySignal[] {
    const seen = new Set<string>();
    return opportunities.filter(opportunity => {
      const key = `${opportunity.type}_${opportunity.urgency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Yellow Panther Entity Priority Scoring
   * 
   * Scores entities based on Yellow Panther's target market and value potential
   */
  static getYellowPantherEntityScore(entityName: string, entityType: string): {
    score: number;
    tier: string;
    target_value: string;
    priority_keywords: string[];
  } {
    const nameLower = entityName.toLowerCase();
    const typeLower = entityType.toLowerCase();

    // Premier League & Top Tier (Score: 90-100)
    const premierLeagueClubs = [
      'manchester united', 'manchester city', 'liverpool', 'chelsea', 'arsenal',
      'tottenham', 'premier league', 'man city', 'west ham', 'newcastle'
    ];
    
    // Formula 1 & Motorsports (Score: 90-95)
    const formula1Teams = [
      'ferrari', 'mercedes', 'red bull racing', 'mclaren', 'aston martin',
      'alpine', 'alfa romeo', 'haas', 'williams', 'formula 1', 'f1'
    ];

    // Championship & Major Clubs (Score: 80-89)
    const championshipClubs = [
      'leicester city', 'leeds united', 'southampton', 'everton', 'nottingham forest',
      'championship', 'scottish premiership', 'rangers', 'celtic'
    ];

    // High-Value Competitions (Score: 85-95)
    const majorCompetitions = [
      'uefa champions league', 'champions league', 'europa league', 'fifa world cup',
      'olympics', 'six nations', 'wimbledon', 'the open championship'
    ];

    // Scoring Logic
    let score = 50; // Base score
    let tier = 'Standard';
    let target_value = '£50K-£250K';

    if (premierLeagueClubs.some(club => nameLower.includes(club))) {
      score = 95;
      tier = 'Tier 1 - Premier League';
      target_value = '£1M-£5M+';
    } else if (formula1Teams.some(team => nameLower.includes(team))) {
      score = 94;
      tier = 'Tier 1 - Formula 1';
      target_value = '£2M-£10M+';
    } else if (majorCompetitions.some(comp => nameLower.includes(comp))) {
      score = 92;
      tier = 'Tier 1 - Major Competition';
      target_value = '£3M-£15M+';
    } else if (championshipClubs.some(club => nameLower.includes(club))) {
      score = 85;
      tier = 'Tier 2 - Championship';
      target_value = '£500K-£2M';
    } else if (nameLower.includes('stadium') || nameLower.includes('arena')) {
      score = 80;
      tier = 'Tier 2 - Major Venue';
      target_value = '£750K-£3M';
    } else if (nameLower.includes('league') || nameLower.includes('association')) {
      score = 78;
      tier = 'Tier 2 - Sports Organization';
      target_value = '£600K-£2.5M';
    }

    // Boost for sports entities
    if (this.isSportsEntity(entityType)) {
      score += 10;
    }

    return {
      score: Math.min(100, score),
      tier,
      target_value,
      recommended_approach: score >= 90 ? 'premium partnership' : 
                          score >= 80 ? 'strategic collaboration' : 'standard engagement',
      priority_keywords: this.getPriorityKeywords(entityName, score)
    };
  }

  /**
   * Get Yellow Panther priority keywords for entity
   */
  private static getPriorityKeywords(entityName: string, score: number): string[] {
    const baseKeywords = [
      'digital transformation', 'fan engagement', 'mobile app', 'e-commerce',
      'UI/UX design', 'gamification', 'analytics platform', 'CRM system'
    ];

    if (score >= 90) {
      // High-value entities get premium keywords
      return [
        ...baseKeywords,
        'AI-powered platform', 'digital innovation partner', 'premium development',
        'enterprise solutions', 'scalable architecture', 'advanced analytics'
      ];
    } else if (score >= 80) {
      // Mid-tier entities get strategic keywords
      return [
        ...baseKeywords,
        'digital strategy', 'platform modernization', 'fan experience',
        'data analytics', 'mobile optimization', 'engagement platform'
      ];
    }

    return baseKeywords;
  }

  /**
   * Check if entity is sports-related
   */
  private static isSportsEntity(entityType: string): boolean {
    const sportsIndicators = [
      'sports', 'football', 'soccer', 'basketball', 'baseball', 'hockey',
      'tennis', 'golf', 'rugby', 'cricket', 'club', 'team', 'league',
      'athletic', 'stadium', 'arena', 'premier league', 'nfl', 'nba',
      'mlb', 'nhl', 'fifa', 'uefa', 'olympics', 'motorsport', 'f1'
    ];

    return sportsIndicators.some(indicator => 
      entityType.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Generate comprehensive opportunity analysis
   */
  static generateOpportunityAnalysis(content: string, entityType: string): {
    opportunities: OpportunitySignal[];
    summary: string;
    recommendedActions: string[];
    estimatedValue: string;
    timeline: string;
    confidence: number;
  } {
    const opportunities = this.detectOpportunities(content, entityType);
    
    const highConfidenceOpportunities = opportunities.filter(o => o.confidence > 0.7);
    const urgentOpportunities = opportunities.filter(o => o.urgency === 'high');
    
    const summary = this.generateSummary(opportunities, entityType);
    const recommendedActions = this.generateRecommendedActions(opportunities);
    const estimatedValue = this.estimateValue(opportunities, content);
    const timeline = this.estimateTimeline(opportunities);
    const confidence = this.calculateOverallConfidence(opportunities);

    return {
      opportunities,
      summary,
      recommendedActions,
      estimatedValue,
      timeline,
      confidence
    };
  }

  /**
   * Generate opportunity summary
   */
  private static generateSummary(opportunities: OpportunitySignal[], entityType: string): string {
    if (opportunities.length === 0) {
      return 'No immediate procurement opportunities detected.';
    }

    const highUrgency = opportunities.filter(o => o.urgency === 'high').length;
    const directRFP = opportunities.filter(o => o.type === 'direct_rfp').length;
    const upcoming = opportunities.filter(o => o.type === 'upcoming_need').length;

    let summary = `Detected ${opportunities.length} opportunity indicators`;
    
    if (directRFP > 0) {
      summary += `, including ${directRFP} direct RFP opportunities`;
    }
    if (highUrgency > 0) {
      summary += `, with ${highUrgency} high-urgency items`;
    }
    if (upcoming > 0) {
      summary += `, and ${upcoming} upcoming needs`;
    }

    summary += ` for ${entityType}.`;

    return summary;
  }

  /**
   * Generate recommended actions
   */
  private static generateRecommendedActions(opportunities: OpportunitySignal[]): string[] {
    const allActions = new Set<string>();
    
    opportunities.forEach(opportunity => {
      opportunity.required_actions.forEach(action => allActions.add(action));
    });

    return Array.from(allActions).slice(0, 5); // Top 5 actions
  }

  /**
   * Estimate opportunity value
   */
  private static estimateValue(opportunities: OpportunitySignal[], content: string): string {
    const hasBudgetTerms = /\b(£|\$|€)\d+[kmb]|\d+(k|m|b)\s*(£|\$|€)/gi.test(content);
    const hasHighValue = /\b(million|billion|high value|significant)\b/gi.test(content);
    const hasDirectRFP = opportunities.some(o => o.type === 'direct_rfp');

    if (hasDirectRFP && hasBudgetTerms) return 'High Value (£100k-£1M+)';
    if (hasDirectRFP) return 'Medium Value (£50k-£500k)';
    if (hasBudgetTerms) return 'Budget Confirmed';
    if (hasHighValue) return 'Potential High Value';
    return 'Value to be Determined';
  }

  /**
   * Estimate timeline
   */
  private static estimateTimeline(opportunities: OpportunitySignal[]): string {
    const hasUrgent = opportunities.some(o => o.urgency === 'high');
    const hasDirectRFP = opportunities.some(o => o.type === 'direct_rfp');
    const hasUpcoming = opportunities.some(o => o.type === 'upcoming_need');

    if (hasDirectRFP && hasUrgent) return 'Immediate (1-4 weeks)';
    if (hasDirectRFP) return 'Short-term (1-3 months)';
    if (hasUpcoming) return 'Medium-term (3-6 months)';
    return 'To be Determined';
  }

  /**
   * Calculate overall confidence
   */
  private static calculateOverallConfidence(opportunities: OpportunitySignal[]): number {
    if (opportunities.length === 0) return 0;
    
    const avgConfidence = opportunities.reduce((sum, o) => sum + o.confidence, 0) / opportunities.length;
    const hasDirectRFP = opportunities.some(o => o.type === 'direct_rfp');
    const hasMultipleSignals = opportunities.length > 2;

    let confidence = avgConfidence;
    if (hasDirectRFP) confidence += 0.1;
    if (hasMultipleSignals) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

/**
 * Enhanced keyword generation for RFP/tender detection
 */
class RFPKeywordGenerator {
  
  /**
   * Generate comprehensive keywords for RFP/tender monitoring
   */
  static generateRFPKeywords(entityName: string, entityType: string, sector: string = 'general'): string[] {
    const baseKeywords = [
      entityName.toLowerCase(),
      `${entityName.toLowerCase()} procurement`,
      `${entityName.toLowerCase()} tender`,
      `${entityName.toLowerCase()} contract`,
      `${entityName.toLowerCase()} partnership`
    ];

    const rfpterms = RFPOpportunityDetector.RFPTERMINOLOGY.flatMap(t => t.terms);
    const sportsTerms = sector === 'sports' ? Object.values(RFPOpportunityDetector.SPORTS_OPPORTUNITY_INDICATORS).flat() : [];

    return [...baseKeywords, ...rfpterms, ...sportsTerms].slice(0, 100); // Limit to 100 keywords
  }

  /**
   * Generate contextual search terms
   */
  static generateContextualSearchTerms(entityName: string, opportunityType: string): string[] {
    const contextMap: Record<string, string[]> = {
      technology: [
        'digital transformation', 'software implementation', 'system integration',
        'platform development', 'cloud migration', 'data analytics', 'AI implementation'
      ],
      infrastructure: [
        'construction project', 'facility development', 'stadium upgrade',
        'infrastructure modernization', 'building project', 'facility expansion'
      ],
      services: [
        'consulting contract', 'professional services', 'advisory services',
        'management consulting', 'strategic consulting', 'implementation services'
      ]
    };

    const baseTerms = contextMap[opportunityType] || [];
    
    return baseTerms.map(term => `${entityName.toLowerCase()} ${term}`);
  }
}

export { RFPKeywordGenerator };