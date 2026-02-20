# Universal Dossier Outreach Implementation Guide

**Version**: 1.0
**Last Updated**: 2026-02-09
**Status**: Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [Configuration](#configuration)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Success Metrics](#success-metrics)

---

## 1. System Overview

### Architecture

The Universal Dossier Outreach system integrates three core components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                       │
├─────────────────────────────────────────────────────────────────────┤
│  EnhancedClubDossier (10 Tabs)                                      │
│  ├── Overview │ Leadership │ Digital │ Procurement │ Timing        │
│  ├── Risks │ Opportunities │ Strategy │ Connections │ Outreach      │
│  └── OutreachStrategyPanel (Strategy Reasoning + Message Composer)  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Python FastAPI)                       │
├─────────────────────────────────────────────────────────────────────┤
│  UniversalDossierGenerator → HypothesisDrivenDiscovery             │
│         ↓                          ↓                                │
│  [Dossier]                [Hypotheses + Signals]                   │
│         ↓                          ↓                                │
│  LinkedInProfiler → OutreachIntelligence → Strategy Generation     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
    ┌─────────┐         ┌──────────┐         ┌──────────┐
    │ FalkorDB│         │ BrightData│         │ Claude AI│
    │ (Graph DB)│       │ (Web Scraping)│      │ (Models) │
    └─────────┘         └──────────┘         └──────────┘
```

### Data Flow

**Step 1: Dossier Generation**
```
User Request → API: GET /api/dossier?entity_id=arsenal-fc
  ↓
UniversalDossierGenerator.generate_universal_dossier()
  ├─→ DossierDataCollector.collect_all() [FalkorDB + BrightData]
  ├─→ Model Cascade: Haiku (80%) → Sonnet (15%) → Opus (5%)
  ├─→ Tier Selection: BASIC/STANDARD/PREMIUM (based on priority_score)
  └─→ Hypothesis + Signal Extraction
  ↓
Response: JSON dossier with metadata, sections, hypotheses, signals
```

**Step 2: Discovery with Dossier Context**
```
HypothesisDrivenDiscovery.run_discovery_with_dossier_context()
  ├─→ Initialize hypotheses from dossier signals
  ├─→ Generate targeted search queries
  ├─→ Execute EIG-based prioritization
  └─→ Single-hop discovery (deterministic cost control)
  ↓
Result: DiscoveryResult with validated signals
```

**Step 3: Outreach Strategy Generation**
```
LinkedInProfiler.extract_outreach_intelligence()
  ├─→ Mutual connection paths (YP team → targets)
  ├─→ Conversation starters from recent posts
  ├─→ Current vendor relationships
  └─→ Communication patterns
  ↓
OutreachStrategyPanel renders:
  ├─→ StrategyReasoning (why this approach)
  ├─→ ApproachDecider (which channel)
  └─→ MessageComposer (personalized message)
```

### Component Relationships

| Component | File | Purpose | Dependencies |
|-----------|------|---------|--------------|
| **UniversalDossierGenerator** | `backend/dossier_generator.py` | Generate tiered dossiers with model cascade | ClaudeClient, DossierDataCollector, FalkorDB |
| **HypothesisDrivenDiscovery** | `backend/hypothesis_driven_discovery.py` | EIG-based entity exploration | ClaudeClient, BrightDataSDKClient, HypothesisManager |
| **LinkedInProfiler** | `backend/linkedin_profiler.py` | Extract outreach intelligence | BrightDataSDKClient |
| **EnhancedClubDossier** | `src/components/entity-dossier/EnhancedClubDossier.tsx` | 10-tab dossier UI | OutreachStrategyPanel, DossierData types |
| **OutreachStrategyPanel** | `src/components/entity-dossier/OutreachStrategyPanel.tsx` | Strategy + message generation | StrategyReasoning, ApproachDecider, MessageComposer |
| **Dossier API** | `src/app/api/dossier/route.ts` | REST endpoints for dossier generation | Supabase (cache), backend services |

---

## 2. Quick Start Guide

### Generate a Universal Dossier

**Using cURL:**
```bash
curl -X GET "http://localhost:3005/api/dossier?entity_id=arsenal-fc&force=true" \
  -H "Content-Type: application/json"
```

**Response Structure:**
```json
{
  "entity_id": "arsenal-fc",
  "entity_name": "Arsenal FC",
  "tier": "PREMIUM",
  "priority_score": 99,
  "metadata": {
    "generated_at": "2026-02-09T12:00:00Z",
    "data_freshness": 85,
    "confidence_overall": 75,
    "hypothesis_count": 5,
    "signal_count": 12
  },
  "executive_summary": {
    "overall_assessment": { ... },
    "quick_actions": [ ... ],
    "key_insights": [ ... ]
  },
  "digital_infrastructure": { ... },
  "procurement_signals": { ... },
  "leadership_analysis": { ... },
  "timing_analysis": { ... },
  "extracted_hypotheses": [ ... ],
  "extracted_signals": [ ... ]
}
```

### Run Hypothesis-Driven Discovery with Dossier Context

**Python Script:**
```python
import asyncio
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

async def main():
    # Initialize clients
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()
    discovery = HypothesisDrivenDiscovery(claude, brightdata)

    # Prepare dossier context
    dossier = {
        'procurement_signals': [
            {'type': '[PROCUREMENT]', 'text': 'Evaluating CRM platforms', 'confidence': 0.75}
        ],
        'capability_signals': [
            {'type': '[CAPABILITY]', 'text': 'Uses Salesforce', 'confidence': 0.60}
        ]
    }

    # Run discovery with dossier context
    result = await discovery.run_discovery_with_dossier_context(
        entity_id='arsenal-fc',
        entity_name='Arsenal FC',
        dossier=dossier,
        max_iterations=30
    )

    print(f"Final Confidence: {result.final_confidence:.2f}")
    print(f"Signals Discovered: {len(result.signals_discovered)}")
    print(f"Total Cost: ${result.total_cost_usd:.2f}")

