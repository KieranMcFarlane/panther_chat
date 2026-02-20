# Evidence Verification Integration Guide

## Problem: Current System Doesn't Verify Evidence

### Current Behavior (Pass 2 - Claude Validation)

```python
# CURRENT: Blind trust in scraper metadata
evidence_text = "LinkedIn (credibility: 0.85)"
# Claude validates: "0.85 credibility seems reasonable"
# Result: Confidence stays at 0.85
```

**Issues**:
- ❌ Doesn't check if URLs exist
- ❌ Doesn't verify content is real
- ❌ Doesn't validate source credibility
- ❌ Trusts scraper's claimed credibility score blindly

**Example of what gets through**:
```json
{
  "source": "LinkedIn",
  "credibility_score": 0.85,
  "url": "https://linkedin.com/jobs/view/123456789",  // FAKE!
  "text": "Arsenal FC seeking..."
}
```

### Enhanced Behavior (With Evidence Verification)

```python
# ENHANCED: Verify evidence before Claude validation
verified = await verifier.verify_evidence(evidence)

if verified['url_accessible']:
    evidence_text = f"LinkedIn (verified: 0.85)"
else:
    evidence_text = f"LinkedIn (UNVERIFIED: claimed 0.85, actual: 0.55)"

# Claude validates: "URL not accessible, credibility questionable"
# Result: Confidence adjusted downward
```

**Benefits**:
- ✅ Checks URL accessibility
- ✅ Verifies source credibility
- ✅ Penalizes fake/broken URLs
- ✅ Provides actual vs claimed credibility

---

## Integration Architecture

### Ralph Loop 3-Pass Validation (Enhanced)

```
Pass 1: Rule-Based Filtering
  ├─ Evidence count check (≥3 sources)
  ├─ Confidence threshold check (≥0.7)
  └─ Survives: YES/NO

Pass 2: Evidence Verification (NEW!)
  ├─ Verify URLs are accessible
  ├─ Validate source credibility
  ├─ Check content matches claims
  └─ Adjust credibility scores

Pass 3: Claude Validation (Enhanced)
  ├─ Uses VERIFIED credibility scores
  ├─ Sees which evidence was verified
  ├─ Knows which URLs failed
  └─ Adjusts confidence based on verified quality

Pass 4: Final Confirmation
  └─ Store signal with verification metadata
```

---

## Implementation Steps

### Step 1: Add Evidence Verification to Ralph Loop

**File**: `backend/ralph_loop_server.py`

