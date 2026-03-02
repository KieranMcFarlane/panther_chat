# CSV Entity Pipeline Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CSV upload page that accepts new entities, persists them into the shared entity store, runs the full dossier-to-dashboard pipeline, records temporal/RFP outputs, and makes imported entities visible everywhere else in the system.

**Architecture:** Keep `react-csv-importer` as the client-side mapping and validation UI, but move all persistence and phase execution behind server-side APIs. Introduce one explicit orchestration path that starts with normalized entity import rows, upserts the entity into Supabase plus graph storage, runs Phase 0 through Phase 4 in order, persists each artifact, and exposes batch/job status back to the upload page.

**Tech Stack:** Next.js App Router, React, `react-csv-importer`, Supabase, FastAPI, existing Python pipeline modules in `backend/`, Graphiti/FalkorDB integration, Claude client, BrightData.

## Current-State Findings

- `backend/dossier_generator.py` exists and does generate dossier metadata plus `extracted_signals`, but the discovery warm-start path is not using that contract cleanly.
- `backend/hypothesis_driven_discovery.py` currently iterates `dossier["procurement_signals"]` like a list, while the generator schema defines `procurement_signals` as an object with `upcoming_opportunities`, `budget_indicators`, and `strategic_initiatives`.
- `run_dossier_first_pipeline.py` is not the full production path yet: it does not run explicit Ralph validation after discovery and passes `episodes=None` into dashboard scoring.
- `src/app/api/entities/route.ts` `POST` is still mock entity creation, so there is no real import endpoint for new entities.
- `src/app/api/dossier/route.ts` is dossier retrieval/generation, not end-to-end onboarding.
- `backend/graphiti_service.py` can already persist episodes, entities, and signals to Supabase or FalkorDB, so the missing piece is orchestration rather than raw capability.

## Recommended End-To-End Design

### Task 1: Define the import contract and CSV template

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-import-schema.ts`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/entity-import-csv-format.md`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_data_specs.py`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-canonicalization.ts`

**Step 1: Write the failing test**

Create a source-level test that asserts the importer schema exposes the required fields and required/optional column split.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-import-schema.mjs`
Expected: FAIL because the schema file does not exist yet.

**Step 3: Write minimal implementation**

Define one import shape for entity onboarding:

Required columns:
- `name`
- `entity_type`
- `sport`
- `country`
- `source`

Optional columns:
- `external_id`
- `website`
- `league`
- `founded_year`
- `headquarters`
- `stadium_name`
- `capacity`
- `description`
- `priority_score`
- `badge_url`

Normalization rules:
- Generate `entity_id` slug server-side from `name`
- Normalize `entity_type` to the existing canonical set
- Default `priority_score` to `50`
- Reject rows with empty required fields
- Keep `source` so imported records remain traceable

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-import-schema.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/entity-import-schema.ts docs/entity-import-csv-format.md tests/test-entity-import-schema.mjs
git commit -m "feat: define entity csv import contract"
```

### Task 2: Add a real CSV upload page using `react-csv-importer`

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-import/page.tsx`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/entity-import/EntityCsvImporter.tsx`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/package.json`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-page.mjs`

**Step 1: Write the failing test**

Assert that the import page renders the importer entry point, displays the required columns, and posts normalized rows to a real API endpoint.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-import-page.mjs`
Expected: FAIL because the page and component do not exist.

**Step 3: Write minimal implementation**

Install and wire [react-csv-importer](https://github.com/beamworks/react-csv-importer) into a dedicated page that:
- Shows the required CSV columns before upload
- Lets the user map uploaded columns to the schema
- Streams parsed rows to a server endpoint in chunks
- Shows batch progress, accepted rows, rejected rows, and created job IDs

Keep the page intentionally focused:
- No direct database writes from the client
- No phase execution in the browser
- No hidden field guessing beyond simple normalization hints

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-import-page.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json package-lock.json src/app/entity-import/page.tsx src/components/entity-import/EntityCsvImporter.tsx tests/test-entity-import-page.mjs
git commit -m "feat: add csv entity import page"
```

### Task 3: Replace mock entity creation with a real import API

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entity-import/route.ts`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-import-mapper.ts`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entities/route.ts`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/cached-entities-supabase.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-api.mjs`

**Step 1: Write the failing test**

