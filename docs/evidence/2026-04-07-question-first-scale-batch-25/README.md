# Question-First 25-Entity Evidence Bundle

This is a portable compact evidence bundle for the 2026-04-07 25-entity control batch.

## Provenance

- Original run root: `/tmp/question-first-scale-batch-25`
- Raw `/tmp` artifacts were no longer present when this bundle was created.
- This bundle reconstructs the compact matrix from pushed result notes, failure segmentation, and the tracked manifest.
- It is not the full raw per-question artifact tree.

## Files

- `question_first_archetype_smoke.reconstructed.json`: compact reconstructed summary and per-entity question matrix

## Aggregate Result

- `entities_total`: `25`
- `entities_completed`: `25`
- `entities_failed`: `0`
- `entities_with_validated_questions`: `25`
- `recovered_from_terminal_state_files`: `True`
- `recovery_reason`: `serial smoke wrapper blocked on lingering opencode_agentic_batch process after terminal state write`

## Per-Question Validation

- `q1_foundation`: `22` validated, `3` no_signal
- `q2_digital_stack`: `20` validated, `5` no_signal
- `q3_procurement_signal`: `14` validated, `11` no_signal
- `q4_decision_owner`: `12` validated, `13` no_signal
- `q5_related_pois`: `18` validated, `7` no_signal

## Per-Entity Matrix

| Entity | Type | q1 | q2 | q3 | q4 | q5 | Validated |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Arsenal Football Club | `SPORT_CLUB` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| Leeds United | `SPORT_CLUB` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| Celtic FC | `SPORT_CLUB` | `validated` | `validated` | `no_signal` | `no_signal` | `no_signal` | `2/5` |
| Inter Miami CF | `SPORT_CLUB` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| FC Barcelona | `SPORT_CLUB` | `validated` | `validated` | `validated` | `no_signal` | `validated` | `4/5` |
| Real Madrid CF | `SPORT_CLUB` | `no_signal` | `validated` | `no_signal` | `validated` | `validated` | `3/5` |
| Manchester City FC | `SPORT_CLUB` | `no_signal` | `validated` | `validated` | `no_signal` | `no_signal` | `2/5` |
| Juventus FC | `SPORT_CLUB` | `validated` | `validated` | `no_signal` | `no_signal` | `no_signal` | `2/5` |
| FC Bayern Munich | `SPORT_CLUB` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| Paris Saint-Germain | `SPORT_CLUB` | `validated` | `no_signal` | `no_signal` | `no_signal` | `no_signal` | `1/5` |
| International Canoe Federation | `SPORT_FEDERATION` | `validated` | `no_signal` | `no_signal` | `validated` | `validated` | `3/5` |
| World Rugby | `SPORT_FEDERATION` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| England and Wales Cricket Board | `SPORT_FEDERATION` | `validated` | `no_signal` | `validated` | `no_signal` | `validated` | `3/5` |
| FIFA | `SPORT_FEDERATION` | `validated` | `validated` | `no_signal` | `validated` | `validated` | `4/5` |
| UEFA | `SPORT_FEDERATION` | `validated` | `validated` | `validated` | `no_signal` | `no_signal` | `3/5` |
| FIBA | `SPORT_FEDERATION` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| World Athletics | `SPORT_FEDERATION` | `validated` | `no_signal` | `validated` | `validated` | `validated` | `4/5` |
| International Ski and Snowboard Federation | `SPORT_FEDERATION` | `validated` | `validated` | `no_signal` | `no_signal` | `validated` | `3/5` |
| Major League Cricket | `SPORT_LEAGUE` | `validated` | `validated` | `no_signal` | `no_signal` | `no_signal` | `2/5` |
| Premier League | `SPORT_LEAGUE` | `validated` | `validated` | `validated` | `validated` | `validated` | `5/5` |
| National Women's Soccer League | `SPORT_LEAGUE` | `validated` | `validated` | `no_signal` | `no_signal` | `validated` | `3/5` |
| Major League Soccer | `SPORT_LEAGUE` | `no_signal` | `no_signal` | `validated` | `no_signal` | `no_signal` | `1/5` |
| Formula 1 | `SPORT_LEAGUE` | `validated` | `validated` | `no_signal` | `validated` | `validated` | `4/5` |
| Women's Super League | `SPORT_LEAGUE` | `validated` | `validated` | `validated` | `no_signal` | `validated` | `4/5` |
| Bundesliga | `SPORT_LEAGUE` | `validated` | `validated` | `no_signal` | `no_signal` | `validated` | `3/5` |

## Related Tracked Notes

- `docs/plans/2026-04-07-question-first-25-entity-scale-results.md`
- `docs/plans/2026-04-07-question-first-25-entity-failure-segmentation.md`
- `apps/signal-noise-app/backend/data/question_first_scale_batch_25.json`
