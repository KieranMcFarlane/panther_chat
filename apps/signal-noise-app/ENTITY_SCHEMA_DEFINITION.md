# Signal Noise App - Complete Entity Schema Definition

## Overview
This schema defines the comprehensive data structure for all entity types in the Signal Noise App knowledge graph, designed for enrichment with BrightData, Perplexity, and AuraDB (Neo4j).

## Core Entity Types

### 1. Club Entity Schema
```json
{
  "type": "Club",
  "labels": ["Club", "Entity"],
  "required_fields": {
    "name": "string",
    "type": "club",
    "sport": "string",
    "country": "string"
  },
  "optional_fields": {
    "stadium": "string",
    "league": "string",
    "level": "string",
    "founded": "string|number",
    "website": "string",
    "linkedin_url": "string",
    "social_media": {
      "twitter": "string",
      "instagram": "string",
      "facebook": "string",
      "youtube": "string"
    },
    "contact": {
      "phone": "string",
      "email": "string",
      "address": "string"
    },
    "digital_maturity": "LOW|MEDIUM|HIGH",
    "estimated_value": "string",
    "revenue": "string",
    "staff_count": "number",
    "member_count": "number",
    "colors": "string[]",
    "nickname": "string",
    "sponsorships": "string[]",
    "partners": "string[]",
    "achievements": "string[]",
    "description": "string",
    "opportunity_score": "number",
    "relationship_score": "number",
    "yellow_panther_priority": "number",
    "last_contact": "string",
    "notes": "string"
  },
  "enrichment_targets": {
    "brightdata": ["financial_data", "sponsorship_deals", "recent_news", "market_analysis"],
    "perplexity": ["strategic_priorities", "technology initiatives", "market_position", "competitive_analysis"],
    "neo4j_queries": ["leadership_team", "ownership_structure", "partnership_network", "historical_performance"]
  }
}
```

### 2. Person Entity Schema
```json
{
  "type": "Person",
  "labels": ["Person", "Entity"],
  "required_fields": {
    "name": "string",
    "type": "person"
  },
  "optional_fields": {
    "role": "string",
    "position": "string",
    "seniority": "C_LEVEL|DIRECTOR|MANAGER|SPECIALIST|COACH|PLAYER",
    "department": "string",
    "team": "string",
    "organization": "string",
    "contact": {
      "email": "string",
      "phone": "string",
      "linkedin_url": "string",
      "twitter": "string"
    },
    "location": {
      "city": "string",
      "country": "string",
      "timezone": "string"
    },
    "bio": "string",
    "experience": "string",
    "education": "string[]",
    "achievements": "string[]",
    "specializations": "string[]",
    "languages": "string[]",
    "expertise": "string[]",
    "decision_maker": "boolean",
    "influence_level": "HIGH|MEDIUM|LOW",
    "communication_style": "string",
    "preferred_contact_time": "string",
    "response_rate": "number",
    "relationship_score": "number",
    "opportunity_score": "number",
    "last_contact": "string",
    "network_strength": "number",
    "career_background": {
      "previous_roles": "string[]",
      "career_progression": "string",
      "industry_expertise": "string[]"
    },
    "decision_making_patterns": {
      "partnership_philosophy": "string",
      "technology_focus": "string[]",
      "recent_investments": "string[]",
      "budget_authority": "string"
    },
    "strategic_focus": {
      "current_priorities": "string[]",
      "technology_scouting": "string[]",
      "innovation_criteria": "string[]"
    }
  },
  "enrichment_targets": {
    "brightdata": ["professional_background", "contact_information", "social_media_presence", "career_progression"],
    "perplexity": ["strategic_priorities", "industry influence", "decision making patterns", "technology interests"],
    "neo4j_queries": ["career_history", "professional_network", "board_positions", "investment_activities"]
  }
}
```

