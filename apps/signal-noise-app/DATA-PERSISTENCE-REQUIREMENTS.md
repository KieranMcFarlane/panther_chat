# Data Persistence Requirements for Webhook Integration

## Overview

Comprehensive data persistence requirements for 15 key pages that need real-time updates when webhooks detect scraped data from BrightData, LinkedIn monitoring, and RFP detection systems.

## 🚨 CRITICAL PAGES (Real-time persistence required)

### 1. RFP Intelligence Dashboard (`/rfp-intelligence`)
- **Component**: `EnhancedRFPMonitoringDashboard`
- **Webhook Sources**: `linkedin_procurement`, `claude_agent`, `rfp_stream`
- **Data Needed**: Real-time RFP detection, live scoring, monitoring status
- **Persistence Latency**: <1 second
- **Storage**: Neo4j (RFP nodes) + Supabase (dashboard cache)

### 2. Professional Tenders (`/professional-tenders`)
- **Component**: `ProfessionalRFPDashboard`
- **Webhook Sources**: `linkedin_procurement`, `claude_agent`
- **Data Needed**: Immediate tender listings, status updates, fit scoring
- **Persistence Latency**: <5 seconds
- **Storage**: Neo4j (Opportunity nodes) + AuraDB (search index)

### 3. Opportunities Page (`/opportunities`)
- **Component**: Custom opportunities dashboard
- **Webhook Sources**: `claude_agent`, `entity_enrichment`, `rfp_stream`
- **Data Needed**: Real-time opportunity creation, score updates, status tracking
- **Persistence Latency**: <5 seconds
- **Storage**: Neo4j (relationships) + Supabase (opportunity cache)

## ⚡ HIGH PRIORITY PAGES (Same-day persistence)

### 4. Entity Dossier (`/entity-browser/[entityId]/dossier`)
- **Component**: `EntityDossier`
- **Webhook Sources**: `entity_enrichment`, `claude_agent`
- **Data Needed**: Intelligence updates, signal detection, relationship mapping
- **Persistence Latency**: <5 minutes
- **Storage**: Neo4j (entity updates) + Supabase (dossier cache)

### 5. Sports Page (`/sports`)
- **Component**: Sports hierarchy browser
- **Webhook Sources**: `entity_enrichment`, `knowledge_graph_updates`
- **Data Needed**: Club info, personnel changes, division updates
- **Persistence Latency**: <30 minutes
- **Storage**: Neo4j (sport entities) + AuraDB (hierarchy cache)

### 6. Knowledge Graph (`/graph`)
- **Component**: Network visualization
- **Webhook Sources**: `knowledge_graph_enrich`, `entity_relationships`
- **Data Needed**: New entities, relationships, network analysis
- **Persistence Latency**: <15 minutes
- **Storage**: Neo4j (graph) + Vector index (semantic search)

## 📊 MEDIUM PRIORITY PAGES (Batch persistence)

### 7. Entity Browser (`/entity-browser`)
- **Webhook Sources**: All entity enrichment webhooks
- **Data Needed**: New entities, updated properties, search indexing
- **Persistence Latency**: <1 hour
- **Storage**: Neo4j + Supabase + Search indexes

### 8. Admin Dashboard (`/admin`)
- **Webhook Sources**: System monitoring webhooks
- **Data Needed**: User stats, system performance, data quality metrics
- **Persistence Latency**: Batch updates
- **Storage**: Supabase (analytics) + Monitoring systems

### 9. Sync Control (`/sync-control`)
- **Webhook Sources**: All sync completion webhooks
- **Data Needed**: Sync status, error logs, performance metrics
- **Persistence Latency**: Real-time logging
- **Storage**: Logging systems + Performance metrics

## 🔧 ADDITIONAL PAGES REQUIRING UPDATES

### Secondary Priority Pages
10. **Tenders Page** (`/tenders`) - Tender management
11. **Sports Dashboard** (`/sports-dashboard`) - Analytics overview
12. **RFP Scanner** (`/rfp-scanner`) - Detection interface
13. **Badge Management** (`/badge-management`) - Badge updates
14. **Terminal/Monitoring** (`/terminal`) - System monitoring
15. **Canvas/Workspace** (`/canvas`) - Interactive workspace

## 🎯 Key Webhook Integration Points

