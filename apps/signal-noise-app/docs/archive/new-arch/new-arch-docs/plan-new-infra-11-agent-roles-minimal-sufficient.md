1️⃣ Agent Roles (Minimal, Sufficient)
You only need two Claude roles for scraping:
Agent S1 – Extractor/Validator (Sonnet)


Agent S2 – Synthesizer (Opus, conditional)


Do not use Haiku for extraction at this scale — you’ll pay later in retries.

2️⃣ Exact Prompt: S1 — Extraction + Coverage Report
This is the most important prompt in your system.
System Prompt (S1)
You are a structured intelligence extraction agent.

You operate on prepared inputs only.
You do not browse, speculate, or infer beyond evidence.
You must return structured outputs that can be validated by a machine.

Your job:
1. Identify candidate signals
2. Extract evidence items
3. Report coverage gaps against minimum requirements

Do NOT:
- assign final confidence
- invent entities or relationships
- merge evidence types
- write summaries

User Task Prompt (S1)
{
  "entity": "AC Milan",
  "context": {
    "industry": "sports",
    "entity_type": "football_club"
  },
  "inputs": {
    "articles": [...],
    "job_listings": [...],
    "linkedin_events": [...],
    "press_releases": [...]
  },
  "minimum_requirements": {
    "evidence_items": 2,
    "evidence_types": 2,
    "source_domains": 2
  }
}

Required Output Schema (strict)
{
  "entity_resolved": true,
  "candidate_signals": [
    {
      "type": "ORG_TRANSFORMATION",
      "subtype": "INTERNAL_PLATFORM_REWRITE",
      "evidence_ids": ["e1", "e3"]
    }
  ],
  "evidence": [
    {
      "id": "e1",
      "type": "job_listing",
      "source": "linkedin",
      "date": "2026-01-04",
      "snippet": "..."
    }
  ],
  "coverage_report": {
    "evidence_count": 1,
    "evidence_types": ["job_listing"],
    "source_domains": ["linkedin.com"],
    "missing": ["non-hiring evidence"]
  }
}

Claude must include coverage_report.
 This is what powers the Ralph loop.

3️⃣ Ralph Loop — Orchestrator Logic (Correct Form)
Claude never loops itself.
Pseudocode
MAX_ATTEMPTS = 3

for entity in batch:
    attempt = 1
    inputs = initial_sources(entity)

    while attempt <= MAX_ATTEMPTS:
        result = run_claude_s1(entity, inputs)

        if meets_min_requirements(result.coverage_report):
            write_candidates_to_graphiti(result)
            break

        new_sources = select_additional_sources(
            missing=result.coverage_report.missing
        )

        if not new_sources:
            mark_insufficient(entity)
            break

        inputs += fetch(new_sources)
        attempt += 1

Key rule
Claude reports gaps


System decides next fetch


Hard stop always enforced



4️⃣ When to Escalate to S2 (Opus)
Only escalate after S1 passes minimums and only if:
Multiple candidate signals exist


Evidence conflicts


Cross-source synthesis needed


S2 Prompt (Short, Sharp)
You are a signal synthesis agent.

You receive validated candidate signals and evidence.
Your job is to:
- merge compatible evidence
- flag contradictions
- recommend promotion or rejection

Do not invent new signals.
Do not downgrade evidence.

S2 output:
{
  "action": "PROMOTE",
  "signal": {
    "type": "...",
    "subtype": "..."
  },
  "notes": "Consistent across hiring + vendor evidence"
}


5️⃣ Parallelization Strategy (4k+ Entities)
Golden Rule
Parallelize across entities, not within entities.
Recommended setup
Batch size: 50–100 entities


Concurrency: 10–25 Claude calls


Queue-based orchestration (Temporal, Celery, n8n, or custom)


Why
Keeps Ralph loops contained


Prevents cascading retries


Predictable cost envelope



6️⃣ Failure & Retry Semantics (Critical)
Claude failure
Retry same attempt once


Then mark entity ERROR_REVIEW


Incomplete data
Loop only if new source class exists


Never re-run Claude on identical inputs


Timeouts
Abort attempt


Preserve partial coverage report


Resume next cycle



7️⃣ GraphRAG Integration (Correct Placement)
GraphRAG runs between attempts, never inside Claude.
S1 → coverage gaps
  ↓
GraphRAG fetches semantically relevant docs
  ↓
Re-run S1 (if attempt budget remains)

GraphRAG is fuel, not the engine.

8️⃣ Cost & Throughput (Realistic Numbers)
With Sonnet as S1:
Avg tokens / entity / attempt: ~3–5k


Avg attempts: 1.3–1.6


4k entities ≈ 25–35M tokens per full sweep


Tiered cadence cuts this by 60–70%.

9️⃣ Operational Defaults (Use These)
MAX_ATTEMPTS: 3
ENTITY_BATCH_SIZE: 75
S1_MODEL: claude-3-5-sonnet
S2_MODEL: claude-3-opus
RETRY_ON_FAILURE: 1
INSUFFICIENT_REVIEW_DELAY: 30d


🧠 Final Mental Model (Lock It In)
Claude extracts and reports gaps.
 The orchestrator decides continuation.
 Ralph loops enforce standards.
 Graphiti stores only validated intelligence.
This is exactly how you scale agent-based scraping to thousands of entities without drift, runaway cost, or hallucinated signals.

If you want next, I can:
Provide ready-made JSON Schemas for validation


Show Temporal / n8n DAGs


Design alerting & anomaly detection


Add active learning loops


Map this directly to Yellow Panther’s production stack


You’re now operating at serious system level.
Yes
Perfect. I’ll move forward without asking more questions and give you the next concrete layer you can drop straight into your stack:
I’ll cover, in order:
End-to-end architecture (Claude Agent SDK + CopilotKit + Graphiti MCP)


Where FalkorDB actually sits


When GraphRAG is required vs not


Exact JSON schemas (fixed but extensible)


How Claude reasons over the graph in CopilotKit


What happens when Claude is slow


How PersonaPlex fits (voice ≠ reasoning)


This will fully resolve the confusion threads you were circling.

