# Signal Lifecycle (Ralph Loop)

Purpose
Define how signals are created, validated, and written to the graph.

TL;DR
- Signals are only accepted through Ralph Loop.
- Minimum evidence count: 3.
- Minimum confidence: 0.7.
- Maximum passes: 3.
- Only validated signals are written to Graphiti.

Lifecycle
1) Raw signals from scrapers.
2) Pass 1: rule-based filtering (evidence count, source credibility, confidence).
3) Pass 2: Claude validation (consistency, dedupe, plausibility).
4) Pass 3: final confirmation (confidence + duplication).
5) Write to Graphiti/Supabase only if validated.

Invariants
- Fail closed on low evidence or confidence.
- No writes unless validation_pass=3 and validated=true.
- Claude is used for semantic adjudication; rules remain deterministic.

Interfaces/Contracts
- API: /api/signals/validate
- Graph write: GraphitiService.upsert_signal

Failure modes
- Claude failure: falls back to pass-through but should be logged.
- Missing graph connection: validation fails or uses Supabase if configured.

Where to go next
- Graph storage details: 04-GRAPH-STACK.md
- Runtime query behavior: 05-RUNTIME-COPILOTKIT.md
