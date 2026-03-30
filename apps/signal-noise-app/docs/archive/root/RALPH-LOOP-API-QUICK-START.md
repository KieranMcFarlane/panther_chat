# Ralph Loop API - Quick Start Guide

## 🚀 Starting the Server

### Option 1: Direct Python
```bash
cd backend
python ralph_loop.py serve
# Or specify host/port:
python ralph_loop.py serve 0.0.0.0 8001
```

### Option 2: Background Service
```bash
# Start in background
nohup python backend/ralph_loop.py serve > logs/ralph_loop.log 2>&1 &

# Check logs
tail -f logs/ralph_loop.log

# Stop server
pkill -f "ralph_loop.py serve"
```

### Option 3: Using systemd (Production)
Create `/etc/systemd/system/ralph-loop.service`:
```ini
[Unit]
Description=Ralph Loop API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/signal-noise-app
ExecStart=/usr/bin/python3 backend/ralph_loop.py serve
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable ralph-loop
sudo systemctl start ralph-loop
sudo systemctl status ralph-loop
```

---

## 📡 API Endpoints

### 1. Root Endpoint
```
GET /
```

**Response**:
```json
{
  "service": "Ralph Loop API",
  "version": "1.0.0",
  "endpoints": {
    "/api/validate-exploration": "POST - Validate exploration decision",
    "/health": "GET - Health check"
  }
}
```

### 2. Health Check
```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:34:56.789Z"
}
```

### 3. Validate Exploration (Main Endpoint)
```
POST /api/validate-exploration
Content-Type: application/json
```

**Request Body**:
```json
{
  "entity_name": "Arsenal FC",
  "category": "Digital Infrastructure & Stack",
  "evidence": "Arsenal FC is seeking a CRM Manager to lead digital transformation",
  "current_confidence": 0.75,
  "source_url": "https://arsenal.com/jobs/crm-manager",
  "previous_evidences": [],
  "iteration_number": 1,
  "accepted_signals_per_category": {
    "Digital Infrastructure & Stack": 0
  },
  "consecutive_rejects_per_category": {}
}
```

**Response**:
```json
{
  "decision": "ACCEPT",
  "action": "CONTINUE",
  "justification": "All ACCEPT criteria met (new, specific, future action, credible)",
  "new_confidence": 0.81,
  "raw_delta": 0.06,
  "category_multiplier": 1.0,
  "applied_delta": 0.06,
  "category_saturated": false,
  "confidence_saturated": false,
  "iteration_logged": true
}
```

---

## 🧪 Testing the API

### Using cURL
```bash
# Health check
curl http://localhost:8001/health

# Validate exploration
curl -X POST http://localhost:8001/api/validate-exploration \
  -H "Content-Type: application/json" \
  -d '{
    "entity_name": "Arsenal FC",
    "category": "Digital Infrastructure & Stack",
    "evidence": "Arsenal FC is seeking a CRM Manager to lead digital transformation",
    "current_confidence": 0.75,
    "source_url": "https://arsenal.com/jobs/crm-manager",
    "iteration_number": 1,
    "accepted_signals_per_category": {},
    "consecutive_rejects_per_category": {}
  }'
```

### Using Python
```python
import httpx

async def validate_exploration():
    payload = {
        "entity_name": "Arsenal FC",
        "category": "Digital Infrastructure & Stack",
        "evidence": "Arsenal FC is seeking a CRM Manager",
        "current_confidence": 0.75,
        "source_url": "https://arsenal.com/jobs"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8001/api/validate-exploration",
            json=payload
        )
        result = response.json()

        print(f"Decision: {result['decision']}")
        print(f"Action: {result['action']}")
        print(f"New Confidence: {result['new_confidence']}")

import asyncio
asyncio.run(validate_exploration())
```

### Using the Test Suite
```bash
# Start server in one terminal
python backend/ralph_loop.py serve

# Run tests in another terminal
python test_ralph_loop_api.py
```

---

## 📊 Ralph Decision Rubric

### ACCEPT (all must be true)
1. ✅ Evidence is **new** (not logged previously)
2. ✅ Evidence is **entity-specific** (explicit name match)
3. ✅ Evidence implies **future action** (budgeting, procurement, hiring, RFP)
4. ✅ Source is **credible** (official site, job board, press release)

**Example**:
```json
{
  "evidence": "Arsenal FC is seeking a CRM Manager to lead digital transformation",
  "source_url": "https://arsenal.com/jobs/crm-manager"
}
```

### WEAK_ACCEPT
- Evidence is new but **partially missing** ACCEPT criteria

**Example**:
```json
{
  "evidence": "New partnership announced for ticketing improvements",
  "source_url": "https://news.sports.com/partnership"
}
```
- Missing: Entity-specific name ("Arsenal FC")

### REJECT
- No new information
- Generic industry commentary
- Duplicate or paraphrased signals
- Historical-only information
- Speculation without evidence

