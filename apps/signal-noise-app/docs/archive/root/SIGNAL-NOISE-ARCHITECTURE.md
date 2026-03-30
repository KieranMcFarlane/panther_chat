# Signal Noise App - Architecture & Component Catalog

**Distilled reference guide for developers working on the Signal Noise AI-powered sports intelligence platform.**

---

## Executive Summary

**Signal Noise** is an AI-powered RFP (Request for Proposal) detection and prediction system that monitors 3,400+ sports entities to identify procurement opportunities before they're publicly announced.

**Architecture Pattern**: Headless Backend + Optional Frontend
- Backend can run **standalone** as an API/AI service
- Frontend (Next.js 14) is a **consumer** of backend APIs
- All business logic lives in backend (Python FastAPI)
- Frontend is replaceable (could be React Native, desktop app, CLI, etc.)

**Core Philosophy**: API-first, headless by design
- ✅ Backend works without frontend
- ✅ Frontend works with any backend implementing the API contract
- ✅ Mobile apps, CLI tools, integrations can all use same APIs
- ✅ UI is decoupled from business logic

---

## Part 1: System Architecture

### 1.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Optional)                      │
│  Next.js 14 + CopilotKit + shadcn/ui + Tailwind CSS        │
│  Port: 3005 (dev) / 4328 (prod)                            │
└─────────────────────────────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Required)                       │
│  Python FastAPI + Claude Agent SDK + BrightData SDK        │
│  Port: 8001 (Ralph Loop)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ FalkorDB │      │ Supabase │      │ Graphiti │
    │  (Local) │      │ (Cloud)  │      │ (Local)  │
    └──────────┘      └──────────┘      └──────────┘
```

### 1.2 Core Services

| Service | Language | Port | Purpose | Headless? |
|---------|----------|------|---------|-----------|
| **Ralph Loop Server** | Python (FastAPI) | 8001 | RFP validation, Claude agent orchestration | ✅ Yes |
| **Temporal Prior Service** | Python (async) | - | Computes temporal multipliers from historical data | ✅ Yes |
| **Graphiti Service** | Python | - | Temporal knowledge graph, episode storage | ✅ Yes |
| **BrightData SDK Client** | Python (async) | - | Web scraping, search engine integration | ✅ Yes |
| **FalkorDB MCP Server** | Python (FastMCP) | stdio | Native graph database queries | ✅ Yes |
| **Temporal Intelligence MCP** | Python (FastMCP) | stdio | Timeline analysis, pattern detection | ✅ Yes |
| **Next.js Frontend** | TypeScript (Next.js 14) | 3005/4328 | UI, dashboard, entity browser | ❌ Optional |

### 1.3 Data Flow (Headless View)

```
1. SIGNAL INGESTION (Backend-only)
   ┌─────────────────────────────────────────────────────┐
   │ Sources:                                            │
   │ • LinkedIn webhooks (BrightData SDK)                │
   │ • Search engines (BrightData SDK)                   │
   │ • Official sites (scraping)                         │
   │ • Press releases (scraping)                         │
   │                                                      │
   │ Pipeline:                                           │
   │   Raw signal → EvidenceItem → SignalCandidate       │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
2. RALPH LOOP VALIDATION (Backend-only)
   ┌─────────────────────────────────────────────────────┐
   │ Pass 1: Rule-based filter (min evidence, confidence) │
   │ Pass 1.5: Evidence verification (URLs, credibility)  │
   │ Pass 2: Claude validation (model cascade)          │
   │ Pass 3: Final confirmation (temporal multiplier)    │
   │ Pass 4: Graphiti storage (authoritative source)     │
   │                                                      │
   │ Output: ValidatedSignal                             │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
3. TEMPORAL INTELLIGENCE (Backend-only)
   ┌─────────────────────────────────────────────────────┐
   │ Nightly computation:                                │
   │ • Seasonality (Q1-Q4 patterns)                      │
   │ • Recurrence (interval analysis)                    │
   │ • Momentum (recent activity)                        │
   │ • Backoff chain (entity → cluster → global)        │
   │                                                      │
   │ Output: Temporal multipliers (0.75 - 1.40)          │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
4. STORAGE & QUERYING (Backend-only)
   ┌─────────────────────────────────────────────────────┐
   │ Primary:                                            │
   │ • FalkorDB (graph DB, 3,400+ entities)             │
   │ • Supabase (22 tables, cache layer)                │
   │ • Graphiti (temporal episodes)                     │
   │                                                      │
   │ Query interfaces:                                   │
   │ • MCP servers (stdio transport)                     │
   │ • REST APIs (for frontend/consumers)                │
   │ • Direct Python imports (for backend services)      │
   └─────────────────────────────────────────────────────┘
                         │
                         ▼
