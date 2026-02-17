#!/usr/bin/env python3
"""
Entity-Type-Specific Dossier Questions with Yellow Panther Integration

This module provides question templates for each entity type that:
1. Generate hypotheses with validation strategies
2. Include YP Service Fit for each question
3. Tag questions with YP positioning strategies
4. Reference relevant YP case studies

Key Innovation: Question-First Reasoning
- Each question is designed to generate a TESTABLE HYPOTHESIS
- Questions vary by entity type (SPORT_CLUB vs SPORT_FEDERATION vs SPORT_LEAGUE)
- Each hypothesis includes validation strategy (next_signals, hop_types)
- Yellow Panther service mapping for opportunity filtering

Usage:
    from backend.entity_type_dossier_questions import (
        get_questions_for_entity_type,
        generate_hypothesis_from_question,
        map_question_to_hop_types
    )

    # Get questions for a specific entity type
    questions = get_questions_for_entity_type("SPORT_CLUB")

    # Generate a hypothesis from a question
    hypothesis = generate_hypothesis_from_question(
        question=questions[0],
        entity_name="Arsenal FC",
        entity_id="arsenal-fc"
    )

    # Map question to discovery hop types
    hop_types = map_question_to_hop_types(questions[0])
"""

import logging
from typing import Dict, List, Optional, Any, Literal
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


# =============================================================================
# Yellow Panther Service Categories
# =============================================================================

class YPServiceCategory(str, Enum):
    """Yellow Panther service categories"""
    MOBILE_APPS = "MOBILE_APPS"
    DIGITAL_TRANSFORMATION = "DIGITAL_TRANSFORMATION"
    FAN_ENGAGEMENT = "FAN_ENGAGEMENT"
    ANALYTICS = "ANALYTICS"
    ECOMMERCE = "ECOMMERCE"
    UI_UX_DESIGN = "UI_UX_DESIGN"


class YPPositioningStrategy(str, Enum):
    """Yellow Panther positioning strategies based on signal type"""
    SOLUTION_PROVIDER = "SOLUTION_PROVIDER"  # For RFP signals
    STRATEGIC_PARTNER = "STRATEGIC_PARTNER"  # For digital initiatives
    CAPABILITY_PARTNER = "CAPABILITY_PARTNER"  # For hiring signals
    INNOVATION_PARTNER = "INNOVATION_PARTNER"  # For partnership seeking
    TRUSTED_ADVISOR = "TRUSTED_ADVISOR"  # For mutual connections


# =============================================================================
# Yellow Panther Profile
# =============================================================================

YELLOW_PANTHER_PROFILE = {
    "ideal_budget_range": "£80K-£500K",
    "ideal_timeline": "3-12 months",
    "team_size": "2-8 developers",
    "case_studies": {
        "team_gb": {
            "service": "MOBILE_APPS",
            "description": "Olympic mobile app delivery",
            "achievement": "STA Award 2024 winner",
            "budget": "~£300K",
            "relevance": "Shows Olympic-scale delivery capability"
        },
        "premier_padel": {
            "service": "DIGITAL_TRANSFORMATION",
            "description": "3-year strategic partnership",
            "achievement": "End-to-end digital transformation",
            "budget": "~£500K/year",
            "relevance": "Long-term federation partnership model"
        },
        "fiba_3x3": {
            "service": "FAN_ENGAGEMENT",
            "description": "FIBA 3×3 Basketball platform",
            "achievement": "Multi-federation engagement platform",
            "budget": "~£200K",
            "relevance": "Federation member management experience"
        },
        "isu": {
            "service": "ANALYTICS",
            "description": "International Skating Union data platform",
            "achievement": "Sports analytics implementation",
            "budget": "~£150K",
            "relevance": "International federation analytics"
        },
        "lnb": {
            "service": "MOBILE_APPS",
            "description": "Ligue Nationale de Basket mobile platform",
            "achievement": "French basketball federation app",
            "budget": "~£250K",
            "relevance": "Federation-wide mobile deployment"
        },
        "bnpp_paribas": {
            "service": "ECOMMERCE",
            "description": "BNP Paribas Open ticketing platform",
            "achievement": "Major event e-commerce delivery",
            "budget": "~£200K",
            "relevance": "High-volume ticketing/e-commerce"
        }
    },
    "competitive_differentiators": [
        "Wild Creativity × Boundless Technology approach",
        "Agile 2-8 developer team structure",
        "Proven sports industry experience",
        "Multi-federation partnership track record",
        "Olympic-scale delivery capability (Team GB)",
        "End-to-end digital transformation expertise"
    ]
}


