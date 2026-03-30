# Ops and Testing

Purpose
Provide minimal runbooks and known diagnostics.

TL;DR
- Dev server runs on port 3005.
- Validation endpoint: /api/signals/validate.
- CopilotKit runtime: /api/copilotkit.
- GraphRAG: /api/graphrag.

Operational checks
- Start dev server: npm run dev
- API test suite: npm run test
- MCP integration test: npm run test:mcp

Known issues
- Tool calls may be zero even when configured.
- Streaming error observed: controller closed early (see diagnostics).

Concrete artifacts
- Diagnostics log: new-arch-docs/copilotkit-diagnostics-2026-01-24.md
- Tests: tests/run-tests.sh, tests/test-api-endpoints.mjs

Where to go next
- Business positioning: 11-BUSINESS-POSITIONING.md
