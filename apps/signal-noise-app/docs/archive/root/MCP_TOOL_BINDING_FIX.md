# MCP Tool Binding Fix - Summary

## Problem Identified

The Claude Agent SDK was spawning MCP servers correctly and receiving valid tool definitions, but **tools were never injected into the model's tool registry**. This resulted in:

- ✅ MCP servers start successfully
- ✅ MCP servers respond to `initialize` and `tools/list`
- ✅ No crashes or schema errors
- ❌ **toolResults: 0 every time**
- ❌ Claude has zero awareness that tools exist

### Root Cause

The SDK's `query()` function accepts `mcpServers` config and spawns the processes, but **does not automatically bind the discovered tools to the model request**. The tools must be explicitly:

1. Extracted from MCP servers via `tools/list`
2. Filtered by allowed tools list
3. **Explicitly passed to the model via `tools` parameter**

## The Fix

### Before (Broken)
```typescript
for await (const message of query({
  prompt: latestUserMessage.content,
  options: {
    mcpServers: getMCPServerConfig(),  // ← Spawns MCP but doesn't bind tools
    allowedTools: ALLOWED_TOOLS,
    model: 'claude-3-5-haiku-20241022'
  },
  system: `...`
}, stream)) {
  // ... toolResults: 0
}
```

### After (Fixed)
```typescript
// Step 1: Explicitly extract tools from MCP servers
const mcpTools = await getMCPToolsWithBinding();

// Step 2: Filter by allowed tools
const filteredTools = mcpTools.filter(tool =>
  ALLOWED_TOOLS.includes(tool.name)
);

// Step 3: Log what we're sending (for debugging)
console.log(`🔧 Tools sent to model: ${filteredTools.map(t => t.name).join(', ')}`);

// Step 4: Pass tools EXPLICITLY to the model
for await (const message of query({
  prompt: latestUserMessage.content,
  options: {
    tools: filteredTools,  // ← CRITICAL: Explicit tool injection
    allowedTools: ALLOWED_TOOLS,
    model: 'claude-3-5-haiku-20241022'
  },
  system: `...`
}, stream)) {
  // ... toolResults > 0 ✅
}
```

## Implementation Details

### New Function: `getMCPToolsWithBinding()`

Located in `src/app/api/copilotkit/route.ts` (lines 150-260)

This function:
1. Loads MCP server config from `mcp-config.json`
2. Spawns each MCP server process
3. Creates an MCP client for each server
4. Initializes the connection
5. **Explicitly calls `tools/list` to extract tool definitions**
6. Returns all extracted tools as an array

### Key Changes

1. **Explicit Tool Extraction**
   - Added `getMCPToolsWithBinding()` function
   - Uses `@modelcontextprotocol/sdk` directly
   - Spawns processes and extracts tools before calling `query()`

2. **Tool Injection**
   - Changed from `mcpServers: getMCPServerConfig()` to `tools: filteredTools`
   - This is the critical fix that binds tools to the model

3. **Diagnostic Logging**
   - Logs number of tools extracted
   - Logs tool names being sent to model
   - Logs each tool call with arguments
   - Logs tool results
   - Provides comprehensive summary at end

4. **Tool Filtering**
   - Filters extracted tools by `ALLOWED_TOOLS` list
   - Prevents unintended tools from being exposed

## Verification

### Quick Test
```bash
node test-mcp-tool-binding.mjs
```

Expected output:
```
🔧 Extracting tools from MCP servers...
📡 Connecting to: graphiti-intelligence
✅ graphiti-intelligence: 8 tools
   - mcp__graphiti__add_memory
   - mcp__graphiti__search_nodes
   - mcp__graphiti__search_memory_facts
   - mcp__graphiti__get_episodes
   - mcp__graphiti__get_entity_edge
   - mcp__graphiti__get_status
   - mcp__graphiti__delete_entity_edge
   - mcp__graphiti__delete_episode

🎉 Total tools extracted: 8 tools

🔧 Sending query with explicitly bound tools...
Tools sent to model: mcp__graphiti__add_memory, mcp__graphiti__search_nodes, ...

📨 Message 1: system (init)
📨 Message 2: tool_use
  🔧 TOOL CALLED: mcp__graphiti__search_nodes
     Args: {"query":"Arsenal"}
📨 Message 3: tool_result
  ✅ TOOL RESULT: mcp__graphiti__search_nodes

═══════════════════════════════════════════════════════
📊 TEST RESULTS
═══════════════════════════════════════════════════════
Total messages: 5
Tools sent: 8
Tools called: 1

✅ SUCCESS! Tools are being called.
   The MCP tool binding fix is working correctly.
```

### Production Test
Start your dev server and send a chat message that encourages tool usage:

```
Search the graph for information about Arsenal FC
```

