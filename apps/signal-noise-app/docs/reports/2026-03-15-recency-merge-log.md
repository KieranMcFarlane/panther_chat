# Recency-First Codex Merge Log (2026-03-15)

## Scope
- Included branches considered:
  - `codex/phase0-reliability-optimizations`
  - `codex/phase0-reliability-optimizations-no-workflow`
  - `codex/fix-missing-view-transition-lib`
  - `codex/worktree-snapshot-20260312` (salvage-only)
- Excluded by policy: `graphiti_system`

## Included Commits
- `2f5e8c7` feat: add entity congruence remediation and audit gates
- `7d1ac13` chore: require baseline for entity congruence CI
- `40d9636` chore: expose baseline drift deltas in congruence reports
- `125efe6` chore(sync): backfill congruence dependency libs for recency merge
- `2437614` feat: add canonical audit admin view, alerts, and taxonomy hygiene

## Conflict Decisions (Deterministic Precedence)
- Applied "newest valid commit wins" for congruence/audit surfaces.
- Preserved current-branch stricter script set in `package.json` where older variant dropped audit checks.
- Kept legacy-deleted surfaces excluded (no reintroduction of removed demo/voice paths).

## Skipped Commits and Reasons
- `374f146` (binary-doc/media fallback hardening): skipped due dependency chain not fully present in this batch (would leave `dossier_data_collector` inconsistent and reintroduce deleted stale test surface).
- `be2cb95` (nav stabilization): resolved to empty cherry-pick (already represented by current branch state).
- `0f45646` from `codex/fix-missing-view-transition-lib`: duplicate (`git cherry` marked as already represented).
- `codex/worktree-snapshot-20260312`: treated as salvage; no unique non-superseded commit selected in this pass.

## Verification Results
- `npm run qa:imports`: pass after each applied batch.
- Targeted API smoke:
  - `/api/entities/taxonomy` responds successfully.
  - `/api/entities?page=1&limit=3&sport=Cricket` responds successfully.
- `npm run lint:full`: blocked by interactive Next.js ESLint setup prompt in this repo state.
- Pipeline smoke scripts referenced by prior workflow are not present in this repository layout (`run_fixed_dossier_pipeline.py`, `scripts/check-pipeline-runtime.sh`, `backend/tests/test_dossier_phase0_runtime.py` not found).

## Wave 2B (Runtime + Run-Detail)

### Included Commits
- `c8d01bb` fix: preserve dossier phase metadata in pipeline updates
- `0e881c5` feat: add live phase0 substep states and collection timeout guard
- `c5c3a58` fix(merge): restore valid collector try/finally in dossier generation

### Conflict Decisions (Deterministic Precedence)
- Kept newer phase-metadata + phase0 substep instrumentation from the selected Wave 2B commit.
- Preserved current branch deletion of `backend/tests/test_pipeline_phase_update_payload.py` to avoid reintroducing a stale deleted surface.
- Merged `dossier_generator.py` to keep leadership enrichment and Claude-disabled fallback behavior while adding timeout/progress callbacks.

### Verification Results (Wave 2B)
- `npm run qa:imports`: pass.
- `node --test tests/test-entity-run-detail.mjs`: pass.
- `python3 -m py_compile backend/main.py backend/dossier_generator.py backend/entity_pipeline_worker.py backend/pipeline_run_metadata.py`: pass.
- `PYTHONPATH=backend pytest backend/tests/test_entity_pipeline_worker.py -q`: blocked in this environment (`ModuleNotFoundError: No module named 'supabase'`).

## Wave 2C (BrightData Timeout Hardening)

### Included Commit
- `d38cd72` fix: enforce timeout on brightdata sdk calls

### Conflict Decisions
- Merged timeout guard into current `brightdata_sdk_client.py` while preserving newer adaptive zone/fallback logic already present on `main`.

