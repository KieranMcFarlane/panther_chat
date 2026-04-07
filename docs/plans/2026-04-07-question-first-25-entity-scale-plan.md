# Question-First 25-Entity Control Batch

## Goal

Run the first post-hardening 25-entity control batch against the baseline five-question question-first system.

## Cohort

- 10 clubs
- 8 federations
- 7 leagues

The cohort intentionally biases toward globally recognizable entities so the batch measures scale behavior, not avoidable naming ambiguity.

## Baseline assumptions

- Connections enrichment stays off by default.
- Success is determined only by the core five-question path.
- Durable batch metrics and rerun/backfill controls are enabled.

## Success gates

- `entities_completed >= 25`
- `entities_failed == 0`
- `q1_foundation >= 90% validated`
- `q2_digital_stack >= 90% validated`
- `q3_procurement_signal >= 85% validated`
- `q4_decision_owner >= 90% validated`
- `q5_related_pois >= 90% validated`

## Stop conditions

- Stop if wrapper-level failures appear.
- Stop if BrightData teardown errors become fatal instead of cleanup noise.
- Stop if one question family regresses below `70%` validated across the cohort.

## Review focus

- completion and dossier rate
- per-question validation
- by-entity-type drift
- question and entity runtimes
- deterministic versus retrieval behavior
- rerun and backfill observations if needed
