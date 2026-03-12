# Chutes + BrightData Optimal Runtime Setup

This setup is tuned for the dossier-first pipeline path (`run_fixed_dossier_pipeline.py`) and reflects current code behavior in:
- `backend/claude_client.py`
- `backend/brightdata_sdk_client.py`

It is based on Context7 documentation for:
- Bright Data Python SDK (`/brightdata/sdk-python`)
- OpenAI Python client retry/timeout guidance (`/openai/openai-python`)
- HTTPX timeout/connection pool guidance (`/encode/httpx`)

## Recommended Environment (Reliability-First)

```bash
# Chutes (OpenAI-compatible)
LLM_PROVIDER=chutes_openai
CHUTES_API_KEY=...
CHUTES_BASE_URL=https://llm.chutes.ai/v1
CHUTES_MODEL=zai-org/GLM-5-TEE
CHUTES_FALLBACK_MODEL=moonshotai/Kimi-K2.5-TEE
CHUTES_TIMEOUT_SECONDS=45
CHUTES_FALLBACK_TIMEOUT_SECONDS=90
CHUTES_STREAM_IDLE_TIMEOUT_SECONDS=45
CHUTES_STREAM_ENABLED=true
CHUTES_MAX_RETRIES=2
CHUTES_RETRY_BACKOFF_CAP_SECONDS=8
CHUTES_RETRY_JITTER_SECONDS=0.5
CHUTES_429_POLICY=header_exponential
CHUTES_CIRCUIT_BREAK_ON_QUOTA=true
CHUTES_CIRCUIT_TTL_SECONDS=300
CHUTES_CIRCUIT_TTL_MULTIPLIER=2.0
CHUTES_CIRCUIT_TTL_MAX_SECONDS=1800
LLM_PROVIDER_VALIDATION_STRICT=true

# BrightData
BRIGHTDATA_API_TOKEN=...
BRIGHTDATA_API_URL=https://api.brightdata.com
BRIGHTDATA_SERP_ZONE=sdk_serp
BRIGHTDATA_UNLOCKER_ZONE=sdk_unlocker
BRIGHTDATA_SDK_TIMEOUT_SECONDS=60
BRIGHTDATA_SERP_TIMEOUT_SECONDS=35
BRIGHTDATA_SERP_POLL_ATTEMPTS=10
BRIGHTDATA_SERP_POLL_INTERVAL_SECONDS=1.5

# Discovery time budgets
DISCOVERY_SEARCH_TIMEOUT_SECONDS=12
DISCOVERY_SEARCH_VALIDATION_TIMEOUT_SECONDS=5
DISCOVERY_URL_RESOLUTION_TIMEOUT_SECONDS=12
DISCOVERY_HEURISTIC_FALLBACK_ON_LLM_UNAVAILABLE=true
```

## Why These Values

- `CHUTES_MAX_RETRIES=2`: aligns with common OpenAI-compatible client behavior for transient 429/5xx/timeouts.
- `CHUTES_RETRY_BACKOFF_CAP_SECONDS=8` + jitter: reduces synchronized retry bursts under provider throttling.
- `CHUTES_CIRCUIT_BREAK_ON_QUOTA=true`: prevents tight failure loops when Chutes returns quota exhaustion (`429` / code `1113`).
- `CHUTES_CIRCUIT_TTL_SECONDS=300`, `...MULTIPLIER=2.0`, `...MAX=1800`: quota circuit reset windows become `5m -> 10m -> 20m -> 30m cap`.
- Circuit resets are reason-aware:
  - `kind=quota`: auto-resets when cooldown window expires.
  - `kind=env`: never auto-resets.
- A successful LLM response resets quota trip-count and circuit state.
- `BRIGHTDATA_*_TIMEOUT` and `SERP_POLL_*`: gives async SERP results enough time to materialize without stalling the pipeline.
- Explicit `BRIGHTDATA_SERP_ZONE` and `BRIGHTDATA_UNLOCKER_ZONE`: avoids cross-zone mismatches between `/serp/req` and `/request`.

## Trial Evidence (Current Branch)

- Unit tests:
  - `pytest -q backend/tests/test_claude_client_chutes.py` -> pass
  - Added coverage for:
    - quota-circuit TTL expiry
    - env-disable non-expiry
    - exponential quota cooldown growth + max cap
- Live checks:
  - `GET https://api.chutes.ai/ping` -> `200`
  - `GET https://llm.chutes.ai/v1/models` -> `200`
  - Chat completion test for `zai-org/GLM-5-TEE` and `moonshotai/Kimi-K2.5-TEE` -> `200`
  - 3-entity single-pass verification run:
    - all entities stayed on `evaluation_mode=llm` in that run
    - no quota-circuit sticky disable observed

## Is This "Optimal"?

For this pipeline and current provider behavior: **yes, this is the best reliability-first profile tested so far**.
It is not globally optimal for all workloads. If your quota headroom improves and you want faster recovery:

- Faster recovery profile:
  - `CHUTES_CIRCUIT_TTL_SECONDS=120`
  - `CHUTES_CIRCUIT_TTL_MULTIPLIER=1.5`
  - `CHUTES_CIRCUIT_TTL_MAX_SECONDS=900`
- Safer profile under repeated quota exhaustion:
  - keep `300 / 2.0 / 1800` (current recommendation)

## Validation Steps

1. Run BrightData hello-world checks:
```bash
python3 scripts/check-brightdata-hello.py
```
2. Run targeted runtime smoke:
```bash
bash scripts/check-pipeline-runtime.sh
```
3. Run single-entity dossier pipeline:
```bash
PYTHONPATH=backend python3 run_fixed_dossier_pipeline.py
```

4. Run 3-entity discovery verification (single-pass):
```bash
# Use your existing single-pass batch command/path in this repo and confirm:
# - evaluation_mode remains "llm"
# - llm_last_status is not "quota_exhausted"
# - llm_circuit_broken remains false during healthy quota periods
```