# =============================================================================
# Question Template Data Structure
# =============================================================================

@dataclass
class QuestionTemplate:
    """
    A question template designed to generate testable hypotheses

    Attributes:
        question_id: Unique identifier for the question
        question: The actual question text (with {entity} placeholder)
        yp_service_fit: List of YP service categories that match
        budget_range: Expected budget range for this opportunity
        yp_advantage: Key YP advantage/case study for this question
        positioning_strategy: YP positioning strategy for this opportunity
        hypothesis_template: Template for generating hypothesis statement
        next_signals: What signals would validate this hypothesis
        hop_types: Which discovery hop types to use
        accept_criteria: What constitutes strong evidence
        confidence_boost: Prior confidence boost if evidence found
    """
    question_id: str
    question: str
    yp_service_fit: List[YPServiceCategory]
    budget_range: str
    yp_advantage: str
    positioning_strategy: YPPositioningStrategy
    hypothesis_template: str
    next_signals: List[str]
    hop_types: List[str]
    accept_criteria: str
    confidence_boost: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "question_id": self.question_id,
            "question": self.question,
            "yp_service_fit": [s.value for s in self.yp_service_fit],
            "budget_range": self.budget_range,
            "yp_advantage": self.yp_advantage,
            "positioning_strategy": self.positioning_strategy.value,
            "hypothesis_template": self.hypothesis_template,
            "next_signals": self.next_signals,
            "hop_types": self.hop_types,
            "accept_criteria": self.accept_criteria,
            "confidence_boost": self.confidence_boost
        }


# =============================================================================
# SPORT_CLUB Questions (7 questions)
# =============================================================================

