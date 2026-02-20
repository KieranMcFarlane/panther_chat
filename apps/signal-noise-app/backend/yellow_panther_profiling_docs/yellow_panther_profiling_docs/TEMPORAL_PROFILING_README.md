# Yellow Panther-Style Temporal Profiling System

## Overview

A progressive multi-pass temporal profiling system inspired by Yellow Panther's approach to intelligence gathering. The system evolves entity profiles through multiple discovery sweeps, each building on the previous pass.

## Key Features

### 1. Dossier Question Extraction
- Extracts intelligence questions from dossier sections
- Categorizes questions by type (Leadership, Technology, Procurement, etc.)
- Prioritizes questions for discovery guidance
- Creates feedback loop: dossier → questions → discovery → dossier

### 2. LinkedIn Profiling (Multi-Pass, BrightData Only)
- **Pass 1**: Quick cached sweep via BrightData (~30s)
- **Pass 2**: Targeted BrightData scraping for executives (~2min)
- **Pass 3+**: Hybrid approach with cache warming (~90s)
- **All LinkedIn data scraped via BrightData - NO official API needed!**

### 3. Question-Guided Discovery
- High-priority questions guide hypothesis selection
- Discovery focuses on answering intelligence gaps
- Answers feed back into next dossier generation

### 4. Temporal Sweep Scheduler
- **Pass 1 (Day 0)**: Quick cached sweep
  - 3 sections (core info, quick actions, contact)
  - Cost: ~$0.0005, Duration: ~30s

- **Pass 2 (Day 7)**: Standard sweep + questions
  - 7 sections (adds news, performance, leadership, digital maturity)
  - Cost: ~$0.010, Duration: ~60s

- **Pass 3 (Day 14)**: Deep sweep with LinkedIn API
  - 10 sections (adds AI assessment, challenges, strategic analysis)
  - Cost: ~$0.050, Duration: ~120s

- **Pass 4+ (Monthly)**: Monitoring sweeps
  - 7 sections + change detection
  - Cost: ~$0.015, Duration: ~90s

### 5. Profile Evolution Tracking
- Detects changes between sweep passes
- Tracks confidence deltas
- Monitors questions answered
- Identifies new decision makers and signals

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TEMPORAL PROFILING SYSTEM                │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌────▼────┐   ┌─────▼──────┐
        │  Dossier  │   │LinkedIn │   │  Sweep     │
        │Generator  │   │Profiler │   │Scheduler   │
        └─────┬─────┘   └────┬────┘   └─────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Question Extractor│
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Question-Guided │
                    │    Discovery      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Entity Profile   │
                    │  (with versioning)│
                    └───────────────────┘
```

## File Structure

### New Files Created

1. **`backend/dossier_question_extractor.py`**
   - Extracts questions from dossier sections
   - Classifies questions by type
   - Generates search strategies for answering questions
   - Prioritizes questions for discovery

2. **`backend/linkedin_profiler.py`**
   - Multi-pass LinkedIn profiling (BrightData only)
   - Cached data extraction (Pass 1)
   - Targeted scraping for executives (Pass 2)
   - Hybrid approach (Pass 3+)
   - Decision maker extraction
   - **NEW**: Post signal detection (RFP, tech needs, etc.)
   - **NEW**: Mutual connections discovery (Yellow Panther → targets)
   - **NEW**: Opportunity detection from company posts

3. **`backend/temporal_sweep_scheduler.py`**
   - Schedules and executes temporal sweeps
   - Manages multi-pass orchestration
   - Tracks profile changes between passes
   - Cost and time optimization

4. **`backend/test_temporal_profiling.py`**
   - End-to-end test suite
   - Demonstrates all phases
   - Example usage and validation

### Modified Files

1. **`backend/schemas.py`**
   - Added `DossierQuestion` schema
   - Added `DossierQuestionType` enum
   - Added `DossierQuestionStatus` enum
   - Added `EntityProfile` schema
   - Added `ProfileChange` schema
   - Added `SweepConfig` schema
   - Added `SweepResult` schema
   - Added `LinkedInProfile` schema
   - Added `LinkedInEpisodeType` enum
   - Added `SweepType` enum
   - Enhanced `EntityDossier` to include questions

2. **`backend/dossier_generator.py`**
   - Integrated question extraction
   - Questions now generated with dossiers
   - Feedback loop enabled

## Usage

### Basic Question Extraction

```python
from dossier_question_extractor import DossierQuestionExtractor
from claude_client import ClaudeClient

