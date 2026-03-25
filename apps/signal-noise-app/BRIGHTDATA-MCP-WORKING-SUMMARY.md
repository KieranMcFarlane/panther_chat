# BrightData MCP Working Summary

This document captures how the BrightData MCP path was made to work in the signal-noise app, what actually proved it, and where the remaining boundaries are.

## What we wanted

We wanted Bright Data to be the discovery layer, with a persistent MCP endpoint available for repeated searches and scrapes, and with the LLM reasoning over retrieved evidence instead of acting as the transport itself.

## What finally worked

The working path is now:

1. A persistent local FastMCP service runs on `http://127.0.0.1:8000/mcp`.
2. That service connects to Bright Data MCP over hosted SSE.
3. The Bright Data client is created through `backend/brightdata_client_factory.py`.
4. Hosted Bright Data search runs first.
5. If search returns hits, the smoke scrapes the first search result URL.
6. DeepSeek (`deepseek-ai/DeepSeek-V3.2-TEE`) reasons over the scraped evidence.
7. The run is persisted as a JSON report.

The hosted Bright Data endpoint we use is:

```text
https://mcp.brightdata.com/sse?token=YOUR_API_TOKEN_HERE
```

## Why this was hard

The early attempts failed for three different reasons:

- the old stdio path could cold-start slowly and hang
- the hosted Bright Data search payload needed normalization (`organic` results were not being mapped correctly)
- some queries were too weak to return search hits, which made the search step look broken when the transport was actually fine

The important distinction was:

- `status: success` with `result_count: 0` means the tool call worked, but the search backend returned no matches
- `search_hit: true` means the MCP search actually returned URLs, and the smoke scraped one of those URLs directly

## What we changed in code

- `backend/brightdata_mcp_client.py`
  - prefers the hosted SSE transport
  - maps Bright Data hosted search responses into a normalized `results` list
  - keeps the transport boundary explicit in the report

- `scripts/brightdata_mcp_fact_smoke.py`
  - searches first
  - records `search_hit`, `search_empty`, `scrape_used`, and `scrape_source`
  - scrapes `search_result[0]` when search hits exist
  - persists the report to disk

- `backend/tests/test_brightdata_mcp_client_hosted.py`
  - verifies the hosted transport path and the hosted result normalization

- `backend/tests/test_brightdata_mcp_fact_smoke.py`
  - verifies the report separates search, scrape, and reasoning

## Proof runs

These are the cleanest proof artifacts:

- OpenAI search hit and scrape:
  - `apps/signal-noise-app/backend/data/mcp_smokes/openai_non_sports_mcp_fact_smoke.json`

- Chelsea titles proof:
  - `apps/signal-noise-app/backend/data/mcp_smokes/chelsea_non_sports_mcp_fact_smoke.json`

- Major League Cricket RFP proof:
  - `apps/signal-noise-app/backend/data/mcp_smokes/major_league_cricket_rfp_smoke.json`

What those reports show:

- Bright Data MCP search is live
- search can return actual hits
- the smoke can scrape the returned result URL
- DeepSeek can reason over that evidence
- the final answer is persisted in the JSON report

## What to look for in a healthy report

The report should contain all of these:

```json
{
  "retrieval": {
    "transport": "hosted_sse",
    "search_hit": true,
    "search_empty": false,
    "scrape_used": true,
    "scrape_source": "search_result[0]"
  },
  "reasoning": {
    "model_used": "deepseek-ai/DeepSeek-V3.2-TEE"
  }
}
```

## Current limitations

- Search quality is query-dependent.
- A `success` result with zero hits is not a transport failure; it just means the query did not surface matches.
- The proof smoke is intentionally simple. It proves the MCP/search/scrape/reasoning chain, not full procurement intelligence coverage.

## Bottom line

Bright Data MCP is now working as the discovery transport, FastMCP keeps the service hot for local development, and DeepSeek handles the reasoning step over the evidence that Bright Data returns.