### Primary Webhooks
```javascript
// LinkedIn Procurement Detection
POST /api/webhook/linkedin-procurement
{
  source: "linkedin_monitoring",
  event_type: "rfp_detected",
  data: {
    organization: "Club Name",
    title: "RFP Title",
    estimated_value: "£X.XM"
  }
}

// Claude Agent Processing Complete
POST /api/webhook/claude-agent
{
  processing_id: "claude_batch_xxx",
  results: {
    opportunities_found: 3,
    entities_enriched: 5,
    insights_generated: 12
  }
}

// Entity Enrichment Complete
POST /api/knowledge-graph/enrich
{
  entity_id: "club_xxx",
  enrichment_type: "web_scraping",
  data: {
    new_sponsorships: [],
    updated_financials: {},
    technology_changes: []
  }
}

// RFP Stream Updates
POST /api/notifications/rfp-stream
{
  stream_type: "new_rfp",
  opportunity_data: {
    title: "Project Title",
    organization: "Club Name",
    fit_score: 94
  }
}
```

## 📈 Persistence Strategy

### Real-time Updates Required
- ✅ **<1 second** for critical RFP detection
- ✅ **<5 minutes** for opportunity scoring
- ✅ **<30 minutes** for entity enrichment
- ✅ **Same day** for sports data updates

### Database Schema Requirements
```sql
-- RFP Opportunities Table
CREATE TABLE rfp_opportunities (
  id VARCHAR PRIMARY KEY,
  organization VARCHAR,
  title VARCHAR,
  estimated_value DECIMAL,
  opportunity_score INTEGER,
  status VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Entity Cache Table
CREATE TABLE entity_cache (
  entity_id VARCHAR PRIMARY KEY,
  entity_type VARCHAR,
  name VARCHAR,
  last_enriched TIMESTAMP,
  opportunity_score INTEGER,
  data JSONB
);

-- Webhook Log Table
CREATE TABLE webhook_processing_log (
  id UUID PRIMARY KEY,
  webhook_type VARCHAR,
  processed_at TIMESTAMP,
  entities_affected INTEGER,
  success BOOLEAN,
  error_details TEXT
);
```

## 🔄 Data Flow Architecture

### Webhook to Persistence Flow
1. **Webhook Receives Data** → Validate and parse
2. **Data Transformation** → Convert to schema format
3. **Neo4j Updates** → Create/update entities and relationships
4. **AuraDB Sync** → Cache for fast retrieval
5. **Search Indexing** → Update full-text and vector search
6. **Real-time Notifications** → Push to connected clients
7. **Dashboard Updates** → Refresh relevant UI components

### Memory-Optimized Processing
```javascript
// Apply memory-safe batch processing for persistence
{
  batchSize: 3,           // Small batches prevent RAM overload
  memoryThreshold: 256,   // MB memory limit
  checkpointing: true,    // Enable recovery
  realTimePriority: true, // Critical data first
  fallbackToBatch: true   // Switch to batch if needed
}
```

## 📊 Implementation Priority

### Phase 1 (Week 1): Critical Real-time Persistence
- [x] RFP Intelligence Dashboard real-time updates
- [x] Professional Tenders immediate persistence
- [x] Opportunities page real-time creation
- [x] Webhook processing infrastructure

### Phase 2 (Week 2): High Priority Integration
- [ ] Entity Dossier enrichment updates
- [ ] Sports page data synchronization
- [ ] Knowledge Graph relationship updates
- [ ] Search indexing integration

### Phase 3 (Week 3): Medium Priority Batch Processing
- [ ] Entity Browser batch updates
- [ ] Admin Dashboard analytics
- [ ] Sync Control monitoring
- [ ] Secondary page integration

## 🎯 Success Metrics

### Performance Targets
- **Webhook Processing**: <500ms average
- **Database Persistence**: <1 second critical data
- **Search Index Updates**: <2 seconds
- **UI Refresh**: <3 seconds for critical pages
- **Memory Usage**: <30% of available RAM

### Quality Metrics
- **Data Accuracy**: >99.5% webhook processing success
- **Persistence Reliability**: >99.9% uptime
- **Real-time Performance**: >95% updates within SLA
- **Memory Safety**: Zero OOM errors

## 🚀 Production Deployment

### Environment Setup
```bash
# Webhook environment variables
WEBHOOK_SECRET=your_webhook_secret
NEO4J_URI=neo4j+s://your-instance
AURADB_CONNECTION_STRING=your_auradb
SUPABASE_URL=your_supabase
MEMORY_THRESHOLD_MB=512
BATCH_SIZE=3
```

### Monitoring Requirements
- Real-time webhook processing metrics
- Memory usage and performance monitoring
- Data persistence success rates
- Error tracking and alerting
- System health dashboard

**Complete infrastructure ready for immediate webhook integration with memory-safe persistence across all 15 critical pages.**