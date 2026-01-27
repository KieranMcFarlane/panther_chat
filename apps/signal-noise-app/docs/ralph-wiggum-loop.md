# Ralph Wiggum Loop - Signal Validation System (Iteration 08)

## Overview

The **Ralph Wiggum Loop** is a mandatory signal validation pipeline that enforces strict quality thresholds before any signal is written to Graphiti. It implements **3-pass validation** with **hard minimums** to ensure only high-quality, validated signals enter the knowledge graph.

## Iteration 08 Compliance

**Critical Requirement:** Ralph Loop is **MANDATORY** for all signal creation. No bypasses allowed.

### Invariants (Enforced)

```python
config = RalphLoopConfig(
    min_evidence=3,      # Minimum 3 evidence items per signal
    min_confidence=0.7,  # Confidence threshold (0.0-1.0)
    max_passes=3         # Maximum 3 validation passes
)
```

**Rules:**
- Signals with < 3 evidence items → **REJECTED**
- Signals with confidence < 0.7 → **REJECTED**
- All signals must pass 3 validation passes → **REQUIRED**
- Only validated signals (validated=true, validation_pass=3) written to Graphiti

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ SIGNAL INGESTION (Ralph Loop Mandatory)                 │
│                                                          │
│ Scrapers → /api/signals/validate (port 8001)            │
│            → 3-pass validation (min_evidence=3)          │
│            → Graphiti storage (validated only)           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ RUNTIME QUERY (Already Working)                         │
│                                                          │
│ User → CopilotKit (port 3005) → /api/graphiti (port 8000)│
│                                    → Tool-backed answers  │
└─────────────────────────────────────────────────────────┘
```

### Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| **Ralph Loop** | 8001 | 3-pass signal validation (this system) |
| **Graphiti MCP** | 8000 | Temporal knowledge graph storage |
| **CopilotKit** | 3005 | Runtime AI chat interface |

## 3-Pass Validation Pipeline

### Pass 1: Rule-Based Filtering

**Checks:**
- ✅ Minimum evidence count (≥ 3 items)
- ✅ Confidence threshold (≥ 0.7)
- ✅ Source credibility (average ≥ 0.6)
- ✅ Basic data validation

**Output:** Candidates that meet hard minimums

### Pass 2: Claude Validation

**Checks:**
- ✅ Consistency with existing signals
- ✅ Duplicate detection
- ✅ Plausibility check

**Process:**
1. Fetch existing signals from Graphiti
2. Send candidates + context to Claude
3. Claude validates consistency and uniqueness

**Output:** Non-duplicate, consistent signals

### Pass 3: Final Confirmation

**Checks:**
- ✅ Final confidence scoring
- ✅ Embedding-based duplicate detection
- ✅ Quality assessment

**Output:** Fully validated signals (marked with `validated=true`, `validation_pass=3`)

## Usage

### Starting Ralph Loop Service

```bash
# Start Ralph Loop validation service on port 8001
./scripts/start-ralph-loop.sh

# Service will be available at:
# - API: http://localhost:8001/api/signals/validate
# - Docs: http://localhost:8001/docs
# - Health: http://localhost:8001/health
```

### Submitting Signals for Validation

**Frontend Client:**
```typescript
import { validateSignalsViaRalphLoop } from '@/lib/ralph-loop-client';

const rawSignals = [
  {
    entity_id: "ac-milan",
    signal_type: "RFP_DETECTED",
    confidence: 0.8,
    evidence: [
      { source: "LinkedIn", credibility_score: 0.8 },
      { source: "Perplexity", credibility_score: 0.7 },
      { source: "Crunchbase", credibility_score: 0.9 }
    ],
    metadata: { first_seen: "2026-01-27T10:00:00Z" }
  }
];