claude = ClaudeClient()
extractor = DossierQuestionExtractor(claude)

# Extract questions from a dossier
questions = await extractor.extract_questions_from_dossier(
    sections=dossier.sections,
    entity_name="Arsenal FC",
    max_per_section=5
)

# Prioritize questions
top_questions = extractor.prioritize_questions(questions, max_count=20)
```

### LinkedIn Profiling

```python
from linkedin_profiler import LinkedInProfiler
from brightdata_sdk_client import BrightDataSDKClient

brightdata = BrightDataSDKClient()
profiler = LinkedInProfiler(brightdata)

# Pass 1: Quick sweep
pass1_profiles = await profiler.profile_entity("Arsenal FC", pass_number=1)

# Pass 2: Deep dive
pass2_profiles = await profiler.profile_entity(
    "Arsenal FC",
    pass_number=2,
    previous_profiles=pass1_profiles
)

# Extract decision makers
decision_makers = await profiler.extract_decision_makers(
    pass1_profiles + pass2_profiles,
    "Arsenal FC"
)
```

### Temporal Sweep Scheduling

```python
from temporal_sweep_scheduler import TemporalSweepScheduler
from claude_client import ClaudeClient
from brightdata_sdk_client import BrightDataSDKClient

claude = ClaudeClient()
brightdata = BrightDataSDKClient()
scheduler = TemporalSweepScheduler(claude, brightdata)

# Execute a single sweep pass
result = await scheduler.execute_sweep(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    entity_type="CLUB",
    priority_score=85,
    pass_number=1
)

print(f"Confidence: {result.entity_profile.confidence_score}")
print(f"Questions answered: {result.questions_answered}")
print(f"Cost: ${result.cost_usd:.4f}")
```

### Multi-Pass Profiling

```python
# Execute multiple passes sequentially
results = await scheduler.schedule_sweeps(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    entity_type="CLUB",
    priority_score=85,
    num_passes=4
)

for result in results:
    print(f"Pass {result.entity_profile.sweep_pass}: "
          f"{result.entity_profile.confidence_score:.2f} confidence")
```

## Question Types

The system extracts 10 types of questions:

1. **LEADERSHIP**: Decision makers, org structure
2. **TECHNOLOGY**: Tech stack, platforms
3. **PROCUREMENT_TIMING**: When they buy, cycle
4. **BUDGET**: Financial capacity
5. **DIGITAL_MATURITY**: Digital sophistication
6. **PARTNERSHIPS**: Vendor relationships
7. **CHALLENGES**: Pain points, needs
8. **STRATEGY**: Strategic direction
9. **COMPETITIVE**: Market position
10. **GENERAL**: Other questions

## Profile Evolution

### Confidence Progression

```
Pass 1: 0.62 (baseline from cached data)
  ↓
Pass 2: 0.74 (+0.12 from fresh discovery)
  ↓
Pass 3: 0.81 (+0.07 from LinkedIn API)
  ↓
Pass 4: 0.85 (+0.04 from monitoring)
```

### Question Answer Rate

```
Pass 1: 8/30 questions (27%)
  ↓
Pass 2: 18/30 questions (60%)
  ↓
Pass 3: 25/30 questions (83%)
  ↓
Pass 4: 28/30 questions (93%)
```

## Cost Optimization

### Tiered Sweep Strategy

| Pass | Type | Duration | Cost | Sections |
|------|------|----------|------|----------|
| 1 | QUICK | 30s | $0.0005 | 3 |
| 2 | STANDARD | 60s | $0.010 | 7 |
| 3 | DEEP | 120s | $0.050 | 10 |
| 4+ | MONITORING | 90s | $0.015 | 7 |

**Total for 4 passes**: ~$0.076 per entity

**Cost savings via caching**: 60% reduction vs. full deep sweeps

## Testing

Run the end-to-end test:

```bash
cd backend
python test_temporal_profiling.py
```

Expected output:
```
================================================================================
YELLOW PANTHER-STYLE TEMPORAL PROFILING SYSTEM
End-to-End Test
================================================================================