SPORT_CLUB_QUESTIONS: List[QuestionTemplate] = [
    QuestionTemplate(
        question_id="sc_mobile_fan_platform",
        question="What mobile app or fan engagement platform investments are planned by {entity}?",
        yp_service_fit=[YPServiceCategory.MOBILE_APPS, YPServiceCategory.FAN_ENGAGEMENT],
        budget_range="£80K-£300K",
        yp_advantage="Team GB Olympic mobile app delivery, STA Award 2024 winner",
        positioning_strategy=YPPositioningStrategy.SOLUTION_PROVIDER,
        hypothesis_template="{entity} will issue mobile app RFP (£80K-£300K budget) within 6-18 months",
        next_signals=[
            "Job postings: Mobile Developer, iOS Developer, Product Manager - Mobile",
            "RFP keywords: mobile app, fan app, official app, React Native",
            "Announcements: Digital transformation initiatives, fan engagement strategy"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="Any mention of mobile platform development or fan app in official channels",
        confidence_boost=0.15
    ),
    QuestionTemplate(
        question_id="sc_digital_transformation",
        question="What digital transformation initiatives is {entity} undertaking or planning?",
        yp_service_fit=[YPServiceCategory.DIGITAL_TRANSFORMATION],
        budget_range="£150K-£500K",
        yp_advantage="3-year partnership track record (Premier Padel), end-to-end transformation expertise",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} is seeking digital transformation partner (£150K-£500K) for modernization project",
        next_signals=[
            "Job postings: CTO, CIO, Digital Transformation Manager, Cloud Architect",
            "Strategic announcements: Digital modernization, cloud migration, legacy system refresh",
            "Partnership announcements: Technology consulting partners"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "OFFICIAL_SITE"],
        accept_criteria="Mentions of modernization, cloud migration, or technology overhaul initiatives",
        confidence_boost=0.20
    ),
    QuestionTemplate(
        question_id="sc_ticketing_ecommerce",
        question="What ticketing or e-commerce pain points indicate replacement needs at {entity}?",
        yp_service_fit=[YPServiceCategory.ECOMMERCE, YPServiceCategory.FAN_ENGAGEMENT],
        budget_range="£80K-£250K",
        yp_advantage="BNP Paribas Open ticketing platform experience, high-volume e-commerce delivery",
        positioning_strategy=YPPositioningStrategy.SOLUTION_PROVIDER,
        hypothesis_template="{entity} will replace ticketing/e-commerce platform (£80K-£250K) within 12 months",
        next_signals=[
            "Fan complaints: Ticketing issues, checkout problems, mobile ticketing",
            "Job postings: E-commerce Manager, Head of Ticketing, CRM Manager",
            "Partnership changes: New ticketing provider partnerships"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="Evidence of ticketing issues or job postings for e-commerce roles",
        confidence_boost=0.15
    ),
    QuestionTemplate(
        question_id="sc_analytics_data_platform",
        question="What analytics or data platform needs does {entity} have for performance or fan insights?",
        yp_service_fit=[YPServiceCategory.ANALYTICS],
        budget_range="£100K-£400K",
        yp_advantage="ISU skating analytics platform, sports analytics expertise",
        positioning_strategy=YPPositioningStrategy.CAPABILITY_PARTNER,
        hypothesis_template="{entity} will invest in analytics/data platform (£100K-£400K) for performance/fan insights",
        next_signals=[
            "Job postings: Data Analyst, Data Engineer, BI Developer, Analytics Manager",
            "Partnerships: Analytics providers, BI platform announcements",
            "Strategic mentions: Data-driven decisions, fan insights, performance analytics"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "OFFICIAL_SITE"],
        accept_criteria="Job postings for analytics roles or data platform announcements",
        confidence_boost=0.12
    ),
    QuestionTemplate(
        question_id="sc_fan_engagement_gaps",
        question="What fan engagement strategy gaps or opportunities exist at {entity}?",
        yp_service_fit=[YPServiceCategory.FAN_ENGAGEMENT, YPServiceCategory.MOBILE_APPS],
        budget_range="£80K-£300K",
        yp_advantage="FIBA 3×3 fan engagement platform, multi-federation experience",
        positioning_strategy=YPPositioningStrategy.INNOVATION_PARTNER,
        hypothesis_template="{entity} will seek fan engagement solution (£80K-£300K) to improve supporter experience",
        next_signals=[
            "Season ticket holder feedback: Engagement complaints, communication issues",
            "Job postings: Fan Engagement Manager, Head of Supporter Services",
            "Initiatives: Fan experience programs, loyalty scheme launches"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "OFFICIAL_SITE"],
        accept_criteria="Fan engagement initiatives or related job postings",
        confidence_boost=0.10
    ),
    QuestionTemplate(
        question_id="sc_stadium_technology",
        question="What stadium or venue technology upgrades is {entity} planning?",
        yp_service_fit=[YPServiceCategory.MOBILE_APPS, YPServiceCategory.UI_UX_DESIGN, YPServiceCategory.ECOMMERCE],
        budget_range="£100K-£400K",
        yp_advantage="Olympic venue app experience, large-scale deployment capability",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} will upgrade stadium technology (£100K-£400K) for matchday experience",
        next_signals=[
            "Stadium announcements: WiFi upgrades, mobile ordering, seat upgrades",
            "Job postings: Stadium Technology Manager, Venue Operations Director",
            "Partnerships: Stadium technology providers, connectivity partners"
        ],
        hop_types=["PRESS_RELEASE", "CAREERS_PAGE", "RFP_PAGE"],
        accept_criteria="Stadium technology initiatives or related partnerships",
        confidence_boost=0.12
    ),
    QuestionTemplate(
        question_id="sc_legacy_replacement",
        question="What legacy system replacement signals is {entity} showing?",
        yp_service_fit=[YPServiceCategory.DIGITAL_TRANSFORMATION, YPServiceCategory.ANALYTICS],
        budget_range="£150K-£500K",
        yp_advantage="End-to-end digital transformation, legacy migration expertise",
        positioning_strategy=YPPositioningStrategy.SOLUTION_PROVIDER,
        hypothesis_template="{entity} will initiate legacy system replacement (£150K-£500K) within 6-12 months",
        next_signals=[
            "Partnership changes: Ending vendor relationships",
            "Strategic announcements: System modernization, platform migration",
            "Job postings: Migration specialists, system architects"
        ],
        hop_types=["PRESS_RELEASE", "RFP_PAGE", "CAREERS_PAGE"],
        accept_criteria="Evidence of vendor changes or modernization initiatives",
        confidence_boost=0.18
    )
]


# =============================================================================
# SPORT_FEDERATION Questions (6 questions)
# =============================================================================

