# 🕷️ Neo4j Entity Webhook Integration Schema

## 📋 Overview

This schema defines the webhook integration system for monitoring sports entities in Neo4j AuraDB, designed to work in conjunction with the Yellow Panther Business Profile for automated RFP detection and opportunity targeting.

## 🏗️ Current Neo4j Schema Analysis

### Entity Node Structure
Based on our analysis of 4,483 entities, the current schema includes:

#### Core Entity Properties (Universal)
```cypher
(:Entity {
  // Identity
  name: String                    // Entity name
  type: String                    // Club, League, Federation, Tournament, Venue, Person
  
  // Sports Context
  sport: String                   // Primary sport
  country: String                 // Country of origin
  tier: String                    // Competition tier (1, 2, 3, etc.)
  level: String                   // Competition level
  
  // Digital Presence
  website: String                 // Official website URL
  linkedin: String                // LinkedIn profile URL
  mobileApp: String               // Mobile app status
  
  // Business Intelligence
  opportunityScore: Integer       // 0-100 opportunity score
  estimatedValue: String          // Estimated project value
  priorityScore: Integer          // Priority ranking
  
  // Yellow Panther Specific
  yellowPantherFit: String        // PERFECT_FIT, STRETCH_TARGET, MONITOR
  yellowPantherPriority: Integer  // 1-10 priority ranking
  yellowPantherStrategy: String   // DIRECT_APPROACH, PHASE_BASED, etc.
  digitalTransformationScore: Integer // 0-100 digital maturity
  
  // Metadata
  neo4j_id: String                // Internal Neo4j ID
  migrated_at: DateTime           // Migration timestamp
  enrichmentStatus: String        // Data enrichment status
})
```

#### Extended Entity Properties (Enhanced Entities)
```cypher
(:Entity {
  // Advanced Business Intelligence
  digitalTransformationOpportunity: String,
  websiteModernnessTier: String,   // MODERN, STANDARD, LEGACY, OUTDATED
  yellowPantherContactAccessibility: String, // HIGH, MEDIUM, LOW
  yellowPantherNextAction: String,
  yellowPantherBudgetRange: String,
  yellowPantherDigitalGapAnalysis: String,
  yellowPantherTechStackOpportunity: String,
  
  // Enrichment Data
  lastEnrichmentDate: DateTime,
  intelligenceSource: String,
  linkedinFollowers: Integer,
  linkedinEmployees: Integer,
  headquarters: String,
  founded: String,
  companySize: String,
  
  // Badge Management
  badgePath: String,
  badge_s3_url: String,
  badgeDownloadedAt: DateTime
})
```

### Relationship Structure
Weighted relationships with strength scores (0.0-1.0):

```cypher
// Sports Relationships
(:Entity)-[:PLAYS_IN {strength: Float, weight_category: String}]->(:Entity)
(:Entity)-[:PARTICIPATES_IN {strength: Float, weight_category: String}]->(:Entity)
(:Entity)-[:COMPETES_WITH {strength: Float, weight_category: String}]->(:Entity)

// Governance & Affiliation
(:Entity)-[:GOVERNED_BY {strength: Float, weight_category: String}]->(:Entity)
(:Entity)-[:MEMBER_OF {strength: Float, weight_category: String}]->(:Entity)
(:Entity)-[:AFFILIATED_WITH {strength: Float, weight_category: String}]->(:Entity)

// Business Relationships
(:Entity)-[:HAS_PARTNERSHIP_WITH {status: String, partnership_category: String}]->(:Entity)
(:Entity)-[:HAS_OPPORTUNITY {priority: Integer}]->(:Entity)
(:Entity)-[:HAS_CONNECTION_TO {strength: Float, connection_type: String}]->(:Entity)
```

## 🎯 Webhook Integration Strategy

### Phase 1: Multi-Channel Signal Monitoring Webhooks

