# Runtime and CopilotKit

Purpose
Describe how user queries are processed and grounded at runtime.

TL;DR
- CopilotKit is the user-facing chat interface.
- /api/copilotkit uses Claude Agent SDK with MCP tools.
- The model should use graph tools for grounding.

Runtime flow
1) User query arrives at /api/copilotkit.
2) Claude Agent SDK selects model and tool set.
3) MCP tools (Graphiti) are available for graph retrieval.
4) Response is streamed back to UI.

Invariants
- Tool use should be preferred for factual graph claims.
- Allowed tools are explicitly whitelisted.

Interfaces/Contracts
- Runtime endpoint: src/app/api/copilotkit/route.ts
- MCP config: mcp-config.json (Graphiti MCP server).

Known risks
- Model may choose not to call tools even if available.
- Tool call failures can lead to ungrounded responses.

Where to go next
- Agent roles: 06-AGENTS-ROLES.md
- Ops and testing: 10-OPS-TESTING.md
