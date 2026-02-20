# Ralph Loop Setup Guide (Iteration 08 Aligned)

## Quick Start

### 1. Start Ralph Loop Service

```bash
# Start Ralph Loop validation service (port 8001)
./scripts/start-ralph-loop.sh
```

**Expected Output:**
```
🔄 Ralph Loop Validation Service (Iteration 08 Compliant)
══════════════════════════════════════════════════════════

📊 Iteration 08 Invariants:
   • min_evidence = 3 (minimum 3 evidence items per signal)
   • min_confidence = 0.7 (confidence threshold)
   • max_passes = 3 (3-pass validation enforced)
   • validated == true (only validated signals written to Graphiti)

🌐 Service Configuration:
   • Port: 8001 (Ralph Loop validation)
   • Graphiti MCP: Port 8000 (storage)
   • API Docs: http://localhost:8001/docs
   • Health Check: http://localhost:8001/health

🔄 Signal Validation Endpoint:
   • POST http://localhost:8001/api/signals/validate

✅ Starting Ralph Loop service...
```

### 2. Verify Service is Running

```bash
# Health check
curl http://localhost:8001/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-01-27T10:00:00Z",
  "version": "2.0.0",
  "services": {
    "graphiti": true
  }
}
```

### 3. Test Signal Validation

```bash
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d '[
    {
      "entity_id": "test-entity",
      "signal_type": "RFP_DETECTED",
      "confidence": 0.8,
      "evidence": [
        {"source": "LinkedIn", "credibility_score": 0.8},
        {"source": "Perplexity", "credibility_score": 0.7},
        {"source": "Crunchbase", "credibility_score": 0.9}
      ]
    }
  ]'
```

**Expected Response (Validated):**
```json
{
  "validated_signals": 1,
  "rejected_signals": 0,
  "signals": [
    {
      "id": "signal_test-entity_rfp_detected_20260127...",
      "type": "RFP_DETECTED",
      "confidence": 0.8,
      "first_seen": "2026-01-27T10:00:00Z",
      "entity_id": "test-entity",
      "validated": true,
      "validation_pass": 3
    }
  ],
  "validation_time_seconds": 2.3
}
```

**Expected Response (Rejected - < 3 evidence):**
```json
{
  "validated_signals": 0,
  "rejected_signals": 1,
  "signals": [],
  "validation_time_seconds": 0.5
}
```

## Environment Variables

### Required Environment Variables

**All environment variables are in the main `.env` file:**

```bash
# =============================================================================
# Ralph Loop Configuration (in .env at project root)
# =============================================================================

# Ralph Loop API endpoint (port 8001)
RALPH_LOOP_API_URL=http://localhost:8001
NEXT_PUBLIC_RALPH_LOOP_API_URL=http://localhost:8001

# Anthropic Claude API (Required for Pass 2 validation)
ANTHROPIC_API_KEY=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c
# OR use custom API via Z.AI:
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=0e978aa432bf416991b4f00fcfaa49f5.AtIKDj9a7SxqQei3

# Graphiti Service (Required for storage)
NEO4J_URI=neo4j+s://cce1f84b.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0

# FalkorDB (alternative graph database)
FALKORDB_URI=rediss://r-6jissuruar.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud:50743
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=N!HH@CBC9QDesFdS
FALKORDB_DATABASE=sports_intelligence
```

**Note:** All environment variables are loaded from the main `.env` file at the project root. The startup script automatically loads these variables before starting the Ralph Loop service.

## Service Architecture

### Port Allocation

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Ralph Loop** | 8001 | Signal validation (3-pass pipeline) | ✅ This implementation |
| **Graphiti MCP** | 8000 | Temporal knowledge graph storage | ✅ Already running |
| **CopilotKit** | 3005 | Runtime AI chat interface | ✅ Already running |

### Data Flow (Iteration 08 Compliant)

```
┌─────────────────────────────────────────────────────────┐
│ 1. SIGNAL INGESTION (Ralph Loop Mandatory)              │
│                                                          │
│    Scrapers → Ralph Loop (port 8001)                    │
│               → Pass 1: Rule-based filtering            │
│               → Pass 2: Claude validation               │
│               → Pass 3: Final confirmation              │
│               → Validated signals only →                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. STORAGE (Graphiti)                                   │
│                                                          │
│    Ralph Loop → Graphiti (port 8000)                    │
│               → Upsert validated signals                 │
│               → Link evidence                           │
│               → Build episodes                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. RUNTIME QUERY (CopilotKit)                           │
│                                                          │
│    User → CopilotKit (port 3005)                        │
│          → /api/graphiti (port 8000)                    │
│          → Tool-backed answers →                        │
└─────────────────────────────────────────────────────────┘
```

## Integration Examples

### Example 1: Submit Signals from Frontend

```typescript
import { validateSignalsViaRalphLoop } from '@/lib/ralph-loop-client';

async function submitRFPDetection(entityId: string, rfpData: any) {
  const rawSignal = {
    entity_id: entityId,
    signal_type: "RFP_DETECTED",
    confidence: 0.8,
    evidence: [
      {
        source: "LinkedIn",
        credibility_score: 0.8,
        date: new Date().toISOString(),
        url: rfpData.url,
        extracted_text: rfpData.description
      },
      {
        source: "Perplexity",
        credibility_score: 0.7,
        extracted_text: rfpData.market_research
      },
      {
        source: "Crunchbase",
        credibility_score: 0.9,
        metadata: { company_info: rfpData.company_data }
      }
    ],
    metadata: {
      rfp_category: rfpData.category,
      estimated_value: rfpData.value,
      first_seen: new Date().toISOString()
    }
  };

  const result = await validateSignalsViaRalphLoop([rawSignal]);

  console.log(`✅ Validated: ${result.validated_signals}`);
  console.log(`❌ Rejected: ${result.rejected_signals}`);

  return result;
}
```

