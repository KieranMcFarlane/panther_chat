# Temporal Profiling System - File Structure

## New Files Created

```
backend/
├── dossier_question_extractor.py          # 487 lines - Question extraction from dossiers
├── linkedin_profiler.py                    # 457 lines - Multi-pass LinkedIn profiling
├── temporal_sweep_scheduler.py             # 534 lines - Automated sweep orchestration
├── test_temporal_profiling.py              # 400+ lines - End-to-end tests
├── test_integration_temporal.py            # 200+ lines - Integration tests
├── TEMPORAL_PROFILING_README.md            # Comprehensive documentation
├── TEMPORAL_PROFILING_QUICKSTART.md        # 5-minute setup guide
├── TEMPORAL_PROFILING_IMPLEMENTATION_SUMMARY.md  # Implementation details
├── TEMPORAL_PROFILING_COMPLETE.md          # Complete package summary
└── FILE_STRUCTURE_TEMPORAL_PROFILING.md    # This file
```

## Modified Files

```
backend/
├── schemas.py                              # Enhanced with 15+ new classes
└── dossier_generator.py                    # Integrated question extraction
```

## Schema Additions

### New Enums (6)
```python
DossierQuestionType          # 10 question types
DossierQuestionStatus        # 4 statuses (PENDING, IN_PROGRESS, ANSWERED, DEPRIORITIZED)
ProfileChangeType            # 7 change types
SweepType                    # 4 sweep types (QUICK, STANDARD, DEEP, MONITORING)
LinkedInEpisodeType          # 5 LinkedIn episode types
ConfidenceBand               # 4 confidence bands (enhanced existing)
```

### New Dataclasses (15+)
```python
DossierQuestion              # Question with search strategy
EntityProfile                # Complete temporal profile
ProfileChange                # Change between versions
SweepConfig                  # Sweep configuration
SweepResult                  # Sweep execution results
LinkedInProfile              # LinkedIn profile data
MultiPassNarrative           # Narrative across passes (placeholder for Phase 5)
```

## Module Dependencies

```
dossier_question_extractor.py
├── schemas.py (DossierQuestion, DossierSection)
└── claude_client.py (ClaudeClient)

linkedin_profiler.py
├── schemas.py (LinkedInProfile, LinkedInEpisodeType)
└── brightdata_sdk_client.py (BrightDataSDKClient)

temporal_sweep_scheduler.py
├── schemas.py (all temporal profiling schemas)
├── linkedin_profiler.py (LinkedInProfiler)
├── dossier_generator.py (EntityDossierGenerator)
├── dossier_question_extractor.py (DossierQuestionExtractor)
├── hypothesis_driven_discovery.py (HypothesisDrivenDiscovery)
├── claude_client.py (ClaudeClient)
└── brightdata_sdk_client.py (BrightDataSDKClient)

dossier_generator.py (MODIFIED)
├── schemas.py (EntityDossier - enhanced with questions)
├── claude_client.py (ClaudeClient)
└── dossier_question_extractor.py (NOW IMPORTS)
```

## Test Files

### test_temporal_profiling.py
Tests all 4 phases:
- Phase 1: Question extraction
- Phase 2: LinkedIn profiling
- Phase 3: Temporal sweep scheduling
- Phase 4: Profile evolution tracking

### test_integration_temporal.py
Integration verification:
- Schema imports
- Question extraction
- LinkedIn profiling
- Sweep scheduler
- Dossier integration

## Documentation Files

### TEMPORAL_PROFILING_README.md
- System overview
- Architecture diagrams
- File structure
- Usage examples
- Testing guide
- Troubleshooting

### TEMPORAL_PROFILING_QUICKSTART.md
- 5-minute setup
- Common workflows
- API reference
- Cost calculator
- Integration examples

### TEMPORAL_PROFILING_IMPLEMENTATION_SUMMARY.md
- Implementation status
- Success criteria
- Metrics and KPIs
- Integration points

### TEMPORAL_PROFILING_COMPLETE.md
- Complete package summary
- Quick start
- Performance metrics
- Integration guide
- Verification checklist

## Line Count Summary

```
Module                              Lines    Purpose
────────────────────────────────────────────────────────────────
dossier_question_extractor.py       487     Question extraction
linkedin_profiler.py                 457     LinkedIn profiling
temporal_sweep_scheduler.py          534     Sweep orchestration
test_temporal_profiling.py          400+    End-to-end tests
test_integration_temporal.py        200+    Integration tests
schemas.py (additions)              300+    Schema definitions
dossier_generator.py (mod)          20      Integration
────────────────────────────────────────────────────────────────
TOTAL                               ~2,400  Complete system
```

