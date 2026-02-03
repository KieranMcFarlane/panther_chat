# System Improvements Implementation Plan

**Date**: 2026-02-03
**Status**: Ready for Implementation
**Estimated Time**: 2.5 hours

---

## Executive Summary

Three high-impact improvements to the hypothesis-driven discovery system identified from validation analysis:

1. **Increase Max Depth** (HIGH) - Allow deeper exploration (3→7 iterations)
2. **Fix FalkorDB Persistence** (MEDIUM) - Eliminate NoneType errors
3. **Add Search Fallbacks** (LOW) - Graceful handling of search failures

---

## Current State Analysis

### What's Working ✅
- Signal extraction: 2 signals extracted correctly (Bayern Munich)
- Hop loop prevention: PSG tried LINKEDIN_JOB twice then skipped
- Channel blacklist: Automatic reset working correctly
- Saturation logic: 5 NO_PROGRESS in 7 iterations detected

### What Needs Improvement ⚠️

**Issue 1: Max Depth Too Restrictive**
- Liverpool: Stopped at iteration 2 (max depth 3 reached)
- Bayern: Stopped at iteration 4 (max depth 3 reached)
- PSG: Stopped at iteration 9 (never hit depth limit but saturated)

**Issue 2: FalkorDB Persistence Errors**
```
❌ Failed to save hypothesis: 'NoneType' object has no attribute 'query'
```
- Appears 44+ times per entity
- Not blocking discovery but pollutes logs
- `self.graph` is None when `save_hypothesis()` is called

**Issue 3: Search Failures**
- PSG: "search returned 0 results" multiple times
- Causes early iteration termination
- No fallback query mechanism

---

## Improvement 1: Increase Max Depth

**Priority**: HIGH
**Impact**: High - more exploration opportunities
**Risk**: Low - simple parameter change
**Time**: 30 minutes

### Implementation

**File**: `backend/hypothesis_driven_discovery.py`
**Line**: 216

**Current**:
```python
self.max_depth = 3
```

**Change to**:
```python
self.max_depth = 7  # Allow more exploration before stopping (increased from 3)
```

### Rationale
- PSG reached 9 iterations without hitting depth limit (was saturated)
- Liverpool and Bayern hit depth limit at 2 and 4 iterations
- More depth = more chances to find ACCEPT signals
- 7 iterations is still reasonable (vs unlimited)

### Success Criteria
- ✅ Entities can explore up to 7 iterations deep
- ✅ Liverpool/Bayern no longer hit depth 3 limit
- ✅ Cost increase minimal (~$0.01-0.02 per entity)

### Testing
```bash
# Run validation on same 3 entities
python scripts/run_real_discovery_comparison.py

# Check that entities can now go deeper
grep "max depth" data/real_discovery_report_*.txt
```

---

## Improvement 2: Fix FalkorDB Persistence

**Priority**: MEDIUM
**Impact**: Medium - clean up logs, enable hypothesis history
**Risk**: Low - make persistence optional
**Time**: 1 hour

### Root Cause Analysis

**Error**: `'NoneType' object has no attribute 'query'`
**Location**: `backend/hypothesis_persistence_native.py:233`
**Cause**: `self.graph` is None when `save_hypothesis()` is called

**Current Flow**:
1. `HypothesisRepository.__init__()` stores connection params
2. `initialize()` should be called to create `self.graph`
3. If `initialize()` fails or is never called, `self.graph` remains None
4. `save_hypothesis()` tries to use `self.graph.query()` → crashes

### Implementation Strategy: Make Persistence Optional

**Approach**: Wrap all database operations in try/except and log warnings instead of failing.

**File 1**: `backend/hypothesis_persistence_native.py`

**Add connection check helper** (after line 131):
```python
def _is_connected(self) -> bool:
    """Check if database connection is active"""
    return self.graph is not None
```

**Modify `save_hypothesis()`** (line 190-240):
```python
async def save_hypothesis(self, hypothesis: 'Hypothesis') -> bool:
    """
    Save hypothesis to database

    Args:
        hypothesis: Hypothesis to save

    Returns:
        True if saved successfully, False otherwise (but doesn't raise)
    """
    try:
        # Check connection first
        if not self._is_connected():
            logger.warning(f"⚠️ FalkorDB not connected, skipping hypothesis save: {hypothesis.hypothesis_id}")
            return False

        # ... existing save logic ...

    except Exception as e:
        logger.error(f"❌ Failed to save hypothesis: {e}")
        return False
```

