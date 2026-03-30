# Agents and Roles

Purpose
Define the division of responsibilities between agents and models.

TL;DR
- Runtime agent handles user queries and tool use.
- Escalation agent handles complex reasoning or validation.
- Schema evolution is offline-only.

Roles
- Runtime agent: fast responses, tool use, no schema mutation.
- Validation agent: used within Ralph Loop for semantic checks.
- Schema agent: offline, proposes changes to fixed meta-schema.

Invariants
- Runtime cannot mutate schema.
- Escalation only for validation or high-risk reasoning.

Where to go next
- Tool recursion and budgets: 07-RLM-RECURSION.md
