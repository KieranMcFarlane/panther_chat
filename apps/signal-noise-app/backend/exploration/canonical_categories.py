"""
Canonical Exploration Categories

Defines 8 canonical exploration categories for systematic RFP signal discovery.

Each category represents a distinct aspect of procurement behavior that can be
observed, measured, and replicated across entities.

Categories:
1. JOBS_BOARD_EFFECTIVENESS - LinkedIn job posting signals
2. OFFICIAL_SITE_RELIABILITY - Press releases, news sections
3. STRATEGIC_HIRE_INDICATORS - CRM/Data/Digital roles
4. PARTNERSHIP_SIGNALS - Tech partner mentions
5. OFFICIAL_DOMAIN_DISCOVERY - Finding .com, .de, etc.
6. SEMANTIC_FILTERING - Filtering .gov, .edu for sports
7. HISTORICAL_PATTERN_RECOGNITION - Timeline analysis
8. CLUSTER_PATTERN_REPLICATION - Transfer learning
"""

from enum import Enum
from typing import Dict, List, Any
from dataclasses import dataclass


class ExplorationCategory(Enum):
    """8 canonical exploration categories for systematic signal discovery"""

    JOBS_BOARD_EFFECTIVENESS = "JOBS_BOARD_EFFECTIVENESS"
    """LinkedIn job posting signals for RFP indicators"""

    OFFICIAL_SITE_RELIABILITY = "OFFICIAL_SITE_RELIABILITY"
    """Press releases, news sections, official announcements"""

    STRATEGIC_HIRE_INDICATORS = "STRATEGIC_HIRE_INDICATORS"
    """CRM/Data/Digital leadership hires as RFP precursors"""

    PARTNERSHIP_SIGNALS = "PARTNERSHIP_SIGNALS"
    """Tech partner mentions, vendor changes, platform switches"""

    OFFICIAL_DOMAIN_DISCOVERY = "OFFICIAL_DOMAIN_DISCOVERY"
    """Finding official domains (.com, .de, .org, etc.)"""

    SEMANTIC_FILTERING = "SEMANTIC_FILTERING"
    """Filtering .gov, .edu for sports-relevant signals"""

    HISTORICAL_PATTERN_RECOGNITION = "HISTORICAL_PATTERN_RECOGNITION"
    """Timeline analysis for recurring procurement patterns"""

    CLUSTER_PATTERN_REPLICATION = "CLUSTER_PATTERN_REPLICATION"
    """Transfer learning across entities in same cluster"""


@dataclass
class CategoryMetadata:
    """
    Metadata for exploration categories

    Attributes:
        category: ExplorationCategory enum
        description: Human-readable description
        exploration_methods: Recommended methods (Claude Code, BrightData MCP, etc.)
        confidence_indicators: Signals that indicate high confidence
        negative_indicators: Signals that indicate low confidence
        sample_size: Recommended sample size for exploration (default: 7 entities)
        repeatability_threshold: Min entities to confirm pattern (default: 3/7)
    """
    category: ExplorationCategory
    description: str
    exploration_methods: List[str]
    confidence_indicators: List[str]
    negative_indicators: List[str]
    sample_size: int = 7
    repeatability_threshold: int = 3


