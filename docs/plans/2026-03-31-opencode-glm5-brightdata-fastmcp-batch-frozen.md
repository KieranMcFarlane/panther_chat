# OpenCode + GLM-5 + BrightData FastMCP Batch Setup

Date: 2026-03-31

## Purpose
Freeze the working OpenCode question-first setup so we stop losing the transport and batch details in context.

This documents the path that is now working:
- OpenCode as the question runner
- `zai-coding-plan/glm-5` as the model
- BrightData FastMCP on `http://127.0.0.1:8000/mcp`
- the question-first worktree config as the source of truth
- the batch runner as the single-question / multi-question harness

## Verified Setup

### OpenCode worktree config
The question-first worktree config is:

- [/.worktrees/opencode-question-first-ssot/opencode.json](/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/opencode-question-first-ssot/opencode.json)

It is configured with:
- model: `zai-coding-plan/glm-5`
- provider label: `Z.AI Coding Plan`
- MCP transport: local `node` command
- MCP command: `node /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/mcp-brightdata-server.js`
- MCP env keeps BrightData on the local API token path; no streamableHttp BrightData server remains in the repo configs

### Runtime env
The repo env points the BrightData runtime at the local FastMCP service:

- [apps/signal-noise-app/.env](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env)

Key values:
- `BRIGHTDATA_FASTMCP_HOST=127.0.0.1`
- `BRIGHTDATA_FASTMCP_PORT=8000`
- `BRIGHTDATA_FASTMCP_URL=http://127.0.0.1:8000/mcp`
- `PIPELINE_USE_BRIGHTDATA_FASTMCP=true`
- `PIPELINE_USE_BRIGHTDATA_MCP=false`

### FastMCP launcher
The local service is launched by:

- [apps/signal-noise-app/scripts/start_brightdata_fastmcp_service.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/start_brightdata_fastmcp_service.py)

It starts BrightData FastMCP on:
- `127.0.0.1:8000`
- health endpoint: `/health`
- MCP endpoint: `/mcp`

## What Was Fixed

### 1. OpenCode was loading the wrong BrightData config
The repo-root batch path was letting the stale `.mcp.json` BrightData streamableHttp shape leak in.

Fix:
- the batch runner now resolves the dedicated question-first worktree root:
  - `/.worktrees/opencode-question-first-ssot`
- both repo MCP configs now point BrightData at the same local stdio bridge
- the repo-root stale BrightData streamableHttp server entry was removed

### 2. BrightData transport had to be a local stdio MCP command
The OpenCode config now uses:
- `type: "local"`
- `command: ["node", "/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/src/mcp-brightdata-server.js"]`
- `environment.BRIGHTDATA_API_TOKEN = "${BRIGHTDATA_API_TOKEN}"`

That local stdio server is the bridge OpenCode can load reliably. It keeps the BrightData story consistent with the rest of the repo configs and avoids the old streamableHttp path.

### 3. OpenCode needed a stricter answer contract
The prompt was tightened so the model:
- starts with search
- only scrapes if search is not enough
- returns exactly one fenced JSON block
- stops immediately after the first validated answer

This made the OpenCode output parseable by the batch runner.

### 4. The batch parser needed to tolerate prose plus fenced JSON
OpenCode often returns a short natural-language preface and then a fenced JSON block.

Fix:
- the batch parser now walks text events from the tail and extracts the last valid fenced JSON block
- this is why the Arsenal smoke now yields a validated artifact instead of an empty run

### 5. `scrape_batch` returned a list where the client expected a dict
The BrightData MCP path surfaced a `list` response for batch scrape.

Fix:
- `BrightDataMCPClient._call_tool()` now normalizes a JSON list into a dict-shaped result
- `BrightDataMCPClient.scrape_batch()` also defensively handles a raw list
- this removed the runtime error:
  - `Error calling tool 'scrape_batch': 'list' object has no attribute 'get'`

## Verified Logs

### Direct `glm-5` smoke
The simplest question works on the direct OpenCode path:

Question:
- `What year was Arsenal Football Club founded?`

Observed outcome:
- BrightData search returned consistent evidence from:
  - Wikipedia
  - Arsenal.com
  - Britannica
  - FootballHistory.org
- OpenCode emitted:
  - `{"answer":"1886","confidence":0.95,"sources":[...],"validation_state":"validated"}`

### Single-question batch smoke
The batch runner now also succeeds on the same question.

Observed output:
- `questions_total: 1`
- `questions_validated: 1`
- `validation_state: validated`

Artifact paths:
- `/tmp/glm5-single-question-out/arsenal-fc_opencode_batch_20260331_162530_meta.json`
- `/tmp/glm5-single-question-out/arsenal-fc_opencode_batch_20260331_162530_question_first_run_v1.json`

### Key transport evidence
The batch logs now show the good path:
- OpenCode loads the question-first worktree
- BrightData search tool is called
- the response comes from `mcp_client`
- the run exits cleanly

## Current Limitations

The remaining issue is the larger atomic discovery pack:
- search is working
- the list-shape scrape bug is fixed
- but the broader atomic pack may still take longer than the current timeout budget

The procurement/tender slice is intentionally separated into its own canary:
- the old `arsenal.com`-first q2b probe was too slow/fragile
- the repo now uses a web-first procurement canary instead:
  - [apps/signal-noise-app/backend/data/question_sources/arsenal_procurement_webfirst.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/question_sources/arsenal_procurement_webfirst.json)
- that canary should be treated as a fragile negative/slow path unless it validates quickly

That means:
- the transport is stable
- the parser is stable
- the scrape batch shape bug is fixed
- but we may still need a larger timeout or a smaller atomic slice for the full pack loop

## Practical Rules Going Forward

1. Use the question-first worktree config for all OpenCode smoke runs.
2. Keep BrightData routed through the local stdio server command shared by the repo configs.
3. Keep the FastMCP service on port 8000 for the app-side service path.
3. Use `zai-coding-plan/glm-5` for the batch smoke.
4. Treat plain text + fenced JSON as the expected OpenCode response shape.
5. Keep `scrape_batch` list normalization in `BrightDataMCPClient`.
6. If the atomic pack stalls, reduce the question slice before changing transport again.

## Files That Define This Setup

- [apps/signal-noise-app/scripts/opencode_agentic_batch.mjs](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/opencode_agentic_batch.mjs)
- [apps/signal-noise-app/backend/brightdata_mcp_client.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/brightdata_mcp_client.py)
- [apps/signal-noise-app/backend/brightdata_fastmcp_service.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/brightdata_fastmcp_service.py)
- [/.worktrees/opencode-question-first-ssot/opencode.json](/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/opencode-question-first-ssot/opencode.json)
- [apps/signal-noise-app/.env](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env)
