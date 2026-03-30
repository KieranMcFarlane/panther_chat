# Testing Guide - Complete Graph Intelligence System

**Date**: January 23, 2026
**Status**: ✅ Ready for Testing

---

## System Overview

### Services Running

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| **Next.js** | 3005 | ✅ Running | CopilotKit chat interface |
| **Graph Intelligence API** | 8001 | ✅ Running | REST API with mock backend |
| **FalkorDB (local)** | 6379 | ✅ Running | Database (not accessible via graph) |

### Current Data

- **Entities**: 5 created (PSG, Real Madrid, Chelsea FC, Liverpool FC, FC Barcelona)
- **Signals**: 5 extracted (1 per entity)
- **Backend**: Mock (fully functional)

---

## Testing Approach

### 1. Direct API Testing (curl commands)

### Test 1.1: System Statistics

**What it checks:** API is running and returning stats

```bash
curl http://localhost:8001/stats
```

**Expected Response:**
```json
{
  "success": true,
  "stats": {
    "graph": {
      "total_entities": 5,
      "total_signals": 5,
      "backend": "mock"
    },
    "scheduler": {
      "type": "EntityScheduler",
      "freshness_window_days": 7
    },
    "extractor": {
      "type": "SignalExtractor",
      "signal_types": [
        "RFP_DETECTED",
        "EXECUTIVE_CHANGE",
        "PARTNERSHIP_FORMED"
      ]
    }
  }
}
```

### Test 1.2: Search Entities

**What it checks:** Can search for entities

```bash
curl -X POST http://localhost:8001/search-entities \
  -H "Content-Type: application/json" \
  -d '{"query": "real", "limit": 5}'
```

**Expected Response:**
```json
{
  "success": true,
  "query": "real",
  "count": 1,
  "results": [
    {
      "entity_id": "real_madrid",
      "name": "Real Madrid",
      "entity_type": "ORG",
      "created_at": "2026-01-23T07:56:51.048036+00:00"
    }
  ]
}
```

### Test 1.3: Query Entity with Signals

**What it checks:** Can retrieve entity details with signals

```bash
curl -X POST http://localhost:8001/query-entity \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "real_madrid", "include_timeline": true}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "entity_id": "real_madrid",
    "found": true,
    "name": "Real Madrid",
    "type": "ORG",
    "signals": [...],
    "signal_count": 1
  }
}
```

### Test 1.4: Run Intelligence Batch

**What it checks:** Can process new entities and extract signals

```bash
curl -X POST http://localhost:8001/run-batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 3}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "entities_processed": 3,
    "signals_extracted": 3,
    "signals_validated": 3,
    "signals_added_to_graph": 3
  }
}
```

---

## 2. CopilotKit Chat Interface Testing (Browser)

### Access the Chat Interface

**URL**: http://localhost:3005

**What to expect:**
- CopilotKit chat interface
- Streaming responses
- 6 new graph intelligence tools available
- Natural language queries supported

### Test Queries to Try

#### Query 1: System Status

**User:**
```
What's the current state of the knowledge graph?
```

**Expected Response:**
```
The knowledge graph currently has:
- 5 entities
- 5 signals
- Using mock backend
- Signal types: RFP_DETECTED, EXECUTIVE_CHANGE, PARTNERSHIP_FORMED
```

#### Query 2: Entity Information

**User:**
```
Tell me about Real Madrid
```

**Expected Response:**
```
Real Madrid is an organization (ORG) with 1 signal detected:
- EXECUTIVE_CHANGE (confidence: 0.75)
- Created: 2026-01-23T07:56:51
- Source: MVP_Pipeline
```

#### Query 3: Search Entities

**User:**
```
Find all entities with 'fc' in the name
```

**Expected Response:**
```
Found 3 entities:
- Chelsea FC
- Liverpool FC
- FC Barcelona
```

#### Query 4: Run Intelligence Batch

**User:**
```
Run an intelligence batch on 5 entities
```

**Expected Response:**
```
✅ Intelligence batch complete:
- Processed: 5 entities
- Signals extracted: 5
- Signals validated: 5
- Added to graph: 5
- Duration: ~0.004s
```

#### Query 5: Signal Types

**User:**
```
What signal types are supported?
```

**Expected Response:**
```
The MVP system supports 3 canonical signal types:
1. RFP_DETECTED - Organization issued Request for Proposal
2. EXECUTIVE_CHANGE - C-level executive changes
3. PARTNERSHIP_FORMED - New partnerships or collaborations
```

#### Query 6: Get Entity Signals

**User:**
```
Show me all signals for Chelsea FC from the last 30 days
```

**Expected Response:**
```
Chelsea FC has 1 signal:
- Signal type: EXECUTIVE_CHANGE
- Confidence: 0.75
- Evidence: Content contains executive change keywords
- Created: [timestamp]
```

---

## 3. Advanced Testing Scenarios

### Scenario 1: Multi-Step Query

**User:**
```
Run an intelligence batch on 3 entities, then search for entities created in the last hour
```

**Expected Flow:**
1. Claude calls `run_intelligence_batch` tool
2. API processes 3 entities
3. Claude calls `search_entities_mvp` to show results
4. Returns processed entities with timestamps

### Scenario 2: Comparative Analysis

**User:**
```
Compare Real Madrid and Barcelona - what signals do they have?
```

**Expected Flow:**
1. Claude queries `query_entity_mvp` for "real_madrid"
2. Claude queries `query_entity_mvp` for "fc_barcelona"
3. Claude compares signals and summarizes differences

### Scenario 3: System Health Check

**User:**
```
Check the system health and run a diagnostic batch
```

