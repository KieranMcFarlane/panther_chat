# Universal Dossier & Outreach System Test Suite

## Overview

Comprehensive test suite for the universal dossier generation and outreach intelligence system with approximately 600 lines across 3 test files.

## Test Files

### 1. `test_universal_dossier_integration.py` (12 test cases)

Tests for `UniversalDossierGenerator`:

- **test_generate_universal_dossier_basic_tier**: Validates BASIC tier dossier generation (priority ≤ 20)
- **test_generate_universal_dossier_standard_tier**: Validates STANDARD tier dossier generation (priority 21-50)
- **test_generate_universal_dossier_premium_tier**: Validates PREMIUM tier dossier generation (priority > 50)
- **test_hypothesis_extraction_from_dossier**: Tests extraction of testable hypotheses from dossiers
- **test_signal_extraction_with_correct_tags**: Validates signal extraction with proper [PROCUREMENT][CAPABILITY][TIMING][CONTACT] tags
- **test_no_arsenal_content_in_other_entities**: Ensures no Arsenal content leaks into other entity dossiers
- **test_confidence_score_validation**: Validates all confidence scores are in 0-100 range
- **test_signal_type_tagging_consistency**: Tests consistent signal type tagging across sections
- **test_tier_based_prompt_selection**: Validates correct prompt template selection for each tier
- **test_model_cascade_strategy**: Tests Haiku 80%, Sonnet 15%, Opus 5% cascade
- **test_dossier_metadata_completeness**: Validates all required metadata fields present
- **test_hypothesis_ready_flag_validation**: Tests hypothesis_ready flag usage

### 2. `test_outreach_intelligence.py` (12 test cases)

Tests for `LinkedInProfiler` outreach intelligence:

- **test_extract_outreach_intelligence_basic**: Tests basic intelligence extraction
- **test_mutual_connection_detection**: Validates mutual connection detection
- **test_conversation_starter_generation**: Tests conversation starter generation from posts
- **test_current_provider_identification**: Tests current vendor/provider identification
- **test_path_strength_calculation**: Tests connection path strength calculation (0-1 scale)
- **test_communication_pattern_analysis**: Tests posting frequency and engagement style analysis
- **test_post_relevance_scoring**: Tests post relevance scoring (high/medium/low)
- **test_conversation_angle_generation**: Tests conversation angle generation for different post types
- **test_outreach_intelligence_completeness**: Validates all intelligence components present
- **test_multiple_contacts_processing**: Tests processing multiple target contacts efficiently
- **test_days_lookback_filtering**: Tests days_to_lookback parameter filtering
- **test_outreach_intelligence_serialization**: Tests JSON serialization for storage

### 3. `test_dossier_discovery_integration.py` (12 test cases)

Tests for `HypothesisDrivenDiscovery` integration with dossiers:

- **test_initialize_from_dossier_basic**: Tests hypothesis initialization from dossier
- **test_signal_type_to_category_mapping**: Tests [PROCUREMENT]→procurement_opportunity mapping
- **test_run_discovery_with_dossier_context**: Tests discovery with dossier-generated context
- **test_warm_start_vs_cold_start_performance**: Compares warm-start (dossier) vs cold-start efficiency
- **test_cost_tracking_with_dossier_context**: Tests cost tracking with budget limits
- **test_dossier_hypothesis_confidence_preservation**: Tests preservation of dossier confidences
- **test_brightdata_sdk_integration**: Validates BrightData SDK integration
- **test_dossier_signal_extraction_to_discovery**: Tests signal extraction from dossiers
- **test_dossier_hypothesis_metadata_tracking**: Tests metadata tracking for dossier hypotheses
- **test_dossier_discovery_error_handling**: Tests error handling with empty/invalid dossiers
- **test_dossier_discovery_signal_validation**: Tests validation of dossier signal confidences
- **test_dossier_discovery_iteration_tracking**: Tests iteration tracking with dossier context

## Running Tests

```bash
# Run all tests
pytest backend/test_universal_dossier_integration.py -v
pytest backend/test_outreach_intelligence.py -v
pytest backend/test_dossier_discovery_integration.py -v

# Run specific test
pytest backend/test_universal_dossier_integration.py::TestUniversalDossierGenerator::test_generate_universal_dossier_basic_tier -v

# Run with coverage
pytest backend/test_universal_dossier_integration.py --cov=backend.dossier_generator --cov-report=html
```

## Key Features Tested

### Universal Dossier System
- ✅ Tier-based prompt selection (BASIC/STANDARD/PREMIUM)
- ✅ Model cascade optimization (Haiku 80%, Sonnet 15%, Opus 5%)
- ✅ Hypothesis extraction with confidence scores
- ✅ Signal extraction with [PROCUREMENT][CAPABILITY][TIMING][CONTACT] tags
- ✅ Entity-specific content generation (no Arsenal leakage)
- ✅ Comprehensive metadata tracking

### Outreach Intelligence
- ✅ Mutual connection detection
- ✅ Conversation starter generation from LinkedIn posts
- ✅ Current vendor/provider identification
- ✅ Path strength calculation (logarithmic scaling)
- ✅ Communication pattern analysis (frequency, engagement)
- ✅ JSON serialization for storage

### Dossier-Discovery Integration
- ✅ Warm-start vs cold-start performance
- ✅ Signal type to category mapping
- ✅ BrightData SDK integration
- ✅ Cost tracking with budget limits
- ✅ Hypothesis confidence preservation
- ✅ Iteration and depth tracking

## Mock Data

### MockClaudeClient
Returns realistic dossier JSON with:
- Executive summary with key insights
- Procurement signals with RFP probability
- Digital infrastructure assessment
- Leadership analysis
- Timing analysis (contract windows)
- Hypothesis generation

### MockBrightDataClient
Returns:
- Search results with position, title, URL, snippet
- Scraped markdown content
- Job posting data
- Async method signatures matching real SDK

## Validation Coverage

### Confidence Scores
- All scores in 0-100 range (dossier)
- All scores in 0.0-1.0 range (discovery)
- Validation on hypotheses, signals, metadata

### Signal Tags
- Only valid tags: [PROCUREMENT] [CAPABILITY] [TIMING] [CONTACT]
- Consistent tagging across sections
- Proper signal type to category mapping

### Entity Separation
- No Arsenal content in other entities
- Entity-specific insights only
- No template leakage

## Performance Metrics

### Expected Performance
- BASIC tier: ~5s, ~$0.0004 (3 sections)
- STANDARD tier: ~15s, ~$0.0095 (7 sections)
- PREMIUM tier: ~30s, ~$0.057 (11 sections)

### Model Cascade
- Haiku handles ~80% of cases
- Sonnet fallback ~15%
- Opus fallback ~5%

### Warm-Start Benefit
- Dossier-initialized hypotheses reduce discovery iterations
- Prior confidences guide exploration
- Cost savings vs cold-start

## Dependencies

```python
pytest
pytest-asyncio
unittest.mock
```

## Integration Points

### Files Tested
- `backend/dossier_generator.py` (UniversalDossierGenerator)
- `backend/linkedin_profiler.py` (LinkedInProfiler)
- `backend/hypothesis_driven_discovery.py` (HypothesisDrivenDiscovery)
- `backend/brightdata_sdk_client.py` (BrightDataSDKClient)
- `backend/claude_client.py` (ClaudeClient)

### Schema Files
- `backend/schemas.py` (EntityDossier, DossierSection, etc.)

## Future Enhancements

1. Add performance benchmarking tests
2. Add integration tests with real FalkorDB
3. Add end-to-end tests with real entities
4. Add load testing for batch processing
5. Add regression tests for known issues