5. OPTIONAL FRONTEND (Next.js)
   ┌─────────────────────────────────────────────────────┐
   │ Consumes backend APIs via HTTP/REST:                │
   │ • Entity browser (/api/entities/*)                 │
   │ • RFP dashboard (/api/graphiti/*)                   │
   │ • AI chat (/api/copilotkit/*)                       │
   │ • Temporal intelligence (via MCP)                  │
   └─────────────────────────────────────────────────────┘
```

---

## Part 2: Schema & Data Models

### 2.1 Fixed Schema (iteration_02 compliant)

```python
# backend/schemas.py

@dataclass
class Entity:
    """Sports organization, person, or venue"""
    id: str
    name: str
    type: EntityType  # ORG, PERSON, PRODUCT, INITIATIVE, VENUE
    first_seen: datetime
    metadata: Dict[str, Any]

@dataclass
class Evidence:
    """Supporting evidence for a signal"""
    id: str
    signal_id: str
    source: str
    url: str
    extracted_text: str
    credibility_score: float
    verified: bool  # iteration_02: evidence verification
    accessible: bool  # URL accessible?

@dataclass
class ConfidenceValidation:
    """Pass 2 output from Claude validation"""
    original_confidence: float
    validated_confidence: float
    adjustment: float  # +/- delta
    rationale: str
    requires_manual_review: bool

@dataclass
class Signal:
    """RFP signal (candidate or validated)"""
    id: str
    type: SignalType  # RFP_DETECTED, PARTNERSHIP_FORMED, etc.
    confidence: float
    first_seen: datetime
    entity_id: str
    validated: bool
    validation_pass: int  # 1, 1.5, 2, 3
    confidence_validation: Optional[ConfidenceValidation]
    temporal_multiplier: float  # iteration_02: temporal intelligence
    yellow_panther_fit_score: float  # Yellow Panther optimization
    yellow_panther_priority: str  # TIER_1, TIER_2, TIER_3, TIER_4
```

### 2.2 Extended RFP Discovery Schema

```python
# backend/rfc_discovery_schema.py

class SignalCategory(Enum):
    """14 RFP categories for sports entities"""
    CRM = "CRM"
    TICKETING = "TICKETING"
    DATA_PLATFORM = "DATA_PLATFORM"
    COMMERCE = "COMMERCE"
    CONTENT = "CONTENT"
    MARKETING = "MARKETING"
    ANALYTICS = "ANALYTICS"
    COMMUNICATION = "COMMUNICATION"
    COLLABORATION = "COLLABORATION"
    OPERATIONS = "OPERATIONS"
    HR = "HR"
    FINANCE = "FINANCE"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY = "SECURITY"

@dataclass
class EvidenceItem:
    """Evidence with verification metadata (Pass 1.5)"""
    id: str
    source: str  # LinkedIn, Official Site, Press Release
    url: str
    date: datetime
    extracted_text: str
    credibility_score: float  # 0.0 - 1.0
    verified: bool  # URL accessible?
    accessible: bool  # Domain reachable?

@dataclass
class SignalCandidate:
    """Before Ralph Loop validation"""
    id: str
    entity_id: str
    entity_name: str
    category: SignalCategory
    evidence: List[EvidenceItem]
    raw_confidence: float
    temporal_multiplier: float  # From temporal priors
    discovered_at: datetime

@dataclass
class ValidatedSignal:
    """After Ralph Loop validation (Pass 3+)"""
    id: str
    entity_id: str
    entity_name: str
    category: SignalCategory
    confidence: float  # Final (with temporal multiplier)
    validation_pass: int  # 3 (validated), 4 (stored)
    evidence: List[EvidenceItem]
    temporal_multiplier: float
    primary_reason: str  # TECHNOLOGY_OBSOLESCENCE, etc.
    primary_reason_confidence: float
    urgency: str  # HIGH, MEDIUM, LOW
    yellow_panther_fit_score: float  # 0-100
    yellow_panther_priority: str  # TIER_1, TIER_2, TIER_3, TIER_4
    confidence_validation: Optional[ConfidenceValidation]
    validated_at: datetime
```

---

## Part 3: shadcn/ui Component Catalog

### 3.1 Component Mapping by Function

| Function | shadcn/ui Component | Props | Usage |
|----------|---------------------|-------|-------|
| **Entity Browser** | | | |
| Entity list | `Table` | `columns`, `data` | Display entities with pagination |
| Entity cards | `Card` | `@click` handlers | Entity overview with badges |
| Search | `Input` + `useDebounce` | `placeholder="Search entities..."` | Filter by name/type |
| Filters | `MultiSelect` | `categories`, `countries` | Filter by entity attributes |
| Badges | `Badge` | `variant="outline"` | Show entity type, country |
| **RFP Dashboard** | | | |
| Signal list | `DataTable` | sortable columns | Validated signals with scores |
| Confidence meter | `Progress` | `value={confidence * 100}` | Visual confidence indicator |
| Temporal chart | `LineChart` (Recharts) | `data={timeline}` | Seasonality visualization |
| Evidence cards | `Accordion` | `evidenceItems` | Expandable evidence details |
| **AI Chat** | | | |
| Chat input | `Textarea` + `autosize` | `placeholder="Ask about entities..."` | CopilotKit integration |
| Messages | `ScrollArea` | `messages` | Chat history |
| Tool calls | `Badge` | `variant="secondary"` | Show MCP tools used |
| **Alert Center** | | | |
| Opportunity feed | `Card` + `Tabs` | `tier` | Filter by priority tier |
| Alert status | `Badge` | `variant={delivered ? "success" : "warning"}` | Delivery status |
| Delivery logs | `Table` | `logs` | Channel delivery tracking |
| **Forms** | | | |
| Entity create | `Form` + `useForm` | `zodSchema` | Entity creation form |
| Signal validate | `Dialog` + `Form` | `signalData` | Manual validation trigger |
| Settings | `Tabs` + `Switch` | `config` | System configuration |

### 3.2 Common Component Patterns

#### Pattern 1: Entity List with Filtering

```typescript
// src/components/entity/EntityList.tsx
'use client';

import { useEntityFilter } from '@/hooks/use-entity-filter';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

export function EntityList() {
  const { filters, setFilter, entities, isLoading } = useEntityFilter();

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Search entities..."
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
        className="max-w-sm"
      />

      {/* Filters */}
      <MultiSelect
        placeholder="Filter by type"
        options={entityTypes}
        selected={filters.types}
        onChange={(types) => setFilter('types', types)}
      />

      {/* Data table */}
      <DataTable
        columns={entityColumns}
        data={entities}
        isLoading={isLoading}
        pagination={{ pageSize: 50 }}
      />
    </div>
  );
}
```

#### Pattern 2: RFP Signal Cards

```typescript
// src/components/rfp/SignalCard.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface SignalCardProps {
  signal: ValidatedSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{signal.entity_name}</h3>
          <Badge variant="outline">{signal.category}</Badge>
        </div>

        <div className="text-right">
          <div className="text-sm text-muted-foreground">Confidence</div>
          <Progress value={signal.confidence * 100} className="w-32" />
          <div className="text-xs">{(signal.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Evidence */}
      <Accordion type="single" collapsible>
        <AccordionItem value="evidence">
          <AccordionTrigger>Evidence ({signal.evidence.length})</AccordionTrigger>
          <AccordionContent>
            {signal.evidence.map((ev) => (
              <div key={ev.id} className="text-sm">
                <Badge variant={ev.verified ? "success" : "warning"}>
                  {ev.source}
                </Badge>
                <p className="mt-1">{ev.extracted_text.slice(0, 100)}...</p>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Yellow Panther scoring */}
      {signal.yellow_panther_fit_score && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span>YP Fit Score</span>
            <Badge variant={
              signal.yellow_panther_fit_score >= 70 ? "success" :
              signal.yellow_panther_fit_score >= 50 ? "warning" : "secondary"
            }>
              {signal.yellow_panther_priority}
            </Badge>
          </div>
          <Progress value={signal.yellow_panther_fit_score} className="mt-2" />
        </div>
      )}
    </Card>
  );
}
```

#### Pattern 3: AI Chat with Tool Visibility

```typescript
// src/components/chat/ChatInterface.tsx
'use client';

