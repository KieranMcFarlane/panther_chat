# Signal Lifecycle (Ralph Loop)

Purpose
Define how signals are validated and written.

TL;DR
- Ralph Loop is required for all signal creation.
- Pass 1: rule-based checks (evidence, confidence, credibility).
- Pass 2: Claude validation (consistency and dedupe).
- Pass 3: final confirmation.
- Only validated signals are written.

Invariants / Non-negotiables
- min_evidence = 3
- min_confidence = 0.7
- max_passes = 3
- validated == true and validation_pass == 3 before write

Interfaces / Contracts
- API: /api/signals/validate
- RawSignal model: backend/main.py
- Ralph Loop logic: backend/ralph_loop.py
- Graph write: GraphitiService.upsert_signal

Failure modes & mitigations
- Claude failure in Pass 2: Ralph Loop currently fails open (returns candidates). Log and monitor.
- Missing graph connection: validation may fail unless Supabase is configured.

Concrete artifacts
- Ralph Loop: backend/ralph_loop.py
- Graph write: backend/graphiti_service.py (upsert_signal, link_evidence)
- Client: src/lib/ralph-loop-client.ts

Where to go next
- Graph stack: 04-GRAPH-STACK.md
- Runtime tool usage: 05-RUNTIME-COPILOTKIT.md