SPORT_FEDERATION_QUESTIONS: List[QuestionTemplate] = [
    QuestionTemplate(
        question_id="sf_member_platform",
        question="What member federation management platform or mobile app initiatives are underway at {entity}?",
        yp_service_fit=[YPServiceCategory.MOBILE_APPS, YPServiceCategory.DIGITAL_TRANSFORMATION],
        budget_range="£150K-£500K",
        yp_advantage="Multi-federation partnerships (FIBA 3×3, ISU, LNB), Olympic scalability (170+ federations)",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} will seek member database/platform RFP (£150K-£500K) for federation management",
        next_signals=[
            "Job postings: CRM Manager, Member Services Director, Digital Platform Manager",
            "RFP keywords: member database, federation platform, CRM system",
            "Announcements: Strategic plan mentions, digital initiative announcements"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="Any mention of member system modernization or digital platform",
        confidence_boost=0.18
    ),
    QuestionTemplate(
        question_id="sf_officiating_tech",
        question="What officiating or technology projects is {entity} planning for major events?",
        yp_service_fit=[YPServiceCategory.ANALYTICS, YPServiceCategory.MOBILE_APPS],
        budget_range="£200K-£500K",
        yp_advantage="International federation experience (ISU officiating platform), event tech delivery",
        positioning_strategy=YPPositioningStrategy.INNOVATION_PARTNER,
        hypothesis_template="{entity} will issue AI officiating/platform RFP (£200K-£500K) before next major event",
        next_signals=[
            "Job postings: Officiating Technology Manager, Event Technology Director",
            "Event announcements: Technology trials, officiating system upgrades",
            "Partnerships: Technology providers for officiating/VAR systems"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="Job postings or announcements about officiating technology",
        confidence_boost=0.20
    ),
    QuestionTemplate(
        question_id="sf_certification_modernization",
        question="What digital certification or assessment systems is {entity} modernizing?",
        yp_service_fit=[YPServiceCategory.DIGITAL_TRANSFORMATION, YPServiceCategory.UI_UX_DESIGN],
        budget_range="£100K-£300K",
        yp_advantage="Federation certification platform experience, multi-language capability",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} will seek digital certification platform (£100K-£300K) for assessment modernization",
        next_signals=[
            "Job postings: Certification Manager, Assessment System Lead",
            "Initiatives: Digital assessment programs, online certification launches",
            "RFP mentions: Certification system, assessment platform"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "OFFICIAL_SITE"],
        accept_criteria="Digital certification or assessment system initiatives",
        confidence_boost=0.15
    ),
    QuestionTemplate(
        question_id="sf_event_management",
        question="What event management platform needs does {entity} have for competitions/championships?",
        yp_service_fit=[YPServiceCategory.ECOMMERCE, YPServiceCategory.MOBILE_APPS],
        budget_range="£100K-£400K",
        yp_advantage="Major event platform delivery (Olympic-scale), multi-event management",
        positioning_strategy=YPPositioningStrategy.SOLUTION_PROVIDER,
        hypothesis_template="{entity} will seek event management platform (£100K-£400K) for championship operations",
        next_signals=[
            "Job postings: Event Technology Manager, Championship Operations Lead",
            "Event announcements: New event formats, digital ticketing for events",
            "Partnerships: Event technology providers"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="Event management technology initiatives or partnerships",
        confidence_boost=0.15
    ),
    QuestionTemplate(
        question_id="sf_member_communication",
        question="What digital member communication or engagement platforms is {entity} implementing?",
        yp_service_fit=[YPServiceCategory.FAN_ENGAGEMENT, YPServiceCategory.MOBILE_APPS],
        budget_range="£80K-£250K",
        yp_advantage="FIBA 3×3 member engagement platform, federation communication tools",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} will implement member communication platform (£80K-£250K) for federation engagement",
        next_signals=[
            "Job postings: Communication Manager, Member Engagement Lead",
            "Initiatives: Member portal launches, communication strategy updates",
            "Platform announcements: Member apps, communication tools"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "OFFICIAL_SITE"],
        accept_criteria="Member communication or engagement platform initiatives",
        confidence_boost=0.12
    ),
    QuestionTemplate(
        question_id="sf_analytics_platform",
        question="What analytics or performance data platform is {entity} seeking for member federations?",
        yp_service_fit=[YPServiceCategory.ANALYTICS],
        budget_range="£150K-£400K",
        yp_advantage="ISU analytics platform, international federation data systems",
        positioning_strategy=YPPositioningStrategy.CAPABILITY_PARTNER,
        hypothesis_template="{entity} will invest in federation analytics platform (£150K-£400K) for member insights",
        next_signals=[
            "Job postings: Data Analyst, Analytics Manager, Performance Data Lead",
            "Strategic mentions: Data-driven member support, performance insights",
            "Partnerships: Analytics platform providers"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "OFFICIAL_SITE"],
        accept_criteria="Analytics platform initiatives or related job postings",
        confidence_boost=0.15
    )
]