import { useCopilotChat } from '@copilotkit/react-core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export function ChatInterface() {
  const { messages, append, isLoading } = useCopilotChat();

  return (
    <div className="flex flex-col h-screen">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <p>{msg.content}</p>

              {/* Tool calls */}
              {msg.toolCalls && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls.map((call) => (
                    <Badge key={call.id} variant="secondary">
                      🛠 {call.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <Textarea
          placeholder="Ask about entities, RFPs, temporal patterns..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              append({ role: 'user', content: e.currentTarget.value });
              e.currentTarget.value = '';
            }
          }}
          className="min-h-[100px]"
        />
      </div>
    </div>
  );
}
```

---

## Part 4: Headless API Reference

### 4.1 Ralph Loop API (Port 8001)

**Validate Signal**
```http
POST /api/signals/validate
Content-Type: application/json

{
  "entity_id": "arsenal",
  "entity_name": "Arsenal FC",
  "category": "CRM",
  "evidence": [
    {
      "source": "LinkedIn",
      "url": "https://linkedin.com/jobs/arsenal-crm",
      "extracted_text": "Arsenal hiring CRM Director...",
      "credibility_score": 0.85
    }
  ],
  "raw_confidence": 0.75
}

Response:
{
  "validated": true,
  "confidence_raw": 0.75,
  "confidence_final": 0.88,
  "temporal": {
    "multiplier": 1.35,
    "backoff_level": "entity_category",
    "seasonality": "Q1 (80%)",
    "recurrence": "380 days (expected: ~365)"
  },
  "yellow_panther": {
    "fit_score": 15.0,
    "priority": "TIER_4",
    "alerts_planned": []
  },
  "stored": {
    "graphiti_episode_id": "ep_arsenal_crm_001"
  }
}
```

### 4.2 Temporal Intelligence API

**Get Entity Timeline**
```http
GET /api/temporal/timeline/{entity_id}