### Example 2: Batch Validation with Progress

```typescript
import { validateSignalsWithProgress } from '@/lib/ralph-loop-client';

async function validateBatch(rawSignals: RawSignal[]) {
  const result = await validateSignalsWithProgress(
    rawSignals,
    10, // Chunk size
    (progress) => {
      console.log(`Progress: ${progress.completed}/${progress.total}`);
      console.log(`Validated: ${progress.validated}, Rejected: ${progress.rejected}`);
    }
  );

  return result;
}
```

### Example 3: Check Signal Validation Status

```typescript
import { ValidatedSignal } from '@/lib/ralph-loop-client';

function isSignalFullyValidated(signal: ValidatedSignal): boolean {
  // Iteration 08: Must have validation_pass == 3
  return signal.validated === true && signal.validation_pass === 3;
}

// Usage
const result = await validateSignalsViaRalphLoop(rawSignals);

result.signals.forEach(signal => {
  if (isSignalFullyValidated(signal)) {
    console.log(`✅ ${signal.id} passed all 3 validation passes`);
  } else {
    console.warn(`⚠️ ${signal.id} has partial validation`);
  }
});
```

## Troubleshooting

### Issue: Port 8001 Already in Use

**Error:**
```
OSError: [Errno 48] Address already in use
```

**Solution:**
```bash
# Find process using port 8001
lsof -i :8001

# Kill the process
kill -9 <PID>

# Restart Ralph Loop
./scripts/start-ralph-loop.sh
```

### Issue: Claude Validation Fails

**Error:**
```
Pass 2: Claude validation failed: API key not found
```

**Solution:**
```bash
# Check environment variables
cat backend/.env | grep ANTHROPIC

# Should see either:
# ANTHROPIC_API_KEY=sk-ant-...
# OR
# ANTHROPIC_AUTH_TOKEN=your-token
```

### Issue: Graphiti Service Unavailable

**Error:**
```
HTTPException: Graphiti service not available
```

**Solution:**
```bash
# Check Graphiti MCP server is running on port 8000
curl http://localhost:8000/health

# If not running, start Graphiti MCP server
python3 backend/graphiti_mcp_server_official/src/graphiti_mcp_server.py
```

### Issue: Signals Not Being Written to Graphiti

**Symptom:** `validated_signals > 0` but signals don't appear in queries

**Debug:**
```bash
# Check Ralph Loop logs for write confirmations
# Should see: "✅ Wrote signal: signal_xxx (confidence: 0.8)"

# Check Graphiti directly
curl http://localhost:8000/api/signals
```

**Possible Causes:**
1. Graphiti service not responding
2. FalkorDB/Neo4j connection issue
3. Signal write failed silently (check logs)

## Monitoring

### Health Check

```bash
# Ralph Loop health
curl http://localhost:8001/health

# Graphiti health
curl http://localhost:8000/health

# CopilotKit health
curl http://localhost:3005/health
```

### Validation Metrics

```bash
# Check recent validation activity
tail -f backend/ralph_loop.log

# Look for:
# - "✅ Ralph Loop complete: X validated, Y rejected"
# - "❌ Pass 1: Signal rejected (insufficient evidence)"
# - "❌ Pass 2: Claude rejected signal_xxx"
```

### Performance Monitoring

```bash
# Monitor API response times
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d @test-signals.json \
  -w "\nResponse time: %{time_total}s\n"
```

## Production Deployment

### Environment Variables (Production)

```bash
# Production Ralph Loop API
NEXT_PUBLIC_RALPH_LOOP_API_URL=https://api.yourservice.com

# Backend service (behind nginx/load balancer)
RALPH_LOOP_PORT=8001
RALPH_LOOP_HOST=0.0.0.0
```

### Service Management (systemd)

Create `/etc/systemd/system/ralph-loop.service`:

```ini
[Unit]
Description=Ralph Loop Signal Validation Service
After=network.target graphiti.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/signal-noise-app/backend
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 /var/www/signal-noise-app/backend/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable ralph-loop
sudo systemctl start ralph-loop
sudo systemctl status ralph-loop
```

## Summary

**Ralph Loop** is the **mandatory** signal validation pipeline that enforces Iteration 08 invariants:

1. ✅ **min_evidence = 3** - Minimum 3 evidence items per signal
2. ✅ **min_confidence = 0.7** - Confidence threshold enforced
3. ✅ **max_passes = 3** - 3-pass validation pipeline
4. ✅ **validated only** - Only validated signals written to Graphiti
5. ✅ **no bypasses** - Ralph Loop is mandatory for all signal creation

**Quick Start:**
```bash
./scripts/start-ralph-loop.sh
```

**Verify:**
```bash
curl http://localhost:8001/health
```

**Test:**
```bash
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d '[{"entity_id":"test","signal_type":"RFP_DETECTED","confidence":0.8,"evidence":[...]}]'
```

**Result:** High-quality, validated signals only. Full Iteration 08 compliance.
