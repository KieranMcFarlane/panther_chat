"""
Analysis Agent - Signal Scoring and Classification Specialist

Autonomous agent for scoring signals and calculating confidence bands.

Capabilities:
- Classifies signals (ACCEPT, WEAK_ACCEPT, REJECT, etc.)
- Calculates confidence scores with delta system
- Determines confidence bands (EXPLORATORY → ACTIONABLE)
- Evaluates actionable gate criteria
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class AnalysisAgent:
    """
    Procurement Intelligence Analyst

    Classifies signals and calculates confidence scores.

    Decision Framework:
    - ACCEPT (+0.06): Strong procurement evidence
    - WEAK_ACCEPT (+0.02): Capability without intent
    - REJECT (0.00): No evidence
    - NO_PROGRESS (0.00): No new information
    - SATURATED (0.00): Category exhausted

    Confidence Bands:
    - EXPLORATORY (<0.30): $0 - Research phase
    - INFORMED (0.30-0.60): $500/entity/month - Monitoring
    - CONFIDENT (0.60-0.80): $2,000/entity/month - Sales engaged
    - ACTIONABLE (>0.80 + gate): $5,000/entity/month - Immediate outreach

    Actionable Gate: Requires ≥2 ACCEPTs across ≥2 categories
    """

    SYSTEM_PROMPT = """You are a Procurement Intelligence Analyst.

Your goal is to classify signals and calculate confidence scores for entity assessment.

Decision Types (Internal → External):
- ACCEPT (+0.06) → Procurement Signal: Strong procurement evidence
- WEAK_ACCEPT (+0.02) → Capability Signal: Capability without intent
- REJECT (0.00) → No Signal: No evidence
- NO_PROGRESS (0.00) → No Signal: No new information
- SATURATED (0.00) → Saturated: Category exhausted

Signal Classification Rules:

ACCEPT Criteria (must meet 2+):
- Explicit procurement language ("RFP released", "vendor selection", "implementing")
- Recent job postings for CRM/analytics roles (< 3 months)
- Press release about digital transformation initiative
- Budget or timeline mentioned
- Decision maker identified (CTO, CIO, Head of Digital)

WEAK_ACCEPT Criteria (must meet 1+):
- Technology mentioned but no procurement intent
- Case study showing capability exists
- Partnership with vendor (but no purchase indicated)
- General digital transformation mentioned (no specifics)

REJECT Criteria:
- No evidence found
- Content contradicts hypothesis (e.g., "we don't use CRM")

NO_PROGRESS Criteria:
- Content found but adds no new information
- Duplicate of previous evidence

SATURATED Criteria:
- 3 REJECTs in same category
- <0.01 confidence gain over 10 iterations

Confidence Calculation:
Starting: 0.50 (neutral prior)
Formula: 0.50 + (num_ACCEPT × 0.06) + (num_WEAK_ACCEPT × 0.02)
Bounds: 0.00 to 1.00 (enforced)

Confidence Bands:
- EXPLORATORY (<0.30): $0
- INFORMED (0.30-0.60): $500/entity/month
- CONFIDENT (0.60-0.80): $2,000/entity/month
- ACTIONABLE (>0.80): $5,000/entity/month

Actionable Gate:
Requires BOTH:
1. Confidence > 0.80
2. ≥2 ACCEPTs across ≥2 categories

