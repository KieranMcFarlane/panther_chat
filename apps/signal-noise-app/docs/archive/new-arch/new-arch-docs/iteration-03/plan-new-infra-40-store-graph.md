1️⃣ Schemas are fixed (mostly)
Claude reasons against a fixed, explicit schema in Graphiti.
Examples:
Entity (Company, Person, Product, Subreddit)


Signal


Event (Hire, Launch, Partnership)


Relationship


Evidence


These schemas do not change frequently.
 They are your ontology.
Claude is strongest when the schema is stable.

2️⃣ Raw data updates continuously
Your scraped inputs:
Articles


Posts


Comments


Job listings


Hire announcements


These are unstructured, noisy, high-volume.
They do not go directly into the graph as truth.

3️⃣ GraphRAG / semantic layer continuously mines signals
This layer:
Embeds incoming text


Clusters related datapoints


Detects candidate signals


Example outputs:
“Possible AI initiative”


“Early hiring ramp”


“Vendor evaluation phase”


“Growing dissatisfaction”


These are hypotheses, not facts.

4️⃣ Claude reasons over candidates (this is the key step)
Claude (Sonnet / Opus when needed):
Validates signal coherence


Checks:


entity consistency


temporal alignment


evidence diversity


Assigns:


signal type


confidence score


supporting evidence


This is where reasoning happens.
Claude does NOT reason over raw text.
 Claude reasons over structured candidates.

5️⃣ Graphiti is updated with structured signals
Only after reasoning.
Graphiti receives entries like:
(:Company)-[:HAS_SIGNAL {
  type: "DIGITAL_TRANSFORMATION_INITIATIVE",
  confidence: 0.81,
  evidence_count: 6,
  first_seen: 2026-01-04,
  last_seen: 2026-01-18
}]

This becomes authoritative memory.

6️⃣ Caching happens at two levels (important)
🔹 Semantic cache
Recent embeddings


Recent clusters


Recent candidate signals


Prevents re-processing the same noise


🔹 Graph cache
Hot subgraphs (last N entities)


Recent signals


Frequently queried entities


Claude hits cache before recomputing.

What Claude Always Sees (and What It Never Sees)
✅ Claude always sees:
Fixed Graphiti schema


Structured nodes and edges


Signal confidence + evidence


Cached subgraphs


❌ Claude never sees:
Raw scraped text (unless explicitly requested)


Embedding vectors


Clustering internals


Storage engines (FalkorDB, etc.)


This is by design.

Why This Works (The Big Insight)
You get three stability layers:
Stable schema → reliable reasoning


Evolving signals → adaptability


Cached graph views → low latency


Claude reasons as if the world is clean,
 because you’ve already cleaned it for him.

Plain-English Summary
✅ Data flows in continuously


✅ Semantic systems detect possible signals


✅ Claude reasons and validates


✅ Graphiti stores truth using a fixed schema


✅ Caches reduce recomputation


✅ Claude always reasons against a stable world model


So yes:
The world changes continuously, but Claude’s mental model stays stable.
That’s the secret.

Perfect — let’s lock this in as a clear, end-to-end architecture for CopilotKit + Claude Agent SDK + Graphiti, focused on how reasoning and querying actually works at runtime.
I’ll do this in layers, then a step-by-step flow, then why this scales for your 3.5k-entity signal system.

🧠 High-Level Architecture
User (UI)
  ↓
CopilotKit (Agent UI + State)
  ↓
Claude Agent SDK
  ↓
Tool Router
  ├─ Graphiti MCP (authoritative graph)
  ├─ Signal Cache (hot subgraphs)
  ├─ Optional GraphRAG (semantic recall)
  ↓
Graphiti (→ FalkorDB under the hood)

Claude never talks to the database directly.
 Claude only talks to tools.

1️⃣ FalkorDB — The Physical Graph Brain
What FalkorDB is
Persistent graph database


Fast traversal


Strong relationship modeling


ACID enough for signal updates


What FalkorDB is not
Not an LLM interface


Not a reasoning engine


Not queried directly by Claude


Role in system
FalkorDB is the ground truth.
Every:
Entity


Signal


Evidence


Relationship


Temporal edge


Lives here.
Graphiti is the only thing allowed to talk to it.

2️⃣ Graphiti — The Semantic Graph Interface
Graphiti does 3 critical things
1. Schema enforcement
Entity → Signal → Evidence

Claude never sees graph chaos.

2. Opinionated queries
Instead of:
MATCH (e)-[:MENTIONS]->(a) ...

Claude calls:
get_active_signals(entity, type, confidence)

Graphiti translates this → FalkorDB traversal.

