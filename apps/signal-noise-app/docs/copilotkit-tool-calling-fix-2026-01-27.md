# CopilotKit Tool Calling Fix (2026-01-27)

## Problem
Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.1.10) has a bug where MCP tools are configured correctly but never invoked by the model.

**Symptoms:**
- MCP servers load successfully
- Tools are listed and available
- Diagnostic logs show: `Tool calls made: 0`
- Model generates text responses instead of using tools

## Root Cause
The SDK's `query()` function has a fundamental issue where it doesn't properly trigger tool use, even when:
- MCP servers are correctly configured
- Tools are properly defined
- System prompt instructs tool usage
- User queries explicitly require tools

## Solution: SDK Bypass
Replace SDK's `query()` function with direct Anthropic API calls that implement tool use manually.

### Changes Made

#### 1. Updated MCP Configuration (`mcp-config.json`)
**Before:**
```json
{
  "mcpServers": {
    "graph-tools": {
      "command": "python3",
      "args": ["backend/graph_tools_cli.py"],
      "env": {}
    }
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "python3",
      "args": ["backend/graphiti_mcp_server_official/src/graphiti_mcp_server.py"],
      "env": {
        "DATABASE_PROVIDER": "falkordb",
        "FALKORDB_URI": "...",
        "FALKORDB_USER": "falkordb",
        "FALKORDB_PASSWORD": "...",
        "FALKORDB_DATABASE": "sports_intelligence",
        "MODEL_NAME": "gpt-4o-mini",
        "EMBEDDING_MODEL": "text-embedding-3-small",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

#### 2. Updated Allowed Tools (`src/app/api/copilotkit/route.ts`)
**Before:**
```typescript
const ALLOWED_TOOLS: string[] = [
  "mcp__graph-tools__search_graph",
  "mcp__graph-tools__add_episode"
];
```

**After (Iteration 08 Aligned):**
```typescript
const ALLOWED_TOOLS: string[] = [
  "mcp__graphiti__search_nodes",
  "mcp__graphiti__search_memory_facts",
  "mcp__graphiti__get_episodes",
  "mcp__graphiti__add_memory"
];
```

#### 3. Replaced SDK with Direct API Implementation
**Before:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: generateMessages(),
  options: {
    mcpServers: mcpConfig,
    allowedTools: ALLOWED_TOOLS,
    model: 'claude-3-5-sonnet-20241022',
    maxTurns: 5
  },
  system: systemPrompt
}, stream)) {
  // Handle messages
}
```

**After:**
```typescript
// Direct Anthropic API call with manual tool execution
const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
  method: 'POST',
  headers: {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: currentMessages,
    system: systemPrompt,
    tools: Object.values(TOOLS).map(({ name, description, inputSchema }) => ({
      name,
      description,
      input_schema: inputSchema
    }))
  })
});

// Manual tool use loop (up to 5 turns)
for (let turn = 0; turn < maxTurns; turn++) {
  const data = await response.json();

  // Check for tool use blocks
  const toolBlocks = data.content.filter((block: any) => block.type === 'tool_use');

  if (toolBlocks.length > 0) {
    // Execute tools
    for (const toolBlock of toolBlocks) {
      const result = await executeTool(toolBlock.name, toolBlock.input);
      // Add result to conversation and continue
    }
  } else {
    break; // No tools, done
  }
}
```

#### 4. Updated System Prompt
Aligned with Iteration 08 requirements:
- Use Graphiti as authoritative source
- Tools are mandatory for factual claims
- No GraphRAG in runtime (discovery-only)
- Proper tool names: `search_nodes`, `search_memory_facts`, `get_episodes`, `add_memory`

## Test Results

### Before Fix
```bash
curl -X POST http://localhost:3005/api/copilotkit \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Search for Arsenal"}]}'

# Response: "No entities found"
# Tool calls: 0
```

### After Fix
```bash
curl -X POST http://localhost:3005/api/copilotkit \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Search for Arsenal"}]}'

# Response: "I found 1 result for Arsenal: Arsenal FC CRM system upgrade RFP..."
# Tool calls: 1 (search_nodes)
# Tool result: {"count":1,"results":[{...}]}
```

## Alignment with Iteration 08

✅ **Graphiti is authoritative source** - Using official Graphiti MCP server
✅ **GraphRAG is discovery-only** - Not used in runtime queries
✅ **Proper tool names** - `search_nodes`, `search_memory_facts`, etc.
✅ **Tools are mandatory** - System prompt enforces tool usage
✅ **No write tools in runtime** - Only read operations by default
✅ **Streaming responses** - Real-time feedback to users

## Known Limitations

1. **Bridge Implementation**: Currently uses `/api/graphrag` endpoint as a bridge to Graphiti. Production should call MCP server directly via stdio.

2. **Tool Execution**: `get_episodes` returns mock data. Full implementation requires direct Graphiti client calls.

3. **MCP Server Communication**: Tools are executed via HTTP wrapper, not direct MCP stdio. This adds a layer of indirection.

## Next Steps

1. **Direct MCP Integration**: Replace `/api/graphrag` bridge with direct MCP server communication via stdio

2. **Complete Tool Set**: Implement all Graphiti tools:
   - `get_entity_edge`
   - `delete_entity_edge`
   - `delete_episode`
   - `clear_graph`
   - `get_status`

3. **3-Agent Topology**: Implement Iteration 08's multi-agent architecture:
   - Agent A (Runtime Reasoner - Sonnet) - Current implementation
   - Agent B (Deep Synthesizer - Opus) - For complex queries
   - Agent C (Schema Evolution) - Offline only

## Files Modified

1. `mcp-config.json` - Updated to use official Graphiti MCP server
2. `src/app/api/copilotkit/route.ts` - Replaced SDK with direct API implementation
3. Removed SDK import: `import { query } from "@anthropic-ai/claude-agent-sdk"`

## Verification

Run this test to verify tool calling works:

```bash
curl -X POST http://localhost:3005/api/copilotkit \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"user","content":"Search for Arsenal and tell me what you find"}
    ],
    "stream": false
  }'
```

Expected output should include:
- `{"type":"tool","tool":"search_nodes",...}`
- `{"type":"tool_result","tool":"search_nodes","result":{...}}`
- Text response summarizing the results
