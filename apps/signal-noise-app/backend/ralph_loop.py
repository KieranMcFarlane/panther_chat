#!/usr/bin/env python3
"""
Ralph Loop: Batch-Enforced Signal Validation

Implements the Ralph Loop validation system with hard minimums and max 3 passes:

RULES:
- Minimum 3 pieces of evidence per signal
- Confidence > 0.7 for signal creation
- Maximum 3 validation passes per entity
- Only validated signals written to Graphiti

PASSES:
- Pass 1: Rule-based filtering (min evidence, source credibility)
- Pass 2: Claude validation (cross-check with existing signals)
- Pass 3: Final confirmation (confidence scoring, duplicate detection)

Usage:
    from backend.ralph_loop import RalphLoop
    from backend.claude_client import ClaudeClient
    from backend.graphiti_service import GraphitiService

    claude = ClaudeClient()
    graphiti = GraphitiService()
    await graphiti.initialize()

    ralph = RalphLoop(claude, graphiti)
    validated_signals = await ralph.validate_signals(raw_signals, entity_id)

    for signal in validated_signals:
        print(f"✅ Validated: {signal.id} (confidence: {signal.confidence})")
"""

import os
import sys
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class RalphLoopConfig:
    """Configuration for Ralph Loop validation"""
    min_evidence: int = 3
    min_confidence: float = 0.7
    min_evidence_credibility: float = 0.6
    max_passes: int = 3
    duplicate_threshold: float = 0.85  # Similarity threshold for duplicate detection


