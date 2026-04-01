# OpenCode + BrightData FastMCP Setup

> **Date:** 2026-03-31

## Purpose

This note captures the working setup for the question-first discovery path so we stop re-discovering the same OpenCode / BrightData / FastMCP wiring.

The canonical working shape is:

1. OpenCode runs the question-first prompt loop.
2. OpenCode uses the local BrightData FastMCP service.
3. The FastMCP service listens on `127.0.0.1:8000`.
4. OpenCode returns validated JSON.

## What the setup looks like now

### Environment

[`apps/signal-noise-app/.env`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/.env) already carries the FastMCP runtime settings:

```bash
BRIGHTDATA_FASTMCP_HOST=127.0.0.1
BRIGHTDATA_FASTMCP_PORT=8000
BRIGHTDATA_FASTMCP_URL=http://127.0.0.1:8000/mcp
PIPELINE_USE_BRIGHTDATA_FASTMCP=true
PIPELINE_USE_BRIGHTDATA_MCP=false
```

### OpenCode config

The active question-first worktree config is:

[`/.worktrees/opencode-question-first-ssot/opencode.json`](/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/opencode-question-first-ssot/opencode.json)

The important bit is the local MCP launcher:

```json
"mcp": {
  "brightData": {
    "type": "local",
    "enabled": true,
    "command": [
      "python3",
      "apps/signal-noise-app/scripts/start_brightdata_fastmcp_service.py"
    ]
  }
}
```

That config also tells OpenCode to use the `Z.AI Coding Plan` provider. If a manual login is needed, the OpenCode docs say to use:

```bash
opencode auth login
```

and choose `Z.AI Coding Plan`.

## How it was fixed

The setup kept getting lost because the transport boundary was spread across multiple places:

- `.env` had the port and FastMCP URL
- the OpenCode config had the local launcher
- the question-first batch path had to be run from the correct worktree
- the repository also still contains older BrightData compatibility paths

The working fix is to treat the question-first worktree config as the source of truth for the smoke:

- launch `start_brightdata_fastmcp_service.py`
- keep it on port `8000`
- run OpenCode from `.worktrees/opencode-question-first-ssot`
- rely on the local FastMCP service, not the old hosted or fallback path

## Known-good terminal proof

### FastMCP service is listening on port 8000

```bash
$ lsof -nP -iTCP:8000 -sTCP:LISTEN
COMMAND   PID            USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
Python  45125 kieranmcfarlane    6u  IPv4 0xdd13d574e18494e4      0t0  TCP 127.0.0.1:8000 (LISTEN)
```

### Direct OpenCode smoke from the question-first worktree

Command:

```bash
cd .worktrees/opencode-question-first-ssot
OPENCODE_TEE_LOGS=true opencode run --format json --model zai-coding-plan/glm-5 --title 'FastMCP smoke' 'What year was Arsenal Football Club founded? use brightdata'
```

Observed output:

```json
{
  "entity": "Arsenal Football Club",
  "fact": {
    "year_founded": 1886
  },
  "source": "BrightData MCP knowledge base",
  "confidence": "high"
}
```

### Why this matters

That run proves:

- OpenCode is launching correctly
- the local BrightData FastMCP service is reachable
- the prompt path can get a validated answer through the intended transport

## Reproduction checklist

If you need to verify the stack again:

1. Confirm port `8000` is listening.
2. Start OpenCode from `.worktrees/opencode-question-first-ssot`.
3. Use the question-first prompt with `use brightdata`.
4. Expect a validated JSON answer rather than prose.

## Notes

- The repo still contains older BrightData compatibility paths. Those are historical or fallback paths and should not be treated as the primary setup for the question-first smoke.
- OpenCode provider auth is already present in the repo environment here, so the smoke did not require an extra login step.
- If a future environment lacks provider credentials, use `opencode auth login` and select `Z.AI Coding Plan`.