#### 1.1 Social Media Posts & Content Monitoring
```json
{
  "webhook_type": "social_content_signal",
  "entity_id": "neo4j_id",
  "trigger_type": "content_analysis",
  "priority": "HIGH|MEDIUM|LOW",
  "timestamp": "2025-01-09T10:30:00Z",
  "source": {
    "platform": "linkedin|twitter|facebook|instagram",
    "author": {
      "name": "John Smith",
      "role": "CEO",
      "company": "Sunderland FC",
      "profile_url": "https://linkedin.com/in/johnsmith"
    },
    "content": {
      "text": "Excited to announce our digital transformation initiative - seeking innovative partners for mobile app development",
      "post_url": "https://linkedin.com/posts/12345",
      "published_at": "2025-01-09T10:15:00Z",
      "engagement": {
        "likes": 145,
        "comments": 23,
        "shares": 12
      }
    },
    "signal_analysis": {
      "keywords_detected": ["digital transformation", "mobile app development", "seeking partners"],
      "intent_score": 0.89,
      "urgency_indicators": ["excited", "announce", "seeking"],
      "budget_indicators": ["initiative", "partners"],
      "yellow_panther_relevance": {
        "service_match": "mobile_app_development",
        "fit_score": 0.95,
        "recommended_action": "immediate_outreach"
      }
    }
  },
  "action_required": {
    "type": "social_engagement",
    "deadline": "2025-01-10T10:15:00Z",
    "contact_method": "linkedin_comment",
    "template": "digital_transformation_response",
    "talking_points": ["mobile app expertise", "sports industry experience", "Team GB case study"]
    }
  }
}
```

#### 1.2 Job Change & Personnel Movement Signals
```json
{
  "webhook_type": "personnel_change_signal",
  "entity_id": "neo4j_id",
  "trigger_type": "career_transition",
  "priority": "HIGH",
  "timestamp": "2025-01-09T10:30:00Z",
  "person": {
    "name": "Sarah Johnson",
    "previous_role": "Marketing Director",
    "new_role": "Chief Digital Officer",
    "company": "Premier League",
    "linkedin_url": "https://linkedin.com/in/sarahjohnson",
    "change_date": "2025-01-08T09:00:00Z"
  },
  "signal_analysis": {
    "change_type": "promotion_to_digital_leadership",
    "significance_score": 0.92,
    "technology_budget_likely": true,
    "decision_making_authority": "HIGH",
    "change_indicators": [
      "Chief Digital Officer title",
      "recent promotion",
      "digital leadership role"
    ],
    "yellow_panther_opportunity": {
      "timing": "3-6_months",
      "project_type": "digital_strategy",
      "contact_approach": "warm_introduction",
      "budget_window": "Q2_Q3_2025"
    }
  },
  "network_impact": {
    "previous_company_connections": 45,
    "new_company_influence": 78,
    "shared_connections": 12,
    "network_overlap_score": 0.73
  }
}
```

#### 1.3 Company Leadership & Executive Announcements
```json
{
  "webhook_type": "executive_announcement_signal",
  "entity_id": "neo4j_id",
  "trigger_type": "leadership_communication",
  "priority": "HIGH",
  "timestamp": "2025-01-09T10:30:00Z",
  "announcement": {
    "executive": {
      "name": "David Chen",
      "role": "CEO",
      "company": "Italy Golf Tournament 5497"
    },
    "content": {
      "title": "Strategic Investment in Fan Experience Technology",
      "summary": "Allocating €5M for digital transformation over next 18 months",
      "full_text": "We are excited to announce a significant investment in enhancing our digital fan experience...",
      "publication_url": "https://golf-tournament.com/press/2025/digital-investment",
      "published_at": "2025-01-09T08:00:00Z"
    },
    "financial_signals": {
      "investment_amount": "€5M",
      "timeline": "18_months",
      "project_types": ["fan_experience", "digital_transformation", "mobile_platform"],
      "budget_confirmed": true
    }
  },
  "opportunity_analysis": {
    "yellow_panther_fit": "PERFECT_FIT",
    "estimated_value": "€2M-€3M",
    "competition_stage": "early_planning",
    "decision_timeline": "3_months",
    "key_stakeholders": ["CEO", "CFO", "Head of Digital"],
    "technical_requirements": ["mobile_app", "fan_engagement", "ticketing_integration"]
  }
}
```

