# CopilotKit Diagnostics (2026-01-24)

## Environment
- Repo: /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
- Server: Next.js dev server on 127.0.0.1:3005

## Start/Bind Notes
- `npm run dev -p 3005 -H 0.0.0.0` failed with `EPERM`.
- `npx next dev -p 3005 -H 127.0.0.1` also failed with `EPERM`.
- Server started successfully only with escalated permissions.

## CopilotKit API Smoke Tests
### Test 1
Request:
- POST http://127.0.0.1:3005/api/copilotkit
- Body: {"messages":[{"role":"user","content":"Search the graph for Arsenal and tell me what entities you find."}],"stream":false}

Result:
- HTTP 200
- Response: assistant said no entities found
- Tool results: 0

### Test 2 (Explicit Tool Instruction)
Request:
- POST http://127.0.0.1:3005/api/copilotkit
- Body: {"messages":[{"role":"user","content":"Use the mcp__graphiti__search_nodes tool to search for Arsenal. Return the tool result."}],"stream":false}

Result:
- HTTP 200
- Response: assistant claimed a search but no entities found
- Tool results: 0

## Log Observations
- MCP server config loaded: graphiti (from mcp-config.json)
- Allowed tools: 9
- Tool execution summary: Tool calls made = 0
- Earlier request logged streaming error: `TypeError [ERR_INVALID_STATE]: Controller is already closed`

## Current Status
- CopilotKit route is reachable and responds.
- MCP tools are configured but not being invoked by the model in these requests.
