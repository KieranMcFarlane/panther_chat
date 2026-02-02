#!/usr/bin/env python3
"""
Hypothesis-Driven Discovery

Deterministic single-hop execution with EIG-based hypothesis prioritization.

Key Features:
- Single-hop-per-iteration (no multi-hop, no parallel exploration)
- EIG-based hypothesis ranking (prioritize uncertain + valuable hypotheses)
- Depth-aware stopping (enforce 2-3 level depth limit)
- Deterministic cost control (predictable per-iteration cost)

Flow:
1. Initialize hypothesis set from template
2. For each iteration:
   a. Re-score all ACTIVE hypotheses by EIG
   b. Select top hypothesis (runtime enforces single-hop)
   c. Choose hop type within strategy rails
   d. Execute hop (scrape + evaluate)
   e. Update hypothesis state and confidence
   f. Check stopping conditions
3. Return final entity assessment

Usage:
    from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery

    discovery = HypothesisDrivenDiscovery(
        claude_client=claude,
        brightdata_client=brightdata
    )

    result = await discovery.run_discovery(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        template_id="tier_1_club_centralized_procurement",
        max_iterations=30,
        max_depth=3
    )
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# =============================================================================
# Hop Types (Strategy Rails)
# =============================================================================

class HopType(str, Enum):
    """Allowed hop types for hypothesis-driven discovery"""
    OFFICIAL_SITE = "official_site"           # Official domain, homepage
    CAREERS_PAGE = "careers_page"             # Jobs index, job posting
    LINKEDIN_JOB = "linkedin_job_posting"     # Specific LinkedIn job
    ANNUAL_REPORT = "annual_report"           # Financial section
    PRESS_RELEASE = "press_release"           # Recent news


# Allowed hop types per category (strategy rails)
ALLOWED_HOP_TYPES = {
    "official_site": ["homepage", "about", "press"],
    "careers_page": ["jobs_index", "job_posting"],
    "linkedin_job_posting": ["specific_role"],
    "annual_report": ["financial_section"],
    "press_release": ["recent_news"]
}

# Forbidden hop types (low signal sources)
FORBIDDEN_HOP_TYPES = [
    "social_media",      # Twitter, Facebook (low signal)
    "blogs",             # Corporate blogs (low signal)
    "third_party_news"   # Unless cited by entity
]


# =============================================================================
# Discovery Result
# =============================================================================

@dataclass
class DiscoveryResult:
    """
    Result from hypothesis-driven discovery

    Contains:
    - Final entity assessment
    - Total iterations and cost
    - Hypothesis states
    - Depth statistics
    - Signals discovered
    """
    entity_id: str
    entity_name: str
    final_confidence: float
    confidence_band: str
    is_actionable: bool
    iterations_completed: int
    total_cost_usd: float
    hypotheses: List[Any]  # List of Hypothesis objects
    depth_stats: Dict[int, int]  # depth -> iteration count
    signals_discovered: List[Dict[str, Any]]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'final_confidence': self.final_confidence,
            'confidence_band': self.confidence_band,
            'is_actionable': self.is_actionable,
            'iterations_completed': self.iterations_completed,
            'total_cost_usd': self.total_cost_usd,
            'hypotheses': [h.to_dict() if hasattr(h, 'to_dict') else h for h in self.hypotheses],
            'depth_stats': self.depth_stats,
            'signals_discovered': self.signals_discovered,
            'timestamp': self.timestamp.isoformat()
        }


# =============================================================================
# Hypothesis-Driven Discovery Engine
# =============================================================================

class HypothesisDrivenDiscovery:
    """
    Hypothesis-driven discovery engine with deterministic single-hop execution

    Implements optimal discovery strategy:
    1. Explicit hypothesis objects with state tracking
    2. EIG-based prioritization (focus on uncertain + valuable)
    3. Single-hop execution (deterministic cost, auditable)
    4. Depth-aware stopping (2-3 levels max)
    """

    def __init__(
        self,
        claude_client,
        brightdata_client,
        falkordb_client=None
    ):
        """
        Initialize hypothesis-driven discovery engine

        Args:
            claude_client: ClaudeClient for AI inference
            brightdata_client: BrightDataSDKClient for web scraping
            falkordb_client: Optional FalkorDB client for persistence
        """
        from backend.hypothesis_manager import HypothesisManager
        from backend.eig_calculator import EIGCalculator

        self.claude_client = claude_client
        self.brightdata_client = brightdata_client
        self.falkordb_client = falkordb_client

        # Initialize components
        self.hypothesis_manager = HypothesisManager(falkordb_client)
        self.eig_calculator = EIGCalculator()

        # Track cost
        self.total_cost_usd = 0.0

        logger.info("🔍 HypothesisDrivenDiscovery initialized")

    async def run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        template_id: str,
        max_iterations: int = 30,
        max_depth: int = 3
    ) -> DiscoveryResult:
        """
        Run hypothesis-driven discovery for entity

        Flow:
        1. Initialize hypothesis set from template
        2. For each iteration:
           a. Re-score all ACTIVE hypotheses by EIG
           b. Select top hypothesis (runtime enforces single-hop)
           c. Choose hop type within strategy rails
           d. Execute hop (scrape + evaluate)
           e. Update hypothesis state and confidence
           f. Check stopping conditions
        3. Return final entity assessment

        Args:
            entity_id: Entity identifier
            entity_name: Human-readable entity name
            template_id: Template to use for discovery
            max_iterations: Maximum iterations (default: 30)
            max_depth: Maximum depth level (default: 3)

        Returns:
            DiscoveryResult with final assessment
        """
        from backend.schemas import RalphState

        logger.info(f"🔍 Starting hypothesis-driven discovery for {entity_name}")
        logger.info(f"   Template: {template_id}")
        logger.info(f"   Max iterations: {max_iterations}")
        logger.info(f"   Max depth: {max_depth}")

        # Initialize
        state = RalphState(
            entity_id=entity_id,
            entity_name=entity_name,
            max_depth=max_depth,
            current_depth=1
        )

        # Initialize hypotheses from template
        hypotheses = await self.hypothesis_manager.initialize_hypotheses(
            template_id=template_id,
            entity_id=entity_id,
            entity_name=entity_name
        )

        if not hypotheses:
            logger.error(f"Failed to initialize hypotheses for {entity_name}")
            return self._build_failure_result(entity_id, entity_name, "No hypotheses initialized")

        state.active_hypotheses = hypotheses

        # Main iteration loop
        for iteration in range(1, max_iterations + 1):
            logger.info(f"\n--- Iteration {iteration} ---")

            # Phase A: Re-score hypotheses by EIG
            await self._rescore_hypotheses_by_eig(hypotheses)

            # Phase B: Select top hypothesis (runtime enforced)
            top_hypothesis = await self._select_top_hypothesis(hypotheses, state)

            if not top_hypothesis:
                logger.info("No active hypotheses remaining")
                break

            logger.info(
                f"Top hypothesis: {top_hypothesis.hypothesis_id} "
                f"(EIG: {top_hypothesis.expected_information_gain:.3f}, "
                f"Confidence: {top_hypothesis.confidence:.2f})"
            )

            # Phase C: Choose hop type (within strategy rails)
            hop_type = self._choose_next_hop(top_hypothesis, state)

            logger.info(f"Hop type: {hop_type} (depth: {state.current_depth})")

            # Phase D: Execute hop (scrape + evaluate)
            result = await self._execute_hop(
                hop_type=hop_type,
                hypothesis=top_hypothesis,
                state=state
            )

            if not result:
                logger.warning(f"Hop execution failed for {hop_type}")
                continue

            # Phase E: Update state
            await self._update_hypothesis_state(
                hypothesis=top_hypothesis,
                result=result,
                state=state
            )

            # Phase F: Check stopping conditions
            if self._should_stop(state, iteration, max_depth, top_hypothesis):
                logger.info(f"Stopping condition met at iteration {iteration}")
                break

        # Build final result
        return self._build_final_result(state, hypotheses)

    async def _rescore_hypotheses_by_eig(self, hypotheses: List):
        """
        Re-score all ACTIVE hypotheses by EIG

        Args:
            hypotheses: List of Hypothesis objects
        """
        for h in hypotheses:
            if h.status == "ACTIVE":
                # Calculate EIG (no cluster state yet)
                h.expected_information_gain = self.eig_calculator.calculate_eig(h)

    async def _select_top_hypothesis(
        self,
        hypotheses: List,
        state
    ) -> Optional[Any]:
        """
        Select top hypothesis by EIG (runtime enforces single-hop)

        Args:
            hypotheses: List of Hypothesis objects
            state: Current RalphState

        Returns:
            Hypothesis with highest EIG or None
        """
        # Filter active hypotheses
        active = [h for h in hypotheses if h.status == "ACTIVE"]

        if not active:
            return None

        # Sort by EIG (descending)
        sorted_hypotheses = sorted(
            active,
            key=lambda h: h.expected_information_gain,
            reverse=True
        )

        return sorted_hypotheses[0]

    def _choose_next_hop(self, hypothesis, state) -> HopType:
        """
        Choose next hop type within strategy rails

        Args:
            hypothesis: Top hypothesis to explore
            state: Current RalphState

        Returns:
            HopType to execute
        """
        # Simple strategy: use depth level to determine hop type
        depth_level = state.get_depth_level()

        if depth_level.value == "SURFACE":
            # Level 1: Start with official site
            return HopType.OFFICIAL_SITE

        elif depth_level.value == "OPERATIONAL":
            # Level 2: Check careers page
            return HopType.CAREERS_PAGE

        elif depth_level.value == "AUTHORITY":
            # Level 3: Deep dive (annual report or press release)
            if hypothesis.iterations_attempted < 3:
                return HopType.ANNUAL_REPORT
            else:
                return HopType.PRESS_RELEASE

        # Default
        return HopType.OFFICIAL_SITE

    async def _execute_hop(
        self,
        hop_type: HopType,
        hypothesis,
        state
    ) -> Optional[Dict[str, Any]]:
        """
        Execute single hop (scrape + evaluate)

        Args:
            hop_type: Type of hop to execute
            hypothesis: Hypothesis being explored
            state: Current RalphState

        Returns:
            Hop result with decision and confidence delta
        """
        logger.info(f"🔎 Executing hop: {hop_type}")

        # Track depth iteration
        state.increment_depth_count(state.current_depth)

        # Get URL based on hop type
        url = await self._get_url_for_hop(hop_type, hypothesis, state)

        if not url:
            logger.warning(f"Could not determine URL for hop type: {hop_type}")
            return None

        logger.info(f"Scraping: {url}")

        # Scrape URL
        try:
            content_result = await self.brightdata_client.scrape_as_markdown(url)

            if content_result.get('status') != 'success':
                logger.error(f"Scraping failed: {content_result.get('error', 'Unknown error')}")
                return None

            content = content_result.get('content', '')

            # Evaluate content with Claude
            evaluation = await self._evaluate_content_with_claude(
                content=content,
                hypothesis=hypothesis,
                hop_type=hop_type
            )

            # Add cost tracking
            hop_cost = 0.001  # TODO: Track actual cost
            self.total_cost_usd += hop_cost

            return {
                'hop_type': hop_type.value,
                'url': url,
                'decision': evaluation.get('decision', 'NO_PROGRESS'),
                'confidence_delta': evaluation.get('confidence_delta', 0.0),
                'justification': evaluation.get('justification', ''),
                'evidence_found': evaluation.get('evidence_found', ''),
                'cost_usd': hop_cost
            }

        except Exception as e:
            logger.error(f"Hop execution error: {e}")
            return None

    async def _get_url_for_hop(
        self,
        hop_type: HopType,
        hypothesis,
        state
    ) -> Optional[str]:
        """
        Get URL to scrape based on hop type

        Args:
            hop_type: Type of hop
            hypothesis: Hypothesis being explored
            state: Current RalphState

        Returns:
            URL to scrape or None
        """
        entity_name = state.entity_name

        # Simple URL generation (TODO: Use discovered channels from runtime bindings)
        if hop_type == HopType.OFFICIAL_SITE:
            # Search for official site
            search_query = f'"{entity_name}" official website'
            search_result = await self.brightdata_client.search_engine(
                query=search_query,
                engine='google',
                num_results=1
            )

            if search_result.get('status') == 'success' and search_result.get('results'):
                return search_result['results'][0].get('url')

        elif hop_type == HopType.CAREERS_PAGE:
            # Search for careers page
            search_query = f'"{entity_name}" careers jobs'
            search_result = await self.brightdata_client.search_engine(
                query=search_query,
                engine='google',
                num_results=1
            )

            if search_result.get('status') == 'success' and search_result.get('results'):
                return search_result['results'][0].get('url')

        elif hop_type == HopType.ANNUAL_REPORT:
            # Search for annual report
            search_query = f'"{entity_name}" annual report 2024'
            search_result = await self.brightdata_client.search_engine(
                query=search_query,
                engine='google',
                num_results=1
            )

            if search_result.get('status') == 'success' and search_result.get('results'):
                return search_result['results'][0].get('url')

        elif hop_type == HopType.PRESS_RELEASE:
            # Search for recent news
            search_query = f'"{entity_name}" recent news press release'
            search_result = await self.brightdata_client.search_engine(
                query=search_query,
                engine='google',
                num_results=1
            )

            if search_result.get('status') == 'success' and search_result.get('results'):
                return search_result['results'][0].get('url')

        return None

    async def _evaluate_content_with_claude(
        self,
        content: str,
        hypothesis,
        hop_type: HopType
    ) -> Dict[str, Any]:
        """
        Evaluate scraped content with Claude

        Args:
            content: Scraped markdown content
            hypothesis: Hypothesis being evaluated
            hop_type: Type of hop executed

        Returns:
            Evaluation result with decision and confidence delta
        """
        # Build evaluation prompt
        prompt = f"""
