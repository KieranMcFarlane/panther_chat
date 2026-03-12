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
import random
import re
import asyncio
import time
from importlib import import_module
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import OrderedDict
from urllib.parse import urlparse
from pathlib import Path

logger = logging.getLogger(__name__)


DEFAULT_DISCOVERY_TEMPLATE_ID = "yellow_panther_agency"
FEDERATION_DISCOVERY_TEMPLATE_ID = "federation_governing_body"


def _load_backend_attr(module_name: str, attr_name: str, default: Any = None):
    """Load backend modules whether imported as a package or from the backend cwd."""
    try:
        module = import_module(f"backend.{module_name}")
    except ImportError:
        try:
            module = import_module(module_name)
        except ImportError:
            return default
    return getattr(module, attr_name, default)


def _default_template_id_for_entity_type(entity_type: Optional[str]) -> str:
    normalized = str(entity_type or "").upper()
    if "FEDERATION" in normalized or "GOVERN" in normalized:
        return FEDERATION_DISCOVERY_TEMPLATE_ID
    return DEFAULT_DISCOVERY_TEMPLATE_ID


get_page_rank = _load_backend_attr(
    "discovery_page_registry",
    "get_page_rank",
    lambda _entity_type, _hop_type: 0.5,
)
get_site_path_shortcuts = _load_backend_attr(
    "discovery_page_registry",
    "get_site_path_shortcuts",
    lambda _entity_type, _hop_type: [],
)
rank_official_site_candidates = _load_backend_attr(
    "official_site_resolver",
    "rank_official_site_candidates",
    lambda entity_name, candidates, max_candidates=10: list(candidates[:max_candidates]),
)


