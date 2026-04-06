# Question-First Current State

Date: 2026-04-06

## What is stable

- The three-archetype canonical smoke is stable end to end.
- The 10-entity scale batch runs to completion.
- The wrapper now correctly detects timestamped `*_question_first_run_v1.json` artifacts.
- `q2_digital_stack` is the strongest question at scale.
- `q4_decision_owner` and `q5_related_pois` are now stable enough to use in production dossiers.

## Current baseline metrics

From the latest completed 10-entity scale run:

- `entities_total`: 10
- `entities_completed`: 10
- `entities_failed`: 0
- `q1_foundation`: 9 validated, 1 no_signal
- `q2_digital_stack`: 9 validated, 1 no_signal
- `q3_procurement_signal`: 8 validated, 2 no_signal
- `q4_decision_owner`: 9 validated, 1 no_signal
- `q5_related_pois`: 9 validated, 1 no_signal

## Archetype notes

- Clubs are the noisiest entity type overall.
- Federations are the strongest entity type overall.
- Leagues sit in the middle.
- Celtic was the clearest noisy club case before tuning.

## Celtic status

Celtic now has a dedicated club override for:

- `q1_foundation`
- `q3_procurement_signal`
- `q4_decision_owner`
- `q5_related_pois`

The current intent is:

- `q1` should use full club naming and official history sources.
- `q3` should bias toward commercial partnerships, sponsorship, official partners, and platform work.
- `q4` / `q5` should use club-commercial wording instead of a generic leader search.

The latest Celtic procurement retune still returned `no_signal` on `q3`, even after the official-site-first commercial-partnership queries were added. That makes Celtic a useful example of a club with weak procurement surface rather than a query-shape bug.

## Remaining weak spots

- `q3_procurement_signal` is still the main unresolved question family.
- ICF remains the most specialized case and already has its own tender-doc path.
- Celtic is the club case to keep watching after the procurement tuning.

## Operational takeaway

The system is now suitable for controlled scaling, with targeted tuning only where the scale run shows a clear gap.
