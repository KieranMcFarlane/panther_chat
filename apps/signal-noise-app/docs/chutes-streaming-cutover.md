# Chutes Streaming Cutover (Global `chutes_openai`)

## What changed

The `chutes_openai` transport is now streaming-first for all `ClaudeClient.query()` calls:

- Endpoint: `POST /v1/chat/completions`
- Mode: `stream=true` by default
- Parsing: SSE `data:` frames only, `[DONE]` terminator supported
- Output policy: business output uses answer channel (`delta.content`) only
- Reasoning channel (`delta.reasoning_content`) is captured for diagnostics only

For dossier generation, JSON parsing was tightened:

- Old behavior: first regex match
- New behavior: parse and accept the **last valid JSON object/array block** from model output

This reduces failures from partial/early JSON fragments in reasoning-heavy responses.

## Runtime fallback behavior

For retryable failures and empty answer-channel responses:

1. Try `CHUTES_MODEL`
2. Switch to `CHUTES_FALLBACK_MODEL`
3. Use extended timeout for fallback attempts
4. Preserve existing degraded Phase 0 safety if both attempts fail

## New/updated env contract

Required/primary knobs:

- `LLM_PROVIDER=chutes_openai`
- `CHUTES_API_KEY`
- `CHUTES_BASE_URL=https://llm.chutes.ai/v1`
- `CHUTES_MODEL`
- `CHUTES_FALLBACK_MODEL`
- `CHUTES_STREAM_ENABLED=true`
- `CHUTES_TIMEOUT_SECONDS` (primary)
- `CHUTES_FALLBACK_TIMEOUT_SECONDS` (fallback)
- `CHUTES_STREAM_IDLE_TIMEOUT_SECONDS` (read idle guard)
- `CHUTES_MAX_RETRIES`

## Diagnostics added

`ClaudeClient.query()` now emits additive diagnostics under `inference_diagnostics`, and Phase 0 stores these under `inference_runtime`:

- `streaming`
- `model_used`
- `fallback_used`
- `chunk_count`
- `stop_reason`
- `answer_channel_chars`
- `reasoning_channel_chars`

## Validation performed

- Unit tests for SSE parsing, fallback switching, timeout fallback behavior
- Unit tests for dossier last-valid-JSON extraction
- Pipeline metadata tests for new inference runtime fields
- Live smoke run confirming persisted streaming diagnostics in `entity_pipeline_runs.metadata.phase_details_by_phase.dossier_generation.inference_runtime`
