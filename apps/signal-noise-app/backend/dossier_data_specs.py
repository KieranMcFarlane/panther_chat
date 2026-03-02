#!/usr/bin/env python3
"""
Dossier Data Specifications - CSV Schemas for Phase 0 Scalable System

This module defines data schemas for all 11 dossier sections in CSV format.
These specifications serve as:
1. Reference for data structure requirements
2. Import templates for manual data entry
3. Specifications for BrightData SDK output format
4. Documentation for data freshness requirements

AUTHOR: Phase 0 Scalable Dossier System
DATE: 2026-02-23
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class DossierTier(Enum):
    """Dossier generation tiers"""
    BASIC = "BASIC"       # 3 sections, ~5s, ~$0.0004
    STANDARD = "STANDARD" # 7 sections, ~15s, ~$0.0095
    PREMIUM = "PREMIUM"   # 11 sections, ~30s, ~$0.057


class DataFreshness(Enum):
    """Data freshness requirements"""
    REAL_TIME = "real_time"         # < 24 hours old (job postings, news)
    WEEKLY = "weekly"                # < 7 days old (press releases)
    MONTHLY = "monthly"              # < 30 days old (leadership changes)
    QUARTERLY = "quarterly"          # < 90 days old (performance data)
    STABLE = "stable"                # Changes infrequently (founded, stadium)


# =============================================================================
# SECTION 1: CORE INFORMATION (BASIC Tier)
# =============================================================================

@dataclass
class CoreInfoSpec:
    """Core entity information schema"""
    entity_id: str
    official_name: str
    type: str  # CLUB, LEAGUE, FEDERATION, VENUE, PERSON
    sport: str
    country: str
    league: str = ""
    founded_year: str = ""
    headquarters: str = ""
    stadium_name: str = ""
    capacity: str = ""
    website_url: str = ""
    employee_count: str = ""
    description: str = ""

    # Metadata
    data_source: str = "official_website"
    freshness: DataFreshness = DataFreshness.STABLE
    last_updated: str = ""  # ISO timestamp

    def to_csv_row(self) -> Dict[str, str]:
        return {
            "entity_id": self.entity_id,
            "official_name": self.official_name,
            "type": self.type,
            "sport": self.sport,
            "country": self.country,
            "league": self.league,
            "founded_year": self.founded_year,
            "headquarters": self.headquarters,
            "stadium_name": self.stadium_name,
            "capacity": self.capacity,
            "website_url": self.website_url,
            "employee_count": self.employee_count,
            "description": self.description,
            "data_source": self.data_source,
            "freshness": self.freshness.value,
            "last_updated": self.last_updated
        }

    @classmethod
    def csv_headers(cls) -> List[str]:
        return [
            "entity_id", "official_name", "type", "sport", "country", "league",
            "founded_year", "headquarters", "stadium_name", "capacity",
            "website_url", "employee_count", "description",
            "data_source", "freshness", "last_updated"
        ]


# =============================================================================
# SECTION 2: DIGITAL TRANSFORMATION (STANDARD Tier)
# =============================================================================

@dataclass
class DigitalStackSpec:
    """Digital technology stack schema"""
    entity_id: str
    website_platform: str = ""  # React, WordPress, Drupal, etc.
    crm_system: str = ""  # Salesforce, HubSpot, etc.
    analytics_platform: str = ""  # Google Analytics, Adobe, etc.
    mobile_apps: str = ""  # yes, no, partial
    ecommerce_platform: str = ""  # Shopify, Magento, custom
    ticketing_system: str = ""  # Ticketmaster, StubHub, etc.
    tech_partner_primary: str = ""
    tech_partner_secondary: str = ""
    digital_maturity_score: int = 0  # 0-100
    transformation_score: int = 0  # 0-100

    # Metadata
    data_source: str = "website_analysis"
    freshness: DataFreshness = DataFreshness.MONTHLY
    last_updated: str = ""

    def to_csv_row(self) -> Dict[str, str]:
        return {
            "entity_id": self.entity_id,
            "website_platform": self.website_platform,
            "crm_system": self.crm_system,
            "analytics_platform": self.analytics_platform,
            "mobile_apps": self.mobile_apps,
            "ecommerce_platform": self.ecommerce_platform,
            "ticketing_system": self.ticketing_system,
            "tech_partner_primary": self.tech_partner_primary,
            "tech_partner_secondary": self.tech_partner_secondary,
            "digital_maturity_score": str(self.digital_maturity_score),
            "transformation_score": str(self.transformation_score),
            "data_source": self.data_source,
            "freshness": self.freshness.value,
            "last_updated": self.last_updated
        }


# =============================================================================
# SECTION 3: AI REASONER ASSESSMENT (PREMIUM Tier)
# =============================================================================

@dataclass
class AIOpportunitySpec:
    """AI reasoner / YP opportunity assessment schema"""
    entity_id: str
    yp_service_fit: List[str] = field(default_factory=list)  # MOBILE_APPS, ANALYTICS, etc.
    entry_point_type: str = ""  # pilot, partnership, vendor replacement, new initiative
    competitive_positioning: str = ""
    estimated_probability: int = 0  # 0-100
    risk_factors: List[str] = field(default_factory=list)
    competitive_advantages: List[str] = field(default_factory=list)
    recommended_approach: str = ""

    # Metadata
    data_source: str = "ai_analysis"
    freshness: DataFreshness = DataFreshness.WEEKLY
    last_updated: str = ""


# =============================================================================
# SECTION 4: STRATEGIC OPPORTUNITIES (PREMIUM Tier)
# =============================================================================

@dataclass
class OpportunitySpec:
    """Strategic opportunity tracking schema"""
    entity_id: str
    opportunity_name: str
    opportunity_type: str  # immediate_launch, medium_term, long_term
    timeline_months: str  # "3-6", "6-12", "18+"
    estimated_budget: str = ""  # "£100K-£300K"
    probability_score: int = 0  # 0-100
    yp_service_fit: List[str] = field(default_factory=list)
    strategic_importance: str = ""  # HIGH, MEDIUM, LOW

    # Metadata
    data_source: str = "strategic_analysis"
    freshness: DataFreshness = DataFreshness.MONTHLY
    last_updated: str = ""


# =============================================================================
# SECTION 5: KEY DECISION MAKERS (STANDARD Tier)
# =============================================================================

@dataclass
class LeadershipSpec:
    """Leadership / decision maker schema (CRITICAL for Connections)"""
    entity_id: str
    person_name: str  # REAL NAME - NO PLACEHOLDERS like {CTO}
    role: str  # Commercial Director, CTO, CDO, etc.
    title: str  # Full title with qualifier
    influence_level: str  # HIGH, MEDIUM, LOW
    decision_scope: str  # What they control
    communication_style: str  # analytical, relationship, story-driven, direct
    risk_profile: str  # conservative, moderate, aggressive
    tech_savviness: str  # low, medium, high
    linkedin_url: str = ""
    email: str = ""
    phone: str = ""

    # Yellow Panther engagement specifics
    yp_value_proposition: str = ""
    yp_messaging: str = ""
    yp_service_fit: List[str] = field(default_factory=list)
    yp_contact_channel: str = ""  # email, linkedin, warm_intro, conference

    # Metadata
    data_source: str = "linkedin_scraping"
    confidence: int = 0  # 0-100
    freshness: DataFreshness = DataFreshness.MONTHLY
    last_updated: str = ""

    def to_csv_row(self) -> Dict[str, str]:
        return {
            "entity_id": self.entity_id,
            "person_name": self.person_name,
            "role": self.role,
            "title": self.title,
            "influence_level": self.influence_level,
            "decision_scope": self.decision_scope,
            "communication_style": self.communication_style,
            "risk_profile": self.risk_profile,
            "tech_savviness": self.tech_savviness,
            "linkedin_url": self.linkedin_url,
            "email": self.email,
            "phone": self.phone,
            "yp_value_proposition": self.yp_value_proposition,
            "yp_messaging": self.yp_messaging,
            "yp_service_fit": ",".join(self.yp_service_fit),
            "yp_contact_channel": self.yp_contact_channel,
            "data_source": self.data_source,
            "confidence": str(self.confidence),
            "freshness": self.freshness.value,
            "last_updated": self.last_updated
        }

    @classmethod
    def csv_headers(cls) -> List[str]:
        return [
            "entity_id", "person_name", "role", "title", "influence_level",
            "decision_scope", "communication_style", "risk_profile", "tech_savviness",
            "linkedin_url", "email", "phone",
            "yp_value_proposition", "yp_messaging", "yp_service_fit", "yp_contact_channel",
            "data_source", "confidence", "freshness", "last_updated"
        ]


# =============================================================================
# SECTION 6: CONNECTIONS ANALYSIS (PREMIUM Tier)
# =============================================================================

@dataclass
class YPTeamMemberSpec:
    """Yellow Panther team member (static reference data)"""
    yp_name: str
    yp_role: str
    yp_linkedin: str
    yp_weight: float = 1.0
    yp_expertise_1: str = ""
    yp_expertise_2: str = ""
    yp_expertise_3: str = ""
    excluded_from_connections: bool = False

    def to_csv_row(self) -> Dict[str, str]:
        return {
            "yp_name": self.yp_name,
            "yp_role": self.yp_role,
            "yp_linkedin": self.yp_linkedin,
            "yp_weight": str(self.yp_weight),
            "yp_expertise_1": self.yp_expertise_1,
            "yp_expertise_2": self.yp_expertise_2,
            "yp_expertise_3": self.yp_expertise_3,
            "excluded_from_connections": str(self.excluded_from_connections)
        }


@dataclass
class ConnectionPathSpec:
    """Network connection path between YP member and target entity"""
    entity_id: str
    yp_member_name: str
    target_person_name: str
    target_person_role: str
    target_linkedin_url: str = ""
    direct_connections: int = 0
    mutual_connections: List[str] = field(default_factory=list)
    connection_strength: str = ""  # strong, medium, weak, none
    tier_2_bridge_available: bool = False
    tier_2_bridge_contact: str = ""
    success_probability: int = 0  # 0-100

    # Metadata
    data_source: str = "linkedin_analysis"
    freshness: DataFreshness = DataFreshness.WEEKLY
    last_updated: str = ""


@dataclass
class BridgeContactSpec:
    """Tier 2 network contact (bridge to target entity)"""
    contact_name: str
    relationship_to_yp: str  # "Close connection to Stuart Cope"
    network_reach: str  # "Sports Industry Contacts"
    introduction_capability: str  # "High credibility in sports sector"
    linkedin_url: str = ""
    target_connections_count: int = 0

    def to_csv_row(self) -> Dict[str, str]:
        return {
            "contact_name": self.contact_name,
            "relationship_to_yp": self.relationship_to_yp,
            "network_reach": self.network_reach,
            "introduction_capability": self.introduction_capability,
            "linkedin_url": self.linkedin_url,
            "target_connections_count": str(self.target_connections_count)
        }


# =============================================================================
# SECTION 7: RECENT NEWS (BASIC Tier)
# =============================================================================

@dataclass
class NewsSpec:
    """Recent news / press release schema"""
    entity_id: str
    date: str  # ISO date
    headline: str
    source: str  # publication name
    category: str  # technology, partnership, operations, other
    relevance_score: int = 0  # 0-100
    summary: str = ""
    url: str = ""
    signals: List[str] = field(default_factory=list)  # [PROCUREMENT], [CAPABILITY], etc.

    # Metadata
    data_source: str = "news_scraping"
    freshness: DataFreshness = DataFreshness.REAL_TIME
    last_updated: str = ""


# =============================================================================
# SECTION 8: CURRENT PERFORMANCE (BASIC Tier - Sports Only)
# =============================================================================

@dataclass
class PerformanceSpec:
    """Current sports performance schema"""
    entity_id: str
    league_position: int = 0
    points: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    recent_form: List[str] = field(default_factory=list)  # ["W", "D", "W", "W", "W"]
    mini_table: List[Dict[str, Any]] = field(default_factory=list)  # Top 3 competitors

    # Metadata
    data_source: str = "sports_api"
    freshness: DataFreshness = DataFreshness.WEEKLY
    last_updated: str = ""


# =============================================================================
# SECTION 9: OUTREACH STRATEGY (STANDARD Tier)
# =============================================================================

@dataclass
class OutreachStrategySpec:
    """Outreach / engagement strategy schema"""
    entity_id: str
    approach_type: str  # warm, lukewarm, cold
    primary_channel: str  # email, linkedin, warm_intro, phone
    messaging_angle: str  # how to frame YP value
    optimal_timing: str  # when to reach out
    personalization_tokens: List[str] = field(default_factory=list)  # [{{recent_initiative}}]
    conversation_starters: List[str] = field(default_factory=list)
    anti_patterns: List[str] = field(default_factory=list)  # mistakes to avoid

    # Expected outcomes
    expected_response_rate: int = 0  # 0-100

    # Metadata
    data_source: str = "strategic_analysis"
    freshness: DataFreshness = DataFreshness.MONTHLY
    last_updated: str = ""


# =============================================================================
# SECTION 10: RISK ASSESSMENT (PREMIUM Tier)
# =============================================================================

@dataclass
class RiskAssessmentSpec:
    """Implementation and competitive risk schema"""
    entity_id: str
    risk_category: str = ""  # business, technical, organizational
    risk_description: str = ""
    probability: int = 0  # 0-100
    impact: str = ""  # HIGH, MEDIUM, LOW
    mitigation_strategy: str = ""
    yp_differentiation: str = ""  # How YP addresses this risk

    # Competitive landscape
    incumbent_vendors: List[str] = field(default_factory=list)
    alternative_providers: List[str] = field(default_factory=list)
    switching_costs: str = ""

    # Metadata
    data_source: str = "competitive_analysis"
    freshness: DataFreshness = DataFreshness.QUARTERLY
    last_updated: str = ""


# =============================================================================
# SECTION 11: LEAGUE CONTEXT (BASIC Tier - Sports Only)
# =============================================================================

@dataclass
class LeagueContextSpec:
    """League / competitive context schema"""
    entity_id: str
    league_name: str = ""
    current_position: int = 0
    clubs_in_league: int = 0
    season_phase: str = ""  # early, mid, late season
    top_competitor_1: str = ""
    top_competitor_2: str = ""
    top_competitor_3: str = ""

    # Metadata
    data_source: str = "sports_api"
    freshness: DataFreshness = DataFreshness.WEEKLY
    last_updated: str = ""


# =============================================================================
# CSV TEMPLATES FOR EXPORT
# =============================================================================

CSV_TEMPLATE_DIR = "data/dossier_templates"

CSV_TEMPLATES = {
    "core_info.csv": CoreInfoSpec.csv_headers(),
    "leadership.csv": LeadershipSpec.csv_headers(),
    "digital_stack.csv": DigitalStackSpec(
        entity_id="", website_platform="", crm_system=""
    ).to_csv_row().keys(),
    "yp_team.csv": YPTeamMemberSpec(
        yp_name="", yp_role="", yp_linkedin=""
    ).to_csv_row().keys(),
    "bridge_contacts.csv": BridgeContactSpec(
        contact_name="", relationship_to_yp="", network_reach="", introduction_capability=""
    ).to_csv_row().keys(),
}


# =============================================================================
# BRIGHTDATA QUERIES BY SECTION
# =============================================================================

BRIGHTDATA_QUERIES = {
    "core_information": [
        "{entity} official website",
        "{entity} founded history",
        "{entity} stadium capacity",
        "{entity} headquarters location"
    ],
    "digital_transformation": [
        "{entity} technology stack CRM",
        "{entity} website platform built with",
        "{entity} analytics provider",
        "{entity} technology partner",
        "{entity} digital transformation initiative"
    ],
    "ai_reasoner_assessment": [
        "{entity} digital transformation projects",
        "{entity} stadium technology initiative",
        "{entity} partnership opportunities"
    ],
    "strategic_opportunities": [
        "{entity} digital transformation projects",
        "{entity} stadium technology initiative",
        "{entity} partnership opportunities",
        "{entity} women's team digital expansion"
    ],
    "leadership": [
        "{entity} leadership team executive",
        "{entity} Commercial Director name",
        "{entity} CEO Managing Director",
        "{entity} CTO CDO digital leadership",
        "{entity} board of directors"
    ],
    "connections": [
        "Stuart Cope connections to {entity}",
        "Gunjan Parikh connections to {entity}",
        "Andrew Rapley connections to {entity}",
        "Sarfraz Hussain connections to {entity}",
        "Elliott Hillman connections to {entity}",
        "Stuart Cope {target_person} mutual connections LinkedIn",
        "{yp_member} connections football industry"
    ],
    "recent_news": [
        "{entity} news 2025",
        "{entity} press release technology",
        "{entity} partnership announcement",
        "{entity} digital initiative"
    ],
    "current_performance": [
        "{entity} Premier League table 2025",
        "{entity} current standings",
        "{entity} last 5 results"
    ],
    "outreach_strategy": [
        "{entity} recent initiatives",
        "{entity} upcoming events",
        "{entity} partnerships announcements"
    ],
    "risk_assessment": [
        "{entity} technology vendors",
        "{entity} incumbent providers",
        "{entity} existing partnerships"
    ],
    "league_context": [
        "{entity} league table 2025",
        "{entity} competitors comparison"
    ]
}


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def get_brightdata_queries(section_id: str, entity_name: str) -> List[str]:
    """
    Get BrightData collection queries for a section.

    Args:
        section_id: Section identifier (e.g., "leadership")
        entity_name: Name of entity to query for

    Returns:
        List of search query strings
    """
    queries = BRIGHTDATA_QUERIES.get(section_id, [])
    return [q.replace("{entity}", entity_name) for q in queries]


def get_csv_template_headers(template_name: str) -> List[str]:
    """
    Get CSV headers for a template.

    Args:
        template_name: Name of CSV template (e.g., "leadership.csv")

    Returns:
        List of CSV column headers
    """
    return CSV_TEMPLATES.get(template_name, [])


def generate_csv_template_file(template_name: str, output_path: str = None) -> str:
    """
    Generate a CSV template file for data entry.

    Args:
        template_name: Name of CSV template (e.g., "leadership.csv")
        output_path: Optional output path (defaults to CSV_TEMPLATE_DIR)

    Returns:
        Path to generated template file
    """
    import csv
    from pathlib import Path

    headers = get_csv_template_headers(template_name)
    if not headers:
        raise ValueError(f"Unknown template: {template_name}")

    if output_path is None:
        output_path = Path(CSV_TEMPLATE_DIR) / template_name
    else:
        output_path = Path(output_path)

    # Create directory if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write CSV with headers only
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

    logger = __import__('logging').getLogger(__name__)
    logger.info(f"Generated CSV template: {output_path}")

    return str(output_path)


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    # Enums
    "DossierTier",
    "DataFreshness",

    # Schema classes
    "CoreInfoSpec",
    "DigitalStackSpec",
    "AIOpportunitySpec",
    "OpportunitySpec",
    "LeadershipSpec",
    "YPTeamMemberSpec",
    "ConnectionPathSpec",
    "BridgeContactSpec",
    "NewsSpec",
    "PerformanceSpec",
    "OutreachStrategySpec",
    "RiskAssessmentSpec",
    "LeagueContextSpec",

    # Templates and queries
    "CSV_TEMPLATE_DIR",
    "CSV_TEMPLATES",
    "BRIGHTDATA_QUERIES",

    # Functions
    "get_brightdata_queries",
    "get_csv_template_headers",
    "generate_csv_template_file",
]
