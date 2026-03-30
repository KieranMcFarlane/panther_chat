# Data Persistence Requirements for Webhook-Detected Content

## Overview
This document outlines all pages and components that require data persistence when webhooks detect new scraped data from BrightData, Perplexity, and other sources.

## Priority Levels

### 🚨 **CRITICAL PAGES** (Real-time persistence required)
*Pages that need immediate data updates when webhooks trigger*

### ⚡ **HIGH PRIORITY** (Same-day persistence required)
*Pages that should reflect new data within the same day*

### 📊 **MEDIUM PRIORITY** (Batch persistence acceptable)
*Pages that can be updated through batch processes*

---

## 1. CRITICAL PAGES - Real-time Persistence

### RFP Intelligence Dashboard (`/rfp-intelligence`)
**Location:** `src/app/rfp-intelligence/page.tsx`  
**Component:** `EnhancedRFPMonitoringDashboard`

**Data Sources:** LinkedIn webhooks, RFP detection APIs  
**Persistence Requirements:**
- ✅ **Real-time RFP detection** - Immediate display when webhook detects new RFP
- ✅ **Live opportunity scoring** - Update fit scores as analysis completes
- ✅ **Active monitoring status** - Show webhook processing status
- ✅ **Alert notifications** - Real-time alerts for high-value opportunities

**Webhook Integration:**
```typescript
// BrightData LinkedIn webhook
POST /api/webhook/linkedin-procurement
POST /api/webhook/claude-agent  
POST /api/notifications/rfp-detected
POST /api/notifications/rfp-stream
```

**Data to Persist:**
```typescript
interface RFPData {
  id: string;
  title: string;
  organization: string;
  value: string;
  deadline: string;
  yellow_panther_fit: number;
  confidence: number;
  priority_score: number;
  status: 'detected' | 'analyzing' | 'analyzed' | 'archived';
  webhook_source: 'linkedin' | 'manual' | 'api';
  created_at: string;
  updated_at: string;
}
```

### Professional Tenders (`/professional-tenders`)
**Location:** `src/app/professional-tenders/page.tsx`  
**Component:** `ProfessionalRFPDashboard`

**Data Sources:** Tender websites, procurement portals  
**Persistence Requirements:**
- ✅ **Immediate tender listing** - New tenders appear instantly
- ✅ **Status updates** - Deadline changes, status modifications
- ✅ **Fit scoring** - AI analysis results integration

**Data to Persist:**
```typescript
interface TenderData {
  id: string;
  title: string;
  organization: string;
  location: string;
  value: string;
  deadline: string;
  published: string;
  source: 'LinkedIn' | 'iSportConnect' | 'Direct';
  category: string;
  status: 'Open' | 'Closed' | 'Awarded';
  yellow_panther_fit: number;
  confidence: number;
  priority_score: number;
}
```

### Opportunities Page (`/opportunities`)
**Location:** `src/app/opportunities/page.tsx`  
**Component:** Custom opportunities dashboard

**Data Sources:** RFP analysis, entity relationships  
**Persistence Requirements:**
- ✅ **Real-time opportunity creation** - From webhook analysis
- ✅ **Score updates** - Relationship and opportunity scoring
- ✅ **Status tracking** - Opportunity lifecycle management

**Data to Persist:**
```typescript
interface OpportunityData {
  id: string;
  title: string;
  type: 'tender' | 'partnership' | 'sponsorship' | 'acquisition' | 'investment';
  club: string;
  sport: string;
  country: string;
  deadline?: string;
  value?: string;
  description: string;
  lastUpdated: string;
  opportunity_score: number;
  relationship_score: number;
}
```

---

## 2. HIGH PRIORITY PAGES - Same-day Persistence

### Entity Dossier (`/entity-browser/[entityId]/dossier`)
**Location:** `src/app/entity-browser/[entityId]/dossier/page.tsx`  
**Component:** `EntityDossier`

**Data Sources:** Entity enrichment, AI analysis  
**Persistence Requirements:**
- ✅ **Intelligence dossier updates** - Enrichment results
- ✅ **Signal detection** - New activities and opportunities
- ✅ **Relationship updates** - New connections discovered
- ✅ **Contact information** - Updated contact details