# =============================================================================
# SPORT_LEAGUE Questions (5 questions)
# =============================================================================

SPORT_LEAGUE_QUESTIONS: List[QuestionTemplate] = [
    QuestionTemplate(
        question_id="sl_league_mobile_app",
        question="What league-wide mobile app or digital platform initiatives is {entity} pursuing?",
        yp_service_fit=[YPServiceCategory.MOBILE_APPS, YPServiceCategory.FAN_ENGAGEMENT],
        budget_range="£200K-£500K",
        yp_advantage="Olympic mobile app experience, multi-club deployment capability",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} will develop league-wide mobile platform (£200K-£500K) for fan engagement",
        next_signals=[
            "Job postings: Mobile Product Manager, League Digital Director",
            "League announcements: Mobile strategy, digital fan experience",
            "Club initiatives: Coordinated mobile efforts across clubs"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="League-wide mobile or digital platform announcements",
        confidence_boost=0.20
    ),
    QuestionTemplate(
        question_id="sl_digital_operations",
        question="What digital transformation of league operations is {entity} undertaking?",
        yp_service_fit=[YPServiceCategory.DIGITAL_TRANSFORMATION],
        budget_range="£200K-£500K",
        yp_advantage="Premier Padel 3-year transformation model, league operations expertise",
        positioning_strategy=YPPositioningStrategy.STRATEGIC_PARTNER,
        hypothesis_template="{entity} will seek digital operations transformation (£200K-£500K) for league efficiency",
        next_signals=[
            "Job postings: League Operations Director, Digital Transformation Lead",
            "Strategic announcements: Operations modernization, digital league management",
            "Club mandates: Digital requirements for member clubs"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "RFP_PAGE"],
        accept_criteria="League operations modernization initiatives",
        confidence_boost=0.18
    ),
    QuestionTemplate(
        question_id="sl_centralized_analytics",
        question="What centralized analytics or data platform is {entity} building for league and clubs?",
        yp_service_fit=[YPServiceCategory.ANALYTICS],
        budget_range="£150K-£400K",
        yp_advantage="ISU federation analytics, multi-club data platform experience",
        positioning_strategy=YPPositioningStrategy.CAPABILITY_PARTNER,
        hypothesis_template="{entity} will invest in centralized analytics platform (£150K-£400K) for league-wide insights",
        next_signals=[
            "Job postings: Head of Analytics, Data Platform Manager",
            "League initiatives: Data sharing, analytics for member clubs",
            "Partnerships: Analytics platform providers"
        ],
        hop_types=["CAREERS_PAGE", "PRESS_RELEASE", "RFP_PAGE"],
        accept_criteria="Centralized analytics or data platform initiatives",
        confidence_boost=0.15
    ),
    QuestionTemplate(
        question_id="sl_ecommerce_platform",
        question="What league-wide e-commerce or ticketing platform is {entity} developing?",
        yp_service_fit=[YPServiceCategory.ECOMMERCE],
        budget_range="£150K-£400K",
        yp_advantage="BNP Paribas Open ticketing experience, league-wide commerce",
        positioning_strategy=YPPositioningStrategy.SOLUTION_PROVIDER,
        hypothesis_template="{entity} will create unified e-commerce platform (£150K-£400K) for league merchandise/ticketing",
        next_signals=[
            "Job postings: E-commerce Director, Head of League Commerce",
            "League announcements: Unified shopping, league ticketing platform",
            "Club alignment: Standardized e-commerce across clubs"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="League-wide e-commerce or ticketing initiatives",
        confidence_boost=0.15
    ),
    QuestionTemplate(
        question_id="sl_broadcast_streaming",
        question="What broadcast or streaming enhancements is {entity} planning for content distribution?",
        yp_service_fit=[YPServiceCategory.MOBILE_APPS, YPServiceCategory.UI_UX_DESIGN],
        budget_range="£200K-£500K",
        yp_advantage="Streaming platform experience, mobile video delivery",
        positioning_strategy=YPPositioningStrategy.INNOVATION_PARTNER,
        hypothesis_template="{entity} will enhance broadcast/streaming platform (£200K-£500K) for digital content",
        next_signals=[
            "Job postings: Streaming Product Manager, Digital Content Lead",
            "Media announcements: OTT platform, direct-to-consumer streaming",
            "Partnerships: Streaming technology providers"
        ],
        hop_types=["RFP_PAGE", "CAREERS_PAGE", "PRESS_RELEASE"],
        accept_criteria="Streaming or broadcast platform initiatives",
        confidence_boost=0.15
    )
]


# =============================================================================
# Entity Type Question Registry
# =============================================================================

ENTITY_TYPE_QUESTIONS: Dict[str, List[QuestionTemplate]] = {
    "SPORT_CLUB": SPORT_CLUB_QUESTIONS,
    "SPORT_FEDERATION": SPORT_FEDERATION_QUESTIONS,
    "SPORT_LEAGUE": SPORT_LEAGUE_QUESTIONS,
    # Default to club questions for unknown types
    "DEFAULT": SPORT_CLUB_QUESTIONS
}


# =============================================================================
# Public API Functions
# =============================================================================

def get_questions_for_entity_type(
    entity_type: str,
    max_questions: Optional[int] = None
) -> List[QuestionTemplate]:
    """
    Get question templates for a specific entity type

    Args:
        entity_type: Entity type (SPORT_CLUB, SPORT_FEDERATION, SPORT_LEAGUE)
        max_questions: Optional limit on number of questions returned

    Returns:
        List of QuestionTemplate objects for this entity type
    """
    questions = ENTITY_TYPE_QUESTIONS.get(
        entity_type.upper(),
        ENTITY_TYPE_QUESTIONS["DEFAULT"]
    )

    if max_questions:
        questions = questions[:max_questions]

    logger.info(f"Retrieved {len(questions)} questions for entity type: {entity_type}")
    return questions


def generate_hypothesis_from_question(
    question: QuestionTemplate,
    entity_name: str,
    entity_id: str,
    additional_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate a hypothesis dictionary from a question template

    Args:
        question: QuestionTemplate to generate hypothesis from
        entity_name: Name of the entity
        entity_id: Entity identifier
        additional_context: Optional additional context for hypothesis

    Returns:
        Hypothesis dictionary with all required fields
    """
    # Format the hypothesis statement
    statement = question.hypothesis_template.format(entity=entity_name)

    # Create the hypothesis
    hypothesis = {
        "hypothesis_id": f"{entity_id}_{question.question_id}",
        "entity_id": entity_id,
        "entity_name": entity_name,
        "statement": statement,
        "category": question.question_id.split('_')[1],  # Extract category from ID
        "prior_probability": 0.50 + question.confidence_boost,  # Start above neutral
        "confidence": 0.50 + question.confidence_boost,
        "status": "ACTIVE",
        "metadata": {
            "source": "entity_type_question_template",
            "question_id": question.question_id,
            "yp_service_fit": [s.value for s in question.yp_service_fit],
            "budget_range": question.budget_range,
            "yp_advantage": question.yp_advantage,
            "positioning_strategy": question.positioning_strategy.value,
            "next_signals": question.next_signals,
            "hop_types": question.hop_types,
            "accept_criteria": question.accept_criteria,
            "confidence_boost": question.confidence_boost,
            **(additional_context or {})
        }
    }

    logger.info(
        f"Generated hypothesis: {hypothesis['hypothesis_id']} "
        f"(confidence: {hypothesis['confidence']:.2f}, "
        f"YP services: {', '.join(hypothesis['metadata']['yp_service_fit'])})"
    )

    return hypothesis


def map_question_to_hop_types(question: QuestionTemplate) -> List[str]:
    """
    Map a question to its discovery hop types

    Args:
        question: QuestionTemplate to map

    Returns:
        List of hop type strings for discovery
    """
    return question.hop_types


def score_entity_for_yp_service(
    question: QuestionTemplate,
    signal_evidence: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Score a signal against Yellow Panther service fit

    Args:
        question: QuestionTemplate with YP service fit
        signal_evidence: Evidence from discovery

    Returns:
        Scoring results with fit score and recommendations
    """
    # Check evidence against next_signals
    evidence_text = signal_evidence.get('content', '').lower()
    evidence_title = signal_evidence.get('title', '').lower()

    # Count matches
    matched_signals = []
    for signal in question.next_signals:
        signal_lower = signal.lower()
        if any(keyword in evidence_text or keyword in evidence_title
               for keyword in signal_lower.split()[:3]):  # Check first 3 words
            matched_signals.append(signal)

    # Calculate fit score
    match_ratio = len(matched_signals) / len(question.next_signals)
    fit_score = match_ratio * 100

    # Determine positioning
    positioning = question.positioning_strategy.value

    # Generate recommendations
    recommendations = []
    if fit_score >= 70:
        recommendations.append("Immediate outreach recommended")
        recommendations.append(f"Lead with: {question.yp_advantage}")
        recommendations.append(f"Positioning: {positioning}")
    elif fit_score >= 40:
        recommendations.append("Add to watch list")
        recommendations.append(f"Monitor for: {', '.join(question.next_signals[:2])}")
    else:
        recommendations.append("Low fit - monitor only")

    return {
        "fit_score": round(fit_score, 1),
        "positioning": positioning,
        "yp_services": [s.value for s in question.yp_service_fit],
        "budget_range": question.budget_range,
        "matched_signals": matched_signals,
        "recommendations": recommendations,
        "yp_advantage": question.yp_advantage
    }


def get_yp_service_summary() -> Dict[str, Any]:
    """
    Get Yellow Panther service summary for prompt context

    Returns:
        Dictionary with YP services, budgets, and case studies
    """
    return {
        "services": {
            "MOBILE_APPS": {
                "description": "iOS/Android, React Native, Flutter, native apps, fan apps",
                "budget_range": "£80K-£300K",
                "timeline": "3-6 months",
                "case_studies": ["team_gb", "lnb"]
            },
            "DIGITAL_TRANSFORMATION": {
                "description": "Modernization, cloud migration, legacy system upgrades",
                "budget_range": "£150K-£500K",
                "timeline": "6-12 months",
                "case_studies": ["premier_padel"]
            },
            "FAN_ENGAGEMENT": {
                "description": "Fan platforms, supporter experience, fan communication",
                "budget_range": "£80K-£300K",
                "timeline": "3-6 months",
                "case_studies": ["fiba_3x3", "isu"]
            },
            "ANALYTICS": {
                "description": "Data platforms, BI, reporting, sports analytics",
                "budget_range": "£100K-£400K",
                "timeline": "3-9 months",
                "case_studies": ["isu"]
            },
            "ECOMMERCE": {
                "description": "Ticketing, merchandise, retail platforms, hospitality",
                "budget_range": "£80K-£250K",
                "timeline": "3-6 months",
                "case_studies": ["bnpp_paribas"]
            },
            "UI_UX_DESIGN": {
                "description": "User experience, website redesign, app design",
                "budget_range": "£50K-£200K",
                "timeline": "2-4 months",
                "case_studies": []
            }
        },
        "positioning_strategies": {
            "SOLUTION_PROVIDER": "For RFP signals - respond to specific procurement needs",
            "STRATEGIC_PARTNER": "For digital initiatives - advisory relationship",
            "CAPABILITY_PARTNER": "For hiring signals - tool timing, scale with team",
            "INNOVATION_PARTNER": "For partnership seeking - co-creation mode",
            "TRUSTED_ADVISOR": "For mutual connections - referral mode"
        },
        "ideal_profile": {
            "budget_range": "£80K-£500K",
            "timeline": "3-12 months",
            "team_size": "2-8 developers"
        },
        "competitive_differentiators": YELLOW_PANTHER_PROFILE["competitive_differentiators"]
    }


def validate_contact_data(contact: Dict[str, Any]) -> tuple[bool, str]:
    """
    Validate contact data to ensure real data, not placeholders

    Args:
        contact: Contact dictionary to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    name = contact.get('name', '')

    # Check for placeholders
    placeholder_patterns = [
        '{', '}', '[', ']',
        'PRESIDENT', 'DIRECTOR', 'MANAGER',
        'FEDERATION', 'TECHNOLOGY'
    ]

    name_upper = name.upper()
    for pattern in placeholder_patterns:
        if pattern in name_upper:
            return False, f"Placeholder detected: {pattern}"

    # Check for minimum information
    if not contact.get('linkedin_url') and not contact.get('email'):
        return False, "No contact URL or email provided"

    # Check for generic titles
    title = contact.get('title', '').upper()
    generic_titles = ['DIRECTOR', 'MANAGER', 'HEAD']
    if title in generic_titles and not any(specifier in title for specifier in
                                          ['TECHNICAL', 'COMMERCIAL', 'DIGITAL', 'OPERATIONS']):
        return False, f"Generic title: {title}"

    return True, "Valid"


# =============================================================================
# Convenience Functions for Prompt Generation
# =============================================================================

def get_question_first_prompt_context(
    entity_type: str,
    entity_name: str
) -> str:
    """
    Generate prompt context for question-first dossier generation

    Args:
        entity_type: Type of entity
        entity_name: Name of entity

    Returns:
        Context string for LLM prompt
    """
    questions = get_questions_for_entity_type(entity_type)
    yp_summary = get_yp_service_summary()

    context = f"""
YELLOW PANTHER SERVICE CONTEXT:
- Services: {', '.join(yp_summary['services'].keys())}
- Ideal Budget: {yp_summary['ideal_profile']['budget_range']}
- Timeline: {yp_summary['ideal_profile']['timeline']}
- Team Size: {yp_summary['ideal_profile']['team_size']}

ENTITY TYPE: {entity_type}
ENTITY NAME: {entity_name}

QUESTIONS TO ANSWER (each generates a testable hypothesis):

"""

    for i, q in enumerate(questions, 1):
        context += f"""
{i}. {q.question.format(entity=entity_name)}
   → YP Services: {', '.join([s.value for s in q.yp_service_fit])}
   → Budget: {q.budget_range}
   → Positioning: {q.positioning_strategy.value}
   → Validate with: {', '.join(q.next_signals[:2])}
"""

    return context


def generate_hypothesis_batch(
    entity_type: str,
    entity_name: str,
    entity_id: str,
    max_questions: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Generate all hypotheses for an entity from question templates

    Args:
        entity_type: Type of entity
        entity_name: Name of entity
        entity_id: Entity identifier
        max_questions: Optional limit on hypotheses

    Returns:
        List of hypothesis dictionaries
    """
    questions = get_questions_for_entity_type(entity_type, max_questions)
    hypotheses = []

    for question in questions:
        hypothesis = generate_hypothesis_from_question(
            question=question,
            entity_name=entity_name,
            entity_id=entity_id
        )
        hypotheses.append(hypothesis)

    logger.info(f"Generated {len(hypotheses)} hypotheses for {entity_name} ({entity_type})")
    return hypotheses


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Classes
    'QuestionTemplate',
    'YPServiceCategory',
    'YPPositioningStrategy',

    # Data
    'ENTITY_TYPE_QUESTIONS',
    'SPORT_CLUB_QUESTIONS',
    'SPORT_FEDERATION_QUESTIONS',
    'SPORT_LEAGUE_QUESTIONS',
    'YELLOW_PANTHER_PROFILE',

    # Functions
    'get_questions_for_entity_type',
    'generate_hypothesis_from_question',
    'map_question_to_hop_types',
    'score_entity_for_yp_service',
    'get_yp_service_summary',
    'validate_contact_data',
    'get_question_first_prompt_context',
    'generate_hypothesis_batch'
]


# =============================================================================
# Example Usage
# =============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("Entity-Type Dossier Questions - Yellow Panther Integration")
    print("=" * 80)

    # Example 1: Get questions for a club
    print("\n1. SPORT_CLUB Questions:")
    print("-" * 80)
    club_questions = get_questions_for_entity_type("SPORT_CLUB", max_questions=3)
    for q in club_questions:
        print(f"\n  {q.question_id}")
        print(f"  Question: {q.question}")
        print(f"  YP Services: {', '.join([s.value for s in q.yp_service_fit])}")
        print(f"  Budget: {q.budget_range}")
        print(f"  Positioning: {q.positioning_strategy.value}")

    # Example 2: Generate hypothesis for Arsenal
    print("\n2. Generate Hypothesis for Arsenal FC:")
    print("-" * 80)
    hypothesis = generate_hypothesis_from_question(
        question=club_questions[0],
        entity_name="Arsenal FC",
        entity_id="arsenal-fc"
    )
    print(f"  ID: {hypothesis['hypothesis_id']}")
    print(f"  Statement: {hypothesis['statement']}")
    print(f"  Confidence: {hypothesis['confidence']:.2f}")
    print(f"  YP Services: {', '.join(hypothesis['metadata']['yp_service_fit'])}")

    # Example 3: Get YP service summary
    print("\n3. Yellow Panther Service Summary:")
    print("-" * 80)
    yp_summary = get_yp_service_summary()
    print(f"  Services: {', '.join(yp_summary['services'].keys())}")
    print(f"  Ideal Budget: {yp_summary['ideal_profile']['budget_range']}")

    # Example 4: Generate batch hypotheses
    print("\n4. Batch Hypothesis Generation:")
    print("-" * 80)
    hypotheses = generate_hypothesis_batch(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=5
    )
    print(f"  Generated {len(hypotheses)} hypotheses")
    for hyp in hypotheses[:3]:
        print(f"    - {hyp['statement'][:80]}...")

    print("\n" + "=" * 80)
    print("✅ All examples completed successfully")
    print("=" * 80)
