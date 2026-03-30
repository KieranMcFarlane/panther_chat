# Multi-Agent System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Signal Noise Multi-Agent System                     │
│                         (Claude Agent SDK)                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              YOUR CODE                                  │
│                                                                          │
│  from backend.agents import discover_with_agents                        │
│  result = await discover_with_agents("Arsenal FC", "arsenal-fc")        │
│                                                                          │
│  OR (recommended):                                                       │
│  from backend.agents import MultiAgentCoordinator                        │
│  coordinator = MultiAgentCoordinator()                                   │
│  context = await coordinator.discover_entity("Arsenal FC", "arsenal-fc")│
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEGACY ADAPTER LAYER                            │
│  (Maintains backward compatibility with existing code)                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DigitalDiscoveryAgentAdapter                                  │   │
│  │  - Wraps MultiAgentCoordinator                                  │   │
│  │  - Returns legacy format results                               │   │
│  │  - Drop-in replacement for existing code                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TemplateValidationAdapter                                      │   │
│  │  - Validates templates against test entities                   │   │
│  │  - Uses Search + Scrape agents                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  HypothesisDiscoveryAdapter                                     │   │
│  │  - Tests hypotheses using agents                               │   │
│  │  - Focused discovery for hypothesis validation                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT COORDINATOR                               │
│  (Orchestrates Search → Scrape → Analysis workflow)                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  AgentContext (Shared State)                                    │   │
│  │  - entity_name, entity_id                                       │   │
│  │  - discovered_domains, primary_domain                           │   │
│  │  - entity_profile, scraped_urls                                 │   │
│  │  - raw_signals, scored_signals                                  │   │
│  │  - confidence_metrics, current_confidence                       │   │
│  │  - iterations, start_time, end_time                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Workflow:                                                                │
│  1. Search Phase → Discover domains                                     │
│  2. Scrape Phase → Extract profile                                      │
│  3. Analysis Phase → Score signals                                      │
│  4. Check Stop Conditions → Repeat if needed                            │
└─────────┬──────────────────────┬──────────────────────┬─────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  SEARCH AGENT   │    │  SCRAPE AGENT   │    │ ANALYSIS AGENT  │
│  Domain Discovery│    │Content Extraction│    │Signal Scoring   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AGENT SDK CLIENT FACTORY                            │
│  (Creates Claude Agent SDK clients with tools)                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ClientFactory.create_discovery_client()                        │   │
│  │  ClientFactory.create_multi_agent_client()                      │   │
│  │  ClientFactory.create_analysis_client()                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BRIGHTDATA TOOL REGISTRY                            │
│  (5 tools with @tool decorator pattern)                                 │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ search_engine    │  │ scrape_url       │  │ scrape_batch     │      │
│  │ Google/Bing/     │  │ URL → Markdown   │  │ Concurrent URLs  │      │
│  │ Yandex search     │  │                  │  │                  │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐                              │
│  │ search_jobs      │  │search_press_rels │                              │
│  │ Job board search │  │Press release srch│                              │
│  └──────────────────┘  └──────────────────┘                              │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BRIGHTDATA SDK CLIENT                                 │
│  (Official Python SDK - NOT MCP)                                         │
│                                                                          │
│  - search.google() / search.bing() / search.yandex()                    │
│  - scrape_url() for single URLs                                         │
│  - scrape_url(mode='async') for batch scraping                          │
│  - Automatic proxy rotation                                             │
│  - Anti-bot protection                                                   │
└─────────────────────────────────────────────────────────────────────────┘



┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA FLOW DIAGRAM                                   │
└─────────────────────────────────────────────────────────────────────────┘

User Request
    │
    ├─→ "Discover Arsenal FC"
    │
    ▼