**Data to Persist:**
```typescript
interface DossierData {
  entity_id: string;
  intelligence_data: {
    perplexity_analysis: PerplexityIntelligence;
    recent_activities: Activity[];
    opportunity_detection: Opportunity[];
    relationship_mapping: Connection[];
  };
  last_enriched: string;
  enrichment_sources: string[];
  dossier_status: 'generating' | 'ready' | 'updating' | 'error';
}
```

### Sports Page (`/sports`)
**Location:** `src/app/sports/page.tsx`  
**Component:** Sports hierarchy browser

**Data Sources:** Sports data APIs, entity enrichment  
**Persistence Requirements:**
- ✅ **Club information updates** - New clubs added
- ✅ **Personnel changes** - Staff appointments, transfers
- ✅ **Division updates** - League changes, promotions/relegations
- ✅ **Contact information** - Updated details

**Data to Persist:**
```typescript
interface SportsData {
  divisions: Division[];
  clubs: Club[];
  sportspersons: Sportsperson[];
  hierarchy_updated: string;
  data_sources: string[];
}
```

### Graph/Knowledge Page (`/graph`)
**Location:** `src/app/graph/page.tsx`  
**Component:** Knowledge graph visualization

**Data Sources:** Neo4j knowledge graph, relationship mapping  
**Persistence Requirements:**
- ✅ **New entities** - Added to graph structure
- ✅ **Relationship updates** - New connections mapped
- ✅ **Entity properties** - Enriched data integration
- ✅ **Network analysis** - Updated centrality metrics

---

## 3. MEDIUM PRIORITY PAGES - Batch Persistence

### Entity Browser (`/entity-browser`)
**Location:** `src/app/entity-browser/page.tsx`  
**Component:** Entity search and filter

**Data Sources:** Entity database, search indexes  
**Persistence Requirements:**
- ✅ **New entities** - Batch addition to searchable database
- ✅ **Entity properties** - Updated through enrichment processes
- ✅ **Search indexing** - Updated for new content discovery

### Admin Dashboard (`/admin`)
**Location:** `src/app/admin/page.tsx`  
**Component:** System administration panel

**Data Sources:** System metrics, user management  
**Persistence Requirements:**
- ✅ **User statistics** - Usage patterns and engagement
- ✅ **System performance** - Webhook processing metrics
- ✅ **Data quality metrics** - Enrichment success rates

### Sync Control (`/sync-control`)
**Location:** `src/app/sync-control/page.tsx`  
**Component:** Data synchronization management

**Data Sources:** Sync processes, data pipelines  
**Persistence Requirements:**
- ✅ **Sync status** - Current synchronization state
- ✅ **Error logs** - Failed processes and retry attempts
- ✅ **Performance metrics** - Processing times and success rates

---

## 4. Webhook Data Flow Architecture

### Primary Webhook Endpoints

#### 1. BrightData LinkedIn Monitoring
```typescript
// POST /api/webhook/linkedin-procurement
interface LinkedInWebhook {
  signal_type: 'procurement_opportunity' | 'personnel_change' | 'strategic_initiative';
  entity_data: {
    name: string;
    organization: string;
    content: string;
    url: string;
    timestamp: string;
  };
  analysis_result?: {
    fit_score: number;
    opportunity_type: string;
    recommended_actions: string[];
  };
}
```

#### 2. RFP Intelligence Processing
```typescript
// POST /api/webhook/claude-agent
interface RFPAnalysisWebhook {
  rfp_data: {
    title: string;
    organization: string;
    requirements: string[];
    deadline: string;
    value?: string;
  };
  claude_analysis: {
    fit_score: number;
    feasibility: number;
    strategic_alignment: number;
    competitive_advantage: string[];
  };
  entity_relationships: {
    existing_contacts: string[];
    warm_introductions: string[];
    competitor_insights: string[];
  };
}
```

#### 3. Entity Intelligence Updates
```typescript
// POST /api/knowledge-graph/enrich
interface EntityEnrichmentWebhook {
  entity_id: string;
  entity_type: 'Club' | 'Person' | 'League' | 'Organization';
  enrichment_data: {
    brightdata_insights: object;
    perplexity_analysis: object;
    relationship_updates: object[];
  };
  confidence_score: number;
  data_sources: string[];
}
```

