# Q3/Q4 Timeout Salvage Evidence Bundle

Compact evidence bundle for the q3/q4 timeout-salvage diagnostic slice.

## Contents

- `timeout_salvage_evidence.json`: compact status matrix and extracted `timeout_salvage` fields.

## Provenance

- Local raw artifact root: `/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/tmp/question-first-diagnostics/2026-04-07-q3-q4-timeout-salvage`
- Raw `apps/signal-noise-app/tmp/` artifacts are generated runtime outputs and are intentionally not tracked.
- Diagnostic interpretation is also recorded in `docs/plans/2026-04-07-q3-q4-raw-trace-diagnostic.md`.

## Result Matrix

| Entity | Question | Strict Outcome | Timeout Salvage | Assessment |
| --- | --- | --- | --- | --- |
| `celtic-fc` | `q3_procurement_signal` | `validated` | none | strict validated; no salvage needed |
| `major-league-cricket` | `q3_procurement_signal` | `tool_call_missing` | yes | internal review signal retained |
| `fc-barcelona` | `q4_decision_owner` | `tool_call_missing` | none | no safe salvage candidate |
| `mls` | `q4_decision_owner` | `tool_call_missing` | yes | internal review signal retained |

## Policy

- Strict validation remains the system-of-record baseline.
- `timeout_salvage` is non-strict internal metadata only.
- `timeout_salvage` does not count as validated.
- Do not expose salvage in the client UI until more examples prove it is consistently useful and low-noise.
