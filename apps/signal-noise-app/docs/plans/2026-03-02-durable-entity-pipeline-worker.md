# Durable Entity Pipeline Worker

## Goal

Move heavy entity runs off in-process background execution and onto a durable worker loop so long entities like International Canoe Federation do not depend on one Next.js request lifecycle.

## Current State

- CSV and single-entity intake now enqueue work and return immediately.
- Batch/run state is persisted in:
  - `entity_import_batches`
  - `entity_pipeline_runs`
- Execution is still started inside the Next.js route process with an in-memory `activeBatchRuns` map.

## Problem

That is not durable:

- a restart loses the in-memory worker state
- long runs can outlive a single app process
- heavy entities still exceed practical synchronous smoke-test windows

## Recommended Cutover

### 1. Queue Mode Flag

Add env:

```env
ENTITY_IMPORT_QUEUE_MODE=durable_worker
```

Modes:

- `in_process`
  Current behavior. Good for local dev.
- `durable_worker`
  Route only marks batch queued. External worker claims and processes it.

### 2. Worker Contract

Worker loop should:

1. poll `entity_import_batches` for `status='queued'`
2. atomically claim one batch by updating:
   - `status='running'`
   - `metadata.worker_id`
   - `metadata.claimed_at`
3. read `entity_pipeline_runs` for that batch
4. process incomplete runs one by one
5. persist:
   - phase updates
   - `scores`
   - `performance_summary`
   - dossier and RFP promotion outputs
6. mark batch:
   - `completed` if all runs complete
   - `failed` if any run fails and retry policy is exhausted

### 3. Retry Policy

Per run:

- `attempt_count` in `entity_pipeline_runs.metadata`
- retry transient failures only
- cap retries to `2`

Per batch:

- leave batch `running` while active runs remain
- move to `failed` only when unfinished runs cannot be retried

### 4. Health and Recovery

Worker should also reclaim stale runs:

- if `status='running'` and `metadata.heartbeat_at` is too old
- reset run to `queued`
- append recovery note in metadata

### 5. Deployment Shape

Recommended production shape:

- Next.js app:
  intake, status pages, dossier/RFP surfaces
- FastAPI app:
  phase execution endpoint
- worker process:
  polls Supabase queue tables and calls FastAPI

## Why This Is The Right Next Step

- keeps the UI async and fast
- makes long federation runs operationally safe
- uses the batch/run tables already in place
- avoids tying heavy pipeline work to a browser request or a single web process
