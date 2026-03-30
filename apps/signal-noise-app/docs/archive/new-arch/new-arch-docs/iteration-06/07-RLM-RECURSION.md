# RLM Recursion

Purpose
Define recursive reasoning loops and tool budgets.

TL;DR
- RLM loops are controlled exploration, not open-ended reasoning.
- Tool call budgets and stop conditions must be enforced.
- Context should be navigated, not consumed.

Invariants / Non-negotiables
- Hard caps on tool calls.
- Stop once answer sufficiency is reached.

Interfaces / Contracts
- RLM concepts live in plan-new-infra.md (design intent).

Failure modes & mitigations
- Unbounded recursion increases cost and latency. Enforce caps.

Concrete artifacts
- Design context: new-arch-docs/plan-new-infra.md

Where to go next
- Orchestration: 08-ORCHESTRATION.md
