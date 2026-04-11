# Self-Healing Repair Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current operator-steered degraded-publication flow into a bounded self-healing repair loop that automatically retries incomplete entities, preserves canonical Supabase publication, and reconciles Falkor asynchronously.

**Architecture:** Keep Supabase-backed canonical dossier publication as the operator-facing source of truth. Add a repair coordinator that detects incomplete/degraded entities, schedules root-question repairs using the existing cascade graph, tracks retry budgets, and advances entities through explicit lifecycle states. Decouple Falkor reconciliation into a background worker so degraded publication can heal without blocking question progression.

**Tech Stack:** Next.js App Router, TypeScript, Python FastAPI backend, Supabase, existing entity pipeline worker/orchestrator, question-first dossier artifacts, contract tests, pytest, node test, eslint.

### Task 1: Define bounded self-healing state model

**Files:**
- Create: `docs/plans/2026-04-10-self-healing-repair-loop.md`
- Modify: `apps/signal-noise-app/backend/pipeline_run_metadata.py`
- Modify: `apps/signal-noise-app/src/lib/entity-pipeline-lifecycle.ts`
- Test: `apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`
- Test: `apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs`

**Step 1: Write the failing backend test**

Add a pytest that expects run metadata to support explicit self-healing lifecycle fields:
- `repair_state`
- `repair_retry_count`
- `repair_retry_budget`
- `next_repair_question_id`
- `reconciliation_state`

**Step 2: Run test to verify it fails**

Run: `cd apps/signal-noise-app && pytest backend/tests/test_pipeline_orchestrator.py -q`
Expected: FAIL because the new fields are not persisted.

**Step 3: Write the failing frontend contract test**

Add a node contract test expecting the lifecycle helper to read and surface:
- `repairing`
- `reconciling`
- bounded retry metadata

**Step 4: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs`
Expected: FAIL because the lifecycle helper does not expose those states.

**Step 5: Write minimal implementation**

Update metadata helpers and lifecycle normalization so these fields persist and map cleanly into shared lifecycle state.

**Step 6: Run tests to verify they pass**

Run the same commands.
Expected: PASS.

**Step 7: Commit**

```bash
git add apps/signal-noise-app/backend/pipeline_run_metadata.py \
  apps/signal-noise-app/src/lib/entity-pipeline-lifecycle.ts \
  apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py \
  apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs

git commit -m "feat: add self-healing repair lifecycle metadata"
```

### Task 2: Add repair root selection for incomplete entities

**Files:**
- Create: `apps/signal-noise-app/backend/repair_root_selector.py`
- Modify: `apps/signal-noise-app/backend/question_first_repair.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_repair.py`
- Test: `apps/signal-noise-app/backend/tests/test_repair_root_selector.py`

**Step 1: Write the failing selector test**

Create tests that assert the coordinator chooses the earliest meaningful root blocker, not arbitrary blocked descendants:
- FC Porto-style chain chooses `q11_decision_owner` over `q12_connections` or `q15_outreach_strategy`
- procurement chain chooses `q7_procurement_signal` over downstream blocked questions
- exhausted retry budget returns no candidate

**Step 2: Run test to verify it fails**

Run: `cd apps/signal-noise-app && pytest backend/tests/test_question_first_repair.py backend/tests/test_repair_root_selector.py -q`
Expected: FAIL because selector logic does not exist.

**Step 3: Write minimal implementation**

Create a small selector that:
- inspects canonical dossier question states
- uses existing dependency graph ordering
- chooses the nearest retryable root question
- skips roots whose retry budgets are exhausted

**Step 4: Run tests to verify they pass**

Run the same pytest command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/repair_root_selector.py \
  apps/signal-noise-app/backend/question_first_repair.py \
  apps/signal-noise-app/backend/tests/test_question_first_repair.py \
  apps/signal-noise-app/backend/tests/test_repair_root_selector.py

git commit -m "feat: select repair roots for incomplete entities"
```

### Task 3: Auto-queue bounded repair cycles for incomplete entities

**Files:**
- Modify: `apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Modify: `apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Modify: `apps/signal-noise-app/src/lib/entity-dossier-queue.ts`
- Test: `apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`
- Test: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/tests/test-entity-dossier-rerun-dedupe-contract.mjs`

**Step 1: Write the failing orchestrator test**

Add tests asserting:
- a completed-but-blocked entity can enqueue a repair batch automatically
- the batch targets `next_repair_question_id`
- retry count increments
- exhausted entities stop auto-requeueing and move to `exhausted`

**Step 2: Run test to verify it fails**

Run: `cd apps/signal-noise-app && pytest backend/tests/test_pipeline_orchestrator.py backend/tests/test_entity_pipeline_worker.py -q`
Expected: FAIL because auto-repair scheduling does not exist.

**Step 3: Write the failing contract test for dedupe under auto-repair**

Assert duplicate operator/manual and auto-generated repair requests for the same repair key still reuse the active batch.

**Step 4: Run contract test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-entity-dossier-rerun-dedupe-contract.mjs`
Expected: FAIL if auto-queue path is not deduped.

