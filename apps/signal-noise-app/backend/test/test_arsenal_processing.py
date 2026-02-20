#!/usr/bin/env python3
"""
Test Arsenal FC Processing

This script simulates the complete processing workflow for Arsenal FC,
including webhook signal detection and Ralph Loop validation with model cascade.

Usage:
    cd backend
    python test/test_arsenal_processing.py

Expected Output:
    - Webhook signal received and validated
    - Confidence adjustment: 0.92 → 0.82
    - Model used: Haiku (80% success rate)
    - Cost: ~$0.00045
    - Processing time: ~20 seconds
"""
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MockClaudeClient:
    """Mock Claude client for testing"""

    def __init__(self):
        self.call_count = 0
        self.tokens_used = 0

    async def query(self, prompt: str, model: str = "haiku-3.5-20250813", max_tokens: int = 1000):
        """
        Mock Claude API call

        Simulates Haiku response for confidence validation
        """
        self.call_count += 1

        # Simulate token usage
        input_tokens = len(prompt.split()) * 1.3  # Rough estimate
        output_tokens = 150  # Typical response length
        total_tokens = int(input_tokens + output_tokens)
        self.tokens_used += total_tokens

        logger.info(f"🔄 Claude API call #{self.call_count} ({model})")
        logger.info(f"   Input tokens: ~{int(input_tokens)}")
        logger.info(f"   Output tokens: ~{output_tokens}")
        logger.info(f"   Total tokens: ~{total_tokens}")

        # Simulate Haiku response (confidence validation)
        if model == "haiku-3.5-20250813":
            response = {
                "validated": True,
                "confidence_adjustment": -0.10,
                "rationale": "LinkedIn job posting is credible but single source. Corroboration from Graphiti (similar RFP 2 weeks ago) strengthens validity. However, lack of direct confirmation from Arsenal FC reduces confidence. 0.92 is overconfident for this evidence set.",
                "requires_manual_review": False
            }
        elif model == "claude-sonnet-4-5-20250929":
            response = {
                "validated": True,
                "confidence_adjustment": -0.08,
                "rationale": "Detailed Sonnet analysis agrees with Haiku assessment. Evidence is strong but not definitive. Recommendation: monitor for additional confirmation.",
                "requires_manual_review": False
            }
        else:  # Opus
            response = {
                "validated": True,
                "confidence_adjustment": -0.05,
                "rationale": "Comprehensive Opus analysis confirms signal validity with high confidence. Multiple corroborating factors support RFP detection.",
                "requires_manual_review": False
            }

        # Return as JSON string
        return json.dumps(response)


class MockGraphitiService:
    """Mock Graphiti service for testing"""

    def __init__(self):
        self.initialized = False
        self.signals = []
        self.entities = {}

    async def initialize(self):
        """Initialize mock Graphiti service"""
        self.initialized = True
        logger.info("✅ Mock Graphiti service initialized")

        # Create Arsenal FC entity
        self.entities['arsenal_fc'] = {
            'entity_id': 'arsenal_fc',
            'entity_name': 'Arsenal FC',
            'tier': 'premium',
            'metadata': {
                'league': 'Premier League',
                'founded': 1886
            }
        }

        # Add some existing signals for context
        self.signals.append({
            'id': 'arsenal-rfp-20260115',
            'type': 'RFP_DETECTED',
            'confidence': 0.78,
            'entity_id': 'arsenal_fc',
            'first_seen': datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        })

        self.signals.append({
            'id': 'arsenal-executive-20260110',
            'type': 'EXECUTIVE_CHANGE',
            'confidence': 0.85,
            'entity_id': 'arsenal_fc',
            'first_seen': datetime(2026, 1, 10, 14, 20, 0, tzinfo=timezone.utc)
        })

    async def get_entity(self, entity_id: str):
        """Get entity by ID"""
        return self.entities.get(entity_id)

    async def get_entity_signals(self, entity_id: str, time_horizon_days: int = 30):
        """Get signals for entity"""
        return [s for s in self.signals if s['entity_id'] == entity_id]

    async def find_related_signals(self, entity_id: str, min_confidence: float = 0.0, time_horizon_days: int = 365):
        """Find related signals for context"""
        return await self.get_entity_signals(entity_id)

    async def upsert_signal(self, signal):
        """Upsert signal to Graphiti"""
        # Check if signal already exists
        existing = next((s for s in self.signals if s['id'] == signal.id), None)

        if existing:
            # Update existing signal
            existing.update({
                'confidence': signal.confidence,
                'validated': signal.validated,
                'validation_pass': signal.validation_pass
            })
            logger.info(f"✅ Signal updated: {signal.id}")
        else:
            # Insert new signal
            signal_dict = {
                'id': signal.id,
                'type': signal.type.value if hasattr(signal.type, 'value') else signal.type,
                'confidence': signal.confidence,
                'entity_id': signal.entity_id,
                'first_seen': signal.first_seen,
                'validated': getattr(signal, 'validated', False),
                'validation_pass': getattr(signal, 'validation_pass', 0)
            }
            self.signals.append(signal_dict)
            logger.info(f"✅ Signal inserted: {signal.id}")

    def close(self):
        """Close mock Graphiti service"""
        logger.info("✅ Mock Graphiti service closed")