```python
from backend.evidence_verifier import EvidenceVerifier

class RalphLoopValidator:
    def __init__(self):
        # Existing initialization
        self.evidence_verifier = EvidenceVerifier()

    async def validate_signal(self, signal: Dict) -> Dict:
        """Enhanced validation with evidence verification"""

        # Pass 1: Rule-based filtering (unchanged)
        pass1_result = await self._pass1_rule_based_filtering(signal)
        if not pass1_result['survived']:
            return pass1_result

        # NEW: Pass 1.5: Evidence verification
        logger.info("🔁 Pass 1.5/4: Evidence verification")
        verified_evidence = await self.evidence_verifier.verify_all_evidence(
            signal.get('evidence', [])
        )

        verification_summary = self.evidence_verifier.get_verification_summary(
            verified_evidence
        )

        logger.info(f"   Verification rate: {verification_summary['verification_rate']:.1%}")
        logger.info(f"   Credibility adjustment: {verification_summary['credibility_adjustment']:+.2f}")

        # Update evidence with verification results
        for i, ev_verified in enumerate(verified_evidence):
            if 'evidence' in signal:
                signal['evidence'][i]['verified'] = ev_verified['verified']
                signal['evidence'][i]['actual_credibility'] = ev_verified['actual_credibility']
                signal['evidence'][i]['verification_issues'] = ev_verified.get('issues', [])

        # Check if critical issues (fake URLs, etc.)
        if verification_summary['has_critical_issues']:
            logger.warning(f"   ⚠️  Critical issues found: {verification_summary['all_issues']}")

            # Option 1: Reject signal entirely
            # return {'survived': False, 'reason': 'Critical evidence verification failures'}

            # Option 2: Continue but flag for manual review
            signal['requires_manual_review'] = True

        # Pass 2: Claude validation (enhanced with verification data)
        pass2_result = await self._pass2_claude_validation_enhanced(
            signal,
            verification_summary
        )

        # Pass 3: Final confirmation (unchanged)
        pass3_result = await self._pass3_final_confirmation(signal)

        return pass3_result

    async def _pass2_claude_validation_enhanced(
        self,
        signal: Dict,
        verification_summary: Dict
    ) -> Dict:
        """Enhanced Claude validation with verification context"""

        if not claude_client:
            logger.warning("⚠️ Claude client not available, skipping Pass 2")
            signal['pass2_confidence'] = signal['confidence']
            signal['model_used'] = 'skipped'
            return {'survived': True, 'signal': signal}

        logger.info("🔁 Pass 2/4: Claude validation (Haiku) with evidence verification")

        # Build enhanced prompt
        prompt = self._build_validation_prompt_enhanced(signal, verification_summary)

        try:
            # Call Claude API (same as before)
            response = claude_client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract and parse response (same as before)
            content = response.content[0].text
            # ... rest of processing

        except Exception as e:
            logger.error(f"❌ Pass 2 failed: {e}")
            signal['pass2_confidence'] = signal['confidence']
            signal['model_used'] = 'error'
            return {'survived': True, 'signal': signal}

    def _build_validation_prompt_enhanced(
        self,
        signal: Dict,
        verification_summary: Dict
    ) -> str:
        """Build validation prompt with verification context"""

        # Build evidence text with verification status
        evidence_text = "\n".join([
            f"{i+1}. {ev.get('source', 'Unknown')} "
            f"(claimed: {ev.get('credibility_score', 0.5)}, "
            f"verified: {ev.get('actual_credibility', 'N/A')}) "
            f"{'✅' if ev.get('verified', False) else '❌'}"
            for i, ev in enumerate(signal.get('evidence', [])[:5])
        ])

        return f"""You are a signal validation expert. Validate this signal for entity: {signal['entity_id']}

Signal:
- ID: {signal['id']}
- Type: {signal['type']}
- Confidence: {signal['confidence']}

Evidence Verification Summary:
- Total Evidence: {verification_summary['total_evidence']}
- Verified: {verification_summary['verified_count']}
- Verification Rate: {verification_summary['verification_rate']:.1%}
- Avg Claimed Credibility: {verification_summary['avg_claimed_credibility']:.2f}
- Avg Actual Credibility: {verification_summary['avg_actual_credibility']:.2f}
- Credibility Adjustment: {verification_summary['credibility_adjustment']:+.2f}

Evidence Details:
{evidence_text}

{'⚠️  WARNING: Some evidence could not be verified!' + '\nCritical Issues: ' + ', '.join(verification_summary['all_issues'][:3]) if verification_summary['has_critical_issues'] else '✅ All evidence verified'}

Task: Validate signal and adjust confidence if needed.

Consider:
1. Evidence verification rate (higher = more reliable)
2. Credibility adjustment (negative = scraper overconfident)
3. Verified vs claimed credibility (trust verified scores)
4. Presence of critical issues (fake URLs, broken links)

Return ONLY a JSON object (no markdown):
{{
  "validated": true/false,
  "confidence_adjustment": 0.0,
  "rationale": "brief explanation mentioning verification results",
  "requires_manual_review": false
}}

Be thorough in checking verification status."""
```

---

## Expected Results

### Before Evidence Verification

```json
{
  "status": "validated",
  "original_confidence": 0.92,
  "validated_confidence": 0.89,
  "adjustment": -0.03,
  "rationale": "Evidence quality is strong but lacks official statements..."
}
```

### After Evidence Verification

```json
{
  "status": "validated",
  "original_confidence": 0.92,
  "verified_confidence": 0.65,  // Much lower!
  "adjustment": -0.27,
  "rationale": "Evidence verification failed: 2/3 URLs not accessible. Claimed credibility 0.92 vs actual 0.65. Scraper appears overconfident.",
  "verification_summary": {
    "total_evidence": 3,
    "verified_count": 1,
    "verification_rate": 0.33,
    "avg_claimed_credibility": 0.90,
    "avg_actual_credibility": 0.60,
    "critical_issues": [
      "URL not accessible: https://linkedin.com/jobs/view/123456789",
      "URL not accessible: https://fake-domain-12345.com"
    ]
  }
}
```

---

## Testing Evidence Verification

### Test Case 1: Fake LinkedIn URL

```bash
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-fake-url",
    "source": "linkedin",
    "entity_id": "arsenal_fc",
    "type": "RFP_DETECTED",
    "confidence": 0.92,
    "evidence": [
      {
        "source": "LinkedIn",
        "credibility_score": 0.85,
        "url": "https://linkedin.com/jobs/view/123456789"
      }
    ]
  }'

# Expected: Confidence drops significantly due to fake URL
```

