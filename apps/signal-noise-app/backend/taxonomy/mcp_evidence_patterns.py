#!/usr/bin/env python3
"""
MCP Evidence Type Taxonomy

Extracted from BrightData MCP + Claude Code discovery success patterns.

Based on analysis of 4 MCP discovery summaries:
- World Athletics: 0.95 confidence (5 ACCEPT + temporal bonuses)
- Arsenal FC: 0.90 confidence (3 ACCEPT + temporal bonuses)
- ICF: 0.85 confidence (4 ACCEPT + bonuses)
- Aston Villa: 0.88 confidence (4 ACCEPT + bonuses)

Key insight: MCP achieves 9-15× higher confidence than hypothesis-driven
by detecting high-value direct signals (major partnerships, recent deployments)
rather than weak operational signals (Kit Assistant roles).

Usage:
    from taxonomy.mcp_evidence_patterns import MCP_EVIDENCE_TYPES, match_evidence_type

    # Detect evidence type from content
    content = "NTT Data multi-year partnership for digital transformation"
    matches = match_evidence_type(content)
    # Returns: {"type": "multi_year_partnership", "confidence": 0.15, "bonus": 0.05}
"""

import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

# =============================================================================
# Evidence Type Taxonomy (MCP-Derived)
# =============================================================================

class SignalType(str, Enum):
    """Signal type from Ralph decision system"""
    ACCEPT = "ACCEPT"           # Strong procurement intent
    WEAK_ACCEPT = "WEAK_ACCEPT" # Capability but unclear intent
    REJECT = "REJECT"           # Evidence contradicts hypothesis
    NO_PROGRESS = "NO_PROGRESS" # No relevant evidence


@dataclass
class TemporalBonus:
    """Temporal scoring bonus for recent/old signals"""
    within_6_months: float = 0.05
    within_12_months: float = 0.03
    older: float = 0.0


@dataclass
class OpportunityBonus:
    """Opportunity bonus for legacy systems (replacement opportunities)"""
    ten_plus_years: float = 0.10
    seven_to_ten_years: float = 0.05
    five_to_seven_years: float = 0.02
    recent: float = 0.0


@dataclass
class EvidenceType:
    """
    Evidence type definition with patterns and scoring

    Attributes:
        type_id: Unique identifier (e.g., "multi_year_partnership")
        patterns: Regex patterns to detect this evidence type
        signal: Ralph decision type (ACCEPT/WEAK_ACCEPT)
        base_confidence: Base confidence contribution
        temporal_bonus: Optional bonus for recency
        opportunity_bonus: Optional bonus for legacy age
        examples: Real examples from MCP discoveries
    """
    type_id: str
    patterns: List[str]
    signal: SignalType
    base_confidence: float
    temporal_bonus: Optional[TemporalBonus] = None
    opportunity_bonus: Optional[OpportunityBonus] = None
    examples: List[str] = None

    def __post_init__(self):
        if self.examples is None:
            self.examples = []


