# Quick Integration Reference Card

**Copy-paste these code changes to integrate the multi-agent system.**

---

## 🚀 Fastest Integration (5 minutes)

### Step 1: Enable Multi-Agent System

Add to `backend/.env`:
```bash
USE_MULTI_AGENT=true
```

### Step 2: Update `backend/digital_discovery_agent.py`

Add at the top (after existing imports):
```python
import os
import sys

# Enable multi-agent system via environment variable
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter
    # Use multi-agent system
    DigitalDiscoveryAgent = DigitalDiscoveryAgentAdapter
```

### Step 3: Test It

```bash
cd backend
python3 -c "
import asyncio
import sys
import os
sys.path.insert(0, '.')
os.environ['USE_MULTI_AGENT'] = 'true'

from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def test():
    agent = DigitalDiscoveryAgent()
    print(f'Agent type: {type(agent).__name__}')
    print(f'Using multi-agent: {USE_MULTI_AGENT}')

asyncio.run(test())
"
```

**Output should be:**
```
Agent type: DigitalDiscoveryAgentAdapter
Using multi-agent: True
```

---

## 📝 Common Code Changes

### Change 1: API Endpoint (`backend/api_digital_discovery.py`)

**Find this code:**
```python
from backend.digital_discovery_agent import DigitalDiscoveryAgent
```

**Replace with:**
```python
# Option A: Use legacy adapter (recommended)
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as DigitalDiscoveryAgent

# Option B: Use simple function
from backend.agents import discover_with_agents
```

**Update usage:**
```python
# OLD
agent = DigitalDiscoveryAgent()
result = await agent.discover_entity(entity_name, entity_id)

# NEW (Option A)
agent = DigitalDiscoveryAgentAdapter(max_iterations=5)
result = await agent.discover_entity(entity_name, entity_id)

# NEW (Option B)
result = await discover_with_agents(entity_name, entity_id)
```

### Change 2: Batch Processing

**Find this code:**
```python
from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def process_entities(entities):
    agent = DigitalDiscoveryAgent()
    for entity in entities:
        result = await agent.discover_entity(entity['name'], entity['id'])
```

**Replace with:**
```python
from backend.agents import discover_with_agents

async def process_entities(entities):
    # Process each entity
    results = []
    for entity in entities:
        result = await discover_with_agents(
            entity_name=entity['name'],
            entity_id=entity['id'],
            max_iterations=3
        )
        results.append(result)
    return results
```

### Change 3: Template Discovery

**Find this code:**
```python
from backend.template_discovery import TemplateDiscovery

discovery = TemplateDiscovery(claude, brightdata)
templates = await discovery.discover_templates(entity_ids)
```

**Replace with:**
```python
from backend.agents import MultiAgentCoordinator

coordinator = MultiAgentCoordinator(max_iterations=5)
for entity_id in entity_ids:
    context = await coordinator.discover_entity(entity_name, entity_id)
    # Use context.entity_profile for template learning
```

### Change 4: Hypothesis Testing

**Find this code:**
```python
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

discovery = HypothesisDrivenDiscovery(claude, brightdata)
result = await discovery.run_discovery(entity_id, entity_name, template)
```

**Replace with:**
```python
from backend.agents.legacy_adapter import HypothesisDiscoveryAdapter

adapter = HypothesisDiscoveryAdapter(max_iterations=5)
result = await adapter.test_hypothesis(
    entity_name=entity_name,
    entity_id=entity_id,
    hypothesis={
        "id": "h1",
        "name": "CRM Detection",
        "type": "CRM_ANALYTICS"
    }
)
```

---

## 🧪 Test Your Integration

### Test 1: Simple Smoke Test

```python
import asyncio
import sys
sys.path.insert(0, '.')

async def test():
    from backend.agents import discover_with_agents

    result = await discover_with_agents(
        entity_name="Test",
        entity_id="test-id",
        max_iterations=1
    )

    assert 'confidence' in result
    assert 'discovery_method' in result
    assert result['discovery_method'] == 'multi_agent'
    print('✅ Integration test passed!')

asyncio.run(test())
```

### Test 2: Compare Results

