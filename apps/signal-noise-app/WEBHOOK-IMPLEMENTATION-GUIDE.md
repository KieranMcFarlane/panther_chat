# Webhook Strategy Implementation Guide

## Architecture Overview

```
                   +---------------------------+
                   | Bright Data / Watcher API |
                   |  - Funding rounds         |
                   |  - Posts / Tendres        |
                   |  - Job changes            |
                   +------------+--------------+
                                |
                                | Webhook / Event
                                v
                   +---------------------------+
                   | Tier 1 Entities Only      |
                   | Event-Driven Trigger      |
                   +------------+--------------+
                                |
                                v
                 +------------------------------+
                 | Claude Agent SDK Reasoning   |
                 | - Score & Prioritize         |
                 | - Generate Markdown insights |
                 | - Update memory.md          |
                 +------------+----------------+
                                |
                                v
                   +---------------------------+
                   | Supabase Logs / Neo4j     |
                   | - Store enriched data     |
                   | - Track history           |
                   +------------+--------------+
                                |
                                v
                   +---------------------------+
                   | CopilotKit / AG-UI Front |
                   | - Live feed panel        |
                   | - Progressive streaming  |
                   | - Actionable insights    |
                   +---------------------------+

-----------------------------------------
Batch Enrichment Flow (Tier 2 & 3 Entities)

  +---------------------------+
  | Scheduler / Cron / Queue  |
  +------------+--------------+
               |
               v
  +---------------------------+
  | Batch of Tier 2 & 3       |
  | Entities                  |
  +------------+--------------+
               |
               v
  +---------------------------+
  | Delta Detection           |
  | - Only changed entities   |
  | - Skip static fields      |
  +------------+--------------+
               |
               v
  +---------------------------+
  | Claude Agent SDK          |
  | - Summarize / enrich      |
  | - Generate insights       |
  +------------+--------------+
               |
               v
  +---------------------------+
  | Supabase / Neo4j          |
  | - Store batch results     |
  | - Update knowledge graph  |
  +------------+--------------+
               |
               v
  +---------------------------+
  | CopilotKit / AG-UI Front  |
  | - Daily digest / feed     |
  | - Stream summaries        |
  +---------------------------+
```

## Implementation Files Created

### 1. Enhanced Webhook Receiver
**File**: `src/app/api/webhook/linkedin-procurement/route.ts`
- **Features**: Tier-based entity classification, real-time processing for Tier 1, batch queuing for Tier 2/3
- **Claude Agent SDK Integration**: Full analysis with Neo4j, BrightData, and Perplexity MCP tools
- **Intelligence**: Automatic scoring, memory.md updates, CopilotKit notifications

### 2. Batch Enrichment Service
**File**: `src/app/api/batch/enrichment/route.ts`
- **Features**: Scheduled processing for Tier 2 & 3 entities, delta detection
- **Efficiency**: Only processes changed fields, skips static data
- **Scheduling**: Hourly for Tier 2, daily for Tier 3

### 3. Supabase Cache Layer
**File**: `src/lib/supabase-cache.ts`
- **Features**: Intelligent caching with tier-based expiry, Neo4j synchronization
- **Performance**: Fast frontend access, automatic sync to knowledge graph
- **Management**: Bulk sync operations, cleanup, statistics

### 4. Real-time Streaming
**File**: `src/app/api/streaming/events/route.ts`
- **Features**: Server-Sent Events (SSE) for live updates, client filtering
- **Integration**: CopilotKit frontend streaming, automatic connection management
- **Performance**: Efficient event broadcasting, connection pooling

### 5. Memory Management System
**File**: `src/app/api/memory/route.ts`
- **Features**: Strategic insights storage, daily summaries, searchable knowledge base
- **Integration**: memory.md file updates, database storage, cache integration
- **Intelligence**: Automated insight generation, trend analysis

### 6. Enhanced Frontend Dashboard
**File**: `src/components/rfp/StreamingIntelligenceDashboard.tsx`
- **Features**: Real-time updates, CopilotKit integration, interactive actions
- **UX**: Live streaming, progressive loading, intelligent filtering
- **Actions**: AI-powered interactions, email composition, analysis viewing

## Configuration Requirements

### Environment Variables

```bash
# === Core Services ===
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password
NEO4J_DATABASE=neo4j

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# === AI Services ===
ANTHROPIC_API_KEY=your-claude-api-key
BRIGHTDATA_API_TOKEN=your-brightdata-api-token
PERPLEXITY_API_KEY=your-perplexity-api-key

# === Webhook Security ===
BRIGHTDATA_WEBHOOK_SECRET=your-secure-webhook-secret

# === Application ===
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret
```

### Database Schema (Supabase)