**Step 5: Write minimal implementation**

Update orchestration so when a run ends with:
- valid canonical publication
- incomplete or blocked quality state
- retry budget remaining

it schedules one next repair batch for the chosen root question and records it in metadata. Reuse the existing queue dedupe guard instead of inventing a second scheduling path.

**Step 6: Run tests to verify they pass**

Run both pytest and node test commands.
Expected: PASS.

**Step 7: Commit**

```bash
git add apps/signal-noise-app/backend/pipeline_orchestrator.py \
  apps/signal-noise-app/backend/entity_pipeline_worker.py \
  apps/signal-noise-app/src/lib/entity-dossier-queue.ts \
  apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py \
  apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py \
  apps/signal-noise-app/tests/test-entity-dossier-rerun-dedupe-contract.mjs

git commit -m "feat: auto-queue bounded repair cycles"
```

### Task 4: Add asynchronous Falkor reconciliation worker path

**Files:**
- Create: `apps/signal-noise-app/backend/reconciliation_worker.py`
- Modify: `apps/signal-noise-app/backend/persistence_coordinator.py`
- Modify: `apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/backend/tests/test_persistence_coordinator.py`
- Test: `apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`
- Test: `apps/signal-noise-app/backend/tests/test_reconciliation_worker.py`

**Step 1: Write the failing reconciliation tests**

Add tests asserting:
- Falkor-only write failures create reconciliation work items
- reconciliation worker retries only the missing secondary persistence
- successful reconciliation clears `reconcile_required`
- repeated reconciliation failures stop at a bounded retry count and remain visible

**Step 2: Run tests to verify they fail**

Run: `cd apps/signal-noise-app && pytest backend/tests/test_persistence_coordinator.py backend/tests/test_entity_pipeline_worker.py backend/tests/test_reconciliation_worker.py -q`
Expected: FAIL because the worker does not exist.

**Step 3: Write minimal implementation**

Implement a small background reconciliation runner that:
- consumes persisted reconciliation metadata
- retries Falkor only
- updates run metadata and operator-visible status
- never overwrites newer canonical Supabase-backed dossiers

**Step 4: Run tests to verify they pass**

Run the same pytest command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/backend/reconciliation_worker.py \
  apps/signal-noise-app/backend/persistence_coordinator.py \
  apps/signal-noise-app/backend/entity_pipeline_worker.py \
  apps/signal-noise-app/backend/tests/test_persistence_coordinator.py \
  apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py \
  apps/signal-noise-app/backend/tests/test_reconciliation_worker.py

git commit -m "feat: add asynchronous falkor reconciliation"
```

### Task 5: Surface self-healing states to operators

**Files:**
- Modify: `apps/signal-noise-app/src/components/entity-dossier/DossierOperatorControls.tsx`
- Modify: `apps/signal-noise-app/src/components/home/HomeQueueDashboard.tsx`
- Modify: `apps/signal-noise-app/src/app/entity-import/[batchId]/[entityId]/page.tsx`
- Modify: `apps/signal-noise-app/src/lib/home-queue-dashboard.ts`
- Test: `apps/signal-noise-app/tests/test-operator-controls-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs`
- Test: `apps/signal-noise-app/tests/test-entity-run-detail.mjs`

**Step 1: Write failing UI contract tests**

Add expectations for:
- `Repairing`
- `Reconciliation pending`
- `Exhausted`
- `Auto-repair queued`
- retry count / budget
- next repair root question

**Step 2: Run tests to verify they fail**

Run: `node --test apps/signal-noise-app/tests/test-operator-controls-contract.mjs apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs apps/signal-noise-app/tests/test-entity-run-detail.mjs`
Expected: FAIL because the UI does not show those states.

**Step 3: Write minimal implementation**

Update the operator surfaces so they distinguish:
- manual repair queued vs auto-repair queued
- degraded published vs reconciling vs healed
- retry budget remaining
- exhausted entities requiring explicit operator review

**Step 4: Run tests to verify they pass**

Run the same node test command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/components/entity-dossier/DossierOperatorControls.tsx \
  apps/signal-noise-app/src/components/home/HomeQueueDashboard.tsx \
  apps/signal-noise-app/src/app/entity-import/[batchId]/[entityId]/page.tsx \
  apps/signal-noise-app/src/lib/home-queue-dashboard.ts \
  apps/signal-noise-app/tests/test-operator-controls-contract.mjs \
  apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs \
  apps/signal-noise-app/tests/test-entity-run-detail.mjs

git commit -m "feat: surface self-healing repair states"
```