### Test Case 2: Real Arsenal URL

```bash
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-real-url",
    "source": "arsenal.com",
    "entity_id": "arsenal_fc",
    "type": "RFP_DETECTED",
    "confidence": 0.85,
    "evidence": [
      {
        "source": "Arsenal Official",
        "credibility_score": 0.95,
        "url": "https://arsenal.com/stadium/development"
      }
    ]
  }'

# Expected: Confidence stays high or increases slightly due to verified URL
```

### Test Case 3: Mixed Evidence

```bash
curl -X POST http://localhost:8001/api/webhooks/signal \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-mixed",
    "source": "linkedin",
    "entity_id": "arsenal_fc",
    "type": "RFP_DETECTED",
    "confidence": 0.88,
    "evidence": [
      {
        "source": "LinkedIn",
        "credibility_score": 0.85,
        "url": "https://linkedin.com/jobs/view/fake-123"
      },
      {
        "source": "Arsenal Official",
        "credibility_score": 0.95,
        "url": "https://arsenal.com"
      },
      {
        "source": "BrightData",
        "credibility_score": 0.75,
        "url": "https://brightdata.com"
      }
    ]
  }'

# Expected: Confidence adjusted based on verification rate (2/3 = 66%)
```

---

## Configuration Options

### Enable/Disable Evidence Verification

```bash
# .env.ralph
RALPH_LOOP_ENABLE_EVIDENCE_VERIFICATION=true  # Enable verification
RALPH_LOOP_VERIFICATION_TIMEOUT=5  # Seconds to wait for URL check
RALPH_LOOP_VERIFICATION_MODE=strict  # strict | lenient
RALPH_LOOP_REJECT_UNVERIFIED=false  # Reject signals with fake URLs
```

### Verification Modes

**Strict Mode**:
- All URLs must be accessible
- Reject signals with >1 failed verification
- Maximum penalty for fake URLs

**Lenient Mode**:
- Accept partial verification
- Warn about failed verifications
- Moderate penalty for fake URLs

---

## Performance Considerations

### Current Performance (Without Verification)
- Processing time: 2.07 seconds
- Cost: $0.0002 per signal
- Throughput: ~1,700 signals/hour

### Expected Performance (With Verification)
- Processing time: 5-10 seconds (URL checks add latency)
- Cost: $0.0002 per signal (same Claude cost)
- Throughput: ~600 signals/hour

### Optimization Strategies

1. **Parallel URL checks**: Verify all evidence concurrently
2. **Cache verification results**: Don't recheck same URLs
3. **Async operations**: Non-blocking URL verification
4. **Batch processing**: Verify multiple signals in parallel
5. **Selective verification**: Only verify high-value signals

---

## Rollout Plan

### Phase 1: Development (Week 1)
- ✅ Evidence verifier created
- ⏳ Integrate into Ralph Loop
- ⏳ Unit tests for verification logic
- ⏳ Mock URL responses for testing

### Phase 2: Testing (Week 2)
- ⏳ Test with fake URLs
- ⏳ Test with real URLs
- ⏳ Test with mixed evidence
- ⏳ Measure performance impact
- ⏳ Tune credibility penalties

### Phase 3: Staging (Week 3)
- ⏳ Deploy to staging environment
- ⏳ Monitor verification rates
- ⏳ Collect accuracy metrics
- ⏳ Adjust thresholds

### Phase 4: Production (Week 4)
- ⏳ Enable in production (read-only mode)
- ⏳ Monitor for 1 week
- ⏳ Adjust based on data
- ⏳ Enable enforcement mode

---

## Success Metrics

### Accuracy Improvements
- False positive rate: Target <5% (from ~15%)
- Confidence calibration error: <0.1
- Verification rate: >80%

### Performance Targets
- Processing time: <10 seconds per signal
- Throughput: >500 signals/hour
- Cost: No increase (URL checks are cheap)

### Quality Metrics
- Fake URL detection: >95%
- Source credibility accuracy: >90%
- Content verification: >85%

---

## Summary

**Current Problem**: System trusts scraper claims blindly
**Solution**: Verify URLs, sources, and content
**Impact**: Higher accuracy, lower false positives
**Cost**: Minimal (URL checks are fast)
**Timeline**: 4 weeks to full production

**Recommendation**: Implement evidence verification to improve signal quality and reduce false positives from untrustworthy sources.
