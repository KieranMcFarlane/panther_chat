# Multi-Layered RFP Discovery System

## Overview

This system implements an intelligent, multi-pass RFP discovery platform that combines:
- **Yellow Panther Profile** (agency capabilities)
- **Entity Dossiers** (what entities have/need)
- **Hypothesis Generation** (bridge: entity needs + YP services)
- **Ralph Loop** (deterministic, confidence-driven multi-pass exploration)
- **Graphiti/GraphRAG** (temporal + network intelligence)

## Architecture

```
Pass 1: Initial Discovery (Dossier-Informed Hypotheses)
  ↓
Pass 2: Network Context (Graph Relationships + Peer Patterns)
  ↓
Pass 3: Deep Dive (Highest Confidence + Temporal Patterns)
  ↓
Pass 4+: Adaptive (Develop New Hypotheses from Findings)
```

### Key Components

1. **DossierHypothesisGenerator** (`dossier_hypothesis_generator.py`)
   - Generates hypotheses from entity dossier data
   - Matches entity needs to YP capabilities
   - Confidence-weighted hypothesis scoring

2. **MultiPassContext** (`multi_pass_context.py`)
   - Manages context across multiple passes
   - Provides temporal patterns from Graphiti
   - Provides graph relationships from FalkorDB
   - Generates optimal strategies for each pass

3. **MultiPassRalphCoordinator** (`multi_pass_ralph_loop.py`)
   - Coordinates multi-pass discovery
   - Uses Ralph Loop for each pass validation
   - Generates evolved hypotheses between passes
   - Tracks confidence evolution

## Installation

No additional dependencies required - uses existing backend infrastructure:
- `backend/dossier_generator.py` - Entity dossiers
- `backend/hypothesis_manager.py` - Hypothesis tracking
- `backend/ralph_loop.py` - Signal validation
- `backend/graphiti_service.py` - Temporal intelligence
- `backend/brightdata_sdk_client.py` - Web scraping
- `backend/hypothesis_driven_discovery.py` - Discovery engine

## Usage

### Basic Multi-Pass Discovery

```python
from backend.multi_pass_ralph_loop import MultiPassRalphCoordinator

coordinator = MultiPassRalphCoordinator()
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    yp_template_id="yellow_panther_agency",
    max_passes=4
)

print(f"Final Confidence: {result.final_confidence:.2f}")
print(f"Total Signals: {result.total_signals_detected}")
print(f"High Confidence: {result.high_confidence_signals}")
```

### Dossier-Informed Discovery

```python
from backend.dossier_generator import EntityDossierGenerator
from backend.multi_pass_ralph_loop import MultiPassRalphCoordinator

# Generate dossier
dossier_gen = EntityDossierGenerator(claude)
dossier = await dossier_gen.generate_dossier(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    priority_score=50  # STANDARD tier
)

# Run discovery with dossier
coordinator = MultiPassRalphCoordinator()
result = await coordinator.run_multi_pass_discovery(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    yp_template_id="yellow_panther_agency",
    max_passes=4,
    dossier=dossier  # Dossier informs hypotheses
)
```

### Testing the System

```bash
# Run integration test
python backend/test_multi_pass_integration.py
```

## Pass Structure

### Pass 1: Initial Discovery

**Strategy**: Dossier-informed hypotheses

- **Focus areas**: Web Development, Mobile Development, Digital Transformation
- **Hop types**: Official Site, Careers Page, Press Release
- **Max iterations**: 10
- **Depth limit**: 2
- **Goal**: Establish baseline signals

### Pass 2: Network Context

**Strategy**: Build on Pass 1 findings with network intelligence

- **Focus areas**: Top areas from Pass 1 + network-inferred
- **Hop types**: Annual Report, News Coverage, Partnership Announcements
- **Max iterations**: 15
- **Depth limit**: 3
- **Goal**: Leverage partner/competitor patterns

### Pass 3: Deep Dive

**Strategy**: Focus on highest-confidence signals with temporal patterns

- **Focus areas**: Top 3 signals + temporal patterns
- **Hop types**: LinkedIn Job, Tech Blog, Press Release
- **Max iterations**: 20
- **Depth limit**: 4
- **Goal**: Deep exploration of confirmed opportunities

### Pass 4+: Adaptive

**Strategy**: Generate new hypotheses from discoveries

- **Focus areas**: Cross-category combinations
- **Hop types**: All types available
- **Max iterations**: 25
- **Depth limit**: 5
- **Goal**: Exhaustive exploration of emerging patterns

## Intelligence Sources

### Dossier Intelligence

**Source**: Entity dossiers (BASIC/STANDARD/PREMIUM tiers)

**Provides**:
- Technology gaps (legacy systems)
- Hiring signals (job postings)
- Strategic initiatives (digital transformation)
- Fan engagement needs (customer experience)

**Example**: Dossier shows "React Developer job posting" → Hypothesis: "React Web Development RFP"