Response:
{
  "entity_id": "arsenal",
  "episodes": [
    {
      "id": "ep_001",
      "timestamp": "2025-01-15T10:00:00Z",
      "category": "CRM",
      "summary": "Salesforce CRM upgrade"
    }
  ],
  "temporal_multiplier": 1.35,
  "prediction": {
    "next_expected": "January 2026",
    "seasonality": "Q1 (80%)",
    "confidence": "high"
  }
}
```

**Get Temporal Prior**
```http
GET /api/temporal/prior/{entity_id}/{category}

Response:
{
  "entity_id": "arsenal",
  "category": "CRM",
  "multiplier": 1.35,
  "backoff_level": "entity_category",
  "seasonality": {
    "q1": 0.80,
    "q2": 0.10,
    "q3": 0.05,
    "q4": 0.05
  },
  "recurrence": {
    "mean_days": 365,
    "std_days": 30,
    "last_occurrence": "2025-01-15"
  },
  "momentum": {
    "last_30_days": 2,
    "last_90_days": 5
  }
}
```

### 4.3 Entity Query API (Next.js Frontend)

**Browse Entities**
```http
GET /api/entities?type=ORG&country=GB&limit=50

Response:
{
  "entities": [
    {
      "id": "arsenal",
      "name": "Arsenal FC",
      "type": "ORG",
      "country": "GB",
      "metadata": {
        "league": "Premier League",
        "founded": 1886
      }
    }
  ],
  "total": 3400,
  "page": 1,
  "page_size": 50
}
```

---

## Part 5: Verification Strategy (Production-Grade)

### 5.1 Critical Invariants

**1. Claude sees VERIFIED evidence only (iteration_02)**
- ✅ Pass 1.5 evidence verification runs BEFORE Pass 2 Claude validation
- ✅ Claude input contains verification summary, not raw scrape text
- ✅ Test invariant: Claude payload must not contain HTML dumps or unverified URLs

**2. Temporal multipliers always clamped [0.75, 1.40]**
- ✅ Seasonality, recurrence, momentum components bounded
- ✅ Backoff chain: entity_category → entity → cluster → global → neutral (1.0)

**3. Graphiti is authoritative (iteration_08)**
- ✅ NO fallbacks to other databases
- ✅ Clear error messages: "Graphiti service unreachable - NO FALLBACKS"
- ✅ `/api/graphrag` renamed to `/api/graphiti` (clear semantics)

**4. Yellow Panther scoring does NOT affect validation truth**
- ✅ Low fit scores (e.g., 15/100 for CRM) still store validated signals
- ✅ YP scoring only affects alert routing (TIER_1-TIER_4)
- ✅ All validated signals stored in Graphiti for learning

### 5.2 Test Coverage

**Unit Tests (CI every commit)**
```bash
pytest backend/tests/test_evidence_verifier.py -v
pytest backend/tests/test_temporal_prior_service.py -v
pytest backend/tests/test_ralph_loop_pass_1.py -v
pytest backend/tests/test_yellow_panther_scorer.py -v
pytest backend/tests/test_alert_manager.py -v
```

**Integration Tests (CI nightly)**
```bash
python scripts/test_pipeline_integration.py \
  --entity arsenal \
  --category CRM \
  --expect validated=true
```

**E2E Tests (API correctness)**
```bash
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d @test_signal.json
```

### 5.3 Alert System (Async Side-Effects)

**Critical**: Alerts must NOT block `/validate`

```python
# backend/alerts/alert_manager.py

