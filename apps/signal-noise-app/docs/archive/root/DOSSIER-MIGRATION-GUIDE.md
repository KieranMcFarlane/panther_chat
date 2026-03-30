# Dossier System Migration Guide

## From Arsenal-Specific to Universal Entity Dossiers

This guide shows how to migrate from the hardcoded Arsenal prompts to the new universal, hypothesis-ready system.

---

## Overview

**Problem**: Old system used Arsenal-specific examples that AI models copied literally.

**Solution**: New system uses abstract templates with signal tagging, confidence scoring, and hypothesis generation for any entity.

---

## File Structure Changes

### Before
```
src/components/entity-dossier/
├── enhanced-club-prompts.ts          ❌ Arsenal-specific examples
├── EnhancedArsenalDossier.tsx        ❌ Hardcoded Arsenal content
└── EntityDossierRouter.tsx           ⚠️  Special Arsenal case
```

### After
```
src/components/entity-dossier/
├── universal-club-prompts.ts         ✅ Abstract, entity-agnostic
├── enhanced-club-prompts.ts          🔄 Keep for backward compatibility
├── EnhancedArsenalDossier.tsx        🔄 Keep for manual Arsenal override
└── EntityDossierRouter.tsx           ✅ Use universal by default
```

---

## Step 1: Update Import Statements

### In `EntityDossierRouter.tsx`

**Before**:
```typescript
import EnhancedArsenalDossier from './EnhancedArsenalDossier'
import { EnhancedClubDossier } from './EnhancedClubDossier'
```

**After**:
```typescript
import { generateDossierPrompt, extractHypothesesFromDossier, calculateDossierTier } from './universal-club-prompts'
import EnhancedArsenalDossier from './EnhancedArsenalDossier'
import { EnhancedClubDossier } from './EnhancedClubDossier'

// OR use the new DynamicEntityDossier component
import { DynamicEntityDossier } from './DynamicEntityDossier'
```

---

## Step 2: Update Dossier Generation Logic

### In `EnhancedClubDossier.tsx`

**Before** (lines 82-86):
```typescript
const generateEnhancedDossier = async () => {
  // Uses hardcoded Arsenal prompts
  const prompt = ARSENAL_STYLE_CLUB_PROMPT
    .replace(/{name}/g, entity.properties.name)
  // ... generates dossier with Arsenal content
}
```

**After**:
```typescript
import { generateDossierPrompt, calculateDossierTier, extractSignalsFromDossier } from './universal-club-prompts'

const generateEnhancedDossier = async () => {
  // Calculate tier based on priority
  const priority = getEntityPriority(entity)
  const tier = calculateDossierTier(priority)

  // Generate entity-specific prompt
  const prompt = generateDossierPrompt(
    tier,
    entity.properties.name,
    entity.properties.type || 'Club',
    entity.properties.industry || 'Sports',
    entity.properties
  )

  // Call AI with prompt
  const response = await claudeClient.generate(prompt)

  // Extract signals for hypothesis generation
  const signals = extractSignalsFromDossier(response.data)
  const hypotheses = extractHypothesesFromDossier(response.data)

  // Store structured data
  setEnhancedData({
    ...response.data,
    signals,
    hypotheses,
    tier
  })

  // Optional: Send to hypothesis-driven discovery
  if (hypotheses.length > 0) {
    await submitHypothesesToDiscovery(entity.id, hypotheses)
  }
}
```

---

## Step 3: Update API Route

### In `src/app/api/dossier/route.ts`

**Before** (lines 186-216):
```typescript
async function generateDossier(entityId: string, force: boolean = false) {
  // Option 2: Mock data for testing
  const mockDossier = {
    entity_id: entityId,
    entity_name: entityId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    // ... returns empty sections
  }

  return mockDossier
}
```

**After**:
```typescript
import { generateDossierPrompt, calculateDossierTier, extractHypothesesFromDossier } from '@/components/entity-dossier/universal-club-prompts'

async function generateDossier(entityId: string, force: boolean = false) {
  // 1. Fetch entity data from FalkorDB
  const entityData = await fetchEntityFromFalkorDB(entityId)

  if (!entityData) {
    throw new Error(`Entity ${entityId} not found`)
  }

  // 2. Calculate tier based on priority
  const priority = entityData.priority_score || 50
  const tier = calculateDossierTier(priority)

  // 3. Generate entity-specific prompt
  const prompt = generateDossierPrompt(
    tier,
    entityData.name,
    entityData.type,
    entityData.industry,
    entityData
  )

  // 4. Call backend Python service
  const backendResponse = await fetch('http://localhost:8000/dossier/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_id: entityId,
      prompt: prompt,
      tier: tier,
      priority_score: priority
    })
  })

  const dossier = await backendResponse.json()

  // 5. Extract hypotheses and signals
  const hypotheses = extractHypothesesFromDossier(dossier)
  const signals = extractSignalsFromDossier(dossier)

  // 6. Enhance dossier with extracted data
  const enhancedDossier = {
    ...dossier,
    hypotheses,
    signals,
    metadata: {
      ...dossier.metadata,
      tier,
      priority_score: priority,
      generated_at: new Date().toISOString()
    }
  }

  return enhancedDossier
}
```

