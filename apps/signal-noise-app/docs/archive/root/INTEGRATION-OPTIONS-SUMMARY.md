# Integration Options Summary - Choose Your Path

**3 ways to integrate the multi-agent system, ranked from easiest to most advanced.**

---

## 🥇 Option 1: Drop-in Replacement (Easiest - 5 minutes)

### What You Do
1. Add 1 line to `backend/.env`: `USE_MULTI_AGENT=true`
2. Add 8 lines to `backend/digital_discovery_agent.py`

### Code Change

**Add to top of `backend/digital_discovery_agent.py`:**
```python
import os
USE_MULTI_AGENT = os.getenv('USE_MULTI_AGENT', 'false').lower() == 'true'

if USE_MULTI_AGENT:
    from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter
    DigitalDiscoveryAgent = DigitalDiscoveryAgentAdapter
```

### Pros
- ✅ Zero breaking changes
- ✅ Can enable/disable via environment variable
- ✅ Instant rollback (set `USE_MULTI_AGENT=false`)
- ✅ All existing code works unchanged

### Cons
- ⚠️ Requires environment variable
- ⚠️ Indirection (adapter wrapping)

### When to Choose
- You want to test the system safely
- You need instant rollback capability
- You're risk-averse

---

## 🥈 Option 2: Import Updates (Recommended - 30 minutes)

### What You Do
Update imports in your files to use the new system

### Code Changes

**In any file that imports DigitalDiscoveryAgent:**

**BEFORE:**
```python
from backend.digital_discovery_agent import DigitalDiscoveryAgent
```

**AFTER:**
```python
from backend.agents.legacy_adapter import DigitalDiscoveryAgentAdapter as DigitalDiscoveryAgent
```

**In API endpoints or scripts:**

**BEFORE:**
```python
agent = DigitalDiscoveryAgent()
result = await agent.discover_entity(name, id)
```

**AFTER:**
```python
agent = DigitalDiscoveryAgentAdapter(max_iterations=5)
result = await agent.discover_entity(name, id)
# Same API, same return format!
```

### Pros
- ✅ Direct control over configuration
- ✅ No environment variable needed
- ✅ Clear migration path
- ✅ Better performance control

### Cons
- ⚠️ Requires updating imports in multiple files
- ⚠️ Need to test each file

### When to Choose
- You want to adopt the system permanently
- You're comfortable updating imports
- You want better configuration control

---

## 🥉 Option 3: Direct Multi-Agent (Advanced - 1 hour)

### What You Do
Use the multi-agent system directly for maximum control

### Code Changes

**Replace entire discovery workflow:**

**BEFORE:**
```python
from backend.digital_discovery_agent import DigitalDiscoveryAgent
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient

agent = DigitalDiscoveryAgent()
result = await agent.discover_entity(name, id)
```

**AFTER:**
```python
from backend.agents import MultiAgentCoordinator

coordinator = MultiAgentCoordinator(
    max_iterations=10,
    target_confidence=0.80,
    verbose=True  # Shows progress
)

context = await coordinator.discover_entity(name, id)

# Access detailed results
result = {
    "entity_id": context.entity_id,
    "confidence": context.current_confidence,
    "domain": context.primary_domain,
    "signals": context.scored_signals,
    "iterations": context.iterations
}
```

### Pros
- ✅ Maximum control over orchestration
- ✅ Access to detailed progress and context
- ✅ Can customize each phase (Search → Scrape → Analysis)
- ✅ Better performance tuning opportunities

### Cons
- ⚠️ Requires more code changes
- ⚠️ Different return format (need to adapt)
- ⚠️ More to learn and understand

### When to Choose
- You want full control over the discovery process
- You need access to intermediate results
- You're building custom orchestration
- You want to extend the system

---

## Quick Comparison

| Feature | Option 1 | Option 2 | Option 3 |
|---------|----------|----------|----------|
| **Time to Integrate** | 5 min | 30 min | 1 hour |
| **Code Changes** | 8 lines | Import updates | Rewrite workflows |
|**Breaking Changes** | None | Minimal | Moderate |
| **Rollback** | Instant (env var) | Revert imports | Revert code |
| **Control** | Low | Medium | High |
|**Performance** | Good | Better | Best |
|**Extensibility** | Low | Medium | High |

---

## Decision Tree

```
Do you want to test the system safely?
├─ YES → Option 1 (Drop-in with env var)
└─ NO
    └─ Do you want simple migration or full control?
        ├─ Simple → Option 2 (Update imports)
        └─ Full control → Option 3 (Direct use)
```

---

## My Recommendation

**Start with Option 1** for testing:
- Takes 5 minutes
- Zero risk
- Instant rollback

**Then migrate to Option 2** for production:
- Takes 30 minutes
- Clear migration path
- Better control

**Use Option 3** for custom needs:
- When you need special orchestration
- When building new features
- When optimizing performance

---

## Which Option Will You Choose?

Let me know and I'll provide the exact code changes for your specific files!

**Options:**
1. **Option 1** - Show me the env var + adapter code
2. **Option 2** - Show me which files to update
3. **Option 3** - Show me how to use multi-agent coordinator directly
4. **I'm not sure** - Help me decide based on my use case
