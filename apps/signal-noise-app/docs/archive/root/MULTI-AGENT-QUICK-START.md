# Multi-Agent System - Quick Start Guide

**Date**: 2026-02-04
**Status**: Ready for Testing
**Estimated Testing Time**: 30 minutes

---

## Prerequisites

### 1. Install Claude Agent SDK

```bash
cd backend
pip install claude-agent-sdk
```

**Note**: If the package doesn't exist yet, the system will fall back to the existing Anthropic SDK automatically.

### 2. Verify Environment Variables

```bash
# Check .env file has required keys
cat backend/.env | grep -E "(ANTHROPIC|BRIGHTDATA)"
```

Required:
- `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` (for Z.AI)
- `BRIGHTDATA_API_TOKEN`

---

## Quick Test (5 minutes)

### Test 1: Verify Module Imports

```bash
cd backend
python -c "
from backend.agent_tools.brightdata_tools import BRIGHTDATA_TOOLS
from backend.agent_sdk.client_factory import ClientFactory
from backend.agents import MultiAgentCoordinator
print('✅ All modules imported successfully')
print(f'Available tools: {list(BRIGHTDATA_TOOLS.keys())}')
"
```

**Expected Output**:
```
✅ All modules imported successfully
Available tools: ['search_engine', 'scrape_url', 'scrape_batch', 'search_jobs', 'search_press_releases']
```

### Test 2: Test Individual Tools

```bash
cd backend
python -c "
import asyncio
from backend.agent_tools.brightdata_tools import search_engine_tool

async def test():
    result = await search_engine_tool({
        'query': 'Arsenal FC official website',
        'engine': 'google',
        'num_results': 3
    })
    print('✅ Search tool test passed')
    print(f'Result: {result[\"content\"][0][\"text\"]}')

asyncio.run(test())
"
```

---

## Integration Tests (15 minutes)

### Test 3: Full Multi-Agent Workflow

Create test file `backend/test_multi_agent_system.py`:

```python
"""Test multi-agent system end-to-end"""
import asyncio
import json
from backend.agents import MultiAgentCoordinator

async def test_full_discovery():
    """Test complete discovery workflow"""
    print("="*60)
    print("Testing Multi-Agent System")
    print("="*60)

    # Create coordinator
    coordinator = MultiAgentCoordinator(
        max_iterations=2,  # Quick test (2 iterations)
        target_confidence=0.70,
        verbose=True
    )

    # Discover entity
    print("\n🚀 Starting discovery for: Arsenal FC")
    context = await coordinator.discover_entity(
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        entity_type="organization"
    )

    # Print results
    print("\n" + "="*60)
    print("Discovery Results")
    print("="*60)
    print(f"Primary Domain: {context.primary_domain}")
    print(f"Subdomains: {context.subdomains}")
    print(f"Scraped URLs: {len(context.scraped_urls)}")
    print(f"Raw Signals: {len(context.raw_signals)}")
    print(f"Scored Signals: {len(context.scored_signals)}")
    print(f"Final Confidence: {context.current_confidence:.3f}")
    print(f"Confidence Band: {context.confidence_metrics.get('band', 'UNKNOWN')}")
    print(f"Iterations: {context.iterations}")
    print(f"Actionable Gate: {context.confidence_metrics.get('actionable_gate', False)}")

    # Validate results
    assert context.entity_name == "Arsenal FC"
    assert context.current_confidence >= 0.50
    assert context.iterations <= 2

    print("\n✅ All assertions passed!")

    # Return for inspection
    return context

if __name__ == "__main__":
    context = asyncio.run(test_full_discovery())

    # Optional: Inspect full results
    print("\n" + "="*60)
    print("Full Context (JSON)")
    print("="*60)
    print(json.dumps(context.to_dict(), indent=2))
```

Run test:
```bash
cd backend
python test_multi_agent_system.py
```