┌──────────────────────┐
│ MultiAgentCoordinator│
└────┬─────────────────┘
     │
     ├─→ [Iteration 1]
     │   │
     │   ├─→ SearchAgent.discover_domains()
     │   │   │
     │   │   ├─→ search_engine_tool("Arsenal FC official website")
     │   │   │   │
     │   │   │   ▼ BrightData SDK
     │   │   │   │
     │   │   │   └─→ Returns: arsenal.com, careers.arsenal.com
     │   │   │
     │   │   └─→ Context: primary_domain = "arsenal.com"
     │   │
     │   ├─→ ScrapeAgent.extract_entity_profile()
     │   │   │
     │   │   ├─→ scrape_url_tool("https://arsenal.com")
     │   │   │   │
     │   │   │   ▼ BrightData SDK
     │   │   │   │
     │   │   │   └─→ Returns: 5,000 words markdown
     │   │   │
     │   │   └─→ Context: entity_profile = {...}
     │   │
     │   └─→ AnalysisAgent.score_signals()
     │       │
     │       ├─→ Analyzes profile for signals
     │       │
     │       └─→ Context: confidence = 0.56 (INFORMED)
     │
     ├─→ Check: confidence (0.56) < target (0.80)?
     │   │
     │   └─→ Yes → Continue to iteration 2
     │
     ├─→ [Iteration 2]
     │   │
     │   ├─→ SearchAgent: Refined search ("Arsenal FC CRM")
     │   ├─→ ScrapeAgent: Scrape careers page
     │   └─→ AnalysisAgent: New signals found
     │
     ├─→ Check: confidence (0.72) < target (0.80)?
     │   │
     │   └─→ Yes → Continue to iteration 3
     │
     └─→ [Iteration 3]
         │
         ├─→ SearchAgent: Search press releases
         ├─→ ScrapeAgent: Extract from news page
         └─→ AnalysisAgent: confidence = 0.81 (ACTIONABLE)

     Check: confidence (0.81) >= target (0.80)?
         │
         └─→ Yes → STOP ✅

Final Result: {
  entity_id: "arsenal-fc",
  confidence: 0.81,
  band: "ACTIONABLE",
  primary_domain: "arsenal.com",
  signals: [...],
  iterations: 3
}



┌─────────────────────────────────────────────────────────────────────────┐
│                    CONFIDENCE CALCULATION                               │
└─────────────────────────────────────────────────────────────────────────┘

Starting Confidence: 0.50 (neutral prior)

Signal Decisions:
┌────────────────┬─────────┬─────────────────────────────────┐
│ Decision       │ Delta   │ Meaning                         │
├────────────────┼─────────┼─────────────────────────────────┤
│ ACCEPT         │ +0.06   │ Strong procurement evidence      │
│ WEAK_ACCEPT    │ +0.02   │ Capability without intent        │
│ REJECT         │  0.00   │ No evidence                     │
│ NO_PROGRESS    │  0.00   │ No new information              │
│ SATURATED      │  0.00   │ Category exhausted              │
└────────────────┴─────────┴─────────────────────────────────┘

Formula:
final_confidence = 0.50 + (num_ACCEPT × 0.06) + (num_WEAK_ACCEPT × 0.02)

Bounds: 0.00 to 1.00 (enforced)

Example:
┌─────────────────────────────────────────────────────────────┐
│ Starting: 0.50                                             │
│ 3 ACCEPT signals: +0.18 (3 × 0.06)                         │
│ 2 WEAK_ACCEPT signals: +0.04 (2 × 0.02)                    │
│ ───────────────────────────────────                        │
│ Final: 0.72 (CONFIDENT band)                               │
└─────────────────────────────────────────────────────────────┘

Confidence Bands:
┌──────────────┬────────────┬─────────────────────────────┐
│ Band         │ Range      │ Price                       │
├──────────────┼────────────┼─────────────────────────────┤
│ EXPLORATORY  │ < 0.30     │ $0                          │
│ INFORMED     │ 0.30-0.60  │ $500/entity/month           │
│ CONFIDENT    │ 0.60-0.80  │ $2,000/entity/month         │
│ ACTIONABLE   │ > 0.80     │ $5,000/entity/month         │
└──────────────┴────────────┴─────────────────────────────┘

Actionable Gate:
Requires BOTH:
1. Confidence > 0.80
2. ≥2 ACCEPTs across ≥2 categories



┌─────────────────────────────────────────────────────────────────────────┐
│                    MIGRATION PATH                                      │
└─────────────────────────────────────────────────────────────────────────┘

Phase 1: Foundation (COMPLETE ✅)
├─ Tool registry created
├─ Client factory built
├─ Claude wrapper implemented
└─ All agents coded

Phase 2: Testing (READY ⏳)
├─ Unit tests for each agent
├─ Integration tests for coordinator
├─ Backward compatibility tests
└─ Performance benchmarks

Phase 3: Integration (PENDING)
├─ Update digital_discovery_agent.py
├─ Update template_discovery.py
├─ Update hypothesis_driven_discovery.py
└─ Monitor in production

Phase 4: Optimization (FUTURE)
├─ Add agent-level caching
├─ Implement performance profiling
├─ Add telemetry and monitoring
└─ Optimize tool usage patterns