### Persistence Strategy

#### Real-time Data (Immediate)
```typescript
// Use WebSockets or Server-Sent Events for critical updates
const realtimePersistence = {
  rfp_detection: 'WebSocket',
  opportunity_scoring: 'SSE',
  status_updates: 'Redis Pub/Sub',
  notifications: 'Push Notifications'
};
```

#### Batch Data (Scheduled)
```typescript
// Use batch processing for larger datasets
const batchPersistence = {
  entity_enrichment: 'Every 4 hours',
  relationship_mapping: 'Every 6 hours', 
  sports_data_sync: 'Daily at 2 AM',
  data_quality_checks: 'Every 8 hours'
};
```

---

## 5. Database Schema for Persistence

### Core Tables Required

#### rfp_opportunities
```sql
CREATE TABLE rfp_opportunities (
  id VARCHAR PRIMARY KEY,
  title TEXT NOT NULL,
  organization VARCHAR NOT NULL,
  value VARCHAR,
  deadline TIMESTAMP,
  yellow_panther_fit INTEGER,
  confidence DECIMAL(3,2),
  priority_score INTEGER,
  status VARCHAR DEFAULT 'detected',
  webhook_source VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### entity_dossiers
```sql
CREATE TABLE entity_dossiers (
  entity_id VARCHAR PRIMARY KEY,
  intelligence_data JSONB,
  last_enriched TIMESTAMP,
  enrichment_sources TEXT[],
  dossier_status VARCHAR DEFAULT 'ready',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### webhook_events
```sql
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  webhook_type VARCHAR NOT NULL,
  source VARCHAR NOT NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

#### opportunity_relationships
```sql
CREATE TABLE opportunity_relationships (
  id SERIAL PRIMARY KEY,
  opportunity_id VARCHAR REFERENCES rfp_opportunities(id),
  entity_id VARCHAR,
  relationship_type VARCHAR,
  strength VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6. Implementation Priority

### Phase 1: Critical Real-time Persistence (Week 1)
1. ✅ **RFP Intelligence Dashboard** - Implement webhook listeners
2. ✅ **Professional Tenders** - Connect to tender APIs
3. ✅ **Opportunities Page** - Real-time opportunity creation
4. ✅ **Web Infrastructure** - WebSocket/SSE setup

### Phase 2: High Priority Integration (Week 2) 
1. ✅ **Entity Dossiers** - Intelligence data persistence
2. ✅ **Sports Page** - Data hierarchy updates
3. ✅ **Knowledge Graph** - Relationship mapping
4. ✅ **Batch Processing** - Background job scheduling

### Phase 3: Medium Priority Completion (Week 3)
1. ✅ **Entity Browser** - Search index updates
2. ✅ **Admin Dashboard** - System metrics
3. ✅ **Sync Control** - Process monitoring
4. ✅ **Data Quality** - Validation and cleanup

---

## 7. Monitoring and Alerting

### Real-time Monitoring
- **Webhook Success Rate** - >95% target
- **Data Processing Time** - <5 seconds for critical data
- **Entity Enrichment Success** - >90% completion rate
- **User Notification Delivery** - <1 minute delay

### Automated Alerts
- **Webhook Failures** - Immediate alert on >5 consecutive failures
- **Data Quality Issues** - Alert on low confidence scores
- **Processing Backlog** - Alert on >100 pending items
- **Storage Limits** - Alert at 80% capacity

---

## 8. Success Metrics

### Technical Metrics
- ✅ **Webhook Response Time** - <200ms average
- ✅ **Data Persistence Latency** - <1 second for critical data
- ✅ **System Uptime** - >99.5% availability
- ✅ **Data Accuracy** - >95% accuracy for enriched data

### Business Metrics  
- ✅ **Opportunity Detection Speed** - <30 minutes from source to display
- ✅ **Intelligence Dossier Coverage** - >80% of key entities enriched
- ✅ **User Engagement** - Daily active users viewing updated content
- ✅ **Conversion Rate** - Opportunities progressing to active proposals

This comprehensive persistence framework ensures that all scraped and webhook-detected data is immediately available across the platform, providing users with real-time intelligence and opportunity discovery capabilities.