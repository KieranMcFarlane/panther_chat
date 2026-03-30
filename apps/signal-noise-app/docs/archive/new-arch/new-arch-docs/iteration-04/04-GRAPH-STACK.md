# Graph Stack

Purpose
Explain the storage and retrieval layers and their roles.

TL;DR
- FalkorDB is the primary graph store (Neo4j-compatible).
- Graphiti provides temporal graph primitives (episodes, relationships, semantic search).
- GraphRAG is discovery and retrieval over unstructured data.

Roles
- FalkorDB: physical graph storage, relationships, traversal.
- Graphiti: temporal knowledge graph API (episodes, evidence, signals).
- GraphRAG: semantic clustering and retrieval when graph structure is insufficient.

Invariants
- Graphiti is the source of truth for structured signals.
- GraphRAG never writes; only proposes.

Interfaces/Contracts
- Graphiti MCP server (tools: search_nodes, get_episodes, add_memory).
- GraphitiService (Python) for signals, timelines, and patterns.
- GraphRAG API: /api/graphrag

Failure modes
- Graphiti service unavailable -> fallback to direct graph or mock.
- GraphRAG returns weak candidates -> Ralph Loop rejects.

Where to go next
- Runtime and tool usage: 05-RUNTIME-COPILOTKIT.md
- Signal lifecycle: 03-SIGNAL-LIFECYCLE.md