Return JSON structure:
{
  "signals": [
    {
      "type": "CRM_ANALYTICS",
      "decision": "ACCEPT",
      "delta": 0.06,
      "evidence": ["Job posting for Salesforce Administrator", "Press release about digital transformation"],
      "confidence": 0.95
    }
  ],
  "confidence_metrics": {
    "starting": 0.50,
    "accept_count": 3,
    "weak_accept_count": 2,
    "final_confidence": 0.72,
    "band": "CONFIDENT",
    "actionable_gate": false,
    "actionable_gate_reason": "Need 2 ACCEPTs across 2 categories (currently 2 ACCEPTs in 1 category)"
  },
  "recommendations": ["Monitor for job postings", "Track press releases"],
  "priority": "HIGH"
}"""

    def __init__(self):
        """Initialize Analysis Agent"""
        from backend.agent_sdk.client_factory import create_analysis_client

        self.client = create_analysis_client(system_prompt=self.SYSTEM_PROMPT)

        logger.info("📊 Analysis Agent initialized")

    async def score_signals(
        self,
        entity_name: str,
        signals: List[Dict[str, Any]],
        base_confidence: float = 0.50
    ) -> Dict[str, Any]:
        """
        Score signals and calculate confidence metrics

        Args:
            entity_name: Name of the entity
            signals: List of signals with evidence
            base_confidence: Starting confidence (default: 0.50)

        Returns:
            Dict with scored signals, confidence_metrics, recommendations
        """
        logger.info(f"📊 Scoring signals for: {entity_name} ({len(signals)} signals)")

        prompt = f"""Analyze and score signals for: {entity_name}

Signals to analyze:
{json.dumps(signals, indent=2)}

Starting confidence: {base_confidence}

For each signal:
1. Classify as ACCEPT, WEAK_ACCEPT, REJECT, NO_PROGRESS, or SATURATED
2. Assign appropriate delta
3. Provide evidence and reasoning
4. Calculate final confidence and band

Check actionable gate:
- Need ≥2 ACCEPTs across ≥2 categories
- Confidence must be >0.80

Return JSON with complete analysis."""

        try:
            # Query the agent
            result = await self.client.query(prompt, max_tokens=4000)

            content = result.get("content", "")

            # Try to extract JSON from response
            json_data = self._extract_json(content)

            if json_data:
                metrics = json_data.get("confidence_metrics", {})
                logger.info(f"✅ Signals scored: {metrics.get('final_confidence', 0.0)} ({metrics.get('band', 'UNKNOWN')})")
                return json_data
            else:
                # Fallback: simple calculation
                return self._calculate_fallback(signals, base_confidence)

        except Exception as e:
            logger.error(f"❌ Signal scoring failed: {e}")

            # Return minimal result
            return {
                "signals": [],
                "confidence_metrics": {
                    "starting": base_confidence,
                    "accept_count": 0,
                    "weak_accept_count": 0,
                    "final_confidence": base_confidence,
                    "band": self._get_band(base_confidence),
                    "actionable_gate": False,
                    "error": str(e)
                },
                "recommendations": [],
                "priority": "UNKNOWN"
            }

    async def evaluate_actionable_gate(
        self,
        signals: List[Dict[str, Any]],
        confidence: float
    ) -> Dict[str, Any]:
        """
        Evaluate if entity meets actionable gate criteria

        Args:
            signals: List of scored signals
            confidence: Final confidence score

        Returns:
            Dict with actionable_gate result and reasoning
        """
        logger.info(f"🎯 Evaluating actionable gate (confidence: {confidence})")

        # Count ACCEPTs per category
        accepts_by_category = {}
        for signal in signals:
            if signal.get("decision") == "ACCEPT":
                signal_type = signal.get("type", "UNKNOWN")
                accepts_by_category[signal_type] = accepts_by_category.get(signal_type, 0) + 1

        categories_with_accepts = len(accepts_by_category)
        total_accepts = sum(accepts_by_category.values())

        # Check gate criteria
        meets_confidence = confidence > 0.80
        meets_distribution = total_accepts >= 2 and categories_with_accepts >= 2
        gate_passed = meets_confidence and meets_distribution

        result = {
            "actionable_gate": gate_passed,
            "confidence": confidence,
            "confidence_threshold_met": meets_confidence,
            "distribution_threshold_met": meets_distribution,
            "total_accepts": total_accepts,
            "categories_with_accepts": categories_with_accepts,
            "accepts_by_category": accepts_by_category,
            "reasoning": self._generate_gate_reasoning(
                gate_passed,
                meets_confidence,
                meets_distribution,
                accepts_by_category
            )
        }

        logger.info(f"🎯 Actionable gate: {'PASSED' if gate_passed else 'NOT PASSED'}")

        return result

    def _extract_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from agent response"""
        try:
            import re

            # Look for JSON code blocks
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)

            if not json_match:
                # Try to find bare JSON object
                json_match = re.search(r'\{[^{}]*"confidence_metrics"[^{}]*\}', content, re.DOTALL)

            if json_match:
                json_str = json_match.group(1) if json_match.lastindex else json_match.group(0)
                return json.loads(json_str)

        except Exception as e:
            logger.warning(f"⚠️ JSON extraction failed: {e}")

        return None

    def _calculate_fallback(
        self,
        signals: List[Dict[str, Any]],
        base_confidence: float
    ) -> Dict[str, Any]:
        """Fallback calculation when JSON parsing fails"""
        accept_count = sum(1 for s in signals if s.get("decision") == "ACCEPT")
        weak_accept_count = sum(1 for s in signals if s.get("decision") == "WEAK_ACCEPT")

        final_confidence = base_confidence + (accept_count * 0.06) + (weak_accept_count * 0.02)
        final_confidence = max(0.0, min(1.0, final_confidence))

        return {
            "signals": signals,
            "confidence_metrics": {
                "starting": base_confidence,
                "accept_count": accept_count,
                "weak_accept_count": weak_accept_count,
                "final_confidence": final_confidence,
                "band": self._get_band(final_confidence),
                "actionable_gate": final_confidence > 0.80
            },
            "recommendations": ["Manual review recommended"],
            "priority": "MEDIUM",
            "note": "Calculated using fallback logic"
        }

    def _get_band(self, confidence: float) -> str:
        """Get confidence band from score"""
        if confidence < 0.30:
            return "EXPLORATORY"
        elif confidence < 0.60:
            return "INFORMED"
        elif confidence < 0.80:
            return "CONFIDENT"
        else:
            return "ACTIONABLE"

    def _generate_gate_reasoning(
        self,
        gate_passed: bool,
        meets_confidence: bool,
        meets_distribution: bool,
        accepts_by_category: Dict[str, int]
    ) -> str:
        """Generate reasoning for actionable gate evaluation"""
        if gate_passed:
            return f"✅ Actionable gate PASSED: Confidence >0.80 and {len(accepts_by_category)} categories with ACCEPTs"

        reasons = []
        if not meets_confidence:
            reasons.append("Confidence must be >0.80")
        if not meets_distribution:
            reasons.append(f"Need ≥2 ACCEPTs across ≥2 categories (currently: {accepts_by_category})")

        return f"❌ Actionable gate NOT PASSED: {', '.join(reasons)}"


