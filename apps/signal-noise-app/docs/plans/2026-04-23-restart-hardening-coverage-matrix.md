# Restart Hardening Coverage Matrix

This matrix defines what restart behavior is explicitly covered by automated regression tests today.

It does **not** claim the pipeline is antifragile. It classifies the tested restart outcomes only.

| Scenario | Required checkpoint quality | Expected result | Classification |
| --- | --- | --- | --- |
| Manual stop mid-question | `current_question_id` and `next_repair_question_id` present | Resume materializes a question-scoped repair run with `rerun_mode=question` and `cascade_dependents=false` | `question-resume` |
| Worker crash mid-question | `current_question_id` and `next_repair_question_id` present | Restart claim cycle prefers the unfinished repair question over widening back to a full entity rerun | `question-resume` |
| Completed batch with resumable metadata | terminal batch status, resumable question metadata present on the run | Resume logic ignores terminal batch status as the control plane and continues from run metadata/checkpoints | `question-resume` |
| Missing or partial checkpoint metadata | `current_question_id` present, `next_repair_question_id` missing | Resume follows the current deterministic fallback path and stays bounded to the current question when supported | `fallback` |

## Operational State Contracts

These UI/runtime classifications are also covered:

- stale or crashed worker with resumable rows surfaces as `stopped` / `worker_heartbeat_stale`, not healthy waiting
- stopped pipeline with resumable metadata surfaces as `resume_needed`, not silently completed
- normal queue exhaustion with no resumable work remains `waiting` / idle, not `stopped`

## Out of Scope

- generalized self-healing or automatic retry orchestration
- proof that every stop/restart mode is covered end to end
- any claim that missing or corrupt checkpoint data can always recover without manual inspection