# Category metadata registry
CATEGORY_METADATA: Dict[ExplorationCategory, CategoryMetadata] = {
    ExplorationCategory.JOBS_BOARD_EFFECTIVENESS: CategoryMetadata(
        category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS,
        description="LinkedIn job posting signals for RFP indicators",
        exploration_methods=["LinkedIn Structured Jobs API", "BrightData SDK"],
        confidence_indicators=[
            "CRM Manager/Director postings",
            "Head of Digital/Data roles",
            "Transformation/Change Management hires",
            "Multiple similar roles within 30 days"
        ],
        negative_indicators=[
            "Player/coaching roles",
            "Matchday operations",
            "Retail/staffing roles"
        ]
    ),

    ExplorationCategory.OFFICIAL_SITE_RELIABILITY: CategoryMetadata(
        category=ExplorationCategory.OFFICIAL_SITE_RELIABILITY,
        description="Press releases, news sections, official announcements",
        exploration_methods=["Official Site Scraping", "Press Release Monitoring"],
        confidence_indicators=[
            "Official press releases about partnerships",
            "News sections mentioning technology vendors",
            "Executive announcements about digital initiatives",
            "Case studies or success stories"
        ],
        negative_indicators=[
            "Match reports",
            "Player transfer news",
            "Ticket sales promotions"
        ]
    ),

    ExplorationCategory.STRATEGIC_HIRE_INDICATORS: CategoryMetadata(
        category=ExplorationCategory.STRATEGIC_HIRE_INDICATORS,
        description="CRM/Data/Digital leadership hires as RFP precursors",
        exploration_methods=["LinkedIn Jobs", "Official Career Pages", "Executive Moves"],
        confidence_indicators=[
            "CDO/CTO/CIO hires",
            "Director of Digital/Customer/Data roles",
            "CRM Platform Manager hires",
            "Digital Transformation Lead appointments"
        ],
        negative_indicators=[
            "Commercial/sales director roles",
            "Marketing manager roles (non-technical)",
            "Broadcast/media roles"
        ]
    ),

    ExplorationCategory.PARTNERSHIP_SIGNALS: CategoryMetadata(
        category=ExplorationCategory.PARTNERSHIP_SIGNALS,
        description="Tech partner mentions, vendor changes, platform switches",
        exploration_methods=["Press Releases", "News Monitoring", "Partner Announcements"],
        confidence_indicators=[
            "New CRM platform announcements",
            "Data/analytics partnerships",
            "Fan engagement platform partnerships",
            "Migration from legacy systems"
        ],
        negative_indicators=[
            "Kit sponsor announcements",
            "Media/broadcasting rights deals",
            "Stadium naming rights"
        ]
    ),

    ExplorationCategory.OFFICIAL_DOMAIN_DISCOVERY: CategoryMetadata(
        category=ExplorationCategory.OFFICIAL_DOMAIN_DISCOVERY,
        description="Finding official domains (.com, .de, .org, etc.)",
        exploration_methods=["Google SERP", "Entity Domain Discovery", "BrightData SDK"],
        confidence_indicators=[
            "Official .com/.de/.org domains",
            "Verified social media profiles",
            "League/federation directory listings"
        ],
        negative_indicators=[
            "Fan sites/forums",
            "News/media domains",
            "Ticket resale platforms"
        ]
    ),

    ExplorationCategory.SEMANTIC_FILTERING: CategoryMetadata(
        category=ExplorationCategory.SEMANTIC_FILTERING,
        description="Filtering .gov, .edu for sports-relevant signals",
        exploration_methods=["Semantic Analysis", "Keyword Matching", "Claude NLP"],
        confidence_indicators=[
            "Sports governing body announcements",
            "Funding/grant announcements for sports tech",
            "Regulatory changes affecting sports",
            "Public sector sports partnerships"
        ],
        negative_indicators=[
            "Unrelated government programs",
            "Educational sports scholarships",
            "Non-sports public sector news"
        ]
    ),

    ExplorationCategory.HISTORICAL_PATTERN_RECOGNITION: CategoryMetadata(
        category=ExplorationCategory.HISTORICAL_PATTERN_RECOGNITION,
        description="Timeline analysis for recurring procurement patterns",
        exploration_methods=["Graphiti Timeline Queries", "Narrative Builder", "Temporal Analysis"],
        confidence_indicators=[
            "Seasonal procurement cycles",
            "Recurring vendor switch patterns",
            "Contract renewal timing",
            "Multi-year digital transformation phases"
        ],
        negative_indicators=[
            "One-off events",
            "Random noise without pattern",
            "Single-entity anomalies"
        ]
    ),

    ExplorationCategory.CLUSTER_PATTERN_REPLICATION: CategoryMetadata(
        category=ExplorationCategory.CLUSTER_PATTERN_REPLICATION,
        description="Transfer learning across entities in same cluster",
        exploration_methods=["Cluster Intelligence", "Pattern Replication Engine", "Cross-Entity Inference"],
        confidence_indicators=[
            "Same pattern in 3+ entities",
            "Similar cluster signatures",
            "Consistent signal strength across entities",
            "Cross-validated with multiple sources"
        ],
        negative_indicators=[
            "Single-entity patterns",
            "Inconsistent cluster behavior",
            "Conflicting signals across entities"
        ]
    )
}


def get_category_metadata(category: ExplorationCategory) -> CategoryMetadata:
    """
    Get metadata for exploration category

    Args:
        category: ExplorationCategory enum

    Returns:
        CategoryMetadata with exploration guidance
    """
    return CATEGORY_METADATA[category]


def list_all_categories() -> List[ExplorationCategory]:
    """List all exploration categories"""
    return list(ExplorationCategory)


def get_recommended_sample_size(category: ExplorationCategory) -> int:
    """
    Get recommended sample size for category

    Args:
        category: ExplorationCategory enum

    Returns:
        Recommended sample size (default: 7)
    """
    return CATEGORY_METADATA[category].sample_size


def get_repeatability_threshold(category: ExplorationCategory) -> int:
    """
    Get repeatability threshold for category

    Args:
        category: ExplorationCategory enum

    Returns:
        Min entities to confirm pattern (default: 3)
    """
    return CATEGORY_METADATA[category].repeatability_threshold