# MCP Evidence Types (extracted from 4 discovery summaries)
MCP_EVIDENCE_TYPES: Dict[str, EvidenceType] = {

    # -------------------------------------------------------------------------
    # 1. MAJOR PARTNERSHIPS (Highest Value)
    # -------------------------------------------------------------------------
    "multi_year_partnership": EvidenceType(
        type_id="multi_year_partnership",
        patterns=[
            r"multi-year.*?partnership",  # More flexible: allows words between
            r"\d+-year\s+(?:partnership|deal|agreement)",
            r"long-term\s+(?:partnership|agreement)",
            r"strategic\s+partnership"
        ],
        signal=SignalType.ACCEPT,
        base_confidence=0.15,  # Each major partnership worth +0.15
        examples=[
            "Deloitte 6-year digital transformation partnership (World Athletics)",
            "NTT Data multi-year digital transformation (Arsenal)",
            "Tata Communications 5-year broadcasting deal (World Athletics)"
        ]
    ),

    # -------------------------------------------------------------------------
    # 2. TECHNOLOGY DEPLOYMENTS (High Value)
    # -------------------------------------------------------------------------
    "recent_deployment": EvidenceType(
        type_id="recent_deployment",
        patterns=[
            r"deploys?\s+(?:customer\s+experience|digital\s+transformation)",
            r"digital\s+transformation\s+systems?\s+deployment",
            r"implementation\s+completed",
            r"recently\s+deployed",
            r"deployed\s+(?:new|fresh)"
        ],
        signal=SignalType.ACCEPT,
        base_confidence=0.12,
        temporal_bonus=TemporalBonus(
            within_6_months=0.05,
            within_12_months=0.03,
            older=0.0
        ),
        examples=[
            "Arsenal deploys customer experience systems (July 2025)",
            "Computer Weekly: Arsenal adding digital transformation firepower"
        ]
    ),

    # -------------------------------------------------------------------------
    # 3. PLATFORM CONFIRMATIONS (Medium-High Value)
    # -------------------------------------------------------------------------
    "confirmed_platform": EvidenceType(
        type_id="confirmed_platform",
        patterns=[
            r"uses?\s+\w+\s+for",
            r"deployed\s+\w+",
            r"\w+\s+implementation",
            r"powered\s+by\s+\w+",
            r"built\s+on\s+\w+"
        ],
        signal=SignalType.ACCEPT,
        base_confidence=0.10,
        opportunity_bonus=OpportunityBonus(
            ten_plus_years=0.10,
            seven_to_ten_years=0.05,
            five_to_seven_years=0.02,
            recent=0.0
        ),
        examples=[
            "Arsenal uses SAP Hybris for e-commerce (since 2017, 7+ years old)",
            "World Athletics Fan Data Platform (Deloitte)"
        ]
    ),

    # -------------------------------------------------------------------------
    # 4. DIGITAL LEADERSHIP ROLES (Medium Value)
    # -------------------------------------------------------------------------
    "technology_leadership": EvidenceType(
        type_id="technology_leadership",
        patterns=[
            r"head\s+of\s+digital",
            r"head\s+of\s+technology",
            r"chief\s+digital\s+officer",
            r"head\s+of\s+operational\s+technology",
            r"CTO",
            r"CIO"
        ],
        signal=SignalType.WEAK_ACCEPT,
        base_confidence=0.03,
        examples=[
            "John Maguire - Head of Operational Technology, Arsenal FC (25+ years experience)",
            "Head of Digital Media - World Athletics"
        ]
    ),

    # -------------------------------------------------------------------------
    # 5. TECHNOLOGY COLLABORATIONS (Medium Value)
    # -------------------------------------------------------------------------
    "tech_collaboration": EvidenceType(
        type_id="tech_collaboration",
        patterns=[
            r"technology.*?collaboration",  # More flexible
            r"innovation.*?collaboration",
            r"strategic\s+partnership",
            r"technology.*?integration.*?partner",
            r"technical\s+alliance"
        ],
        signal=SignalType.WEAK_ACCEPT,
        base_confidence=0.02,
        examples=[
            "TDK technology collaboration (World Athletics)",
            "RUN X™ with Technogym (World Athletics)"
        ]
    ),

    # -------------------------------------------------------------------------
    # 6. LEGACY SYSTEMS (Opportunity Detection)
    # -------------------------------------------------------------------------
    "legacy_system": EvidenceType(
        type_id="legacy_system",
        patterns=[
            r"bespoke\s+\w+",
            r"installed\s+(?:in|since)\s+\d{4}",
            r"since\s+\d{4}",
            r"legacy\s+\w+",
            r"\d{4}\s+(?:deployment|implementation|install)"
        ],
        signal=SignalType.WEAK_ACCEPT,
        base_confidence=0.02,
        opportunity_bonus=OpportunityBonus(
            ten_plus_years=0.08,
            seven_to_ten_years=0.05,
            five_to_seven_years=0.02,
            recent=0.0
        ),
        examples=[
            "Bespoke IBM CRM system installed (Arsenal, 2013 = 12+ years old, +0.10 opportunity bonus)",
            "SAP Hybris (Arsenal, 2017 = 7+ years old, +0.05 opportunity bonus)"
        ]
    ),

    # -------------------------------------------------------------------------
    # 7. PROCUREMENT ROLES (RFP-Specific)
    # -------------------------------------------------------------------------
    "procurement_role": EvidenceType(
        type_id="procurement_role",
        patterns=[
            r"procurement\s+manager",
            r"head\s+of\s+procurement",
            r"commercial\s+manager",
            r"sourcing\s+lead",
            r"vendor\s+manager",
            r"procurement\s+officer"
        ],
        signal=SignalType.WEAK_ACCEPT,
        base_confidence=0.02,
        examples=[
            "Head of Procurement - indicates centralized procurement process",
            "Commercial Manager - vendor management responsibility"
        ]
    ),

    # -------------------------------------------------------------------------
    # 8. RFP LANGUAGE (RFP-Specific, High Value)
    # -------------------------------------------------------------------------
    "rfp_language": EvidenceType(
        type_id="rfp_language",
        patterns=[
            r"issued\s+(?:an\s+)?RFP",
            r"request\s+for\s+proposal",
            r"tender\s+(?:issued|released|published)",
            r"seeking\s+proposals?",
            r"supplier\s+(?:solicitation|selection)",
            r"vendor\s+(?:evaluation|assessment)"
        ],
        signal=SignalType.ACCEPT,
        base_confidence=0.08,
        examples=[
            "Club issued RFP for CRM system",
            "Tender released for fan engagement platform"
        ]
    )
}


