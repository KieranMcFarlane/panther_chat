# Pipeline Stabilization And E2E Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stabilize the large uncommitted working tree without regressions, then prove end-to-end pipeline execution from Phase 0 through final scoring on the current runtime stack.

**Architecture:** Use a staged integration flow: first isolate and classify changes, then enforce guardrails and fast tests, then run a controlled live pipeline smoke with deterministic diagnostics capture. Keep risky moves reversible by using small commits and explicit validation after each slice.

**Tech Stack:** Next.js (App Router), Python backend worker/API, Supabase, FalkorDB, Chutes OpenAI-compatible streaming, pytest + node test.

### Task 1: Establish Controlled Baseline

**Files:**
- Modify: `docs/plans/2026-03-10-pipeline-stabilization-and-e2e-validation.md` (mark progress notes)
- Create: `docs/plans/2026-03-10-working-tree-inventory.md`

**Step 1: Capture current git and runtime baseline**

Run:
```bash
git status --short > /tmp/pipeline_status_before.txt
git log --oneline -n 20 > /tmp/pipeline_log_before.txt
```

Expected: command success and baseline snapshots written.

**Step 2: Generate categorized inventory of changed files**

Run:
```bash
python - <<'PY'
from pathlib import Path
import subprocess
root = Path(".")
out = subprocess.check_output(["git","status","--short"], text=True)
lines = [l for l in out.splitlines() if l.strip()]
groups = {"api":[],"ui":[],"backend":[],"tests":[],"docs":[],"scripts":[],"other":[]}
for l in lines:
    p = l[3:]
    if "/src/app/api/" in p: groups["api"].append(l)
    elif "/src/" in p: groups["ui"].append(l)
    elif "/backend/" in p: groups["backend"].append(l)
    elif "/tests/" in p: groups["tests"].append(l)
    elif "/docs/" in p: groups["docs"].append(l)
    elif "/scripts/" in p or p.endswith(".sh"): groups["scripts"].append(l)
    else: groups["other"].append(l)
body = ["# Working Tree Inventory", ""]
for k,v in groups.items():
    body += [f"## {k} ({len(v)})"] + (v or ["(none)"]) + [""]
Path("docs/plans/2026-03-10-working-tree-inventory.md").write_text("\n".join(body))
PY
```

Expected: inventory file created with grouped changes.

**Step 3: Commit planning artifacts only**

Run:
```bash
git add docs/plans/2026-03-10-pipeline-stabilization-and-e2e-validation.md docs/plans/2026-03-10-working-tree-inventory.md
git commit -m "docs: add stabilization and e2e validation execution plan"
```

Expected: single docs-only commit.

### Task 2: Separate Generated Noise From Active Code

**Files:**
- Modify: `.gitignore`
- Modify: `apps/signal-noise-app/.gitignore`
- Create: `docs/plans/2026-03-10-generated-artifacts-boundary.md`

**Step 1: Write failing guard for generated artifact drift**

Create/update test:
`tests/test-build-noise-guards.mjs`

Add assertion set for active-repo denylist:
- `.next.preclean*`
- `.pytest_cache/`
- `.venv*`
- `backend/data/dossiers/*` (except explicit fixture directories)

**Step 2: Run test to verify failure (if denylist currently missing)**

Run:
```bash
node --test tests/test-build-noise-guards.mjs
```

Expected: fail if guard not enforcing current denylist.

**Step 3: Minimal implementation**

Update `.gitignore` and `apps/signal-noise-app/.gitignore` with exact patterns required by the guard.

**Step 4: Re-run guard test**

Run:
```bash
node --test tests/test-build-noise-guards.mjs
```

Expected: PASS.

**Step 5: Commit**

Run:
```bash
git add .gitignore apps/signal-noise-app/.gitignore tests/test-build-noise-guards.mjs docs/plans/2026-03-10-generated-artifacts-boundary.md
git commit -m "chore: enforce generated artifact boundaries"
```

### Task 3: Lock Active Graph Contract Surfaces

**Files:**
- Modify: `tests/test-falkordb-graph-rewire.mjs`
- Modify: `src/lib/graph-id.ts`
- Modify: `src/app/api/entities/route.ts`
- Modify: `src/app/api/graph/relationships/route.ts`

**Step 1: Add failing assertions for active contract**

In `tests/test-falkordb-graph-rewire.mjs`, assert active runtime/API files do not emit:
- `neo4j_id`
- `source_neo4j_id`
- `target_neo4j_id`
outside approved compatibility helper paths.

**Step 2: Run targeted guard**

Run:
```bash
node --test tests/test-falkordb-graph-rewire.mjs
```

Expected: failures identify remaining active leaks.

**Step 3: Implement minimal runtime fixes**

Adjust API mappers and route serializers to emit only graph fields:
- `graph_id`
- `source_graph_id`
- `target_graph_id`

Keep dual-read fallback in `src/lib/graph-id.ts` only.

**Step 4: Re-run guard**

Run:
```bash
node --test tests/test-falkordb-graph-rewire.mjs
```

Expected: PASS.

**Step 5: Commit**

Run:
```bash
git add tests/test-falkordb-graph-rewire.mjs src/lib/graph-id.ts src/app/api/entities/route.ts src/app/api/graph/relationships/route.ts
git commit -m "refactor: enforce graph-id-only runtime contracts"
```

### Task 4: Stabilize Entity Browser Discovery Performance Path

**Files:**
- Modify: `src/app/api/entities/search/route.ts`
- Modify: `src/app/api/entities/taxonomy/route.ts`
- Modify: `src/app/entity-browser/client-page.tsx`
- Test: `tests/test-entity-lookup-filters.mjs`
- Test: `tests/test-feedback-remediation-contracts.mjs`