#### 1.4 Partnership & Sponsorship Announcements
```json
{
  "webhook_type": "partnership_signal",
  "entity_id": "neo4j_id",
  "trigger_type": "business_partnership",
  "priority": "MEDIUM",
  "timestamp": "2025-01-09T10:30:00Z",
  "partnership": {
    "companies": ["Manchester City", "Technology Provider XYZ"],
    "partnership_type": "digital_services",
    "duration": "3_years",
    "value": "undisclosed",
    "announcement_date": "2025-01-08T14:00:00Z"
  },
  "signal_analysis": {
    "competitive_intelligence": {
      "competitor": "Technology Provider XYZ",
      "services_offered": ["mobile_app", "digital_platform"],
      "contract_value_estimated": "£800K-£1.2M",
      "renewal_date": "2028-01-01"
    },
    "yellow_panther_opportunity": {
      "approach": "competitive_replacement",
      "timing": "contract_renewal_window",
      "advantage": ["sports_specialization", "award_winning_apps"],
      "contact_strategy": "wait_for_renewal_signals"
    }
  }
}
```

#### 1.5 Industry News & Press Release Monitoring
```json
{
  "webhook_type": "industry_news_signal",
  "entity_id": "neo4j_id",
  "trigger_type": "media_coverage",
  "priority": "MEDIUM",
  "timestamp": "2025-01-09T10:30:00Z",
  "article": {
    "title": "Premier League Clubs Ramp Up Digital Investment",
    "source": "SportsPro Media",
    "url": "https://sportspro.com/news/pl-digital-investment",
    "published_at": "2025-01-09T06:00:00Z",
    "author": "Journalist Name",
    "content_summary": "Premier League clubs are collectively investing £200M in digital transformation initiatives..."
  },
  "market_analysis": {
    "trend_signals": ["digital_investment", "fan_engagement", "mobile_platforms"],
    "market_size": "£200M_collective",
    "opportunity_window": "12-18_months",
    "entity_mentions": ["Arsenal", "Chelsea", "Liverpool"],
    "yellow_panther_positioning": {
      "competitive_advantage": ["sports_specialization", "proven_track_record"],
      "target_segments": ["mid_table_clubs", "emerging_clubs"],
      "messaging_angle": "cost_effective_digital_transformation"
    }
  }
}
```

#### 1.6 RFP Detection Webhooks
```json
{
  "webhook_type": "rfp_detection",
  "entity_id": "neo4j_id",
  "trigger_type": "procurement_signal",
  "priority": "HIGH|MEDIUM|LOW",
  "timestamp": "2025-01-09T10:30:00Z",
  "data": {
    "entity": {
      "name": "Sunderland FC",
      "type": "Club",
      "sport": "Football",
      "country": "England"
    },
    "rfp_signals": [
      {
        "source": "linkedin",
        "signal_type": "procurement_announcement",
        "content": "seeking digital transformation partner",
        "detected_at": "2025-01-09T10:15:00Z",
        "confidence_score": 0.85
      }
    ],
    "yellow_panther_analysis": {
      "fit_score": 0.95,
      "priority": 10,
      "strategy": "DIRECT_APPROACH",
      "estimated_value": "£150K-£300K",
      "next_action": "Contact CEO with Championship transformation strategy"
    }
  },
  "action_required": {
    "type": "immediate_outreach",
    "deadline": "2025-01-16T10:15:00Z",
    "contact_method": "email",
    "template": "championship_digital_transformation"
  }
}
```

#### 1.2 Entity Change Monitoring
```json
{
  "webhook_type": "entity_change",
  "entity_id": "neo4j_id",
  "trigger_type": "property_update",
  "timestamp": "2025-01-09T10:30:00Z",
  "changes": [
    {
      "property": "digitalTransformationScore",
      "old_value": 65,
      "new_value": 78,
      "change_type": "increase",
      "significance": "HIGH",
      "impact_analysis": "Increased digital transformation readiness indicates potential RFP opportunity"
    }
  ],
  "entity_snapshot": {
    "name": "Italy Golf Tournament 5497",
    "opportunity_score": 99,
    "estimated_value": "£4.7M-£3.3M"
  }
}
```

