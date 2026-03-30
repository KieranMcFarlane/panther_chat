1️⃣ First: What the Claude Agent SDK Is Doing Here
In your scraper pipeline, Claude is not browsing.
Claude is acting as:
A structured classifier


A signal extractor


A validator


Occasionally a schema-proposal agent


All crawling / fetching is done outside Claude.
Claude only sees prepared inputs.

2️⃣ The Correct Mental Model for 4k+ Entities
You are running a data refinery, not a chatbot.
Each entity must pass through fixed gates:
Raw Inputs
  ↓
Claude Pass 1: Extraction
  ↓
Claude Pass 2: Validation
  ↓
Claude Pass 3: Sufficiency Check
  ↓
Write → Graphiti OR mark insufficient

This is where the Ralph loop comes in.

3️⃣ Define “Minimum Requirements” (Non-Negotiable)
Before any looping, you define hard criteria.
Example:
minimum_requirements:
  entity_resolution: true
  evidence_items: >= 2
  evidence_types: >= 2
  signal_confidence_estimate: >= 0.5
  source_diversity: >= 2

Claude does not invent these.
 Claude only reports whether they’re met.

4️⃣ The Ralph Loop (Correctly Applied)
❌ Wrong Ralph Loop
“Keep reasoning until you’re confident.”
This explodes cost and drifts.

✅ Correct Ralph Loop (Bounded, Deterministic)
For each entity in batch:
  attempt = 1
  while attempt ≤ MAX_ATTEMPTS:
    run Claude extraction
    if minimum_requirements met:
        accept
        break
    else if more data sources available:
        fetch more inputs
        attempt += 1
    else:
        mark entity as insufficient
        break

Claude never controls the loop.
 Your orchestrator does.

5️⃣ Claude’s Exact Role Inside the Loop
Claude Agent SDK task example:
{
  "task": "Extract candidate signals and evidence",
  "entity": "AC Milan",
  "inputs": [
    "scraped_articles.json",
    "job_listings.json",
    "linkedin_events.json"
  ],
  "output_schema": {
    "signals": [],
    "evidence": [],
    "coverage_report": {}
  }
}

Claude returns:
Structured candidates


A coverage report


Example:
{
  "coverage_report": {
    "entity_resolved": true,
    "evidence_count": 1,
    "evidence_types": ["job_listing"],
    "confidence_estimate": 0.42,
    "missing": ["non-hiring evidence"]
  }
}

Your orchestrator decides what to do next.

6️⃣ When the Ralph Loop Triggers Another Pass
You loop only if:
Requirements not met


And additional sources exist


And attempt count < MAX_ATTEMPTS (usually 2–3)


Examples of additional sources:
Earnings calls


Vendor pages


GitHub orgs


Regulatory filings


RFP portals


Employee comments



7️⃣ When You STOP (Very Important)
You must stop when:
Max attempts reached


No new source classes remain


Claude explicitly reports “insufficient signal density”


Then you mark:
{
  "entity": "X",
  "status": "NO_ACTIONABLE_SIGNAL",
  "next_review": "30 days"
}

This prevents:
Infinite loops


Burned tokens


False positives



8️⃣ Batch Strategy for 4k+ Entities
Don’t process all entities equally.
Use tiered cadence:
Entity Tier
Frequency
Tier 1 (high value)
Daily
Tier 2
Weekly
Tier 3
Monthly

Ralph loops apply only to entities with activity deltas.

9️⃣ Where GraphRAG Fits in This Loop
GraphRAG is used between passes, not inside Claude.
Claude pass → gaps identified
  ↓
GraphRAG fetches semantically relevant new docs
  ↓
Claude re-run (if allowed)

Claude never does open-ended retrieval.

🔒 10️⃣ Hard Safety Rules (You Want These)
Claude never writes to FalkorDB directly


Claude never controls loop continuation


Claude never sets confidence scores


Claude never escalates itself


Claude reports → system decides.

🧠 Final Mental Model (Lock This In)
Claude is an analyst.
 Your orchestrator is the editor.
 The Ralph loop is the publishing checklist.
If it doesn’t meet standards, it doesn’t ship.

Practical Defaults (You Can Use These)
MAX_ATTEMPTS: 3
TARGET_EVIDENCE_COUNT: 3
MIN_EVIDENCE_TYPES: 2
REVIEW_INTERVAL_IF_EMPTY: 30d
REVIEW_INTERVAL_IF_ACTIVE: 7d


What You’ve Just Designed
A scalable, bounded agent pipeline


Deterministic costs


No hallucinated signals


Clean integration with Graphiti


Safe schema evolution


Works at 4k → 40k entities


This is the right way to use the Claude Agent SDK for scraping intelligence.

If you want next, I can:
Give you exact task prompts for the scraper agent


Show how to parallelize safely


Design failure & retry semantics


Map this to n8n / Temporal / Airflow


Estimate token + cost envelopes


You’re building this at a very high level of maturity.
Yes
Great — I’ll give you concrete, production-ready artifacts you can use immediately for a Claude Agent SDK–driven scraper over 4k+ entities, including:
Exact task prompts (copy-pasteable)


Ralph-loop orchestration logic


Parallelization strategy


Failure & retry semantics


Cost / throughput envelopes


No theory; this is how you actually run it.

