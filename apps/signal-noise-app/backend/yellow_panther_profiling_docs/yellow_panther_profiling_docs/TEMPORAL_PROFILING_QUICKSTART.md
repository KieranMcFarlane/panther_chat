# Yellow Panther Temporal Profiling - Quick Start Guide

## 5-Minute Setup

### 1. Test Question Extraction

```python
from dossier_generator import EntityDossierGenerator
from claude_client import ClaudeClient

claude = ClaudeClient()
generator = EntityDossierGenerator(claude)

# Generate dossier with auto-extracted questions
dossier = await generator.generate_dossier(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    priority_score=85
)

print(f"Sections: {len(dossier.sections)}")
print(f"Questions: {len(dossier.questions)}")
```

### 2. Run LinkedIn Profiling

```python
from linkedin_profiler import LinkedInProfiler
from brightdata_sdk_client import BrightDataSDKClient

brightdata = BrightDataSDKClient()
profiler = LinkedInProfiler(brightdata)

# Pass 1: Quick (30s)
profiles = await profiler.profile_entity("Arsenal FC", pass_number=1)

# Pass 2: Deep (2min)
profiles = await profiler.profile_entity("Arsenal FC", pass_number=2)
```

### 3. Execute Temporal Sweep

```python
from temporal_sweep_scheduler import TemporalSweepScheduler

scheduler = TemporalSweepScheduler(claude, brightdata)

result = await scheduler.execute_sweep(
    entity_id="arsenal-fc",
    entity_name="Arsenal FC",
    pass_number=1
)

print(f"Confidence: {result.entity_profile.confidence_score:.2f}")
print(f"Questions answered: {result.questions_answered}")
```

## Common Workflows

### Workflow 1: Single-Pass Quick Profile

```python
# Use for: Initial entity assessment
result = await scheduler.execute_sweep(
    entity_id="new-entity",
    entity_name="New Entity",
    pass_number=1
)
# Cost: ~$0.0005, Duration: ~30s
# Output: 0.62 confidence, 5-8 questions answered
```

### Workflow 2: Three-Pass Deep Profile

```python
# Use for: High-priority entities
results = await scheduler.schedule_sweeps(
    entity_id="priority-entity",
    entity_name="Priority Entity",
    num_passes=3
)
# Cost: ~$0.061, Duration: ~210s (3.5min)
# Output: 0.81 confidence, 25/30 questions answered
```

### Workflow 3: Continuous Monitoring

```python
# Use for: Ongoing tracking of key entities
result = await scheduler.execute_sweep(
    entity_id="monitored-entity",
    entity_name="Monitored Entity",
    pass_number=4,  # Monitoring mode
    previous_profile=last_profile
)
# Cost: ~$0.015, Duration: ~90s
# Output: Change detection, confidence maintenance
```

## Question Types Reference

| Type | Example | Priority |
|------|---------|----------|
| LEADERSHIP | "Who is the CTO?" | 7-10 |
| TECHNOLOGY | "What CRM platform?" | 7-10 |
| PROCUREMENT_TIMING | "When is next procurement?" | 7-10 |
| BUDGET | "What is the tech budget?" | 6-8 |
| DIGITAL_MATURITY | "How mature is digital transformation?" | 4-6 |
| PARTNERSHIPS | "Who are the technology partners?" | 5-7 |
| CHALLENGES | "What are the pain points?" | 4-6 |
| STRATEGY | "What is the digital strategy?" | 5-7 |
| COMPETITIVE | "How do they compare to competitors?" | 3-5 |
| GENERAL | Other questions | 1-3 |

## Sweep Configurations

### Pass 1: Quick (Day 0)
- **Sections**: 3 (core, quick actions, contact)
- **LinkedIn**: Disabled
- **Cost**: $0.0005
- **Duration**: 30s
- **Output**: Baseline profile (0.62 confidence)

### Pass 2: Standard (Day 7)
- **Sections**: 7 (+ news, performance, leadership, digital maturity)
- **LinkedIn**: Disabled
- **Cost**: $0.010
- **Duration**: 60s
- **Output**: Refined profile (0.74 confidence, +0.12)