### Temporal Intelligence (Graphiti)

**Source**: Historical episode tracking

**Provides**:
- RFP history (frequency, timing)
- Technology adoption patterns
- Partnership history
- Seasonal patterns

**Example**: Entity issues RFPs every March → Temporal fit score boost in Q1

### Network Intelligence (FalkorDB)

**Source**: Graph relationships

**Provides**:
- Partner technology stacks
- Competitor capabilities
- Technology diffusion patterns
- Supply chain relationships

**Example**: Partner adopted React → Network hypothesis: "React adoption likely"

## Confidence Calculation

### Starting Point
- **Initial confidence**: 0.50 (neutral prior)

### Deltas per Decision
- **ACCEPT**: +0.06 (strong evidence of procurement intent)
- **WEAK_ACCEPT**: +0.02 (capability present, intent unclear)
- **REJECT**: 0.00 (no evidence or contradicts hypothesis)
- **NO_PROGRESS**: 0.00 (no new information)

### Formula
```
final_confidence = 0.50 + (num_ACCEPT * 0.06) + (num_WEAK_ACCEPT * 0.02)
```

### Bounds
- **Minimum**: 0.00
- **Maximum**: 1.00

## Expected Outcomes

### Quantitative Improvements

| Metric | Current (Single-Pass) | Multi-Pass (Target) | Improvement |
|--------|---------------------|-------------------|-------------|
| Signal Detection Accuracy | 70% | 90%+ | +28% |
| False Positive Rate | 20% | <10% | -50% |
| High-Confidence Signals | 40% | 70% | +75% |
| Average Lead Time | 30 days | 45+ days | +50% |

### Qualitative Benefits

1. **Dossier-Informed**: Hypotheses based on actual entity needs
2. **Temporal Awareness**: Leverages historical patterns
3. **Network Intelligence**: Uses partner/competitor relationships
4. **Contextual Depth**: Each pass builds on previous findings
5. **Deterministic**: Ralph Loop ensures consistent exploration

## API Endpoints

### Discovery Endpoints

**POST** `/api/multi-pass/discover`
```json
{
  "entity_id": "arsenal-fc",
  "entity_name": "Arsenal FC",
  "max_passes": 4,
  "use_dossier": true
}
```

**Response**:
```json
{
  "entity_id": "arsenal-fc",
  "final_confidence": 0.75,
  "total_signals": 12,
  "high_confidence_signals": 8,
  "opportunities": [
    {
      "category": "React Development",
      "confidence": 0.85,
      "yp_service": "React Web Development",
      "recommended_action": "Immediate outreach"
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# FalkorDB (Graph Database)
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password
FALKORDB_DATABASE=sports_intelligence

# Neo4j Aura (Cloud Backup)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# Supabase (Cache Layer)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key

# AI Services
ANTHROPIC_API_KEY=your-claude-api-key
BRIGHTDATA_API_TOKEN=your-brightdata-token

# Yellow Panther Profile
YELLOW_PANTHER_PROFILE=./YELLOW-PANTHER-PROFILE.md
```

## File Structure

```
backend/
├── dossier_hypothesis_generator.py    # Phase 1: Dossier → Hypotheses
├── multi_pass_context.py               # Phase 2: Context Management
├── multi_pass_ralph_loop.py            # Phase 3: Multi-Pass Coordination
├── test_multi_pass_integration.py      # Integration Tests
└── MULTI_PASS_README.md               # This File
```

## Development Status

### ✅ Implemented

- [x] Phase 1: Dossier-Informed Hypothesis Generation
- [x] Phase 2: Multi-Pass Context Manager
- [x] Phase 3: Multi-Pass Ralph Loop Coordinator
- [x] Integration Tests
- [x] Documentation

### 🔄 In Progress

- [ ] Temporal context provider (Graphiti integration)
- [ ] Graph relationship analyzer (FalkorDB integration)
- [ ] Full orchestrator with all 6 phases

### 📋 Planned

- [ ] Phase 4: Graphiti/Narrative Builder Integration
- [ ] Phase 5: FalkorDB Network Intelligence
- [ ] Phase 6: Unified Orchestrator
- [ ] Production deployment
- [ ] Performance optimization

## Troubleshooting

### Common Issues

**Issue**: "Dossier generation fails"
- **Solution**: Check FalkorDB connection and BrightData API token

**Issue**: "Graphiti temporal patterns not loading"
- **Solution**: Verify Supabase credentials and temporal_episodes table

**Issue**: "Low confidence scores"
- **Solution**: Increase dossier tier (STANDARD → PREMIUM) for more sections

**Issue**: "Multi-pass discovery stops early"
- **Solution**: Check stopping conditions in logs (saturation, plateau)

## Contributing

When adding new features:
1. Update relevant phase in this README
2. Add integration tests
3. Document API changes
4. Update configuration section

## License

Internal use only - Yellow Panther Agency Proprietary
