"""
Domain Disambiguation Gate

Prevents semantic ambiguity failures where domain discovery returns
authoritative-looking domains for the WRONG entity type.

Example failure:
  - Query: "Manchester City"
  - Found: manchester.gov.uk (Manchester City Council)
  - Expected: mancity.com (Manchester City FC)

This happens with:
  - Inter Milan → City of Milan vs Inter Milan FC
  - Sporting CP → Sporting goods vs Sporting Clube de Portugal
  - Ajax → Ajax software vs Ajax Amsterdam FC
  - Rangers → Park services vs Rangers FC
  - Real Madrid → City tourism vs Real Madrid CF
  - City / United / Athletic / Sporting / Real prefixes

Solution:
  Entity-Type Guardrails with domain classification heuristics
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DomainCandidate:
    """Domain candidate with classification score"""
    domain: str
    score: float
    reasons: List[str]
    is_sports_valid: bool


class DomainDisambiguationGate:
    """
    Entity-type aware domain disambiguation

    Scores and filters discovered domains based on entity type context.
    Prevents false authority bias where .gov domains outrank actual club domains.
    """

    # Sports-related keywords (positive signal)
    SPORTS_KEYWORDS = [
        'fc', 'cf', 'sc', 'ac', 'rc',  # Club abbreviations
        'club', 'soccer', 'football', 'basketball', 'hockey',
        'rugby', 'cricket', 'baseball', 'volleyball', 'handball',
        ' athletic', 'sports', 'team', 'players', 'coach', 'stadium',
        'arena', 'pitch', 'tournament', 'league', 'federation', 'association'
    ]

    # Government/education keywords (negative signal)
    GOV_KEYWORDS = [
        'council', 'municipality', 'government', 'city of', 'town of',
        'department', 'bureau', 'official', 'authority', 'metro',
        'university', 'college', 'school', 'institute', 'academy',
        'library', 'museum', 'archive',
        # Multilingual government terms
        'ajuntament',  # Catalan/Portuguese: city council
        'mairie',  # French: city hall
        'ayuntamiento',  # Spanish: city council
        ' Rathaus',  # German: city hall
        'stad',  # Dutch: city
        'kommune',  # German/Danish: municipality
        'commune',  # Italian: municipality
        'concello',  # Galician: council
    ]

    # Hard-exclusion TLDs
    EXCLUDED_TLDS = [
        '.gov', '.gov.uk', '.edu', '.ac.uk', '.go.jp', '.gov.au',
        '.gov.in', '.gov.ca', '.gov.fr', '.gov.de', '.gov.br'
    ]

    # Known organization patterns (path/domain-based exclusions)
    EXCLUDED_PATTERNS = [
        # Government/Civic organizations
        'nationaltrust.org.uk',
        'nps.gov',  # US National Park Service
        'park service',
        'city council',
        'municipal',
        'library',
        'museum',

        # Non-sports organizations
        'ajaxlibrary',
        'decathlon',  # Retail sports goods

        # Civic/Portals (multilingual)
        'comune.',  # Italian municipality
        'ajuntament.',  # Catalan city council
        'mairie.',  # French city hall
        'ayuntamiento.',  # Spanish city hall
        'townof.',
        'cityof.',
    ]

    # Known club brand patterns (positive signal)
    CLUB_BRAND_PATTERNS = [
        'fc', 'cf', 'sc', 'ac', 'rc', 'dc',  # Common football abbreviations
        'united', 'city', 'athletic', 'sporting', 'real', 'inter',
        'rangers', 'celtic', 'benfica', 'portuguese', 'red star',
        'barca', 'laliga', 'premier', 'bundesliga', 'serie', 'ligue'
    ]

    def __init__(self):
        """Initialize disambiguation gate"""
        self.sports_pattern = re.compile(
            r'\b(' + '|'.join(self.SPORTS_KEYWORDS) + r')\b',
            re.IGNORECASE
        )
        self.gov_pattern = re.compile(
            r'\b(' + '|'.join(self.GOV_KEYWORDS) + r')\b',
            re.IGNORECASE
        )

    def score_domain(
        self,
        domain: str,
        entity_name: str,
        entity_profile: Optional[Dict[str, Any]] = None
    ) -> DomainCandidate:
        """
        Score a domain candidate based on entity-type relevance

        Args:
            domain: Domain to score
            entity_name: Name of entity being searched for
            entity_profile: Optional entity metadata from template

        Returns:
            DomainCandidate with score and classification
        """
        score = 0.0
        reasons = []
        is_sports_valid = False

        domain_lower = domain.lower()

        # 1. Hard exclusions (gov/edu TLDs)
        if any(domain_lower.endswith(tld) for tld in self.EXCLUDED_TLDS):
            score -= 0.6
            reasons.append("gov/edu TLD exclusion")
            # Auto-fail sports validity
            return DomainCandidate(
                domain=domain,
                score=score,
                reasons=reasons,
                is_sports_valid=False
            )

        # 1.5. Check for known organization patterns
        for pattern in self.EXCLUDED_PATTERNS:
            if pattern in domain_lower:
                score -= 0.4
                reasons.append(f"excluded pattern: '{pattern}'")
                break

        # 2. Sports keywords presence (40% weight)
        sports_matches = self.sports_pattern.findall(domain)
        if sports_matches:
            sports_score = min(len(sports_matches) * 0.4, 0.4)
            score += sports_score
            reasons.append(f"sports keywords: {sports_matches}")

        # 3. Club brand match (30% weight)
        entity_lower = entity_name.lower()
        brand_match = False

        for brand in self.CLUB_BRAND_PATTERNS:
            # More precise matching: brand must be separate word in domain
            # e.g., "fc" in "fcbarcelona.com" ✓ but not in "barcelona.com"
            if brand in entity_lower:
                # Check if brand appears as whole word or abbreviation in domain
                pattern = r'\b' + brand + r'\b'
                if re.search(pattern, domain_lower, re.IGNORECASE):
                    score += 0.3
                    reasons.append(f"brand match: '{brand}'")
                    brand_match = True
                    break

        # 4. Government/education penalty (already applied TLDs, check content)
        gov_matches = self.gov_pattern.findall(domain)
        if gov_matches:
            score -= 0.4
            reasons.append(f"gov/edu keywords: {gov_matches}")

        # 5. League keywords (20% weight)
        if entity_profile:
            league = entity_profile.get('league', '').lower()
            sport = entity_profile.get('sport', '').lower()

            if league and league in domain_lower:
                score += 0.2
                reasons.append(f"league match: '{league}'")

            if sport and sport in domain_lower:
                score += 0.1
                reasons.append(f"sport match: '{sport}'")

        # 6. Direct entity name match (bonus)
        # Extract entity slug (e.g., "manchester-city" from "Manchester City FC")
        entity_slug = entity_lower.replace(' ', '-').replace('fc', '').strip('-')
        if entity_slug in domain_lower or entity_lower.replace(' ', '') in domain_lower:
            score += 0.15
            reasons.append("direct entity name match")

        # Determine sports validity
        # Lower threshold: score >= 0 is acceptable (not negative)
        # Hard exclusion: gov/edu TLDs are always invalid
        is_sports_valid = score >= 0 and not any(
            domain_lower.endswith(tld) for tld in self.EXCLUDED_TLDS
        )

        return DomainCandidate(
            domain=domain,
            score=score,
            reasons=reasons,
            is_sports_valid=is_sports_valid
        )

    def filter_domains(
        self,
        domains: List[str],
        entity_name: str,
        entity_profile: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Filter and rank domains by entity-type relevance

        Args:
            domains: List of discovered domains
            entity_name: Name of entity
            entity_profile: Optional entity metadata

        Returns:
            Filtered and sorted list of domains
        """
        if not domains:
            return []

        # Score all domains
        candidates = [
            self.score_domain(domain, entity_name, entity_profile)
            for domain in domains
        ]

        # Separate sports-valid and invalid
        sports_valid = [c for c in candidates if c.is_sports_valid]
        sports_invalid = [c for c in candidates if not c.is_sports_valid]

        # Log filtering results
        logger.info(f"Entity: {entity_name}")
        logger.info(f"  Total domains: {len(domains)}")
        logger.info(f"  Sports-valid: {len(sports_valid)}")
        logger.info(f"  Sports-invalid: {len(sports_invalid)}")

        if sports_invalid:
            logger.warning(f"  Filtered invalid domains:")
            for c in sports_invalid[:3]:
                logger.warning(f"    - {c.domain} (score: {c.score:.2f}): {', '.join(c.reasons)}")

        if sports_valid:
            logger.info(f"  Valid domains:")
            for c in sports_valid[:3]:
                logger.info(f"    + {c.domain} (score: {c.score:.2f}): {', '.join(c.reasons)}")

        # Return strategy:
        # 1. If we have sports-valid domains, return them sorted by score
        # 2. Otherwise, return non-negative scoring domains sorted by score (with low confidence warning)
        if sports_valid:
            # Sort by score descending
            sports_valid.sort(key=lambda c: c.score, reverse=True)
            return [c.domain for c in sports_valid]
        else:
            # No sports-valid domains found
            logger.warning(f"  ⚠️  No sports-valid domains found for {entity_name}")
            logger.warning(f"  ⚠️  RECOMMENDATION: Mark binding as LOW_CONFIDENCE and use fallback strategy")

            # Filter out domains with negative scores (gov/edu/etc.)
            # Return only non-negative scoring domains
            non_negative = [c for c in candidates if c.score >= 0]
            non_negative.sort(key=lambda c: c.score, reverse=True)
            return [c.domain for c in non_negative]

    def get_entity_profile_from_template(
        self,
        template_id: str,
        template_loader=None
    ) -> Optional[Dict[str, Any]]:
        """
        Extract entity profile from template metadata

        Args:
            template_id: Template identifier
            template_loader: Optional TemplateLoader instance

        Returns:
            Entity profile dict or None
        """
        if not template_loader:
            from backend.template_loader import TemplateLoader
            template_loader = TemplateLoader()

        template = template_loader.get_template(template_id)
        if not template:
            return None

        # Extract profile from applicable_entity_profile
        profile = template.applicable_entity_profile.copy()

        # Add cluster metadata
        profile['cluster_id'] = template.cluster_id
        profile['template_confidence'] = template.template_confidence

        return profile

    def should_mark_low_confidence(
        self,
        filtered_domains: List[str],
        original_domains: List[str]
    ) -> bool:
        """
        Determine if binding should be marked as low confidence

        Args:
            filtered_domains: Domains after filtering
            original_domains: Original discovered domains

        Returns:
            True if binding should be LOW_CONFIDENCE
        """
        # If we filtered out more than 50% of domains, mark as low confidence
        if len(filtered_domains) < len(original_domains) * 0.5:
            return True

        # If no domains passed sports validity, mark as low confidence
        sports_valid = any(
            not any(d.endswith(tld) for tld in self.EXCLUDED_TLDS)
            for d in filtered_domains
        )

        if not sports_valid:
            return True

        return False