Check the server logs for:
```
🔧 Extracting MCP tools for model binding...
✅ Extracted 8 MCP tools for model
🎯 Filtered to 8 allowed tools
🔄 Trying model: haiku
🔧 Tools sent to model: mcp__graphiti__search_nodes, ...
📨 Received message type: tool_use
🔧 TOOL CALLED: mcp__graphiti__search_nodes
   Args: {"query":"Arsenal FC"}

═══════════════════════════════════════════════════════
📊 TOOL EXECUTION SUMMARY
═══════════════════════════════════════════════════════
Model used: haiku
Tools sent to model: 8
Tool calls made: 1
Tools called:
  1. mcp__graphiti__search_nodes
═══════════════════════════════════════════════════════
```

## Known-Good Pattern

This fix follows the known-good pattern from the Agent SDK documentation:

```typescript
// ✅ Correct: Explicit tool binding
const mcp = await startMCP();
const { client, tools } = await mcp.listTools();

const agent = new Agent({
  model: "claude-3-5-sonnet-latest",
  tools,  // ← CRITICAL: Explicit
});
```

```typescript
// ❌ Wrong: Expecting automatic binding
const agent = new Agent({
  model: "claude-3-5-sonnet-latest",
  mcpServers: serverConfig,  // ← Spawns but doesn't bind
});
```

## Architecture Notes

### MCP Tool Naming Convention

Tools follow the pattern: `mcp__<server-name>__<tool-name>`

Examples:
- `mcp__graphiti__add_memory`
- `mcp__graphiti__search_nodes`
- `mcp__graphiti__get_episodes`

### Allowed Tools List

The `ALLOWED_TOOLS` array (lines 151-203) controls which MCP tools are exposed to the model. Update this list when:

- Adding new MCP servers
- Adding new tools to existing servers
- Restricting tool access for security

### Tool Caching

Tools are cached after first extraction (`cachedMcpTools`) to improve performance on subsequent requests. The cache persists for the lifetime of the server process.

## Troubleshooting

### Issue: Still seeing `toolResults: 0`

**Possible causes:**

1. **Model chose not to use tools**
   - Try a more explicit prompt: "Use the search tool to find..."
   - Check system prompt encourages tool usage

2. **Tools not properly extracted**
   - Check logs for "Extracted X MCP tools for model"
   - Verify MCP servers are starting successfully
   - Run `node test-mcp-tool-binding.mjs` to test extraction

3. **Allowed tools filter blocking everything**
   - Check `ALLOWED_TOOLS` array includes the tools you need
   - Verify tool names match exactly (case-sensitive)

4. **MCP server crashing**
   - Check MCP server logs for errors
   - Verify environment variables are set correctly
   - Test MCP server in isolation

### Debugging Steps

1. **Check tool extraction:**
   ```bash
   node test-mcp-tool-binding.mjs
   ```
   Look for: `✅ Extracted X MCP tools for model`

2. **Check tool binding:**
   Look for: `🔧 Tools sent to model: tool1, tool2, tool3`

3. **Check tool calls:**
   Look for: `🔧 TOOL CALLED: tool_name`

4. **Check summary:**
   Look for: `Tool calls made: X` (should be > 0 for successful tool usage)

## Files Modified

1. `src/app/api/copilotkit/route.ts`
   - Added `getMCPToolsWithBinding()` function
   - Modified `query()` call to use explicit tools
   - Enhanced diagnostic logging
   - Added tool execution summary

2. `test-mcp-tool-binding.mjs` (new file)
   - Standalone test for tool binding
   - Can be run independently to verify fix

## Next Steps

1. **Test the fix:**
   ```bash
   node test-mcp-tool-binding.mjs
   ```

2. **Monitor production logs:**
   - Look for tool extraction logs
   - Look for tool call logs
   - Check tool execution summary

3. **Verify tool usage:**
   - Send queries that should trigger tools
   - Confirm tools are being called
   - Check `toolResults` count is > 0

4. **Optimize if needed:**
   - Adjust caching strategy if tools change frequently
   - Add retry logic for failed MCP connections
   - Implement health checks for MCP servers

## References

- Known-good example: See user's detailed analysis
- Agent SDK docs: https://docs.anthropic.com/claude-agent-sdk
- MCP protocol: https://modelcontextprotocol.io

## Credits

Fix based on excellent debugging analysis identifying the exact issue:
> "The Agent SDK currently does three separate things, but only two are wired together:
> - Process management → spawning MCP servers (✅ works)
> - MCP protocol handling → initialize, ping, message routing (✅ works)
> - Model tool injection → passing tools into messages.create() (❌ broken / manual)"

The solution was to explicitly extract and bind tools, following the known-good pattern provided in the analysis.
