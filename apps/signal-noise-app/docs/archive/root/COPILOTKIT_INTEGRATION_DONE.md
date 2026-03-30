# CopilotKit Integration Complete - MVP Graph Intelligence Tools

**Date**: January 23, 2026
**Status**: ✅ Integration Complete

---

## Overview

Successfully integrated the MVP Graph Intelligence tools into the CopilotKit API route, enabling natural language queries to the graph intelligence system through the AI chat interface.

---

## Integration Details

### Files Modified

1. **`src/app/api/copilotkit/route.ts`** - CopilotKit API route
   - Added `GRAPH_INTELLIGENCE_API` constant (port 8001)
   - Added 6 new graph intelligence tools
   - Combined REST API tools with MCP tools
   - Updated system prompt with MVP tool descriptions

2. **`.env.example`** - Environment variables template
   - Added `FASTAPI_URL=http://localhost:8000`
   - Added `GRAPH_INTELLIGENCE_API=http://localhost:8001`

3. **`.env`** - Actual environment variables
   - Added both FastAPI backend URLs

---

## New Tools Integrated

### 1. query_entity_mvp
Query an entity from the MVP knowledge graph including signals and timeline.

**Parameters:**
- `entity_id` (string): Entity identifier (e.g., "ac_milan", "manchester_united")
- `include_timeline` (boolean, optional): Include signal timeline (default: false)
- `timeline_days` (number, optional): Days to look back for timeline (default: 30)

**Example Usage:**
```
User: "Tell me about AC Milan"
System: Calls query_entity_mvp with entity_id="ac_milan"
Returns: Entity data with signals count and timeline
```

### 2. search_entities_mvp
Search for entities across the knowledge graph by name, type, or metadata.

**Parameters:**
- `query` (string): Search query string
- `entity_type` (string, optional): Optional entity type filter (e.g., "ORG")
- `limit` (number, optional): Maximum results to return (default: 10)

**Example Usage:**
```
User: "Find all entities with 'milan' in the name"
System: Calls search_entities_mvp with query="milan"
Returns: List of matching entities with names and types
```

### 3. run_intelligence_batch
Run the intelligence pipeline to process entities and extract signals automatically.

**Parameters:**
- `batch_size` (number, optional): Number of entities to process (default: 5, recommended: 5-10)

**Example Usage:**
```
User: "Run an intelligence batch on 10 entities"
System: Calls run_intelligence_batch with batch_size=10
Returns: Processing statistics (entities processed, signals added, duration)
```

### 4. get_system_stats_mvp
Get system statistics including total entities, signals, and configuration.

**Parameters:** None

**Example Usage:**
```
User: "What's the current state of the knowledge graph?"
System: Calls get_system_stats_mvp
Returns: Total entities, total signals, backend type, signal types
```

### 5. list_signal_types_mvp
List all available signal types in the MVP system.

**Parameters:** None

**Example Usage:**
```
User: "What signal types are supported?"
System: Calls list_signal_types_mvp
Returns: List of 3 canonical signal types (RFP_DETECTED, EXECUTIVE_CHANGE, PARTNERSHIP_FORMED)
```

### 6. get_entity_signals_mvp
Get all signals for a specific entity with optional filtering.

**Parameters:**
- `entity_id` (string): Entity identifier
- `signal_types` (array, optional): Optional list of signal types to filter by
- `days` (number, optional): Days to look back (default: 30)
- `limit` (number, optional): Maximum signals to return (default: 20)

**Example Usage:**
```
User: "Show me all RFP signals for AC Milan from the last 30 days"
System: Calls get_entity_signals_mvp with entity_id="ac_milan", signal_types=["RFP_DETECTED"]
Returns: List of signals with metadata
```

---

## Architecture

### Tool Flow

```
User Message (Natural Language)
        ↓
CopilotKit API Route (route.ts)
        ↓
Claude Agent SDK (with Model Cascade)
        ↓
Intent Detection → Tool Selection
        ↓
├─→ MCP Tools (Graphiti) ← ALLOWED_TOOLS
│   └─→ Graphiti MCP Server (backend/graphiti_mcp_server_official/)
│
└─→ REST API Tools ← allRestTools
    ├─→ Temporal Intelligence Tools (FASTAPI_URL:8000)
    └─→ MVP Graph Intelligence Tools (GRAPH_INTELLIGENCE_API:8001)
        └─→ Graph Intelligence API (backend/graph_intelligence_api.py)
            └─→ MVP Pipeline (backend/integration/mvp_pipeline.py)
```

### Model Cascade

1. **Haiku First** (claude-3-5-haiku-20241022)
   - Fast and cheap (60x cheaper than Opus)
   - Handles simple queries effectively
   - Target: >60% of queries

2. **Sonnet Fallback** (claude-3-5-sonnet-20241022)
   - Used if Haiku fails or for complex reasoning
   - More capable but slower and more expensive

---

## System Prompt Enhancements

Updated system prompt now includes:

**MVP Graph Intelligence Tools:**
- query_entity_mvp: Query entities from MVP knowledge graph
- search_entities_mvp: Search entities by name, type, or metadata
- run_intelligence_batch: Process entities and extract signals
- get_system_stats_mvp: Get system statistics
- list_signal_types_mvp: List available signal types
- get_entity_signals_mvp: Get signals for specific entity

**Signal Types (MVP):**
- RFP_DETECTED: Organization issued Request for Proposal
- EXECUTIVE_CHANGE: C-level executive changes
- PARTNERSHIP_FORMED: New partnerships or collaborations

