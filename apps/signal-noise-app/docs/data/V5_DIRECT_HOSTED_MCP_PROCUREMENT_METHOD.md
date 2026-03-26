# V5 Direct Hosted BrightData MCP Procurement Method

**Status:** Frozen canonical v5 discovery method
**Last Updated:** 2026-03-26

This document freezes the discovery method we use for procurement and RFP/tender work in v5.
If a run does not follow this flow, it is not the canonical procurement discovery path.

## Why This Is The Method

This is the method that proved the direct BrightData MCP procurement path works end to end:

- the query is explicit
- BrightData MCP returns a real search hit
- the returned result is scraped directly
- DeepSeek judges the evidence
- the judged answer is persisted for the next pipeline stage

The Major League Cricket procurement smoke is the canonical proof.

## Canonical Rule

Use **direct hosted BrightData MCP** as the only external retrieval transport for discovery.

Do not use any non-MCP retrieval path in the v5 discovery flow.

## Frozen Flow

1. Ingest the entity.
2. Build the dossier context.
3. Derive premium questions from the dossier.
4. Convert those questions into procurement-focused BrightData MCP queries.
5. Search using hosted BrightData MCP.
6. Scrape the top returned result via BrightData MCP.
7. Send the scraped evidence to DeepSeek as judge.
8. Persist only validated signals into Graphiti, FalkorDB, and Supabase.
9. Keep the dossier and plain-text transcript in sync with the result.

This flow is the production v5 method.

## Canonical Procurement Query Shape

For the procurement hop, the preferred query pattern is:

- `"{entity}" RFP tender procurement`
- `"{entity}" procurement tender RFP`
- `"{entity}" tender procurement`

These are the first queries the v5 discovery runtime should try for procurement work.

## Canonical Example

The remembered proof pattern is the Major League Cricket procurement smoke:

- Query: `Major League Cricket RFP tender procurement`
- Transport: `hosted_sse`
- Hosted endpoint: `https://mcp.brightdata.com/mcp?token=***`
- Search returned: `10` results
- Top result: a LinkedIn post indicating ACE issued an RFP for a Digital Transformation Project
- Scrape source: `search_result[0]`
- Judge: DeepSeek confirmed the opportunity signal

The persisted proof artifact is:

- [major_league_cricket_rfp_smoke.json](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/data/mcp_smokes/major_league_cricket_rfp_smoke.json)
- [major_league_cricket_rfp_smoke_v5_20260326_hosted.json](/Users/kieranmcfarlane/Downloads/panther_chat/.worktrees/v5-yellow-panther-canonical/apps/signal-noise-app/backend/data/mcp_smokes/major_league_cricket_rfp_smoke_v5_20260326_hosted.json)

## Code Entry Points

The method is implemented and exercised through:

- [apps/signal-noise-app/scripts/brightdata_mcp_fact_smoke.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/scripts/brightdata_mcp_fact_smoke.py)
- [apps/signal-noise-app/backend/brightdata_mcp_client.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/brightdata_mcp_client.py)
- [apps/signal-noise-app/backend/discovery_runtime_v2.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/discovery_runtime_v2.py)
- [apps/signal-noise-app/backend/objective_profiles.py](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend/objective_profiles.py)

## Expected Output Contract

Every run should persist:

- `query`
- `retrieval.transport`
- `retrieval.hosted_url`
- `retrieval.search_attempts`
- `retrieval.search_results`
- `retrieval.search_hit`
- `retrieval.scrape_source`
- `retrieval.scrape`
- `reasoning.model_used`
- `reasoning.structured_output`
- `reasoning.final_answer`

## Operational Guidance

- If the hosted MCP search returns no results, record `no_signal` and stop.
- If the search returns a hit, scrape the returned result instead of probing an unrelated URL.
- Only DeepSeek-validated evidence should be promoted into graph or persistence layers.
- Keep the question-first dossier and the procurement discovery pass separate, but chained.
- Use this document and its proof artifact as the reference point when updating code paths.
- If a future change introduces SDK fallback or a non-MCP retrieval lane into procurement discovery,
  that change should be treated as a regression against this frozen method.
