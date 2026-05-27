# Signal Noise FalkorDB Graph POC

Local-only proof of concept for relationship intelligence. This service talks to the
local FalkorDB container on `127.0.0.1:6379` and exposes a tiny API for graph search,
context retrieval, and upserts.

It is intentionally separate from the Pathway estate-planning assistant.

## Run

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8810
```

## Endpoints

- `GET /health`
- `POST /graph/upsert`
- `POST /graph/search`
- `POST /graph/context`

## Seed

```bash
node scripts/seed-signal-graph.mjs
```

## Example

```bash
curl -s http://127.0.0.1:8810/graph/context \
  -H 'content-type: application/json' \
  -d '{"query":"Find warm opportunities around clubs with tender activity where we know someone connected"}' \
  | python3 -m json.tool
```
