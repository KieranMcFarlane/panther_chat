# Connections Telemetry Result

Date: 2026-04-06

## Scope

Measured the live `connections_graph` enrichment layer across the 10-entity scale batch using:

- existing `question_first_run_v1` artifacts from `/tmp/question-first-scale-batch-10-rerun`
- `QUESTION_FIRST_ENABLE_CONNECTIONS_ENRICHMENT=1`
- current role-aware direct probes, profile-URL direct probes, strict mutual-name filtering, and optional bridge-contact seeding

## Batch Artifact

- Summary JSON: `/tmp/question-first-connections-telemetry-batch-live/connections_telemetry_summary.json`

## Aggregate Result

```json
{
  "entities_total": 10,
  "pair_attempts": 36,
  "direct_hits": 0,
  "direct_profile_url_hits": 0,
  "mutual_hits": 0,
  "filtered_mutual_names": 0,
  "observations_total": 0
}
```

## Interpretation

- The enrichment path is executing.
- The telemetry is recording attempts correctly.
- The current BrightData/LinkedIn probe strategy is not producing usable warm-path edges at meaningful rate.

This means the connections layer should currently be treated as:

- optional
- best-effort
- non-blocking
- sparse opportunistic signal, not a baseline dependency

## Current Recommendation

Do not keep tuning this path blindly.

Preferred next moves:

1. provide real bridge-contact input data where available
2. use a richer relationship-capable source if warm intros are strategically important
3. keep `connections_graph` enrichment enabled only as a premium/supplementary layer, not part of the core success path

## Operational Note

The live runs still emit BrightData stdio shutdown noise after successful dossier writes:

- `RuntimeError: Attempted to exit cancel scope in a different task than it was entered in`

This appears to be transport cleanup noise rather than dossier-generation failure, but it should be cleaned up separately in `brightdata_mcp_client.py`.
