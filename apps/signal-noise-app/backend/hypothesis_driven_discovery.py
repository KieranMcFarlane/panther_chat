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

import json
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import OrderedDict
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# Import PDF extractor for DOCUMENT hop type
try:
    from pdf_extractor import get_pdf_extractor
    PDF_EXTRACTOR_AVAILABLE = True
except ImportError:
    PDF_EXTRACTOR_AVAILABLE = False
    logger.warning("pdf_extractor not available - PDF discovery disabled")


# Import Phase 6 components
try:
    from backend.parameter_tuning import ParameterConfig
    from backend.eig_calculator import EIGConfig
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
    RFP_PAGE = "rfp_page"                     # RFP/tenders page (HIGH VALUE)
    TENDERS_PAGE = "tenders_page"             # Tenders/procurement page (HIGH VALUE)
    PROCUREMENT_PAGE = "procurement_page"     # General procurement (HIGH VALUE)
    DOCUMENT = "document"                     # PDF documents, strategic plans, architecture docs (HIGH VALUE)


# Allowed hop types per category (strategy rails)
ALLOWED_HOP_TYPES = {
    "official_site": ["homepage", "about", "press"],
    "careers_page": ["jobs_index", "job_posting"],
    "linkedin_job_posting": ["specific_role"],
    "annual_report": ["financial_section"],
    "press_release": ["recent_news"],
    "rfp_page": ["tenders", "procurement", "rfp_listings"],
    "tenders_page": ["tenders", "procurement", "vendor_opportunities"],
    "procurement_page": ["procurement", "vendor_opportunities", "partnerships"],
    "document": ["pdf", "strategic_plan", "architecture", "ecosystem", "whitepaper", "roadmap"]
}


# =============================================================================
# Evaluation Context Dataclass
# =============================================================================

@dataclass
class EvaluationContext:
    """Structured context for Claude evaluation"""
    # Hypothesis details
    hypothesis_statement: str
    hypothesis_category: str
    pattern_name: str
    early_indicators: List[str]
    keywords: List[str]
    confidence_weight: float

    # Iteration context
    current_confidence: float
    iterations_attempted: int
    last_decision: Optional[str]
    recent_history: List[str]

    # Channel context
    hop_type: HopType
    channel_guidance: str

    # Temporal context
    entity_name: str
    content_length: int

    # Evidence requirements
    min_evidence_strength: str
    temporal_requirements: str


# =============================================================================
# Optimization Constants (Multi-Engine, Result Count, URL Scoring)
# =============================================================================

# High-value hop types that need multiple results and scoring
HIGH_VALUE_HOPS = {
    HopType.OFFICIAL_SITE,
    HopType.RFP_PAGE,
    HopType.TENDERS_PAGE,
    HopType.PROCUREMENT_PAGE,
    HopType.DOCUMENT,
}

# Engine preferences by hop type (primary, fallback)
ENGINE_PREFERENCES = {
    HopType.RFP_PAGE: ['google', 'bing'],
    HopType.TENDERS_PAGE: ['google', 'yandex'],
    HopType.PROCUREMENT_PAGE: ['google', 'bing'],
    HopType.DOCUMENT: ['google', 'yandex'],
    HopType.CAREERS_PAGE: ['google', 'bing'],
    HopType.PRESS_RELEASE: ['google', 'bing'],
    HopType.ANNUAL_REPORT: ['google'],
    HopType.OFFICIAL_SITE: ['google'],
    HopType.LINKEDIN_JOB: ['google'],
}

# Result count by hop type
NUM_RESULTS_BY_HOP = {
    HopType.RFP_PAGE: 5,
    HopType.TENDERS_PAGE: 5,
    HopType.PROCUREMENT_PAGE: 5,
    HopType.DOCUMENT: 5,
    HopType.ANNUAL_REPORT: 3,
    HopType.PRESS_RELEASE: 2,
    HopType.CAREERS_PAGE: 1,
    HopType.OFFICIAL_SITE: 5,
    HopType.LINKEDIN_JOB: 1,
}


# =============================================================================
# Channel Evaluation Guidance
# =============================================================================

CHANNEL_EVALUATION_GUIDANCE = {
    HopType.OFFICIAL_SITE: """
    Look for: Technology partnerships, digital transformation initiatives,
    current platform/vendor mentions, leadership team (commercial/procurement).

    HIGH CONFIDENCE: Official announcements, partnership pages, case studies
    MEDIUM CONFIDENCE: Leadership bios, technology stack mentions
    LOW CONFIDENCE: Generic marketing copy, consumer product mentions
    """,

    HopType.CAREERS_PAGE: """
    Look for: Procurement/commercial roles, technology leadership (CTO, Head of Digital),
    CRM-specific roles, digital transformation roles, data analytics roles.

    HIGH CONFIDENCE: Senior procurement roles, commercial director roles
    MEDIUM CONFIDENCE: Technology leadership roles, data roles
    LOW CONFIDENCE: Junior IT roles, coaching/playing roles
    """,

    HopType.LINKEDIN_JOB: """
    Look for: Procurement responsibilities, technology stack requirements (Salesforce, SAP),
    digital transformation objectives, team size/budget, reporting lines.

    HIGH CONFIDENCE: Senior procurement role with specific technology requirements
    MEDIUM CONFIDENCE: Technology leadership role with transformation goals
    TEMPORAL: Last 30 days = strong signal, older than 90 days = weaker
    """,

    HopType.ANNUAL_REPORT: """
    Look for: Technology investment plans, partnership agreements, current system mentions,
    financial health, procurement department size/budget.

    HIGH CONFIDENCE: Specific technology investments, partnership agreements
    MEDIUM CONFIDENCE: Digital transformation strategy mentions
    TEMPORAL: Most recent report = most accurate, older than 18 months = outdated
    """,

    HopType.PRESS_RELEASE: """
    Look for: Partnership announcements, technology deployments, leadership appointments,
    digital transformation milestones, awards/recognition.

    HIGH CONFIDENCE: Multi-year partnerships, recent deployments (last 6 months)
    MEDIUM CONFIDENCE: Leadership appointments, technology awards
    TEMPORAL: Last 6 months = strong, older than 12 months = stale
    """,

    HopType.RFP_PAGE: """
    Look for: Active RFPs, tender documents, procurement announcements,
    specific technology requirements, budget ranges, submission deadlines.

    HIGH CONFIDENCE: Explicit "Request for Proposal" or "Tender" with detailed requirements
    MEDIUM CONFIDENCE: General procurement calls, vendor registration
    TEMPORAL: Current/open RFPs = HIGH VALUE, closed RFPs = historical only
    """,

    HopType.TENDERS_PAGE: """
    Look for: Active tenders, procurement opportunities, vendor registration calls,
    specific project requirements, evaluation criteria.

    HIGH CONFIDENCE: Open tenders with submission deadlines and requirements
    MEDIUM CONFIDENCE: General vendor registration without specific projects
    TEMPORAL: Open tenders = ACTIVE, awarded tenders = historical reference
    """,

    HopType.PROCUREMENT_PAGE: """
    Look for: Procurement policies, vendor qualification requirements, upcoming
    procurement schedules, contact information for vendors.

    HIGH CONFIDENCE: Active procurement announcements with timelines
    MEDIUM CONFIDENCE: Procurement policies and qualification requirements
    TEMPORAL: Recent announcements = relevant, outdated policies = less relevant
    """,

    HopType.DOCUMENT: """
    Look for: Strategic plans, technical architecture, ecosystem diagrams,
    RFP requirements, platform specifications, transformation roadmaps.

    HIGH CONFIDENCE: Detailed technical requirements with "NOT IN RFP" or "TBC" annotations,
    multi-platform architecture diagrams, specific technology stack requirements
    MEDIUM CONFIDENCE: General strategic plans without specific requirements,
    conceptual diagrams without technical details
    TEMPORAL: Recent documents (last 12 months) = most relevant, older than 36 months = outdated
    """
}


# =============================================================================
# Decision Criteria Guidance
# =============================================================================

