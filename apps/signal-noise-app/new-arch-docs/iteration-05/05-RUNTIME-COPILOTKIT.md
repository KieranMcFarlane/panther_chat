# Runtime and CopilotKit

Purpose
Describe how user queries are processed and grounded.

TL;DR
- CopilotKit is the user-facing chat interface.
- /api/copilotkit uses Claude Agent SDK + MCP tools.
- Graph tools should be used for factual claims.

Runtime flow
1) User query arrives at /api/copilotkit.
2) Claude Agent SDK selects model and tools.
3) MCP tools (Graphiti) are provided and whitelisted.
4) Response is streamed back to UI.

Invariants / Non-negotiables
- Prefer tool-backed answers for graph facts.
- Allowed tools are explicitly whitelisted.

Interfaces / Contracts
- Runtime route: src/app/api/copilotkit/route.ts
- MCP tools list: ALLOWED_TOOLS in route.ts
- MCP server config: mcp-config.json

Failure modes & mitigations
- Model may skip tool calls even when available.
- Streaming errors can occur if the stream closes early.
- If tools are not called, results can be ungrounded.

Concrete artifacts
- Provider: src/app/layout.tsx
- Runtime route: src/app/api/copilotkit/route.ts
- Diagnostics: new-arch-docs/copilotkit-diagnostics-2026-01-24.md

Where to go next
- Agent roles: 06-AGENTS-ROLES.md
- Ops and testing: 10-OPS-TESTING.md