# =============================================================================
# Convenience Functions
# =============================================================================

async def score_entity_signals(
    entity_name: str,
    signals: List[Dict[str, Any]],
    base_confidence: float = 0.50
) -> Dict[str, Any]:
    """
    Convenience function to score entity signals

    Args:
        entity_name: Name of the entity
        signals: List of signals to score
        base_confidence: Starting confidence

    Returns:
        Dict with scored signals and metrics
    """
    agent = AnalysisAgent()
    return await agent.score_signals(entity_name, signals, base_confidence)


if __name__ == "__main__":
    import asyncio

    async def test_analysis_agent():
        """Test Analysis Agent"""
        print("Testing Analysis Agent...")

        agent = AnalysisAgent()

        # Test signal scoring
        print("\n1. Testing signal scoring...")
        test_signals = [
            {
                "type": "CRM_ANALYTICS",
                "evidence": ["Job posting: Salesforce Administrator", "Press release: Digital transformation initiative"],
                "source": "web"
            },
            {
                "type": "JOB_POSTING",
                "evidence": ["Hiring for CRM Manager"],
                "source": "linkedin"
            }
        ]

        result = await agent.score_signals("Arsenal FC", test_signals)
        print(f"Result: {json.dumps(result, indent=2)}")

        # Test actionable gate
        if result.get("signals"):
            print("\n2. Testing actionable gate...")
            gate_result = await agent.evaluate_actionable_gate(
                result["signals"],
                result["confidence_metrics"]["final_confidence"]
            )
            print(f"Gate result: {json.dumps(gate_result, indent=2)}")

        print("\n✅ Tests complete!")

    asyncio.run(test_analysis_agent())
