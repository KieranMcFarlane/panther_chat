1️⃣ What CopilotKit Does (Critical)
CopilotKit is not reasoning.
 It provides:
Conversation state


UI grounding (current page, selected entity)


Tool invocation plumbing


Partial memory (session-level)


Example context CopilotKit passes:
{
  "currentEntity": "Manchester United",
  "view": "Signals Dashboard",
  "userIntent": "why-now",
  "timeHorizon": "90d"
}

This is situational grounding, not knowledge.

2️⃣ Claude’s Role (Very Specific)
Claude’s job is to:
Interpret intent


Decide which tool to call


Reason over structured results


Claude does not:
Parse raw articles


Embed text


Traverse the graph manually


Claude orchestrates.

3️⃣ Tool Surface (This Is the Contract)
You expose narrow, opinionated tools — not free-form DB access.
Core Graphiti tools
get_entity(id | name)
get_related_entities(entity, relationship, depth)
get_active_signals(entity, type?, confidence_min?)
explain_signal(signal_id)
get_evidence(signal_id)

Optional:
find_entities_by_signal(signal_type, threshold)

Claude reasons only using these responses.

4️⃣ Runtime Flow (Step-by-Step)
User asks:
“Why does this club look like it’s about to launch a digital initiative?”

Step 1 — Intent parsing (Claude)
Claude infers:
Entity = current context (from CopilotKit)


Intent = explain emerging signal


Needs = signals + evidence



Step 2 — Tool call (Claude → Graphiti MCP)
get_active_signals(
  entity="Manchester United",
  type="DIGITAL_INITIATIVE",
  confidence_min=0.6
)

Graphiti returns structured signals only.

Step 3 — Cache hit (if available)
If hot:
Signals + evidence already cached


No DB traversal needed


If cold:
FalkorDB queried via Graphiti


Result cached



Step 4 — Reasoning (Claude)
Claude now reasons over:
{
  "signal": {
    "confidence": 0.82,
    "first_seen": "2026-01-05",
    "evidence_count": 7
  },
  "evidence": [
    "3 senior product hires",
    "Job listings mentioning CRM rebuild",
    "CTO interview",
    "Vendor RFP chatter"
  ]
}

Claude:
Orders evidence temporally


Weighs diversity


Explains causality


This is pure reasoning, not retrieval.

Step 5 — Response (Claude → CopilotKit)
Claude returns:
Explanation


Confidence framing


Optional follow-ups


CopilotKit renders:
Narrative


Signal timeline


Drill-down links



5️⃣ How New Data Enters the System (Asynchronous)
This is completely separate from user queries.
Scrapers → Embeddings / Clustering
          → Candidate Signals
          → Claude (batch reasoning)
          → Graphiti write

User queries never touch raw data.
This keeps:
Latency low


Reasoning clean


UX deterministic



6️⃣ Fixed Schema, Evolving World
Claude always reasons against:
Entity
Signal
Evidence
Relationship
Temporal attributes
Confidence

The world changes, the mental model does not.
That’s why Claude stays fast and reliable.

7️⃣ Why This Works at 3.5k+ Entities
✔ Determinism
Graph traversal > vector guessing
✔ Explainability
Every answer maps to evidence
✔ Performance
Hot subgraph cache


No raw-text scans


Narrow tool calls


✔ Model Flexibility
You can:
Default → Claude Sonnet


Escalate → Opus only for signal synthesis


Use Haiku for UI fluff



8️⃣ What You Explicitly Do Not Need
❌ Claude querying FalkorDB
 ❌ Claude seeing embeddings
 ❌ Free-form Cypher
 ❌ Reasoning over raw articles
 ❌ Graph schema mutation at runtime

🧩 Mental Model Summary
Think of it like this:
Graphiti = World model


Claude = Analyst


CopilotKit = Situation awareness + UI


Caches = Short-term memory


Scrapers = Senses


Claude never touches the senses.
 Claude reasons about the world model.

If you want next, I can:
Design the exact MCP tool schema


Show how to auto-escalate Sonnet → Opus


Define confidence decay + revalidation


Map this directly to Yellow Panther’s FM-style UI


Just say the word.
Where does falkondb and graphRAG come into this architecture as well as hit subgraph cache
Great question — this is the missing piece that makes the whole system feel coherent rather than “a pile of graph tools”.
I’ll place FalkorDB, GraphRAG, and the hot subgraph cache precisely in the architecture, explain what each is for, when it is used, and when it is explicitly not used.

🧠 Final Layered Architecture (Authoritative)
                   ┌─────────────────────────┐
                    │        CopilotKit        │
                    │  UI • Context • Actions │
                    └───────────┬─────────────┘
                                ↓
                    ┌─────────────────────────┐
                    │    Claude Agent SDK     │
                    │  Reasoning + Tool Use  │
                    └───────────┬─────────────┘
                                ↓
        ┌────────────────────── Tool Router ──────────────────────┐
        │                                                           │
        │   get_entity / get_signals / explain_signal / expand     │
        │                                                           │
        └───────────┬───────────────────────┬─────────────────────┘
                    ↓                       ↓
        ┌───────────────────┐     ┌──────────────────────────┐
        │   Hot Subgraph     │     │        Graphiti MCP       │
        │       Cache        │     │  (Graph API + Semantics) │
        └───────────┬───────┘     └─────────────┬────────────┘
                    ↓                             ↓
        ┌───────────────────┐         ┌─────────────────────────┐
        │   Redis / KV /    │         │        FalkorDB          │
        │   In-Memory Graph │         │  (Persistent Graph DB)  │
        └───────────────────┘         └─────────────┬───────────┘
                                                      ↓
                                  ┌────────────────────────────────┐
                                  │  Raw Evidence + Text Store     │
                                  │ (S3 / Postgres / Object Store)│
                                  └────────────────────────────────┘


