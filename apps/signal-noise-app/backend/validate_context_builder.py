#!/usr/bin/env python3
"""
Validation Test: Context Builder Accuracy Improvement

Tests hypothesis-driven discovery with structured context builder on Arsenal FC
to measure accuracy improvements in Claude evaluation decisions.

Metrics:
- ACCEPT accuracy (correct vs incorrect ACCEPT decisions)
- False positive rate (ACCEPT when should be WEAK_ACCEPT/REJECT)
- Justification quality (specific evidence quotes vs generic)
- Iterations to confidence >0.70
- Average confidence delta per ACCEPT
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any
from dataclasses import dataclass, field

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class ValidationMetrics:
    """Metrics from validation test"""
    entity_id: str
    entity_name: str
    total_iterations: int
    final_confidence: float
    confidence_band: str

    # Decision counts
    accept_count: int = 0
    weak_accept_count: int = 0
    reject_count: int = 0
    no_progress_count: int = 0

    # Justification quality
    justifications_with_quotes: int = 0
    justifications_with_urls: int = 0
    justifications_generic: int = 0

    # Confidence metrics
    avg_accept_delta: float = 0.0
    avg_weak_accept_delta: float = 0.0
    total_confidence_increase: float = 0.0

    # Convergence
    iterations_to_070: int = 0  # Iterations to reach 0.70 confidence
    max_confidence_reached: float = 0.0

    # Errors
    claude_errors: int = 0

    # Raw data for analysis
    iteration_details: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'total_iterations': self.total_iterations,
            'final_confidence': self.final_confidence,
            'confidence_band': self.confidence_band,

            'accept_count': self.accept_count,
            'weak_accept_count': self.weak_accept_count,
            'reject_count': self.reject_count,
            'no_progress_count': self.no_progress_count,

            'justifications_with_quotes': self.justifications_with_quotes,
            'justifications_with_urls': self.justifications_with_urls,
            'justifications_generic': self.justifications_generic,

            'avg_accept_delta': self.avg_accept_delta,
            'avg_weak_accept_delta': self.avg_weak_accept_delta,
            'total_confidence_increase': self.total_confidence_increase,

            'iterations_to_070': self.iterations_to_070,
            'max_confidence_reached': self.max_confidence_reached,

            'claude_errors': self.claude_errors,

            'iteration_details': self.iteration_details
        }


class ContextBuilderValidator:
    """Validates context builder implementation"""

    def __init__(self):
        """Initialize validator"""
        self.metrics = None

    async def run_validation(
        self,
        entity_id: str = "arsenal-fc",
        entity_name: str = "Arsenal FC",
        template_id: str = "tier_1_club_centralized_procurement",
        max_iterations: int = 15
    ) -> ValidationMetrics:
        """
        Run validation test on entity

        Args:
            entity_id: Entity identifier
            entity_name: Human-readable entity name
            template_id: Template to use
            max_iterations: Maximum iterations to run

        Returns:
            ValidationMetrics with detailed results
        """
        logger.info(f"{'='*60}")
        logger.info(f"Validation Test: Context Builder Accuracy")
        logger.info(f"{'='*60}")
        logger.info(f"Entity: {entity_name} ({entity_id})")
        logger.info(f"Template: {template_id}")
        logger.info(f"Max Iterations: {max_iterations}")
        logger.info(f"{'='*60}\n")

        # Initialize clients
        from claude_client import ClaudeClient
        from brightdata_sdk_client import BrightDataSDKClient
        from hypothesis_driven_discovery import HypothesisDrivenDiscovery

        claude_client = ClaudeClient()
        brightdata_client = BrightDataSDKClient()

        # Create discovery instance
        discovery = HypothesisDrivenDiscovery(
            claude_client=claude_client,
            brightdata_client=brightdata_client,
            cache_enabled=False  # Disable cache for validation
        )

        # Track metrics
        metrics = ValidationMetrics(
            entity_id=entity_id,
            entity_name=entity_name,
            total_iterations=0,
            final_confidence=0.0,
            confidence_band="EXPLORATORY"
        )

        # Patch _evaluate_content_with_claude to capture metrics
        original_evaluate = discovery._evaluate_content_with_claude

        async def tracked_evaluate(content: str, hypothesis, hop_type):
            """Wrapper to track evaluation metrics"""
            # Call original method
            result = await original_evaluate(content, hypothesis, hop_type)

            # Track metrics
            decision = result.get('decision', 'NO_PROGRESS')

            if decision == 'ACCEPT':
                metrics.accept_count += 1
            elif decision == 'WEAK_ACCEPT':
                metrics.weak_accept_count += 1
            elif decision == 'REJECT':
                metrics.reject_count += 1
            else:
                metrics.no_progress_count += 1

            # Analyze justification quality
            justification = result.get('justification', '')
            if '"' in justification or "'" in justification:
                metrics.justifications_with_quotes += 1
            if 'http' in justification:
                metrics.justifications_with_urls += 1
            elif len(justification) < 30 or justification in ['Parse error', 'Evaluation error', '']:
                metrics.justifications_generic += 1

            # Track confidence deltas
            delta = result.get('confidence_delta', 0.0)
            if decision == 'ACCEPT':
                if metrics.accept_count == 1:
                    metrics.avg_accept_delta = delta
                else:
                    metrics.avg_accept_delta = (
                        (metrics.avg_accept_delta * (metrics.accept_count - 1) + delta) /
                        metrics.accept_count
                    )
            elif decision == 'WEAK_ACCEPT':
                if metrics.weak_accept_count == 1:
                    metrics.avg_weak_accept_delta = delta
                else:
                    metrics.avg_weak_accept_delta = (
                        (metrics.avg_weak_accept_delta * (metrics.weak_accept_count - 1) + delta) /
                        metrics.weak_accept_count
                    )

            # Track iteration details
            iteration_detail = {
                'decision': decision,
                'confidence_delta': delta,
                'justification': justification,
                'evidence_found': result.get('evidence_found', ''),
                'evidence_type': result.get('evidence_type'),
                'hop_type': hop_type.value if hasattr(hop_type, 'value') else str(hop_type),
                'has_quote': '"' in justification or "'" in justification,
                'justification_length': len(justification)
            }
            metrics.iteration_details.append(iteration_detail)

            logger.info(f"  → {decision}: +{delta:.2f} | \"{justification[:80]}...\"")

            return result

        # Apply patch
        discovery._evaluate_content_with_claude = tracked_evaluate

        # Run discovery
        logger.info("\n🔍 Starting hypothesis-driven discovery...\n")

        try:
            result = await discovery.run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                template_id=template_id,
                max_iterations=max_iterations,
                max_depth=7
            )

            # Extract final metrics
            metrics.total_iterations = result.iterations_completed
            metrics.final_confidence = result.final_confidence
            metrics.confidence_band = result.confidence_band
            metrics.max_confidence_reached = result.final_confidence
            metrics.total_confidence_increase = result.final_confidence - 0.5  # Starting confidence

            # Calculate iterations to 0.70
            current_conf = 0.5
            for i, detail in enumerate(metrics.iteration_details, 1):
                current_conf += detail['confidence_delta']
                if current_conf >= 0.70 and metrics.iterations_to_070 == 0:
                    metrics.iterations_to_070 = i
                    logger.info(f"\n✅ Reached 0.70 confidence at iteration {i}")

            logger.info(f"\n✅ Discovery complete: {result.final_confidence:.2f} ({result.confidence_band})")

        except Exception as e:
            logger.error(f"❌ Discovery failed: {e}")
            metrics.claude_errors += 1

        finally:
            # Restore original method
            discovery._evaluate_content_with_claude = original_evaluate

        self.metrics = metrics
        return metrics

    def print_report(self, metrics: ValidationMetrics = None):
        """Print validation report"""
        if metrics is None:
            metrics = self.metrics

        if metrics is None:
            logger.warning("No metrics to report")
            return

        print(f"\n{'='*60}")
        print(f"VALIDATION REPORT: Context Builder Accuracy")
        print(f"{'='*60}")
        print(f"\nEntity: {metrics.entity_name} ({metrics.entity_id})")
        print(f"Total Iterations: {metrics.total_iterations}")
        print(f"Final Confidence: {metrics.final_confidence:.2f}")
        print(f"Confidence Band: {metrics.confidence_band}")

        print(f"\n{'─'*60}")
        print(f"DECISION BREAKDOWN")
        print(f"{'─'*60}")
        print(f"ACCEPT:       {metrics.accept_count:3d} ({metrics.accept_count/max(metrics.total_iterations,1)*100:.1f}%)")
        print(f"WEAK_ACCEPT:  {metrics.weak_accept_count:3d} ({metrics.weak_accept_count/max(metrics.total_iterations,1)*100:.1f}%)")
        print(f"REJECT:       {metrics.reject_count:3d} ({metrics.reject_count/max(metrics.total_iterations,1)*100:.1f}%)")
        print(f"NO_PROGRESS:  {metrics.no_progress_count:3d} ({metrics.no_progress_count/max(metrics.total_iterations,1)*100:.1f}%)")

        print(f"\n{'─'*60}")
        print(f"JUSTIFICATION QUALITY")
        print(f"{'─'*60}")
        total_with_evidence = metrics.justifications_with_quotes + metrics.justifications_with_urls
        total_decisions = metrics.accept_count + metrics.weak_accept_count + metrics.reject_count
        print(f"With Quotes:      {metrics.justifications_with_quotes:3d} / {total_decisions} ({metrics.justifications_with_quotes/max(total_decisions,1)*100:.1f}%)")
        print(f"With URLs:        {metrics.justifications_with_urls:3d} / {total_decisions} ({metrics.justifications_with_urls/max(total_decisions,1)*100:.1f}%)")
        print(f"Generic/Error:    {metrics.justifications_generic:3d} / {total_decisions} ({metrics.justifications_generic/max(total_decisions,1)*100:.1f}%)")
        print(f"Evidence Quality: {total_with_evidence:3d} / {total_decisions} ({total_with_evidence/max(total_decisions,1)*100:.1f}%)")

        print(f"\n{'─'*60}")
        print(f"CONFIDENCE METRICS")
        print(f"{'─'*60}")
        print(f"Avg ACCEPT Delta:      {metrics.avg_accept_delta:.3f}")
        print(f"Avg WEAK_ACCEPT Delta: {metrics.avg_weak_accept_delta:.3f}")
        print(f"Total Confidence Inc:  {metrics.total_confidence_increase:.3f}")
        print(f"Max Confidence:        {metrics.max_confidence_reached:.2f}")

        if metrics.iterations_to_070 > 0:
            print(f"\n{'─'*60}")
            print(f"CONVERGENCE")
            print(f"{'─'*60}")
            print(f"Iterations to 0.70: {metrics.iterations_to_070}")

        print(f"\n{'='*60}")

    def save_results(self, filepath: str, metrics: ValidationMetrics = None):
        """Save validation results to JSON"""
        if metrics is None:
            metrics = self.metrics

        if metrics is None:
            logger.warning("No metrics to save")
            return

        with open(filepath, 'w') as f:
            json.dump({
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'metrics': metrics.to_dict()
            }, f, indent=2)

        logger.info(f"✅ Results saved to {filepath}")


async def main():
    """Main validation test"""
    validator = ContextBuilderValidator()

    # Run validation on Arsenal FC
    metrics = await validator.run_validation(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        template_id="tier_1_club_centralized_procurement",
        max_iterations=15
    )

    # Print report
    validator.print_report(metrics)

    # Save results
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    results_file = f"data/context_builder_validation_arsenal_{timestamp}.json"
    validator.save_results(results_file, metrics)

    # Print summary of key metrics
    print(f"\n{'='*60}")
    print(f"KEY METRICS SUMMARY")
    print(f"{'='*60}")
    print(f"✅ Final Confidence: {metrics.final_confidence:.2f}")
    print(f"✅ Evidence Quality: {metrics.justifications_with_quotes + metrics.justifications_with_urls} / {metrics.accept_count + metrics.weak_accept_count + metrics.reject_count} justifications with evidence")
    print(f"✅ ACCEPT Rate: {metrics.accept_count} / {metrics.total_iterations} iterations ({metrics.accept_count/max(metrics.total_iterations,1)*100:.1f}%)")

    if metrics.iterations_to_070 > 0:
        print(f"✅ Convergence: {metrics.iterations_to_070} iterations to 0.70 confidence")
    else:
        print(f"⚠️  Did not reach 0.70 confidence")

    print(f"\n📊 Results saved to: {results_file}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(main())
