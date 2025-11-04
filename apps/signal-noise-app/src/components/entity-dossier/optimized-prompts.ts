// AI-Optimized Prompts for Entity Intelligence Generation
// These prompts are designed to extract maximum business intelligence for each entity type

export const ENTITY_PROMPTS = {
  // FOOTBALL CLUB PROMPTS
  club: {
    // Main analysis prompt - focuses on Yellow Panther business opportunities
    claudeAnalysis: `
You are a senior business intelligence analyst specializing in sports technology partnerships. Analyze the following football club for strategic partnership opportunities with Yellow Panther (a sports intelligence and RFP analysis platform).

CLUB DETAILS:
Name: {name}
Type: {type}
Sport: {sport}
Current Data: {currentData}

CRITICAL FOCUS AREAS:
1. Digital transformation readiness and pain points
2. Commercial partnership gaps and opportunities  
3. Technology stack modernization needs
4. Fan engagement optimization potential
5. Data analytics and intelligence requirements
6. Decision-maker identification and influence mapping

BUSINESS INTELLIGENCE REQUIREMENTS:
- Opportunity Score (0-100): Based on commercial potential, tech readiness, and partnership fit
- Digital Maturity (LOW/MEDIUM/HIGH): Current digital capabilities assessment
- Top 3 Strategic Opportunities: Specific, actionable partnership areas for Yellow Panther
- Recommended Contact Strategy: Which decision-makers to approach and how
- Market Positioning: How this club fits in the competitive landscape
- Technology Partnership Potential: Readiness for advanced tech solutions
- Confidence Score (0-100): Reliability of this analysis

YELLOW PANTHER CONTEXT:
We provide AI-powered RFP detection, sports intelligence dashboards, and automated opportunity analysis. Look for clubs that need:
- Better market intelligence for sponsorship/commercial opportunities
- Automated RFP and tender monitoring
- Enhanced fan engagement through data insights
- Competitive intelligence for strategic planning
- Digital transformation support

Format as JSON with: opportunity_score, digital_maturity, opportunities[], contact_strategy, market_positioning, tech_partnership_potential, confidence_score, analysis_details
`,

    // Perplexity research prompt - market intelligence focus
    perplexityResearch: `
Provide comprehensive market intelligence for {name}, a {type} in the {sport} industry. Focus on business intelligence relevant to technology partnerships and commercial opportunities.

KEY AREAS TO RESEARCH:
1. Recent business developments and partnerships (2023-2025)
2. Digital transformation initiatives and technology investments
3. Commercial performance and sponsorship strategies
4. Market position and competitive landscape analysis
5. Financial performance indicators and commercial trends
6. Technology adoption patterns and innovation priorities
7. Leadership changes and strategic direction shifts
8. Fan engagement challenges and opportunities

BUSINESS INTELLIGENCE PRIORITIES:
- Technology stack modernization needs
- Partnership gaps and opportunities
- Commercial growth strategies
- Digital revenue optimization potential
- Data analytics and intelligence requirements
- Innovation culture and readiness

Provide specific, recent insights with business intelligence value for technology partnership assessment.
`,

    // BrightData scraping prompt - web intelligence gathering
    webScraping: {
      linkedin: `Find LinkedIn profiles for key executives at {name} including: CEO, Commercial Director, Marketing Director, Digital Director, Technical Director, and Head of Partnerships. Focus on decision-makers involved in technology partnerships and commercial strategy.`,
      
      crunchbase: `Research {name}'s business structure, funding rounds, investor information, and commercial performance data. Look for technology investments, partnership announcements, and business expansion indicators.`,
      
      general: `Search for recent news, announcements, and developments about {name} from the last 12 months. Focus on: technology partnerships, digital initiatives, commercial deals, leadership changes, sponsorships, and strategic business developments.`
    }
  },

  // PERSON/DECISION MAKER PROMPTS  
  person: {
    claudeAnalysis: `
You are an executive intelligence analyst specializing in sports industry decision-makers. Analyze the following individual for strategic engagement potential with Yellow Panther.

PERSON DETAILS:
Name: {name}
Role: {role}
Organization: {organization}
Current Data: {currentData}

CRITICAL FOCUS AREAS:
1. Decision-making authority and budget control
2. Technology partnership philosophy and experience
3. Current strategic priorities and pain points
4. Communication style and engagement preferences
5. Innovation mindset and risk tolerance
6. Relationship mapping and influence networks

EXECUTIVE INTELLIGENCE REQUIREMENTS:
- Influence Level (HIGH/MEDIUM/LOW): Decision-making power and scope
- Partnership Decision Authority: Can they approve Yellow Panther partnerships?
- Strategic Alignment: How well their priorities match Yellow Panther solutions
- Communication Style: Professional approach and preferred engagement methods
- Risk Profile: Innovation tolerance vs. risk-averse tendencies
- Key Projects: Current initiatives where Yellow Panther could add value
- Engagement Strategy: Optimal approach and messaging for outreach

YELLOW PANTHER CONTEXT:
We provide AI-powered sports intelligence, RFP detection, and opportunity analysis. Look for executives who:
- Need better market intelligence for commercial decisions
- Are responsible for digital transformation initiatives
- Manage sponsorship and partnership strategies
- Oversee fan engagement and data analytics
- Lead technology modernization efforts

Format as JSON with: influence_level, decision_authority, strategic_alignment, communication_style, risk_profile, key_projects, engagement_strategy, confidence_score, analysis_details
`,

    perplexityResearch: `
Provide comprehensive professional intelligence for {name}, {role} at {organization}. Focus on their business impact, decision-making patterns, and strategic influence.

KEY AREAS TO RESEARCH:
1. Career background and previous leadership roles
2. Current strategic initiatives and project responsibilities
3. Public statements on technology and digital transformation
4. Partnership decisions and commercial strategy involvement
5. Industry influence and network connections
6. Speaking engagements and thought leadership content
7. Recent business achievements and strategic moves

EXECUTIVE INTELLIGENCE PRIORITIES:
- Decision-making scope and authority level
- Technology partnership experience and preferences
- Innovation track record and strategic priorities
- Communication style and professional approach
- Network influence and industry relationships
- Budget authority and resource control

Provide specific insights relevant to strategic partnership assessment and executive engagement planning.
`,

    webScraping: {
      linkedin: `Find the LinkedIn profile and professional background for {name}, {role} at {organization}. Extract career history, education, current responsibilities, and professional network information.`,
      
      crunchbase: `Research {name}'s involvement in company funding rounds, board positions, and business investments. Look for technology startup involvement, advisory roles, and investment patterns.`,
      
      general: `Search for recent news, interviews, and professional content about {name}. Focus on: strategic decisions, technology partnerships, speaking engagements, industry awards, and business leadership activities.`
    }
  },

  // LEAGE/GOVERNING BODY PROMPTS
  league: {
    claudeAnalysis: `
You are a sports business intelligence analyst specializing in governing bodies and league organizations. Analyze the following league for strategic partnership opportunities with Yellow Panther.

LEAGUE DETAILS:
Name: {name}
Type: {type}
Sport: {sport}
Current Data: {currentData}

CRITICAL FOCUS AREAS:
1. League-wide digital transformation initiatives
2. Member club technology requirements and support
3. Commercial partnership and sponsorship strategies
4. Data analytics and intelligence needs across the league
5. Competitive intelligence and market monitoring requirements
6. Regulatory and compliance technology opportunities

LEAGUE INTELLIGENCE REQUIREMENTS:
- Partnership Scope: Authority to implement league-wide technology solutions
- Member Club Influence: Ability to drive adoption across member organizations
- Commercial Strategy: Technology partnerships that benefit the entire league
- Data Intelligence Needs: League-wide analytics and monitoring requirements
- Innovation Leadership: Role in driving technology adoption across the sport
- Partnership Decision Process: How league technology partnerships are evaluated

YELLOW PANTHER CONTEXT:
We provide AI-powered sports intelligence that can benefit entire leagues through:
- League-wide RFP and opportunity monitoring
- Competitive intelligence across all member clubs
- Centralized market intelligence and trend analysis
- Standardized commercial opportunity tracking
- Cross-club strategic insights and benchmarking

Format as JSON with: partnership_scope, member_influence, commercial_strategy, intelligence_needs, innovation_leadership, decision_process, opportunity_score, confidence_score, analysis_details
`,

    perplexityResearch: `
Provide comprehensive market intelligence for {name}, a {type} governing body in {sport}. Focus on league-wide initiatives, commercial strategies, and technology adoption across member organizations.

KEY AREAS TO RESEARCH:
1. League-wide digital transformation and technology initiatives
2. Commercial partnership strategies and major sponsorship deals
3. Member club services and support programs
4. Competition format innovations and technology integration
5. International expansion and market development strategies
6. Data analytics and performance monitoring initiatives
7. Regulatory changes and compliance requirements

LEAGUE INTELLIGENCE PRIORITIES:
- Technology adoption patterns across member clubs
- Centralized vs. decentralized decision-making processes
- Commercial revenue optimization strategies
- International growth and market expansion plans
- Competitive positioning vs. other leagues/sports

Provide insights relevant to league-wide partnership opportunities and technology adoption strategies.
`,

    webScraping: {
      linkedin: `Find LinkedIn profiles for {name} executives including: Commissioner/CEO, Chief Commercial Officer, Chief Technology Officer, Head of Partnerships, and Member Services Directors.`,
      
      crunchbase: `Research {name}'s business structure, commercial performance, and strategic investments. Look for technology initiatives, partnership programs, and business development activities.`,
      
      general: `Search for recent news about {name} focusing on: technology partnerships, commercial deals, member club initiatives, competition format changes, international expansion, and strategic business developments.`
    }
  },

  // ORGANIZATION/PARTNER PROMPTS
  organization: {
    claudeAnalysis: `
You are a strategic partnership analyst specializing in sports industry service providers. Analyze the following organization for collaboration or partnership opportunities with Yellow Panther.

ORGANIZATION DETAILS:
Name: {name}
Type: {type}
Sport: {sport}
Current Data: {currentData}

CRITICAL FOCUS AREAS:
1. Service offering complementarity with Yellow Panther
2. Technology integration and partnership potential
3. Market positioning and competitive advantages
4. Client base and market reach in sports industry
5. Innovation capabilities and technology stack
6. Business model alignment and partnership structure

PARTNERSHIP INTELLIGENCE REQUIREMENTS:
- Strategic Fit: How well their services complement Yellow Panther offerings
- Integration Potential: Technical and operational compatibility
- Market Synergy: Combined value proposition for sports clients
- Partnership Model: Optimal structure for collaboration (referral, integration, joint solution)
- Competitive Advantage: Unique strengths they bring to the partnership
- Client Overlap: Shared target markets and expansion opportunities

YELLOW PANTHER CONTEXT:
We provide AI-powered sports intelligence and RFP analysis. Look for organizations that:
- Offer complementary services (data providers, consultancies, technology platforms)
- Serve similar sports industry clients
- Have technology that could integrate with our platform
- Provide access to new markets or client segments
- Offer specialized sports industry expertise

Format as JSON with: strategic_fit, integration_potential, market_synergy, partnership_model, competitive_advantage, client_overlap, opportunity_score, confidence_score, analysis_details
`,

    perplexityResearch: `
Provide comprehensive business intelligence for {name}, a {type} organization in the {sport} industry. Focus on their market position, service offerings, and strategic relationships.

KEY AREAS TO RESEARCH:
1. Service offerings and value proposition in sports industry
2. Client portfolio and market penetration strategies
3. Technology partnerships and integration capabilities
4. Competitive positioning and market differentiation
5. Business performance and growth trajectory
6. Strategic partnerships and collaboration history
7. Innovation track record and technology investments

BUSINESS INTELLIGENCE PRIORITIES:
- Market share and competitive positioning
- Service expansion and new market entry strategies
- Technology stack and integration capabilities
- Client relationships and partnership models
- Revenue growth and business scalability

Provide insights relevant to strategic partnership assessment and collaboration potential.
`,

    webScraping: {
      linkedin: `Find LinkedIn profiles for {name} executives and key decision-makers. Focus on roles relevant to strategic partnerships, business development, and technology leadership.`,
      
      crunchbase: `Research {name}'s business structure, funding history, and commercial performance. Look for investment rounds, valuation changes, and business growth indicators.`,
      
      general: `Search for recent news about {name} focusing on: service launches, client partnerships, technology integrations, business expansion, strategic partnerships, and industry recognition.`
    }
  }
}

