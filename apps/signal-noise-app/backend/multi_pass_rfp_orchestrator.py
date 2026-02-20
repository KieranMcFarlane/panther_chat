#!/usr/bin/env python3
"""
Multi-Pass RFP Discovery Orchestrator - Unified System

This is the main orchestrator that brings together all components of the
multi-layered RFP discovery system:

1. Yellow Panther Profile (agency capabilities)
2. Entity Dossiers (what entities have/need)
3. Dossier Hypothesis Generator (match needs to YP services)
4. Multi-Pass Ralph Loop Coordinator (deterministic validation)
5. Temporal Context Provider (Graphiti episodes)
6. Graph Relationship Analyzer (FalkorDB network intelligence)
7. BrightData SDK (web scraping)
8. Claude Agent SDK (AI analysis)

Phase 6: Unified Orchestrator
Coordinates all systems for complete RFP discovery workflow.

Usage:
    from multi_pass_rfp_orchestrator import MultiPassRFPOrchestrator

    orchestrator = MultiPassRFPOrchestrator()

    result = await orchestrator.discover_rfp_opportunities(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        max_passes=4
    )

    print(f"Final Confidence: {result.final_confidence:.2f}")
    print(f"High-Priority Opportunities: {result.opportunity_report.high_priority_count}")
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class Opportunity:
    """Single RFP opportunity"""
    pass_number: int  # Discovery pass number (1, 2, 3, 4)
    signal_type: str
    category: str
    confidence: float
    evidence_count: int
    yp_service: str
    estimated_value: float
    recommended_action: str
    temporal_fit: float = 0.0
    network_influence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OpportunityReport:
    """Complete opportunity report for entity"""
    opportunities: List[Opportunity]
    total_opportunities: int
    high_priority_count: int  # confidence >= 0.80
    medium_priority_count: int  # confidence 0.60-0.79
    low_priority_count: int  # confidence < 0.60
    entity_summary: Optional['EntityDossier'] = None
    confidence_trend: List[float] = field(default_factory=list)
    temporal_insights: Dict[str, Any] = field(default_factory=dict)
    network_insights: Dict[str, Any] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class OrchestratorResult:
    """Complete orchestrator result"""
    entity_id: str
    entity_name: str
    final_confidence: float
    opportunity_report: OpportunityReport
    multi_pass_result: 'MultiPassResult'
    dossier: Optional['EntityDossier'] = None
    temporal_context: Optional['InterPassContext'] = None
    network_context: Optional['NetworkContext'] = None
    duration_seconds: float = 0.0
    total_cost: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class MultiPassRFPOrchestrator:
    """
    Main orchestrator for multi-layered RFP discovery

    Coordinates:
    - Entity dossier generation (baseline needs assessment)
    - Dossier-informed hypothesis generation (YP capability matching)
    - Multi-pass discovery with Ralph Loop validation
    - Temporal intelligence (Graphiti episodes)
    - Network intelligence (FalkorDB relationships)
    - Final opportunity report generation

    This is the primary entry point for the complete system.
    """

    def __init__(self):
        """Initialize orchestrator with all required components"""
        logger.info("🚀 Initializing MultiPassRFPOrchestrator...")

        # Core services
        from claude_client import ClaudeClient
        from brightdata_sdk_client import BrightDataSDKClient
        from graphiti_service import GraphitiService

        self.claude_client = ClaudeClient()
        self.brightdata_client = BrightDataSDKClient()
        self.graphiti_service = GraphitiService()

        # System components
        from dossier_generator import EntityDossierGenerator
        from dossier_hypothesis_generator import DossierHypothesisGenerator
        from multi_pass_ralph_loop import MultiPassRalphCoordinator
        from temporal_context_provider import TemporalContextProvider
        from graph_relationship_analyzer import GraphRelationshipAnalyzer

        self.dossier_generator = EntityDossierGenerator(self.claude_client)
        self.hypothesis_generator = DossierHypothesisGenerator()
        self.multi_pass_coordinator = MultiPassRalphCoordinator()
        self.temporal_provider = TemporalContextProvider()
        self.graph_analyzer = GraphRelationshipAnalyzer()

        # Yellow Panther profile (for capability matching)
        self.yp_profile = self._load_yp_profile()

        logger.info("✅ MultiPassRFPOrchestrator initialized successfully")
        logger.info(f"   YP Capabilities: {len(self.yp_profile.get('capabilities', []))} services")

    def _load_yp_profile(self) -> Dict:
        """Load Yellow Panther profile from markdown file"""
        yp_path = Path(__file__).parent.parent / "YELLOW-PANTHER-PROFILE.md"

        if not yp_path.exists():
            logger.warning(f"Yellow Panther profile not found at {yp_path}")
            return self._get_default_yp_profile()

        try:
            content = yp_path.read_text()

            # Parse YP capabilities from markdown
            capabilities = self._parse_yp_capabilities(content)

            return {
                'agency_name': 'Yellow Panther',
                'capabilities': capabilities,
                'technology_stack': ['React.js', 'Node.js', 'Python', 'TypeScript'],
                'industry_expertise': ['Sports & Entertainment', 'Fan Engagement'],
                'source_file': str(yp_path)
            }
        except Exception as e:
            logger.error(f"Error loading YP profile: {e}")
            return self._get_default_yp_profile()

    def _get_default_yp_profile(self) -> Dict:
        """Return default YP profile if file not found"""
        return {
            'agency_name': 'Yellow Panther',
            'capabilities': [
                {'service': 'React Web Development', 'category': 'Web Development'},
                {'service': 'React Mobile Development', 'category': 'Mobile Development'},
                {'service': 'Digital Transformation', 'category': 'Digital Transformation'},
                {'service': 'E-commerce Solutions', 'category': 'E-commerce'},
                {'service': 'Fan Engagement Platforms', 'category': 'Fan Engagement'}
            ],
            'technology_stack': ['React.js', 'Node.js', 'Python'],
            'industry_expertise': ['Sports & Entertainment']
        }

    def _parse_yp_capabilities(self, content: str) -> List[Dict]:
        """Parse YP capabilities from markdown content"""
        capabilities = []

        # Simple parsing - look for service categories
        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()
            if line.startswith('##') and any(keyword in line.lower() for keyword in
                                                 ['web', 'mobile', 'digital', 'ecommerce', 'fan']):
                current_section = line.replace('##', '').strip()
            elif line.startswith('-') or line.startswith('*'):
                service = line.lstrip('-*').strip()
                if service and current_section:
                    capabilities.append({
                        'service': service,
                        'category': current_section
                    })

        return capabilities if capabilities else self._get_default_yp_profile()['capabilities']

    async def discover_rfp_opportunities(
        self,
        entity_id: str,
        entity_name: str,
        max_passes: int = 4,
        dossier_priority: str = 'STANDARD',
        skip_dossier: bool = False,
        include_temporal: bool = True,
        include_network: bool = True
    ) -> OrchestratorResult:
        """
        Complete multi-pass RFP discovery for entity

        This is the main entry point for the entire system.

        Flow:
        1. Generate entity dossier (baseline needs assessment)
        2. Generate dossier-informed hypotheses (matched to YP capabilities)
        3. Run multi-pass discovery with Ralph Loop validation
        4. Gather temporal context (Graphiti episodes)
        5. Gather network context (FalkorDB relationships)
        6. Generate final opportunity report

        Args:
            entity_id: Entity identifier (e.g., "arsenal-fc")
            entity_name: Entity display name (e.g., "Arsenal FC")
            max_passes: Maximum number of discovery passes (default: 4)
            dossier_priority: Dossier tier - BASIC, STANDARD, or PREMIUM
            skip_dossier: Skip dossier generation (use existing)
            include_temporal: Include temporal intelligence from Graphiti
            include_network: Include network intelligence from FalkorDB

        Returns:
            OrchestratorResult with complete discovery results
        """
        start_time = datetime.now(timezone.utc)
        total_cost = 0.0

        logger.info(f"\n{'='*80}")
        logger.info(f"MULTI-LAYERED RFP DISCOVERY: {entity_name} ({entity_id})")
        logger.info(f"{'='*80}\n")
        logger.info(f"Configuration:")
        logger.info(f"  Max Passes: {max_passes}")
        logger.info(f"  Dossier Priority: {dossier_priority}")
        logger.info(f"  Temporal Intelligence: {'✅' if include_temporal else '❌'}")
        logger.info(f"  Network Intelligence: {'✅' if include_network else '❌'}")

        # Initialize services
        await self.graphiti_service.initialize()

        # Step 1: Generate entity dossier (baseline)
        dossier = None
        if not skip_dossier:
            logger.info("\n📊 Step 1: Generating entity dossier...")
            try:
                dossier = await self.dossier_generator.generate_dossier(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    priority_score=self._priority_to_score(dossier_priority),
                    max_sections=self._priority_to_sections(dossier_priority)
                )
                logger.info(f"  ✅ Generated dossier with {len(dossier.sections)} sections")
            except Exception as e:
                logger.warning(f"  ⚠️  Dossier generation failed: {e}")
                logger.warning(f"  Continuing without dossier...")

        # Step 2: Run multi-pass discovery
        logger.info(f"\n🔍 Step 2: Running {max_passes}-pass discovery...")
        multi_pass_result = await self.multi_pass_coordinator.run_multi_pass_discovery(
            entity_id=entity_id,
            entity_name=entity_name,
            yp_template_id="yellow_panther_agency",
            max_passes=max_passes,
            dossier=dossier
        )

        total_cost += multi_pass_result.total_cost
        logger.info(f"  ✅ Multi-pass discovery complete")
        logger.info(f"     Final Confidence: {multi_pass_result.final_confidence:.2f}")
        logger.info(f"     Signals Detected: {multi_pass_result.total_signals_detected}")
        logger.info(f"     Iterations: {multi_pass_result.total_iterations}")

        # Step 3: Gather temporal context
        temporal_context = None
        temporal_insights = {}
        if include_temporal and max_passes > 1:
            logger.info("\n⏰ Step 3: Gathering temporal context...")
            try:
                temporal_context = await self.temporal_provider.get_inter_pass_context(
                    entity_id=entity_id,
                    from_pass=1,
                    to_pass=max_passes,
                    time_horizon_days=90
                )

                temporal_insights = {
                    'narrative_summary': temporal_context.narrative_summary,
                    'confidence_boost': temporal_context.confidence_boost,
                    'focus_areas': temporal_context.focus_areas,
                    'episode_count': temporal_context.episode_count,
                    'recent_changes': temporal_context.recent_changes
                }

                logger.info(f"  ✅ Temporal context gathered")
                logger.info(f"     Episodes: {temporal_context.episode_count}")
                logger.info(f"     Confidence Boost: +{temporal_context.confidence_boost:.2f}")
            except Exception as e:
                logger.warning(f"  ⚠️  Temporal context failed: {e}")

        # Step 4: Gather network context
        network_context = None
        network_insights = {}
        if include_network:
            logger.info("\n🌐 Step 4: Gathering network context...")
            try:
                network_context = await self.graph_analyzer.analyze_network_context(
                    entity_id=entity_id
                )

                network_insights = {
                    'partner_count': len(network_context.partners),
                    'competitor_count': len(network_context.competitors),
                    'network_hypotheses_count': len(network_context.network_hypotheses),
                    'technology_clusters': network_context.technology_clusters
                }

                logger.info(f"  ✅ Network context gathered")
                logger.info(f"     Partners: {network_insights['partner_count']}")
                logger.info(f"     Competitors: {network_insights['competitor_count']}")
            except Exception as e:
                logger.warning(f"  ⚠️  Network context failed: {e}")

        # Step 5: Generate opportunity report
        logger.info("\n📋 Step 5: Generating opportunity report...")
        opportunity_report = await self._generate_opportunity_report(
            entity_id=entity_id,
            entity_name=entity_name,
            multi_pass_result=multi_pass_result,
            temporal_context=temporal_context,
            network_context=network_context
        )

        logger.info(f"  ✅ Opportunity report generated")
        logger.info(f"     Total Opportunities: {opportunity_report.total_opportunities}")
        logger.info(f"     High Priority: {opportunity_report.high_priority_count}")
        logger.info(f"     Medium Priority: {opportunity_report.medium_priority_count}")
        logger.info(f"     Low Priority: {opportunity_report.low_priority_count}")

        # Calculate duration
        duration_seconds = (datetime.now(timezone.utc) - start_time).total_seconds()

        # Create result
        result = OrchestratorResult(
            entity_id=entity_id,
            entity_name=entity_name,
            final_confidence=multi_pass_result.final_confidence,
            opportunity_report=opportunity_report,
            multi_pass_result=multi_pass_result,
            dossier=dossier,
            temporal_context=temporal_context,
            network_context=network_context,
            duration_seconds=duration_seconds,
            total_cost=total_cost,
            metadata={
                'max_passes': max_passes,
                'dossier_priority': dossier_priority,
                'dossier_generated': dossier is not None,
                'temporal_included': include_temporal,
                'network_included': include_network,
                'yp_capabilities': len(self.yp_profile.get('capabilities', []))
            }
        )

        logger.info(f"\n{'='*80}")
        logger.info(f"DISCOVERY COMPLETE: {entity_name}")
        logger.info(f"{'='*80}")
        logger.info(f"Final Confidence: {result.final_confidence:.2f}")
        logger.info(f"High-Priority Opportunities: {opportunity_report.high_priority_count}")
        logger.info(f"Duration: {duration_seconds:.1f}s")
        logger.info(f"Total Cost: ${total_cost:.2f}")
        logger.info(f"{'='*80}\n")

        return result

    async def _generate_opportunity_report(
        self,
        entity_id: str,
        entity_name: str,
        multi_pass_result: 'MultiPassResult',
        temporal_context: Optional['InterPassContext'] = None,
        network_context: Optional['NetworkContext'] = None
    ) -> OpportunityReport:
        """Generate final opportunity report from multi-pass results"""

        opportunities = []
        high_priority = 0
        medium_priority = 0
        low_priority = 0

        # Process signals from all passes
        for pass_result in multi_pass_result.pass_results:
            pass_num = pass_result.pass_number

            for signal in pass_result.validated_signals:
                # Extract signal data
                signal_dict = signal if isinstance(signal, dict) else {
                    'id': getattr(signal, 'id', 'unknown'),
                    'type': getattr(signal, 'type', 'UNKNOWN'),
                    'subtype': getattr(signal, 'subtype', 'general'),
                    'category': getattr(signal, 'category', 'General'),
                    'confidence': getattr(signal, 'confidence', 0.5),
                    'evidence': getattr(signal, 'evidence', [])
                }

                confidence = signal_dict.get('confidence', 0.5)

                # Skip low-confidence signals
                if confidence < 0.40:
                    continue

                # Create opportunity
                opportunity = Opportunity(
                    pass_number=pass_num,
                    signal_type=signal_dict.get('type', 'UNKNOWN'),
                    category=signal_dict.get('category', 'General'),
                    confidence=confidence,
                    evidence_count=len(signal_dict.get('evidence', [])),
                    yp_service=self._match_signal_to_yp_service(signal_dict),
                    estimated_value=self._estimate_value(signal_dict, confidence),
                    recommended_action=self._get_recommended_action(confidence),
                    metadata={
                        'signal_id': signal_dict.get('id'),
                        'subtype': signal_dict.get('subtype', 'general')
                    }
                )

                # Add temporal fit if available
                if temporal_context:
                    opportunity.temporal_fit = temporal_context.confidence_boost

                # Add network influence if available
                if network_context:
                    network_score = self._calculate_network_score(
                        signal_dict.get('category'),
                        network_context
                    )
                    opportunity.network_influence = network_score

                opportunities.append(opportunity)

                # Count by priority
                if confidence >= 0.80:
                    high_priority += 1
                elif confidence >= 0.60:
                    medium_priority += 1
                else:
                    low_priority += 1

        # Confidence trend across passes
        confidence_trend = []
        for pass_result in multi_pass_result.pass_results:
            if pass_result.validated_signals:
                avg_confidence = sum(
                    s.get('confidence', 0.5) if isinstance(s, dict)
                    else getattr(s, 'confidence', 0.5)
                    for s in pass_result.validated_signals
                ) / len(pass_result.validated_signals)
                confidence_trend.append(avg_confidence)

        return OpportunityReport(
            opportunities=opportunities,
            total_opportunities=len(opportunities),
            high_priority_count=high_priority,
            medium_priority_count=medium_priority,
            low_priority_count=low_priority,
            confidence_trend=confidence_trend,
            temporal_insights=temporal_context.__dict__ if temporal_context else {},
            network_insights=network_context.__dict__ if network_context else {}
        )

    def _priority_to_score(self, priority: str) -> int:
        """Convert priority string to score"""
        mapping = {
            'BASIC': 30,
            'STANDARD': 50,
            'PREMIUM': 80
        }
        return mapping.get(priority.upper(), 50)

    def _priority_to_sections(self, priority: str) -> int:
        """Convert priority string to number of dossier sections"""
        mapping = {
            'BASIC': 3,
            'STANDARD': 7,
            'PREMIUM': 11
        }
        return mapping.get(priority.upper(), 7)

    def _match_signal_to_yp_service(self, signal: Dict) -> str:
        """Match signal category to Yellow Panther service"""
        category = signal.get('category', '').lower()
        signal_type = signal.get('type', '').lower()

        # Simple matching rules
        if any(keyword in category or keyword in signal_type
               for keyword in ['react', 'web', 'frontend', 'website']):
            return 'React Web Development'
        elif any(keyword in category or keyword in signal_type
                 for keyword in ['mobile', 'app', 'ios', 'android']):
            return 'React Mobile Development'
        elif any(keyword in category or keyword in signal_type
                 for keyword in ['digital', 'transformation', 'modernization']):
            return 'Digital Transformation'
        elif any(keyword in category or keyword in signal_type
                 for keyword in ['ecommerce', 'e-commerce', 'shop', 'store']):
            return 'E-commerce Solutions'
        elif any(keyword in category or keyword in signal_type
                 for keyword in ['fan', 'engagement', 'supporter']):
            return 'Fan Engagement Platforms'
        else:
            return 'General Consulting'

    def _estimate_value(self, signal: Dict, confidence: float) -> float:
        """Estimate opportunity value in USD"""
        category = signal.get('category', '').lower()

        # Base values by category
        base_values = {
            'digital transformation': 500000,
            'crm': 250000,
            'data platform': 300000,
            'ai platform': 400000,
            'web development': 150000,
            'mobile app': 200000,
            'fan engagement': 175000
        }

        # Find matching base value
        base_value = 50000  # Default
        for keyword, value in base_values.items():
            if keyword in category:
                base_value = value
                break

        # Adjust by confidence
        return base_value * confidence

    def _get_recommended_action(self, confidence: float) -> str:
        """Get recommended action based on confidence"""
        if confidence >= 0.80:
            return 'Immediate outreach'
        elif confidence >= 0.60:
            return 'Engage sales team'
        elif confidence >= 0.40:
            return 'Add to watchlist'
        else:
            return 'Monitor for changes'

    def _calculate_network_score(
        self,
        category: str,
        network_context: 'NetworkContext'
    ) -> float:
        """Calculate network influence score for category"""
        # Simple implementation - check if category appears in network hypotheses
        for hyp in network_context.network_hypotheses:
            if category.lower() in hyp.get('category', '').lower():
                return hyp.get('influence_score', 0.5)
        return 0.0

    def save_result(self, result: OrchestratorResult, output_dir: str = "data"):
        """Save orchestrator result to JSON file"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"orchestrator_result_{result.entity_id}_{timestamp}.json"
        filepath = output_path / filename

        # Convert to dict
        result_dict = {
            'entity_id': result.entity_id,
            'entity_name': result.entity_name,
            'final_confidence': result.final_confidence,
            'duration_seconds': result.duration_seconds,
            'total_cost': result.total_cost,
            'opportunity_report': asdict(result.opportunity_report),
            'multi_pass_summary': {
                'total_signals': result.multi_pass_result.total_signals_detected,
                'high_confidence': result.multi_pass_result.high_confidence_signals,
                'unique_categories': result.multi_pass_result.unique_categories,
                'total_iterations': result.multi_pass_result.total_iterations
            },
            'metadata': result.metadata
        }

        # Write to file
        with open(filepath, 'w') as f:
            json.dump(result_dict, f, indent=2, default=str)

        logger.info(f"💾 Result saved to {filepath}")
        return filepath


