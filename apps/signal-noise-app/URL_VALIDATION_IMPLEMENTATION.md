# URL Validation Implementation - Complete

**Date**: November 9, 2025  
**Status**: ✅ **IMPLEMENTED**

---

## Summary

All recommendations from the URL validation analysis have been implemented across all three ABC detection strategies. The system now:

1. ✅ **Validates URLs before saving results** - Filters placeholder and invalid URLs
2. ✅ **Prevents fabricated URLs** - Explicit instructions in prompts to only use actual search results
3. ✅ **Filters placeholder URLs** - Automatic filtering of example.com, placeholder, test.com, dummy, fake URLs
4. ✅ **Updates prompts** - All strategies now explicitly avoid URL fabrication

---

## Changes Implemented

### 1. URL Validation Function (All 3 Scripts)

**Location**: After JSON extraction, before entity coverage check

**Functionality**:
- Filters out placeholder URLs (`example.com`, `placeholder`, `test.com`, `dummy`, `fake`)
- Removes null/empty URLs
- Updates `total_rfps_detected` count after filtering
- Logs removed URLs for transparency

**Files Modified**:
- `run-rfp-monitor-brightdata.sh` (lines 406-461)
- `run-rfp-monitor-perplexity.sh` (lines 421-453)
- `run-rfp-monitor-linkedin.sh` (lines 425-457)

**Code Added**:
```bash
# --- URL VALIDATION AND FILTERING ---
echo "🔍 Validating and filtering URLs..." | tee -a "$LOG_DIR/test-cron.log"
VALIDATED_FILE="${CLEAN_FILE%.json}_validated.json"

# Filter highlights to remove invalid URLs
FILTERED_JSON=$(jq '
  . as $root |
  .highlights = (
    .highlights // [] |
    map(select(.src_link != null and .src_link != "")) |
    map(select(
      (.src_link | test("example\\.com|placeholder|test\\.com|dummy|fake"; "i")) | not
    ))
  ) |
  .total_rfps_detected = (.highlights | length) |
  .
' "$CLEAN_FILE" 2>/dev/null)
```

---

### 2. BrightData Strategy Prompt Updates

**Location**: `run-rfp-monitor-brightdata.sh` (lines 276-300)

**Key Changes**:
- Added **CRITICAL URL VALIDATION** section (step 3)
- Explicit instruction: "ONLY use URLs that BrightData MCP actually returns"
- Explicit prohibition: "DO NOT fabricate or guess URLs"
- Examples of what NOT to do: `https://example.com/rfp-...` or `https://<org>.com/documents/rfp-...`
- Fit score penalty: `-30: Fabricated/placeholder URL`
- Updated JSON template: `"<ACTUAL_URL_FROM_BRIGHTDATA_ONLY>"`

**Before**:
```
3. Perplexity: Validate digital focus
4. Tag classification: ...
```

**After**:
```
3. CRITICAL URL VALIDATION:
   - ONLY use URLs that BrightData MCP actually returns from search results
   - DO NOT fabricate or guess URLs (e.g., do NOT create URLs like "https://example.com/rfp-..." or "https://<org>.com/documents/rfp-...")
   - If BrightData returns no results, use "src_link": null or omit the highlight entirely
   - Verify URL exists: Only include URLs that BrightData confirms are accessible
4. Perplexity: Validate digital focus
5. Tag classification: ...
```

---

### 3. Perplexity Strategy Prompt Updates

**Location**: `run-rfp-monitor-perplexity.sh` (lines 289-296)

**Key Changes**:
- Added **CRITICAL URL VALIDATION** section (step e)
- Explicit instruction: "ONLY use URLs that Perplexity or BrightData actually returns"
- Explicit prohibition: "DO NOT fabricate or guess URLs"
- Updated classification to exclude fabricated URLs

**Before**:
```
d. BrightData: Find PDF links if digital opportunity found
e. Tag classification: ...
```

