# Repo Stabilization And Cleanup Plan (2026-03-11)

## Objective
Recover the repository to a predictable, reviewable, and releasable state by isolating unrelated work, re-establishing CI guardrails, and introducing strict change governance.

## Current Problem
- The repo contains a high volume of unrelated modified/deleted/untracked files.
- Application, scripts, docs, and generated artifacts are intermixed.
- It is difficult to trust diffs, run targeted reviews, or safely ship.

## Success Criteria
- Every active branch has a clear scope and bounded diff.
- Generated/runtime artifacts are excluded from git.
- CI enforces lint, tests, and type checks for touched areas.
- PRs are auditable by domain (api/backend/frontend/ops/docs).

## Phase 1: Freeze And Snapshot (Day 0)
1. Create a complete inventory of modified/deleted/untracked files.
2. Categorize files into: `product code`, `infra`, `scripts`, `docs`, `generated/runtime`, `legacy`.
3. Save an immutable snapshot report in `docs/reports/`.
4. Declare a temporary merge freeze except hotfixes.

## Phase 2: Isolate Workstreams (Day 1)
1. Create dedicated branches/worktrees per stream:
   - `codex/stabilization-core` (build/runtime)
   - `codex/stabilization-api`
   - `codex/stabilization-backend`
   - `codex/stabilization-docs`
2. Move non-critical experiments to `archive/` or external branch.
3. Mark deleted files as intentional or restore them explicitly.

## Phase 3: Repository Hygiene (Day 1-2)
1. Update `.gitignore` for runtime and generated outputs (`logs/`, temp exports, local archives, build artifacts, credential files).
2. Introduce `scripts/validate-repo-state.sh` to fail on forbidden tracked artifacts.
3. Add CODEOWNERS by domain to route review.
4. Add PR template with mandatory scope declaration and verification checklist.

## Phase 4: Verification Baseline (Day 2)
1. Define minimum CI gates:
   - targeted lint on changed files
   - unit/integration tests for changed domains
   - typecheck for app packages
2. Add “changed-files aware” test entrypoints to keep CI fast.
3. Require green CI before merge.

## Phase 5: Batch Cleanup PRs (Day 2-4)
1. Submit cleanup PRs in this order:
   - PR1: `.gitignore` + guard scripts + CI wiring
   - PR2: generated/runtime artifact removals
   - PR3: API/backend restoration or intentional deletions
   - PR4: docs and plan alignment
2. Keep each PR narrowly scoped (<500 changed lines where possible).

## Phase 6: Governance (Day 4+)
1. Enforce branch naming and one-ticket-per-PR.
2. Enable branch protection with required checks and review count.
3. Run weekly repo hygiene audit (automated report + owner rotation).

## Operational Notes
- Never use `git reset --hard` in this cleanup.
- Treat credential-like files as sensitive and rotate if exposure is suspected.
- Keep historical artifacts only in `archive/` with clear provenance metadata.

## Immediate Next Actions
1. Generate and commit `repo-state-inventory-2026-03-11.json`.
2. Open PR for hygiene/CI guardrails.
3. Open follow-up PRs per domain cleanup stream.

## Entity Congruence Workstream (P1 Follow-through)
1. Land migration `20260311_entity_relationships_on_update_cascade.sql` in the next DB release.
2. Run reconciliation baseline and store report artifact (`cached`, `embeddings`, `relationships`, mismatch metrics).
3. Execute semantic merge remediation (`strategy=semantic_merge`) as default path; keep ID-backfill only for explicit missing-ID recovery.
4. Run bounded collision repair passes until `actionable_id_name_mismatches=0`.
5. Quarantine non-sports/system embedding rows (`tier_*`, `Entity ####`, location-only rows) from remediation decisions.
6. Keep `embeddings_not_in_cached=0` as a hard gate before shipping search/filter UI changes.
7. Add a weekly scheduled graph->supabase sync + reconciliation check and alert on regressions.