DECISION_CRITERIA_GUIDANCE = """
## ACCEPT (Strong Procurement Signal)
CLEAR evidence of: Active procurement (job postings), recent deployments (within 12 months),
multi-year partnerships (3+ year contracts), digital transformation initiatives,
leadership appointments.

Required: Specific quotes with dates, vendor names, contract duration.
Confidence delta: +0.06

## WEAK_ACCEPT (Capability Signal)
Evidence of: Technology capability (uses platform X), general digital maturity,
legacy systems, technology investments.

Required: Mentions of technology but no procurement intent.
Confidence delta: +0.02

## REJECT (Evidence Contradicts Hypothesis)
Evidence of: Explicit contradiction, entity outsources, legacy system with no replacement plans,
consumer-focused technology.

Confidence delta: -0.02

## NO_PROGRESS (No Relevant Evidence)
Content doesn't mention hypothesis topic, generic marketing copy,
consumer products/fan engagement, too old/outdated (>18 months).

Confidence delta: 0.0
"""

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
        '{entity} news',
        # LinkedIn RFP/procurement announcements (ACE RFP was found on LinkedIn)
        '{entity} RFP site:linkedin.com',
        '{entity} "request for proposal" site:linkedin.com',
        '{entity} "digital transformation" site:linkedin.com',
        '{entity} procurement site:linkedin.com',
        '{entity} tender site:linkedin.com',
        '{entity} "request for quotations" site:linkedin.com'
    ],
    HopType.LINKEDIN_JOB: [
        '{entity} jobs careers site:linkedin.com',
        '{entity} careers',
        '{entity} open positions'
    ],
    HopType.RFP_PAGE: [
        '{entity} rfp',
        '{entity} "request for proposal" procurement',
        '{entity} tender documents',
        '{entity} "vendor requirements"',
        '{entity} procurement official',
        '{entity} procurement rfp documents',
        '{entity} request for proposal tender',
        # News section targeting (RFPs often announced in news - ACE/MLC RFP was at /news/241)
        '{entity} "request for proposal" news press',
        '{entity} RFP announcement news',
        '{entity} tender announcement press release',
        # Digital transformation specific searches
        '{entity} "digital transformation" RFP',
        '{entity} "digital transformation" request for proposal',
        '{entity} "digital transformation" tender',
        # Technology-specific RFP searches
        '{entity} "CRM" RFP procurement',
        '{entity} "data warehouse" RFP',
        '{entity} "business intelligence" request for proposal',
        '{entity} "SSO" "single sign-on" RFP',
        '{entity} "email marketing" RFP procurement',
        '{entity} "mobile app" RFP development',
        '{entity} "website" RFP redesign',
        # LinkedIn RFP announcements (ACE RFP was found on LinkedIn)
        '{entity} RFP site:linkedin.com',
        '{entity} "request for proposal" site:linkedin.com',
        '{entity} "digital transformation" site:linkedin.com',
        '{entity} procurement site:linkedin.com',
        '{entity} tender site:linkedin.com'
    ],
    HopType.TENDERS_PAGE: [
        '{entity} tenders',
        '{entity} procurement tenders',
        '{entity} "vendor opportunities"',
        '{entity} "supplier tender"',
        '{entity} procurement portal',
        '{entity} vendor registration portal',
        '{entity} procurement opportunities'
    ],
    HopType.PROCUREMENT_PAGE: [
        '{entity} procurement',
        '{entity} purchasing department',
        '{entity} vendors suppliers',
        '{entity} procurement portal',
        '{entity} procurement policy',
        '{entity} vendor information'
    ],
    HopType.CAREERS_PAGE: [
        '{entity} "head of procurement" careers',
        '{entity} "director of digital" careers',
        '{entity} CRM manager careers',
        '{entity} "procurement director" careers',
        '{entity} careers jobs',
        '{entity} work at'
    ],
    HopType.DOCUMENT: [
        '{entity} filetype:pdf ecosystem',
        '{entity} filetype:pdf RFP',
        '{entity} filetype:pdf procurement',
        '{entity} filetype:pdf digital transformation',
        '{entity} filetype:pdf strategic plan',
        '{entity} filetype:pdf architecture',
        '{entity} filetype:pdf roadmap',
        '{entity} filetype:pdf "paddle worldwide"'
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
    - Hypothesis states (new: maturity, activity, sales readiness)
    - Depth statistics
    - Signals discovered
    - Raw Signal objects (for Ralph Loop)
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
    raw_signals: List[Any] = field(default_factory=list)  # Signal objects for Ralph Loop
    hypothesis_states: Dict[str, Dict[str, Any]] = field(default_factory=dict)  # Category -> state data
    performance_summary: Dict[str, Any] = field(default_factory=dict)
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
            'raw_signals_count': len(self.raw_signals),  # Include count for wrapper
            'hypothesis_states': self.hypothesis_states,  # New: hypothesis state data
            'performance_summary': self.performance_summary,
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
        graphiti_service=None,
        config: ParameterConfig = None,
        cache_enabled: bool = True
    ):
        """
        Initialize hypothesis-driven discovery engine with Phase 6 configuration

        Args:
            claude_client: ClaudeClient for AI inference
            brightdata_client: BrightDataSDKClient for web scraping
            falkordb_client: Optional FalkorDB client for persistence
            graphiti_service: Optional GraphitiService for temporal episode storage
            config: Optional ParameterConfig for Phase 6 parameter tuning
            cache_enabled: Enable Phase 5 LRU cache (default: True)
        """
        from backend.hypothesis_manager import HypothesisManager
        from backend.eig_calculator import EIGCalculator

        self.claude_client = claude_client
        self.brightdata_client = brightdata_client
        self.falkordb_client = falkordb_client
        self.graphiti_service = graphiti_service  # For storing discovery episodes

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

        # Initialize PDF extractor
        self.pdf_extractor = None
        if PDF_EXTRACTOR_AVAILABLE:
            try:
                self.pdf_extractor = get_pdf_extractor(enable_ocr=False)
                logger.info("✅ PDF extractor initialized")
            except Exception as e:
                logger.warning(f"⚠️ PDF extractor initialization failed: {e}")

        # Initialize search result validator for post-search validation
        self.search_validator = None
        try:
            from backend.search_result_validator import SearchResultValidator
            self.search_validator = SearchResultValidator(claude_client)
            logger.info("✅ Search result validator initialized")
        except ImportError:
            logger.warning("⚠️ search_result_validator not available - post-search validation disabled")

        # Initialize search cache (24-hour TTL)
        self._search_cache = OrderedDict()
        self._cache_ttl = timedelta(hours=24)

        # Log temporal tracking availability
        if self.graphiti_service:
            logger.info("🕰️ GraphitiService available - discovery will be stored as temporal episodes")
        else:
            logger.info("⚠️ No GraphitiService - discovery episodes will not be stored temporally")

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

        # Dossier hypotheses cache for warm-start discovery
        self._dossier_hypotheses_cache = {}
        self._last_url_candidates: List[str] = []

        logger.info("🔍 HypothesisDrivenDiscovery initialized")

    def _score_url(self, url: str, hop_type: HopType, entity_name: str, title: str = "", snippet: str = "") -> float:
        """
        Score URL relevance for a specific hop type

        Args:
            url: URL to score
            hop_type: Type of hop being executed
            entity_name: Name of entity being searched
            title: Result title from search
            snippet: Result snippet from search

        Returns:
            Relevance score (0.0 to 1.0+)
        """
        score = 0.0
        url_lower = url.lower()
        title_lower = title.lower()
        snippet_lower = snippet.lower()
        from urllib.parse import urlparse
        parsed = urlparse(url_lower)

        # Domain authority signals
        if '.gov.' in url or '.org.' in url:
            score += 0.3

        # Reject search-engine redirect wrappers; they are not target evidence pages.
        if "google." in parsed.netloc and parsed.path in {"/url", "/goto"}:
            return 0.0

        # Entity name match in domain
        entity_slug = entity_name.lower().replace(' ', '').replace('-', '')
        if entity_slug in url_lower:
            score += 0.2
        # Also support initialism-style club domains (e.g., Coventry City FC -> ccfc.co.uk).
        initials = ''.join([part[0] for part in entity_name.lower().replace('-', ' ').split() if part])
        if len(initials) >= 3 and initials in url_lower:
            score += 0.2

        # Source-quality adjustment by domain/content type
        host = parsed.netloc.lower()
        trusted_domain_markers = {
            ".gov", ".org", "tenders", "procurement", "contracts",
        }
        low_quality_domains = {
            "youtube.com", "youtu.be", "reddit.com", "tiktok.com",
            "facebook.com", "instagram.com", "x.com", "twitter.com",
        }
        mainstream_press_domains = {
            "bbc.", "skysports.", "espn.", "goal.com",
        }

        if any(marker in host for marker in trusted_domain_markers):
            score += 0.2
        if any(domain in host for domain in low_quality_domains):
            score -= 0.5
        if hop_type in {HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE}:
            if any(domain in host for domain in mainstream_press_domains):
                score -= 0.15

            # Entity grounding in title/snippet boosts relevance for procurement hops.
            text_blob = f"{title_lower} {snippet_lower}"
            entity_tokens = [t for t in entity_name.lower().replace('-', ' ').split() if len(t) > 2]
            grounded = any(tok in text_blob for tok in entity_tokens)
            if grounded:
                score += 0.15
            else:
                score -= 0.2

        # Official-site specific ranking to avoid store/merch domains becoming canonical.
        if hop_type == HopType.OFFICIAL_SITE:
            # Homepages on the entity domain are preferred.
            parsed_url = parsed
            if entity_slug in url_lower and (parsed_url.path in {"", "/"}):
                score += 0.35
            if len(initials) >= 3 and initials in url_lower and (parsed_url.path in {"", "/"}):
                score += 0.25

            # Demote commercial storefronts; they are often adjacent but not canonical.
            commerce_tokens = {"store", "shop", "ticket", "tickets", "merch", "ecommerce"}
            if any(token in url_lower for token in commerce_tokens):
                score -= 0.7

            # Demote encyclopedic/news mirrors for official-site discovery.
            weak_official_domains = {"wikipedia.org", "espn.", "bbc.", "skysports.", "goal.com"}
            if any(domain in url_lower for domain in weak_official_domains):
                score -= 0.5

        procurement_keywords = {'rfp', 'request for proposal', 'procurement', 'tender', 'vendor', 'supplier'}
        procurement_hops = {HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE, HopType.DOCUMENT}

        # LinkedIn can surface real opportunities, but treat it as weak evidence unless
        # the result explicitly reads like a procurement announcement.
        if hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
            if 'linkedin.com' in url_lower:
                if '/posts/' in url_lower or '/activity/' in url_lower:
                    procurement_language = (
                        any(kw in title_lower for kw in procurement_keywords) or
                        any(kw in snippet_lower for kw in procurement_keywords)
                    )
                    if procurement_language:
                        score += 0.15
                    else:
                        score -= 0.35

        # Hop-type-specific scoring
        if hop_type == HopType.RFP_PAGE:
            keywords = {'rfp': 0.5, 'procurement': 0.3, 'tender': 0.3, 'vendor': 0.2, 'supplier': 0.2}
            for kw, weight in keywords.items():
                if kw in url_lower:
                    score += weight

        elif hop_type == HopType.TENDERS_PAGE:
            keywords = {'tender': 0.4, 'procurement': 0.3, 'vendor': 0.2, 'supplier': 0.2, 'opportunities': 0.1}
            for kw, weight in keywords.items():
                if kw in url_lower:
                    score += weight

        elif hop_type == HopType.PROCUREMENT_PAGE:
            keywords = {'procurement': 0.4, 'purchasing': 0.3, 'vendor': 0.2, 'supplier': 0.2}
            for kw, weight in keywords.items():
                if kw in url_lower:
                    score += weight

        # Title and snippet relevance
        if hop_type in procurement_hops:
            if 'procurement' in title_lower or 'rfp' in title_lower:
                score += 0.2
            if 'procurement' in snippet_lower or 'vendor' in snippet_lower:
                score += 0.1
            if not any(kw in f"{title_lower} {snippet_lower}" for kw in procurement_keywords):
                score -= 0.2

        # Penalty for generic/low-value paths (but not for LinkedIn posts)
        if 'linkedin.com' not in url_lower:
            avoid_paths = {'/news/', '/blog/', '/about/', '/contact/', '/events/', '/media/'}
            if any(path in url_lower for path in avoid_paths):
                score -= 0.5

        # Social and generic press/news results are too noisy for procurement discovery.
        weak_domains = {'linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com'}
        if hop_type in procurement_hops and any(domain in url_lower for domain in weak_domains):
            if not any(kw in f"{title_lower} {snippet_lower}" for kw in procurement_keywords):
                score -= 0.25

        # Bonus for corporate/official paths
        good_paths = {'/procurement/', '/vendors/', '/suppliers/', '/rfp/', '/tenders/'}
        if any(path in url_lower for path in good_paths):
            score += 0.3

        return max(0.0, score)  # Ensure non-negative

    async def _get_cached_search(self, query: str, engine: str) -> Optional[Dict[str, Any]]:
        """Get cached search result if available and not expired"""
        cache_key = f"{engine}:{query}"
        if cache_key in self._search_cache:
            result, timestamp = self._search_cache[cache_key]
            if datetime.now() - timestamp < self._cache_ttl:
                logger.debug(f"Cache hit: {cache_key}")
                return result
            else:
                # Remove expired entry
                del self._search_cache[cache_key]
        return None

    async def _cache_search_result(self, query: str, engine: str, result: Dict[str, Any]):
        """Cache a search result"""
        cache_key = f"{engine}:{query}"
        self._search_cache[cache_key] = (result, datetime.now())

        # Evict oldest entry if cache too large
        if len(self._search_cache) > 256:
            self._search_cache.popitem(last=False)

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
        from backend.schemas import RalphState

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

        # Store context for post-search validation
        self.current_entity_name = entity_name
        self.current_entity_id = entity_id
        # Extract entity type from template ID or hypotheses
        self.current_entity_type = self._extract_entity_type_from_template(template_id)
        self.current_hypothesis_context = f"Searching for procurement signals and RFP opportunities"

        # Main iteration loop
        discovery_started_at = time.perf_counter()

        for iteration in range(1, max_iterations + 1):
            iteration_started_at = time.perf_counter()
            logger.info(f"\n--- Iteration {iteration} ---")

            # Phase A: Re-score hypotheses by EIG
            await self._rescore_hypotheses_by_eig(hypotheses)

            # Phase B: Select top hypothesis (runtime enforced)
            top_hypothesis = await self._select_top_hypothesis(hypotheses, state)

            if not top_hypothesis:
                logger.info("No active hypotheses remaining")
                break

            logger.info(
                f"   Top hypothesis: {top_hypothesis.hypothesis_id} "
                f"(EIG: {top_hypothesis.expected_information_gain:.3f}, "
                f"Confidence: {top_hypothesis.confidence:.2f})"
            )

            # Phase C: Choose hop type (within strategy rails)
            hop_type = self._choose_next_hop(top_hypothesis, state)

            logger.info(f"   Hop type: {hop_type} (depth: {state.current_depth})")

            # Update hypothesis context for post-search validation
            self.current_hypothesis_context = (
                f"Testing hypothesis: {top_hypothesis.statement} "
                f"(category: {top_hypothesis.category}, hop: {hop_type.value})"
            )

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
                'duration_ms': round((time.perf_counter() - iteration_started_at) * 1000, 2),
                'result': result
            }
            state.iteration_results.append(iteration_record)

            # Phase F: Check stopping conditions
            if self._should_stop(state, iteration, max_depth, top_hypothesis):
                logger.info(f"Stopping condition met at iteration {iteration}")
                break

        # Build final result
        return await self._build_final_result(
            state,
            hypotheses,
            total_duration_ms=round((time.perf_counter() - discovery_started_at) * 1000, 2)
        )

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
        from backend.sources.mcp_source_priorities import (
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
            HopType.LINKEDIN_JOB: SourceType.LINKEDIN_JOBS_OPERATIONAL,
            # NEW: RFP/Tenders hop types (HIGH VALUE - partnership opportunities)
            HopType.RFP_PAGE: SourceType.PARTNERSHIP_ANNOUNCEMENTS,
            HopType.TENDERS_PAGE: SourceType.PARTNERSHIP_ANNOUNCEMENTS,
            HopType.PROCUREMENT_PAGE: SourceType.PARTNERSHIP_ANNOUNCEMENTS
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
            f"   MCP-guided hop selection: {best_hop.value} "
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
        hop_started_at = time.perf_counter()
        performance = {
            'hop_type': hop_type.value if hasattr(hop_type, 'value') else str(hop_type),
            'started_at': datetime.now(timezone.utc).isoformat()
        }

        def build_no_progress_result(justification: str, scrape_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
            performance['total_duration_ms'] = round((time.perf_counter() - hop_started_at) * 1000, 2)
            logger.info(
                "⏱️ Hop timing %s: total=%sms url=%sms scrape=%sms eval=%sms",
                hop_type.value,
                performance['total_duration_ms'],
                performance.get('url_resolution_ms', 0.0),
                performance.get('scrape_ms', 0.0),
                performance.get('evaluation_ms', 0.0)
            )
            return {
                'hop_type': hop_type.value,
                'url': url if 'url' in locals() else None,
                'decision': 'NO_PROGRESS',
                'confidence_delta': 0.0,
                'justification': justification,
                'evidence_found': '',
                'cost_usd': 0.0,
                'scrape_data': scrape_data or {},
                'performance': performance
            }

        async def try_additional_candidates(primary_url: str, reason: str) -> Optional[Dict[str, Any]]:
            """Try additional scored URL candidates when the primary scrape path fails."""
            max_candidates = int(os.getenv("DISCOVERY_MAX_URL_CANDIDATES_PER_HOP", "3"))
            candidates = []
            for candidate in getattr(self, "_last_url_candidates", []):
                if candidate and candidate != primary_url and candidate not in candidates:
                    candidates.append(candidate)
                if len(candidates) >= max_candidates - 1:
                    break
            if not candidates:
                return None

            performance.setdefault("candidate_attempts", [])
            for candidate_url in candidates:
                candidate_record = {"url": candidate_url}
                performance["candidate_attempts"].append(candidate_record)
                try:
                    scrape_started_at = time.perf_counter()
                    content_result = await self.brightdata_client.scrape_as_markdown(candidate_url)
                    candidate_record["scrape_ms"] = round((time.perf_counter() - scrape_started_at) * 1000, 2)

                    if content_result.get("status") != "success":
                        candidate_record["status"] = "scrape_failed"
                        continue

                    content_text = content_result.get("content", "")
                    if not isinstance(content_text, str) or not content_text.strip():
                        candidate_record["status"] = "empty_content"
                        continue

                    evaluation_started_at = time.perf_counter()
                    evaluation = await self._evaluate_content_with_claude(
                        content=content_text,
                        hypothesis=hypothesis,
                        hop_type=hop_type,
                        content_metadata={"content_type": "text/html", "char_count": len(content_text)},
                    )
                    candidate_record["evaluation_ms"] = round((time.perf_counter() - evaluation_started_at) * 1000, 2)

                    decision = evaluation.get("decision", "NO_PROGRESS")
                    if decision in {"ACCEPT", "WEAK_ACCEPT"}:
                        target_entity_name = (
                            getattr(state, 'entity_name', None)
                            or getattr(hypothesis, 'entity_name', None)
                            or (getattr(hypothesis, 'metadata', {}) or {}).get('entity_name')
                            or ''
                        )
                        if not self._is_entity_grounded(content=content_text, url=candidate_url, entity_name=target_entity_name):
                            evaluation = {
                                **evaluation,
                                "decision": "REJECT",
                                "confidence_delta": -0.02,
                                "justification": "Evidence appears weakly grounded to target entity; likely league/governing-body spillover",
                                "evidence_type": "entity_grounding_filter",
                            }

                    hop_cost = 0.001
                    self.total_cost_usd += hop_cost
                    candidate_record["status"] = "evaluated"

                    return {
                        "hop_type": hop_type.value,
                        "url": candidate_url,
                        "decision": evaluation.get("decision", "NO_PROGRESS"),
                        "confidence_delta": evaluation.get("confidence_delta", 0.0),
                        "justification": evaluation.get("justification", reason),
                        "evidence_found": evaluation.get("evidence_found", ""),
                        "cost_usd": hop_cost,
                        "scrape_data": {
                            "publication_date": content_result.get("publication_date"),
                            "timestamp": content_result.get("timestamp"),
                            "url": content_result.get("url"),
                            "word_count": content_result.get("metadata", {}).get("word_count"),
                        },
                        "performance": {
                            **performance,
                            "total_duration_ms": round((time.perf_counter() - hop_started_at) * 1000, 2),
                        },
                    }
                except Exception as candidate_error:
                    candidate_record["status"] = "error"
                    candidate_record["error"] = str(candidate_error)
                    continue
            return None

        # Track depth iteration
        state.increment_depth_count(state.current_depth)

        # Get URL based on hop type
        url_resolution_started_at = time.perf_counter()
        url = await self._get_url_for_hop(hop_type, hypothesis, state)
        performance['url_resolution_ms'] = round((time.perf_counter() - url_resolution_started_at) * 1000, 2)
        if hasattr(self, '_last_url_resolution_metrics'):
            performance['url_resolution'] = self._last_url_resolution_metrics

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
            return build_no_progress_result("No URL found for hop")

        logger.info(f"🔎 Scraping: {url}")

        # Check if URL is a PDF
        is_pdf = self._is_pdf_url(url)

        # Scrape URL
        try:
            if is_pdf and self.pdf_extractor:
                # Extract PDF content
                logger.info(f"📄 PDF detected, extracting with pdf_extractor...")
                scrape_started_at = time.perf_counter()
                extract_result = await self.pdf_extractor.extract(url)
                performance['scrape_ms'] = round((time.perf_counter() - scrape_started_at) * 1000, 2)

                if extract_result.get('status') == 'success':
                    content = extract_result.get('content', '')
                    method = extract_result.get('method', 'unknown')
                    char_count = extract_result.get('char_count', 0)
                    page_count = extract_result.get('page_count', 0)

                    logger.info(f"✅ PDF extracted: {char_count} chars from {page_count} pages (method: {method})")

                    # Mark as PDF content for special handling in evaluation
                    content_metadata = {
                        'content_type': 'application/pdf',
                        'extraction_method': method,
                        'char_count': char_count,
                        'page_count': page_count
                    }
                else:
                    logger.error(f"PDF extraction failed: {extract_result.get('error', 'Unknown error')}")
                    return build_no_progress_result(
                        f"PDF extraction failed: {extract_result.get('error', 'Unknown error')}"
                    )
            else:
                # Scrape HTML content
                if is_pdf and not self.pdf_extractor:
                    logger.warning("⚠️ PDF detected but pdf_extractor not available, skipping...")
                    return build_no_progress_result("PDF detected but extractor unavailable")

                scrape_started_at = time.perf_counter()
                content_result = await self.brightdata_client.scrape_as_markdown(url)
                performance['scrape_ms'] = round((time.perf_counter() - scrape_started_at) * 1000, 2)

                if content_result.get('status') != 'success':
                    logger.error(f"Scraping failed: {content_result.get('error', 'Unknown error')}")
                    alt_result = await try_additional_candidates(
                        primary_url=url,
                        reason=f"Primary scrape failed for {url}: {content_result.get('error', 'Unknown error')}"
                    )
                    if alt_result:
                        return alt_result
                    return build_no_progress_result(
                        f"Scraping failed: {content_result.get('error', 'Unknown error')}",
                        scrape_data={
                            'url': url
                        }
                    )

                content = content_result.get('content', '')
                content_text = content if isinstance(content, str) else ''
                content_metadata = {
                    'content_type': 'text/html',
                    'char_count': len(content_text)
                }

                if not content_text.strip():
                    fallback_entity_name = (
                        getattr(state, 'entity_name', None)
                        or getattr(hypothesis, 'entity_name', None)
                        or (getattr(hypothesis, 'metadata', {}) or {}).get('entity_name')
                        or ''
                    )
                    snippet_fallback = await self._build_snippet_fallback_content(url, fallback_entity_name)
                    if snippet_fallback:
                        logger.info("🧩 Using SERP snippet fallback content for empty scrape")
                        content_text = snippet_fallback
                        content_metadata = {
                            'content_type': 'text/snippet_fallback',
                            'char_count': len(content_text)
                        }
                    else:
                        logger.warning("Scraping returned empty content; treating hop as NO_PROGRESS")
                        alt_result = await try_additional_candidates(
                            primary_url=url,
                            reason=f"No content returned from primary scrape: {url}"
                        )
                        if alt_result:
                            return alt_result
                        return {
                            'hop_type': hop_type.value,
                            'url': url,
                            'decision': 'NO_PROGRESS',
                            'confidence_delta': 0.0,
                            'justification': 'No content returned from scrape',
                            'evidence_found': '',
                            'cost_usd': 0.0,
                            'scrape_data': {
                                'publication_date': content_result.get('publication_date'),
                                'timestamp': content_result.get('timestamp'),
                                'url': content_result.get('url'),
                                'word_count': content_result.get('metadata', {}).get('word_count')
                            },
                            'performance': {
                                **performance,
                                'total_duration_ms': round((time.perf_counter() - hop_started_at) * 1000, 2)
                            }
                        }

                content = content_text

                # ENHANCEMENT: Extract PDF links from tender pages
                # This addresses the ICF case where /tenders page contained links to multiple RFP PDFs
                if hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
                    pdf_links = self._extract_pdf_links_from_content(
                        html_content=content_result.get('raw_html', ''),
                        base_url=url
                    )
                    if pdf_links:
                        logger.info(f"📄 Found {len(pdf_links)} PDF links on tender page")

                        # Prioritize PDFs with RFP/digital keywords in filename
                        prioritized_pdfs = self._prioritize_pdf_links(pdf_links, hypothesis)

                        if prioritized_pdfs:
                            # Extract and evaluate the most relevant PDF
                            best_pdf_url = prioritized_pdfs[0]['url']
                            logger.info(f"🎯 Prioritizing PDF: {best_pdf_url}")

                            # Extract PDF content
                            if self.pdf_extractor:
                                pdf_extract_started_at = time.perf_counter()
                                extract_result = await self.pdf_extractor.extract(best_pdf_url)
                                performance['tender_pdf_extract_ms'] = round((time.perf_counter() - pdf_extract_started_at) * 1000, 2)
                                if extract_result.get('status') == 'success':
                                    content = extract_result.get('content', '')
                                    method = extract_result.get('method', 'unknown')
                                    char_count = extract_result.get('char_count', 0)
                                    page_count = extract_result.get('page_count', 0)

                                    logger.info(f"✅ Tender PDF extracted: {char_count} chars from {page_count} pages")

                                    # Update metadata
                                    content_metadata = {
                                        'content_type': 'application/pdf',
                                        'extraction_method': method,
                                        'char_count': char_count,
                                        'page_count': page_count,
                                        'source_url': best_pdf_url,
                                        'discovered_via': 'tender_page_scan'
                                    }

                                    # Update URL for tracking
                                    url = best_pdf_url

            # Evaluate content with Claude
            evaluation_started_at = time.perf_counter()
            evaluation = await self._evaluate_content_with_claude(
                content=content,
                hypothesis=hypothesis,
                hop_type=hop_type,
                content_metadata=content_metadata
            )
            performance['evaluation_ms'] = round((time.perf_counter() - evaluation_started_at) * 1000, 2)

            # Ground positive decisions to the target entity to avoid league-level spillover.
            decision = evaluation.get('decision', 'NO_PROGRESS')
            if decision in {'ACCEPT', 'WEAK_ACCEPT'}:
                target_entity_name = (
                    getattr(state, 'entity_name', None)
                    or getattr(hypothesis, 'entity_name', None)
                    or (getattr(hypothesis, 'metadata', {}) or {}).get('entity_name')
                    or ''
                )
                if not self._is_entity_grounded(content=content, url=url, entity_name=target_entity_name):
                    evaluation = {
                        **evaluation,
                        'decision': 'REJECT',
                        'confidence_delta': -0.02,
                        'justification': 'Evidence appears weakly grounded to target entity; likely league/governing-body spillover',
                        'evidence_type': 'entity_grounding_filter',
                    }

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

            total_duration_ms = round((time.perf_counter() - hop_started_at) * 1000, 2)
            performance['total_duration_ms'] = total_duration_ms
            logger.info(
                "⏱️ Hop timing %s: total=%sms url=%sms scrape=%sms eval=%sms",
                hop_type.value,
                total_duration_ms,
                performance.get('url_resolution_ms', 0.0),
                performance.get('scrape_ms', 0.0),
                performance.get('evaluation_ms', 0.0)
            )

            return {
                'hop_type': hop_type.value,
                'url': url,
                'decision': evaluation.get('decision', 'NO_PROGRESS'),
                'confidence_delta': evaluation.get('confidence_delta', 0.0),
                'justification': evaluation.get('justification', ''),
                'evidence_found': evaluation.get('evidence_found', ''),
                'cost_usd': hop_cost,
                'scrape_data': {
                    'publication_date': content_result.get('publication_date'),
                    'timestamp': content_result.get('timestamp'),
                    'url': content_result.get('url'),
                    'word_count': content_result.get('metadata', {}).get('word_count')
                },
                'performance': performance
            }

        except Exception as e:
            logger.error(f"Hop execution error: {e}")
            return build_no_progress_result(f"Hop execution error: {e}")

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

    def _is_pdf_url(self, url: str) -> bool:
        """
        Check if URL points to a PDF document

        Args:
            url: URL to check

        Returns:
            True if URL appears to be a PDF
        """
        url_lower = url.lower()

        # Check file extension
        if url_lower.endswith('.pdf'):
            return True

        # Check query parameters (common in CMS systems)
        if '.pdf?' in url_lower:
            return True

        # Check path components
        if '/pdf/' in url_lower or '/documents/' in url_lower or '/files/' in url_lower:
            # Additional check for common PDF paths
            pdf_indicators = ['proposal', 'ecosystem', 'architecture', 'roadmap', 'strategy', 'rfp', 'tender']
            if any(indicator in url_lower for indicator in pdf_indicators):
                return True

        return False

    def _extract_pdf_links_from_content(
        self,
        html_content: str,
        base_url: str
    ) -> List[Dict[str, Any]]:
        """
        Extract PDF links from HTML content

        This addresses cases where tender pages list multiple RFP PDFs
        (e.g., ICF /tenders page with links to DXP, OTT, and other RFPs).

        Args:
            html_content: Raw HTML content
            base_url: Base URL for resolving relative links

        Returns:
            List of dicts with 'url' and 'filename' keys
        """
        import re
        from urllib.parse import urljoin, urlparse

        if not html_content:
            return []

        pdf_links = []

        # Pattern 1: Direct href links to .pdf files
        pdf_pattern = r'href=\"([^\"]*\.pdf[^\"]*)\"'
        for match in re.finditer(pdf_pattern, html_content, re.IGNORECASE):
            pdf_url = match.group(1)
            # Clean up URL (remove query strings if needed)
            pdf_url = pdf_url.split('?')[0].split('#')[0]

            # Resolve relative URLs
            if not pdf_url.startswith('http'):
                pdf_url = urljoin(base_url, pdf_url)

            # Extract filename
            filename = pdf_url.split('/')[-1]

            pdf_links.append({
                'url': pdf_url,
                'filename': filename,
                'source': 'href'
            })

        # Pattern 2: Look for PDFs in /sites/default/files/ pattern (common in Drupal/CMS)
        files_pattern = r'/(sites/default/files/[^\"]*\.pdf)'
        for match in re.finditer(files_pattern, html_content, re.IGNORECASE):
            pdf_path = match.group(1)
            # Resolve to full URL
            parsed_base = urlparse(base_url)
            pdf_url = f"{parsed_base.scheme}://{parsed_base.netloc}{pdf_path}"

            filename = pdf_path.split('/')[-1]

            # Avoid duplicates
            if not any(p['url'] == pdf_url for p in pdf_links):
                pdf_links.append({
                    'url': pdf_url,
                    'filename': filename,
                    'source': 'files_pattern'
                })

        return pdf_links

    def _prioritize_pdf_links(
        self,
        pdf_links: List[Dict[str, Any]],
        hypothesis
    ) -> List[Dict[str, Any]]:
        """
        Prioritize PDF links based on relevance to hypothesis

        Higher priority for PDFs with:
        - RFP/tender/procurement keywords in filename
        - Digital/tech keywords matching hypothesis category
        - Excludes obvious non-relevant files (uniforms, apparel, etc.)

        Args:
            pdf_links: List of PDF link dicts with 'url' and 'filename'
            hypothesis: Current hypothesis being tested

        Returns:
            Prioritized list of PDF links (highest score first)
        """
        if not pdf_links:
            return []

        # Keywords that indicate high relevance (digital RFPs)
        high_priority_keywords = [
            'dxp', 'digital', 'ecosystem', 'crm', 'analytics', 'platform',
            'ott', 'streaming', 'video', 'data', 'lake', 'api',
            'transformation', 'modernization', 'headless', 'cms'
        ]

        # Keywords that indicate medium relevance
        medium_priority_keywords = [
            'rfp', 'tender', 'proposal', 'procurement', 'itt', 'rfq',
            'vendor', 'supplier', 'service', 'system'
        ]

        # Keywords that indicate low relevance (not digital/tech)
        low_priority_keywords = [
            'uniform', 'apparel', 'clothing', 'merchandise', 'kit',
            'equipment', 'office', 'furniture', 'catering', 'travel',
            'insurance', 'cleaning', 'maintenance'
        ]

        scored_pdfs = []

        for pdf in pdf_links:
            filename_lower = pdf['filename'].lower()
            url_lower = pdf['url'].lower()

            score = 0

            # High priority keywords
            for keyword in high_priority_keywords:
                if keyword in filename_lower or keyword in url_lower:
                    score += 10

            # Medium priority keywords
            for keyword in medium_priority_keywords:
                if keyword in filename_lower or keyword in url_lower:
                    score += 5

            # Low priority penalty
            for keyword in low_priority_keywords:
                if keyword in filename_lower or keyword in url_lower:
                    score -= 20

            # Bonus for matching hypothesis category
            if hypothesis:
                category = hypothesis.category.lower()
                if category == 'analytics' and any(k in filename_lower for k in ['analytics', 'data', 'bi', 'intelligence']):
                    score += 8
                elif category == 'member' and any(k in filename_lower for k in ['crm', 'member', 'platform', 'portal']):
                    score += 8
                elif category == 'event' and any(k in filename_lower for k in ['event', 'ticketing', 'platform']):
                    score += 8
                elif category == 'officiating' and any(k in filename_lower for k in ['ott', 'video', 'streaming']):
                    score += 8

            # Bonus for "paddle worldwide" (ICF rebrand)
            if 'paddle' in filename_lower or 'paddle' in url_lower:
                score += 7

            scored_pdfs.append({
                **pdf,
                'priority_score': score
            })

        # Sort by score descending
        scored_pdfs.sort(key=lambda x: x['priority_score'], reverse=True)

        # Filter out PDFs with very low scores (likely irrelevant)
        filtered_pdfs = [p for p in scored_pdfs if p['priority_score'] > -15]

        return filtered_pdfs

    async def _get_url_for_hop(
        self,
        hop_type: HopType,
        hypothesis,
        state
    ) -> Optional[str]:
        """
        Get URL to scrape based on hop type

        Uses multi-engine search, result caching, and URL scoring
        to find the most relevant URL for each hop type.

        Args:
            hop_type: Type of hop
            hypothesis: Hypothesis being explored
            state: Current RalphState

        Returns:
            URL to scrape or None
        """
        entity_name = state.entity_name
        search_started_at = time.perf_counter()
        metrics = {
            'primary_query': None,
            'engines_tried': [],
            'search_calls': 0,
            'search_calls_ms': 0.0,
            'validation_calls': 0,
            'validation_ms': 0.0,
            'fallback_queries_tried': 0,
            'site_specific_attempted': False
        }
        self._last_url_candidates = []

        # Special handling for DOCUMENT hop type - use optimized PDF search
        if hop_type == HopType.DOCUMENT:
            logger.debug("Using optimized PDF search for DOCUMENT hop type")

            pdf_url = await self._search_pdfs_optimized(entity_name)

            if pdf_url:
                return pdf_url

            # Fall through to standard search if optimized search fails
            logger.warning("Optimized PDF search failed, falling back to standard search")

        # Define primary search query for each hop type
        primary_queries = {
            HopType.OFFICIAL_SITE: f'"{entity_name}" official website',
            HopType.CAREERS_PAGE: f'"{entity_name}" careers jobs',
            HopType.ANNUAL_REPORT: f'"{entity_name}" annual report 2024',
            HopType.PRESS_RELEASE: f'"{entity_name}" recent news press release',
            HopType.LINKEDIN_JOB: f'"{entity_name}" jobs careers site:linkedin.com',
            HopType.RFP_PAGE: f'"{entity_name}" rfp',
            HopType.TENDERS_PAGE: f'"{entity_name}" tenders',
            HopType.PROCUREMENT_PAGE: f'"{entity_name}" procurement',
            HopType.DOCUMENT: f'"{entity_name}" filetype:pdf strategic plan OR ecosystem OR architecture'
        }

        # Get primary query for this hop type
        primary_query = primary_queries.get(hop_type)
        metrics['primary_query'] = primary_query

        if not primary_query:
            logger.warning(f"No primary query defined for hop type: {hop_type}")
            metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
            self._last_url_resolution_metrics = metrics
            return None

        # Get engines to try for this hop type
        engines = ENGINE_PREFERENCES.get(hop_type, ['google'])
        num_results = NUM_RESULTS_BY_HOP.get(hop_type, 1)

        logger.debug(f"Primary search query: {primary_query} (engines: {engines}, results: {num_results})")

        # Try each engine
        for engine in engines:
            metrics['engines_tried'].append(engine)
            # Check cache first
            cached_result = await self._get_cached_search(primary_query, engine)
            if cached_result:
                search_result = cached_result
            else:
                # Perform search
                engine_started_at = time.perf_counter()
                search_result = await self.brightdata_client.search_engine(
                    query=primary_query,
                    engine=engine,
                    num_results=num_results
                )
                metrics['search_calls'] += 1
                metrics['search_calls_ms'] += (time.perf_counter() - engine_started_at) * 1000
                # Cache the result
                if search_result.get('status') == 'success':
                    await self._cache_search_result(primary_query, engine, search_result)

            # Process results
            if search_result.get('status') == 'success' and search_result.get('results'):
                results = search_result['results']

                # For high-value hops with multiple results, apply post-search validation
                if hop_type in HIGH_VALUE_HOPS and len(results) > 1:
                    # First pass: URL scoring to filter obviously irrelevant results
                    scored_results = []
                    for item in results:
                        url = item.get('url', '')
                        if not url:
                            continue
                        score = self._score_url(
                            url,
                            hop_type,
                            entity_name,
                            title=item.get('title', ''),
                            snippet=item.get('snippet', '')
                        )
                        logger.debug(f"URL score: {score} for {url}")
                        # Keep results with minimum threshold
                        min_score = 0.5 if hop_type in HIGH_VALUE_HOPS else 0.3
                        if score >= min_score:
                            item['_url_score'] = score
                            scored_results.append(item)

                    # Second pass: Claude validation if we have multiple candidates
                    if len(scored_results) > 1 and self.search_validator:
                        scored_results.sort(key=lambda x: x.get('_url_score', 0), reverse=True)
                        top_score = scored_results[0].get('_url_score', 0)
                        second_score = scored_results[1].get('_url_score', 0)

                        # If the best result is already clearly dominant, skip LLM validation.
                        if top_score >= 0.75 and (top_score - second_score) >= 0.25:
                            best_url = scored_results[0].get('url')
                            self._last_url_candidates = [r.get('url') for r in scored_results if r.get('url')][:3]
                            logger.info(
                                f"✅ {engine} search found dominant URL without validation "
                                f"(score {top_score}, delta {top_score - second_score:.2f}): {best_url}"
                            )
                            metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                            self._last_url_resolution_metrics = {
                                **metrics,
                                'search_calls_ms': round(metrics['search_calls_ms'], 2),
                                'validation_ms': round(metrics['validation_ms'], 2)
                            }
                            return best_url

                        validation_started_at = time.perf_counter()
                        valid_results, rejected_results = await self._validate_search_results(
                            results=scored_results,
                            entity_name=entity_name,
                            entity_type=getattr(self, 'current_entity_type', 'ORG'),
                            search_query=primary_query,
                            hypothesis_context=getattr(self, 'current_hypothesis_context', None)
                        )
                        metrics['validation_calls'] += 1
                        metrics['validation_ms'] += (time.perf_counter() - validation_started_at) * 1000

                        # Return best valid result by URL score
                        if valid_results:
                            # Sort by URL score if available
                            valid_results.sort(key=lambda x: x.get('_url_score', 0), reverse=True)
                            best_url = valid_results[0].get('url')
                            self._last_url_candidates = [r.get('url') for r in valid_results if r.get('url')][:3]
                            best_score = valid_results[0].get('_url_score', 0)
                            logger.info(
                                f"✅ {engine} search found best URL after validation "
                                f"(score {best_score}): {best_url}"
                            )

                            # ENHANCEMENT: If best URL is a PDF, check if there's a tender page
                            # that might contain multiple RFPs (like ICF's /tenders page)
                            if hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
                                if self._is_pdf_url(best_url):
                                    logger.info("📄 Best URL is a PDF, checking for tender page...")
                                    tender_page_url = await self._try_find_tender_page(entity_name, best_url)
                                    if tender_page_url:
                                        logger.info(f"🎯 Found tender page, using instead of direct PDF: {tender_page_url}")
                                        metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                                        self._last_url_resolution_metrics = {
                                            **metrics,
                                            'search_calls_ms': round(metrics['search_calls_ms'], 2),
                                            'validation_ms': round(metrics['validation_ms'], 2)
                                        }
                                        return tender_page_url

                            metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                            self._last_url_resolution_metrics = {
                                **metrics,
                                'search_calls_ms': round(metrics['search_calls_ms'], 2),
                                'validation_ms': round(metrics['validation_ms'], 2)
                            }
                            return best_url

                    # Fallback: return best scored result without validation
                    if scored_results:
                        scored_results.sort(key=lambda x: x.get('_url_score', 0), reverse=True)
                        best_url = scored_results[0].get('url')
                        self._last_url_candidates = [r.get('url') for r in scored_results if r.get('url')][:3]
                        best_score = scored_results[0].get('_url_score', 0)
                        logger.info(f"✅ {engine} search found best URL (score {best_score}): {best_url}")

                        # ENHANCEMENT: If best URL is a PDF, check if there's a tender page
                        # that might contain multiple RFPs (like ICF's /tenders page)
                        if hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
                            if self._is_pdf_url(best_url):
                                logger.info("📄 Best URL is a PDF, checking for tender page...")
                                tender_page_url = await self._try_find_tender_page(entity_name, best_url)
                                if tender_page_url:
                                    logger.info(f"🎯 Found tender page, using instead of direct PDF: {tender_page_url}")
                                    metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                                    self._last_url_resolution_metrics = {
                                        **metrics,
                                        'search_calls_ms': round(metrics['search_calls_ms'], 2),
                                        'validation_ms': round(metrics['validation_ms'], 2)
                                    }
                                    return tender_page_url

                        metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                        self._last_url_resolution_metrics = {
                            **metrics,
                            'search_calls_ms': round(metrics['search_calls_ms'], 2),
                            'validation_ms': round(metrics['validation_ms'], 2)
                        }
                        return best_url
                else:
                    # For lower-priority hops, still rank by URL score instead of taking first result.
                    scored_results = []
                    for item in results:
                        candidate_url = item.get('url', '')
                        if not candidate_url:
                            continue
                        score = self._score_url(
                            candidate_url,
                            hop_type,
                            entity_name,
                            title=item.get('title', ''),
                            snippet=item.get('snippet', '')
                        )
                        item['_url_score'] = score
                        scored_results.append(item)
                    scored_results.sort(key=lambda x: x.get('_url_score', 0), reverse=True)
                    best = scored_results[0] if scored_results else None
                    url = best.get('url') if best else None
                    if url:
                        self._last_url_candidates = [r.get('url') for r in scored_results if r.get('url')][:3]
                        logger.info(f"✅ {engine} search found URL (scored): {url}")
                        metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                        self._last_url_resolution_metrics = {
                            **metrics,
                            'search_calls_ms': round(metrics['search_calls_ms'], 2),
                            'validation_ms': round(metrics['validation_ms'], 2)
                        }
                        return url

        # All engines failed, try fallback queries
        logger.warning(f"⚠️ All search engines failed for {hop_type}, trying fallbacks")

        fallback_queries = self._get_fallback_queries(hop_type, entity_name)

        for i, fallback_query in enumerate(fallback_queries, 1):
            logger.debug(f"Fallback {i}/{len(fallback_queries)}: {fallback_query}")
            metrics['fallback_queries_tried'] += 1

            for engine in engines:
                engine_started_at = time.perf_counter()
                search_result = await self.brightdata_client.search_engine(
                    query=fallback_query,
                    engine=engine,
                    num_results=1
                )
                metrics['search_calls'] += 1
                metrics['search_calls_ms'] += (time.perf_counter() - engine_started_at) * 1000

                if search_result.get('status') == 'success' and search_result.get('results'):
                    url = search_result['results'][0].get('url')
                    if url:
                        self._last_url_candidates = [r.get('url') for r in search_result['results'] if r.get('url')][:3]
                        logger.info(f"✅ Fallback {i} ({engine}) found URL: {url}")
                        metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                        self._last_url_resolution_metrics = {
                            **metrics,
                            'search_calls_ms': round(metrics['search_calls_ms'], 2),
                            'validation_ms': round(metrics['validation_ms'], 2)
                        }
                        return url

        # FINAL FALLBACK: Try site-specific search for RFP-related hops
        # This addresses cases like ACE/MLC where RFP was on entity's own domain
        if hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
            logger.info("🔄 Trying site-specific search as final fallback...")
            metrics['site_specific_attempted'] = True
            site_url = await self._try_site_specific_search(entity_name, hop_type)
            if site_url:
                self._last_url_candidates = [site_url]
                metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
                self._last_url_resolution_metrics = {
                    **metrics,
                    'search_calls_ms': round(metrics['search_calls_ms'], 2),
                    'validation_ms': round(metrics['validation_ms'], 2)
                }
                return site_url

        logger.error(f"❌ All search queries failed for {hop_type}")
        metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
        self._last_url_resolution_metrics = {
            **metrics,
            'search_calls_ms': round(metrics['search_calls_ms'], 2),
            'validation_ms': round(metrics['validation_ms'], 2)
        }
        return None

    async def _try_site_specific_search(
        self,
        entity_name: str,
        hop_type: HopType
    ) -> Optional[str]:
        """
        Try site-specific search as a last resort for RFP/procurement hops

        This addresses cases like ACE/MLC where the RFP was on the entity's own
        domain (majorleaguecricket.com/news/241) but generic searches didn't find it.

        Strategy:
        1. First find the official site domain
        2. Then search site:domain.com for RFP/procurement content

        Args:
            entity_name: Name of entity
            hop_type: Type of hop (RFP_PAGE, TENDERS_PAGE, PROCUREMENT_PAGE)

        Returns:
            URL to scrape or None
        """
        if hop_type not in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
            return None

        logger.info(f"🔍 Trying site-specific search for {entity_name}...")

        # Step 1: Find official site domain
        try:
            official_site_result = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine='google',
                num_results=5
            )

            if official_site_result.get('status') != 'success' or not official_site_result.get('results'):
                logger.warning("Could not find official site for site-specific search")
                return None

            official_results = official_site_result.get('results', [])[:5]
            official_url = None
            scored_candidates = []
            for result in official_results:
                candidate_url = result.get('url', '')
                if not candidate_url:
                    continue
                scored_candidates.append(
                    (
                        self._score_url(
                            url=candidate_url,
                            hop_type=HopType.OFFICIAL_SITE,
                            entity_name=entity_name,
                            title=result.get('title', ''),
                            snippet=result.get('snippet', ''),
                        ),
                        candidate_url,
                    )
                )
            if scored_candidates:
                scored_candidates.sort(key=lambda item: item[0], reverse=True)
                official_url = scored_candidates[0][1]
            else:
                official_url = official_results[0].get('url', '')
            if not official_url:
                return None

            # Extract domain from URL
            from urllib.parse import urlparse
            parsed = urlparse(official_url)
            domain = parsed.netloc

            # Remove www. if present
            if domain.startswith('www.'):
                domain = domain[4:]

            logger.info(f"📍 Found official domain: {domain}")

        except Exception as e:
            logger.warning(f"Error finding official site: {e}")
            return None

        # Step 2: Search the entity's own domain for RFP content
        site_search_queries = [
            f'site:{domain} "request for proposal"',
            f'site:{domain} RFP tender',
            f'site:{domain} procurement',
            f'site:{domain} "request for quotations"',
            f'site:{domain} "digital transformation" RFP',
            f'site:{domain} "CRM" RFP',
            f'site:{domain} "vendor"',
            f'site:{domain} tender',
            f'site:{domain} "supplier"',
            # Also try news section (ACE RFP was at /news/241)
            f'site:{domain}/news/ RFP',
            f'site:{domain}/news/ "request for proposal"',
            f'site:{domain}/news/ tender',
            f'site:{domain}/press/ RFP',
            f'site:{domain}/press/ "request for proposal"'
        ]

        for query in site_search_queries:
            try:
                logger.debug(f"Site search: {query}")

                search_result = await self.brightdata_client.search_engine(
                    query=query,
                    engine='google',
                    num_results=3  # Get more results for site-specific search
                )

                if search_result.get('status') == 'success' and search_result.get('results'):
                    results = search_result['results']

                    # Score each result
                    for result in results:
                        url = result.get('url', '')
                        title = result.get('title', '')
                        snippet = result.get('snippet', '')

                        score = self._score_url(
                            url=url,
                            hop_type=hop_type,
                            entity_name=entity_name,
                            title=title,
                            snippet=snippet
                        )

                        result['_url_score'] = score

                    # Sort by score
                    results.sort(key=lambda x: x.get('_url_score', 0), reverse=True)

                    # Return best result if score is reasonable
                    best_result = results[0]
                    best_score = best_result.get('_url_score', 0)
                    best_url = best_result.get('url')

                    if best_score >= 0.4:  # Slightly lower threshold for site-specific
                        logger.info(f"✅ Site-specific search found: {best_url} (score: {best_score:.2f})")
                        return best_url
                    else:
                        logger.debug(f"Site-specific result score too low: {best_score:.2f}")

            except Exception as e:
                logger.debug(f"Site search query failed: {e}")
                continue

        logger.info("Site-specific search found no suitable results")
        return None

    async def _build_snippet_fallback_content(self, url: str, entity_name: str) -> Optional[str]:
        """
        Build minimal fallback content from SERP snippet when page scraping is empty.
        """
        try:
            from urllib.parse import urlparse
            domain = (urlparse(url).netloc or "").strip()
            if not domain:
                return None
            query = f'site:{domain} "{entity_name}"'
            search_result = await self.brightdata_client.search_engine(
                query=query,
                engine='google',
                num_results=3
            )
            if search_result.get('status') != 'success':
                return None
            snippets = []
            for item in search_result.get('results', []):
                title = (item.get('title') or '').strip()
                snippet = (item.get('snippet') or '').strip()
                if title:
                    snippets.append(title)
                if snippet:
                    snippets.append(snippet)
            text = "\n".join(dict.fromkeys([s for s in snippets if s]))
            return text if text.strip() else None
        except Exception:
            return None

    async def _try_find_tender_page(
        self,
        entity_name: str,
        pdf_url: str
    ) -> Optional[str]:
        """
        Try to find a tender page when a PDF URL is found

        This addresses cases like ICF where search finds a PDF (e.g., rfp_-_uniform.pdf)
        but the actual tender page (/tenders) contains multiple RFPs including
        more relevant ones (e.g., DXP, OTT Platform).

        Strategy:
        1. Extract domain from PDF URL
        2. Check common tender page paths (/tenders, /procurement, /rfp, etc.)
        3. Return the tender page URL if found and accessible

        Args:
            entity_name: Name of entity
            pdf_url: URL of the PDF that was found

        Returns:
            Tender page URL or None
        """
        from urllib.parse import urlparse

        try:
            parsed = urlparse(pdf_url)
            domain = parsed.netloc

            # Common tender page paths to try
            tender_paths = [
                '/tenders',
                '/procurement',
                '/rfp',
                '/tender',
                '/opportunities',
                '/suppliers',
                '/vendor-opportunities'
            ]

            for path in tender_paths:
                tender_url = f"{parsed.scheme}://{domain}{path}"

                logger.debug(f"Checking for tender page: {tender_url}")

                # Quick check without full scrape
                try:
                    check_result = await self.brightdata_client.scrape_as_markdown(tender_url)
                    if check_result.get('status') == 'success':
                        content = check_result.get('content', '').lower()

                        # Check if page has tender-related content
                        tender_indicators = ['tender', 'rfp', 'request for proposal', 'procurement', 'vendor']
                        if any(indicator in content for indicator in tender_indicators):
                            # Check if it has multiple PDFs (good sign it's a tender index page)
                            pdf_count = content.count('.pdf')
                            if pdf_count >= 2:  # Multiple PDFs indicates it's a tender index page
                                logger.info(f"✅ Found tender page with {pdf_count} PDFs: {tender_url}")
                                return tender_url

                except Exception as e:
                    logger.debug(f"Tender page check failed for {tender_url}: {e}")
                    continue

            logger.debug("No suitable tender page found")
            return None

        except Exception as e:
            logger.warning(f"Error finding tender page: {e}")
            return None

    async def _validate_search_results(
        self,
        results: List[Dict[str, Any]],
        entity_name: str,
        entity_type: str,
        search_query: str,
        hypothesis_context: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Validate search results using Claude to filter false positives

        Args:
            results: List of search results with 'title', 'url', 'snippet'
            entity_name: Name of the entity
            entity_type: Type of entity (SPORT_CLUB, SPORT_FEDERATION, etc.)
            search_query: The original search query
            hypothesis_context: Optional context about the hypothesis

        Returns:
            Tuple of (valid_results, rejected_results)
        """
        if not self.search_validator:
            # Validator not available, return all results as valid
            logger.debug("Search result validator not configured, skipping validation")
            return results, []

        if not results:
            return [], []

        try:
            valid, rejected = await self.search_validator.validate_search_results(
                results=results,
                entity_name=entity_name,
                entity_type=entity_type,
                search_query=search_query,
                hypothesis_context=hypothesis_context
            )

            logger.info(
                f"🔍 Post-search validation: {len(valid)}/{len(results)} valid, "
                f"{len(rejected)}/{len(results)} rejected"
            )

            # Log rejected results for analysis
            if rejected:
                for r in rejected:
                    validation = r.get('validation', {})
                    logger.debug(f"  ❌ Rejected: {r.get('title', 'N/A')[:60]} - {validation.get('reason', 'No reason')}")

            return valid, rejected

        except Exception as e:
            logger.warning(f"⚠️ Search result validation failed: {e}, using all results")
            return results, []

    def _extract_entity_type_from_template(self, template_id: str) -> str:
        """
        Extract entity type from template ID

        Args:
            template_id: Template identifier (e.g., "tier_1_club_centralized_procurement")

        Returns:
            Entity type string (SPORT_CLUB, SPORT_FEDERATION, SPORT_LEAGUE, or ORG as default)
        """
        template_lower = template_id.lower()

        if 'club' in template_lower or 'arsenal' in template_lower or 'real madrid' in template_lower:
            return 'SPORT_CLUB'
        elif 'federation' in template_lower or 'icf' in template_lower or 'fiba' in template_lower:
            return 'SPORT_FEDERATION'
        elif 'league' in template_lower or 'premier' in template_lower or 'laliga' in template_lower:
            return 'SPORT_LEAGUE'
        else:
            return 'ORG'  # Default generic type

    async def _search_pdfs_optimized(
        self,
        entity_name: str,
        num_results: int = 5
    ) -> Optional[str]:
        """
        Optimized PDF search using BrightData SDK with multi-engine support

        Searches across Google and Yandex for PDF documents, prioritizing
        URLs that contain procurement-relevant keywords.

        Args:
            entity_name: Name of entity to search for
            num_results: Number of results to check per engine

        Returns:
            Best PDF URL found or None
        """
        pdf_queries = [
            f'"{entity_name}" filetype:pdf ecosystem',
            f'"{entity_name}" filetype:pdf RFP procurement',
            f'"{entity_name}" filetype:pdf digital transformation',
            f'"{entity_name}" filetype:pdf architecture',
        ]

        # Procurement-relevant keywords for URL filtering
        pdf_keywords = ['ecosystem', 'architecture', 'rfp', 'procurement',
                        'strategic', 'roadmap', 'transformation', 'proposal']

        best_url = None
        best_score = 0

        # Try multiple engines for broader coverage
        for engine in ['google', 'yandex']:
            for query in pdf_queries:
                try:
                    search_result = await self.brightdata_client.search_engine(
                        query=query,
                        engine=engine,
                        num_results=num_results
                    )

                    if search_result.get('status') == 'success':
                        for item in search_result.get('results', []):
                            url = item.get('url', '')
                            if self._is_pdf_url(url):
                                # Score based on keyword presence in URL
                                score = sum(1 for kw in pdf_keywords if kw.lower() in url.lower())

                                # Bonus for high-value indicators in snippet
                                snippet = item.get('snippet', '')
                                if any(ind in snippet.lower() for ind in ['not in rfp', 'tbc', 'phase']):
                                    score += 2

                                # Bonus for strategic keywords in title
                                title = item.get('title', '')
                                if any(kw in title.lower() for kw in ['ecosystem', 'architecture', 'roadmap']):
                                    score += 1

                                if score > best_score:
                                    best_score = score
                                    best_url = url
                                    logger.debug(f"Found PDF URL (score {score}): {url}")

                except Exception as e:
                    logger.warning(f"PDF search failed on {engine}: {e}")
                    continue

        if best_url:
            logger.info(f"✅ Optimized PDF search found: {best_url} (score: {best_score})")

        return best_url

    def _build_evaluation_context(
        self,
        hypothesis,
        hop_type: HopType,
        content: str,
        entity_name: str
    ) -> EvaluationContext:
        """Build structured evaluation context for Claude"""
        # Extract hypothesis metadata
        pattern_name = hypothesis.metadata.get('pattern_name', 'unknown')
        template_id = hypothesis.metadata.get('template_id', '')

        # Load template to get early_indicators and keywords
        from backend.template_loader import TemplateLoader
        loader = TemplateLoader()
        template = loader.get_template(template_id) if template_id else None

        # Find matching pattern
        early_indicators = []
        keywords = []
        confidence_weight = hypothesis.prior_probability

        if template:
            for pattern in template.get('signal_patterns', []):
                if pattern.get('pattern_name') == pattern_name:
                    early_indicators = pattern.get('early_indicators', [])
                    keywords = pattern.get('keywords', [])
                    confidence_weight = pattern.get('weight', confidence_weight)
                    break

        # Get recent decision history
        recent_history = []
        if hypothesis.iterations_attempted > 0:
            if hypothesis.iterations_accepted > 0:
                recent_history.append(f"{hypothesis.iterations_accepted} ACCEPT")
            if hypothesis.iterations_weak_accept > 0:
                recent_history.append(f"{hypothesis.iterations_weak_accept} WEAK_ACCEPT")
            if hypothesis.iterations_rejected > 0:
                recent_history.append(f"{hypothesis.iterations_rejected} REJECT")
            if hypothesis.iterations_no_progress > 0:
                recent_history.append(f"{hypothesis.iterations_no_progress} NO_PROGRESS")

        # Determine last decision
        last_decision = None
        if hypothesis.iterations_attempted > 0:
            if hypothesis.last_delta > 0:
                last_decision = "ACCEPT" if hypothesis.last_delta >= 0.04 else "WEAK_ACCEPT"
            elif hypothesis.last_delta < 0:
                last_decision = "REJECT"
            else:
                last_decision = "NO_PROGRESS"

        # Get channel-specific guidance
        channel_guidance = CHANNEL_EVALUATION_GUIDANCE.get(hop_type, "")

        # Determine evidence requirements
        if hop_type in [HopType.OFFICIAL_SITE, HopType.PRESS_RELEASE]:
            min_evidence_strength = "specific_detail"
            temporal_requirements = "last_12_months"
        elif hop_type == HopType.LINKEDIN_JOB:
            min_evidence_strength = "exact_quote"
            temporal_requirements = "last_30_days"
        elif hop_type == HopType.ANNUAL_REPORT:
            min_evidence_strength = "specific_detail"
            temporal_requirements = "most_recent_report"
        elif hop_type in [HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE]:
            # NEW: RFP/Tenders pages have specific requirements
            min_evidence_strength = "specific_detail"
            temporal_requirements = "current_open"  # Open RFPs are HIGH VALUE
        else:  # CAREERS_PAGE
            min_evidence_strength = "specific_detail"
            temporal_requirements = "last_90_days"

        return EvaluationContext(
            hypothesis_statement=hypothesis.statement,
            hypothesis_category=hypothesis.category,
            pattern_name=pattern_name,
            early_indicators=early_indicators,
            keywords=keywords,
            confidence_weight=confidence_weight,
            current_confidence=hypothesis.confidence,
            iterations_attempted=hypothesis.iterations_attempted,
            last_decision=last_decision,
            recent_history=recent_history[:3],
            hop_type=hop_type,
            channel_guidance=channel_guidance,
            entity_name=entity_name,
            content_length=len(content),
            min_evidence_strength=min_evidence_strength,
            temporal_requirements=temporal_requirements
        )

    def _format_early_indicators(self, indicators: List[str]) -> str:
        """Format early indicators for prompt"""
        if not indicators:
            return "- No specific early indicators defined"
        return '\n'.join(f"- {ind}" for ind in indicators)

    def _is_low_signal_content(self, content: str) -> bool:
        """Detect low-signal page content (error/nav shells) for compact prompting."""
        text = str(content or "").strip().lower()
        if not text:
            return True
        words = text.split()
        if len(words) < 80:
            return True
        low_signal_markers = [
            "this endpoint is not supported",
            "terms of use",
            "privacy policy",
            "accessibility",
            "contact us",
            "tickets",
            "store",
            "club site",
        ]
        marker_hits = sum(1 for marker in low_signal_markers if marker in text)
        return marker_hits >= 2

    def _fallback_result(self) -> Dict[str, Any]:
        """Return fallback NO_PROGRESS result"""
        return {
            'decision': 'NO_PROGRESS',
            'confidence_delta': 0.0,
            'justification': 'Evaluation error',
            'evidence_found': '',
            'evidence_type': None
        }

    def _deterministic_fallback_classification(
        self,
        content: str,
        context: EvaluationContext,
        mcp_matches: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Deterministic backup classifier when evaluator response is invalid/non-JSON.
        """
        text = str(content or "").lower()
        keyword_hits = sum(1 for kw in (context.keywords or []) if kw and kw.lower() in text)
        mcp_score = max((float(m.get("total_confidence", 0.0)) for m in (mcp_matches or [])), default=0.0)

        if keyword_hits >= 2 and mcp_score >= 0.2:
            decision = "ACCEPT"
            delta = 0.06
        elif keyword_hits >= 1 or mcp_score >= 0.08:
            decision = "WEAK_ACCEPT"
            delta = 0.02
        elif self._is_low_signal_content(text):
            decision = "NO_PROGRESS"
            delta = 0.0
        else:
            decision = "NO_PROGRESS"
            delta = 0.0

        return {
            "decision": decision,
            "confidence_delta": delta,
            "justification": "Deterministic fallback classifier used after invalid evaluator output",
            "evidence_found": "",
            "evidence_type": "deterministic_fallback",
            "temporal_score": "older",
        }

    def _is_entity_grounded(self, content: str, url: str, entity_name: str) -> bool:
        """
        Check whether evidence content appears grounded to the target entity.
        """
        text = str(content or "").lower()
        entity = str(entity_name or "").strip().lower()
        if not entity:
            return True

        # Direct entity mention.
        if entity in text:
            return True

        # Initialism mention (e.g., Coventry City FC -> ccfc).
        parts = [p for p in entity.replace("-", " ").split() if p]
        initials = "".join(p[0] for p in parts)
        if len(initials) >= 3 and initials in text:
            return True

        # Domain-level grounding in URL.
        from urllib.parse import urlparse
        host = (urlparse(url or "").netloc or "").lower()
        entity_slug = entity.replace(" ", "")
        if entity_slug and entity_slug in host:
            return True
        if len(initials) >= 3 and initials in host:
            return True

        return False

    async def _query_evaluator_model(
        self,
        prompt: str,
        max_tokens: int,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        requested_model: str = "haiku",
    ) -> Dict[str, Any]:
        """Query evaluator model with bounded timeout retries and optional model escalation."""
        import asyncio
        import os
        import random

        query_fn = getattr(getattr(self, "claude_client", None), "query", None)
        if not callable(query_fn):
            raise RuntimeError("Claude client query method unavailable")

        timeout_seconds = float(getattr(self, "evaluation_query_timeout_seconds", 30.0) or 30.0)
        if timeout_seconds <= 0:
            timeout_seconds = 30.0

        timeout_max_retries = max(
            0, int(getattr(self, "evaluation_timeout_max_retries", int(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES", "2"))) or 0)
        )
        timeout_backoff_seconds = max(
            0.0,
            float(getattr(self, "evaluation_timeout_retry_backoff_seconds", float(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_RETRY_BACKOFF_SECONDS", "1.5"))) or 0.0),
        )
        timeout_backoff_cap_seconds = max(
            0.0,
            float(getattr(self, "evaluation_timeout_retry_backoff_cap_seconds", float(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_RETRY_BACKOFF_CAP_SECONDS", "8"))) or 0.0),
        )
        timeout_jitter_seconds = max(
            0.0,
            float(getattr(self, "evaluation_timeout_retry_jitter_seconds", float(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_RETRY_JITTER_SECONDS", "0.35"))) or 0.0),
        )
        timeout_model_escalation_enabled = bool(
            getattr(
                self,
                "evaluation_timeout_model_escalation_enabled",
                str(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_MODEL_ESCALATION_ENABLED", "true")).lower() in {"1", "true", "yes", "on"},
            )
        )
        timeout_escalation_model = str(
            getattr(self, "evaluation_timeout_escalation_model", os.getenv("DISCOVERY_EVALUATION_TIMEOUT_ESCALATION_MODEL", "sonnet"))
            or "sonnet"
        ).strip().lower()

        total_attempts = timeout_max_retries + 1
        current_model = str(requested_model or "haiku").strip().lower() or "haiku"

        async def _await_query(coro):
            try:
                return await asyncio.wait_for(coro, timeout=timeout_seconds)
            except asyncio.TimeoutError as timeout_error:
                raise TimeoutError(
                    f"Evaluator model query timed out after {timeout_seconds:.2f}s"
                ) from timeout_error

        async def _invoke_once() -> Dict[str, Any]:
            try:
                query_coro = query_fn(
                    prompt=prompt,
                    model=current_model,
                    max_tokens=max_tokens,
                    system_prompt=system_prompt,
                    json_mode=json_mode,
                )
                return await _await_query(query_coro)
            except TypeError as type_error:
                message = str(type_error).lower()
                if "unexpected keyword argument" in message:
                    fallback_coro = query_fn(
                        prompt=prompt,
                        model=current_model,
                        max_tokens=max_tokens,
                    )
                    return await _await_query(fallback_coro)
                raise

        for attempt_idx in range(total_attempts):
            try:
                return await _invoke_once()
            except TimeoutError:
                if attempt_idx >= (total_attempts - 1):
                    raise

                if (
                    timeout_model_escalation_enabled
                    and timeout_escalation_model
                    and current_model != timeout_escalation_model
                ):
                    logger.warning(
                        "Evaluator timeout on model=%s; escalating to model=%s",
                        current_model,
                        timeout_escalation_model,
                    )
                    current_model = timeout_escalation_model

                backoff_delay = min(
                    timeout_backoff_cap_seconds,
                    timeout_backoff_seconds * (2 ** attempt_idx),
                )
                if timeout_jitter_seconds > 0:
                    backoff_delay += random.uniform(0.0, timeout_jitter_seconds)
                logger.warning(
                    "Evaluator request timed out (attempt %s/%s); retrying in %.2fs",
                    attempt_idx + 1,
                    total_attempts,
                    backoff_delay,
                )
                if backoff_delay > 0:
                    await asyncio.sleep(backoff_delay)

        raise TimeoutError(f"Evaluator model query timed out after {timeout_seconds:.2f}s")

    async def _evaluate_content_with_claude(
        self,
        content: str,
        hypothesis,
        hop_type: HopType,
        content_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate scraped content with Claude + MCP pattern matching

        Uses hybrid approach with structured context builder:
        1. MCP pattern matching for fast evidence type detection
        2. Structured evaluation context for Claude (hypothesis, channel, history)
        3. Claude evaluation for context and decision validation

        Args:
            content: Scraped markdown content
            hypothesis: Hypothesis being evaluated
            hop_type: Type of hop executed
            content_metadata: Optional metadata about content (type, extraction method, etc.)

        Returns:
            Evaluation result with decision and confidence delta
        """
        try:
            from backend.taxonomy.mcp_evidence_patterns import match_evidence_type
            from backend.confidence.mcp_scorer import MCPScorer, Signal
        except ImportError:
            # Backward compatibility for direct backend cwd execution.
            from taxonomy.mcp_evidence_patterns import match_evidence_type
            from confidence.mcp_scorer import MCPScorer, Signal

        # Step 1: Build structured evaluation context
        entity_name = hypothesis.metadata.get('entity_name', 'this entity')
        context = self._build_evaluation_context(
            hypothesis=hypothesis,
            hop_type=hop_type,
            content=content,
            entity_name=entity_name
        )

        # Step 2: MCP pattern matching (existing logic)
        mcp_matches = match_evidence_type(content, extract_metadata=True)
        logger.debug(f"MCP pattern matching found {len(mcp_matches)} match(es)")

        # Step 3: Build MCP insights section
        mcp_insights = ""
        if mcp_matches:
            mcp_insights = "\n\n## MCP Pattern Matching Results\n"
            for match in mcp_matches:
                mcp_insights += f"- **{match['type']}**: {match['signal']} (+{match['total_confidence']:.2f})\n"

        # Step 4: Build comprehensive prompt
        # Add PDF-specific guidance if content is from PDF
        context_guidance = ""
        if content_metadata and content_metadata.get('content_type') == 'application/pdf':
            context_guidance = """

NOTE: This content was extracted from a PDF document. PDF documents often contain:
- Strategic planning documents with procurement requirements
- Technical architecture diagrams with platform specifications
- RFP requirements with "NOT IN RFP" or "TBC" annotations
- Multi-year digital transformation roadmaps

Pay special attention to:
- Annotations like "NOT IN RFP", "TBC", "Phase 1/2/3" which indicate active procurement
- Specific technology platform requirements (CRM, CMS, Data Lake, etc.)
- Architecture diagrams showing multiple platforms requiring vendor selection
- Budget/timeline information
"""

        low_signal_content = self._is_low_signal_content(content)

        if low_signal_content:
            prompt = f"""
# Discovery Evaluation (Low-Signal Content)

Entity: {context.entity_name}
Hypothesis: {context.hypothesis_statement}
Category: {context.hypothesis_category}
Hop Type: {context.hop_type.value.upper()}
Keywords: {', '.join(context.keywords) if context.keywords else 'None'}

Content:
```markdown
{content[:1200]}
```

Return strict JSON only:
{{
  "decision": "ACCEPT" | "WEAK_ACCEPT" | "REJECT" | "NO_PROGRESS",
  "confidence_delta": 0.0,
  "justification": "brief explanation",
  "evidence_found": "exact quote or empty string",
  "evidence_type": "{mcp_matches[0]['type'] if mcp_matches else 'null'}",
  "temporal_score": "recent_6mo | recent_12mo | older"
}}
"""
        else:
            prompt = f"""
# Hypothesis-Driven Discovery Evaluation

You are evaluating whether {context.entity_name} shows procurement readiness signals.

## Hypothesis Context
**Statement**: {context.hypothesis_statement}
**Category**: {context.hypothesis_category}
**Pattern**: {context.pattern_name}
**Current Confidence**: {context.current_confidence:.2f}
**Iterations Attempted**: {context.iterations_attempted}

## Early Indicators to Look For
{self._format_early_indicators(context.early_indicators)}

## Keywords
{', '.join(context.keywords) if context.keywords else 'None specified'}

## Iteration History
{', '.join(context.recent_history) if context.recent_history else 'First iteration'}
Last Decision: {context.last_decision if context.last_decision else 'N/A'}

## Channel Context: {context.hop_type.value.upper()}
{context.channel_guidance}
{context_guidance}

## Content to Evaluate
```markdown
{content[:2000]}
```

## MCP Pattern Insights
{mcp_insights if mcp_insights else 'No high-confidence MCP patterns detected.'}

## Decision Criteria
{DECISION_CRITERIA_GUIDANCE}

## Evidence Requirements
- **Minimum Evidence Quality**: {context.min_evidence_strength}
- **Temporal Requirements**: {context.temporal_requirements}

## Your Task
Evaluate the content against the hypothesis using:
1. Channel-specific guidance (what to look for on this source type)
2. MCP pattern matches (high-confidence signals)
3. Decision criteria (when to use each decision type)
4. Evidence requirements (quality and recency)

Return JSON:
{{
  "decision": "ACCEPT" | "WEAK_ACCEPT" | "REJECT" | "NO_PROGRESS",
  "confidence_delta": 0.0,
  "justification": "brief explanation referencing specific evidence",
  "evidence_found": "exact quote or specific detail",
  "evidence_type": "{mcp_matches[0]['type'] if mcp_matches else 'null'}",
  "temporal_score": "recent_6mo | recent_12mo | older"
}}
"""

        # Step 5: Call Claude API (existing implementation continues...)
        response_text = ""
        try:
            # Use ClaudeClient.query() instead of Anthropic SDK
            response = await self._query_evaluator_model(
                prompt=prompt,
                max_tokens=220 if low_signal_content else 500,
                system_prompt=(
                    "You are a strict JSON evaluator. "
                    "Return only a single valid JSON object and no markdown, prose, or reasoning."
                ),
                json_mode=True,
                requested_model="haiku",
            )

            # Extract text from response
            # ClaudeClient.query() returns 'content' key, not 'text'
            response_text = response.get('content', '') or response.get('text', '')

            # Parse JSON response (existing code)
            import re

            json_match = re.search(r'\{[^}]*"decision"[^}]*\}', response_text, re.DOTALL)

            if json_match:
                result = json.loads(json_match.group(0))

                # Ensure result has required 'decision' key
                if 'decision' not in result:
                    logger.warning(f"Parsed JSON missing 'decision' key: {result}")
                    return self._fallback_result()

                # Enhance with MCP-derived confidence if not provided
                if mcp_matches and result.get('confidence_delta', 0) == 0.0:
                    try:
                        from backend.confidence.mcp_scorer import calculate_mcp_confidence_from_matches
                    except ImportError:
                        from confidence.mcp_scorer import calculate_mcp_confidence_from_matches
                    mcp_confidence = calculate_mcp_confidence_from_matches(mcp_matches)
                    result['confidence_delta'] = max(0.0, mcp_confidence - 0.70)
                    result['mcp_matches'] = mcp_matches
                    result['mcp_confidence'] = mcp_confidence

                return result
            else:
                # Fallback: extract decision only from decision-specific patterns.
                simple_match = re.search(
                    r'(?:["\']?decision["\']?\s*[:=]\s*["\']?|decision\s+(?:is|should\s+be)\s*:?\s*)(ACCEPT|WEAK_ACCEPT|REJECT|NO_PROGRESS)\b',
                    str(response_text or ""),
                    re.IGNORECASE
                )
                if simple_match:
                    decision = simple_match.group(1).upper()
                    logger.info(f"Fallback extracted decision token: {decision}")
                    return {
                        'decision': decision,
                        'confidence_delta': 0.05 if decision == 'ACCEPT' else (0.02 if decision == 'WEAK_ACCEPT' else 0.0),
                        'justification': 'Extracted from non-JSON evaluator response',
                        'evidence_found': '',
                        'evidence_type': 'fallback'
                    }

                # One-shot recovery: ask evaluator to reformat to strict JSON.
                try:
                    recovery_prompt = (
                        "Convert the following evaluator output into EXACT JSON with keys: "
                        "decision, confidence_delta, justification, evidence_found, evidence_type, temporal_score. "
                        "Decision must be one of ACCEPT|WEAK_ACCEPT|REJECT|NO_PROGRESS. "
                        "Return only JSON.\n\n"
                        f"OUTPUT:\n{str(response_text or '')[:1600]}"
                    )
                    recovery_response = await self._query_evaluator_model(
                        prompt=recovery_prompt,
                        max_tokens=260,
                        system_prompt="Return one valid JSON object only.",
                        json_mode=True,
                        requested_model="haiku",
                    )
                    recovery_text = recovery_response.get('content', '') or recovery_response.get('text', '')
                    recovery_json_match = re.search(r'\{[^}]*"decision"[^}]*\}', str(recovery_text), re.DOTALL)
                    if recovery_json_match:
                        recovered = json.loads(recovery_json_match.group(0))
                        if 'decision' in recovered:
                            return recovered
                except Exception:
                    pass

                if low_signal_content:
                    return {
                        'decision': 'NO_PROGRESS',
                        'confidence_delta': 0.0,
                        'justification': 'Low-signal page content (navigation/error shell) yielded no procurement evidence',
                        'evidence_found': '',
                        'evidence_type': 'low_signal_content',
                        'temporal_score': 'older',
                    }

                logger.warning(f"Could not parse Claude response: {response_text}")
                return self._deterministic_fallback_classification(
                    content=content,
                    context=context,
                    mcp_matches=mcp_matches,
                )
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.debug(f"Response text that failed to parse: {response_text[:500]}")
            # Try to extract decision with simpler regex
            simple_match = re.search(r'"decision"\s*:\s*"(\w+)"', response_text)
            if simple_match:
                decision = simple_match.group(1)
                logger.info(f"Fallback extracted decision: {decision}")
                return {
                    'decision': decision,
                    'confidence_delta': 0.05 if decision == 'ACCEPT' else 0.0,
                    'justification': 'Extracted via fallback parsing',
                    'evidence_found': '',
                    'evidence_type': 'fallback'
                }
            return self._fallback_result()
        except TimeoutError as e:
            logger.warning(f"Claude evaluation timeout: {e}")
            return {
                'decision': 'NO_PROGRESS',
                'confidence_delta': 0.0,
                'justification': 'Evaluator timeout after retry budget; deferred without heuristic fallback',
                'evidence_found': '',
                'evidence_type': 'llm_timeout_deferred',
                'temporal_score': 'unknown',
                'parse_path': 'llm_timeout_deferred',
            }
        except Exception as e:
            logger.error(f"Claude evaluation error: {e}")
            logger.debug(f"Response text: {response_text[:500] if response_text else 'empty'}")
            return self._fallback_result()

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
        from backend.sources.mcp_source_priorities import SourceType

        # Ensure result has required keys
        if 'decision' not in result:
            logger.error(f"Result missing 'decision' key: {result.keys() if hasattr(result, 'keys') else 'not a dict'}")
            return

        # Update hypothesis via manager
        updated_hypothesis = await self.hypothesis_manager.update_hypothesis(
            hypothesis_id=hypothesis.hypothesis_id,
            entity_id=state.entity_id,
            decision=result.get('decision', 'NO_PROGRESS'),
            confidence_delta=result.get('confidence_delta', 0.0),
            evidence_ref=result.get('url', '')
        )

        if updated_hypothesis is None:
            logger.warning(
                "Hypothesis manager returned no persisted state for %s; applying in-memory fallback",
                hypothesis.hypothesis_id
            )
            updated_hypothesis = hypothesis
            updated_hypothesis.iterations_attempted += 1
            decision = result.get('decision', 'NO_PROGRESS')
            if decision == "ACCEPT":
                updated_hypothesis.iterations_accepted += 1
                updated_hypothesis.reinforced_count += 1
            elif decision == "WEAK_ACCEPT":
                updated_hypothesis.iterations_weak_accept += 1
            elif decision == "REJECT":
                updated_hypothesis.iterations_rejected += 1
                updated_hypothesis.weakened_count += 1
            elif decision == "NO_PROGRESS":
                updated_hypothesis.iterations_no_progress += 1

            old_confidence = updated_hypothesis.confidence
            updated_hypothesis.confidence = max(
                0.0,
                min(1.0, updated_hypothesis.confidence + result.get('confidence_delta', 0.0))
            )
            updated_hypothesis.last_delta = updated_hypothesis.confidence - old_confidence
            updated_hypothesis.last_updated = datetime.now(timezone.utc)

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
                "linkedin_job_posting": SourceType.LINKEDIN_JOBS_OPERATIONAL,
                # NEW: RFP/Tenders hop types
                "rfp_page": SourceType.PARTNERSHIP_ANNOUNCEMENTS,
                "tenders_page": SourceType.PARTNERSHIP_ANNOUNCEMENTS,
                "procurement_page": SourceType.PARTNERSHIP_ANNOUNCEMENTS
            }

            hop_type_str = result.get('hop_type', '')
            source_type = hop_type_to_source.get(hop_type_str)

            if source_type:
                # Record success or failure
                decision = result.get('decision', 'NO_PROGRESS')
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
            f"   Iteration complete: {result.get('decision', 'NO_PROGRESS')} "
            f"(+{result.get('confidence_delta', 0.0):.2f}) → "
            f"{updated_hypothesis.confidence:.2f}"
        )

        # Create Signal object for Ralph Loop validation (bridge Step 2 → Step 3)
        signal = self._create_signal_from_hop_result(
            result=result,
            hypothesis=hypothesis,
            entity_id=state.entity_id,
            entity_name=state.entity_name
        )
        if signal:
            # Add signal to state for Ralph Loop
            if not hasattr(state, 'raw_signals'):
                state.raw_signals = []
            state.raw_signals.append(signal)
            logger.info(f"   ✅ Created signal: {signal.id} (type: {signal.type.value}, confidence: {signal.confidence:.2f})")

    def _create_signal_from_hop_result(
        self,
        result: Dict[str, Any],
        hypothesis,
        entity_id: str,
        entity_name: str
    ) -> Optional['Signal']:
        """
        Create Signal object from hop execution result (bridges Step 2 → Step 3)

        Only creates signals for ACCEPT or WEAK_ACCEPT decisions with sufficient evidence.
        Signals are the input format expected by Ralph Loop validation.

        Args:
            result: Hop execution result with decision, confidence_delta, etc.
            hypothesis: The hypothesis being evaluated
            entity_id: Entity identifier
            entity_name: Entity display name

        Returns:
            Signal object if criteria met, None otherwise
        """
        from backend.schemas import Signal, Evidence, SignalType, SignalSubtype

        decision = result.get('decision', 'NO_PROGRESS')

        # Only create signals for positive decisions
        if decision not in ['ACCEPT', 'WEAK_ACCEPT']:
            return None

        # Map hypothesis category to signal type
        signal_type_mapping = {
            'member': SignalType.PARTNERSHIP_FORMED,  # Member platform = partnership
            'officiating': SignalType.TECHNOLOGY_ADOPTED,  # Officiating tech = technology
            'certification': SignalType.TECHNOLOGY_ADOPTED,  # Certification platform = technology
            'event': SignalType.TECHNOLOGY_ADOPTED,  # Event platform = technology
            'analytics': SignalType.TECHNOLOGY_ADOPTED,  # Analytics = technology
            'partnership': SignalType.PARTNERSHIP_FORMED,
            'procurement': SignalType.RFP_DETECTED,
            'rfp': SignalType.RFP_DETECTED,
        }

        # Map to signal subtypes
        signal_subtype_mapping = {
            'member': SignalSubtype.FAN_ENGAGEMENT_PLATFORM,
            'officiating': SignalSubtype.AI_ADOPTION,
            'certification': SignalSubtype.CLOUD_MIGRATION,  # Close match for platform
            'event': SignalSubtype.FAN_ENGAGEMENT_PLATFORM,
            'analytics': SignalSubtype.DATA_ANALYTICS_SUITE,
        }

        category = hypothesis.category.lower() if hypothesis.category else ''
        signal_type = signal_type_mapping.get(category, SignalType.TECHNOLOGY_ADOPTED)
        signal_subtype = signal_subtype_mapping.get(category)

        # Calculate confidence from hypothesis confidence
        confidence = hypothesis.confidence

        # Skip if confidence too low for Ralph Loop (< 0.7)
        if confidence < 0.5:  # Minimum threshold for signal creation
            logger.debug(f"Skipping signal creation: confidence {confidence:.2f} below threshold 0.5")
            return None

        # Generate unique signal ID
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        signal_id = f"{entity_id}_{hypothesis.category}_{timestamp}"

        # Extract content for evidence
        url = result.get('url', '')
        content_snippet = result.get('evidence_found', '')[:500]  # First 500 chars

        # Create evidence object
        evidence_id = f"{signal_id}_evidence_0"
        evidence = Evidence(
            id=evidence_id,
            source=url or 'web_scrape',
            date=datetime.now(timezone.utc),
            signal_id=signal_id,
            url=url,
            extracted_text=content_snippet,
            metadata={
                'hop_type': result.get('hop_type', ''),
                'decision': decision,
                'confidence_delta': result.get('confidence_delta', 0.0),
                'justification': result.get('justification', ''),
                'entity_name': entity_name,
                'hypothesis_id': hypothesis.hypothesis_id,
                'hypothesis_statement': hypothesis.statement
            }
        )

        # Build signal metadata
        signal_metadata = {
            'hypothesis_id': hypothesis.hypothesis_id,
            'hypothesis_statement': hypothesis.statement,
            'hypothesis_category': hypothesis.category,
            'decision': decision,
            'confidence_delta': result.get('confidence_delta', 0.0),
            'justification': result.get('justification', ''),
            'hop_type': result.get('hop_type', ''),
            'source_url': url,
            'entity_name': entity_name,
            'yp_service_fit': hypothesis.metadata.get('yp_service_fit', []),
            'budget_range': hypothesis.metadata.get('budget_range', ''),
            'positioning_strategy': hypothesis.metadata.get('positioning_strategy', ''),
        }

        # Add MCP matches if present
        if 'mcp_matches' in result:
            signal_metadata['mcp_matches'] = result['mcp_matches']
            signal_metadata['mcp_confidence'] = result.get('mcp_confidence', 0.0)

        # Create signal
        signal = Signal(
            id=signal_id,
            type=signal_type,
            confidence=confidence,
            first_seen=datetime.now(timezone.utc),
            entity_id=entity_id,
            subtype=signal_subtype,
            metadata=signal_metadata
        )

        # Store evidence with signal (for Ralph Loop access)
        signal.evidence = [evidence]  # Add as list for Ralph Loop compatibility

        logger.debug(
            f"Created Signal: id={signal_id}, type={signal_type.value}, "
            f"subtype={signal_subtype.value if signal_subtype else 'None'}, "
            f"confidence={confidence:.2f}"
        )

        return signal

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

        Also populates state.raw_signals with Signal objects for Ralph Loop.

        Args:
            state: RalphState with iteration_results

        Returns:
            List of signal dictionaries (for DiscoveryResult output)
        """
        from backend.schemas import Signal, Evidence, SignalType, SignalSubtype

        signals = []
        raw_signals = []

        # Signal type mapping
        signal_type_mapping = {
            'member': (SignalType.PARTNERSHIP_FORMED, SignalSubtype.FAN_ENGAGEMENT_PLATFORM),
            'officiating': (SignalType.TECHNOLOGY_ADOPTED, SignalSubtype.AI_ADOPTION),
            'certification': (SignalType.TECHNOLOGY_ADOPTED, SignalSubtype.CLOUD_MIGRATION),
            'event': (SignalType.TECHNOLOGY_ADOPTED, SignalSubtype.FAN_ENGAGEMENT_PLATFORM),
            'analytics': (SignalType.TECHNOLOGY_ADOPTED, SignalSubtype.DATA_ANALYTICS_SUITE),
            'partnership': (SignalType.PARTNERSHIP_FORMED, None),
            'procurement': (SignalType.RFP_DETECTED, None),
            'rfp': (SignalType.RFP_DETECTED, None),
        }

        for iteration_record in state.iteration_results:
            result = iteration_record.get('result', {})
            decision = result.get('decision', '')

            # Only extract ACCEPT and WEAK_ACCEPT signals
            if decision not in ['ACCEPT', 'WEAK_ACCEPT']:
                continue

            hypothesis_id = iteration_record.get('hypothesis_id', '')

            # Get hypothesis to determine category
            hypothesis = None
            for h in state.active_hypotheses:
                if h.hypothesis_id == hypothesis_id:
                    hypothesis = h
                    break

            if not hypothesis:
                logger.warning(f"Hypothesis not found: {hypothesis_id}")
                continue

            category = hypothesis.category.lower() if hypothesis.category else ''
            signal_type, signal_subtype = signal_type_mapping.get(
                category,
                (SignalType.TECHNOLOGY_ADOPTED, None)
            )

            # Calculate confidence
            confidence = hypothesis.confidence

            # Skip if confidence too low
            if confidence < 0.5:
                logger.debug(f"Skipping signal: confidence {confidence:.2f} below threshold 0.5")
                continue

            # Generate unique signal ID
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
            signal_id = f"{state.entity_id}_{category}_{timestamp}_{len(signals)}"

            # Extract content for evidence
            url = result.get('url', '')
            content_snippet = result.get('evidence_found', '')[:500]

            # Create evidence object
            evidence_id = f"{signal_id}_evidence_0"
            evidence = Evidence(
                id=evidence_id,
                source=url or 'web_scrape',
                date=datetime.now(timezone.utc),
                signal_id=signal_id,
                url=url,
                extracted_text=content_snippet,
                metadata={
                    'hop_type': result.get('hop_type', ''),
                    'decision': decision,
                    'confidence_delta': result.get('confidence_delta', 0.0),
                    'justification': result.get('justification', ''),
                    'entity_name': state.entity_name,
                    'hypothesis_id': hypothesis_id,
                    'hypothesis_statement': hypothesis.statement
                }
            )

            # Build signal metadata
            signal_metadata = {
                'hypothesis_id': hypothesis_id,
                'hypothesis_statement': hypothesis.statement,
                'hypothesis_category': category,
                'decision': decision,
                'confidence_delta': result.get('confidence_delta', 0.0),
                'justification': result.get('justification', ''),
                'hop_type': result.get('hop_type', ''),
                'source_url': url,
                'entity_name': state.entity_name,
                'yp_service_fit': hypothesis.metadata.get('yp_service_fit', []),
                'budget_range': hypothesis.metadata.get('budget_range', ''),
                'positioning_strategy': hypothesis.metadata.get('positioning_strategy', ''),
            }

            # Add MCP metadata if available
            if 'mcp_matches' in result:
                signal_metadata['mcp_matches'] = result['mcp_matches']
                signal_metadata['mcp_confidence'] = result.get('mcp_confidence', 0.0)

            # Create Signal object for Ralph Loop
            signal_obj = Signal(
                id=signal_id,
                type=signal_type,
                confidence=confidence,
                first_seen=datetime.now(timezone.utc),
                entity_id=state.entity_id,
                subtype=signal_subtype,
                metadata=signal_metadata
            )

            # Attach evidence to signal
            signal_obj.evidence = [evidence]

            # Add to raw_signals for Ralph Loop
            raw_signals.append(signal_obj)

            # Build dict for output
            # Include evidence as a list for Ralph Loop compatibility
            signal_dict = {
                'id': signal_id,
                'type': signal_type.value,
                'subtype': signal_subtype.value if signal_subtype else None,
                'confidence': confidence,
                'entity_id': state.entity_id,
                'hypothesis_id': hypothesis_id,
                'decision': decision,
                'justification': result.get('justification', ''),
                'evidence_found': content_snippet,
                'source_url': url,
                'hop_type': result.get('hop_type', ''),
                'depth': iteration_record.get('depth'),
                'iteration': iteration_record.get('iteration'),
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'first_seen': datetime.now(timezone.utc).isoformat(),
                # Add evidence list for Ralph Loop validation
                'evidence': [{
                    'id': evidence_id,
                    'source': url or 'web_scrape',
                    'url': url,
                    'content': content_snippet,
                    'confidence': confidence,
                    'collected_at': datetime.now(timezone.utc).isoformat()
                }]
            }

            signals.append(signal_dict)
            logger.info(f"✅ Extracted signal: {signal_id} (type: {signal_type.value}, confidence: {confidence:.2f})")

        # Store raw_signals on state for Ralph Loop access
        state.raw_signals = raw_signals

        logger.info(f"Extracted {len(signals)} signals from {len(state.iteration_results)} iterations")
        if raw_signals:
            logger.info(f"Created {len(raw_signals)} Signal objects for Ralph Loop validation")

        return signals

        return signals

    async def _store_discovery_episode(
        self,
        state,
        signals_discovered: List[Dict[str, Any]]
    ):
        """
        Store discovery run as a temporal episode for future temporal intelligence

        This ensures that each discovery run contributes to the entity's temporal history,
        allowing the system to learn patterns over time and improve future predictions.

        Args:
            state: Final RalphState
            signals_discovered: List of discovered signals
        """
        if not self.graphiti_service:
            return

        try:
            # Extract earliest evidence_date from iteration results (scrapes)
            earliest_evidence_date = None
            for iteration_record in getattr(state, 'iteration_results', []):
                result = iteration_record.get('result', {})
                scrape_data = result.get('scrape_data', {})
                pub_date = scrape_data.get('publication_date')
                if pub_date:
                    try:
                        from dateutil import parser as date_parser
                        parsed_date = date_parser.parse(pub_date)
                        # Use the earliest (oldest) evidence date
                        if earliest_evidence_date is None or parsed_date < earliest_evidence_date:
                            earliest_evidence_date = parsed_date
                            logger.debug(f"Found evidence date: {parsed_date} from iteration {iteration_record.get('iteration')}")
                    except Exception as e:
                        logger.debug(f"Could not parse evidence date {pub_date}: {e}")

            # Determine episode type based on discovery results
            if signals_discovered:
                # Has signals - mark as discovery with signals
                episode_type = "DISCOVERY_SUCCESS"
                description = (
                    f"Discovery run found {len(signals_discovered)} signal(s). "
                    f"Final confidence: {state.current_confidence:.2f}. "
                    f"Signals: {', '.join(s.get('type', 'UNKNOWN') for s in signals_discovered[:3])}"
                )
            else:
                # No signals found - mark as discovery attempt
                episode_type = "DISCOVERY_RUN"
                description = (
                    f"Discovery run completed with {state.iterations_completed} iterations. "
                    f"Final confidence: {state.current_confidence:.2f}. "
                    f"No signals detected."
                )

            # Store the episode with evidence_date
            evidence_date_iso = earliest_evidence_date.isoformat() if earliest_evidence_date else None

            await self.graphiti_service.add_discovery_episode(
                entity_id=state.entity_id,
                entity_name=state.entity_name,
                entity_type=getattr(state, 'entity_type', 'Entity'),
                episode_type=episode_type,
                description=description,
                source="hypothesis_driven_discovery",
                confidence=state.current_confidence,
                evidence_date=evidence_date_iso,
                metadata={
                    'iterations_completed': state.iterations_completed,
                    'max_depth': state.max_depth_reached if hasattr(state, 'max_depth_reached') else 0,
                    'signals_count': len(signals_discovered),
                    'signal_types': [s.get('type') for s in signals_discovered],
                    'template_id': getattr(state, 'template_id', None),
                    'evidence_date_source': 'scraped_content' if earliest_evidence_date else None
                }
            )

            logger.info(f"🕰️ Stored discovery episode: {episode_type} for {state.entity_name} (evidence_date: {evidence_date_iso[:10] if evidence_date_iso else 'N/A'})")

        except Exception as e:
            logger.warning(f"⚠️ Could not store discovery episode: {e}")

    def _calculate_hypothesis_states_from_iterations(
        self,
        state
    ) -> Dict[str, Dict[str, Any]]:
        """
        Calculate hypothesis states from iteration results

        Uses the new signal classification system to compute:
        - maturity_score: from CAPABILITY signals
        - activity_score: from PROCUREMENT_INDICATOR signals
        - state: MONITOR/WARM/ENGAGE/LIVE based on scores

        Args:
            state: RalphState with iteration_results

        Returns:
            Dict mapping category -> {maturity_score, activity_score, state, ...}
        """
        from backend.ralph_loop import classify_signal, recalculate_hypothesis_state

        # Group signals by category
        category_signals = {
            'CAPABILITY': {},
            'PROCUREMENT_INDICATOR': {},
            'VALIDATED_RFP': {}
        }

        for iteration_record in state.iteration_results:
            result = iteration_record.get('result', {})
            decision = result.get('decision', '')

            # Convert decision to RalphDecisionType
            from backend.schemas import RalphDecisionType
            if decision == 'ACCEPT':
                ralph_decision = RalphDecisionType.ACCEPT
            elif decision == 'WEAK_ACCEPT':
                ralph_decision = RalphDecisionType.WEAK_ACCEPT
            else:
                continue  # Skip REJECT, NO_PROGRESS, SATURATED

            # Get confidence
            confidence = result.get('confidence', 0.5)

            # Get source URL for domain checking
            url = result.get('url', '')

            # Classify the signal
            signal_class = classify_signal(ralph_decision, confidence, url)

            if not signal_class:
                continue

            # Get hypothesis category
            hypothesis_id = iteration_record.get('hypothesis_id', '')
            hypothesis = None
            for h in state.active_hypotheses:
                if h.hypothesis_id == hypothesis_id:
                    hypothesis = h
                    break

            if not hypothesis:
                continue

            category = hypothesis.category
            if category not in category_signals[signal_class.value]:
                category_signals[signal_class.value][category] = []

            # Add signal to category
            category_signals[signal_class.value][category].append({
                'decision': decision,
                'confidence': confidence,
                'url': url
            })

        # Calculate hypothesis states for each category
        hypothesis_states = {}

        # Get all unique categories
        all_categories = set()
        for signal_type in category_signals.values():
            all_categories.update(signal_type.keys())

        for category in all_categories:
            capability_signals = category_signals['CAPABILITY'].get(category, [])
            procurement_indicators = category_signals['PROCUREMENT_INDICATOR'].get(category, [])
            validated_rfps = category_signals['VALIDATED_RFP'].get(category, [])

            if capability_signals or procurement_indicators or validated_rfps:
                state_obj = recalculate_hypothesis_state(
                    entity_id=state.entity_id,
                    category=category,
                    capability_signals=capability_signals,
                    procurement_indicators=procurement_indicators,
                    validated_rfps=validated_rfps
                )

                hypothesis_states[category] = {
                    'maturity_score': state_obj.maturity_score,
                    'activity_score': state_obj.activity_score,
                    'state': state_obj.state,
                    'last_updated': state_obj.last_updated.isoformat()
                }

        return hypothesis_states

    async def _build_final_result(
        self,
        state,
        hypotheses: List,
        total_duration_ms: Optional[float] = None
    ) -> DiscoveryResult:
        """
        Build final discovery result (async to support episode storage)

        Args:
            state: Final RalphState
            hypotheses: List of hypotheses

        Returns:
            DiscoveryResult
        """
        # Extract signals from iteration results
        signals_discovered = self._extract_signals_from_iterations(state)

        # Calculate hypothesis states using new classification system
        hypothesis_states = self._calculate_hypothesis_states_from_iterations(state)

        # Log hypothesis states
        logger.info(f"📊 Calculated {len(hypothesis_states)} hypothesis states:")
        for category, state_data in hypothesis_states.items():
            state_emoji = {'MONITOR': '👁️', 'WARM': '🌡️', 'ENGAGE': '🤝', 'LIVE': '🔥'}.get(state_data['state'], '❓')
            logger.info(f"   {state_emoji} {category}: {state_data['state']} (M: {state_data['maturity_score']:.2f}, A: {state_data['activity_score']:.2f})")

        # Store discovery as temporal episode for future temporal intelligence
        await self._store_discovery_episode(state, signals_discovered)

        performance_summary = self._build_performance_summary(state, total_duration_ms)

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
            signals_discovered=signals_discovered,
            raw_signals=getattr(state, 'raw_signals', []),  # Signal objects for Ralph Loop
            hypothesis_states=hypothesis_states,  # New: hypothesis state data
            performance_summary=performance_summary,
            timestamp=datetime.now(timezone.utc)
        )

    def _build_performance_summary(
        self,
        state,
        total_duration_ms: Optional[float]
    ) -> Dict[str, Any]:
        """Summarize discovery timings so live runs expose the slowest hop."""
        hop_records = []
        slowest_hop = None
        slowest_iteration = None

        for iteration_record in getattr(state, 'iteration_results', []):
            result = iteration_record.get('result', {})
            performance = result.get('performance')
            if not performance:
                continue

            record = {
                'iteration': iteration_record.get('iteration'),
                'hop_type': iteration_record.get('hop_type'),
                'duration_ms': performance.get('total_duration_ms', 0.0),
                'url_resolution_ms': performance.get('url_resolution_ms', 0.0),
                'scrape_ms': performance.get('scrape_ms', 0.0),
                'evaluation_ms': performance.get('evaluation_ms', 0.0),
                'validation_ms': performance.get('url_resolution', {}).get('validation_ms', 0.0),
                'decision': result.get('decision'),
                'selected_url': result.get('url'),
                'selected_domain': urlparse(result.get('url')).netloc if result.get('url') else None,
            }
            hop_records.append(record)

            if slowest_hop is None or record['duration_ms'] > slowest_hop['duration_ms']:
                slowest_hop = record
                slowest_iteration = iteration_record

        return {
            'total_duration_ms': total_duration_ms,
            'iterations_with_timings': len(hop_records),
            'slowest_hop': slowest_hop,
            'slowest_iteration': {
                'iteration': slowest_iteration.get('iteration'),
                'hypothesis_id': slowest_iteration.get('hypothesis_id'),
                'hop_type': slowest_iteration.get('hop_type')
            } if slowest_iteration else None,
            'hop_timings': hop_records
        }

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
            performance_summary={},
            timestamp=datetime.now(timezone.utc)
        )

    # =============================================================================
    # Dossier Integration Methods
    # =============================================================================

    async def initialize_from_question_templates(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        max_questions: int = 10
    ) -> int:
        """
        Initialize discovery system with entity-type-specific question templates

        Each question template generates a hypothesis with:
        - YP service fit
        - Budget range
        - Positioning strategy
        - Validation strategy (next_signals, hop_types)

        Args:
            entity_id: Entity identifier
            entity_name: Human-readable entity name
            entity_type: Type of entity (SPORT_CLUB, SPORT_FEDERATION, SPORT_LEAGUE)
            max_questions: Maximum number of questions/hypotheses to generate

        Returns:
            Number of hypotheses successfully added
        """
        try:
            from entity_type_dossier_questions import (
                generate_hypothesis_batch,
                validate_contact_data
            )
        except ImportError:
            logger.warning("entity_type_dossier_questions not available - question initialization skipped")
            return 0

        from backend.hypothesis_manager import Hypothesis

        # Generate hypotheses from question templates
        hypotheses = generate_hypothesis_batch(
            entity_type=entity_type,
            entity_name=entity_name,
            entity_id=entity_id,
            max_questions=max_questions
        )

        added_count = 0
        for hyp_dict in hypotheses:
            try:
                # Create Hypothesis object with YP metadata
                hypothesis = Hypothesis(
                    hypothesis_id=hyp_dict['hypothesis_id'],
                    entity_id=entity_id,
                    statement=hyp_dict['statement'],
                    category=hyp_dict['category'],
                    prior_probability=hyp_dict['confidence'],
                    confidence=hyp_dict['confidence'],
                    status='ACTIVE',
                    metadata={
                        'source': 'entity_type_question_template',
                        'question_id': hyp_dict['metadata']['question_id'],
                        'yp_service_fit': hyp_dict['metadata']['yp_service_fit'],
                        'budget_range': hyp_dict['metadata']['budget_range'],
                        'yp_advantage': hyp_dict['metadata']['yp_advantage'],
                        'positioning_strategy': hyp_dict['metadata']['positioning_strategy'],
                        'next_signals': hyp_dict['metadata']['next_signals'],
                        'hop_types': hyp_dict['metadata']['hop_types'],
                        'accept_criteria': hyp_dict['metadata']['accept_criteria'],
                        'confidence_boost': hyp_dict['metadata']['confidence_boost']
                    }
                )

                # Store in instance cache
                if not hasattr(self, '_dossier_hypotheses_cache'):
                    self._dossier_hypotheses_cache = {}
                if entity_id not in self._dossier_hypotheses_cache:
                    self._dossier_hypotheses_cache[entity_id] = []
                self._dossier_hypotheses_cache[entity_id].append(hypothesis)

                added_count += 1

                logger.info(
                    f"✅ Added question-based hypothesis: {hypothesis.hypothesis_id} "
                    f"(confidence: {hypothesis.confidence:.2f}, "
                    f"YP services: {', '.join(hyp_dict['metadata']['yp_service_fit'])})"
                )

            except Exception as e:
                logger.error(f"❌ Failed to add question-based hypothesis: {e}")
                continue

        logger.info(f"📋 Question initialization complete: {added_count}/{len(hypotheses)} hypotheses added")
        return added_count

    async def initialize_from_dossier(
        self,
        entity_id: str,
        dossier_hypotheses: List[Dict[str, Any]]
    ) -> int:
        """
        Warm-start discovery system with dossier-generated hypotheses

        Converts dossier hypotheses to internal Hypothesis format and adds
        to hypothesis_manager. Maps signal types to categories and sets
        prior_confidence from dossier confidence scores.

        Enhanced with YP integration - includes YP service fit and positioning
        in hypothesis metadata.

        Args:
            entity_id: Entity identifier
            dossier_hypotheses: List of hypothesis dictionaries from dossier

        Returns:
            Number of hypotheses successfully added
        """
        from backend.hypothesis_manager import Hypothesis

        added_count = 0

        logger.info(f"📋 Initializing {len(dossier_hypotheses)} hypotheses from dossier")

        for hyp_dict in dossier_hypotheses:
            try:
                # Map signal type to category
                signal_type = hyp_dict.get('signal_type', '')
                category = self._map_signal_to_category(signal_type)

                # Enhanced metadata with YP info if available
                metadata = {
                    'source': 'dossier_generation',
                    'dossier_confidence': hyp_dict.get('confidence', 0.50),
                    'original_category': hyp_dict.get('category', 'unknown'),
                    'signal_type': signal_type,
                    'pattern_name': hyp_dict.get('pattern', 'dossier_pattern')
                }

                # Add YP metadata if present
                if 'yp_service_fit' in hyp_dict:
                    metadata['yp_service_fit'] = hyp_dict['yp_service_fit']
                if 'positioning_strategy' in hyp_dict:
                    metadata['positioning_strategy'] = hyp_dict['positioning_strategy']
                if 'hop_types' in hyp_dict:
                    metadata['hop_types'] = hyp_dict['hop_types']
                if 'next_signals' in hyp_dict:
                    metadata['next_signals'] = hyp_dict['next_signals']

                # Create Hypothesis object
                hypothesis = Hypothesis(
                    hypothesis_id=f"{entity_id}_{category}_{hyp_dict.get('category', 'unknown')}",
                    entity_id=entity_id,
                    statement=hyp_dict.get('statement', ''),
                    category=category,
                    prior_probability=hyp_dict.get('confidence', 0.50),
                    confidence=hyp_dict.get('confidence', 0.50),
                    status='ACTIVE',
                    metadata=metadata
                )

                # Store in instance cache for retrieval
                if not hasattr(self, '_dossier_hypotheses_cache'):
                    self._dossier_hypotheses_cache = {}
                if entity_id not in self._dossier_hypotheses_cache:
                    self._dossier_hypotheses_cache[entity_id] = []
                self._dossier_hypotheses_cache[entity_id].append(hypothesis)

                added_count += 1

                logger.info(
                    f"✅ Added dossier hypothesis: {hypothesis.hypothesis_id} "
                    f"(confidence: {hypothesis.confidence:.2f}, category: {category})"
                )

            except Exception as e:
                logger.error(f"❌ Failed to add dossier hypothesis: {e}")
                continue

        logger.info(f"📋 Dossier initialization complete: {added_count}/{len(dossier_hypotheses)} hypotheses added")
        return added_count

    def plan_hops_from_hypothesis(
        self,
        hypothesis: 'Hypothesis',
        entity_name: str
    ) -> List[Dict[str, Any]]:
        """
        Plan discovery hops based on hypothesis metadata

        Maps hypothesis validation strategies to specific hop types:
        - Job postings → CAREERS_PAGE hop
        - RFP mentions → RFP_PAGE, TENDERS_PAGE hops
        - Strategic announcements → PRESS_RELEASE hop
        - Technology info → OFFICIAL_SITE hop

        Args:
            hypothesis: Hypothesis object with metadata
            entity_name: Name of entity for query generation

        Returns:
            List of hop plans with hop_type and query
        """
        hop_plans = []

        # Get validation metadata
        metadata = hypothesis.metadata or {}
        next_signals = metadata.get('next_signals', [])
        hop_types = metadata.get('hop_types', [])

        # If hop_types specified, use them
        if hop_types:
            for hop_type_str in hop_types:
                try:
                    hop_type = HopType(hop_type_str)
                    query = self._generate_query_for_hop(hop_type, hypothesis.statement, entity_name)
                    hop_plans.append({
                        'hop_type': hop_type,
                        'query': query,
                        'priority': 'high' if 'RFP' in hop_type_str or 'TENDER' in hop_type_str else 'medium'
                    })
                except ValueError:
                    logger.warning(f"Invalid hop type: {hop_type_str}")
                    continue

        # Otherwise, infer from next_signals
        elif next_signals:
            for signal in next_signals:
                signal_lower = signal.lower()

                if 'job' in signal_lower:
                    hop_type = HopType.CAREERS_PAGE
                    query = f'"{entity_name}" job posting'
                elif 'rfp' in signal_lower or 'tender' in signal_lower:
                    hop_type = HopType.RFP_PAGE
                    query = f'"{entity_name}" RFP tender'
                elif 'announcement' in signal_lower or 'strategic' in signal_lower:
                    hop_type = HopType.PRESS_RELEASE
                    query = f'"{entity_name}" press release'
                else:
                    hop_type = HopType.OFFICIAL_SITE
                    query = f'"{entity_name}" official site'

                hop_plans.append({
                    'hop_type': hop_type,
                    'query': query,
                    'priority': 'medium'
                })

        # Default to official site if no plan
        if not hop_plans:
            hop_plans.append({
                'hop_type': HopType.OFFICIAL_SITE,
                'query': f'"{entity_name}" official site',
                'priority': 'low'
            })

        return hop_plans

    def _generate_query_for_hop(
        self,
        hop_type: HopType,
        statement: str,
        entity_name: str
    ) -> str:
        """Generate search query for a specific hop type"""
        # Extract keywords from hypothesis statement
        keywords = statement.lower().split()
        relevant_keywords = [k for k in keywords if len(k) > 4][:3]

        if hop_type == HopType.RFP_PAGE:
            return f'"{entity_name}" RFP tender procurement {" ".join(relevant_keywords)}'
        elif hop_type == HopType.CAREERS_PAGE:
            return f'"{entity_name}" job posting {" ".join(relevant_keywords)}'
        elif hop_type == HopType.PRESS_RELEASE:
            return f'"{entity_name}" press release announcement {" ".join(relevant_keywords)}'
        else:
            return f'"{entity_name}" {" ".join(relevant_keywords)}'

    async def run_discovery_with_dossier_context(
        self,
        entity_id: str,
        entity_name: str,
        dossier: Dict[str, Any],
        max_iterations: int = 30
    ) -> DiscoveryResult:
        """
        Run hypothesis-driven discovery with dossier-generated context

        Extracts procurement signals from dossier, generates targeted search
        queries based on signals, and guides hop type selection based on
        dossier insights. Continues with standard discovery flow.

        Args:
            entity_id: Entity identifier
            entity_name: Human-readable entity name
            dossier: Dossier dictionary with procurement signals
            max_iterations: Maximum iterations to run

        Returns:
            DiscoveryResult with enhanced dossier context
        """
        logger.info(f"📋 Running dossier-context discovery for {entity_name}")

        # Extract procurement signals from dossier
        procurement_signals = []
        capability_signals = []
        extracted_signals = dossier.get('extracted_signals', [])

        for raw_signal in extracted_signals:
            normalized_signal = self._normalize_dossier_signal(raw_signal)
            if not normalized_signal:
                continue

            if normalized_signal.get('type') == '[PROCUREMENT]':
                procurement_signals.append(normalized_signal)
            elif normalized_signal.get('type') == '[CAPABILITY]':
                capability_signals.append(normalized_signal)

        procurement_signal_block = dossier.get('procurement_signals', {})
        upcoming_opportunities = procurement_signal_block.get('upcoming_opportunities', [])
        for opportunity in upcoming_opportunities:
            opportunity_signal = self._normalize_dossier_opportunity_signal(opportunity)
            if opportunity_signal:
                procurement_signals.append(opportunity_signal)

        logger.info(f"📋 Found {len(procurement_signals)} procurement signals")
        logger.info(f"📋 Found {len(capability_signals)} capability signals")

        # Convert dossier signals to hypotheses
        dossier_hypotheses = []

        for signal in procurement_signals:
            dossier_hypotheses.append({
                'statement': signal.get('text', ''),
                'category': self._map_signal_to_category(signal.get('type', '')),
                'confidence': signal.get('confidence', 0.50),
                'signal_type': signal.get('type', ''),
                'pattern': 'procurement_signal',
                'source': 'dossier_generation'
            })

        for signal in capability_signals:
            dossier_hypotheses.append({
                'statement': signal.get('text', ''),
                'category': self._map_signal_to_category(signal.get('type', '')),
                'confidence': signal.get('confidence', 0.50),
                'signal_type': signal.get('type', ''),
                'pattern': 'capability_signal',
                'source': 'dossier_generation'
            })

        # Initialize hypotheses from dossier
        await self.initialize_from_dossier(entity_id, dossier_hypotheses)

        # Generate targeted search queries based on dossier signals
        targeted_queries = []

        for signal in procurement_signals:
            # Create targeted search for procurement opportunities
            query = f'"{entity_name}" {signal.get("text", "")} procurement tender'
            targeted_queries.append(query)

        for signal in capability_signals:
            # Create verification search for capabilities
            query = f'"{entity_name}" {signal.get("text", "")} platform'
            targeted_queries.append(query)

        logger.info(f"🔍 Generated {len(targeted_queries)} targeted search queries")

        # Use BrightData SDK to search for specific opportunities
        search_results = []

        for query in targeted_queries[:5]:  # Limit to 5 searches to control cost
            try:
                result = await self.brightdata_client.search_engine(
                    query=query,
                    engine='google',
                    num_results=3
                )

                if result.get('status') == 'success':
                    search_results.extend(result.get('results', []))
                    logger.info(f"✅ Search found {len(result.get('results', []))} results: {query}")

            except Exception as e:
                logger.warning(f"⚠️ Search failed for query: {query} - {e}")
                continue

        logger.info(f"🔍 Total search results: {len(search_results)}")

        # Initialize state and run discovery
        from backend.schemas import RalphState

        state = RalphState(
            entity_id=entity_id,
            entity_name=entity_name,
            max_depth=self.max_depth,
            current_depth=1
        )

        # Add dossier context to iteration results (for tracking)
        state.iteration_results.append({
            'stage': 'dossier_initialization',
            'dossier_signals_count': len(dossier_hypotheses),
            'targeted_searches_count': len(targeted_queries),
            'search_results_count': len(search_results),
            'source': 'dossier_context'
        })

        # Get active hypotheses from dossier cache
        dossier_hyps = self._dossier_hypotheses_cache.get(entity_id, [])
        active_hypotheses = dossier_hyps

        if not active_hypotheses:
            logger.warning("No dossier hypotheses found, falling back to standard discovery")
            return await self.run_discovery(
                entity_id=entity_id,
                entity_name=entity_name,
                template_id='yellow_panther_agency',  # Default template available in bootstrapped_templates
                max_iterations=max_iterations
            )

        state.active_hypotheses = active_hypotheses

        # Run standard discovery loop with dossier-enhanced hypotheses
        result = await self._run_discovery_loop(
            state=state,
            max_iterations=max_iterations
        )

        # Enhance result with dossier context
        result.signals_discovered.extend([{
            'entity_id': entity_id,
            'entity_name': entity_name,
            'signal_type': 'DOSSIER_CONTEXT',
            'confidence_delta': 0.0,
            'evidence_found': f'Initialized with {len(dossier_hypotheses)} dossier hypotheses',
            'justification': 'Dossier-generated hypotheses used as priors',
            'source': 'dossier_integration',
            'timestamp': datetime.now(timezone.utc).isoformat()
        }])

        logger.info(f"✅ Dossier-context discovery complete: {result.final_confidence:.2f} confidence")
        return result

    async def _run_discovery_loop(
        self,
        state,
        max_iterations: int
    ) -> DiscoveryResult:
        """
        Internal method to run discovery loop with pre-initialized state

        Args:
            state: Pre-initialized RalphState
            max_iterations: Maximum iterations

        Returns:
            DiscoveryResult
        """
        hypotheses = state.active_hypotheses

        discovery_started_at = time.perf_counter()

        for iteration in range(1, max_iterations + 1):
            iteration_started_at = time.perf_counter()
            logger.info(f"\n--- Iteration {iteration} ---")

            # Re-score hypotheses by EIG
            await self._rescore_hypotheses_by_eig(hypotheses)

            # Select top hypothesis
            top_hypothesis = await self._select_top_hypothesis(hypotheses, state)

            if not top_hypothesis:
                logger.info("No active hypotheses remaining")
                break

            logger.info(
                f"   Top hypothesis: {top_hypothesis.hypothesis_id} "
                f"(EIG: {top_hypothesis.expected_information_gain:.3f}, "
                f"Confidence: {top_hypothesis.confidence:.2f})"
            )

            # Choose hop type
            hop_type = self._choose_next_hop(top_hypothesis, state)
            logger.info(f"   Hop type: {hop_type} (depth: {state.current_depth})")

            # Execute hop
            result = await self._execute_hop(
                hop_type=hop_type,
                hypothesis=top_hypothesis,
                state=state
            )

            if not result:
                logger.warning(f"Hop execution failed for {hop_type}")
                continue

            # Update state
            await self._update_hypothesis_state(
                hypothesis=top_hypothesis,
                result=result,
                state=state
            )

            # Track iteration
            iteration_record = {
                'iteration': iteration,
                'hypothesis_id': top_hypothesis.hypothesis_id,
                'hop_type': hop_type.value if hasattr(hop_type, 'value') else str(hop_type),
                'depth': state.current_depth,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'duration_ms': round((time.perf_counter() - iteration_started_at) * 1000, 2),
                'result': result
            }
            state.iteration_results.append(iteration_record)

            # Check stopping conditions
            if self._should_stop(state, iteration, self.max_depth, top_hypothesis):
                logger.info(f"Stopping condition met at iteration {iteration}")
                break

        return await self._build_final_result(
            state,
            hypotheses,
            total_duration_ms=round((time.perf_counter() - discovery_started_at) * 1000, 2)
        )

    def _normalize_dossier_signal(self, signal: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Normalize dossier signal variants into the discovery signal contract."""
        if not isinstance(signal, dict):
            return None

        signal_type = signal.get('type') or signal.get('signal_type') or ''
        text = signal.get('text') or signal.get('statement') or signal.get('insight') or signal.get('opportunity') or ''
        confidence = signal.get('confidence', 0.50)

        if not text:
            return None

        if isinstance(confidence, (int, float)) and confidence > 1:
            confidence = confidence / 100.0

        return {
            'type': signal_type,
            'text': text,
            'confidence': confidence,
            'source': signal.get('source', 'dossier_generation'),
        }

    def _normalize_dossier_opportunity_signal(self, opportunity: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert dossier procurement opportunity blocks into procurement signals."""
        if not isinstance(opportunity, dict):
            return None

        opportunity_name = opportunity.get('opportunity') or opportunity.get('title') or ''
        if not opportunity_name:
            return None

        confidence = opportunity.get('rfp_probability', 0.50)
        if isinstance(confidence, (int, float)) and confidence > 1:
            confidence = confidence / 100.0

        timeline = opportunity.get('timeline')
        opportunity_type = opportunity.get('type')

        text = f"Opportunity: {opportunity_name}"
        if opportunity_type:
            text = f"{text} ({opportunity_type})"
        if timeline:
            text = f"{text} timeline {timeline}"

        return {
            'type': '[PROCUREMENT]',
            'text': text,
            'confidence': confidence,
            'source': 'dossier_generation',
        }

    def _map_signal_to_category(self, signal_type: str) -> str:
        """
        Map dossier signal type to discovery category

        Args:
            signal_type: Signal type from dossier (e.g., '[PROCUREMENT]', '[CAPABILITY]')

        Returns:
            Category string for hypothesis system

        Mapping:
        - '[PROCUREMENT]' → 'procurement_opportunity'
        - '[CAPABILITY]' → 'digital_transformation'
        - '[TIMING]' → 'contract_renewal'
        - '[CONTACT]' → 'decision_maker_influence'
        - Unknown → 'general'
        """
        signal_mapping = {
            '[PROCUREMENT]': 'procurement_opportunity',
            '[CAPABILITY]': 'digital_transformation',
            '[TIMING]': 'contract_renewal',
            '[CONTACT]': 'decision_maker_influence'
        }

        return signal_mapping.get(signal_type, 'general')


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
