# Data Flow

Purpose
Explain the end-to-end flow from raw data ingestion to user-facing answers.

TL;DR
- Raw data enters via scrapers and async jobs.
- GraphRAG groups weak signals into candidates.
- Claude validates and structures candidates.
- Graphiti stores validated signals.
- CopilotKit retrieves and explains.

Flow (canonical)
1) Ingest raw text (articles, posts, hires, comments, job pages).
2) GraphRAG clusters semantically related evidence into candidate signals.
3) Claude validates candidates (consistency, plausibility, duplication checks).
4) Ralph Loop enforces minimum evidence and confidence rules.
5) Graphiti stores validated signals and links evidence.
6) CopilotKit serves user queries using graph tools and summaries.

Invariants
- No direct writes from GraphRAG.
- Claude is the last gate before write.
- Ralph Loop is mandatory for signal creation.

Interfaces/Contracts
- Ingestion: scrapers -> validation API
- GraphRAG: /api/graphrag (search, add episode)
- Graphiti: GraphitiService (signals, episodes, timelines)
- Runtime: /api/copilotkit

Failure modes
- Missing evidence -> rejected by Ralph Loop.
- Graphiti unavailable -> validation fails or stores via fallback.
- CopilotKit tool usage not triggered -> responses may be ungrounded.

Where to go next
- Signal validation rules: 03-SIGNAL-LIFECYCLE.md
- Graph storage and retrieval: 04-GRAPH-STACK.md