#### 1.3 Relationship Change Monitoring
```json
{
  "webhook_type": "relationship_change",
  "entity_id": "neo4j_id",
  "trigger_type": "new_relationship",
  "timestamp": "2025-01-09T10:30:00Z",
  "relationship": {
    "type": "HAS_PARTNERSHIP_WITH",
    "target_entity": "Technology Provider XYZ",
    "properties": {
      "status": "active",
      "partnership_category": "digital_services",
      "created_at": "2025-01-09T10:25:00Z"
    }
  },
  "business_impact": {
    "opportunity_type": "partnership_displacement",
    "yellow_panther_angle": "Existing partnership indicates digital transformation budget",
    "recommended_action": "monitor for contract renewal timing"
  }
}
```

### Phase 2: Person-of-Interest (POI) Tracking System

#### 2.1 Person-of-Interest Entity Schema
```cypher
(:Person {
  // Identity
  name: String,
  linkedinUrl: String,
  currentRole: String,
  company: String,
  
  // POI Classification
  poiCategory: String,              // EXECUTIVE, DIGITAL_LEADER, DECISION_MAKER, INFLUENCER
  poiPriority: Integer,             // 1-10 importance ranking
  monitoringLevel: String,          // INTENSIVE, MODERATE, PASSIVE
  
  // Contact & Network
  email: String,
  phone: String,
  twitterHandle: String,
  sharedConnections: Integer,
  
  // Influence Indicators
  linkedinFollowers: Integer,
  postEngagementRate: Float,
  industryInfluence: Float,         // 0.0-1.0 influence score
  
  // Yellow Panther Specific
  ypRelationshipStrength: Float,    // 0.0-1.0 connection strength
  ypLastContact: DateTime,
  ypContactFrequency: String,       // WEEKLY, MONTHLY, QUARTERLY
  ypNotes: String,
  
  // Metadata
  lastUpdated: DateTime,
  monitoringEnabled: Boolean,
  alertThreshold: Float            // 0.0-1.0 sensitivity
})

// Person-Entity Relationships
(:Person)-[:WORKS_FOR {role: String, startDate: DateTime, decisionMakingAuthority: String}]->(:Entity)
(:Person)-[:CONNECTED_TO {strength: Float, relationshipType: String, sharedConnections: Integer}]->(:Person)
(:Person)-[:POSTED_ON {platform: String, postCount: Integer, avgEngagement: Float}]->(:Platform)
```

#### 2.2 Comprehensive Touchpoint Monitoring

##### 2.2.1 Social Media Platforms
```javascript
const MONITORING_PLATFORMS = {
  linkedin: {
    priority: "HIGH",
    update_frequency: "15_minutes",
    content_types: ["posts", "articles", "comments", "job_changes"],
    keyword_matching: "full_text",
    engagement_tracking: true
  },
  
  twitter: {
    priority: "MEDIUM",
    update_frequency: "30_minutes",
    content_types: ["tweets", "retweets", "replies"],
    keyword_matching: "hashtags_and_keywords",
    engagement_tracking: true
  },
  
  facebook: {
    priority: "LOW",
    update_frequency: "1_hour",
    content_types: ["posts", "page_updates"],
    keyword_matching: "title_and_description",
    engagement_tracking: false
  },
  
  instagram: {
    priority: "LOW",
    update_frequency: "2_hours",
    content_types: ["posts", "stories", "business_updates"],
    keyword_matching: "caption_and_hashtags",
    engagement_tracking: false
  }
};
```

##### 2.2.2 Professional Networks & Career Sites
```javascript
const CAREER_MONITORING_SOURCES = {
  linkedin_jobs: {
    priority: "HIGH",
    signals: ["new_postings", "role_changes", "hiring_spikes"],
    yellow_panther_relevance: {
      "digital_roles": ["CTO", "CDO", "Head of Digital", "Digital Manager"],
      "technology_roles": ["IT Director", "Head of Technology"],
      "leadership_roles": ["CEO", "Managing Director", "Operations Director"]
    }
  },
  
  indeed: {
    priority: "MEDIUM",
    signals: ["job_postings", "company_hiring_trends"],
    search_keywords: ["mobile app", "digital transformation", "sports technology"]
  },
  
  glassdoor: {
    priority: "LOW",
    signals: ["company_reviews", "salary_insights", "technology_stack_mentions"]
  }
};
```