---

## Step 4: Update Backend Python Service

### In `backend/dossier_generator.py`

**Before** (lines 1-100):
```python
class EntityDossierGenerator:
    def __init__(self, claude_client, falkordb_client):
        self.claude_client = claude_client
        self.section_templates = {
            "core_information": {
                "model": "haiku",
                "prompt_template": "core_info_template",
                # ... hardcoded templates
            }
        }
```

**After**:
```python
from typing import Dict, List, Optional
from schemas import EntityDossier, DossierSection

class UniversalDossierGenerator:
    """
    Generates entity-agnostic dossiers using universal prompts

    Supports tiered generation for cost-optimized processing:
    - BASIC (0-20 priority): 3 sections, $0.0004, ~5s
    - STANDARD (21-50): 7 sections, $0.0095, ~15s
    - PREMIUM (51-100): 11 sections, $0.057, ~30s
    """

    def __init__(self, claude_client, falkordb_client=None):
        self.claude_client = claude_client
        self.falkordb_client = falkordb_client

    async def generate_dossier(
        self,
        entity_id: str,
        entity_data: Dict,
        tier: str = 'STANDARD'
    ) -> EntityDossier:
        """
        Generate dossier for any entity using universal prompts

        Args:
            entity_id: Unique entity identifier
            entity_data: Entity properties from FalkorDB
            tier: BASIC | STANDARD | PREMIUM

        Returns:
            EntityDossier with structured intelligence
        """
        # Import universal prompts
        from universal_club_prompts import (
            UNIVERSAL_CLUB_DOSSIER_PROMPT,
            BASIC_DOSSIER_PROMPT,
            STANDARD_DOSSIER_PROMPT
        )

        # Select prompt based on tier
        prompt_templates = {
            'BASIC': BASIC_DOSSIER_PROMPT,
            'STANDARD': STANDARD_DOSSIER_PROMPT,
            'PREMIUM': UNIVERSAL_CLUB_DOSSIER_PROMPT
        }

        prompt = prompt_templates[tier]

        # Interpolate entity data into prompt
        formatted_prompt = self._interpolate_prompt(
            prompt,
            entity_data
        )

        # Generate dossier using appropriate model
        if tier == 'PREMIUM':
            # Use model cascade for premium tier
            dossier = await self._generate_with_model_cascade(
                formatted_prompt,
                entity_id
            )
        else:
            # Use single model for basic/standard
            model = 'haiku' if tier == 'BASIC' else 'sonnet'
            dossier = await self._generate_with_model(
                formatted_prompt,
                entity_id,
                model
            )

        # Validate dossier structure
        self._validate_dossier(dossier)

        # Extract hypotheses for downstream systems
        dossier['hypotheses'] = self._extract_hypotheses(dossier)
        dossier['signals'] = self._extract_signals(dossier)

        return EntityDossier(**dossier)

    def _interpolate_prompt(self, prompt: str, entity_data: Dict) -> str:
        """Replace template variables with entity-specific data"""
        return (
            prompt.replace('{name}', entity_data.get('name', 'Unknown'))
                 .replace('{type}', entity_data.get('type', 'Organization'))
                 .replace('{industry}', entity_data.get('industry', 'Unknown'))
                 .replace('{currentData}', json.dumps(entity_data, indent=2))
        )

    async def _generate_with_model_cascade(
        self,
        prompt: str,
        entity_id: str
    ) -> Dict:
        """Generate premium dossier using Haiku → Sonnet → Opus cascade"""
        # Phase 1: Haiku for basic info (80% of content)
        haiku_result = await self.claude_client.generate(
            prompt=prompt,
            model='haiku-3.5',
            max_tokens=4000
        )

        # Phase 2: Sonnet for analysis (15% of content)
        sonnet_prompt = f"""
        Review and enhance the following dossier sections with deeper analysis:

        {haiku_result['text']}

        Focus on:
        - Leadership profiling with communication styles
        - Digital maturity assessment with specific gaps
        - Risk analysis with mitigation strategies

        Return ONLY the enhanced sections in the same JSON structure.
        """

        sonnet_result = await self.claude_client.generate(
            prompt=sonnet_prompt,
            model='sonnet-4-5',
            max_tokens=6000
        )

        # Phase 3: Opus for strategic insights (5% of content)
        opus_prompt = f"""
        Based on this dossier, generate the following advanced sections:

        1. Primary hypothesis with 75%+ confidence
        2. Three secondary hypotheses
        3. Validation strategies for each hypothesis
        4. Success metrics and timeline

        Dossier:
        {sonnet_result['text']}

        Return in the hypothesis_generation section of the JSON structure.
        """

        opus_result = await self.claude_client.generate(
            prompt=opus_prompt,
            model='opus-4-6',
            max_tokens=3000
        )

        # Merge results
        return self._merge_cascade_results(
            haiku_result,
            sonnet_result,
            opus_result
        )

    def _validate_dossier(self, dossier: Dict) -> bool:
        """Ensure dossier meets quality standards"""
        required_sections = [
            'metadata',
            'executive_summary',
            'digital_infrastructure',
            'procurement_signals',
            'recommended_approach',
            'next_steps'
        ]

        for section in required_sections:
            if section not in dossier:
                raise ValueError(f"Missing required section: {section}")

        # Validate confidence scores
        for insight in dossier.get('executive_summary', {}).get('key_insights', []):
            if 'confidence' not in insight:
                logger.warning(f"Insight missing confidence score: {insight}")
                insight['confidence'] = 50  # Default confidence

        # Validate signal tagging
        for insight in dossier.get('executive_summary', {}).get('key_insights', []):
            if 'signal_type' not in insight:
                logger.warning(f"Insight missing signal_type: {insight}")

        return True

    def _extract_hypotheses(self, dossier: Dict) -> List[Dict]:
        """Extract hypothesis-ready insights"""
        hypotheses = []

        # From executive summary
        for insight in dossier.get('executive_summary', {}).get('key_insights', []):
            if insight.get('hypothesis_ready', False):
                hypotheses.append({
                    'statement': insight['insight'],
                    'signal_type': insight['signal_type'],
                    'confidence': insight['confidence'],
                    'entity_id': dossier['metadata']['entity_id']
                })

        # From hypothesis generation section
        hg = dossier.get('recommended_approach', {}).get('hypothesis_generation', {})
        if hg.get('primary_hypothesis'):
            hypotheses.append({
                **hg['primary_hypothesis'],
                'entity_id': dossier['metadata']['entity_id'],
                'type': 'PRIMARY'
            })

        for h in hg.get('secondary_hypotheses', []):
            hypotheses.append({
                **h,
                'entity_id': dossier['metadata']['entity_id'],
                'type': 'SECONDARY'
            })

        return hypotheses

    def _extract_signals(self, dossier: Dict) -> List[Dict]:
        """Extract tagged signals for filtering"""
        signals = []

        for insight in dossier.get('executive_summary', {}).get('key_insights', []):
            signals.append({
                'type': insight['signal_type'],
                'insight': insight['insight'],
                'confidence': insight['confidence'],
                'impact': insight.get('impact', 'MEDIUM'),
                'entity_id': dossier['metadata']['entity_id']
            })

        return signals
```

