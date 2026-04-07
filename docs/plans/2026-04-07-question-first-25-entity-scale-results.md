# Question-First 25-Entity Scale Results

## Purpose

This note records the first 25-entity control batch against the hardened five-question question-first baseline.

It captures:
- batch completion and artifact health
- per-question validation rates
- by-entity-type performance
- the wrapper finalization failure encountered at the end of the run
- the next production-hardening targets

## Run

- Output root: `/tmp/question-first-scale-batch-25`
- Summary: [/tmp/question-first-scale-batch-25/question_first_archetype_smoke.json](/tmp/question-first-scale-batch-25/question_first_archetype_smoke.json)
- Manifest: [apps/signal-noise-app/backend/data/question_first_scale_batch_25.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_scale_batch_25.json)
- Plan: [docs/plans/2026-04-07-question-first-25-entity-scale-plan.md](/Users/kieranmcfarlane/Downloads/panther_chat/docs/plans/2026-04-07-question-first-25-entity-scale-plan.md)
- Portable evidence bundle: [docs/evidence/2026-04-07-question-first-scale-batch-25/README.md](/Users/kieranmcfarlane/Downloads/panther_chat/docs/evidence/2026-04-07-question-first-scale-batch-25/README.md)

## Batch Result

- `entities_total`: `25`
- `entities_completed`: `25`
- `entities_failed`: `0`
- `entities_with_validated_questions`: `25`

The core runner completed every entity to terminal question state.

## Important caveat

The serial smoke wrapper did **not** emit its summary file on its own.

Observed failure mode:
- all entity state files reached `run_phase: completed`
- the final `opencode_agentic_batch.mjs` process stayed alive after terminal state write
- `run_smoke()` remained blocked inside `await run_question_first_dossier(...)`
- the wrapper never returned to its summary-write path

Recovery used for this note:
- the final summary JSON and markdown were materialized directly from the terminal `*_state.json` files
- the recovered summary is marked with:
  - `recovered_from_terminal_state_files: true`
  - `recovery_reason: serial smoke wrapper blocked on lingering opencode_agentic_batch process after terminal state write`
- because the original `/tmp` artifacts were not portable and were later cleaned up, a compact reconstructed evidence bundle is tracked under [docs/evidence/2026-04-07-question-first-scale-batch-25/](/Users/kieranmcfarlane/Downloads/panther_chat/docs/evidence/2026-04-07-question-first-scale-batch-25/)

So the quality results are real, but the wrapper finalization path still needs a follow-up fix.

## Per-Question Validation

- `q1_foundation`: `22` validated, `3` no_signal
- `q2_digital_stack`: `20` validated, `5` no_signal
- `q3_procurement_signal`: `14` validated, `11` no_signal
- `q4_decision_owner`: `12` validated, `13` no_signal
- `q5_related_pois`: `18` validated, `7` no_signal

## By Entity Type

- `SPORT_CLUB`: `34` validated, `16` no_signal across `10` entities
- `SPORT_FEDERATION`: `30` validated, `10` no_signal across `8` entities
- `SPORT_LEAGUE`: `22` validated, `13` no_signal across `7` entities

Federations held up best on aggregate. Clubs and leagues remained materially noisier.

## Entity Summary

Clean `5/5` validated:
- Arsenal Football Club
- FC Bayern Munich
- FIBA
- Inter Miami CF
- Leeds United
- Premier League
- World Rugby

Mixed but usable:
- England and Wales Cricket Board: `3` validated, `2` no_signal
- FC Barcelona: `4` validated, `1` no_signal
- FIFA: `4` validated, `1` no_signal
- Formula 1: `4` validated, `1` no_signal
- International Canoe Federation: `3` validated, `2` no_signal
- International Ski and Snowboard Federation: `3` validated, `2` no_signal
- Real Madrid CF: `3` validated, `2` no_signal
- UEFA: `3` validated, `2` no_signal
- World Athletics: `4` validated, `1` no_signal
- Women's Super League: `4` validated, `1` no_signal
- Bundesliga: `3` validated, `2` no_signal
- National Women’s Soccer League: `3` validated, `2` no_signal

Weak / noisy:
- Celtic FC: `2` validated, `3` no_signal
- Juventus: `2` validated, `3` no_signal
- Major League Cricket: `2` validated, `3` no_signal
- Manchester City FC: `2` validated, `3` no_signal
- Major League Soccer: `1` validated, `4` no_signal
- Paris Saint-Germain: `1` validated, `4` no_signal

## Assessment Against 25-Entity Gates

The batch proved the following:
- the hardened question-first system scales mechanically to a 25-entity cohort
- wrapper/artifact generation did not collapse during execution
- BrightData teardown noise no longer blocked the batch
- the quality envelope is visible and measurable at a larger control-batch tier

The batch did **not** hit the planned validation thresholds.

Compared to the control gates:
- `q1_foundation >= 90%`: met (`22/25 = 88%`) -> narrowly missed
- `q2_digital_stack >= 90%`: missed (`20/25 = 80%`)
- `q3_procurement_signal >= 85%`: missed (`14/25 = 56%`)
- `q4_decision_owner >= 90%`: missed (`12/25 = 48%`)
- `q5_related_pois >= 90%`: missed (`18/25 = 72%`)

This means the system has now proved:
- architecture
- runtime stability
- scale mechanics
- observability

It has not yet proved:
- stable cross-cohort quality at the 25-entity production gate

## What this batch taught us

Strongest question families:
- `q1_foundation`
- `q2_digital_stack`

Weakest question families:
- `q4_decision_owner`
- `q3_procurement_signal`

Recurring failure patterns:
- clubs with weak public commercial people surfaces still degrade on `q4/q5`
- some leagues and federations still degrade on `q2`
- `q3` remains the main unstable question family across multiple org shapes

## Next Actions

1. Fix the smoke-wrapper finalization bug so terminal entity state always results in summary emission.
2. Treat this 25-entity run as a diagnostic control batch, not a pass-the-gate batch.
3. Segment tuning by org surface rather than only by top-level entity type.
4. Focus the next quality pass on:
   - `q4_decision_owner`
   - `q3_procurement_signal`
   - selected `q2_digital_stack` misses for leagues/federations
5. Use rerun/backfill mechanics on failure subsets instead of rerunning the entire cohort.

## Bottom Line

This batch proves the question-first system is no longer a prototype.
It runs, scales, emits usable dossiers for many entities, and exposes its weak spots clearly.

But it is still a **production-hardening system**, not yet a production-quality system at the 25-entity bar.
