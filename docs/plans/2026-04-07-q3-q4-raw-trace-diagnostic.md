# `q3/q4` Raw Trace Diagnostic

## Scope

This note records the first diagnostic slice after preserving bounded
`raw_execution_trace` data in question-first artifacts.

The goal was not quality uplift. The goal was to determine whether recent
`tool_call_missing` outcomes were caused by:

- runtime/tool failure,
- retrieval finding partial evidence but failing final JSON output,
- genuinely absent public evidence,
- or a validator/acceptance problem.

## Diagnostic Slice

`q3_procurement_signal`:

- `celtic-fc`
- `major-league-cricket`

Run output:

- `/tmp/question-first-diagnostic-q3-trace-b/question_first_archetype_smoke.json`
- `/tmp/question-first-diagnostic-q3-trace-b/question_first_archetype_smoke.md`

`q4_decision_owner`:

- `fc-barcelona`
- `mls`

Run output:

- `/tmp/question-first-diagnostic-q4-trace-b/question_first_archetype_smoke.json`
- `/tmp/question-first-diagnostic-q4-trace-b/question_first_archetype_smoke.md`

## Contract Fix

The question-first run contract now promotes execution traces onto the canonical
merged question payload, not only the nested `question_first_answer` payload.

Fields promoted:

- `prompt_trace`
- `message_trace`
- `raw_execution_trace`

This makes the trace available at:

- `questions[].raw_execution_trace`
- `questions[].question_first_answer.raw_execution_trace`
- `merge_patch.questions[].raw_execution_trace`

## Result

All four diagnostic questions ended in the same failure shape:

- `validation_state = tool_call_missing`
- `raw_execution_trace.exit_code = 1`
- `raw_execution_trace.has_structured_output = false`
- `raw_execution_trace.assistant_text_excerpt = ""`
- no partial assistant answer
- no structured candidate
- no retained retrieval evidence

Representative stderr:

```text
Error: Unexpected error, check log file at /Users/kieranmcfarlane/.local/share/opencode/log/2026-04-07T121615.log for more details

error: Cannot find module '/Users/kieranmcfarlane/.cache/opencode/node_modules/opencode-copilot-auth' from '/$bunfs/root/src/index.js'
```

The same missing-module pattern appeared for:

| Entity | Question | Outcome | Primary Classification |
| --- | --- | --- | --- |
| `celtic-fc` | `q3_procurement_signal` | `tool_call_missing` | OpenCode runtime/config failure |
| `major-league-cricket` | `q3_procurement_signal` | `tool_call_missing` | OpenCode runtime/config failure |
| `fc-barcelona` | `q4_decision_owner` | `tool_call_missing` | OpenCode runtime/config failure |
| `mls` | `q4_decision_owner` | `tool_call_missing` | OpenCode runtime/config failure |

## Interpretation

This diagnostic slice does **not** support adding weak-signal fallback yet.

Reason:

- there was no assistant text to salvage,
- no candidate answer to downgrade,
- no raw retrieval evidence to reinterpret,
- and no validator rejection of a usable partial answer.

The immediate root cause is an execution/runtime dependency failure in the
OpenCode path:

- missing module: `opencode-copilot-auth`
- expected location: `/Users/kieranmcfarlane/.cache/opencode/node_modules/opencode-copilot-auth`

## Product Policy Decision

Keep **strict validated** mode as the baseline system of record.

Do **not** implement flagged `best_available_signal` mode yet.

Decision gate:

- only revisit weak-signal fallback after the execution path is healthy and
  artifacts show repeated useful partial evidence or candidate answers that
  strict validation rejects.

## Next Step

Fix or reconfigure the OpenCode runtime dependency path for
`opencode-copilot-auth`, then rerun the same four-question diagnostic slice.

Only after that rerun should the team decide whether the remaining failures are:

- true weak-surface evidence problems,
- retrieval/extraction problems,
- validator/acceptance problems,
- or still runtime/tooling problems.

## Follow-Up: Runtime Repaired

The local OpenCode cache was repaired by reinstalling dependencies from:

- `/Users/kieranmcfarlane/.cache/opencode/package.json`
- `/Users/kieranmcfarlane/.cache/opencode/bun.lock`

Verified cache packages:

