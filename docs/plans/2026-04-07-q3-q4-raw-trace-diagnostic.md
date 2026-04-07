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
