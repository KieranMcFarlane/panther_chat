# 🚀 Ralph Loop Deployment Guide - Local Docker Setup

## Prerequisites

1. **Start Docker Desktop** (required for container orchestration)
2. **Verify API keys** in `.env.ralph`

## Quick Start

### Step 1: Start Docker Desktop
```bash
# Open Docker Desktop from Applications
# Or run:
open /Applications/Docker.app
```

Wait for Docker to be ready (Dolphin icon in menu bar stops animating).

### Step 2: Navigate to project
```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
```

### Step 3: Source environment variables
```bash
export $(grep -v '^#' .env.ralph | xargs)
```

### Step 4: Start the services
```bash
# Stop any existing containers
docker-compose -f docker-compose.ralph.yml down

# Build and start services
docker-compose -f docker-compose.ralph.yml up -d --build
```

### Step 5: Watch the logs
```bash
# Follow webhook handler logs
docker-compose -f docker-compose.ralph.yml logs -f webhook-handler

# Or view all logs
docker-compose -f docker-compose.ralph.yml logs -f
```

## What Gets Deployed

### Services Started:

1. **FalkorDB** (port 7687)
   - Primary graph database
   - Connection: `rediss://r-6jissuruar.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud:50743`

2. **Redis** (port 6379)
   - Cache layer
   - Used for hot subgraph caching

3. **Webhook Handler** (port 8001)
   - FastAPI server for real-time signal processing
   - Endpoint: `http://localhost:8001/api/webhooks/signal`
   - Health check: `http://localhost:8001/health`

4. **Grafana** (port 3000)
   - Monitoring dashboard
   - URL: `http://localhost:3000`
   - Username: `admin`
   - Password: `admin`

5. **Prometheus** (port 9090)
   - Metrics collection
   - URL: `http://localhost:9090`

## Testing the Deployment

### Test Webhook Endpoint

```bash
# Send test webhook
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-webhook-001",
    "source": "test",
    "entity_id": "arsenal_fc",
    "type": "RFP_DETECTED",
    "confidence": 0.92,
    "evidence": [
      {
        "source": "LinkedIn",
        "credibility_score": 0.85,
        "url": "https://linkedin.com/jobs/123",
        "date": "2026-01-28",
        "text": "Test job posting"
      },
      {
        "source": "Graphiti corroboration",
        "credibility_score": 0.75,
        "related_signal_id": "test-rfp-001",
        "date": "2026-01-28"
      },
      {
        "source": "Perplexity",
        "credibility_score": 0.70,
        "date": "2026-01-28"
      }
    ],
    "metadata": {
      "test": true
    }
  }' | python3 -m json.tool
```

### Expected Response:
```json
{
  "status": "validated",
  "signal_id": "test-webhook-001",
  "validated": true,
  "original_confidence": 0.92,
  "validated_confidence": 0.82,
  "adjustment": -0.10,
  "rationale": "LinkedIn credible but single source...",
  "model_used": "haiku",
  "cost_usd": 0.0001,
  "processing_time_seconds": 3.5
}
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐                   │
│  │ FalkorDB     │    │   Redis          │                   │
│  │ (Graph DB)    │    │   (Cache)        │                   │
│  │ Port: 7687   │    │   Port: 6379     │                   │
│  └──────────────┘    └──────────────────┘                   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────┐               │
│  │     Webhook Handler (FastAPI)           │               │
│  │     Port: 8001                          │               │
│  │     - /api/webhooks/signal              │               │
│  │     - /health                             │               │
│  └──────────────────────────────────────────┘               │
│                          ↓                                   │
│  ┌──────────────────────────────────────────┐               │
│  │     Claude API (External)                │               │
│  │     - Haiku for validation               │               │
│  │     - Sonnet/Opus fallback              │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │     Grafana (Monitoring)                │               │
│  │     Port: 3000                          │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │     Prometheus (Metrics)                 │               │
│  │     Port: 9090                          │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Real-World Testing

### Test with Arsenal FC (Real Entity)

```bash
# Simulate real webhook for Arsenal FC
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "arsenal-rfp-'$(date +%s)'",
    "source": "linkedin",
    "entity_id": "arsenal_fc",
    "entity_name": "Arsenal FC",
    "type": "RFP_DETECTED",
    "confidence": 0.92,
    "evidence": [
      {
        "source": "LinkedIn",
        "credibility_score": 0.85,
        "url": "https://linkedin.com/jobs/123456789",
        "date": "'$(date +%Y-%m-%d)'",
        "text": "Arsenal FC seeking Head of Digital Transformation - £120k-150k"
      },
      {
        "source": "Graphiti corroboration",
        "credibility_score": 0.75,
        "related_signal_id": "arsenal-rfp-20260115",
        "date": "2026-01-15"
      },
      {
        "source": "Perplexity",
        "credibility_score": 0.70,
        "date": "'$(date +%Y-%m-%d)'",
        "text": "Arsenal FC actively pursuing digital transformation in 2026"
      }
    ],
    "metadata": {
      "job_title": "Head of Digital Transformation",
      "indicative_budget": "£1.5M",
      "department": "Technology"
    }
  }'
```

### Process Multiple Entities

```bash
# Test Manchester United
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "manutd-rfp-'$(date +%s)'",
    "source": "brightdata",
    "entity_id": "manchester_united",
    "type": "RFP_DETECTED",
    "confidence": 0.88,
    "evidence": [
      {"source": "BrightData", "credibility_score": 0.82, "date": "2026-01-28"},
      {"source": "Graphiti corroboration", "credibility_score": 0.70, "date": "2026-01-20"},
      {"source": "Perplexity", "credibility_score": 0.65, "date": "2026-01-28"}
    ]
  }'

