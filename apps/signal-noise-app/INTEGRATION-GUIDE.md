# Multi-Agent System Integration Guide

**Step-by-step instructions to integrate the new multi-agent system into your existing code.**

---

## 🎯 Overview

You have 3 main options for integration:

1. **Drop-in Replacement** (Easiest) - Use legacy adapter, zero code changes
2. **Simple Migration** (Recommended) - Update imports, minimal changes
3. **Full Migration** (Advanced) - Use multi-agent coordinator directly

---

## Option 1: Drop-in Replacement (Zero Code Changes)

### When to Use
- You want to test the system immediately
- Minimal risk to existing functionality
- Gradual migration approach

### How It Works

The legacy adapter wraps the multi-agent system and presents the **exact same API** as your existing code.

### Integration Steps

**Step 1: Add compatibility layer to `digital_discovery_agent.py`**

Add this at the top of `backend/digital_discovery_agent.py`:

```python
# Add after existing imports
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Check if we should use multi-agent system
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    # Import multi-agent adapter
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as MultiAgentAdapter
    # Alias for compatibility
    DigitalDiscoveryAgent = MultiAgentAdapter
```

**Step 2: Enable multi-agent system via environment variable**

```bash
# Add to backend/.env
USE_MULTI_AGENT=true
```

**Step 3: That's it!**

All existing code continues to work:
- `backend/api_digital_discovery.py` - No changes needed
- `backend/hypothesis_driven_discovery.py` - No changes needed
- Any file importing `DigitalDiscoveryAgent` - No changes needed

**Step 4: Test it**

```python
# Test that it works
python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def test():
    # This will use multi-agent system if USE_MULTI_AGENT=true
    agent = DigitalDiscoveryAgent()
    print(f'Agent type: {type(agent).__name__}')
    print('✅ Integration working!')

asyncio.run(test())
"
```

---

## Option 2: Simple Migration (Recommended)

### When to Use
- You want to use the multi-agent system directly
- You're comfortable updating imports
- You want better control over configuration

### File 1: `backend/api_digital_discovery.py`

**BEFORE:**
```python
from backend.digital_discovery_agent import DigitalDiscoveryAgent

# ... in the code ...
discovery_agent = DigitalDiscoveryAgent()
result = await discovery_agent.discover_entity(...)
```

**AFTER:**
```python
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

# ... in the code ...
discovery_agent = DigitalDiscoveryAgentAdapter(max_iterations=5)
result = await discovery_agent.discover_entity(...)
```

**Full example with context:**
```python
# OLD CODE
from backend.digital_discovery_agent import DigitalDiscoveryAgent
from backend.schemas import Entity
from typing import Dict, Any

class DigitalDiscoveryRouter:
    def __init__(self):
        self.agent = DigitalDiscoveryAgent()

    async def discover_entity(self, entity_name: str, entity_id: str) -> Dict[str, Any]:
        result = await self.agent.discover_entity(
            entity_name=entity_name,
            entity_id=entity_id
        )
        return result

# NEW CODE (Option 2)
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter
from backend.schemas import Entity
from typing import Dict, Any

class DigitalDiscoveryRouter:
    def __init__(self):
        # Use multi-agent adapter
        self.agent = DigitalDiscoveryAgentAdapter(
            max_iterations=5,
            target_confidence=0.70
        )

    async def discover_entity(self, entity_name: str, entity_id: str) -> Dict[str, Any]:
        # Same API call!
        result = await self.agent.discover_entity(
            entity_name=entity_name,
            entity_id=entity_id
        )
        return result
```

### File 2: `backend/hypothesis_driven_discovery.py`

**BEFORE:**
```python
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

discovery = HypothesisDrivenDiscovery(...)
result = await discovery.run_discovery(...)
```

**AFTER:**
```python
from backend.agents.legacy_adapter import HypothesisDiscoveryAdapter

discovery = HypothesisDiscoveryAdapter(max_iterations=5)
result = await discovery.test_hypothesis(...)
```

**Full integration example:**
```python
# OLD CODE
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient

class DiscoveryOrchestrator:
    def __init__(self):
        self.claude = ClaudeClient()
        self.brightdata = BrightDataSDKClient()

    async def discover(self, entity_name):
        discovery = HypothesisDrivenDiscovery(
            claude_client=self.claude,
            brightdata_client=self.brightdata
        )
        return await discovery.run_discovery(
            entity_name=entity_name,
            entity_id=entity_name.lower().replace(" ", "-")
        )

# NEW CODE (Option 2)
from backend.agents.legacy_adapter import HypothesisDiscoveryAdapter
from backend.agents import MultiAgentCoordinator

class DiscoveryOrchestrator:
    def __init__(self):
        # Multi-agent system handles everything internally
        pass

    async def discover(self, entity_name):
        # Use hypothesis discovery adapter
        discovery = HypothesisDiscoveryAdapter(max_iterations=5)

        # Test hypothesis
        return await discovery.test_hypothesis(
            entity_name=entity_name,
            entity_id=entity_name.lower().replace(" ", "-"),
            hypothesis={
                "id": "h1",
                "name": "CRM Detection",
                "type": "CRM_ANALYTICS"
            }
        )
```