asyncio.run(main())
```

**Expected Output:**
```
📋 Running dossier-context discovery for Arsenal FC
📋 Found 1 procurement signals
📋 Found 1 capability signals
🔍 Generated 2 targeted search queries
🔍 Total search results: 15
Final Confidence: 0.72
Signals Discovered: 8
Total Cost: $1.85
```

### Use the Outreach Strategy Tab

**Frontend Integration:**
```tsx
import { EnhancedClubDossier } from '@/components/entity-dossier/EnhancedClubDossier'

function EntityPage({ entity }: { entity: Entity }) {
  const [dossier, setDossier] = useState(null)

  useEffect(() => {
    // Fetch dossier from API
    fetch(`/api/dossier?entity_id=${entity.id}`)
      .then(res => res.json())
      .then(data => setDossier(data))
  }, [entity.id])

  return (
    <EnhancedClubDossier
      entity={entity}
      dossier={dossier}
      onEmailEntity={() => console.log('Email sent')}
    />
  )
}
```

**Tab Navigation:**
- Tab 1: **Overview** - Executive summary, quick actions
- Tab 2: **Leadership** - Decision makers, influence network
- Tab 3: **Digital Maturity** - Tech stack, vendor relationships
- Tab 4: **Procurement Signals** - Upcoming opportunities, budget indicators
- Tab 5: **Timing Analysis** - Contract windows, strategic cycles
- Tab 6: **Risk Assessment** - Implementation risks, competitive landscape
- Tab 7: **Opportunities** - Strategic initiatives, partnerships
- Tab 8: **Strategy** - Hypothesis generation, resource allocation
- Tab 9: **Connections** - Network analysis, mutual connections
- Tab 10: **Outreach Strategy** - **Strategy reasoning, approach decider, message composer**

---

## 3. Backend Integration

### UniversalDossierGenerator API

**Initialization:**
```python
from backend.dossier_generator import UniversalDossierGenerator
from backend.claude_client import ClaudeClient

claude = ClaudeClient()
generator = UniversalDossierGenerator(claude, falkordb_client=None)
```

**Generate Dossier:**
```python
dossier = await generator.generate_universal_dossier(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    entity_type="CLUB",
    priority_score=99,  # Determines tier (0-100)
    entity_data=None  # Auto-collected if None
)

# Returns:
{
    "metadata": { ... },
    "executive_summary": { ... },
    "digital_infrastructure": { ... },
    "procurement_signals": { ... },
    "leadership_analysis": { ... },
    "timing_analysis": { ... },
    "extracted_hypotheses": [ ... ],  # For discovery system
    "extracted_signals": [ ... ],     # Tagged [PROCUREMENT][CAPABILITY][TIMING][CONTACT]
    "generation_time_seconds": 28.5,
    "tier": "PREMIUM"
}
```

**Hypothesis Extraction:**
```python
hypotheses = generator._extract_hypotheses(dossier)
# Example:
[
    {
        "statement": "Arsenal FC is evaluating CRM platforms",
        "signal_type": "[PROCUREMENT]",
        "confidence": 75,
        "validation_strategy": "Search for RFP documents",
        "success_metrics": ["Find tender announcement"],
        "entity_id": "arsenal-fc",
        "type": "PRIMARY"
    }
]
```

**Signal Extraction:**
```python
signals = generator._extract_signals(dossier)
# Example:
[
    {
        "type": "[PROCUREMENT]",
        "insight": "Opportunity: CRM platform evaluation",
        "confidence": 75,
        "timeline": "Q2 2026",
        "entity_id": "arsenal-fc",
        "section": "procurement"
    },
    {
        "type": "[CONTACT]",
        "insight": "Decision maker: {CTO} - Chief Technology Officer",
        "confidence": 70,
        "influence": "HIGH",
        "channel": "linkedin",
        "entity_id": "arsenal-fc",
        "section": "leadership"
    }
]
```

### HypothesisDrivenDiscovery Enhancements

**Dossier Context Integration:**
```python
# Warm-start discovery with dossier-generated hypotheses
result = await discovery.run_discovery_with_dossier_context(
    entity_id='arsenal-fc',
    entity_name='Arsenal FC',
    dossier=dossier,  # Contains procurement/capability signals
    max_iterations=30
)

# Benefits:
# 1. Targeted search queries based on dossier signals
# 2. Pre-initialized hypotheses with higher prior confidence
# 3. Faster convergence (fewer iterations needed)
# 4. Cost reduction ($1.85 vs $2.50 for cold-start)
```

**Signal Mapping:**
```python
# Dossier signals → Discovery hypotheses
signal_map = {
    '[PROCUREMENT]': 'procurement_opportunity',
    '[CAPABILITY]': 'digital_transformation',
    '[TIMING]': 'contract_renewal',
    '[CONTACT]': 'decision_maker_identification'
}

# Automatic hypothesis conversion
hypotheses = await discovery.initialize_from_dossier(
    entity_id='arsenal-fc',
    dossier_hypotheses=[
        {
            'statement': 'Evaluating CRM platforms',
            'category': 'procurement_opportunity',  # Mapped from [PROCUREMENT]
            'confidence': 0.75,
            'signal_type': '[PROCUREMENT]'
        }
    ]
)
# Returns: Number of hypotheses added (e.g., 5)
```

### LinkedInProfiler Outreach Intelligence

**Extract Outreach Intelligence:**
```python
from backend.linkedin_profiler import LinkedInProfiler
from backend.brightdata_sdk_client import BrightDataSDKClient

brightdata = BrightDataSDKClient()
profiler = LinkedInProfiler(brightdata)

intelligence = await profiler.extract_outreach_intelligence(
    entity_name='Arsenal FC',
    target_contacts=[
        'https://linkedin.com/in/cto-arsenal',
        'https://linkedin.com/in/cio-arsenal'
    ],
    yp_team_members=[
        'https://linkedin.com/in/yp-founder',
        'https://linkedin.com/in/yp-sales'
    ],
    days_to_lookback=30
)

