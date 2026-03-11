# Chutes + BrightData Optimal Runtime Setup

This setup is tuned for the dossier-first pipeline path (`run_fixed_dossier_pipeline.py`) and reflects current code behavior in:
- `backend/claude_client.py`
- `backend/brightdata_sdk_client.py`

It is based on Context7 documentation for:
- Bright Data Python SDK (`/brightdata/sdk-python`)
- OpenAI Python client retry/timeout guidance (`/openai/openai-python`)
- HTTPX timeout/connection pool guidance (`/encode/httpx`)

## Recommended Environment

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
```

## Why These Values

- `CHUTES_MAX_RETRIES=2`: aligns with common OpenAI-compatible client behavior for transient 429/5xx/timeouts.
- `CHUTES_RETRY_BACKOFF_CAP_SECONDS=8` + jitter: reduces synchronized retry bursts under provider throttling.
- `BRIGHTDATA_*_TIMEOUT` and `SERP_POLL_*`: gives async SERP results enough time to materialize without stalling the pipeline.
- Explicit `BRIGHTDATA_SERP_ZONE` and `BRIGHTDATA_UNLOCKER_ZONE`: avoids cross-zone mismatches between `/serp/req` and `/request`.

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
