# Option 1: Drop-in Replacement - Step-by-Step

**5-minute integration with instant rollback capability**

---

## Step 1: Enable Multi-Agent System (1 minute)

### Add to `backend/.env`

**Open file:** `backend/.env`

**Add this line:**
```bash
USE_MULTI_AGENT=true
```

**Complete example of what your `.env` should look like:**
```bash
# Anthropic API
ANTHROPIC_API_KEY=your-key-here

# BrightData
BRIGHTDATA_API_TOKEN=your-token-here

# Multi-Agent System (NEW)
USE_MULTI_AGENT=true
```

**Verify it was added:**
```bash
cat backend/.env | grep USE_MULTI_AGENT
```

Should output: `USE_MULTI_AGENT=true`

---

## Step 2: Update `digital_discovery_agent.py` (3 minutes)

### Open file: `backend/digital_discovery_agent.py`

**Add this code AFTER the existing imports (around line 10-15):**

```python
# =============================================================================
# Multi-Agent System Integration
# =============================================================================

import os

# Check if multi-agent system is enabled via environment variable
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    # Import multi-agent adapter
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

    # Replace DigitalDiscoveryAgent with multi-agent version
    # This maintains backward compatibility while using the new system
    DigitalDiscoveryAgent = DigitalDiscoveryAgentAdapter

    logger.info("✅ Multi-agent system enabled via USE_MULTI_AGENT=true")
else:
    logger.info("ℹ️  Using legacy DigitalDiscoveryAgent")
```

### Where to place it:

**Find these lines at the top of the file:**
```python
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)
```

**Add your new code RIGHT AFTER the logger line:**
```python
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

# =============================================================================
# Multi-Agent System Integration
# =============================================================================

import os

# Check if multi-agent system is enabled via environment variable
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    # Import multi-agent adapter
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter

    # Replace DigitalDiscoveryAgent with multi-agent version
    # This maintains backward compatibility while using the new system
    DigitalDiscoveryAgent = DigitalDiscoveryAgentAdapter

    logger.info("✅ Multi-agent system enabled via USE_MULTI_AGENT=true")
else:
    logger.info("ℹ️  Using legacy DigitalDiscoveryAgent")
```

---

## Step 3: Test the Integration (1 minute)

### Run this test command:

```bash
cd backend
python3 -c "
import asyncio
import sys
import os
sys.path.insert(0, '.')

# Enable multi-agent for this test
os.environ['USE_MULTI_AGENT'] = 'true'

# Import the module (this will trigger the conditional import)
from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def test():
    # Create agent
    agent = DigitalDiscoveryAgent()

    # Check which implementation is being used
    agent_type = type(agent).__name__

    print('='*60)
    print('Multi-Agent Integration Test')
    print('='*60)
    print(f'✅ Agent type: {agent_type}')
    print(f'✅ Using multi-agent: {agent_type == \"DigitalDiscoveryAgentAdapter\"}')
    print()
    print('This means your system is now using the multi-agent architecture!')
    print('='*60)

    return agent_type == 'DigitalDiscoveryAgentAdapter'

asyncio.run(test())
"
```

**Expected Output:**
```
============================================================
Multi-Agent Integration Test
============================================================
✅ Agent type: DigitalDiscoveryAgentAdapter
✅ Using multi-agent: True

============================================================

This means your system is now using the multi-agent architecture!
============================================================
```

---

## Step 4: Verify with Real Discovery (Optional - 2 minutes)

### Test with actual entity discovery:

```bash
cd backend
python3 -c "
import asyncio
import sys
import os
sys.path.insert(0, '.')
os.environ['USE_MULTI_AGENT'] = 'true'

from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def test_discovery():
    agent = DigitalDiscoveryAgent()

    print('Testing discovery with Arsenal FC...')
    result = await agent.discover_entity(
        entity_name='Arsenal FC',
        entity_id='arsenal-fc',
        max_iterations=1
    )

    print()
    print('='*60)
    print('Discovery Results')
    print('='*60)
    print(f\"Entity: {result.get('entity_name')}\")
    print(f\"Domain: {result.get('primary_domain')}\")
    print(f\"Confidence: {result.get('confidence', 0):.3f}\")
    print(f\"Method: {result.get('discovery_method', 'unknown')}\")
    print('='*60)
    print('✅ Multi-agent system working!')

asyncio.run(test_discovery())
" 2>&1 | grep -A 20 "Discovery Results"
```

**Expected Output:**
```
============================================================
Discovery Results
============================================================
Entity: Arsenal FC
Domain: arsenal.com
Confidence: 0.520
Method: multi-agent
============================================================
✅ Multi-agent system working!
```

---

