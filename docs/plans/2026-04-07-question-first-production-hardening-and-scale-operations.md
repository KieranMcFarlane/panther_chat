# Question-First Production Hardening And Scale Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the five-question question-first system so it can run larger batches reliably, measure quality drift, and support rerun/backfill operations without depending on experimental connections enrichment.

**Architecture:** Keep the current five-question pipeline as the baseline path and make all non-core enrichments explicitly optional. Extend the existing smoke and dossier runners with stronger batch controls, persistent run summaries, rerun/backfill entrypoints, and cleaner transport behavior. Improve only the weakest remaining core question family where scale evidence shows a real gap: `q3_procurement_signal`.

**Tech Stack:** Python, Node.js, pytest, node:test, BrightData MCP stdio transport, JSON run artifacts, markdown run summaries.

## Baseline Assumptions

- Current baseline is documented in:
  - `docs/plans/2026-04-06-question-first-stable-baseline.md`
  - `docs/plans/2026-04-06-question-first-current-state.md`
  - `docs/plans/2026-04-06-question-first-10-entity-scale-results.md`
  - `docs/plans/2026-04-06-connections-telemetry-result.md`
- The current core path is:
  - `apps/signal-noise-app/backend/universal_atomic_matrix.py`
  - `apps/signal-noise-app/backend/question_first_dossier_runner.py`
  - `apps/signal-noise-app/backend/question_first_archetype_smoke.py`
  - `apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- `connections_graph` enrichment is now optional and should remain outside baseline success criteria.

## Success Criteria

- A `25`-entity mixed batch completes with:
  - `entities_completed >= 25`
  - `entities_failed == 0`
  - `q1_foundation >= 90% validated`
  - `q2_digital_stack >= 90% validated`
  - `q3_procurement_signal >= 85% validated`
  - `q4_decision_owner >= 90% validated`
  - `q5_related_pois >= 90% validated`
- Baseline runs do not require `connections_graph` enrichment.
- Failed entities and failed questions can be rerun without reprocessing the full batch.
- Batch output includes durable metrics for quality, runtime, and transport-health review.
- BrightData transport shutdown noise is either fixed or isolated so it does not pollute baseline operations.

---

### Task 1: Freeze The Baseline / Experimental Split

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Modify: `apps/signal-noise-app/backend/question_first_archetype_smoke.py`
- Modify: `apps/signal-noise-app/backend/pipeline_orchestrator.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py`
- Test: `apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py`

**Step 1: Write the failing tests**

Add tests that prove:
- baseline dossier runs do not enable connections enrichment unless explicitly requested
- smoke runs mark enrichment as optional metadata, not a pass/fail dependency
- orchestrator paths preserve that default

**Step 2: Run tests to verify they fail**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py -q
```

Expected: at least one failure around default enrichment behavior.

**Step 3: Write the minimal implementation**

Implement:
- explicit baseline default: `connections enrichment = disabled`
- explicit opt-in path through env/config/CLI
- summary fields that record whether enrichment was enabled

**Step 4: Run tests to verify they pass**

Run the same pytest command.

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  apps/signal-noise-app/backend/question_first_dossier_runner.py \
  apps/signal-noise-app/backend/question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/pipeline_orchestrator.py \
  apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/tests/test_pipeline_orchestrator.py
git commit -m "feat(question-first): make enrichment opt-in for baseline runs"
```

---

### Task 2: Add Durable Batch Metrics

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_archetype_smoke.py`
- Modify: `apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Possibly modify: `apps/signal-noise-app/backend/question_first_promoter.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py`

**Step 1: Write the failing tests**

Add tests that require smoke outputs to include:
- per-question validation totals
- per-entity runtime totals
- per-entity-type validation totals
- deterministic vs retrieval counts where available
- enrichment-enabled flag

**Step 2: Run tests to verify they fail**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py -q
```

Expected: FAIL on missing summary keys.

**Step 3: Write the minimal implementation**

Extend smoke summary generation so the top-level JSON includes:
- `entity_runtime_seconds`
- `question_runtime_seconds`
- `validation_by_question`
- `validation_by_entity_type`
- `deterministic_path_counts`
- `retrieval_path_counts`
- `baseline_features`

Keep the markdown summary human-readable and aligned with the JSON.

