# LinkedIn Connection Analysis - Claude Agent SDK Specification

## Overview
A Claude Agent SDK-based system that analyzes LinkedIn connections between sales team members and target entities to identify the warmest introduction paths.

## Core Capabilities

### 1. Connection Mapping & Analysis
- **Direct Connections**: Identify 1st-degree connections between sales team and targets
- **Mutual Connections**: Find shared connections that can facilitate introductions
- **2nd-Degree Networks**: Map connection chains through mutual contacts
- **Company Relationships**: Analyze employee movements, alumni networks, professional associations
- **Network Strength Scoring**: Rate connection paths by warmth and reliability

### 2. Intelligent Introduction Strategy
- **Path Optimization**: Recommend the most effective introduction routes
- **Contextual Messaging**: Suggest personalized introduction approaches
- **Timing Recommendations**: Identify optimal moments for outreach
- **Confidence Scoring**: Provide probability scores for successful introductions

## Technical Architecture

### Claude Agent SDK Configuration
```typescript
const connectionAnalysisAgent = {
  name: "linkedin-connection-analyzer",
  description: "Analyzes LinkedIn networks to identify warm introduction paths",
  
  mcpServers: {
    "brightdata": {
      command: "npx",
      args: ["-y", "@brightdata/mcp"],
      env: {
        API_TOKEN: process.env.BRIGHTDATA_API_TOKEN
      }
    },
    "neo4j-mcp": {
      command: "npx", 
      args: ["-y", "@alanse/mcp-neo4j-server"],
      env: {
        NEO4J_URI: process.env.NEO4J_URI,
        NEO4J_USERNAME: process.env.NEO4J_USERNAME,
        NEO4J_PASSWORD: process.env.NEO4J_PASSWORD
      }
    }
  },
  
  allowedTools: [
    "mcp__brightdata__scrape_as_markdown",
    "mcp__brightdata__search_engine", 
    "mcp__brightdata__scrape_batch",
    "mcp__neo4j-mcp__execute_query",
    "mcp__neo4j-mcp__create_relationship"
  ],
  
  maxTurns: 8,
  temperature: 0.3
};
```

### System Prompt
```
You are a LinkedIn Connection Analysis Specialist for Yellow Panther's sales intelligence platform.

Your core function is to analyze LinkedIn networks and identify the warmest introduction paths between our sales team and target entities in the sports industry.

ANALYSIS METHODOLOGY:
1. Map direct connections between sales team members and target entities
2. Identify mutual connections and shared networks
3. Analyze 2nd-degree connection chains
4. Evaluate connection strength and recency
5. Consider professional context (previous employers, alumni networks, industry associations)
6. Score introduction paths by warmth and likelihood of success

CONNECTION STRENGTH CRITERIA:
- STRONG: Direct connections with recent interaction, or mutual connections from current/recent workplace
- MEDIUM: Mutual connections from past relationships, or 2nd-degree with strong professional context
- WEAK: Distant connections, minimal professional context, or outdated relationships

INTRODUCTION STRATEGY FACTORS:
- Professional context and timing
- Relationship history and recency
- Industry relevance and current roles
- Communication preferences and likelihood to respond

OUTPUT REQUIREMENTS:
- Structured JSON with actionable introduction paths
- Confidence scores for each recommendation
- Specific messaging strategies for each connection type
- Alternative paths if primary approach fails

Always prioritize actionable insights that can immediately improve sales outreach success rates.
```

## API Specification

### Input Schema
```typescript
interface ConnectionAnalysisRequest {
  yellow_panther_uk_team: {
    name: string;
    linkedin_url: string;
    role: string;
    location: string;
    is_primary?: boolean;
    previous_companies?: string[];
    alumni_networks?: string[];
  }[];
  
  targets: {
    entity_name: string;
    linkedin_url?: string;
    company_linkedin_url?: string;
    key_contacts?: {
      name: string;
      linkedin_url: string;
      role: string;
    }[];
    industry?: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  
  analysis_options?: {
    include_2nd_degree: boolean;
    max_depth: number;
    min_connection_strength: 'WEAK' | 'MEDIUM' | 'STRONG';
    focus_companies?: string[];
    primary_connection_weighting?: number; // Extra weight for Stuart Cope connections
  };
}
```

### Yellow Panther UK Team Analysis
The system will first identify and analyze all Yellow Panther team members based in the United Kingdom from the LinkedIn search results:
https://www.linkedin.com/search/results/people/?keywords=yellow%20panther&origin=CLUSTER_EXPANSION

