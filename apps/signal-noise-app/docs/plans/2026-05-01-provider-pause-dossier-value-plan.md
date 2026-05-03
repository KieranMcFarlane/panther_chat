# Provider Pause Dossier Value Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the entity pipeline safe while Z.ai is inactive, extract maximum value from existing persisted dossiers, and provide a controlled restart path once the coding plan activates.

**Architecture:** Treat local Postgres as the source of truth. While provider access is blocked, no new entity claims should run; all product work should read from `entity_dossiers`, `graphiti_dossier_ingestions`, and `graphiti_materialized_opportunities`. Once provider access is live, resume only after a smoke test and verify one entity progresses from claim to partial dossier without queue burn.

**Tech Stack:** Next.js API/routes, TypeScript Graphiti opportunity modules, Python durable worker, local Postgres, Node test runner, Pytest.

### Task 1: Lock Provider-Pause Semantics

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/entity_pipeline_worker.py`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/tests/test_entity_pipeline_worker.py`

**Step 1: Write/keep failing test**

Ensure these tests exist:
- `test_process_batch_provider_infrastructure_failure_pauses_without_auto_advance`
- `test_normalize_pipeline_control_state_for_worker_start_preserves_provider_pause`

**Step 2: Run tests**

Run:
```bash
PYTHONPATH=backend pytest -q backend/tests/test_entity_pipeline_worker.py -k "provider_infrastructure_failure_pauses or preserves_provider_pause"
```

Expected: pass after current fix.

**Step 3: Verify live state**

Run:
```bash
node --input-type=commonjs scripts/admin/check-pipeline-provider-pause.cjs
```

If that script does not exist, create it in Task 2.

Expected:
- `is_paused=true`
- `stop_reason=provider_infrastructure_failure`
- `active_runs=0`
- queued rows preserved

### Task 2: Add Provider-Pause Admin Status Script

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/admin/check-pipeline-provider-pause.cjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-provider-pause-admin-contract.mjs`

**Step 1: Write failing contract test**

Test should assert the script:
- Reads `DATABASE_URL` from `.env`.
- Reports `pipeline_control_state`.
- Reports active `running/retrying` count.
- Reports queued count.
- Does not print secrets.

**Step 2: Implement minimal script**

The script should print JSON:
```json
{
  "control": {
    "is_paused": true,
    "stop_reason": "provider_infrastructure_failure"
  },
  "active_runs": 0,
  "queued_runs": 2065,
  "recent_provider_failures": []
}
```

**Step 3: Run tests**

Run:
```bash
node --test tests/test-provider-pause-admin-contract.mjs
```

Expected: pass.

### Task 3: Dossier Inventory and Quality Report

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/admin/report-dossier-quality.cjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-dossier-quality-report-contract.mjs`

**Step 1: Write failing contract test**

Test should assert report fields:
- `canonical_entities_total`
- `persisted_dossier_entities`
- `quality_counts`
- `ingestion_counts`
- `answer_coverage_buckets`
- `top_recent_dossiers`
- `top_commercial_signal_candidates`

**Step 2: Implement report**

Read from:
- `canonical_entities`
- `entity_dossiers`
- `graphiti_dossier_ingestions`
- `graphiti_materialized_opportunities`

Do not mutate data.

**Step 3: Run report**

Run:
```bash
node scripts/admin/report-dossier-quality.cjs
```

Expected:
- It summarizes the current roughly `734` persisted canonical dossier entities.
- It separates failed/provider failures from useful partial/complete dossiers.

### Task 4: Improve Opportunity Diagnostics While Shortlist Stays Conservative

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/graphiti-opportunity-persistence.ts`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/graphiti-opportunity-reasoning.mjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-graphiti-opportunities-dossier-source-contract.mjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-graphiti-opportunity-temporal-reasoning.mjs`

**Step 1: Add tests for demoted watch/context reasons**

Assert demoted rows include:
- `commercial_qualification.status`
- `promotion_reason`
- `blockers`
- `watch_reason`
- `trigger_evidence_count`
- `yp_fit_breakdown`

**Step 2: Implement minimal metadata additions**

Keep default `/api/opportunities` shortlist-only.

Do not promote weak rows just to increase volume.

**Step 3: Run targeted tests**

Run:
```bash
NODE_OPTIONS=--experimental-strip-types node --test \
  tests/test-graphiti-opportunities-dossier-source-contract.mjs \
  tests/test-graphiti-opportunity-temporal-reasoning.mjs
```

Expected: pass.

### Task 5: Add “Reviewable Signals” Diagnostics API

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/api/opportunities/diagnostics/route.ts`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opportunities-diagnostics-contract.mjs`

**Step 1: Write failing API contract test**

The route should return:
- active shortlist count
- watch item count
- context-only count
- failed-only count
- top 20 reviewable watch items with reason and dossier link

**Step 2: Implement read-only route**

Source from `graphiti_materialized_opportunities.raw_payload` and `graphiti_dossier_ingestions`.

**Step 3: Run tests**

Run:
```bash
NODE_OPTIONS=--experimental-strip-types node --test tests/test-opportunities-diagnostics-contract.mjs
```

Expected: pass.

### Task 6: Improve Opportunity Card Strategy Copy

