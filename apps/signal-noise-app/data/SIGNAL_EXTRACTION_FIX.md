# Signal Extraction Fix - Implementation Summary

**Date**: 2026-02-03
**Status**: ✅ IMPLEMENTED
**Issue**: System made WEAK_ACCEPT decisions but reported 0 signals

---

## Problem

The system was making correct detection decisions (WEAK_ACCEPT, ACCEPT) but never extracted those decisions into signal objects for reporting.

**Evidence**:
- Liverpool FC: 1 WEAK_ACCEPT decision, but `signals_discovered = []`
- Bayern Munich: 2 WEAK_ACCEPT decisions, but `signals_discovered = []`
- PSG: 0 WEAK_ACCEPT decisions, `signals_discovered = []`

**Root Cause**: Line 906 TODO comment: `signals_discovered=[],  # TODO: Extract signals from iterations`

---

## Solution Implemented

### 1. Added `iteration_results` field to RalphState

**File**: `backend/schemas.py`

**Change**: Added field to track iteration results during discovery

```python
# Iteration results tracking (for signal extraction)
iteration_results: List[Dict[str, Any]] = field(default_factory=list)
```

**Location**: After `last_failed_hop` field (line 622)

---

### 2. Store iteration results during discovery loop

**File**: `backend/hypothesis_driven_discovery.py`

**Change**: Added code to store each iteration's result

```python
# Track iteration result for signal extraction
iteration_record = {
    'iteration': iteration,
    'hypothesis_id': top_hypothesis.hypothesis_id,
    'hop_type': hop_type.value if hasattr(hop_type, 'value') else str(hop_type),
    'depth': state.current_depth,
    'timestamp': datetime.now(timezone.utc).isoformat(),
    'result': result
}
state.iteration_results.append(iteration_record)
```

**Location**: In `run_discovery` method, after `_update_hypothesis_state` (line 340-350)

---

### 3. Extract signals from iteration results

**File**: `backend/hypothesis_driven_discovery.py`

**Change**: Added `_extract_signals_from_iterations` method

**Logic**:
1. Loop through all iteration results
2. Filter for ACCEPT and WEAK_ACCEPT decisions only
3. Build signal objects with full metadata:
   - entity_id, entity_name, hypothesis_id
   - signal_type, confidence_delta
   - evidence_type, evidence_found, justification
   - source_url, hop_type, depth, iteration, timestamp
   - mcp_matches, mcp_confidence (if available)

**Location**: Before `_build_final_result` method (line 893-945)

---

### 4. Updated `_build_final_result` to use extracted signals

**File**: `backend/hypothesis_driven_discovery.py`

**Change**:
```python
# Before:
signals_discovered=[],  # TODO: Extract signals from iterations

# After:
signals_discovered = self._extract_signals_from_iterations(state)
...
signals_discovered=signals_discovered,  # FIXED: Now extracts from iterations
```

**Location**: In `_build_final_result` method (line 960-975)

---

## Signal Structure

Each extracted signal contains:

```python
{
    'entity_id': str,              # Entity identifier
    'entity_name': str,            # Entity display name
    'hypothesis_id': str,          # Hypothesis that detected signal
    'signal_type': str,            # 'ACCEPT' or 'WEAK_ACCEPT'
    'confidence_delta': float,     # Confidence impact (+0.02 or +0.08)
    'evidence_type': str | None,   # MCP evidence type (e.g., 'technology_leadership')
    'evidence_found': str,         # Actual text excerpt from content
    'justification': str,          # Claude's reasoning
    'source_url': str,             # URL where content was scraped
    'hop_type': str,               # Type of hop (official_site, press_release, etc.)
    'depth': int,                  # Discovery depth level (1, 2, 3)
    'iteration': int,              # Iteration number when detected
    'timestamp': str,              # ISO format timestamp
    'mcp_matches': List[Dict],     # Optional: MCP pattern matches
    'mcp_confidence': float        # Optional: MCP-calculated confidence
}
```

---

## Expected Results

### Before Fix

```json
{
  "entity_id": "liverpool-fc",
  "signals_count": 0,
  "signals_discovered": [],
  "iterations_weak_accept": 1
}
```

