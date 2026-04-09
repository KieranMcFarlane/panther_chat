# Home Queue Truth And Loop Health Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the home queue dashboard report one coherent source of truth for loop state and expose whether the durable worker loop is actually active, stale, or idle.

**Architecture:** Keep client-ready dossier cards sourced from persisted canonical dossier artifacts, but compute queue lanes and loop counters from the freshest runtime source among Supabase pipeline runs and local diagnostics progress. Treat the published snapshot as a last-resort fallback only, and add explicit loop health fields so UI copy reflects real loop activity instead of hardcoded “active” language.

**Tech Stack:** Next.js, TypeScript, Supabase, local diagnostics JSON artifacts, node:test contract tests.

### Task 1: Lock Dashboard Truth-Source Contracts

**Files:**
- Modify: `apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs`

**Step 1: Write the failing test**

Add assertions that:
- the loader no longer prefers `publishedLoopStatus || ...`
- the loader no longer prefers `publishedQueue || ...`
- the loader computes loop health and/or freshness from runtime timestamps
- the UI renders loop health language instead of always claiming continuous active looping

**Step 2: Run test to verify it fails**

Run: `node --test apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs`
Expected: FAIL on the old snapshot-preference logic and old “Continuous loop active” copy.

### Task 2: Implement Coherent Loader Selection

**Files:**
- Modify: `apps/signal-noise-app/src/lib/home-queue-dashboard.ts`

**Step 1: Add minimal runtime helpers**

Implement helpers to:
- parse timestamps safely
- compute freshness / staleness
- derive a unified queue source choice from:
  - Supabase pipeline runs when recent
  - diagnostics progress and diagnostics queue state when fresher
  - snapshot only when no fresher runtime source exists

**Step 2: Unify counters and queue selection**

Change the payload builder so:
- `loop_status` and `queue` come from the same selected runtime source
- `client_ready_dossiers` / `promoted_dossiers` counts come from the same dossier scan used for dossier cards
- snapshot data is fallback-only, not primary

**Step 3: Add explicit loop health metadata**

Return fields such as:
- `health`: `active | stale | idle`
- `source`: `pipeline_runs | diagnostics | snapshot`
- `last_activity_at`

### Task 3: Make UI Copy Truthful

**Files:**
- Modify: `apps/signal-noise-app/src/components/home/HomeQueueDashboard.tsx`

**Step 1: Update payload typing**

Add the new loop health/source fields to the component payload type.

**Step 2: Replace hardcoded active-language**

Render:
- an “active” badge only when runtime data is fresh
- a “stalled” or “idle” badge otherwise
- supporting copy that names the source and last activity time

### Task 4: Verify Contracts

**Files:**
- Test: `apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs`

**Step 1: Run targeted tests**

Run: `node --test apps/signal-noise-app/tests/test-home-queue-dashboard-contract.mjs`
Expected: PASS

### Task 5: Verify Loop Runtime Prerequisites

**Files:**
- Inspect: `apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Inspect: `apps/signal-noise-app/package.json`

**Step 1: Check worker prerequisites**

Verify:
- local env has Supabase credentials
- FastAPI backend is reachable
- durable worker can run via `npm run worker:entity-pipeline`

**Step 2: Attempt worker restart if environment is ready**

Run the worker only if env and backend prerequisites are satisfied. If not, document the exact blocker and the command that would resume the loop once the backend is available.
