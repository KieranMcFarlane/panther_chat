# Orchestration and Batching

Purpose
Describe batch processing, parallelization, and DAG logic.

TL;DR
- Scrapes and validations run asynchronously.
- Batch size and retry policy are core levers.
- DAGs govern ingestion -> validation -> storage -> notification.

Rules
- Batches should stop after max passes or time budget.
- Revalidation loops are automatic but bounded.

Where to go next
- Project structure: 09-SCHEMA-GOVERNANCE.md, 10-OPS-TESTING.md
