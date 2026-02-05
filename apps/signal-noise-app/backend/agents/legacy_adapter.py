"""
Legacy Adapter - Backward Compatibility Layer

Adapters for existing code to use multi-agent system internally.
Maintains existing interfaces while leveraging new agent capabilities.

Adapters:
- DigitalDiscoveryAgentAdapter: Wraps MultiAgentCoordinator
- TemplateValidationAdapter: Wraps agents for template validation
- HypothesisDiscoveryAdapter: Wraps agents for hypothesis-driven discovery
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


# =============================================================================
# Digital Discovery Agent Adapter
# =============================================================================

class DigitalDiscoveryAgentAdapter:
    """
    Adapter for digital discovery using multi-agent coordinator internally

    Maintains the same interface as existing DigitalDiscoveryAgent
    but uses Search → Scrape → Analysis agents under the hood.
    """

    def __init__(
        self,
        claude_client=None,
        brightdata_client=None,
        max_iterations: int = 10,
        target_confidence: float = 0.80
    ):
        """
        Initialize adapter (clients are optional, will use agents internally)

        Args:
            claude_client: Optional legacy Claude client (ignored, using agents)
            brightdata_client: Optional legacy BrightData client (ignored, using agents)
            max_iterations: Maximum discovery iterations
            target_confidence: Target confidence score
        """
        self.max_iterations = max_iterations
        self.target_confidence = target_confidence

        # Initialize multi-agent coordinator
        from backend.agents.multi_agent_coordinator import MultiAgentCoordinator

        self.coordinator = MultiAgentCoordinator(
            max_iterations=max_iterations,
            target_confidence=target_confidence,
            verbose=True
        )

        logger.info(f"🔄 DigitalDiscoveryAgentAdapter initialized (multi-agent mode)")

    async def discover_entity(
        self,
        entity_name: str,
        entity_id: str,
        entity_type: str = "organization",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Discover entity using multi-agent coordinator

        Args:
            entity_name: Name of the entity
            entity_id: Unique entity identifier
            entity_type: Type of entity
            **kwargs: Additional parameters (ignored for now)

        Returns:
            Dict in legacy format with discovery results
        """
        logger.info(f"🔄 Discovering entity via adapter: {entity_name}")

        # Use multi-agent coordinator
        context = await self.coordinator.discover_entity(
            entity_name=entity_name,
            entity_id=entity_id,
            entity_type=entity_type
        )

        # Convert to legacy format
        return self._context_to_legacy_result(context)

    def _context_to_legacy_result(self, context) -> Dict[str, Any]:
        """Convert AgentContext to legacy result format"""
        return {
            "entity_id": context.entity_id,
            "entity_name": context.entity_name,
            "entity_type": context.entity_type,

            # Discovery results
            "primary_domain": context.primary_domain,
            "domains_discovered": context.discovered_domains,
            "subdomains": context.subdomains,

            # Profile
            "entity_profile": context.entity_profile,
            "scraped_urls": context.scraped_urls,
            "pages_scraped": len(context.scraped_urls),

            # Signals
            "raw_signals": context.raw_signals,
            "scored_signals": context.scored_signals,
            "signal_count": len(context.scored_signals),

            # Confidence
            "confidence": context.current_confidence,
            "confidence_band": context.confidence_metrics.get("band", "UNKNOWN"),
            "actionable_gate": context.confidence_metrics.get("actionable_gate", False),

            # Metrics
            "iterations": context.iterations,
            "max_iterations": context.max_iterations,
            "target_confidence": context.target_confidence,
            "confidence_gained": context.current_confidence - 0.50,

            # Timing
            "start_time": context.start_time.isoformat(),
            "end_time": context.end_time.isoformat() if context.end_time else None,
            "duration_seconds": (context.end_time - context.start_time).total_seconds() if context.end_time else 0,

            # Metadata
            "discovery_method": "multi_agent",
            "agents_used": ["search", "scrape", "analysis"],

            # Status
            "status": "success" if context.current_confidence > 0.50 else "partial"
        }


# =============================================================================
# Template Validation Adapter
# =============================================================================