class AlertManager:
    async def send_alert_async(self, opportunity: Dict, tier: str):
        """Non-blocking alert delivery"""
        # Queue for background processing
        await self.alert_queue.put({
            "opportunity": opportunity,
            "tier": tier,
            "timestamp": datetime.now().isoformat()
        })

    async def process_alert_queue(self):
        """Background task"""
        while True:
            alert = await self.alert_queue.get()
            try:
                await self._deliver_alert(alert)
                await self.audit_logger.log_alert_sent(alert)
            except Exception as e:
                logger.error(f"Alert failed: {e}")
                await self._retry_alert(alert)
```

**API Response** (returns immediately):
```json
{
  "validated": true,
  "alert_plan": ["email", "webhook", "slack"],
  "alerts_sent": [],  // Empty - delivery happens async
  "alert_tracking_id": "alert_001"
}
```

### 5.4 Success Criteria

**Functional**
- ✅ Evidence verification rejects fake URLs at ≥99%
- ✅ Claude never sees raw scrape text (verified summaries only)
- ✅ Temporal priors computed nightly + present for ≥90% of entities
- ✅ Alerts route correctly by tier and fit score
- ✅ Graphiti episodes stored for every validated signal

**Performance**
- ✅ Pass 1 + 1.5 < 500ms typical
- ✅ Full Ralph Loop < 10s per signal
- ✅ Alerts delivered < 30s for Tier 1 (async)
- ✅ Priors computation < 5 minutes / 3.4k entities

**Business**
- ✅ False positives < 30%
- ✅ Weekly high-fit opportunities ≥ 8
- ✅ Tier 1 response time < 1 hour
- ✅ Win rate improvement tracked via outcomes table

---

## Part 6: Development Quick Start

### 6.1 Backend-Only Development

```bash
# 1. Install dependencies
cd backend
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start Ralph Loop server
python ralph_loop_server.py  # Port 8001

# 4. Test validation API
curl -X POST http://localhost:8001/api/signals/validate \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "arsenal",
    "category": "CRM",
    "evidence": [...],
    "raw_confidence": 0.75
  }'
```

### 6.2 Full Stack Development

```bash
# 1. Start backend (above)
cd backend && python ralph_loop_server.py

# 2. Start frontend (new terminal)
cd ..
npm install
npm run dev  # Port 3005

# 3. Access UI
open http://localhost:3005
```

### 6.3 Testing

```bash
# Unit tests
cd backend
pytest tests/ -v

# Integration tests
python test_rfp_discovery_schema.py --entity arsenal --categories CRM

# Mock tests
python test_rfp_discovery_mock.py
```

---

## Appendix A: Component Library

### shadcn/ui Components Used

**Core Components**
- `Button` - Primary actions
- `Input` - Form inputs, search
- `Textarea` - Chat input, long-form text
- `Select` - Dropdowns
- `MultiSelect` - Multi-choice filters
- `Checkbox` - Boolean toggles
- `Switch` - Settings toggles
- `Slider` - Range inputs (confidence thresholds)

**Layout**
- `Card` - Content containers
- `Tabs` - Navigation, content switching
- `Accordion` - Expandable content (evidence, logs)
- `ScrollArea` - Scrollable containers
- `Separator` - Visual dividers
- `Sheet` - Side panels, drawers

**Data Display**
- `Table` - Entity lists, signal lists
- `DataTable` - Sortable, filterable tables
- `Badge` - Status indicators, tags
- `Progress` - Confidence meters, progress bars
- `Skeleton` - Loading placeholders

**Feedback**
- `Alert` - Notifications, errors
- `Toast` - Non-intrusive notifications
- `Dialog` - Modals, confirmations
- `Popover` - Context menus, tooltips

**Forms**
- `Form` + `useForm` - Form state management
- `Label` - Form labels
- `FormControl` - Form validation

---

## Appendix B: MCP Tools Reference

### FalkorDB MCP

```python
# Search entities
await falkordb.search_nodes(
    label="Entity",
    properties={"name": "Arsenal FC"}
)

# Get relationships
await falkordb.get_relationships(
    source_id="arsenal",
    relationship_type="HAS_SIGNAL"
)
```

### Temporal Intelligence MCP

```python
# Get timeline
await temporal.get_entity_timeline(entity_id="arsenal")

# Get temporal prior
await temporal.get_temporal_prior(
    entity_id="arsenal",
    signal_category="CRM"
)

# Compute multiplier
await temporal.compute_multiplier(
    entity_id="arsenal",
    signal_category="CRM",
    timestamp=datetime.now()
)
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-31
**Status**: Production-Ready (with verification recommendations applied)