**Expected Output**:
```
==============================================================
Testing Multi-Agent System
==============================================================

🚀 Starting discovery for: Arsenal FC

============================================================
Iteration 1/2: Arsenal FC
Current confidence: 0.500
============================================================

🔍 Phase 1: Search - Discovering domains...
✅ Search complete: arsenal.com

📄 Phase 2: Scrape - Extracting profile...
✅ Scrape complete: 1 pages, 2 signals

📊 Phase 3: Analysis - Scoring signals...
✅ Analysis complete: 0.560 (INFORMED)

============================================================
Discovery Results
============================================================
Primary Domain: arsenal.com
Subdomains: ['careers.arsenal.com', ...]
Scraped URLs: 1
Raw Signals: 2
Scored Signals: 2
Final Confidence: 0.560
Confidence Band: INFORMED
Iterations: 1
Actionable Gate: False

✅ All assertions passed!
```

### Test 4: Backward Compatibility

Create test file `backend/test_legacy_adapter.py`:

```python
"""Test legacy adapter for backward compatibility"""
import asyncio
import json
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

async def test_legacy_adapter():
    """Test that legacy adapter works"""
    print("="*60)
    print("Testing Legacy Adapter (Backward Compatibility)")
    print("="*60)

    # Create adapter
    adapter = DigitalDiscoveryAgentAdapter(
        max_iterations=2,
        target_confidence=0.70
    )

    # Discover entity (using legacy API)
    print("\n🔄 Discovering via legacy adapter...")
    result = await adapter.discover_entity(
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        entity_type="organization"
    )

    # Check legacy format
    print("\n" + "="*60)
    print("Legacy Format Check")
    print("="*60)

    required_keys = [
        "entity_id",
        "entity_name",
        "entity_type",
        "primary_domain",
        "confidence",
        "confidence_band",
        "actionable_gate",
        "iterations",
        "discovery_method"
    ]

    for key in required_keys:
        assert key in result, f"Missing key: {key}"
        print(f"✅ {key}: {result[key]}")

    # Validate specific fields
    assert result["discovery_method"] == "multi_agent", "Should use multi-agent"
    assert result["confidence"] >= 0.50, "Confidence should be >= 0.50"
    assert result["entity_id"] == "arsenal-fc", "Entity ID should match"

    print("\n✅ All legacy format checks passed!")

    return result

if __name__ == "__main__":
    result = asyncio.run(test_legacy_adapter())

    # Optional: Inspect full result
    print("\n" + "="*60)
    print("Full Result (JSON)")
    print("="*60)
    print(json.dumps(result, indent=2))
```

Run test:
```bash
cd backend
python test_legacy_adapter.py
```

**Expected Output**:
```
==============================================================
Testing Legacy Adapter (Backward Compatibility)
==============================================================

🔄 Discovering via legacy adapter...

============================================================
Legacy Format Check
============================================================
✅ entity_id: arsenal-fc
✅ entity_name: Arsenal FC
✅ entity_type: organization
✅ primary_domain: arsenal.com
✅ confidence: 0.560
✅ confidence_band: INFORMED
✅ actionable_gate: False
✅ iterations: 1
✅ discovery_method: multi_agent

✅ All legacy format checks passed!
```

---

## Performance Benchmarks (10 minutes)

### Test 5: Benchmark vs. Old System

Create test file `backend/test_benchmark.py`:

```python
"""Benchmark multi-agent system vs. old system"""
import asyncio
import time
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

async def benchmark():
    """Compare performance"""
    print("="*60)
    print("Performance Benchmark")
    print("="*60)

    # Test entities
    entities = [
        ("Arsenal FC", "arsenal-fc"),
        ("Chelsea FC", "chelsea-fc"),
        ("Liverpool FC", "liverpool-fc")
    ]

    results = []

    for entity_name, entity_id in entities:
        print(f"\n🚀 Testing: {entity_name}")

        # New system (multi-agent)
        adapter = DigitalDiscoveryAgentAdapter(max_iterations=2)
        start = time.time()
        result = await adapter.discover_entity(entity_name, entity_id)
        duration = time.time() - start

        results.append({
            "entity": entity_name,
            "confidence": result["confidence"],
            "duration": duration,
            "iterations": result["iterations"],
            "signals": result["signal_count"]
        })

        print(f"   Confidence: {result['confidence']:.3f}")
        print(f"   Duration: {duration:.2f}s")
        print(f"   Iterations: {result['iterations']}")
        print(f"   Signals: {result['signal_count']}")

    # Summary
    print("\n" + "="*60)
    print("Benchmark Summary")
    print("="*60)

    avg_confidence = sum(r["confidence"] for r in results) / len(results)
    avg_duration = sum(r["duration"] for r in results) / len(results)
    avg_signals = sum(r["signals"] for r in results) / len(results)

    print(f"Average Confidence: {avg_confidence:.3f}")
    print(f"Average Duration: {avg_duration:.2f}s")
    print(f"Average Signals: {avg_signals:.1f}")

    print("\n✅ Benchmark complete!")

if __name__ == "__main__":
    asyncio.run(benchmark())
```

