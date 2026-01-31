"""
Reason Likelihood Analyzer

Computes likelihood scores for WHY entities might issue RFPs.

This helps Yellow Panther understand:
1. What business problem is the entity solving?
2. How urgent is the problem?
3. What's the likelihood they'll buy YP services?
4. When should YP reach out?
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from enum import Enum


class ReasonCategory(str, Enum):
    """Categories of reasons for RFP issuance"""
    TECHNOLOGY_OBSOLESCENCE = "TECHNOLOGY_OBSOLESCENCE"
    COMPETITIVE_PRESSURE = "COMPETITIVE_PRESSURE"
    GROWTH_EXPANSION = "GROWTH_EXPANSION"
    REGULATORY_COMPLIANCE = "REGULATORY_COMPLIANCE"
    EXECUTIVE_CHANGE = "EXECUTIVE_CHANGE"
    FAN_DEMAND = "FAN_DEMAND"
    REVENUE_PRESSURE = "REVENUE_PRESSURE"
    OPERATIONAL_EFFICIENCY = "OPERATIONAL_EFFICIENCY"


class UrgencyLevel(str, Enum):
    """Urgency levels for RFPs"""
    CRITICAL = "CRITICAL"  # Immediate action required
    HIGH = "HIGH"         # Action within 1-3 months
    MEDIUM = "MEDIUM"     # Action within 3-6 months
    LOW = "LOW"           # Action within 6-12 months


class ReasonLikelihoodAnalyzer:
    """
    Analyze WHY entities issue RFPs with confidence scoring.

    Returns detailed reasoning with:
    - Primary reason + confidence
    - Secondary reasons + confidence
    - Urgency level
    - YP solution fit percentage
    - Timeline predictions (immediate, 3m, 6m, never)
    """

    # Reason definitions with keywords and patterns
    REASON_DEFINITIONS = {
        ReasonCategory.TECHNOLOGY_OBSOLESCENCE: {
            "name": "Technology Obsolescence",
            "description": "Legacy systems need replacement or modernization",
            "keywords": [
                "legacy", "obsolete", "outdated", "end of life", "end of support",
                "modernization", "upgrade", "replacement", "refresh", "migrate",
                "old system", "aging infrastructure", "technical debt"
            ],
            "yp_solution_fit": 0.92,  # YP excels at modernization
            "typical_urgency": UrgencyLevel.HIGH
        },
        ReasonCategory.COMPETITIVE_PRESSURE: {
            "name": "Competitive Pressure",
            "description": "Rivals upgrading technology or gaining advantage",
            "keywords": [
                "competitor", "rival", "competitive advantage", "catch up",
                "fall behind", "market leader", "industry standard",
                "peer comparison", "benchmarking"
            ],
            "yp_solution_fit": 0.75,
            "typical_urgency": UrgencyLevel.MEDIUM
        },
        ReasonCategory.GROWTH_EXPANSION: {
            "name": "Growth & Expansion",
            "description": "New markets, territories, or business lines",
            "keywords": [
                "expansion", "growth", "new market", "international", "global",
                "scale up", "new business line", "diversification", "enter market"
            ],
            "yp_solution_fit": 0.88,  # YP does scaling well
            "typical_urgency": UrgencyLevel.HIGH
        },
        ReasonCategory.REGULATORY_COMPLIANCE: {
            "name": "Regulatory Compliance",
            "description": "Legal or industry requirements",
            "keywords": [
                "compliance", "regulation", "gdpr", "data protection", "security",
                "legal requirement", "industry standard", "certification", "audit"
            ],
            "yp_solution_fit": 0.65,  # Not YP's core strength
            "typical_urgency": UrgencyLevel.CRITICAL
        },
        ReasonCategory.EXECUTIVE_CHANGE: {
            "name": "Executive Change",
            "description": "New CTO/Technical leadership driving change",
            "keywords": [
                "new cto", "new cio", "new leadership", "new director",
                "executive hire", "leadership change", "new c-level",
                "technical leadership", "digital chief"
            ],
            "yp_solution_fit": 0.85,  # New leaders often seek modern partners
            "typical_urgency": UrgencyLevel.MEDIUM
        },
        ReasonCategory.FAN_DEMAND: {
            "name": "Fan Demand",
            "description": "Supporter pressure for better experience",
            "keywords": [
                "fan experience", "supporter experience", "fan feedback", "fan demand",
                "season ticket", "supporter", "fan engagement", "fan satisfaction",
                "fan complaints", "fan expectations"
            ],
            "yp_solution_fit": 0.95,  # Core YP strength (fan engagement)
            "typical_urgency": UrgencyLevel.HIGH
        },
        ReasonCategory.REVENUE_PRESSURE: {
            "name": "Revenue Pressure",
            "description": "Need new monetization channels",
            "keywords": [
                "revenue", "monetization", "new income stream", "commercial",
                "sponsorship", "merchandising", "ticketing revenue", "commercialization"
            ],
            "yp_solution_fit": 0.82,
            "typical_urgency": UrgencyLevel.HIGH
        },
        ReasonCategory.OPERATIONAL_EFFICIENCY: {
            "name": "Operational Efficiency",
            "description": "Streamline business processes",
            "keywords": [
                "efficiency", "streamline", "automation", "operational",
                "business process", "workflow", "productivity", "cost reduction",
                "operational excellence", "process optimization"
            ],
            "yp_solution_fit": 0.78,
            "typical_urgency": UrgencyLevel.MEDIUM
        }
    }

    def __init__(self):
        """Initialize analyzer"""
        pass

    def analyze_reason_likelihood(
        self,
        signal: Dict,
        entity_context: Optional[Dict] = None
    ) -> Dict:
        """
        Analyze WHY this entity might issue an RFP.

        Args:
            signal: RFP signal with category, evidence, confidence
            entity_context: Entity information (tech stack, initiatives, etc.)

        Returns:
            {
                "primary_reason": "TECHNOLOGY_OBSOLESCENCE",
                "primary_name": "Technology Obsolescence",
                "primary_confidence": 0.85,
                "secondary_reasons": [
                    {"reason": "FAN_DEMAND", "name": "...", "confidence": 0.72}
                ],
                "urgency": "HIGH",
                "yp_solution_fit": 0.88,
                "timeline_prediction": {
                    "immediate": 0.15,
                    "3_months": 0.45,
                    "6_months": 0.30,
                    "never": 0.10
                },
                "evidence": [...],
                "recommendations": [...]
            }
        """
        # Extract content from evidence
        evidence = signal.get('evidence', [])
        content = self._extract_content(evidence)

        # Score each reason category
        reason_scores = {}
        for reason_cat, definition in self.REASON_DEFINITIONS.items():
            score = self._score_reason(content, definition, entity_context)
            reason_scores[reason_cat] = {
                "score": score,
                "definition": definition,
                "evidence": self._find_evidence(content, definition['keywords'])
            }

        # Sort by score
        sorted_reasons = sorted(
            reason_scores.items(),
            key=lambda x: x[1]['score'],
            reverse=True
        )

        # Primary reason
        primary_reason, primary_data = sorted_reasons[0]
        primary_confidence = min(1.0, primary_data['score'] / 10)

        # Secondary reasons (top 3 after primary)
        secondary_reasons = []
        for reason, data in sorted_reasons[1:4]:
            confidence = min(1.0, data['score'] / 10)
            if confidence >= 0.3:  # Only include if some confidence
                secondary_reasons.append({
                    "reason": reason.value,
                    "name": data['definition']['name'],
                    "confidence": confidence,
                    "evidence_count": len(data['evidence'])
                })

        # Determine urgency
        urgency = self._determine_urgency(
            primary_data['definition'],
            primary_confidence,
            signal.get('confidence', 0.7)
        )

        # Calculate YP solution fit
        yp_solution_fit = self._calculate_yp_fit(sorted_reasons)

        # Predict timeline
        timeline_prediction = self._predict_timeline(
            primary_confidence, urgency, yp_solution_fit, signal
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            primary_reason,
            primary_data['definition'],
            yp_solution_fit,
            urgency
        )

        return {
            "primary_reason": primary_reason.value,
            "primary_name": primary_data['definition']['name'],
            "primary_confidence": primary_confidence,
            "secondary_reasons": secondary_reasons,
            "urgency": urgency.value,
            "yp_solution_fit": yp_solution_fit,
            "timeline_prediction": timeline_prediction,
            "evidence": primary_data['evidence'][:5],  # Top 5 evidence items
            "recommendations": recommendations
        }

    def _extract_content(self, evidence: list) -> str:
        """Extract text content from evidence"""
        content_parts = []
        for item in evidence:
            if isinstance(item, dict):
                content_parts.append(item.get('content', ''))
                content_parts.append(item.get('snippet', ''))
            elif isinstance(item, str):
                content_parts.append(item)
        return ' '.join(content_parts).lower()

    def _score_reason(
        self,
        content: str,
        definition: Dict,
        entity_context: Optional[Dict]
    ) -> float:
        """
        Score a reason based on content match.

        Returns score from 0-10.
        """
        score = 0.0
        keywords = definition['keywords']

        # Count keyword matches
        matches = sum(1 for kw in keywords if kw.lower() in content)

        # Base score from matches
        score += matches * 2.0

        # Boost for strong indicators
        strong_indicators = ["urgent", "critical", "immediate", "required"]
        if any(ind in content for ind in strong_indicators):
            score += 2.0

        # Boost from entity context
        if entity_context:
            # Check if entity has legacy tech (supports obsolescence)
            if definition.get('name') == "Technology Obsolescence":
                current_tech = entity_context.get('current_tech_stack', [])
                if any('legacy' in tech.lower() or 'old' in tech.lower() for tech in current_tech):
                    score += 3.0

            # Check for new executive (supports executive change)
            if definition.get('name') == "Executive Change":
                recent_initiatives = entity_context.get('recent_initiatives', [])
                if any('new cto' in init.lower() or 'new cio' in init.lower()
                       for init in recent_initiatives):
                    score += 3.0

        return min(score, 10.0)

    def _find_evidence(self, content: str, keywords: list) -> list:
        """Find evidence snippets for keywords"""
        evidence = []
        content_lower = content.lower()

        for keyword in keywords:
            if keyword.lower() in content_lower:
                # Find surrounding context (simplified)
                start_idx = content_lower.find(keyword.lower())
                snippet_start = max(0, start_idx - 30)
                snippet_end = min(len(content), start_idx + len(keyword) + 30)
                snippet = content[snippet_start:snippet_end].strip()

                if snippet and snippet not in evidence:
                    evidence.append(snippet)

        return evidence[:5]  # Max 5 evidence items

    def _determine_urgency(
        self,
        definition: Dict,
        confidence: float,
        signal_confidence: float
    ) -> UrgencyLevel:
        """Determine urgency level"""
        typical_urgency = definition.get('typical_urgency', UrgencyLevel.MEDIUM)

        # Upgrade urgency if high confidence
        if confidence >= 0.8 and signal_confidence >= 0.85:
            return UrgencyLevel.CRITICAL

        # Downgrade urgency if low confidence
        if confidence < 0.5:
            return UrgencyLevel.LOW

        return typical_urgency

    def _calculate_yp_fit(self, sorted_reasons: list) -> float:
        """
        Calculate how well YP can solve this problem.

        Weighted average of top 3 reasons' fit scores.
        """
        if not sorted_reasons:
            return 0.7  # Neutral fit

        # Weight primary reason more heavily
        weights = [0.6, 0.3, 0.1]

        total_fit = 0.0
        total_weight = 0.0

        for i, (reason, data) in enumerate(sorted_reasons[:3]):
            weight = weights[i]
            fit = data['definition'].get('yp_solution_fit', 0.7)
            confidence = min(1.0, data['score'] / 10)

            # Adjust fit by confidence
            adjusted_fit = fit * confidence

            total_fit += adjusted_fit * weight
            total_weight += weight

        return total_fit / total_weight if total_weight > 0 else 0.7

    def _predict_timeline(
        self,
        primary_confidence: float,
        urgency: UrgencyLevel,
        yp_fit: float,
        signal: Dict
    ) -> Dict:
        """
        Predict buying timeline.

        Returns:
            {
                "immediate": 0.15,  # Already in vendor selection
                "3_months": 0.45,   # Q1 budget cycle
                "6_months": 0.30,   # Q2 planning
                "never": 0.10       # False positive
            }
        """
        # Base probabilities
        timeline = {
            "immediate": 0.05,
            "3_months": 0.30,
            "6_months": 0.40,
            "never": 0.25
        }

        # Adjust based on urgency
        if urgency == UrgencyLevel.CRITICAL:
            timeline['immediate'] += 0.20
            timeline['3_months'] += 0.15
            timeline['never'] -= 0.20
        elif urgency == UrgencyLevel.HIGH:
            timeline['3_months'] += 0.15
            timeline['never'] -= 0.10

        # Adjust based on confidence
        if primary_confidence >= 0.8:
            timeline['never'] -= 0.15
            timeline['3_months'] += 0.10
        elif primary_confidence < 0.5:
            timeline['never'] += 0.15
            timeline['immediate'] -= 0.05

        # Adjust based on YP fit
        if yp_fit >= 0.85:
            timeline['3_months'] += 0.10
            timeline['never'] -= 0.10

        # Adjust based on temporal multiplier
        temporal_multiplier = signal.get('temporal_multiplier', 1.0)
        if temporal_multiplier >= 1.30:
            timeline['immediate'] += 0.10
            timeline['3_months'] += 0.10
            timeline['never'] -= 0.10

        # Normalize to sum to 1.0
        total = sum(timeline.values())
        for key in timeline:
            timeline[key] = max(0, min(1.0, timeline[key] / total))

        return timeline

    def _generate_recommendations(
        self,
        primary_reason: ReasonCategory,
        definition: Dict,
        yp_fit: float,
        urgency: UrgencyLevel
    ) -> List[str]:
        """Generate action recommendations for YP"""
        recommendations = []

        # Timing recommendation
        if urgency == UrgencyLevel.CRITICAL:
            recommendations.append("Reach out immediately (within 24-48 hours)")
        elif urgency == UrgencyLevel.HIGH:
            recommendations.append("Reach out within 1-2 weeks")
        elif urgency == UrgencyLevel.MEDIUM:
            recommendations.append("Reach out within 1 month")
        else:
            recommendations.append("Add to watch list for Q2 outreach")

        # Approach recommendation
        if yp_fit >= 0.85:
            recommendations.append("Lead with relevant YP case studies (Team GB, Premier Padel)")
            recommendations.append("Position as strategic partner (not just vendor)")

        # Reason-specific recommendations
        if primary_reason == ReasonCategory.TECHNOLOGY_OBSOLESCENCE:
            recommendations.append("Emphasize modernization expertise and cloud migration")
            recommendations.append("Offer proof-of-concept for legacy system replacement")

        elif primary_reason == ReasonCategory.FAN_DEMAND:
            recommendations.append("Showcase fan engagement platform capabilities")
            recommendations.append("Highlight Team GB Olympic mobile app success (STA Award)")

        elif primary_reason == ReasonCategory.COMPETITIVE_PRESSURE:
            recommendations.append("Reference competitor implementations")
            recommendations.append("Emphasize speed to market and competitive advantage")

        elif primary_reason == ReasonCategory.GROWTH_EXPANSION:
            recommendations.append("Highlight scalability and international experience")
            recommendations.append("Showcase multi-federation partnerships (FIBA, ISU, LNB)")

        return recommendations


# Convenience function
def analyze_reason_likelihood(
    signal: Dict,
    entity_context: Optional[Dict] = None
) -> Dict:
    """
    Quick convenience function to analyze reason likelihood.

    Args:
        signal: RFP signal
        entity_context: Optional entity information

    Returns:
        Reason likelihood analysis
    """
    analyzer = ReasonLikelihoodAnalyzer()
    return analyzer.analyze_reason_likelihood(signal, entity_context)