class TemplateValidationAdapter:
    """
    Adapter for template validation using agents

    Uses Search and Scrape agents to validate templates against real entities.
    """

    def __init__(self):
        """Initialize adapter"""
        from backend.agents.search_agent import SearchAgent
        from backend.agents.scrape_agent import ScrapeAgent
        from backend.agents.analysis_agent import AnalysisAgent

        self.search_agent = SearchAgent()
        self.scrape_agent = ScrapeAgent()
        self.analysis_agent = AnalysisAgent()

        logger.info("🔄 TemplateValidationAdapter initialized")

    async def validate_template(
        self,
        template_id: str,
        test_entities: List[str],
        template_hypotheses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate template against test entities

        Args:
            template_id: Template identifier
            test_entities: List of entity names to test against
            template_hypotheses: Hypotheses from template

        Returns:
            Dict with validation results
        """
        logger.info(f"🔄 Validating template {template_id} against {len(test_entities)} entities")

        results = []
        for entity_name in test_entities:
            try:
                # Discover entity
                context = await self._discover_entity_for_validation(entity_name)

                # Check if hypotheses were validated
                validated_count = sum(
                    1 for s in context.scored_signals
                    if s.get("decision") in ["ACCEPT", "WEAK_ACCEPT"]
                )

                results.append({
                    "entity_name": entity_name,
                    "confidence": context.current_confidence,
                    "signals_found": len(context.scored_signals),
                    "hypotheses_validated": validated_count,
                    "status": "validated" if validated_count > 0 else "no_signals"
                })

            except Exception as e:
                logger.warning(f"⚠️ Validation failed for {entity_name}: {e}")
                results.append({
                    "entity_name": entity_name,
                    "error": str(e),
                    "status": "error"
                })

        # Calculate validation metrics
        successful = [r for r in results if r.get("status") in ["validated", "no_signals"]]
        validation_rate = len([r for r in successful if r.get("hypotheses_validated", 0) > 0]) / len(test_entities) if test_entities else 0

        return {
            "template_id": template_id,
            "test_entities_count": len(test_entities),
            "validation_rate": validation_rate,
            "results": results,
            "recommendation": "APPROVED" if validation_rate > 0.6 else "NEEDS_REVISION"
        }

    async def _discover_entity_for_validation(self, entity_name: str):
        """Quick discovery for template validation"""
        from backend.agents.multi_agent_coordinator import AgentContext

        # Simplified discovery (max 2 iterations)
        coordinator = self.search_agent  # Reuse search agent
        context = AgentContext(
            entity_name=entity_name,
            entity_id=entity_name.lower().replace(" ", "-"),
            max_iterations=2
        )

        # Quick search
        search_result = await self.search_agent.discover_domains(entity_name, max_iterations=2)
        context.primary_domain = search_result.get("primary_domain")

        # Quick scrape if domain found
        if context.primary_domain:
            urls = [f"https://{context.primary_domain}"]
            scrape_result = await self.scrape_agent.extract_entity_profile(
                entity_name, urls, max_tokens=5000, max_pages=2
            )
            context.entity_profile = scrape_result.get("entity_profile", {})

            # Extract signals
            raw_signals = self._extract_signals(context.entity_profile)

            # Quick analysis
            analysis_result = await self.analysis_agent.score_signals(
                entity_name, raw_signals, base_confidence=0.50
            )
            context.scored_signals = analysis_result.get("signals", [])
            context.current_confidence = analysis_result.get("confidence_metrics", {}).get("final_confidence", 0.50)

        return context

    def _extract_signals(self, profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract signals from profile"""
        signals = []

        tech_stack = profile.get("technology_stack", {})
        for category, technologies in tech_stack.items():
            if isinstance(technologies, list) and technologies:
                signals.append({
                    "type": category.upper(),
                    "evidence": [f"Uses {tech}" for tech in technologies],
                    "source": "profile"
                })

        return signals


# =============================================================================
# Hypothesis Discovery Adapter
# =============================================================================

class HypothesisDiscoveryAdapter:
    """
    Adapter for hypothesis-driven discovery using agents

    Uses multi-agent coordinator to test hypotheses efficiently.
    """

    def __init__(self, max_iterations: int = 5):
        """Initialize adapter"""
        from backend.agents.multi_agent_coordinator import MultiAgentCoordinator

        self.coordinator = MultiAgentCoordinator(
            max_iterations=max_iterations,
            target_confidence=0.70,
            verbose=False
        )

        logger.info("🔄 HypothesisDiscoveryAdapter initialized")

    async def test_hypothesis(
        self,
        entity_name: str,
        entity_id: str,
        hypothesis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Test single hypothesis using agents

        Args:
            entity_name: Name of the entity
            entity_id: Unique entity identifier
            hypothesis: Hypothesis to test

        Returns:
            Dict with hypothesis test results
        """
        logger.info(f"🔄 Testing hypothesis for {entity_name}: {hypothesis.get('name', 'unknown')}")

        # Discover entity (focused on hypothesis)
        context = await self.coordinator.discover_entity(
            entity_name=entity_name,
            entity_id=entity_id,
            entity_type="organization"
        )

        # Check if hypothesis was validated
        hypothesis_type = hypothesis.get("type", "").upper()
        matching_signals = [
            s for s in context.scored_signals
            if hypothesis_type in s.get("type", "")
        ]

        if matching_signals:
            # Best signal determines hypothesis outcome
            best_signal = max(matching_signals, key=lambda s: s.get("confidence", 0))

            return {
                "hypothesis_id": hypothesis.get("id"),
                "hypothesis_name": hypothesis.get("name"),
                "entity_id": entity_id,
                "decision": best_signal.get("decision", "REJECT"),
                "confidence": best_signal.get("confidence", 0.0),
                "evidence": best_signal.get("evidence", []),
                "validated": best_signal.get("decision") in ["ACCEPT", "WEAK_ACCEPT"]
            }
        else:
            return {
                "hypothesis_id": hypothesis.get("id"),
                "hypothesis_name": hypothesis.get("name"),
                "entity_id": entity_id,
                "decision": "REJECT",
                "confidence": 0.0,
                "evidence": ["No matching signals found"],
                "validated": False
            }


# =============================================================================
# Convenience Functions
# =============================================================================

async def discover_with_agents(
    entity_name: str,
    entity_id: str,
    entity_type: str = "organization",
    max_iterations: int = 10,
    target_confidence: float = 0.80
) -> Dict[str, Any]:
    """
    Convenience function for backward-compatible discovery

    Args:
        entity_name: Name of the entity
        entity_id: Unique entity identifier
        entity_type: Type of entity
        max_iterations: Maximum iterations
        target_confidence: Target confidence

    Returns:
        Dict with discovery results (legacy format)
    """
    adapter = DigitalDiscoveryAgentAdapter(
        max_iterations=max_iterations,
        target_confidence=target_confidence
    )

    return await adapter.discover_entity(
        entity_name=entity_name,
        entity_id=entity_id,
        entity_type=entity_type
    )


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def test_adapters():
        """Test all adapters"""
        print("Testing Legacy Adapters...\n")

        # Test DigitalDiscoveryAgentAdapter
        print("1. Testing DigitalDiscoveryAgentAdapter...")
        adapter = DigitalDiscoveryAgentAdapter(max_iterations=2, target_confidence=0.70)
        result = await adapter.discover_entity("Arsenal FC", "arsenal-fc")
        print(f"   Result: {result['confidence']:.3f} ({result['confidence_band']})")
        print(f"   Domain: {result['primary_domain']}")
        print(f"   Discovery method: {result['discovery_method']}")

        # Test TemplateValidationAdapter
        print("\n2. Testing TemplateValidationAdapter...")
        validator = TemplateValidationAdapter()
        validation_result = await validator.validate_template(
            template_id="test_template",
            test_entities=["Arsenal FC"],
            template_hypotheses=[{"id": "h1", "name": "CRM Detection", "type": "CRM_ANALYTICS"}]
        )
        print(f"   Validation rate: {validation_result['validation_rate']:.2%}")
        print(f"   Recommendation: {validation_result['recommendation']}")

        print("\n✅ All adapter tests complete!")

    asyncio.run(test_adapters())
