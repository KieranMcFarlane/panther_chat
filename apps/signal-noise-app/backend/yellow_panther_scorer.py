"""
Yellow Panther Fit Scorer

Scores RFP opportunities against Yellow Panther's ideal client profile
and service offerings for sports technology opportunities.

Yellow Panther Business Profile:
- Services: Mobile apps, digital transformation, fan engagement platforms
- Ideal projects: £80K-£500K, 3-12 months, 2-8 developers
- Major clients: Team GB, Premier Padel, LNB, ISU, FIBA 3×3
"""

from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum
import re


class ServiceCategory(str, Enum):
    """Yellow Panther service categories"""
    MOBILE_APPS = "MOBILE_APPS"
    DIGITAL_TRANSFORMATION = "DIGITAL_TRANSFORMATION"
    FAN_ENGAGEMENT = "FAN_ENGAGEMENT"
    ANALYTICS = "ANALYTICS"
    ECOMMERCE = "ECOMMERCE"
    UI_UX_DESIGN = "UI_UX_DESIGN"


class PriorityTier(str, Enum):
    """Opportunity priority tiers"""
    TIER_1 = "TIER_1"  # Critical: Immediate notification
    TIER_2 = "TIER_2"  # High: Within 1 hour
    TIER_3 = "TIER_3"  # Medium: Daily digest
    TIER_4 = "TIER_4"  # Low: Weekly summary


class BudgetAlignment(str, Enum):
    """Budget alignment with YP profile"""
    POOR = "POOR"          # < £50K or > £1M
    MARGINAL = "MARGINAL"  # £50K-£80K or £500K-£1M
    GOOD = "GOOD"          # £80K-£500K (ideal)
    PERFECT = "PERFECT"    # £150K-£300K (sweet spot)