class RalphLoop:
    """
    Batch-enforced signal validation with hard minimums

    The Ralph Loop ensures only high-quality signals enter the graph by:
    1. Enforcing minimum evidence requirements
    2. Validating against existing signals
    3. Detecting and deduplicating similar signals
    4. Scoring confidence with multiple validation passes

    Only signals that pass all 3 passes are written to Graphiti.
    """

    def __init__(self, claude_client, graphiti_service, config: RalphLoopConfig = None):
        """
        Initialize Ralph Loop

        Args:
            claude_client: ClaudeClient instance for AI validation
            graphiti_service: GraphitiService instance for graph operations
            config: Optional RalphLoopConfig (uses defaults if not provided)
        """
        self.claude_client = claude_client
        self.graphiti_service = graphiti_service
        self.config = config or RalphLoopConfig()

        logger.info(f"🔁 Ralph Loop initialized (min_evidence: {self.config.min_evidence}, "
                   f"min_confidence: {self.config.min_confidence}, max_passes: {self.config.max_passes})")

    async def validate_signals(
        self,
        raw_signals: List[Dict[str, Any]],
        entity_id: str
    ) -> List['Signal']:
        """
        Ralph Loop validation pipeline

        Args:
            raw_signals: List of raw signal data from scrapers
            entity_id: Entity identifier for validation context

        Returns:
            List of validated Signal objects (ready for Graphiti)

        Process:
        1. Pass 1: Rule-based filtering (min evidence, basic checks)
        2. Pass 2: Claude validation (cross-check with existing signals)
        3. Pass 3: Final confirmation (confidence scoring, duplicate detection)

        Only signals that survive all 3 passes are returned.
        """
        from backend.schemas import Signal

        logger.info(f"🔁 Starting Ralph Loop for {entity_id} with {len(raw_signals)} raw signals")

        validated_signals = []
        pass_results = {1: [], 2: [], 3: []}

        # Pass 1: Rule-based filtering
        logger.info(f"🔁 Pass 1/3: Rule-based filtering for {entity_id}")
        pass1_candidates = await self._pass1_filter(raw_signals)
        pass_results[1] = pass1_candidates

        logger.info(f"   ✅ Pass 1: {len(pass1_candidates)}/{len(raw_signals)} signals survived")
        logger.info(f"   ❌ Pass 1: {len(raw_signals) - len(pass1_candidates)} signals rejected")

        if not pass1_candidates:
            logger.warning(f"⚠️ No signals survived Pass 1 for {entity_id}")
            return []

        # Pass 2: Claude validation
        logger.info(f"🔁 Pass 2/3: Claude validation for {entity_id}")
        pass2_candidates = await self._pass2_claude_validation(pass1_candidates, entity_id)
        pass_results[2] = pass2_candidates

        logger.info(f"   ✅ Pass 2: {len(pass2_candidates)}/{len(pass1_candidates)} signals survived")
        logger.info(f"   ❌ Pass 2: {len(pass1_candidates) - len(pass2_candidates)} signals rejected")

        if not pass2_candidates:
            logger.warning(f"⚠️ No signals survived Pass 2 for {entity_id}")
            return []

        # Pass 3: Final confirmation
        logger.info(f"🔁 Pass 3/3: Final confirmation for {entity_id}")
        pass3_candidates = await self._pass3_final_confirmation(pass2_candidates, entity_id)
        pass_results[3] = pass3_candidates

        logger.info(f"   ✅ Pass 3: {len(pass3_candidates)}/{len(pass2_candidates)} signals survived")
        logger.info(f"   ❌ Pass 3: {len(pass2_candidates) - len(pass3_candidates)} signals rejected")

        if not pass3_candidates:
            logger.warning(f"⚠️ No signals survived Pass 3 for {entity_id}")
            return []

        # Mark all surviving signals as validated
        for signal in pass3_candidates:
            signal.validated = True
            signal.validation_pass = 3

        validated_signals = pass3_candidates

        # Write only validated signals to Graphiti
        logger.info(f"💾 Writing {len(validated_signals)} validated signals to Graphiti")
        for signal in validated_signals:
            try:
                await self.graphiti_service.upsert_signal(signal)
                logger.info(f"   ✅ Wrote signal: {signal.id} (confidence: {signal.confidence})")
            except Exception as e:
                logger.error(f"   ❌ Failed to write signal {signal.id}: {e}")

        logger.info(f"✅ Ralph Loop complete: {len(validated_signals)}/{len(raw_signals)} signals validated")

        return validated_signals

    async def _pass1_filter(self, raw_signals: List[Dict]) -> List['Signal']:
        """
        Pass 1: Rule-based filtering

        Filters:
        - Minimum evidence count
        - Source credibility
        - Confidence threshold
        - Basic data validation
        """
        from backend.schemas import Signal, Evidence, SignalType

        filtered = []

        for raw_signal in raw_signals:
            try:
                # Extract basic fields
                signal_type = raw_signal.get('type', 'RFP_DETECTED')
                confidence = raw_signal.get('confidence', 0.0)
                entity_id = raw_signal.get('entity_id')
                evidence_list = raw_signal.get('evidence', [])

                # Check confidence threshold
                if confidence < self.config.min_confidence:
                    logger.debug(f"❌ Pass 1: Signal rejected (low confidence: {confidence})")
                    continue

                # Check evidence count
                if len(evidence_list) < self.config.min_evidence:
                    logger.debug(f"❌ Pass 1: Signal rejected (insufficient evidence: {len(evidence_list)}/{self.config.min_evidence})")
                    continue

                # Check source credibility
                if not self._check_source_credibility(evidence_list):
                    logger.debug(f"❌ Pass 1: Signal rejected (low source credibility)")
                    continue

                # Create Signal object
                signal_id = raw_signal.get('id', f"signal_{entity_id}_{signal_type.lower()}_{datetime.now().strftime('%Y%m%d%H%M%S')}")

                signal = Signal(
                    id=signal_id,
                    type=SignalType[signal_type] if signal_type in SignalType.__members__ else SignalType.RFP_DETECTED,
                    subtype=raw_signal.get('subtype'),
                    confidence=confidence,
                    first_seen=datetime.now(timezone.utc),
                    entity_id=entity_id,
                    metadata=raw_signal.get('metadata', {}),
                    validation_pass=1
                )

                filtered.append(signal)

            except Exception as e:
                logger.warning(f"⚠️ Pass 1: Error processing signal: {e}")
                continue

        return filtered

    def _check_source_credibility(self, evidence_list: List[Dict]) -> bool:
        """
        Check if evidence sources meet credibility threshold

        Args:
            evidence_list: List of evidence items

        Returns:
            True if average credibility >= min_evidence_credibility
        """
        if not evidence_list:
            return False

        credibility_scores = [
            ev.get('credibility_score', 0.5)
            for ev in evidence_list
        ]

        avg_credibility = sum(credibility_scores) / len(credibility_scores)

        return avg_credibility >= self.config.min_evidence_credibility

    async def _pass2_claude_validation(
        self,
        candidates: List['Signal'],
        entity_id: str
    ) -> List['Signal']:
        """
        Pass 2: Claude validation

        Validates:
        - Consistency with existing signals
        - Duplicate detection
        - Plausibility check
        """
        from backend.schemas import SignalValidationResult

        # Get existing signals for context
        try:
            existing_signals = await self.graphiti_service.find_related_signals(
                entity_id=entity_id,
                min_confidence=0.0,  # Get all signals for context
                time_horizon_days=365
            )
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch existing signals: {e}")
            existing_signals = []

        if not existing_signals:
            # No existing signals, skip this pass
            return candidates

        # Format signals for Claude
        existing_summary = self._format_signals_for_claude(existing_signals[:10])  # Limit context
        candidates_summary = self._format_signals_for_claude(candidates)

        prompt = f"""
You are a signal validation expert. Your job is to validate candidate signals against existing signals for entity: {entity_id}

EXISTING SIGNALS (last 10):
{existing_summary}

CANDIDATE SIGNALS TO VALIDATE:
{candidates_summary}

For each candidate signal, evaluate:
1. Is it consistent with existing signals? (No contradictions)
2. Is it distinct from existing signals? (Not a duplicate)
3. Is it plausible? (Reasonable given entity context)

Return ONLY a JSON object with this exact format:
{{
  "validated": ["signal_id_1", "signal_id_2"],
  "rejected": [
    {{"signal_id": "signal_id_3", "reason": "Duplicate of existing signal"}}
  ]
}}

Be strict but fair. Only reject signals that are clearly duplicates or inconsistent.
"""

        try:
            # Call Claude for validation
            response = await self.claude_client.query(
                prompt=prompt,
                max_tokens=2000
            )

            # Parse Claude's response
            validated_ids = self._parse_claude_validation(response, candidates)

            # Filter candidates
            validated = [s for s in candidates if s.id in validated_ids]
            rejected = [s for s in candidates if s.id not in validated_ids]

            for signal in rejected:
                logger.debug(f"❌ Pass 2: Claude rejected {signal.id}")

            return validated

        except Exception as e:
            logger.error(f"❌ Pass 2: Claude validation failed: {e}")
            # Fail open: return all candidates if Claude fails
            return candidates

    def _format_signals_for_claude(self, signals: List[Any]) -> str:
        """Format signals for Claude consumption"""
        lines = []
        for signal in signals:
            if isinstance(signal, dict):
                signal_id = signal.get('id', 'unknown')
                signal_type = signal.get('type', 'unknown')
                confidence = signal.get('confidence', 0.0)
                lines.append(f"- {signal_id}: {signal_type} (confidence: {confidence})")
            else:
                # Signal object
                lines.append(f"- {signal.id}: {signal.type.value} (confidence: {signal.confidence})")
        return "\n".join(lines)

    def _parse_claude_validation(self, response: str, candidates: List['Signal']) -> List[str]:
        """Parse Claude's validation response and extract validated signal IDs"""
        import json
        import re

        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{[^}]*"validated"[^}]*\}', response, re.DOTALL)

            if json_match:
                result = json.loads(json_match.group(0))
                validated = result.get('validated', [])

                logger.debug(f"Claude validated {len(validated)}/{len(candidates)} signals")
                return validated
            else:
                logger.warning("Could not parse Claude validation JSON, accepting all candidates")
                return [s.id for s in candidates]

        except Exception as e:
            logger.warning(f"Error parsing Claude validation: {e}, accepting all candidates")
            return [s.id for s in candidates]

    async def _pass3_final_confirmation(
        self,
        candidates: List['Signal'],
        entity_id: str
    ) -> List['Signal']:
        """
        Pass 3: Final confirmation

        Performs:
        - Final confidence scoring
        - Duplicate detection via embedding similarity
        - Quality assessment
        """
        # For now, this is a simple pass that checks final confidence
        # In production, this could use embeddings for duplicate detection

        confirmed = []

        for signal in candidates:
            # Final confidence check
            if signal.confidence >= self.config.min_confidence:
                # Check for near-duplicates in confirmed
                is_duplicate = False

                for confirmed_signal in confirmed:
                    if self._are_signals_duplicate(signal, confirmed_signal):
                        is_duplicate = True
                        logger.debug(f"❌ Pass 3: Duplicate detected: {signal.id} ~ {confirmed_signal.id}")
                        break

                if not is_duplicate:
                    signal.validation_pass = 3
                    confirmed.append(signal)

        return confirmed

    def _are_signals_duplicate(self, signal1: 'Signal', signal2: 'Signal') -> bool:
        """
        Check if two signals are duplicates

        Args:
            signal1: First signal
            signal2: Second signal

        Returns:
            True if signals are near-duplicates
        """
        # Simple check: same type and entity within 24 hours
        from datetime import timedelta

        time_diff = abs((signal1.first_seen - signal2.first_seen).total_seconds())

        if signal1.type == signal2.type and signal1.entity_id == signal2.entity_id:
            # Same type and entity, check time proximity
            if time_diff < 86400:  # 24 hours in seconds
                # Check confidence similarity
                conf_diff = abs(signal1.confidence - signal2.confidence)
                if conf_diff < 0.15:  # Very similar confidence
                    return True

        return False


