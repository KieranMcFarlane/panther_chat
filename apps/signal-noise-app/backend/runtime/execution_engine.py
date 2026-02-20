"""
Execution Engine

Deterministic runtime execution using Bright Data SDK only (NO Claude, NO MCP).

Core principle: Runtime execution is 100% deterministic.
- No Claude involvement (no LLM calls)
- No MCP tools (use SDK directly)
- All 3,400+ entities scaled execution
- Cache bindings with performance tracking
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.template_runtime_binding import RuntimeBinding, RuntimeBindingCache
from backend.brightdata_sdk_client import BrightDataSDKClient

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    """
    Result from deterministic execution

    Attributes:
        success: Whether execution succeeded
        signals_found: Number of signals discovered
        channels_explored: Number of channels explored
        execution_time_seconds: Time taken
        claude_calls: Number of Claude calls (should always be 0)
        mcp_calls: Number of MCP calls (should always be 0)
        sdk_calls: Number of Bright Data SDK calls
        error: Error message if execution failed
        metadata: Additional execution context
    """
    success: bool
    signals_found: int
    channels_explored: int
    execution_time_seconds: float
    claude_calls: int = 0
    mcp_calls: int = 0
    sdk_calls: int = 0
    error: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ExecutionEngine:
    """
    Deterministic execution engine

    Executes runtime bindings without any Claude or MCP involvement.
    """

    def __init__(
        self,
        binding_cache: Optional[RuntimeBindingCache] = None,
        brightdata_client: Optional[BrightDataSDKClient] = None
    ):
        """
        Initialize execution engine

        Args:
            binding_cache: Optional binding cache (creates default if not provided)
            brightdata_client: Optional BrightData client (creates default if not provided)
        """
        self.binding_cache = binding_cache or RuntimeBindingCache()
        self.brightdata_client = brightdata_client or BrightDataSDKClient()

        logger.info("⚙️ ExecutionEngine initialized (deterministic mode)")

    async def execute_binding_deterministic(
        self,
        template_id: str,
        entity_id: str,
        entity_name: str
    ) -> ExecutionResult:
        """
        Execute binding with pure deterministic logic (no Claude/MCP)

        Args:
            template_id: Template to execute
            entity_id: Entity identifier
            entity_name: Entity name

        Returns:
            ExecutionResult with deterministic execution metrics
        """
        start_time = datetime.now()
        logger.info(f"⚙️ Executing binding: {template_id}/{entity_id}")

        # Check cache for existing binding
        binding = self.binding_cache.get_binding(entity_id)

        if not binding:
            # No cached binding, create new one
            logger.info(f"ℹ️ No cached binding for {entity_id}, creating new one")

            binding = await self._create_new_binding(
                template_id=template_id,
                entity_id=entity_id,
                entity_name=entity_name
            )

            if not binding:
                return ExecutionResult(
                    success=False,
                    signals_found=0,
                    channels_explored=0,
                    execution_time_seconds=(datetime.now() - start_time).total_seconds(),
                    error="Failed to create binding"
                )

        # Execute discovered channels (deterministic only)
        result = await self._execute_channels(binding)

        # Update binding performance
        binding.mark_used(success=result.success)
        self.binding_cache.set_binding(binding)

        # Add execution time
        result.execution_time_seconds = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"✅ Execution complete: {result.signals_found} signals, "
            f"{result.channels_explored} channels, "
            f"{result.execution_time_seconds:.2f}s"
        )

        return result

    async def _create_new_binding(
        self,
        template_id: str,
        entity_id: str,
        entity_name: str
    ) -> Optional[RuntimeBinding]:
        """
        Create new runtime binding using deterministic discovery only

        Uses BrightData SDK (NO Claude, NO MCP) for:
        - Domain discovery via search_engine
        - Channel discovery via scrape_as_markdown
        - Signal extraction via pattern matching

        Args:
            template_id: Template to bind
            entity_id: Entity identifier
            entity_name: Entity name

        Returns:
            RuntimeBinding if successful, None otherwise
        """
        from backend.brightdata_sdk_client import BrightDataSDKClient
        from backend.entity_domain_discovery import EntityDomainDiscovery

        discovered_domains = []
        discovered_channels = {}
        enriched_patterns = {}

        try:
            # =====================================================================
            # STEP 1: DOMAIN DISCOVERY (DETERMINISTIC)
            # =====================================================================
            logger.info(f"🔍 Discovering domains for {entity_name}")

            domain_discovery = EntityDomainDiscovery()
            domains = await domain_discovery.discover_domain(entity_name)

            if domains:
                discovered_domains = domains
                logger.info(f"✅ Found {len(domains)} domains: {domains}")
            else:
                logger.warning(f"⚠️ No domains found for {entity_name}")

            # =====================================================================
            # STEP 2: CHANNEL DISCOVERY (DETERMINISTIC)
            # =====================================================================
            logger.info(f"🔍 Discovering channels for {entity_name}")

            brightdata = BrightDataSDKClient()

            # Discover channels for each domain
            for domain in discovered_domains:
                domain_channels = {}

                # 1. Jobs Board Channel
                try:
                    jobs_url = f"https://{domain}/careers"
                    scrape_result = await brightdata.scrape_as_markdown(jobs_url)

                    if scrape_result.get("status") == "success":
                        content = scrape_result.get("content", "")
                        if content and len(content) > 100:  # Minimum content threshold
                            domain_channels["jobs_board"] = [jobs_url]
                            logger.info(f"✅ Found jobs board: {jobs_url}")
                except Exception as e:
                    logger.debug(f"Jobs board not found: {e}")

                # 2. Official Site Channel
                try:
                    site_url = f"https://{domain}"
                    scrape_result = await brightdata.scrape_as_markdown(site_url)

                    if scrape_result.get("status") == "success":
                        content = scrape_result.get("content", "")
                        if content and len(content) > 200:
                            domain_channels["official_site"] = [site_url]
                            logger.info(f"✅ Found official site: {site_url}")
                except Exception as e:
                    logger.debug(f"Official site scrape failed: {e}")

                # 3. News/Press Channel
                try:
                    news_url = f"https://{domain}/news"
                    scrape_result = await brightdata.scrape_as_markdown(news_url)

                    if scrape_result.get("status") == "success":
                        content = scrape_result.get("content", "")
                        if content and len(content) > 100:
                            domain_channels["news"] = [news_url]
                            logger.info(f"✅ Found news section: {news_url}")
                except Exception as e:
                    logger.debug(f"News section not found: {e}")

                discovered_channels[domain] = list(domain_channels.keys())

            # =====================================================================
            # STEP 3: SIGNAL EXTRACTION (DETERMINISTIC PATTERN MATCHING)
            # =====================================================================
            logger.info(f"🔍 Extracting signals for {entity_name}")

            # Define signal patterns (deterministic, no Claude)
            signal_patterns = {
                "strategic_leadership": [
                    "chief digital officer",
                    "head of digital",
                    "vp of digital",
                    "director of digital",
                    "head of crm",
                    "crm director"
                ],
                "tech_keywords": [
                    "salesforce",
                    "sap",
                    "oracle",
                    "hubspot",
                    "adobe",
                    "mailchimp",
                    "Microsoft dynamics"
                ],
                "procurement_signals": [
                    "request for proposal",
                    "rfp",
                    "vendor selection",
                    "platform migration",
                    "system implementation"
                ]
            }

            # Search for signals across all discovered channels
            for domain, channels in discovered_channels.items():
                for channel_type, urls in channels.items():
                    for url in urls:
                        try:
                            scrape_result = await brightdata.scrape_as_markdown(url)

                            if scrape_result.get("status") == "success":
                                content = scrape_result.get("content", "").lower()

                                # Check for each pattern category
                                for pattern_name, patterns in signal_patterns.items():
                                    matches = [
                                        pattern for pattern in patterns
                                        if pattern.lower() in content
                                    ]

                                    if matches:
                                        if pattern_name not in enriched_patterns:
                                            enriched_patterns[pattern_name] = []

                                        pattern_str = f"{', '.join(matches[:3])} found in {url}"
                                        enriched_patterns[pattern_name].append(pattern_str)

                        except Exception as e:
                            logger.debug(f"Signal extraction failed for {url}: {e}")

            # Count total signals found
            total_signals = sum(
                len(patterns) for patterns in enriched_patterns.values()
            )

            logger.info(f"✅ Extracted {total_signals} signals across {len(enriched_patterns)} pattern types")

            # =====================================================================
            # STEP 4: CREATE BINDING WITH DISCOVERED DATA
            # =====================================================================
            binding = RuntimeBinding(
                template_id=template_id,
                entity_id=entity_id,
                entity_name=entity_name,
                discovered_domains=discovered_domains,
                discovered_channels=discovered_channels,
                enriched_patterns=enriched_patterns,
                state="EXPLORING",
                confidence_adjustment=0.0
            )

            logger.info(f"✅ Binding created for {entity_id} with {len(discovered_domains)} domains, {len(discovered_channels)} channels")

        except Exception as e:
            logger.error(f"❌ Binding creation failed for {entity_id}: {e}")

            # Create minimal binding on error
            binding = RuntimeBinding(
                template_id=template_id,
                entity_id=entity_id,
                entity_name=entity_name,
                discovered_domains=[],
                discovered_channels={},
                enriched_patterns={},
                state="EXPLORING"
            )

        return binding

    async def _execute_channels(
        self,
        binding: RuntimeBinding
    ) -> ExecutionResult:
        """
        Execute discovered channels using Bright Data SDK only

        Args:
            binding: Runtime binding with discovered channels

        Returns:
            ExecutionResult
        """
        signals_found = 0
        channels_explored = 0
        sdk_calls = 0

        # Define deterministic signal patterns (NO Claude)
        signal_indicators = {
            # Strategic leadership hires
            "leadership": [
                "chief digital officer",
                "head of digital",
                "vp digital",
                "director of digital",
                "head of crm",
                "crm director",
                "chief technology officer",
                "cto",
                "cdo"
            ],
            # Tech platform mentions
            "platform": [
                "salesforce",
                "sap",
                "oracle",
                "hubspot",
                "adobe experience cloud",
                "microsoft dynamics",
                "service now"
            ],
            # RFP/procurement language
            "procurement": [
                "request for proposal",
                "rfp",
                "vendor selection",
                "platform migration",
                "system implementation",
                "digital transformation",
                "crm implementation"
            ]
        }

        # Execute each discovered channel
        for channel_type, urls in binding.discovered_channels.items():
            logger.debug(f"🔍 Exploring channel: {channel_type} ({len(urls)} URLs)")

            for url in urls:
                try:
                    # Use BrightData SDK (NOT MCP)
                    result = await self.brightdata_client.scrape_as_markdown(url)

                    sdk_calls += 1

                    if result.get("status") == "success":
                        content = result.get("content", "").lower()

                        # Extract signals using deterministic pattern matching
                        for signal_type, indicators in signal_indicators.items():
                            matches_found = []

                            for indicator in indicators:
                                if indicator.lower() in content:
                                    matches_found.append(indicator)

                            if matches_found:
                                # Count unique signal occurrences
                                unique_signals = len(set(matches_found))
                                signals_found += unique_signals

                                logger.debug(
                                    f"  Found {unique_signals} {signal_type} signals in {url}"
                                )

                        channels_explored += 1

                except Exception as e:
                    logger.warning(f"⚠️ Error scraping {url}: {e}")
                    continue

        return ExecutionResult(
            success=True,
            signals_found=signals_found,
            channels_explored=channels_explored,
            sdk_calls=sdk_calls,
            execution_time_seconds=0.0,  # Will be set by caller
            metadata={
                "channel_types": list(binding.discovered_channels.keys()),
                "binding_version": binding.version
            }
        )

    def verify_deterministic(self, result: ExecutionResult) -> bool:
        """
        Verify that execution was truly deterministic

        Args:
            result: Execution result to verify

        Returns:
            True if deterministic (no Claude/MCP calls)
        """
        if result.claude_calls > 0:
            logger.error(f"❌ Deterministic violation: {result.claude_calls} Claude calls detected")
            return False

        if result.mcp_calls > 0:
            logger.error(f"❌ Deterministic violation: {result.mcp_calls} MCP calls detected")
            return False

        return True


# =============================================================================
# Convenience Functions
# =============================================================================

async def execute_binding(
    template_id: str,
    entity_id: str,
    entity_name: str
) -> ExecutionResult:
    """
    Convenience function to execute binding deterministically

    Args:
        template_id: Template to execute
        entity_id: Entity identifier
        entity_name: Entity name

    Returns:
        ExecutionResult
    """
    engine = ExecutionEngine()
    return await engine.execute_binding_deterministic(
        template_id=template_id,
        entity_id=entity_id,
        entity_name=entity_name
    )