class YellowPantherFitScorer:
    """
    Scores RFP opportunities against Yellow Panther's ideal client profile.

    Scoring Criteria:
    1. Service Match (40 points): Does RFP need YP services?
    2. Budget Alignment (25 points): £80K-£500K range?
    3. Timeline Fit (15 points): 3-12 months?
    4. Entity Size (10 points): Not too big (like Man United)?
    5. Geographic Fit (10 points): UK/Europe preference?
    """

    # Yellow Panther service keywords
    YP_SERVICE_KEYWORDS = {
        ServiceCategory.MOBILE_APPS: [
            "mobile app", "ios", "android", "app development",
            "native app", "hybrid app", "react native", "flutter",
            "mobile application", "official app", "fan app"
        ],
        ServiceCategory.DIGITAL_TRANSFORMATION: [
            "digital transformation", "modernization", "cloud migration",
            "legacy system", "system upgrade", "technology overhaul",
            "digital platform", "tech stack refresh"
        ],
        ServiceCategory.FAN_ENGAGEMENT: [
            "fan engagement", "fan platform", "supporter experience",
            "fan experience", "supporter platform", "fan interaction",
            "season ticket holder", "fan loyalty", "fan communication"
        ],
        ServiceCategory.ANALYTICS: [
            "analytics", "data platform", "bi", "reporting",
            "business intelligence", "data analytics", "performance analytics",
            "sports analytics", "player analytics"
        ],
        ServiceCategory.ECOMMERCE: [
            "e-commerce", "ticketing", "shop", "merchandise",
            "online store", "retail platform", "ticketing platform",
            "hospitality", "vip sales"
        ],
        ServiceCategory.UI_UX_DESIGN: [
            "ui/ux", "user experience", "user interface", "design",
            "website redesign", "app design", "digital design"
        ]
    }

    # Budget range indicators
    BUDGET_INDICATORS = {
        "LOW": ["small project", "micro", "startup", "budget-friendly"],
        "MEDIUM": ["enterprise", "organization", "professional"],
        "HIGH": ["strategic", "multi-year", "transformation", "platform", "major"]
    }

    # Entity size tiers (based on club/league reputation)
    ENTITY_SIZE_WEIGHTS = {
        "elite_top": 0.3,      # Man United, Real Madrid, etc. (too big)
        "elite_high": 0.6,     # Arsenal, Chelsea, Barcelona (good)
        "elite_mid": 1.0,      # Tottenham, Liverpool, Juventus (ideal)
        "championship": 1.0,   # Championship clubs (ideal)
        "league_one": 0.9,     # League One (good)
        "lower_league": 0.7,   # Lower leagues (acceptable)
        "international": 1.0,  # International federations (ideal)
        "default": 0.8
    }

    # Geographic preference (UK/Europe preferred)
    GEOGRAPHIC_WEIGHTS = {
        "UK": 1.0,
        "Europe": 1.0,
        "North America": 0.8,
        "South America": 0.7,
        "Asia": 0.6,
        "Africa": 0.6,
        "Oceania": 0.6,
        "default": 0.7
    }

    def __init__(self):
        """Initialize the scorer with YP business profile"""
        self.yp_clients = {
            "team_gb": "Team GB - Olympic mobile app",
            "premier_padel": "Premier Padel - 3-year partnership",
            "lnb": "Ligue Nationale de Basket",
            "isu": "International Skating Union",
            "fiba_3x3": "FIBA 3×3 Basketball",
            "bnpp_paribas": "BNP Paribas Open"
        }

    def score_opportunity(
        self,
        signal: Dict,
        entity_context: Optional[Dict] = None
    ) -> Dict:
        """
        Score RFP signal against Yellow Panther profile.

        Args:
            signal: RFP signal with category, evidence, confidence
            entity_context: Entity information (name, type, country, size)

        Returns:
            {
                "fit_score": 0-100,
                "priority": "TIER_1/TIER_2/TIER_3/TIER_4",
                "budget_alignment": "POOR/MARGINAL/GOOD/PERFECT",
                "service_alignment": ["MOBILE_APPS", "FAN_ENGAGEMENT"],
                "scores": {
                    "service_match": 0-40,
                    "budget": 0-25,
                    "timeline": 0-15,
                    "entity_size": 0-10,
                    "geographic": 0-10
                },
                "recommended_actions": [...],
                "yp_advantages": [...]
            }
        """
        # Extract signal data
        category = signal.get('signal_category', '')
        evidence = signal.get('evidence', [])
        confidence = signal.get('confidence', 0.7)
        content = self._extract_content_from_evidence(evidence)

        # Score each criterion
        scores = {
            "service_match": self._score_service_match(category, content),
            "budget": self._score_budget_alignment(content),
            "timeline": self._score_timeline_fit(content),
            "entity_size": self._score_entity_size(entity_context),
            "geographic": self._score_geographic_fit(entity_context)
        }

        # Calculate total fit score
        fit_score = sum(scores.values())

        # Determine priority tier and budget alignment
        priority = self._determine_priority_tier(fit_score, confidence, signal)
        budget_alignment = self._determine_budget_alignment(scores['budget'])

        # Identify matching services
        service_alignment = self._identify_matching_services(category, content)

        # Generate recommendations and advantages
        recommended_actions = self._generate_recommendations(
            fit_score, service_alignment, entity_context
        )
        yp_advantages = self._identify_yp_advantages(service_alignment)

        return {
            "fit_score": round(fit_score, 1),
            "priority": priority,
            "budget_alignment": budget_alignment,
            "service_alignment": service_alignment,
            "scores": scores,
            "recommended_actions": recommended_actions,
            "yp_advantages": yp_advantages,
            "timestamp": datetime.now().isoformat()
        }

    def _extract_content_from_evidence(self, evidence: List[Dict]) -> str:
        """Extract text content from evidence items"""
        content_parts = []
        for item in evidence:
            if isinstance(item, dict):
                content_parts.append(item.get('content', ''))
                content_parts.append(item.get('snippet', ''))
                content_parts.append(item.get('title', ''))
            elif isinstance(item, str):
                content_parts.append(item)
        return ' '.join(content_parts).lower()

    def _score_service_match(self, category: str, content: str) -> float:
        """
        Score service match (40 points max).

        Checks if RFP needs YP services based on category and content keywords.
        """
        score = 0.0
        content_lower = content.lower()
        category_lower = category.lower()

        # Check each YP service category
        matched_services = []
        for service, keywords in self.YP_SERVICE_KEYWORDS.items():
            # Check category match
            category_match = any(
                kw in category_lower for kw in keywords
            )

            # Check content match
            content_matches = sum(
                1 for kw in keywords if kw in content_lower
            )

            # Score based on matches
            if category_match and content_matches >= 2:
                score += 40  # Perfect match
                matched_services.append(service)
            elif content_matches >= 3:
                score += 35  # Strong content match
                matched_services.append(service)
            elif category_match or content_matches >= 1:
                score += 20  # Partial match
                if category_match or content_matches >= 2:
                    matched_services.append(service)

        return min(score, 40.0)

    def _score_budget_alignment(self, content: str) -> float:
        """
        Score budget alignment (25 points max).

        £80K-£500K is ideal range for YP.
        """
        score = 12.5  # Neutral score

        content_lower = content.lower()

        # Look for budget indicators
        has_high_indicators = any(
            ind in content_lower for ind in self.BUDGET_INDICATORS["HIGH"]
        )
        has_medium_indicators = any(
            ind in content_lower for ind in self.BUDGET_INDICATORS["MEDIUM"]
        )
        has_low_indicators = any(
            ind in content_lower for ind in self.BUDGET_INDICATORS["LOW"]
        )

        # Score based on indicators
        if has_high_indicators and not has_low_indicators:
            score = 25.0  # Likely in good range
        elif has_medium_indicators:
            score = 20.0  # Probably acceptable
        elif has_low_indicators:
            score = 5.0   # Too small

        return score

    def _score_timeline_fit(self, content: str) -> float:
        """
        Score timeline fit (15 points max).

        YP ideal: 3-12 months.
        """
        score = 7.5  # Neutral score
        content_lower = content.lower()

        # Look for timeline indicators
        # Short timelines (< 3 months)
        short_indicators = ["urgent", "immediate", "asap", "quick"]
        has_short = any(ind in content_lower for ind in short_indicators)

        # Ideal timelines (3-12 months)
        ideal_indicators = [
            "3 month", "4 month", "5 month", "6 month",
            "quarter", "3-6 month", "6-12 month", "months"
        ]
        has_ideal = any(ind in content_lower for ind in ideal_indicators)

        # Long timelines (> 12 months)
        long_indicators = ["multi-year", "18 month", "24 month", "year"]
        has_long = any(ind in content_lower for ind in long_indicators)

        # Score based on timeline
        if has_ideal:
            score = 15.0  # Perfect fit
        elif has_long:
            score = 10.0  # Acceptable but long
        elif has_short:
            score = 5.0   # Too short

        return score

    def _score_entity_size(self, entity_context: Optional[Dict]) -> float:
        """
        Score entity size fit (10 points max).

        Not too big (like Man United), not too small.
        """
        if not entity_context:
            return 8.0  # Default neutral score

        entity_name = entity_context.get('name', '').lower()
        entity_type = entity_context.get('type', '').lower()

        # Elite top clubs (too big for typical YP projects)
        elite_top = ['manchester united', 'real madrid', 'fc barcelona', 'bayern munich']
        if any(club in entity_name for club in elite_top):
            return 3.0  # Too big

        # Elite high clubs (good but challenging)
        elite_high = ['arsenal', 'chelsea', 'liverpool', 'man city', 'psg']
        if any(club in entity_name for club in elite_high):
            return 6.0

        # Elite mid clubs (ideal)
        elite_mid = ['tottenham', 'juventus', 'atlético madrid', 'inter milan']
        if any(club in entity_name for club in elite_mid):
            return 10.0

        # International federations (ideal)
        if entity_type in ['international', 'federation', 'olympic']:
            return 10.0

        # Default
        return 8.0

    def _score_geographic_fit(self, entity_context: Optional[Dict]) -> float:
        """
        Score geographic fit (10 points max).

        UK/Europe preferred.
        """
        if not entity_context:
            return 7.0  # Default neutral

        country = entity_context.get('country', '').lower()

        # UK countries
        if country in ['uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland']:
            return 10.0

        # Europe
        european_countries = [
            'france', 'spain', 'germany', 'italy', 'portugal',
            'netherlands', 'belgium', 'switzerland', 'austria'
        ]
        if country in european_countries:
            return 10.0

        # North America
        if country in ['usa', 'united states', 'canada']:
            return 8.0

        return 7.0

    def _determine_priority_tier(
        self,
        fit_score: float,
        confidence: float,
        signal: Dict
    ) -> PriorityTier:
        """
        Determine priority tier based on fit score and confidence.

        TIER_1 (Critical): fit_score >= 90, confidence >= 0.85
        TIER_2 (High): fit_score >= 70, confidence >= 0.75
        TIER_3 (Medium): fit_score >= 50, confidence >= 0.70
        TIER_4 (Low): Everything else
        """
        temporal_multiplier = signal.get('temporal_multiplier', 1.0)

        if fit_score >= 90 and confidence >= 0.85 and temporal_multiplier >= 1.30:
            return PriorityTier.TIER_1
        elif fit_score >= 70 and confidence >= 0.75 and temporal_multiplier >= 1.15:
            return PriorityTier.TIER_2
        elif fit_score >= 50 and confidence >= 0.70:
            return PriorityTier.TIER_3
        else:
            return PriorityTier.TIER_4

    def _determine_budget_alignment(self, budget_score: float) -> BudgetAlignment:
        """Convert budget score to alignment category"""
        if budget_score >= 22:
            return BudgetAlignment.PERFECT
        elif budget_score >= 18:
            return BudgetAlignment.GOOD
        elif budget_score >= 10:
            return BudgetAlignment.MARGINAL
        else:
            return BudgetAlignment.POOR

    def _identify_matching_services(
        self,
        category: str,
        content: str
    ) -> List[str]:
        """Identify which YP services match the RFP"""
        matched = []
        content_lower = content.lower()
        category_lower = category.lower()

        for service, keywords in self.YP_SERVICE_KEYWORDS.items():
            if any(kw in category_lower or kw in content_lower for kw in keywords):
                matched.append(service.value)

        return matched

    def _generate_recommendations(
        self,
        fit_score: float,
        service_alignment: List[str],
        entity_context: Optional[Dict]
    ) -> List[str]:
        """Generate recommended actions for Yellow Panther"""
        recommendations = []

        if fit_score >= 80:
            recommendations.append("Immediate outreach recommended")
            recommendations.append("Lead with relevant case studies (Team GB, Premier Padel)")
            recommendations.append("Schedule discovery call this week")

            if "MOBILE_APPS" in service_alignment:
                recommendations.append("Highlight Olympic mobile app success (STA Award 2024)")

            if "FAN_ENGAGEMENT" in service_alignment:
                recommendations.append("Showcase fan engagement platform capabilities")

        elif fit_score >= 60:
            recommendations.append("Reach out within 1-2 weeks")
            recommendations.append("Research entity's current technology stack")
            recommendations.append("Prepare tailored proposal")

        else:
            recommendations.append("Monitor for additional signals")
            recommendations.append("Add to watch list for future opportunities")

        return recommendations

    def _identify_yp_advantages(self, service_alignment: List[str]) -> List[str]:
        """Identify YP's competitive advantages for this opportunity"""
        advantages = []

        if "MOBILE_APPS" in service_alignment:
            advantages.append("Proven Olympic mobile app delivery (Team GB)")
            advantages.append("STA Award 2024 winner for mobile innovation")

        if "FAN_ENGAGEMENT" in service_alignment:
            advantages.append("Deep sports industry experience")
            advantages.append("Multi-sport federation partnerships (FIBA, ISU, LNB)")

        if "DIGITAL_TRANSFORMATION" in service_alignment:
            advantages.append("End-to-end digital transformation expertise")
            advantages.append("3-year partnership track record (Premier Padel)")

        if not advantages:
            advantages.append("Wild Creativity × Boundless Technology approach")
            advantages.append("Agile 2-8 developer team structure")

        return advantages


# Convenience function for quick scoring
def score_yp_fit(signal: Dict, entity_context: Optional[Dict] = None) -> Dict:
    """
    Quick convenience function to score a signal against YP profile.

    Args:
        signal: RFP signal dictionary
        entity_context: Optional entity information

    Returns:
        Fit scoring results
    """
    scorer = YellowPantherFitScorer()
    return scorer.score_opportunity(signal, entity_context)