Run benchmark:
```bash
cd backend
python test_benchmark.py
```

---

## Integration with Existing Code (5 minutes)

### Test 6: Update Digital Discovery Agent

Create test file `backend/test_integration.py`:

```python
"""Test integration with existing digital_discovery_agent.py"""
import asyncio
import sys
sys.path.insert(0, '/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app/backend')

from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

async def test_integration():
    """Test that adapter can replace existing agent"""
    print("="*60)
    print("Integration Test")
    print("="*60)

    # Create adapter (drop-in replacement)
    agent = DigitalDiscoveryAgentAdapter(max_iterations=2)

    # Use like existing DigitalDiscoveryAgent
    result = await agent.discover_entity(
        entity_name="Arsenal FC",
        entity_id="arsenal-fc"
    )

    # Verify expected keys
    expected_keys = [
        "entity_id", "entity_name", "primary_domain",
        "confidence", "confidence_band", "scored_signals"
    ]

    for key in expected_keys:
        assert key in result, f"Missing key: {key}"

    print(f"✅ Integration test passed!")
    print(f"   Confidence: {result['confidence']:.3f}")
    print(f"   Band: {result['confidence_band']}")
    print(f"   Signals: {len(result['scored_signals'])}")

if __name__ == "__main__":
    asyncio.run(test_integration())
```

Run integration test:
```bash
cd backend
python test_integration.py
```

---

## Troubleshooting

### Issue: ModuleNotFoundError

**Error**:
```
ModuleNotFoundError: No module named 'backend.agent_tools'
```

**Solution**:
```bash
# Ensure you're running from the correct directory
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app

# Or add to PYTHONPATH
export PYTHONPATH="/Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app:$PYTHONPATH"
```

### Issue: Claude Agent SDK not installed

**Error**:
```
ImportError: cannot import name 'create_sdk_mcp_server' from 'claude_agent_sdk'
```

**Solution**:
```bash
# Install SDK (or use fallback mode)
pip install claude-agent-sdk

# If package doesn't exist yet, system will fall back to Anthropic SDK
```

### Issue: BrightData API errors

**Error**:
```
⚠️ BRIGHTDATA_API_TOKEN not found in environment
```

**Solution**:
```bash
# Add to backend/.env
echo "BRIGHTDATA_API_TOKEN=your_token_here" >> backend/.env
```

---

## Success Criteria

✅ All 6 tests pass without errors
✅ Multi-agent system discovers entities successfully
✅ Backward compatibility maintained
✅ Performance is acceptable (< 30s per entity)
✅ Confidence scores are reasonable (0.50 - 0.80 range)

---

## Next Steps After Testing

### If Tests Pass:
1. ✅ Integrate into production code
2. ✅ Update `digital_discovery_agent.py` to use adapter
3. ✅ Monitor performance in production
4. ✅ Measure cost savings vs. old system

### If Tests Fail:
1. 📝 Check error logs above
2. 📝 Verify environment variables
3. 📝 Test individual components (search, scrape, analysis)
4. 📝 Report issues with full error messages

---

## Summary

✅ **Implementation**: Complete
✅ **Testing**: Ready to begin
✅ **Integration**: Drop-in replacement via adapter
✅ **Backward Compatibility**: Maintained
⏳ **Production**: Pending test results

**Estimated Time to Full Integration**: 1-2 hours (including testing)

---

**Questions?** Refer to `MULTI-AGENT-IMPLEMENTATION-COMPLETE.md` for detailed documentation.
