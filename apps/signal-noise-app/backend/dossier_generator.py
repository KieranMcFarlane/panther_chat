#!/usr/bin/env python3
"""
Entity Dossier Generator with Model Cascade Strategy

Generates multi-section intelligence dossiers using cost-optimized model selection:
- Haiku (80%): Core info, quick actions, news, performance, contact
- Sonnet (15%): Digital maturity, leadership, AI assessment, challenges
- Opus (5%): Strategic analysis, connections

Priority Tiers:
- Basic (0-20): 3 sections, ~$0.0004, ~5s
- Standard (21-50): 7 sections, ~$0.0095, ~15s
- Premium (51-100): 11 sections, ~$0.057, ~30s
"""

import asyncio
import json
import logging
import random
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from schemas import EntityDossier, DossierSection, DossierTier, CacheStatus
from claude_client import ClaudeClient

# Import data collector
try:
    from dossier_data_collector import DossierDataCollector, DossierData, EntityMetadata
    DATA_COLLECTOR_AVAILABLE = True
except ImportError:
    DATA_COLLECTOR_AVAILABLE = False
    logger.warning("DossierDataCollector not available - using placeholder data")

logger = logging.getLogger(__name__)


class EntityDossierGenerator:
    """
    Generate multi-section entity dossiers using model cascade

    Uses intelligent model selection to optimize costs while delivering
    deep insights across 11 dossier sections.
    """

    def __init__(self, claude_client: ClaudeClient, falkordb_client=None):
        """
        Initialize dossier generator

        Args:
            claude_client: Claude client with model cascade support
            falkordb_client: Optional FalkorDB client for entity data
        """
        self.claude_client = claude_client
        self.falkordb_client = falkordb_client

        # Section templates with model assignments
        self.section_templates = {
            # Haiku sections (fast data extraction)
            "core_information": {
                "model": "haiku",
                "prompt_template": "core_info_template",
                "max_tokens": 1000,
                "description": "Basic entity information"
            },
            "quick_actions": {
                "model": "haiku",
                "prompt_template": "quick_actions_template",
                "max_tokens": 1500,
                "description": "Immediate action recommendations"
            },
            "contact_information": {
                "model": "haiku",
                "prompt_template": "contact_info_template",
                "max_tokens": 1000,
                "description": "Contact details and locations"
            },
            "recent_news": {
                "model": "haiku",
                "prompt_template": "news_aggregation_template",
                "max_tokens": 2000,
                "description": "Recent news and developments"
            },
            "current_performance": {
                "model": "haiku",
                "prompt_template": "performance_data_template",
                "max_tokens": 1500,
                "description": "Current performance metrics"
            },

            # Sonnet sections (balanced analysis)
            "digital_maturity": {
                "model": "sonnet",
                "prompt_template": "digital_maturity_template",
                "max_tokens": 2000,
                "description": "Digital maturity assessment"
            },
            "leadership": {
                "model": "sonnet",
                "prompt_template": "leadership_profiling_template",
                "max_tokens": 2500,
                "description": "Leadership team analysis"
            },
            "ai_reasoner_assessment": {
                "model": "sonnet",
                "prompt_template": "ai_assessment_template",
                "max_tokens": 2000,
                "description": "AI reasoner assessment"
            },
            "challenges_opportunities": {
                "model": "sonnet",
                "prompt_template": "challenges_opportunities_template",
                "max_tokens": 2000,
                "description": "Challenges and opportunities"
            },

            # Opus sections (deep strategic analysis)
            "strategic_analysis": {
                "model": "opus",
                "prompt_template": "strategic_analysis_template",
                "max_tokens": 3000,
                "description": "Deep strategic analysis"
            },
            "connections": {
                "model": "opus",
                "prompt_template": "connections_analysis_template",
                "max_tokens": 3000,
                "description": "Network connections analysis"
            },

            # Outreach strategy section (NEW)
            "outreach_strategy": {
                "model": "sonnet",
                "prompt_template": "outreach_strategy_template",
                "max_tokens": 4000,
                "description": "Outreach strategy with conversation trees"
            }
        }

        # Tier section mappings
        self.tier_sections = {
            "BASIC": [
                "core_information",
                "quick_actions",
                "contact_information"
            ],
            "STANDARD": [
                "core_information",
                "quick_actions",
                "contact_information",
                "recent_news",
                "current_performance",
                "leadership",
                "digital_maturity",
                "outreach_strategy"  # NEW for STANDARD
            ],
            "PREMIUM": [
                "core_information",
                "quick_actions",
                "contact_information",
                "recent_news",
                "current_performance",
                "leadership",
                "digital_maturity",
                "ai_reasoner_assessment",
                "challenges_opportunities",
                "strategic_analysis",
                "connections",
                "outreach_strategy"  # NEW for PREMIUM
            ]
        }

    def _determine_tier(self, priority_score: int) -> str:
        """
        Determine dossier tier from priority score

        Args:
            priority_score: Entity priority score (0-100)

        Returns:
            Tier string (BASIC/STANDARD/PREMIUM)
        """
        if priority_score <= 20:
            return "BASIC"
        elif priority_score <= 50:
            return "STANDARD"
        else:
            return "PREMIUM"

    def _get_sections_for_tier(self, tier: str) -> List[str]:
        """
        Get section IDs for a given tier

        Args:
            tier: Dossier tier

        Returns:
            List of section IDs to generate
        """
        return self.tier_sections.get(tier, self.tier_sections["BASIC"])

    async def generate_dossier(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        entity_data: Optional[Dict[str, Any]] = None
    ) -> EntityDossier:
        """
        Generate complete dossier based on priority tier

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity display name
            entity_type: Entity type (CLUB, LEAGUE, VENUE, etc.)
            priority_score: Priority score (0-100) for tier determination
            entity_data: Optional pre-collected entity data (deprecated, auto-collected if None)

        Returns:
            Complete EntityDossier with all sections
        """
        start_time = datetime.now(timezone.utc)

        # Determine tier
        tier = self._determine_tier(priority_score)

        # Get sections for this tier
        sections_to_generate = self._get_sections_for_tier(tier)

        # Create dossier object
        dossier = EntityDossier(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=priority_score,
            tier=tier
        )

        # Collect entity data using DossierDataCollector
        if DATA_COLLECTOR_AVAILABLE:
            logger.info(f"🔍 Collecting entity data for {entity_name}")
            collector = DossierDataCollector()
            dossier_data_obj = await collector.collect_all(entity_id, entity_name)

            # Convert DossierData object to dict format for compatibility
            entity_data = self._dossier_data_to_dict(dossier_data_obj)

            logger.info(f"✅ Data sources used: {', '.join(dossier_data_obj.data_sources_used)}")

            # ENHANCED: Collect multi-source intelligence using BrightData SDK
            if hasattr(collector, '_collect_multi_source_intelligence'):
                logger.info(f"🌐 Collecting multi-source intelligence for {entity_name}")

                # Collect real-time data
                multi_source_data = await collector._collect_multi_source_intelligence(entity_name)

                # Add to entity_data for prompt interpolation
                entity_data["official_site_summary"] = multi_source_data.get("official_site", {}).get("summary", "")
                entity_data["official_site_url"] = multi_source_data.get("official_site", {}).get("url", "")
                entity_data["job_postings_summary"] = self._summarize_job_postings(multi_source_data.get("job_postings", []))
                entity_data["job_postings_count"] = len(multi_source_data.get("job_postings", []))
                entity_data["press_releases_summary"] = self._summarize_press_releases(multi_source_data.get("press_releases", []))
                entity_data["press_releases_count"] = len(multi_source_data.get("press_releases", []))
                entity_data["linkedin_posts_summary"] = self._summarize_linkedin_posts(multi_source_data.get("linkedin_posts", []))
                entity_data["linkedin_posts_count"] = len(multi_source_data.get("linkedin_posts", []))
                entity_data["data_freshness"] = multi_source_data.get("freshness_score", 50)
                entity_data["sources_used"] = multi_source_data.get("sources_used", [])

                logger.info(f"✅ Multi-source data collected: {', '.join(multi_source_data.get('sources_used', []))}")
        elif entity_data is None:
            # Fallback: create minimal entity data dict
            logger.warning("DossierDataCollector unavailable, using placeholder data")
            entity_data = {
                "entity_name": entity_name,
                "entity_id": entity_id,
                "entity_type": entity_type,
                "sport": None,
                "country": None,
                "league_or_competition": None,
                "description": None
            }
        else:
            # Use provided entity_data
            logger.info(f"Using provided entity_data for {entity_name}")

        # Enhance entity_data with real metadata if available
        if DATA_COLLECTOR_AVAILABLE and dossier_data_obj.metadata:
            entity_data = self._inject_falkordb_metadata(entity_data, dossier_data_obj.metadata)
        else:
            # Add fallback placeholder values for templates
            entity_data["metadata_summary"] = f"""
Entity: {entity_name}
Type: {entity_type if 'entity_type' in entity_data else 'CLUB'}
Sport: N/A
Country: N/A
League: N/A
Digital Maturity: N/A
Revenue Band: N/A
Founded: N/A
Stadium: N/A
Capacity: N/A
Website: N/A
            """.strip()
            entity_data["entity_sport"] = entity_data.get("sport")
            entity_data["entity_country"] = entity_data.get("country")
            entity_data["entity_league"] = entity_data.get("league_or_competition")
            entity_data["entity_digital_maturity"] = entity_data.get("digital_maturity")
            entity_data["entity_revenue_band"] = entity_data.get("estimated_revenue_band")
            entity_data["entity_founded"] = entity_data.get("founded")
            entity_data["entity_stadium"] = entity_data.get("stadium")
            entity_data["entity_capacity"] = entity_data.get("capacity")
            entity_data["entity_website"] = entity_data.get("website")
            entity_data["entity_employees"] = entity_data.get("employees")
            entity_data["entity_type"] = entity_type if 'entity_type' in entity_data else 'CLUB'

            if DATA_COLLECTOR_AVAILABLE:
                logger.info("⚠️ Using placeholder data (FalkorDB unavailable)")

        # Generate sections in parallel where possible
        logger.info(f"Generating {len(sections_to_generate)} sections for {entity_name} ({tier} tier)")

        # Group sections by model for parallel execution
        haiku_sections = [s for s in sections_to_generate if self.section_templates[s]["model"] == "haiku"]
        sonnet_sections = [s for s in sections_to_generate if self.section_templates[s]["model"] == "sonnet"]
        opus_sections = [s for s in sections_to_generate if self.section_templates[s]["model"] == "opus"]

        # Generate Haiku sections in parallel
        if haiku_sections:
            haiku_results = await self._generate_sections_parallel(
                haiku_sections,
                entity_data,
                "haiku"
            )
            dossier.sections.extend(haiku_results)

        # Generate Sonnet sections in parallel
        if sonnet_sections:
            sonnet_results = await self._generate_sections_parallel(
                sonnet_sections,
                entity_data,
                "sonnet"
            )
            dossier.sections.extend(sonnet_results)

        # Generate Opus sections in parallel
        if opus_sections:
            opus_results = await self._generate_sections_parallel(
                opus_sections,
                entity_data,
                "opus"
            )
            dossier.sections.extend(opus_results)

        # Extract questions from sections (for discovery feedback loop)
        try:
            from dossier_question_extractor import DossierQuestionExtractor
            question_extractor = DossierQuestionExtractor(self.claude_client)
            dossier.questions = await question_extractor.extract_questions_from_dossier(
                dossier.sections,
                entity_name,
                max_per_section=3
            )
            logger.info(f"Extracted {len(dossier.questions)} questions from dossier sections")
        except Exception as e:
            logger.warning(f"Could not extract questions from dossier: {e}")
            dossier.questions = []

        # Calculate metrics
        end_time = datetime.now(timezone.utc)
        dossier.generation_time_seconds = (end_time - start_time).total_seconds()
        dossier.generated_at = start_time

        logger.info(
            f"Dossier generated for {entity_name}: "
            f"{len(dossier.sections)} sections, "
            f"{len(dossier.questions)} questions, "
            f"{dossier.generation_time_seconds:.2f}s, "
            f"${dossier.total_cost_usd:.4f}"
        )

        return dossier

    async def _generate_sections_parallel(
        self,
        section_ids: List[str],
        entity_data: Dict[str, Any],
        model: str
    ) -> List[DossierSection]:
        """
        Generate multiple sections in parallel using the same model

        Args:
            section_ids: List of section IDs to generate
            entity_data: Collected entity data
            model: Model to use (haiku/sonnet/opus)

        Returns:
            List of generated DossierSection objects
        """
        # Create tasks for parallel execution
        tasks = [
            self._generate_section(
                section_id=section_id,
                entity_data=entity_data,
                model=model
            )
            for section_id in section_ids
        ]

        # Execute in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out failures
        sections = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to generate section {section_ids[i]}: {result}")
                # Create fallback section
                sections.append(self._create_fallback_section(section_ids[i], model))
            elif isinstance(result, DossierSection):
                sections.append(result)

        return sections

    async def _generate_section(
        self,
        section_id: str,
        entity_data: Dict[str, Any],
        model: str
    ) -> DossierSection:
        """
        Generate a single dossier section

        Args:
            section_id: Section identifier
            entity_data: Collected entity data
            model: Model to use (haiku/sonnet/opus)

        Returns:
            Generated DossierSection
        """
        # Get template info
        template_info = self.section_templates.get(section_id)
        if not template_info:
            raise ValueError(f"Unknown section ID: {section_id}")

        # Load prompt template
        from dossier_templates import get_prompt_template
        prompt_template = get_prompt_template(
            template_info["prompt_template"],
            model
        )

        # Build prompt with entity data
        entity_name = entity_data.get("entity_name", "this entity")

        # Create safe entity data for formatting (remove entity_name to avoid duplicate)
        safe_entity_data = {k: v for k, v in entity_data.items() if k != "entity_name"}

        prompt = prompt_template.format(entity_name=entity_name, **safe_entity_data)

        # Call Claude with appropriate model
        try:
            # Select model based on cascade (use model names, not model IDs)
            claude_model = model  # haiku, sonnet, or opus

            # Generate content using ClaudeClient.query()
            response = await self.claude_client.query(
                prompt=prompt,
                model=claude_model,
                max_tokens=template_info["max_tokens"]
            )

            content_text = response.get("content", "")

            # Parse response (expect JSON)
            import json
            import re

            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', content_text)
            if json_match:
                section_data = json.loads(json_match.group(0))
            else:
                # Fallback: treat entire response as content
                section_data = {"content": [content_text]}

            # Create DossierSection
            section = DossierSection(
                id=section_id,
                title=template_info["description"],
                content=section_data.get("content", []),
                metrics=section_data.get("metrics", []),
                insights=section_data.get("insights", []),
                recommendations=section_data.get("recommendations", []),
                confidence=section_data.get("confidence", 0.7),
                generated_by=model
            )

            # Track cost (approximate)
            section_cost = self._estimate_section_cost(model, template_info["max_tokens"])
            section.total_cost_usd = section_cost

            return section

        except Exception as e:
            logger.error(f"Error generating section {section_id} with {model}: {e}")
            raise

    def _estimate_section_cost(self, model: str, max_tokens: int) -> float:
        """
        Estimate cost for generating a section

        Args:
            model: Model used (haiku/sonnet/opus)
            max_tokens: Max tokens in response

        Returns:
            Estimated cost in USD
        """
        # Pricing per 1M tokens (input + output)
        pricing = {
            "haiku": 0.25,
            "sonnet": 3.0,
            "opus": 15.0
        }

        # Estimate input + output tokens
        estimated_tokens = max_tokens * 2  # Assume 1:1 input:output ratio

        cost_per_million = pricing.get(model, 0.25)
        return (estimated_tokens / 1_000_000) * cost_per_million

    def _create_fallback_section(self, section_id: str, model: str) -> DossierSection:
        """
        Create fallback section when generation fails

        Args:
            section_id: Section identifier
            model: Model that was attempted

        Returns:
            Fallback DossierSection with error message
        """
        template_info = self.section_templates.get(section_id, {})
        return DossierSection(
            id=section_id,
            title=template_info.get("description", section_id),
            content=[f"Section generation failed. Please try again later."],
            confidence=0.0,
            generated_by=model
        )

    def _dossier_data_to_dict(self, dossier_data: 'DossierData') -> Dict[str, Any]:
        """
        Convert DossierData object to dict format for backward compatibility

        Args:
            dossier_data: DossierData object from collector

        Returns:
            Dictionary with entity data for prompt formatting
        """
        if not DATA_COLLECTOR_AVAILABLE:
            return {}

        entity_dict = {
            "entity_name": dossier_data.entity_name,
            "entity_id": dossier_data.entity_id,
        }

        # Add metadata if available
        if dossier_data.metadata:
            metadata = dossier_data.metadata
            entity_dict.update({
                "entity_type": metadata.entity_type,
                "sport": metadata.sport,
                "country": metadata.country,
                "league_or_competition": metadata.league_or_competition,
                "ownership_type": metadata.ownership_type,
                "org_type": metadata.org_type,
                "estimated_revenue_band": metadata.estimated_revenue_band,
                "digital_maturity": metadata.digital_maturity,
                "entity_description": metadata.description,
            })

        # Add scraped content if available
        if dossier_data.scraped_content:
            entity_dict["scraped_content"] = dossier_data.scraped_content
            entity_dict["has_scraped_content"] = True

        # Add hypothesis signals if available
        if dossier_data.hypothesis_signals:
            entity_dict["hypothesis_signals"] = dossier_data.hypothesis_signals
            entity_dict["has_hypothesis_signals"] = True

        return entity_dict

    def _inject_falkordb_metadata(self, entity_data: Dict[str, Any], metadata: EntityMetadata) -> Dict[str, Any]:
        """
        Inject FalkorDB metadata into entity_data dict with rich context

        Args:
            entity_data: Existing entity data dict
            metadata: EntityMetadata object from FalkorDB

        Returns:
            Enhanced entity_data dict with real metadata
        """
        # Create rich context description
        rich_description = f"{metadata.entity_name} is a "

        if metadata.sport:
            rich_description += f"{metadata.sport} "

        if metadata.org_type:
            rich_description += f"{metadata.org_type} "

        if metadata.country:
            rich_description += f"based in {metadata.country}"

        if metadata.league_or_competition:
            rich_description += f", competing in the {metadata.league_or_competition}"

        rich_description += "."

        # Add details about organization
        if metadata.ownership_type:
            rich_description += f" Ownership: {metadata.ownership_type}."

        if metadata.estimated_revenue_band:
            rich_description += f" Estimated revenue: {metadata.estimated_revenue_band}."

        if metadata.digital_maturity:
            rich_description += f" Digital maturity: {metadata.digital_maturity}."

        # Add scraped properties (Phase 2)
        if metadata.founded:
            rich_description += f" Founded: {metadata.founded}."
        if metadata.stadium:
            rich_description += f" Stadium: {metadata.stadium}."
        if metadata.capacity:
            rich_description += f" Capacity: {metadata.capacity}."
        if metadata.website:
            rich_description += f" Website: {metadata.website}."

        # Update entity_data with rich metadata
        entity_data["entity_description"] = metadata.description or rich_description
        entity_data["entity_sport"] = metadata.sport
        entity_data["entity_country"] = metadata.country
        entity_data["entity_league"] = metadata.league_or_competition
        entity_data["entity_ownership"] = metadata.ownership_type
        entity_data["entity_revenue_band"] = metadata.estimated_revenue_band
        entity_data["entity_digital_maturity"] = metadata.digital_maturity

        # Add scraped properties
        entity_data["entity_founded"] = metadata.founded
        entity_data["entity_stadium"] = metadata.stadium
        entity_data["entity_capacity"] = metadata.capacity
        entity_data["entity_website"] = metadata.website
        entity_data["entity_employees"] = metadata.employees

        # Add metadata summary for prompts
        entity_data["metadata_summary"] = f"""
Entity: {metadata.entity_name}
Type: {metadata.entity_type}
Sport: {metadata.sport or 'N/A'}
Country: {metadata.country or 'N/A'}
League: {metadata.league_or_competition or 'N/A'}
Digital Maturity: {metadata.digital_maturity or 'N/A'}
Revenue Band: {metadata.estimated_revenue_band or 'N/A'}
Founded: {metadata.founded or 'N/A'}
Stadium: {metadata.stadium or 'N/A'}
Capacity: {metadata.capacity or 'N/A'}
Website: {metadata.website or 'N/A'}
        """.strip()

        logger.info(f"✅ Injected FalkorDB + BrightData metadata for {metadata.entity_name}")
        return entity_data

    def _summarize_job_postings(self, jobs: List[Dict]) -> str:
        """
        Summarize job postings for prompt context

        Args:
            jobs: List of job posting dicts

        Returns:
            Summary string
        """
        if not jobs:
            return "No recent job postings found"

        summaries = []
        for job in jobs[:5]:  # Limit to 5
            title = job.get('title', 'Unknown Role')
            summary = f"- {title}"
            summaries.append(summary)

        return "\n".join(summaries)

    def _summarize_press_releases(self, press: List[Dict]) -> str:
        """
        Summarize press releases for prompt context

        Args:
            press: List of press release dicts

        Returns:
            Summary string
        """
        if not press:
            return "No recent press releases found"

        summaries = []
        for release in press[:5]:  # Limit to 5
            title = release.get('title', 'Unknown Release')
            summary = f"- {title}"
            summaries.append(summary)

        return "\n".join(summaries)

    def _summarize_linkedin_posts(self, posts: List[Dict]) -> str:
        """
        Summarize LinkedIn posts for prompt context

        Args:
            posts: List of LinkedIn post dicts

        Returns:
            Summary string
        """
        if not posts:
            return "No recent LinkedIn activity found"

        count = len(posts)
        return f"{count} recent LinkedIn posts/references found"