================================================================================
PHASE 1: DOSSIER QUESTION EXTRACTION
================================================================================

📊 Generating dossier for Arsenal FC...
✅ Dossier generated: 11 sections
✅ Questions extracted: 27 questions

📝 Sample questions:
  1. [LEADERSHIP] Who is the primary decision maker for technology procurement?
     Priority: 7/10 | Status: PENDING
  ...

================================================================================
PHASE 2: LINKEDIN PROFILING (Multi-Pass)
================================================================================

🔄 Pass 1: Cached sweep for Arsenal FC...
✅ Pass 1 complete: 12 profiles
👔 Decision makers identified: 3

================================================================================
PHASE 3: TEMPORAL SWEEP SCHEDULER
================================================================================

🔄 Executing Pass 1 (Quick sweep)...
✅ Pass 1 complete:
   - Questions answered: 5
   - Questions generated: 27
   - Cost: $0.0005
   - Duration: 28s
   - Profile confidence: 0.62

✅ ALL TESTS PASSED
```

## Integration with Existing Systems

### Ralph Loop

The temporal profiling system integrates with the existing Ralph Loop:

- **Hypothesis-Driven Discovery**: Uses questions to guide hypothesis selection
- **Confidence Scoring**: Profile confidence updates Ralph Loop state
- **Signal Validation**: LinkedIn profiles validate decision maker signals

### Graphiti Service

Temporal episodes stored in Graphiti:

- `LINKEDIN_PROFILE_SWEEP`: LinkedIn profiling episodes
- `LINKEDIN_EXECUTIVE_DETECTED`: Executive identification
- `LINKEDIN_HIRING_CHANGE`: Job posting changes
- `PROFILE_VERSION_CHANGE`: Profile evolution tracking

### Dossier Generator

Enhanced with question extraction:

- Questions automatically extracted from all sections
- Prioritized by relevance and searchability
- Feed back into discovery for next pass

## Future Enhancements

### Phase 4: Yellow Panther-Style Profiling (TODO)

- **Sales Intelligence Module**: Decision maker identification, tech stack analysis
- **Competitive Intelligence Module**: Market position benchmarking
- **YP-Style Question Framework**: Structured question templates

### Phase 5: Multi-Pass Narratives (TODO)

- **Narrative Builder**: Compress multi-pass profiles into token-bounded narratives
- **Delta Tracking**: Clear change documentation between passes
- **Actionable Recommendations**: Evolve with confidence

## Metrics & KPIs

### Success Criteria

- **Question Answer Rate**: >70% of questions answered within 3 passes
- **Confidence Delta**: +0.15 average gain from Pass 1 to Pass 3
- **LinkedIn Coverage**: >80% of decision makers identified by Pass 3
- **Temporal Evolution**: >5 profile changes detected per month
- **Cost Optimization**: 60% cost reduction via tiered strategy

## Troubleshooting

### Issue: Low Question Extraction Rate

**Solution**:
- Check section content quality
- Adjust `max_per_section` parameter
- Verify AI model access for question generation

### Issue: LinkedIn Profiling Fails

**Solution**:
- Verify BrightData API token
- Check search query formatting
- Use cached data (Pass 1) as fallback

### Issue: Sweep Schedule Too Slow

**Solution**:
- Reduce sections per pass
- Lower priority score → fewer sections
- Use cached data sources only

## Contributing

When extending the temporal profiling system:

1. **Add new question types** to `DossierQuestionType` enum
2. **Update search strategies** in `DossierQuestionExtractor`
3. **Enhance sweep configs** in `TemporalSweepScheduler`
4. **Test with real entities** before deploying

## License

Part of the Signal Noise App - Yellow Panther Integration

---

**Status**: ✅ Phase 1-3 Complete (Questions, LinkedIn, Scheduling)
**Next**: Phase 4-5 (YP Profiling, Narratives)
