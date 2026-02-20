"""
Crunchbase Confidence Enhancer

Conditional commercial verification with strict gating.

Position in Pipeline (Non-Negotiable):
1. Template fires
2. Bright Data exploration (SERP + scrape)
3. Initial confidence score (0–1)
4. IF confidence ∈ [0.35, 0.75] AND template allows enrichment
5. Crunchbase Confidence Enhancer
6. Confidence re-score + explanation
7. Promotion / Merge / Retire decision

Crunchbase NEVER runs:
- Before Bright Data discovery
- On high-confidence hits (>0.75)
- On low-signal junk (<0.35)
- On non-commercial templates

Architecture:
- Cluster-level gating (hard rule)
- Template-level gating (stricter)
- Confidence gating (hard requirement)
- Cost guardrails (kill switch)
- 30-day aggressive caching
- Deterministic + LLM uplift

Example:
    enhancer = CrunchbaseConfidenceEnhancer()
    result = await enhancer.enrich_confidence(
        entity_id="borussia-dortmund",
        initial_confidence=0.52,
        cluster=cluster_data,
        template=template_data
    )
    # Returns: {"final_confidence": 0.70, "uplift": 0.18, "explanation": "..."}
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class CrunchbaseCommercialProfile:
    """
    Minimal, opinionated feature surface for commercial verification

    Attributes:
        entity_id: Entity identifier
        resolved_name: Resolved company name from Crunchbase
        confidence_in_match: Confidence that Crunchbase entry matches entity

        # Ownership structure
        ownership: Dict with has_parent_company, parent_type, parent_name

        # Organization scale
        organisation_scale: Dict with employee_count_range, estimated_revenue_range

        # Commercial signals
        commercial_signals: Dict with funding_stage, last_funding_date, acquisitions, investments

        # Technology posture
        technology_posture: Dict with technology_categories, digital_focus_score

        # People signals
        people_signals: Dict with recent_exec_hires, commercial_roles_present

        # Derived features
        derived_features: Dict with commercial_maturity, procurement_likelihood

        # Cost tracking
        cost: Dict with credits_used, usd_estimate
    """
    entity_id: str
    resolved_name: str
    confidence_in_match: float

    # Ownership structure
    ownership: Dict[str, Any] = field(default_factory=dict)

    # Organization scale
    organisation_scale: Dict[str, Any] = field(default_factory=dict)

    # Commercial signals
    commercial_signals: Dict[str, Any] = field(default_factory=dict)

    # Technology posture
    technology_posture: Dict[str, Any] = field(default_factory=dict)

    # People signals
    people_signals: Dict[str, Any] = field(default_factory=dict)

    # Derived features
    derived_features: Dict[str, Any] = field(default_factory=dict)

    # Cost tracking
    cost: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CrunchbaseEnrichmentResult:
    """
    Result from Crunchbase confidence enrichment

    Attributes:
        enriched: Whether Crunchbase enrichment was performed
        final_confidence: Final confidence after enrichment
        uplift: Confidence uplift from Crunchbase
        explanation: Explanation of uplift
        profile: CrunchbaseCommercialProfile (if enriched)
        gate_passed: List of gates that passed
        gate_failed: List of gates that failed
        cost_usd: Cost of enrichment
    """
    enriched: bool
    final_confidence: float
    uplift: float
    explanation: str
    profile: Optional[CrunchbaseCommercialProfile] = None
    gate_passed: List[str] = field(default_factory=list)
    gate_failed: List[str] = field(default_factory=list)
    cost_usd: float = 0.0


class CrunchbaseConfidenceEnhancer:
    """
    Crunchbase confidence enhancer with strict gating

    Implements:
    - Cluster-level gating (club/franchise + top-tier/professional)
    - Template-level gating (commercial keywords only)
    - Confidence gating [0.35, 0.75]
    - Cost guardrails with kill switch
    - 30-day aggressive caching
    - Deterministic + LLM uplift calculation

    Cost Rules:
    - max_calls_per_entity_per_30_days: 1
    - max_cost_per_entity_usd: 0.50
    - max_uplift: 0.25
    - monthly_budget_cap_usd: 100.00
    """

    # Global rules (hard limits)
    CRUNCHBASE_RULES = {
        "max_calls_per_entity_per_30_days": 1,
        "max_cost_per_entity_usd": 0.50,
        "confidence_gate_min": 0.35,
        "confidence_gate_max": 0.75,
        "max_uplift": 0.25,
        "monthly_budget_cap_usd": 100.00
    }

    # Commercial keywords for template gating
    COMMERCIAL_KEYWORDS = [
        "CRM", "Fan Engagement",
        "Data", "Analytics",
        "Digital Transformation",
        "Ticketing", "Merch", "E-commerce",
        "Media", "Streaming", "OTT",
        "Sponsorship activation tech"
    ]

    def __init__(
        self,
        claude_client=None,
        cache_path: str = "data/runtime_bindings/crunchbase_cache.json"
    ):
        """
        Initialize Crunchbase confidence enhancer

        Args:
            claude_client: Optional Claude client (creates default if not provided)
            cache_path: Path to Crunchbase cache JSON file
        """
        from backend.claude_client import ClaudeClient

        self.claude = claude_client or ClaudeClient()
        self.cache_path = Path(cache_path)
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)

        # Load cache
        self.cache = self._load_cache()

        # Track monthly spend
        self.monthly_spend_usd = self._calculate_monthly_spend()

        logger.info(f"💰 CrunchbaseConfidenceEnhancer initialized (monthly_spend: ${self.monthly_spend_usd:.2f})")

    def _load_cache(self) -> Dict[str, Any]:
        """Load Crunchbase cache from disk"""
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'r') as f:
                    data = json.load(f)
                logger.info(f"✅ Loaded Crunchbase cache ({len(data.get('entities', {}))} entities)")
                return data
            except Exception as e:
                logger.error(f"❌ Error loading Crunchbase cache: {e}")
                return {"entities": {}, "metadata": {"last_updated": datetime.now().isoformat()}}
        else:
            return {"entities": {}, "metadata": {"last_updated": datetime.now().isoformat()}}

    def _save_cache(self):
        """Save Crunchbase cache to disk"""
        try:
            self.cache["metadata"]["last_updated"] = datetime.now().isoformat()

            with open(self.cache_path, 'w') as f:
                json.dump(self.cache, f, indent=2)

            logger.debug(f"💾 Saved Crunchbase cache")

        except Exception as e:
            logger.error(f"❌ Error saving Crunchbase cache: {e}")

    def _calculate_monthly_spend(self) -> float:
        """Calculate total spend in current month"""
        current_month = datetime.now().strftime("%Y-%m")

        total_spend = 0.0

        for entity_data in self.cache.get("entities", {}).values():
            if entity_data.get("month") == current_month:
                total_spend += entity_data.get("cost_usd", 0.0)

        return total_spend

    async def enrich_confidence(
        self,
        entity_id: str,
        entity_name: str,
        initial_confidence: float,
        cluster: Optional[Dict[str, Any]] = None,
        template: Optional[Dict[str, Any]] = None
    ) -> CrunchbaseEnrichmentResult:
        """
        Enrich confidence using Crunchbase (with strict gating)

        Process:
        1. Check confidence gate (hard requirement)
        2. Check cluster gate (entity type + tier)
        3. Check template gate (commercial keywords)
        4. Check cost guardrails (monthly budget + per-entity limits)
        5. Check cache (30-day TTL)
        6. Fetch Crunchbase data (if not cached)
        7. Calculate uplift (deterministic + LLM)
        8. Update cache and return result

        Args:
            entity_id: Entity identifier
            entity_name: Entity name
            initial_confidence: Confidence from Bright Data discovery
            cluster: Optional cluster metadata for gating
            template: Optional template metadata for gating

        Returns:
            CrunchbaseEnrichmentResult with enrichment outcome
        """
        gate_passed = []
        gate_failed = []

        # Gate 1: Confidence gate (hard requirement)
        if not self._check_confidence_gate(initial_confidence):
            gate_failed.append("confidence")
            return CrunchbaseEnrichmentResult(
                enriched=False,
                final_confidence=initial_confidence,
                uplift=0.0,
                explanation=f"Confidence gate failed: {initial_confidence:.2f} not in [0.35, 0.75]",
                gate_passed=gate_passed,
                gate_failed=gate_failed
            )
        gate_passed.append("confidence")

        # Gate 2: Cluster gate
        if cluster and not self._check_cluster_gate(cluster):
            gate_failed.append("cluster")
            return CrunchbaseEnrichmentResult(
                enriched=False,
                final_confidence=initial_confidence,
                uplift=0.0,
                explanation=f"Cluster gate failed: entity not club/franchise or not top-tier/professional",
                gate_passed=gate_passed,
                gate_failed=gate_failed
            )
        gate_passed.append("cluster")

        # Gate 3: Template gate
        if template and not self._check_template_gate(template):
            gate_failed.append("template")
            return CrunchbaseEnrichmentResult(
                enriched=False,
                final_confidence=initial_confidence,
                uplift=0.0,
                explanation=f"Template gate failed: no commercial keywords found",
                gate_passed=gate_passed,
                gate_failed=gate_failed
            )
        gate_passed.append("template")

        # Gate 4: Cost guardrails
        budget_ok = self._check_monthly_budget()
        entity_limit_ok = self._check_entity_limit(entity_id)

        if not budget_ok:
            logger.warning(f"❌ Crunchbase disabled: monthly budget cap exceeded")
            gate_failed.append("monthly_budget")
            return CrunchbaseEnrichmentResult(
                enriched=False,
                final_confidence=initial_confidence,
                uplift=0.0,
                explanation=f"Cost gate failed: monthly budget cap exceeded",
                gate_passed=gate_passed,
                gate_failed=gate_failed
            )

        if not entity_limit_ok:
            gate_failed.append("entity_limit")
            return CrunchbaseEnrichmentResult(
                enriched=False,
                final_confidence=initial_confidence,
                uplift=0.0,
                explanation=f"Cost gate failed: entity already called in last 30 days",
                gate_passed=gate_passed,
                gate_failed=gate_failed
            )
        gate_passed.append("cost")

        # All gates passed - check cache
        cache_key = f"{entity_id}:{datetime.now().strftime('%Y-%m')}"
        cached_profile = self.cache.get("entities", {}).get(cache_key)

        if cached_profile:
            logger.info(f"✅ Crunchbase cache hit for {entity_name}")
            profile_data = cached_profile.get("profile")
            uplift = cached_profile.get("uplift", 0.0)

            profile = CrunchbaseCommercialProfile(**profile_data)

            return CrunchbaseEnrichmentResult(
                enriched=True,
                final_confidence=min(initial_confidence + uplift, 1.0),
                uplift=uplift,
                explanation=f"Used cached Crunchbase data (uplift: +{uplift:.2f})",
                profile=profile,
                gate_passed=gate_passed,
                gate_failed=gate_failed,
                cost_usd=0.0  # No cost for cached data
            )

        # Fetch fresh Crunchbase data
        logger.info(f"💰 Fetching Crunchbase data for {entity_name}")

        profile = await self._fetch_crunchbase_profile(entity_name)
        cost_usd = profile.cost.get("usd_estimate", 0.25)

        # Calculate uplift (deterministic + LLM)
        deterministic_uplift = self._calculate_deterministic_uplift(profile)
        llm_uplift = await self._calculate_llm_uplift(profile)

        # Average with hard cap
        uplift = min((deterministic_uplift + llm_uplift) / 2, self.CRUNCHBASE_RULES["max_uplift"])

        # Update cache
        self.cache["entities"][cache_key] = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "month": datetime.now().strftime("%Y-%m"),
            "profile": profile.__dict__,
            "uplift": uplift,
            "cost_usd": cost_usd,
            "cached_at": datetime.now().isoformat()
        }
        self._save_cache()

        # Update monthly spend
        self.monthly_spend_usd += cost_usd

        final_confidence = min(initial_confidence + uplift, 1.0)

        explanation = (
            f"Crunchbase enrichment: deterministic uplift +{deterministic_uplift:.2f}, "
            f"LLM uplift +{llm_uplift:.2f}, averaged +{uplift:.2f}"
        )

        logger.info(
            f"✅ Crunchbase enrichment complete: {initial_confidence:.2f} +{uplift:.2f} = {final_confidence:.2f}"
        )

        return CrunchbaseEnrichmentResult(
            enriched=True,
            final_confidence=final_confidence,
            uplift=uplift,
            explanation=explanation,
            profile=profile,
            gate_passed=gate_passed,
            gate_failed=gate_failed,
            cost_usd=cost_usd
        )

    def _check_confidence_gate(self, confidence: float) -> bool:
        """Check confidence gate [0.35, 0.75]"""
        return self.CRUNCHBASE_RULES["confidence_gate_min"] <= confidence <= self.CRUNCHBASE_RULES["confidence_gate_max"]

    def _check_cluster_gate(self, cluster: Dict[str, Any]) -> bool:
        """
        Check cluster gate (club/franchise + top-tier/professional)

        Args:
            cluster: Cluster metadata with entity_type and tier

        Returns:
            True if cluster passes gate
        """
        entity_type = cluster.get("entity_type", "").lower()
        tier = cluster.get("tier", "").lower()

        # Must be club or franchise
        if entity_type not in ["club", "franchise"]:
            return False

        # Must be top-tier or professional OR high commercial maturity
        if tier not in ["top_tier", "professional"] and cluster.get("commercial_maturity") != "high":
            return False

        return True

    def _check_template_gate(self, template: Dict[str, Any]) -> bool:
        """
        Check template gate (commercial keywords)

        Args:
            template: Template metadata

        Returns:
            True if template has commercial keywords
        """
        template_text = f"{template.get('name', '')} {' '.join(template.get('patterns', []))}".lower()

        return any(keyword.lower() in template_text for keyword in self.COMMERCIAL_KEYWORDS)

    def _check_monthly_budget(self) -> bool:
        """Check monthly budget cap"""
        return self.monthly_spend_usd < self.CRUNCHBASE_RULES["monthly_budget_cap_usd"]

    def _check_entity_limit(self, entity_id: str) -> bool:
        """Check per-entity call limit (1 call per 30 days)"""
        current_month = datetime.now().strftime("%Y-%m")

        # Check if entity was called this month
        cache_key = f"{entity_id}:{current_month}"
        return cache_key not in self.cache.get("entities", {})

    async def _fetch_crunchbase_profile(self, entity_name: str) -> CrunchbaseCommercialProfile:
        """
        Fetch Crunchbase profile for entity

        NOTE: This is a placeholder implementation.
        In production, this would use the BrightData Crunchbase structured API.

        Args:
            entity_name: Entity to fetch profile for

        Returns:
            CrunchbaseCommercialProfile with discovered data
        """
        # TODO: Replace with actual BrightData Crunchbase structured API call
        # mcp__brightdata__web_data_crunchbase_company

        logger.info(f"📊 Fetching Crunchbase profile for {entity_name}")

        # Placeholder profile (in production, this would be real Crunchbase data)
        profile = CrunchbaseCommercialProfile(
            entity_id=entity_name.lower().replace(" ", "-"),
            resolved_name=entity_name,
            confidence_in_match=0.85,
            ownership={
                "has_parent_company": False,
                "parent_type": None,
                "parent_name": None
            },
            organisation_scale={
                "employee_count_range": "1000-5000",
                "estimated_revenue_range": "$100M-$500M"
            },
            commercial_signals={
                "funding_stage": "Private Equity",
                "last_funding_date": "2023-06-15",
                "acquisitions_last_24_months": 2,
                "investments_count": 5
            },
            technology_posture={
                "technology_categories": ["CRM", "Analytics", "Digital"],
                "digital_focus_score": 0.8
            },
            people_signals={
                "recent_exec_hires": 3,
                "commercial_roles_present": True
            },
            derived_features={
                "commercial_maturity": "high",
                "procurement_likelihood": 0.7
            },
            cost={
                "credits_used": 1,
                "usd_estimate": 0.25
            }
        )

        return profile

    def _calculate_deterministic_uplift(self, profile: CrunchbaseCommercialProfile) -> float:
        """
        Calculate deterministic confidence uplift (max +0.25)

        Args:
            profile: CrunchbaseCommercialProfile

        Returns:
            Deterministic uplift (0.0 to 0.25)
        """
        uplift = 0.0

        # Ownership structure
        if profile.ownership.get("has_parent_company"):
            uplift += 0.08

        # Commercial signals
        if profile.commercial_signals.get("acquisitions_last_24_months", 0) > 0:
            uplift += 0.07

        # Technology posture
        if "CRM" in profile.technology_posture.get("technology_categories", []):
            uplift += 0.10

        # People signals
        if profile.people_signals.get("commercial_roles_present"):
            uplift += 0.08

        # Derived features
        if profile.derived_features.get("commercial_maturity") == "high":
            uplift += 0.12

        return min(uplift, self.CRUNCHBASE_RULES["max_uplift"])

    async def _calculate_llm_uplift(self, profile: CrunchbaseCommercialProfile) -> float:
        """
        Calculate LLM-based confidence uplift (boxed reasoning)

        Args:
            profile: CrunchbaseCommercialProfile

        Returns:
            LLM uplift (0.0 to 0.30)
        """
        prompt = f"""