### 3. League Entity Schema
```json
{
  "type": "League",
  "labels": ["League", "Entity"],
  "required_fields": {
    "name": "string",
    "type": "league",
    "sport": "string"
  },
  "optional_fields": {
    "country": "string",
    "level": "string",
    "teams": "number",
    "members": "number",
    "founded": "string|number",
    "website": "string",
    "headquarters": "string",
    "commissioner": "string",
    "contact": {
      "email": "string",
      "phone": "string",
      "address": "string"
    },
    "social_media": {
      "twitter": "string",
      "instagram": "string",
      "facebook": "string",
      "youtube": "string",
      "linkedin": "string"
    },
    "sponsorships": "string[]",
    "broadcast_partners": "string[]",
    "technology_partners": "string[]",
    "revenue": "string",
    "viewership": "string",
    "digital_maturity": "LOW|MEDIUM|HIGH",
    "description": "string",
    "governing_body": "string",
    "regulations": "string",
    "competitions": "string[]",
    "opportunity_score": "number",
    "relationship_score": "number",
    "yellow_panther_priority": "number",
    "last_contact": "string",
    "notes": "string"
  },
  "enrichment_targets": {
    "brightdata": ["financial_performance", "media_deals", "sponsorship_values", "membership_data"],
    "perplexity": ["strategic_initiatives", "digital_transformation", "market_analysis", "competitive_positioning"],
    "neo4j_queries": ["member_clubs", "governance_structure", "commercial_partnerships", "regulatory_framework"]
  }
}
```

### 4. Organization Entity Schema
```json
{
  "type": "Organization",
  "labels": ["Organization", "Entity"],
  "required_fields": {
    "name": "string",
    "type": "organization"
  },
  "optional_fields": {
    "subtype": "AGENCY|GOVERNING_BODY|ASSOCIATION|PARTNER|SUPPLIER|COMPANY",
    "industry": "string",
    "sector": "string",
    "size": "SMALL|MEDIUM|LARGE|ENTERPRISE",
    "sport_focus": "string[]",
    "country": "string",
    "headquarters": "string",
    "founded": "string|number",
    "website": "string",
    "linkedin_url": "string",
    "contact": {
      "email": "string",
      "phone": "string",
      "address": "string"
    },
    "social_media": {
      "twitter": "string",
      "instagram": "string",
      "facebook": "string",
      "youtube": "string",
      "linkedin": "string"
    },
    "services": "string[]",
    "products": "string[]",
    "clients": "string[]",
    "partners": "string[]",
    "competitors": "string[]",
    "digital_maturity": "LOW|MEDIUM|HIGH",
    "current_tech_stack": "string[]",
    "recent_initiatives": "string[]",
    "estimated_value": "string",
    "revenue": "string",
    "staff_count": "number",
    "description": "string",
    "opportunity_score": "number",
    "relationship_score": "number",
    "yellow_panther_priority": "number",
    "last_contact": "string",
    "notes": "string"
  },
  "enrichment_targets": {
    "brightdata": ["company_financials", "client_portfolio", "market_position", "industry_ranking"],
    "perplexity": ["strategic_direction", "technology_adoption", "market_opportunities", "competitive_advantages"],
    "neo4j_queries": ["client_relationships", "partnership_network", "industry_connections", "service_ecosystem"]
  }
}
```

### 5. Partner Entity Schema
```json
{
  "type": "Partner",
  "labels": ["Partner", "Entity"],
  "required_fields": {
    "name": "string",
    "type": "partner"
  },
  "optional_fields": {
    "subtype": "TECHNOLOGY|SPONSOR|MEDIA|CONSULTANT|SUPPLIER|AGENCY",
    "industry": "string",
    "sector": "string",
    "size": "SMALL|MEDIUM|LARGE|ENTERPRISE",
    "sport_focus": "string[]",
    "country": "string",
    "headquarters": "string",
    "founded": "string|number",
    "website": "string",
    "linkedin_url": "string",
    "contact": {
      "email": "string",
      "phone": "string",
      "address": "string"
    },
    "services": "string[]",
    "products": "string[]",
    "clients": "string[]",
    "partners": "string[]",
    "competitors": "string[]",
    "digital_maturity": "LOW|MEDIUM|HIGH",
    "current_tech_stack": "string[]",
    "recent_initiatives": "string[]",
    "estimated_value": "string",
    "revenue": "string",
    "staff_count": "number",
    "description": "string",
    "opportunity_score": "number",
    "relationship_score": "number",
    "yellow_panther_priority": "number",
    "last_contact": "string",
    "notes": "string"
  },
  "enrichment_targets": {
    "brightdata": ["partnership_portfolio", "market_reach", "service_capabilities", "financial_stability"],
    "perplexity": ["partnership_strategy", "innovation_focus", "market_trends", "collaboration_opportunities"],
    "neo4j_queries": ["partnership_network", "client_base", "service_delivery", "market_presence"]
  }
}
```

