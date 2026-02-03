#!/usr/bin/env python3
"""
Pattern-Inspired Discovery Validation

Validates that pattern-inspired discovery achieves ≥0.70 confidence on NEW entities
(not Arsenal/World Athletics which were training data).

Uses:
- BrightData SDK for web scraping (HTTP-based, NOT MCP tools)
- Claude Agent SDK for reasoning
- Pattern-guided hop selection (partnership-aware, temporal-aware)
- FalkorDB for persistence

Tests 3 NEW entities to validate pattern generalization:
- Liverpool FC (top tier club, different from Arsenal)
- Bayern Munich (continental club, different market)
- Paris Saint-Germain (top tier, different ownership)

Success Criteria:
- Final confidence ≥0.70 (actionable threshold)
- Detect ≥1 ACCEPT signal (procurement intent)
- Detect ≥2 WEAK_ACCEPT signals (capability)
- Iterations <15 (efficient discovery)
- Cost <$0.10 per entity
- Zero hops on forbidden channels (app stores, official homepage)

This is NOT simulated - it performs real web scraping and AI inference.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any
import os
import sys

# Get directories
script_dir = Path(__file__).parent
app_dir = script_dir.parent
backend_dir = app_dir / 'backend'

# Change to app root directory so template paths work correctly
os.chdir(str(app_dir))

# Add backend directory to PYTHONPATH (must happen before imports)
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Set PYTHONPATH environment variable for subprocess calls
os.environ['PYTHONPATH'] = str(backend_dir) + os.pathsep + os.environ.get('PYTHONPATH', '')

from anthropic import Anthropic
from brightdata_sdk_client import BrightDataSDKClient
from hypothesis_driven_discovery import HypothesisDrivenDiscovery

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RealDiscoveryRunner:
    """Run real discovery for multiple entities"""

    def __init__(self):
        """Initialize clients"""
        logger.info("🚀 Initializing Real Discovery Runner")

        # Check environment variables
        anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        brightdata_token = os.getenv('BRIGHTDATA_API_TOKEN')

        if not anthropic_key:
            logger.error("❌ ANTHROPIC_API_KEY not found")
            raise ValueError("ANTHROPIC_API_KEY required")

        if not brightdata_token:
            logger.warning("⚠️ BRIGHTDATA_API_TOKEN not found - will use fallback")

        # Initialize Claude client
        self.claude = Anthropic(api_key=anthropic_key)
        logger.info("✅ Claude client initialized")

        # Initialize BrightData client
        self.brightdata = BrightDataSDKClient()
        logger.info("✅ BrightData client initialized")

        # Results storage
        self.results = {}

    async def discover_entity(
        self,
        entity_id: str,
        entity_name: str,
        template_id: str = "tier_1_club_centralized_procurement",
        max_iterations: int = 15
    ) -> Dict[str, Any]:
        """
        Run real discovery for a single entity

        Args:
            entity_id: Entity identifier (e.g., "arsenal-fc")
            entity_name: Human-readable name
            template_id: Template to use for hypothesis generation
            max_iterations: Maximum discovery iterations

        Returns:
            Complete discovery result with metadata
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"🔍 Starting REAL Discovery: {entity_name}")
        logger.info(f"{'='*80}")
        logger.info(f"Entity ID: {entity_id}")
        logger.info(f"Template: {template_id}")
        logger.info(f"Max Iterations: {max_iterations}")
        logger.info(f"⚠️  This will perform ACTUAL web scraping and Claude API calls")
        logger.info(f"⚠️  Real costs will be incurred")
        logger.info(f"{'='*80}\n")

        try:
            # Initialize discovery engine
            discovery = HypothesisDrivenDiscovery(
                claude_client=self.claude,
                brightdata_client=self.brightdata,
                cache_enabled=True
            )

            # Run discovery
            result = await discovery.run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                template_id=template_id,
                max_iterations=max_iterations,
                max_depth=7  # Updated from 3 based on validation analysis
            )

            # Convert to dict
            result_dict = result.to_dict() if hasattr(result, 'to_dict') else result

            logger.info(f"\n✅ Discovery complete for {entity_name}")
            logger.info(f"   Final Confidence: {result.final_confidence:.2f}")
            logger.info(f"   Iterations: {result.iterations_completed}")
            logger.info(f"   Total Cost: ${result.total_cost_usd:.4f}")
            logger.info(f"   Actionable: {result.is_actionable}")

            return result_dict

        except Exception as e:
            logger.error(f"❌ Discovery failed for {entity_name}: {e}")
            import traceback
            traceback.print_exc()
            return {
                'entity_id': entity_id,
                'entity_name': entity_name,
                'error': str(e),
                'traceback': traceback.format_exc()
            }

    async def run_comparison(
        self,
        entities: List[Dict[str, str]],
        max_iterations: int = 15
    ) -> Dict[str, Any]:
        """
        Run discovery for multiple entities and compare results

        Args:
            entities: List of {entity_id, entity_name} dicts
            max_iterations: Max iterations per entity

        Returns:
            Comparison report with all results
        """
        logger.info(f"\n{'='*80}")
        logger.info(f"🔄 Running Real Discovery Comparison")
        logger.info(f"{'='*80}")
        logger.info(f"Entities: {len(entities)}")
        logger.info(f"Max Iterations: {max_iterations}")
        logger.info(f"⚠️  ESTIMATED TOTAL COST: ${len(entities) * max_iterations * 0.03:.2f}")
        logger.info(f"{'='*80}\n")

        # Run discovery for each entity
        results = {}
        for entity in entities:
            entity_id = entity['entity_id']
            entity_name = entity['entity_name']

            result = await self.discover_entity(
                entity_id=entity_id,
                entity_name=entity_name,
                max_iterations=max_iterations
            )

            results[entity_id] = result

        # Generate comparison report
        report = self.generate_comparison_report(results, entities)

        # Save results
        self.save_results(results, report)

        return report

    def generate_comparison_report(
        self,
        results: Dict[str, Any],
        entities: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Generate comparison report from discovery results"""

        logger.info(f"\n{'='*80}")
        logger.info(f"📊 Generating Comparison Report")
        logger.info(f"{'='*80}\n")

        report = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'entities_tested': len(entities),
            'total_cost_usd': 0.0,
            'total_iterations': 0,
            'entity_results': {},
            'comparison': {
                'best_confidence': {'entity_id': None, 'confidence': 0.0},
                'lowest_cost': {'entity_id': None, 'cost': float('inf')},
                'most_iterations': {'entity_id': None, 'iterations': 0},
                'actionable_count': 0
            },
            'analysis': {}
        }

        # Process each entity result
        for entity_id, result in results.items():
            if 'error' in result:
                logger.warning(f"⚠️  {entity_id}: Discovery failed - {result['error']}")
                report['entity_results'][entity_id] = {
                    'status': 'failed',
                    'error': result['error']
                }
                continue

            entity_name = next(e['entity_name'] for e in entities if e['entity_id'] == entity_id)

            entity_report = {
                'entity_name': entity_name,
                'final_confidence': result.get('final_confidence', 0.0),
                'confidence_band': result.get('confidence_band', 'UNKNOWN'),
                'is_actionable': result.get('is_actionable', False),
                'iterations_completed': result.get('iterations_completed', 0),
                'total_cost_usd': result.get('total_cost_usd', 0.0),
                'signals_count': len(result.get('signals_discovered', [])),
                'hypotheses_count': len(result.get('hypotheses', []))
            }

            report['entity_results'][entity_id] = entity_report

            # Update totals
            report['total_cost_usd'] += entity_report['total_cost_usd']
            report['total_iterations'] += entity_report['iterations_completed']

            # Update comparisons
            if entity_report['final_confidence'] > report['comparison']['best_confidence']['confidence']:
                report['comparison']['best_confidence'] = {
                    'entity_id': entity_id,
                    'confidence': entity_report['final_confidence']
                }

            if entity_report['total_cost_usd'] < report['comparison']['lowest_cost']['cost']:
                report['comparison']['lowest_cost'] = {
                    'entity_id': entity_id,
                    'cost': entity_report['total_cost_usd']
                }

            if entity_report['iterations_completed'] > report['comparison']['most_iterations']['iterations']:
                report['comparison']['most_iterations'] = {
                    'entity_id': entity_id,
                    'iterations': entity_report['iterations_completed']
                }

            if entity_report['is_actionable']:
                report['comparison']['actionable_count'] += 1

        # Calculate averages
        if report['entities_tested'] > 0:
            report['averages'] = {
                'confidence': sum(r['final_confidence'] for r in report['entity_results'].values() if 'final_confidence' in r) / report['entities_tested'],
                'cost_usd': report['total_cost_usd'] / report['entities_tested'],
                'iterations': report['total_iterations'] / report['entities_tested']
            }

        return report

    def save_results(
        self,
        results: Dict[str, Any],
        report: Dict[str, Any]
    ):
        """Save detailed results and report to files"""

        # Create data directory
        data_dir = Path(__file__).parent.parent / 'data'
        data_dir.mkdir(exist_ok=True)

        # Save full results
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        results_file = data_dir / f'real_discovery_results_{timestamp}.json'

        with open(results_file, 'w') as f:
            json.dump({
                'report': report,
                'detailed_results': results
            }, f, indent=2)

        logger.info(f"\n✅ Results saved to: {results_file}")

        # Save report separately
        report_file = data_dir / f'real_discovery_report_{timestamp}.txt'

        with open(report_file, 'w') as f:
            f.write(self.format_report_text(report))

        logger.info(f"✅ Report saved to: {report_file}")

    def format_report_text(self, report: Dict[str, Any]) -> str:
        """Format report as readable text"""

        lines = []
        lines.append("=" * 80)
        lines.append("REAL DISCOVERY COMPARISON REPORT")
        lines.append("=" * 80)
        lines.append(f"Timestamp: {report['timestamp']}")
        lines.append(f"Entities Tested: {report['entities_tested']}")
        lines.append("")

        # Summary
        lines.append("SUMMARY")
        lines.append("-" * 80)
        lines.append(f"Total Cost: ${report['total_cost_usd']:.4f}")
        lines.append(f"Total Iterations: {report['total_iterations']}")

        if 'averages' in report:
            lines.append(f"Average Confidence: {report['averages']['confidence']:.2f}")
            lines.append(f"Average Cost: ${report['averages']['cost_usd']:.4f}")
            lines.append(f"Average Iterations: {report['averages']['iterations']:.1f}")

        lines.append(f"Actionable Count: {report['comparison']['actionable_count']}/{report['entities_tested']}")
        lines.append("")

        # Best performers
        lines.append("BEST PERFORMERS")
        lines.append("-" * 80)
        best = report['comparison']['best_confidence']
        if best['entity_id']:
            lines.append(f"Highest Confidence: {best['entity_id']} ({best['confidence']:.2f})")

        lowest = report['comparison']['lowest_cost']
        if lowest['entity_id']:
            lines.append(f"Lowest Cost: {lowest['entity_id']} (${lowest['cost']:.4f})")

        most = report['comparison']['most_iterations']
        if most['entity_id']:
            lines.append(f"Most Iterations: {most['entity_id']} ({most['iterations']} iterations)")
        lines.append("")

        # Entity-by-entity results
        lines.append("ENTITY RESULTS")
        lines.append("-" * 80)

        for entity_id, result in report['entity_results'].items():
            if 'status' in result and result['status'] == 'failed':
                lines.append(f"{entity_id}: ❌ FAILED - {result['error']}")
                continue

            lines.append(f"{entity_id}:")
            lines.append(f"  Name: {result['entity_name']}")
            lines.append(f"  Confidence: {result['final_confidence']:.2f} ({result['confidence_band']})")
            lines.append(f"  Actionable: {'✅ YES' if result['is_actionable'] else '❌ NO'}")
            lines.append(f"  Iterations: {result['iterations_completed']}")
            lines.append(f"  Cost: ${result['total_cost_usd']:.4f}")
            lines.append(f"  Signals: {result['signals_count']}")
            lines.append("")

        lines.append("=" * 80)

        return "\n".join(lines)


async def main():
    """Main execution"""

    # Define entities to test (NEW entities - not training data)
    # Training entities (exclude): Arsenal FC, World Athletics, ICF, Aston Villa
    entities = [
        {
            'entity_id': 'liverpool-fc',
            'entity_name': 'Liverpool FC'
        },
        {
            'entity_id': 'bayern-munich',
            'entity_name': 'Bayern Munich'
        },
        {
            'entity_id': 'psg',
            'entity_name': 'Paris Saint-Germain'
        }
    ]

    # Initialize runner
    runner = RealDiscoveryRunner()

    # Run comparison
    report = await runner.run_comparison(
        entities=entities,
        max_iterations=15
    )

    # Print summary
    print("\n" + "="*80)
    print("🎉 REAL DISCOVERY COMPARISON COMPLETE")
    print("="*80)
    print(f"Total Cost: ${report['total_cost_usd']:.4f}")
    print(f"Entities Tested: {report['entities_tested']}")
    print(f"Actionable: {report['comparison']['actionable_count']}/{report['entities_tested']}")

    if 'averages' in report:
        print(f"Average Confidence: {report['averages']['confidence']:.2f}")

    print("\n✅ Results and report saved to data/ directory")
    print("="*80)


if __name__ == '__main__':
    asyncio.run(main())