### Task 6: Add one narrow operator verification page for self-healing loop state

**Files:**
- Modify: `apps/signal-noise-app/src/app/entity-pipeline/live-repair-verification/page.tsx`
- Test: `apps/signal-noise-app/tests/test-live-repair-verification-page.mjs`

**Step 1: Write the failing test**

Extend the verification page contract to expect:
- retry budget and retry count
- next repair question
- reconciliation state
- exhausted/manual-review fallback when budget is gone

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-live-repair-verification-page.mjs`
Expected: FAIL because the page only shows the current degraded-publication proof.

**Step 3: Write minimal implementation**

Update the page so operators can verify the self-healing loop in one place using the same FC Porto and procurement-led paths.

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/src/app/entity-pipeline/live-repair-verification/page.tsx \
  apps/signal-noise-app/tests/test-live-repair-verification-page.mjs

git commit -m "feat: extend live repair verification page for self-healing state"
```

### Task 7: Add live-safe end-to-end validations

**Files:**
- Create: `apps/signal-noise-app/scripts/verify_self_healing_repair_loop.mjs`
- Test: `apps/signal-noise-app/tests/test-self-healing-verification-script.mjs`

**Step 1: Write the failing test**

Add a contract test requiring a small verification script that:
- fetches canonical dossier API
- fetches rerun API/run detail data
- prints a concise pass/fail checklist for FC Porto and one procurement-led entity

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-self-healing-verification-script.mjs`
Expected: FAIL because the script does not exist.

**Step 3: Write minimal implementation**

Create a script that does read-only verification and clearly prints:
- publication state
- reconciliation state
- next repair state
- blocker-chain status
- whether the entity is still incomplete

**Step 4: Run test to verify it passes**

Run the same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/signal-noise-app/scripts/verify_self_healing_repair_loop.mjs \
  apps/signal-noise-app/tests/test-self-healing-verification-script.mjs

git commit -m "feat: add self-healing repair verification script"
```

### Task 8: Final verification

**Files:**
- No new files required

**Step 1: Run targeted backend tests**

Run:
```bash
cd apps/signal-noise-app && pytest \
  backend/tests/test_pipeline_orchestrator.py \
  backend/tests/test_entity_pipeline_worker.py \
  backend/tests/test_question_first_repair.py \
  backend/tests/test_repair_root_selector.py \
  backend/tests/test_persistence_coordinator.py \
  backend/tests/test_reconciliation_worker.py -q
```
Expected: PASS.

**Step 2: Run targeted frontend/contracts**

Run:
```bash
node --test \
  apps/signal-noise-app/tests/test-entity-pipeline-lifecycle-contract.mjs \
  apps/signal-noise-app/tests/test-operator-controls-contract.mjs \
  apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs \
  apps/signal-noise-app/tests/test-entity-run-detail.mjs \
  apps/signal-noise-app/tests/test-entity-dossier-rerun-dedupe-contract.mjs \
  apps/signal-noise-app/tests/test-live-repair-verification-page.mjs \
  apps/signal-noise-app/tests/test-self-healing-verification-script.mjs
```
Expected: PASS.

**Step 3: Run targeted lint**

Run:
```bash
cd apps/signal-noise-app && npx eslint \
  'src/components/entity-dossier/DossierOperatorControls.tsx' \
  'src/components/home/HomeQueueDashboard.tsx' \
  'src/app/entity-import/[batchId]/[entityId]/page.tsx' \
  'src/lib/home-queue-dashboard.ts' \
  'src/lib/entity-pipeline-lifecycle.ts' \
  'src/app/entity-pipeline/live-repair-verification/page.tsx'
```
Expected: PASS.

**Step 4: Run live-safe verification script**

Run:
```bash
cd apps/signal-noise-app && node scripts/verify_self_healing_repair_loop.mjs
```
Expected:
- FC Porto shows canonical publication plus next self-healing action state
- procurement-led entity shows the same bounded-repair signals
- degraded reconciliation is visible and non-blocking

**Step 5: Commit final verification updates if needed**

```bash
git add -A
git commit -m "test: verify bounded self-healing repair loop"
```