**Primary Connection:**
- Stuart Cope: https://www.linkedin.com/in/stuart-cope-54392b16/ (Primary connection - weighted highest)

**Secondary Connections:**
- All other Yellow Panther UK team members from the search results (analyzed in order of relevance/seniority)

The analysis will map each target entity's connections against every Yellow Panther UK team member, with Stuart Cope serving as the primary anchor point for network analysis.

### Output Schema
```typescript
interface ConnectionAnalysisResponse {
  analysis_summary: {
    total_targets_analyzed: number;
    yellow_panther_uk_team_size: number;
    primary_connection_name: string;
    strong_paths_found: number;
    medium_paths_found: number;
    weak_paths_found: number;
    analysis_timestamp: string;
  };
  
  yellow_panther_team_analysis: {
    team_members: Array<{
      name: string;
      role: string;
      linkedin_url: string;
      connection_count: number;
      strongest_connection?: string;
      is_primary: boolean;
    }>;
    network_overview: {
      total_connections_found: number;
      unique_mutual_connections: number;
      company_overlaps: number;
      alumni_connections: number;
    };
  };
  
  introduction_paths: {
    target_entity: string;
    yellow_panther_contact: string;
    connection_strength: 'STRONG' | 'MEDIUM' | 'WEAK';
    connection_type: 'DIRECT' | 'MUTUAL_CONNECTION' | '2ND_DEGREE' | 'COMPANY_NETWORK';
    confidence_score: number;
    is_primary_path?: boolean; // True if through Stuart Cope
    
    connection_details: {
      mutual_connections?: Array<{
        name: string;
        linkedin_url: string;
        relationship_context: string;
        recency_years: number;
        strength_rating: number;
        yellow_panther_proximity: string; // Which YP team member this connection relates to
      }>;
      
      company_relationships?: Array<{
        company: string;
        overlap_period: string;
        role_context: string;
        shared_projects?: string[];
        yellow_panther_team_member: string;
      }>;
      
      alumni_connections?: Array<{
        institution: string;
        graduation_year?: string;
        shared_activities?: string[];
        yellow_panther_alumni: string;
      }>;
    };
    
    introduction_strategy: {
      recommended_approach: string;
      messaging_angle: string;
      timing_suggestion: string;
      talking_points: string[];
      follow_up_strategy: string;
      yellow_panther_context: string; // Specific context for YP team member
    };
    
    alternative_paths?: Array<{
      approach: string;
      confidence_score: number;
      reasoning: string;
      yellow_panther_contact: string;
    }>;
  }[];
  
  recommendations: {
    target_priority_ranking: Array<{
      entity: string;
      success_probability: number;
      recommended_yellow_panther_contact: string;
      is_primary_connection_path: boolean;
      time_to_close_estimate: string;
    }>;
    
    yellow_panther_team_optimization: {
      best_practices: string[];
      network_gaps: string[];
      suggested_connections: string[];
      primary_connection_leverage: string[]; // How to best utilize Stuart Cope's network
    };
    
    strategic_insights: {
      industry_trends: string[];
      competitive_landscape: string[];
      market_opportunities: string[];
      yellow_panther_network_strengths: string[];
    };
  };
}
```

## Implementation Examples

### Example 1: Single Target Analysis with Yellow Panther UK Team
```typescript
const result = await query({
  prompt: `Analyze LinkedIn connections for Arsenal FC introduction opportunities:

YELLOW PANTHER UK TEAM:
First, identify all Yellow Panther team members from: https://www.linkedin.com/search/results/people/?keywords=yellow%20panther&origin=CLUSTER_EXPANSION

PRIMARY CONNECTION:
- Stuart Cope: https://www.linkedin.com/in/stuart-cope-54392b16/ (Primary - highest priority)

SECONDARY CONNECTIONS:
- [Scrape additional Yellow Panther UK team members from search results]

TARGET:
- Arsenal FC: https://linkedin.com/company/arsenal-fc/
- Key Contacts: Technical Director, Commercial Director, Digital Innovation Lead

ANALYSIS REQUIREMENTS:
1. Map connections from ALL Yellow Panther UK team members to Arsenal FC decision makers
2. Give extra weight to connection paths through Stuart Cope (primary connection)
3. Identify mutual connections, company overlaps, and alumni networks
4. Provide specific introduction strategies for each Yellow Panther team member
5. Rank connection paths by strength and confidence scores

