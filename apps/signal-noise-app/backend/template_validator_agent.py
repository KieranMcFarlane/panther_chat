"""
Template Validation Agent

Claude Agent SDK orchestration layer for template validation.

Architecture:
1. Classify entity (deterministic, rule-based)
2. Bind template placeholders to entity-specific values
3. Orchestrate BrightData scraping via SDK (with httpx fallback)
4. Score detected signals against patterns
5. Return validation result with confidence

Key Design:
- DETERMINISTIC classification (no LLM calls)
- Placeholder binding for entity-specific URLs
- Pattern matching with confidence scoring
- Graceful degradation via HTTP fallback if SDK fails
"""

import copy
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime

from backend.template_loader import Template, TemplateLoader
from backend.claude_client import ClaudeClient
from backend.brightdata_sdk_client import BrightDataSDKClient

logger = logging.getLogger(__name__)


@dataclass
class Entity:
    """Entity for template validation"""

    entity_id: str
    name: str
    sport: str
    org_type: str
    estimated_revenue_band: str
    digital_maturity: str
    entity_domain: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of template validation for entity"""

    template_id: str
    entity_id: str
    passed: bool
    signals_detected: int
    confidence_score: float
    execution_time_seconds: float
    errors: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class TemplateValidationAgent:
    """
    Claude Agent SDK-based template validation

    Orchestrates template validation with:
    - Deterministic entity classification
    - Template placeholder binding
    - BrightData SDK tool calls (with HTTP fallback)
    - Signal pattern matching
    """

    def __init__(
        self,
        claude_client: Optional[ClaudeClient] = None,
        template_loader: Optional[TemplateLoader] = None,
        brightdata_client: Optional[BrightDataSDKClient] = None
    ):
        """
        Initialize validation agent

        Args:
            claude_client: Claude client (optional, creates default)
            template_loader: Template loader (optional, creates default)
            brightdata_client: BrightData SDK client (optional, creates default with HTTP fallback)
        """
        self.claude = claude_client or ClaudeClient()
        self.loader = template_loader or TemplateLoader()
        # Use BrightData SDK client with automatic HTTP fallback
        self.brightdata = brightdata_client or BrightDataSDKClient()

        logger.info("🤖 TemplateValidationAgent initialized")

    def classify_entity(self, entity: Entity) -> str:
        """
        DETERMINISTIC entity classification (no LLM calls)

        Rules:
        - top_tier_club: club + high + high
        - mid_tier_club: club + medium + medium
        - top_tier_league: league + high + high
        - etc.

        Args:
            entity: Entity to classify

        Returns:
            Cluster ID string
        """
        # Build cluster ID from entity attributes
        parts = []

        # Digital maturity tier
        if entity.digital_maturity == "high":
            parts.append("top_tier")
        elif entity.digital_maturity == "medium":
            parts.append("mid_tier")
        else:
            parts.append("low_tier")

        # Org type
        parts.append(entity.org_type)

        # Sport (if not unknown)
        if entity.sport != "unknown":
            parts.append(entity.sport.lower())

        cluster_id = "_".join(parts)

        logger.info(f"🏷️ Classified {entity.name} as: {cluster_id}")

        return cluster_id

    def bind_placeholders(self, template: Template, entity: Entity) -> Template:
        """
        Bind entity-specific placeholders in template

        Replaces:
        - {entity_name} -> entity.name (lowercase, spaces -> hyphens)
        - {entity_domain} -> entity.entity_domain

        Args:
            template: Template with placeholders
            entity: Entity to bind to

        Returns:
            New Template with bound placeholders
        """
        bound = copy.deepcopy(template)

        # Prepare entity name for URLs (lowercase, spaces to hyphens)
        entity_name_url = entity.name.lower().replace(" ", "-")

        for channel in bound.signal_channels:
            # Bind example_domains
            for i, domain in enumerate(channel["example_domains"]):
                domain = domain.replace("{entity_name}", entity_name_url)
                domain = domain.replace("{entity_domain}", entity.entity_domain or "")
                channel["example_domains"][i] = domain

        logger.debug(f"🔗 Bound placeholders for {template.template_id}")

        return bound

    async def validate_template_for_entity(
        self,
        template: Template,
        entity: Entity
    ) -> ValidationResult:
        """
        Validate template for entity with live BrightData scraping

        Args:
            template: Template to validate
            entity: Entity to validate against

        Returns:
            ValidationResult with confidence score
        """
        start_time = datetime.now()

        try:
            logger.info(
                f"🔍 Validating {template.template_id} for {entity.name}"
            )

            # 1. Bind placeholders
            bound_template = self.bind_placeholders(template, entity)

            # 2. Iterate signal channels
            signals_detected = 0
            details = {}
            errors = []

            for channel in bound_template.signal_channels:
                channel_type = channel["channel_type"]
                priority = channel.get("scraping_priority", 5)

                # Only process high/medium priority channels (>= 5)
                if priority < 5:
                    continue

                try:
                    if channel_type == "jobs_board":
                        result = await self._scrape_jobs_board(
                            entity, bound_template, channel
                        )
                        details[channel_type] = result
                        signals_detected += result.get("signals_found", 0)

                    elif channel_type == "official_site":
                        result = await self._scrape_official_site(
                            entity, bound_template, channel
                        )
                        details[channel_type] = result
                        signals_detected += result.get("signals_found", 0)

                    elif channel_type == "partner_site":
                        result = await self._scrape_partner_site(
                            entity, bound_template, channel
                        )
                        details[channel_type] = result
                        signals_detected += result.get("signals_found", 0)

                    elif channel_type == "press":
                        result = await self._scrape_press(
                            entity, bound_template, channel
                        )
                        details[channel_type] = result
                        signals_detected += result.get("signals_found", 0)

                except Exception as e:
                    error_msg = f"{channel_type} failed: {str(e)}"
                    errors.append(error_msg)
                    logger.error(f"❌ {error_msg}")
                    details[channel_type] = {
                        "status": "error",
                        "error": error_msg,
                        "signals_found": 0
                    }

            # 3. Calculate confidence
            confidence = self._calculate_confidence(
                signals_detected,
                bound_template.signal_patterns,
                details
            )

            # 4. Determine if passed
            passed = confidence >= 0.7

            execution_time = (datetime.now() - start_time).total_seconds()

            result = ValidationResult(
                template_id=template.template_id,
                entity_id=entity.entity_id,
                passed=passed,
                signals_detected=signals_detected,
                confidence_score=confidence,
                execution_time_seconds=execution_time,
                errors=errors,
                details=details
            )

            logger.info(
                f"✅ Validation complete: {entity.name} -> "
                f"confidence={confidence:.2f}, passed={passed}"
            )

            return result

        except Exception as e:
            logger.error(f"❌ Validation failed: {e}")
            return ValidationResult(
                template_id=template.template_id,
                entity_id=entity.entity_id,
                passed=False,
                signals_detected=0,
                confidence_score=0.0,
                execution_time_seconds=(datetime.now() - start_time).total_seconds(),
                errors=[str(e)],
                details={}
            )

    async def _scrape_jobs_board(
        self,
        entity: Entity,
        template: Template,
        channel: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Scrape jobs boards for entity"""
        # Extract keywords from signal patterns
        keywords = []
        for pattern in template.signal_patterns:
            for indicator in pattern.get("early_indicators", []):
                # Extract keywords from indicator
                if "Job posting:" in indicator:
                    keyword = indicator.split(":")[-1].strip().strip("'\"")
                    keywords.append(keyword)

        # Call BrightData jobs board search
        result = await self.brightdata.scrape_jobs_board(
            entity.name,
            keywords[:5]  # Limit to 5 keywords
        )

        # Parse and count signals
        signals_found = self._count_signals_in_result(
            result,
            template.signal_patterns
        )

        return {
            "status": "success",
            "signals_found": signals_found,
            "keywords_used": keywords[:5],
            "result_summary": {
                "total_results": len(result.get("results", [])),
                "engine": result.get("engine", "unknown")
            }
        }

    async def _scrape_official_site(
        self,
        entity: Entity,
        template: Template,
        channel: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Scrape official entity website"""
        # Use first example domain
        domains = channel.get("example_domains", [])
        if not domains:
            return {
                "status": "skipped",
                "signals_found": 0,
                "reason": "No domains to scrape"
            }

        # Call BrightData scraper on first domain
        url = domains[0]
        result = await self.brightdata.scrape_as_markdown(url)

        # Parse for signals
        signals_found = self._count_signals_in_text(
            result.get("content", ""),
            template.signal_patterns
        )

        return {
            "status": "success",
            "signals_found": signals_found,
            "url_scraped": url,
            "content_length": len(result.get("content", ""))
        }

    async def _scrape_partner_site(
        self,
        entity: Entity,
        template: Template,
        channel: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Scrape partner sites for entity mentions"""
        domains = channel.get("example_domains", [])[:3]  # Limit to 3

        # Batch scrape partner sites
        result = await self.brightdata.scrape_batch(domains)

        # Count signals across all results
        signals_found = 0
        for item in result.get("results", []):
            content = item.get("content", "")
            signals_found += self._count_signals_in_text(
                content,
                template.signal_patterns
            )

        return {
            "status": "success",
            "signals_found": signals_found,
            "domains_scraped": len(domains),
            "successful": result.get("successful", 0)
        }

    async def _scrape_press(
        self,
        entity: Entity,
        template: Template,
        channel: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Scrape press for entity mentions"""
        result = await self.brightdata.scrape_press_release(entity.name)

        # Count signals
        signals_found = self._count_signals_in_result(
            result,
            template.signal_patterns
        )

        return {
            "status": "success",
            "signals_found": signals_found,
            "total_results": len(result.get("results", []))
        }

    def _count_signals_in_result(
        self,
        result: Dict[str, Any],
        patterns: List[Dict[str, Any]]
    ) -> int:
        """Count signal matches in search result"""
        count = 0

        for item in result.get("results", []):
            text = item.get("snippet", "") + " " + item.get("title", "")
            count += self._count_signals_in_text(text, patterns)

        return count

    def _count_signals_in_text(
        self,
        text: str,
        patterns: List[Dict[str, Any]]
    ) -> int:
        """Count signal pattern matches in text"""
        if not text:
            return 0

        text_lower = text.lower()
        count = 0

        for pattern in patterns:
            for indicator in pattern.get("early_indicators", []):
                # Extract keyword from indicator
                if ":" in indicator:
                    keyword = indicator.split(":")[-1].strip().strip("'\"").lower()
                else:
                    keyword = indicator.lower()

                # Count occurrences
                if keyword in text_lower:
                    count += 1

        return count

    def _calculate_confidence(
        self,
        signals_detected: int,
        patterns: List[Dict[str, Any]],
        details: Dict[str, Any]
    ) -> float:
        """
        Calculate confidence score from detected signals

        Args:
            signals_detected: Total signals found
            patterns: Signal patterns with confidence weights
            details: Channel-specific details

        Returns:
            Confidence score (0.0 - 1.0)
        """
        if not patterns:
            return 0.0

        # Base confidence from signal count vs patterns
        max_possible = len(patterns) * 2  # Assume 2 matches per pattern
        signal_ratio = min(signals_detected / max_possible, 1.0)

        # Weight by pattern confidence
        avg_pattern_weight = sum(
            p.get("confidence_weight", 0.5)
            for p in patterns
        ) / len(patterns)

        # Combine
        confidence = signal_ratio * avg_pattern_weight

        return min(confidence, 1.0)


# =============================================================================
# Convenience Functions
# =============================================================================

async def validate_template(
    template_id: str,
    entity_data: Dict[str, Any]
) -> ValidationResult:
    """
    Convenience function to validate template for entity

    Args:
        template_id: Template identifier
        entity_data: Entity dict with required fields

    Returns:
        ValidationResult
    """
    loader = TemplateLoader()
    agent = TemplateValidationAgent()

    template = loader.get_template(template_id)
    if not template:
        raise ValueError(f"Template not found: {template_id}")

    entity = Entity(**entity_data)

    return await agent.validate_template_for_entity(template, entity)


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def test_validation_agent():
        """Test template validation agent"""

        loader = TemplateLoader()
        agent = TemplateValidationAgent()

        # Get first template
        templates = loader.get_all_templates()
        if not templates:
            print("❌ No templates found")
            return

        template = templates[0]

        # Create test entity
        entity = Entity(
            entity_id="arsenal-fc",
            name="Arsenal FC",
            sport="Football",
            org_type="club",
            estimated_revenue_band="high",
            digital_maturity="high",
            entity_domain="arsenal.com"
        )

        # Validate
        result = await agent.validate_template_for_entity(template, entity)

        # Print results
        print("=== Validation Result ===")
        print(f"Template: {result.template_id}")
        print(f"Entity: {result.entity_id}")
        print(f"Passed: {result.passed}")
        print(f"Signals Detected: {result.signals_detected}")
        print(f"Confidence: {result.confidence_score:.2f}")
        print(f"Execution Time: {result.execution_time_seconds:.2f}s")
        print(f"\nDetails:")
        print(json.dumps(result.details, indent=2))

        if result.errors:
            print(f"\nErrors: {result.errors}")

    asyncio.run(test_validation_agent())