```python
import asyncio
import sys
import os
sys.path.insert(0, '.')

async def test():
    # Enable multi-agent
    os.environ['USE_MULTI_AGENT'] = 'true'

    # Import will now use multi-agent system
    from backend.digital_discovery_agent import DigitalDiscoveryAgent

    agent = DigitalDiscoveryAgent()
    print(f'Using: {type(agent).__name__}')

    # Test discovery
    result = await agent.discover_entity("Arsenal FC", "arsenal-fc")
    print(f"Confidence: {result.get('confidence', 0):.3f}")
    print(f"Domain: {result.get('primary_domain', 'None')}")

asyncio.run(test())
```

---

## 🔧 Common Issues & Fixes

### Issue 1: Import Error

**Error:** `ModuleNotFoundError: No module named 'backend'`

**Fix:**
```python
import sys
sys.path.insert(0, '.')  # Add current directory to path
```

### Issue 2: Multi-Agent Not Activating

**Error:** Still using old system

**Fix:**
```bash
# Check environment variable
echo $USE_MULTI_AGENT

# Should be: true
# If not set, add to backend/.env
```

### Issue 3: Different Results

**Error:** Results differ from old system

**Fix:**
```python
# Adjust iterations to match old behavior
agent = DigitalDiscoveryAgentAdapter(max_iterations=3)  # Was 5
```

---

## 📋 Integration Checklist

### Phase 1: Setup (5 min)
- [ ] Add `USE_MULTI_AGENT=true` to `backend/.env`
- [ ] Add compatibility import to `digital_discovery_agent.py`
- [ ] Test with simple entity
- [ ] Verify multi-agent system is being used

### Phase 2: Update Main Files (30 min)
- [ ] Update `backend/api_digital_discovery.py`
- [ ] Update `backend/hypothesis_driven_discovery.py` (if used)
- [ ] Update `backend/template_discovery.py` (if used)
- [ ] Update any batch processing scripts
- [ ] Test each updated file

### Phase 3: Validate (1 hour)
- [ ] Run test suite
- [ ] Compare results with old system
- [ ] Check performance metrics
- [ ] Validate confidence scores
- [ ] Deploy to staging environment

---

## 💡 Pro Tips

### Tip 1: Gradual Rollout

Use environment variable to control rollout:
```bash
# Development
USE_MULTI_AGENT=true

# Staging
USE_MULTI_AGENT=true

# Production (start with false)
USE_MULTI_AGENT=false
```

### Tip 2: Monitor Performance

Add logging to track improvements:
```python
import time

start = time.time()
result = await agent.discover_entity(...)
duration = time.time() - start

logger.info(f"Discovery took {duration:.2f}s (multi-agent)")
```

### Tip 3: A/B Testing

Run both systems in parallel:
```python
# 10% of entities use multi-agent
if hash(entity_id) % 10 == 0:
    result = await discover_with_agents(...)  # New
else:
    result = await old_agent.discover_entity(...)  # Old
```

---

## 🎯 Quick Copy-Paste Templates

### Template 1: Simple Discovery

```python
from backend.agents import discover_with_agents

result = await discover_with_agents(
    entity_name="Entity Name",
    entity_id="entity-id",
    max_iterations=5
)

print(f"Confidence: {result['confidence']:.3f}")
print(f"Domain: {result['primary_domain']}")
```

### Template 2: Full Control

```python
from backend.agents import MultiAgentCoordinator

coordinator = MultiAgentCoordinator(
    max_iterations=10,
    target_confidence=0.80,
    verbose=True
)

context = await coordinator.discover_entity(
    entity_name="Entity Name",
    entity_id="entity-id"
)

print(f"Confidence: {context.current_confidence:.3f}")
print(f"Domain: {context.primary_domain}")
print(f"Signals: {len(context.scored_signals)}")
```

### Template 3: Individual Agents

```python
from backend.agents import SearchAgent, ScrapeAgent, AnalysisAgent

search = SearchAgent()
domains = await search.discover_domains("Entity Name", max_iterations=3)

scrape = ScrapeAgent()
profile = await scrape.extract_entity_profile("Entity Name", urls)

analysis = AnalysisAgent()
scored = await analysis.score_signals("Entity Name", signals)
```

---

**Need help with a specific file?** Just let me know which file you want to update and I'll show you the exact code changes!