---

## Option 3: Full Migration (Direct Multi-Agent Use)

### When to Use
- You want maximum control
- You want to use individual agents
- You want custom orchestration

### Example 1: Direct Multi-Agent Coordinator

```python
from backend.agents import MultiAgentCoordinator
from backend.agents import AgentContext

async def discover_with_full_control(entity_name: str, entity_id: str):
    """Full control over discovery process"""

    # Create coordinator with custom settings
    coordinator = MultiAgentCoordinator(
        max_iterations=10,  # Up to 10 iterations
        target_confidence=0.80,  # Target CONFIDENT band
        verbose=True  # Show progress
    )

    # Run discovery
    context = await coordinator.discover_entity(
        entity_name=entity_name,
        entity_id=entity_id,
        entity_type="organization"
    )

    # Access detailed results
    return {
        "entity_id": context.entity_id,
        "entity_name": context.entity_name,
        "primary_domain": context.primary_domain,
        "confidence": context.current_confidence,
        "confidence_band": context.confidence_metrics.get("band"),
        "signals": context.scored_signals,
        "iterations": context.iterations,
        "duration_seconds": (context.end_time - context.start_time).total_seconds()
    }
```

### Example 2: Individual Agents

```python
from backend.agents import SearchAgent, ScrapeAgent, AnalysisAgent

async def custom_discovery_workflow(entity_name: str):
    """Custom workflow using individual agents"""

    # Step 1: Search for domains
    search_agent = SearchAgent()
    domains = await search_agent.discover_domains(
        entity_name=entity_name,
        max_iterations=3
    )

    print(f"Found domain: {domains['primary_domain']}")

    # Step 2: Scrape if domain found
    if domains['primary_domain']:
        scrape_agent = ScrapeAgent()

        # Build URL list
        urls = [f"https://{domains['primary_domain']}"]
        urls.extend([f"https://{sub}" for sub in domains.get('subdomains', [])[:2]])

        profile = await scrape_agent.extract_entity_profile(
            entity_name=entity_name,
            urls=urls,
            max_tokens=10000
        )

        print(f"Tech stack: {profile['entity_profile']['technology_stack']}")

        # Step 3: Analyze signals
        raw_signals = extract_signals_from_profile(profile)

        analysis_agent = AnalysisAgent()
        scored = await analysis_agent.score_signals(
            entity_name=entity_name,
            signals=raw_signals
        )

        return {
            "domain": domains['primary_domain'],
            "profile": profile['entity_profile'],
            "confidence": scored['confidence_metrics']['final_confidence'],
            "band": scored['confidence_metrics']['band']
        }

    return None
```

### Example 3: API Endpoint Integration

```python
# File: backend/api_digital_discovery.py (updated)
from fastapi import APIRouter, HTTPException
from backend.agents import discover_with_agents

router = APIRouter(prefix="/api/discovery", tags=["discovery"])

@router.post("/entity")
async def discover_entity(request: EntityDiscoveryRequest):
    """Discover entity using multi-agent system"""
    try:
        # Simple one-liner!
        result = await discover_with_agents(
            entity_name=request.entity_name,
            entity_id=request.entity_id,
            max_iterations=request.max_iterations or 5,
            target_confidence=request.target_confidence or 0.70
        )

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Quick Integration Checklist

### Phase 1: Test with Drop-in Replacement ⏱️ 5 minutes

- [ ] Add `USE_MULTI_AGENT=true` to `backend/.env`
- [ ] Add compatibility import to `digital_discovery_agent.py`
- [ ] Run existing tests
- [ ] Verify results match old system

### Phase 2: Simple Migration ⏱️ 30 minutes

- [ ] Update imports in `api_digital_discovery.py`
- [ ] Update imports in `hypothesis_driven_discovery.py`
- [ ] Test with real entities
- [ ] Compare results with old system

### Phase 3: Full Integration ⏱️ 1-2 hours

- [ ] Update all discovery files
- [ ] Add custom configurations
- [ ] Monitor performance metrics
- [ ] Calibrate confidence thresholds
- [ ] Deploy to production

---

## Common Integration Patterns

### Pattern 1: Batch Discovery

```python
# OLD CODE
from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def batch_discover(entity_names):
    agent = DigitalDiscoveryAgent()
    results = []
    for name in entity_names:
        result = await agent.discover_entity(name, name.lower().replace(" ", "-"))
        results.append(result)
    return results

# NEW CODE (Option 2)
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

async def batch_discover(entity_names):
    agent = DigitalDiscoveryAgentAdapter(max_iterations=3)
    results = []
    for name in entity_names:
        result = await agent.discover_entity(name, name.lower().replace(" ", "-"))
        results.append(result)
    return results
```

### Pattern 2: Template Validation

```python
# OLD CODE
from backend.template_discovery import TemplateDiscovery

discovery = TemplateDiscovery(...)
templates = await discovery.discover_templates(entity_ids)

# NEW CODE (Option 2)
from backend.agents.legacy_adapter import TemplateValidationAdapter

