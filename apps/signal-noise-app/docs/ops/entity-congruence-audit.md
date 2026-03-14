# Entity Congruence Audit Runbook

## Purpose
`qa-entity-congruence-audit` validates that cached entities, embeddings, and seeded league/team coverage remain congruent after sync/remediation runs.

## Commands
- Hard fail mode:
  - `npm run qa:entity-congruence-audit`
- Soft mode (report only):
  - `npm run qa:entity-congruence-audit:soft`
- JSON + markdown outputs:
  - `node scripts/qa-entity-congruence-audit.mjs --json --no-fail --out artifacts/entity-congruence-audit.json --summary-md artifacts/entity-congruence-audit-summary.md`
- Baseline refresh:
  - `npm run qa:entity-congruence-baseline:update`

## Checks
- `embedding_id_overlap`:
  - threshold `>= 95%`
- `normalized_names_missing_rate`:
  - threshold `<= 25`
- `id_name_mismatch_threshold`:
  - threshold `<= 1200`
- `ipl_seed_presence`:
  - threshold `10/10`
- `epl_seed_presence`:
  - threshold `>= 80%` of seeds
- `bundesliga_seed_presence`:
  - threshold `>= 80%` of seeds
- Baseline drift checks (from `config/entity-congruence-baseline.json`):
  - `baseline_drift_id_name_mismatches`
  - `baseline_drift_missing_normalized_names`
  - `baseline_drift_overlap_pct`
  - `baseline_drift_ipl_seed_presence`
  - `baseline_drift_epl_seed_presence`
  - `baseline_drift_bundesliga_seed_presence`

## CI Behavior
- Workflow: `.github/workflows/entity-congruence-audit.yml`
- Uses explicit least-privilege permissions:
  - `contents: read`
  - `pull-requests: write` (required for sticky PR comments)
- Uses concurrency cancellation:
  - only latest run per PR/ref remains active
- `congruence-audit` job is the gate.
- `congruence-audit-report` job always runs and:
  - generates JSON + markdown report files,
  - publishes a human summary in `GITHUB_STEP_SUMMARY`,
  - emits check-level `::error` annotations for failed checks,
  - uploads report artifacts,
  - updates a sticky PR comment with the summary.

## Operational Sequence
1. Run full sync:
   - `POST /api/sync/graph-to-supabase`
2. Ensure post-sync reconciliation completed.
3. Run audit gate.
4. If failing:
   - inspect failed check details,
   - run remediation,
   - rerun audit until pass.

## Baseline Management
- Baseline file:
  - `config/entity-congruence-baseline.json`
- Default behavior:
  - audit auto-loads this baseline file if present
- Optional override:
  - `--baseline <path>`
- Recommended baseline refresh process:
  1. complete remediation and verify all checks pass
  2. run `npm run qa:entity-congruence-baseline:update`
  3. review changed metrics in `config/entity-congruence-baseline.json`
  4. keep allowed regression values conservative
