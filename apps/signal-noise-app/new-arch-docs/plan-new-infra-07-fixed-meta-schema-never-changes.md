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



