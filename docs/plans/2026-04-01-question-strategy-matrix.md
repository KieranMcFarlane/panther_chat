# Universal Atomic Matrix

Date: 2026-04-01

## Purpose
Freeze one atomic question strategy matrix and apply it to every entity.

The atomic strategy is universal:
- the same four question families are used everywhere
- only entity name, entity ID, and rendered query text change
- `no_signal` is a valid terminal result when evidence does not exist

This is the canonical operating guide for the current question-first setup.

Baseline hop policy:
- atomic questions start with an 8-hop baseline
- evidence extension is still allowed, but the matrix is tuned from an 8-hop starting point

## Canonical Matrix

### q1_foundation
- Note: direct factual lookup; keep it deterministic and fast.
- Best sources: `google_serp`, `official_site`, `wikipedia`
- Role: foundation / stable canary

### q2_launch_signal
- Note: broad web-first discovery for a public app, product, or digital platform signal.
- Best sources: `google_serp`, `news`, `press_release`, `linkedin_posts`, `official_site`
- Role: launch / product signal

### q3_procurement_signal
- Note: broad-first discovery for procurement, RFP, tender, or vendor-change evidence.
- Best sources: `google_serp`, `linkedin_posts`, `news`, `press_release`, `official_site`
- Role: procurement / RFP / tender

### q4_decision_owner
- Note: LinkedIn-heavy leadership search for commercial partnerships or business development.
- Best sources: `google_serp`, `linkedin_posts`, `linkedin_people_search`, `linkedin_person_profile`, `linkedin_company_profile`, `news`, `official_site`
- Role: decision owner / commercial lead

## Archetype Validation

Use the same matrix on three archetypes before scaling:

- Arsenal
  - club archetype
  - proves the baseline sport-entity path

- International Canoe Federation
  - federation archetype
  - proves the official-site / federation style path

- Major League Cricket
  - procurement archetype
  - proves the broad discovery and procurement signal path

## Source Files

Canonical checked-in sources:
- `/apps/signal-noise-app/backend/data/question_sources/arsenal_atomic_matrix.json`
- `/apps/signal-noise-app/backend/data/question_sources/icf_atomic_matrix.json`
- `/apps/signal-noise-app/backend/data/question_sources/major_league_cricket_atomic_matrix.json`

Generator:
- `/apps/signal-noise-app/backend/universal_atomic_matrix.py`

## Rules

1. Use the same strategy matrix for every entity.
2. Do not branch the atomic strategy by entity type.
3. Preserve the same hop/timeout/confidence policy across all archetypes.
4. Keep the matrix small and deterministic enough to validate end to end.
5. Treat `q2`, `q3`, and `q4` as legitimate terminal questions, not as special-case canaries.

## Test Plan

- Validate that the generator renders the same matrix for Arsenal, ICF, and MLC.
- Validate that the canonical source files exactly match the generator output.
- Run the end-to-end batch on the three archetypes and confirm:
  - question-first artifacts are written
  - the dossier/promoter path still accepts the output
  - the acceptance gate still works

## Rollout

1. Prove the matrix end to end on Arsenal, ICF, and MLC.
2. Sample a broader set of entities once the archetypes are stable.
3. Roll the same matrix into the full 3000+ entity batch.
4. Keep the execution model as scheduled batch, not an always-on worker.

