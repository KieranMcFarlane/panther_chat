# Graph Stack

Purpose
Explain storage and retrieval layers and their roles.

TL;DR
- FalkorDB is the primary graph store (Neo4j-compatible).
- Graphiti provides temporal graph primitives (episodes, signals, relationships).
- GraphRAG performs semantic discovery over unstructured evidence.

Invariants / Non-negotiables
- Graphiti is the authoritative memory for structured signals.
- GraphRAG is discovery-only.

Interfaces / Contracts
- Graphiti MCP: mcp-config.json (graphiti server)
- GraphitiService: backend/graphiti_service.py
- GraphRAG API: /api/graphrag

Failure modes & mitigations
- Graphiti service down: /api/graphrag falls back to direct graph or mock.
- GraphRAG weak evidence: Ralph Loop rejects candidates.

Concrete artifacts
- MCP config: mcp-config.json
- Graphiti MCP server: backend/graphiti_mcp_server_official
- GraphRAG route: src/app/api/graphrag/route.ts

Where to go next
- Runtime and tool usage: 05-RUNTIME-COPILOTKIT.md
- Schema rules: 09-SCHEMA-GOVERNANCE.md
