# Pinned Client Smoke Regeneration Evidence Bundle

Compact evidence bundle for the dedicated pinned-entity question-first regeneration pass.

## Contents

- `pinned_client_smoke_regeneration.json`: manifest path, promoted artifacts, and per-entity readiness classification.

## Provenance

- Dedicated manifest: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_first_pinned_client_smoke_batch.json`
- Local raw artifact root: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tmp/question-first-diagnostics/2026-04-08-pinned-client-regeneration`
- Raw `apps/signal-noise-app/tmp/` artifacts are generated runtime outputs and are intentionally not tracked.

## Result Matrix

| Entity | Classification | Promotion | Notes |
| --- | --- | --- | --- |
| `arsenal` | `generated_but_not_ready` | no | q1 and q2 validated in state, but no final canonical run/dossier artifact emitted yet |
| `coventry-city` | `generated_but_not_ready` | no | q1 validated in state, but no final canonical run/dossier artifact emitted yet |
| `zimbabwe-cricket` | `generated_but_not_ready` | no | q1 and q2 validated in state, but no final canonical run/dossier artifact emitted yet |
| `major-league-cricket` | `ready_canonical` | yes | promoted existing real ready run artifact from the question-first SSOT worktree |
| `zimbabwe-handball-federation` | `no_artifact` | no | no state or final canonical artifact emitted during the captured pass |

## Policy

- Strict validation remains the source of truth.
- The client smoke strip may shrink to only truly ready canonical dossiers.
- No placeholder, legacy fallback, or timeout-salvage artifact qualifies an entity for the client path.