**Step 4: Run tests to verify they pass**

Run the same pytest command.

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  apps/signal-noise-app/backend/question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/question_first_dossier_runner.py \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/tests/test_question_first_dossier_runner.py
git commit -m "feat(question-first): add durable batch metrics"
```

---

### Task 3: Build Rerun And Backfill Entry Points

**Files:**
- Modify: `apps/signal-noise-app/backend/question_first_archetype_smoke.py`
- Modify: `apps/signal-noise-app/backend/question_first_dossier_runner.py`
- Create or modify: `apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py`

**Step 1: Write the failing tests**

Add tests for:
- rerun only failed entities from a previous summary
- rerun only failed questions for one entity
- skip entities with complete fresh artifacts
- backfill dossiers when a run artifact exists but the dossier is missing

**Step 2: Run tests to verify they fail**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py -q
```

Expected: FAIL because the selectors or modes do not exist yet.

**Step 3: Write the minimal implementation**

Add CLI options such as:
- `--rerun-failed-from <summary.json>`
- `--rerun-entity <entity-id>`
- `--rerun-question <q_id>`
- `--backfill-dossiers-from <summary.json>`
- `--skip-complete`

Use the existing artifact layout instead of inventing a new store.

**Step 4: Run tests to verify they pass**

Run the same pytest command.

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  apps/signal-noise-app/backend/question_first_archetype_smoke.py \
  apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py