class UniversalDossierGenerator(EntityDossierGenerator):
    """
    Universal dossier generator with tiered prompts and hypothesis extraction.

    Extends EntityDossierGenerator to support:
    - Tiered prompt selection (BASIC/STANDARD/PREMIUM)
    - Prompt interpolation with entity data
    - Model cascade for cost optimization (Haiku 80%, Sonnet 15%, Opus 5%)
    - Hypothesis extraction for discovery system
    - Signal extraction with tags [PROCUREMENT][CAPABILITY][TIMING][CONTACT]
    """

    # Universal dossier prompts (inline version of universal-club-prompts.ts)
    UNIVERSAL_CLUB_DOSSIER_PROMPT = """
You are a business intelligence analyst generating entity dossiers for an automated RFP discovery system.

TARGET ENTITY:
Name: {name}
Type: {type}
Industry: {industry}
Current Data: {currentData}

OBJECTIVE:
Generate a comprehensive dossier that identifies:
1. PROCUREMENT SIGNALS: Indicators of upcoming purchasing decisions
2. CAPABILITY SIGNALS: Technology gaps and digital maturity levels
3. TIMING SIGNALS: Contract windows, strategic cycles, budget availability
4. CONTACT SIGNALS: Decision makers, influence mapping, optimal introduction paths

CRITICAL REQUIREMENTS:
- DO NOT copy example content literally
- Generate entity-specific analysis using ONLY the provided entity data
- Use placeholders when specific information is unavailable
- Assign confidence scores (0-100) to all assertions
- Tag each insight with signal type: [PROCUREMENT] [CAPABILITY] [TIMING] [CONTACT]

OUTPUT STRUCTURE:
{
  "metadata": {
    "entity_id": "{name}",
    "generated_at": "timestamp",
    "data_freshness": "score_0_100",
    "confidence_overall": "score_0_100",
    "priority_signals": ["array of signal tags"]
  },
  "executive_summary": {
    "overall_assessment": {
      "digital_maturity": {
        "score": 0-100,
        "trend": "improving|stable|declining",
        "meaning": "plain English explanation of what this score means for this entity",
        "why": "evidence-based reasoning for why this score was assigned",
        "benchmark": "industry comparison or context (e.g., 'above average for federations')",
        "action": "specific, actionable next step based on this score",
        "key_strengths": ["specific to entity"],
        "key_gaps": ["specific to entity"]
      },
      "procurement_readiness": {
        "budget_availability": "unknown|low|medium|high",
        "decision_horizon": "immediate|0-3months|3-6months|6-12months|12+months",
        "strategic_fit": "score_0_100"
      },
      "yellow_panther_opportunity": {
        "service_fit": ["specific Yellow Panther services that match entity needs"],
        "entry_point": "pilot|partnership|vendor replacement|new initiative",
        "competitive_advantage": "why Yellow Panther vs alternatives",
        "estimated_probability": "score_0_100"
      }
    },
    "quick_actions": [
      {
        "action": "specific next step",
        "priority": "HIGH|MEDIUM|LOW",
        "timeline": "specific timeframe",
        "owner": "who should act",
        "success_criteria": "measurable outcome"
      }
    ],
    "key_insights": [
      {
        "insight": "specific observation about entity",
        "signal_type": "[PROCUREMENT]|[CAPABILITY]|[TIMING]|[CONTACT]",
        "confidence": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "source": "specific data point or observation",
        "hypothesis_ready": true/false
      }
    ]
  },
  "digital_infrastructure": {
    "current_tech_stack": {
      "website_platform": "specific if known, otherwise 'unknown'",
      "crm_system": "specific if known, otherwise 'unknown'",
      "analytics_platform": "specific if known, otherwise 'unknown'",
      "mobile_apps": "yes/no/partial",
      "ecommerce": "yes/no/partial",
      "data_infrastructure": "description if available"
    },
    "vendor_relationships": [
      {
        "vendor": "specific company name if known",
        "services": "what they provide",
        "contract_duration": "if known",
        "renewal_window": "estimated if available",
        "satisfaction_indicator": "signs of satisfaction or friction"
      }
    ],
    "digital_maturity_metrics": {
      "transformation_score": 0-100,
      "innovation_velocity": "low|medium|high",
      "data_sophistication": "basic|intermediate|advanced",
      "customer_obsession": "score_0_100",
      "integration_readiness": "score_0_100"
    },
    "capability_gaps": [
      {
        "gap": "specific missing capability",
        "urgency": "immediate|near-term|long-term",
        "yellow_panther_fit": "which Yellow Panther service addresses this",
        "procurement_likelihood": "score_0_100"
      }
    ]
  },
  "procurement_signals": {
    "upcoming_opportunities": [
      {
        "opportunity": "specific initiative or project",
        "type": "new_project|renewal|expansion|replacement",
        "estimated_budget": "unknown|low|medium|high|specific",
        "timeline": "specific window",
        "decision_makers": ["roles"],
        "rfp_probability": 0-100,
        "yellow_panther_fit": {
          "services": ["relevant offerings"],
          "competitive_positioning": "why Yellow Panther",
          "win_probability": 0-100
        },
        "next_actions": ["concrete steps"],
        "hypothesis_id": "auto-generated unique identifier"
      }
    ],
    "budget_indicators": [
      {
        "indicator": "specific sign of budget allocation",
        "confidence": 0-100,
        "relevance": "HIGH|MEDIUM|LOW",
        "source": "where observed"
      }
    ],
    "strategic_initiatives": [
      {
        "initiative": "named strategic effort",
        "description": "what it entails",
        "phase": "announcement|planning|execution|expansion",
        "technology_needs": ["specific requirements"],
        "partnership_opportunities": ["vendor types needed"]
      }
    ]
  },
  "leadership_analysis": {
    "decision_makers": [
      {
        "name": "specific if known, else {ROLE}",
        "title": "specific title",
        "responsibility_scope": "what they control",
        "influence_level": "HIGH|MEDIUM|LOW",
        "communication_style": "analytical|relationship|story-driven|direct",
        "tech_savviness": "low|medium|high",
        "risk_appetite": "conservative|moderate|aggressive",
        "decision_criteria": ["what matters to them"],
        "contact_preferences": {
          "channel": "email|linkedin|intro|cold|conference",
          "messaging": "what resonates",
          "timing": "when to approach"
        },
        "yellow_panther_angle": {
          "value_proposition": "how to frame YP value",
          "use_cases": ["relevant examples"],
          "success_metrics": ["what they care about"]
        }
      }
    ],
    "influence_network": {
      "internal_champions": ["roles who would advocate"],
      "blockers": ["roles who might resist"],
      "decision_process": "how decisions get made",
      "approval_chain": ["roles in order"]
    }
  },
  "timing_analysis": {
    "contract_windows": [
      {
        "contract": "specific if known",
        "vendor": "current provider if known",
        "renewal_date": "estimated if known",
        "rfp_window": "when RFP likely",
        "probability": 0-100,
        "action_deadline": "when to engage"
      }
    ],
    "strategic_cycles": {
      "budget_cycle": "when fiscal planning happens",
      "planning_horizon": "how far out they plan",
      "procurement_peaks": ["times of year with more activity"]
    },
    "urgency_indicators": [
      {
        "indicator": "specific urgency signal",
        "type": "deadline|pressure|opportunity|threat",
        "window": "timeframe",
        "action_required": "what to do"
      }
    ]
  },
  "risk_assessment": {
    "implementation_risks": [
      {
        "risk": "specific challenge",
        "probability": 0-100,
        "impact": "HIGH|MEDIUM|LOW",
        "mitigation": "how to address",
        "yellow_panther_differentiation": "how YP mitigates this"
      }
    ],
    "competitive_landscape": {
      "incumbent_vendors": ["who already has relationships"],
      "alternative_providers": ["who else competes"],
      "switching_costs": "barriers to change",
      "yellow_panther_advantages": ["where YP wins"]
    }
  },
  "recommended_approach": {
    "immediate_actions": [
      {
        "action": "specific step",
        "priority": "HIGH|MEDIUM|LOW",
        "timeline": "when",
        "responsible": "who",
        "success_criteria": "measurable outcome",
        "hypothesis_to_test": "what this validates"
      }
    ],
    "hypothesis_generation": {
      "primary_hypothesis": {
        "statement": "testable assertion about procurement likelihood",
        "confidence": 0-100,
        "validation_strategy": "how to test",
        "success_metrics": ["what to measure"],
        "next_signals": ["what to look for next"]
      },
      "secondary_hypotheses": [
      {
        "statement": "alternative hypothesis",
        "confidence": 0-100,
        "relationship_to_primary": "support|contradict|independent"
      }
      ]
    },
    "resource_allocation": {
      "sales_effort": "hours_per_week",
      "technical_preparation": "what needs building",
      "partnership_leverage": "who else can help",
      "budget_required": "estimated investment"
    }
  },
  "outreach_strategy": {
    "connection_intelligence": {
      "approach_type": "warm|lukewarm|cold",
      "mutual_connections": ["list of mutual connections if available"],
      "conversation_starters": [
        {
          "topic": "specific discussion topic based on entity research",
          "relevance": "why this matters to them right now",
          "talking_points": ["point 1", "point 2", "point 3"],
          "risk_level": "low|medium|high"
        }
      ],
      "current_providers": [
        {
          "provider": "company name if detectable",
          "service": "what they provide",
          "satisfaction_indicators": "signs of satisfaction or friction",
          "replacement_opportunity": "why Yellow Panther could replace them"
        }
      ]
    },
    "conversation_trees": [
      {
        "scenario": "specific outreach scenario name (e.g., 'Digital Transformation Discovery')",
        "opening_message": {
          "subject_line": "compelling email subject line",
          "body": "conversational opening message (not salesy, personalized based on research)",
          "personalization_tokens": ["{{recent_initiative}}", "{{specific_technology}}", "{{event_name}}"],
          "expected_response_rate": 0-100
        },
        "response_branches": [
          {
            "response_type": "interested|neutral|negative|questioning",
            "probability": 0-100,
            "follow_up_strategy": {
              "message": "specific follow-up message text",
              "timing": "when to send (e.g., '2 days later', 'next week')",
              "channel": "email|linkedin|phone",
              "goal": "what this follow-up achieves"
            }
          }
        ],
        "depth": 3,
        "success_criteria": "what constitutes successful engagement for this scenario",
        "anti_patterns": ["generic mistake 1 to avoid", "specific mistake 2"]
      }
    ],
    "recommended_approach": {
      "primary_channel": "email|linkedin|warm_intro|phone",
      "messaging_angle": "how to frame Yellow Panther value proposition based on entity research",
      "timing": "specific timeframe when to reach out",
      "confidence": 0-100,
      "confidence_explanation": "why we're confident this approach will work based on collected intelligence",
      "next_actions": ["immediate step 1", "step 2", "step 3"]
    }
  },
  "next_steps": {
    "monitoring_triggers": [
      {
        "signal": "what event to watch for",
        "source": "where to look",
        "frequency": "how often to check",
        "alert_threshold": "when to take action"
      }
    ],
    "data_gaps": [
      {
        "missing_info": "what we don't know",
        "importance": "why it matters",
        "collection_method": "how to get it",
        "priority": "HIGH|MEDIUM|LOW"
      }
    ],
    "engagement_sequence": [
      {
        "step": 1,
        "action": "specific outreach or activity",
        "timing": "when",
        "channel": "how",
        "messaging": "key points",
        "success_indicator": "what constitutes progress"
      }
    ]
  }
}

GENERATION RULES:

1. ENTITY-SPECIFIC CONTENT:
   - Every insight must be about THIS entity, not a template
   - Use "unknown" or "not available" when data is missing
   - Never copy Arsenal or any other club's data literally
   - Reference actual observations from the entity data provided

2. CONFIDENCE SCORING AND CONTEXT:
   - Base confidence on data availability and recency
   - Explicitly state uncertainty
   - Distinguish between "observed" vs "inferred" insights
   - Flag assumptions requiring validation
   - CRITICAL: For EVERY score in digital_maturity, include:
     * meaning: plain English explanation
     * why: evidence-based reasoning
     * benchmark: industry comparison
     * action: specific next step


3. SIGNAL TAGGING:
   - [PROCUREMENT]: Active buying signals, RFP likelihood, budget movement
   - [CAPABILITY]: Tech gaps, digital maturity, infrastructure needs
   - [TIMING]: Contract windows, strategic cycles, urgency indicators
   - [CONTACT]: Decision makers, influence mapping, introduction paths

4. HYPOTHESIS GENERATION:
   - Each dossier should produce 3-5 testable hypotheses
   - Hypotheses must be specific, measurable, and actionable
   - Include validation strategies and success metrics
   - Link hypotheses to specific signal types

5. HUMAN-AI COLLABORATION:
   - Include both structured data (for AI) and narrative summaries (for humans)
   - Provide clear next steps with ownership and timelines
   - Flag areas requiring human judgment vs. automated monitoring
   - Balance comprehensive analysis with actionable brevity

Remember: This dossier will feed into an automated hypothesis-driven discovery system that scans 3,000+ entities for RFP opportunities. Every insight should help prioritize which entities deserve human sales attention and automated monitoring.

Generate the dossier now for {name}.
"""

    BASIC_DOSSIER_PROMPT = """
Generate BASIC tier dossier for {name} (3 sections, ~5s, ~$0.0004):

Focus on:
1. Core entity information (name, type, industry, website, size)
2. Quick opportunity assessment (priority score 0-100, key signals)
3. Immediate next steps (1-2 actions, monitoring triggers)

Use UNIVERSAL_CLUB_DOSSIER_PROMPT structure but limit to:
- metadata
- executive_summary.overall_assessment (brief)
- executive_summary.quick_actions (top 3 only)
- next_steps.monitoring_triggers (5 high-priority signals)

Confidence scores required. Skip unavailable data - use "unknown".
"""

    STANDARD_DOSSIER_PROMPT = """
Generate STANDARD tier dossier for {name} (7 sections, ~15s, ~$0.0095):

Include:
1. Core entity information
2. Executive summary with key insights
3. Digital infrastructure overview
4. Procurement signals (opportunities + budget indicators)
5. Leadership analysis (top 3 decision makers)
6. Risk assessment (major risks only)
7. Recommended approach (primary hypothesis + next steps)

Use UNIVERSAL_CLUB_DOSSIER_PROMPT structure. Skip unavailable data.
"""

    def __init__(self, claude_client: ClaudeClient, falkordb_client=None):
        """Initialize universal dossier generator."""
        super().__init__(claude_client, falkordb_client)

    def _select_prompt_by_tier(self, tier: str) -> str:
        """
        Select appropriate prompt template based on dossier tier.

        Args:
            tier: Dossier tier (BASIC/STANDARD/PREMIUM)

        Returns:
            Prompt template string for the tier
        """
        tier_prompts = {
            "BASIC": self.BASIC_DOSSIER_PROMPT,
            "STANDARD": self.STANDARD_DOSSIER_PROMPT,
            "PREMIUM": self.UNIVERSAL_CLUB_DOSSIER_PROMPT
        }
        return tier_prompts.get(tier, self.STANDARD_DOSSIER_PROMPT)

    def _interpolate_prompt(self, prompt: str, entity_data: dict) -> str:
        """
        Replace placeholder variables in prompt template with entity data.

        Args:
            prompt: Prompt template with {name}, {type}, {industry}, {currentData} placeholders
            entity_data: Dictionary containing entity information

        Returns:
            Interpolated prompt with placeholders replaced
        """
        # Extract entity information
        name = entity_data.get("entity_name", "Unknown Entity")
        entity_type = entity_data.get("entity_type", "CLUB")
        industry = entity_data.get("sport", "Sports") or entity_data.get("industry", "Sports")

        # Create current data summary
        current_data = {
            "entity_id": entity_data.get("entity_id", ""),
            "entity_type": entity_type,
            "sport": entity_data.get("sport") or entity_data.get("entity_sport"),
            "country": entity_data.get("country") or entity_data.get("entity_country"),
            "league": entity_data.get("league_or_competition") or entity_data.get("entity_league"),
            "digital_maturity": entity_data.get("digital_maturity") or entity_data.get("entity_digital_maturity"),
            "revenue_band": entity_data.get("estimated_revenue_band") or entity_data.get("entity_revenue_band"),
            "website": entity_data.get("website") or entity_data.get("entity_website"),
            "stadium": entity_data.get("stadium") or entity_data.get("entity_stadium"),
            "capacity": entity_data.get("capacity") or entity_data.get("entity_capacity"),
            "founded": entity_data.get("founded") or entity_data.get("entity_founded"),
            "has_scraped_content": entity_data.get("has_scraped_content", False),
            "has_hypothesis_signals": entity_data.get("has_hypothesis_signals", False)
        }

        # Remove None values
        current_data = {k: v for k, v in current_data.items() if v is not None}

        # Convert to JSON string for the prompt
        current_data_json = json.dumps(current_data, indent=2, default=str)

        # Replace placeholders
        interpolated = prompt.replace("{name}", name)
        interpolated = interpolated.replace("{type}", entity_type)
        interpolated = interpolated.replace("{industry}", industry)
        interpolated = interpolated.replace("{currentData}", current_data_json)

        return interpolated

    async def _generate_with_model_cascade(
        self,
        prompt: str,
        entity_name: str,
        tier: str
    ) -> dict:
        """
        Generate dossier using model cascade strategy for cost optimization.

        Cascade strategy:
        - Haiku (80%): Try first for fast, cheap generation
        - Sonnet (15%): Fall back if Haiku fails or low confidence
        - Opus (5%): Final fallback for complex cases

        Args:
            prompt: Interpolated prompt with entity data
            entity_name: Name of entity (for logging)
            tier: Dossier tier (BASIC/STANDARD/PREMIUM)

        Returns:
            Generated dossier as dictionary
        """
        # Determine max tokens based on tier
        max_tokens_by_tier = {
            "BASIC": 2000,
            "STANDARD": 4000,
            "PREMIUM": 8000
        }
        max_tokens = max_tokens_by_tier.get(tier, 4000)

        # Model cascade: Try Haiku first (80% of cases)
        rollout = random.random()

        if rollout < 0.80:
            # Try Haiku first (80%)
            model = "haiku"
            logger.info(f"🎯 Using Haiku for {entity_name} ({tier} tier)")
        elif rollout < 0.95:
            # Try Sonnet (15%)
            model = "sonnet"
            logger.info(f"🎯 Using Sonnet for {entity_name} ({tier} tier)")
        else:
            # Use Opus (5%)
            model = "opus"
            logger.info(f"🎯 Using Opus for {entity_name} ({tier} tier)")

        try:
            # Generate with selected model
            response = await self.claude_client.query(
                prompt=prompt,
                model=model,
                max_tokens=max_tokens
            )

            content_text = response.get("content", "")

            # Parse JSON response
            json_match = re.search(r'\{[\s\S]*\}', content_text)
            if json_match:
                dossier = json.loads(json_match.group(0))

                # Validate required structure
                if self._validate_dossier_structure(dossier):
                    logger.info(f"✅ Generated {entity_name} dossier with {model}")
                    return dossier
                else:
                    logger.warning(f"⚠️ Invalid dossier structure from {model}, retrying with Sonnet")

        except Exception as e:
            logger.warning(f"⚠️ Error generating with {model}: {e}")

        # Fallback to Sonnet if primary model failed
        if model != "sonnet":
            logger.info(f"🔄 Falling back to Sonnet for {entity_name}")
            try:
                response = await self.claude_client.query(
                    prompt=prompt,
                    model="sonnet",
                    max_tokens=max_tokens
                )
                content_text = response.get("content", "")
                json_match = re.search(r'\{[\s\S]*\}', content_text)
                if json_match:
                    dossier = json.loads(json_match.group(0))
                    if self._validate_dossier_structure(dossier):
                        logger.info(f"✅ Generated {entity_name} dossier with Sonnet (fallback)")
                        return dossier
            except Exception as e:
                logger.error(f"❌ Sonnet fallback also failed: {e}")

        # Final fallback to Opus if needed
        if model != "opus":
            logger.info(f"🔄 Final fallback to Opus for {entity_name}")
            try:
                response = await self.claude_client.query(
                    prompt=prompt,
                    model="opus",
                    max_tokens=max_tokens
                )
                content_text = response.get("content", "")
                json_match = re.search(r'\{[\s\S]*\}', content_text)
                if json_match:
                    dossier = json.loads(json_match.group(0))
                    logger.info(f"✅ Generated {entity_name} dossier with Opus (final fallback)")
                    return dossier
            except Exception as e:
                logger.error(f"❌ All models failed for {entity_name}: {e}")

        # If all else fails, return minimal valid dossier
        logger.error(f"❌ Complete generation failure for {entity_name}, returning minimal dossier")
        return self._create_minimal_dossier(entity_name)

    def _validate_dossier_structure(self, dossier: dict) -> bool:
        """
        Validate that generated dossier has required structure.

        Args:
            dossier: Generated dossier dictionary

        Returns:
            True if dossier has required fields
        """
        required_fields = ["metadata", "executive_summary"]
        return all(field in dossier for field in required_fields)

    def _create_minimal_dossier(self, entity_name: str) -> dict:
        """
        Create minimal valid dossier when generation fails.

        Args:
            entity_name: Name of entity

        Returns:
            Minimal valid dossier structure
        """
        return {
            "metadata": {
                "entity_id": entity_name,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "data_freshness": 0,
                "confidence_overall": 0,
                "priority_signals": []
            },
            "executive_summary": {
                "overall_assessment": {
                    "digital_maturity": {
                        "score": 0,
                        "trend": "unknown",
                        "key_strengths": [],
                        "key_gaps": []
                    }
                },
                "quick_actions": [],
                "key_insights": []
            }
        }

    def _extract_hypotheses(self, dossier: dict) -> List[dict]:
        """
        Extract testable hypotheses from generated dossier.

        Looks for:
        - Insights marked as hypothesis_ready in executive_summary
        - Primary and secondary hypotheses from recommended_approach
        - High-probability procurement opportunities

        Args:
            dossier: Generated dossier dictionary

        Returns:
            List of hypothesis dictionaries with statement, confidence, type
        """
        hypotheses = []

        try:
            # Extract from executive summary insights marked as hypothesis_ready
            key_insights = dossier.get("executive_summary", {}).get("key_insights", [])
            for insight in key_insights:
                if insight.get("hypothesis_ready", False):
                    hypotheses.append({
                        "statement": insight.get("insight"),
                        "signal_type": insight.get("signal_type"),
                        "confidence": insight.get("confidence", 50),
                        "impact": insight.get("impact"),
                        "source": insight.get("source"),
                        "entity_id": dossier.get("metadata", {}).get("entity_id"),
                        "type": "INSIGHT"
                    })

            # Extract primary hypothesis
            hypothesis_gen = dossier.get("recommended_approach", {}).get("hypothesis_generation", {})
            primary_hypothesis = hypothesis_gen.get("primary_hypothesis")
            if primary_hypothesis:
                hypotheses.append({
                    "statement": primary_hypothesis.get("statement"),
                    "signal_type": "[PROCUREMENT]",
                    "confidence": primary_hypothesis.get("confidence", 50),
                    "validation_strategy": primary_hypothesis.get("validation_strategy"),
                    "success_metrics": primary_hypothesis.get("success_metrics", []),
                    "next_signals": primary_hypothesis.get("next_signals", []),
                    "entity_id": dossier.get("metadata", {}).get("entity_id"),
                    "type": "PRIMARY"
                })

            # Extract secondary hypotheses
            secondary_hypotheses = hypothesis_gen.get("secondary_hypotheses", [])
            for h in secondary_hypotheses:
                hypotheses.append({
                    "statement": h.get("statement"),
                    "signal_type": "[PROCUREMENT]",
                    "confidence": h.get("confidence", 50),
                    "relationship_to_primary": h.get("relationship_to_primary"),
                    "entity_id": dossier.get("metadata", {}).get("entity_id"),
                    "type": "SECONDARY"
                })

            # Extract from procurement opportunities with high RFP probability
            procurement_signals = dossier.get("procurement_signals", {})
            upcoming_opportunities = procurement_signals.get("upcoming_opportunities", [])
            for opp in upcoming_opportunities:
                if opp.get("rfp_probability", 0) > 50:
                    hypotheses.append({
                        "statement": f"RFP likely for {opp.get('opportunity')} ({opp.get('type')})",
                        "signal_type": "[PROCUREMENT]",
                        "confidence": opp.get("rfp_probability", 50),
                        "opportunity_type": opp.get("type"),
                        "timeline": opp.get("timeline"),
                        "yellow_panther_fit": opp.get("yellow_panther_fit"),
                        "entity_id": dossier.get("metadata", {}).get("entity_id"),
                        "type": "OPPORTUNITY"
                    })

        except Exception as e:
            logger.warning(f"⚠️ Error extracting hypotheses: {e}")

        return hypotheses

    def _extract_signals(self, dossier: dict) -> List[dict]:
        """
        Extract tagged signals from generated dossier.

        Looks for signals tagged with:
        - [PROCUREMENT]: Buying signals, RFP likelihood
        - [CAPABILITY]: Tech gaps, digital maturity
        - [TIMING]: Contract windows, strategic cycles
        - [CONTACT]: Decision makers, influence mapping

        Args:
            dossier: Generated dossier dictionary

        Returns:
            List of signal dictionaries with type, insight, confidence
        """
        signals = []

        try:
            # Extract from executive summary insights
            key_insights = dossier.get("executive_summary", {}).get("key_insights", [])
            for insight in key_insights:
                signal_type = insight.get("signal_type", "")
                if signal_type in ["[PROCUREMENT]", "[CAPABILITY]", "[TIMING]", "[CONTACT]"]:
                    signals.append({
                        "type": signal_type,
                        "insight": insight.get("insight"),
                        "confidence": insight.get("confidence", 50),
                        "impact": insight.get("impact"),
                        "source": insight.get("source"),
                        "entity_id": dossier.get("metadata", {}).get("entity_id"),
                        "section": "executive_summary"
                    })

            # Extract from procurement opportunities
            procurement_signals = dossier.get("procurement_signals", {})
            upcoming_opportunities = procurement_signals.get("upcoming_opportunities", [])
            for opp in upcoming_opportunities:
                signals.append({
                    "type": "[PROCUREMENT]",
                    "insight": f"Opportunity: {opp.get('opportunity')}",
                    "confidence": opp.get("rfp_probability", 50),
                    "timeline": opp.get("timeline"),
                    "entity_id": dossier.get("metadata", {}).get("entity_id"),
                    "section": "procurement"
                })

            # Extract from timing analysis
            timing_analysis = dossier.get("timing_analysis", {})
            contract_windows = timing_analysis.get("contract_windows", [])
            for window in contract_windows:
                signals.append({
                    "type": "[TIMING]",
                    "insight": f"Contract renewal: {window.get('contract')}",
                    "confidence": window.get("probability", 50),
                    "deadline": window.get("action_deadline"),
                    "entity_id": dossier.get("metadata", {}).get("entity_id"),
                    "section": "timing"
                })

            # Extract from leadership analysis
            leadership_analysis = dossier.get("leadership_analysis", {})
            decision_makers = leadership_analysis.get("decision_makers", [])
            for leader in decision_makers:
                signals.append({
                    "type": "[CONTACT]",
                    "insight": f"Decision maker: {leader.get('name')} - {leader.get('title')}",
                    "confidence": 70,
                    "influence": leader.get("influence_level"),
                    "channel": leader.get("contact_preferences", {}).get("channel"),
                    "entity_id": dossier.get("metadata", {}).get("entity_id"),
                    "section": "leadership"
                })

            # Extract from capability gaps
            digital_infrastructure = dossier.get("digital_infrastructure", {})
            capability_gaps = digital_infrastructure.get("capability_gaps", [])
            for gap in capability_gaps:
                signals.append({
                    "type": "[CAPABILITY]",
                    "insight": f"Capability gap: {gap.get('gap')}",
                    "confidence": gap.get("procurement_likelihood", 50),
                    "urgency": gap.get("urgency"),
                    "yellow_panther_fit": gap.get("yellow_panther_fit"),
                    "entity_id": dossier.get("metadata", {}).get("entity_id"),
                    "section": "digital_infrastructure"
                })

        except Exception as e:
            logger.warning(f"⚠️ Error extracting signals: {e}")

        return signals

    async def generate_universal_dossier(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        entity_data: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Generate universal dossier with tiered prompts and hypothesis extraction.

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity display name
            entity_type: Entity type (CLUB, LEAGUE, VENUE, etc.)
            priority_score: Priority score (0-100) for tier determination
            entity_data: Optional pre-collected entity data

        Returns:
            Complete dossier dictionary with metadata, hypotheses, and signals
        """
        start_time = datetime.now(timezone.utc)

        # Determine tier
        tier = self._determine_tier(priority_score)
        logger.info(f"📊 Generating {tier} dossier for {entity_name} (priority: {priority_score})")

        # Collect entity data if not provided
        if entity_data is None and DATA_COLLECTOR_AVAILABLE:
            collector = DossierDataCollector()
            dossier_data_obj = await collector.collect_all(entity_id, entity_name)
            entity_data = self._dossier_data_to_dict(dossier_data_obj)
        elif entity_data is None:
            # Fallback to minimal data
            entity_data = {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type
            }

        # Select prompt based on tier
        prompt_template = self._select_prompt_by_tier(tier)

        # Interpolate prompt with entity data
        interpolated_prompt = self._interpolate_prompt(prompt_template, entity_data)

        # Generate dossier using model cascade
        dossier = await self._generate_with_model_cascade(
            prompt=interpolated_prompt,
            entity_name=entity_name,
            tier=tier
        )

        # Extract hypotheses and signals
        hypotheses = self._extract_hypotheses(dossier)
        signals = self._extract_signals(dossier)

        # Add metadata
        dossier["metadata"]["entity_id"] = entity_id
        dossier["metadata"]["generated_at"] = start_time.isoformat()
        dossier["metadata"]["tier"] = tier
        dossier["metadata"]["priority_score"] = priority_score
        dossier["metadata"]["hypothesis_count"] = len(hypotheses)
        dossier["metadata"]["signal_count"] = len(signals)

        # Attach hypotheses and signals
        dossier["extracted_hypotheses"] = hypotheses
        dossier["extracted_signals"] = signals

        # Calculate generation time
        end_time = datetime.now(timezone.utc)
        generation_time = (end_time - start_time).total_seconds()
        dossier["generation_time_seconds"] = generation_time

        logger.info(
            f"✅ Universal dossier generated for {entity_name}: "
            f"{len(hypotheses)} hypotheses, "
            f"{len(signals)} signals, "
            f"{generation_time:.2f}s"
        )

        return dossier


# Example usage
async def main():
    """Example dossier generation"""
    from claude_client import ClaudeClient

    # Initialize
    claude = ClaudeClient()
    generator = EntityDossierGenerator(claude)

    # Generate dossier
    dossier = await generator.generate_dossier(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        entity_type="CLUB",
        priority_score=99  # Premium tier
    )

    print(f"Generated {dossier.tier} dossier for {dossier.entity_name}")
    print(f"Sections: {len(dossier.sections)}")
    print(f"Cost: ${dossier.total_cost_usd:.4f}")
    print(f"Time: {dossier.generation_time_seconds:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
