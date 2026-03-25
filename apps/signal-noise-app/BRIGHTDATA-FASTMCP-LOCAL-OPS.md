# BrightData FastMCP Local Ops

This is the recommended way to run BrightData MCP for the pipeline during local development.

## Why this exists

The direct `npx @brightdata/mcp` startup path can be slow to cold-start inside the pipeline.  
For local work, we run a persistent FastMCP service on localhost and point the pipeline at it.

## Start the service

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
export BRIGHTDATA_API_TOKEN="$BRIGHTDATA_API_TOKEN"
export BRIGHTDATA_FASTMCP_HOST=127.0.0.1
export BRIGHTDATA_FASTMCP_PORT=8000
python3 scripts/start_brightdata_fastmcp_service.py
```

The service listens on:

- `http://127.0.0.1:8000/mcp`
- `http://127.0.0.1:8000/health`

## Pipeline env vars

Set these before running the pipeline:

```bash
export BRIGHTDATA_FASTMCP_URL=http://127.0.0.1:8000/mcp
export PIPELINE_USE_BRIGHTDATA_FASTMCP=true
export PIPELINE_BRIGHTDATA_SHARED_CLIENT=true
export BRIGHTDATA_MCP_WARM_SERVICE=true
```

Optional timeouts:

```bash
export BRIGHTDATA_FASTMCP_WARMUP_TIMEOUT_SECONDS=60
export BRIGHTDATA_MCP_TIMEOUT_SECONDS=20
```

## What the pipeline does

1. The pipeline creates a BrightData client through `backend/brightdata_client_factory.py`.
2. If `BRIGHTDATA_FASTMCP_URL` is set, it prefers the local FastMCP client.
3. The client prewarms once and is cached for the run.
4. Search and scrape calls go through the FastMCP service instead of cold-starting an MCP subprocess.

## Where this applies

FastMCP is now used by the main pipeline paths:

- `run_fixed_dossier_pipeline.py`
- `backend/main.py`
- `backend/temporal_sweep_scheduler.py` when no explicit BrightData client is injected

These remain on the direct SDK path by design so they can serve as control arms:

- dual-compare control/candidate runtime clients
- explicit test fixtures that inject `BrightDataSDKClient`

This keeps the operational pipeline on FastMCP while preserving meaningful comparisons.

## Sanity checks

```bash
curl -fsS http://127.0.0.1:8000/health
```

Expected response:

```text
OK
```

You can also watch the service logs by running it in a foreground shell.

## Production note

For production, run the FastMCP service as a persistent process under a supervisor
instead of starting it on demand inside each pipeline execution.