Evaluate this scraped content for hypothesis: {hypothesis.statement}

Content from {hop_type.value}:
{content[:2000]}  # Limit to 2000 chars for cost control

Task: Determine if this content supports or contradicts the hypothesis.

Return JSON:
{{
  "decision": "ACCEPT" | "WEAK_ACCEPT" | "REJECT" | "NO_PROGRESS",
  "confidence_delta": 0.0,
  "justification": "brief explanation",
  "evidence_found": "key evidence excerpt"
}}

Decision criteria:
- ACCEPT: Strong evidence of procurement intent (+0.06 delta)
- WEAK_ACCEPT: Capability but unclear procurement intent (+0.02 delta)
- REJECT: Evidence contradicts hypothesis (0.0 delta)
- NO_PROGRESS: No relevant evidence (0.0 delta)
"""

        try:
            response = await self.claude_client.query(
                prompt=prompt,
                model="claude-3-5-haiku-20241022",  # Use Haiku for cost efficiency
                max_tokens=500
            )

            # Parse JSON response
            import json
            import re

            json_match = re.search(r'\{[^}]*"decision"[^}]*\}', response, re.DOTALL)

            if json_match:
                return json.loads(json_match.group(0))
            else:
                logger.warning(f"Could not parse Claude response")
                return {
                    'decision': 'NO_PROGRESS',
                    'confidence_delta': 0.0,
                    'justification': 'Parse error',
                    'evidence_found': ''
                }

        except Exception as e:
            logger.error(f"Claude evaluation error: {e}")
            return {
                'decision': 'NO_PROGRESS',
                'confidence_delta': 0.0,
                'justification': f'Error: {str(e)}',
                'evidence_found': ''
            }

    async def _update_hypothesis_state(
        self,
        hypothesis,
        result: Dict[str, Any],
        state
    ):
        """
        Update hypothesis state after iteration

        Args:
            hypothesis: Hypothesis to update
            result: Hop execution result
            state: Current RalphState
        """
        # Update hypothesis via manager
        updated_hypothesis = await self.hypothesis_manager.update_hypothesis(
            hypothesis_id=hypothesis.hypothesis_id,
            entity_id=state.entity_id,
            decision=result['decision'],
            confidence_delta=result['confidence_delta'],
            evidence_ref=result['url']
        )

        # Update state confidence
        state.update_confidence(updated_hypothesis.confidence)
        state.iterations_completed += 1

        # Determine if we should go deeper
        if state.should_dig_deeper(updated_hypothesis):
            state.current_depth += 1
            logger.info(f"Digging deeper: depth {state.current_depth}")

        logger.info(
            f"Iteration complete: {result['decision']} "
            f"(+{result['confidence_delta']:.2f}) → "
            f"{updated_hypothesis.confidence:.2f}"
        )

    def _should_stop(
        self,
        state,
        iteration: int,
        max_depth: int,
        hypothesis
    ) -> bool:
        """
        Check if discovery should stop

        Args:
            state: Current RalphState
            iteration: Current iteration number
            max_depth: Maximum depth level
            hypothesis: Current hypothesis

        Returns:
            True if should stop, False otherwise
        """
        # Stop if no active hypotheses
        active_hypotheses = [h for h in state.active_hypotheses if h.status == "ACTIVE"]
        if not active_hypotheses:
            logger.info("No active hypotheses remaining")
            return True

        # Stop if globally saturated
        if state.global_saturated:
            logger.info("Global saturation reached")
            return True

        # Stop if confidence saturated
        if state.confidence_saturated:
            logger.info("Confidence saturation reached")
            return True

        # Stop if actionable gate reached (high confidence + >=2 ACCEPTs)
        if state.is_actionable and state.current_confidence > 0.80:
            logger.info(f"Actionable gate reached: {state.current_confidence:.2f}")
            return True

        # Stop if max depth reached
        if state.current_depth >= max_depth:
            # Check if we should stop at this depth
            if not state.should_dig_deeper(hypothesis):
                logger.info(f"Max depth reached: {max_depth}")
                return True

        return False

    def _build_final_result(
        self,
        state,
        hypotheses: List
    ) -> DiscoveryResult:
        """
        Build final discovery result

        Args:
            state: Final RalphState
            hypotheses: List of hypotheses

        Returns:
            DiscoveryResult
        """
        return DiscoveryResult(
            entity_id=state.entity_id,
            entity_name=state.entity_name,
            final_confidence=state.current_confidence,
            confidence_band=state.confidence_band.value,
            is_actionable=state.is_actionable,
            iterations_completed=state.iterations_completed,
            total_cost_usd=self.total_cost_usd,
            hypotheses=hypotheses,
            depth_stats=state.depth_counts,
            signals_discovered=[],  # TODO: Extract signals from iterations
            timestamp=datetime.now(timezone.utc)
        )

    def _build_failure_result(
        self,
        entity_id: str,
        entity_name: str,
        error_message: str
    ) -> DiscoveryResult:
        """Build failure result"""
        return DiscoveryResult(
            entity_id=entity_id,
            entity_name=entity_name,
            final_confidence=0.0,
            confidence_band="EXPLORATORY",
            is_actionable=False,
            iterations_completed=0,
            total_cost_usd=0.0,
            hypotheses=[],
            depth_stats={},
            signals_discovered=[],
            timestamp=datetime.now(timezone.utc)
        )


# =============================================================================
# Convenience Functions
# =============================================================================

async def run_hypothesis_driven_discovery(
    entity_id: str,
    entity_name: str,
    template_id: str,
    claude_client,
    brightdata_client,
    max_iterations: int = 30,
    max_depth: int = 3
) -> DiscoveryResult:
    """
    Convenience function to run hypothesis-driven discovery

    Args:
        entity_id: Entity identifier
        entity_name: Human-readable entity name
        template_id: Template to use
        claude_client: ClaudeClient instance
        brightdata_client: BrightDataSDKClient instance
        max_iterations: Maximum iterations
        max_depth: Maximum depth level

    Returns:
        DiscoveryResult
    """
    discovery = HypothesisDrivenDiscovery(
        claude_client=claude_client,
        brightdata_client=brightdata_client
    )

    return await discovery.run_discovery(
        entity_id=entity_id,
        entity_name=entity_name,
        template_id=template_id,
        max_iterations=max_iterations,
        max_depth=max_depth
    )


if __name__ == "__main__":
    # Test HypothesisDrivenDiscovery
    import asyncio

    async def test():
        print("=== Testing HypothesisDrivenDiscovery ===")

        # TODO: Add actual test with Claude client and BrightData client

        print("✅ HypothesisDrivenDiscovery test complete")

    asyncio.run(test())
