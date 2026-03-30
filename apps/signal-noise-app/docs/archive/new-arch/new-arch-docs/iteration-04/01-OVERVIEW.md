# Overview

Purpose
Describe the system at a high level: what it does, why it exists, and the core components.

TL;DR
- The app ingests noisy, continuous signals across ~3.5k entities and surfaces actionable opportunities.
- The system is graph-first with RAG-assisted discovery.
- Graphiti is the structured memory, GraphRAG finds weak signals, Claude validates, CopilotKit serves answers.
- Ralph Loop ensures data quality and prevents bad writes.

Invariants
- Graphiti is the authoritative memory.
- GraphRAG does not write; it only discovers candidates.
- Claude mediates every write.

Core components
- Ingestion: scrapers, batch jobs, webhooks (raw data).
- Discovery: GraphRAG for semantic clustering of weak signals.
- Validation: Ralph Loop (hard minimums + multi-pass).
- Storage: Graphiti over FalkorDB (with Supabase where configured).
- Retrieval: CopilotKit runtime + GraphRAG search endpoints.

Interfaces/Contracts
- Validation endpoint: /api/signals/validate (batch, Ralph Loop).
- GraphRAG endpoint: /api/graphrag (search + add episode).
- CopilotKit runtime: /api/copilotkit (tools + chat).

Failure modes
- GraphRAG or Graphiti service unavailable -> fallback to graph direct or mock data.
- Tool usage not invoked by model -> CopilotKit answers without MCP evidence.

Where to go next
- Data flow: 02-DATAFLOW.md
- Signal validation: 03-SIGNAL-LIFECYCLE.md