**Query Strategy:**
- Use query_entity_mvp for MVP entities
- Use run_intelligence_batch to populate graph
- MVP pipeline provides fresh signals via batch processing

---

## Testing the Integration

### 1. Start the Graph Intelligence API

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend
python3 graph_intelligence_api.py
# Runs on http://localhost:8001
```

### 2. Start Next.js Dev Server

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
npm run dev
# Runs on port 3005
```

### 3. Test Natural Language Queries

Open the chat interface and try:

**Query Entity:**
```
User: "Tell me about AC Milan"
Expected: Claude calls query_entity_mvp, returns entity data with signals
```

**Search Entities:**
```
User: "Find all entities with 'milan' in the name"
Expected: Claude calls search_entities_mvp, returns matching entities
```

**Run Intelligence Batch:**
```
User: "Run an intelligence batch on 5 entities"
Expected: Claude calls run_intelligence_batch, returns processing stats
```

**System Statistics:**
```
User: "What's the current state of the knowledge graph?"
Expected: Claude calls get_system_stats_mvp, returns total entities and signals
```

**List Signal Types:**
```
User: "What signal types are supported?"
Expected: Claude calls list_signal_types_mvp, returns 3 canonical types
```

**Get Entity Signals:**
```
User: "Show me all signals for Juventus from the last 30 days"
Expected: Claude calls get_entity_signals_mvp, returns signal list
```

---

## Integration Verification

### Code Changes Summary

✅ Added GRAPH_INTELLIGENCE_API constant
✅ Defined 6 graph intelligence tools with handlers
✅ Created allRestTools combining temporal and graph intelligence tools
✅ Updated query() call to include tools parameter
✅ Enhanced system prompt with MVP tool descriptions
✅ Added environment variables to .env and .env.example

### Tool Integration Points

**File: src/app/api/copilotkit/route.ts**

Lines 66-67: FastAPI backend URLs
```typescript
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const GRAPH_INTELLIGENCE_API = process.env.GRAPH_INTELLIGENCE_API || 'http://localhost:8001';
```

Lines 323-546: MVP Graph Intelligence Tools
```typescript
const graphIntelligenceTools = {
  'query_entity_mvp': { /* ... */ },
  'search_entities_mvp': { /* ... */ },
  'run_intelligence_batch': { /* ... */ },
  'get_system_stats_mvp': { /* ... */ },
  'list_signal_types_mvp': { /* ... */ },
  'get_entity_signals_mvp': { /* ... */ }
};
```

Lines 548-556: Combined Tools Object
```typescript
const allRestTools = {
  ...temporalTools,
  ...graphIntelligenceTools
};
```

Line 668: Tools Passed to Query
```typescript
for await (const message of query({
  prompt: latestUserMessage.content,
  options: {
    mcpServers: getMCPServerConfig(),
    allowedTools: ALLOWED_TOOLS,
    tools: allRestTools,  // <-- NEW
    model: model === 'haiku' ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022'
  },
```

Lines 434-481: Updated System Prompt
```typescript
system: `Sports Intelligence AI with Graph Intelligence Architecture (Phase 2 + MVP Integration).

You have access to graph intelligence tools via MCP and REST API. Use them strategically:

**MVP Graph Intelligence Tools (NEW - via REST API):**
- query_entity_mvp: Query entities from MVP knowledge graph with signals and timeline
- search_entities_mvp: Search entities by name, type, or metadata
- run_intelligence_batch: Process entities and extract signals to populate knowledge graph
// ... (full prompt)
```

---

## Next Steps

### Immediate Testing

1. **Start Graph Intelligence API**
   ```bash
   cd backend
   python3 graph_intelligence_api.py
   ```

2. **Verify API is Running**
   ```bash
   curl http://localhost:8001/stats
   ```

3. **Start Next.js and Test Chat**
   ```bash
   npm run dev
   # Open http://localhost:3005
   # Try the test queries listed above
   ```

### Optional Enhancements

1. **Add Tool Result Formatting**
   - Enhance response formatting for better user experience
   - Add drill-down options for entity exploration

2. **Implement Intent Detection**
   - Automatic detection of user query intent
   - Route to appropriate tool without explicit tool calls

3. **Add Error Handling**
   - Graceful fallback when API is unavailable
   - User-friendly error messages

4. **Performance Optimization**
   - Cache frequently accessed entities
   - Batch multiple tool calls when possible

---

## Troubleshooting

### Issue: "Graph API error: connection refused"

**Cause**: Graph Intelligence API not running on port 8001

**Solution**:
```bash
cd backend
python3 graph_intelligence_api.py
```

### Issue: "Entity not found in knowledge graph"

**Cause**: Knowledge graph is empty (no entities processed yet)

**Solution**: Run an intelligence batch first
```
User: "Run an intelligence batch on 5 entities"
```

### Issue: "Tool not available"

**Cause**: Tool not in allRestTools object

**Solution**: Verify tool is defined in graphIntelligenceTools and included in allRestTools

---

## Summary

✅ **CopilotKit Integration**: Complete
✅ **6 New Tools**: query_entity_mvp, search_entities_mvp, run_intelligence_batch, get_system_stats_mvp, list_signal_types_mvp, get_entity_signals_mvp
✅ **REST API Integration**: Tools fetch from Graph Intelligence API (port 8001)
✅ **System Prompt Updated**: Includes MVP tool descriptions and usage guidance
✅ **Environment Variables**: Added to .env and .env.example
✅ **Testing Guide**: Complete with example queries

**The CopilotKit integration is ready for testing!**

Start the Graph Intelligence API backend and Next.js dev server to test natural language queries with the new MVP graph intelligence tools.