**Example**:
```json
{
  "evidence": "Arsenal wins match against Chelsea",
  "source_url": "https://news.com/match-report"
}
```
- Generic match report, not procurement-related

---

## 🔢 Confidence Math (Fixed, No Drift)

### Constants
```
START_CONFIDENCE = 0.20
MAX_CONFIDENCE = 0.95
MIN_CONFIDENCE = 0.05

ACCEPT_DELTA = +0.06
WEAK_ACCEPT_DELTA = +0.02
REJECT_DELTA = 0.00
```

### Calculation
```python
# Category multiplier (forces breadth before depth)
category_multiplier = 1.0 / (1.0 + accepted_signals_in_category)

# Applied delta
applied_delta = raw_delta * category_multiplier

# New confidence (with clamping)
new_confidence = clamp(
    current_confidence + applied_delta,
    MIN_CONFIDENCE,
    MAX_CONFIDENCE
)
```

### Example

**Iteration 1** (first ACCEPT in category):
- `accepted_signals_in_category = 0`
- `category_multiplier = 1.0 / (1.0 + 0) = 1.0`
- `applied_delta = 0.06 * 1.0 = 0.06`
- `new_confidence = 0.20 + 0.06 = 0.26`

**Iteration 2** (second ACCEPT in same category):
- `accepted_signals_in_category = 1`
- `category_multiplier = 1.0 / (1.0 + 1) = 0.5`
- `applied_delta = 0.06 * 0.5 = 0.03`
- `new_confidence = 0.26 + 0.03 = 0.29`

**Result**: Forces exploration across categories before diving deep

---

## 🛑 Saturation Detection

### Category Saturation
**Rule**: 3 consecutive REJECTs → `CATEGORY_SATURATED`

**Request**:
```json
{
  "category": "Governance, Compliance & Security",
  "consecutive_rejects_per_category": {
    "Governance, Compliance & Security": 3
  }
}
```

**Response**:
```json
{
  "category_saturated": true,
  "action": "STOP"
}
```

**Behavior**: Skip this category for remainder of exploration

### Confidence Saturation
**Rule**: < 0.01 gain over 10 iterations → `CONFIDENCE_SATURATED`

**Behavior**: Stop exploration immediately (diminishing returns)

---

## 🎯 Actions Explained

| Action | When | Behavior |
|--------|------|----------|
| `CONTINUE` | Normal exploration | Keep exploring this category |
| `STOP` | Category saturated, low confidence + REJECT | Stop this category, move to next |
| `LOCK_IN` | Confidence ≥ 0.85 | High confidence, write to evidence store |

---

## 📝 Mandatory Logging

Every iteration is logged with:
- Timestamp
- Entity name, category, iteration number
- Source URL, evidence snippet
- Decision, action, justification
- Confidence before/after, deltas
- Saturation flags

**Log Output**:
```
2026-01-30 12:34:56 - ralph_loop - INFO - 🔁 Validating exploration: Arsenal FC | Digital Infrastructure & Stack | Iteration 1
2026-01-30 12:34:57 - ralph_loop - INFO -   📊 Decision: ACCEPT | CONTINUE | Confidence: 0.750 → 0.810
```

---

## 🔒 Error Handling

### Client Errors (4xx)
```json
{
  "detail": "Entity name is required"
}
```

### Server Errors (5xx)
```json
{
  "detail": "Internal server error"
}
```

**Best Practice**: Implement retry logic with exponential backoff

```python
import asyncio
import httpx

async def validate_with_retry(payload, max_retries=3):
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "http://localhost:8001/api/validate-exploration",
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
```

---

## 🚀 Production Deployment

### Environment Variables
```bash
# Optional: Override defaults
RALPH_LOOP_HOST=0.0.0.0
RALPH_LOOP_PORT=8001
RALPH_LOG_LEVEL=INFO
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name ralph-loop.example.com;

    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Monitoring
```bash
# Check if service is running
curl http://localhost:8001/health

# Monitor logs
tail -f /var/log/ralph_loop/access.log

# Check process
ps aux | grep ralph_loop
```

---

## 📚 Related Documentation

- **Implementation Plan**: `IMPLEMENTATION-STATUS-PHASE-0.md`
- **Calibration Experiment**: `backend/calibration_experiment.py`
- **Budget Controller**: `backend/budget_controller.py`
- **Ralph Loop Governor**: `backend/ralph_loop_governor.py`

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Check if port is already in use
lsof -i :8001

# Kill existing process
kill -9 $(lsof -t -i:8001)

# Try different port
python backend/ralph_loop.py serve 0.0.0.0 8002
```

### Connection refused
```bash
# Check firewall
sudo ufw allow 8001/tcp

# Check if server is running
curl http://localhost:8001/health
```

### Import errors
```bash
# Install dependencies
pip install fastapi uvicorn pydantic httpx
```

---

**Status**: ✅ Ralph Loop API endpoint complete and ready for testing
**Next**: Run `python test_ralph_loop_api.py` to verify all functionality