##### 2.2.3 Industry News & Press Release Monitoring
```javascript
const NEWS_SOURCES = {
  sports_industry: {
    priority: "HIGH",
    sources: ["SportsPro", "Sport Business Journal", "Sports Technology"],
    keywords: ["digital transformation", "mobile app", "fan engagement", "technology partnership"],
    entities_tracked: ["Premier League", "Team GB", "Major Clubs"],
    update_frequency: "hourly"
  },
  
  tech_news: {
    priority: "MEDIUM", 
    sources: ["TechCrunch", "Wired", "VentureBeat"],
    keywords: ["sports technology", "mobile development", "digital sports"],
    update_frequency: "daily"
  },
  
  business_news: {
    priority: "MEDIUM",
    sources: ["Bloomberg", "Reuters", "Financial Times"],
    keywords: ["sports investment", "sports technology funding", "digital sports media"],
    update_frequency: "daily"
  }
};
```

#### 2.3 Signal Detection Framework

##### 2.3.1 Keyword Matching & Scoring System
```javascript
const SIGNAL_CATEGORIES = {
  // High Value Signals - Immediate Action Required
  PROCUREMENT_SIGNALS: {
    keywords: [
      "rfp", "tender", "procurement", "bidding process",
      "seeking partners", "vendor selection", "supplier evaluation",
      "request for proposal", "invitation to tender"
    ],
    context_keywords: ["digital", "mobile", "app", "technology", "software"],
    weight: 1.0,
    action_required: "immediate_outreach",
    response_time: "2_hours"
  },
  
  // Medium-High Value Signals - Strategic Planning
  DIGITAL_TRANSFORMATION_SIGNALS: {
    keywords: [
      "digital transformation", "digital strategy", "modernization",
      "technology overhaul", "digital innovation", "tech upgrade",
      "digital-first", "mobile-first strategy"
    ],
    context_keywords: ["fan experience", "engagement", "revenue", "growth"],
    weight: 0.85,
    action_required: "strategic_monitoring",
    response_time: "24_hours"
  },
  
  // Personnel Change Signals - Opportunity Windows
  LEADERSHIP_CHANGE_SIGNALS: {
    keywords: [
      "appointed", "hired", "promoted", "new role", "joined",
      "chief digital officer", "CTO", "head of technology",
      "digital director", "technology leadership"
    ],
    context_keywords: ["sports", "club", "league", "federation", "organization"],
    weight: 0.90,
    action_required: "relationship_building",
    response_time: "1_week"
  },
  
  // Budget & Investment Signals
  INVESTMENT_SIGNALS: {
    keywords: [
      "investment", "funding", "budget allocation", "capital expenditure",
      "£", "€", "$", "million", "investment in", "allocating"
    ],
    context_keywords: ["technology", "digital", "mobile", "fan experience", "infrastructure"],
    weight: 0.80,
    action_required: "budget_tracking",
    response_time: "48_hours"
  },
  
  // Partnership Signals - Competitive Intelligence
  PARTNERSHIP_SIGNALS: {
    keywords: [
      "partnership", "sponsorship", "collaboration", "agreement",
      "technology partner", "digital partner", "mobile app partner"
    ],
    context_keywords: ["signed", "announced", "extended", "renewed", "multi-year"],
    weight: 0.70,
    action_required: "competitive_analysis",
    response_time: "1_week"
  },
  
  // Project & Initiative Signals
  PROJECT_SIGNALS: {
    keywords: [
      "project", "initiative", "program", "rollout", "implementation",
      "launch", "development", "platform", "system", "application"
    ],
    context_keywords: ["mobile", "app", "digital", "fan", "ticketing", "engagement"],
    weight: 0.75,
    action_required: "opportunity_tracking",
    response_time: "72_hours"
  }
};
```