### 6. Opportunity Entity Schema
```json
{
  "type": "Opportunity",
  "labels": ["Opportunity", "Entity"],
  "required_fields": {
    "title": "string",
    "type": "opportunity"
  },
  "optional_fields": {
    "category": "RFP|TENDER|PARTNERSHIP|SPONSORSHIP|TECHNOLOGY|CONSULTING",
    "source": "LINKEDIN|WEBSITE|REFERRAL|DIRECT|PUBLIC",
    "organization": "string",
    "contact_person": "string",
    "estimated_value": "string",
    "currency": "string",
    "urgency_level": "LOW|MEDIUM|HIGH|CRITICAL",
    "deadline": "string",
    "deadline_estimate": "string",
    "requirements": "string[]",
    "business_objectives": "string[]",
    "technical_specifications": "string[]",
    "evaluation_criteria": "string[]",
    "fit_score": "number",
    "feasibility_score": "number",
    "competition": "string[]",
    "source_url": "string",
    "description": "string",
    "status": "ACTIVE|WON|LOST|ON_HOLD|CLOSED",
    "created_at": "string",
    "updated_at": "string",
    "assigned_to": "string",
    "notes": "string"
  },
  "enrichment_targets": {
    "brightdata": ["market_analysis", "competitive_landscape", "organization_research", "decision_maker_identification"],
    "perplexity": ["strategic_alignment", "solution_feasibility", "market_trends", "competitive_positioning"],
    "neo4j_queries": ["related_opportunities", "past_engagements", "competitive_wins", "team_capabilities"]
  }
}
```

## Relationship Types

### Core Relationships
```json
{
  "WORKS_AT": {
    "from": "Person",
    "to": ["Club", "Organization", "League", "Partner"],
    "properties": {
      "role": "string",
      "start_date": "string",
      "end_date": "string",
      "seniority": "string",
      "department": "string",
      "responsibilities": "string[]",
      "verified": "boolean",
      "source": "string"
    }
  },
  "MANAGES": {
    "from": "Person",
    "to": ["Club", "Organization", "League"],
    "properties": {
      "management_type": "EXECUTIVE|OPERATIONAL|STRATEGIC",
      "scope": "string",
      "start_date": "string",
      "end_date": "string",
      "verified": "boolean"
    }
  },
  "PARTNER_OF": {
    "from": ["Club", "Organization", "Partner"],
    "to": ["Club", "Organization", "Partner"],
    "properties": {
      "partnership_type": "SPONSORSHIP|TECHNOLOGY|MEDIA|STRATEGIC|SUPPLY",
      "start_date": "string",
      "end_date": "string",
      "value": "string",
      "currency": "string",
      "scope": "string",
      "status": "ACTIVE|EXPIRED|PENDING"
    }
  },
  "MEMBER_OF": {
    "from": ["Club", "Organization"],
    "to": "League",
    "properties": {
      "membership_type": "FULL|ASSOCIATE|AFFILIATE",
      "join_date": "string",
      "status": "ACTIVE|SUSPENDED|EXPIRED",
      "division": "string",
      "league_level": "string"
    }
  },
  "COMPETES_WITH": {
    "from": ["Club", "Organization"],
    "to": ["Club", "Organization"],
    "properties": {
      "competition_type": "SPORTING|COMMERCIAL|MARKET",
      "intensity": "HIGH|MEDIUM|LOW",
      "market": "string[]",
      "historical_data": "string[]"
    }
  },
  "KNOWS": {
    "from": "Person",
    "to": "Person",
    "properties": {
      "relationship_type": "PROFESSIONAL|PERSONAL|SOCIAL",
      "strength": "STRONG|MODERATE|WEAK",
      "context": "string",
      "verified": "boolean",
      "source": "string"
    }
  },
  "REPORTS_TO": {
    "from": "Person",
    "to": "Person",
    "properties": {
      "reporting_type": "DIRECT|INDIRECT|FUNCTIONAL",
      "start_date": "string",
      "end_date": "string",
      "verified": "boolean"
    }
  },
  "HAS_OPPORTUNITY": {
    "from": ["Club", "Organization", "Person"],
    "to": "Opportunity",
    "properties": {
      "opportunity_type": "RFP|TENDER|PARTNERSHIP",
      "stage": "IDENTIFIED|QUALIFIED|PROPOSAL|NEGOTIATION|CLOSED",
      "assigned_to": "string",
      "priority": "HIGH|MEDIUM|LOW",
      "value": "string"
    }
  },
  "LOCATED_IN": {
    "from": ["Club", "Organization", "Person"],
    "to": "Location",
    "properties": {
      "location_type": "HEADQUARTERS|BRANCH|HOME|VENUE",
      "address": "string",
      "coordinates": "string",
      "timezone": "string"
    }
  }
}
```

