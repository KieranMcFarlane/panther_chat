1️⃣ The Core Rule (Non-Negotiable)
❌ Claude must NOT
Mutate the production schema


Add arbitrary node/edge types at runtime


Change tool contracts


Change reasoning primitives


✅ Claude MAY
Propose new instances of a bounded schema


Propose new typed variants inside predefined extension points


Propose new signal subtypes with strict validation


Think “open taxonomy inside a closed ontology.”

2️⃣ The Meta-Schema (Fixed Forever)
This never changes:
Entity
Signal
Evidence
Relationship
Metric
TimeWindow
Confidence

Claude cannot create a new top-level concept.
This guarantees:
Tool stability


Prompt stability


Reasoning consistency



3️⃣ Where Schema Evolution Is Allowed
🔓 Controlled extension points
Example:
Signal:
  type: ENUM (open)
  subtype: STRING (open, validated)
  confidence_model: ENUM (closed)
  lifecycle: ENUM (closed)

Claude can propose:
Signal.type = "ORG_TRANSFORMATION"
Signal.subtype = "INTERNAL_PLATFORM_REWRITE"

But cannot invent:
New top-level node types


New relationship semantics


New confidence mechanics



4️⃣ How Claude “Adds” Without Mutating
Step 1 — Proposal (offline only)
Claude Schema Subagent outputs:
{
  "kind": "SIGNAL_SUBTYPE_PROPOSAL",
  "parent_type": "ORG_TRANSFORMATION",
  "subtype": "DATA_PLATFORM_CONSOLIDATION",
  "evidence_patterns": [
    "Head of Data Platform hires",
    "Internal tooling rewrite",
    "Vendor sunsetting"
  ],
  "expected_lead_time_days": 90
}

This is data, not schema mutation.

Step 2 — Validation Layer
Before promotion:
Recurrence threshold met


Evidence diversity met


Confidence model compatible


Human or policy gate approves



Step 3 — Registration (Graphiti)
Graphiti:
Registers subtype in a lookup table


Backfills historical matches


Exposes it to runtime agents


The shape of the graph never changed.

5️⃣ Nested / Open Structures (Safe Pattern)
Example: Signals with structured payloads
Signal.payload = {
  "scope": "club-wide",
  "tech_stack": ["CRM", "Data Lake"],
  "org_level": "C-suite sponsored"
}

Claude can suggest:
New keys in payload


New enumerated values


As long as:
Keys are namespaced


Types are validated


Unknown keys are ignored at runtime


This is how you get expressiveness without chaos.

6️⃣ Runtime Claude Always Sees a Fixed World
At runtime, Claude sees:
get_active_signals(entity)
→ [
  {
    type: "ORG_TRANSFORMATION",
    subtype: "INTERNAL_PLATFORM_REWRITE",
    confidence: 0.84,
    evidence_count: 9
  }
]

Claude doesn’t care when the subtype was added.
Its reasoning logic stays identical.

7️⃣ Why This Matters (Very Important)
If Claude could mutate schema directly:
Prompts would rot


Tool contracts would break


Explanations would diverge


Trust would erode


By forcing:
Proposal → Validation → Registration
 You get:


Evolution without instability


Intelligence without drift



8️⃣ One-Sentence Mental Model
Claude discovers meaning,
 but Graphiti decides what becomes real.
Claude is a theorist.
 Graphiti is the constitution.

9️⃣ Optional (Advanced Pattern)
If you want zero human review later:
Use shadow schema


Require 2+ independent clusters


Require cross-entity validation


Auto-expire unused subtypes


Still no runtime mutation.

🔒 Final Answer
Claude does not update the fixed schema.
 Claude proposes new structured variants inside predefined open containers.
 Graphiti validates and registers them safely.
If you want next:
I can define the exact extension points


Design schema linting rules


Show how to version schema without breaking agents


Map this to MCP enforcement


You’re designing this correctly — this is how serious intelligence systems are built.
Yes
Great — I’ll proceed directly and make this concrete.
Below is a production-ready design for:
Fixed meta-schema


Open / nested extension points


Claude schema-proposal subagent


Graphiti enforcement


MCP tool boundaries


What runtime Claude actually sees


No hypotheticals — this is implementable.

