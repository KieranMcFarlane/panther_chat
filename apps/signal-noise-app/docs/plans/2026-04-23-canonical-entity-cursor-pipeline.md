# Canonical Entity Cursor Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current batch-first queue progression with a canonical-entity cursor loop that resumes the current entity/question when stopped, finishes that entity, then advances to the next canonical entity automatically.

**Architecture:** Keep the existing worker, run metadata, and question-first execution surfaces, but change the control model from "claim next queued batch" to "claim or resume next canonical entity state". Batches become an execution detail for auditability only; the source of truth becomes a durable per-entity lifecycle/cursor record that tells the worker whether to resume a question repair, continue a full entity run, or advance to the next canonical entity.

**Tech Stack:** Python worker/orchestrator, local Postgres persistence, Next.js operational drilldown APIs, React operational strip/dashboard, pytest, node test.

### Task 1: Document the current queue-first failure mode in tests

**Files:**
- Modify: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`

**Step 1: Write the failing tests**

Add tests that prove:
- a completed batch with a queued run is not claimable by the current worker
- the worker writes `queue_exhausted` when `_queue_manifest_auto_advance()` returns `None`
- a stopped entity with `current_question_id` / `next_repair_question_id` should be preferred over queuing a brand-new entity

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -k "queue_exhausted or resume_current_entity" -v`
Expected: FAIL because current worker is batch-centric and cannot satisfy entity-cursor resume behavior.

**Step 3: Write minimal implementation scaffolding**

Add test fixtures/helpers only. Do not change runtime behavior yet.

**Step 4: Run test to verify it passes or stays intentionally failing**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -k "queue_exhausted or resume_current_entity" -v`
Expected: failing assertions clearly describe the current broken contract.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py
git commit -m "test: capture queue-first worker failure modes"
```

### Task 2: Introduce a durable entity-cursor selector

**Files:**
- Modify: `apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Modify: `apps/signal-noise-app/backend/local_pg_client.py`
- Test: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/backend/tests/test_local_pg_client.py`

**Step 1: Write the failing tests**

Add tests for a selector that chooses, in order:
- an in-progress/retrying entity that should resume
- a queued follow-on repair question for the current entity
- the next untouched canonical entity

Add local Postgres tests proving the selector does not require a queued batch row to find resumable work.

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_local_pg_client.py -k "entity_cursor or resumable" -v`
Expected: FAIL because no entity-cursor selector exists.

**Step 3: Write minimal implementation**

Implement a worker helper and local-Postgres support that can answer:
- `resume current entity`
- `resume current repair question`
- `advance to next canonical entity`

Do not remove batch tables yet. Add the selector alongside the existing claim path.

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_local_pg_client.py -k "entity_cursor or resumable" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/entity_pipeline_worker.py apps/signal-noise-app/backend/local_pg_client.py apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_local_pg_client.py
git commit -m "feat: add canonical entity cursor selector"
```

### Task 3: Resume the current entity/question instead of queueing a fresh start target

**Files:**
- Modify: `apps/signal-noise-app/src/lib/operational-start-target.ts`
- Modify: `apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx`
- Modify: `apps/signal-noise-app/src/app/api/home/queue-drilldown/route.ts`
- Test: `apps/signal-noise-app/tests/test-operational-status-view-model.mjs`
- Test: `apps/signal-noise-app/tests/test-operational-shell-contract.mjs`

**Step 1: Write the failing tests**

Add tests proving:
- the start target prefers the current resumable entity/question over upcoming/completed entities
- the strip start action resumes the current entity/question rather than always seeding a new rerun target

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-operational-status-view-model.mjs apps/signal-noise-app/tests/test-operational-shell-contract.mjs`
Expected: FAIL where current selection logic falls back to completed/upcoming entities.

**Step 3: Write minimal implementation**

Change start-target resolution so the preferred order is:
- `in_progress_entity`
- `stale_active_rows`
- `resume_needed_entities`
- current repair follow-on
- next untouched entity only when nothing is resumable

Keep the button surface, but change the semantics from "queue something" to "resume/continue cursor".

**Step 4: Run test to verify it passes**

Run: `node --test apps/signal-noise-app/tests/test-operational-status-view-model.mjs apps/signal-noise-app/tests/test-operational-shell-contract.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/lib/operational-start-target.ts apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx apps/signal-noise-app/src/app/api/home/queue-drilldown/route.ts apps/signal-noise-app/tests/test-operational-status-view-model.mjs apps/signal-noise-app/tests/test-operational-shell-contract.mjs
git commit -m "feat: resume current entity from live ops"
```

### Task 4: Make queue rows an audit artifact, not the control plane

**Files:**
- Modify: `apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Modify: `apps/signal-noise-app/backend/pipeline_run_metadata.py`
- Modify: `apps/signal-noise-app/src/lib/pipeline-runtime.ts`
- Modify: `apps/signal-noise-app/src/app/api/home/queue-drilldown/route.ts`
- Test: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`

**Step 1: Write the failing tests**

Add tests proving:
- a resumable entity can continue even when its previous batch is completed
- `queued` runs under completed batches are normalized out of the live control path
- progress state for current question/repair survives resume

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py -k "resume or completed batch" -v`
Expected: FAIL because current logic binds control flow to batch status.

