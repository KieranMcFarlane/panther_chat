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
    from hypothesis_driven_discovery import HypothesisDrivenDiscovery

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


# Import Phase 6 components
try:
    from parameter_tuning import ParameterConfig
    from eig_calculator import EIGConfig
    PARAMETER_TUNING_AVAILABLE = True
except ImportError:
    PARAMETER_TUNING_AVAILABLE = False
    ParameterConfig = None
    EIGConfig = None
    logger.warning("Phase 6 parameter tuning components not available")


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

# Fallback search queries when primary search fails
FALLBACK_QUERIES = {
    HopType.OFFICIAL_SITE: [
        '{entity} official site',
        '{entity} website',
        '{entity}.com'
    ],
    HopType.CAREERS_PAGE: [
        '{entity} careers jobs',
        '{entity} jobs',
        '{entity} work at',
        '{entity} career opportunities'
    ],
    HopType.ANNUAL_REPORT: [
        '{entity} annual report',
        '{entity} financial report',
        '{entity} 2024 report'
    ],
    HopType.PRESS_RELEASE: [
        '{entity} recent news press release',
        '{entity} press releases',
        '{entity} news'
    ],
    HopType.LINKEDIN_JOB: [
        '{entity} jobs careers site:linkedin.com',
        '{entity} careers',
        '{entity} open positions'
    ]
}


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
        falkordb_client=None,
        config: ParameterConfig = None,
        cache_enabled: bool = True
    ):
        """
        Initialize hypothesis-driven discovery engine with Phase 6 configuration

        Args:
            claude_client: ClaudeClient for AI inference
            brightdata_client: BrightDataSDKClient for web scraping
            falkordb_client: Optional FalkorDB client for persistence
            config: Optional ParameterConfig for Phase 6 parameter tuning
            cache_enabled: Enable Phase 5 LRU cache (default: True)
        """
        from hypothesis_manager import HypothesisManager
        from eig_calculator import EIGCalculator

        self.claude_client = claude_client
        self.brightdata_client = brightdata_client
        self.falkordb_client = falkordb_client

        # Load or create default config
        self.config = config
        if config is None and PARAMETER_TUNING_AVAILABLE:
            self.config = ParameterConfig()
            logger.info("🔍 Using default ParameterConfig")
        elif config is None:
            self.config = None
            logger.info("⚠️ Phase 6 ParameterConfig not available")

        # Initialize EIG calculator with config
        if self.config and EIGConfig:
            eig_config = EIGConfig(
                category_multipliers=self.config.get_eig_multipliers(),
                novelty_decay_factor=self.config.novelty_decay_factor,
                information_value_default=1.0
            )
            self.eig_calculator = EIGCalculator(eig_config)
            logger.info("🔍 EIGCalculator configured with ParameterConfig")
        else:
            self.eig_calculator = EIGCalculator()
            logger.info("🔍 EIGCalculator using default configuration")

        # Initialize hypothesis manager with cache
        self.hypothesis_manager = HypothesisManager(
            falkordb_client,
            cache_enabled=cache_enabled
        )

        # Load config parameters if available
        if self.config:
            self.max_iterations = self.config.max_iterations
            self.max_depth = self.config.max_depth
            self.accept_delta = self.config.accept_delta
            self.weak_accept_delta = self.config.weak_accept_delta
            self.reject_delta = self.config.reject_delta
            self.max_cost_per_entity = self.config.max_cost_per_entity_usd
        else:
            # Use defaults
            self.max_iterations = 30
            self.max_depth = 7  # Allow more exploration before stopping (increased from 3 based on validation analysis)
            self.accept_delta = 0.06
            self.weak_accept_delta = 0.02
            self.reject_delta = 0.0
            self.max_cost_per_entity = 2.0

        # Track cost
        self.total_cost_usd = 0.0

        logger.info("🔍 HypothesisDrivenDiscovery initialized")

    async def run_discovery(
        self,
        entity_id: str,
        entity_name: str,
        template_id: str,
        max_iterations: int = None,
        max_depth: int = None,
        max_cost_usd: float = None
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
        from schemas import RalphState

        # Use config values if not specified (Phase 6 parameter tuning)
        if max_iterations is None:
            max_iterations = self.max_iterations
        if max_depth is None:
            max_depth = self.max_depth
        if max_cost_usd is None:
            max_cost_usd = self.max_cost_per_entity

        logger.info(f"🔍 Starting hypothesis-driven discovery for {entity_name}")
        logger.info(f"   Template: {template_id}")
        logger.info(f"   Max iterations: {max_iterations}")
        logger.info(f"   Max depth: {max_depth}")
        logger.info(f"   Max cost: ${max_cost_usd:.2f}")

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

            # Track iteration result for signal extraction
            iteration_record = {
                'iteration': iteration,
                'hypothesis_id': top_hypothesis.hypothesis_id,
                'hop_type': hop_type.value if hasattr(hop_type, 'value') else str(hop_type),
                'depth': state.current_depth,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'result': result
            }
            state.iteration_results.append(iteration_record)

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
        Choose next hop type using MCP-guided scoring instead of depth-based

        MCP-guided selection prioritizes:
        1. Partnership announcements (highest ROI, 35% of ACCEPT signals)
        2. Tech news articles (deployment confirmations, 25% of ACCEPT signals)
        3. Press releases (official announcements, 10% of ACCEPT signals)
        4. Leadership job postings (technology roles, 20% WEAK_ACCEPT)

        Low-value sources are blacklisted:
        - LinkedIn Jobs operational (Kit Assistant, Shift Manager)
        - Official site homepages (consumer-facing, not corporate)
        - App stores (completely irrelevant)

        Args:
            hypothesis: Top hypothesis to explore
            state: Current RalphState

        Returns:
            HopType to execute (highest scored option)
        """
        from sources.mcp_source_priorities import (
            get_source_config,
            calculate_channel_score,
            ChannelBlacklist,
            SourceType
        )

        # Get or create channel blacklist from state metadata
        if not hasattr(state, 'channel_blacklist') or state.channel_blacklist is None:
            state.channel_blacklist = ChannelBlacklist()

        # Initialize hop failure tracking if not present
        if not hasattr(state, 'hop_failure_counts'):
            state.hop_failure_counts = {}
        if not hasattr(state, 'last_failed_hop'):
            state.last_failed_hop = None

        # Score all possible hop types, excluding those with too many consecutive failures
        hop_scores = {}
        max_consecutive_failures = 2  # Skip hop type after 2 consecutive failures

        # Map HopTypes to SourceTypes for scoring
        hop_source_mapping = {
            HopType.PRESS_RELEASE: SourceType.PRESS_RELEASES,
            HopType.OFFICIAL_SITE: SourceType.TECH_NEWS_ARTICLES,  # Use tech news strategy
            HopType.CAREERS_PAGE: SourceType.LEADERSHIP_JOB_POSTINGS,
            HopType.ANNUAL_REPORT: SourceType.PRESS_RELEASES,  # Treat as press releases
            HopType.LINKEDIN_JOB: SourceType.LINKEDIN_JOBS_OPERATIONAL
        }

        # Get base EIG from hypothesis
        base_eig = hypothesis.expected_information_gain

        # Score each hop type (skip those with too many consecutive failures)
        for hop_type, source_type in hop_source_mapping.items():
            hop_type_str = hop_type.value if hasattr(hop_type, 'value') else str(hop_type)

            # Skip hop types with 2+ consecutive failures
            if state.hop_failure_counts.get(hop_type_str, 0) >= max_consecutive_failures:
                logger.debug(f"Skipping {hop_type_str} (failed {state.hop_failure_counts[hop_type_str]} times consecutively)")
                continue

            score = calculate_channel_score(
                source_type=source_type,
                blacklist=state.channel_blacklist,
                base_eig=base_eig
            )
            hop_scores[hop_type] = score

        # Select highest scoring hop
        if not hop_scores:
            logger.warning("No hop types available, defaulting to PRESS_RELEASE")
            return HopType.PRESS_RELEASE

        best_hop = max(hop_scores.items(), key=lambda x: x[1])[0]
        best_score = hop_scores[best_hop]

        logger.info(
            f"MCP-guided hop selection: {best_hop.value} "
            f"(score: {best_score:.3f}, EIG: {base_eig:.3f})"
        )

        # If best score is 0 (all channels blacklisted), reset blacklist
        if best_score == 0.0:
            logger.warning("All channels blacklisted, resetting blacklist")
            state.channel_blacklist = ChannelBlacklist()
            return HopType.PRESS_RELEASE

        return best_hop

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
            # Record hop failure
            hop_type_str = hop_type.value if hasattr(hop_type, 'value') else str(hop_type)
            if not hasattr(state, 'hop_failure_counts'):
                state.hop_failure_counts = {}

            # Increment consecutive failure counter
            if hop_type_str == state.last_failed_hop:
                state.hop_failure_counts[hop_type_str] = state.hop_failure_counts.get(hop_type_str, 0) + 1
            else:
                # Reset counter if different hop type failed
                state.hop_failure_counts[hop_type_str] = 1
                state.last_failed_hop = hop_type_str

            logger.warning(f"Could not determine URL for hop type: {hop_type} (consecutive failures: {state.hop_failure_counts[hop_type_str]})")
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

            # Reset failure counter for this hop type on success
            hop_type_str = hop_type.value if hasattr(hop_type, 'value') else str(hop_type)
            if hasattr(state, 'hop_failure_counts') and hop_type_str in state.hop_failure_counts:
                del state.hop_failure_counts[hop_type_str]
                if state.last_failed_hop == hop_type_str:
                    state.last_failed_hop = None
                logger.debug(f"Reset failure counter for {hop_type_str} (successful execution)")

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

    def _get_fallback_queries(self, hop_type: HopType, entity_name: str) -> list[str]:
        """
        Get fallback search queries for a hop type

        Args:
            hop_type: Type of hop to execute
            entity_name: Name of entity to search for

        Returns:
            List of fallback query strings
        """
        queries = FALLBACK_QUERIES.get(hop_type, [])
        return [q.format(entity=entity_name) for q in queries]

    async def _get_url_for_hop(
        self,
        hop_type: HopType,
        hypothesis,
        state
    ) -> Optional[str]:
        """
        Get URL to scrape based on hop type

        Uses primary search query first, then falls back to alternative queries
        if primary search fails.

        Args:
            hop_type: Type of hop
            hypothesis: Hypothesis being explored
            state: Current RalphState

        Returns:
            URL to scrape or None
        """
        entity_name = state.entity_name

        # Define primary search query for each hop type
        primary_queries = {
            HopType.OFFICIAL_SITE: f'"{entity_name}" official website',
            HopType.CAREERS_PAGE: f'"{entity_name}" careers jobs',
            HopType.ANNUAL_REPORT: f'"{entity_name}" annual report 2024',
            HopType.PRESS_RELEASE: f'"{entity_name}" recent news press release',
            HopType.LINKEDIN_JOB: f'"{entity_name}" jobs careers site:linkedin.com'
        }

        # Get primary query for this hop type
        primary_query = primary_queries.get(hop_type)
        if not primary_query:
            logger.warning(f"No primary query defined for hop type: {hop_type}")
            return None

        logger.debug(f"Primary search query: {primary_query}")

        # Try primary search
        search_result = await self.brightdata_client.search_engine(
            query=primary_query,
            engine='google',
            num_results=1
        )

        # Check if primary search succeeded
        if search_result.get('status') == 'success' and search_result.get('results'):
            url = search_result['results'][0].get('url')
            if url:
                logger.info(f"✓ Primary search found URL: {url}")
                return url

        # Primary search failed, try fallback queries
        logger.warning(f"⚠️ Primary search failed for {hop_type}, trying fallbacks")

        fallback_queries = self._get_fallback_queries(hop_type, entity_name)

        for i, fallback_query in enumerate(fallback_queries, 1):
            logger.debug(f"Fallback {i}/{len(fallback_queries)}: {fallback_query}")

            search_result = await self.brightdata_client.search_engine(
                query=fallback_query,
                engine='google',
                num_results=1
            )

            if search_result.get('status') == 'success' and search_result.get('results'):
                url = search_result['results'][0].get('url')
                if url:
                    logger.info(f"✓ Fallback {i} found URL: {url}")
                    return url

        # All searches failed
        logger.error(f"❌ All search queries failed for {hop_type}")
        return None

    async def _evaluate_content_with_claude(
        self,
        content: str,
        hypothesis,
        hop_type: HopType
    ) -> Dict[str, Any]:
        """
        Evaluate scraped content with Claude + MCP pattern matching

        Uses hybrid approach:
        1. MCP pattern matching for fast evidence type detection
        2. Claude evaluation for context and decision validation

        Args:
            content: Scraped markdown content
            hypothesis: Hypothesis being evaluated
            hop_type: Type of hop executed

        Returns:
            Evaluation result with decision and confidence delta
        """
        from taxonomy.mcp_evidence_patterns import match_evidence_type
        from confidence.mcp_scorer import MCPScorer, Signal

        # Step 1: MCP pattern matching (fast, rules-based)
        mcp_matches = match_evidence_type(content, extract_metadata=True)

        logger.debug(f"MCP pattern matching found {len(mcp_matches)} match(es)")

        # Step 2: Build enhanced prompt with MCP insights
        mcp_insights = ""
        if mcp_matches:
            mcp_insights = "\n\nMCP Pattern Matching Results:\n"
            for match in mcp_matches:
                mcp_insights += f"- {match['type']}: {match['signal']} (+{match['total_confidence']:.2f})\n"

        prompt = f"""
Evaluate this scraped content for hypothesis: {hypothesis.statement}

Content from {hop_type.value}:
{content[:2000]}  # Limit to 2000 chars for cost control
{mcp_insights}
Task: Determine if this content supports or contradicts the hypothesis.

Return JSON:
{{
  "decision": "ACCEPT" | "WEAK_ACCEPT" | "REJECT" | "NO_PROGRESS",
  "confidence_delta": 0.0,
  "justification": "brief explanation",
  "evidence_found": "key evidence excerpt",
  "evidence_type": "mcp_evidence_type_or_null"
}}

Decision criteria:
- ACCEPT: Strong evidence of procurement intent (+0.08 delta for MCP patterns)
- WEAK_ACCEPT: Capability but unclear procurement intent (+0.02 delta)
- REJECT: Evidence contradicts hypothesis (-0.02 delta)
- NO_PROGRESS: No relevant evidence (0.0 delta)

MCP Pattern Guidance:
- If MCP detects "multi_year_partnership" → ACCEPT (+0.08)
- If MCP detects "recent_deployment" → ACCEPT (+0.08)
- If MCP detects "confirmed_platform" → ACCEPT (+0.08)
- If MCP detects "technology_leadership" → WEAK_ACCEPT (+0.02)
- If MCP detects "legacy_system" → WEAK_ACCEPT (+0.02)
"""

        try:
            # Use Anthropic messages API (not .query() which doesn't exist)
            message = self.claude_client.messages.create(
                model="claude-3-5-haiku-20241022",  # Use Haiku for cost efficiency
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract response text from Anthropic API response
            response = message.content[0].text

            # Parse JSON response
            import json
            import re

            json_match = re.search(r'\{[^}]*"decision"[^}]*\}', response, re.DOTALL)

            if json_match:
                result = json.loads(json_match.group(0))

                # Enhance with MCP-derived confidence delta if not provided
                if mcp_matches and result.get('confidence_delta', 0) == 0.0:
                    # Use MCP confidence calculation
                    from confidence.mcp_scorer import calculate_mcp_confidence_from_matches
                    mcp_confidence = calculate_mcp_confidence_from_matches(mcp_matches)

                    # Convert total confidence to delta (approximate)
                    # Base is 0.70, so delta = total - 0.70
                    result['confidence_delta'] = max(0.0, mcp_confidence - 0.70)

                    # Add MCP metadata
                    result['mcp_matches'] = mcp_matches
                    result['mcp_confidence'] = mcp_confidence

                return result
            else:
                logger.warning(f"Could not parse Claude response")
                return {
                    'decision': 'NO_PROGRESS',
                    'confidence_delta': 0.0,
                    'justification': 'Parse error',
                    'evidence_found': '',
                    'evidence_type': None
                }

        except Exception as e:
            logger.error(f"Claude evaluation error: {e}")
            return {
                'decision': 'NO_PROGRESS',
                'confidence_delta': 0.0,
                'justification': f'Error: {str(e)}',
                'evidence_found': '',
                'evidence_type': None
            }

    async def _update_hypothesis_state(
        self,
        hypothesis,
        result: Dict[str, Any],
        state
    ):
        """
        Update hypothesis state after iteration with channel tracking

        Updates:
        - Hypothesis confidence and state
        - Channel failure/success tracking (for MCP-guided hop selection)
        - Overall entity confidence

        Args:
            hypothesis: Hypothesis to update
            result: Hop execution result
            state: Current RalphState
        """
        from sources.mcp_source_priorities import SourceType

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

        # Track channel failure/success for MCP-guided hop selection
        if hasattr(state, 'channel_blacklist'):
            # Map hop type to source type
            hop_type_to_source = {
                "official_site": SourceType.TECH_NEWS_ARTICLES,
                "careers_page": SourceType.LEADERSHIP_JOB_POSTINGS,
                "press_release": SourceType.PRESS_RELEASES,
                "annual_report": SourceType.PRESS_RELEASES,
                "linkedin_job_posting": SourceType.LINKEDIN_JOBS_OPERATIONAL
            }

            hop_type_str = result.get('hop_type', '')
            source_type = hop_type_to_source.get(hop_type_str)

            if source_type:
                # Record success or failure
                decision = result['decision']
                if decision in ['ACCEPT', 'WEAK_ACCEPT']:
                    state.channel_blacklist.record_success(source_type)
                    logger.debug(f"Recorded SUCCESS for {source_type.value}")
                elif decision in ['REJECT', 'NO_PROGRESS']:
                    state.channel_blacklist.record_failure(source_type)
                    logger.debug(f"Recorded FAILURE for {source_type.value} "
                                f"({state.channel_blacklist.get_failure_count(source_type)} "
                                f"failures total)")

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

    def _extract_signals_from_iterations(
        self,
        state
    ) -> List[Dict[str, Any]]:
        """
        Extract signals from iteration results

        Converts ACCEPT and WEAK_ACCEPT decisions into signal objects
        with full metadata from the evaluation results.

        Args:
            state: RalphState with iteration_results

        Returns:
            List of signal dictionaries
        """
        signals = []

        for iteration_record in state.iteration_results:
            result = iteration_record.get('result', {})
            decision = result.get('decision', '')

            # Only extract ACCEPT and WEAK_ACCEPT signals
            if decision not in ['ACCEPT', 'WEAK_ACCEPT']:
                continue

            # Build signal object
            signal = {
                'entity_id': state.entity_id,
                'entity_name': state.entity_name,
                'hypothesis_id': iteration_record.get('hypothesis_id'),
                'signal_type': decision,
                'confidence_delta': result.get('confidence_delta', 0.0),
                'evidence_type': result.get('evidence_type'),
                'evidence_found': result.get('evidence_found', ''),
                'justification': result.get('justification', ''),
                'source_url': result.get('url', ''),
                'hop_type': iteration_record.get('hop_type'),
                'depth': iteration_record.get('depth'),
                'iteration': iteration_record.get('iteration'),
                'timestamp': iteration_record.get('timestamp')
            }

            # Add MCP metadata if available
            if 'mcp_matches' in result:
                signal['mcp_matches'] = result['mcp_matches']
            if 'mcp_confidence' in result:
                signal['mcp_confidence'] = result['mcp_confidence']

            signals.append(signal)

        return signals

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
        # Extract signals from iteration results
        signals_discovered = self._extract_signals_from_iterations(state)

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
            signals_discovered=signals_discovered,  # FIXED: Now extracts from iterations
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