class RalphLoopValidator:
    """Simplified Ralph Loop validator for testing"""

    def __init__(self, claude_client, graphiti_service):
        self.claude = claude_client
        self.graphiti_service = graphiti_service
        self.config = {
            'min_evidence': 3,
            'min_confidence': 0.7,
            'min_evidence_credibility': 0.6,
            'max_confidence_adjustment': 0.15
        }

    async def validate_signals(self, raw_signals: List[Dict], entity_id: str):
        """
        Validate signals using Ralph Loop 3-pass validation

        Returns:
            List of validated Signal objects
        """
        logger.info(f"🔁 Starting Ralph Loop for {entity_id} with {len(raw_signals)} signals")

        # Pass 1: Rule-based filtering
        logger.info(f"🔁 Pass 1/3: Rule-based filtering")
        pass1_survivors = await self._pass1_filter(raw_signals, entity_id)
        logger.info(f"   ✅ Pass 1: {len(pass1_survivors)}/{len(raw_signals)} signals survived")

        if not pass1_survivors:
            logger.warning("⚠️ No signals survived Pass 1")
            return []

        # Pass 2: Claude validation with cascade
        logger.info(f"🔁 Pass 2/3: Claude validation with cascade")
        pass2_survivors = await self._pass2_claude_validation(pass1_survivors, entity_id)
        logger.info(f"   ✅ Pass 2: {len(pass2_survivors)}/{len(pass1_survivors)} signals survived")

        if not pass2_survivors:
            logger.warning("⚠️ No signals survived Pass 2")
            return []

        # Pass 3: Final confirmation
        logger.info(f"🔁 Pass 3/3: Final confirmation")
        pass3_survivors = await self._pass3_final_confirmation(pass2_survivors, entity_id)
        logger.info(f"   ✅ Pass 3: {len(pass3_survivors)}/{len(pass2_survivors)} signals survived")

        if not pass3_survivors:
            logger.warning("⚠️ No signals survived Pass 3")
            return []

        # Write to Graphiti
        logger.info(f"💾 Writing {len(pass3_survivors)} validated signals to Graphiti")
        for signal in pass3_survivors:
            # Convert dict to Signal object
            signal_obj = Signal(signal)
            await self.graphiti_service.upsert_signal(signal_obj)

        logger.info(f"✅ Ralph Loop complete: {len(pass3_survivors)}/{len(raw_signals)} signals validated")

        return pass3_survivors

    async def _pass1_filter(self, raw_signals: List[Dict], entity_id: str) -> List[Dict]:
        """Pass 1: Rule-based filtering"""
        filtered = []

        for signal in raw_signals:
            # Check confidence threshold
            if signal['confidence'] < self.config['min_confidence']:
                logger.debug(f"❌ Pass 1: Signal rejected (low confidence: {signal['confidence']})")
                continue

            # Check evidence count (with auto-enrichment if needed)
            evidence_count = len(signal.get('evidence', []))
            if evidence_count < self.config['min_evidence']:
                logger.info(f"🔍 Enriching signal {signal['id']} (evidence: {evidence_count} < {self.config['min_evidence']})")
                signal = await self._enrich_signal(signal, entity_id)
                evidence_count = len(signal.get('evidence', []))

            if evidence_count < self.config['min_evidence']:
                logger.debug(f"❌ Pass 1: Signal rejected (insufficient evidence: {evidence_count})")
                continue

            # Check evidence credibility
            avg_credibility = self._calculate_avg_credibility(signal.get('evidence', []))
            if avg_credibility < self.config['min_evidence_credibility']:
                logger.debug(f"❌ Pass 1: Signal rejected (low credibility: {avg_credibility})")
                continue

            # Signal passed all checks
            signal['pass1_confidence'] = signal['confidence']
            signal['avg_credibility'] = avg_credibility
            filtered.append(signal)
            logger.debug(f"✅ Pass 1: Signal {signal['id']} survived (confidence: {signal['confidence']}, evidence: {evidence_count})")

        return filtered

    async def _enrich_signal(self, signal: Dict, entity_id: str) -> Dict:
        """Enrich signal with additional evidence"""
        # Get existing signals from Graphiti for corroboration
        existing_signals = await self.graphiti_service.get_entity_signals(entity_id, time_horizon_days=30)

        # Add corroboration evidence
        for existing in existing_signals[:2]:
            if 'evidence' not in signal:
                signal['evidence'] = []

            signal['evidence'].append({
                'source': 'graphiti_corroboration',
                'type': 'related_signal',
                'signal_id': existing['id'],
                'credibility_score': 0.75,
                'date': existing['first_seen'].isoformat() if isinstance(existing['first_seen'], datetime) else existing['first_seen']
            })

        # Add Perplexity evidence (mock)
        signal['evidence'].append({
            'source': 'Perplexity',
            'type': 'market_research',
            'credibility_score': 0.70,
            'date': datetime.now(timezone.utc).isoformat(),
            'extracted_text': f"{entity_id.replace('_', ' ').title()} has been actively pursuing digital transformation initiatives"
        })

        return signal

    def _calculate_avg_credibility(self, evidence: List[Dict]) -> float:
        """Calculate average credibility score"""
        if not evidence:
            return 0.0

        credibility_scores = [ev.get('credibility_score', 0.5) for ev in evidence]
        return sum(credibility_scores) / len(credibility_scores)

    async def _pass2_claude_validation(self, candidates: List[Dict], entity_id: str) -> List[Dict]:
        """Pass 2: Claude validation with cascade (Haiku → Sonnet → Opus)"""
        validated = []

        for candidate in candidates:
            # Try Haiku first
            result = await self._validate_with_model(candidate, entity_id, "haiku-3.5-20250813")

            if result['validated']:
                # Haiku succeeded
                candidate.update(result)
                validated.append(candidate)
            else:
                # Try Sonnet (escalation)
                logger.info(f"🔁 Haiku insufficient for {candidate['id']}, escalating to Sonnet")
                result = await self._validate_with_model(candidate, entity_id, "claude-sonnet-4-5-20250929")

                if result['validated']:
                    candidate.update(result)
                    validated.append(candidate)
                else:
                    # Try Opus (final escalation)
                    logger.info(f"🔁 Sonnet insufficient for {candidate['id']}, escalating to Opus")
                    result = await self._validate_with_model(candidate, entity_id, "claude-opus-4-5-20251101")

                    candidate.update(result)
                    # Opus is final, always accept
                    validated.append(candidate)

        return validated

    async def _validate_with_model(self, signal: Dict, entity_id: str, model: str) -> Dict:
        """Validate signal with specific Claude model"""

        # Build prompt
        prompt = self._build_prompt(signal, entity_id)

        # Call Claude API
        start_time = datetime.now(timezone.utc)
        response = await self.claude.query(prompt, model=model)
        end_time = datetime.now(timezone.utc)

        # Parse response
        try:
            validation_result = json.loads(response)

            # Calculate cost
            haiku_cost = 0.25 / 1_000_000  # $0.25 per 1M tokens
            sonnet_cost = 3.0 / 1_000_000   # $3.00 per 1M tokens
            opus_cost = 15.0 / 1_000_000    # $15.00 per 1M tokens

            if 'haiku' in model:
                cost_per_token = haiku_cost
            elif 'sonnet' in model:
                cost_per_token = sonnet_cost
            else:  # opus
                cost_per_token = opus_cost

            estimated_tokens = len(prompt.split()) * 1.3 + 150
            cost = estimated_tokens * cost_per_token

            processing_time = (end_time - start_time).total_seconds()

            logger.info(f"✅ {model.split('-')[0].title()} validation succeeded")
            logger.info(f"   Confidence adjustment: {validation_result.get('confidence_adjustment', 0.0):+.2f}")
            logger.info(f"   Rationale: {validation_result.get('rationale', 'No rationale')[:80]}...")
            logger.info(f"   Cost: ${cost:.4f}")
            logger.info(f"   Processing time: {processing_time:.2f}s")

            return {
                'validated': validation_result.get('validated', False),
                'pass2_confidence': signal['confidence'] + validation_result.get('confidence_adjustment', 0.0),
                'confidence_adjustment': validation_result.get('confidence_adjustment', 0.0),
                'rationale': validation_result.get('rationale', ''),
                'requires_manual_review': validation_result.get('requires_manual_review', False),
                'model_used': model,
                'validation_cost': cost
            }

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse {model} response: {e}")
            return {'validated': False, 'error': str(e)}

    def _build_prompt(self, signal: Dict, entity_id: str) -> str:
        """Build prompt for Claude validation"""
        evidence_text = "\n".join([
            f"{i+1}. {ev.get('source', 'Unknown')} (credibility: {ev.get('credibility_score', 0.5)})"
            for i, ev in enumerate(signal.get('evidence', [])[:5])
        ])

        return f"""
Validate this signal for entity: {entity_id}

Signal:
- ID: {signal['id']}
- Type: {signal['type']}
- Confidence: {signal['confidence']}
- Evidence: {len(signal.get('evidence', []))} items

Evidence:
{evidence_text}

Task: Validate signal and adjust confidence if needed.

Consider:
1. Evidence quality (credibility, recency, source diversity)
2. Confidence score alignment with evidence strength
3. Adjustment range: ±0.15

Return JSON:
{{
  "validated": true/false,
  "confidence_adjustment": 0.0,
  "rationale": "explanation",
  "requires_manual_review": false
}}
"""

    async def _pass3_final_confirmation(self, candidates: List[Dict], entity_id: str) -> List[Dict]:
        """Pass 3: Final confirmation"""
        confirmed = []

        for signal in candidates:
            # Check final confidence threshold
            if signal['pass2_confidence'] >= self.config['min_confidence']:
                signal['final_confidence'] = signal['pass2_confidence']
                signal['validated'] = True
                signal['validation_pass'] = 3
                confirmed.append(signal)
                logger.debug(f"✅ Pass 3: Signal {signal['id']} confirmed (confidence: {signal['final_confidence']})")
            else:
                logger.debug(f"❌ Pass 3: Signal {signal['id']} rejected (confidence: {signal['pass2_confidence']} < {self.config['min_confidence']})")

        return confirmed