**Issue**: Shows 1 WEAK_ACCEPT decision but 0 signals

### After Fix

```json
{
  "entity_id": "liverpool-fc",
  "signals_count": 1,
  "signals_discovered": [
    {
      "signal_type": "WEAK_ACCEPT",
      "confidence_delta": 0.02,
      "evidence_type": "technology_leadership",
      "evidence_found": "Found technology leadership role",
      "hop_type": "press_release",
      "iteration": 2
    }
  ],
  "iterations_weak_accept": 1
}
```

**Fixed**: Signal object matches decision count

---

## Validation Plan

### Step 1: Run validation with fix

```bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
python scripts/run_real_discovery_comparison.py
```

### Step 2: Check results

**Expected**:
- Liverpool FC: 1 signal (WEAK_ACCEPT from press release)
- Bayern Munich: 2 signals (WEAK_ACCEPT from careers pages)
- PSG: 0 signals (all NO_PROGRESS)
- **Total: 3 signals** (vs 0 before)

### Step 3: Verify signal metadata

For each signal, verify:
- ✅ `signal_type` is ACCEPT or WEAK_ACCEPT
- ✅ `confidence_delta` matches decision (+0.02 or +0.08)
- ✅ `evidence_type` is populated (if MCP detected)
- ✅ `evidence_found` contains actual text
- ✅ `justification` explains Claude's reasoning
- ✅ `source_url` is valid
- ✅ `hop_type` matches iteration log
- ✅ `iteration` number is correct
- ✅ `timestamp` is present

---

## Impact on Confidence

**No change to confidence calculations** - confidence is already calculated correctly from decisions.

**Before fix**:
- Liverpool: 0.50 (1 WEAK_ACCEPT × 0.02 = +0.02)
- Bayern: 0.52 (2 WEAK_ACCEPT × 0.02 = +0.04)
- PSG: 0.50 (0 WEAK_ACCEPT)
- **Average: 0.51**

**After fix**:
- Liverpool: 0.50 (unchanged)
- Bayern: 0.52 (unchanged)
- PSG: 0.50 (unchanged)
- **Average: 0.51** (unchanged)

**Change**: Reporting accuracy only. Confidence was always calculated correctly.

---

## Files Modified

1. **`backend/schemas.py`** (+3 lines)
   - Added `iteration_results` field to RalphState

2. **`backend/hypothesis_driven_discovery.py`** (+50 lines)
   - Added iteration result tracking in discovery loop
   - Added `_extract_signals_from_iterations` method
   - Updated `_build_final_result` to call extraction method

---

## Next Steps

### Immediate (This Session)
1. ✅ Implement signal extraction (COMPLETE)
2. ⏳ Run validation to confirm signals are extracted
3. ⏳ Verify signal metadata completeness
4. ⏳ Document results

### Short-term (Next Session)
5. Consider confidence delta tuning if still below 0.70 target
6. Consider increasing max depth for more exploration opportunities

---

## Success Criteria

✅ **Fix is successful when**:
- `signals_discovered` array contains signal objects
- `signals_count` matches `iterations_accepted + iterations_weak_accept`
- Each signal has complete metadata (evidence_type, justification, etc.)
- Validation runs without errors

---

## Technical Notes

### Why Confidence Didn't Change

Confidence is tracked in Hypothesis objects:
```python
hypothesis.iterations_weak_accept += 1
hypothesis.confidence += 0.02
```

This happens in `_update_hypothesis_state` (line 775-805) and is independent of signal extraction.

Signal extraction is purely for **reporting** - it exposes what decisions were made and what evidence was found.

### Why Pattern Sensitivity is Not the Issue

Pattern matching was working correctly:
- MCP patterns detected evidence types ✅
- Claude received MCP insights ✅
- Claude made correct decisions (WEAK_ACCEPT) ✅
- Confidence updated correctly ✅

The only missing piece: **Extract decisions into signal objects** (now fixed).

---

## Conclusion

The signal extraction fix is now implemented. The system will now correctly report the signals it detects.

**Expected outcome**: 3 signals detected (Liverpool: 1, Bayern: 2, PSG: 0) vs 0 before.

**Confidence impact**: None (confidence already calculated correctly).

**Next validation run** will confirm the fix works as expected.
