# Phase 0 Blocker and Full Pipeline Recovery Plan

## Summary

This plan fixes the current blocker first, then completes end-to-end pipeline hardening for reliable operation at 3,000+ entities.

Current blocker observed in live runs:
- Phase 0 (`dossier_generation`) stalls at `collect_entity_data` and frequently exits only via global timeout (`HTTP 504`) unless degraded mode is enabled.
- This causes completed runs with empty dossier evidence, weak discovery context, and low downstream signal quality.

This plan preserves the existing business phases but makes execution deterministic, bounded, and observable.

## Blocker Diagnosis

### Evidence
- Live run `import_1772704853294` failed at phase 0 timeout with `phase_details.reason=dossier_generation_timeout`.
- Live run `import_1772705169227` completed only because `PIPELINE_PHASE0_TIMEOUT_MODE=degraded` was enabled.
- In degraded completion, `phases.dossier_generation.source_count=0`, `sources_used=[]`, and no collection timings were persisted.

### Most likely root causes
1. Blocking I/O inside async phase-0 collection path:
- `backend/dossier_data_collector.py` uses sync FalkorDB query (`g.query`) inside async functions.
- `asyncio.wait_for` around these functions cannot reliably preempt blocking sync calls.

2. Timeout boundaries are layered but not source-granular:
- Per-source timeout exists, but if a source blocks synchronously, cancellation is ineffective.
- Outer phase timeout catches the whole phase late, after most of the budget is consumed.

3. Weak phase-0 telemetry for failure analysis:
- We track only coarse substep states in run metadata.
- We do not always persist source-level attempt/failure/timeout timing in real time.

4. BrightData usage can be bypassed by runtime/env mismatch:
- BrightData fallback path was improved, but phase-0 collection still needs explicit per-source diagnostics to prove path selection in production.

## Target Outcomes

1. Phase 0 always terminates within a hard bound with deterministic fallback behavior.
2. Phase 0 always emits source-level timing + status for each source attempt.
3. Blocking source calls are isolated from the event loop and cannot stall the phase.
4. Runs complete with either:
- validated phase-0 evidence, or
- explicit degraded evidence contract explaining what was skipped and why.
5. Full pipeline (queue -> worker -> FastAPI -> Supabase -> UI) remains durable and operator-visible.

## Implementation Plan

## Stage A: Blocker Fix (Immediate)

### Task A1: Move blocking source calls off event loop and enforce hard source deadlines

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_data_collector.py`

Implement:
- Wrap FalkorDB blocking operations in `asyncio.to_thread` (or dedicated thread helpers).
- Apply explicit per-source deadline to thread futures.
- Mark source result as `timeout`/`failed` without blocking whole phase.
- Do not call sync database clients directly from async path.

Acceptance:
- `collect_entity_data` cannot block beyond `DOSSIER_SOURCE_TIMEOUT_SECONDS` per source.
- Event loop remains responsive under unreachable FalkorDB/BrightData endpoints.

### Task A2: Add source-level substeps and live progress emission for Phase 0

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/main.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_generator.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_data_collector.py`

Implement:
- Extend phase-0 substeps to include:
  - `connect_falkordb`
  - `fetch_falkordb_metadata`
  - `connect_brightdata`
  - `brightdata_search_official`
  - `brightdata_scrape_official`
  - `extract_entity_properties`
- Emit status transitions (`running`, `completed`, `failed`, `timeout`, `skipped`) as they happen.
- Persist `duration_seconds`, `error`, `source`, `cache_hit` where applicable.

Acceptance:
- Run-detail metadata shows exactly which source step consumed time and failed.
- No more opaque `collect_entity_data` stall with no source breakdown.

### Task A3: Make degraded mode explicit default for production while preserving diagnostics

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/main.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env.optional`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env.required` (documented note only)

Implement:
- Default `PIPELINE_PHASE0_TIMEOUT_MODE=degraded` for worker-driven production mode.
- Preserve hard timeout budget (`DOSSIER_PHASE0_TIMEOUT_SECONDS`) and include timeout reason in metadata.
- Persist fallback dossier contract fields:
  - `generation_mode=timeout_degraded`
  - `collection_timed_out=true`
  - per-source partial results snapshot.

Acceptance:
- Timeouts no longer fail entire run by default.
- Operators can still detect degraded runs and why they degraded.

### Task A4: Add Phase 0 regression tests