# Convenience functions for common use cases

async def quick_discovery(
    entity_id: str,
    entity_name: str,
    max_passes: int = 2
) -> OrchestratorResult:
    """
    Quick discovery with minimal passes and intelligence

    Use for rapid assessment when time/cost is constrained
    """
    orchestrator = MultiPassRFPOrchestrator()
    return await orchestrator.discover_rfp_opportunities(
        entity_id=entity_id,
        entity_name=entity_name,
        max_passes=max_passes,
        dossier_priority='BASIC',
        include_temporal=False,
        include_network=False
    )


async def full_discovery(
    entity_id: str,
    entity_name: str,
    max_passes: int = 4
) -> OrchestratorResult:
    """
    Full discovery with maximum intelligence

    Use for comprehensive analysis when accuracy is critical
    """
    orchestrator = MultiPassRFPOrchestrator()
    return await orchestrator.discover_rfp_opportunities(
        entity_id=entity_id,
        entity_name=entity_name,
        max_passes=max_passes,
        dossier_priority='PREMIUM',
        include_temporal=True,
        include_network=True
    )


# Main entry point for testing
if __name__ == "__main__":
    import asyncio

    async def test_orchestrator():
        """Test the orchestrator with Arsenal FC"""
        print("\n🧪 Testing MultiPassRFPOrchestrator\n")

        orchestrator = MultiPassRFPOrchestrator()

        # Quick discovery test
        print("Running quick discovery (2 passes, BASIC)...")
        result = await orchestrator.discover_rfp_opportunities(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            max_passes=2,
            dossier_priority='BASIC',
            include_temporal=False,
            include_network=False
        )

        print(f"\nResults:")
        print(f"  Final Confidence: {result.final_confidence:.2f}")
        print(f"  Opportunities: {result.opportunity_report.total_opportunities}")
        print(f"  High Priority: {result.opportunity_report.high_priority_count}")
        print(f"  Duration: {result.duration_seconds:.1f}s")

        # Save result
        output_file = orchestrator.save_result(result)
        print(f"\n✅ Test complete! Results saved to {output_file}")

    asyncio.run(test_orchestrator())