# Returns:
OutreachIntelligence(
    entity_name='Arsenal FC',
    mutual_paths=[
        MutualConnectionPath(
            yp_member='https://linkedin.com/in/yp-founder',
            target_contact='https://linkedin.com/in/cto-arsenal',
            mutual_connections=['John Doe', 'Jane Smith'],
            path_strength=0.7,
            connection_type='one_hop'
        )
    ],
    conversation_starters=[
        ConversationStarter(
            post_content='Excited about our digital transformation...',
            post_date='2026-02-01',
            author='CTO Arsenal',
            relevance_score=0.85,
            conversation_angle='I noticed your post about digital transformation...',
            url='https://linkedin.com/posts/123'
        )
    ],
    current_providers=[
        CurrentProvider(
            provider_name='Salesforce',
            solution_type='crm',
            confidence=0.8,
            source_post='We use Salesforce for fan engagement...',
            mentioned_date='2026-01-15'
        )
    ],
    communication_patterns=[
        CommunicationPattern(
            contact_name='CTO Arsenal',
            posting_frequency='weekly',
            best_contact_times=['Tuesday', 'Wednesday'],
            engagement_style='active'
        )
    ],
    generated_at=datetime(2026, 2, 9, 12, 0, 0)
)
```

### BrightData SDK Integration Points

**Primary Methods:**
```python
# 1. Search Engine (Domain Discovery)
results = await brightdata.search_engine(
    query='"Arsenal FC" official website',
    engine='google',
    num_results=10
)
# Returns: {status: 'success', results: [{position, title, url, snippet}, ...]}

# 2. Scrape Content (Markdown)
content = await brightdata.scrape_as_markdown('https://arsenal.com')
# Returns: {status: 'success', content: 'markdown text', ...}

# 3. Batch Scraping (Concurrent)
urls = ['https://site1.com', 'https://site2.com']
results = await brightdata.scrape_batch(urls)
# Returns: {status: 'success', total_urls: 2, successful: 2, results: [...]}

# 4. Job Board Scraping
jobs = await brightdata.scrape_jobs_board(
    entity_name='Arsenal FC',
    keywords=['CRM', 'Digital', 'Data']
)
# Returns: Search results for job postings

# 5. Press Release Scraping
press = await brightdata.scrape_press_release(entity_name='Arsenal FC')
# Returns: Search results for press releases
```

**Cost Management:**
- **Pay-per-success**: Only charged for successful scrapes
- **Automatic retry**: Built-in HTTP fallback if SDK unavailable
- **Rate limiting**: Respect 1 request/second default limit
- **Cache-first**: Check FalkorDB/Supabase before scraping

**DO NOT use MCP tools for BrightData:**
- ❌ `mcp__brightdata__*` (MCP tools)
- ❌ `mcp__brightdata-mcp__*` (MCP tools)
- ✅ `BrightDataSDKClient()` class (always use SDK directly)

---

## 4. Frontend Integration

### EnhancedClubDossier with 10 Tabs

**Component Structure:**
```tsx
// src/components/entity-dossier/EnhancedClubDossier.tsx

export function EnhancedClubDossier({
  entity,
  dossier,
  onEmailEntity
}: EnhancedClubDossierProps) {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-10">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="leadership">Leadership</TabsTrigger>
        <TabsTrigger value="digital">Digital</TabsTrigger>
        <TabsTrigger value="procurement">Procurement</TabsTrigger>
        <TabsTrigger value="timing">Timing</TabsTrigger>
        <TabsTrigger value="risks">Risks</TabsTrigger>
        <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        <TabsTrigger value="strategy">Strategy</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="outreach">Outreach</TabsTrigger>
      </TabsList>

      {/* Tab Contents... */}
    </Tabs>
  )
}
```

**Data Mapping:**
```tsx
// Map API response to component format
function mapApiDossierToEnhancedDossier(apiDossier: any): EnhancedClubDossier {
  return {
    executiveSummary: {
      overallAssessment: apiDossier.executive_summary?.overall_assessment,
      quickActions: apiDossier.executive_summary?.quick_actions,
      keyInsights: apiDossier.executive_summary?.key_insights
    },
    digitalInfrastructure: apiDossier.digital_infrastructure,
    procurementSignals: apiDossier.procurement_signals,
    leadershipAnalysis: apiDossier.leadership_analysis,
    timingAnalysis: apiDossier.timing_analysis,
    riskAssessment: apiDossier.risk_assessment,
    strategicOpportunities: apiDossier.opportunities,
    hypotheses: apiDossier.extracted_hypotheses,
    signals: apiDossier.extracted_signals,
    linkedinConnectionAnalysis: apiDossier.linkedin_connection_analysis
  }
}
```

### OutreachStrategyPanel Component Breakdown

**Three-Component Architecture:**
```tsx
// src/components/entity-dossier/OutreachStrategyPanel.tsx

export function OutreachStrategyPanel({
  entity,
  dossier,
  hypotheses,
  signals,
  linkedInData,
  onApproveOutreach
}: OutreachStrategyPanelProps) {
  return (
    <div className="space-y-6">
      {/* 1. Strategy Reasoning */}
      <StrategyReasoning
        entity={entity}
        dossier={dossier}
        hypotheses={hypotheses}
        signals={signals}
      />

      {/* 2. Approach Decider */}
      <ApproachDecider
        linkedInData={linkedInData}
        signals={signals}
      />

      {/* 3. Message Composer */}
      <MessageComposer
        entity={entity}
        strategy={selectedStrategy}
        intelligence={outreachIntelligence}
        onApprove={onApproveOutreach}
      />
    </div>
  )
}
```

**1. StrategyReasoning Component:**
```tsx
// src/components/entity-dossier/StrategyReasoning.tsx