# =============================================================================
# Pattern Matching Functions
# =============================================================================

def match_evidence_type(
    content: str,
    extract_metadata: bool = True
) -> List[Dict[str, Any]]:
    """
    Match content against MCP evidence type patterns

    Args:
        content: Text content to analyze (e.g., scraped webpage, job description)
        extract_metadata: Whether to extract metadata (years, dates, etc.)

    Returns:
        List of matched evidence types with confidence scores and bonuses

    Example:
        content = "NTT Data multi-year partnership for digital transformation since 2017"
        matches = match_evidence_type(content)
        # Returns: [
        #   {
        #     "type": "multi_year_partnership",
        #     "base_confidence": 0.15,
        #     "signal": "ACCEPT",
        #     "matched_pattern": "multi-year partnership",
        #     "temporal_bonus": 0.0,
        #     "opportunity_bonus": 0.05  # 7+ years old
        #   }
        # ]
    """
    matches = []

    content_lower = content.lower()

    for type_id, evidence_type in MCP_EVIDENCE_TYPES.items():
        for pattern in evidence_type.patterns:
            if re.search(pattern, content_lower, re.IGNORECASE):
                # Extract metadata if requested
                metadata = {}
                temporal_bonus = 0.0
                opportunity_bonus = 0.0

                if extract_metadata:
                    # Extract years for temporal/opportunity bonuses
                    years = re.findall(r'\b(19|20)\d{2}\b', content)
                    if years:
                        metadata['years'] = years

                        # Calculate temporal bonus (recent deployments)
                        if evidence_type.temporal_bonus:
                            current_year = 2026  # Update as needed
                            most_recent = max(int(y) for y in years)
                            years_ago = current_year - most_recent

                            if years_ago <= 0.5:  # Within 6 months
                                temporal_bonus = evidence_type.temporal_bonus.within_6_months
                            elif years_ago <= 1:  # Within 12 months
                                temporal_bonus = evidence_type.temporal_bonus.within_12_months

                        # Calculate opportunity bonus (legacy systems)
                        if evidence_type.opportunity_bonus:
                            current_year = 2026
                            oldest = min(int(y) for y in years)
                            years_old = current_year - oldest

                            if years_old >= 10:
                                opportunity_bonus = evidence_type.opportunity_bonus.ten_plus_years
                            elif years_old >= 7:
                                opportunity_bonus = evidence_type.opportunity_bonus.seven_to_ten_years
                            elif years_old >= 5:
                                opportunity_bonus = evidence_type.opportunity_bonus.five_to_seven_years

                matches.append({
                    "type": type_id,
                    "base_confidence": evidence_type.base_confidence,
                    "signal": evidence_type.signal.value,
                    "matched_pattern": pattern,
                    "temporal_bonus": temporal_bonus,
                    "opportunity_bonus": opportunity_bonus,
                    "total_confidence": evidence_type.base_confidence + temporal_bonus + opportunity_bonus,
                    "metadata": metadata
                })

    return matches