const result = await validateSignalsViaRalphLoop(rawSignals);
console.log(`Validated: ${result.validated_signals}, Rejected: ${result.rejected_signals}`);
```

**Direct API Call:**
```bash
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d '[
    {
      "entity_id": "ac-milan",
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

## Iteration 08 Data Flow

```
1) Ingest raw signals from scrapers, feeds, and webhooks
2) GraphRAG performs semantic clustering and candidate discovery
3) Claude validates and structures candidates
4) Ralph Loop runs 3-pass validation (MANDATORY) ← THIS SYSTEM
5) Graphiti writes validated signals and links evidence
6) CopilotKit retrieves and explains using tool-backed answers
```

**Critical Invariant:** Ralph Loop is mandatory for signal creation. No bypasses allowed.

## Validation Logic

### Evidence Count Check

```python
if len(evidence_list) < config.min_evidence:  # min_evidence = 3
    logger.debug(f"❌ Pass 1: Signal rejected (insufficient evidence: {len(evidence_list)}/3)")
    continue  # Signal rejected
```

### Confidence Threshold Check

```python
if confidence < config.min_confidence:  # min_confidence = 0.7
    logger.debug(f"❌ Pass 1: Signal rejected (low confidence: {confidence})")
    continue  # Signal rejected
```

### Source Credibility Check

```python
def _check_source_credibility(self, evidence_list):
    credibility_scores = [ev.get('credibility_score', 0.5) for ev in evidence_list]
    avg_credibility = sum(credibility_scores) / len(credibility_scores)

    if avg_credibility < self.config.min_evidence_credibility:  # 0.6
        return False  # Signal rejected

    return True
```

## API Endpoints

### POST /api/signals/validate

**Description:** Submit raw signals for 3-pass Ralph Loop validation

**Request:**
```json
[
  {
    "entity_id": "ac-milan",
    "signal_type": "RFP_DETECTED",
    "confidence": 0.8,
    "evidence": [
      {
        "source": "LinkedIn",
        "credibility_score": 0.8,
        "date": "2026-01-27",
        "url": "https://linkedin.com/..."
      },
      {
        "source": "Perplexity",
        "credibility_score": 0.7,
        "extracted_text": "..."
      },
      {
        "source": "Crunchbase",
        "credibility_score": 0.9
      }
    ],
    "metadata": {
      "first_seen": "2026-01-27T10:00:00Z"
    }
  }
]
```

**Response:**
```json
{
  "validated_signals": 1,
  "rejected_signals": 0,
  "signals": [
    {
      "id": "signal_ac-milan_rfp_detected_20260127100000",
      "type": "RFP_DETECTED",
      "confidence": 0.8,
      "first_seen": "2026-01-27T10:00:00Z",
      "entity_id": "ac-milan",
      "validated": true,
      "validation_pass": 3,
      "metadata": {...}
    }
  ],
  "validation_time_seconds": 2.3
}
```

### GET /health

**Description:** Check Ralph Loop service health

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-27T10:00:00Z",
  "version": "2.0.0",
  "services": {
    "graphiti": true
  }
}
```

## Environment Variables

**Required:**
```bash
# Backend service (port 8001)
NEXT_PUBLIC_RALPH_LOOP_API_URL=http://localhost:8001

# Anthropic Claude (for Pass 2 validation)
ANTHROPIC_API_KEY=your-claude-api-key
# OR use custom API via Z.AI:
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=your-zai-token

# Graphiti (for storage)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

## Implementation Files

### Backend (Python)
- `backend/main.py` - FastAPI service (port 8001)
- `backend/ralph_loop.py` - 3-pass validation logic
- `backend/claude_client.py` - Claude integration for Pass 2
- `backend/graphiti_service.py` - Graphiti storage integration

### Frontend (TypeScript)
- `src/lib/ralph-loop-client.ts` - Ralph Loop API client
- `src/app/api/copilotkit/route.ts` - CopilotKit integration

### Scripts
- `scripts/start-ralph-loop.sh` - Startup script

### Documentation
- `docs/ralph-wiggum-loop.md` - This file

## Testing

### Test 1: Start Ralph Loop
```bash
./scripts/start-ralph-loop.sh
# Expected: "✅ Starting Ralph Loop validation service on port 8001"
```