- `/Users/kieranmcfarlane/.cache/opencode/node_modules/opencode-copilot-auth`
- `/Users/kieranmcfarlane/.cache/opencode/node_modules/opencode-anthropic-auth`

Direct smoke from `.worktrees/opencode-question-first-ssot` succeeded with
BrightData and returned the expected Arsenal founded-year JSON.

## Follow-Up Diagnostic Slice

Durable output root:

- `apps/signal-noise-app/tmp/question-first-diagnostics/2026-04-07-q3-q4-runtime-fixed-timeout-artifacts/`

The rerun required two launcher hardening changes:

- bounded single-question reruns now allow `120000ms` question timeout and `60000ms` hop timeout
- OpenCode child timeout now resolves into a `code=124` trace artifact instead of failing the whole entity

Results:

| Entity | Question | Outcome | Trace Classification |
| --- | --- | --- | --- |
| `celtic-fc` | `q3_procurement_signal` | `tool_call_missing` | timeout with retained BrightData search output |
| `major-league-cricket` | `q3_procurement_signal` | `validated` | structured answer produced |
| `fc-barcelona` | `q4_decision_owner` | `tool_call_missing` | timeout with retained BrightData search output |
| `mls` | `q4_decision_owner` | `tool_call_missing` | timeout with retained but noisy search output |

The missing-module failure is gone.

The remaining failures are now evidence/extraction-timeout cases, not OpenCode
startup failures.

Observed useful partial evidence:

- `celtic-fc` retained search output mentioning mobile app/platform manager and commercial partnership signals.
- `fc-barcelona` retained search output with plausible partnership-owner leads, including partnership director results.
- `mls` retained a large search trace but the visible tail was noisy and included real-estate MLS false positives.

## Updated Product Policy Decision

Do **not** add a broad product-level `best_available_signal` mode yet.

But the follow-up slice now justifies a narrower internal next step:

- add a timeout-salvage extraction pass for retained `raw_execution_trace.stdout_excerpt`
- keep the salvaged result explicitly marked as non-strict and non-validated
- use it only when `validation_state = tool_call_missing`, `exit_code = 124`, and retained stdout contains BrightData search/scrape evidence

This should be implemented as diagnostic/assistive recovery first, not counted
in baseline validation metrics.

## Follow-Up: Timeout Salvage Metadata

Implemented an internal `timeout_salvage` field for bounded timeout artifacts.
This is diagnostic metadata only and does not affect strict validation counts.

Emission gate:

- `validation_state = tool_call_missing`
- `raw_execution_trace.exit_code = 124`
- retained stdout contains BrightData search or scrape evidence

Artifact shape:

- `salvage_state = evidence_retained`
- `counts_as_validated = false`
- `candidate_summary`
- `candidate_evidence_urls`
- `risk_notes`

Durable diagnostic output root:

- `apps/signal-noise-app/tmp/question-first-diagnostics/2026-04-07-q3-q4-timeout-salvage/`

Final diagnostic rerun outputs:

- `q3-final/question_first_archetype_smoke.json`
- `q4-final/question_first_archetype_smoke.json`

Results:

| Entity | Question | Strict Outcome | Timeout Salvage | Assessment |
| --- | --- | --- | --- | --- |
| `celtic-fc` | `q3_procurement_signal` | `validated` | none | Strict path recovered; no salvage needed. |
| `major-league-cricket` | `q3_procurement_signal` | `tool_call_missing` timeout | yes | Retained streaming-platform evidence; useful as internal review signal, not validated. |
| `fc-barcelona` | `q4_decision_owner` | `tool_call_missing` timeout | none | No safe salvage candidate from the bounded excerpt. |
| `mls` | `q4_decision_owner` | `tool_call_missing` timeout | yes | Retained plausible executive/Apple partnership signal for Camilo Durana; useful as internal review signal, not validated. |

Policy decision remains unchanged:

- keep strict validated mode as the baseline system of record
- do not expose timeout salvage in the client UI yet
- do not count salvage as validated
- treat salvage as internal review/debug metadata until more examples show it is consistently useful and low-noise

Next decision gate:

- if future diagnostic slices repeatedly produce useful `timeout_salvage` for timed-out `q3/q4` cases, design a visible `weak signal / needs review` dossier section
- if salvage stays sparse or noisy, keep it internal only
