"""
Multi-Agent Coordinator - Orchestration Layer

Coordinates Search → Scrape → Analysis agents for intelligent entity discovery.

Architecture:
- Search Agent: Discovers domains and web presence
- Scrape Agent: Extracts structured profiles
- Analysis Agent: Scores signals and calculates confidence
- Coordinator: Orchestrates workflow and manages agent context
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass, field
import json

logger = logging.getLogger(__name__)


# =============================================================================
# Agent Context
# =============================================================================

@dataclass
class AgentContext:
    """Shared context for agent coordination"""
    entity_name: str
    entity_id: str
    entity_type: str = "organization"

    # Search phase
    discovered_domains: List[str] = field(default_factory=list)
    primary_domain: Optional[str] = None
    subdomains: List[str] = field(default_factory=list)

    # Scrape phase
    scraped_urls: List[str] = field(default_factory=list)
    entity_profile: Dict[str, Any] = field(default_factory=dict)

    # Analysis phase
    raw_signals: List[Dict[str, Any]] = field(default_factory=list)
    scored_signals: List[Dict[str, Any]] = field(default_factory=list)
    confidence_metrics: Dict[str, Any] = field(default_factory=dict)

    # Metadata
    iterations: int = 0
    max_iterations: int = 10
    target_confidence: float = 0.80
    current_confidence: float = 0.50

    # Timing
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dict"""
        return {
            "entity_name": self.entity_name,
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "discovered_domains": self.discovered_domains,
            "primary_domain": self.primary_domain,
            "subdomains": self.subdomains,
            "scraped_urls": self.scraped_urls,
            "entity_profile": self.entity_profile,
            "raw_signals": self.raw_signals,
            "scored_signals": self.scored_signals,
            "confidence_metrics": self.confidence_metrics,
            "iterations": self.iterations,
            "max_iterations": self.max_iterations,
            "target_confidence": self.target_confidence,
            "current_confidence": self.current_confidence,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None
        }


# =============================================================================
# Multi-Agent Coordinator
# =============================================================================

