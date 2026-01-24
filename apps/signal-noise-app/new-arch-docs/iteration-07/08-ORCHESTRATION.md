# Orchestration and Batching

Purpose
Explain batch processing, scheduling, and DAG logic.

TL;DR
- Scrapes and validations run asynchronously.
- Batch size and retry policy are core levers.
- DAGs control ingestion -> validation -> storage -> notification.

Invariants / Non-negotiables
- Batch passes must respect Ralph Loop max_passes.
- Retry policy must be bounded.

Interfaces / Contracts
- Script and cron tooling exists in /scripts and /backend.

Failure modes & mitigations
- Over-sized batches cause latency and cost spikes. Use chunking.

Concrete artifacts
- Scripts: scripts/
- Tests and examples: tests/

Where to go next
- Ops/testing: 10-OPS-TESTING.md
