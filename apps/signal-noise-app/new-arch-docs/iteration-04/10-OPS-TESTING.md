# Ops and Testing

Purpose
Give minimal operational guidance for validating behavior.

TL;DR
- Dev server runs on 3005 (CopilotKit runtime).
- API tests exist for endpoints.
- Tool usage is not guaranteed unless enforced by prompt/tool gating.

Operational checks
- Start dev server: npm run dev (port 3005)
- CopilotKit smoke test: POST /api/copilotkit
- GraphRAG API: /api/graphrag
- Ralph Loop validation: /api/signals/validate

Known issues
- Tool calls may be zero even when configured.

Where to go next
- Business and positioning: 11-BUSINESS-POSITIONING.md