validator = TemplateValidationAdapter()
result = await validator.validate_template(
    template_id="my_template",
    test_entities=["Arsenal FC", "Chelsea FC"],
    template_hypotheses=[...]
)
```

### Pattern 3: Hypothesis Testing

```python
# OLD CODE
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

discovery = HypothesisDrivenDiscovery(...)
result = await discovery.run_discovery(entity_id, entity_name, template_id)

# NEW CODE (Option 2)
from backend.agents.legacy_adapter import HypothesisDiscoveryAdapter

adapter = HypothesisDiscoveryAdapter()
result = await adapter.test_hypothesis(
    entity_name="Arsenal FC",
    entity_id="arsenal-fc",
    hypothesis={
        "id": "h1",
        "name": "CRM Detection",
        "type": "CRM_ANALYTICS"
    }
)
```

---

## Testing Your Integration

### Test 1: Verify Import Works

```bash
cd backend
python3 -c "
import sys
sys.path.insert(0, '.')
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter
print('✅ Import successful!')
"
```

### Test 2: Test Simple Discovery

```python
import asyncio
import sys
sys.path.insert(0, '.')

async def test():
    from backend.agents import discover_with_agents

    result = await discover_with_agents(
        entity_name="Test Entity",
        entity_id="test-entity",
        max_iterations=1
    )

    print(f"✅ Discovery test passed!")
    print(f"Confidence: {result['confidence']:.3f}")
    return result

asyncio.run(test())
```

### Test 3: Compare with Old System

```python
import asyncio
import sys
sys.path.insert(0, '.')

async def compare():
    # Old system (if still available)
    from backend.digital_discovery_agent import DigitalDiscoveryAgent as OldAgent

    # New system
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as NewAgent

    # Test both
    old_agent = OldAgent()
    new_agent = NewAgentAdapter(max_iterations=1)

    # Run discovery
    old_result = await old_agent.discover_entity("Arsenal FC", "arsenal-fc")
    new_result = await new_agent.discover_entity("Arsenal FC", "arsenal-fc")

    # Compare
    print(f"Old confidence: {old_result.get('confidence', 0):.3f}")
    print(f"New confidence: {new_result['confidence']:.3f}")
    print(f"Match: {abs(old_result.get('confidence', 0) - new_result['confidence']) < 0.1}")

asyncio.run(compare())
```

---

## Rollback Plan

If something doesn't work, you can instantly rollback:

### Option 1: Disable Multi-Agent

```bash
# In backend/.env
USE_MULTI_AGENT=false
```

### Option 2: Revert Import

```python
# Change back to old import
from backend.digital_discovery_agent import DigitalDiscoveryAgent  # Original
# from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter  # Comment out
```

### Option 3: Keep Both

```python
# Keep both systems
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as DiscoverySystem
else:
    from backend.digital_discovery_agent import DigitalDiscoveryAgent as DiscoverySystem
```

---

## Migration Examples by File

### Example 1: Update `scripts/batch_template_discovery.py`

**BEFORE:**
```python
from backend.template_discovery import TemplateDiscovery

discovery = TemplateDiscovery(...)
templates = await discovery.discover_templates(entity_ids)
```

**AFTER:**
```python
from backend.agents.legacy_adapter import TemplateValidationAdapter

validator = TemplateValidationAdapter()
result = await validator.validate_template(
    template_id="template_1",
    test_entities=["Arsenal FC", "Chelsea FC"],
    template_hypotheses=[...]
)
```

### Example 2: Update `backend/template_bootstrap.py`

**BEFORE:**
```python
from backend.template_discovery import TemplateDiscovery
from backend.template_enrichment_agent import TemplateEnrichmentAgent

discovery = TemplateDiscovery(...)
enrichment = TemplateEnrichmentAgent(...)
```

**AFTER:**
```python
from backend.agents import MultiAgentCoordinator

coordinator = MultiAgentCoordinator(max_iterations=5)
context = await coordinator.discover_entity(entity_name, entity_id)
```

### Example 3: Update API endpoint

**BEFORE:**
```python
@router.post("/discover")
async def discover(request):
    from backend.digital_discovery_agent import DigitalDiscoveryAgent
    agent = DigitalDiscoveryAgent()
    result = await agent.discover_entity(...)
    return result
```

**AFTER:**
```python
@router.post("/discover")
async def discover(request):
    from backend.agents import discover_with_agents
    result = await discover_with_entities(...)
    return result
```

---

## Summary

### Quickest Path (5 minutes)

1. Add `USE_MULTI_AGENT=true` to `.env`
2. Add compatibility import to `digital_discovery_agent.py`
3. Test with existing code
4. Done!

### Recommended Path (30 minutes)

1. Update imports in 2-3 main files
2. Test with real entities
3. Compare results
4. Deploy

### Full Control (1-2 hours)

1. Use MultiAgentCoordinator directly
2. Customize agent configuration
3. Add monitoring and telemetry
4. Optimize based on metrics

---

**Which option would you like to start with?** I can help you implement any of these approaches!