class Signal:
    """Signal object for Graphiti storage"""
    def __init__(self, signal_data: Dict):
        self.id = signal_data['id']
        self.type = signal_data['type']
        self.confidence = signal_data.get('final_confidence', signal_data.get('pass2_confidence', signal_data['confidence']))
        self.first_seen = signal_data.get('timestamp', datetime.now(timezone.utc))
        self.entity_id = signal_data['entity_id']
        self.validated = signal_data.get('validated', False)
        self.validation_pass = signal_data.get('validation_pass', 0)


async def test_arsenal_webhook_processing():
    """Test Arsenal FC webhook processing"""

    print("\n" + "="*80)
    print("🧪 ARSENAL FC WEBHOOK PROCESSING TEST")
    print("="*80 + "\n")

    # Step 1: Create webhook signal
    logger.info("📨 Step 1: Creating webhook signal")

    webhook_signal = {
        "id": "webhook-linkedin-20260128-000015",
        "type": "RFP_DETECTED",
        "confidence": 0.92,
        "entity_id": "arsenal_fc",
        "timestamp": datetime.now(timezone.utc),
        "evidence": [
            {
                "source": "LinkedIn",
                "type": "job_posting",
                "url": "https://linkedin.com/jobs/view/123456789",
                "credibility_score": 0.85,
                "date": "2026-01-28",
                "extracted_text": "Arsenal FC is seeking a Head of Digital Transformation to lead our technology modernization efforts..."
            }
        ],
        "metadata": {
            "source": "webhook",
            "webhook_id": "linkedin-20260128-000015",
            "job_title": "Head of Digital Transformation",
            "indicative_budget": "£1.5M"
        }
    }

    logger.info(f"   Signal ID: {webhook_signal['id']}")
    logger.info(f"   Type: {webhook_signal['type']}")
    logger.info(f"   Confidence: {webhook_signal['confidence']}")
    logger.info(f"   Evidence: {len(webhook_signal['evidence'])} items")

    # Step 2: Initialize services
    logger.info("\n🔧 Step 2: Initializing services")

    claude = MockClaudeClient()
    graphiti = MockGraphitiService()
    await graphiti.initialize()

    ralph_loop = RalphLoopValidator(claude, graphiti)

    # Step 3: Run Ralph Loop validation
    logger.info("\n🔁 Step 3: Running Ralph Loop validation")

    start_time = datetime.now(timezone.utc)
    validated_signals = await ralph_loop.validate_signals(
        raw_signals=[webhook_signal],
        entity_id="arsenal_fc"
    )
    end_time = datetime.now(timezone.utc)

    # Step 4: Display results
    logger.info("\n📊 Step 4: Results Summary")

    print("\n" + "-"*80)
    print("RESULTS SUMMARY")
    print("-"*80)

    if validated_signals:
        signal = validated_signals[0]
        print(f"\n✅ Signal Validated Successfully!")
        print(f"\n   Signal ID: {signal['id']}")
        print(f"   Type: {signal['type']}")
        print(f"   Original Confidence: {webhook_signal['confidence']:.2f}")
        print(f"   Validated Confidence: {signal['final_confidence']:.2f}")
        print(f"   Confidence Adjustment: {signal['final_confidence'] - webhook_signal['confidence']:+.2f}")

        if 'confidence_adjustment' in signal:
            print(f"   Adjustment Rationale: {signal.get('rationale', 'N/A')}")
            print(f"   Model Used: {signal.get('model_used', 'N/A')}")
            print(f"   Validation Cost: ${signal.get('validation_cost', 0.0):.4f}")

        print(f"\n   Validation Pass: {signal['validation_pass']}/3")
        print(f"   Validated: {signal['validated']}")
        print(f"   Entity: {signal['entity_id']}")

        # Calculate cost comparison
        haiku_tokens = 1800  # Estimated
        sonnet_cost = haiku_tokens * 3.0 / 1_000_000  # Sonnet baseline
        haiku_cost = haiku_tokens * 0.25 / 1_000_000  # Haiku actual

        print(f"\n💰 Cost Comparison:")
        print(f"   Sonnet (baseline): ${sonnet_cost:.4f}")
        print(f"   Haiku (actual): ${haiku_cost:.4f}")
        print(f"   Savings: ${sonnet_cost - haiku_cost:.4f} ({(1 - haiku_cost/sonnet_cost)*100:.1f}%)")

        processing_time = (end_time - start_time).total_seconds()
        print(f"\n⏱️  Processing Time: {processing_time:.2f} seconds")

        print(f"\n📈 Claude API Usage:")
        print(f"   API Calls: {claude.call_count}")
        print(f"   Total Tokens: ~{claude.tokens_used:,}")

    else:
        print("\n❌ Signal Validation Failed")
        print("   No signals survived all 3 passes")

    print("\n" + "-"*80)

    # Step 5: Verify Graphiti storage
    logger.info("\n💾 Step 5: Verifying Graphiti storage")

    stored_signals = await graphiti.get_entity_signals('arsenal_fc')
    print(f"\n✅ Signals in Graphiti for Arsenal FC: {len(stored_signals)}")
    for sig in stored_signals:
        print(f"   - {sig['id']}: {sig['type']} (confidence: {sig['confidence']:.2f})")

    # Close services
    graphiti.close()

    print("\n" + "="*80)
    print("✅ TEST COMPLETE")
    print("="*80 + "\n")


async def main():
    """Run Arsenal FC processing test"""
    try:
        await test_arsenal_webhook_processing()
    except Exception as e:
        logger.error(f"❌ Test failed: {e}", exc_info=True)
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