3. Temporal + confidence logic
Graphiti handles:
Signal decay


Evidence freshness


Confidence rollups


Merge/split signals


Claude doesn’t do math.
 Claude interprets results.

3️⃣ Hot Subgraph Cache — Short-Term Working Memory
Why it exists
Most user sessions:
Look at the same entity


Ask 5–15 follow-ups


Traverse 1–2 hops repeatedly


Re-querying FalkorDB every time is wasteful.

What is cached
Not raw data.
Cached:
Entity neighborhood


Active signals


Evidence summaries


Relationship weights


Example cache unit:
{
  "entity": "Arsenal FC",
  "subgraph": {
    "signals": [...],
    "relationships": [...],
    "confidence": {...}
  },
  "ttl": "15 minutes"
}


Cache hierarchy
Layer
Use
In-memory
Current conversation
Redis / KV
Cross-session
FalkorDB
Canonical

Claude never knows which one answered.

4️⃣ GraphRAG — When Graph Is Not Enough
This is the subtle one.
GraphRAG is not the primary brain
GraphRAG is used only when:
“We don’t yet know what to connect.”

When GraphRAG is triggered
Scenario A — Discovery
“What clubs might be quietly investing in AI?”
No entity specified.
 No signal exists yet.
→ GraphRAG scans:
Articles


Posts


Hiring pages


Comments


→ Finds candidates
 → Claude (batch mode) validates
 → Graphiti writes new signals

Scenario B — Weak evidence
Signal confidence < threshold.
GraphRAG:
Pulls semantically similar content


Finds corroboration


Feeds evidence to Graphiti



Scenario C — New schema emergence
You see patterns like:
“Head of Platform”


“Internal tooling rewrite”


“Data mesh”


GraphRAG helps define a new signal type.

When GraphRAG is NOT used
❌ User asks about known entity
 ❌ Signal already exists
 ❌ Evidence already linked
 ❌ Real-time UX flow

5️⃣ Data Ingestion & Reasoning Loop (Asynchronous)
This is where SVD / clustering / slow reasoning lives.
Scrapers
  ↓
Embeddings + Clustering
  ↓
GraphRAG (semantic grouping)
  ↓
Claude (offline reasoning)
  ↓
Graphiti write
  ↓
FalkorDB

This pipeline runs:
Hourly


Daily


Event-driven


User queries never wait on this.

6️⃣ How Claude Interacts With All This (Cleanly)
Claude sees:
{
  "entity": "...",
  "signals": [...],
  "confidence": "...",
  "evidence": [...]
}

Claude does not see:
FalkorDB


Embeddings


Vector scores


Raw text blobs


This keeps:
Latency low


Reasoning sharp


Prompts stable



7️⃣ Final Rule of Thumb
You need…
Component
When
FalkorDB
Always (persistent truth)
Graphiti
Always (semantic layer)
Hot subgraph cache
Always (performance)
GraphRAG
Only for discovery & weak signals


🧩 One-Line Summary
FalkorDB stores reality.
 Graphiti explains reality.
 GraphRAG discovers new reality.
 The cache remembers what you just talked about.
 Claude reasons about the explanation — not the mess.

If you want, next I can:
Draw the exact signal confidence math


Show how to retire signals cleanly


Map this to MCP specs


Show how CopilotKit state narrows graph queries


This is already a production-grade intelligence architecture — you’re asking exactly the right questions.
If we give claude a skill or subagent for reasoning based on aligned goals that emerge with new data alongside graphRag to then add to the schema ahead of time
Yes — and this is the right instinct.
 What you’re describing is effectively schema evolution driven by goal-aligned reasoning, not ad-hoc discovery. This is how you prevent the graph from becoming either brittle or messy.
I’ll explain:
What this “skill / subagent” actually is


Where it sits in the architecture


How it works step-by-step


How it cooperates with GraphRAG


Why it does not destabilize Claude-at-runtime


What you gain vs naïve schema expansion



1️⃣ Fixed Meta-Schema (Never Changes)
This is your constitutional layer.
NodeTypes:
  Entity
  Signal
  Evidence
  Metric
  TimeWindow

EdgeTypes:
  HAS_SIGNAL
  SUPPORTED_BY
  RELATED_TO
  OCCURRED_AT

CoreConstraints:
  - All reasoning happens via Signals
  - Evidence never directly drives answers
  - Confidence is always explicit

Claude cannot add:
New node types


New edge semantics


New traversal logic



2️⃣ Controlled Extension Points (This Is the Key)
Signal is the primary extension surface
Signal:
  type: ENUM (open, governed)
  subtype: STRING (open, namespaced)
  payload: JSON (validated)
  confidence_model: ENUM (closed)
  lifecycle_state: ENUM (closed)
  created_at: timestamp
  last_validated: timestamp