```sql
-- Entity Cache Table
CREATE TABLE entity_cache (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT DEFAULT 'rfp',
  organization TEXT NOT NULL,
  sport TEXT,
  fit_score INTEGER,
  urgency TEXT,
  status TEXT,
  entity_tier INTEGER DEFAULT 2,
  data JSONB NOT NULL,
  neo4j_synced BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Queue Table
CREATE TABLE batch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,
  entity_type TEXT DEFAULT 'rfp',
  entity_tier INTEGER NOT NULL,
  data JSONB NOT NULL,
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  last_processed TIMESTAMP WITH TIME ZONE,
  processing_attempts INTEGER DEFAULT 0
);

-- Memory Entries Table
CREATE TABLE memory_entries (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Stream Table
CREATE TABLE event_stream (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_data JSONB NOT NULL,
  event_type TEXT NOT NULL,
  priority TEXT DEFAULT 'MEDIUM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client Events Table (for SSE)
CREATE TABLE client_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Digest Table
CREATE TABLE daily_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  entity_id TEXT NOT NULL,
  organization TEXT NOT NULL,
  tier INTEGER NOT NULL,
  summary TEXT NOT NULL,
  key_changes TEXT[],
  recommendations TEXT[],
  impact_score TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_entity_cache_expires_at ON entity_cache(expires_at);
CREATE INDEX idx_entity_cache_tier ON entity_cache(entity_tier);
CREATE INDEX idx_batch_queue_status ON batch_queue(status, scheduled_for);
CREATE INDEX idx_memory_entries_type ON memory_entries(memory_type);
CREATE INDEX idx_event_stream_type ON event_stream(event_type, created_at);
```

## Deployment Strategy

### 1. Bright Data Configuration

```javascript
// BrightData Webhook Configuration
const webhookConfig = {
  url: "https://your-domain.com/api/webhook/linkedin-procurement",
  secret: "your-secure-webhook-secret",
  content_types: ["posts", "articles", "company_updates"],
  delivery_format: "json",
  retry_policy: {
    max_retries: 3,
    retry_delay: 30
  },
  filters: {
    keywords: [
      "digital transformation", "fan engagement", "ticketing system", 
      "CRM integration", "data analytics", "mobile app", "cloud migration"
    ],
    companies: ["Premier League", "Manchester United", "Chelsea", "Arsenal"],
    roles: ["CTO", "CEO", "Digital Director", "Head of Innovation"]
  }
};
```

### 2. Cron Job Setup

```bash
# Add to crontab for batch processing
# Tier 2 processing (every hour)
0 * * * * curl -X POST https://your-domain.com/api/batch/enrichment

# Tier 3 processing (daily at 2 AM)
0 2 * * * curl -X POST https://your-domain.com/api/batch/enrichment

# Daily summary generation (daily at 9 AM)
0 9 * * * curl -X POST https://your-domain.com/api/memory -H "Content-Type: application/json" -d '{"action":"generate_daily_summary"}'

# Cache cleanup (every 6 hours)
0 */6 * * * curl -X POST https://your-domain.com/api/cache/cleanup
```

### 3. Vercel Deployment Configuration

```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "NEO4J_URI": "@neo4j-uri",
    "NEO4J_USERNAME": "@neo4j-username",
    "NEO4J_PASSWORD": "@neo4j-password",
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
    "ANTHROPIC_API_KEY": "@anthropic-api-key",
    "BRIGHTDATA_API_TOKEN": "@brightdata-api-token",
    "PERPLEXITY_API_KEY": "@perplexity-api-key",
    "BRIGHTDATA_WEBHOOK_SECRET": "@brightdata-webhook-secret"
  },
  "build": {
    "env": {
      "NEXT_PUBLIC_BASE_URL": "@vercel-url"
    }
  }
}
```

## Testing the Implementation

### 1. Webhook Testing

```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/api/webhook/linkedin-procurement \
  -H "Content-Type: application/json" \
  -H "X-Brightdata-Signature: test-signature" \
  -d '{
    "webhook_id": "test_001",
    "content": "Manchester United seeking digital transformation partner for fan engagement platform modernization",
    "meta": {
      "author": "Sarah Chen",
      "role": "CTO",
      "company": "Manchester United FC"
    }
  }'
```

### 2. Streaming Test

```javascript
// Test SSE connection
const eventSource = new EventSource('https://your-domain.com/api/streaming/events');
eventSource.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

### 3. End-to-End Flow Test

```bash
# 1. Trigger webhook (simulates Bright Data)
# 2. Check Neo4j for new entities
# 3. Check Supabase cache
# 4. Verify streaming updates
# 5. Check memory.md file
```

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Webhook Performance**
   - Success rate: Target >95%
   - Processing time: Target <30 seconds
   - Error rates: Monitor webhook failures

2. **Cache Performance**
   - Hit rate: Target >80%
   - Sync success: Neo4j integration
   - Storage usage: Monitor table sizes

3. **Streaming Performance**
   - Connection uptime: Target >99%
   - Event delivery: Real-time latency
   - Client connections: Active users

4. **AI Processing**
   - Claude analysis success rate
   - Token usage optimization
   - MCP tool performance

### Regular Maintenance Tasks

```bash
# Weekly cleanup
npm run cleanup:cache
npm run cleanup:events
npm run optimize:neo4j

# Monthly updates
npm run update:mcp-servers
npm run update:ai-models
npm run backup:data
```

## Performance Optimizations

### 1. Caching Strategy
- **Tier 1**: 5-minute cache expiry
- **Tier 2**: 30-minute cache expiry  
- **Tier 3**: 2-hour cache expiry

### 2. Database Optimization
- Connection pooling for Neo4j
- Read replicas for frequent queries
- Automated index management

### 3. Stream Processing
- Event batching for high volume
- Connection pooling for SSE
- Automatic reconnection logic

## Security Considerations

### 1. Webhook Security
- HMAC signature validation
- Rate limiting per source
- IP whitelisting

### 2. Data Protection
- Encrypted environment variables
- Database access controls
- Audit logging

### 3. API Security
- CORS configuration
- Authentication middleware
- Input sanitization

---

**Status**: Ready for deployment  
**Next Steps**: Configure environment variables, deploy to Vercel, test webhook integration