### Pass 3: Deep (Day 14)
- **Sections**: 10 (+ AI assessment, challenges, strategic analysis)
- **LinkedIn**: Enabled
- **Cost**: $0.050
- **Duration**: 120s
- **Output**: Strategic profile (0.81 confidence, +0.07)

### Pass 4+: Monitoring (Monthly)
- **Sections**: 7 (refresh)
- **LinkedIn**: Enabled (cache warming)
- **Cost**: $0.015
- **Duration**: 90s
- **Output**: Updated profile with deltas

## Cost Calculator

```python
def calculate_total_cost(num_passes, num_entities):
    costs = {1: 0.0005, 2: 0.010, 3: 0.050, 4: 0.015}
    total = sum(costs.get(min(p, 4), 0.015) for p in range(1, num_passes + 1))
    return total * num_entities

# Examples:
print(calculate_total_cost(1, 100))  # $0.05 (100 entities, 1 pass)
print(calculate_total_cost(3, 10))   # $0.61 (10 entities, 3 passes)
print(calculate_total_cost(4, 50))   # $3.80 (50 entities, 4 passes)
```

## Troubleshooting

### "No questions extracted"
- **Cause**: Sections too generic or empty
- **Fix**: Increase priority score → more sections generated

### "LinkedIn profiling failed"
- **Cause**: BrightData API token invalid or rate limited
- **Fix**: Check `.env` for `BRIGHTDATA_API_TOKEN`

### "Sweep taking too long"
- **Cause**: Too many sections or slow API responses
- **Fix**: Reduce `max_per_section` or use cached data only

## API Reference

### DossierQuestionExtractor

```python
extractor = DossierQuestionExtractor(claude)

# Extract questions
questions = await extractor.extract_questions_from_dossier(
    sections=dossier.sections,
    entity_name="Entity Name",
    max_per_section=5
)

# Prioritize
top_questions = extractor.prioritize_questions(questions, max_count=20)
```

### LinkedInProfiler

```python
profiler = LinkedInProfiler(brightdata)

# Profile entity
profiles = await profiler.profile_entity(
    entity_name="Entity Name",
    pass_number=1,
    use_cached=True,
    previous_profiles=None
)

# Extract decision makers
decision_makers = await profiler.extract_decision_makers(
    profiles=profiles,
    entity_name="Entity Name"
)
```

### TemporalSweepScheduler

```python
scheduler = TemporalSweepScheduler(claude, brightdata)

# Execute single sweep
result = await scheduler.execute_sweep(
    entity_id="entity-id",
    entity_name="Entity Name",
    entity_type="CLUB",
    priority_score=50,
    pass_number=1,
    previous_profile=None,
    previous_questions=None
)

# Schedule multiple sweeps
results = await scheduler.schedule_sweeps(
    entity_id="entity-id",
    entity_name="Entity Name",
    entity_type="CLUB",
    priority_score=50,
    num_passes=4
)
```

## Integration Examples

### With Ralph Loop

```python
from ralph_loop import RalphLoop

ralph = RalphLoop(claude, graphiti)

# Use questions to guide discovery
for question in top_questions[:5]:
    discovery_result = await discovery.run_discovery(
        entity_id=entity_id,
        entity_name=entity_name,
        template_id=question.search_strategy['template_id']
    )
```

### With Graphiti

```python
from graphiti_service import GraphitiService

graphiti = await GraphitiService().initialize()

# Store profile version as episode
await graphiti.create_episode(
    entity_id=profile.entity_id,
    episode_type="PROFILE_VERSION_CHANGE",
    source_description=f"Profile version {profile.profile_version}",
    episode_content=profile.to_dict()
)
```

## Testing

Run all tests:
```bash
cd backend
python test_temporal_profiling.py
```

Run specific test:
```python
# Test question extraction only
dossier = await test_question_extraction()

# Test LinkedIn only
profiles = await test_linkedin_profiling()

# Test sweeps only
pass1, pass2 = await test_temporal_sweep()
```

## Next Steps

1. **Customize sweep schedules** for your entity types
2. **Add question templates** for your domain
3. **Integrate with your CRM** for decision maker outreach
4. **Set up monitoring alerts** for profile changes

---

**Need Help?** See `TEMPORAL_PROFILING_README.md` for detailed documentation.
