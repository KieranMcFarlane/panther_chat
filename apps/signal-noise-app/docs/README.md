# Signal Noise App Docs

Current production architecture in this repo is FalkorDB + Supabase.

Historical Neo4j-era scripts, reports, and docs are preserved under [`legacy/neo4j/`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/legacy/neo4j) and should not be treated as active setup guidance.

## Overview

The active stack is:
- Next.js app routes and UI under `src/`
- FastAPI dossier and pipeline services under `backend/`
- Supabase as the canonical entity, dossier, event, and cache store
- FalkorDB as the active graph backend
- MCP integrations for graph queries, Bright Data, and external analysis services

## Active Architecture

```text
Next.js UI/API
  -> Supabase (canonical entities, dossiers, cache, events)
  -> FalkorDB (graph traversal and relationship queries)
  -> FastAPI pipeline + workers
  -> MCP services (graph, Bright Data, Perplexity, LLM providers)
```

## Local Setup

### Prerequisites

- Node.js and npm
- Python 3.12+ recommended for backend services
- Redis for worker or broker flows when those paths are needed
- Supabase project credentials
- FalkorDB connection details

### Environment

Use `.env` or `.env.local` with graph-aligned settings. The active graph-related variables are:

```bash
FALKORDB_URI=redis://...
FALKORDB_USER=default
FALKORDB_PASSWORD=...
FALKORDB_DATABASE=graph

GRAPH_MCP_URL=http://localhost:3004

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

Some compatibility flows still read `neo4j_id` as a legacy entity property or graph key. That is historical identity data, not a signal that Neo4j is still the live backend.

## Running the App

### Frontend

```bash
npm run dev
```

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Worker

```bash
celery -A backend.worker worker --loglevel=info
```

## Verification

Core repo guard:

```bash
node --test tests/test-falkordb-graph-rewire.mjs
```

Useful focused checks:

```bash
node --test tests/test-entity-dossier-generation-route.mjs
pytest backend/tests
```

## Local Pipeline Verification Runbook

Use this sequence for a quick Phase 0 to final pipeline check:

```bash
# 1) Start app/backend/worker
npm run dev
python backend/main.py
python backend/entity_pipeline_worker.py

# 2) Queue one entity run
curl -sS -X POST http://localhost:3005/api/entity-pipeline \
  -H 'Content-Type: application/json' \
  -d '{
    "entity_id":"pipeline-smoke-local",
    "name":"Pipeline Smoke Local FC",
    "entity_type":"Club",
    "sport":"Football",
    "country":"England",
    "source":"manual_smoke"
  }'

# 3) Poll status
curl -sS http://localhost:3005/api/entity-import/<batchId>
```

Expected terminal state:
- `batch.status=completed`
- `pipeline_runs[0].status=completed`
- `pipeline_runs[0].phase=dashboard_scoring`

## Troubleshooting

### FalkorDB

- Verify `FALKORDB_URI`, user, and password are correct.
- Confirm the URI scheme matches the deployment: `redis://` vs `rediss://`.
- Check whether the database is cold-starting before treating timeouts as application bugs.

### Supabase

- Confirm service-role credentials are set for server-side write paths.
- Verify canonical entity rows exist in `cached_entities`.
- Inspect `entity_dossiers` and `entity_relationships` when dossier or graph-backed pages look incomplete.

### Pipeline

- Use canonical entity UUIDs as the source of truth for dossier persistence.
- Inspect `entity_pipeline_runs` metadata before assuming a phase actually regenerated content.
- Check provider-specific runtime metadata when LLM results are unexpectedly minimal.

## Archive Boundary

Do not use root-level historical deployment or migration notes as active instructions unless they have been explicitly moved back out of [`legacy/neo4j/`](/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/legacy/neo4j).

If you need to revive an archived flow:
- rework it to FalkorDB + Supabase first
- remove hardcoded credentials
- add it back through the active guard suite before treating it as supported
