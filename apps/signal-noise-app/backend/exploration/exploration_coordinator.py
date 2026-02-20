"""
Exploration Coordinator

Orchestrates exploration across 7 representative entities per cluster.

Process:
1. For each of 8 canonical categories
2. For each of 7 entities in sample
3. Run exploration (Claude Code or Bright Data MCP)
4. Log evidence (write-once)
5. Aggregate results across entities
6. Generate pattern repeatability report

Output: ExplorationReport with promotion decision
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from backend.exploration.canonical_categories import (
    ExplorationCategory,
    get_category_metadata,
    list_all_categories
)
from backend.exploration.exploration_log import ExplorationLogEntry, ExplorationReport
from backend.exploration.evidence_store import EvidenceStore

logger = logging.getLogger(__name__)


class ExplorationCoordinator:
    """
    Orchestrates exploration across entity samples

    Coordinates exploration workflow:
    - Select entity samples (7 per cluster)
    - Run exploration for all 8 categories
    - Aggregate results
    - Generate promotion reports
    """

    def __init__(self, evidence_store: Optional[EvidenceStore] = None):
        """
        Initialize exploration coordinator

        Args:
            evidence_store: Optional EvidenceStore (creates default if not provided)
        """
        self.evidence_store = evidence_store or EvidenceStore()

        logger.info("🔍 ExplorationCoordinator initialized")

    async def run_exploration_cycle(
        self,
        cluster_id: str,
        template_id: str,
        entity_sample: List[str],
        categories: Optional[List[ExplorationCategory]] = None
    ) -> ExplorationReport:
        """
        Run full exploration cycle for all categories

        Args:
            cluster_id: Cluster to explore
            template_id: Template to test
            entity_sample: 7 representative entities
            categories: Categories to explore (default: all 8)

        Returns:
            ExplorationReport with aggregated results
        """
        if categories is None:
            categories = list_all_categories()

        logger.info(
            f"🔍 Starting exploration cycle for {cluster_id}/{template_id} "
            f"({len(categories)} categories, {len(entity_sample)} entities)"
        )

        # Create report
        report = ExplorationReport(
            cluster_id=cluster_id,
            template_id=template_id,
            category=ExplorationCategory.JOBS_BOARD_EFFECTIVENESS  # Placeholder
        )

        # Run exploration for each category
        for category in categories:
            logger.info(f"🔍 Exploring category: {category.value}")

            category_report = await self.explore_category(
                cluster_id=cluster_id,
                template_id=template_id,
                entity_sample=entity_sample,
                category=category
            )

            # Add entries to main report
            for entry in category_report.entries:
                report.add_entry(entry)

        # Log summary
        logger.info(
            f"✅ Exploration cycle complete: "
            f"{len(report.entries)} entries, "
            f"{report.total_observations} observations, "
            f"{report.average_confidence:.2%} avg confidence"
        )

        return report

    async def explore_category(
        self,
        cluster_id: str,
        template_id: str,
        entity_sample: List[str],
        category: ExplorationCategory
    ) -> ExplorationReport:
        """
        Explore single category across entity sample

        Args:
            cluster_id: Cluster to explore
            template_id: Template to test
            entity_sample: Entities to explore (default: 7)
            category: Category to explore

        Returns:
            ExplorationReport for this category
        """
        logger.info(f"🔍 Exploring {category.value} across {len(entity_sample)} entities")

        # Get category metadata
        metadata = get_category_metadata(category)

        # Create category report
        report = ExplorationReport(
            cluster_id=cluster_id,
            template_id=template_id,
            category=category
        )

        # Explore each entity
        for entity_name in entity_sample:
            logger.debug(f"🔍 Exploring {entity_name} for {category.value}")

            # Run exploration for this entity
            entry = await self.explore_entity(
                cluster_id=cluster_id,
                template_id=template_id,
                entity_sample=entity_sample,
                category=category,
                focus_entity=entity_name
            )

            if entry:
                # Append to evidence store
                self.evidence_store.append(entry)

                # Add to report
                report.add_entry(entry)

        # Log category summary
        logger.info(
            f"✅ {category.value} complete: "
            f"{report.total_observations} observations, "
            f"{len(report.get_repeatable_patterns())} repeatable patterns"
        )

        return report

    async def explore_entity(
        self,
        cluster_id: str,
        template_id: str,
        entity_sample: List[str],
        category: ExplorationCategory,
        focus_entity: str
    ) -> Optional[ExplorationLogEntry]:
        """
        Explore single entity for category using actual Claude + BrightData logic

        Args:
            cluster_id: Cluster being explored
            template_id: Template being tested
            entity_sample: Full entity sample
            category: Category to explore
            focus_entity: Entity to focus on

        Returns:
            ExplorationLogEntry if exploration successful
        """
        from backend.claude_client import ClaudeClient
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.entity_domain_discovery import EntityDomainDiscovery

        # Get category metadata
        metadata = get_category_metadata(category)

        # Create log entry
        entry = ExplorationLogEntry(
            cluster_id=cluster_id,
            template_id=template_id,
            entity_sample=entity_sample,
            category=category,
            hypothesis=f"Test {category.value} for {focus_entity}",
            exploration_method="Claude Code + BrightData SDK"
        )

        # Initialize clients
        claude = ClaudeClient()
        brightdata = BrightDataSDKClient()
        domain_discovery = EntityDomainDiscovery()

        patterns_observed = []
        confidence_signals = []
        negative_findings = []

        try:
            # =====================================================================
            # CATEGORY-SPECIFIC EXPLORATION LOGIC
            # =====================================================================

            if category == ExplorationCategory.OFFICIAL_DOMAIN_DISCOVERY:
                # Discover official domains
                logger.info(f"🔍 Discovering domains for {focus_entity}")

                discovered_domains = await domain_discovery.discover_domain(focus_entity)

                if discovered_domains:
                    patterns_observed.append(f"Found {len(discovered_domains)} official domains")
                    confidence_signals.append(0.9 if len(discovered_domains) >= 2 else 0.7)
                    entry.brightdata_query = f"Domain discovery for {focus_entity}"
                    entry.brightdata_results = {"domains": discovered_domains}
                else:
                    negative_findings.append(f"No domains found for {focus_entity}")

            elif category == ExplorationCategory.JOBS_BOARD_EFFECTIVENESS:
                # Search for job postings
                logger.info(f"🔍 Searching job postings for {focus_entity}")

                # Use BrightData SDK to search for jobs
                search_results = await brightdata.search_engine(
                    query=f'"{focus_entity}" jobs CRM Digital Data',
                    engine="google",
                    num_results=10
                )

                if search_results.get("status") == "success":
                    results = search_results.get("results", [])

                    # Look for strategic job titles
                    strategic_keywords = ["CRM", "Digital", "Data", "Head of", "Director", "VP", "Chief"]
                    strategic_jobs = [
                        r for r in results
                        if any(kw.lower() in r.get("title", "").lower() for kw in strategic_keywords)
                    ]

                    if strategic_jobs:
                        patterns_observed.append(f"Found {len(strategic_jobs)} strategic job postings")
                        confidence_signals.append(0.85)
                        entry.brightdata_results = {"jobs": strategic_jobs[:5]}
                    else:
                        negative_findings.append("No strategic job postings found")

                # Also scrape official site careers page
                try:
                    # Discover domain first
                    domains = await domain_discovery.discover_domain(focus_entity)
                    if domains:
                        domain = domains[0]
                        jobs_url = f"https://{domain}/careers"

                        scrape_result = await brightdata.scrape_as_markdown(jobs_url)

                        if scrape_result.get("status") == "success":
                            content = scrape_result.get("content", "").lower()

                            # Count strategic roles in content
                            role_count = sum(
                                content.count(kw.lower())
                                for kw in ["crm", "digital", "data", "analytics"]
                            )

                            if role_count > 5:
                                patterns_observed.append(f"Careers page has {role_count} strategic keyword mentions")
                                confidence_signals.append(0.8)

                except Exception as e:
                    logger.warning(f"⚠️ Error scraping jobs board: {e}")
                    negative_findings.append(f"Jobs board scraping failed: {str(e)}")

            elif category == ExplorationCategory.OFFICIAL_SITE_RELIABILITY:
                # Check official site for signals
                logger.info(f"🔍 Checking official site for {focus_entity}")

                domains = await domain_discovery.discover_domain(focus_entity)

                if domains:
                    domain = domains[0]

                    # Look for news, press, partnership pages
                    paths_to_try = [
                        f"https://{domain}/news",
                        f"https://{domain}/press",
                        f"https://{domain}/partners"
                    ]

                    for path in paths_to_try:
                        try:
                            result = await brightdata.scrape_as_markdown(path)

                            if result.get("status") == "success":
                                content = result.get("content", "").lower()

                                # Look for partnership/tech keywords
                                tech_keywords = ["crm", "salesforce", "hubspot", "sap", "oracle", "partnership", "partner"]

                                keyword_count = sum(content.count(kw) for kw in tech_keywords)

                                if keyword_count >= 3:
                                    patterns_observed.append(f"Found {keyword_count} tech partnership indicators on {path}")
                                    confidence_signals.append(0.75)

                                    # Store successful path
                                    if "discovered_channels" not in entry.brightdata_results:
                                        entry.brightdata_results["discovered_channels"] = []
                                    entry.brightdata_results["discovered_channels"].append(path)

                        except Exception as e:
                            logger.debug(f"Path {path} failed: {e}")
                            negative_findings.append(f"Path {path} not accessible")

            elif category == ExplorationCategory.STRATEGIC_HIRE_INDICATORS:
                # Look for C-level and VP hires
                logger.info(f"🔍 Checking strategic hires for {focus_entity}")

                search_results = await brightdata.search_engine(
                    query=f'"{focus_entity}" "Chief Digital Officer" OR "VP Digital" OR "Head of CRM"',
                    engine="google",
                    num_results=10
                )

                if search_results.get("status") == "success":
                    results = search_results.get("results", [])

                    # Count strategic hire indicators
                    strategic_hires = len(results)

                    if strategic_hires >= 2:
                        patterns_observed.append(f"Found {strategic_hires} strategic hire signals")
                        confidence_signals.append(0.9)
                        entry.brightdata_results = {"strategic_hires": results[:3]}
                    else:
                        negative_findings.append(f"Only {strategic_hires} strategic hire found")

            elif category == ExplorationCategory.PARTNERSHIP_SIGNALS:
                # Look for tech partner announcements
                logger.info(f"🔍 Checking partnership signals for {focus_entity}")

                search_results = await brightdata.search_engine(
                    query=f'"{focus_entity}" partnership CRM platform OR "digital transformation" OR "fan engagement"',
                    engine="google",
                    num_results=10
                )

                if search_results.get("status") == "success":
                    results = search_results.get("results", [])

                    # Look for vendor names in results
                    vendor_names = ["salesforce", "sap", "oracle", "adobe", "hubspot", "mailchimp"]
                    partner_signals = [
                        r for r in results
                        if any(vendor in r.get("title", "").lower() or vendor in r.get("snippet", "").lower()
                           for vendor in vendor_names)
                    ]

                    if partner_signals:
                        patterns_observed.append(f"Found {len(partner_signals)} tech partner signals")
                        confidence_signals.append(0.85)
                        entry.brightdata_results = {"partner_signals": partner_signals[:3]}

            elif category in [
                ExplorationCategory.SEMANTIC_FILTERING,
                ExplorationCategory.HISTORICAL_PATTERN_RECOGNITION,
                ExplorationCategory.CLUSTER_PATTERN_REPLICATION
            ]:
                # These require Claude reasoning - use Claude client
                logger.info(f"🧠 Using Claude for {category.value} analysis")

                claude_prompt = f"""Analyze {focus_entity} (a sports entity) for {category.value.replace('_', ' ')}.