**Step 1: Add failing tests for fast-first-page behavior**

Add assertions:
- default returns bounded payload size
- supports autocomplete endpoint behavior
- supports vector-backed search fallback behavior contract
- first page default sorted by popularity signal

**Step 2: Run tests to confirm failure**

Run:
```bash
node --test tests/test-entity-lookup-filters.mjs tests/test-feedback-remediation-contracts.mjs
```

Expected: fail on missing/default behavior.

**Step 3: Implement minimal API/UI contract fixes**

- Enforce strict default `limit` for first load.
- Return `has_more`, `total_estimate`, and `latency_ms` metadata.
- Wire UI search input to autocomplete endpoint and deferred query trigger.
- Keep full result fetch only after explicit filter/apply action.

**Step 4: Re-run tests**

Run:
```bash
node --test tests/test-entity-lookup-filters.mjs tests/test-feedback-remediation-contracts.mjs
```

Expected: PASS.

**Step 5: Commit**

Run:
```bash
git add src/app/api/entities/search/route.ts src/app/api/entities/taxonomy/route.ts src/app/entity-browser/client-page.tsx tests/test-entity-lookup-filters.mjs tests/test-feedback-remediation-contracts.mjs
git commit -m "feat: optimize entity browser first-load and discovery contracts"
```

### Task 5: Re-verify Chutes Streaming + Dossier Final JSON Determinism

**Files:**
- Modify: `backend/tests/test_claude_client_chutes.py` (only if needed)
- Modify: `backend/tests/test_dossier_generator_timeout.py` (only if needed)

**Step 1: Run canonical cutover test suite**

Run:
```bash
pytest backend/tests/test_claude_client_chutes.py backend/tests/test_dossier_generator_timeout.py backend/tests/test_pipeline_phase_update_payload.py -q
```

Expected: PASS.

**Step 2: If failing, apply minimal fix in impacted backend file only**

Likely files:
- `backend/claude_client.py`
- `backend/dossier_generator.py`
- `backend/main.py`

**Step 3: Re-run suite**

Run same pytest command above.

Expected: PASS with no new failures.

**Step 4: Commit (only if code changed)**

Run:
```bash
git add backend/claude_client.py backend/dossier_generator.py backend/main.py backend/tests/test_claude_client_chutes.py backend/tests/test_dossier_generator_timeout.py backend/tests/test_pipeline_phase_update_payload.py
git commit -m "fix: preserve chutes streaming and final-json dossier guarantees"
```

### Task 6: Full Runtime Smoke (Phase 0 To Final)

**Files:**
- Create: `docs/plans/2026-03-10-e2e-smoke-results.md`

**Step 1: Ensure runtime processes are up**

Run:
```bash
cd apps/signal-noise-app
npm run dev
```
and in separate terminals:
```bash
cd apps/signal-noise-app/backend
python main.py
python entity_pipeline_worker.py
```

Expected: app/API/worker healthy.

**Step 2: Trigger one controlled pipeline run**

Run:
```bash
curl -sS -X POST http://localhost:8000/entity-pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"entity_name":"pipeline-smoke-2026-03-10","mode":"premium"}'
```

Expected: run id returned.

**Step 3: Poll until completion and capture phase transitions**

Run:
```bash
curl -sS "http://localhost:8000/entity-pipeline/status/<RUN_ID>"
```

Expected: reaches final phase (`dashboard_scoring` or equivalent terminal success).

**Step 4: Validate dossier metadata includes streaming diagnostics**

Confirm response or persisted run metadata includes:
- `streaming`
- `model_used`
- `fallback_used`
- `chunk_count`
- `answer_channel_chars`
- `reasoning_channel_chars`

**Step 5: Record results and commit**

Write outcomes to:
`docs/plans/2026-03-10-e2e-smoke-results.md`

Then:
```bash
git add docs/plans/2026-03-10-e2e-smoke-results.md
git commit -m "docs: record phase0-to-final e2e smoke validation"
```

### Task 7: Final Verification Gate

**Files:**
- No code changes expected

**Step 1: Run regression gate**

Run:
```bash
node --test tests/test-falkordb-graph-rewire.mjs tests/test-feedback-remediation-contracts.mjs
pytest backend/tests/test_entity_pipeline_worker.py backend/tests/test_dossier_phase0_runtime.py -q
```

Expected: all PASS.

**Step 2: Run type/lint build checks**

Run:
```bash
npm run lint
npm run build
```

Expected: clean build and lint.

**Step 3: Commit any final tiny fixes**

Run:
```bash
git add -A
git commit -m "chore: final stabilization fixes after regression gate"
```

(Skip if no diffs.)

### Task 8: Release-Ready Handoff

**Files:**
- Modify: `docs/README.md`
- Create: `docs/plans/2026-03-10-stabilization-handoff.md`

**Step 1: Document active known risks and mitigations**

Include:
- open risks
- rollback point (commit hash)
- required env keys
- smoke command sequence

**Step 2: Update README operational section**

Add short “local pipeline verification” runbook with exact commands.

**Step 3: Commit handoff docs**

Run:
```bash
git add docs/README.md docs/plans/2026-03-10-stabilization-handoff.md
git commit -m "docs: add stabilization handoff and local verification runbook"
```

## Definition of Done

- Active graph/runtime surfaces are graph-id aligned with legacy fallback isolated.
- Generated/noisy artifacts are excluded from active repo workflows.
- Entity browser first-load and filter/search contracts are performance-safe and tested.
- Chutes streaming + final JSON dossier parsing remains green in tests.
- One real pipeline run completes from Phase 0 through final phase with diagnostics captured.
- Regression, lint, and build gates pass on the integrated working tree.