**Files:**
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/lib/graphiti-opportunity-reasoning.mjs`
- Modify: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/app/opportunities/page.tsx`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-opportunities-temporal-ui-contract.mjs`

**Step 1: Add tests for Yellow Panther strategy copy**

For Doncaster-style hiring signal, assert the card includes:
- why this maps to Yellow Panther success
- approach strategy
- buyer route
- verification caveat
- first outreach angle

**Step 2: Implement copy shaping**

Prefer structured `yp_fit_breakdown`:
- `capability_match`
- `buyer_route`
- `outreach_angle`
- `verification_needed`
- `success_rationale`
- `strategy_next_steps`

**Step 3: Run tests**

Run:
```bash
NODE_OPTIONS=--experimental-strip-types node --test tests/test-opportunities-temporal-ui-contract.mjs
```

Expected: pass.

### Task 7: Backfill Existing Dossiers Into Updated Reasoning

**Files:**
- Existing: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/backfill-graphiti-dossier-ingestions.mjs`

**Step 1: Dry-run**

Run:
```bash
node scripts/backfill-graphiti-dossier-ingestions.mjs --limit=5000
```

Expected:
- no active failed-only opportunities
- opportunity shortlist remains conservative

**Step 2: Apply**

Run:
```bash
node scripts/backfill-graphiti-dossier-ingestions.mjs --limit=5000 --apply
```

Expected:
- ingestion ledger refreshed
- opportunities rebuilt from existing dossiers only

**Step 3: Verify API**

Run:
```bash
curl -s http://localhost:3005/api/opportunities | jq '.items | length'
curl -s http://localhost:3005/api/opportunities/diagnostics | jq .
```

Expected:
- default shortlist may still be small
- diagnostics explain what was found and why most rows were demoted

### Task 8: Z.ai Activation Resume Runbook

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/docs/runbooks/zai-provider-resume.md`

**Step 1: Document preflight**

Commands:
```bash
bash scripts/smoke-zai-inference.sh
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/openapi.json | jq '.paths["/api/pipeline/run-entity"]'
```

Expected:
- Z.ai smoke returns `ok=true`
- backend health returns JSON healthy
- route exists

**Step 2: Document resume**

Only after smoke passes:
```bash
node scripts/admin/resume-pipeline-after-provider-activation.cjs
```

If script does not exist, implement in Task 9.

**Step 3: Document watch**

Watch:
- first claimed entity
- q1/q2/q3 checkpoint writes
- partial row in `entity_dossiers`
- no provider failure rows

### Task 9: Safe Resume Script After Provider Activation

**Files:**
- Create: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/admin/resume-pipeline-after-provider-activation.cjs`
- Test: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tests/test-provider-resume-admin-contract.mjs`

**Step 1: Write failing contract test**

Test should assert script requires:
- Z.ai smoke success marker or explicit `--force`.
- Backend route present.
- Current stop reason is `provider_infrastructure_failure`.

**Step 2: Implement minimal script**

It should set:
- `is_paused=false`
- `requested_state=running`
- `observed_state=running`
- clear provider stop fields
- preserve cursor/queued work

**Step 3: Run tests**

Run:
```bash
node --test tests/test-provider-resume-admin-contract.mjs
```

Expected: pass.

### Task 10: One-Entity Resume Verification

**Files:**
- No code unless verification reveals a bug.

**Step 1: Resume after Z.ai activation**

Run:
```bash
bash scripts/smoke-zai-inference.sh
node scripts/admin/resume-pipeline-after-provider-activation.cjs
```

**Step 2: Watch one entity**

Run:
```bash
tail -f tmp/entity-pipeline-worker.log
```

Expected:
- worker claims one queued entity
- status enters `dossier_generation`
- nested checkpoint appears
- partial dossier is persisted before full completion
- worker moves on or remains healthy

**Step 3: Run post-resume checks**

Run:
```bash
node scripts/admin/check-pipeline-provider-pause.cjs
node scripts/admin/report-dossier-quality.cjs
```

Expected:
- provider pause cleared
- active run or recent completion exists
- no new provider infrastructure failures

### Task 11: Commit

**Files:**
- Stage only intentional source/test/docs changes.
- Do not stage runtime artifacts:
  - `.tmp-graphiti-opportunity-tsconfig.tsbuildinfo`
  - `backend/backend/data/`
  - root `backend/`
  - root `tmp/`

**Step 1: Check status**

Run:
```bash
git status --short
```

**Step 2: Run final focused tests**

Run:
```bash
PYTHONPATH=backend pytest -q backend/tests/test_entity_pipeline_worker.py -k "provider_infrastructure_failure or provider_pause or timeout"
NODE_OPTIONS=--experimental-strip-types node --test \
  tests/test-zai-smoke-contract.mjs \
  tests/test-graphiti-dossier-ingestion-contract.mjs \
  tests/test-graphiti-opportunities-dossier-source-contract.mjs \
  tests/test-graphiti-opportunity-temporal-reasoning.mjs \
  tests/test-opportunities-temporal-ui-contract.mjs \
  tests/test-home-queue-dashboard-contract.mjs \
  tests/test-pipeline-runtime-state.mjs
```

**Step 3: Commit**

Run:
```bash
git add backend/entity_pipeline_worker.py backend/tests/test_entity_pipeline_worker.py scripts/smoke-zai-inference.sh tests/test-zai-smoke-contract.mjs docs/plans/2026-05-01-provider-pause-dossier-value-plan.md
git commit -m "Protect pipeline during provider activation delay"
```