---

## Step 5: Update Frontend Display

### In `EnhancedClubDossier.tsx`

**Before** (lines 89-100):
```typescript
const mapApiDossierToEnhancedDossier = (apiDossier: any): EnhancedClubDossier => {
  return {
    coreInfo: {
      name: apiDossier.core_info?.name || props.name || 'Unknown',
      type: apiDossier.core_info?.type || props.type || 'Club',
      // ... simple mapping
    }
  }
}
```

**After**:
```typescript
const mapApiDossierToEnhancedDossier = (apiDossier: any): EnhancedClubDossier => {
  return {
    coreInfo: {
      name: apiDossier.metadata?.entity_name || props.name || 'Unknown',
      type: apiDossier.metadata?.entity_type || props.type || 'Club',
      league: props.level || 'Unknown',
      founded: apiDossier.digital_infrastructure?.current_tech_stack?.founded || 'Unknown',
      hq: props.country || 'Unknown',
      stadium: apiDossier.digital_infrastructure?.current_tech_stack?.stadium || 'Unknown',
      website: props.website,
      employeeRange: apiDossier.digital_infrastructure?.current_tech_stack?.employee_count || 'Unknown'
    },

    // Map executive summary with confidence scores
    executiveSummary: {
      overallAssessment: apiDossier.executive_summary?.overall_assessment || {},
      quickActions: apiDossier.executive_summary?.quick_actions || [],
      keyInsights: (apiDossier.executive_summary?.key_insights || []).map((insight: any) => ({
        text: insight.insight,
        signalType: insight.signal_type,
        confidence: insight.confidence,
        impact: insight.impact,
        source: insight.source,
        hypothesisReady: insight.hypothesis_ready
      }))
    },

    // Map procurement signals
    procurementSignals: {
      upcomingOpportunities: apiDossier.procurement_signals?.upcoming_opportunities || [],
      budgetIndicators: apiDossier.procurement_signals?.budget_indicators || [],
      strategicInitiatives: apiDossier.procurement_signals?.strategic_initiatives || []
    },

    // Map leadership analysis
    leadership: apiDossier.leadership_analysis?.decision_makers || [],

    // Map timing analysis
    timing: {
      contractWindows: apiDossier.timing_analysis?.contract_windows || [],
      strategicCycles: apiDossier.timing_analysis?.strategic_cycles || {},
      urgencyIndicators: apiDossier.timing_analysis?.urgency_indicators || []
    },

    // Map risk assessment
    risks: {
      implementationRisks: apiDossier.risk_assessment?.implementation_risks || [],
      competitiveLandscape: apiDossier.risk_assessment?.competitive_landscape || {}
    },

    // Map recommended approach with hypotheses
    recommendedApproach: {
      immediateActions: apiDossier.recommended_approach?.immediate_actions || [],
      hypothesisGeneration: apiDossier.recommended_approach?.hypothesis_generation || {},
      resourceAllocation: apiDossier.recommended_approach?.resource_allocation || {}
    },

    // Map next steps
    nextSteps: {
      monitoringTriggers: apiDossier.next_steps?.monitoring_triggers || [],
      dataGaps: apiDossier.next_steps?.data_gaps || [],
      engagementSequence: apiDossier.next_steps?.engagement_sequence || []
    },

    // Add extracted signals and hypotheses
    signals: apiDossier.signals || [],
    hypotheses: apiDossier.hypotheses || [],

    // Add metadata
    metadata: {
      tier: apiDossier.metadata?.tier || 'STANDARD',
      priorityScore: apiDossier.metadata?.priority_score || 50,
      confidenceOverall: apiDossier.metadata?.confidence_overall || 50,
      generatedAt: apiDossier.metadata?.generated_at || new Date().toISOString(),
      dataFreshness: apiDossier.metadata?.data_freshness || 50
    }
  }
}
```