Focus on identifying the warmest introduction paths with specific Yellow Panther team member context and messaging strategies.`,

  options: connectionAnalysisAgent
});
```

### Example 2: Batch Analysis for Multiple Targets with Yellow Panther UK Team
```typescript
const batchTargets = [
  { name: "Arsenal FC", linkedin_url: "https://linkedin.com/company/arsenal-fc/" },
  { name: "Chelsea FC", linkedin_url: "https://linkedin.com/company/chelsea-fc/" },
  { name: "Tottenham Hotspur", linkedin_url: "https://linkedin.com/company/tottenham-hotspur/" }
];

const batchResult = await query({
  prompt: `Batch analyze LinkedIn connections for these 3 Premier League clubs: ${batchTargets.map(t => t.name).join(', ')}

YELLOW PANTHER UK TEAM ANALYSIS:
1. First, scrape all Yellow Panther UK team members from: https://www.linkedin.com/search/results/people/?keywords=yellow%20panther&origin=CLUSTER_EXPANSION
2. Identify Stuart Cope as primary connection: https://www.linkedin.com/in/stuart-cope-54392b16/
3. Map secondary connections from remaining Yellow Panther UK team members

FOR EACH CLUB, IDENTIFY:
1. Connection paths from ALL Yellow Panther UK team members (primary weight to Stuart Cope)
2. Mutual connections between Yellow Panther team and club decision makers
3. Company relationships and employee movements (shared employers, alumni networks)
4. Optimal introduction strategy with specific Yellow Panther team member recommendations
5. Confidence scoring for each connection path

PRIORITIZATION:
- Stuart Cope connections get 1.5x confidence boost
- Direct connections to any Yellow Panther UK team member are HIGH priority
- Mutual connections through Stuart Cope are preferred over other team members

Process efficiently in batches of 3 entities with comprehensive Yellow Panther network mapping.`,

  options: {
    ...connectionAnalysisAgent,
    maxTurns: 12 // Longer for Yellow Panther team analysis + batch processing
  }
});
```

## Integration Points

### 1. Entity Dossier Integration
- Add "LinkedIn Connection Analysis" tab to entity dossiers
- Display warmest introduction paths alongside entity profiles
- Show Yellow Panther UK team member connection strengths visually
- Highlight Stuart Cope (primary connection) paths with special visual indicators
- Display team-specific introduction strategies and messaging recommendations

### 2. CRM Integration
- Auto-populate CRM with Yellow Panther UK team connection analysis results
- Score leads by introduction warmth and Yellow Panther team member proximity
- Track introduction success rates by Yellow Panther team member
- Flag opportunities where Stuart Cope (primary connection) has network advantage

### 3. Sales Dashboard Integration
- Display Yellow Panther UK team network strength metrics
- Show pipeline opportunities by Yellow Panther team member connection type
- Highlight targets where multiple Yellow Panther team members have connections
- Alert team to new connection opportunities, especially through Stuart Cope's network
- Display team member connection diversity and coverage metrics

## Performance Considerations

### 1. Economical Processing
- Batch processing in groups of 3 entities
- Intelligent caching of LinkedIn profile data
- Delta detection to only analyze new/changed connections

### 2. Rate Limiting
- Respect LinkedIn's rate limits through BrightData
- Implement exponential backoff for failed requests
- Queue management for large analysis batches

### 3. Data Freshness
- Cache connection data for 7-14 days
- Prioritize recent connections and interactions
- Update analysis periodically for key targets

## Success Metrics

### 1. Connection Discovery
- % of targets with identifiable connection paths
- Average connection strength score across pipeline
- Number of warm introductions facilitated

### 2. Sales Impact
- Increase in conversion rates for warm introductions
- Reduction in sales cycle length for connected targets
- Improvement in overall pipeline velocity

### 3. Network Growth
- Expansion of sales team networks over time
- Identification of strategic connection gaps
- Success rate of recommended connection strategies

## Future Enhancements

### 1. AI-Powered Predictive Analysis
- Predict likelihood of connection acceptance
- Suggest optimal timing for introduction requests
- Identify emerging connection opportunities

### 2. Automated Outreach Integration
- Draft personalized introduction messages
- Schedule outreach at optimal times
- Track response rates and follow-up reminders

### 3. Competitive Intelligence
- Analyze competitor networks and relationships
- Identify exclusive connection opportunities
- Market positioning based on network strength

This specification provides a comprehensive framework for implementing LinkedIn connection analysis using the Claude Agent SDK, enabling data-driven sales intelligence through warm introduction identification.