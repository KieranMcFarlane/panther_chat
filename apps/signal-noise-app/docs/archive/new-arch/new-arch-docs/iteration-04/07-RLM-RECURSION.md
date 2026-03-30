# RLM Recursion

Purpose
Define recursive reasoning loops and tool budgets.

TL;DR
- RLM loops are for controlled exploration, not open-ended reasoning.
- Tool call budgets and stop conditions must be enforced.
- Context should be navigated, not consumed.

Rules
- Hard caps on tool calls per query.
- Early stop once signal confidence or answer sufficiency is met.
- Store traversal state in a cache or session log.

Where to go next
- Orchestration details: 08-ORCHESTRATION.md
