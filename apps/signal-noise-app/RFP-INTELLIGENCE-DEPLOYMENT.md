# RFP Intelligence System Deployment Guide

## Overview

The RFP Intelligence system integrates LinkedIn monitoring with Claude Agent SDK to provide real-time procurement opportunity analysis for Yellow Panther.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BrightData LinkedIn                      │
│                   (Monitoring Service)                      │
└────────────────────┬──────────────────────────────────────┘
                     │ Webhook Trigger
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              /api/webhook/linkedin-rfp-claude               │
│                                                         │
│  • Signature validation                                    │
│  • Procurement signal detection                            │
│  • Claude Agent SDK integration                            │
└────────────────────┬──────────────────────────────────────┘
                     │ Multi-step Analysis
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                Claude Agent SDK (MCP)                      │
│                                                         │
│  🔍 Neo4j MCP → Knowledge graph relationships             │
│  🌐 BrightData MCP → Web research & scraping              │
│  🧠 Perplexity MCP → Market intelligence                  │
│                                                         │
│  → Structured RFP analysis                               │
│  → Fit scoring & recommendations                         │
└────────────────────┬──────────────────────────────────────┘
                     │ Enriched Data
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Data Enrichment & Storage                      │
│                                                         │
│  📊 /api/knowledge-graph/enrich → Neo4j storage           │
│  🔔 /api/notifications/rfp-stream → Real-time alerts      │
│  📈 /api/rfp-intelligence/analyze → Detailed analysis     │
└────────────────────┬──────────────────────────────────────┘
                     │ Results
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                CopilotKit Dashboard                         │
│                                                         │
│  🎯 RFP Intelligence Dashboard                           │
│  💬 Claude chat integration                               │
│  📱 Real-time notifications                              │
│  🔧 Interactive actions                                   │
└─────────────────────────────────────────────────────────────┐
```

## Environment Configuration

### Required Environment Variables

```bash
# Claude Agent SDK & MCP Configuration
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password
NEO4J_DATABASE=neo4j

BRIGHTDATA_API_TOKEN=your-brightdata-api-token
PERPLEXITY_API_KEY=your-perplexity-api-key

# Webhook Security
BRIGHTDATA_WEBHOOK_SECRET=your-secure-webhook-secret

# Application (if using Next.js)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Claude Agent SDK (optional)
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### MCP Server Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "neo4j-mcp": {
      "command": "npx",
      "args": ["-y", "@alanse/mcp-neo4j-server"],
      "env": {
        "NEO4J_URI": "${NEO4J_URI}",
        "NEO4J_USERNAME": "${NEO4J_USERNAME}",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}",
        "NEO4J_DATABASE": "${NEO4J_DATABASE}"
      }
    },
    "brightData": {
      "command": "npx", 
      "args": ["-y", "@brightdata/mcp"],
      "env": {
        "API_TOKEN": "${BRIGHTDATA_API_TOKEN}",
        "PRO_MODE": "true"
      }
    },
    "perplexity-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-perplexity-search"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}"
      }
    }
  }
}
```

## Deployment Options

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod

# Configure environment variables in Vercel dashboard
# Settings → Environment Variables
```

**Vercel Configuration (vercel.json):**
```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "env": {
    "NEO4J_URI": "@neo4j-uri",
    "NEO4J_USERNAME": "@neo4j-username", 
    "NEO4J_PASSWORD": "@neo4j-password",
    "BRIGHTDATA_API_TOKEN": "@brightdata-api-token",
    "PERPLEXITY_API_KEY": "@perplexity-api-key",
    "BRIGHTDATA_WEBHOOK_SECRET": "@brightdata-webhook-secret"
  }
}
```

### Option 2: AWS EC2

```bash
# Using the provided deployment script
./deploy-to-ec2.sh

# Manual deployment:
git clone <repository>
cd apps/signal-noise-app
npm install
npm run build
npm start
```

**EC2 Requirements:**
- Instance type: t3.medium or higher
- Memory: 4GB+ RAM
- Storage: 20GB+ SSD
- Ports: 80, 443, 3000

### Option 3: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t rfp-intelligence .
docker run -p 3000:3000 --env-file .env rfp-intelligence
```

## BrightData Webhook Configuration

### 1. Set up LinkedIn Monitoring

1. Log in to BrightData dashboard
2. Navigate to Web Data Collector
3. Create new LinkedIn monitoring task
4. Configure targeting:
   - Keywords: "digital transformation", "fan engagement", "ticketing system", "CRM integration"
   - Companies: Premier League clubs, major rugby/cricket venues
   - Roles: CTO, CEO, Digital Director, Head of Innovation
   - Post types: Updates, articles

### 2. Configure Webhook

**Webhook URL:** `https://your-domain.com/api/webhook/linkedin-rfp-claude`