##### 2.3.2 Signal Scoring Algorithm
```javascript
function calculateSignalScore(signal, entity, person) {
  let baseScore = 0;
  
  // Keyword matching (0-0.4)
  const keywordScore = calculateKeywordMatch(signal.content, SIGNAL_CATEGORIES);
  baseScore += keywordScore * 0.4;
  
  // Source credibility (0-0.2)
  const sourceScore = getSourceCredibilityScore(signal.source);
  baseScore += sourceScore * 0.2;
  
  // Entity relevance (0-0.2)
  const entityScore = getEntityRelevanceScore(entity);
  baseScore += entityScore * 0.2;
  
  // Person authority (0-0.1)
  const personScore = getPersonAuthorityScore(person);
  baseScore += personScore * 0.1;
  
  // Timing relevance (0-0.1)
  const timingScore = getTimingRelevanceScore(signal.timestamp);
  baseScore += timingScore * 0.1;
  
  return {
    overall_score: Math.min(baseScore, 1.0),
    component_scores: {
      keywords: keywordScore,
      source: sourceScore,
      entity: entityScore,
      person: personScore,
      timing: timingScore
    },
    action_priority: getActionPriority(baseScore),
    recommended_response: getRecommendedResponse(baseScore, signal.category)
  };
}
```

### Phase 3: Advanced Monitoring Configuration

#### 3.1 Real-Time Monitoring Dashboard
```cypher
// Real-time signal aggregation
MATCH (p:Person)-[:WORKS_FOR]->(e:Entity)
WHERE p.monitoringEnabled = true
AND e.yellowPantherPriority <= 5
OPTIONAL MATCH (p)-[posted:POSTED_ON]->(pl:Platform)
WHERE posted.lastPostTime >= datetime() - duration({hours: 24})
OPTIONAL MATCH (e)-[signal:RECEIVED_SIGNAL]->()
WHERE signal.timestamp >= datetime() - duration({hours: 24})
RETURN e.name as entity,
       p.name as person,
       p.poiCategory as role,
       COUNT(DISTINCT pl) as active_platforms,
       COUNT(DISTINCT signal) as recent_signals,
       MAX(signal.priority) as highest_signal_priority,
       p.poiPriority as person_priority
ORDER BY highest_signal_priority DESC, person_priority ASC;
```

#### 3.2 Alert Threshold Configuration
```javascript
const ALERT_THRESHOLDS = {
  // Immediate Alerts (15-minute response)
  CRITICAL: {
    score_range: [0.9, 1.0],
    notification_methods: ["email", "slack", "sms"],
    escalation: "immediate",
    auto_escalation_minutes: 30
  },
  
  // High Priority (2-hour response)
  HIGH: {
    score_range: [0.7, 0.89],
    notification_methods: ["email", "slack"],
    escalation: "team_lead",
    auto_escalation_minutes: 120
  },
  
  // Medium Priority (24-hour response)
  MEDIUM: {
    score_range: [0.5, 0.69],
    notification_methods: ["email"],
    escalation: "weekly_digest",
    auto_escalation_minutes: 1440
  },
  
  // Low Priority (Weekly digest)
  LOW: {
    score_range: [0.0, 0.49],
    notification_methods: ["weekly_digest"],
    escalation: "monthly_review",
    auto_escalation_minutes: 10080
  }
};
```