**Step 3: Write minimal implementation**

Normalize control logic so:
- worker resume decisions come from run metadata / entity cursor state
- batch rows remain for traceability and links
- live runtime APIs stop treating completed batches as terminal when the entity still has resumable question work

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py -k "resume or completed batch" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/entity_pipeline_worker.py apps/signal-noise-app/backend/pipeline_run_metadata.py apps/signal-noise-app/src/lib/pipeline-runtime.ts apps/signal-noise-app/src/app/api/home/queue-drilldown/route.ts apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py
git commit -m "refactor: decouple pipeline control from batch status"
```

### Task 5: Remove `queue_exhausted` as a terminal pause for normal operation

**Files:**
- Modify: `apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Modify: `apps/signal-noise-app/src/lib/operational-status-hero.ts`
- Modify: `apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx`
- Test: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/tests/test-operational-status-hero.mjs`

**Step 1: Write the failing tests**

Add tests proving:
- empty work does not force the whole pipeline into paused state
- live ops reads idle/waiting rather than stopped/paused for normal exhaustion
- explicit user stop still pauses the worker

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -k "queue_exhausted or idle_waiting" -v`
Run: `node --test apps/signal-noise-app/tests/test-operational-status-hero.mjs`
Expected: FAIL because current behavior writes paused control state on queue exhaustion.

**Step 3: Write minimal implementation**

Change `queue_exhausted` handling to:
- leave requested state as `running`
- report `waiting for claimable/resumable work`
- only pause on manual stop or unhealthy orchestrator conditions

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -k "queue_exhausted or idle_waiting" -v`
Run: `node --test apps/signal-noise-app/tests/test-operational-status-hero.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/entity_pipeline_worker.py apps/signal-noise-app/src/lib/operational-status-hero.ts apps/signal-noise-app/src/components/layout/OperationalStatusStrip.tsx apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/tests/test-operational-status-hero.mjs
git commit -m "fix: keep pipeline running while waiting for next entity"
```

### Task 6: Run a live cursor smoke from the strip semantics

**Files:**
- Modify: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Modify: `apps/signal-noise-app/tests/test-operational-status-view-model.mjs`

**Step 1: Write the failing tests**

Add end-to-end smoke assertions that verify:
- current entity resumes from its current question
- entity completes all remaining questions
- worker advances to the next canonical entity automatically
- operational strip shows current question, then next entity, without manual reseeding

**Step 2: Run test to verify it fails**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -k "cursor_smoke" -v`
Expected: FAIL before implementation is complete.

**Step 3: Write minimal implementation**

Add only the missing wiring needed for the smoke to pass.

**Step 4: Run test to verify it passes**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -k "cursor_smoke" -v`
Run: `node --test apps/signal-noise-app/tests/test-operational-status-view-model.mjs apps/signal-noise-app/tests/test-operational-status-hero.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/tests/test-operational-status-view-model.mjs
git commit -m "test: verify canonical cursor pipeline resume and advance"
```

### Task 7: Full verification

**Files:**
- Modify: none unless fixes are required

**Step 1: Run backend verification**

Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py apps/signal-noise-app/backend/tests/test_local_pg_client.py apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q`
Expected: PASS

**Step 2: Run frontend verification**

Run: `node --test apps/signal-noise-app/tests/test-operational-shell-contract.mjs apps/signal-noise-app/tests/test-operational-status-view-model.mjs apps/signal-noise-app/tests/test-operational-status-hero.mjs`
Expected: PASS

**Step 3: Run live smoke**

Run:

```bash
cd apps/signal-noise-app/backend
PYTHON_PERSISTENCE_BACKEND=local_postgres python3 entity_pipeline_worker.py
```

In a second shell:

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
curl -X POST http://localhost:3000/api/home/pipeline-control -H 'Content-Type: application/json' -d '{"action":"start","is_paused":false}'
```

Expected:
- current resumable entity/question is selected first
- worker finishes that entity
- worker advances to the next canonical entity without manual reseeding
- operational strip remains in running/waiting mode, not paused by `queue_exhausted`

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify canonical cursor pipeline end to end"
```