export function StrategyReasoning({
  entity,
  dossier,
  hypotheses,
  signals
}: StrategyReasoningProps) {
  // Generate reasoning based on:
  // - Hypothesis confidence scores
  // - Signal types (PROCUREMENT vs CAPABILITY)
  // - Dossier executive summary

  const reasoning = generateStrategyReasoning(
    entity,
    dossier,
    hypotheses,
    signals
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Reasoning</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ReasoningBlock
            title="Procurement Readiness"
            score={dossier?.metadata?.confidence_overall || 0}
            signals={signals.filter(s => s.type === '[PROCUREMENT]')}
          />
          <ReasoningBlock
            title="Digital Maturity"
            score={dossier?.digital_infrastructure?.transformation_score || 0}
            signals={signals.filter(s => s.type === '[CAPABILITY]')}
          />
          <ReasoningBlock
            title="Timing Urgency"
            score={calculateTimingScore(dossier?.timing_analysis)}
            signals={signals.filter(s => s.type === '[TIMING]')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

**2. ApproachDecider Component:**
```tsx
// src/components/entity-dossier/ApproachDecider.tsx

export function ApproachDecider({
  linkedInData,
  signals
}: ApproachDeciderProps) {
  // Decide approach based on:
  // - Mutual connection strength
  // - Decision maker communication preferences
  // - Signal confidence

  const approaches = generateApproaches(linkedInData, signals)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended Approaches</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {approaches.map(approach => (
            <ApproachCard
              key={approach.id}
              name={approach.name}
              description={approach.description}
              suitabilityScore={approach.suitability_score}
              reasoning={approach.reasoning}
              talkingPoints={approach.talking_points}
              riskFactors={approach.risk_factors}
              onSelect={() => setSelectedApproach(approach)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

**3. MessageComposer Component:**
```tsx
// src/components/entity-dossier/MessageComposer.tsx

export function MessageComposer({
  entity,
  strategy,
  intelligence,
  onApprove
}: MessageComposerProps) {
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Generate personalized message using:
    // - Entity dossier insights
    // - LinkedIn conversation starters
    // - Mutual connection paths
    // - Current provider context

    const generated = generatePersonalizedMessage(
      entity,
      strategy,
      intelligence
    )
    setMessage(generated)
  }, [entity, strategy, intelligence])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personalized Message</CardTitle>
      </CardHeader>
      <CardContent>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full h-64 p-4 border rounded"
          placeholder="Generated message will appear here..."
        />
        <div className="mt-4 flex gap-2">
          <Button onClick={() => onApprove({ message, ...strategy })}>
            Approve & Send
          </Button>
          <Button variant="outline" onClick={regenerate}>
            Regenerate
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### API Endpoint Usage

**GET /api/dossier**
```typescript
// Fetch single dossier
const response = await fetch(
  `/api/dossier?entity_id=${entityId}&force=false`
)
const dossier = await response.json()

// Response:
interface DossierResponse {
  entity_id: string
  entity_name: string
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM'
  priority_score: number
  metadata: {
    generated_at: string
    data_freshness: number
    confidence_overall: number
    hypothesis_count: number
    signal_count: number
  }
  executive_summary: { ... }
  digital_infrastructure: { ... }
  procurement_signals: { ... }
  leadership_analysis: { ... }
  timing_analysis: { ... }
  extracted_hypotheses: Hypothesis[]
  extracted_signals: Signal[]
  cache_status: 'CACHED' | 'GENERATED'
}
```

**POST /api/dossier (Batch)**
```typescript
// Generate multiple dossiers
const response = await fetch('/api/dossier', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entity_ids: ['arsenal-fc', 'chelsea-fc', 'liverpool-fc'],
    force: false
  })
})
const batch = await response.json()

// Response:
interface BatchResponse {
  results: DossierResponse[]
  summary: {
    total: number
    successful: number
    cached: number
    generated: number
    failed: number
    total_cost_usd: number
    total_time_seconds: number
  }
}
```

---

## 5. Configuration

### Tier-Based Generation Costs

| Tier | Priority Score | Sections | Time | Cost | Use Case |
|------|---------------|----------|------|------|----------|
| **BASIC** | 0-20 | 3 | ~5s | ~$0.0004 | Low-priority entities, bulk scanning |
| **STANDARD** | 21-50 | 7 | ~15s | ~$0.0095 | Medium-priority, monitoring phase |
| **PREMIUM** | 51-100 | 11 | ~30s | ~$0.057 | High-priority, sales-ready targets |

**Section Distribution by Tier:**

**BASIC (3 sections):**
1. Core Information (Haiku)
2. Quick Actions (Haiku)
3. Contact Information (Haiku)

**STANDARD (7 sections):**
1-3. Basic sections
4. Recent News (Haiku)
5. Current Performance (Haiku)
6. Leadership (Sonnet)
7. Digital Maturity (Sonnet)

**PREMIUM (11 sections):**
1-7. Standard sections
8. AI Reasoner Assessment (Sonnet)
9. Challenges & Opportunities (Sonnet)
10. Strategic Analysis (Opus)
11. Connections (Opus)

### Batch Processing Settings

**Environment Variables:**
```bash
# .env.local

# Claude AI Configuration
ANTHROPIC_API_KEY=your-claude-api-key
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1  # Or use Z.AI proxy

# BrightData Configuration
BRIGHTDATA_API_TOKEN=your-brightdata-token

# FalkorDB Configuration
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-falkordb-password

# Supabase Configuration (Cache)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Dossier Generation
DOSSIER_CACHE_TTL=86400  # 24 hours in seconds
DOSSIER_BATCH_SIZE=10  # Max dossiers per batch
DOSSIER_FORCE_REGENERATE=false  # Default force flag

# Discovery Configuration
DISCOVERY_MAX_ITERATIONS=30
DISCOVERY_MAX_DEPTH=3
DISCOVERY_MAX_COST_PER_ENTITY=2.0

# Model Cascade Probabilities
MODEL_CASCADE_HAIKU_PROBABILITY=0.80
MODEL_CASCADE_SONNET_PROBABILITY=0.15
MODEL_CASCADE_OPUS_PROBABILITY=0.05
```

### Model Cascade Strategy

**Cost-Optimized Model Selection:**
```python
# 80% Haiku (Fast, Cheap)
if rollout < 0.80:
    model = "haiku"
    cost = ~$0.00025 per section

# 15% Sonnet (Balanced)
elif rollout < 0.95:
    model = "sonnet"
    cost = ~$0.003 per section

# 5% Opus (Deep Analysis)
else:
    model = "opus"
    cost = ~$0.015 per section
```

**Fallback Strategy:**
1. Try primary model (based on cascade)
2. If validation fails → Fallback to Sonnet
3. If Sonnet fails → Fallback to Opus
4. If all fail → Return minimal valid dossier

---

## 6. Testing Guide

### Unit Test Examples

**Backend Tests:**
```python
# backend/tests/test_dossier_generator.py

import pytest
from backend.dossier_generator import UniversalDossierGenerator
from backend.schemas import EntityDossier

@pytest.mark.asyncio
async def test_basic_tier_generation():
    """Test BASIC tier dossier generation"""
    claude = ClaudeClient()
    generator = UniversalDossierGenerator(claude)

    dossier = await generator.generate_dossier(
        entity_id="test-entity",
        entity_name="Test Entity",
        entity_type="CLUB",
        priority_score=10  # BASIC tier
    )

    assert dossier.tier == "BASIC"
    assert len(dossier.sections) == 3
    assert dossier.total_cost_usd < 0.001

@pytest.mark.asyncio
async def test_hypothesis_extraction():
    """Test hypothesis extraction from dossier"""
    generator = UniversalDossierGenerator(claude)

    dossier_dict = {
        "executive_summary": {
            "key_insights": [
                {
                    "insight": "Entity is evaluating CRM platforms",
                    "signal_type": "[PROCUREMENT]",
                    "confidence": 75,
                    "hypothesis_ready": True
                }
            ]
        },
        "recommended_approach": {
            "hypothesis_generation": {
                "primary_hypothesis": {
                    "statement": "RFP likely in Q2 2026",
                    "confidence": 70
                }
            }
        }
    }

    hypotheses = generator._extract_hypotheses(dossier_dict)

    assert len(hypotheses) == 2
    assert hypotheses[0]["type"] == "INSIGHT"
    assert hypotheses[1]["type"] == "PRIMARY"

@pytest.mark.asyncio
async def test_signal_tagging():
    """Test signal extraction with tags"""
    generator = UniversalDossierGenerator(claude)

    dossier_dict = {
        "procurement_signals": {
            "upcoming_opportunities": [
                {
                    "opportunity": "CRM platform evaluation",
                    "rfp_probability": 80
                }
            ]
        },
        "leadership_analysis": {
            "decision_makers": [
                {
                    "name": "John Doe",
                    "title": "CTO",
                    "influence_level": "HIGH"
                }
            ]
        }
    }

    signals = generator._extract_signals(dossier_dict)

    assert len(signals) == 2
    assert signals[0]["type"] == "[PROCUREMENT]"
    assert signals[1]["type"] == "[CONTACT]"
```

### Integration Test Scenarios

**End-to-End Dossier Generation:**
```python
# backend/tests/test_e2e_dossier.py

@pytest.mark.asyncio
async def test_full_dossier_pipeline():
    """Test complete dossier generation pipeline"""
    # 1. Initialize clients
    claude = ClaudeClient()
    brightdata = BrightDataSDKClient()
    falkordb = FalkorDBClient()

    # 2. Generate dossier
    generator = UniversalDossierGenerator(claude, falkordb)
    dossier = await generator.generate_universal_dossier(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        priority_score=99
    )

    # 3. Validate structure
    assert "metadata" in dossier
    assert "executive_summary" in dossier
    assert "extracted_hypotheses" in dossier
    assert "extracted_signals" in dossier

    # 4. Run discovery with dossier context
    discovery = HypothesisDrivenDiscovery(claude, brightdata)
    result = await discovery.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier=dossier
    )

    # 5. Validate discovery results
    assert result.final_confidence > 0.5
    assert len(result.signals_discovered) > 0
    assert result.total_cost_usd < 2.0

    print(f"✅ Full pipeline test passed")
    print(f"   Confidence: {result.final_confidence:.2f}")
    print(f"   Signals: {len(result.signals_discovered)}")
    print(f"   Cost: ${result.total_cost_usd:.2f}")
```

**Frontend Integration Test:**
```typescript
// tests/entity-dossier.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import { EnhancedClubDossier } from '@/components/entity-dossier/EnhancedClubDossier'

describe('EnhancedClubDossier', () => {
  it('renders all 10 tabs', () => {
    const mockEntity = {
      id: 'arsenal-fc',
      type: 'club',
      name: 'Arsenal FC',
      properties: {}
    }

    const mockDossier = {
      entity_id: 'arsenal-fc',
      tier: 'PREMIUM',
      executive_summary: { ... },
      extracted_hypotheses: [ ... ],
      extracted_signals: [ ... ]
    }

    render(
      <EnhancedClubDossier
        entity={mockEntity}
        dossier={mockDossier}
        onEmailEntity={() => {}}
      />
    )

    // Verify all tabs are present
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Leadership')).toBeInTheDocument()
    expect(screen.getByText('Digital')).toBeInTheDocument()
    expect(screen.getByText('Procurement')).toBeInTheDocument()
    expect(screen.getByText('Timing')).toBeInTheDocument()
    expect(screen.getByText('Risks')).toBeInTheDocument()
    expect(screen.getByText('Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Strategy')).toBeInTheDocument()
    expect(screen.getByText('Connections')).toBeInTheDocument()
    expect(screen.getByText('Outreach')).toBeInTheDocument()
  })

  it('displays outreach strategy panel with intelligence', async () => {
    // Click Outreach tab
    const outreachTab = screen.getByText('Outreach')
    fireEvent.click(outreachTab)

    // Verify strategy components render
    await waitFor(() => {
      expect(screen.getByText('Strategy Reasoning')).toBeInTheDocument()
      expect(screen.getByText('Recommended Approaches')).toBeInTheDocument()
      expect(screen.getByText('Personalized Message')).toBeInTheDocument()
    })
  })
})
```

### End-to-End Testing Workflow

**Manual Testing Checklist:**

1. **Dossier Generation**
   - [ ] BASIC tier generates 3 sections
   - [ ] STANDARD tier generates 7 sections
   - [ ] PREMIUM tier generates 11 sections
   - [ ] Cache returns cached dossier when force=false
   - [ ] Force regenerate bypasses cache

2. **Hypothesis Extraction**
   - [ ] Extracts from executive_summary insights
   - [ ] Extracts from recommended_approach
   - [ ] Tags with signal types [PROCUREMENT][CAPABILITY][TIMING][CONTACT]
   - [ ] Assigns confidence scores 0-100

3. **Signal Extraction**
   - [ ] Extracts from procurement_signals
   - [ ] Extracts from leadership_analysis
   - [ ] Extracts from timing_analysis
   - [ ] Extracts from digital_infrastructure

4. **Discovery with Dossier Context**
   - [ ] Initializes hypotheses from dossier
   - [ ] Generates targeted search queries
   - [ ] Runs EIG-based prioritization
   - [ ] Returns validated signals

5. **Outreach Strategy Panel**
   - [ ] Strategy reasoning displays procurement readiness
   - [ ] Approach decider recommends channels
   - [ ] Message composer generates personalized text
   - [ ] Approve button triggers callback

---

## 7. Troubleshooting

### Common Issues and Solutions

**Issue 1: Dossier Generation Fails**
```
Error: "Failed to generate dossier - all models failed"
```
**Cause**: All three models (Haiku, Sonnet, Opus) failed validation
**Solution**:
```python
# Check Claude API key
echo $ANTHROPIC_API_KEY

# Test connection
python -c "from backend.claude_client import ClaudeClient; import asyncio; asyncio.run(ClaudeClient().query('test'))"

# If using Z.AI proxy, check base URL
echo $ANTHROPIC_BASE_URL  # Should be https://api.z.ai/api/anthropic
```

**Issue 2: Hypothesis Extraction Returns Empty**
```
Warning: "⚠️ Error extracting hypotheses: ..."
```
**Cause**: Invalid dossier structure or missing required fields
**Solution**:
```python
# Validate dossier structure before extraction
required_fields = ["metadata", "executive_summary"]
for field in required_fields:
    if field not in dossier:
        logger.error(f"Missing required field: {field}")
        # Fallback to minimal dossier
        dossier = generator._create_minimal_dossier(entity_name)
```

**Issue 3: Discovery Cost Too High**
```
Warning: "Total cost exceeded budget: $2.50"
```
**Cause**: Too many iterations or expensive hop types
**Solution**:
```python
# Reduce max iterations
result = await discovery.run_discovery(
    entity_id='arsenal-fc',
    entity_name='Arsenal FC',
    template_id='tier_1_club_centralized_procurement',
    max_iterations=20,  # Reduced from 30
    max_depth=2  # Reduced from 3
)

# Or use dossier context (cheaper)
result = await discovery.run_discovery_with_dossier_context(
    entity_id='arsenal-fc',
    entity_name='Arsenal FC',
    dossier=dossier  # Pre-validates hypotheses
)
```

**Issue 4: LinkedIn Profiler Returns Empty**
```
Warning: "No mutual connections found"
```
**Cause**: LinkedIn scraping blocked or rate limited
**Solution**:
```python
# Check BrightData API token
echo $BRIGHTDATA_API_TOKEN

# Use cached data if available
profiles = await profiler.profile_entity(
    entity_name='Arsenal FC',
    pass_number=1,
    use_cached=True  # Use cached results
)

# Or use alternative data sources
# - Company website leadership pages
# - Press releases with executive quotes
# - Annual reports with board bios
```

**Issue 5: Frontend Tab Not Rendering**
```
Error: "activeTab changed to outreach but panel not rendering"
```
**Cause**: Missing dossier data or incorrect data structure
**Solution**:
```tsx
// Ensure dossier data is loaded before rendering tabs
useEffect(() => {
  const loadDossier = async () => {
    const data = await fetch(`/api/dossier?entity_id=${entity.id}`)
    const json = await data.json()

    // Validate structure
    if (json.metadata && json.executive_summary) {
      setDossier(json)
    } else {
      console.error('Invalid dossier structure:', json)
    }
  }

  loadDossier()
}, [entity.id])
```

### Performance Optimization Tips

**1. Dossier Generation**
```python
# Use batch processing for multiple entities
from backend.dossier_generator import UniversalDossierGenerator

entity_ids = ['arsenal-fc', 'chelsea-fc', 'liverpool-fc']

# Generate in parallel (faster)
tasks = [
    generator.generate_universal_dossier(eid, eid.split('-')[0].title(), 'CLUB', 50)
    for eid in entity_ids
]
dossiers = await asyncio.gather(*tasks)

# Instead of sequential (slower)
dossiers = []
for eid in entity_ids:
    dossier = await generator.generate_universal_dossier(eid, ...)
    dossiers.append(dossier)
```

**2. Discovery with Dossier Context**
```python
# Warm-start with dossier (2x faster, 3x cheaper)
result_with_dossier = await discovery.run_discovery_with_dossier_context(
    entity_id='arsenal-fc',
    entity_name='Arsenal FC',
    dossier=dossier  # Pre-validated hypotheses
)
# Cost: ~$1.85, Time: ~45s

# Instead of cold-start (slower, expensive)
result_cold_start = await discovery.run_discovery(
    entity_id='arsenal-fc',
    entity_name='Arsenal FC',
    template_id='tier_1_club_centralized_procurement'
)
# Cost: ~$2.50, Time: ~90s
```

**3. Cache Strategy**
```python
# Use intelligent caching
from backend.dossier_generator import UniversalDossierGenerator

# Check cache first
cached = await get_dossier_from_cache('arsenal-fc')
if cached and not is_cache_expired(cached, ttl_hours=24):
    print("✅ Using cached dossier (24h fresh)")
    dossier = cached
else:
    print("⚠️ Cache miss, generating new dossier")
    dossier = await generator.generate_universal_dossier(...)
    await cache_dossier(dossier)
```

**4. Frontend Rendering**
```tsx
// Use React.memo to prevent re-renders
export const OutreachStrategyPanel = React.memo(({
  entity,
  dossier,
  hypotheses,
  signals
}: OutreachStrategyPanelProps) => {
  // Component code...
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.entity.id === nextProps.entity.id &&
    prevProps.dossier?.metadata?.generated_at === nextProps.dossier?.metadata?.generated_at
  )
})

// Use virtualization for long lists
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={400}
  itemCount={signals.length}
  itemSize={50}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <SignalCard signal={signals[index]} />
    </div>
  )}
</FixedSizeList>
```

### Cost Management

**1. Model Cascade Optimization**
```python
# Adjust probabilities based on budget
LOW_BUDGET = {
    "haiku": 0.95,  # 95% Haiku (cheapest)
    "sonnet": 0.05,
    "opus": 0.00
}

STANDARD_BUDGET = {
    "haiku": 0.80,
    "sonnet": 0.15,
    "opus": 0.05  # Default
}

HIGH_BUDGET = {
    "haiku": 0.50,
    "sonnet": 0.30,
    "opus": 0.20  # More Opus for quality
}
```

**2. Discovery Iteration Limits**
```python
# Set strict limits to prevent cost overruns
MAX_COST_PER_ENTITY = 2.0  # USD
MAX_ITERATIONS = 30
MAX_DEPTH = 3

# Early stopping conditions
if discovery.total_cost_usd >= MAX_COST_PER_ENTITY:
    logger.warning(f"Cost limit reached: ${discovery.total_cost_usd:.2f}")
    break

if state.current_confidence >= 0.80:
    logger.info(f"Target confidence reached: {state.current_confidence:.2f}")
    break
```

**3. BrightData SDK Optimization**
```python
# Batch scraping (more efficient)
urls = ['https://site1.com', 'https://site2.com', 'https://site3.com']
results = await brightdata.scrape_batch(urls)
# 1 API call, 3 URLs scraped

# Instead of sequential (less efficient)
for url in urls:
    result = await brightdata.scrape_as_markdown(url)
# 3 API calls, slower

# Use cached data when possible
jobs = await brightdata.scrape_jobs_board(
    entity_name='Arsenal FC',
    keywords=['CRM', 'Digital']
)
# Returns cached results if available
```

---

## 8. Success Metrics

### Technical Metrics

**Dossier Quality:**
```python
# Measure dossier completeness
def calculate_dossier_quality_score(dossier: dict) -> float:
    """
    Calculate dossier quality score (0-100)

    Factors:
    - Data freshness (0-20 points)
    - Confidence scores (0-30 points)
    - Section completeness (0-30 points)
    - Hypothesis count (0-10 points)
    - Signal count (0-10 points)
    """
    score = 0

    # Data freshness
    freshness = dossier.get('metadata', {}).get('data_freshness', 0)
    score += (freshness / 100) * 20

    # Confidence scores
    confidence = dossier.get('metadata', {}).get('confidence_overall', 0)
    score += (confidence / 100) * 30

    # Section completeness
    required_sections = [
        'executive_summary',
        'digital_infrastructure',
        'procurement_signals',
        'leadership_analysis',
        'timing_analysis'
    ]
    completed = sum(1 for s in required_sections if s in dossier)
    score += (completed / len(required_sections)) * 30

    # Hypothesis count
    hypothesis_count = len(dossier.get('extracted_hypotheses', []))
    score += min(hypothesis_count / 5, 1.0) * 10

    # Signal count
    signal_count = len(dossier.get('extracted_signals', []))
    score += min(signal_count / 10, 1.0) * 10

    return score

# Target: Quality score > 70 for production use
```

**Generation Time:**
```python
# Measure generation performance
generation_time = dossier.get('generation_time_seconds', 0)

# Targets:
# BASIC tier: < 10 seconds
# STANDARD tier: < 20 seconds
# PREMIUM tier: < 40 seconds

if dossier['tier'] == 'BASIC' and generation_time > 10:
    logger.warning(f"BASIC tier slow: {generation_time:.2f}s")
elif dossier['tier'] == 'PREMIUM' and generation_time > 40:
    logger.warning(f"PREMIUM tier slow: {generation_time:.2f}s")
```

**Cost Efficiency:**
```python
# Calculate cost per signal
cost_per_signal = result.total_cost_usd / len(result.signals_discovered)

# Target: < $0.25 per signal
if cost_per_signal > 0.25:
    logger.warning(f"High cost per signal: ${cost_per_signal:.2f}")
else:
    logger.info(f"✅ Cost efficient: ${cost_per_signal:.2f} per signal")
```

### Business Metrics

**Response Rates:**
```typescript
// Track outreach response rates
interface OutreachMetrics {
  sent: number
  opened: number
  replied: number
  meeting_booked: number
  deal_closed: number
}

function calculateResponseRates(metrics: OutreachMetrics) {
  return {
    open_rate: (metrics.opened / metrics.sent) * 100,
    reply_rate: (metrics.replied / metrics.sent) * 100,
    meeting_rate: (metrics.meeting_booked / metrics.sent) * 100,
    closing_rate: (metrics.deal_closed / metrics.sent) * 100
  }
}

// Targets:
// Open rate: > 50%
// Reply rate: > 20%
// Meeting rate: > 10%
// Closing rate: > 2%
```

**Pipeline Velocity:**
```python
# Measure time from dossier to deal
days_to_contact = 2  # Average days to first contact
days_to_meeting = 14  # Average days to meeting booked
days_to_deal = 90  # Average days to close deal

# Targets:
# First contact within 3 days of dossier generation
# Meeting within 30 days
# Deal within 120 days
```

**Deal Attribution:**
```python
# Track which dossier insights led to deals
def attribute_deal_to_insights(deal: dict, dossier: dict) -> list:
    """
    Identify which insights contributed to deal closure

    Returns:
        List of insight IDs that were decisive
    """
    decisive_insights = []

    # Check if procurement signals predicted correctly
    for signal in dossier.get('extracted_signals', []):
        if signal['type'] == '[PROCUREMENT]':
            if deal['outcome'] == 'won' and signal['confidence'] > 70:
                decisive_insights.append(signal)

    # Check if timing analysis was accurate
    timing_analysis = dossier.get('timing_analysis', {})
    for window in timing_analysis.get('contract_windows', []):
        deal_date = parse_date(deal['closed_at'])
        predicted_date = parse_date(window['action_deadline'])
        if abs((deal_date - predicted_date).days) < 30:
            decisive_insights.append(window)

    return decisive_insights
```

### How to Track and Measure

**1. Backend Logging:**
```python
# Add structured logging to all components
import logging
import json

logger = logging.getLogger(__name__)

def log_dossier_generation(dossier: dict, generation_time: float):
    """Log dossier generation metrics"""
    metrics = {
        'event': 'dossier_generated',
        'entity_id': dossier['entity_id'],
        'tier': dossier['tier'],
        'sections': len(dossier.get('sections', [])),
        'hypotheses': len(dossier.get('extracted_hypotheses', [])),
        'signals': len(dossier.get('extracted_signals', [])),
        'generation_time_seconds': generation_time,
        'cost_usd': dossier.get('total_cost_usd', 0),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
    logger.info(json.dumps(metrics))
```

**2. Frontend Analytics:**
```typescript
// Track user interactions with dossiers
import { track } from '@vercel/analytics/react'

export function EnhancedClubDossier({ entity, dossier }: Props) {
  useEffect(() => {
    // Track dossier view
    track('dossier_viewed', {
      entity_id: entity.id,
      tier: dossier?.tier,
      sections_count: dossier?.sections?.length
    })
  }, [entity, dossier])

  const handleTabChange = (tab: string) => {
    // Track tab navigation
    track('dossier_tab_changed', {
      entity_id: entity.id,
      tab: tab,
      tier: dossier?.tier
    })
  }

  const handleOutreachApproved = (strategy: OutreachStrategy) => {
    // Track outreach approval
    track('outreach_approved', {
      entity_id: entity.id,
      approach: strategy.selectedApproach,
      message_length: strategy.message.length
    })
  }
}
```

**3. Database Storage:**
```sql
-- Create metrics tracking table
CREATE TABLE dossier_metrics (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(255),
    tier VARCHAR(20),
    generation_time_seconds FLOAT,
    cost_usd FLOAT,
    hypothesis_count INTEGER,
    signal_count INTEGER,
    quality_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create outreach tracking table
CREATE TABLE outreach_metrics (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(255),
    dossier_id VARCHAR(255),
    approach_type VARCHAR(100),
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    replied_at TIMESTAMP,
    meeting_booked_at TIMESTAMP,
    deal_closed_at TIMESTAMP,
    outcome VARCHAR(50)
);
```

**4. Dashboard Visualization:**
```typescript
// Create monitoring dashboard
// src/app/admin/dossier-metrics/page.tsx

export default function DossierMetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(null)

  useEffect(() => {
    async function loadMetrics() {
      const response = await fetch('/api/admin/dossier-metrics')
      const data = await response.json()
      setMetrics(data)
    }
    loadMetrics()
  }, [])

  return (
    <div>
      <MetricsCard
        title="Average Generation Time"
        value={`${metrics?.avg_generation_time.toFixed(2)}s`}
        target="< 30s"
      />
      <MetricsCard
        title="Average Cost per Dossier"
        value={`$${metrics?.avg_cost_usd.toFixed(4)}`}
        target="< $0.05"
      />
      <MetricsCard
        title="Response Rate"
        value={`${metrics?.response_rate.toFixed(1)}%`}
        target="> 20%"
      />
      <MetricsCard
        title="Meeting Rate"
        value={`${metrics?.meeting_rate.toFixed(1)}%`}
        target="> 10%"
      />
    </div>
  )
}
```

---

## Appendix

### Signal Type Reference

| Tag | Meaning | Example | Priority |
|-----|---------|---------|----------|
| **[PROCUREMENT]** | Active buying signal | "Evaluating CRM platforms" | HIGH |
| **[CAPABILITY]** | Tech gap or digital maturity | "Uses legacy analytics" | MEDIUM |
| **[TIMING]** | Contract window or cycle | "Contract renews in Q2" | HIGH |
| **[CONTACT]** | Decision maker identified | "CTO controls budget" | MEDIUM |

### Confidence Band Reference

| Band | Range | Price | Action |
|------|-------|-------|--------|
| **EXPLORATORY** | < 0.30 | $0 | Monitor only |
| **INFORMED** | 0.30 - 0.60 | $500/entity/month | Add to watchlist |
| **CONFIDENT** | 0.60 - 0.80 | $2,000/entity/month | Sales engaged |
| **ACTIONABLE** | > 0.80 + gate | $5,000/entity/month | Immediate outreach |

### Model Pricing (per 1M tokens)

| Model | Input | Output | Avg Cost |
|-------|-------|--------|----------|
| **Haiku** | $0.25 | $1.25 | ~$0.00025/section |
| **Sonnet** | $3.00 | $15.00 | ~$0.003/section |
| **Opus** | $15.00 | $75.00 | ~$0.015/section |

---

**Document Version**: 1.0
**Last Updated**: 2026-02-09
**Maintained By**: Yellow Panther AI Team
**For Support**: #engineering-ai Slack channel
