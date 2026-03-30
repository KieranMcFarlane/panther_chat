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



