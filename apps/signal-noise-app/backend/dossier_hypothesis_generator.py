#!/usr/bin/env python3
"""
Dossier-Informed Hypothesis Generator

Generates hypotheses from entity dossier data matched to Yellow Panther capabilities.

This module bridges the gap between:
- Entity dossiers (what entities have/need)
- Yellow Panther profile (what YP offers)
- Hypothesis system (testable claims about procurement readiness)

Key Innovation:
- Uses dossier sections to extract entity needs
- Matches needs to YP capabilities
- Generates confidence-weighted hypotheses

Usage:
    from backend.dossier_hypothesis_generator import DossierHypothesisGenerator

    generator = DossierHypothesisGenerator(yp_profile_path='YELLOW-PANTHER-PROFILE.md')
    hypotheses = await generator.generate_hypotheses_from_dossier(
        dossier=entity_dossier,
        entity_id="arsenal-fc"
    )
"""

import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class YellowPantherCapability:
    """YP capability from profile"""
    service: str
    technology: str
    category: str
    description: str
    target_markets: List[str]


@dataclass
class EntityNeed:
    """Extracted entity need from dossier"""
    category: str
    description: str
    evidence_text: str
    source_section: str
    confidence: float
    keywords: List[str]


class DossierHypothesisGenerator:
    """
    Generate hypotheses from entity dossier data matched to YP capabilities

    Process:
    1. Extract entity needs from dossier sections
    2. Match needs to YP capabilities
    3. Generate confidence-weighted hypotheses
    """

    def __init__(self, yp_profile_path: Optional[str] = None):
        """
        Initialize generator

        Args:
            yp_profile_path: Path to Yellow Panther profile (default: YELLOW-PANTHER-PROFILE.md)
        """
        if yp_profile_path is None:
            # Default to YELLOW-PANTHER-PROFILE.md in project root
            project_root = Path(__file__).parent.parent
            yp_profile_path = project_root / "YELLOW-PANTHER-PROFILE.md"

        self.yp_profile_path = Path(yp_profile_path)
        self.yp_capabilities = self._load_yp_profile()

        logger.info(f"📋 Loaded {len(self.yp_capabilities)} YP capabilities from profile")

    def _load_yp_profile(self) -> List[YellowPantherCapability]:
        """
        Load Yellow Panther profile from markdown file

        Returns:
            List of YP capabilities
        """
        capabilities = []

        if not self.yp_profile_path.exists():
            logger.warning(f"⚠️ YP profile not found: {self.yp_profile_path}")
            return self._get_default_capabilities()

        try:
            with open(self.yp_profile_path, 'r') as f:
                content = f.read()

            # Parse YP profile (simplified parsing for now)
            # In production, this would use a proper markdown parser

            # Extract services section
            if "Services:" in content or "Capabilities:" in content:
                # Look for service listings
                lines = content.split('\n')
                current_section = None

                for line in lines:
                    line = line.strip()

                    # Detect service sections
                    if any(kw in line.lower() for kw in ['react', 'mobile', 'digital', 'e-commerce', 'transformation']):
                        current_section = line

                        # Extract technology
                        technology = "React.js"
                        if "mobile" in line.lower():
                            technology = "React Native"
                        elif "python" in line.lower():
                            technology = "Python"

                        capabilities.append(YellowPantherCapability(
                            service=line,
                            technology=technology,
                            category=self._categorize_service(line),
                            description=line,
                            target_markets=["Sports & Entertainment"]
                        ))

            if not capabilities:
                logger.warning("⚠️ No capabilities parsed from YP profile, using defaults")
                return self._get_default_capabilities()

            return capabilities

        except Exception as e:
            logger.error(f"❌ Error loading YP profile: {e}")
            return self._get_default_capabilities()

    def _get_default_capabilities(self) -> List[YellowPantherCapability]:
        """
        Get default YP capabilities (fallback)

        Returns:
            Default YP capabilities
        """
        return [
            YellowPantherCapability(
                service="React Web Development",
                technology="React.js",
                category="Web Development",
                description="Modern React.js web applications",
                target_markets=["Sports & Entertainment"]
            ),
            YellowPantherCapability(
                service="React Mobile Apps",
                technology="React Native",
                category="Mobile Development",
                description="Cross-platform mobile applications",
                target_markets=["Sports & Entertainment"]
            ),
            YellowPantherCapability(
                service="Digital Transformation",
                technology="Node.js, Python",
                category="Digital Transformation",
                description="End-to-end digital transformation",
                target_markets=["Sports & Entertainment"]
            ),
            YellowPantherCapability(
                service="E-commerce Platforms",
                technology="Node.js, React",
                category="E-commerce",
                description="Custom e-commerce solutions",
                target_markets=["Sports & Entertainment"]
            ),
            YellowPantherCapability(
                service="Fan Engagement Platforms",
                technology="React, Node.js",
                category="Fan Engagement",
                description="Interactive fan experiences",
                target_markets=["Sports & Entertainment"]
            )
        ]

    def _categorize_service(self, service_line: str) -> str:
        """
        Categorize YP service

        Args:
            service_line: Service description line

        Returns:
            Category string
        """
        service_lower = service_line.lower()

        if 'mobile' in service_lower or 'app' in service_lower:
            return "Mobile Development"
        elif 'digital' in service_lower or 'transformation' in service_lower:
            return "Digital Transformation"
        elif 'commerce' in service_lower or 'shop' in service_lower:
            return "E-commerce"
        elif 'fan' in service_lower or 'engagement' in service_lower:
            return "Fan Engagement"
        elif 'react' in service_lower or 'web' in service_lower:
            return "Web Development"
        else:
            return "General"

    async def generate_hypotheses_from_dossier(
        self,
        dossier,
        entity_id: str
    ) -> List[Dict]:
        """
        Analyze dossier and generate YP-matched hypotheses

        Process:
        1. Extract entity needs from dossier
        2. Match needs to YP capabilities
        3. Generate confidence-weighted hypotheses

        Args:
            dossier: Entity dossier with multiple sections
            entity_id: Entity identifier

        Returns:
            List of Hypothesis dictionaries matched to YP capabilities
        """

        logger.info(f"🔍 Generating dossier-informed hypotheses for {dossier.entity_name}")

        # Step 1: Extract entity needs from dossier
        entity_needs = self._extract_entity_needs(dossier)
        logger.info(f"  ✅ Extracted {len(entity_needs)} entity needs from dossier")

        # Step 2: Match needs to YP capabilities
        matched_hypotheses = []

        for need in entity_needs:
            # Check if YP can address this need
            yp_capability = self._match_yp_capability(need)

            if yp_capability:
                # Calculate prior probability based on need confidence + capability match
                prior_probability = self._calculate_prior_probability(need, dossier)

                # Generate hypothesis as dictionary
                hypothesis = {
                    'hypothesis_id': f"{entity_id}_{need['category'].lower().replace(' ', '_')}",
                    'entity_id': entity_id,
                    'category': need['category'],
                    'statement': self._generate_hypothesis_statement(
                        dossier.entity_name,
                        need,
                        yp_capability
                    ),
                    'prior_probability': prior_probability,
                    'confidence': prior_probability,
                    'metadata': {
                        'dossier_derived': True,
                        'yp_capability': yp_capability.service,
                        'yp_technology': yp_capability.technology,
                        'entity_need': need,
                        'source_section': need['source_section'],
                        'generation_method': 'dossier_informed'
                    }
                }

                matched_hypotheses.append(hypothesis)
                logger.info(f"  ✅ Matched: {need['category']} → {yp_capability.service}")

        logger.info(f"✅ Generated {len(matched_hypotheses)} dossier-informed hypotheses")

        return matched_hypotheses

    def _extract_entity_needs(self, dossier) -> List[Dict[str, Any]]:
        """
        Extract what entity needs from dossier sections

        Analyzes each dossier section for procurement signals:
        - Technology gaps (mentions of legacy systems)
        - Hiring signals (job postings for technical roles)
        - Strategic initiatives (digital transformation mentions)
        - Fan engagement needs (customer experience focus)

        Args:
            dossier: Entity dossier

        Returns:
            List of entity needs with evidence
        """
        needs = []

        for section in dossier.sections:
            # Analyze section content for procurement signals
            section_needs = self._analyze_section_for_needs(section)
            needs.extend(section_needs)

        return needs

    def _analyze_section_for_needs(self, section: 'DossierSection') -> List[Dict[str, Any]]:
        """
        Analyze a single dossier section for procurement signals

        Args:
            section: Dossier section

        Returns:
            List of extracted needs
        """
        needs = []

        # Get section content
        if not section.content:
            return needs

        # Combine all content into text for analysis
        content_text = " ".join(str(item) for item in section.content)

        # Define signal patterns
        signal_patterns = {
            'Web Development': {
                'keywords': ['website', 'web platform', 'frontend', 'UI/UX', 'react', 'angular', 'vue'],
                'action_keywords': ['redesign', 'rebuild', 'migrate', 'upgrade', 'improve'],
                'weight': 0.7
            },
            'Mobile Development': {
                'keywords': ['mobile app', 'ios', 'android', 'react native', 'flutter'],
                'action_keywords': ['build', 'develop', 'create', 'launch'],
                'weight': 0.8
            },
            'Digital Transformation': {
                'keywords': ['digital transformation', 'modernize', 'cloud migration', 'digitize'],
                'action_keywords': ['transform', 'modernize', 'migrate', 'digitize'],
                'weight': 0.9
            },
            'E-commerce': {
                'keywords': ['e-commerce', 'online store', 'shop', 'merchandise', 'ticketing'],
                'action_keywords': ['launch', 'implement', 'upgrade'],
                'weight': 0.7
            },
            'Fan Engagement': {
                'keywords': ['fan engagement', 'fan experience', 'supporter', 'membership'],
                'action_keywords': ['improve', 'enhance', 'digital', 'platform'],
                'weight': 0.8
            },
            'Data & Analytics': {
                'keywords': ['analytics', 'data platform', 'crm', 'customer data'],
                'action_keywords': ['implement', 'centralize', 'unify'],
                'weight': 0.7
            },
            'AI & Automation': {
                'keywords': ['AI', 'automation', 'machine learning', 'chatbot'],
                'action_keywords': ['implement', 'deploy', 'integrate'],
                'weight': 0.6
            }
        }

        # Scan content for signals
        content_lower = content_text.lower()

        for category, pattern in signal_patterns.items():
            # Check for keywords
            keyword_matches = [kw for kw in pattern['keywords'] if kw.lower() in content_lower]

            # Check for action keywords
            action_matches = [kw for kw in pattern['action_keywords'] if kw.lower() in content_lower]

            if keyword_matches and action_matches:
                # Found a signal - extract evidence
                need = {
                    'category': category,
                    'description': f"Entity signals need for {category.lower()}",
                    'evidence_text': self._extract_evidence_snippet(content_text, keyword_matches, action_matches),
                    'source_section': section.id,
                    'confidence': pattern['weight'],
                    'keywords': keyword_matches + action_matches
                }

                needs.append(need)

        return needs

    def _extract_evidence_snippet(
        self,
        content: str,
        keywords: List[str],
        actions: List[str],
        max_length: int = 200
    ) -> str:
        """
        Extract relevant evidence snippet from content

        Args:
            content: Full content text
            keywords: Matched keywords
            actions: Matched action keywords
            max_length: Maximum snippet length

        Returns:
            Evidence snippet
        """
        # Find the most relevant sentence
        sentences = content.split('. ')

        best_sentence = ""
        best_score = 0

        for sentence in sentences:
            score = 0
            sentence_lower = sentence.lower()

            # Score based on keyword matches
            for kw in keywords + actions:
                if kw.lower() in sentence_lower:
                    score += 1

            if score > best_score:
                best_score = score
                best_sentence = sentence

        # Truncate if needed
        if len(best_sentence) > max_length:
            best_sentence = best_sentence[:max_length] + "..."

        return best_sentence.strip()

    def _match_yp_capability(self, need: Dict[str, Any]) -> Optional[YellowPantherCapability]:
        """
        Match entity need to YP capability

        Args:
            need: Entity need

        Returns:
            Matching YP capability or None
        """
        need_category = need['category'].lower()

        # Find best matching capability
        for capability in self.yp_capabilities:
            cap_category = capability.category.lower()

            # Direct match
            if need_category in cap_category or cap_category in need_category:
                return capability

            # Technology-specific match
            if 'mobile' in need_category and 'mobile' in cap_category:
                return capability
            if 'web' in need_category and 'web' in cap_category:
                return capability
            if 'digital' in need_category and 'digital' in cap_category:
                return capability

        # Default to web development for general needs
        if 'general' in need_category or 'technology' in need_category:
            for capability in self.yp_capabilities:
                if capability.category == "Web Development":
                    return capability

        return None

    def _calculate_prior_probability(
        self,
        need: Dict[str, Any],
        dossier: 'EntityDossier'
    ) -> float:
        """
        Calculate prior probability for hypothesis

        Combines:
        - Need confidence (from signal pattern)
        - Dossier tier (higher tier = more reliable data)
        - Section confidence (if available)

        Args:
            need: Entity need
            dossier: Entity dossier

        Returns:
            Prior probability (0.0-1.0)
        """
        # Start with need confidence
        prior = need.get('confidence', 0.5)

        # Boost for higher dossier tiers
        tier_boost = {
            'PREMIUM': 0.10,
            'STANDARD': 0.05,
            'BASIC': 0.0
        }
        prior += tier_boost.get(dossier.tier, 0.0)

        # Clamp to valid range
        return max(0.0, min(1.0, prior))

    def _generate_hypothesis_statement(
        self,
        entity_name: str,
        need: Dict[str, Any],
        yp_capability: YellowPantherCapability
    ) -> str:
        """
        Generate hypothesis statement from need + capability

        Examples:
            "Arsenal FC is preparing React Web Development procurement"
            "Arsenal FC is seeking Mobile Development services"

        Args:
            entity_name: Entity name
            need: Entity need
            yp_capability: Matching YP capability

        Returns:
            Hypothesis statement
        """
        return f"{entity_name} is preparing procurement related to {yp_capability.service}"


