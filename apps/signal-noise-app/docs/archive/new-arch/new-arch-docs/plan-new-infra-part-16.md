1️⃣ RLM Tool Contracts (Claude Agent SDK)
These tools define the external environment Claude is allowed to recurse through.
Tool: list_sources
{
  "name": "list_sources",
  "description": "List available data sources for an entity",
  "input_schema": {
    "type": "object",
    "properties": {
      "entity_id": { "type": "string" }
    },
    "required": ["entity_id"]
  }
}


Tool: search_source
{
  "name": "search_source",
  "description": "Search within a specific source",
  "input_schema": {
    "type": "object",
    "properties": {
      "source": { "type": "string" },
      "query": { "type": "string" }
    },
    "required": ["source", "query"]
  }
}


Tool: open_fragment
{
  "name": "open_fragment",
  "description": "Open a specific fragment of a document",
  "input_schema": {
    "type": "object",
    "properties": {
      "source": { "type": "string" },
      "doc_id": { "type": "string" },
      "start": { "type": "integer" },
      "end": { "type": "integer" }
    },
    "required": ["source", "doc_id", "start", "end"]
  }
}


Tool: refine_search
{
  "name": "refine_search",
  "description": "Narrow search scope using a previous result",
  "input_schema": {
    "type": "object",
    "properties": {
      "previous_query": { "type": "string" },
      "refinement": { "type": "string" }
    },
    "required": ["previous_query", "refinement"]
  }
}

👉 Critical rule:
 These tools are available only to the exploratory RLM agent, never to CopilotKit reasoning agents.

2️⃣ Traversal / Subgraph Cache Schema
This is what prevents Claude from re-exploring the same ground.
TraversalSession
{
  "session_id": "uuid",
  "entity_id": "AC_MILAN",
  "started_at": "2026-01-22T10:01:00Z",
  "model": "claude-3-5-sonnet",
  "max_depth": 6,
  "tool_budget": 12,
  "status": "ACTIVE | COMPLETED | ABORTED"
}


TraversalStep
{
  "session_id": "uuid",
  "step": 3,
  "tool": "search_source",
  "input": {
    "source": "linkedin",
    "query": "platform engineer"
  },
  "result_hash": "sha256",
  "signal_hints": ["DIGITAL_TRANSFORMATION"]
}


ExplorationOutcome
{
  "entity_id": "AC_MILAN",
  "signal_type": "ORG_TRANSFORMATION",
  "supporting_docs": ["doc_12", "doc_19"],
  "confidence_hint": 0.72,
  "eligible_for_graph": true
}

Only eligible_for_graph = true outcomes are passed into the Ralph loop.

3️⃣ Cost-Guarded Recursion Policy (Non-Negotiable)
This is what keeps the system sane at 4k+ entities.
Hard limits (enforced by orchestrator)
MAX_DEPTH: 6
MAX_TOOL_CALLS: 12
MAX_TOKENS_PER_SESSION: 8_000
MAX_ATTEMPTS_PER_ENTITY: 3


Stop conditions (Claude must follow)
Claude system prompt (RLM agent):
Stop recursion if:
- the same source has been inspected twice
- no new signal types emerge after 2 steps
- remaining tool budget < 2
- confidence gain is marginal

Claude cannot override these — the orchestrator terminates the loop.

4️⃣ CopilotKit Integration (Tool Gating)
This is where most systems accidentally break.
CopilotKit agent tools (ONLY these)
query_entity
query_subgraph
find_signals
trace_evidence

❌ No search
 ❌ No open
 ❌ No refine
 ❌ No RLM tools
CopilotKit system prompt (reasoning agent)
You are reasoning over a validated knowledge graph.
You may not search the open world.
If information is missing, say so.
Base all answers on graph queries.

If a user asks:
“Are there rumors about X?”
Claude:
checks graph


if absent → “No validated signals yet”


That’s by design.

5️⃣ End-to-End Execution Trace (One Entity)
Let’s walk AC Milan through the full pipeline.
Phase 1 — RLM Exploration
Claude searches hiring posts


Opens engineering listings


Refines into “data platform”


Flags candidate signal


Phase 2 — Ralph Loop
Coverage report shows 1 source


Orchestrator fetches press releases


RLM inspects again


Minimums satisfied


Phase 3 — Validation
Claude S1 extracts evidence


Claude S2 (optional) synthesizes


Phase 4 — Graph Write
Graphiti MCP upserts:


Entity


Signal


Evidence


Relationships


Phase 5 — User Interaction
User:
“Why do you think AC Milan is modernising digitally?”
Claude (CopilotKit):
queries subgraph


explains signal


cites evidence


PersonaPlex speaks it.

6️⃣ Why This Architecture Is Stable
This matters more than performance.
RLM handles uncertainty


Ralph handles quality


Graphiti handles truth


Claude handles reasoning


CopilotKit handles UX


PersonaPlex handles human interface


No component does two jobs.

What I Recommend You Do Next (Order Matters)
Implement RLM tool contracts


Add TraversalSession cache


Enforce hard recursion budgets


Gate CopilotKit tools


Run 50-entity pilot batch


Tune stop conditions


If you want next, I can:
Write Claude Agent SDK code for this loop


Design Temporal / n8n workflows


Create evaluation metrics (precision drift)


Map this directly into Yellow Panther’s live system


You’re no longer “using LLMs” —
 you’re building an intelligence engine.
yes
Perfect — then the next step is to give you a full Claude Agent SDK–ready implementation for the RLM + Ralph + Graphiti pipeline, so you can literally drop it in and run a batch of entities. This includes:
Traversal loop orchestration


RLM tool calls


Ralph loop enforcement


Graphiti writes


Traversal / subgraph cache updates


Here’s a production-grade Python scaffold:

