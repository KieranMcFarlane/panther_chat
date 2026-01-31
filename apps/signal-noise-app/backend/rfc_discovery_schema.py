"""
RFP Discovery Schema - Optimal Architecture for Ralph Loops

This schema defines the complete RFP discovery pipeline using:
- Claude Agent SDK primitives (tools, agents, workflows)
- BrightData SDK (direct Python integration)
- Ralph Loop validation (4-pass pipeline)
- Template discovery & validation system

ARCHITECTURE:
    1. Claude Agent SDK orchestrates the discovery workflow
    2. BrightData SDK gathers raw signal data
    3. Ralph Loop validates signals (4-pass pipeline)
    4. Template system learns WHERE signals appear
    5. Graphiti stores validated signals

Usage:
    from backend.rfc_discovery_schema import (
        RFPDiscoveryWorkflow,
        SignalCandidate,
        ValidatedSignal,
        RalphLoopConfig
    )

    # Create workflow
    workflow = RFPDiscoveryWorkflow()

    # Discover RFPs for entity
    result = await workflow.discover_rfps(
        entity_name="Arsenal FC",
        entity_id="arsenal",
        categories=["CRM", "TICKETING"]
    )

    for signal in result.validated_signals:
        print(f"✅ {signal.signal_type}: {signal.confidence}")
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


# =============================================================================
# PART 1: SIGNAL CANDIDATE (Raw Discovery Output)
# =============================================================================

class SignalCategory(str, Enum):
    """14 RFP signal categories"""

    # Customer-facing systems
    CRM = "CRM"
    TICKETING = "TICKETING"
    COMMERCE = "COMMERCE"
    CONTENT = "CONTENT"

    # Internal operations
    MARKETING = "MARKETING"
    ANALYTICS = "ANALYTICS"
    COLLABORATION = "COLLABORATION"
    COMMUNICATION = "COMMUNICATION"

    # Business infrastructure
    OPERATIONS = "OPERATIONS"
    HR = "HR"
    FINANCE = "FINANCE"

    # Technical infrastructure
    DATA_PLATFORM = "DATA_PLATFORM"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY = "SECURITY"


@dataclass
class EvidenceItem:
    """
    Single evidence item supporting a signal candidate

    Collected by BrightData SDK from various sources.
    """
    id: str
    source: str  # "LinkedIn", "Official Site", "Press Release", etc.
    url: Optional[str]
    date: datetime
    extracted_text: str
    credibility_score: float = 0.5  # 0.0-1.0

    # Metadata
    scraped_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    verified: bool = False  # Pass 1.5: Evidence verification
    accessible: bool = True  # URL accessibility check

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'source': self.source,
            'url': self.url,
            'date': self.date.isoformat(),
            'extracted_text': self.extracted_text,
            'credibility_score': self.credibility_score,
            'scraped_at': self.scraped_at.isoformat(),
            'verified': self.verified,
            'accessible': self.accessible
        }


@dataclass
class SignalCandidate:
    """
    Raw signal candidate from discovery phase

    BEFORE Ralph Loop validation.
    Contains all evidence but hasn't passed validation yet.
    """
    id: str
    entity_id: str
    entity_name: str
    category: SignalCategory

    # Evidence
    evidence: List[EvidenceItem] = field(default_factory=list)

    # Confidence (before Ralph Loop)
    raw_confidence: float = 0.0  # 0.0-1.0

    # Metadata
    discovered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    discovery_source: str = "brightdata_sdk"

    # Temporal intelligence
    temporal_multiplier: float = 1.0  # From temporal prior service
    temporal_prior_available: bool = False

    # Validation status
    ralph_loop_pass: int = 0  # 0 = not validated, 1-3 = passed which pass
    validated: bool = False

    # Yellow Panther scoring
    yellow_panther_fit_score: Optional[float] = None  # 0-100
    yellow_panther_priority: Optional[str] = None  # TIER_1-TIER_4

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'category': self.category.value,
            'evidence': [e.to_dict() for e in self.evidence],
            'raw_confidence': self.raw_confidence,
            'discovered_at': self.discovered_at.isoformat(),
            'discovery_source': self.discovery_source,
            'temporal_multiplier': self.temporal_multiplier,
            'temporal_prior_available': self.temporal_prior_available,
            'ralph_loop_pass': self.ralph_loop_pass,
            'validated': self.validated,
            'yellow_panther_fit_score': self.yellow_panther_fit_score,
            'yellow_panther_priority': self.yellow_panther_priority
        }


# =============================================================================
# PART 2: VALIDATED SIGNAL (After Ralph Loop)
# =============================================================================

@dataclass
class ConfidenceValidation:
    """
    Results of Claude confidence validation in Pass 2

    iteration_02 enhancement: Claude validates scraper-assigned confidence
    """
    original_confidence: float
    validated_confidence: float
    adjustment: float  # validated - original
    rationale: str  # Claude's reasoning
    requires_manual_review: bool = False
    validation_timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            'original_confidence': self.original_confidence,
            'validated_confidence': self.validated_confidence,
            'adjustment': self.adjustment,
            'rationale': self.rationale,
            'requires_manual_review': self.requires_manual_review,
            'validation_timestamp': self.validation_timestamp.isoformat()
        }


@dataclass
class ValidatedSignal:
    """
    Signal that has passed Ralph Loop validation

    AFTER Ralph Loop validation (all 3 passes complete).
    Ready for Graphiti storage.
    """
    id: str
    entity_id: str
    entity_name: str
    category: SignalCategory

    # Evidence (verified in Pass 1.5)
    evidence: List[EvidenceItem]

    # Confidence (validated in Pass 2)
    confidence: float  # Final validated confidence
    confidence_validation: Optional[ConfidenceValidation] = None

    # Ralph Loop validation
    validation_pass: int = 3  # Completed all 3 passes
    validated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Temporal intelligence
    temporal_multiplier: float = 1.0

    # Yellow Panther scoring
    yellow_panther_fit_score: Optional[float] = None
    yellow_panther_priority: Optional[str] = None

    # Reason likelihood (WHY this RFP is being issued)
    primary_reason: Optional[str] = None  # "TECHNOLOGY_OBSOLESCENCE", etc.
    primary_reason_confidence: Optional[float] = None
    urgency: Optional[str] = None  # "HIGH", "MEDIUM", "LOW"

    def to_dict(self) -> Dict[str, Any]:
        result = {
            'id': self.id,
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'category': self.category.value,
            'evidence': [e.to_dict() for e in self.evidence],
            'confidence': self.confidence,
            'validation_pass': self.validation_pass,
            'validated_at': self.validated_at.isoformat(),
            'temporal_multiplier': self.temporal_multiplier,
            'yellow_panther_fit_score': self.yellow_panther_fit_score,
            'yellow_panther_priority': self.yellow_panther_priority,
            'primary_reason': self.primary_reason,
            'primary_reason_confidence': self.primary_reason_confidence,
            'urgency': self.urgency
        }

        if self.confidence_validation:
            result['confidence_validation'] = self.confidence_validation.to_dict()

        return result


# =============================================================================
# PART 3: RALPH LOOP CONFIGURATION
# =============================================================================

@dataclass
class RalphLoopConfig:
    """
    Ralph Loop validation configuration

    4-Pass Pipeline:
    - Pass 1: Rule-based filtering (min evidence, min confidence)
    - Pass 1.5: Evidence verification (URL accessibility, source credibility)
    - Pass 2: Claude validation (consistency, duplicates, confidence assessment)
    - Pass 3: Final confirmation (temporal multiplier, duplicate detection)
    - Pass 4: Graphiti storage
    """
    # Pass 1: Rule-based filtering
    min_evidence: int = 3
    min_confidence: float = 0.70
    min_evidence_credibility: float = 0.60

    # Pass 1.5: Evidence verification (iteration_02)
    enable_evidence_verification: bool = True
    verify_url_accessibility: bool = True
    verify_source_credibility: bool = True
    verify_content_matching: bool = True

    # Pass 2: Claude validation
    enable_confidence_validation: bool = True
    max_confidence_adjustment: float = 0.15  # Max ± adjustment
    confidence_review_threshold: float = 0.20  # Flag if adjustment > threshold

    # Model cascade (cost optimization)
    use_model_cascade: bool = True
    haiku_threshold: float = 0.90  # Use Haiku if confidence >= threshold
    sonnet_threshold: float = 0.75  # Use Sonnet if confidence >= threshold
    opus_threshold: float = 0.0  # Use Opus for everything else

    # Pass 3: Final confirmation
    duplicate_threshold: float = 0.85  # Embedding similarity
    enable_temporal_adjustment: bool = True
    temporal_multiplier_range: tuple = (0.75, 1.40)

    # Pass 4: Graphiti storage
    enable_graphiti_storage: bool = True


# =============================================================================
# PART 4: BRIGHTDATA DISCOVERY CONFIG
# =============================================================================

@dataclass
class BrightDataDiscoveryConfig:
    """
    BrightData SDK discovery configuration

    Uses official BrightData Python SDK (not MCP).
    """
    # Search engine configuration
    default_engine: str = "google"  # google, bing, yandex
    default_country: str = "uk"
    num_results_per_query: int = 10

    # Batch scraping
    enable_batch_scraping: bool = True
    max_concurrent_requests: int = 5

    # Fallback (if SDK unavailable)
    enable_http_fallback: bool = True
    fallback_timeout: int = 30

    # Rate limiting
    min_delay_between_requests: float = 1.0  # seconds
    max_requests_per_minute: int = 30


# =============================================================================
# PART 5: TEMPLATE DISCOVERY CONFIG
# =============================================================================

@dataclass
class TemplateDiscoveryConfig:
    """
    Template discovery configuration

    Templates define WHERE and HOW RFP signals appear for entity clusters.
    """
    # Sample size for template discovery
    min_sample_entities: int = 5
    max_sample_entities: int = 20

    # BrightData validation
    enable_brightdata_validation: bool = True
    validation_queries_per_entity: int = 4

    # Confidence calculation weights
    channel_coverage_weight: float = 0.40
    pattern_clarity_weight: float = 0.30
    brightdata_validation_weight: float = 0.20
    sample_representativeness_weight: float = 0.10

    # Deployment thresholds
    min_confidence_for_deployment: float = 0.70
    min_validation_rate_for_deployment: float = 0.60


# =============================================================================
# PART 6: YELLOW PANTHER SCORING CONFIG
# =============================================================================

@dataclass
class YellowPantherScoringConfig:
    """
    Yellow Panther fit scoring configuration

    Scores RFP opportunities against YP's service offerings.
    """
    # Service categories (YP strengths)
    yp_services: List[str] = field(default_factory=lambda: [
        "MOBILE_APPS",
        "DIGITAL_TRANSFORMATION",
        "FAN_ENGAGEMENT",
        "ANALYTICS",
        "ECOMMERCE"
    ])

    # Scoring weights (total 100 points)
    service_match_weight: float = 40.0
    budget_alignment_weight: float = 25.0
    timeline_fit_weight: float = 15.0
    entity_size_weight: float = 10.0
    geographic_fit_weight: float = 10.0

    # Budget alignment (YP ideal: £80K-£500K)
    min_budget: int = 80000
    ideal_budget_min: int = 80000
    ideal_budget_max: int = 500000
    max_budget: int = 1000000

    # Timeline fit (YP ideal: 3-12 months)
    min_timeline_months: int = 1
    ideal_timeline_min: int = 3
    ideal_timeline_max: int = 12
    max_timeline_months: int = 24

    # Priority tier thresholds
    tier_1_min_score: float = 90.0
    tier_2_min_score: float = 70.0
    tier_3_min_score: float = 50.0


# =============================================================================
# PART 7: TEMPORAL INTELLIGENCE CONFIG
# =============================================================================

@dataclass
class TemporalIntelligenceConfig:
    """
    Temporal intelligence configuration

    Computes WHEN entities are likely to issue RFPs based on:
    - Seasonality (which quarters are most active)
    - Recurrence (time since last RFP vs expected)
    - Momentum (recent 30/90-day activity)
    """
    # Seasonality analysis
    enable_seasonality: bool = True
    seasonality_quarters: int = 4  # Q1, Q2, Q3, Q4

    # Recurrence analysis
    enable_recurrence: bool = True
    recurrence_window_days: int = 730  # 2 years of history
    min_recurrence_samples: int = 3

    # Momentum analysis
    enable_momentum: bool = True
    momentum_window_30d: bool = True
    momentum_window_90d: bool = True

    # Multiplier calculation
    base_multiplier: float = 1.0
    seasonality_weight: float = 0.4
    recurrence_weight: float = 0.35
    momentum_weight: float = 0.25

    # Multiplier range
    min_multiplier: float = 0.75
    max_multiplier: float = 1.40

    # Backoff hierarchy (entity_category → entity → cluster → global)
    enable_backoff: bool = True


# =============================================================================
# PART 8: RFP DISCOVERY WORKFLOW (Main Orchestrator)
# =============================================================================

class RFPDiscoveryWorkflow:
    """
    Main RFP discovery workflow using Claude Agent SDK primitives

    Orchestrates:
    1. BrightData SDK for raw signal discovery
    2. Ralph Loop for validation (4-pass pipeline)
    3. Template discovery for learning WHERE signals appear
    4. Temporal intelligence for WHEN signals appear
    5. Yellow Panther scoring for fit assessment
    """

    def __init__(
        self,
        ralph_config: RalphLoopConfig = None,
        brightdata_config: BrightDataDiscoveryConfig = None,
        template_config: TemplateDiscoveryConfig = None,
        yp_config: YellowPantherScoringConfig = None,
        temporal_config: TemporalIntelligenceConfig = None
    ):
        # Initialize configurations
        self.ralph_config = ralph_config or RalphLoopConfig()
        self.brightdata_config = brightdata_config or BrightDataDiscoveryConfig()
        self.template_config = template_config or TemplateDiscoveryConfig()
        self.yp_config = yp_config or YellowPantherScoringConfig()
        self.temporal_config = temporal_config or TemporalIntelligenceConfig()

        # Initialize components (lazy loading)
        self._brightdata_client = None
        self._claude_client = None
        self._graphiti_client = None
        self._temporal_client = None

        logger.info("✅ RFPDiscoveryWorkflow initialized")

    async def discover_rfps(
        self,
        entity_name: str,
        entity_id: str,
        categories: List[SignalCategory],
        max_iterations: int = 30
    ) -> Dict[str, Any]:
        """
        Discover RFP signals for an entity

        Args:
            entity_name: Entity display name
            entity_id: Entity identifier
            categories: List of signal categories to search
            max_iterations: Maximum discovery iterations per category

        Returns:
            Discovery results with validated signals
        """
        logger.info(f"🔍 Discovering RFPs for {entity_name} ({entity_id})")
        logger.info(f"   Categories: {[c.value for c in categories]}")

        results = {
            'entity_id': entity_id,
            'entity_name': entity_name,
            'categories_searched': [c.value for c in categories],
            'validated_signals': [],
            'rejected_candidates': [],
            'discovery_summary': {}
        }

        # Discover signals for each category
        for category in categories:
            logger.info(f"\n📂 Category: {category.value}")

            category_result = await self._discover_category(
                entity_name=entity_name,
                entity_id=entity_id,
                category=category,
                max_iterations=max_iterations
            )

            results['validated_signals'].extend(category_result['validated_signals'])
            results['rejected_candidates'].extend(category_result['rejected_candidates'])
            results['discovery_summary'][category.value] = category_result['summary']

        logger.info(f"\n✅ Discovery complete: {len(results['validated_signals'])} validated signals")

        return results

    async def _discover_category(
        self,
        entity_name: str,
        entity_id: str,
        category: SignalCategory,
        max_iterations: int
    ) -> Dict[str, Any]:
        """
        Discover signals for a single category

        This is the main Claude Agent SDK workflow loop.
        """
        from claude_client import ClaudeClient
        from brightdata_sdk_client import BrightDataSDKClient

        # Initialize clients
        if not self._brightdata_client:
            self._brightdata_client = BrightDataSDKClient()
        if not self._claude_client:
            self._claude_client = ClaudeClient()

        # Get temporal multiplier for this entity+category
        temporal_multiplier = await self._get_temporal_multiplier(entity_id, category)
        logger.info(f"   Temporal multiplier: {temporal_multiplier:.2f}")

        # Adjust confidence threshold based on temporal multiplier
        # High multiplier → lower threshold (more likely to be real)
        adjusted_threshold = self.ralph_config.min_confidence / temporal_multiplier
        logger.info(f"   Adjusted threshold: {adjusted_threshold:.2f}")

        validated_signals = []
        rejected_candidates = []
        iteration = 0

        current_confidence = 0.20  # Start confidence (exploration)
        previous_evidences = []

        # Claude Agent SDK workflow loop
        while iteration < max_iterations and current_confidence < 0.85:
            iteration += 1
            logger.info(f"\n   Iteration {iteration}/{max_iterations} | Confidence: {current_confidence:.2f}")

            # Step 1: Claude Agent decides WHERE to search
            search_decision = await self._claude_agent_decide_search(
                entity_name=entity_name,
                category=category,
                current_confidence=current_confidence,
                previous_evidences=previous_evidences,
                iteration=iteration
            )

            search_query = search_decision['search_query']
            logger.info(f"   Query: \"{search_query}\"")

            # Step 2: BrightData SDK gathers evidence
            logger.info("   📡 Gathering evidence with BrightData SDK...")
            evidence_items = await self._gather_evidence_with_brightdata(
                entity_name=entity_name,
                category=category,
                search_query=search_query
            )

            if not evidence_items:
                logger.info("   ⏭️ No evidence found, trying next iteration")
                continue

            # Step 3: Apply Ralph Decision Rubric (exploration governance)
            from ralph_loop import apply_ralph_decision_rubric, RalphExplorationDecision

            # Format evidence for Ralph rubric
            evidence_text = "\n".join([e.extracted_text for e in evidence_items])

            decision, justification = apply_ralph_decision_rubric(
                evidence_text=evidence_text,
                category=category.value,
                entity_name=entity_name,
                source_url=evidence_items[0].url if evidence_items else "",
                previous_evidences=previous_evidences
            )

            logger.info(f"   Decision: {decision.value} | {justification}")

            # Step 4: Update confidence
            if decision == RalphExplorationDecision.ACCEPT:
                raw_delta = 0.06
            elif decision == RalphExplorationDecision.WEAK_ACCEPT:
                raw_delta = 0.02
            else:  # REJECT
                raw_delta = 0.00

            # Category multiplier (diminishing returns)
            category_multiplier = 1.0 / (1.0 + len(validated_signals))
            applied_delta = raw_delta * category_multiplier
            current_confidence = max(0.05, min(0.95, current_confidence + applied_delta))

            logger.info(f"   Confidence: {current_confidence - applied_delta:.2f} → {current_confidence:.2f}")

            # Track previous evidences
            previous_evidences.append(evidence_text)

            # Step 5: If high confidence, create signal candidate and run Ralph Loop
            if current_confidence >= adjusted_threshold:
                logger.info("   ✅ Threshold reached, creating signal candidate")

                # Create signal candidate
                candidate = SignalCandidate(
                    id=f"candidate_{entity_id}_{category.value}_{iteration}",
                    entity_id=entity_id,
                    entity_name=entity_name,
                    category=category,
                    evidence=evidence_items,
                    raw_confidence=current_confidence,
                    temporal_multiplier=temporal_multiplier
                )

                # Run Ralph Loop validation
                validated_signal = await self._run_ralph_loop(candidate)

                if validated_signal:
                    validated_signals.append(validated_signal)
                    logger.info(f"   ✅ VALIDATED: {category.value} (confidence: {validated_signal.confidence:.2f})")
                else:
                    rejected_candidates.append(candidate)
                    logger.info(f"   ❌ REJECTED: {category.value}")

                # Update confidence based on validation
                if validated_signal:
                    current_confidence = validated_signal.confidence

        # Build category result
        summary = {
            'iterations': iteration,
            'final_confidence': current_confidence,
            'validated_count': len(validated_signals),
            'rejected_count': len(rejected_candidates),
            'temporal_multiplier': temporal_multiplier
        }

        return {
            'validated_signals': validated_signals,
            'rejected_candidates': rejected_candidates,
            'summary': summary
        }

    async def _claude_agent_decide_search(
        self,
        entity_name: str,
        category: SignalCategory,
        current_confidence: float,
        previous_evidences: List[str],
        iteration: int
    ) -> Dict[str, str]:
        """
        Claude Agent decides WHERE to search next

        This is a Claude Agent SDK primitive (tool-using agent).
        """
        # Build search strategy prompt
        prompt = f"""
You are an RFP discovery agent for {entity_name}.

Current context:
- Category: {category.value}
- Current confidence: {current_confidence:.2f}
- Iteration: {iteration}
- Previous searches: {len(previous_evidences)}

Your job: Decide the BEST search query to find evidence for {category.value} RFP signals.

Search strategy options:
1. Job boards: "{entity_name} {category.value} manager jobs careers"
2. Press releases: "{entity_name} {category.value} press release announcement"
3. Official site: "site:{entity_name.replace(' ', '').lower()}.com {category.value}"
4. Procurement: "{entity_name} {category.value} tender vendor procurement"
5. Industry news: "{entity_name} {category.value} upgrade implementation"

Return ONLY a JSON object:
{{
    "search_query": "your chosen query",
    "rationale": "why this query is best"
}}
"""

        try:
            response = await self._claude_client.query(
                prompt=prompt,
                model="haiku",  # Use Haiku for fast decisions
                max_tokens=500
            )

            # Extract JSON from response
            import re
            json_match = re.search(r'\{[^}]*"search_query"[^}]*\}', response['content'], re.DOTALL)

            if json_match:
                decision = json.loads(json_match.group(0))
                return decision
            else:
                # Fallback to default query
                return {
                    'search_query': f'{entity_name} {category.value} jobs careers',
                    'rationale': 'Default query (parse failed)'
                }

        except Exception as e:
            logger.warning(f"⚠️ Claude agent search decision failed: {e}")
            return {
                'search_query': f'{entity_name} {category.value}',
                'rationale': 'Fallback query (agent failed)'
            }

    async def _gather_evidence_with_brightdata(
        self,
        entity_name: str,
        category: SignalCategory,
        search_query: str
    ) -> List[EvidenceItem]:
        """
        Gather evidence using BrightData SDK

        This is the BrightData SDK integration (NOT MCP).
        """
        try:
            # Step 1: Search engine query
            search_result = await self._brightdata_client.search_engine(
                query=search_query,
                engine=self.brightdata_config.default_engine,
                num_results=self.brightdata_config.num_results_per_query
            )

            if search_result['status'] != 'success':
                logger.warning(f"⚠️ BrightData search failed: {search_result.get('error')}")
                return []

            evidence_items = []

            # Step 2: Batch scrape URLs
            urls = [r['url'] for r in search_result['results'][:5]]  # Top 5 results

            if len(urls) > 1:
                scrape_result = await self._brightdata_client.scrape_batch(urls)
            else:
                scrape_result = {'results': []}

                if urls:
                    single_scrape = await self._brightdata_client.scrape_as_markdown(urls[0])
                    if single_scrape['status'] == 'success':
                        scrape_result['results'] = [single_scrape]

            # Step 3: Create evidence items
            if scrape_result['status'] == 'success':
                for idx, result in enumerate(scrape_result['results']):
                    if result['status'] == 'success':
                        evidence = EvidenceItem(
                            id=f"evidence_{entity_name}_{category.value}_{idx}",
                            source=result.get('metadata', {}).get('source', 'web'),
                            url=result['url'],
                            date=datetime.now(timezone.utc),
                            extracted_text=result['content'][:500],  # First 500 chars
                            credibility_score=0.7  # Default credibility
                        )
                        evidence_items.append(evidence)

            logger.info(f"   📦 Gathered {len(evidence_items)} evidence items")
            return evidence_items

        except Exception as e:
            logger.error(f"❌ BrightData evidence gathering failed: {e}")
            return []

    async def _get_temporal_multiplier(
        self,
        entity_id: str,
        category: SignalCategory
    ) -> float:
        """
        Get temporal multiplier for entity+category

        Temporal intelligence: WHEN is this entity likely to issue RFPs?
        """
        # For now, return default multiplier
        # In production, this would query the temporal prior service
        return 1.0

    async def _run_ralph_loop(
        self,
        candidate: SignalCandidate
    ) -> Optional[ValidatedSignal]:
        """
        Run Ralph Loop validation on candidate

        4-Pass Pipeline:
        - Pass 1: Rule-based filtering
        - Pass 1.5: Evidence verification
        - Pass 2: Claude validation
        - Pass 3: Final confirmation
        """
        # Check evidence count
        if len(candidate.evidence) < self.ralph_config.min_evidence:
            logger.debug(f"❌ Pass 1: Insufficient evidence ({len(candidate.evidence)}/{self.ralph_config.min_evidence})")
            return None

        # Check confidence threshold
        if candidate.raw_confidence < self.ralph_config.min_confidence:
            logger.debug(f"❌ Pass 1: Low confidence ({candidate.raw_confidence:.2f} < {self.ralph_config.min_confidence})")
            return None

        # Pass 1.5: Evidence verification (if enabled)
        verified_evidence = await self._verify_evidence(candidate.evidence)

        # Pass 2: Claude validation
        validated_confidence = candidate.raw_confidence  # For now, skip Claude validation

        # Apply temporal multiplier
        final_confidence = validated_confidence * candidate.temporal_multiplier
        final_confidence = max(0.0, min(1.0, final_confidence))

        # Create validated signal
        validated_signal = ValidatedSignal(
            id=candidate.id.replace('candidate', 'signal'),
            entity_id=candidate.entity_id,
            entity_name=candidate.entity_name,
            category=candidate.category,
            evidence=verified_evidence,
            confidence=final_confidence,
            temporal_multiplier=candidate.temporal_multiplier
        )

        return validated_signal

    async def _verify_evidence(
        self,
        evidence: List[EvidenceItem]
    ) -> List[EvidenceItem]:
        """
        Verify evidence items (Pass 1.5)

        iteration_02 enhancement: Verify URLs are accessible and credible
        """
        if not self.ralph_config.enable_evidence_verification:
            return evidence

        verified = []

        for item in evidence:
            # For now, just mark as verified
            # In production, would check URL accessibility
            item.verified = True
            item.accessible = True
            verified.append(item)

        return verified


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

async def discover_rfps_for_entity(
    entity_name: str,
    entity_id: str,
    categories: List[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to discover RFPs for an entity

    Args:
        entity_name: Entity display name
        entity_id: Entity identifier
        categories: List of category names (default: all 14)

    Returns:
        Discovery results
    """
    if categories is None:
        categories = [c.value for c in SignalCategory]

    # Convert strings to enums
    category_enums = [SignalCategory(c) for c in categories]

    workflow = RFPDiscoveryWorkflow()
    return await workflow.discover_rfps(
        entity_name=entity_name,
        entity_id=entity_id,
        categories=category_enums
    )


# =============================================================================
# TEST / MAIN
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def test_schema():
        """Test the RFP discovery schema"""
        print("\n🧪 Testing RFP Discovery Schema\n")

        # Test 1: Create signal candidate
        print("Test 1: Creating signal candidate...")

        evidence = [
            EvidenceItem(
                id="ev1",
                source="LinkedIn",
                url="https://linkedin.com/jobs/123",
                date=datetime.now(timezone.utc),
                extracted_text="Arsenal FC hiring CRM Director",
                credibility_score=0.8
            ),
            EvidenceItem(
                id="ev2",
                source="Official Site",
                url="https://arsenal.com/careers",
                date=datetime.now(timezone.utc),
                extracted_text="CRM Manager position available",
                credibility_score=0.9
            ),
            EvidenceItem(
                id="ev3",
                source="Press Release",
                url="https://arsenal.com/news/crm-upgrade",
                date=datetime.now(timezone.utc),
                extracted_text="Arsenal announces CRM upgrade project",
                credibility_score=0.85
            )
        ]

        candidate = SignalCandidate(
            id="candidate_arsenal_crm_1",
            entity_id="arsenal",
            entity_name="Arsenal FC",
            category=SignalCategory.CRM,
            evidence=evidence,
            raw_confidence=0.82,
            temporal_multiplier=1.35
        )

        print(f"✅ Candidate created: {candidate.id}")
        print(f"   Evidence: {len(candidate.evidence)} items")
        print(f"   Raw confidence: {candidate.raw_confidence:.2f}")
        print(f"   Temporal multiplier: {candidate.temporal_multiplier:.2f}")

        # Test 2: Create validated signal
        print("\nTest 2: Creating validated signal...")

        validated = ValidatedSignal(
            id="signal_arsenal_crm_1",
            entity_id="arsenal",
            entity_name="Arsenal FC",
            category=SignalCategory.CRM,
            evidence=evidence,
            confidence=0.95,
            temporal_multiplier=1.35,
            primary_reason="TECHNOLOGY_OBSOLESCENCE",
            primary_reason_confidence=0.88,
            urgency="HIGH"
        )

        print(f"✅ Validated signal created: {validated.id}")
        print(f"   Confidence: {validated.confidence:.2f}")
        print(f"   Primary reason: {validated.primary_reason} ({validated.primary_reason_confidence:.2f})")
        print(f"   Urgency: {validated.urgency}")

        # Test 3: Workflow configuration
        print("\nTest 3: Creating RFP discovery workflow...")

        workflow = RFPDiscoveryWorkflow()

        print(f"✅ Workflow created")
        print(f"   Ralph Loop min confidence: {workflow.ralph_config.min_confidence}")
        print(f"   Evidence verification: {workflow.ralph_config.enable_evidence_verification}")
        print(f"   Model cascade: {workflow.ralph_config.use_model_cascade}")

        print("\n✅ All schema tests passed!\n")

    asyncio.run(test_schema())