# Test Chelsea FC
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "chelsea-rfp-'$(date +%s)'",
    "source": "linkedin",
    "entity_id": "chelsea_fc",
    "type": "RFP_DETECTED",
    "confidence": 0.75,
    "evidence": [
      {"source": "LinkedIn", "credibility_score": 0.80, "date": "2026-01-28"},
      {"source": "Graphiti corroboration", "credibility_score": 0.70, "date": "2026-01-10"},
      {"source": "Perplexity", "credibility_score": 0.68, "date": "2026-01-28"}
    ]
  }'
```

## Monitoring

### View Logs

```bash
# All logs
docker-compose -f docker-compose.ralph.yml logs -f

# Specific service logs
docker-compose -f docker-compose.ralph.yml logs -f webhook-handler
docker-compose -f docker-compose.ralph.yml logs -f ralph-loop-worker

# Last 50 lines
docker-compose -f docker-compose.ralph.yml logs --tail=50 webhook-handler
```

### Check Service Status

```bash
# All services
docker-compose -f docker-compose.ralph.yml ps

# Service health
curl http://localhost:8001/health
curl http://localhost:6379  # Redis ping
```

### View Metrics

```bash
# Prometheus metrics
curl http://localhost:9090/metrics

# Grafana dashboard
open http://localhost:3000
# Username: admin
# Password: admin
```

## Configuration

### Environment Variables (.env.ralph)

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# FalkorDB
FALKORDB_URI=rediss://r-6jissuruar.instance-...cloud:50743
FALKORDB_PASSWORD=N!HH@CBC9QDesFdS
FALKORDB_USER=falkordb
FALKORDB_DATABASE=sports_intelligence

# Redis
REDIS_URL=redis://redis:6379

# Ralph Loop
RALPH_LOOP_MIN_EVIDENCE=3
RALPH_LOOP_MIN_CONFIDENCE=0.7
RALPH_LOOP_ENABLE_CONFIDENCE_VALIDATION=true
RALPH_LOOP_MAX_CONFIDENCE_ADJUSTMENT=0.15
```

## Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.ralph.yml down

# Remove volumes (WARNING: deletes data!)
docker-compose -f docker-compose.ralph.yml down -v
```

## Troubleshooting

### Issue: Port already in use

```bash
# Check what's using the port
lsof -i :8001

# Kill the process
kill -9 <PID>

# Or use a different port in docker-compose.ralph.yml
```

### Issue: API key not working

```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY

# Test API directly
python3 << 'EOF'
from anthropic import Anthropic
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
response = client.messages.create(
    model="claude-3-5-haiku-20241022",
    max_tokens=10,
    messages=[{"role": "user", "content": "Hi"}]
)
print("✅ API working")
EOF
```

### Issue: FalkorDB connection failed

```bash
# Test FalkorDB connection
docker exec falkordb-graph redis-cli -p 7687 PING

# Check logs
docker-compose -f docker-compose.ralph.yml logs falkordb
```

### Issue: Container won't start

```bash
# Check container logs
docker-compose -f docker-compose.ralph.yml logs webhook-handler

# Rebuild without cache
docker-compose -f docker-compose.ralph.yml up -d --build --force-recreate

# View detailed error
docker-compose -f docker-compose.ralph.yml up --build
```

## Next Steps After Deployment

1. **Verify webhook endpoint is working** (send test webhook)
2. **Check Grafana dashboard** (monitor metrics)
3. **Test with real entities** (Arsenal FC, Manchester United)
4. **Review logs** (ensure confidence validation works)
5. **Scale up** (add more worker containers if needed)

## Production Considerations

For production deployment:

1. **Use HTTPS** (add SSL/TLS termination)
2. **Rate limiting** (prevent abuse)
3. **Webhook signature verification** (security)
4. **Database backups** (FalkorDB snapshots)
5. **Horizontal scaling** (multiple webhook handlers)
6. **Monitoring alerts** (Prometheus AlertManager)
7. **Log aggregation** (ELK stack or similar)
8. **Secrets management** (HashiCorp Vault or AWS Secrets Manager)

## Cost Tracking

### Monitor Claude API Usage

```bash
# Check usage logs
docker-compose -f docker-compose.ralph.yml logs webhook-handler | grep "Cost:"

# Total cost calculation
# (Total tokens × $0.25/1M for Haiku)
```

### Expected Daily Costs

```
3,400 entities × 8 signals/day × 500 avg tokens = 13,600,000 tokens/day
Haiku cost: 13,600,000 × $0.25/M = $3.40/day
Annual: $3.40 × 365 = $1,241/year

vs Sonnet baseline: $13,600,000 × $3/M = $40.80/day
Annual: $40.80 × 365 = $14,892/year

Savings: $13,651/year (92% reduction!)
```

---

## Summary

This deployment provides:
✅ Real-time webhook processing
✅ Confidence validation with Claude Haiku
✅ Model cascade (Haiku → Sonnet → Opus)
✅ FalkorDB graph database integration
✅ Redis caching layer
✅ Grafana monitoring dashboard
✅ Prometheus metrics
✅ Complete logging

**Ready to validate all 3,400 sports entities daily with 92% cost savings!**