---

## Step 6: Integration with Hypothesis-Driven Discovery

### New Integration Point

```python
# backend/hypothesis_driven_discovery.py

async def initialize_hypotheses_from_dossiers(
    entity_ids: List[str],
    discovery: HypothesisDrivenDiscovery
):
    """
    Initialize discovery system with dossier-generated hypotheses

    This replaces cold-start with warm-start from dossier intelligence
    """
    for entity_id in entity_ids:
        # Fetch cached dossier
        dossier = await fetch_dossier_from_cache(entity_id)

        if not dossier:
            continue

        # Extract pre-generated hypotheses
        hypotheses = dossier.get('hypotheses', [])

        # Initialize hypothesis manager with dossier insights
        for hypothesis_data in hypotheses:
            hypothesis = Hypothesis(
                id=f"dossier_{entity_id}_{uuid.uuid4().hex[:8]}",
                entity_id=entity_id,
                category=map_signal_to_category(hypothesis_data['signal_type']),
                assertion=hypothesis_data['statement'],
                prior_confidence=hypothesis_data['confidence'] / 100,  # Convert to 0-1
                source='dossier_generation',
                validation_strategy=hypothesis_data.get('validation_strategy'),
                metadata={
                    'type': hypothesis_data.get('type'),
                    'impact': hypothesis_data.get('impact')
                }
            )

            # Add to discovery system
            discovery.hypothesis_manager.add_hypothesis(hypothesis)

        # Add signals to context
        signals = dossier.get('signals', [])
        discovery.context_builder.add_signals(entity_id, signals)
```

---

## Testing the Migration

### 1. Test Basic Tier (Low Priority Entity)

