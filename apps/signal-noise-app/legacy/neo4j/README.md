# Neo4j Legacy Archive

This directory contains historical Neo4j-era scripts, reports, migration artifacts, and backend utilities kept for reference.

Active production architecture in this repo is FalkorDB + Supabase.

Archive rules:
- Files here are preserved for historical context only.
- Active runtime paths under `src/`, current MCP surfaces, and current sync flows should not depend on this archive.
- Historical backend utilities live under `legacy/neo4j/backend/`.
- Historical deployment and implementation docs live under `legacy/neo4j/docs/`.
- Historical reports and generated outputs live under `legacy/neo4j/reports/`.
- If a legacy script needs to be revived, it should be reworked into graph/FalkorDB-aligned tooling before reuse.