Closed enums (Claude cannot change)
confidence_model:
  - temporal_weighted
  - diversity_weighted
  - threshold_triggered

lifecycle_state:
  - candidate
  - active
  - decaying
  - retired


3️⃣ What “Open / Nested” Actually Means
Claude can propose new values, not new shapes.
✅ Allowed:
{
  "type": "ORG_TRANSFORMATION",
  "subtype": "INTERNAL_PLATFORM_REWRITE",
  "payload": {
    "scope": "club-wide",
    "sponsor_level": "CTO",
    "systems": ["CRM", "Data Platform"]
  }
}

❌ Not allowed:
New top-level keys


New lifecycle logic


New confidence math


Unknown payload keys:
Stored


Validated


Ignored by runtime agents unless whitelisted



4️⃣ Claude Schema Subagent (Offline Only)
This is a separate Claude instance with a hard prompt boundary.
Inputs
GraphRAG clusters


Existing schema registry


Explicit goals


goals:
  - Detect early commercial intent
  - Detect internal capability shifts
  - Surface non-obvious digital initiatives


Output (Strict JSON Contract)
{
  "proposal_kind": "SIGNAL_SUBTYPE",
  "parent_type": "ORG_TRANSFORMATION",
  "subtype": "DATA_PLATFORM_CONSOLIDATION",
  "justification": {
    "recurrence_entities": 21,
    "avg_lead_time_days": 110,
    "signal_lift": "+0.18 over baseline hiring"
  },
  "recommended_payload_schema": {
    "systems": "array[string]",
    "org_scope": "enum(team,dept,org)",
    "sponsor_level": "enum(CTO,CIO,CPO)"
  }
}

Claude cannot write to Graphiti.

5️⃣ Graphiti Enforcement Layer
Graphiti acts like a schema firewall.
It checks:
Parent type exists


Subtype naming rules


Payload keys are namespaced


Confidence model compatibility


Collision with existing subtypes


Then:
Registers subtype in a lookup table


Backfills historical matches


Marks as candidate


Only after validation:
Promoted to active


Exposed to runtime agents



6️⃣ MCP Tool Boundaries (Critical)
Runtime Claude tools (read-only)
get_entity(entity_id)
get_active_signals(entity_id)
explain_signal(signal_id)
get_signal_evidence(signal_id)

Schema agent tools (write-proposal only)
propose_signal_subtype(schema_proposal)

No Claude instance ever gets:
Direct DB access


Schema mutation rights


Raw embeddings



7️⃣ What Runtime Claude Actually Sees
Always the same shape:
{
  "signal": {
    "type": "ORG_TRANSFORMATION",
    "subtype": "DATA_PLATFORM_CONSOLIDATION",
    "confidence": 0.81,
    "evidence_count": 9,
    "first_seen": "2025-11-14"
  }
}

Claude’s reasoning prompt never changes, even as the world evolves.

8️⃣ Why This Works for Your Use Case (3.5k Entities, Noisy Signals)
GraphRAG finds possibilities


Schema agent evaluates meaning


Graphiti enforces structure


Runtime Claude explains implications


This prevents:
Embedding drift


Prompt entropy


Schema sprawl


“Why did the model say this?” moments



9️⃣ Mental Model (Lock This In)
Claude can suggest new vocabulary.
 Graphiti decides what becomes language.
 Runtime Claude only speaks approved language.
That’s the whole system.

If you want next (pick one and I’ll go deep):
Exact confidence math for multi-evidence signals


Automatic retirement / decay rules


FM-style UI mapping (how signals become “attributes”)


How PersonaPlex voice fits on top of this cleanly


How to test schema proposals safely


Just say which.
Yes
Got it. I’ll continue without asking you to choose and cover the next most critical piece given your earlier PersonaPlex + CopilotKit question:
👉 How PersonaPlex (full-duplex voice) sits cleanly on top of this architecture — without breaking reasoning, schema stability, or graph trust
This is the natural continuation.

🎙️ PersonaPlex in This Architecture (Correct Placement)
PersonaPlex is not a reasoning model.
 It is a real-time speech interface with persona control.
So it must sit above Claude, never beside or below it.
User (Voice)
  ↓
PersonaPlex (speech ↔ speech, persona, turn-taking)
  ↓
Claude Agent SDK (reasoning, tools, graph queries)
  ↓
Graphiti MCP
  ↓
FalkorDB / Cache / GraphRAG (offline)

PersonaPlex never touches the graph
 PersonaPlex never reasons about signals
It only:
Transcribes


Streams


Speaks


Maintains conversational flow