### Test 2: Verify Endpoint
```bash
curl http://localhost:8001/docs
# Expected: FastAPI docs with /api/signals/validate endpoint
```

### Test 3: Test Iteration 08 Invariants
```bash
# Send test signal with < 3 evidence items
# Expected: REJECTED (violates min_evidence=3)

# Send test signal with confidence < 0.7
# Expected: REJECTED (violates min_confidence=0.7)

# Send test signal with >= 3 evidence, confidence >= 0.7
# Expected: VALIDATED and written to Graphiti
```

### Test 4: End-to-End Data Flow
1. ✅ Scraper generates raw signal
2. ✅ Signal sent to `/api/signals/validate` (Ralph Loop on port 8001)
3. ✅ Ralph Loop runs 3-pass validation
4. ✅ Only validated signals stored in Graphiti (port 8000)
5. ✅ User queries via CopilotKit (port 3005)
6. ✅ CopilotKit returns only validated signals

## Troubleshooting

### Port Conflict (8000 already in use)

**Error:** `OSError: [Errno 48] Address already in use`

**Solution:** Ralph Loop now uses port 8001 (not 8000). Ensure Graphiti MCP server is on port 8000.

```bash
# Check which service is on port 8000
lsof -i :8000

# Check Ralph Loop on port 8001
lsof -i :8001
```

### Claude Validation Failed

**Error:** `Pass 2: Claude validation failed`

**Solution:** Check ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is set in `backend/.env`

### Graphiti Service Unavailable

**Error:** `Graphiti service not available`

**Solution:** Ensure Graphiti MCP server is running on port 8000

```bash
# Check Graphiti MCP server
curl http://localhost:8000/health
```

## BrightData Integration

### Current State
- ✅ Ralph Loop service running on port 8001
- ✅ BrightData scrapers integrated with Ralph Loop
- ✅ All BrightData signals validated through 3-pass pipeline
- ✅ Only validated BrightData signals written to Graphiti

### BrightData Signal Format

BrightData scrapers convert RFP detections to Ralph Loop format:

```javascript
{
  entity_id: "ac-milan",
  signal_type: "RFP_DETECTED",
  confidence: 0.85,
  evidence: [
    { source: "BrightData", credibility_score: 0.8, url: "..." },
    { source: "BrightData Search", credibility_score: 0.7 },
    { source: "URL Validation", credibility_score: 0.9 }
  ],
  metadata: {
    rfp_type: "digital-transformation-rfp",
    fit_score: 85,
    detection_strategy: "brightdata"
  }
}
```

### Validation Results

- **Validated:** Signal passed all 3 validation passes, written to Graphiti
- **Rejected:** Signal failed validation (insufficient evidence or low confidence)
- **Error:** Ralph Loop service unavailable or validation failed

### Usage

```bash
# Start Ralph Loop
./scripts/start-ralph-loop.sh

# Run BrightData scraper (auto-validates through Ralph Loop)
node production-brightdata-rfp-detector.js

# Check logs for validation results
grep "RALPH-LOOP" /var/log/brightdata-scraper.log
```

### Integration Files

- `src/lib/ralph-loop-node-client.js` - Node.js client for BrightData scrapers
- `production-brightdata-rfp-detector.js` - Production scraper with Ralph Loop validation
- `rfp-brightdata-detector.js` - Alternative scraper with Ralph Loop validation
- `brightdata-mcp-rfp-detector.js` - MCP-based scraper with Ralph Loop validation
- `scripts/test-brightdata-ralph-loop.sh` - Integration test script

## Summary

**Ralph Wiggum Loop** is the **mandatory** signal validation pipeline that:

1. ✅ Enforces **min_evidence = 3** (minimum 3 evidence items)
2. ✅ Enforces **min_confidence = 0.7** (confidence threshold)
3. ✅ Runs **3 validation passes** (rule-based, Claude, final confirmation)
4. ✅ Only writes **validated signals** to Graphiti
5. ✅ Runs on **port 8001** (no conflict with Graphiti on port 8000)
6. ✅ Provides **clear API** at `/api/signals/validate`
7. ✅ Maintains **Iteration 08 compliance** (no bypasses allowed)
8. ✅ **ALL signal sources integrated** (BrightData, scrapers, webhooks)

