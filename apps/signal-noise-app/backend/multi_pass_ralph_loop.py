#!/usr/bin/env python3
"""
Multi-Pass Ralph Loop Coordinator

Coordinates multi-pass discovery using Ralph Loop for validation.

Each pass:
1. Uses highest confidence hypotheses from previous pass
2. Performs deterministic exploration (single-hop)
3. Validates signals with 3-pass Ralph Loop
4. Generates new hypotheses based on findings
5. Updates confidence scores

Usage:
    from multi_pass_ralph_loop import MultiPassRalphCoordinator

    coordinator = MultiPassRalphCoordinator()
    result = await coordinator.run_multi_pass_discovery(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        yp_template_id="yellow_panther_agency",
        max_passes=4
    )
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class MultiPassResult:
    """Results from multi-pass discovery"""
    entity_id: str
    entity_name: str
    pass_results: List['PassResult']
    evolved_hypotheses: List['Hypothesis']
    final_confidence: float
    total_cost: float
    total_iterations: int
    duration_seconds: float

    # Summary statistics
    total_signals_detected: int = 0
    high_confidence_signals: int = 0
    unique_categories: int = 0


@dataclass
class PassResult:
    """Results from a single pass"""
    pass_number: int
    discovery_result: 'DiscoveryResult'
    strategy: 'PassStrategy'
    raw_signals: List[Dict] = field(default_factory=list)
    validated_signals: List['Signal'] = field(default_factory=list)
    hypotheses_tested: List[str] = field(default_factory=list)
    confidence_delta: float = 0.0


class MultiPassRalphCoordinator:
    """
    Coordinates multi-pass discovery using Ralph Loop for validation

    Responsibilities:
    - Run multi-pass discovery with evolving hypotheses
    - Validate signals with Ralph Loop each pass
    - Generate new hypotheses between passes
    - Track confidence evolution
    """

    def __init__(self):
        """Initialize coordinator"""
        from ralph_loop import RalphLoop
        from graphiti_service import GraphitiService
        from claude_client import ClaudeClient
        from multi_pass_context import MultiPassContext
        from hypothesis_manager import HypothesisManager

        self.claude_client = ClaudeClient()
        self.graphiti_service = GraphitiService()
        self.ralph_loop = RalphLoop(self.claude_client, self.graphiti_service)
        self.context_manager = MultiPassContext()
        self.hypothesis_manager = HypothesisManager()

        # BrightData client for web scraping
        from brightdata_sdk_client import BrightDataSDKClient
        self.brightdata_client = BrightDataSDKClient()

        logger.info("🔄 MultiPassRalphCoordinator initialized")

    async def run_multi_pass_discovery(
        self,
        entity_id: str,
        entity_name: str,
        yp_template_id: str,
        max_passes: int = 4,
        dossier: Optional['EntityDossier'] = None
    ) -> MultiPassResult:
        """
        Run multi-pass discovery for entity

        Flow:
        1. Initialize hypotheses (dossier-informed if available)
        2. Run discovery passes
        3. Each pass informed by: temporal patterns, graph relationships
        4. Generate new hypotheses between passes
        5. Return final opportunities with confidence scores

        Args:
            entity_id: Entity identifier
            entity_name: Entity display name
            yp_template_id: Yellow Panther template ID
            max_passes: Maximum number of passes to run
            dossier: Optional entity dossier for hypothesis generation

        Returns:
            MultiPassResult with all pass data and final confidence
        """
        start_time = datetime.now(timezone.utc)

        logger.info(f"\n{'='*80}")
        logger.info(f"MULTI-PASS RFP DISCOVERY: {entity_name}")
        logger.info(f"{'='*80}\n")

        # Initialize services
        await self.graphiti_service.initialize()

        all_pass_results = []
        evolved_hypotheses = []

        # Step 1: Generate initial hypotheses
        if dossier:
            logger.info("Step 1: Generating dossier-informed hypotheses...")
            from dossier_hypothesis_generator import DossierHypothesisGenerator

            hyp_gen = DossierHypothesisGenerator()
            initial_hypotheses = await hyp_gen.generate_hypotheses_from_dossier(
                dossier=dossier,
                entity_id=entity_id
            )

            logger.info(f"  ✅ Generated {len(initial_hypotheses)} dossier-informed hypotheses")
        else:
            logger.info("Step 1: Loading template-based hypotheses...")
            initial_hypotheses = await self.hypothesis_manager.initialize_hypotheses(
                template_id=yp_template_id,
                entity_id=entity_id,
                entity_name=entity_name
            )

            logger.info(f"  ✅ Loaded {len(initial_hypotheses)} template-based hypotheses")

        # Step 2: Run multi-pass discovery
        logger.info(f"\nStep 2: Running {max_passes}-pass discovery...\n")

        for pass_num in range(1, max_passes + 1):
            logger.info(f"\n{'='*80}")
            logger.info(f"PASS {pass_num}: Starting discovery")
            logger.info(f"{'='*80}\n")

            # Get pass strategy
            strategy = await self.context_manager.get_pass_strategy(
                entity_id=entity_id,
                entity_name=entity_name,
                pass_number=pass_num,
                previous_results=all_pass_results
            )

            # Select hypotheses for this pass
            if pass_num == 1:
                hypotheses = initial_hypotheses
                logger.info(f"Testing {len(hypotheses)} initial hypotheses")
            else:
                hypotheses = await self._select_evolved_hypotheses(
                    entity_id,
                    all_pass_results,
                    pass_num
                )
                logger.info(f"Testing {len(hypotheses)} evolved hypotheses")

            if not hypotheses:
                logger.warning(f"No hypotheses to test in Pass {pass_num}")
                break

            # Run discovery with this pass's hypotheses
            pass_result = await self._run_single_pass(
                entity_id=entity_id,
                entity_name=entity_name,
                hypotheses=hypotheses,
                strategy=strategy,
                pass_number=pass_num,
                yp_template_id=yp_template_id
            )

            all_pass_results.append(pass_result)

            logger.info(f"\n✅ Pass {pass_num} Results:")
            logger.info(f"   Signals detected: {len(pass_result.validated_signals)}")
            logger.info(f"   High confidence (>0.7): {len([s for s in pass_result.validated_signals if s.confidence > 0.7])}")
            logger.info(f"   Confidence delta: {pass_result.confidence_delta:+.3f}")

            # Generate new hypotheses based on validated signals
            if pass_num < max_passes:
                new_hypotheses = await self._generate_next_pass_hypotheses(
                    pass_result.validated_signals,
                    entity_id,
                    pass_num
                )

                if new_hypotheses:
                    evolved_hypotheses.extend(new_hypotheses)
                    logger.info(f"  ✅ Generated {len(new_hypotheses)} new hypotheses for Pass {pass_num + 1}")

            # Check stopping conditions
            if await self._should_stop_discovery(all_pass_results, pass_num):
                logger.info(f"\n🛑 Stopping discovery early (stopping conditions met)")
                break

        # Calculate final results
        end_time = datetime.now(timezone.utc)
        duration_seconds = (end_time - start_time).total_seconds()

        final_confidence = self._calculate_final_confidence(all_pass_results)
        total_cost = sum(pr.discovery_result.total_cost_usd for pr in all_pass_results)
        total_iterations = sum(pr.discovery_result.iterations_completed for pr in all_pass_results)

        # Gather statistics
        all_signals = []
        categories = set()

        for pr in all_pass_results:
            all_signals.extend(pr.validated_signals)
            for signal in pr.validated_signals:
                if hasattr(signal, 'category'):
                    categories.add(signal.category)

        result = MultiPassResult(
            entity_id=entity_id,
            entity_name=entity_name,
            pass_results=all_pass_results,
            evolved_hypotheses=evolved_hypotheses,
            final_confidence=final_confidence,
            total_cost=total_cost,
            total_iterations=total_iterations,
            duration_seconds=duration_seconds,
            total_signals_detected=len(all_signals),
            high_confidence_signals=len([s for s in all_signals if s.confidence > 0.7]),
            unique_categories=len(categories)
        )

        logger.info(f"\n{'='*80}")
        logger.info(f"MULTI-PASS DISCOVERY COMPLETE: {entity_name}")
        logger.info(f"{'='*80}")
        logger.info(f"Final Confidence: {final_confidence:.3f}")
        logger.info(f"Total Signals: {result.total_signals_detected}")
        logger.info(f"High Confidence: {result.high_confidence_signals}")
        logger.info(f"Unique Categories: {result.unique_categories}")
        logger.info(f"Total Cost: ${total_cost:.2f}")
        logger.info(f"Duration: {duration_seconds:.1f}s")
        logger.info(f"{'='*80}\n")

        return result

    async def _run_single_pass(
        self,
        entity_id: str,
        entity_name: str,
        hypotheses: List['Hypothesis'],
        strategy: 'PassStrategy',
        pass_number: int,
        yp_template_id: str
    ) -> PassResult:
        """
        Run a single discovery pass

        Args:
            entity_id: Entity identifier
            entity_name: Entity display name
            hypotheses: Hypotheses to test
            strategy: Pass strategy
            pass_number: Pass number

        Returns:
            PassResult with discovered and validated signals
        """
        from hypothesis_driven_discovery import HypothesisDrivenDiscovery

        logger.info(f"Running Pass {pass_number} discovery...")
        logger.info(f"  Focus areas: {', '.join(strategy.focus_areas[:3])}")
        logger.info(f"  Max iterations: {strategy.max_iterations}")
        logger.info(f"  Depth limit: {strategy.depth_limit}")

        # Initialize discovery system
        discovery = HypothesisDrivenDiscovery(
            claude_client=self.claude_client,
            brightdata_client=self.brightdata_client
        )

        # Run discovery
        # Note: Hypotheses should already be loaded in HypothesisManager via initialize_hypotheses()
        discovery_result = await discovery.run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            template_id=yp_template_id,  # Use template_id, not hypotheses
            max_iterations=strategy.max_iterations,
            max_depth=strategy.depth_limit
        )

        # Extract raw signals from DiscoveryResult
        raw_signals = discovery_result.signals_discovered

        # Validate signals with Ralph Loop
        logger.info(f"Validating {len(raw_signals)} signals with Ralph Loop...")
        validated_signals = await self.ralph_loop.validate_signals(
            raw_signals=raw_signals,
            entity_id=entity_id
        )

        # Calculate confidence delta
        old_confidence = hypotheses[0].confidence if hypotheses else 0.5
        new_confidence = discovery_result.final_confidence
        confidence_delta = new_confidence - old_confidence

        # Track hypothesis updates
        hypotheses_tested = [h.hypothesis_id for h in hypotheses]

        return PassResult(
            pass_number=pass_number,
            discovery_result=discovery_result,
            strategy=strategy,
            raw_signals=raw_signals,
            validated_signals=validated_signals,
            hypotheses_tested=hypotheses_tested,
            confidence_delta=confidence_delta
        )

    async def _select_evolved_hypotheses(
        self,
        entity_id: str,
        all_pass_results: List[PassResult],
        pass_number: int
    ) -> List['Hypothesis']:
        """
        Select hypotheses for next pass based on confidence scores

        Strategy:
        - Prioritize hypotheses from highest-confidence signals in previous pass
        - Include new hypotheses generated from discoveries
        - Drop hypotheses that saturated (3 REJECTs)

        Args:
            entity_id: Entity identifier
            all_pass_results: All previous pass results
            pass_number: Current pass number

        Returns:
            Hypotheses for this pass
        """
        from schemas import Hypothesis

        previous_pass = all_pass_results[-1]

        # Get top confidence signals
        top_signals = sorted(
            previous_pass.validated_signals,
            key=lambda s: s.confidence,
            reverse=True
        )[:10]

        # Convert signals to hypotheses
        signal_hypotheses = []

        for signal in top_signals:
            # Skip low-confidence signals
            if signal.confidence < 0.5:
                continue

            hypothesis = Hypothesis(
                hypothesis_id=f"{entity_id}_{signal.type.value}_{pass_number}",
                entity_id=entity_id,
                category=signal.subtype.value if signal.subtype else signal.type.value,
                statement=f"Hypothesis from {signal.type.value} signal (pass {pass_number})",
                prior_probability=signal.confidence,
                confidence=signal.confidence,
                metadata={
                    'derived_from_signal': signal.id,
                    'source_pass': pass_number,
                    'evidence_count': len(signal.evidence) if hasattr(signal, 'evidence') else 0,
                    'generation_method': 'signal_evolution'
                }
            )

            signal_hypotheses.append(hypothesis)

        logger.info(f"  Selected {len(signal_hypotheses)} signal-based hypotheses")

        return signal_hypotheses

    async def _generate_next_pass_hypotheses(
        self,
        validated_signals: List['Signal'],
        entity_id: str,
        pass_number: int
    ) -> List['Hypothesis']:
        """
        Generate new hypotheses for next pass based on discoveries

        Examples:
        - Pass 1 finds "React Developer" job → Pass 2: "React Mobile App RFP"
        - Pass 1 finds "Digital transformation" → Pass 2: "CRM Platform RFP"
        - Pass 2 finds "Salesforce CRM" → Pass 3: "Salesforce Migration RFP"

        Args:
            validated_signals: Validated signals from this pass
            entity_id: Entity identifier
            pass_number: Current pass number

        Returns:
            New hypotheses for next pass
        """
        from schemas import Hypothesis

        new_hypotheses = []

        for signal in validated_signals:
            # Generate follow-up hypotheses based on signal type
            signal_type = signal.type.value if hasattr(signal, 'type') else 'UNKNOWN'
            keywords = signal.metadata.get('keywords', []) if hasattr(signal, 'metadata') else []

            # Rule-based hypothesis generation
            if signal_type == 'JOB_POSTING':
                # Job posting → technology-specific RFP hypothesis
                if any('react' in kw.lower() for kw in keywords):
                    new_hypothesis = Hypothesis(
                        hypothesis_id=f"{entity_id}_react_mobile_rfp",
                        entity_id=entity_id,
                        category="Mobile Development",
                        statement=f"{entity_id} seeking React Native mobile app development",
                        prior_probability=signal.confidence * 1.1,  # Boost from parent signal
                        confidence=min(1.0, signal.confidence * 1.1),
                        metadata={
                            'derived_from_signal': signal.id,
                            'derived_from_pass': pass_number,
                            'generation_type': 'follow_up',
                            'parent_confidence': signal.confidence
                        }
                    )

                    new_hypotheses.append(new_hypothesis)

            elif signal_type == 'CRM_ANALYTICS':
                # CRM/analytics signal → platform expansion hypothesis
                new_hypothesis = Hypothesis(
                    hypothesis_id=f"{entity_id}_crm_platform_rfp",
                    entity_id=entity_id,
                    category="CRM Platform",
                    statement=f"{entity_id} seeking CRM platform expansion or migration",
                    prior_probability=signal.confidence * 1.05,
                    confidence=min(1.0, signal.confidence * 1.05),
                    metadata={
                        'derived_from_signal': signal.id,
                        'derived_from_pass': pass_number,
                        'generation_type': 'follow_up',
                        'parent_confidence': signal.confidence
                    }
                )

                new_hypotheses.append(new_hypothesis)

            elif signal_type == 'DIGITAL_TRANSFORMATION':
                # Digital transformation → multiple platform hypotheses
                for platform in ['E-commerce', 'Fan Engagement', 'Data Platform']:
                    new_hypothesis = Hypothesis(
                        hypothesis_id=f"{entity_id}_{platform.lower().replace(' ', '_')}_rfp",
                        entity_id=entity_id,
                        category=platform,
                        statement=f"{entity_id} seeking {platform} as part of digital transformation",
                        prior_probability=signal.confidence * 0.9,
                        confidence=min(1.0, signal.confidence * 0.9),
                        metadata={
                            'derived_from_signal': signal.id,
                            'derived_from_pass': pass_number,
                            'generation_type': 'platform_expansion',
                            'parent_confidence': signal.confidence,
                            'parent_category': 'Digital Transformation'
                        }
                    )

                    new_hypotheses.append(new_hypothesis)

        logger.info(f"  Generated {len(new_hypotheses)} follow-up hypotheses")

        return new_hypotheses

    async def _should_stop_discovery(
        self,
        all_pass_results: List[PassResult],
        current_pass: int
    ) -> bool:
        """
        Check if discovery should stop early

        Stopping conditions:
        - Confidence saturation (<0.01 gain over last 2 passes)
        - Signal exhaustion (no new signals in last pass)
        - High confidence plateau (>0.85 with minimal gain)

        Args:
            all_pass_results: All pass results so far
            current_pass: Current pass number

        Returns:
            True if should stop, False otherwise
        """
        if len(all_pass_results) < 2:
            return False

        # Check confidence saturation
        recent_deltas = [pr.confidence_delta for pr in all_pass_results[-2:]]

        if all(abs(delta) < 0.01 for delta in recent_deltas):
            logger.info(f"  Confidence saturation detected (<0.01 gain)")
            return True

        # Check signal exhaustion
        last_pass = all_pass_results[-1]
        if len(last_pass.validated_signals) == 0:
            logger.info(f"  No signals detected in last pass")
            return True

        # Check high confidence plateau
        if len(all_pass_results) >= 2:
            avg_confidence = sum(
                pr.discovery_result.final_confidence
                for pr in all_pass_results[-2:]
            ) / 2.0

            if avg_confidence > 0.85 and all(abs(pr.confidence_delta) < 0.02 for pr in all_pass_results[-2:]):
                logger.info(f"  High confidence plateau detected (>0.85, minimal gain)")
                return True

        return False

    def _calculate_final_confidence(self, all_pass_results: List[PassResult]) -> float:
        """
        Calculate final confidence from all passes

        Uses weighted average of recent passes (more recent = higher weight)

        Args:
            all_pass_results: All pass results

        Returns:
            Final confidence score
        """
        if not all_pass_results:
            return 0.5

        # Weight recent passes more heavily
        weights = [i + 1 for i in range(len(all_pass_results))]
        total_weight = sum(weights)

        weighted_sum = 0.0

        for i, result in enumerate(all_pass_results):
            confidence = result.discovery_result.final_confidence
            weighted_sum += confidence * weights[i]

        final_confidence = weighted_sum / total_weight if total_weight > 0 else 0.5

        return max(0.0, min(1.0, final_confidence))


# =============================================================================
# Convenience Functions
# =============================================================================

async def run_multi_pass_discovery(
    entity_id: str,
    entity_name: str,
    yp_template_id: str = "yellow_panther_agency",
    max_passes: int = 4,
    dossier: Optional['EntityDossier'] = None
) -> MultiPassResult:
    """
    Convenience function to run multi-pass discovery

    Args:
        entity_id: Entity identifier
        entity_name: Entity display name
        yp_template_id: Yellow Panther template ID
        max_passes: Maximum number of passes
        dossier: Optional entity dossier

    Returns:
        MultiPassResult with all findings
    """
    coordinator = MultiPassRalphCoordinator()
    return await coordinator.run_multi_pass_discovery(
        entity_id=entity_id,
        entity_name=entity_name,
        yp_template_id=yp_template_id,
        max_passes=max_passes,
        dossier=dossier
    )


if __name__ == "__main__":
    # Test multi-pass Ralph Loop
    import asyncio

    async def test():
        print("=== Testing Multi-Pass Ralph Loop ===\n")

        coordinator = MultiPassRalphCoordinator()

        # Run discovery (without dossier for now)
        result = await coordinator.run_multi_pass_discovery(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            yp_template_id="yellow_panther_agency",
            max_passes=2  # Limited for testing
        )

        print(f"\n✅ Multi-Pass Discovery Complete:")
        print(f"   Final Confidence: {result.final_confidence:.3f}")
        print(f"   Total Signals: {result.total_signals_detected}")
        print(f"   High Confidence: {result.high_confidence_signals}")
        print(f"   Total Cost: ${result.total_cost:.2f}")
        print(f"   Duration: {result.duration_seconds:.1f}s")

        print("\n✅ Test complete")

    asyncio.run(test())
