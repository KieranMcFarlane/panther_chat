# 2026-04-07 Question-First 25-Entity Failure Segmentation

Source summary: `/tmp/question-first-scale-batch-25/question_first_archetype_smoke.json`

This note segments the recovered 25-entity control-batch failures by org surface so the next pass can tune q4, then q3, then selected q2 misses without rerunning the entire cohort.

## Global counts

- `q4_decision_owner`: 13 failures
- `q3_procurement_signal`: 11 failures
- `q2_digital_stack`: 5 failures

## Surface Buckets

### `global_elite_club`

- entities: arsenal, bayern-munich, fc-barcelona, inter-miami-cf, juventus, manchester-city, psg, real-madrid-cf
- q2 failures: psg
- q3 failures: juventus, psg, real-madrid-cf
- q4 failures: fc-barcelona, juventus, manchester-city, psg
- q5 failures: juventus, manchester-city, psg

### `weaker_public_surface_club`

- entities: celtic-fc, leeds-united
- q2 failures: none
- q3 failures: celtic-fc
- q4 failures: celtic-fc
- q5 failures: celtic-fc

### `top_commercial_league`

- entities: bundesliga, formula-1, premier-league
- q2 failures: none
- q3 failures: bundesliga, formula-1
- q4 failures: bundesliga
- q5 failures: none

### `developing_or_fragmented_league`

- entities: major-league-cricket, mls, nwsl, wsl
- q2 failures: mls
- q3 failures: major-league-cricket, nwsl
- q4 failures: major-league-cricket, mls, nwsl, wsl
- q5 failures: major-league-cricket, mls

### `commercial_global_federation`

- entities: ecb, fiba, fifa, uefa, world-athletics, world-rugby
- q2 failures: ecb, world-athletics
- q3 failures: fifa
- q4 failures: ecb, uefa
- q5 failures: uefa

### `technical_tender_federation`

- entities: fis, icf
- q2 failures: icf
- q3 failures: fis, icf
- q4 failures: fis
- q5 failures: none

## Recommended Rerun Order

1. `q4_decision_owner` failures across clubs, leagues, and federations using the focused q4 subset manifest.
2. `q3_procurement_signal` failures with surface-specific tuning, especially technical/tender federations and weaker-public-surface clubs.
3. `q2_digital_stack` rerun only for the selected league/federation misses, not the full cohort.

## Rerun Manifests

- [question_first_rerun_q4_failures_batch.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_rerun_q4_failures_batch.json)
- [question_first_rerun_q3_failures_batch.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_rerun_q3_failures_batch.json)
- [question_first_rerun_q2_selected_batch.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_rerun_q2_selected_batch.json)

## Suggested Commands

```bash
PYTHONPATH=apps/signal-noise-app python3 apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py \
  --batch-manifest apps/signal-noise-app/backend/data/question_first_rerun_q4_failures_batch.json \
  --rerun-question q4_decision_owner \
  --output-root /tmp/question-first-rerun-q4

PYTHONPATH=apps/signal-noise-app python3 apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py \
  --batch-manifest apps/signal-noise-app/backend/data/question_first_rerun_q3_failures_batch.json \
  --rerun-question q3_procurement_signal \
  --output-root /tmp/question-first-rerun-q3

PYTHONPATH=apps/signal-noise-app python3 apps/signal-noise-app/scripts/run_question_first_archetype_smoke.py \
  --batch-manifest apps/signal-noise-app/backend/data/question_first_rerun_q2_selected_batch.json \
  --rerun-question q2_digital_stack \
  --output-root /tmp/question-first-rerun-q2-selected
```