**Result:** High-quality, validated signals only. No unvalidated or partial signals in Graphiti.

---

## Historical Context

This document originally described "Ralph Wiggum" deterministic tasks for bash loops. It has been updated to reflect the **Iteration 08** implementation: a mandatory 3-pass signal validation pipeline that enforces strict quality thresholds before writing to Graphiti.

Basic file loop:
```bash
for file in docs/*.md; do
  echo "Processing $file"
  codex exec "
  READ $file
  PERFORM TASK ralph_wiggum_parse
  WRITE output/$(basename $file .md).json
  "
done
```

Chunked loop:
```bash
split -l 200 docs/claude_code.md chunks/claude_chunk_

for chunk in chunks/*; do
  echo "Processing $chunk"
  codex exec "
  READ $chunk
  PERFORM TASK ralph_wiggum_parse
  WRITE parsed/$(basename $chunk).json
  "
done
```

Guidance template wired into the loop:
```bash
TASK="ralph_wiggum_extract_entities"
OUTDIR="parsed"

mkdir -p "$OUTDIR"

for file in docs/*.md; do
  echo "Processing $file with $TASK"
  codex exec "
  You are performing a Ralph Wiggum task.

  Rules:
  - Do not explain
  - Do not summarize
  - Do not infer intent
  - Do not combine tasks
  - Output valid JSON only
  - Follow the schema exactly
  - If information is missing, return empty arrays

  Task: $TASK

  Input:
  <<<
  $(cat "$file")
  >>>

  Output schema:
  {
    \"commands\": [],
    \"flags\": [],
    \"files\": [],
    \"env_vars\": [],
    \"tools\": []
  }
  " > "$OUTDIR/$(basename "$file" .md).json"
done
```

---

## B) Deterministic Task Model

Each task must be:
- Single responsibility
- No interpretation
- No opinions
- Fixed schema output
- Idempotent

### Task: extract_entities
Input: raw docs
Output: nouns only
```json
{
  "commands": [],
  "flags": [],
  "files": [],
  "env_vars": [],
  "tools": []
}
```

### Task: extract_actions
Input: same docs
Output: verb -> object pairs
```json
{
  "actions": [
    { "verb": "run", "object": "claude-code" },
    { "verb": "install", "object": "plugin" }
  ]
}
```

### Task: extract_constraints
Input: docs
Output: MUST / MUST NOT / ONLY IF
```json
{
  "constraints": [
    "Claude Code must run in repo root",
    "Plugin requires Node >= 18"
  ]
}
```

### Task: extract_sequences
Input: docs
Output: linear steps only (no conditionals)
```json
{
  "sequences": [
    ["install", "configure", "run"],
    ["open_repo", "start_claude", "execute_task"]
  ]
}
```

### Task: extract_io_contracts
Input: docs
Output: inputs/outputs per command
```json
{
  "io": [
    {
      "command": "claude code",
      "input": ["repo"],
      "output": ["diff", "stdout"]
    }
  ]
}
```

---

## C) Copy-Paste Codex Instruction (Template)

Use this exact prompt when calling Codex (per chunk, per task):
```
You are performing a Ralph Wiggum task.

Rules:
- Do not explain
- Do not summarize
- Do not infer intent
- Do not combine tasks
- Output valid JSON only
- Follow the schema exactly
- If information is missing, return empty arrays

Task: ralph_wiggum_extract_entities

Input:
<<<
{DOCUMENT_CHUNK}
>>>

Output schema:
{
  "commands": [],
  "flags": [],
  "files": [],
  "env_vars": [],
  "tools": []
}
```

Then repeat the loop with:
- ralph_wiggum_extract_actions
- ralph_wiggum_extract_constraints
- ralph_wiggum_extract_sequences
- ralph_wiggum_extract_io_contracts