git commit -m "feat(question-first): add rerun and backfill modes"
```

---

### Task 4: Harden `q3_procurement_signal`

**Files:**
- Modify: `apps/signal-noise-app/backend/universal_atomic_matrix.py`
- Modify: `apps/signal-noise-app/scripts/opencode_agentic_batch.mjs`
- Modify canonical sources only if expected: `apps/signal-noise-app/backend/data/question_sources/*.json`
- Test: `apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py`
- Test: `apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py`
- Test: `apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs`

**Step 1: Write the failing tests**

Target the exact current weak cases:
- weaker clubs with commercial-partner-only signals
- specialized federations with tender/doc surfaces
- leagues with partner/broadcast/data/platform signals

Add tests that require:
- stable entity-type-specific `q3` search strategies
- no regression on the existing stable archetypes

**Step 2: Run tests to verify they fail**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py \
  apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py -q
node --test apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
```

Expected: FAIL on the new `q3` expectations.

**Step 3: Write the minimal implementation**

Make `q3` more operationally stable by:
- preserving entity-type-specific query sets
- explicitly separating:
  - club commercial-partnership path
  - federation tender/docs path
  - league platform/broadcast/data path
- tightening stop conditions so usable ecosystem evidence is not overwritten by later timeouts

Do not expand the five-question schema. Keep the external contract unchanged.

**Step 4: Run tests to verify they pass**

Run the same pytest and node:test commands.

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  apps/signal-noise-app/backend/universal_atomic_matrix.py \
  apps/signal-noise-app/scripts/opencode_agentic_batch.mjs \
  apps/signal-noise-app/backend/data/question_sources/*.json \
  apps/signal-noise-app/backend/tests/test_universal_atomic_matrix.py \
  apps/signal-noise-app/backend/tests/test_universal_atomic_matrix_sources.py \
  apps/signal-noise-app/tests/test-opencode-agentic-batch.mjs
git commit -m "feat(question-first): harden q3 procurement signal"
```

---

### Task 5: Fix Or Contain BrightData MCP Shutdown Noise

**Files:**
- Modify: `apps/signal-noise-app/backend/brightdata_mcp_client.py`
- Test: `apps/signal-noise-app/backend/tests/test_brightdata_mcp_client.py`
- Test: `apps/signal-noise-app/backend/tests/test_brightdata_client_factory.py`
- Test if needed: `apps/signal-noise-app/backend/tests/test_brightdata_mcp_client_hosted.py`

**Step 1: Write the failing test**

Reproduce the observed shutdown error:
- create and close the stdio client in the same way the dossier runner does
- assert shutdown completes without cross-task cancel-scope exceptions

**Step 2: Run test to verify it fails**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_brightdata_mcp_client.py \
  apps/signal-noise-app/backend/tests/test_brightdata_client_factory.py -q
```

Expected: FAIL or missing reproduction coverage.

**Step 3: Write the minimal implementation**

Fix or contain:
- async transport cleanup ordering
- session close idempotence
- cross-task teardown misuse

If a full fix is risky, contain the noise and surface it as structured warning output instead of an unhandled runtime exception.

**Step 4: Run tests to verify they pass**

Run the same pytest command.

Expected: PASS.

**Step 5: Commit**

```bash
git add \
  apps/signal-noise-app/backend/brightdata_mcp_client.py \
  apps/signal-noise-app/backend/tests/test_brightdata_mcp_client.py \
  apps/signal-noise-app/backend/tests/test_brightdata_client_factory.py \
  apps/signal-noise-app/backend/tests/test_brightdata_mcp_client_hosted.py
git commit -m "fix(brightdata): clean stdio shutdown behavior"
```

---

### Task 6: Define And Run The 25-Entity Control Batch

**Files:**
- Create: `apps/signal-noise-app/backend/data/question_first_scale_batch_25.json`
- Create: `docs/plans/2026-04-07-question-first-25-entity-scale-plan.md`
- Possibly modify: `apps/signal-noise-app/backend/question_first_archetype_smoke.py`
- Test: `apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py`

**Step 1: Write the failing test**

Add a smoke test for manifest loading against a `25`-entity manifest shape if needed, or extend the existing manifest-driven coverage.

**Step 2: Run test to verify it fails**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 -m pytest \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py -q
```

Expected: FAIL only if new manifest behaviors are added.

**Step 3: Write the minimal implementation**

Create:
- a mixed `25`-entity manifest
- a short plan doc with:
  - cohort composition
  - success gates
  - stop conditions
  - expected metrics review

Reuse the existing manifest-driven runner.

**Step 4: Run test to verify it passes**

Run the same pytest command.

Expected: PASS.

**Step 5: Execute the batch**

Run:

```bash
PYTHONPATH=apps/signal-noise-app python3 \
  apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py \
  --batch-manifest apps/signal-noise-app/backend/data/question_first_scale_batch_25.json \
  --output-root /tmp/question-first-scale-batch-25
```

Expected:
- batch completes
- summary JSON and markdown are written
- no entity-level wrapper failures

**Step 6: Commit**

```bash
git add \
  apps/signal-noise-app/backend/data/question_first_scale_batch_25.json \
  docs/plans/2026-04-07-question-first-25-entity-scale-plan.md \
  apps/signal-noise-app/backend/tests/test_question_first_archetype_smoke.py
git commit -m "docs(question-first): define 25-entity control batch"
```

---

### Task 7: Record The Operational Baseline After 25 Entities

**Files:**
- Create: `docs/plans/2026-04-07-question-first-25-entity-scale-results.md`
- Reference: `/tmp/question-first-scale-batch-25/question_first_archetype_smoke.json`

**Step 1: Capture the completed batch metrics**

Record:
- completion/failure totals
- per-question validation totals
- by-entity-type totals
- runtime distribution
- rerun/backfill observations
- any BrightData transport warnings

**Step 2: Write the results note**

Keep it short and operational:
- what held
- what regressed
- what changed from the 10-entity baseline
- whether the system is ready for the next scale tier

**Step 3: Commit**

```bash
git add docs/plans/2026-04-07-question-first-25-entity-scale-results.md
git commit -m "docs(question-first): record 25-entity control batch"
```

---

## Execution Order

Do not reorder casually. The intended sequence is:

1. Freeze baseline vs experimental behavior.
2. Add durable batch metrics.
3. Add rerun/backfill modes.
4. Harden `q3`.
5. Fix or contain BrightData shutdown noise.
6. Define and run the `25`-entity control batch.
7. Record the resulting operational baseline.

## Non-Goals

Do not spend this hardening pass on:
- new question families
- broader dossier redesign
- warm-path/connection heuristic tuning
- replacing the artifact layout with a database

Those are separate tracks.

## Final Acceptance Gate

The hardening pass is complete only if:
- the `25`-entity control batch finishes cleanly
- baseline runs no longer depend on experimental enrichment
- rerun/backfill workflows exist and are tested
- `q3` reaches the target validation rate without degrading `q1`, `q2`, `q4`, or `q5`
- BrightData transport cleanup no longer pollutes normal baseline runs
