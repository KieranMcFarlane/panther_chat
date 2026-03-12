# Graph Sync + Reconciliation Ops

## Purpose
Keep `cached_entities` and `entity_relationships` synchronized from graph source and automatically detect reconciliation drift.

## Required Environment
Set these values in `.env`/runtime config:

```bash
GRAPH_SYNC_BASE_URL=http://127.0.0.1:3005
GRAPH_SYNC_SCHEDULE=0 */6 * * *
GRAPH_SYNC_RUN_ON_START=true

RECON_MAX_EMBEDDINGS_NOT_IN_CACHED=0
RECON_MAX_ACTIONABLE_MISMATCHES=0
RECON_ALERT_WEBHOOK_URL=
```

## Manual Commands

```bash
# one reconciliation health check (non-zero exit on threshold breach)
npm run reconciliation:monitor

# start scheduler (runs startup sync unless GRAPH_SYNC_RUN_ON_START=false)
npm run sync:schedule
```

## Suggested Cron Wiring
Run scheduler as a managed process (preferred) or invoke monitor directly via cron.

```bash
# Every 15 minutes, run monitor and append logs
*/15 * * * * cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app && npm run reconciliation:monitor >> logs/reconciliation-monitor.log 2>&1
```

## Alert Semantics
- Breach when `embeddings_not_in_cached > RECON_MAX_EMBEDDINGS_NOT_IN_CACHED`
- Breach when `id_name_mismatches_actionable > RECON_MAX_ACTIONABLE_MISMATCHES`
- If `RECON_ALERT_WEBHOOK_URL` is set, breach payload is posted to webhook.

## Expected Healthy Output
`npm run reconciliation:monitor` returns JSON with:
- `"ok": true`
- `"embeddings_not_in_cached": 0`
- `"id_name_mismatches_actionable": 0`
