# Overview

Purpose
Explain what the system does, why it exists, and the core components.

TL;DR
- The system monitors noisy signals across ~3.5k entities and surfaces opportunities.
- It is graph-first with RAG-assisted discovery.
- Graphiti stores authoritative signals; GraphRAG finds weak signals; Claude validates; CopilotKit serves answers.
- Ralph Loop enforces data quality and prevents bad writes.

Invariants / Non-negotiables
- Graphiti is the source of truth for structured signals and temporal facts.
- GraphRAG never writes to the graph. It only proposes candidates.
- Claude is the last semantic gate before write.

Interfaces / Contracts
- Validation API: /api/signals/validate (Ralph Loop).
- GraphRAG API: /api/graphrag (search and add-episode).
- Runtime API: /api/copilotkit (chat + tool use).

Failure modes & mitigations
- Graphiti service unavailable: fallback to direct graph or mock results.
- Tool usage not invoked: responses may be ungrounded. Prefer tool-gating or stronger prompts.

Concrete artifacts
- Overview doc: CLAUDE.md
- Runtime route: src/app/api/copilotkit/route.ts
- GraphRAG route: src/app/api/graphrag/route.ts
- Validation: backend/ralph_loop.py, backend/main.py

Where to go next
- Data flow: 02-DATAFLOW.md
- Signal lifecycle: 03-SIGNAL-LIFECYCLE.md
