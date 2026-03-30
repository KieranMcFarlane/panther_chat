# Graphiti MCP Server Testing Guide
**Production FalkorDB Cloud Integration**

**Date:** January 23, 2026
**Status:** ✅ Ready for Testing

---

## System Overview

### ✅ What's Working

**Graphiti MCP Server:**
- **Configuration:** `mcp-config.json` → stdio transport
- **Database:** FalkorDB Production Cloud
- **Connection:** Successfully authenticated and tested
- **Host:** `r-6jissuruar.instance-vnsu2asxb.hc-srom4rolb.eu-west-1.aws.f2e0a955bb84.cloud:50743`
- **Database:** `sports_intelligence`
- **Data:** 3,400+ sports entities from production

**Services Running:**
- ✅ Next.js Dev Server (port 3005)
- ✅ CopilotKit API Route (configured)
- ✅ Graphiti MCP Server (on-demand via stdio)

**Available Tools (Official Graphiti MCP):**
1. `mcp__graphiti__add_memory` - Add memories/entities to the temporal knowledge graph
2. `mcp__graphiti__search_nodes` - Search for nodes in the graph by criteria
3. `mcp__graphiti__search_memory_facts` - Search for specific facts within memories
4. `mcp__graphiti__get_episodes` - Retrieve temporal episodes from the graph
5. `mcp__graphiti__get_entity_edge` - Get relationships between entities
6. `mcp__graphiti__get_status` - Get graph status and statistics
7. `mcp__graphiti__delete_entity_edge` - Delete entity relationships (use with caution)
8. `mcp__graphiti__delete_episode` - Delete episodes (use with caution)
9. `mcp__graphiti__clear_graph` - Clear entire graph (use extreme caution)

---

## How It Works

### Architecture
```
User Message (Browser)
    ↓
CopilotKit API Route (route.ts)
    ↓
Claude Agent SDK (with Model Cascade)
    ↓
Spawns Graphiti MCP Server (stdio)
    ↓
Connects to Production FalkorDB Cloud
    ↓
Returns results to Claude
    ↓
Claude reasons and responds
```

### Key Points
- **Graphiti MCP server spawns on-demand** when CopilotKit needs it
- **Connection is fast:** SSL handshake completes in < 2 seconds
- **Production data:** Access to 3,400+ sports entities
- **No local database needed:** All data lives in production FalkorDB cloud

---

## Testing Instructions

### Step 1: Open Chat Interface

**URL:** http://localhost:3005

The CopilotKit chat interface should load with the streaming chat component.

### Step 2: Test Queries

Try these queries to test the Graphiti MCP tools:

#### Query 1: Get Graph Status
```
What's the status of the knowledge graph?
```

**Expected Tool Call:**
- `mcp__graphiti__get_status`

**Expected Response:**
- Graph statistics (node count, edge count)
- Database type (falkordb)
- Connection status

#### Query 2: Search for Entities
```
Search for entities related to Real Madrid
```

**Expected Tool Call:**
- `mcp__graphiti__search_nodes` with search criteria

**Expected Response:**
- List of entities matching "Real Madrid"
- Entity types (Organization, etc.)
- Relationship information

#### Query 3: Get Entity Relationships
```
What entities are related to Barcelona?
```

**Expected Tool Call:**
- `mcp__graphiti__get_entity_edge` or `mcp__graphiti__search_nodes`

**Expected Response:**
- Barcelona entity details
- Connected entities (players, partnerships, etc.)
- Relationship types

#### Query 4: Get Episodes
```
What episodes exist in the knowledge graph?
```

**Expected Tool Call:**
- `mcp__graphiti__get_episodes`

**Expected Response:**
- List of temporal episodes
- Episode metadata
- Timestamp information

#### Query 5: Add New Memory
```
Remember that AC Milan won their latest match 3-0 against Inter
```

**Expected Tool Call:**
- `mcp__graphiti__add_memory`

**Expected Response:**
- Confirmation that memory was added
- Entity extraction results
- Relationship created

---

## Verification Steps

### 1. Check Browser Console

Open browser DevTools (F12) → Console tab

**What to Look For:**
- Tool invocation messages
- MCP server startup logs
- No connection errors

**Expected Console Output:**
```
✅ Loaded MCP server config from mcp-config.json: [ 'graphiti' ]
📨 Received message type: system (init)
📨 Received message type: assistant
```

### 2. Check Network Tab

