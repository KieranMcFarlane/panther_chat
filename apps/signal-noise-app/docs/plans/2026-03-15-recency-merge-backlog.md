# Recency Backlog Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the remaining unique work from `codex/phase0-reliability-optimizations`, `codex/phase0-reliability-optimizations-no-workflow`, and `codex/worktree-snapshot-20260312` into `main` with recency-first conflict resolution and stable gates.

**Architecture:** Use `main` as the only integration lane and apply small cherry-pick waves in descending recency and risk. Prefer newer valid behavior, keep stale/deleted surfaces deleted, and stop after each wave for verification. Snapshot branch is salvage-only and only used when a patch is unique and not superseded.

**Tech Stack:** Git cherry-pick workflow, Node import/lint gates, Python pytest/compile gates, BrightData hello smoke.

## Scope Rules

1. Precedence rules:
- Newest valid commit wins by hunk.
- Tie-breaker: `codex/phase0-reliability-optimizations` > `codex/phase0-reliability-optimizations-no-workflow`.
- Keep deleted legacy/stale test surfaces deleted unless explicitly reintroduced as part of active runtime behavior.

2. Hard exclusions:
- Bulk migration of baseline-monitoring architecture until constructor/API contracts are aligned in a dedicated wave.
- Any commit that reintroduces archived/demo surfaces.

3. Hard inclusions:
- Phase-0 reliability, timeout/retry correctness, official-site/discovery signal quality, and chutes/brightdata runtime hardening.

## Global Gate (run after every wave)

1. `cd apps/signal-noise-app && npm run qa:imports`
2. `cd apps/signal-noise-app && python3 -m py_compile backend/main.py backend/claude_client.py backend/dossier_generator.py`
3. `cd apps/signal-noise-app && PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py backend/tests/test_dossier_generator_timeout_fallback.py -q`
4. `cd apps/signal-noise-app && PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`
5. `cd apps/signal-noise-app && PYTHONPATH=backend .venv-codex/bin/python scripts/check-brightdata-hello.py`

Expected:
- No new import/compile errors.
- Timeout + worker suites remain green.
- BrightData hello check returns success for env/search/scrape (search may use fallback, scrape must remain successful).

## Wave Plan

### Task 1: Build fresh candidate inventory

**Files:**
- Modify: `apps/signal-noise-app/docs/reports/2026-03-15-recency-merge-log.md`

**Step 1: Generate candidate list**
- Run:
```bash
git cherry -v main codex/phase0-reliability-optimizations > /tmp/wave_phase0.txt
git cherry -v main codex/phase0-reliability-optimizations-no-workflow > /tmp/wave_nowf.txt
git cherry -v main codex/worktree-snapshot-20260312 > /tmp/wave_snapshot.txt
```

**Step 2: Build unique shortlist**
- Keep only `+` entries.
- Remove obvious duplicates by subject and patch-id.

**Step 3: Commit log update**
- Add shortlist summary to merge log.

### Task 2: Reliability wave A (low-risk runtime)

**Target commit themes:**
- Timeout/retry hardening.
- Chutes request failure transparency.
- Dossier generation resilience with fallback continuity.

**Step 1: Cherry-pick 1-2 commits**
- Run one-by-one:
```bash
git cherry-pick <sha>
```

**Step 2: Resolve conflicts**
- Keep current stabilized `dossier_generator.py` behavior unless incoming hunk is strictly additive and tested.
- Keep stale `test_pipeline_phase_update_payload.py` deleted.

**Step 3: Run Global Gate**

**Step 4: Commit**
- If additional reconciliation was needed:
```bash
git add <files>
git commit -m "fix(merge): reconcile <component> recency wave A"
```

### Task 3: Discovery quality wave B (official-site/path hardening)

**Target commit themes:**
- Official-site lane ranking.
- Domain poisoning guards.
- Discovery parsing structured payload precedence.

**Step 1: Cherry-pick one commit**

**Step 2: If conflict in discovery + dossier overlap**
- Prefer logic already validated by existing timeout/fallback tests.
- Add minimal regression tests for new behavior.

**Step 3: Run Global Gate**

### Task 4: Runtime transport wave C (Chutes transport/streaming)

**Target commit themes:**
- Streaming transport.
- Final JSON block extraction/parsing diagnostics.

**Step 1: Cherry-pick**

**Step 2: Conflict resolution policy**
- Keep incoming `claude_client.py` transport/parsing where it does not break existing timeout-mode expectations.
- Preserve stable run-entity timeout mode semantics and test assumptions.

**Step 3: Run Global Gate**

### Task 5: Baseline-monitoring architecture wave D (deferred/high risk)

**Precondition:** only start when previous waves are stable and test harness can support baseline module contracts.

**Step 1: Add compatibility shim tests first**
- Introduce targeted tests for `PipelineOrchestrator` constructor contract used by `main.py`.

**Step 2: Cherry-pick one baseline-monitoring commit at a time**

**Step 3: Resolve API drift immediately**
- If constructor mismatch occurs, patch either orchestrator adapter or call site within same wave.

**Step 4: Run Global Gate plus targeted baseline-monitoring tests**

### Task 6: Snapshot salvage wave E (`codex/worktree-snapshot-20260312`)

**Step 1: Only pick commits that are `+` vs main and not superseded by newer commit already merged**

**Step 2: Cherry-pick one at a time**

**Step 3: Run Global Gate**

### Task 7: Branch convergence check

**Step 1: Recompute deltas**
- Run:
```bash
for b in codex/phase0-reliability-optimizations codex/phase0-reliability-optimizations-no-workflow codex/worktree-snapshot-20260312; do
  echo "$b plus=$(git cherry -v main $b | rg '^\\+' | wc -l | tr -d ' ')"
done
```

**Step 2: If any `plus` remains**
- Start next micro-wave from highest-value remaining commit.

### Task 8: Final verification and documentation

**Step 1: Run Global Gate once more on clean `main`**

**Step 2: Update merge log with**
- Included commits
- Skipped duplicates/superseded commits
- Conflict decisions
- Test results and any residual risk

**Step 3: Push**
```bash
git push origin main
```

## Stop Criteria

Stop wave execution and escalate if any occur:
- More than 2 manual conflict resolutions in one commit touching the same hot file (`backend/main.py`, `backend/dossier_generator.py`, `backend/claude_client.py`).
- Global Gate fails twice for same root cause.
- Runtime contract drift appears between `main.py` and `pipeline_orchestrator.py` that cannot be covered by a small adapter.

## Success Criteria

- Remaining `+` counts materially reduced across all three source branches.
- `main` remains green on Global Gate after every wave.
- Merge log remains current and auditable for every wave.