## Enrichment Configuration

### BrightData Integration
```json
{
  "brightdata_enrichment": {
    "endpoints": {
      "company_research": "/v1/companies/domain",
      "person_research": "/v1/people/search",
      "news_monitoring": "/v1/news/search",
      "market_intelligence": "/v1/markets/analysis"
    },
    "data_points": {
      "financial": ["revenue", "profit", "funding", "valuation"],
      "organizational": ["employee_count", "locations", "subsidiaries", "hierarchy"],
      "market": ["market_share", "competitors", "growth_rate", "trends"],
      "digital": ["website_tech", "social_presence", "digital_initiatives"],
      "people": ["leadership_changes", "hiring_patterns", "executive_profiles"]
    },
    "refresh_frequency": {
      "financial_data": "quarterly",
      "organizational_data": "monthly",
      "market_data": "weekly",
      "news_monitoring": "daily"
    }
  }
}
```

### Perplexity Integration
```json
{
  "perplexity_enrichment": {
    "capabilities": {
      "market_analysis": "Industry trends, competitive positioning, market size",
      "strategic_insights": "Business strategy, technology adoption, innovation focus",
      "financial_intelligence": "Performance metrics, investment patterns, financial health",
      "relationship_mapping": "Partnership networks, competitive relationships, ecosystem analysis"
    },
    "query_templates": {
      "company_overview": "Provide strategic overview of {entity_name} in {industry}",
      "competitive_analysis": "Analyze competitive position of {entity_name} vs {competitors}",
      "market_opportunities": "Identify growth opportunities for {entity_name} in {market}",
      "technology_assessment": "Evaluate technology stack and digital maturity of {entity_name}"
    },
    "response_schema": {
      "executive_summary": "string",
      "key_findings": "string[]",
      "recommendations": "string[]",
      "confidence_score": "number",
      "sources": "string[]",
      "last_updated": "string"
    }
  }
}
```

### Neo4j (AuraDB) Schema
```cypher
// Indexes for performance
CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type);
CREATE INDEX person_email_index IF NOT EXISTS FOR (p:Person) ON (p.email);
CREATE INDEX club_website_index IF NOT EXISTS FOR (c:Club) ON (c.website);
CREATE INDEX organization_industry_index IF NOT EXISTS FOR (o:Organization) ON (o.industry);

// Vector index for semantic search
CREATE VECTOR INDEX entity_embeddings IF NOT EXISTS
FOR (n:Entity)
ON n.embedding
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1536,
    `vector.similarity_function`: 'cosine'
  }
};

// Full-text search index
CREATE FULLTEXT INDEX entity_search_index IF NOT EXISTS
FOR (e:Entity) ON EACH [e.name, e.description, e.type, e.sport, e.country];

// Constraint for unique entities
CREATE CONSTRAINT entity_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.name IS UNIQUE;

// Constraint for unique emails
CREATE CONSTRAINT person_email_unique IF NOT EXISTS
FOR (p:Person) REQUIRE p.email IS UNIQUE;
```

