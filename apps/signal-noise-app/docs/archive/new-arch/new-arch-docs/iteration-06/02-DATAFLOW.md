# Data Flow

Purpose
Describe the end-to-end flow from raw data to user answers.

TL;DR
- Raw text is ingested from scrapers and async jobs.
- GraphRAG clusters weak signals into candidates.
- Claude validates and structures candidates.
- Ralph Loop enforces minimums and consistency.
- Graphiti stores validated signals and evidence.
- CopilotKit uses graph tools to answer queries.

Canonical flow
1) Ingest raw signals from scrapers, feeds, and webhooks.
2) GraphRAG performs semantic clustering and candidate discovery.
3) Claude validates and structures candidates.
4) Ralph Loop runs 3-pass validation and enforces thresholds.
5) Graphiti writes validated signals and links evidence.
6) CopilotKit retrieves and explains using tool-backed answers.

Invariants / Non-negotiables
- GraphRAG never writes directly.
- Claude must validate before any write.
- Ralph Loop is mandatory for signal creation.

Interfaces / Contracts
- Ingestion: scrapers -> /api/signals/validate
- GraphRAG: /api/graphrag (search, add-episode)
- Graph write: GraphitiService.upsert_signal
- Runtime: /api/copilotkit

Failure modes & mitigations
- Missing evidence: rejected by Ralph Loop.
- Graphiti unavailable: fail closed or fallback to Supabase if configured.
- GraphRAG unavailable: fall back to direct graph or mock.

Concrete artifacts
- Scraper integration: src/lib/real-time-scraper.ts
- Ralph Loop client: src/lib/ralph-loop-client.ts
- Validation endpoint: backend/main.py
- Graphiti service: backend/graphiti_service.py

Where to go next
- Signal lifecycle: 03-SIGNAL-LIFECYCLE.md
- Graph stack: 04-GRAPH-STACK.md