Provide:
1. Patterns observed (list)
2. Confidence scores (0.0-1.0 for each pattern)
3. Negative findings (what was NOT found)

Return as JSON:
{{
  "patterns": ["pattern1", "pattern2"],
  "confidences": [0.8, 0.7],
  "negative_findings": ["not found1", "not found2"]
}}
"""

                try:
                    response = await claude.query(prompt=claude_prompt, max_tokens=1000)

                    # Parse Claude's response
                    import json
                    import re

                    json_match = re.search(r'\{[^{}]*"patterns"[^{}]*\}', response, re.DOTALL)

                    if json_match:
                        claude_result = json.loads(json_match.group(0))

                        patterns_observed = claude_result.get("patterns", [])
                        confidence_signals = claude_result.get("confidences", [])
                        negative_findings = claude_result.get("negative_findings", [])

                        entry.claude_prompt = claude_prompt
                        entry.claude_response = response

                except Exception as e:
                    logger.warning(f"⚠️ Claude analysis failed: {e}")
                    negative_findings.append(f"Claude analysis failed: {str(e)}")

            # =====================================================================
            # STORE RESULTS IN ENTRY
            # =====================================================================

            entry.patterns_observed = patterns_observed
            entry.confidence_signals = confidence_signals
            entry.negative_findings = negative_findings

            logger.info(
                f"✅ Exploration complete for {focus_entity}: "
                f"{len(patterns_observed)} patterns, "
                f"{sum(confidence_signals)/len(confidence_signals) if confidence_signals else 0:.2%} avg confidence"
            )

        except Exception as e:
            logger.error(f"❌ Exploration failed for {focus_entity}: {e}")
            entry.negative_findings.append(f"Exploration error: {str(e)}")
            return entry

        return entry

    def generate_pattern_repeatability_report(
        self,
        report: ExplorationReport
    ) -> Dict[str, Any]:
        """
        Generate pattern repeatability report

        Args:
            report: ExplorationReport to analyze

        Returns:
            Dictionary with repeatability metrics
        """
        repeatable_patterns = report.get_repeatable_patterns(min_entities=3)

        return {
            "total_patterns": len(report.unique_patterns),
            "repeatable_patterns": len(repeatable_patterns),
            "repeatable_patterns_list": repeatable_patterns,
            "pattern_frequency": report.pattern_frequency,
            "entity_coverage": report.entity_coverage,
            "average_confidence": report.average_confidence,
            "meets_promotion_threshold": report.meets_promotion_threshold(),
            "meets_guard_threshold": report.meets_guard_threshold()
        }


# =============================================================================
# Convenience Functions
# =============================================================================

async def run_exploration(
    cluster_id: str,
    template_id: str,
    entity_sample: List[str],
    categories: Optional[List[ExplorationCategory]] = None
) -> ExplorationReport:
    """
    Convenience function to run exploration cycle

    Args:
        cluster_id: Cluster to explore
        template_id: Template to test
        entity_sample: 7 representative entities
        categories: Categories to explore (default: all 8)

    Returns:
        ExplorationReport with aggregated results
    """
    coordinator = ExplorationCoordinator()
    return await coordinator.run_exploration_cycle(
        cluster_id=cluster_id,
        template_id=template_id,
        entity_sample=entity_sample,
        categories=categories
    )