**Add similar checks to other methods**:
- `get_hypothesis()` - return None if not connected
- `update_hypothesis_status()` - log warning and return False
- `get_hypotheses_by_entity()` - return empty list if not connected
- All `save_*()` methods - log warning and return False

### Success Criteria
- ✅ No more "'NoneType' object has no attribute 'query'" errors
- ✅ Discovery continues even if persistence fails
- ✅ Clear warning messages when persistence is unavailable
- ✅ Logs are clean and informative

### Testing
```bash
# Test with FalkorDB disconnected
export FALKORDB_URI="invalid"
python backend/hypothesis_driven_discovery.py

# Should see warnings, not errors
# Discovery should continue successfully
```

---

## Improvement 3: Add Search Fallbacks

**Priority**: LOW
**Impact**: Low - handles edge cases better
**Risk**: Low - graceful degradation
**Time**: 1 hour

### Implementation

**File**: `backend/hypothesis_driven_discovery.py`

**Step 1: Add fallback query dictionary** (after imports, around line 50):
```python
# Fallback search queries when primary search fails
FALLBACK_QUERIES = {
    HopType.OFFICIAL_SITE: [
        '{entity} official site',
        '{entity} website',
        '{entity}.com'
    ],
    HopType.CAREERS_PAGE: [
        '{entity} careers jobs',
        '{entity} jobs',
        '{entity} work at',
        '{entity} career opportunities'
    ],
    HopType.ANNUAL_REPORT: [
        '{entity} annual report',
        '{entity} financial report',
        '{entity} 2024 report'
    ],
    HopType.PRESS_RELEASE: [
        '{entity} recent news press release',
        '{entity} press releases',
        '{entity} news'
    ],
    HopType.LINKEDIN_JOB: [
        '{entity} jobs careers site:linkedin.com',
        '{entity} careers',
        '{entity} open positions'
    ]
}
```

**Step 2: Add fallback helper method** (around line 580):
```python
def _get_fallback_queries(self, hop_type: HopType, entity_name: str) -> list[str]:
    """
    Get fallback search queries for a hop type

    Args:
        hop_type: Type of hop to execute
        entity_name: Name of entity to search for

    Returns:
        List of fallback query strings
    """
    queries = FALLBACK_QUERIES.get(hop_type, [])
    return [q.format(entity=entity_name) for q in queries]
```

**Step 3: Modify `_get_url_for_hop()`** (around line 580-648):
```python
async def _get_url_for_hop(
    self,
    hop_type: HopType,
    hypothesis,
    state: 'RalphState'
) -> Optional[str]:

    # Get entity name from hypothesis
    entity_name = hypothesis.entity_id

    # Primary search query
    primary_query = self._get_search_query(hop_type, entity_name)
    logger.debug(f"Primary search query: {primary_query}")

    search_result = await self.brightdata_client.search_engine(
        query=primary_query,
        engine='google',
        num_results=1
    )

    # Check if primary search succeeded
    if search_result.get('status') == 'success' and search_result.get('results'):
        url = search_result['results'][0].get('url')
        if url:
            logger.info(f"✓ Primary search found URL: {url}")
            return url

    # Primary search failed, try fallback queries
    logger.warning(f"⚠️ Primary search failed for {hop_type}, trying fallbacks")

    fallback_queries = self._get_fallback_queries(hop_type, entity_name)

    for i, fallback_query in enumerate(fallback_queries, 1):
        logger.debug(f"Fallback {i}/{len(fallback_queries)}: {fallback_query}")

        search_result = await self.brightdata_client.search_engine(
            query=fallback_query,
            engine='google',
            num_results=1
        )

        if search_result.get('status') == 'success' and search_result.get('results'):
            url = search_result['results'][0].get('url')
            if url:
                logger.info(f"✓ Fallback {i} found URL: {url}")
                return url

    # All searches failed
    logger.error(f"❌ All search queries failed for {hop_type}")
    return None
```

### Success Criteria
- ✅ Primary search failures don't block discovery
- ✅ Fallback queries provide alternative results
- ✅ Success rate improves for difficult entities (PSG)
- ✅ No increase in false positives

