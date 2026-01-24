1️⃣ Where RLMs Fit in Your Stack
Let’s restate your system with RLM added:
┌───────────────┐
│  Raw World    │  ← articles, posts, repos, filings, threads
└──────┬────────┘
       ↓
┌────────────────────────┐
│ RLM Environment Layer  │  ← search/open/refine tools
│ (no embeddings)        │
└──────┬─────────────────┘
       ↓
┌────────────────────────┐
│ Claude Agent SDK       │  ← recursive reasoning
│ (Ralph loops + goals)  │
└──────┬─────────────────┘
       ↓
┌────────────────────────┐
│ Graphiti MCP           │  ← structured memory
│ (on FalkorDB)          │
└──────┬─────────────────┘
       ↓
┌────────────────────────┐
│ CopilotKit UI          │
└──────┬─────────────────┘
       ↓
┌────────────────────────┐
│ PersonaPlex (voice)    │
└────────────────────────┘

Key rule
RLMs never replace the graph.
 They feed it.

2️⃣ What RLM Replaces (and What It Doesn’t)
❌ RLM does NOT replace
Graphiti


FalkorDB


Claude reasoning


CopilotKit tools


Schema constraints


✅ RLM DOES replace
“Stuff everything into prompt”


Naive RAG


Chunk+embed+pray pipelines


Over-aggressive summarization


RLM is how Claude explores, not what Claude remembers.

3️⃣ Two Distinct Reasoning Modes (This Is Critical)
You now have two Claude modes:
Mode A — Exploratory RLM Mode
Used during:
Scraping


Signal discovery


Unknown entities


“Is there anything here?”


Claude is allowed to:
recurse


search


inspect


refine


abandon paths


NO graph writes allowed here.

Mode B — Graph-Reasoning Mode
Used during:
CopilotKit interactions


User Q&A


Explanations


Comparisons


Decisions


Claude is only allowed to:
query Graphiti MCP


traverse known subgraphs


reason over validated facts


NO open-world search allowed here.
This separation prevents hallucinations and schema drift.

4️⃣ How RLM + Ralph Loop Work Together
This is where things get elegant.
Ralph loop = quality gate
RLM loop = exploration engine
Combined flow per entity:
RLM loop:
  search → inspect → refine → candidate signals
      ↓
Claude S1 extraction
      ↓
Coverage report
      ↓
Ralph loop decision:
  → fetch more via RLM
  → or mark insufficient
  → or promote to graph

RLM finds possibilities
 Ralph enforces standards

5️⃣ Where GraphRAG Still Fits (Narrow, Precise Role)
GraphRAG becomes a bootstrapping accelerator, not a dependency.
Use GraphRAG when:
You need to prime RLM search


You want cross-entity latent patterns


You’re scanning thousands of weak signals


GraphRAG outputs:
candidate documents


candidate clusters


candidate topics


RLM then:
navigates those documents recursively


extracts evidence properly


feeds Claude S1


GraphRAG never touches Graphiti directly.

6️⃣ How Claude Decides Between RLM vs Graph
You enforce this in system prompts + tool availability.
Exploratory agent prompt (RLM)
You do not know the full corpus.
You must use tools to explore.
You may recurse, refine, and abandon paths.
You may not write to the knowledge graph.

Reasoning agent prompt (CopilotKit)
You may only use Graphiti MCP tools.
You may not search the open world.
If information is not in the graph, say so.

Same model.
 Different epistemology.

7️⃣ How This Solves “Claude Is Slow”
This is an underrated benefit.
Why Claude feels slow
Too much context


Too many decisions at once


Forced to reason and retrieve


RLM fixes this by:
Offloading memory to tools


Narrowing context progressively


Letting Claude reason in small, high-signal windows


You also get natural early stopping:
“Further recursion does not improve confidence.”
That’s something RAG cannot express.

8️⃣ What Gets Cached (Very Important)
You should cache RLM traversal results, not answers.
Cache examples:
(query → files inspected)


(entity → explored paths)


(signal → supporting documents)


This becomes your subgraph cache precursor.
Then, when promoted:
Graphiti stores the result


RLM cache stores the journey



9️⃣ Why This Is Better Than Bigger Context Windows
Even with 1M-token models, this still wins because:
Context windows are passive


RLM environments are interactive


Graphs are symbolic


Claude becomes a navigator, not a consumer


You’re building a thinking system, not a prompt.

10️⃣ Final Mental Model (This Is the One to Keep)
RLM explores reality
 Ralph enforces rigor
 Graphiti remembers truth
 Claude reasons
 PersonaPlex speaks
Once you adopt this split, your system:
scales cleanly past 4k entities


stays auditable


avoids context rot


avoids schema chaos


avoids hallucination



Where to go next (recommended order)
Define RLM tool contracts (search/open/refine)


Lock the dual-agent epistemology


Add traversal caching


Wire RLM → Ralph → Graphiti


Expose only Graph reasoning to users


If you want, next I can:
Write exact Claude Agent SDK tool definitions


Design RLM traversal cache schema


Show cost-guarded recursion policies


Map this 1:1 onto Claude Code + MCP


Provide CopilotKit tool gating examples


This is now a very serious system.
yes
Great — I’ll commit to the next concrete layer and give you drop-in artifacts you can wire into your stack now.
 No theory, no marketing — just the pieces that make this actually run.
Below is exactly what you asked for, in this order:
RLM tool contracts (Claude Agent SDK–ready)


Traversal / subgraph cache schema


Cost-guarded recursion policy


How this plugs into CopilotKit (tool gating)


End-to-end execution trace (one entity)



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