## Import Paths

All new modules can be imported from the `backend` directory:

```python
# Question extraction
from dossier_question_extractor import DossierQuestionExtractor

# LinkedIn profiling
from linkedin_profiler import LinkedInProfiler

# Sweep scheduling
from temporal_sweep_scheduler import TemporalSweepScheduler

# Schemas
from schemas import (
    DossierQuestion, EntityProfile, LinkedInProfile,
    SweepConfig, SweepResult, ProfileChange
)
```

## Environment Variables Required

```bash
# Claude API (for question extraction)
ANTHROPIC_API_KEY=your-key

# BrightData API (for LinkedIn profiling)
BRIGHTDATA_API_TOKEN=your-token

# FalkorDB (optional, for enhanced entity data)
FALKORDB_URI=bolt://localhost:7687
FALKORDB_USER=falkordb
FALKORDB_PASSWORD=your-password

# Supabase (optional, for Graphiti)
SUPABASE_URL=your-url
SUPABASE_ANON_KEY=your-key
```

## Database Schema Changes

### New Episode Types (Graphiti)
```sql
INSERT INTO episode_source_types (name) VALUES
('LINKEDIN_PROFILE_SWEEP'),
('LINKEDIN_EXECUTIVE_DETECTED'),
('LINKEDIN_HIRING_CHANGE'),
('LINKEDIN_SKILL_UPDATE'),
('LINKEDIN_ACTIVITY_PATTERN');
```

### Profile Storage (Optional)
```sql
CREATE TABLE entity_profiles (
    profile_id SERIAL PRIMARY KEY,
    entity_id VARCHAR(255) NOT NULL,
    profile_version INTEGER NOT NULL,
    sweep_pass INTEGER NOT NULL,
    confidence_score FLOAT NOT NULL,
    profile_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entity_profiles_entity ON entity_profiles(entity_id);
CREATE INDEX idx_entity_profiles_version ON entity_profiles(entity_id, profile_version);
```

## API Endpoints (Future)

Potential endpoints to add:

```
POST /api/temporal/sweep
  - Execute a temporal sweep pass

GET /api/temporal/profile/{entity_id}
  - Get latest profile for entity

GET /api/temporal/profile/{entity_id}/history
  - Get profile version history

GET /api/temporal/questions/{entity_id}
  - Get outstanding questions

POST /api/linkedin/profile
  - Trigger LinkedIn profiling
```

## Monitoring & Metrics

### Key Metrics to Track

1. **Question Metrics**
   - Questions extracted per section
   - Questions answered per pass
   - Question type distribution

2. **LinkedIn Metrics**
   - Profiles found per pass
   - Decision makers identified
   - Cache hit rate

3. **Sweep Metrics**
   - Cost per sweep
   - Duration per sweep
   - Confidence gain per pass

4. **Profile Metrics**
   - Profile version count
   - Change detection rate
   - Confidence progression

### Logging

All modules use Python's `logging` module:

```python
import logging
logger = logging.getLogger(__name__)

logger.info("Sweep pass 1 complete")
logger.warning("Cache miss for entity")
logger.error("LinkedIn API failed")
```

## Testing Strategy

### Unit Tests (TODO)
- Question extraction logic
- LinkedIn profile parsing
- Change detection algorithms

### Integration Tests (DONE)
- End-to-end sweep execution
- Multi-pass profiling
- Profile evolution tracking

### Performance Tests (TODO)
- Concurrent entity profiling
- Bulk question answering
- Cache effectiveness

## Deployment Checklist

- [x] All modules implemented
- [x] Schemas defined and tested
- [x] Documentation complete
- [x] Integration tests passing
- [x] Quick start guide created
- [ ] Environment variables configured
- [ ] Database schema updated (if using)
- [ ] API endpoints created (optional)
- [ ] Monitoring setup (optional)
- [ ] Production deployment

## Future Enhancements

### Phase 4: Yellow Panther Profiling
- `sales_intelligence_analyzer.py`
- `competitive_intelligence_analyzer.py`
- `yellow_panther_profiler.py`

### Phase 5: Multi-Pass Narratives
- Enhance `narrative_builder.py`
- Add delta tracking
- Token-bounded compression

### Optional
- Cache warming strategies
- Parallel question answering
- Batch LinkedIn profiling
- Rate limiting optimization

---

**Last Updated**: February 7, 2026
**Status**: Complete (Phases 1-3)
**Total Lines**: ~2,400
**Files**: 11 (6 modules + 2 modified + 3 docs)