**Expected Flow:**
1. Claude calls `get_system_stats_mvp`
2. Reports total entities, signals, backend type
3. Calls `run_intelligence_batch` with batch_size=2
4. Reports processing results

---

## 4. Testing Tool Integration

### Check MCP Tools Are Available

Open browser console and check:

```javascript
// The tools should be available in the chat
console.log('Available tools:', Object.keys(allRestTools));
// Should show:
// - query_entity_mvp
// - search_entities_mvp
// - run_intelligence_batch
// - get_system_stats_mvp
// - list_signal_types_mvp
// - get_entity_signals_mvp
```

### Monitor Tool Calls

Open browser DevTools → Network tab

When you send a message, you should see:
1. POST request to `/api/copilotkit`
2. Tool calls in request/response
3. Streaming response chunks

**Expected tool calls:**
```javascript
{
  "tool": "graph_intelligence_query_entity_mvp",
  "args": {"entity_id": "real_madrid"}
}
```

---

## 5. Common Queries & Expected Results

| Query | Tool Used | Expected Result |
|-------|-----------|----------------|
| "What's the state?" | get_system_stats_mvp | Entity/signal count, backend type |
| "Tell me about X" | query_entity_mvp | Entity details, signals, timeline |
| "Find entities with X" | search_entities_mvp | List of matching entities |
| "Run batch on N entities" | run_intelligence_batch | Processing stats |
| "What signal types?" | list_signal_types_mvp | 3 canonical types |
| "Show signals for X" | get_entity_signals_mvp | Signal list with filters |

---

## 6. Troubleshooting

### Issue: "Entity not found"

**Cause:** Entity hasn't been processed yet

**Solution:** Run an intelligence batch first
```
User: "Run an intelligence batch on 5 entities"
Then: "Tell me about [entity from batch]"
```

### Issue: "Tool not available"

**Cause:** Tool not in allRestTools object

**Solution:** Check browser console for errors, refresh page

### Issue: "API not responding"

**Cause:** Graph Intelligence API not running

**Solution:** Start the API
```bash
cd backend
python3 graph_intelligence_api.py
```

### Issue: "No entities in graph"

**Cause:** Mock data was cleared or API restarted

**Solution:** Run an intelligence batch to populate
```
User: "Run an intelligence batch on 5 entities"
```

---

## 7. Success Criteria

### API Testing
- [ ] Stats endpoint returns 200 with valid JSON
- [ ] Search returns entities
- [ ] Query returns entity with signals
- [ ] Batch processing completes without errors
- [ ] All 6 endpoints respond correctly

### CopilotKit Testing
- [ ] Chat interface loads at localhost:3005
- [ ] Natural language queries work
- [ ] Tools are called correctly
- [ ] Streaming responses appear in real-time
- [ ] Entity data displays properly

### Data Verification
- [ ] Batch processing creates entities
- [ ] Signals are extracted with confidence ≥ 0.6
- [ ] Entities can be searched and queried
- [ ] Timeline queries work
- [ ] System stats update after each operation

---

## 8. Quick Test Script

Save this as `test_system.sh` and run it:

```bash
#!/bin/bash

echo "=== Testing Graph Intelligence System ==="
echo ""

echo "1. Testing API stats..."
curl -s http://localhost:8001/stats | python3 -m json.tool | head -10
echo ""

echo "2. Testing entity search..."
curl -s -X POST http://localhost:8001/search-entities \
  -H "Content-Type: application/json" \
  -d '{"query": "real", "limit": 5}' | python3 -m json.tool
echo ""

echo "3. Testing entity query..."
curl -s -X POST http://localhost:8001/query-entity \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "real_madrid"}' | python3 -m json.tool | head -15
echo ""

echo "4. Running intelligence batch..."
curl -s -X POST http://localhost:8001/run-batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 3}' | python3 -m json.tool
echo ""

echo "=== API Tests Complete ==="
echo ""
echo "Now test in browser: http://localhost:3005"
```

---

## 9. Next Steps After Testing

### If Everything Works ✅

1. **Document Results**
   - Take screenshots of successful queries
   - Save example responses
   - Note any unexpected behavior

2. **Try Complex Queries**
   - Multi-step scenarios
   - Comparative analysis
   - System health checks

3. **Scale Up**
   - Run larger batches (10, 20 entities)
   - Test concurrent queries
   - Monitor performance

### If Issues Found ⚠️

1. **Check Logs**
   ```bash
   # Graph Intelligence API logs
   tail -f /tmp/graph-intelligence-api.log

   # Next.js logs
   # Check terminal where `npm run dev` is running
   ```

2. **Restart Services**
   ```bash
   # Kill and restart Graph Intelligence API
   pkill -f graph_intelligence_api.py
   cd backend
   python3 graph_intelligence_api.py

   # Next.js auto-reloads on file save
   # Or restart: Ctrl+C, then npm run dev
   ```

3. **Verify Environment**
   ```bash
   # Check ports
   lsof -i :8001  # Graph Intelligence API
   lsof -i :3005  # Next.js
   ```

---

## 10. Summary

### ✅ Ready to Test NOW

**API Testing:**
- All endpoints working
- Mock backend fully functional
- 5 entities with signals available

**Browser Testing:**
- Next.js running on port 3005
- CopilotKit integrated with 6 new tools
- Natural language queries enabled

**What to Test:**
1. Direct API calls with curl
2. Natural language queries in browser
3. Tool integration and streaming
4. Multiple scenarios and workflows

**The complete system is operational and ready for testing!** 🚀

Start with the quick test script above, then open the browser to test natural language queries.