**Webhook Configuration:**
```json
{
  "webhook_url": "https://your-domain.com/api/webhook/linkedin-rfp-claude",
  "signature_secret": "your-secure-webhook-secret",
  "content_types": ["posts", "articles"],
  "delivery_format": "json",
  "retry_policy": {
    "max_retries": 3,
    "retry_delay": 30
  }
}
```

### 3. Test Webhook

```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/api/webhook/linkedin-rfp-claude \
  -H "Content-Type: application/json" \
  -H "x-brightdata-signature: test-signature" \
  -d '{
    "webhook_id": "test_001",
    "content": "Test procurement signal",
    "meta": {
      "author": "Test User",
      "role": "CTO",
      "company": "Test Club"
    }
  }'
```

## Monitoring & Logging

### Application Monitoring

```bash
# Health check
curl https://your-domain.com/api/health

# View logs (Vercel)
vercel logs

# View logs (EC2)
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Key Metrics to Monitor

1. **Webhook Processing**
   - Success rate: Target >95%
   - Processing time: Target <30 seconds
   - Error rates: Monitor webhook failures

2. **Claude Agent SDK Performance**
   - Token usage per analysis
   - Response times
   - Tool success rates

3. **Knowledge Graph Growth**
   - New entities per day
   - Relationship connections created
   - Query performance

4. **User Engagement**
   - Dashboard active users
   - RFP alerts viewed
   - CopilotKit interactions

## Testing

### Run Full Test Suite

```bash
# Run all tests
./tests/test-rfp-integration.sh run

# Run specific tests
./tests/test-rfp-integration.sh webhook
./tests/test-rfp-integration.sh e2e
```

### Manual Testing Checklist

- [ ] Webhook receives BrightData data
- [ ] Claude Agent SDK analyzes RFP signals
- [ ] Neo4j knowledge graph is updated
- [ ] Real-time notifications appear in dashboard
- [ ] CopilotKit chat integration works
- [ ] MCP tools (Neo4j, BrightData, Perplexity) function correctly

## Security Considerations

### 1. API Security
- Use HTTPS for all endpoints
- Validate webhook signatures
- Rate limit webhook endpoints
- Sanitize all input data

### 2. Data Protection
- Encrypt sensitive environment variables
- Use read-only database credentials where possible
- Implement data retention policies
- GDPR compliance for contact information

### 3. Access Control
- Authentication for dashboard access
- Role-based permissions
- Audit logging for data access
- Secure API key management

## Performance Optimization

### 1. Caching Strategy
```typescript
// Cache frequent Neo4j queries
const queryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedNeo4jQuery(query, params) {
  const key = `${query}:${JSON.stringify(params)}`;
  const cached = queryCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  const result = await executeNeo4jQuery(query, params);
  queryCache.set(key, { result, timestamp: Date.now() });
  return result;
}
```

### 2. Stream Processing
- Use Server-Sent Events for real-time updates
- Implement backpressure handling
- Queue webhooks for async processing
- Batch database operations

### 3. Resource Management
```typescript
// Connection pooling for Neo4j
const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  {
    maxConnectionLifetime: 60 * 60 * 1000, // 1 hour
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 60000 // 1 minute
  }
);
```

## Troubleshooting

### Common Issues

1. **Webhook Not Received**
   - Check BrightData configuration
   - Verify webhook URL is accessible
   - Review signature validation

2. **Claude Analysis Fails**
   - Check MCP server configurations
   - Verify API credentials
   - Review token limits and billing

3. **Dashboard Not Updating**
   - Check WebSocket/SSE connections
   - Verify client-side filtering
   - Review browser console errors

4. **Performance Issues**
   - Monitor database query times
   - Check for memory leaks
   - Review concurrent request limits

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# Test individual components
curl -X POST /api/rfp-intelligence/analyze -d '{"content": "test"}'
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer for multiple instances
- Implement Redis for session sharing
- Consider serverless functions for webhooks

### Database Scaling
- Monitor Neo4j cluster performance
- Implement read replicas for queries
- Archive old RFP data periodically

### CDN & Caching
- Cache static assets with CDN
- Implement API response caching
- Use edge computing for webhook processing

## Support & Maintenance

### Regular Tasks
1. **Weekly:** Review performance metrics and error logs
2. **Monthly:** Update MCP server dependencies
3. **Quarterly:** Review and optimize Claude prompts
4. **Annually:** Security audit and access review

### Emergency Contacts
- Technical Lead: [Contact information]
- BrightData Support: [Support portal]
- Claude/Anthropic Support: [Support email]
- Infrastructure Team: [Contact details]

---

**Version:** 1.0  
**Last Updated:** October 2024  
**Next Review:** January 2025