#!/usr/bin/env python3
"""
Run Coventry City FC Through the "Real" Dossier-First Pipeline

This script executes the complete 4-phase unified intelligence pipeline:

Phase 1: DOSSIER GENERATION (Cold Start)
    - Generate 11-section intelligence dossier
    - Extract procurement signals with confidence scores
    - Collect decision makers with LinkedIn URLs

Phase 2: HYPOTHESIS-DRIVEN DISCOVERY (Warm Start)
    - Feed dossier signals as PRIOR confidence (not neutral 0.50)
    - Generate targeted search queries from dossier signals
    - Find ADDITIONAL evidence via BrightData SDK

Phase 3: DASHBOARD SCORING (Three-Axis)
    - Procurement Maturity Score (0-100)
    - Active Procurement Probability (0-1)
    - Sales Readiness Level

Phase 4: FEEDBACK LOOP
    - Enrich dossier with discovered evidence
    - Update confidence scores
    - Generate outreach strategy

Usage:
    python run_dossier_first_pipeline.py

Output:
    - backend/data/dossiers/coventry-city-fc_dossier_enriched.json
    - backend/data/dossiers/coventry-city-fc_discovery_results.json
    - backend/data/dossiers/coventry-city-fc_dashboard_scores.json
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DossierFirstPipeline:
    """Orchestrates the 4-phase dossier-first intelligence pipeline"""

    def __init__(self):
        """Initialize all required clients and services"""
        from backend.claude_client import ClaudeClient
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.dossier_generator import EntityDossierGenerator, UniversalDossierGenerator
        from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
        from backend.dashboard_scorer import DashboardScorer

        logger.info("🚀 Initializing Dossier-First Pipeline...")

        # Initialize clients
        self.claude = ClaudeClient()
        self.brightdata = BrightDataSDKClient()

        # Initialize components - try Universal first, fall back to Entity
        try:
            self.dossier_generator = UniversalDossierGenerator(self.claude)
            logger.info("✅ Using UniversalDossierGenerator")
        except Exception as e:
            logger.warning(f"⚠️ UniversalDossierGenerator failed: {e}")
            self.dossier_generator = EntityDossierGenerator(self.claude)
            logger.info("✅ Using EntityDossierGenerator as fallback")

        self.discovery = HypothesisDrivenDiscovery(self.claude, self.brightdata)
        self.dashboard_scorer = DashboardScorer()

        # Create output directory
        self.output_dir = Path("backend/data/dossiers")
        self.output_dir.mkdir(parents=True, exist_ok=True)

        logger.info("✅ Pipeline initialized")

    async def run_pipeline(
        self,
        entity_id: str,
        entity_name: str,
        tier: str = "STANDARD",
        max_iterations: int = 15
    ) -> Dict[str, Any]:
        """
        Run the complete 4-phase dossier-first pipeline

        Args:
            entity_id: Entity identifier (e.g., "coventry-city-fc")
            entity_name: Entity display name (e.g., "Coventry City FC")
            tier: Dossier tier (BASIC/STANDARD/PREMIUM)
            max_iterations: Maximum discovery iterations

        Returns:
            Complete pipeline results with all phases
        """
        start_time = datetime.now(timezone.utc)

        logger.info("=" * 60)
        logger.info(f"🎯 DOSSIER-FIRST PIPELINE: {entity_name}")
        logger.info("=" * 60)

        # =========================================================================
        # PHASE 1: DOSSIER GENERATION (Cold Start)
        # =========================================================================
        logger.info("\n📋 PHASE 1: DOSSIER GENERATION (Cold Start)")
        logger.info("-" * 60)

        dossier = await self._phase_1_generate_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            tier=tier
        )

        # =========================================================================
        # PHASE 2: HYPOTHESIS-DRIVEN DISCOVERY (Warm Start)
        # =========================================================================
        logger.info("\n🔍 PHASE 2: DISCOVERY (Warm Start with Dossier Context)")
        logger.info("-" * 60)

        discovery_result = await self._phase_2_run_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            max_iterations=max_iterations
        )

        # =========================================================================
        # PHASE 3: DASHBOARD SCORING (Three-Axis)
        # =========================================================================
        logger.info("\n📊 PHASE 3: DASHBOARD SCORING (Three-Axis)")
        logger.info("-" * 60)

        dashboard_scores = await self._phase_3_calculate_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            discovery_result=discovery_result
        )

        # =========================================================================
        # PHASE 4: FEEDBACK LOOP (Enrich Dossier)
        # =========================================================================
        logger.info("\n🔄 PHASE 4: FEEDBACK LOOP (Enrich Dossier)")
        logger.info("-" * 60)

        enriched_dossier = await self._phase_4_enrich_dossier(
            dossier=dossier,
            discovery_result=discovery_result,
            dashboard_scores=dashboard_scores
        )

        # =========================================================================
        # FINAL OUTPUT
        # =========================================================================
        end_time = datetime.now(timezone.utc)
        total_time = (end_time - start_time).total_seconds()

        # Extract discovery result values (handle both dataclass and dict)
        if hasattr(discovery_result, 'final_confidence'):
            final_conf = discovery_result.final_confidence
            iterations = discovery_result.iterations_completed
            signals_count = len(discovery_result.signals_discovered)
        else:
            final_conf = discovery_result.get('final_confidence', 0)
            iterations = discovery_result.get('iteration_count', discovery_result.get('iterations_completed', 0))
            signals_count = len(discovery_result.get('signals_discovered', []))

        result = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "pipeline_version": "dossier_first_v1",
            "started_at": start_time.isoformat(),
            "completed_at": end_time.isoformat(),
            "total_time_seconds": round(total_time, 2),
            "phases": {
                "phase_1_dossier": {
                    "status": "completed",
                    "sections": len(dossier.get("sections", [])),
                    "hypotheses": dossier.get("metadata", {}).get("hypothesis_count", 0),
                    "signals": dossier.get("metadata", {}).get("signal_count", 0)
                },
                "phase_2_discovery": {
                    "status": "completed",
                    "final_confidence": final_conf,
                    "iterations": iterations,
                    "signals_discovered": signals_count
                },
                "phase_3_scoring": {
                    "status": "completed",
                    "procurement_maturity": dashboard_scores.get("procurement_maturity", 0),
                    "active_probability": dashboard_scores.get("active_probability", 0),
                    "sales_readiness": dashboard_scores.get("sales_readiness", "NOT_READY")
                },
                "phase_4_feedback": {
                    "status": "completed",
                    "outreach_questions": len(enriched_dossier.get("outreach_strategy", {}).get("questions", []))
                }
            }
        }

        # Save results
        await self._save_results(entity_id, dossier, discovery_result, dashboard_scores, enriched_dossier)

        logger.info("\n" + "=" * 60)
        logger.info(f"✅ PIPELINE COMPLETE: {entity_name}")
        logger.info("=" * 60)
        logger.info(f"⏱️  Total time: {total_time:.1f} seconds")
        logger.info(f"📊 Maturity: {dashboard_scores.get('procurement_maturity', 0)}/100")
        logger.info(f"📈 Probability: {dashboard_scores.get('active_probability', 0)*100:.1f}%")
        logger.info(f"🎯 Readiness: {dashboard_scores.get('sales_readiness', 'NOT_READY')}")
        logger.info("=" * 60)

        return result

    async def _phase_1_generate_dossier(
        self,
        entity_id: str,
        entity_name: str,
        tier: str
    ) -> Dict[str, Any]:
        """Phase 1: Generate 11-section intelligence dossier"""

        logger.info(f"📋 Generating {tier} dossier for {entity_name}")

        # Determine priority score from tier
        priority_score = {"BASIC": 10, "STANDARD": 50, "PREMIUM": 90}.get(tier, 50)

        dossier = await self.dossier_generator.generate_universal_dossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type="CLUB",
            priority_score=priority_score
        )

        # Log key findings
        logger.info(f"✅ Dossier generated:")
        logger.info(f"   - Sections: {len(dossier.get('sections', []))}")
        logger.info(f"   - Hypotheses: {dossier.get('metadata', {}).get('hypothesis_count', 0)}")
        logger.info(f"   - Signals: {dossier.get('metadata', {}).get('signal_count', 0)}")
        logger.info(f"   - Time: {dossier.get('generation_time_seconds', 0):.1f}s")

        # Log procurement signals
        procurement_signals = dossier.get('extracted_signals', [])
        if procurement_signals:
            logger.info(f"   - Procurement signals detected:")
            for signal in procurement_signals[:5]:
                logger.info(f"     * {signal.get('text', 'Unknown')[:60]}...")

        return dossier

    async def _phase_2_run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
        max_iterations: int
    ) -> Any:
        """Phase 2: Run hypothesis-driven discovery with dossier context"""

        logger.info(f"🔍 Running discovery with dossier context (max {max_iterations} iterations)")

        # Check if dossier has any signals
        signal_count = len(dossier.get('extracted_signals', []))
        hypothesis_count = dossier.get('metadata', {}).get('hypothesis_count', 0)

        if signal_count == 0 and hypothesis_count == 0:
            logger.warning(f"⚠️ Dossier has no signals/hypotheses, falling back to standard discovery")

            # Run standard discovery instead - try different template IDs
            template_ids = ['tier_1_club_centralized_procurement', 'production_templates']
            result = None

            for template_id in template_ids:
                try:
                    logger.info(f"🔍 Trying template: {template_id}")
                    result = await self.discovery.run_discovery(
                        entity_id=entity_id,
                        entity_name=entity_name,
                        template_id=template_id,
                        max_iterations=max_iterations
                    )
                    break  # Success! Use this result
                except Exception as e:
                    logger.warning(f"⚠️ Template {template_id} failed: {e}")
                    continue

            # If all templates failed, create a minimal result
            if result is None:
                logger.error("❌ All discovery templates failed, creating minimal result")
                from backend.hypothesis_driven_discovery import DiscoveryResult
                result = DiscoveryResult(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    final_confidence=0.50,
                    confidence_band="EXPLORATORY",
                    is_actionable=False,
                    iterations_completed=0,
                    total_cost_usd=0.0,
                    hypotheses=[],
                    depth_stats={},
                    signals_discovered=[]
                )

            return result

        # Run discovery with dossier context
        result = await self.discovery.run_discovery_with_dossier_context(
            entity_id=entity_id,
            entity_name=entity_name,
            dossier=dossier,
            max_iterations=max_iterations
        )

        # Log results
        logger.info(f"✅ Discovery complete:")
        logger.info(f"   - Final confidence: {result.final_confidence:.3f}")
        logger.info(f"   - Iterations: {result.iterations_completed}")
        logger.info(f"   - Signals discovered: {len(result.signals_discovered)}")

        # Log top hypotheses
        hypotheses = result.hypotheses
        if hypotheses:
            logger.info(f"   - Top hypotheses:")
            for hyp in hypotheses[:3]:
                conf = getattr(hyp, 'confidence', hyp.get('confidence', 0) if isinstance(hyp, dict) else 0)
                stmt = getattr(hyp, 'statement', hyp.get('statement', 'Unknown') if isinstance(hyp, dict) else 'Unknown')
                logger.info(f"     * [{conf:.2f}] {stmt[:50]}...")

        return result

    async def _phase_3_calculate_scores(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
        discovery_result: Any
    ) -> Dict[str, Any]:
        """Phase 3: Calculate three-axis dashboard scores"""

        logger.info(f"📊 Calculating three-axis dashboard scores")

        # Combine dossier signals and discovery signals
        all_signals = []

        # Add dossier signals
        for signal in dossier.get('extracted_signals', []):
            all_signals.append({
                'type': signal.get('type', 'UNKNOWN'),
                'text': signal.get('text', ''),
                'confidence': signal.get('confidence', 0.5),
                'source': 'dossier'
            })

        # Add discovery signals - handle both DiscoveryResult dataclass and dict
        signals_discovered = []
        if hasattr(discovery_result, 'signals_discovered'):
            signals_discovered = discovery_result.signals_discovered
        elif isinstance(discovery_result, dict):
            signals_discovered = discovery_result.get('signals_discovered', [])

        for signal in signals_discovered:
            # Handle both dict and object signals
            if isinstance(signal, dict):
                all_signals.append({
                    'type': signal.get('signal_type', signal.get('type', 'UNKNOWN')),
                    'text': signal.get('statement', signal.get('text', '')),
                    'confidence': signal.get('confidence', 0.5),
                    'source': 'discovery'
                })
            else:
                all_signals.append({
                    'type': getattr(signal, 'signal_type', getattr(signal, 'type', 'UNKNOWN')),
                    'text': getattr(signal, 'statement', getattr(signal, 'text', '')),
                    'confidence': getattr(signal, 'confidence', 0.5),
                    'source': 'discovery'
                })

        # Get hypotheses - handle both dataclass and dict
        hypotheses = []
        if hasattr(discovery_result, 'hypotheses'):
            hypotheses = discovery_result.hypotheses
        elif isinstance(discovery_result, dict):
            hypotheses = discovery_result.get('hypotheses', [])

        # Calculate scores
        scores = await self.dashboard_scorer.calculate_entity_scores(
            entity_id=entity_id,
            entity_name=entity_name,
            hypotheses=hypotheses,
            signals=all_signals,
            episodes=None  # No temporal episodes for this run
        )

        # Log scores
        logger.info(f"✅ Dashboard scores calculated:")
        logger.info(f"   - Procurement Maturity: {scores['procurement_maturity']}/100")
        logger.info(f"   - Active Probability: {scores['active_probability']*100:.1f}%")
        logger.info(f"   - Sales Readiness: {scores['sales_readiness']}")

        # Log breakdown
        breakdown = scores.get('breakdown', {})
        if 'maturity' in breakdown:
            logger.info(f"   - Maturity breakdown:")
            for key, value in breakdown['maturity'].items():
                logger.info(f"     * {key}: {value}")

        return scores

    async def _phase_4_enrich_dossier(
        self,
        dossier: Dict[str, Any],
        discovery_result: Any,
        dashboard_scores: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Phase 4: Enrich dossier with discovery results and dashboard scores"""

        logger.info(f"🔄 Enriching dossier with discovery results")

        # Extract values from discovery_result (handle both dataclass and dict)
        if hasattr(discovery_result, 'final_confidence'):
            final_confidence = discovery_result.final_confidence
            iterations_run = discovery_result.iterations_completed
            signals_discovered = discovery_result.signals_discovered
            hypotheses = discovery_result.hypotheses
        else:
            final_confidence = discovery_result.get('final_confidence', 0)
            iterations_run = discovery_result.get('iteration_count', discovery_result.get('iterations_completed', 0))
            signals_discovered = discovery_result.get('signals_discovered', [])
            hypotheses = discovery_result.get('hypotheses', [])

        # Convert hypotheses to dict format for JSON serialization
        top_hypotheses = []
        for h in hypotheses[:5]:
            if hasattr(h, 'statement'):
                top_hypotheses.append({
                    'statement': h.statement,
                    'confidence': h.confidence,
                    'category': h.category
                })
            elif isinstance(h, dict):
                top_hypotheses.append({
                    'statement': h.get('statement', ''),
                    'confidence': h.get('confidence', 0),
                    'category': h.get('category', '')
                })

        # Create enriched dossier
        enriched = {
            **dossier,
            "discovery_enrichment": {
                "final_confidence": final_confidence,
                "iterations_run": iterations_run,
                "additional_signals": len(signals_discovered),
                "top_hypotheses": top_hypotheses
            },
            "dashboard_scores": {
                "procurement_maturity": dashboard_scores['procurement_maturity'],
                "active_probability": dashboard_scores['active_probability'],
                "sales_readiness": dashboard_scores['sales_readiness'],
                "calculated_at": dashboard_scores['calculated_at']
            },
            "outreach_strategy": self._generate_outreach_strategy(
                dossier, discovery_result, dashboard_scores
            )
        }

        logger.info(f"✅ Dossier enriched with:")
        logger.info(f"   - Discovery results: {iterations_run} iterations")
        logger.info(f"   - Dashboard scores: {dashboard_scores['sales_readiness']} readiness")
        logger.info(f"   - Outreach questions: {len(enriched['outreach_strategy'].get('questions', []))}")

        return enriched

    def _generate_outreach_strategy(
        self,
        dossier: Dict[str, Any],
        discovery_result: Any,
        scores: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate outreach strategy based on all intelligence"""

        readiness = scores.get('sales_readiness', 'NOT_READY')
        maturity = scores.get('procurement_maturity', 0)
        probability = scores.get('active_probability', 0)

        # Get decision makers from dossier
        decision_makers = []
        for section in dossier.get('sections', []):
            if section.get('section_id') == 'leadership':
                content = section.get('content', '')
                # Extract decision makers (simple extraction)
                if 'Chairman' in content or 'CEO' in content or 'Director' in content:
                    decision_makers.append({
                        'role': 'Leadership',
                        'context': 'See Leadership section for details'
                    })

        # Generate questions based on procurement signals
        questions = []

        # Add questions from dossier signals
        for signal in dossier.get('extracted_signals', [])[:3]:
            if signal.get('type') == '[PROCUREMENT]':
                questions.append({
                    'question': f"Based on signal: {signal.get('text', '')}",
                    'confidence': signal.get('confidence', 0.5),
                    'source': 'dossier_signal'
                })

        # Get hypotheses from discovery_result (handle both dataclass and dict)
        hypotheses = []
        if hasattr(discovery_result, 'hypotheses'):
            hypotheses = discovery_result.hypotheses
        elif isinstance(discovery_result, dict):
            hypotheses = discovery_result.get('hypotheses', [])

        # Generate questions based on discovery
        for hyp in hypotheses[:3]:
            # Handle both dataclass and dict
            if hasattr(hyp, 'confidence'):
                conf = hyp.confidence
                stmt = hyp.statement
            else:
                conf = hyp.get('confidence', 0)
                stmt = hyp.get('statement', '')

            if conf > 0.6:
                questions.append({
                    'question': f"Validate hypothesis: {stmt}",
                    'confidence': conf,
                    'source': 'discovery_hypothesis'
                })

        return {
            'readiness_level': readiness,
            'recommended_action': self._get_action_for_readiness(readiness),
            'priority_score': maturity * probability,
            'target_decision_makers': decision_makers[:3],
            'questions': questions[:5],
            'talking_points': self._generate_talking_points(dossier, discovery_result)
        }

    def _get_action_for_readiness(self, readiness: str) -> str:
        """Get recommended action based on sales readiness"""
        actions = {
            'NOT_READY': 'Monitor - Entity not ready for outreach',
            'MONITOR': 'Watchlist - Monitor for signal changes',
            'ENGAGE': 'Prepare - Research and prepare outreach materials',
            'HIGH_PRIORITY': 'Engage - Begin outreach process',
            'LIVE': 'Immediate - RFP detected, immediate action required'
        }
        return actions.get(readiness, 'Monitor')

    def _generate_talking_points(
        self,
        dossier: Dict[str, Any],
        discovery_result: Any
    ) -> List[str]:
        """Generate talking points for outreach"""
        points = []

        # Extract from digital maturity section
        for section in dossier.get('sections', []):
            if section.get('section_id') == 'digital_maturity':
                points.append("Digital Capabilities: See Digital Maturity section")

        # Extract from challenges
        for section in dossier.get('sections', []):
            if section.get('section_id') == 'challenges_opportunities':
                points.append("Pain Points: See Challenges & Opportunities section")

        # Get signals from discovery_result
        signals_discovered = []
        if hasattr(discovery_result, 'signals_discovered'):
            signals_discovered = discovery_result.signals_discovered
        elif isinstance(discovery_result, dict):
            signals_discovered = discovery_result.get('signals_discovered', [])

        # Add discovery insights
        for signal in signals_discovered[:2]:
            # Handle both dict and object signals
            if isinstance(signal, dict):
                stmt = signal.get('statement', signal.get('text', 'Discovery insight'))
            else:
                stmt = getattr(signal, 'statement', getattr(signal, 'text', 'Discovery insight'))
            points.append(f"Signal: {stmt[:60]}...")

        return points[:5]

    async def _save_results(
        self,
        entity_id: str,
        dossier: Dict[str, Any],
        discovery_result: Any,
        dashboard_scores: Dict[str, Any],
        enriched_dossier: Dict[str, Any]
    ):
        """Save all results to files"""

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        # Save enriched dossier
        dossier_path = self.output_dir / f"{entity_id}_dossier_enriched_{timestamp}.json"
        with open(dossier_path, 'w') as f:
            json.dump(enriched_dossier, f, indent=2, default=str)
        logger.info(f"💾 Enriched dossier saved: {dossier_path}")

        # Extract discovery data for JSON serialization
        if hasattr(discovery_result, 'to_dict'):
            discovery_data = discovery_result.to_dict()
        elif hasattr(discovery_result, 'final_confidence'):
            # It's a DiscoveryResult dataclass, convert manually
            discovery_data = {
                'entity_id': discovery_result.entity_id,
                'entity_name': discovery_result.entity_name,
                'final_confidence': discovery_result.final_confidence,
                'iterations_completed': discovery_result.iterations_completed,
                'total_cost_usd': discovery_result.total_cost_usd,
                'hypotheses': [
                    h.to_dict() if hasattr(h, 'to_dict') else h
                    for h in discovery_result.hypotheses[:10]
                ],
                'signals_discovered': discovery_result.signals_discovered[:10]
            }
        else:
            discovery_data = discovery_result

        # Save discovery results
        discovery_path = self.output_dir / f"{entity_id}_discovery_{timestamp}.json"
        with open(discovery_path, 'w') as f:
            json.dump(discovery_data, f, indent=2, default=str)
        logger.info(f"💾 Discovery results saved: {discovery_path}")

        # Save dashboard scores
        scores_path = self.output_dir / f"{entity_id}_scores_{timestamp}.json"
        with open(scores_path, 'w') as f:
            json.dump(dashboard_scores, f, indent=2, default=str)
        logger.info(f"💾 Dashboard scores saved: {scores_path}")


async def main():
    """Main entry point"""

    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()

    # Verify environment
    required_vars = ['ANTHROPIC_AUTH_TOKEN', 'BRIGHTDATA_API_TOKEN']
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set them in your .env file")
        return

    # Create and run pipeline
    pipeline = DossierFirstPipeline()

    # Run for Coventry City FC
    result = await pipeline.run_pipeline(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        tier="STANDARD",
        max_iterations=15
    )

    # Print summary
    print("\n" + "=" * 60)
    print("📋 PIPELINE SUMMARY")
    print("=" * 60)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