class MultiAgentCoordinator:
    """
    Coordinates Search → Scrape → Analysis agents

    Workflow:
    1. Search Phase: Discover official domains
    2. Scrape Phase: Extract structured profile
    3. Analysis Phase: Score signals and calculate confidence

    Iteration:
    - If confidence < target, loop back with refined search
    - Stop when: target_confidence reached OR max_iterations OR saturated
    """

    def __init__(
        self,
        max_iterations: int = 10,
        target_confidence: float = 0.80,
        verbose: bool = True
    ):
        """
        Initialize coordinator

        Args:
            max_iterations: Maximum discovery iterations
            target_confidence: Target confidence score
            verbose: Enable verbose logging
        """
        self.max_iterations = max_iterations
        self.target_confidence = target_confidence
        self.verbose = verbose

        # Initialize agents
        from backend.agents.search_agent import SearchAgent
        from backend.agents.scrape_agent import ScrapeAgent
        from backend.agents.analysis_agent import AnalysisAgent

        self.search_agent = SearchAgent()
        self.scrape_agent = ScrapeAgent()
        self.analysis_agent = AnalysisAgent()

        logger.info(f"🤖 Multi-Agent Coordinator initialized (max_iterations: {max_iterations}, target: {target_confidence})")

    async def discover_entity(
        self,
        entity_name: str,
        entity_id: str,
        entity_type: str = "organization",
        max_iterations: Optional[int] = None
    ) -> AgentContext:
        """
        Run full discovery workflow for an entity

        Args:
            entity_name: Name of the entity
            entity_id: Unique entity identifier
            entity_type: Type of entity
            max_iterations: Override max iterations

        Returns:
            AgentContext with complete discovery results
        """
        max_iterations = max_iterations or self.max_iterations

        logger.info(f"🚀 Starting discovery for: {entity_name} ({entity_id})")

        # Initialize context
        context = AgentContext(
            entity_name=entity_name,
            entity_id=entity_id,
            entity_type=entity_type,
            max_iterations=max_iterations,
            target_confidence=self.target_confidence
        )

        # Run discovery loop
        try:
            for iteration in range(max_iterations):
                context.iterations = iteration + 1

                if self.verbose:
                    logger.info(f"\n{'='*60}")
                    logger.info(f"Iteration {iteration + 1}/{max_iterations}: {entity_name}")
                    logger.info(f"Current confidence: {context.current_confidence:.3f}")
                    logger.info(f"{'='*60}\n")

                # Phase 1: Search
                context = await self._run_search_phase(context)

                # Phase 2: Scrape
                context = await self._run_scrape_phase(context)

                # Phase 3: Analysis
                context = await self._run_analysis_phase(context)

                # Check stopping conditions
                if self._should_stop(context):
                    break

        except Exception as e:
            logger.error(f"❌ Discovery failed: {e}")
            context.confidence_metrics["error"] = str(e)

        finally:
            context.end_time = datetime.now()

        # Final summary
        self._log_summary(context)

        return context

    async def _run_search_phase(self, context: AgentContext) -> AgentContext:
        """Run Search Agent to discover domains"""
        if self.verbose:
            logger.info("🔍 Phase 1: Search - Discovering domains...")

        try:
            # Discover domains
            result = await self.search_agent.discover_domains(
                entity_name=context.entity_name,
                entity_type=context.entity_type,
                max_iterations=3
            )

            # Update context
            context.primary_domain = result.get("primary_domain")
            context.discovered_domains = [context.primary_domain] if context.primary_domain else []
            context.subdomains = result.get("subdomains", [])

            if self.verbose:
                logger.info(f"✅ Search complete: {context.primary_domain}")
                if context.subdomains:
                    logger.info(f"   Subdomains: {', '.join(context.subdomains[:3])}")

        except Exception as e:
            logger.warning(f"⚠️ Search phase failed: {e}")

        return context

    async def _run_scrape_phase(self, context: AgentContext) -> AgentContext:
        """Run Scrape Agent to extract profile"""
        if self.verbose:
            logger.info("📄 Phase 2: Scrape - Extracting profile...")

        # Build URL list
        urls = []
        if context.primary_domain:
            urls.append(f"https://{context.primary_domain}")
        urls.extend([f"https://{sub}" for sub in context.subdomains[:2]])

        if not urls:
            logger.warning("⚠️ No URLs to scrape")
            return context

        try:
            # Extract profile
            result = await self.scrape_agent.extract_entity_profile(
                entity_name=context.entity_name,
                urls=urls,
                max_tokens=10000,
                max_pages=3
            )

            # Update context
            context.entity_profile = result.get("entity_profile", {})
            context.scraped_urls = urls[:result.get("pages_scraped", len(urls))]

            # Extract raw signals
            raw_signals = self._extract_signals_from_profile(context.entity_profile)
            context.raw_signals.extend(raw_signals)

            if self.verbose:
                logger.info(f"✅ Scrape complete: {len(context.scraped_urls)} pages, {len(raw_signals)} signals")

        except Exception as e:
            logger.warning(f"⚠️ Scrape phase failed: {e}")

        return context

    async def _run_analysis_phase(self, context: AgentContext) -> AgentContext:
        """Run Analysis Agent to score signals"""
        if self.verbose:
            logger.info("📊 Phase 3: Analysis - Scoring signals...")

        if not context.raw_signals:
            logger.warning("⚠️ No signals to score")
            return context

        try:
            # Score signals
            result = await self.analysis_agent.score_signals(
                entity_name=context.entity_name,
                signals=context.raw_signals,
                base_confidence=context.current_confidence
            )

            # Update context
            context.scored_signals = result.get("signals", [])
            context.confidence_metrics = result.get("confidence_metrics", {})
            context.current_confidence = context.confidence_metrics.get("final_confidence", context.current_confidence)

            if self.verbose:
                band = context.confidence_metrics.get("band", "UNKNOWN")
                logger.info(f"✅ Analysis complete: {context.current_confidence:.3f} ({band})")

        except Exception as e:
            logger.warning(f"⚠️ Analysis phase failed: {e}")

        return context

    def _should_stop(self, context: AgentContext) -> bool:
        """Check if discovery should stop"""
        # Target confidence reached
        if context.current_confidence >= context.target_confidence:
            if self.verbose:
                logger.info(f"🎯 Target confidence reached: {context.current_confidence:.3f}")
            return True

        # Actionable gate passed
        actionable = context.confidence_metrics.get("actionable_gate", False)
        if actionable:
            if self.verbose:
                logger.info(f"🎯 Actionable gate passed!")
            return True

        # Saturation detected
        saturated = any(
            s.get("decision") == "SATURATED"
            for s in context.scored_signals
        )
        if saturated:
            if self.verbose:
                logger.info(f"🔄 Category saturated")
            return True

        # Max iterations reached
        if context.iterations >= context.max_iterations:
            if self.verbose:
                logger.info(f"🔄 Max iterations reached")
            return True

        return False

    def _extract_signals_from_profile(self, profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract raw signals from entity profile"""
        signals = []

        # Technology stack signals
        tech_stack = profile.get("technology_stack", {})
        for category, technologies in tech_stack.items():
            if isinstance(technologies, list) and technologies:
                signals.append({
                    "type": category.upper(),
                    "evidence": [f"Uses {tech}" for tech in technologies],
                    "source": "profile_extraction"
                })

        # Partnership signals
        partnerships = profile.get("vendor_partnerships", [])
        for partner in partnerships[:3]:
            signals.append({
                "type": "PARTNERSHIP",
                "evidence": [f"Partnership with {partner}"],
                "source": "profile_extraction"
            })

        # Maturity signals
        maturity = profile.get("digital_maturity", "")
        if maturity in ["HIGH", "MEDIUM"]:
            signals.append({
                "type": "DIGITAL_MATURITY",
                "evidence": [f"Digital maturity: {maturity}"],
                "source": "profile_extraction"
            })

        return signals

    def _log_summary(self, context: AgentContext):
        """Log discovery summary"""
        duration = (context.end_time - context.start_time).total_seconds() if context.end_time else 0

        logger.info(f"\n{'='*60}")
        logger.info(f"Discovery Summary: {context.entity_name}")
        logger.info(f"{'='*60}")
        logger.info(f"Iterations: {context.iterations}/{context.max_iterations}")
        logger.info(f"Duration: {duration:.1f}s")
        logger.info(f"Domain: {context.primary_domain or 'Not found'}")
        logger.info(f"Confidence: {context.current_confidence:.3f} ({context.confidence_metrics.get('band', 'UNKNOWN')})")
        logger.info(f"Actionable: {'Yes' if context.confidence_metrics.get('actionable_gate') else 'No'}")
        logger.info(f"{'='*60}\n")


# =============================================================================
# Convenience Functions
# =============================================================================

async def discover_entity_with_agents(
    entity_name: str,
    entity_id: str,
    entity_type: str = "organization",
    max_iterations: int = 10,
    target_confidence: float = 0.80
) -> Dict[str, Any]:
    """
    Convenience function for entity discovery

    Args:
        entity_name: Name of the entity
        entity_id: Unique entity identifier
        entity_type: Type of entity
        max_iterations: Maximum discovery iterations
        target_confidence: Target confidence score

    Returns:
        Dict with complete discovery results
    """
    coordinator = MultiAgentCoordinator(
        max_iterations=max_iterations,
        target_confidence=target_confidence
    )

    context = await coordinator.discover_entity(
        entity_name=entity_name,
        entity_id=entity_id,
        entity_type=entity_type
    )

    return context.to_dict()


if __name__ == "__main__":
    import asyncio

    async def test_coordinator():
        """Test Multi-Agent Coordinator"""
        print("Testing Multi-Agent Coordinator...")

        coordinator = MultiAgentCoordinator(
            max_iterations=3,
            target_confidence=0.70,
            verbose=True
        )

        # Test full discovery
        context = await coordinator.discover_entity(
            entity_name="Arsenal FC",
            entity_id="arsenal-fc",
            entity_type="organization"
        )

        print(f"\nFinal Result:")
        print(f"Domain: {context.primary_domain}")
        print(f"Confidence: {context.current_confidence:.3f}")
        print(f"Band: {context.confidence_metrics.get('band', 'UNKNOWN')}")
        print(f"Signals: {len(context.scored_signals)}")

        print("\n✅ Tests complete!")

    asyncio.run(test_coordinator())
