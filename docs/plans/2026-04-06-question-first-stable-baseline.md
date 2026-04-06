# Question-First Stable Baseline

Date: 2026-04-06

## Purpose

Freeze the current `question-first` baseline that is proven on `main`.

This note is the operational checkpoint after:

- `725058e7` `fix(question-first): recover official domains for mlc q1 q2`
- `33971a9a` `fix(question-first): detect timestamped run artifacts`

It records what the system now does end to end, what the final archetype smoke proved, and what should be treated as the current stable foundation before the next scaling step.

## Stable System Shape

The live system on `main` is the five-question matrix:

1. `q1_foundation`
2. `q2_digital_stack`
3. `q3_procurement_signal`
4. `q4_decision_owner`
5. `q5_related_pois`

The execution model is:

- `q1`, `q3`, `q4`, `q5`: bounded retrieval via OpenCode + BrightData
- `q2`: deterministic enrichment first via `apify_techstack`, retrieval fallback second
- downstream dossier generation: driven from `question_first_run_v1` artifacts

## What Is Now Proven

### 1. MLC `q1/q2` regression is fixed

The Major League Cricket path no longer fails because `q1` returns Wikipedia first.

What changed:

- `q1_foundation` now treats `validated_with_nuance` as terminal validated state
- MLC `q1` now searches official website first
- `q2_digital_stack` can conservatively recover an official domain when `q1` only surfaced a non-official source

Practical result:

- MLC `q1_foundation` validates
- MLC `q2_digital_stack` validates on an official MLC domain path

### 2. Wrapper artifact handoff is fixed

The dossier wrapper no longer fails when the Node batch writes timestamped artifacts like:

- `*_opencode_batch_*_question_first_run_v1.json`

What changed:

- the wrapper now falls back to the newest `*_question_first_run_v1.json` in the output directory
- this matches the real artifact shape produced by the batch runner

Practical result:

- completed entity runs now produce downstream dossier outputs instead of being marked failed

### 3. Full archetype smoke completes successfully

Final smoke summary:

- [question_first_archetype_smoke.json](/tmp/question-first-archetype-smoke-final/question_first_archetype_smoke.json)

Result:

- `entities_total: 3`
- `entities_completed: 3`
- `entities_failed: 0`
- `entities_with_validated_questions: 3`

Per entity:

- Arsenal Football Club: `5 validated`, `0 no_signal`
- International Canoe Federation: `5 validated`, `0 no_signal`
- Major League Cricket: `5 validated`, `0 no_signal`

## Canonical Output Paths From The Final Smoke

### Arsenal Football Club

- [run artifact](/tmp/question-first-archetype-smoke-final/arsenal/arsenal-fc_opencode_batch_20260406_025926_question_first_run_v1.json)
- [dossier JSON](/tmp/question-first-archetype-smoke-final/arsenal/arsenal-fc_question_first_dossier.json)
- [state](/tmp/question-first-archetype-smoke-final/arsenal/arsenal-fc_arsenal-atomic-matrix_state.json)

### International Canoe Federation

- [run artifact](/tmp/question-first-archetype-smoke-final/icf/international-canoe-federation_opencode_batch_20260406_030501_question_first_run_v1.json)
- [dossier JSON](/tmp/question-first-archetype-smoke-final/icf/international-canoe-federation_question_first_dossier.json)
- [state](/tmp/question-first-archetype-smoke-final/icf/international-canoe-federation_icf-atomic-matrix_state.json)

### Major League Cricket

- [run artifact](/tmp/question-first-archetype-smoke-final/major-league-cricket/major-league-cricket_opencode_batch_20260406_031128_question_first_run_v1.json)
- [dossier JSON](/tmp/question-first-archetype-smoke-final/major-league-cricket/major-league-cricket_question_first_dossier.json)
- [state](/tmp/question-first-archetype-smoke-final/major-league-cricket/major-league-cricket_major-league-cricket-atomic-matrix_state.json)

## Operational Interpretation

This is the current stable baseline:

- matrix execution works
- deterministic enrichment works
- official-domain recovery for MLC works
- people discovery works strongly enough across the three archetypes
- `question_first_run_v1` artifact handoff works
- dossier generation works
- top-level smoke summary accounting works

This does not mean the broader 15-question future matrix is fully implemented.

It means the current five-question production path is stable enough to treat as the baseline for the next step.

## Recommended Next Step

Do not widen the system further before recording scale assumptions.

The next sensible move is:

1. treat this five-question baseline as frozen
2. define the next scaling target beyond the three archetypes
3. measure where failure returns when entity count increases

In practice, that means the next work should be about scale, scheduling, or broader entity coverage, not reworking the now-stable baseline.