def get_evidence_type(type_id: str) -> Optional[EvidenceType]:
    """
    Get evidence type definition by ID

    Args:
        type_id: Evidence type identifier

    Returns:
        EvidenceType or None if not found
    """
    return MCP_EVIDENCE_TYPES.get(type_id)


def get_high_value_evidence_types() -> List[str]:
    """
    Get list of high-value evidence types (ACCEPT signal with base_confidence >= 0.10)

    Returns:
        List of evidence type IDs
    """
    return [
        type_id for type_id, evidence in MCP_EVIDENCE_TYPES.items()
        if evidence.signal == SignalType.ACCEPT and evidence.base_confidence >= 0.10
    ]


def get_medium_value_evidence_types() -> List[str]:
    """
    Get list of medium-value evidence types (WEAK_ACCEPT or lower confidence)

    Returns:
        List of evidence type IDs
    """
    return [
        type_id for type_id, evidence in MCP_EVIDENCE_TYPES.items()
        if evidence.signal == SignalType.WEAK_ACCEPT or
           (evidence.signal == SignalType.ACCEPT and evidence.base_confidence < 0.10)
    ]


# =============================================================================
# Convenience Functions
# =============================================================================

def calculate_total_confidence(matches: List[Dict[str, Any]]) -> float:
    """
    Calculate total confidence from matched evidence

    Args:
        matches: List of matched evidence from match_evidence_type()

    Returns:
        Total confidence score (sum of all match confidences)
    """
    return sum(m.get('total_confidence', 0.0) for m in matches)


def count_signals_by_type(matches: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Count ACCEPT vs WEAK_ACCEPT signals in matches

    Args:
        matches: List of matched evidence

    Returns:
        Dict with signal type counts
    """
    counts = {"ACCEPT": 0, "WEAK_ACCEPT": 0, "REJECT": 0, "NO_PROGRESS": 0}

    for match in matches:
        signal = match.get('signal', 'NO_PROGRESS')
        counts[signal] = counts.get(signal, 0) + 1

    return counts


if __name__ == "__main__":
    # Test MCP evidence pattern matching
    print("=== Testing MCP Evidence Pattern Matching ===\n")

    test_cases = [
        "NTT Data multi-year partnership for digital transformation",
        "Arsenal deploys customer experience systems (July 2025)",
        "Arsenal uses SAP Hybris for e-commerce since 2017",
        "John Maguire - Head of Operational Technology",
        "Bespoke IBM CRM system installed in 2013"
    ]

    for i, content in enumerate(test_cases, 1):
        print(f"Test Case {i}: {content}")
        matches = match_evidence_type(content)
        print(f"  Found {len(matches)} match(es):")
        for match in matches:
            print(f"    - {match['type']}: +{match['total_confidence']:.2f} confidence")
            if match['temporal_bonus'] > 0:
                print(f"      Temporal bonus: +{match['temporal_bonus']:.2f}")
            if match['opportunity_bonus'] > 0:
                print(f"      Opportunity bonus: +{match['opportunity_bonus']:.2f}")
        print()

    print("✅ MCP Evidence Pattern Matching test complete")
