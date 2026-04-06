# Question-First 10-Entity Scale Results

## Purpose

This note records the first manifest-driven 10-entity scale batch against the current five-question question-first baseline.

It captures:
- batch completion and artifact health
- per-question validation rates
- degradation by entity type
- exact failure sets for the next tuning pass

## Run

- Output root: `/tmp/question-first-scale-batch-10`
- Summary: [/tmp/question-first-scale-batch-10/question_first_archetype_smoke.json](/tmp/question-first-scale-batch-10/question_first_archetype_smoke.json)
- Manifest: [apps/signal-noise-app/backend/data/question_first_scale_batch_10.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_scale_batch_10.json)

## Batch Result

- `entities_total`: `10`
- `entities_completed`: `10`
- `entities_failed`: `0`
- `entities_with_validated_questions`: `10`

The scale harness, artifact handoff, and dossier generation all held at 10 entities.

## Per-Question Validation

- `q1_foundation`: `8` validated, `2` no_signal
- `q2_digital_stack`: `10` validated, `0` no_signal
- `q3_procurement_signal`: `7` validated, `3` no_signal
- `q4_decision_owner`: `6` validated, `4` no_signal
- `q5_related_pois`: `9` validated, `1` no_signal

## By Entity Type

- `SPORT_CLUB`: `14` validated, `6` no_signal across `4` entities
- `SPORT_FEDERATION`: `14` validated, `1` no_signal across `3` entities
- `SPORT_LEAGUE`: `12` validated, `3` no_signal across `3` entities

Federations held up best. Clubs were the noisiest entity type.

## Entity Summary

- Arsenal Football Club: `3` validated, `2` no_signal
- Leeds United: `3` validated, `2` no_signal
- Celtic FC: `3` validated, `2` no_signal
- Inter Miami CF: `5` validated, `0` no_signal
- International Canoe Federation: `4` validated, `1` no_signal
- World Rugby: `5` validated, `0` no_signal
- England and Wales Cricket Board: `5` validated, `0` no_signal
- Major League Cricket: `5` validated, `0` no_signal
- Premier League: `3` validated, `2` no_signal
- National Women’s Soccer League: `4` validated, `1` no_signal

## Failure Sets

### q4_decision_owner

Failed entities:
- `arsenal` (`SPORT_CLUB`)
- `celtic-fc` (`SPORT_CLUB`)
- `leeds-united` (`SPORT_CLUB`)
- `premier-league` (`SPORT_LEAGUE`)

Observed failure mode:
- these were not low-confidence buyer picks
- they were hard timeouts with no structured output
- the first executed query in each case was the LinkedIn company anchor query
- the generated-source path was too brittle when that anchor did not resolve quickly

Tuning direction:
- preserve company-anchored discovery
- broaden clubs and leagues to use official site, news, and commercial-team discovery earlier
- avoid spending the full timeout budget inside a single LinkedIn-first probe

### q1_foundation

Failed entities:
- `arsenal` (`SPORT_CLUB`)
- `celtic-fc` (`SPORT_CLUB`)

Observed failure mode:
- weak club identity resolution in generated-source scale mode
- same question held up better in the frozen canonical-source baseline

Tuning direction:
- improve weaker-club foundation retrieval without breaking the now-stable MLC path
- bias clubs toward official-site and authoritative club-history lookups sooner

### q3_procurement_signal

Failed entities:
- `icf` (`SPORT_FEDERATION`)
- `premier-league` (`SPORT_LEAGUE`)
- `nwsl` (`SPORT_LEAGUE`)

Observed failure mode:
- ecosystem/procurement evidence was present for many entities, but weaker on some leagues and federations
- current broad procurement/ecosystem query set is good enough to scale mechanically, but not yet good enough to validate consistently on those three entities

Tuning direction:
- add league/federation variants around partner change, broadcast, data, analytics, and platform modernization
- keep explicit RFP language in the mix, but not as the only strong signal path

## Current Assessment

The 10-entity run is strong enough to treat as the first real scale checkpoint.

What is stable:
- batch execution
- artifact production
- dossier generation
- `q2_digital_stack` at scale
- `q5_related_pois` at scale

What needs the next tuning pass:
1. `q4_decision_owner`
2. `q1_foundation` for weaker clubs
3. `q3_procurement_signal` for some leagues and federations

## Next Actions

1. Retune `q4_decision_owner` against the exact club and league timeout failures.
2. Re-run focused `q4` checks on Arsenal and Premier League.
3. Inspect `q1` club failures and tighten foundation discovery for weaker clubs.
4. Inspect `q3` failures for `icf`, `premier-league`, and `nwsl` and split their search variants by entity type.