**What to Look For:**
- POST request to `/api/copilotkit`
- Request contains your message
- Response streams back with tool calls

### 3. Monitor Server Logs (Optional)

If you want to see the Graphiti MCP server logs in real-time:

```bash
# The logs are written to stdout/stderr by the MCP server
# You can monitor them in the terminal where you started Next.js
```

---

## Troubleshooting

### Issue: "MCP server failed to start"

**Cause:** Environment variables not set

**Solution:**
```bash
# Verify environment variables are set
echo $FALKORDB_URI
echo $FALKORDB_USER
echo $FALKORDB_PASSWORD

# They should be populated from your .env file
```

### Issue: "Tool not found"

**Cause:** Tool name mismatch

**Solution:**
- Use official Graphiti MCP tool names
- Tool names follow pattern: `mcp__graphiti__<tool_name>`
- Check ALLOWED_TOOLS in `src/app/api/copilotkit/route.ts`

### Issue: "No entities returned"

**Cause:** Graph might be empty or query too specific

**Solution:**
- Try broader search terms
- Use `get_status` to check if graph has data
- Verify connection to production FalkorDB

### Issue: "Connection timeout"

**Cause:** Network or SSL issues

**Solution:**
- Check internet connection
- Verify production FalkorDB is accessible
- Check if VPN is required (contact your admin)

---

## Advanced Testing

### Test 1: Multi-Tool Query

**Query:**
```
Tell me about Real Madrid's recent activities and their relationships with other clubs
```

**Expected Tools:**
1. `mcp__graphiti__search_nodes` (find Real Madrid)
2. `mcp__graphiti__get_entity_edge` (get relationships)
3. `mcp__graphiti__get_episodes` (get recent episodes)

### Test 2: Entity Extraction

**Query:**
```
Remember that Lionel Messi transferred from Barcelona to PSG in 2021
```

**Expected Tools:**
1. `mcp__graphiti__add_memory` (add the fact)
2. Entity extraction for: Lionel Messi, Barcelona, PSG
3. Relationship creation: transferred_from, joined

### Test 3: Temporal Search

**Query:**
```
What episodes involving Barcelona exist from 2020-2023?
```

**Expected Tools:**
1. `mcp__graphiti__search_nodes` or `mcp__graphiti__get_episodes`
2. Filter by timestamp or episode content

---

## Success Criteria

- ✅ Graphiti MCP server starts automatically
- ✅ Connects to production FalkorDB cloud
- ✅ Tools are called correctly by Claude
- ✅ Entities are returned from production data
- ✅ Streaming responses work in browser
- ✅ No authentication errors

---

## What's Different from Before

### ❌ Old Architecture (MVP with Mock)
- Mock backend with 5 entities
- REST API tools (query_entity_mvp, search_entities_mvp, etc.)
- Local data only
- Temporal intelligence limited

### ✅ New Architecture (Graphiti MCP + Production FalkorDB)
- **Official Graphiti MCP tools** (low-level graph operations)
- **Production FalkorDB cloud** (3,400+ entities)
- **Full temporal knowledge graph** capabilities
- **Semantic helpers** can be built in service layer
- **Real sports intelligence data**

---

## Next Steps After Testing

### If Everything Works ✅

1. **Build semantic helper functions** in service layer:
   - `search_entities()` - Wrapper around `search_nodes`
   - `get_entity_signals()` - Combines multiple Graphiti calls
   - `query_entity_timeline()` - Gets entity history

2. **Add more data** to the knowledge graph:
   - Ingest recent sports news
   - Extract entities and relationships
   - Build temporal episodes

3. **Implement RFP intelligence**:
   - Add RFP-specific entity types
   - Extract procurement signals
   - Build RFP prediction models

### If Issues Arise ⚠️

1. **Check logs:**
   ```bash
   # Next.js logs
   # Check terminal where npm run dev is running
   ```

2. **Verify environment:**
   ```bash
   # Check ports
   lsof -i :3005  # Next.js
   ```

3. **Test connection:**
   - Verify FalkorDB cloud is accessible
   - Check credentials in .env file
   - Ensure network allows SSL connections

---

## Summary

**✅ Production FalkorDB Cloud: Connected**
**✅ Graphiti MCP Server: Configured**
**✅ CopilotKit Integration: Ready**
**✅ Official Tools: Available**

**The complete Graphiti MCP + Production FalkorDB system is ready for testing!**

Open http://localhost:3005 and try the test queries above.