### Testing
```bash
# Test with PSG (has search failures in logs)
python -c "
from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
# Run discovery for PSG
# Check logs for fallback attempts
"

# Should see:
# "Primary search failed for PRESS_RELEASE, trying fallbacks"
# "Fallback 1 found URL: ..."
```

---

## Implementation Order

### Phase 1: Quick Win (Improvement 1) - 30 min

1. Change `max_depth` from 3 to 7 in `hypothesis_driven_discovery.py:216`
2. Add comment explaining rationale
3. Run validation to confirm

### Phase 2: Investigation (Improvement 2) - 1 hour

1. Add `_is_connected()` helper to `hypothesis_persistence_native.py`
2. Wrap all database operations with connection checks
3. Test with disconnected FalkorDB
4. Validate that warnings appear instead of errors

### Phase 3: Enhancement (Improvement 3) - 1 hour

1. Add `FALLBACK_QUERIES` dictionary
2. Add `_get_fallback_queries()` helper
3. Modify `_get_url_for_hop()` to use fallbacks
4. Test with PSG entity

---

## Risk Mitigation

### Risk 1: Increased Depth Increases Cost
**Mitigation**: Max depth 7 is still reasonable. Most entities stop at 3-5 iterations due to saturation, not depth limit.

### Risk 2: FalkorDB Fix Breaks Something
**Mitigation**: Make persistence optional. If connection fails, log warning and continue discovery without persistence.

### Risk 3: Fallback Queries Increase False Positives
**Mitigation**: Fallback queries are more generic. Only use when primary search fails. Still require Claude evaluation.

---

## Rollback Plan

If any improvement causes issues:

**Improvement 1 (Max Depth)**: Revert line 216 to `self.max_depth = 3`
**Improvement 2 (FalkorDB)**: Remove connection checks, keep existing code
**Improvement 3 (Fallbacks)**: Remove fallback logic, keep primary search only

All changes are isolated and can be independently reverted.

---

## Files Modified

### Improvement 1
- `backend/hypothesis_driven_discovery.py` (1 line change at line 216)

### Improvement 2
- `backend/hypothesis_persistence_native.py` (add connection checks)
  - Add `_is_connected()` method
  - Modify `save_hypothesis()` with connection check
  - Modify `get_hypothesis()` with connection check
  - Modify `update_hypothesis_status()` with connection check
  - Modify `get_hypotheses_by_entity()` with connection check

### Improvement 3
- `backend/hypothesis_driven_discovery.py` (add fallback logic)
  - Add `FALLBACK_QUERIES` dictionary (around line 50)
  - Add `_get_fallback_queries()` helper (around line 580)
  - Modify `_get_url_for_hop()` to use fallbacks (around line 580-648)

---

## Testing Strategy

### Unit Tests

**Test 1: Max Depth**
```python
def test_max_depth_increase():
    discovery = HypothesisDrivenDiscovery()
    assert discovery.max_depth == 7
```

**Test 2: FalkorDB Persistence**
```python
def test_hypothesis_persistence_optional():
    repo = HypothesisRepository(uri="invalid")
    # Should not crash, should return False/None
    result = await repo.save_hypothesis(h)
    assert result is False
```

**Test 3: Search Fallbacks**
```python
async def test_search_fallbacks():
    # Given: Primary search returns 0 results
    # When: Fallback queries available
    # Then: Try alternative queries
    # And: Return URL if any query succeeds
```

### Integration Validation

**Run validation on same 3 entities**:
```bash
python scripts/run_real_discovery_comparison.py
```

**Expected improvements**:
- More iterations before stopping
- Fewer persistence errors in logs
- Better search success rate

---

## Next Steps

### Immediate Actions
1. ✅ Review and approve plan
2. ⏳ Implement Improvement 1 (max depth)
3. ⏳ Implement Improvement 2 (FalkorDB persistence)
4. ⏳ Implement Improvement 3 (search fallbacks)
5. ⏳ Run validation tests
6. ⏳ Document results

### Validation Checklist
- [ ] Liverpool FC can explore beyond depth 3
- [ ] Bayern Munich can explore beyond depth 3
- [ ] No NoneType errors in logs
- [ ] PSG uses fallback queries when primary fails
- [ ] Cost increase is minimal (<$0.05 per entity)

---

**Status**: Ready for implementation
**Last Updated**: 2026-02-03
