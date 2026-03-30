# LLM Handover Index (Iteration 08)

Purpose
Provide a context-efficient map of the system. Read only what you need.

Recommended reading order
1) 00-INDEX.md
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

Task shortcuts
- Validate signals or adjust quality gates: 03-SIGNAL-LIFECYCLE.md, 04-GRAPH-STACK.md
- Answer a user query in CopilotKit: 05-RUNTIME-COPILOTKIT.md, 04-GRAPH-STACK.md, 99-GLOSSARY.md
- Add or debug ingestion: 02-DATAFLOW.md, 08-ORCHESTRATION.md
- Change schema: 09-SCHEMA-GOVERNANCE.md
- Debug tool usage or latency: 05-RUNTIME-COPILOTKIT.md, 10-OPS-TESTING.md

Global invariants (never break)
- Graphiti is the authoritative system of record for structured signals.
- GraphRAG is discovery-only; it never writes to the graph directly.
- Claude validates and structures candidates before any write.
- Ralph Loop hard minimums: min evidence = 3, min confidence = 0.7, max passes = 3.
- Only validated signals are written.
- Runtime agents must stay within allowed MCP tool boundaries.

If anything conflicts with these invariants, treat it as a bug or regression.


Prompt library
- 12-PROMPTS-TOOLS-CONFIGS-VERBATIM.md (verbatim prompts, no distillation)