// Helper function to format prompts with entity data
export function formatPrompt(template: string, entityData: any): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return entityData[key] || match;
  });
}

// Helper function to get optimized prompt for entity type and analysis service
export function getOptimizedPrompt(entityType: string, analysisService: string, entityData: any): string {
  const prompts = ENTITY_PROMPTS[entityType as keyof typeof ENTITY_PROMPTS];
  if (!prompts) {
    throw new Error(`No prompts defined for entity type: ${entityType}`);
  }

  const prompt = prompts[analysisService as keyof typeof prompts];
  if (!prompt) {
    throw new Error(`No ${analysisService} prompt defined for entity type: ${entityType}`);
  }

  if (typeof prompt === 'string') {
    return formatPrompt(prompt, entityData);
  }

  return prompt;
}

// AI Reasoner feedback prompts for generating strategic insights
export const AI_REASONER_PROMPTS = {
  clubFeedback: `
Based on the intelligence data for {clubName}, provide strategic recommendations for Yellow Panther engagement:

INTELLIGENCE SUMMARY:
{intelligenceSummary}

BUSINESS CONTEXT:
Yellow Panther provides AI-powered sports intelligence, RFP detection, and opportunity analysis for sports organizations.

STRATEGIC ASSESSMENT REQUIREMENTS:
1. Overall assessment of partnership potential
2. Specific Yellow Panther opportunity areas
3. Recommended engagement strategy and approach
4. Risk factors and competitive challenges
5. Competitive advantages we can leverage
6. Recommended first contact and value proposition

Focus on actionable insights that will help secure meaningful partnerships and drive business growth.
`,

  personFeedback: `
Based on the executive intelligence for {personName}, provide engagement recommendations:

EXECUTIVE PROFILE:
{executiveProfile}

ENGAGEMENT ASSESSMENT REQUIREMENTS:
1. Overall assessment of partnership influence
2. Recommended engagement approach and messaging
3. Strategic hooks and value proposition angles
4. Communication style and risk considerations
5. Relationship-building strategies
6. Optimal timing and outreach channels

Focus on practical engagement strategies that resonate with this executive's priorities and communication style.
`,

  opportunityScoring: `
Score the following strategic opportunities for {entityName} based on partnership potential, implementation difficulty, and business impact:

OPPORTUNITIES TO SCORE:
{opportunities}

SCORING CRITERIA:
- Partnership Potential (0-100): Likelihood of successful collaboration
- Implementation Difficulty (0-100): Technical and operational complexity
- Business Impact (0-100): Revenue and strategic value
- Competitive Advantage (0-100): Differentiation in market
- Timeline to Success (0-100): Speed to market and ROI

Provide detailed scoring with rationale for each opportunity.
`
}