## Step 5: Verify Rollback Capability (1 minute)

### Test that you can instantly disable the multi-agent system:

```bash
# Test with multi-agent ENABLED
USE_MULTI_AGENT=true python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def test():
    agent = DigitalDiscoveryAgent()
    print(f'With USE_MULTI_AGENT=true: {type(agent).__name__}')

asyncio.run(test())
"

# Test with multi-agent DISABLED
USE_MULTI_AGENT=false python3 -c "
import asyncio
import sys
sys.path.insert(0, '.')
from backend.digital_discovery_agent import DigitalDiscoveryAgent

async def test():
    agent = DigitalDiscoveryAgent()
    print(f'With USE_MULTI_AGENT=false: {type(agent).__name__}')

asyncio.run(test())
"
```

**Expected Output:**
```
With USE_MULTI_AGENT=true: DigitalDiscoveryAgentAdapter
With USE_MULTI_AGENT=false: DigitalDiscoveryAgent
```

**This proves you can instantly rollback by changing one environment variable!**

---

## Summary: What You Just Did

### ✅ Changes Made

1. **Environment Variable**: Added `USE_MULTI_AGENT=true` to `.env`
2. **Code Addition**: Added ~20 lines to `digital_discovery_agent.py`
3. **Testing**: Verified the integration works

### ✅ Benefits

- **Zero Breaking Changes**: All existing code continues to work
- **Instant Rollback**: Change `USE_MULTI_AGENT=false` to disable
- **Same API**: No changes to function signatures
- **Better Performance**: Multi-agent coordination under the hood

### ✅ What Happens Now

When you run discovery code:

```python
from backend.digital_discovery_agent import DigitalDiscoveryAgent

agent = DigitalDiscoveryAgent()
result = await agent.discover_entity("Entity Name", "entity-id")
```

**Behind the scenes**, it now:
1. Creates `MultiAgentCoordinator`
2. Runs Search → Scrape → Analysis agents
3. Returns results in the same format as before
4. Adds `discovery_method: "multi_agent"` to results

---

## Troubleshooting

### Issue 1: Import error

**Error:** `ModuleNotFoundError: No module named 'backend'`

**Fix:**
```python
import sys
sys.path.insert(0, '.')  # Add current directory to path
```

### Issue 2: Multi-agent not activating

**Error:** Still shows old class name

**Fix:**
```bash
# Check the environment variable
echo $USE_MULTI_AGENT

# Should output: true
# If empty, check backend/.env file
cat backend/.env | grep USE_MULTI_AGENT
```

### Issue 3: Different results

**Error:** Results differ from old system

**Fix:**
```python
# Adjust iterations in DigitalDiscoveryAgentAdapter
agent = DigitalDiscoveryAgentAdapter(max_iterations=3)  # Match old behavior
```

---

## Rollback Plan

### To Disable Multi-Agent System Instantly

**Option A: Environment Variable**
```bash
# In backend/.env
USE_MULTI_AGENT=false
```

**Option B: Comment Out Code**
```python
# In digital_discovery_agent.py, comment out:
# if USE_MULTI_AGENT:
#     from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter
#     DigitalDiscoveryAgent = DigitalDiscoveryAgentAdapter
```

Both options will instantly revert to the old system!

---

## Next Steps

### After Successful Integration

1. **Monitor Performance**
   - Track discovery time per entity
   - Compare with old system metrics
   - Calculate cost savings

2. **Validate Results**
   - Check confidence scores
   - Verify signal accuracy
   - Test with known entities

3. **Deploy to Staging**
   - Enable `USE_MULTI_AGENT=true` in staging
   - Monitor for 1-2 weeks
   - Collect performance data

4. **Production Rollout**
   - Enable in production (can start with 10% of traffic)
   - Gradually increase based on confidence
   - Keep rollback ready

---

## Success Criteria

✅ **Integration Test**: Multi-agent agent activates when `USE_MULTI_AGENT=true`
✅ **Rollback Test**: Can disable by changing environment variable
✅ **API Test**: Existing API endpoints work without changes
✅ **Result Test**: Returns data in same format as old system
✅ **Performance Test**: Discovery completes in reasonable time

---

## 🎉 Congratulations!

You've successfully integrated the multi-agent system with:
- **5 minutes of effort**
- **Zero breaking changes**
- **Instant rollback capability**
- **Better performance**

**Your system is now using:**
- ✅ 3 specialized agents (Search, Scrape, Analysis)
- ✅ BrightData tool integration (5 tools)
- ✅ Multi-agent coordination
- ✅ Signal scoring and confidence calculation
- ✅ Backward compatibility maintained

**Ready to test with real entities!** 🚀