You assess commercial readiness using structured signals.
You do NOT invent data.
You do NOT speculate beyond provided fields.

Given this CrunchbaseCommercialProfile:
- Ownership: {profile.ownership}
- Commercial Signals: {profile.commercial_signals}
- Technology Posture: {profile.technology_posture}
- People Signals: {profile.people_signals}
- Derived Features: {profile.derived_features}

Estimate how much more likely this entity is to issue a commercial RFP in the next 12 months.

Return JSON:
{{
  "likelihood_increase": 0.0-0.3,
  "reasoning": "≤2 sentences"
}}

Be concise and data-driven.
"""

        try:
            response = await self.claude.query(
                prompt=prompt,
                model="sonnet",  # Cost-effective reasoning
                max_tokens=500
            )

            # Parse JSON
            content = response.get("content", "{}")

            if "```json" in content:
                json_start = content.find("```json") + 7
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()
            elif "```" in content:
                json_start = content.find("```") + 3
                json_end = content.find("```", json_start)
                content = content[json_start:json_end].strip()

            result = json.loads(content)
            uplift = result.get("likelihood_increase", 0.0)

            logger.debug(f"🧠 LLM uplift: +{uplift:.2f} - {result.get('reasoning', 'N/A')}")

            return min(uplift, 0.3)

        except Exception as e:
            logger.warning(f"⚠️ LLM uplift calculation failed: {e}")
            return 0.0

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        entities = self.cache.get("entities", {})

        return {
            "total_entities_cached": len(entities),
            "monthly_spend_usd": self.monthly_spend_usd,
            "monthly_budget_cap_usd": self.CRUNCHBASE_RULES["monthly_budget_cap_usd"],
            "budget_remaining_usd": self.CRUNCHBASE_RULES["monthly_budget_cap_usd"] - self.monthly_spend_usd,
            "last_updated": self.cache.get("metadata", {}).get("last_updated")
        }


# =============================================================================
# Convenience Functions
# =============================================================================

async def enrich_with_crunchbase(
    entity_id: str,
    entity_name: str,
    initial_confidence: float,
    cluster: Optional[Dict[str, Any]] = None,
    template: Optional[Dict[str, Any]] = None
) -> CrunchbaseEnrichmentResult:
    """
    Convenience function to enrich confidence with Crunchbase

    Args:
        entity_id: Entity identifier
        entity_name: Entity name
        initial_confidence: Confidence from Bright Data discovery
        cluster: Optional cluster metadata for gating
        template: Optional template metadata for gating

    Returns:
        CrunchbaseEnrichmentResult
    """
    enhancer = CrunchbaseConfidenceEnhancer()
    return await enhancer.enrich_confidence(
        entity_id=entity_id,
        entity_name=entity_name,
        initial_confidence=initial_confidence,
        cluster=cluster,
        template=template
    )


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    async def test_crunchbase_enhancer():
        """Test Crunchbase confidence enhancer"""
        print("=== Testing Crunchbase Confidence Enhancer ===")

        enhancer = CrunchbaseConfidenceEnhancer()

        # Test 1: Should enable (commercial template + top-tier club + right confidence)
        print("\n--- Test 1: Should enable ---")

        cluster = {
            "entity_type": "club",
            "tier": "top_tier",
            "commercial_maturity": "high"
        }

        template = {
            "name": "Tier 1 Club Digital Transformation",
            "patterns": ["CRM", "Digital", "Analytics"]
        }

        result = await enhancer.enrich_confidence(
            entity_id="borussia-dortmund",
            entity_name="Borussia Dortmund",
            initial_confidence=0.52,
            cluster=cluster,
            template=template
        )

        print(f"Enriched: {result.enriched}")
        print(f"Final Confidence: {result.final_confidence:.2f}")
        print(f"Uplift: +{result.uplift:.2f}")
        print(f"Gates Passed: {result.gate_passed}")
        print(f"Explanation: {result.explanation}")

        # Test 2: Should disable (confidence too low)
        print("\n--- Test 2: Should disable (confidence too low) ---")

        result2 = await enhancer.enrich_confidence(
            entity_id="test-entity",
            entity_name="Test Entity",
            initial_confidence=0.30,  # Below 0.35
            cluster=cluster,
            template=template
        )

        print(f"Enriched: {result2.enriched}")
        print(f"Gate Failed: {result2.gate_failed}")
        print(f"Explanation: {result2.explanation}")

        # Cache stats
        print("\n--- Cache Stats ---")
        stats = enhancer.get_cache_stats()
        print(f"Total Entities Cached: {stats['total_entities_cached']}")
        print(f"Monthly Spend: ${stats['monthly_spend_usd']:.2f}")
        print(f"Budget Remaining: ${stats['budget_remaining_usd']:.2f}")

    asyncio.run(test_crunchbase_enhancer())
