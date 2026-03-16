# Snapshot Merge Wave Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the highest-value, low-risk reliability commits from `codex/worktree-snapshot-20260312` into `main` without regressions.

**Architecture:** Use strict per-commit cherry-pick validation. Apply one candidate commit at a time onto `codex/snapshot-wave-20260316` (tracking `main`), run targeted backend tests for affected modules, and only keep commits that pass. If a cherry-pick causes heavy conflicts or test regressions, skip and move to next candidate.

**Tech Stack:** Git, Python backend tests (`pytest`), BrightData client, Chutes client.

### Task 1: Candidate A (`07221f4`) BrightData JS extraction + Chutes fallback handling

**Files:**
- Modify: `apps/signal-noise-app/backend/brightdata_sdk_client.py`
- Modify: `apps/signal-noise-app/backend/claude_client.py`
- Modify: `apps/signal-noise-app/backend/hypothesis_driven_discovery.py`
- Test: `apps/signal-noise-app/backend/tests/test_brightdata_serp_async_and_templates.py`
- Test: `apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`
- Test: `apps/signal-noise-app/backend/tests/test_discovery_url_resolution_fallbacks.py`

**Step 1:** Cherry-pick `07221f4` with conflict resolution preserving current-main behavior when uncertain.

**Step 2:** Run tests:
- `pytest -q apps/signal-noise-app/backend/tests/test_brightdata_serp_async_and_templates.py`
- `pytest -q apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`
- `pytest -q apps/signal-noise-app/backend/tests/test_discovery_url_resolution_fallbacks.py`

**Step 3:** If tests pass, keep commit. If not, revert and mark as rejected.

### Task 2: Candidate B (`0f239f2`) jittered Chutes retry backoff

**Files:**
- Modify: `apps/signal-noise-app/backend/claude_client.py`
- Test: `apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`

**Step 1:** Cherry-pick `0f239f2`.

**Step 2:** Run tests:
- `pytest -q apps/signal-noise-app/backend/tests/test_claude_client_chutes.py`

**Step 3:** Keep only if green.

### Task 3: Candidate C (`bb68b82`) template restore + async SERP result handling

**Files:**
- Modify: `apps/signal-noise-app/backend/*` (inspect exact set during cherry-pick)
- Test: `apps/signal-noise-app/backend/tests/test_brightdata_serp_async_and_templates.py`
- Test: `apps/signal-noise-app/backend/tests/test_dossier_*` (targeted based on changed files)

**Step 1:** Cherry-pick `bb68b82`.

**Step 2:** Run targeted tests for changed modules.

**Step 3:** Keep only if green.

### Task 4: Integrate to main

**Files:**
- No direct code edits expected.

**Step 1:** Compare branch against `main` and summarize accepted commits.

**Step 2:** Merge `codex/snapshot-wave-20260316` to `main` with `--no-ff`.

**Step 3:** Push `main` and verify `origin/main` matches.
