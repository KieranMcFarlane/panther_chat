# Phase0 Reliability Salvage Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Salvage missing phase0 reliability features from `codex/phase0-reliability-optimizations` into `main` without dropping requested capabilities.

**Architecture:** Use a recency-biased, feature-bucket cherry-pick sequence from `codex/phase0-reliability-optimizations` onto a staging branch from `main`. Apply core worker/UI features first, then discovery quality hardening, then congruence/audit gates. Validate after each bucket.

**Tech Stack:** Git, Next.js app routes/components, Python backend pipeline workers, pytest, npm lint/tests.

## Source-Of-Truth Branch

- Primary source: `codex/phase0-reliability-optimizations`
- Secondary only for no-workflow variants: `codex/phase0-reliability-optimizations-no-workflow`

## Bucket A: Async import queueing + single-entity durable worker + progress metadata

### Task A1: Create staging branch from main

**Step 1:**
Run: `git switch main && git pull --ff-only`

**Step 2:**
Run: `git switch -c codex/salvage-phase0-main`

### Task A2: Cherry-pick core commits in dependency order

**Step 1:**
Run:

```bash
git cherry-pick -x \
  edcca2a \
  521b149 \
  f5d946d \
  42c0786 \
  ee52c10 \
  a4248ec \
  c497c9b \
  cb015c0 \
  3f3d4cb \
  1250ef9 \
  0df0b56 \
  e34a039
```

### Task A3: Verify bucket A

**Step 1:**
Run: `npm --prefix apps/signal-noise-app run lint:full`

**Step 2:**
Run: `pytest apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py -q`

**Step 3:**
Run: `pytest apps/signal-noise-app/backend/tests/test_discovery_progress_reporting.py -q`

## Bucket B: Discovery cache/perf + federation template/hop tuning + official-site hardening

### Task B1: Cherry-pick discovery quality commits

**Step 1:**
Run:

```bash
git cherry-pick -x \
  2c29866 \
  b0eb92b \
  13d9344 \
  4cf79af \
  a9ed650 \
  7251b36 \
  3ab66f7 \
  2fc4803 \
  ad24491 \
  374f146
```

### Task B2: Verify bucket B

**Step 1:**
Run: `pytest apps/signal-noise-app/backend/tests/test_discovery_url_resolution_fallbacks.py -q`

**Step 2:**
Run: `pytest apps/signal-noise-app/backend/tests/test_dossier_data_collector_seed.py -q`

**Step 3:**
Run: `pytest apps/signal-noise-app/backend/tests/test_official_site_resolver.py -q`

## Bucket C: Congruence/audit/remediation gates

### Task C1: Choose one variant

**Option 1 (recommended):** workflow-enabled commits from `phase0`.

```bash
git cherry-pick -x 0e25a2b 4744c6c 3d077c1
```

**Option 2:** no-workflow variant from `phase0-reliability-optimizations-no-workflow`.

```bash
git cherry-pick -x 75b4b40 8c43bb5 bc4a5df
```

### Task C2: Verify bucket C

**Step 1:**
Run: `npm --prefix apps/signal-noise-app run lint:full`

**Step 2:**
Run: `node apps/signal-noise-app/scripts/qa-entity-congruence-audit.mjs --help`

## Final Verification

### Task D1: Pipeline smoke checks

**Step 1:**
Run: `pytest apps/signal-noise-app/backend/tests/test_dossier_phase0_runtime.py -q`

**Step 2:**
Run: `bash apps/signal-noise-app/scripts/check-pipeline-runtime.sh`

**Step 3:**
Run: `PYTHONPATH=apps/signal-noise-app/backend python3 apps/signal-noise-app/run_fixed_dossier_pipeline.py`

## Merge and Cleanup

### Task E1: Merge

**Step 1:**
Run: `git switch main`

**Step 2:**
Run: `git merge --no-ff codex/salvage-phase0-main`

**Step 3:**
Run: `git push origin main`

### Task E2: Branch deletion (only after verification)

**Step 1:**
Run: `git branch -d codex/phase0-reliability-optimizations`

**Step 2:**
Run: `git push origin --delete codex/phase0-reliability-optimizations`

**Step 3:**
If no-workflow commits were not used, keep `codex/phase0-reliability-optimizations-no-workflow` until a final parity check is completed.
