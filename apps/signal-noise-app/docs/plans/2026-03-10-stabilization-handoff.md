# Stabilization Handoff (2026-03-10)

## Delivered In This Execution

- Working-tree stabilization plan created and executed in batches.
- Generated-artifact boundary guard added and enforced in `.gitignore`.
- Graph runtime guard tightened for relationship payload contracts.
- Entity browser discovery path improved:
  - autocomplete endpoint wiring
  - apply-to-search behavior (no full reload on every keystroke)
  - popular-first default sorting and bounded first-load behavior
- Chutes streaming/dossier regression suite re-verified.
- Live queue-backed pipeline smoke run completed end-to-end:
  - batch: `import_1773155211741`
  - terminal phase: `dashboard_scoring`
- Build blockers fixed:
  - syntax error in `src/services/AutonomousRFPManager.ts`
  - client/server boundary import issue in `src/components/graph/GraphWrapper.tsx`

## Current Risks

- Phase 0 in the smoke run completed with `dossier_generation_timeout_degraded`.
- Streaming chunk diagnostics were not present on that specific run because degraded timeout fallback completed Phase 0.
- `npm run lint` is currently blocked by interactive Next.js ESLint setup prompt (no committed ESLint config yet).
- Build succeeded, but static generation logs include external fetch failures for data-dependent pages during build-time data collection.

## Rollback Point

- Conservative rollback point for the Chutes cutover itself: `73353cf`
- Rollback point before this stabilization batch began: `fa7e74f`

## Required Environment Keys (Minimum)

- `LLM_PROVIDER=chutes_openai`
- `OPENAI_BASE_URL=https://llm.chutes.ai/v1`
- `OPENAI_API_KEY` (Chutes key)
- `CHUTES_MODEL`
- `CHUTES_FALLBACK_MODEL`
- `CHUTES_STREAM_ENABLED=true`
- `CHUTES_TIMEOUT_SECONDS`
- `CHUTES_FALLBACK_TIMEOUT_SECONDS`
- `CHUTES_STREAM_IDLE_TIMEOUT_SECONDS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (for server-side write paths)
- `FALKORDB_URI`
- `FALKORDB_USER`
- `FALKORDB_PASSWORD`

## Local Validation Commands

```bash
# Guard + regression
node --test tests/test-falkordb-graph-rewire.mjs tests/test-feedback-remediation-contracts.mjs
pytest backend/tests/test_entity_pipeline_worker.py backend/tests/test_dossier_phase0_runtime.py -q
pytest backend/tests/test_claude_client_chutes.py backend/tests/test_dossier_generator_timeout.py backend/tests/test_pipeline_phase_update_payload.py -q

# Build
npm run build
```

## Next Priority Actions

1. Add committed ESLint config so `npm run lint` is non-interactive in CI/local.
2. Raise/segment Phase 0 timeout strategy so at least one non-degraded smoke run captures streaming diagnostics fields.
3. Add a targeted smoke for `inference_runtime.streaming=true` + `model_used` + `chunk_count` in run metadata.