# =============================================================================
# Convenience Functions
# =============================================================================

async def validate_with_ralph_loop(
    raw_signals: List[Dict[str, Any]],
    entity_id: str,
    claude_client=None,
    graphiti_service=None
) -> List['Signal']:
    """
    Convenience function to run Ralph Loop validation

    Args:
        raw_signals: Raw signal data from scrapers
        entity_id: Entity identifier
        claude_client: Optional ClaudeClient (creates default if not provided)
        graphiti_service: Optional GraphitiService (creates default if not provided)

    Returns:
        List of validated Signal objects
    """
    from backend.claude_client import ClaudeClient
    from backend.graphiti_service import GraphitiService

    # Initialize clients if not provided
    if not claude_client:
        claude_client = ClaudeClient()

    if not graphiti_service:
        graphiti_service = GraphitiService()
        await graphiti_service.initialize()

    # Run Ralph Loop
    ralph = RalphLoop(claude_client, graphiti_service)
    validated = await ralph.validate_signals(raw_signals, entity_id)

    return validated


if __name__ == "__main__":
    # Test Ralph Loop
    import asyncio

    async def test():
        from backend.claude_client import ClaudeClient
        from backend.graphiti_service import GraphitiService
        from backend.schemas import SignalType

        # Initialize
        claude = ClaudeClient()
        graphiti = GraphitiService()
        await graphiti.initialize()

        # Create test signals
        raw_signals = [
            {
                "id": "test-signal-001",
                "type": "RFP_DETECTED",
                "confidence": 0.85,
                "entity_id": "test-entity",
                "evidence": [
                    {"source": "LinkedIn", "credibility_score": 0.8},
                    {"source": "Perplexity", "credibility_score": 0.7},
                    {"source": "Crunchbase", "credibility_score": 0.9}
                ]
            },
            {
                "id": "test-signal-002",
                "type": "RFP_DETECTED",
                "confidence": 0.6,  # Below threshold
                "entity_id": "test-entity",
                "evidence": [
                    {"source": "LinkedIn", "credibility_score": 0.8}
                ]  # Only 1 evidence
            }
        ]

        # Run Ralph Loop
        ralph = RalphLoop(claude, graphiti)
        validated = await ralph.validate_signals(raw_signals, "test-entity")

        print(f"\n✅ Ralph Loop test complete: {len(validated)} signals validated")

        graphiti.close()

    asyncio.run(test())