### Phase 4: Intelligent Trigger Event Types
```javascript
const TRIGGER_EVENTS = {
  // High Priority Triggers
  PROCUREMENT_ANNOUNCEMENT: {
    type: 'linkedin_procurement',
    keywords: ['digital transformation', 'mobile app', 'rfp', 'tender'],
    priority: 'HIGH',
    response_time: '2_hours'
  },
  
  EXECUTIVE_HIRE: {
    type: 'leadership_change',
    keywords: ['chief digital officer', 'cto', 'head of technology'],
    priority: 'HIGH',
    response_time: '24_hours'
  },
  
  TECHNOLOGY_INVESTMENT: {
    type: 'investment_signal',
    keywords: ['technology investment', 'digital platform', 'infrastructure'],
    priority: 'MEDIUM',
    response_time: '48_hours'
  },
  
  // Medium Priority Triggers
  PARTNERSHIP_ANNOUNCEMENT: {
    type: 'business_partnership',
    keywords: ['partnership', 'sponsorship', 'collaboration'],
    priority: 'MEDIUM',
    response_time: '1_week'
  },
  
  ACHIEVEMENT_AWARD: {
    type: 'organizational_success',
    keywords: ['award', 'recognition', 'achievement'],
    priority: 'LOW',
    response_time: '2_weeks'
  }
};
```

#### 2.2 Webhook Endpoint Configuration
```yaml
# Primary Webhook Endpoints
endpoints:
  rfp_detection:
    url: "https://your-domain.com/api/webhook/rfp-detected"
    method: "POST"
    headers:
      Authorization: "Bearer ${WEBHOOK_SECRET}"
      Content-Type: "application/json"
    retry_policy:
      max_attempts: 3
      backoff: "exponential"
  
  entity_monitoring:
    url: "https://your-domain.com/api/webhook/entity-change"
    method: "POST"
    headers:
      Authorization: "Bearer ${WEBHOOK_SECRET}"
      Content-Type: "application/json"
    retry_policy:
      max_attempts: 5
      backoff: "linear"

# Monitoring Configuration
monitoring:
  check_interval: "15_minutes"
  batch_size: 50
  priority_threshold: 7
  enable_real_time: true
```

### Phase 3: Entity Enhancement Schema

#### 3.1 Webhook Monitoring Properties
```cypher
// Add to existing Entity nodes
(:Entity {
  // Webhook Configuration
  webhookEnabled: Boolean,        // Enable monitoring for this entity
  webhookPriority: String,        // HIGH, MEDIUM, LOW
  webhookTriggers: [String],      // Array of trigger types
  webhookEndpoints: [String],     // Target webhook URLs
  
  // Monitoring Metadata
  lastWebhookTrigger: DateTime,   // Last webhook trigger time
  webhookTriggerCount: Integer,   // Total webhook triggers
  lastWebhookPayload: String,     // Last webhook payload (JSON)
  
  // RFP Specific
  rfpMonitoringEnabled: Boolean,  // Enable RFP monitoring
  lastRFPDetection: DateTime,     // Last RFP detection
  rfpDetectionCount: Integer,     // Total RFP detections
  rfpKeywords: [String],          // Custom RFP keywords
  
  // Change Tracking
  lastSignificantChange: DateTime, // Last significant change
  changeScore: Float,             // 0.0-1.0 change significance
  monitoringScore: Float          // 0.0-1.0 monitoring priority
})
```

#### 3.2 Webhook Event Nodes
```cypher
(:WebhookEvent {
  eventId: String,                // Unique event ID
  eventType: String,              // RFP_DETECTION, ENTITY_CHANGE, etc.
  entityId: String,               // Reference to monitored entity
  timestamp: DateTime,            // Event timestamp
  priority: String,               // HIGH, MEDIUM, LOW
  processed: Boolean,             // Processing status
  payload: String,                // Full event payload (JSON)
  responseRequired: Boolean,      // Action required flag
  deadline: DateTime,             // Response deadline
  assignedTo: String,             // Assigned team member
  
  // Processing Metadata
  processingAttempts: Integer,    // Number of processing attempts
  lastProcessed: DateTime,        // Last processing attempt
  processingError: String         // Last processing error
})
```

#### 3.3 Monitoring Relationships
```cypher
(:Entity)-[:TRIGGERED {event_type: String, timestamp: DateTime}]->(:WebhookEvent)
(:Entity)-[:MONITORED_BY {priority: String, enabled: Boolean}]->(:MonitoringService)
(:WebhookEvent)-[:REQUIRES_ACTION {action_type: String, deadline: DateTime}]->(:ActionItem)
(:WebhookEvent)-[:PROCESSED_BY {timestamp: DateTime, success: Boolean}]->(:WebhookEndpoint)
```

