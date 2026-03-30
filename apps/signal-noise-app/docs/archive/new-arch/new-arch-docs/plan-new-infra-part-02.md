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

