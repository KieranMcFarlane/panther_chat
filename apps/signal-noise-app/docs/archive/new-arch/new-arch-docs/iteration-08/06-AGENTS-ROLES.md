# Agents and Roles

Purpose
Define agent responsibilities and escalation patterns.

TL;DR
- Runtime agent handles user queries and tool use.
- Validation agent is used inside Ralph Loop.
- Schema evolution agent is offline-only (design intent).

Invariants / Non-negotiables
- Runtime agents do not mutate schema.
- Validation agent must not write without Ralph Loop.

Interfaces / Contracts
- Claude Agent SDK: @anthropic-ai/claude-agent-sdk
- Ralph Loop uses Claude for semantic validation.

Failure modes & mitigations
- Over-delegation: avoid using high-cost models unless required.

Concrete artifacts
- Runtime entry: src/app/api/copilotkit/route.ts
- Validation path: backend/ralph_loop.py

Where to go next
- RLM recursion: 07-RLM-RECURSION.md
