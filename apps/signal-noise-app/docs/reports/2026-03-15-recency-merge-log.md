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