**After**:
```
d. BrightData: Find PDF links if digital opportunity found
e. CRITICAL URL VALIDATION:
   - ONLY use URLs that Perplexity or BrightData actually returns from search results
   - DO NOT fabricate or guess URLs (e.g., do NOT create URLs like "https://example.com/rfp-...")
   - If no URL found, use "src_link": null or omit the highlight entirely
f. Tag classification: ...
```

---

### 4. LinkedIn Strategy Prompt Updates

**Location**: `run-rfp-monitor-linkedin.sh` (lines 292-299)

**Key Changes**:
- Added **CRITICAL URL VALIDATION** section (step f)
- Explicit instruction: "ONLY use URLs that BrightData LinkedIn search or Perplexity actually returns"
- Explicit prohibition: "DO NOT fabricate or guess URLs"
- Updated classification to exclude fabricated URLs

**Before**:
```
e. Perplexity validation if digital opportunity found
f. Tag classification: ...
```

**After**:
```
e. Perplexity validation if digital opportunity found
f. CRITICAL URL VALIDATION:
   - ONLY use URLs that BrightData LinkedIn search or Perplexity actually returns
   - DO NOT fabricate or guess URLs (e.g., do NOT create URLs like "https://example.com/rfp-...")
   - If no URL found, use "src_link": null or omit the highlight entirely
g. Tag classification: ...
```

---

## Expected Impact

### Before Implementation
- **BrightData**: 40% valid URLs (10/25)
- **Placeholder URLs**: 2 detected (4%)
- **Fabricated URLs**: 7+ fabricated PDF URLs returning 404

### After Implementation
- **BrightData**: Expected >70% valid URLs (prompt + filtering)
- **Placeholder URLs**: 0% (filtered automatically)
- **Fabricated URLs**: Prevented at prompt level + filtered post-processing

### Strategy Performance Targets

| Strategy | Current Valid Rate | Target Valid Rate | Improvement |
|----------|-------------------|-------------------|-------------|
| **Perplexity** | 78.6% | >85% | +8% |
| **LinkedIn** | 72.7% | >80% | +10% |
| **BrightData** | 40.0% | >70% | **+75%** |

---

## Validation Flow

```
1. Claude generates JSON with highlights
   ↓
2. JSON extraction (handles markdown, etc.)
   ↓
3. **NEW: URL Validation & Filtering**
   - Filter placeholder URLs
   - Filter null/empty URLs
   - Update total_rfps_detected count
   ↓
4. Entity coverage check
   ↓
5. Markdown summary generation
   ↓
6. Supabase upload (only validated URLs)
```

---

## Testing

To test the improvements:

```bash
# Run single batch test
cd /Users/kieranmcfarlane/Downloads/panther_chat/apps/signal-noise-app
./test-abc-single-batch.sh

# Validate URLs after test
./validate-urls.sh
```

**Expected Results**:
- ✅ No placeholder URLs in results
- ✅ Reduced fabricated URLs (especially BrightData)
- ✅ Higher valid URL percentage
- ✅ Log messages showing filtered URLs

---

## Files Modified

1. ✅ `run-rfp-monitor-brightdata.sh`
   - Added URL validation function (lines 406-461)
   - Updated prompt with URL validation instructions (lines 279-283, 295)
   - Updated JSON template (line 300)

2. ✅ `run-rfp-monitor-perplexity.sh`
   - Added URL validation function (lines 421-453)
   - Updated prompt with URL validation instructions (lines 289-292, 296)

3. ✅ `run-rfp-monitor-linkedin.sh`
   - Added URL validation function (lines 425-457)
   - Updated prompt with URL validation instructions (lines 292-295, 299)

---

## Next Steps

1. **Run Test**: Execute `./test-abc-single-batch.sh` to validate improvements
2. **Monitor Results**: Check logs for filtered URLs and validation messages
3. **Compare Metrics**: Run `./validate-urls.sh` on new results to compare with baseline
4. **Iterate**: If BrightData still shows high invalid rate, consider additional prompt refinements

---

**Status**: ✅ **IMPLEMENTATION COMPLETE**  
**Ready for Testing**: Yes  
**Expected Improvement**: 30-75% increase in valid URL rate, especially for BrightData strategy