## 🔧 Implementation Plan

### Step 1: Schema Migration
```cypher
// Add webhook monitoring properties to existing entities
MATCH (e:Entity)
WHERE e.yellowPantherPriority <= 5  // Target high-priority entities first
SET e.webhookEnabled = true,
    e.webhookPriority = CASE 
      WHEN e.yellowPantherPriority <= 3 THEN 'HIGH'
      WHEN e.yellowPantherPriority <= 7 THEN 'MEDIUM'
      ELSE 'LOW'
    END,
    e.webhookTriggers = ['procurement_announcement', 'executive_hire', 'technology_investment'],
    e.rfpMonitoringEnabled = true,
    e.monitoringScore = (10 - e.yellowPantherPriority) / 10.0
RETURN count(e) as entities_updated;
```

### Step 2: Webhook Event Tracking
```cypher
// Create webhook event nodes for tracking
CREATE (we:WebhookEvent {
  eventId: randomUUID(),
  eventType: 'RFP_DETECTION',
  entityId: 'entity_neo4j_id',
  timestamp: datetime(),
  priority: 'HIGH',
  processed: false,
  responseRequired: true,
  deadline: datetime() + duration({hours: 24})
});
```

### Step 3: Trigger Configuration
```javascript
// Configure triggers based on Yellow Panther business profile
const RFP_TRIGGERS = {
  // High Priority Mobile App Indicators
  MOBILE_APP_RFP: {
    keywords: [
      'mobile app development',
      'official app',
      'fan engagement app',
      'ticketing app',
      'sports app'
    ],
    budget_indicators: [
      'enterprise solution',
      'scalable platform',
      'multi-year project'
    ],
    yellow Panther_fit: 'PERFECT_FIT',
    priority: 10
  },
  
  // Digital Transformation Indicators
  DIGITAL_TRANSFORMATION_RFP: {
    keywords: [
      'digital transformation',
      'digital strategy',
      'modernization',
      'technology overhaul'
    ],
    budget_indicators: [
      'comprehensive solution',
      'end-to-end digital',
      'full-scale transformation'
    ],
    yellow_panther_fit: 'PERFECT_FIT',
    priority: 9
  }
};
```

## 📊 Monitoring & Analytics

### Webhook Performance Metrics
```cypher
// Query webhook performance
MATCH (e:Entity)-[t:TRIGGERED]->(we:WebhookEvent)
WHERE we.timestamp >= datetime() - duration({days: 30})
RETURN e.type as entity_type,
       count(we) as webhook_events,
       sum(CASE WHEN we.processed = true THEN 1 ELSE 0 END) as processed_events,
       avg(we.processingAttempts) as avg_processing_attempts,
       count(CASE WHEN we.responseRequired = true THEN 1 END) as action_required_events
ORDER BY webhook_events DESC;
```

### RFP Detection Success Rate
```cypher
// RFP detection effectiveness
MATCH (e:Entity)
WHERE e.webhookEnabled = true
RETURN e.yellowPantherFit as fit_category,
       count(e) as monitored_entities,
       sum(e.rfpDetectionCount) as total_rfp_detections,
       avg(e.rfpDetectionCount) as avg_detections_per_entity,
       sum(CASE WHEN e.lastRFPDetection >= datetime() - duration({days: 30}) THEN 1 ELSE 0 END) as_recent_detections;
```

## 🚀 Next Steps

1. **Schema Implementation**: Add webhook monitoring properties to existing entities
2. **Webhook Infrastructure**: Set up webhook endpoints and event processing
3. **Trigger Configuration**: Configure RFP detection triggers based on business profile
4. **Monitoring Dashboard**: Create real-time webhook monitoring interface
5. **Integration Testing**: Test webhook delivery and processing
6. **Performance Optimization**: Optimize for real-time processing

---

**Status**: ✅ Schema designed and ready for implementation  
**Priority**: 🎯 **HIGH** - Core to RFP detection strategy  
**Integration**: 🔄 Ready for Yellow Panther Business Profile alignment  
**Timeline**: 📅 **2-3 weeks** for full implementation