# =============================================================================
# Convenience Functions
# =============================================================================

def get_disambiguation_gate() -> DomainDisambiguationGate:
    """Get singleton instance of disambiguation gate"""
    return DomainDisambiguationGate()


def filter_entity_domains(
    domains: List[str],
    entity_name: str,
    entity_profile: Optional[Dict[str, Any]] = None
) -> List[str]:
    """
    Filter domains for entity-type relevance

    Args:
        domains: Discovered domains
        entity_name: Entity name
        entity_profile: Optional entity metadata

    Returns:
        Filtered list of domains
    """
    gate = get_disambiguation_gate()
    return gate.filter_domains(domains, entity_name, entity_profile)


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    print("=== Domain Disambiguation Gate Tests ===\n")

    gate = DomainDisambiguationGate()

    # Test 1: Manchester City (the failure case)
    print("Test 1: Manchester City FC")
    test_domains = [
        "manchester.gov.uk",
        "mancity.com",
        "manchestercity.com",
        "manchester.gov.uk/council"
    ]

    entity_profile = {
        "sport": "Football",
        "org_type": "club",
        "league": "Premier League"
    }

    filtered = gate.filter_domains(test_domains, "Manchester City FC", entity_profile)
    print(f"Input: {test_domains}")
    print(f"Output: {filtered}")
    print(f"Expected: ['mancity.com', 'manchestercity.com'] (not .gov)")

    if "manchester.gov.uk" not in filtered:
        print("✅ SUCCESS: Government domain filtered out\n")
    else:
        print("❌ FAILED: Government domain not filtered\n")

    # Test 2: Sporting CP (sporting goods vs club)
    print("Test 2: Sporting CP")
    test_domains_2 = [
        "sporting.com",
        "sporting.pt",
        "sportinggoods.com",
        "scp.pt"
    ]

    entity_profile_2 = {
        "sport": "Football",
        "org_type": "club",
        "league": "Primeira Liga"
    }

    filtered_2 = gate.filter_domains(test_domains_2, "Sporting CP", entity_profile_2)
    print(f"Input: {test_domains_2}")
    print(f"Output: {filtered_2}")

    # Test 3: Real Madrid (city tourism vs club)
    print("\nTest 3: Real Madrid CF")
    test_domains_3 = [
        "realmadrid.com",
        "madrid.es/turismo",
        "realmadridcf.com",
        "esmadrid.com"
    ]

    entity_profile_3 = {
        "sport": "Football",
        "org_type": "club",
        "league": "La Liga"
    }

    filtered_3 = gate.filter_domains(test_domains_3, "Real Madrid CF", entity_profile_3)
    print(f"Input: {test_domains_3}")
    print(f"Output: {filtered_3}")

    if not any("turismo" in d or "esmadrid" in d for d in filtered_3[:2]):
        print("✅ SUCCESS: Tourism domains filtered out\n")
    else:
        print("❌ FAILED: Tourism domains not filtered\n")

    # Test 4: Direct brand match
    print("Test 4: Arsenal FC")
    test_domains_4 = [
        "arsenal.com",
        "arsenal.fc",  # fake
        "thearsenal.com"
    ]

    entity_profile_4 = {
        "sport": "Football",
        "org_type": "club",
        "league": "Premier League"
    }

    filtered_4 = gate.filter_domains(test_domains_4, "Arsenal FC", entity_profile_4)
    print(f"Input: {test_domains_4}")
    print(f"Output: {filtered_4}")

    if "arsenal.com" == filtered_4[0]:
        print("✅ SUCCESS: Direct match prioritized\n")
    else:
        print("⚠️  WARNING: Direct match not first\n")

    print("=== Tests Complete ===")