Files:
- Create/modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_phase0_collection_timeouts.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_phase_update_payload.py`

Test cases:
- blocking FalkorDB call is bounded and reported as timed out.
- BrightData failure does not block phase completion.
- degraded timeout path returns completed response with fallback metadata.
- phase updates include source-level timing entries.

## Stage B: BrightData and Source Reliability

### Task B1: Enforce deterministic BrightData source strategy per entity type

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_data_collector.py`
- Reuse: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_page_registry.py`

Implement:
- For `FEDERATION`, attempt canonical order:
  - official site
  - `/tenders`, `/procurement`
  - `/news`, `/documents`
- Use known domain shortcuts before broad web search when official domain exists.

Acceptance:
- Fewer wasted search hops.
- Better hit rate on procurement-relevant pages.

### Task B2: Persist BrightData channel diagnostics in run metadata

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/brightdata_sdk_client.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_data_collector.py`

Implement:
- Record for each call:
  - provider path (`brightdata_sdk` vs `brightdata_http_fallback`)
  - endpoint
  - zone
  - duration
  - result count.
- Surface this in `metadata.phases.dossier_generation.source_timings`.

Acceptance:
- Operators can verify API usage and zone/endpoint alignment without reading logs.

## Stage C: Queue/Worker/FastAPI Reliability (Complete control plane)

### Task C1: Finalize queue state semantics in metadata

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-import-jobs.ts`

Implement:
- Ensure consistent transitions:
  - `queued -> running -> completed|failed`
  - `retrying` only while actually re-queued
- Clear/refresh `lease_expires_at` and `retry_state` correctly on completion/failure.

Acceptance:
- No stale `retry_state=retrying` on failed terminal runs.

### Task C2: Add run-level durable event timeline

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-import/[batchId]/[entityId]/page.tsx`
- Add backend metadata emitter helper in FastAPI path.

Implement:
- Append compact event timeline entries for each phase/substep change.
- Render timeline in run-detail page.

Acceptance:
- Debugging no longer requires log inspection.

## Stage D: Discovery and Scoring Quality

### Task D1: Keep discovery throughput-first with strict early stop

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/hypothesis_driven_discovery.py`

Implement:
- Stop repeated unchanged `official_site` evaluation loops.
- Prioritize deterministic page classes over broad search.
- Keep compact evidence packs only.

Acceptance:
- Reduced run time on heavy entities.
- Reduced token spend.

### Task D2: Maintain validation-first scoring contract

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dashboard_scorer.py`

Implement:
- Ensure hypotheses remain priors/uncertainty modifiers.
- Primary score inputs remain validated signals + temporal evidence.

Acceptance:
- Stable scores despite hypothesis drift.

## Stage E: UI and Operator Surface

### Task E1: Surface phase-0 source diagnostics directly

Files:
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-import/[batchId]/[entityId]/page.tsx`

Implement:
- Dedicated Phase 0 panel with:
  - source table
  - status per source
  - duration per source
  - degraded reason banner.

Acceptance:
- Immediate visibility into phase-0 bottlenecks.

### Task E2: Keep CSV, dossier, and RFP pages intact

Files:
- Review only:
  - `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-pipeline/page.tsx`
  - `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-browser/[entityId]/dossier/page.tsx`
  - `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/rfps/page.tsx`

Acceptance:
- No UX regressions in existing entity and RFP surfacing.

## Verification Plan

## Automated

- Backend tests:
  - phase-0 timeout bounded behavior
  - source-step metadata emission
  - degraded fallback contract
- Route tests:
  - queue-only behavior unchanged
  - run-detail renders phase-0 source diagnostics.

## Live smoke tests

1. `International Canoe Federation` (federation, document-heavy)
2. `AFC Bournemouth` (club)
3. One entity with poor official domain quality

For each:
- confirm total runtime bound
- confirm phase-0 source breakdown exists
- confirm BrightData path metadata exists
- confirm dossier page and unified RFP page still load data

## Rollout

1. Stage A in one branch and deploy to staging first.
2. Run smoke tests and compare failure rate/timeouts vs current.
3. Merge Stage B/C once blocker metrics improve.
4. Complete D/E and run full end-to-end validation suite.

## Success Criteria

1. No run stalls indefinitely in phase 0.
2. Phase 0 either succeeds with evidence or degrades explicitly with reason.
3. Source-level timings are always visible for phase 0.
4. Durable worker runs complete without manual intervention.
5. RFP surfacing remains intact across CSV-imported entities.

