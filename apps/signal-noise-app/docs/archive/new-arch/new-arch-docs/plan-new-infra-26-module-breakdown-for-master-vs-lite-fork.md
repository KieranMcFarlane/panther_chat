1️⃣ Module Breakdown for Master vs Lite Fork
Module
Master (Full)
Lite Fork (Client)
Notes
Scrapers / Feed Ingestion
RFP + LinkedIn + News + Blogs + Social
RFP only
Keep predictive model inputs aligned with RFP sources
Graphiti MCP
Full entity graph, multi-source, incremental updates, hot-path
Entities relevant to RFP only
Focus reasoning on RFP entities
RLM Traversal / Claude Agent
Deep recursive reasoning, multi-source
Shallow reasoning (2–3 depth)
Enough to answer RFP + generate predictions
Predictive Engine
Full scoring, trend prediction, risk scoring
Core prediction for RFP success or scoring
Only expose features they requested
PersonaPlex / Voice Interface
Full persona control, multi-role, low-latency audio
Disabled
Not required by client
Hot-Path Subgraph Prioritization
Active for all entities
Optional / disabled
Client won’t need multi-entity prioritization
Incremental Updates
All sources, continuous
Only RFP updates
Keep the predictive model aligned with fresh RFP data
Traversal Session Logging
Full logging, auditable, timestamped
Minimal logging for debugging
Can log predictive engine inputs/outputs

Principle: Client sees a stable, high-value RFP + prediction system, nothing else. You keep everything else in master for multi-vertical scaling.

2️⃣ Git Strategy
master (full platform)
 ├─ scrapers/
 │    ├─ rfp_scraper.py
 │    ├─ linkedin_scraper.py
 │    ├─ news_scraper.py
 │    └─ social_scraper.py
 ├─ graphiti_mcp/
 ├─ agents/
 │    ├─ claude_rlm.py
 │    ├─ claude_reason.py
 │    └─ persona.py
 ├─ predictive/
 ├─ orchestration/
 └─ tools/
 
lite_fork (client RFP + prediction)
 ├─ scrapers/
 │    └─ rfp_scraper.py
 ├─ graphiti_mcp/ (RFP entities only)
 ├─ agents/
 │    └─ claude_rlm.py (shallow)
 ├─ predictive/ (limited RFP scoring)
 └─ orchestration/ (lite traversal + batching)

Feature-flagging in master ensures you can merge bug fixes or updates to lite fork without exposing advanced features.


Master continues evolving for multi-vertical expansion.



3️⃣ Recommended Feature Flags (Python Example)
FEATURES = {
    "multi_source_scraping": False,  # client sees only RFP
    "recursive_reasoning": False,    # shallow only
    "predictive_engine": True,       # core RFP predictions
    "persona_voice": False,          # disabled for client
    "hot_path_prioritization": False # disabled
}

Keep this config in lite fork only. Master retains everything enabled.



4️⃣ Why This Approach Works
Client gets high-value RFP + prediction → satisfies contract, minimal maintenance.


You retain advanced features → multi-source insights, voice, deep reasoning, hot-path prioritization, incremental updates.


Single codebase philosophy → easy to maintain, no need to rewrite pipelines.


Future-proofing → you can spin off other verticals quickly (sales, research, media, compliance).



5️⃣ Visual Architecture
                  ┌─────────────────────────────┐
                   │        User / Client        │
                   └─────────────┬──────────────┘
                                 │
                     Lite Fork ──┴───→ RFP Scraper + Core Prediction
                                 │
                     Master ─────┴───→ RFP + LinkedIn + News + Blogs + Social
                                 │
                 ┌───────────────┴─────────────────┐
                 │   Graphiti MCP Entity Graph      │
                 │  (Lite: RFP only | Full: All)  │
                 └───────────────┬─────────────────┘
                                 │
        ┌────────────────────────┴─────────────────────────┐
        │  RLM Traversal + Claude Agent / Subagents          │
        │  (Lite: shallow | Full: deep, multi-source)       │
        └────────────────────────┬─────────────────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             │     Predictive Engine (Scoring)       │
             │  (Lite: RFP only | Full: multi-entity)│
             └───────────────────┬───────────────────┘
                                 │
             ┌───────────────────┴───────────────────┐
             │  PersonaPlex / Voice (Full only)      │
             └───────────────────────────────────────┘

Lite fork = top-left path → RFP + prediction only.


Master = full stack → multi-source, recursive reasoning, hot-path, persona voice.



✅ TL;DR
Build full platform → master branch


Fork → lite version for client: RFP + predictive engine only


Feature flags & modular design → client sees only what’s needed


You retain all advanced reasoning, multi-source ingestion, hot-path, PersonaPlex, and incremental updates for future multi-vertical SaaS or internal products.