## Data Quality and Validation

### Validation Rules
```json
{
  "validation_rules": {
    "required_fields": {
      "all_entities": ["name", "type"],
      "clubs": ["sport", "country"],
      "persons": ["name"],
      "organizations": ["industry"],
      "leagues": ["sport"]
    },
    "format_validation": {
      "email": "email_format",
      "website": "url_format",
      "phone": "phone_format",
      "date": "iso_date_format"
    },
    "enum_validation": {
      "digital_maturity": ["LOW", "MEDIUM", "HIGH"],
      "seniority": ["C_LEVEL", "DIRECTOR", "MANAGER", "SPECIALIST"],
      "urgency_level": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      "entity_type": ["Club", "Person", "League", "Organization", "Partner", "Opportunity"]
    },
    "range_validation": {
      "scores": {"min": 0, "max": 100},
      "year": {"min": 1800, "max": 2030}
    }
  }
}
```

### Data Refresh Strategy
```json
{
  "refresh_strategy": {
    "high_priority_entities": {
      "frequency": "daily",
      "sources": ["brightdata", "perplexity", "manual_update"],
      "triggers": ["opportunity_detection", "relationship_change", "score_threshold"]
    },
    "medium_priority_entities": {
      "frequency": "weekly",
      "sources": ["brightdata", "perplexity"],
      "triggers": ["scheduled_update", "data_staleness"]
    },
    "low_priority_entities": {
      "frequency": "monthly",
      "sources": ["perplexity", "manual_update"],
      "triggers": ["scheduled_update", "user_request"]
    }
  }
}
```

## Usage Examples

### Entity Creation Example
```javascript
// Create a Club entity
const clubEntity = {
  name: "Arsenal FC",
  type: "club",
  sport: "Football",
  country: "England",
  stadium: "Emirates Stadium",
  league: "Premier League",
  founded: 1886,
  website: "https://www.arsenal.com",
  linkedin_url: "https://www.linkedin.com/company/arsenal",
  digital_maturity: "HIGH",
  estimated_value: "£2.3B",
  revenue: "£368M",
  staff_count: 650,
  opportunity_score: 92,
  relationship_score: 78,
  yellow_panther_priority: 90
};

// Create a Person entity
const personEntity = {
  name: "Vinai Venkatesham",
  type: "person",
  role: "Chief Executive Officer",
  seniority: "C_LEVEL",
  department: "Executive",
  organization: "Arsenal FC",
  email: "vinai.venkatesham@arsenal.com",
  linkedin_url: "https://www.linkedin.com/in/vinaivenkatesham",
  decision_maker: true,
  influence_level: "HIGH",
  opportunity_score: 96,
  relationship_score: 90
};
```

### Enrichment Query Example
```python
# BrightData enrichment request
brightdata_request = {
    "entity": "Arsenal FC",
    "data_points": [
        "financial_performance",
        "sponsorship_deals", 
        "recent_news",
        "market_analysis"
    ],
    "filters": {
        "date_range": "last_90_days",
        "regions": ["Europe", "UK"],
        "sources": ["financial_news", "sports_business", "official_reports"]
    }
}

# Perplexity enrichment request
perplexity_request = {
    "entity": "Arsenal FC",
    "query_type": "strategic_analysis",
    "focus_areas": [
        "digital_transformation initiatives",
        "commercial revenue growth strategies",
        "technology partnership opportunities",
        "fan engagement innovations"
    ],
    "context": "sports technology market analysis"
}
```

## Integration Implementation

This schema is designed to work with your existing MCP tools:
- **BrightData MCP**: Use for structured data enrichment, web research, and market intelligence
- **Perplexity MCP**: Use for strategic analysis, market insights, and business intelligence  
- **Neo4j MCP**: Use for storing relationships, knowledge graph queries, and semantic search
- **Better Auth MCP**: Use for user management and access control to enriched data

The schema provides a comprehensive foundation for your enrichment tools while maintaining flexibility for future expansion and integration with additional data sources.