def resolve_template_id(template_id: Optional[str], entity_type: Optional[str] = None) -> str:
    """Return an available template id for discovery initialization."""
    from template_loader import TemplateLoader

    loader = TemplateLoader()
    requested = template_id or ""
    if requested and loader.get_template(requested):
        return requested

    default_template_id = _default_template_id_for_entity_type(entity_type)
    if loader.get_template(default_template_id):
        fallback_template_id = default_template_id
    else:
        fallback_template_id = DEFAULT_DISCOVERY_TEMPLATE_ID

    logger.warning(
        "Requested discovery template unavailable, falling back to %s (requested=%s, entity_type=%s)",
        fallback_template_id,
        requested or None,
        entity_type,
    )
    return fallback_template_id
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
        '{entity}.com',
        '{entity} official site procurement',
        '{entity} official site vacancies',
        '{entity} official site news press',
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
        self._official_site_content_cache: Dict[str, Dict[str, Any]] = {}
        self._official_site_evaluation_cache: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        self._resolved_url_context: Dict[str, Dict[str, str]] = {}
        self._official_site_url_cache = self._load_official_site_url_cache()
        self._official_site_domain_map = self._load_official_site_domain_map()
        self._official_site_resolution_failures: Dict[str, float] = {}
        self.current_official_site_url: Optional[str] = None
        self.max_consecutive_no_progress_iterations = int(os.getenv("DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS", "3"))
        self.search_timeout_seconds = float(os.getenv("DISCOVERY_SEARCH_TIMEOUT_SECONDS", "12"))
        self.search_validation_timeout_seconds = float(os.getenv("DISCOVERY_SEARCH_VALIDATION_TIMEOUT_SECONDS", "5"))
        self.url_resolution_timeout_seconds = float(os.getenv("DISCOVERY_URL_RESOLUTION_TIMEOUT_SECONDS", "12"))
        self.url_resolution_max_fallback_queries = max(
            1,
            int(os.getenv("DISCOVERY_URL_RESOLUTION_MAX_FALLBACK_QUERIES", "3")),
        )
        self.url_resolution_max_fallback_queries_single_pass = max(
            1,
            int(os.getenv("DISCOVERY_URL_RESOLUTION_MAX_FALLBACK_QUERIES_SINGLE_PASS", "1")),
        )
        self.url_resolution_max_site_specific_queries = max(
            1,
            int(os.getenv("DISCOVERY_URL_RESOLUTION_MAX_SITE_SPECIFIC_QUERIES", "6")),
        )
        self.url_resolution_max_site_specific_queries_single_pass = max(
            1,
            int(os.getenv("DISCOVERY_URL_RESOLUTION_MAX_SITE_SPECIFIC_QUERIES_SINGLE_PASS", "2")),
        )
        self.dossier_context_targeted_search_enabled = self._parse_bool_env(
            os.getenv("DISCOVERY_DOSSIER_CONTEXT_TARGETED_SEARCH_ENABLED"),
            default=True,
        )
        self.dossier_context_max_targeted_queries = max(
            0,
            int(os.getenv("DISCOVERY_DOSSIER_CONTEXT_MAX_TARGETED_QUERIES", "3")),
        )
        self.dossier_context_max_targeted_queries_single_pass = max(
            0,
            int(os.getenv("DISCOVERY_DOSSIER_CONTEXT_MAX_TARGETED_QUERIES_SINGLE_PASS", "0")),
        )
        self.dossier_context_targeted_search_concurrency = max(
            1,
            int(os.getenv("DISCOVERY_DOSSIER_CONTEXT_TARGETED_SEARCH_CONCURRENCY", "2")),
        )
        self.official_site_resolution_num_results = max(
            1,
            int(os.getenv("DISCOVERY_OFFICIAL_SITE_RESOLUTION_NUM_RESULTS", "3")),
        )
        self.official_site_resolution_engines = [
            engine.strip().lower()
            for engine in (os.getenv("DISCOVERY_OFFICIAL_SITE_RESOLUTION_ENGINES", "google,bing") or "").split(",")
            if engine.strip()
        ] or ["google"]
        self.evaluation_query_timeout_seconds = float(
            os.getenv("DISCOVERY_EVALUATION_QUERY_TIMEOUT_SECONDS", "30")
        )
        self.evaluation_timeout_max_retries = max(
            0,
            int(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_MAX_RETRIES", "2")),
        )
        self.evaluation_timeout_retry_backoff_seconds = max(
            0.0,
            float(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_RETRY_BACKOFF_SECONDS", "1.5")),
        )
        self.evaluation_timeout_retry_backoff_cap_seconds = max(
            0.0,
            float(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_RETRY_BACKOFF_CAP_SECONDS", "8")),
        )
        self.evaluation_timeout_retry_jitter_seconds = max(
            0.0,
            float(os.getenv("DISCOVERY_EVALUATION_TIMEOUT_RETRY_JITTER_SECONDS", "0.35")),
        )
        self.evaluation_max_tokens_default = int(os.getenv("DISCOVERY_EVALUATION_MAX_TOKENS_DEFAULT", "360"))
        self.evaluation_max_tokens_press_release = int(os.getenv("DISCOVERY_EVALUATION_MAX_TOKENS_PRESS_RELEASE", "250"))
        self.evaluation_max_tokens_official_site = int(os.getenv("DISCOVERY_EVALUATION_MAX_TOKENS_OFFICIAL_SITE", "220"))
        self.evaluation_max_tokens_careers_annual_report = int(
            os.getenv("DISCOVERY_EVALUATION_MAX_TOKENS_CAREERS_ANNUAL_REPORT", "300")
        )
        self.evaluation_json_repair_attempt = self._parse_bool_env(
            os.getenv("DISCOVERY_JSON_REPAIR_ATTEMPT"),
            default=True,
        )
        self.strict_evaluator_json_response = self._parse_bool_env(
            os.getenv("DISCOVERY_STRICT_EVALUATOR_JSON"),
            default=True,
        )
        self.content_min_text_chars = int(os.getenv("DISCOVERY_CONTENT_MIN_TEXT_CHARS", "240"))
        self.content_max_script_density = float(os.getenv("DISCOVERY_CONTENT_MAX_SCRIPT_DENSITY", "0.12"))
        self.content_min_keyword_sentences = int(os.getenv("DISCOVERY_CONTENT_MIN_KEYWORD_SENTENCES", "1"))
        self.official_site_multi_page_sweep_enabled = self._parse_bool_env(
            os.getenv("DISCOVERY_OFFICIAL_SITE_MULTI_PAGE_SWEEP_ENABLED"),
            default=True,
        )
        self.official_site_sweep_max_pages = max(
            1,
            int(os.getenv("DISCOVERY_OFFICIAL_SITE_SWEEP_MAX_PAGES", "4")),
        )
        sweep_paths_env = os.getenv(
            "DISCOVERY_OFFICIAL_SITE_SWEEP_PATHS",
            "/,/about,/{locale}/,/{locale}/about,/{locale}/news,/news,/press,/careers",
        )
        self.official_site_sweep_paths = [
            value.strip()
            for value in str(sweep_paths_env or "").split(",")
            if value.strip()
        ] or ["/", "/about", "/news", "/press", "/careers"]
        self.official_site_sweep_scrape_timeout_seconds = float(
            os.getenv("DISCOVERY_OFFICIAL_SITE_SWEEP_SCRAPE_TIMEOUT_SECONDS", "10")
        )
        self.heuristic_fallback_on_llm_unavailable = self._parse_bool_env(
            os.getenv("DISCOVERY_HEURISTIC_FALLBACK_ON_LLM_UNAVAILABLE"),
            default=True,
        )
        self.official_site_resolution_cooldown_seconds = float(
            os.getenv("DISCOVERY_OFFICIAL_SITE_RESOLUTION_COOLDOWN_SECONDS", "180")
        )
        self._llm_runtime_diagnostics: Dict[str, Any] = {
            "llm_provider": getattr(self.claude_client, "provider", "unknown"),
            "llm_retry_attempts": 0,
            "llm_last_status": "not_started",
            "llm_circuit_broken": bool(self._get_claude_disabled_reason()),
            "llm_disable_reason": self._get_claude_disabled_reason(),
            "evaluation_mode": "llm",
            "run_profile": os.getenv("DISCOVERY_PROFILE", "continuous"),
            "run_mode": os.getenv("DISCOVERY_RUN_MODE", "phase1_plus"),
        }
        self._last_url_candidates: List[str] = []

        logger.info("🔍 HypothesisDrivenDiscovery initialized")
    @staticmethod
    def _parse_bool_env(value: Optional[str], *, default: bool) -> bool:
        if value is None:
            return default
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        return default

    def _get_claude_disabled_reason(self) -> Optional[str]:
        claude_client = getattr(self, "claude_client", None)
        getter = getattr(claude_client, "_get_disabled_reason", None)
        if callable(getter):
            try:
                reason = getter()
                return str(reason) if reason else None
            except Exception:  # noqa: BLE001
                return None
        return None

    def _official_site_cache_file(self) -> Path:
        cache_path = os.getenv("DISCOVERY_OFFICIAL_SITE_CACHE_PATH", "backend/data/dossiers/official_site_cache.json")
        path = Path(cache_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / cache_path
        return path

    def _official_site_domain_map_file(self) -> Path:
        domain_map_path = os.getenv(
            "DISCOVERY_OFFICIAL_DOMAIN_MAP_PATH",
            "backend/data/dossiers/official_domain_map.json",
        )
        path = Path(domain_map_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / domain_map_path
        return path

    def _normalize_entity_cache_key(self, entity_name: Any) -> str:
        if not isinstance(entity_name, str):
            return ""
        return entity_name.strip().casefold()

    def _canonical_entity_signature(self, entity_name: Any) -> str:
        if not isinstance(entity_name, str):
            return ""
        cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in entity_name.casefold())
        stopwords = {"the", "fc", "afc", "cf", "club", "football", "sports", "sport", "team", "association"}
        tokens = [token for token in cleaned.split() if token and token not in stopwords]
        if not tokens:
            return ""
        return "".join(tokens)

    def _normalize_http_url(self, candidate: Any) -> Optional[str]:
        if not isinstance(candidate, str):
            return None
        value = candidate.strip()
        if not value:
            return None
        if value.startswith(("http://", "https://")):
            return value
        if value.startswith("www.") or "." in value:
            return f"https://{value.lstrip('/')}"
        return None

    def _load_official_site_url_cache(self) -> Dict[str, str]:
        cache_file = self._official_site_cache_file()
        try:
            if not cache_file.exists():
                return {}
            payload = json.loads(cache_file.read_text())
            if not isinstance(payload, dict):
                return {}
            cache: Dict[str, str] = {}
            for key, value in payload.items():
                if not isinstance(key, str):
                    continue
                normalized = self._normalize_http_url(value)
                if normalized:
                    cache[self._normalize_entity_cache_key(key)] = normalized
            return cache
        except Exception:
            return {}

    def _load_official_site_domain_map(self) -> Dict[str, str]:
        domain_map_file = self._official_site_domain_map_file()
        try:
            if not domain_map_file.exists():
                return {}
            payload = json.loads(domain_map_file.read_text())
            if not isinstance(payload, dict):
                return {}
            mapping: Dict[str, str] = {}
            for key, value in payload.items():
                normalized_url = self._normalize_http_url(value)
                normalized_key = self._normalize_entity_cache_key(key)
                if normalized_key and normalized_url:
                    mapping[normalized_key] = normalized_url
            return mapping
        except Exception:
            return {}

    def _get_cached_official_site_url(self, entity_name: str) -> Optional[str]:
        normalized_key = self._normalize_entity_cache_key(entity_name)
        if not normalized_key:
            return None
        cache = getattr(self, "_official_site_url_cache", None)
        if not isinstance(cache, dict):
            return None
        direct = self._normalize_http_url(cache.get(normalized_key))
        if direct:
            return direct

        target_signature = self._canonical_entity_signature(entity_name)
        if not target_signature:
            return None
        for cached_key, cached_url in cache.items():
            if self._canonical_entity_signature(cached_key) != target_signature:
                continue
            normalized_cached = self._normalize_http_url(cached_url)
            if normalized_cached:
                return normalized_cached
        return None

    def _store_cached_official_site_url(self, entity_name: str, url: str) -> None:
        normalized_key = self._normalize_entity_cache_key(entity_name)
        normalized_url = self._normalize_http_url(url)
        if not normalized_key or not normalized_url:
            return
        cache = getattr(self, "_official_site_url_cache", None)
        if not isinstance(cache, dict):
            cache = {}
            self._official_site_url_cache = cache
        cache[normalized_key] = normalized_url
        cache_file = self._official_site_cache_file()
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(cache, indent=2, sort_keys=True))
        except Exception as cache_error:
            logger.debug("Failed to persist official-site cache: %s", cache_error)

    def _get_mapped_official_site_url(self, entity_name: str) -> Optional[str]:
        normalized_key = self._normalize_entity_cache_key(entity_name)
        if not normalized_key:
            return None
        mapping = getattr(self, "_official_site_domain_map", None)
        if not isinstance(mapping, dict):
            return None
        mapped = self._normalize_http_url(mapping.get(normalized_key))
        if mapped:
            return mapped

        target_signature = self._canonical_entity_signature(entity_name)
        if not target_signature:
            return None
        for mapped_key, mapped_value in mapping.items():
            if self._canonical_entity_signature(mapped_key) != target_signature:
                continue
            resolved = self._normalize_http_url(mapped_value)
            if resolved:
                return resolved
        return None

    def _is_official_site_resolution_in_cooldown(self, entity_name: str) -> bool:
        cooldown = float(getattr(self, "official_site_resolution_cooldown_seconds", 0.0))
        if cooldown <= 0:
            return False
        normalized_key = self._normalize_entity_cache_key(entity_name)
        if not normalized_key:
            return False
        failures = getattr(self, "_official_site_resolution_failures", None)
        if not isinstance(failures, dict):
            return False
        last_failed_at = failures.get(normalized_key)
        if not isinstance(last_failed_at, (int, float)):
            return False
        return (time.time() - last_failed_at) < cooldown

    def _mark_official_site_resolution_failure(self, entity_name: str) -> None:
        normalized_key = self._normalize_entity_cache_key(entity_name)
        if not normalized_key:
            return
        failures = getattr(self, "_official_site_resolution_failures", None)
        if not isinstance(failures, dict):
            failures = {}
            self._official_site_resolution_failures = failures
        failures[normalized_key] = time.time()

    def _current_run_mode(self) -> str:
        mode = str(os.getenv("DISCOVERY_RUN_MODE", "phase1_plus") or "phase1_plus").strip().lower()
        if mode not in {"single_pass", "phase1_plus"}:
            mode = "phase1_plus"
        return mode

    def _is_single_pass_mode(self) -> bool:
        return self._current_run_mode() == "single_pass"

    def _update_llm_runtime_diagnostics(self, **kwargs: Any) -> None:
        diag = getattr(self, "_llm_runtime_diagnostics", None)
        if not isinstance(diag, dict):
            claude_client = getattr(self, "claude_client", None)
            diag = {
                "llm_provider": getattr(claude_client, "provider", "unknown"),
                "llm_retry_attempts": 0,
                "llm_last_status": "not_started",
                "llm_circuit_broken": False,
                "llm_disable_reason": None,
                "evaluation_mode": "llm",
                "run_profile": os.getenv("DISCOVERY_PROFILE", "continuous"),
                "run_mode": os.getenv("DISCOVERY_RUN_MODE", "phase1_plus"),
            }
            self._llm_runtime_diagnostics = diag

        for key, value in kwargs.items():
            if value is None:
                continue
            if key == "llm_retry_attempts":
                current = diag.get("llm_retry_attempts", 0)
                try:
                    diag[key] = max(int(current), int(value))
                except Exception:  # noqa: BLE001
                    continue
            else:
                diag[key] = value

    @staticmethod
    def _map_status_to_parse_path(status: Optional[str]) -> str:
        status_value = str(status or "").strip().lower()
        mapping = {
            "ok": "json_direct",
            "key_value_recovered": "key_value_recovered",
            "partial_json_recovered": "partial_json_recovered",
            "text_decision_recovered": "text_decision_recovered",
            "text_no_progress_recovered": "text_no_progress_recovered",
            "strict_text_no_progress_recovered": "text_no_progress_recovered",
            "strict_truncated_json_recovered": "json_truncated_recovered",
            "text_accept_recovered": "text_decision_recovered",
            "json_repair_recovered": "json_repair_recovered",
            "structured_payload": "structured_output",
            "invalid_model_payload": "heuristic_fallback",
            "unparseable_response": "heuristic_fallback",
            "json_parse_error": "heuristic_fallback",
            "request_error": "heuristic_fallback",
            "request_timeout": "heuristic_fallback",
            "disabled": "heuristic_fallback",
            "strict_json_enforced": "heuristic_fallback",
            "empty_response": "heuristic_fallback",
            "skipped_no_content": "skipped_no_evaluation",
            "skipped_low_yield": "skipped_no_evaluation",
            "skipped_no_evaluation": "skipped_no_evaluation",
        }
        return mapping.get(status_value, "heuristic_fallback")

    async def _attempt_json_repair_pass(self, response_text: str) -> Optional[Dict[str, Any]]:
        if not getattr(self, "evaluation_json_repair_attempt", True):
            return None
        repair_prompt = (
            "Convert the following evaluator output into strict JSON only with keys: "
            "decision, confidence_delta, justification, evidence_found, evidence_type, temporal_score.\n\n"
            f"Output:\n{response_text[:2000]}"
        )
        try:
            repair = await self._query_evaluator_model(
                prompt=repair_prompt,
                max_tokens=220,
                system_prompt=(
                    "Return ONLY valid JSON. No prose, no markdown, no code fences. "
                    "Include keys: decision, confidence_delta, justification, evidence_found, evidence_type, temporal_score."
                ),
                json_mode=True,
            )
        except Exception:  # noqa: BLE001
            return None
        repair_text = (repair or {}).get("content", "") if isinstance(repair, dict) else ""
        parsed = self._parse_evaluation_response_json(str(repair_text or ""))
        if isinstance(parsed, dict) and "decision" in parsed:
            parsed["parse_path"] = "json_repair_recovered"
            return parsed
        return None

    def _assess_low_yield_content(
        self,
        *,
        content_text: str,
        raw_html: Optional[str],
        hypothesis_category: str,
    ) -> Optional[str]:
        text = str(content_text or "").strip()
        text_chars = len(text)
        min_text_chars = max(0, int(getattr(self, "content_min_text_chars", 0)))
        if text_chars < min_text_chars:
            return f"text_chars<{min_text_chars}"

        html = str(raw_html or "")
        script_count = html.lower().count("<script")
        max_script_density = float(getattr(self, "content_max_script_density", 0.12))
        script_density = script_count / max(text_chars, 1)
        if script_density > max_script_density:
            return f"script_density>{max_script_density:.2f}"

        keywords_by_category = {
            "procurement": ["procurement", "tender", "rfp", "vendor", "supplier"],
            "analytics": ["data", "analytics", "platform", "integration"],
            "member": ["member", "crm", "engagement", "portal"],
        }
        category_key = str(hypothesis_category or "").lower().strip()
        if category_key not in keywords_by_category:
            return None

        minimum_keyword_sentences = max(0, int(getattr(self, "content_min_keyword_sentences", 0)))
        if minimum_keyword_sentences == 0:
            return None
        # Long pages frequently contain rich navigation/footer text where strict keyword
        # sentence matching is noisy; skip this gate when page text is already substantial.
        if text_chars >= 5000:
            return None

        keywords = keywords_by_category[category_key]
        sentence_count = 0
        for sentence in re.split(r"[.!?\\n]+", text):
            sentence_lower = sentence.lower().strip()
            if sentence_lower and any(kw in sentence_lower for kw in keywords):
                sentence_count += 1
        if sentence_count < minimum_keyword_sentences:
            return f"keyword_sentences<{minimum_keyword_sentences}"
        return None

    def _build_official_site_sweep_candidates(self, base_url: str) -> List[str]:
        parsed = urllib.parse.urlparse(str(base_url or "").strip())
        if not parsed.scheme or not parsed.netloc:
            return [base_url] if isinstance(base_url, str) and base_url.strip() else []

        base_origin = f"{parsed.scheme}://{parsed.netloc}"
        path_segments = [segment for segment in (parsed.path or "").split("/") if segment]
        locale_segment = ""
        if path_segments:
            candidate = path_segments[0].strip().lower()
            if re.match(r"^[a-z]{2,5}(?:-[a-z]{2,5})?$", candidate):
                locale_segment = candidate

        raw_paths = list(getattr(self, "official_site_sweep_paths", []) or [])
        if not raw_paths:
            raw_paths = ["/", "/about", "/news", "/press", "/careers"]

        candidates: List[str] = []
        seen = set()

        def _add(url: str) -> None:
            normalized = self._normalize_http_url(url)
            if not normalized or normalized in seen:
                return
            seen.add(normalized)
            candidates.append(normalized)

        _add(base_url)

        for raw_path in raw_paths:
            path = str(raw_path or "").strip()
            if not path:
                continue
            if "{locale}" in path:
                replacement = locale_segment or ""
                path = path.replace("{locale}", replacement)
            path = re.sub(r"/{2,}", "/", path)
            if not path.startswith("/"):
                path = f"/{path}"
            if path != "/" and path.endswith("/"):
                path = path.rstrip("/")
            _add(f"{base_origin}{path}")

        max_pages = max(1, int(getattr(self, "official_site_sweep_max_pages", 4) or 4))
        return candidates[:max_pages]

    def _score_official_site_content_candidate(
        self,
        *,
        content_text: str,
        raw_html: Optional[str],
        hypothesis_category: str,
        url: str,
    ) -> Tuple[float, Optional[str]]:
        text = str(content_text or "")
        reason = self._assess_low_yield_content(
            content_text=text,
            raw_html=raw_html,
            hypothesis_category=hypothesis_category,
        )

        score = 0.0
        if reason is None:
            score += 45.0
        else:
            score -= 20.0

        score += min(len(text), 6000) / 120.0

        lower_text = text.lower()
        keywords_by_category = {
            "procurement": ["procurement", "tender", "rfp", "vendor", "supplier"],
            "analytics": ["analytics", "data", "platform", "integration", "roadmap"],
            "member": ["member", "engagement", "crm", "portal", "digital"],
        }
        category_key = str(hypothesis_category or "").lower().strip()
        keywords = keywords_by_category.get(category_key, ["digital", "platform", "strategy"])
        keyword_hits = sum(1 for keyword in keywords if keyword in lower_text)
        score += min(keyword_hits, 8) * 3.0

        lowered_url = str(url or "").lower()
        if any(token in lowered_url for token in ("/about", "/news", "/press", "/careers", "/jobs")):
            score += 2.0
        if any(token in lowered_url for token in ("/shop", "/store", "/tickets")):
            score -= 6.0

        return score, reason

    async def _apply_official_site_multi_page_sweep(
        self,
        *,
        initial_url: str,
        initial_content_result: Dict[str, Any],
        hypothesis,
    ) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
        candidates = self._build_official_site_sweep_candidates(initial_url)
        if not candidates:
            return initial_url, initial_content_result, {
                "enabled": True,
                "applied": False,
                "attempted_urls": [],
                "selected_url": initial_url,
            }

        attempted_urls: List[str] = []

        initial_content = str(initial_content_result.get("content") or "")
        best_url = initial_url
        best_result = initial_content_result
        best_score, initial_reason = self._score_official_site_content_candidate(
            content_text=initial_content,
            raw_html=initial_content_result.get("raw_html"),
            hypothesis_category=getattr(hypothesis, "category", ""),
            url=initial_url,
        )
        baseline_score = best_score
        attempted_urls.append(initial_url)

        scrape_timeout = float(getattr(self, "official_site_sweep_scrape_timeout_seconds", 10.0) or 10.0)

        for candidate_url in candidates:
            if candidate_url == initial_url:
                continue
            attempted_urls.append(candidate_url)
            try:
                candidate_result = await asyncio.wait_for(
                    self.brightdata_client.scrape_as_markdown(candidate_url),
                    timeout=scrape_timeout,
                )
            except asyncio.TimeoutError:
                continue
            except Exception:  # noqa: BLE001
                continue

            if not isinstance(candidate_result, dict) or candidate_result.get("status") != "success":
                continue

            candidate_content = str(candidate_result.get("content") or "")
            if not candidate_content.strip():
                continue

            score, _ = self._score_official_site_content_candidate(
                content_text=candidate_content,
                raw_html=candidate_result.get("raw_html"),
                hypothesis_category=getattr(hypothesis, "category", ""),
                url=candidate_url,
            )
            if score > best_score:
                best_score = score
                best_url = candidate_url
                best_result = candidate_result

            if isinstance(getattr(self, "_official_site_content_cache", None), dict):
                self._official_site_content_cache[candidate_url] = candidate_result

        return best_url, best_result, {
            "enabled": True,
            "applied": best_url != initial_url,
            "attempted_urls": attempted_urls,
            "selected_url": best_url,
            "baseline_score": round(baseline_score, 3),
            "selected_score": round(best_score, 3),
            "initial_low_yield_reason": initial_reason,
        }

    def _recover_strict_no_progress_from_narrative(self, response_text: str) -> Optional[Dict[str, Any]]:
        text = str(response_text or "").strip().lower()
        if not text:
            return None

        markers = (
            "no relevant evidence",
            "doesn't indicate",
            "does not indicate",
            "no procurement activity",
            "not enough evidence",
            "insufficient evidence",
            "mostly navigation",
            "promotional content",
            "no clear signal",
            "no rfp",
        )
        if not any(marker in text for marker in markers):
            # Common strict-mode narrative pattern from evaluator models:
            # checklist blocks with repeated "<indicator>: NOT FOUND" lines.
            not_found_count = 0
            for raw_line in str(response_text or "").splitlines():
                line = str(raw_line or "").strip().lower()
                if ":" in line and "not found" in line:
                    not_found_count += 1
            if not_found_count < 3:
                return None

        return {
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "justification": "Recovered NO_PROGRESS from strict narrative response",
            "evidence_found": "",
            "evidence_type": "strict_text_no_progress_recovery",
            "temporal_score": "unknown",
            "parse_path": "text_no_progress_recovered",
        }

    def _recover_strict_from_truncated_json_prefix(self, response_text: str) -> Optional[Dict[str, Any]]:
        text = str(response_text or "").strip()
        if not text:
            return None
        if not text.lstrip().startswith("{"):
            return None

        decision_match = re.search(
            r'(?is)"?decision"?\s*:\s*"?(ACCEPT|WEAK_ACCEPT|REJECT|NO_PROGRESS)',
            text,
        )
        if not decision_match:
            return None
        decision = decision_match.group(1).upper()
        if decision not in {"ACCEPT", "WEAK_ACCEPT", "REJECT", "NO_PROGRESS"}:
            return None

        confidence_delta = 0.0
        confidence_match = re.search(r'(?is)"?confidence_delta"?\s*:\s*(-?\d+(?:\.\d+)?)', text)
        if confidence_match:
            try:
                confidence_delta = float(confidence_match.group(1))
            except Exception:  # noqa: BLE001
                confidence_delta = 0.0
        elif decision == "ACCEPT":
            confidence_delta = 0.06

        return {
            "decision": decision,
            "confidence_delta": confidence_delta,
            "justification": "Recovered decision from truncated JSON prefix",
            "evidence_found": "",
            "evidence_type": "strict_truncated_json_recovery",
            "temporal_score": "unknown",
            "parse_path": "json_truncated_recovered",
        }

    def _extract_deterministic_trusted_signal(
        self,
        *,
        content_text: str,
        hop_type: HopType,
    ) -> Optional[Dict[str, str]]:
        text = str(content_text or "")
        lowered = text.lower()
        if not lowered:
            return None

        procurement_terms = {
            "procurement", "tender", "rfp", "supplier", "vendor", "commercial partner",
            "partnership", "implementation", "rollout", "contract",
        }
        careers_terms = {"careers", "vacancies", "job", "hiring", "apply now"}
        hiring_signal_terms = {
            "procurement manager", "commercial manager", "head of procurement", "digital",
            "manager", "director", "officer", "specialist", "engineer", "analyst",
        }

        def _first_evidence_line(term_set: set[str]) -> Optional[str]:
            for line in text.splitlines():
                line_clean = line.strip()
                if not line_clean:
                    continue
                ll = line_clean.lower()
                if any(term in ll for term in term_set):
                    return line_clean[:220]
            return None

        if hop_type == HopType.CAREERS_PAGE:
            careers_line = _first_evidence_line(careers_terms)
            hiring_line = _first_evidence_line(hiring_signal_terms)
            if careers_line and (hiring_line or len(text) > 600):
                return {
                    "justification": "Careers page includes hiring signals aligned to procurement or digital delivery.",
                    "evidence_found": f"{careers_line} | {(hiring_line or 'role listings present')}",
                    "evidence_type": "deterministic_careers_signal",
                }
            return None

        if hop_type in {HopType.OFFICIAL_SITE, HopType.PRESS_RELEASE, HopType.ANNUAL_REPORT}:
            evidence_line = _first_evidence_line(procurement_terms)
            if evidence_line:
                return {
                    "justification": "Trusted-source content contains explicit procurement/commercial delivery language.",
                    "evidence_found": evidence_line,
                    "evidence_type": "deterministic_trusted_source_signal",
                }

        return None

    def _decorate_evaluation_result(
        self,
        result: Dict[str, Any],
        *,
        evaluation_mode: str,
    ) -> Dict[str, Any]:
        output = dict(result)
        diag = dict(getattr(self, "_llm_runtime_diagnostics", {}) or {})
        output["evaluation_mode"] = evaluation_mode
        output["llm_provider"] = diag.get("llm_provider")
        output["llm_retry_attempts"] = diag.get("llm_retry_attempts", 0)
        output["llm_last_status"] = diag.get("llm_last_status", "unknown")
        output["llm_circuit_broken"] = bool(diag.get("llm_circuit_broken", False))
        output["llm_disable_reason"] = diag.get("llm_disable_reason")
        output["parse_path"] = output.get("parse_path") or self._map_status_to_parse_path(diag.get("llm_last_status"))
        output["run_profile"] = diag.get("run_profile")
        output["run_mode"] = diag.get("run_mode")
        return output

    async def _query_evaluator_model(
        self,
        *,
        prompt: str,
        max_tokens: int,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
    ) -> Dict[str, Any]:
        """Query evaluator model with compatibility fallback for minimal stubs."""
        query_fn = getattr(getattr(self, "claude_client", None), "query", None)
        if not callable(query_fn):
            raise RuntimeError("Claude client query method is unavailable")

        timeout_seconds = float(getattr(self, "evaluation_query_timeout_seconds", 30.0) or 30.0)
        if timeout_seconds <= 0:
            timeout_seconds = 30.0
        timeout_max_retries = max(0, int(getattr(self, "evaluation_timeout_max_retries", 2) or 0))
        timeout_backoff_seconds = max(
            0.0,
            float(getattr(self, "evaluation_timeout_retry_backoff_seconds", 1.5) or 0.0),
        )
        timeout_backoff_cap_seconds = max(
            0.0,
            float(getattr(self, "evaluation_timeout_retry_backoff_cap_seconds", 8.0) or 0.0),
        )
        timeout_jitter_seconds = max(
            0.0,
            float(getattr(self, "evaluation_timeout_retry_jitter_seconds", 0.35) or 0.0),
        )
        total_attempts = timeout_max_retries + 1

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
                    model="haiku",
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
                        model="haiku",
                        max_tokens=max_tokens,
                    )
                    return await _await_query(fallback_coro)
                raise

        for attempt_idx in range(total_attempts):
            try:
                return await _invoke_once()
            except TimeoutError:
                is_final_attempt = attempt_idx >= (total_attempts - 1)
                if is_final_attempt:
                    raise
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

    def _extract_structured_evaluation_payload(self, response: Any) -> Optional[Dict[str, Any]]:
        """Prefer provider-native structured output payloads when available."""
        if not isinstance(response, dict):
            return None

        payload = response.get("structured_output")
        normalized = None
        if isinstance(payload, dict):
            normalized = self._normalize_evaluator_payload(payload)
        elif isinstance(payload, str) and payload.strip():
            normalized = self._parse_evaluation_response_json(payload)

        if normalized is None:
            return None

        normalized = dict(normalized)
        normalized["parse_path"] = normalized.get("parse_path") or "structured_output"
        return normalized

    @staticmethod
    def _extract_balanced_json_object(text: str, *, required_key: str = "decision") -> Optional[Dict[str, Any]]:
        """Extract and parse the first balanced JSON object containing required_key."""
        if not isinstance(text, str) or not text:
            return None

        key_token = f'"{required_key}"'
        starts = [idx for idx, ch in enumerate(text) if ch == "{"] if "{" in text else []
        for start in starts:
            depth = 0
            in_string = False
            escape = False
            for idx in range(start, len(text)):
                ch = text[idx]
                if in_string:
                    if escape:
                        escape = False
                    elif ch == "\\":
                        escape = True
                    elif ch == '"':
                        in_string = False
                    continue

                if ch == '"':
                    in_string = True
                    continue
                if ch == "{":
                    depth += 1
                    continue
                if ch == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = text[start : idx + 1]
                        if key_token not in candidate:
                            break
                        try:
                            parsed = json.loads(candidate)
                        except Exception:  # noqa: BLE001
                            break
                        if isinstance(parsed, dict) and required_key in parsed:
                            return parsed
                        break
        return None

    @staticmethod
    def _normalize_evaluator_payload(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None

        decision = str(payload.get("decision") or "").strip().upper()
        if decision not in {"ACCEPT", "WEAK_ACCEPT", "REJECT", "NO_PROGRESS"}:
            return None

        confidence_raw = payload.get("confidence_delta", 0.0)
        try:
            confidence_delta = float(confidence_raw)
        except Exception:  # noqa: BLE001
            confidence_delta = 0.0

        return {
            "decision": decision,
            "confidence_delta": confidence_delta,
            "justification": str(payload.get("justification") or "").strip() or "Recovered evaluator payload",
            "evidence_found": str(payload.get("evidence_found") or "").strip(),
            "evidence_type": str(payload.get("evidence_type") or "").strip() or "unknown",
            "temporal_score": str(payload.get("temporal_score") or "").strip() or "unknown",
        }

    def _salvage_almost_json_object(self, response_text: str) -> Optional[Dict[str, Any]]:
        if not isinstance(response_text, str) or not response_text.strip():
            return None

        start_index = response_text.find("{")
        if start_index < 0:
            return None

        candidate = response_text[start_index:]
        last_close_index = candidate.rfind("}")
        if last_close_index >= 0:
            candidate = candidate[: last_close_index + 1]

        # Repair common LLM issues: dangling commas and missing closing braces.
        candidate = re.sub(r",(\s*[}\]])", r"\1", candidate)
        open_count = candidate.count("{")
        close_count = candidate.count("}")
        if open_count > close_count:
            candidate = f"{candidate}{'}' * (open_count - close_count)}"
        candidate = re.sub(r",(\s*[}\]])", r"\1", candidate)

        direct = self._extract_balanced_json_object(candidate, required_key="decision")
        normalized = self._normalize_evaluator_payload(direct) if direct else None
        if normalized:
            return normalized

        try:
            loaded = json.loads(candidate)
        except Exception:  # noqa: BLE001
            return None
        return self._normalize_evaluator_payload(loaded)

    def _parse_evaluation_response_json(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Parse evaluator JSON from plain text, fenced blocks, or mixed responses."""
        self._last_parse_path = None
        if not isinstance(response_text, str):
            return None

        direct = self._extract_balanced_json_object(response_text, required_key="decision")
        normalized_direct = self._normalize_evaluator_payload(direct) if direct else None
        if normalized_direct:
            self._last_parse_path = "json_direct"
            return normalized_direct

        import re

        fenced_blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", response_text, flags=re.IGNORECASE)
        for block in fenced_blocks:
            parsed = self._extract_balanced_json_object(block, required_key="decision")
            normalized_fenced = self._normalize_evaluator_payload(parsed) if parsed else None
            if normalized_fenced:
                self._last_parse_path = "json_fenced"
                return normalized_fenced

        key_value_payload = self._extract_evaluation_key_value_payload(response_text)
        if key_value_payload:
            self._last_parse_path = "key_value_recovered"
            return key_value_payload

        salvaged_payload = self._salvage_almost_json_object(response_text)
        if salvaged_payload:
            self._last_parse_path = "json_salvaged"
            return salvaged_payload

        return None

    def _extract_evaluation_key_value_payload(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Recover evaluator payload from strict key:value lines when JSON formatting is missing."""
        if not isinstance(response_text, str) or not response_text.strip():
            return None

        import re

        required_keys = (
            "decision",
            "confidence_delta",
            "justification",
            "evidence_found",
            "evidence_type",
            "temporal_score",
        )
        multiline_keys = {"justification", "evidence_found"}

        values: Dict[str, str] = {}
        active_key: Optional[str] = None

        for raw_line in response_text.splitlines():
            line = str(raw_line or "").strip()
            if not line:
                continue

            match = re.match(
                r'^[\-\*\u2022]?\s*"?([a-z_]+)"?\s*[:=]\s*(.+?)\s*$',
                line,
                flags=re.IGNORECASE,
            )
            if match:
                key = str(match.group(1) or "").strip().lower()
                if key in required_keys:
                    raw_value = str(match.group(2) or "").strip()
                    cleaned = raw_value.strip("`").strip()
                    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
                        cleaned = cleaned[1:-1].strip()
                    values[key] = cleaned
                    active_key = key
                else:
                    active_key = None
                continue

            if active_key in multiline_keys:
                values[active_key] = f"{values.get(active_key, '').strip()} {line}".strip()

        minimal_required_keys = ("decision", "confidence_delta")
        if not all(values.get(key) for key in minimal_required_keys):
            return None

        decision = str(values.get("decision") or "").strip().upper()
        if decision not in {"ACCEPT", "WEAK_ACCEPT", "REJECT", "NO_PROGRESS"}:
            return None

        confidence_text = str(values.get("confidence_delta") or "").strip()
        number_match = re.search(r"-?\d+(?:\.\d+)?", confidence_text)
        if not number_match:
            return None
        try:
            confidence_delta = float(number_match.group(0))
        except Exception:  # noqa: BLE001
            return None

        temporal_score = str(values.get("temporal_score") or "").strip() or "unknown"
        justification = str(values.get("justification") or "").strip() or "Recovered structured key-value response"
        evidence_found = str(values.get("evidence_found") or "").strip()
        evidence_type = str(values.get("evidence_type") or "").strip() or "unknown"

        return {
            "decision": decision,
            "confidence_delta": confidence_delta,
            "justification": justification,
            "evidence_found": evidence_found,
            "evidence_type": evidence_type,
            "temporal_score": temporal_score,
        }
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
        encyclopedia_domains = {
            "wikipedia.org", "wikidata.org", "britannica.com",
        }
        job_aggregator_domains = {
            "indeed.", "glassdoor.", "totaljobs.", "reed.co.uk", "ziprecruiter.",
            "monster.", "simplyhired.", "jobsora.", "jobrapido.", "adzuna.",
        }

        if any(marker in host for marker in trusted_domain_markers):
            score += 0.2
        if any(domain in host for domain in low_quality_domains):
            score -= 0.5

        # Source-priority shaping for discovery quality:
        # prefer entity/official/procurement sources over encyclopedic and aggregator pages.
        if any(domain in host for domain in encyclopedia_domains):
            if hop_type in {HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE, HopType.OFFICIAL_SITE, HopType.DOCUMENT}:
                score -= 0.8
            else:
                score -= 0.35

        if any(domain in host for domain in job_aggregator_domains):
            if hop_type == HopType.CAREERS_PAGE:
                score -= 0.2
            elif hop_type in {HopType.RFP_PAGE, HopType.TENDERS_PAGE, HopType.PROCUREMENT_PAGE, HopType.DOCUMENT, HopType.OFFICIAL_SITE}:
                score -= 0.9
            else:
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

        template_id = resolve_template_id(template_id, getattr(self, "current_entity_type", None))
        # Entity runs must not inherit official-site context from prior entities.
        self.current_official_site_url = None
        self._resolved_url_context = {}
        self._update_llm_runtime_diagnostics(
            run_mode=self._current_run_mode(),
            run_profile=str(os.getenv("DISCOVERY_PROFILE", "continuous") or "continuous").strip().lower(),
        )
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
        content_result: Dict[str, Any] = {}

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
                    candidate_record["brightdata"] = self._extract_brightdata_trace(content_result)

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
                performance['brightdata_scrape'] = self._extract_brightdata_trace(content_result)

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

    def _extract_brightdata_trace(self, payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        return {
            "status": payload.get("status"),
            "error": payload.get("error"),
            "source": metadata.get("source"),
            "zone": metadata.get("zone"),
            "endpoint": metadata.get("endpoint"),
            "extraction_mode": metadata.get("extraction_mode"),
        }

    def _get_fallback_queries(self, hop_type: HopType, entity_name: str) -> list[str]:
        """
        Get fallback search queries for a hop type

        Args:
            hop_type: Type of hop to execute
            entity_name: Name of entity to search for

        Returns:
            List of fallback query strings
        """
        queries = [q.format(entity=entity_name) for q in FALLBACK_QUERIES.get(hop_type, [])]
        if hop_type == HopType.OFFICIAL_SITE:
            for domain in self._build_entity_domain_candidates(entity_name):
                queries.extend(
                    [
                        f'site:{domain} "{entity_name}"',
                        f'site:{domain} "{entity_name}" procurement',
                        f'site:{domain} "{entity_name}" vacancies',
                        f'site:{domain} "{entity_name}" news',
                        f'site:{domain}/news "{entity_name}"',
                        f'site:{domain}/careers "{entity_name}"',
                        f'site:{domain}/about "{entity_name}"',
                    ]
                )
        # Deduplicate while preserving order.
        return list(dict.fromkeys([q for q in queries if q]))

    def _build_entity_domain_candidates(self, entity_name: str) -> List[str]:
        tokens = [part for part in re.split(r"[\s\-_/]+", str(entity_name or "").lower()) if part]
        if not tokens:
            return []
        slug = "".join(ch for ch in "".join(tokens) if ch.isalnum())
        initials = "".join(part[0] for part in tokens if part and part[0].isalnum())
        domains: List[str] = []
        if len(initials) >= 3:
            domains.extend([f"{initials}.co.uk", f"{initials}.com"])
        if slug:
            domains.extend([f"{slug}.com", f"{slug}.co.uk"])
            if len(tokens) >= 2:
                joined_hyphen = "-".join(tokens)
                domains.extend([f"{joined_hyphen}.com", f"{joined_hyphen}.co.uk"])
        return list(dict.fromkeys(domains))

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

    def _cache_resolved_url_context(self, url: Optional[str], result: Optional[Dict[str, Any]]) -> None:
        """Cache lightweight search context (title/snippet) for resolved URLs."""
        if not url or not isinstance(result, dict):
            return
        title = str(result.get("title") or "").strip()
        snippet = str(result.get("snippet") or "").strip()
        if not title and not snippet:
            return
        self._resolved_url_context[url] = {"title": title, "snippet": snippet}

    async def _resolve_official_site_url(self, entity_name: str) -> Optional[str]:
        started_at = time.perf_counter()
        lane_trace: List[Dict[str, Any]] = []

        def _record_lane(lane: str, status: str, **details: Any) -> None:
            lane_trace.append(
                {
                    "lane": lane,
                    "status": status,
                    "details": details,
                }
            )

        known_official_url = self._normalize_http_url(getattr(self, "current_official_site_url", None))
        if known_official_url:
            self.current_official_site_url = known_official_url
            _record_lane("memory:current_official_site", "hit", url=known_official_url)
            self._store_official_site_resolution_trace(entity_name, lane_trace, started_at)
            return known_official_url

        cached_url = self._get_cached_official_site_url(entity_name)
        if cached_url:
            self.current_official_site_url = cached_url
            _record_lane("memory:persistent_cache", "hit", url=cached_url)
            self._store_official_site_resolution_trace(entity_name, lane_trace, started_at)
            return cached_url

        mapped_url = self._get_mapped_official_site_url(entity_name)
        if mapped_url:
            self.current_official_site_url = mapped_url
            self._store_cached_official_site_url(entity_name, mapped_url)
            logger.info("♻️ Reusing mapped official-site URL for %s: %s", entity_name, mapped_url)
            _record_lane("memory:domain_map", "hit", url=mapped_url)
            self._store_official_site_resolution_trace(entity_name, lane_trace, started_at)
            return mapped_url

        if self._is_official_site_resolution_in_cooldown(entity_name):
            logger.info(
                "⏭️ Skipping official-site search due to active cooldown for %s",
                entity_name,
            )
            _record_lane("guard:cooldown", "skipped")
            self._store_official_site_resolution_trace(entity_name, lane_trace, started_at)
            return None

        search_query = f'"{entity_name}" official website'
        engines = getattr(self, "official_site_resolution_engines", None) or ["google"]
        num_results = int(getattr(self, "official_site_resolution_num_results", 1) or 1)
        best_result = None
        best_score = -1.0

        engine_tasks = {
            engine: asyncio.create_task(
                self._search_engine_with_timeout(
                    query=search_query,
                    engine=engine,
                    num_results=num_results,
                )
            )
            for engine in engines
        }
        engine_results = await asyncio.gather(*engine_tasks.values(), return_exceptions=True)

        for engine, result in zip(engine_tasks.keys(), engine_results):
            lane_name = f"search:{engine}"
            if isinstance(result, Exception):
                _record_lane(lane_name, "error", error=str(result))
                continue

            if result.get("status") != "success":
                _record_lane(lane_name, "miss", error=result.get("error", "search_failed"))
                continue

            candidates = result.get("results", []) or []
            ranked_candidates = rank_official_site_candidates(
                entity_name=entity_name,
                candidates=candidates,
                max_candidates=num_results,
            )
            if not ranked_candidates:
                _record_lane(lane_name, "miss", reason="no_valid_candidates")
                continue

            lane_best = ranked_candidates[0]
            lane_best_url = self._normalize_http_url(lane_best.get("url"))
            if not lane_best_url:
                _record_lane(lane_name, "miss", reason="unusable_top_candidate")
                continue

            lane_best_score = float(lane_best.get("score", -1.0))
            lane_best_payload = {
                "url": lane_best_url,
                "title": lane_best.get("title", ""),
                "snippet": lane_best.get("snippet", ""),
                "resolver_reasons": lane_best.get("reasons", []),
            }
            _record_lane(
                lane_name,
                "hit",
                url=lane_best_url,
                score=round(lane_best_score, 3),
                reasons=lane_best.get("reasons", []),
            )
            if lane_best_score > best_score:
                best_score = lane_best_score
                best_result = lane_best_payload

        if not best_result:
            self._mark_official_site_resolution_failure(entity_name)
            self._store_official_site_resolution_trace(entity_name, lane_trace, started_at)
            return None

        resolved_url = self._normalize_http_url(best_result.get('url'))
        if resolved_url:
            self._cache_resolved_url_context(resolved_url, best_result)
            self.current_official_site_url = resolved_url
            self._store_cached_official_site_url(entity_name, resolved_url)
            failures = getattr(self, "_official_site_resolution_failures", None)
            if isinstance(failures, dict):
                failures.pop(self._normalize_entity_cache_key(entity_name), None)
            _record_lane("selection:best_candidate", "selected", url=resolved_url, score=round(best_score, 3))
            self._store_official_site_resolution_trace(entity_name, lane_trace, started_at)
        return resolved_url

    def _store_official_site_resolution_trace(
        self,
        entity_name: str,
        trace: List[Dict[str, Any]],
        started_at: float,
    ) -> None:
        lane_statuses: Dict[str, str] = {}
        selected_url: Optional[str] = None
        selected_score: Optional[float] = None
        for entry in trace:
            lane = str(entry.get("lane") or "").strip()
            status = str(entry.get("status") or "").strip()
            details = entry.get("details") if isinstance(entry.get("details"), dict) else {}
            if lane:
                lane_statuses[lane] = status
            if lane == "selection:best_candidate":
                selected_url = self._normalize_http_url(details.get("url"))
                score_value = details.get("score")
                if isinstance(score_value, (int, float)):
                    selected_score = float(score_value)

        if not selected_url:
            for entry in trace:
                details = entry.get("details") if isinstance(entry.get("details"), dict) else {}
                candidate_url = self._normalize_http_url(details.get("url"))
                if candidate_url:
                    selected_url = candidate_url
                    break

        payload = {
            "entity_name": entity_name,
            "run_mode": self._current_run_mode(),
            "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            "trace": trace,
            "lane_statuses": lane_statuses,
            "selected_url": selected_url,
            "selected_score": round(selected_score, 3) if isinstance(selected_score, float) else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._last_official_site_resolution_trace = list(trace)
        log_store = getattr(self, "_official_site_resolution_trace_log", None)
        if not isinstance(log_store, list):
            log_store = []
            self._official_site_resolution_trace_log = log_store
        log_store.append(payload)
        trace_limit = int(getattr(self, "official_site_resolution_trace_limit", 200))
        if len(log_store) > trace_limit:
            del log_store[:-trace_limit]

    async def _try_direct_site_paths(
        self,
        base_url: str,
        hop_type: HopType,
    ) -> Optional[str]:
        from urllib.parse import urlparse

        parsed = urlparse(base_url)
        if not parsed.scheme or not parsed.netloc:
            return None

        entity_type = getattr(self, "current_entity_type", None)
        shortcuts = get_site_path_shortcuts(entity_type, hop_type.value)
        if not shortcuts:
            return None

        base_origin = f"{parsed.scheme}://{parsed.netloc}"
        content_markers = {
            HopType.TENDERS_PAGE: ["tender", "procurement", "request for proposal", "vendor"],
            HopType.PROCUREMENT_PAGE: ["procurement", "supplier", "vendor", "purchasing"],
            HopType.PRESS_RELEASE: ["news", "press", "announcement", "media"],
            HopType.DOCUMENT: ["document", "pdf", "resource", "download"],
            HopType.OFFICIAL_SITE: ["about", "federation", "official", "organisation"],
        }
        expected_markers = content_markers.get(hop_type, [])

        for path in shortcuts:
            candidate_url = f"{base_origin}{path}" if path != "/" else f"{base_origin}/"
            try:
                check_result = await self.brightdata_client.scrape_as_markdown(candidate_url)
            except Exception as exc:
                logger.debug("Direct path check failed for %s: %s", candidate_url, exc)
                continue

            if check_result.get('status') != 'success':
                continue

            content = str(check_result.get('content') or "").lower()
            if not expected_markers or any(marker in content for marker in expected_markers):
                logger.info("✅ Direct site path matched for %s: %s", hop_type.value, candidate_url)
                return candidate_url

        return None
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
            'site_specific_attempted': False,
            'search_diagnostics': [],
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
            HopType.OFFICIAL_SITE: f'"{entity_name}" official website news careers procurement',
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
            self._append_search_diagnostic(metrics, engine, primary_query, search_result, stage="primary")

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

        if hop_type == HopType.OFFICIAL_SITE:
            logger.warning(
                "⚠️ Official-site primary search failed; skipping fallback query loop to preserve timeout budget"
            )
            metrics['total_duration_ms'] = round((time.perf_counter() - search_started_at) * 1000, 2)
            self._last_url_resolution_metrics = {
                **metrics,
                'search_calls_ms': round(metrics['search_calls_ms'], 2),
                'validation_ms': round(metrics['validation_ms'], 2)
            }
            return None

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
                self._append_search_diagnostic(metrics, engine, fallback_query, search_result, stage="fallback")

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

    def _append_search_diagnostic(
        self,
        metrics: Dict[str, Any],
        engine: str,
        query: str,
        search_result: Dict[str, Any],
        *,
        stage: str,
    ) -> None:
        diagnostics = metrics.setdefault("search_diagnostics", [])
        metadata = (search_result or {}).get("metadata", {}) if isinstance(search_result, dict) else {}
        diagnostics.append(
            {
                "stage": stage,
                "engine": engine,
                "query": query,
                "status": (search_result or {}).get("status"),
                "result_count": len((search_result or {}).get("results") or []),
                "error": (search_result or {}).get("error"),
                "source": metadata.get("source"),
                "zone": metadata.get("zone"),
                "endpoint": metadata.get("endpoint"),
            }
        )

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

    async def _search_engine_with_timeout(
        self,
        *,
        query: str,
        engine: str,
        num_results: int,
    ) -> Dict[str, Any]:
        try:
            return await asyncio.wait_for(
                self.brightdata_client.search_engine(
                    query=query,
                    engine=engine,
                    num_results=num_results,
                ),
                timeout=getattr(self, "search_timeout_seconds", 12.0),
            )
        except asyncio.TimeoutError:
            logger.warning(
                "⚠️ Search timed out after %.1fs (engine=%s, query=%s)",
                getattr(self, "search_timeout_seconds", 12.0),
                engine,
                query,
            )
            return {"status": "error", "error": "Search timeout", "results": []}

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
        *,
        content: str,
        context: EvaluationContext,
        mcp_matches: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Deterministic backup classifier when evaluator output is invalid/non-JSON."""
        return self._extract_evidence_pack(content, context, mcp_matches)

    def _fallback_result_with_reason(
        self,
        reason: str,
        *,
        content: Optional[str] = None,
        hop_type: Optional[HopType] = None,
        context: Optional[EvaluationContext] = None,
    ) -> Dict[str, Any]:
        heuristic = self._heuristic_result_from_content(
            content=content,
            hop_type=hop_type,
            context=context,
            fallback_reason=reason,
        )
        if heuristic is not None:
            return heuristic

        result = self._fallback_result()
        result['justification'] = reason
        return result

    def _heuristic_result_from_content(
        self,
        *,
        content: Optional[str],
        hop_type: Optional[HopType],
        context: Optional[EvaluationContext],
        fallback_reason: str,
    ) -> Optional[Dict[str, Any]]:
        """Fallback evaluator for cases where model output is unavailable."""
        if not content or not context or not hop_type:
            return None

        lines = [line.strip() for line in str(content).splitlines() if line.strip()]
        if not lines:
            return None

        candidates: List[str] = []
        candidates.extend(str(k).strip().lower() for k in (context.keywords or []) if str(k).strip())
        candidates.extend(str(i).strip().lower() for i in (context.early_indicators or []) if str(i).strip())
        candidates.extend(
            [
                "rfp",
                "request for proposal",
                "procurement",
                "tender",
                "vendor",
                "supplier",
                "digital",
                "platform",
                "transformation",
                "partnership",
                "career",
                "careers",
                "vacancy",
                "vacancies",
                "job",
                "hiring",
            ]
        )

        matches: List[str] = []
        evidence_line = ""
        for line in lines:
            line_lower = line.lower()
            line_matches = [keyword for keyword in candidates if keyword and keyword in line_lower]
            if not line_matches:
                continue
            if not evidence_line:
                evidence_line = line
            for keyword in line_matches:
                if keyword not in matches:
                    matches.append(keyword)
            if len(matches) >= 4:
                break

        if not matches:
            return None

        strong_signal_keywords = {
            "procurement",
            "tender",
            "rfp",
            "request for proposal",
            "vendor",
            "supplier",
            "career",
            "careers",
            "vacancy",
            "vacancies",
            "job",
            "hiring",
        }
        if not any(keyword in strong_signal_keywords for keyword in matches):
            return None

        confidence_delta = min(0.06, 0.02 * len(matches))
        return {
            'decision': 'WEAK_ACCEPT',
            'confidence_delta': round(confidence_delta, 3),
            'justification': f"{fallback_reason}; heuristic keyword evidence used",
            'evidence_found': evidence_line,
            'evidence_type': 'heuristic_keyword_fallback',
            'temporal_score': 'unknown',
            'heuristic_matches': matches[:5],
        }

    def _extract_evidence_pack(
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

            structured_result = self._extract_structured_evaluation_payload(response)
            if structured_result is not None:
                structured_result = self._normalize_evaluator_result(structured_result)
                is_valid, schema_reason = self._validate_evaluator_schema(structured_result)
                if not is_valid:
                    self._update_llm_runtime_diagnostics(
                        llm_last_status=f"schema_gate_fail:{schema_reason}",
                        evaluation_mode="heuristic",
                    )
                    fallback = self._deterministic_fallback_classification(
                        content=content,
                        context=context,
                        mcp_matches=mcp_matches,
                    )
                    fallback["parse_path"] = "schema_gate_deterministic_fallback"
                    return self._decorate_evaluation_result(fallback, evaluation_mode="heuristic")
                self._update_llm_runtime_diagnostics(
                    llm_last_status="structured_payload",
                    evaluation_mode="llm",
                )
                if mcp_matches and structured_result.get('confidence_delta', 0) == 0.0:
                    try:
                        from backend.confidence.mcp_scorer import calculate_mcp_confidence_from_matches
                    except ImportError:
                        from confidence.mcp_scorer import calculate_mcp_confidence_from_matches
                    mcp_confidence = calculate_mcp_confidence_from_matches(mcp_matches)
                    structured_result['confidence_delta'] = max(0.0, mcp_confidence - 0.70)
                    structured_result['mcp_matches'] = mcp_matches
                    structured_result['mcp_confidence'] = mcp_confidence
                return self._decorate_evaluation_result(structured_result, evaluation_mode="llm")

            # Extract text from response
            # ClaudeClient.query() returns 'content' key, not 'text'
            response_text = response.get('content', '') or response.get('text', '')
            if not str(response_text or "").strip():
                logger.info("Claude evaluation returned empty response; using heuristic fallback")
                fallback = self._fallback_result_with_reason(
                    "Empty model response",
                    content=content,
                    hop_type=hop_type,
                    context=context,
                )
                self._update_llm_runtime_diagnostics(
                    llm_last_status="empty_response",
                    evaluation_mode="heuristic",
                )
                return self._decorate_evaluation_result(fallback, evaluation_mode="heuristic")

            # Parse JSON response (existing code)
            import re

            result = self._parse_evaluation_response_json(response_text)
            if result:
                result = self._normalize_evaluator_result(result)
                is_valid, schema_reason = self._validate_evaluator_schema(result)
                if not is_valid:
                    result = None
                    logger.warning(f"Evaluator schema gate rejected parsed payload: {schema_reason}")

            if not result:
                repaired = await self._attempt_json_repair_pass(str(response_text or ""))
                if repaired:
                    repaired = self._normalize_evaluator_result(repaired)
                    is_valid, schema_reason = self._validate_evaluator_schema(repaired)
                    if is_valid:
                        result = repaired
                        self._update_llm_runtime_diagnostics(
                            llm_last_status="schema_repair_recovered",
                            evaluation_mode="llm",
                        )
                    else:
                        logger.warning(f"Evaluator schema gate rejected repaired payload: {schema_reason}")

            if not result:
                if low_signal_content:
                    fallback = {
                        'decision': 'NO_PROGRESS',
                        'confidence_delta': 0.0,
                        'justification': 'Low-signal page content (navigation/error shell) yielded no procurement evidence',
                        'evidence_found': '',
                        'evidence_type': 'low_signal_content',
                        'temporal_score': 'older',
                        'parse_path': 'schema_gate_low_signal',
                    }
                else:
                    fallback = self._deterministic_fallback_classification(
                        content=content,
                        context=context,
                        mcp_matches=mcp_matches,
                    )
                    fallback["parse_path"] = "schema_gate_deterministic_fallback"
                self._update_llm_runtime_diagnostics(
                    llm_last_status="schema_gate_fallback",
                    evaluation_mode="heuristic",
                )
                return self._decorate_evaluation_result(fallback, evaluation_mode="heuristic")

            if self._should_force_evidence_reask(result):
                try:
                    evidence_reask_prompt = (
                        "Your prior evaluator output is missing required evidence. "
                        "Return EXACT JSON with keys: decision, confidence_delta, justification, evidence_found, evidence_type, temporal_score. "
                        "Keep the same decision unless invalid. "
                        "Provide a specific quoted evidence snippet in `evidence_found` (8-240 chars). "
                        "Return only JSON."
                    )
                    evidence_response = await self._query_evaluator_model(
                        prompt=evidence_reask_prompt + "\n\nOriginal output:\n" + str(response_text or "")[:1800],
                        max_tokens=220,
                        system_prompt="Return one valid JSON object only.",
                        json_mode=True,
                        requested_model="haiku",
                    )
                    evidence_text = evidence_response.get('content', '') or evidence_response.get('text', '')
                    reask_result = self._parse_evaluation_response_json(str(evidence_text))
                    if reask_result:
                        reask_result = self._normalize_evaluator_result(reask_result)
                        is_valid, _ = self._validate_evaluator_schema(reask_result)
                        if is_valid:
                            result = reask_result
                except Exception:
                    pass

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

            if self._should_force_evidence_reask(result):
                return {
                    'decision': 'NO_PROGRESS',
                    'confidence_delta': 0.0,
                    'justification': 'Evaluator decision lacked minimum evidence payload after re-ask',
                    'evidence_found': '',
                    'evidence_type': 'missing_evidence_payload',
                    'temporal_score': result.get('temporal_score', 'unknown'),
                    'parse_path': 'evidence_payload_gate',
                }

            return result
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.debug(f"Response text that failed to parse: {response_text[:500]}")
            # Try to extract decision with simpler regex
            decision = self._extract_decision_token(str(response_text or ""))
            if decision:
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

    def _extract_evaluator_json(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Extract first valid evaluator JSON object containing a decision key."""
        if not isinstance(response_text, str) or not response_text.strip():
            return None

        candidate_blocks: List[str] = [response_text]

        # Prefer fenced json blocks when present.
        fenced = re.findall(r"```(?:json)?\s*(\{.*?\})\s*```", response_text, re.DOTALL | re.IGNORECASE)
        candidate_blocks = fenced + candidate_blocks if fenced else candidate_blocks

        decoder = json.JSONDecoder()
        for block in candidate_blocks:
            text = block.strip()
            for idx, ch in enumerate(text):
                if ch != "{":
                    continue
                try:
                    obj, _ = decoder.raw_decode(text[idx:])
                except Exception:
                    continue
                if isinstance(obj, dict) and "decision" in obj:
                    return obj
        return None

    def _normalize_evaluator_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(result or {})
        decision = str(normalized.get("decision", "")).strip().upper().replace("-", "_").replace(" ", "_")
        normalized["decision"] = decision
        try:
            normalized["confidence_delta"] = float(normalized.get("confidence_delta", 0.0))
        except Exception:
            normalized["confidence_delta"] = 0.0
        if "evidence_found" in normalized:
            normalized["evidence_found"] = str(normalized.get("evidence_found") or "").strip()
        if "justification" in normalized:
            normalized["justification"] = str(normalized.get("justification") or "").strip()
        normalized["evidence_type"] = str(normalized.get("evidence_type") or "").strip() or "unknown"
        normalized["temporal_score"] = str(normalized.get("temporal_score") or "").strip() or "unknown"
        return normalized

    def _validate_evaluator_schema(self, result: Optional[Dict[str, Any]]) -> Tuple[bool, str]:
        if not isinstance(result, dict):
            return False, "result_not_dict"
        required_keys = [
            "decision",
            "confidence_delta",
            "justification",
            "evidence_found",
            "evidence_type",
            "temporal_score",
        ]
        missing = [key for key in required_keys if key not in result]
        if missing:
            return False, f"missing_keys:{','.join(missing)}"
        decision = str(result.get("decision") or "").strip().upper()
        if decision not in {"ACCEPT", "WEAK_ACCEPT", "REJECT", "NO_PROGRESS"}:
            return False, "invalid_decision"
        try:
            float(result.get("confidence_delta"))
        except Exception:
            return False, "invalid_confidence_delta"
        return True, "ok"

    def _should_force_evidence_reask(self, result: Dict[str, Any]) -> bool:
        """
        Require a minimum evidence payload for positive decisions.
        """
        decision = str((result or {}).get("decision") or "").upper()
        if decision not in {"ACCEPT", "WEAK_ACCEPT"}:
            return False
        evidence = str((result or {}).get("evidence_found") or "").strip()
        return len(evidence) < 8

    def _extract_decision_token(self, response_text: str) -> Optional[str]:
        """Extract canonical decision token from free-form evaluator output."""
        if not isinstance(response_text, str) or not response_text.strip():
            return None

        text = response_text.upper()

        explicit_patterns = [
            r'DECISION["\']?\s*[:=]\s*["\']?(ACCEPT|WEAK[_\s-]*ACCEPT|REJECT|NO[_\s-]*PROGRESS)',
            r'\b(ACCEPT|WEAK[_\s-]*ACCEPT|REJECT|NO[_\s-]*PROGRESS)\b',
        ]
        for pattern in explicit_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if not match:
                continue
            token = re.sub(r'[\s-]+', '_', match.group(1).upper())
            token = token.replace("__", "_")
            if token in {"ACCEPT", "WEAK_ACCEPT", "REJECT", "NO_PROGRESS"}:
                return token

        # Last-resort semantic hints when explicit tokens are absent.
        if "INSUFFICIENT EVIDENCE" in text or "NO EVIDENCE" in text or "NO SIGNAL" in text:
            return "NO_PROGRESS"
        if "CONTRADICT" in text:
            return "REJECT"
        return None

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
        llm_diag = dict(getattr(self, "_llm_runtime_diagnostics", {}) or {})
        schema_metrics = dict(getattr(self, "_schema_metrics", {}) or {})
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
            'hop_timings': hop_records,
            'llm_provider': llm_diag.get('llm_provider'),
            'llm_retry_attempts': llm_diag.get('llm_retry_attempts', 0),
            'llm_last_status': llm_diag.get('llm_last_status'),
            'llm_circuit_broken': bool(llm_diag.get('llm_circuit_broken', False)),
            'llm_disable_reason': llm_diag.get('llm_disable_reason'),
            'evaluation_mode': llm_diag.get('evaluation_mode'),
            'run_profile': llm_diag.get('run_profile'),
            'run_mode': llm_diag.get('run_mode'),
            'official_site_resolution_traces': list(getattr(self, "_official_site_resolution_trace_log", [])[-20:]),
            'field_statuses': schema_metrics.get('field_statuses', {}),
            'claims_count': schema_metrics.get('claims_count', 0),
            'verified_fields_count': schema_metrics.get('verified_fields_count', 0),
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