### Verification Results (Wave 2C)
- `python3 -m py_compile backend/brightdata_sdk_client.py`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python scripts/check-brightdata-hello.py`: pass (`search_engine` and `scrape_as_markdown` both `status=success`, source `brightdata_sdk`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).

## Wave 2D (Phase-0 Timeout Handling)

### Included Commits
- `1b644a4` Fix phase-0 timeout handling in run-entity
- `629c35b` test(timeout): stub missing baseline module for phase0 timeout path

### Conflict Decisions
- No cherry-pick conflicts for `1b644a4`.
- Follow-up test shim added because `run_entity_pipeline` imports `backend.baseline_monitoring` eagerly while this module is not yet merged in current wave scope.

### Verification Results (Wave 2D)
- `npm run qa:imports`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py -q`: pass (`2 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).

## Wave 2E (Chutes Error Reporting Hardening)

### Included Commit
- `3636a17` Harden Chutes error reporting and enrich Phase 0 substep details

### Conflict Decisions
- Resolved conflict in `backend/claude_client.py` by preserving newer local retry/response parsing helpers and adding richer Chutes error formatting from the incoming commit.
- Retryable status set includes both existing and incoming coverage (`408`, `409`, `425`, `429`, and `>=500`).

### Verification Results (Wave 2E)
- `npm run qa:imports`: pass.
- `python3 -m py_compile backend/claude_client.py`: pass.
- `node --test tests/test-entity-run-detail.mjs`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py -q`: pass (`2 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).

## Wave 2F (Compact Phase-0 Fallback + Runtime Telemetry)

### Included Commits
- `74bea9a` Add compact Phase 0 fallback mode and inference runtime telemetry
- `e828403` fix(merge): restore phase0 fallback metadata helpers in dossier generator

### Conflict Decisions
- Kept recency behavior for compact timeout fallback mode and inference runtime metadata in phase payloads/run detail UI.
- Preserved deletion of `backend/tests/test_pipeline_phase_update_payload.py` (legacy stale test surface).
- Applied merge repairs to keep leadership enrichment plus canonical-source metadata paths stable.

### Verification Results (Wave 2F)
- `npm run qa:imports`: pass.
- `python3 -m py_compile backend/dossier_generator.py backend/main.py`: pass.
- `node --test tests/test-entity-run-detail.mjs`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py backend/tests/test_dossier_generator_timeout_fallback.py -q`: pass (`3 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).

## Wave 2G (Degraded Phase-0 Timeout Continuation)

### Included Commits
- `aa0fc4e` Allow degraded Phase 0 timeout continuation in entity pipeline
- `52843ac` test(timeout): isolate degraded phase0 path from full pipeline deps

### Conflict Decisions
- No code conflicts on cherry-pick.
- Test follow-up required in this repo shape because degraded-timeout coverage otherwise depends on optional/older pipeline constructor paths and missing monitoring modules.

### Verification Results (Wave 2G)
- `npm run qa:imports`: pass.
- `python3 -m py_compile backend/main.py`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py backend/tests/test_dossier_generator_timeout_fallback.py -q`: pass (`4 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).

## Wave 2H (Chutes Streaming + JSON Parsing Diagnostics)

### Included Commits
- `330c07c` Add Chutes streaming transport, final JSON parsing, and diagnostics
- `ffdd0c7` test(timeout): align fail-mode assertion with queue defaults

### Conflict Decisions
- Kept incoming `backend/claude_client.py` streaming/parsing implementation and diagnostics surface.
- Kept current stabilized `backend/dossier_generator.py` to avoid regressing previously merged phase-0 reliability behavior.
- Preserved deletion of `backend/tests/test_pipeline_phase_update_payload.py` (stale test surface).
- Restored timeout test file to current-branch baseline and applied a minimal assertion env fix for fail-mode behavior.

### Verification Results (Wave 2H)
- `npm run qa:imports`: pass.
- `python3 -m py_compile backend/claude_client.py backend/main.py`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py backend/tests/test_dossier_generator_timeout_fallback.py -q`: pass (`4 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python scripts/check-brightdata-hello.py`: pass (`search_engine` succeeded via HTTP fallback in this run; `scrape_as_markdown` succeeded via SDK direct mode).

## Wave 3A Prep (Fresh Inventory + Shortlist)

### Fresh `git cherry` counts vs `main`
- `codex/phase0-reliability-optimizations`: `+213`
- `codex/phase0-reliability-optimizations-no-workflow`: `+195`
- `codex/worktree-snapshot-20260312`: `+134`

### Recency-first shortlist (next candidates)
- Reliability wave A candidate:
  - `77e7315` Retry evaluator timeouts with bounded backoff
- Discovery quality wave B candidates:
  - `ad24491` fix(discovery): harden official-site selection against store/media domains
  - `2fc4803` fix(dossier): avoid commerce-domain official-site cache poisoning
  - `374f146` fix(dossier): reject binary docs and media fallbacks for official site
- Snapshot salvage (only if not superseded by newer branch commits):
  - `3ae56af` Prefer root official URLs and retry empty length responses
  - `01a16d7` Fallback official scraping to subpaths on empty homepage

### Dedupe policy applied
- Kept only `+` entries from each branch delta.
- Excluded obvious duplicates already represented in prior waves (e.g., `be2cb95` nav stabilization lineage).

## Wave 3A (Reliability + Discovery Hardening)

### Included Commits
- `715d5cb` Retry evaluator timeouts with bounded backoff
- `ae9964e` fix(discovery): harden official-site selection against store/media domains

### Conflict Decisions
- `hypothesis_driven_discovery.py`: merged incoming evaluator timeout/backoff settings while preserving current `_last_url_candidates` state tracking.
- `dossier_data_collector.py`: merged incoming official-site domain hardening/cache helpers and preserved current async collector `close()` lifecycle method.
- Preserved policy to keep stale deleted tests removed:
  - `backend/tests/test_discovery_url_resolution_fallbacks.py` remained deleted.
  - `backend/tests/test_dossier_data_collector_seed.py` remained deleted.

### Verification Results (Wave 3A)
- `npm run qa:imports`: pass.
- `python3 -m py_compile backend/main.py backend/claude_client.py backend/dossier_generator.py backend/dossier_data_collector.py`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py backend/tests/test_dossier_generator_timeout_fallback.py -q`: pass (`4 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python scripts/check-brightdata-hello.py`: pass (`search_engine` success with `result_count=10`; `scrape_as_markdown` success via `brightdata_sdk` direct mode).

## Wave 3B (Runtime Transport + Snapshot Salvage)

### Included Commits
- `69b4fa1` Add Chutes streaming transport, final JSON parsing, and diagnostics
- `fabc2a5` fix(merge): restore timeout test contract after stale wave-c pick
- `e6dd490` Use URI-based Falkor SSL mode instead of forcing TLS

### Skipped Commits
- `3ae56af` (snapshot: root official URLs + empty-length retry): skipped due high-conflict reintroduction of stale/deleted tests and overlap with newer mainline discovery hardening.

### Conflict Decisions
- For `69b4fa1`: accepted code path while reverting stale test-only backfill that regressed timeout suite against current `main` contracts.
- For `e6dd490`: kept stale `backend/tests/test_dossier_phase0_runtime.py` deleted; applied only URI/override-driven Falkor SSL selection (`ssl=use_ssl`) in `dossier_data_collector.py`.
- Task 5 baseline-monitoring wave remains deferred: `backend.baseline_monitoring` contract still absent on `main`, so precondition not met.

### Verification Results (Wave 3B)
- `npm run qa:imports`: pass.
- `python3 -m py_compile backend/main.py backend/claude_client.py backend/dossier_generator.py backend/dossier_data_collector.py`: pass.
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_dossier_generator_timeout.py backend/tests/test_dossier_generator_timeout_fallback.py -q`: pass (`4 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python -m pytest backend/tests/test_entity_pipeline_worker.py -q`: pass (`31 passed`).
- `PYTHONPATH=backend .venv-codex/bin/python scripts/check-brightdata-hello.py`: pass (`search_engine` success with `result_count=10`; `scrape_as_markdown` success via `brightdata_sdk` direct mode).
