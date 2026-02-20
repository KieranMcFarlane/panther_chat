#!/usr/bin/env python3
"""
MCP Source Strategy (Learned Patterns)

Extracted from BrightData MCP + Claude Code discovery success patterns.

Based on analysis of source productivity in 4 MCP discovery summaries:
- Partnership announcements: 70% of ACCEPT signals come from these
- Tech news articles: High-value deployment confirmations
- Press releases: Partnership and platform announcements
- Leadership job postings: Technology leadership roles
- LinkedIn Jobs (operational): LOW VALUE (Kit Assistant, Shift Manager)
- Official site homepages: Consumer-facing, not corporate
- App stores: Completely irrelevant

Key insight: MCP achieves 9-15× higher confidence by focusing on high-signal
sources (partnership announcements, tech news) rather than low-signal sources
(LinkedIn Jobs operational roles, official homepages).

Usage:
    from sources.mcp_source_priorities import (
        MCP_SOURCE_PRIORITIES,
        get_source_config,
        map_evidence_to_source
    )

    # Map evidence type to optimal source
    source = map_evidence_to_source("multi_year_partnership")
    # Returns: "partnership_announcements"

    # Get source configuration
    config = get_source_config(source)
    # Returns: {"confidence_multiplier": 1.2, "cost": "$0.01-0.02", ...}
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum


# =============================================================================
# Source Type Enum
# =============================================================================

class SourceType(str, Enum):
    """Source types for discovery"""
    PARTNERSHIP_ANNOUNCEMENTS = "partnership_announcements"
    TECH_NEWS_ARTICLES = "tech_news_articles"
    PRESS_RELEASES = "press_releases"
    LEADERSHIP_JOB_POSTINGS = "leadership_job_postings"
    COMPANY_BLOG = "company_blog"
    LINKEDIN_JOBS_OPERATIONAL = "linkedin_jobs_operational"
    OFFICIAL_SITE_HOMEPAGE = "official_site_homepage"
    APP_STORES = "app_stores"


# =============================================================================
# Source Configuration
# =============================================================================

@dataclass
class SourceConfig:
    """
    Source configuration with productivity metrics

    Attributes:
        source_type: Source type identifier
        examples: Real examples from MCP discoveries
        confidence_multiplier: Multiplier for confidence scoring (0.0-1.5)
        cost: Typical cost per search
        productivity: Percentage of ACCEPT signals from this source
        blacklist_threshold: Failures before permanent blacklist
        notes: Additional context
    """
    source_type: SourceType
    examples: List[str]
    confidence_multiplier: float
    cost: str
    productivity: float  # % of ACCEPT signals from this source
    blacklist_threshold: int = 3
    notes: str = ""

    def __post_init__(self):
        if self.notes == "" and self.productivity == 0.0:
            self.notes = "No productivity data"


# MCP Source Priorities (extracted from discovery success patterns)
MCP_SOURCE_PRIORITIES: Dict[SourceType, SourceConfig] = {

    # -------------------------------------------------------------------------
    # PRIMARY SOURCES (70% of ACCEPT signals come from these)
    # -------------------------------------------------------------------------

    SourceType.PARTNERSHIP_ANNOUNCEMENTS: SourceConfig(
        source_type=SourceType.PARTNERSHIP_ANNOUNCEMENTS,
        examples=[
            "Deloitte 6-year partnership announcement (World Athletics)",
            "NTT Data multi-year partnership (Arsenal)",
            "Tata Communications 5-year deal (World Athletics)"
        ],
        confidence_multiplier=1.2,
        cost="$0.01-0.02 per search",
        productivity=0.35,  # 35% of ACCEPT signals
        blacklist_threshold=3,
        notes="Highest ROI source - partnership pages and announcements"
    ),

    SourceType.TECH_NEWS_ARTICLES: SourceConfig(
        source_type=SourceType.TECH_NEWS_ARTICLES,
        examples=[
            "Computer Weekly: Arsenal adding digital transformation firepower",
            "July 2025 CX deployment article",
            "Digital transformation news coverage"
        ],
        confidence_multiplier=1.1,
        cost="$0.01-0.02 per search",
        productivity=0.25,  # 25% of ACCEPT signals
        blacklist_threshold=3,
        notes="Tech news confirms deployments and partnerships"
    ),

    SourceType.PRESS_RELEASES: SourceConfig(
        source_type=SourceType.PRESS_RELEASES,
        examples=[
            "Multi-year partnership announcements",
            "Platform deployment press releases",
            "Digital transformation press releases"
        ],
        confidence_multiplier=1.0,
        cost="$0.01-0.02 per search",
        productivity=0.10,  # 10% of ACCEPT signals
        blacklist_threshold=3,
        notes="Official announcements with high reliability"
    ),

    # -------------------------------------------------------------------------
    # SECONDARY SOURCES (30% of ACCEPT signals)
    # -------------------------------------------------------------------------

    SourceType.LEADERSHIP_JOB_POSTINGS: SourceConfig(
        source_type=SourceType.LEADERSHIP_JOB_POSTINGS,
        examples=[
            "Head of Operational Technology (Arsenal)",
            "Head of Digital Media (World Athletics)",
            "Chief Digital Officer roles"
        ],
        confidence_multiplier=0.8,
        cost="$0.005-0.01 per search",
        productivity=0.20,  # 20% of signals (WEAK_ACCEPT mostly)
        blacklist_threshold=2,
        notes="Technology leadership roles indicate digital maturity"
    ),

    SourceType.COMPANY_BLOG: SourceConfig(
        source_type=SourceType.COMPANY_BLOG,
        examples=[
            "Digital transformation case study",
            "Technology innovation blog posts",
            "Platform deployment stories"
        ],
        confidence_multiplier=0.6,
        cost="$0.01 per search",
        productivity=0.08,  # 8% of signals
        blacklist_threshold=2,
        notes="Corporate blog posts, variable quality"
    ),

    # -------------------------------------------------------------------------
    # LOW-VALUE SOURCES (Avoid these)
    # -------------------------------------------------------------------------

    SourceType.LINKEDIN_JOBS_OPERATIONAL: SourceConfig(
        source_type=SourceType.LINKEDIN_JOBS_OPERATIONAL,
        examples=[
            "Kit Assistant role (Arsenal)",
            "Stadium Tour Host (operational)",
            "Shift Manager (hospitality)"
        ],
        confidence_multiplier=0.2,
        cost="$0.01 per search",
        productivity=0.02,  # 2% of signals (mostly NO_PROGRESS)
        blacklist_threshold=1,
        notes="LOW VALUE - operational roles, not procurement signals"
    ),

    SourceType.OFFICIAL_SITE_HOMEPAGE: SourceConfig(
        source_type=SourceType.OFFICIAL_SITE_HOMEPAGE,
        examples=[
            "Club homepage (consumer-facing)",
            "Official website landing page"
        ],
        confidence_multiplier=0.1,
        cost="$0.01 per search",
        productivity=0.00,  # 0% of ACCEPT signals
        blacklist_threshold=1,
        notes="CONSUMER FACING - not corporate/procurement focused"
    ),

    SourceType.APP_STORES: SourceConfig(
        source_type=SourceType.APP_STORES,
        examples=[
            "Google Play app listings",
            "Apple App Store listings"
        ],
        confidence_multiplier=0.0,
        cost="$0.01 per search",
        productivity=0.00,  # 0% of ACCEPT signals
        blacklist_threshold=0,  # Permanently blacklisted
        notes="COMPLETELY IRRELEVANT - never contains procurement signals"
    )
}


# =============================================================================
# Evidence Type → Source Mapping
# =============================================================================

EVIDENCE_TO_SOURCE_MAPPING: Dict[str, SourceType] = {
    # High-value evidence types → optimal sources
    "multi_year_partnership": SourceType.PARTNERSHIP_ANNOUNCEMENTS,
    "recent_deployment": SourceType.TECH_NEWS_ARTICLES,
    "confirmed_platform": SourceType.PRESS_RELEASES,

    # Medium-value evidence types
    "technology_leadership": SourceType.LEADERSHIP_JOB_POSTINGS,
    "tech_collaboration": SourceType.PRESS_RELEASES,
    "legacy_system": SourceType.TECH_NEWS_ARTICLES,

    # RFP-specific evidence types
    "procurement_role": SourceType.LEADERSHIP_JOB_POSTINGS,
    "rfp_language": SourceType.PRESS_RELEASES
}


# =============================================================================
# Channel Management
# =============================================================================

class ChannelBlacklist:
    """
    Channel blacklist management

    Tracks channels that have been exhausted or proven unproductive.
    """

    def __init__(self):
        self.blacklisted_channels: set = set()
        self.channel_failures: Dict[SourceType, int] = {}
        self.channel_successes: Dict[SourceType, int] = {}

    def record_failure(self, source_type: SourceType):
        """Record a failed hop on this source"""
        self.channel_failures[source_type] = self.channel_failures.get(source_type, 0) + 1

        # Check if should blacklist
        config = get_source_config(source_type)
        if config and self.channel_failures[source_type] >= config.blacklist_threshold:
            self.blacklisted_channels.add(source_type)

    def record_success(self, source_type: SourceType):
        """Record a successful hop on this source"""
        self.channel_successes[source_type] = self.channel_successes.get(source_type, 0) + 1

    def is_blacklisted(self, source_type: SourceType) -> bool:
        """Check if source is blacklisted"""
        return source_type in self.blacklisted_channels

    def get_failure_count(self, source_type: SourceType) -> int:
        """Get failure count for source"""
        return self.channel_failures.get(source_type, 0)

    def get_exhaustion_rate(self, source_type: SourceType) -> float:
        """
        Calculate exhaustion rate (0.0 = fresh, 1.0 = exhausted)

        Based on failure count vs blacklist threshold
        """
        config = get_source_config(source_type)
        if not config:
            return 0.0

        failures = self.channel_failures.get(source_type, 0)
        threshold = config.blacklist_threshold

        if threshold == 0:
            return 1.0  # Permanently exhausted

        return min(1.0, failures / threshold)


# =============================================================================
# Convenience Functions
# =============================================================================

def get_source_config(source_type: SourceType) -> Optional[SourceConfig]:
    """
    Get source configuration by type

    Args:
        source_type: Source type enum

    Returns:
        SourceConfig or None if not found
    """
    return MCP_SOURCE_PRIORITIES.get(source_type)


def map_evidence_to_source(evidence_type: str) -> Optional[SourceType]:
    """
    Map evidence type to optimal source channel

    Args:
        evidence_type: Evidence type identifier (e.g., "multi_year_partnership")

    Returns:
        Optimal SourceType for detecting this evidence
    """
    return EVIDENCE_TO_SOURCE_MAPPING.get(evidence_type)


def get_primary_sources() -> List[SourceType]:
    """
    Get list of primary sources (confidence_multiplier >= 1.0)

    Returns:
        List of high-value source types
    """
    return [
        source for source, config in MCP_SOURCE_PRIORITIES.items()
        if config.confidence_multiplier >= 1.0
    ]


def get_secondary_sources() -> List[SourceType]:
    """
    Get list of secondary sources (0.5 <= confidence_multiplier < 1.0)

    Returns:
        List of medium-value source types
    """
    return [
        source for source, config in MCP_SOURCE_PRIORITIES.items()
        if 0.5 <= config.confidence_multiplier < 1.0
    ]


def get_forbidden_sources() -> List[SourceType]:
    """
    Get list of permanently forbidden sources (confidence_multiplier < 0.3)

    Returns:
        List of low-value source types to avoid
    """
    return [
        source for source, config in MCP_SOURCE_PRIORITIES.items()
        if config.confidence_multiplier < 0.3
    ]


def calculate_channel_score(
    source_type: SourceType,
    blacklist: ChannelBlacklist,
    base_eig: float = 1.0
) -> float:
    """
    Calculate channel score for hop selection

    Score = EIG × confidence_multiplier × (1 - exhaustion_rate)

    Args:
        source_type: Source being evaluated
        blacklist: Channel blacklist tracking
        base_eig: Base expected information gain

    Returns:
        Channel score (higher = better)
    """
    config = get_source_config(source_type)
    if not config:
        return 0.0

    # Permanently blacklisted sources get 0 score
    if blacklist.is_blacklisted(source_type):
        return 0.0

    # Calculate exhaustion penalty
    exhaustion = blacklist.get_exhaustion_rate(source_type)
    novelty_multiplier = 1.0 - exhaustion

    # Calculate score
    score = base_eig * config.confidence_multiplier * novelty_multiplier

    return max(0.0, score)


# =============================================================================
# Sorting and Ranking
# =============================================================================

def rank_sources_by_productivity() -> List[tuple]:
    """
    Rank sources by productivity (descending)

    Returns:
        List of (source_type, productivity) tuples
    """
    sources_with_productivity = [
        (source, config.productivity)
        for source, config in MCP_SOURCE_PRIORITIES.items()
    ]

    return sorted(sources_with_productivity, key=lambda x: x[1], reverse=True)


def rank_sources_by_confidence_multiplier() -> List[tuple]:
    """
    Rank sources by confidence multiplier (descending)

    Returns:
        List of (source_type, confidence_multiplier) tuples
    """
    sources_with_multiplier = [
        (source, config.confidence_multiplier)
        for source, config in MCP_SOURCE_PRIORITIES.items()
    ]

    return sorted(sources_with_multiplier, key=lambda x: x[1], reverse=True)


# =============================================================================
# Print Summary
# =============================================================================

def print_source_summary():
    """Print MCP source strategy summary"""
    print("=== MCP Source Strategy Summary ===\n")

    print("PRIMARY SOURCES (70% of ACCEPT signals):")
    for source in get_primary_sources():
        config = get_source_config(source)
        print(f"  • {source.value}")
        print(f"    Confidence Multiplier: {config.confidence_multiplier}")
        print(f"    Productivity: {config.productivity*100:.0f}% of ACCEPT signals")
        print(f"    Cost: {config.cost}")
        print(f"    Blacklist Threshold: {config.blacklist_threshold} failures")
        print(f"    Examples: {', '.join(config.examples[:2])}")
        print()

    print("SECONDARY SOURCES (30% of ACCEPT signals):")
    for source in get_secondary_sources():
        config = get_source_config(source)
        print(f"  • {source.value}")
        print(f"    Confidence Multiplier: {config.confidence_multiplier}")
        print(f"    Productivity: {config.productivity*100:.0f}%")
        print(f"    Cost: {config.cost}")
        print()

    print("FORBIDDEN SOURCES (Avoid):")
    for source in get_forbidden_sources():
        config = get_source_config(source)
        print(f"  • {source.value} - {config.notes}")
        print(f"    Productivity: {config.productivity*100:.0f}%")

    print("\n✅ MCP Source Strategy Summary complete")


if __name__ == "__main__":
    print_source_summary()
