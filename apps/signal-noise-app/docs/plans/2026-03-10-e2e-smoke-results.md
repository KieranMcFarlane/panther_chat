# Phase 0 to Final E2E Smoke Results (2026-03-10)

## Runtime Status

- Next.js app: `http://localhost:3005` (running)
- Backend API: `backend/main.py` (running)
- Pipeline worker: `backend/entity_pipeline_worker.py` (running)

## Trigger

- Endpoint: `POST /api/entity-pipeline`
- Request payload:
  - `entity_id`: `pipeline-smoke-2026-03-10`
  - `name`: `Pipeline Smoke 2026-03-10 FC`
  - `entity_type`: `Club`
  - `sport`: `Football`
  - `country`: `England`
  - `source`: `manual_smoke`

## Run Identifiers

- `batchId`: `import_1773155211741`
- `entityId`: `pipeline-smoke-2026-03-10-fc`
- `statusUrl`: `/api/entity-import/import_1773155211741`

## Phase Progress

- Initial status: `queued`
- Worker-claimed status: `running` (`phase=dossier_generation`)
- Terminal status: `completed` (`phase=dashboard_scoring`)

## Outcome

- Batch status: `completed`
- Pipeline run status: `completed`
- Terminal phase: `dashboard_scoring`
- `sales_readiness`: `NOT_READY`
- `active_probability`: `0.05`
- `procurement_maturity`: `25`

## Dossier Phase Observations

- Phase 0 completed in degraded mode:
  - `reason`: `dossier_generation_timeout_degraded`
  - `timeout_seconds`: `180`
  - `collection_timed_out`: `true`
- Inference runtime metadata present:
  - `provider`: `chutes_openai`
  - `chutes_model`: `zai-org/GLM-5-TEE`
  - `chutes_timeout_seconds`: `45`
  - `chutes_max_retries`: `1`

## Notes

- End-to-end progression from queueing through final scoring is confirmed on the current runtime.
- This run did not expose streaming chunk diagnostics because Phase 0 timed out and used degraded completion.

## Direct Dossier Probe (Non-Queue Validation)

Follow-up direct dossier generation probe (forced refresh) for:
- `entity_id=streaming-diagnostics-probe-2026-03-10-c`
- `priority_score=10` (`BASIC` tier)

Result highlights:
- Response completed with `cache_status=FRESH`
- `metadata.inference_runtime` now includes non-null diagnostics fields:
  - `model_used="zai-org/GLM-5-TEE"`
  - `streaming=true`
  - `fallback_used=false`
  - `chunk_count=0`
  - `answer_channel_chars=0`
  - `reasoning_channel_chars=0`

Interpretation:
- Runtime metadata wiring is now stable even when dossier output falls back to minimal structured content.