# =============================================================================
# Convenience Functions
# =============================================================================

async def generate_dossier_hypotheses(
    dossier,
    entity_id: str,
    yp_profile_path: Optional[str] = None
) -> List[Dict]:
    """
    Convenience function to generate dossier-informed hypotheses

    Args:
        dossier: Entity dossier
        entity_id: Entity identifier
        yp_profile_path: Optional path to YP profile

    Returns:
        List of Hypothesis dictionaries
    """
    generator = DossierHypothesisGenerator(yp_profile_path)
    return await generator.generate_hypotheses_from_dossier(dossier, entity_id)


if __name__ == "__main__":
    # Test dossier hypothesis generation
    import asyncio
    from backend.dossier_generator import EntityDossierGenerator
    from backend.claude_client import ClaudeClient

    async def test():
        print("=== Testing Dossier Hypothesis Generation ===\n")

        # Initialize
        claude = ClaudeClient()
        generator = EntityDossierGenerator(claude)

        # Generate dossier
        dossier = await generator.generate_dossier(
            entity_id="arsenal-fc",
            entity_name="Arsenal FC",
            entity_type="CLUB",
            priority_score=50  # STANDARD tier
        )

        # Generate hypotheses
        hyp_gen = DossierHypothesisGenerator()
        hypotheses = await hyp_gen.generate_hypotheses_from_dossier(
            dossier=dossier,
            entity_id="arsenal-fc"
        )

        print(f"\n✅ Generated {len(hypotheses)} hypotheses from dossier:")

        for hyp in hypotheses[:5]:  # Show first 5
            print(f"\n  📊 {hyp.hypothesis_id}")
            print(f"     Statement: {hyp.statement}")
            print(f"     Confidence: {hyp.confidence:.2f}")
            print(f"     YP Service: {hyp.metadata.get('yp_capability')}")
            print(f"     Evidence: {hyp.metadata.get('entity_need', {}).get('evidence_text', 'N/A')[:100]}...")

        print("\n✅ Test complete")

    asyncio.run(test())
