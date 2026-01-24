# LLM Handover Index

Purpose: Provide a context-efficient, high-signal map of the system. Read only what you need.

Recommended reading order
1) 00-INDEX.md (this file)
2) 01-OVERVIEW.md
3) 02-DATAFLOW.md
4) 03-SIGNAL-LIFECYCLE.md
5) 04-GRAPH-STACK.md
6) 05-RUNTIME-COPILOTKIT.md
7) 06-AGENTS-ROLES.md
8) 07-RLM-RECURSION.md
9) 08-ORCHESTRATION.md
10) 09-SCHEMA-GOVERNANCE.md
11) 10-OPS-TESTING.md
12) 11-BUSINESS-POSITIONING.md
13) 99-GLOSSARY.md

Task shortcuts (load only these)
- Validate or reject signals: 03-SIGNAL-LIFECYCLE.md, 04-GRAPH-STACK.md
- Answer user query in CopilotKit: 05-RUNTIME-COPILOTKIT.md, 04-GRAPH-STACK.md, 99-GLOSSARY.md
- Add new ingestion source: 02-DATAFLOW.md, 08-ORCHESTRATION.md
- Work on schema changes: 09-SCHEMA-GOVERNANCE.md
- Debug tool usage or latency: 05-RUNTIME-COPILOTKIT.md, 10-OPS-TESTING.md

Global invariants (never break)
- Graphiti is the authoritative system of record for structured signals.
- GraphRAG is discovery only; it never writes to the graph directly.
- Claude validates and structures candidate signals before any write.
- Ralph Loop enforces minimum evidence and confidence (min evidence=3, min confidence=0.7, max passes=3).
- Only validated signals are written.
- Tool boundaries matter: runtime agents should use approved MCP tools only.

If anything conflicts with these invariants, treat it as a bug or a design regression.