```typescript
const testBasicTier = async () => {
  const lowPriorityEntity = {
    id: 'burnley-fc',
    name: 'Burnley FC',
    type: 'Club',
    industry: 'Sports',
    priority_score: 15  // Triggers BASIC tier
  }

  const dossier = await generateDossier('burnley-fc', lowPriorityEntity)

  console.log('Expected sections: 3')
  console.log('Actual sections:', dossier.sections.length)
  console.log('Cost: ~$0.0004')
  console.log('Time: ~5s')
}
```

### 2. Test Standard Tier (Medium Priority)

```typescript
const testStandardTier = async () => {
  const mediumPriorityEntity = {
    id: 'aston-villa-fc',
    name: 'Aston Villa FC',
    type: 'Club',
    industry: 'Sports',
    priority_score: 45  // Triggers STANDARD tier
  }

  const dossier = await generateDossier('aston-villa-fc', mediumPriorityEntity)

  console.log('Expected sections: 7')
  console.log('Actual sections:', dossier.sections.length)
  console.log('Cost: ~$0.0095')
  console.log('Time: ~15s')
}
```

### 3. Test Premium Tier (High Priority)

```typescript
const testPremiumTier = async () => {
  const highPriorityEntity = {
    id: 'arsenal-fc',
    name: 'Arsenal FC',
    type: 'Club',
    industry: 'Sports',
    priority_score: 85  // Triggers PREMIUM tier
  }

  const dossier = await generateDossier('arsenal-fc', highPriorityEntity)

  console.log('Expected sections: 11')
  console.log('Actual sections:', dossier.sections.length)
  console.log('Cost: ~$0.057')
  console.log('Time: ~30s')
}
```

### 4. Verify No Literal Copying

```typescript
const testNoLiteralCopying = async () => {
  const testEntity = {
    id: 'liverpool-fc',
    name: 'Liverpool FC',
    type: 'Club',
    industry: 'Sports',
    priority_score: 75
  }

  const dossier = await generateDossier('liverpool-fc', testEntity)

  // Check that Liverpool dossier doesn't contain Arsenal-specific content
  const content = JSON.stringify(dossier)

  const arsenalSpecificTerms = [
    'Juliet Slot',
    'NTT DATA',
    'Emirates Stadium',
    'Josh Kroenke',
    'Arsenal Mind'
  ]

  const foundArsenalTerms = arsenalSpecificTerms.filter(term =>
    content.includes(term)
  )

  if (foundArsenalTerms.length > 0) {
    console.error('❌ Found Arsenal-specific terms:', foundArsenalTerms)
    throw new Error('Dossier contains copied content')
  } else {
    console.log('✅ No Arsenal-specific terms found - test passed')
  }
}
```

---

## Rollout Strategy

### Phase 1: Parallel Run (Week 1)
- Keep old Arsenal prompts for existing Arsenal dossier
- Test new universal prompts on 10% of entities
- Compare quality and cost
- Gather feedback from sales team

### Phase 2: Soft Launch (Week 2-3)
- Switch 50% of entities to new system
- Monitor hypothesis validation rates
- Fix bugs based on feedback
- Optimize prompts based on outcomes

### Phase 3: Full Migration (Week 4)
- Switch all entities to universal system
- Deprecate Arsenal-specific prompts
- Enable hypothesis-driven discovery integration
- Launch automated monitoring system

---

## Backward Compatibility

Keep these files for reference and gradual migration:

```typescript
// Old files (keep but mark as deprecated)
/**
 * @deprecated Use universal-club-prompts.ts instead
 * This file is kept for backward compatibility
 */
import { ARSENAL_STYLE_CLUB_PROMPT } from './enhanced-club-prompts'
```

---

## Success Metrics

Track these metrics to ensure migration is successful:

1. **Quality Metrics**:
   - Hypothesis validation rate >60%
   - No literal copying of Arsenal content
   - Confidence scores accurate (±10%)

2. **Cost Metrics**:
   - Average cost per entity <$0.01
   - 80%+ cache hit rate
   - Total batch cost <$30 for 3,000 entities

3. **Business Metrics**:
   - RFP detection rate increases by 20%
   - Sales team满意度 >4/5
   - Time-to-opportunity decreases by 30%

---

## Summary

The migration from Arsenal-specific to universal dossiers enables:

✅ **Scale**: Process 3,000+ entities cost-effectively
✅ **Quality**: Entity-specific analysis, no literal copying
✅ **Integration**: Direct feed into hypothesis-driven discovery
✅ **Collaboration**: Structured data for AI, narrative for humans
✅ **Flexibility**: Tiered generation based on priority

The key innovation is using **abstract templates with signal tagging** rather than hardcoded examples, ensuring every dossier is truly entity-specific while maintaining consistent quality standards.