Assert that posting valid rows creates or updates records in `cached_entities` shape, returns dedupe results, and rejects malformed rows with row-level errors.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-import-api.mjs`
Expected: FAIL because the API does not exist.

**Step 3: Write minimal implementation**

Build an API that:
- Accepts chunked import payloads from the upload page
- Normalizes each row into the `cached_entities` shape
- Upserts `cached_entities`
- Returns `created`, `updated`, `skipped_duplicate`, and `invalid` counts
- Writes `properties.source`, `properties.external_id`, and `properties.imported_at`

Do not use the current mock `POST /api/entities` path for ingestion. That route should either be upgraded to the same persistence logic or remain a thin single-entity wrapper around the new importer service.

Important cleanup during this task:
- Remove direct reliance on the hardcoded Supabase anon key in `src/lib/cached-entities-supabase.ts`
- Load credentials from environment variables consistently

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-import-api.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/entity-import/route.ts src/app/api/entities/route.ts src/lib/entity-import-mapper.ts src/lib/cached-entities-supabase.ts tests/test-entity-import-api.mjs
git commit -m "feat: persist imported entities to supabase"
```

### Task 4: Add import batch and pipeline run persistence

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/supabase/migrations/20260302_create_entity_import_tables.sql`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/entity-import-jobs.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-jobs.mjs`

**Step 1: Write the failing test**

Assert that a created import batch can store:
- batch metadata
- row counts
- per-entity pipeline job status
- final outcome references

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-import-jobs.mjs`
Expected: FAIL because these persistence helpers and tables do not exist.

**Step 3: Write minimal implementation**

Create two tables:
- `entity_import_batches`
- `entity_pipeline_runs`

Recommended `entity_import_batches` columns:
- `id`
- `filename`
- `uploaded_by`
- `status`
- `total_rows`
- `created_rows`
- `updated_rows`
- `invalid_rows`
- `started_at`
- `completed_at`
- `metadata`

Recommended `entity_pipeline_runs` columns:
- `id`
- `batch_id`
- `entity_id`
- `entity_name`
- `status`
- `phase`
- `error_message`
- `dossier_id`
- `sales_readiness`
- `rfp_count`
- `started_at`
- `completed_at`
- `metadata`

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-import-jobs.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/20260302_create_entity_import_tables.sql src/lib/entity-import-jobs.ts tests/test-entity-import-jobs.mjs
git commit -m "feat: add import batch and pipeline run tracking"
```

### Task 5: Create one backend orchestrator for Phase 0 through Phase 4

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/main.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/hypothesis_driven_discovery.py`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dossier_generator.py`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/ralph_loop.py`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/graphiti_service.py`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/dashboard_scorer.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`

**Step 1: Write the failing test**

Assert that one orchestrator method does the following for a single entity:
- generates dossier
- converts dossier signals into discovery priors correctly
- runs discovery
- validates raw discovery signals through Ralph
- persists validated signals and temporal episodes
- computes final scores
- returns artifact references

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && python3 -m pytest backend/tests/test_pipeline_orchestrator.py -v`
Expected: FAIL because the orchestrator does not exist.

**Step 3: Write minimal implementation**

Create an orchestrator with this phase order:

Phase 0:
- Read entity from imported row or `cached_entities`
- Generate dossier with `UniversalDossierGenerator`
- Persist/update `entity_dossiers`

Phase 1:
- Convert dossier output into discovery priors using an adapter that understands:
  - `procurement_signals.upcoming_opportunities`
  - `executive_summary.key_insights`
  - `extracted_signals`
- Fix `run_discovery_with_dossier_context()` so it does not assume `procurement_signals` is a list and so it reads the generator’s actual signal fields

Phase 2:
- Convert discovery outputs to Ralph input
- Run `RalphLoop.validate_signals()`
- Persist validated signals using `GraphitiService.upsert_signal()` or the existing temporal store

Phase 3:
- For validated RFP-like signals, create temporal episodes through `GraphitiService.add_rfp_episode()`
- For non-RFP discovery milestones, add discovery episodes through `GraphitiService.add_discovery_episode()`
- Collect recent episodes for the entity

Phase 4:
- Run `DashboardScorer.calculate_entity_scores()` with hypotheses, validated signals, and episodes
- Persist final scores to a dedicated score record or to `entity_pipeline_runs.metadata`

Return:
- `dossier_id`
- `pipeline_run_id`
- `validated_signal_count`
- `rfp_count`
- `sales_readiness`
- `artifact_locations`

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && python3 -m pytest backend/tests/test_pipeline_orchestrator.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/pipeline_orchestrator.py backend/main.py backend/hypothesis_driven_discovery.py backend/tests/test_pipeline_orchestrator.py
git commit -m "feat: orchestrate full intelligence pipeline"
```

### Task 6: Surface detected RFPs into the shared system

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/graphiti_service.py`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/rfp-results/route.ts`
- Inspect: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/supabase-schema-rfps-unified.sql`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_pipeline_rfp_persistence.py`

**Step 1: Write the failing test**

Assert that a validated RFP signal from an imported entity results in:
- a temporal episode
- a row in the unified RFP table
- visibility through the existing RFP API

**Step 2: Run test to verify it fails**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && python3 -m pytest backend/tests/test_pipeline_rfp_persistence.py -v`
Expected: FAIL because the orchestrator does not yet persist unified RFP output.

