# Question-First 10-Entity Scale Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the current stable five-question `question-first` baseline across a 10-entity batch and measure where completion rate, validation rate, and runtime degrade beyond the three-archetype smoke.

**Architecture:** Keep the matrix and runner behavior frozen. Add a scale-batch input path around the existing serial smoke, feed it a fixed 10-entity manifest, and measure output quality without changing retrieval logic during the first pass.

**Tech Stack:** Python dossier runner, OpenCode batch runner, BrightData-backed retrieval, Apify deterministic enrichment, JSON/Markdown smoke outputs.

## Purpose

This plan defines the first scale test beyond the proven three-archetype baseline recorded in:

- [docs/plans/2026-04-06-question-first-stable-baseline.md](/Users/kieranmcfarlane/Downloads/panther_chat/docs/plans/2026-04-06-question-first-stable-baseline.md)

It does **not** widen the matrix.

It does **not** add new question families.

It does **not** tune behavior before seeing scale failure.

It only defines:

- the first 10-entity batch
- the success metrics
- the stop conditions
- the repo-side manifest for the run

## Fixed 10-Entity Batch

Use a balanced mix of clubs, federations, and leagues.

### Clubs

1. Arsenal Football Club
2. Leeds United
3. Celtic FC
4. Inter Miami CF

### Federations

5. International Canoe Federation
6. World Rugby
7. England and Wales Cricket Board

### Leagues

8. Major League Cricket
9. Premier League
10. National Women's Soccer League

## Batch Manifest

The batch manifest for this run should live at:

- [apps/signal-noise-app/backend/data/question_first_scale_batch_10.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_scale_batch_10.json)

This manifest should be treated as the input contract for the first scale pass.

## Success Metrics

Measure these exactly:

1. entity completion rate
   - target: at least `8/10` completed

2. entity dossier generation rate
   - target: at least `8/10` entities produce both:
     - `question_first_run_v1.json`
     - `question_first_dossier.json`

3. per-question validation rate
   - report validated / no-signal counts for:
     - `q1_foundation`
     - `q2_digital_stack`
     - `q3_procurement_signal`
     - `q4_decision_owner`
     - `q5_related_pois`

4. runtime per entity
   - record total wall-clock time per entity
   - flag any entity taking materially longer than the three-archetype baseline

5. deterministic vs retrieval usage for `q2`
   - record whether `q2` validated through:
     - deterministic Apify
     - retrieval fallback
     - or no-signal

6. entity-type breakdown
   - compare completion and validation by:
     - `SPORT_CLUB`
     - `SPORT_FEDERATION`
     - `SPORT_LEAGUE`

## Stop Conditions

Stop the scale pass and inspect before tuning if any of the following happen:

1. entity completion rate falls below `6/10`
2. dossier generation fails for more than `2` entities
3. one question family fails systematically across one entity type
   - example:
     - `q4_decision_owner` fails for most federations
4. runtime becomes operationally impractical
   - example:
     - repeated multi-minute stalls in one layer with no improvement in quality

## What Counts As Success

This scale run is successful if:

- at least `8/10` entities complete
- at least `8/10` entities generate canonical dossier artifacts
- no single question family collapses across the full batch
- the resulting failure pattern is specific enough to guide the next tuning pass

Success does **not** require every entity to go `5/5 validated`.

The point of the scale pass is to identify where the stable baseline stops being stable.

## Required Implementation Change

The current smoke runner is hard-coded to `DEFAULT_ARCHETYPE_BATCH` with three entities.

The next implementation step should be limited to:

1. allow the smoke runner to load a JSON batch manifest
2. run the 10-entity manifest without changing question behavior
3. write the same JSON and Markdown summary shape as the current archetype smoke

Do not tune matrix logic in the same change.

## Expected Output

The scale run should write:

- `question_first_scale_smoke.json`
- `question_first_scale_smoke.md`
- per-entity output directories identical in shape to the archetype smoke

The summary should include:

- entity totals
- completion totals
- dossier totals
- validated/no-signal totals by question id
- per-entity timing
- q2 deterministic vs retrieval outcome

## Recommended Execution Order

1. Teach the smoke runner to accept a batch manifest path
2. Add the 10-entity manifest
3. Run the 10-entity smoke once
4. Record failures without tuning
5. Only then decide which question family to tune next