**Step 3: Write minimal implementation**

On each validated RFP:
- create an `rfp_opportunities_unified` upsert keyed by entity plus URL/title
- keep the original evidence URL and confidence
- store the pipeline run ID in metadata
- record the matching Graphiti episode ID in metadata

This is the point where imported entities start surfacing in the global RFP views rather than only inside their own dossier artifacts.

**Step 4: Run test to verify it passes**

Run: `cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && python3 -m pytest backend/tests/test_pipeline_rfp_persistence.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/pipeline_orchestrator.py backend/graphiti_service.py src/app/api/rfp-results/route.ts backend/tests/test_pipeline_rfp_persistence.py
git commit -m "feat: surface imported-entity rfps globally"
```

### Task 7: Connect the upload page to batch execution and live status

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/entity-import/page.tsx`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/components/entity-import/EntityCsvImporter.tsx`
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/entity-import/[batchId]/route.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-entity-import-status.mjs`

**Step 1: Write the failing test**

Assert that the page can poll batch status and render:
- queued
- running
- completed
- failed

Plus per-entity phase progress.

**Step 2: Run test to verify it fails**

Run: `node --test tests/test-entity-import-status.mjs`
Expected: FAIL because the status endpoint and UI do not exist.

**Step 3: Write minimal implementation**

Page behavior:
- Upload and map CSV
- Submit rows
- Receive `batch_id`
- Poll `/api/entity-import/[batchId]`
- Render a progress table with columns:
  - entity
  - phase
  - status
  - sales readiness
  - RFP count
  - dossier link

Keep it utilitarian. The important thing is operator clarity.

**Step 4: Run test to verify it passes**

Run: `node --test tests/test-entity-import-status.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/entity-import/page.tsx src/components/entity-import/EntityCsvImporter.tsx src/app/api/entity-import/[batchId]/route.ts tests/test-entity-import-status.mjs
git commit -m "feat: add entity import batch status ui"
```

### Task 8: Verify the whole import-to-RFP path

**Files:**
- No new files required unless verification exposes regressions.

**Step 1: Run frontend tests**

Run:

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && node --test tests/test-entity-import-schema.mjs tests/test-entity-import-page.mjs tests/test-entity-import-api.mjs tests/test-entity-import-jobs.mjs tests/test-entity-import-status.mjs
```

Expected: all tests pass.

**Step 2: Run backend tests**

Run:

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && python3 -m pytest backend/tests/test_pipeline_orchestrator.py backend/tests/test_pipeline_rfp_persistence.py -v
```

Expected: all tests pass.

**Step 3: Manual batch verification**

Use a small CSV:

```csv
name,entity_type,sport,country,source,website,league,priority_score
Coventry City FC,CLUB,Football,England,csv_import,https://www.ccfc.co.uk,Championship,70
Arsenal FC,CLUB,Football,England,csv_import,https://www.arsenal.com,Premier League,90
```

Verify:
- rows appear in `cached_entities`
- entities appear in `/api/entities`
- dossiers are created in `entity_dossiers`
- pipeline runs advance through all phases
- temporal episodes are written
- any detected RFPs appear in the global RFP views

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify csv import to intelligence pipeline flow"
```

## CSV Format To Use

Use this as the first import template:

```csv
name,entity_type,sport,country,source,external_id,website,league,founded_year,headquarters,stadium_name,capacity,description,priority_score,badge_url
Arsenal FC,CLUB,Football,England,csv_import,,https://www.arsenal.com,Premier League,1886,London,Emirates Stadium,60704,Premier League football club,90,
```

For the first version, only `name`, `entity_type`, `sport`, `country`, and `source` should be mandatory.

## Recommended Execution Order

1. Fix the entity import contract and add the upload page.
2. Build the real import API and batch persistence.
3. Implement the backend orchestrator and repair the dossier-to-discovery contract mismatch.
4. Wire validated RFP persistence into the global RFP system.
5. Add batch status UI and run end-to-end verification.

## Why This Is The Best Path

- It preserves the existing Python phase modules instead of rewriting them in Next.js.
- It uses `react-csv-importer` only for what it is good at: mapping and row ingestion UX.
- It makes imported entities visible in the same `cached_entities` source already used by the entity browser.
- It creates one explicit production orchestration path instead of relying on scattered demo scripts.
- It ensures RFPs found from imported entities are promoted into the shared system, not trapped inside per-entity dossier output.
