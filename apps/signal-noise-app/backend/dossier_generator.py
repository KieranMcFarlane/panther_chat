#!/usr/bin/env python3
"""
Entity Dossier Generator with Model Cascade Strategy

Generates multi-section intelligence dossiers using cost-optimized model selection:
- Haiku (80%): Core info, quick actions, news, performance, contact
- Sonnet (15%): Digital maturity, leadership, AI assessment, challenges
- Opus (5%): Strategic analysis, connections

Priority Tiers:
- Basic (0-20): 3 sections, ~$0.0004, ~5s
- Standard (21-50): 11 sections, ~$0.057, ~30s
- Premium (51-100): 11 sections, ~$0.057, ~30s
"""

import asyncio
import hashlib
import json
import logging
import os
import random
import re
from copy import deepcopy
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Callable, Awaitable
from dataclasses import dataclass
from urllib.parse import urlparse

from backend.schemas import EntityDossier, DossierSection, DossierTier, CacheStatus
from backend.claude_client import ClaudeClient
try:
    from backend.objective_profiles import (
        DEFAULT_DOSSIER_OBJECTIVE,
        get_objective_profile,
        normalize_run_objective,
    )
except ImportError:
    from objective_profiles import (  # type: ignore
        DEFAULT_DOSSIER_OBJECTIVE,
        get_objective_profile,
        normalize_run_objective,
    )
try:
    from backend.dossier_persistence import apply_dossier_persistence_context
except ImportError:
    from dossier_persistence import apply_dossier_persistence_context  # type: ignore

# Import data collector
try:
    from backend.dossier_data_collector import DossierDataCollector, DossierData, EntityMetadata
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
        self._last_entity_data_by_id: Dict[str, Dict[str, Any]] = {}
        self._seeded_official_site_by_entity_name: Dict[str, str] = {}
        self.section_parallelism = max(
            1,
            int(os.getenv("DOSSIER_SECTION_PARALLELISM", "2")),
        )
        self.section_max_tokens_cap = max(
            0,
            int(os.getenv("DOSSIER_SECTION_MAX_TOKENS_CAP", "1800")),
        )
        self.section_generation_timeout_seconds = self._parse_positive_float_env(
            os.getenv("DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS", "75")
        )
        disable_question_extraction_env = os.getenv("DOSSIER_DISABLE_QUESTION_EXTRACTION")
        self.disable_question_extraction = (
            str(disable_question_extraction_env or "").strip().lower() in {"1", "true", "yes", "on"}
        )
        section_json_repair_env = os.getenv("DOSSIER_SECTION_JSON_REPAIR_ATTEMPT", "true")
        self.section_json_repair_attempt = (
            str(section_json_repair_env).strip().lower() in {"1", "true", "yes", "on"}
        )
        section_json_mode_env = os.getenv("DOSSIER_SECTION_JSON_MODE", "true")
        self.section_json_mode = (
            str(section_json_mode_env).strip().lower() in {"1", "true", "yes", "on"}
        )
        self.use_data_driven_section_baseline = (
            str(os.getenv("DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE", "true")).strip().lower()
            in {"1", "true", "yes", "on"}
        )
        self.data_driven_section_ids = {
            "core_information",
            "quick_actions",
            "contact_information",
            "recent_news",
            "leadership",
            "digital_maturity",
            "outreach_strategy",
            "ai_reasoner_assessment",
            "challenges_opportunities",
            "strategic_analysis",
            "connections",
        }
        self.run_post_collection_enrichment = (
            str(os.getenv("DOSSIER_RUN_POST_COLLECTION_ENRICHMENT", "false")).strip().lower()
            in {"1", "true", "yes", "on"}
        )
        self.section_prompt_field_limits_default = {
            "metadata_summary": 1200,
            "official_site_summary": 1200,
            "job_postings_summary": 1000,
            "press_releases_summary": 1000,
            "linkedin_posts_summary": 1000,
            "target_personnel_data": 1200,
            "yp_team_data": 1200,
            "leadership_names": 400,
            "leadership_roles": 500,
            "leadership_linkedins": 700,
        }
        self.section_prompt_field_limits_by_section = {
            "core_information": {"metadata_summary": 700},
            "quick_actions": {"metadata_summary": 700},
            "contact_information": {"metadata_summary": 700},
            "recent_news": {"press_releases_summary": 700},
            "digital_maturity": {"job_postings_summary": 700, "official_site_summary": 900},
            "leadership": {"metadata_summary": 700},
            "strategic_analysis": {"metadata_summary": 700, "official_site_summary": 800},
            "connections": {"metadata_summary": 700, "official_site_summary": 800},
            "outreach_strategy": {"metadata_summary": 700, "job_postings_summary": 500, "press_releases_summary": 500},
        }
        self.compact_response_section_ids = {
            "digital_maturity",
            "leadership",
            "ai_reasoner_assessment",
            "challenges_opportunities",
            "strategic_analysis",
            "connections",
            "outreach_strategy",
        }
        self.long_sections_use_primary_model = (
            str(os.getenv("DOSSIER_LONG_SECTIONS_USE_PRIMARY_MODEL", "true")).strip().lower()
            in {"1", "true", "yes", "on"}
        )

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
                "max_tokens": 2000,
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
                "max_tokens": 2200,
                "description": "Deep strategic analysis"
            },
            "connections": {
                "model": "opus",
                "prompt_template": "connections_analysis_template",
                "max_tokens": 2200,
                "description": "Network connections analysis"
            },

            # Outreach strategy section (NEW)
            "outreach_strategy": {
                "model": "sonnet",
                "prompt_template": "outreach_strategy_template",
                "max_tokens": 2400,
                "description": "Outreach strategy with conversation trees"
            }
        }

        # Tier section mappings
        premium_sections = [
            "core_information",
            "quick_actions",
            "contact_information",
            "recent_news",
            "leadership",
            "digital_maturity",
            "ai_reasoner_assessment",
            "challenges_opportunities",
            "strategic_analysis",
            "connections",
            "outreach_strategy",
        ]
        self.tier_sections = {
            "BASIC": [
                "core_information",
                "quick_actions",
                "contact_information"
            ],
            "STANDARD": list(premium_sections),
            "PREMIUM": list(premium_sections),
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
        entity_data: Optional[Dict[str, Any]] = None,
        run_objective: Optional[str] = None,
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
        objective = normalize_run_objective(run_objective, default=DEFAULT_DOSSIER_OBJECTIVE)
        objective_profile = get_objective_profile(objective, default=DEFAULT_DOSSIER_OBJECTIVE)
        if run_objective is None:
            # Backward-compatible default behavior for direct generator usage.
            enable_leadership_enrichment = True
            enable_question_extraction = True
        else:
            enable_leadership_enrichment = bool(objective_profile.get("enable_leadership_enrichment", False))
            enable_question_extraction = bool(objective_profile.get("enable_question_extraction", False))

        # Determine tier
        tier = self._determine_tier(priority_score)
        dossier_data_obj: Optional["DossierData"] = None

        # Get sections for this tier
        sections_to_generate = self._get_sections_for_tier(tier)
        if objective in {"rfp_pdf", "rfp_web"}:
            # Objective-scoped compact baseline for RFP-focused runs.
            sections_to_generate = ["core_information", "quick_actions", "contact_information", "recent_news"]

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
            seeded_official_site = self._get_seeded_official_site_url(entity_name)
            if seeded_official_site and hasattr(collector, "seed_official_site_url"):
                collector.seed_official_site_url(entity_name, seeded_official_site)
            dossier_data_obj = await collector.collect_all(entity_id, entity_name, run_objective=objective)

            # Convert DossierData object to dict format for compatibility
            entity_data = self._dossier_data_to_dict(dossier_data_obj)

            logger.info(f"✅ Data sources used: {', '.join(dossier_data_obj.data_sources_used)}")

            # ENHANCED: Optional post-collection enrichment using BrightData SDK
            if hasattr(collector, '_collect_multi_source_intelligence'):
                if self.run_post_collection_enrichment:
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
                else:
                    logger.info("⏭️ Skipping duplicate post-collection multi-source enrichment (DOSSIER_RUN_POST_COLLECTION_ENRICHMENT=false)")

            # PHASE 0 ENHANCEMENT: Collect leadership data for real decision maker names
            if hasattr(collector, 'collect_leadership') and enable_leadership_enrichment:
                leadership_already_present = bool(entity_data.get("leadership_data")) or int(entity_data.get("leadership_count") or 0) > 0
                if leadership_already_present and not self.run_post_collection_enrichment:
                    logger.info("⏭️ Skipping duplicate leadership enrichment (already present from collect_all)")
                else:
                    logger.info(f"🎯 Collecting leadership data for {entity_name}")

                    leadership_data = await collector.collect_leadership(entity_id, entity_name)

                    # Add leadership data to entity_data for prompt interpolation
                    entity_data["leadership_names"] = ", ".join([
                        dm.get("name", "unknown") for dm in leadership_data.get("decision_makers", [])
                    ]) if leadership_data.get("decision_makers") else "unknown"

                    entity_data["leadership_roles"] = ", ".join([
                        dm.get("role", "unknown") for dm in leadership_data.get("decision_makers", [])
                    ]) if leadership_data.get("decision_makers") else "unknown"

                    entity_data["leadership_linkedins"] = ", ".join([
                        dm.get("linkedin_url", "") for dm in leadership_data.get("decision_makers", []) if dm.get("linkedin_url")
                    ]) if leadership_data.get("decision_makers") else ""

                    entity_data["leadership_count"] = len(leadership_data.get("decision_makers", []))
                    entity_data["leadership_sources"] = ", ".join(leadership_data.get("sources_used", []))
                    entity_data["leadership_fresh_signals"] = leadership_data.get("fresh_signals_count", 0)

                    # Store raw leadership data for reference
                    entity_data["leadership_data"] = leadership_data

                    # Format leadership data for Connections section
                    if leadership_data.get("decision_makers"):
                        personnel_summary = []
                        for dm in leadership_data["decision_makers"]:
                            personnel_summary.append(
                                f"- {dm.get('name', 'unknown')}: {dm.get('role', 'unknown')} - "
                                f"LinkedIn: {dm.get('linkedin_url', 'N/A')} - "
                                f"Influence: {dm.get('influence_level', 'UNKNOWN')}"
                            )
                        entity_data["target_personnel_data"] = "\n".join(personnel_summary)
                    else:
                        entity_data["target_personnel_data"] = "No target personnel data available"

                    # Add bridge contacts data (currently placeholder)
                    entity_data["bridge_contacts_data"] = "No bridge contacts data currently available"

                    logger.info(f"✅ Leadership data collected: {entity_data['leadership_count']} decision makers")
            elif not enable_leadership_enrichment:
                logger.info("⏭️ Skipping leadership enrichment for objective=%s", objective)

            # PHASE 0 ENHANCEMENT: Collect Yellow Panther team data for Connections analysis
            try:
                from backend.connections_analyzer import YELLOW_PANTHER_TEAM, format_connections_for_dossier

                # Add YP team data for Connections section
                yp_team_summary = []
                for yp_member in YELLOW_PANTHER_TEAM:
                    yp_team_summary.append(f"""
- {yp_member['yp_name']} ({yp_member['yp_role']}): {yp_member.get('yp_expertise_1', '')}, {yp_member.get('yp_expertise_2', '')}, {yp_member.get('yp_expertise_3', '')}
  LinkedIn: {yp_member.get('yp_linkedin', 'N/A')}
  Weight: {yp_member.get('yp_weight', 1.0)}
""")

                entity_data["yp_team_data"] = "\n".join(yp_team_summary)
                entity_data["yp_team_members"] = len(YELLOW_PANTHER_TEAM)

                logger.info(f"✅ Yellow Panther team data added: {entity_data['yp_team_members']} members")

            except Exception as e:
                logger.warning(f"⚠️ Could not load YP team data: {e}")
                entity_data["yp_team_data"] = "Yellow Panther team data not available"
                entity_data["yp_team_members"] = 0

            await collector.close()
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

        self._last_entity_data_by_id[entity_id] = deepcopy(entity_data)

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
        if self.disable_question_extraction or not enable_question_extraction:
            logger.info(
                "Skipping dossier question extraction (disabled_by_env=%s disabled_by_objective=%s)",
                self.disable_question_extraction,
                not enable_question_extraction,
            )
            dossier.questions = []
        else:
            try:
                try:
                    from backend.dossier_question_extractor import DossierQuestionExtractor
                except ImportError:
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
        dossier.metadata = self._build_dossier_metadata(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            priority_score=priority_score,
            tier=tier,
            objective=objective,
            entity_data=entity_data or {},
            dossier_data_obj=dossier_data_obj,
        )

        logger.info(
            f"Dossier generated for {entity_name}: "
            f"{len(dossier.sections)} sections, "
            f"{len(dossier.questions)} questions, "
            f"{dossier.generation_time_seconds:.2f}s, "
            f"${dossier.total_cost_usd:.4f}"
        )

        return dossier

    def _build_dossier_metadata(
        self,
        *,
        entity_id: str,
        entity_name: str,
        entity_type: str,
        priority_score: int,
        tier: str,
        objective: str,
        entity_data: Dict[str, Any],
        dossier_data_obj: Optional["DossierData"],
    ) -> Dict[str, Any]:
        website_candidate = (
            entity_data.get("official_site_url")
            or entity_data.get("entity_website")
            or entity_data.get("website")
        )
        normalized_website = self._normalize_http_url(str(website_candidate or "")) if website_candidate else None

        sport = entity_data.get("entity_sport") or entity_data.get("sport")
        country = entity_data.get("entity_country") or entity_data.get("country")
        competition = entity_data.get("entity_league") or entity_data.get("league_or_competition")
        founded = entity_data.get("entity_founded") or entity_data.get("founded")

        missing_required_fields: List[str] = []
        if not sport:
            missing_required_fields.append("sport")
        if not country:
            missing_required_fields.append("country")
        if not competition:
            missing_required_fields.append("league_or_competition")
        if not founded and not normalized_website:
            missing_required_fields.append("founded_or_website")
        coverage_score = round(
            (4 - min(4, len(missing_required_fields))) / 4,
            3,
        )

        metadata: Dict[str, Any] = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "priority_score": priority_score,
            "tier": tier,
            "run_objective": objective,
            "sport": sport,
            "country": country,
            "league_or_competition": competition,
            "founded": founded,
            "website": normalized_website or website_candidate,
            "headquarters": entity_data.get("hq"),
            "metadata_coverage_score": coverage_score,
            "metadata_missing_fields": missing_required_fields,
            "canonical_sources": {
                "official_site": normalized_website or website_candidate,
            },
            "field_extraction_results": [],
            "browser_dossier_url": f"/entity-browser/{entity_id}/dossier",
            "page_url": f"/entity-browser/{entity_id}/dossier",
            "source_url": normalized_website or website_candidate,
            "signal_state": "monitor_no_opportunity",
            "opportunity_score": 0,
            "rfp_confidence": 0.0,
            "decision_summary": (
                "Dashboard posture MONITOR with no validated procurement opportunity."
            ),
            "last_pipeline_run_ref": {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "run_objective": objective,
                "browser_dossier_url": f"/entity-browser/{entity_id}/dossier",
                "source_url": normalized_website or website_candidate,
            },
        }

        if dossier_data_obj is not None:
            metadata["data_sources_used"] = list(getattr(dossier_data_obj, "data_sources_used", []) or [])
            metadata["collection_metrics"] = dict(getattr(dossier_data_obj, "collection_metrics", {}) or {})

        return metadata

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
        semaphore = asyncio.Semaphore(self.section_parallelism)

        async def _run(section_id: str):
            async with semaphore:
                generation_coro = self._generate_section(
                    section_id=section_id,
                    entity_data=entity_data,
                    model=model,
                )
                if self.section_generation_timeout_seconds:
                    try:
                        return await asyncio.wait_for(
                            generation_coro,
                            timeout=self.section_generation_timeout_seconds,
                        )
                    except asyncio.TimeoutError:
                        logger.warning(
                            "⚠️ Section %s generation timed out after %.2fs; using fallback section",
                            section_id,
                            self.section_generation_timeout_seconds,
                        )
                        return self._create_fallback_section(
                            section_id,
                            model,
                            reason_code="section_generation_timeout",
                        )
                return await generation_coro

        # Create tasks for parallel execution with bounded concurrency.
        tasks = [_run(section_id) for section_id in section_ids]

        # Execute in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out failures
        sections = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to generate section {section_ids[i]}: {result}")
                # Create fallback section
                sections.append(
                    self._create_fallback_section(
                        section_ids[i],
                        model,
                        reason_code="section_generation_exception",
                    )
                )
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
        max_tokens = int(template_info["max_tokens"])
        if self.section_max_tokens_cap > 0:
            max_tokens = min(max_tokens, self.section_max_tokens_cap)

        # Load prompt template
        from backend.dossier_templates import get_prompt_template
        prompt_template = get_prompt_template(
            template_info["prompt_template"],
            model
        )

        # Build prompt with entity data
        entity_name = entity_data.get("entity_name", "this entity")

        # Create safe entity data for formatting (remove entity_name to avoid duplicate)
        safe_entity_data = {k: v for k, v in entity_data.items() if k != "entity_name"}

        prompt_values = self._prepare_section_prompt_values(
            section_id=section_id,
            entity_name=entity_name,
            safe_entity_data=safe_entity_data,
        )

        deterministic_data = self._build_data_driven_section_content(section_id, entity_data)
        if (
            self.use_data_driven_section_baseline
            and section_id in self.data_driven_section_ids
            and deterministic_data is not None
        ):
            deterministic_status = str(deterministic_data.get("output_status") or "completed")
            deterministic_reason = deterministic_data.get("reason_code")
            section = DossierSection(
                id=section_id,
                title=template_info["description"],
                content=deterministic_data.get("content", []),
                metrics=deterministic_data.get("metrics", []),
                insights=deterministic_data.get("insights", []),
                recommendations=deterministic_data.get("recommendations", []),
                confidence=deterministic_data.get("confidence", 0.66),
                generated_by=model,
                output_status=deterministic_status,
                reason_code=deterministic_reason,
                parse_path="deterministic_data_driven_primary",
                fallback_used=deterministic_status not in {"completed", "completed_evidence_led"},
            )
            section.total_cost_usd = 0.0
            return section

        prompt = self._safe_prompt_format(prompt_template, prompt_values)
        prompt = self._apply_section_response_budget(
            section_id=section_id,
            model=model,
            prompt=prompt,
        )

        # Call Claude with appropriate model
        try:
            parse_path = "json_direct"
            reason_code: Optional[str] = None
            fallback_used = False
            output_status = "completed"
            # Select model based on cascade (use model names, not model IDs)
            claude_model = model  # haiku, sonnet, or opus
            if (
                self.long_sections_use_primary_model
                and section_id in self.compact_response_section_ids
                and model in {"sonnet", "opus"}
            ):
                claude_model = "haiku"

            # Generate content using ClaudeClient.query()
            response = await self.claude_client.query(
                prompt=prompt,
                model=claude_model,
                max_tokens=max_tokens,
                json_mode=self.section_json_mode,
                stream=False,
            )

            content_text = response.get("content", "")

            if not isinstance(content_text, str) or not content_text.strip():
                section_data, reason_code, parse_path = self._build_deterministic_section_fallback(
                    section_id=section_id,
                    primary_text="",
                    repaired_text=None,
                )
                fallback_used = True
                output_status = "completed_with_fallback"
            else:
                section_data = self._extract_section_data(content_text)
                if self._section_data_needs_repair(section_data):
                    parse_path = "json_repair_attempted"
                    if not self.section_json_repair_attempt:
                        reason_code = "section_schema_gate_failed_no_repair"
                        section_data, reason_code, parse_path = self._build_deterministic_section_fallback(
                            section_id=section_id,
                            primary_text=content_text,
                            repaired_text=None,
                        )
                        fallback_used = True
                        output_status = "completed_with_fallback"
                    else:
                        repair_prompt = self._build_section_json_repair_prompt(content_text)
                        repair_response = await self.claude_client.query(
                            prompt=repair_prompt,
                            model=claude_model,
                            max_tokens=min(max_tokens, 600),
                            json_mode=self.section_json_mode,
                            stream=False,
                        )
                        repaired_text = repair_response.get("content", "")
                        section_data = self._extract_section_data(repaired_text)
                        if self._section_data_needs_repair(section_data):
                            section_data, reason_code, parse_path = self._build_deterministic_section_fallback(
                                section_id=section_id,
                                primary_text=content_text,
                                repaired_text=repaired_text,
                            )
                            fallback_used = True
                            output_status = "completed_with_fallback"
                        else:
                            parse_path = "json_repair_recovered"
                            reason_code = "section_json_repaired"

            # Create DossierSection
            section = DossierSection(
                id=section_id,
                title=template_info["description"],
                content=section_data.get("content", []),
                metrics=section_data.get("metrics", []),
                insights=section_data.get("insights", []),
                recommendations=section_data.get("recommendations", []),
                confidence=section_data.get("confidence", 0.7),
                generated_by=model,
                output_status=output_status,
                reason_code=reason_code,
                parse_path=parse_path,
                fallback_used=fallback_used,
            )

            # Track cost (approximate)
            section_cost = self._estimate_section_cost(model, max_tokens)
            section.total_cost_usd = section_cost

            return section

        except Exception as e:
            logger.error(f"Error generating section {section_id} with {model}: {e}")
            raise

    def _extract_section_data(self, content_text: str) -> Dict[str, Any]:
        """Extract structured section data from model output."""
        section_data = self._extract_last_valid_json_block(content_text)
        if isinstance(section_data, list):
            return {"content": section_data}
        if isinstance(section_data, dict):
            return section_data
        return {"content": [content_text]}

    @staticmethod
    def _safe_prompt_format(prompt_template: str, values: Dict[str, Any]) -> str:
        class _PromptValues(dict):
            def __missing__(self, _key):  # pragma: no cover - trivial fallback
                return ""

        return prompt_template.format_map(_PromptValues(values))

    @staticmethod
    def _truncate_prompt_value(value: str, max_chars: int) -> str:
        if max_chars <= 0:
            return ""
        if len(value) <= max_chars:
            return value
        keep = max(64, max_chars - 64)
        omitted = len(value) - keep
        return f"{value[:keep].rstrip()} ... [truncated {omitted} chars]"

    @staticmethod
    def _parse_positive_float_env(value: Optional[str]) -> Optional[float]:
        if value is None:
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        if parsed <= 0:
            return None
        return parsed

    def _prepare_section_prompt_values(
        self,
        *,
        section_id: str,
        entity_name: str,
        safe_entity_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        values = {"entity_name": entity_name, **safe_entity_data}
        limits = dict(self.section_prompt_field_limits_default)
        limits.update(self.section_prompt_field_limits_by_section.get(section_id, {}))
        for key, max_chars in limits.items():
            raw = values.get(key)
            if raw is None:
                continue
            if isinstance(raw, (dict, list)):
                raw_text = json.dumps(raw, ensure_ascii=True)
            else:
                raw_text = str(raw)
            values[key] = self._truncate_prompt_value(raw_text, int(max_chars))
        return values

    def _apply_section_response_budget(self, *, section_id: str, model: str, prompt: str) -> str:
        if section_id not in self.compact_response_section_ids:
            return prompt
        word_budget_by_model = {
            "haiku": 450,
            "sonnet": 550,
            "opus": 650,
        }
        max_words = word_budget_by_model.get(model, 500)
        budget_instruction = (
            "\n\nSTRICT RESPONSE BUDGET:\n"
            f"- Keep total output under {max_words} words.\n"
            "- Return concise JSON only with keys: content, metrics, insights, recommendations, confidence.\n"
            "- content: max 6 items; metrics: max 1 item; insights: max 2 items; recommendations: max 2 items.\n"
            "- Prefer high-signal, entity-specific facts; avoid generic filler."
        )
        return f"{prompt}{budget_instruction}"

    @staticmethod
    def _extract_last_valid_json_block(content_text: str) -> Any:
        """
        Parse the last valid JSON object/array from model output, including fenced blocks.
        """
        if not isinstance(content_text, str) or not content_text.strip():
            return {}

        candidate_blocks: List[str] = []

        fenced_matches = re.findall(
            r"```(?:json)?\s*([\s\S]*?)```",
            content_text,
            flags=re.IGNORECASE,
        )
        candidate_blocks.extend([block.strip() for block in fenced_matches if block and block.strip()])

        for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
            match = re.search(pattern, content_text)
            if match:
                candidate_blocks.append(match.group(0).strip())

        candidate_blocks.append(content_text.strip())

        for block in reversed(candidate_blocks):
            try:
                parsed = json.loads(block)
                if isinstance(parsed, (dict, list)):
                    return parsed
            except Exception:
                continue

        return {}

    def _section_data_needs_repair(self, section_data: Dict[str, Any]) -> bool:
        content = section_data.get("content")
        if not isinstance(content, list) or not content:
            return True

        first_text = next((item for item in content if isinstance(item, str) and item.strip()), "")
        if not first_text:
            return True

        normalized = first_text.strip().lower()
        instruction_markers = (
            "analyze the request",
            "the user wants",
            "task:",
            "instruction",
            "evaluate whether",
            "please review",
            "request context",
            "return valid json",
        )
        if any(marker in normalized for marker in instruction_markers):
            return True

        # Raw markdown/code-fenced JSON indicates parse failure and requires repair.
        if normalized.startswith("```"):
            return True
        if normalized.startswith("{") or normalized.startswith("["):
            return True

        return False

    @staticmethod
    def _build_deterministic_section_fallback(
        section_id: str,
        primary_text: str,
        repaired_text: Optional[str],
    ) -> tuple[Dict[str, Any], str, str]:
        raw_text = (repaired_text or primary_text or "")
        heuristic_data = EntityDossierGenerator._coerce_unstructured_section_data(raw_text)
        if heuristic_data:
            logger.warning(
                "⚠️ Section %s JSON repair failed; using heuristic content fallback",
                section_id,
            )
            return heuristic_data, "section_json_repair_failed_heuristic_fallback", "heuristic_content_fallback"

        fallback_text = raw_text.strip()
        if fallback_text:
            logger.warning(
                "⚠️ Section %s JSON repair failed; using deterministic text fallback",
                section_id,
            )
            return (
                {
                    "content": [fallback_text[:1600]],
                    "metrics": [],
                    "insights": [],
                    "recommendations": [],
                    "confidence": 0.45,
                },
                "section_json_repair_failed_text_fallback",
                "deterministic_text_fallback",
            )

        logger.warning(
            "⚠️ Section %s JSON repair failed with empty payload; using minimal placeholder fallback",
            section_id,
        )
        return (
            {
                "content": [f"Section generation for {section_id} returned no structured content in this run."],
                "metrics": [],
                "insights": [],
                "recommendations": [],
                "confidence": 0.2,
            },
            "section_json_repair_failed_minimal_placeholder",
            "minimal_placeholder_fallback",
        )

    @staticmethod
    def _build_section_json_repair_prompt(raw_output: str) -> str:
        return (
            "Rewrite the following output as strict JSON only.\n"
            "Return a single JSON object with keys: content (array of strings), metrics (array), "
            "insights (array), recommendations (array), confidence (number 0-1).\n"
            "Do not include markdown, commentary, or extra text.\n\n"
            f"RAW_OUTPUT:\n{raw_output}"
        )

    @staticmethod
    def _coerce_unstructured_section_data(raw_output: str) -> Optional[Dict[str, Any]]:
        """Best-effort fallback when model output is non-JSON after repair."""
        if not isinstance(raw_output, str) or not raw_output.strip():
            return None

        marker_patterns = (
            "analyze the request",
            "the user wants",
            "request context",
            "return valid json",
            "instruction",
            "task:",
            "please review",
        )

        content_items: List[str] = []
        for raw_line in raw_output.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("```"):
                continue

            lowered = line.lower()
            if any(marker in lowered for marker in marker_patterns):
                continue

            line = re.sub(r"^\d+[\.\)]\s*", "", line)
            line = re.sub(r"^[-*•]\s*", "", line).strip()

            if line in {"{", "}", "[", "]"}:
                continue
            if len(line) < 24 and "http" not in line:
                continue

            content_items.append(line)

        deduped: List[str] = []
        seen = set()
        for item in content_items:
            if item in seen:
                continue
            seen.add(item)
            deduped.append(item)
            if len(deduped) >= 6:
                break

        if not deduped:
            return None

        return {
            "content": deduped,
            "metrics": [],
            "insights": [],
            "recommendations": [],
            "confidence": 0.55,
        }

    @staticmethod
    def _normalize_entity_key(value: str) -> str:
        return " ".join((value or "").strip().lower().split())

    @staticmethod
    def _normalize_http_url(candidate: Optional[str]) -> Optional[str]:
        if not isinstance(candidate, str):
            return None
        value = candidate.strip()
        if not value:
            return None
        if value.startswith(("http://", "https://")):
            return value.rstrip("/")
        if value.startswith("www.") or "." in value:
            return f"https://{value.lstrip('/').rstrip('/')}"
        return None

    def _get_seeded_official_site_url(self, entity_name: str) -> Optional[str]:
        key = self._normalize_entity_key(entity_name)
        if not key:
            return None
        return self._seeded_official_site_by_entity_name.get(key)

    def seed_official_site_url(self, entity_name: str, url: str) -> Optional[str]:
        normalized_url = self._normalize_http_url(url)
        key = self._normalize_entity_key(entity_name)
        if not key or not normalized_url:
            return None
        self._seeded_official_site_by_entity_name[key] = normalized_url
        return normalized_url

    def get_last_official_site_url(self, entity_id: str) -> Optional[str]:
        payload = self._last_entity_data_by_id.get(entity_id) or {}
        candidates = [
            payload.get("official_site_url"),
            payload.get("entity_website"),
            payload.get("website"),
            payload.get("url"),
        ]
        for candidate in candidates:
            normalized = self._normalize_http_url(candidate)
            if normalized:
                return normalized
        return None

    def get_last_entity_data(self, entity_id: str) -> Dict[str, Any]:
        payload = self._last_entity_data_by_id.get(entity_id) or {}
        if isinstance(payload, dict):
            return deepcopy(payload)
        return {}

    def _build_data_driven_section_content(
        self,
        section_id: str,
        entity_data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        def _is_unknownish(value: Any) -> bool:
            text = str(value or "").strip().lower()
            if text in {"", "unknown", "unknown sport", "unknown country", "unknown competition", "none", "null", "n/a"}:
                return True
            if text.startswith("unknown "):
                return True
            if text in {"http://unknown", "https://unknown"}:
                return True
            return False

        entity_name = str(entity_data.get("entity_name") or "This entity")
        entity_type = str(entity_data.get("entity_type") or "Organization")
        sport = str(entity_data.get("entity_sport") or entity_data.get("sport") or "Unknown sport")
        country = str(entity_data.get("entity_country") or entity_data.get("country") or "Unknown country")
        league = str(entity_data.get("entity_league") or entity_data.get("league_or_competition") or "Unknown competition")
        founded = str(entity_data.get("entity_founded") or entity_data.get("founded") or "Unknown")
        stadium = str(entity_data.get("entity_stadium") or entity_data.get("stadium") or "Unknown")
        website = str(entity_data.get("entity_website") or entity_data.get("website") or entity_data.get("official_site_url") or "Unknown")
        headquarters = str(entity_data.get("hq") or "Unknown")
        revenue_band = str(entity_data.get("entity_revenue_band") or entity_data.get("estimated_revenue_band") or "Unknown")
        digital_maturity = str(entity_data.get("entity_digital_maturity") or entity_data.get("digital_maturity") or "Unknown")
        leadership_names = str(entity_data.get("leadership_names") or "").strip()
        leadership_roles = str(entity_data.get("leadership_roles") or "").strip()
        leadership_count = int(entity_data.get("leadership_count") or 0)
        news_items = entity_data.get("news_items") if isinstance(entity_data.get("news_items"), list) else []
        opportunity_count = int(entity_data.get("opportunity_count") or 0)
        points = str(entity_data.get("points") or "unknown")
        league_position = str(entity_data.get("league_position") or "unknown")
        required_values = {
            "sport": sport,
            "country": country,
            "league": league,
            "founded": founded,
            "website": website,
        }
        unknown_required_field_count = sum(
            1
            for value in required_values.values()
            if _is_unknownish(value)
        )
        metadata_coverage_score = round((len(required_values) - unknown_required_field_count) / max(1, len(required_values)), 3)
        core_degraded = metadata_coverage_score < 0.6

        if section_id == "core_information":
            insights = [f"Digital maturity baseline is {digital_maturity}."]
            recommendations = [
                "Use official-site and leadership sources as primary channels for next-hop discovery.",
            ]
            reason_code = None
            output_status = "completed_evidence_led"
            confidence = 0.72
            if core_degraded:
                output_status = "degraded_sparse_evidence"
                reason_code = "insufficient_metadata"
                confidence = 0.48
                insights.append(
                    "Metadata coverage is insufficient for reliable discovery seeding; targeted metadata recovery is required."
                )
                recommendations.append(
                    "Run targeted metadata recovery for sport, country, league, and official website before wider discovery hops."
                )
            else:
                insights.append("Metadata quality is sufficient for downstream discovery seeding.")
            return {
                "content": [
                    f"{entity_name} is a {entity_type} operating in {sport} with core activity in {country}.",
                    f"The organization is currently associated with {league}.",
                    f"Known profile markers include founded year {founded}, venue {stadium}, and website {website}.",
                ],
                "metrics": [
                    f"Founded: {founded}",
                    f"Country: {country}",
                    f"Revenue band: {revenue_band}",
                    f"Metadata coverage score: {metadata_coverage_score}",
                    f"Unknown required fields: {unknown_required_field_count}",
                ],
                "insights": insights,
                "recommendations": recommendations,
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "quick_actions":
            actions = [
                f"Prioritize outreach to {entity_name}'s commercial/digital leadership with entity-specific value framing.",
                "Run targeted discovery hops against official announcements and recent press updates before broad web hops.",
            ]
            if opportunity_count > 0:
                actions.append(f"Exploit {opportunity_count} detected strategic opportunity signal(s) for tailored outreach timing.")
            low_signal_actionability = leadership_count == 0 and opportunity_count == 0 and len(news_items) == 0
            output_status = "completed_with_sparse_fallback"
            reason_code = None
            confidence = 0.68
            if low_signal_actionability:
                output_status = "degraded_sparse_evidence"
                reason_code = "no_actionable_signals"
                confidence = 0.5
                actions = [
                    f"Actionability for {entity_name} is currently limited by missing leadership/news/opportunity evidence.",
                    "Do not send broad outreach yet; collect named decision makers and one recent entity-grounded trigger signal first.",
                ]
            return {
                "content": actions[:4],
                "metrics": [
                    f"Leadership records: {leadership_count}",
                    f"Opportunities detected: {opportunity_count}",
                    f"Recent news items: {len(news_items)}",
                ],
                "insights": [
                    "Action quality improves when discovery is constrained to entity-grounded official channels first.",
                ],
                "recommendations": [
                    "Execute a leadership-first contact path and a parallel press-release discovery lane.",
                    "Trigger dossier refresh after any new leadership appointment or platform partnership signal.",
                ],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "contact_information":
            content = [
                f"Primary web presence: {website}.",
                f"Headquarters marker: {headquarters}.",
                f"Country context: {country}.",
            ]
            if leadership_names:
                content.append(f"Known decision makers: {leadership_names}.")
            output_status = "completed_with_sparse_fallback"
            reason_code = None
            confidence = 0.67
            if leadership_count == 0:
                output_status = "degraded_sparse_evidence"
                reason_code = "no_leadership_contacts"
                confidence = 0.53
            return {
                "content": content[:5],
                "metrics": [
                    f"Leadership contacts identified: {leadership_count}",
                ],
                "insights": [
                    "Contact surface is strongest through official web channels and verified leadership profiles.",
                ],
                "recommendations": [
                    "Use named leadership contacts for role-specific outreach sequencing.",
                ],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "recent_news":
            recent_news_reason_code = str(entity_data.get("recent_news_reason_code") or "").strip().lower()
            if news_items:
                content = []
                for item in news_items[:4]:
                    if not isinstance(item, dict):
                        continue
                    headline = str(item.get("headline") or "Untitled update")
                    summary = str(item.get("summary") or "").strip()
                    source = str(item.get("source_site") or "unknown source")
                    content.append(f"{headline} ({source}): {summary[:180]}")
                if not content:
                    content = [f"No structured recent-news entries were captured for {entity_name} in this run."]
            else:
                content = [f"No structured recent-news entries were captured for {entity_name} in this run."]
            output_status = "completed_with_sparse_fallback"
            reason_code = None
            confidence = 0.62
            if len(news_items) == 0 and not recent_news_reason_code:
                output_status = "degraded_sparse_evidence"
                reason_code = "recent_news_empty"
                confidence = 0.48
            if recent_news_reason_code in {"timeout_partial", "source_low_signal"}:
                output_status = "degraded_sparse_evidence"
                reason_code = recent_news_reason_code
                confidence = 0.52 if recent_news_reason_code == "timeout_partial" else 0.5
            return {
                "content": content,
                "metrics": [f"News items captured: {len(news_items)}"],
                "insights": [
                    "News coverage quality depends on entity-grounded source selection and scrape depth.",
                ],
                "recommendations": [
                    "Re-run recent-news collection with source constraints when news count is below target.",
                ],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "leadership":
            leader_lines: List[str] = []
            if isinstance(entity_data.get("leadership_data"), dict):
                for person in (entity_data.get("leadership_data") or {}).get("decision_makers", [])[:6]:
                    if not isinstance(person, dict):
                        continue
                    name = str(person.get("name") or "").strip()
                    role = str(person.get("role") or "").strip()
                    linkedin = str(person.get("linkedin_url") or "").strip()
                    if not name:
                        continue
                    snippet = f"{name} - {role or 'Role unknown'}"
                    if linkedin:
                        snippet = f"{snippet} ({linkedin})"
                    leader_lines.append(snippet)
            if not leader_lines and leadership_names:
                leader_lines = [f"{leadership_names} ({leadership_roles or 'roles not yet structured'})"]
            if not leader_lines:
                leader_lines = [f"Leadership records are currently sparse for {entity_name}."]
            output_status = "completed_with_sparse_fallback"
            reason_code = None
            confidence = 0.66
            if leadership_count == 0:
                output_status = "degraded_sparse_evidence"
                reason_code = "leadership_sparse"
                confidence = 0.5
            return {
                "content": leader_lines,
                "metrics": [f"Decision makers identified: {leadership_count}"],
                "insights": [
                    "Leadership extraction should be denoised before enrichment to avoid noisy profile searches.",
                ],
                "recommendations": [
                    "Prioritize outreach to commercial, digital, and procurement-adjacent roles where present.",
                ],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "digital_maturity":
            tech_stack = entity_data.get("detected_tech_stack")
            if isinstance(tech_stack, dict):
                frontend = str(tech_stack.get("frontend") or "unknown")
                analytics = str(tech_stack.get("analytics") or "unknown")
                crm = str(tech_stack.get("crm") or "unknown")
            else:
                frontend = analytics = crm = "unknown"
            output_status = "completed_with_sparse_fallback"
            reason_code = None
            confidence = 0.64
            if not isinstance(tech_stack, dict) and str(league_position).lower() == "unknown" and str(points).lower() == "unknown":
                output_status = "degraded_sparse_evidence"
                reason_code = "digital_maturity_low_signal"
                confidence = 0.52
            return {
                "content": [
                    f"Digital maturity baseline: {digital_maturity}.",
                    f"Observed stack markers include frontend={frontend}, analytics={analytics}, crm={crm}.",
                    f"Current performance markers: league_position={league_position}, points={points}.",
                ],
                "metrics": [
                    f"Digital maturity: {digital_maturity}",
                    f"Tech stack confidence: {'present' if isinstance(tech_stack, dict) else 'limited'}",
                ],
                "insights": [
                    "Depth is constrained when official-site rendering yields low-signal content shells.",
                ],
                "recommendations": [
                    "Trigger rendered scrape fallback for JS-heavy pages when extracted text is below quality threshold.",
                ],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "outreach_strategy":
            primary_target = leadership_names.split(",")[0].strip() if leadership_names else f"{entity_name} digital/commercial lead"
            output_status = "completed_with_sparse_fallback"
            reason_code = None
            confidence = 0.65
            if leadership_count == 0 and len(news_items) == 0:
                output_status = "degraded_sparse_evidence"
                reason_code = "outreach_low_evidence"
                confidence = 0.5
            return {
                "content": [
                    f"Primary target: {primary_target}.",
                    "Sequence outreach in three steps: context proof, capability mapping, and low-friction pilot ask.",
                    "Anchor every message to entity-grounded evidence from official-site or recent-news signals.",
                ],
                "metrics": [
                    f"Leadership targets available: {leadership_count}",
                    f"News/context anchors available: {len(news_items)}",
                ],
                "insights": [
                    "Outreach conversion improves when messaging references specific operational signals rather than generic claims.",
                ],
                "recommendations": [
                    "Send role-specific variants for commercial and technology stakeholders within the same account.",
                ],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "strategic_analysis":
            strategic_signals = []
            if not _is_unknownish(website):
                strategic_signals.append(f"official site: {website}")
            if leadership_count > 0:
                strategic_signals.append(f"leadership anchors: {leadership_count}")
            if len(news_items) > 0:
                strategic_signals.append(f"recent news anchors: {len(news_items)}")
            if opportunity_count > 0:
                strategic_signals.append(f"opportunity signals: {opportunity_count}")
            if not strategic_signals:
                strategic_signals.append("metadata anchors only")

            content = [
                f"{entity_name}'s strategic position is primarily grounded in {sport.lower()} context, league footing, and its official site surface.",
                f"Observed grounding markers include {', '.join(strategic_signals[:4])}.",
                f"Strategy should prioritize entity-specific commercial and digital timing signals over broad league-level assumptions.",
            ]
            recommendations = [
                "Use official-site and same-domain evidence before expanding to wider news or social channels.",
                "Refresh this section after new leadership, partnership, or procurement-adjacent evidence is discovered.",
            ]
            if opportunity_count > 0:
                recommendations.insert(
                    0,
                    f"Prioritize the {opportunity_count} detected opportunity signal(s) when sequencing outreach and follow-up.",
                )
            confidence = 0.68 if metadata_coverage_score >= 0.6 or strategic_signals else 0.55
            output_status = "completed_evidence_led" if metadata_coverage_score >= 0.6 else "completed_with_sparse_fallback"
            reason_code = None if output_status == "completed_evidence_led" else "strategic_analysis_sparse"
            return {
                "content": content,
                "metrics": [
                    f"Metadata coverage score: {metadata_coverage_score}",
                    f"Leadership anchors: {leadership_count}",
                    f"Recent news anchors: {len(news_items)}",
                    f"Opportunity signals: {opportunity_count}",
                ],
                "insights": [
                    "Strategic analysis should stay grounded in entity metadata and only widen when the evidence base expands.",
                    "The strongest next-hop value comes from same-domain and official-channel evidence, not broad generic market summaries.",
                ],
                "recommendations": recommendations[:3],
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "connections":
            connection_anchors = []
            if not _is_unknownish(website):
                connection_anchors.append(f"official domain: {website}")
            if headquarters and not _is_unknownish(headquarters):
                connection_anchors.append(f"headquarters marker: {headquarters}")
            if leadership_count > 0:
                connection_anchors.append(f"named leadership records: {leadership_count}")
            if not connection_anchors:
                connection_anchors.append("metadata-only connection surface")

            content = [
                f"The strongest connection surface for {entity_name} is its official domain and associated canonical contact routes.",
                f"Observed anchors include {', '.join(connection_anchors[:4])}.",
                "Connection mapping should stay entity-specific and avoid speculative network claims without named evidence.",
            ]
            recommendations = [
                "Prefer official-domain and same-domain routes when mapping commercial or procurement connections.",
                "Re-run the connection surface after leadership, news, or partnership evidence changes.",
            ]
            confidence = 0.66 if metadata_coverage_score >= 0.6 or connection_anchors else 0.54
            output_status = "completed_evidence_led" if metadata_coverage_score >= 0.6 else "completed_with_sparse_fallback"
            reason_code = None if output_status == "completed_evidence_led" else "connections_sparse"
            return {
                "content": content,
                "metrics": [
                    f"Official-site anchors: {0 if _is_unknownish(website) else 1}",
                    f"Leadership anchors: {leadership_count}",
                    f"Headquarters anchors: {0 if _is_unknownish(headquarters) else 1}",
                ],
                "insights": [
                    "Connections are best represented as canonical entity surfaces unless the discovery graph provides named evidence.",
                    "Long-form network analysis should not block dossier completion when the entity has enough grounding metadata.",
                ],
                "recommendations": recommendations,
                "confidence": confidence,
                "output_status": output_status,
                "reason_code": reason_code,
            }

        if section_id == "ai_reasoner_assessment":
            confidence_markers = []
            if leadership_count > 0:
                confidence_markers.append("leadership coverage present")
            if len(news_items) > 0:
                confidence_markers.append("recent news anchors present")
            if website and website != "Unknown":
                confidence_markers.append("official web presence identified")
            marker_summary = ", ".join(confidence_markers) if confidence_markers else "limited source grounding"
            return {
                "content": [
                    f"AI readiness posture for {entity_name} is constrained by available entity-grounded signal density.",
                    f"Current evidence indicates {marker_summary}.",
                    "Primary execution risk is low-structure source content, not missing orchestration paths.",
                ],
                "metrics": [
                    f"Signals available for assessment: leadership={leadership_count}, news={len(news_items)}, opportunities={opportunity_count}",
                ],
                "insights": [
                    "Assessment quality improves when official-site rendered extraction yields substantive text and citations.",
                    "Decision confidence should remain bounded when data is sparse or partially inferred.",
                ],
                "recommendations": [
                    "Run a rendered-site depth pass for JS-heavy official pages before escalating model depth.",
                    "Promote only evidence-backed claims into downstream opportunity scoring.",
                ],
                "confidence": 0.63,
            }

        if section_id == "challenges_opportunities":
            challenges = [
                "Source pages may resolve to low-signal shells, reducing extraction depth.",
                "Leadership and recent-news signals can be noisy without strict denoise and grounding gates.",
            ]
            opportunities = [
                "Entity-grounded discovery can increase with rendered fallback and hop-policy tuning.",
                "Role-specific outreach quality improves when decision-maker extraction is deterministic and denoised.",
            ]
            if opportunity_count > 0:
                opportunities.append(f"Detected opportunity signals currently: {opportunity_count}.")
            return {
                "content": [
                    "Key challenges: " + " ".join(challenges[:2]),
                    "Key opportunities: " + " ".join(opportunities[:2]),
                ],
                "metrics": [
                    f"Opportunity signals detected: {opportunity_count}",
                ],
                "insights": [
                    "Challenge/opportunity balance is strongest when discovery evidence is entity-specific and recent.",
                ],
                "recommendations": [
                    "Prioritize entities with >=2 grounded signals for high-confidence outreach sequencing.",
                    "Re-run low-yield entities with expanded rendered extraction and strict source filters.",
                ],
                "confidence": 0.62,
            }

        return None
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

    def _create_fallback_section(
        self,
        section_id: str,
        model: str,
        reason_code: str = "section_generation_failed",
    ) -> DossierSection:
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
            generated_by=model,
            output_status="failed",
            reason_code=reason_code,
            parse_path="section_exception_fallback",
            fallback_used=True,
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

            # Add scraped properties (founded, stadium, website, etc.)
            if metadata.founded:
                entity_dict["founded"] = metadata.founded
            if metadata.stadium:
                entity_dict["stadium"] = metadata.stadium
            if metadata.capacity:
                entity_dict["capacity"] = metadata.capacity
            if metadata.website:
                entity_dict["website"] = metadata.website
            if metadata.employees:
                entity_dict["employees"] = metadata.employees
            if metadata.headquarters:
                entity_dict["hq"] = metadata.headquarters

        # Add scraped content if available
        if dossier_data.scraped_content:
            entity_dict["scraped_content"] = dossier_data.scraped_content
            entity_dict["has_scraped_content"] = True

        # Add hypothesis signals if available
        if dossier_data.hypothesis_signals:
            entity_dict["hypothesis_signals"] = dossier_data.hypothesis_signals
            entity_dict["has_hypothesis_signals"] = True

        # Phase 0: Add enhanced section data
        # Section 2: Digital Transformation
        if dossier_data.digital_transformation:
            entity_dict["digital_transformation"] = dossier_data.digital_transformation
            if dossier_data.digital_transformation.get("tech_stack"):
                tech = dossier_data.digital_transformation["tech_stack"]
                entity_dict["detected_tech_stack"] = tech
                entity_dict["frontend_framework"] = tech.get("frontend", "unknown")
                entity_dict["analytics_platform"] = tech.get("analytics", "none")
                entity_dict["crm_system"] = tech.get("crm", "unknown")

        # Section 4: Strategic Opportunities
        if dossier_data.strategic_opportunities:
            entity_dict["strategic_opportunities"] = dossier_data.strategic_opportunities
            opps = dossier_data.strategic_opportunities.get("opportunities", [])
            entity_dict["detected_opportunities"] = opps
            entity_dict["opportunity_count"] = len(opps)

        # Section 5: Leadership
        if dossier_data.leadership:
            entity_dict["leadership_data"] = dossier_data.leadership
            dms = dossier_data.leadership.get("decision_makers", [])
            entity_dict["leadership_names"] = ", ".join([dm.get("name", "") for dm in dms if dm.get("name")])
            entity_dict["leadership_roles"] = ", ".join([dm.get("role", "") for dm in dms if dm.get("role")])
            entity_dict["leadership_linkedins"] = ", ".join([dm.get("linkedin_url", "") for dm in dms if dm.get("linkedin_url")])
            entity_dict["leadership_count"] = len(dms)

        # Section 7: Recent News
        if dossier_data.recent_news:
            entity_dict["recent_news"] = dossier_data.recent_news
            news_items = dossier_data.recent_news.get("news_items", [])
            entity_dict["news_items"] = news_items
            entity_dict["news_count"] = len(news_items)
            entity_dict["recent_news_reason_code"] = dossier_data.recent_news.get("reason_code")

        # Section 8: Performance
        if dossier_data.performance:
            entity_dict["performance"] = dossier_data.performance
            entity_dict["league_position"] = dossier_data.performance.get("league_position", "unknown")
            entity_dict["points"] = dossier_data.performance.get("points", "unknown")
            entity_dict["recent_form"] = dossier_data.performance.get("recent_form", [])
            entity_dict["performance_reason_code"] = dossier_data.performance.get("reason_code")

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

    def _extract_first_url(self, items: Any) -> Optional[str]:
        """Extract first usable URL from a list of dict records."""
        if not isinstance(items, list):
            return None

        for item in items:
            if isinstance(item, dict):
                for key in ("url", "link", "job_url"):
                    value = item.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()

        return None

    @staticmethod
    def _discovery_signal_rank(validation_state: str) -> int:
        normalized = str(validation_state or "").strip().lower()
        if normalized == "validated":
            return 3
        if normalized == "provisional":
            return 2
        return 1

    def _build_discovery_signal_pool(self, discovery_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        pool: List[Dict[str, Any]] = []
        if not isinstance(discovery_payload, dict):
            return pool

        for state, key in (("validated", "signals_discovered"), ("provisional", "provisional_signals")):
            signals = discovery_payload.get(key)
            if not isinstance(signals, list):
                continue
            for signal in signals:
                if not isinstance(signal, dict):
                    continue
                text = str(signal.get("statement") or signal.get("text") or "").strip()
                if not text:
                    continue
                pool.append(
                    {
                        "validation_state": state,
                        "rank": self._discovery_signal_rank(state),
                        "text": text,
                        "content": str(signal.get("content") or "").strip(),
                        "url": str(signal.get("url") or "").strip(),
                        "subtype": str(signal.get("subtype") or signal.get("type") or "").strip(),
                        "source": "signal",
                    }
                )

        candidate_evaluations = discovery_payload.get("candidate_evaluations")
        if isinstance(candidate_evaluations, list):
            for item in candidate_evaluations:
                if not isinstance(item, dict):
                    continue
                text = str(
                    item.get("evidence_snippet")
                    or item.get("evidence_statement")
                    or item.get("source_snippet")
                    or item.get("source_title")
                    or ""
                ).strip()
                if not text:
                    continue
                content_passages = item.get("evidence_content_passages")
                if isinstance(content_passages, list):
                    content = " ".join(str(p or "").strip() for p in content_passages if str(p or "").strip())
                else:
                    content = ""
                if not content:
                    content = str(item.get("evidence_content_item") or item.get("evidence_snippet") or "").strip()
                pool.append(
                    {
                        "validation_state": "candidate",
                        "rank": 1,
                        "text": text,
                        "content": content,
                        "url": str(item.get("source_url") or "").strip(),
                        "subtype": str(item.get("step_type") or "").strip(),
                        "source": "candidate_eval",
                    }
                )
        evidence_ledger = discovery_payload.get("evidence_ledger")
        if isinstance(evidence_ledger, list):
            for item in evidence_ledger:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("statement") or item.get("text") or "").strip()
                content = str(item.get("content") or item.get("raw_text") or "").strip()
                if not text and not content:
                    continue
                validation_state = str(item.get("validation_state") or "candidate").strip().lower()
                pool.append(
                    {
                        "validation_state": validation_state if validation_state in {"validated", "provisional"} else "candidate",
                        "rank": self._discovery_signal_rank(validation_state),
                        "text": text or self._truncate_prompt_value(content, 220),
                        "content": content,
                        "url": str(item.get("url") or "").strip(),
                        "subtype": str(item.get("subtype") or item.get("reason_code") or "").strip(),
                        "source": "evidence_ledger",
                    }
                )

        kimi_batch_outputs = discovery_payload.get("kimi_batch_outputs")
        if isinstance(kimi_batch_outputs, list):
            for batch in kimi_batch_outputs:
                if not isinstance(batch, dict):
                    continue
                for signal in batch.get("signals_found") or []:
                    if not isinstance(signal, dict):
                        continue
                    text = str(signal.get("summary") or signal.get("text") or "").strip()
                    if not text:
                        continue
                    pool.append(
                        {
                            "validation_state": "candidate",
                            "rank": 1,
                            "text": text,
                            "content": text,
                            "url": str(signal.get("url") or "").strip(),
                            "subtype": str(signal.get("signal_type") or "batch_signal").strip(),
                            "source": "kimi_batch_output",
                        }
                    )
        return pool

    def _extract_leadership_from_json_payload(self, text: str) -> List[Dict[str, str]]:
        payload = self._extract_last_valid_json_block(text)
        if not isinstance(payload, dict):
            raw = str(text or "")
            marker = raw.find('"decision_makers"')
            if marker >= 0:
                start = raw.rfind("{", 0, marker)
                if start >= 0:
                    depth = 0
                    end: Optional[int] = None
                    for index, ch in enumerate(raw[start:], start=start):
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                            if depth == 0:
                                end = index + 1
                                break
                    if end:
                        candidate = raw[start:end]
                        try:
                            parsed = json.loads(candidate)
                            if isinstance(parsed, dict):
                                payload = parsed
                        except Exception:
                            pass
        if not isinstance(payload, dict):
            return []
        people = payload.get("decision_makers")
        if not isinstance(people, list):
            return []
        extracted: List[Dict[str, str]] = []
        for person in people:
            if not isinstance(person, dict):
                continue
            name = str(person.get("name") or "").strip()
            role = str(person.get("role") or person.get("title") or "").strip()
            linkedin = str(person.get("linkedin_url") or person.get("linkedin") or "").strip()
            if name:
                extracted.append({"name": name, "role": role, "linkedin_url": linkedin})
        return extracted

    def _extract_leadership_from_text(self, text: str) -> List[Dict[str, str]]:
        normalized = str(text or "").strip()
        if not normalized:
            return []

        leadership: List[Dict[str, str]] = []
        patterns = (
            re.compile(
                r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-,:]\s*(Chief[^.,;\n]{0,80}|Head of[^.,;\n]{0,80}|Director[^.,;\n]{0,80}|CEO[^.,;\n]{0,80})\b"
            ),
            re.compile(
                r"\b(Chief[^.,;\n]{0,80}|Head of[^.,;\n]{0,80}|Director[^.,;\n]{0,80}|CEO[^.,;\n]{0,80})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b"
            ),
        )
        for pattern in patterns:
            for match in pattern.findall(normalized):
                first, second = str(match[0]).strip(), str(match[1]).strip()
                name, role = (first, second) if pattern is patterns[0] else (second, first)
                if len(name.split()) < 2:
                    continue
                leadership.append({"name": name, "role": role, "linkedin_url": ""})

        deduped: List[Dict[str, str]] = []
        seen: set[str] = set()
        for person in leadership:
            key = str(person.get("name") or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(person)
        return deduped

    def _extract_recent_news_from_pool(self, signal_pool: List[Dict[str, Any]], *, entity_name: str = "") -> List[Dict[str, Any]]:
        candidates: List[Dict[str, Any]] = []
        entity_tokens = [
            token
            for token in re.findall(r"[a-z0-9]+", str(entity_name or "").lower())
            if token and token not in {"fc", "football", "club"}
        ]
        for item in signal_pool:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            text = str(item.get("text") or "").strip()
            content = str(item.get("content") or "").strip()
            subtype = str(item.get("subtype") or "").strip().lower()
            if not text:
                continue

            grounding_blob = " ".join([text.lower(), content.lower(), url.lower()])
            if entity_tokens and not all(token in grounding_blob for token in entity_tokens[:2]):
                continue
            if not (
                any(token in subtype for token in ("news", "press", "partnership", "official"))
                or any(token in url.lower() for token in ("/news", "/press", "announcement", "media"))
            ):
                continue

            host = (urlparse(url).hostname or "").lower().lstrip("www.") if url else "unknown-source"
            date_match = re.search(
                r"\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2})\b",
                " ".join([text, content]),
            )
            headline = text.split(":")[0].strip()[:160]
            if len(headline) < 8:
                headline = text[:160]
            candidates.append(
                {
                    "headline": headline,
                    "summary": (content or text)[:260],
                    "source_site": host,
                    "publication_date": date_match.group(0) if date_match else None,
                    "validation_state": str(item.get("validation_state") or "candidate").strip().lower(),
                    "rank": int(item.get("rank") or 1),
                    "url": url,
                }
            )

        deduped: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for item in sorted(candidates, key=lambda row: (int(row.get("rank") or 1), bool(row.get("publication_date"))), reverse=True):
            key = f"{str(item.get('headline') or '').strip().lower()}|{str(item.get('source_site') or '').strip().lower()}"
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= 6:
                break
        return deduped

    def enrich_dossier_with_discovery_evidence(
        self,
        *,
        dossier_payload: Dict[str, Any],
        discovery_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        payload = dict(dossier_payload or {})
        sections = payload.get("sections")
        if not isinstance(sections, list):
            return payload

        signal_pool = self._build_discovery_signal_pool(discovery_payload)
        if not signal_pool:
            return payload
        evidence_available = bool(signal_pool)
        evidence_available = bool(signal_pool)

        leadership_candidates: List[Dict[str, Any]] = []
        for item in signal_pool:
            text_blob = " ".join([str(item.get("text") or "").strip(), str(item.get("content") or "").strip()]).strip()
            if not text_blob:
                continue
            extracted = self._extract_leadership_from_json_payload(text_blob)
            if not extracted:
                extracted = self._extract_leadership_from_text(text_blob)
            for person in extracted:
                leadership_candidates.append(
                    {
                        **person,
                        "validation_state": str(item.get("validation_state") or "candidate").strip().lower(),
                        "rank": int(item.get("rank") or 1),
                    }
                )

        deduped_leadership: List[Dict[str, Any]] = []
        seen_people: set[str] = set()
        for person in sorted(leadership_candidates, key=lambda row: int(row.get("rank") or 1), reverse=True):
            key = str(person.get("name") or "").strip().lower()
            if not key or key in seen_people:
                continue
            seen_people.add(key)
            deduped_leadership.append(person)
            if len(deduped_leadership) >= 6:
                break

        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        entity_name = str(payload.get("entity_name") or metadata.get("entity_name") or "").strip()
        recent_news = self._extract_recent_news_from_pool(signal_pool, entity_name=entity_name)
        prioritized_signal_pool = sorted(
            signal_pool,
            key=lambda row: (
                self._discovery_signal_rank(str(row.get("validation_state") or "candidate")),
                int(row.get("rank") or 1),
            ),
            reverse=True,
        )

        for section in sections:
            if not isinstance(section, dict):
                continue
            section_id = str(section.get("id") or "").strip().lower()
            if section_id == "quick_actions":
                anchors: List[str] = []
                for item in prioritized_signal_pool[:2]:
                    if not isinstance(item, dict):
                        continue
                    text = str(item.get("text") or item.get("content") or "").strip()
                    url = str(item.get("url") or "").strip()
                    if not text and not url:
                        continue
                    anchor = self._truncate_prompt_value(text, 160) if text else url
                    if url:
                        anchor = f"{anchor} [{url}]"
                    anchors.append(anchor)
                if anchors:
                    section["content"] = [
                        f"Prioritize outreach using the strongest evidence anchor: {anchors[0]}",
                        "Run the next discovery hop against official-site or same-domain paths that corroborate that signal.",
                        "Avoid broad outreach until the entity-specific signal is confirmed across at least one more source.",
                    ]
                    section["metrics"] = [
                        f"Evidence anchors available: {len(anchors)}",
                        f"Validated signals: {len(discovery_payload.get('signals_discovered') or [])}",
                        f"Provisional signals: {len(discovery_payload.get('provisional_signals') or [])}",
                    ]
                    section["output_status"] = "completed_evidence_led"
                    section["reason_code"] = None
                    section["confidence"] = max(0.62, float(section.get("confidence") or 0.62))
                elif evidence_available:
                    section["output_status"] = "degraded_sparse_evidence"
                    section["reason_code"] = "quick_actions_evidence_not_consumed"
                    section["confidence"] = min(0.5, float(section.get("confidence") or 0.5))
            if section_id == "contact_information":
                if evidence_available:
                    content = list(section.get("content") or [])
                    if not content:
                        content = [
                            f"Primary web presence: {metadata.get('website') or metadata.get('official_site_url') or 'Unknown'}.",
                            f"Headquarters marker: {metadata.get('hq') or metadata.get('headquarters') or 'Unknown'}.",
                        ]
                    section["content"] = content[:5]
                    section["output_status"] = "completed_evidence_led"
                    section["reason_code"] = None
                    section["confidence"] = max(0.64, float(section.get("confidence") or 0.64))
            if section_id == "leadership" and deduped_leadership:
                content: List[str] = []
                validated_count = 0
                for person in deduped_leadership:
                    prefix = ""
                    state = str(person.get("validation_state") or "candidate").strip().lower()
                    if state == "validated":
                        validated_count += 1
                    elif state == "provisional":
                        prefix = "[Unvalidated] "
                    else:
                        prefix = "[Unvalidated Candidate] "
                    snippet = f"{prefix}{person.get('name')} - {person.get('role') or 'Role unknown'}"
                    if str(person.get("linkedin_url") or "").strip():
                        snippet = f"{snippet} ({person.get('linkedin_url')})"
                    content.append(snippet)
                section["content"] = content[:6]
                section["metrics"] = [f"Decision makers identified: {len(deduped_leadership)}"]
                if validated_count > 0:
                    section["output_status"] = "completed_evidence_led"
                    section["reason_code"] = None
                    section["confidence"] = max(0.66, float(section.get("confidence") or 0.66))
                else:
                    section["output_status"] = "completed_with_sparse_fallback"
                    section["reason_code"] = "leadership_unvalidated_only"
                    section["confidence"] = 0.56
            elif section_id == "leadership" and evidence_available:
                section["output_status"] = "degraded_sparse_evidence"
                section["reason_code"] = "leadership_evidence_not_consumed"
                section["confidence"] = min(0.5, float(section.get("confidence") or 0.5))

            if section_id == "recent_news" and recent_news:
                content: List[str] = []
                validated_news = 0
                for item in recent_news[:5]:
                    state = str(item.get("validation_state") or "candidate").strip().lower()
                    prefix = ""
                    if state == "validated":
                        validated_news += 1
                    elif state == "provisional":
                        prefix = "[Unvalidated] "
                    else:
                        prefix = "[Unvalidated Candidate] "
                    date_fragment = f", {item['publication_date']}" if item.get("publication_date") else ""
                    content.append(
                        f"{prefix}{item.get('headline')} ({item.get('source_site')}{date_fragment}): {str(item.get('summary') or '')[:180]}"
                    )
                section["content"] = content
                section["metrics"] = [f"News items captured: {len(recent_news)}"]
                if validated_news > 0:
                    section["output_status"] = "completed_evidence_led"
                    section["reason_code"] = None
                    section["confidence"] = max(0.62, float(section.get("confidence") or 0.62))
                else:
                    section["output_status"] = "completed_with_sparse_fallback"
                    section["reason_code"] = "recent_news_unvalidated_only"
                    section["confidence"] = 0.55
            elif section_id == "recent_news" and evidence_available:
                section["output_status"] = "degraded_sparse_evidence"
                section["reason_code"] = "recent_news_evidence_not_consumed"
                section["confidence"] = min(0.52, float(section.get("confidence") or 0.52))
            if section_id == "outreach_strategy":
                anchors: List[str] = []
                for item in prioritized_signal_pool[:3]:
                    if not isinstance(item, dict):
                        continue
                    url = str(item.get("url") or "").strip()
                    text = str(item.get("text") or item.get("content") or "").strip()
                    if not text and not url:
                        continue
                    anchor = self._truncate_prompt_value(text, 150) if text else url
                    if url:
                        anchor = f"{anchor} [{url}]"
                    anchors.append(anchor)
                if anchors:
                    has_validated_anchor = any(
                        str(item.get("validation_state") or "").strip().lower() == "validated"
                        for item in prioritized_signal_pool[:3]
                        if isinstance(item, dict)
                    )
                    section["content"] = [
                        f"Primary evidence anchor: {anchors[0]}",
                        "Sequence outreach in three steps: context proof, capability mapping, and low-friction pilot ask.",
                        "Every message should cite one explicit discovery anchor before making a capability claim.",
                    ]
                    section["recommendations"] = [
                        f"Use anchored evidence in opening outreach: {anchors[0]}",
                        f"Secondary proof point: {anchors[1]}" if len(anchors) > 1 else "Gather one more entity-grounded proof point before broad outreach.",
                    ]
                    section["output_status"] = "completed_evidence_led" if has_validated_anchor else "completed_with_sparse_fallback"
                    section["reason_code"] = None if has_validated_anchor else "outreach_unvalidated_anchors"
                    section["confidence"] = max(0.58, float(section.get("confidence") or 0.58))
                elif evidence_available:
                    section["output_status"] = "degraded_sparse_evidence"
                    section["reason_code"] = "outreach_evidence_not_consumed"
                    section["confidence"] = min(0.5, float(section.get("confidence") or 0.5))

        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            payload["metadata"] = metadata
        metadata["discovery_enrichment"] = {
            "validated_signals": len(discovery_payload.get("signals_discovered") or []),
            "provisional_signals": len(discovery_payload.get("provisional_signals") or []),
            "candidate_events": len(discovery_payload.get("candidate_evaluations") or []),
            "candidate_events_summary": dict(discovery_payload.get("candidate_events_summary") or {}),
            "lane_failures": dict(discovery_payload.get("lane_failures") or {}),
            "actionability_score": float(discovery_payload.get("actionability_score") or 0.0),
            "entity_grounded_signal_count": int(discovery_payload.get("entity_grounded_signal_count") or 0),
        }
        return payload


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
- LEADERSHIP DATA: If currentData contains leadership_names, leadership_roles, or target_personnel, USE REAL NAMES. Only use placeholders like {ROLE} when no real names are available.
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
        "name": "USE REAL NAME from currentData.leadership_names if available, else 'unknown' (NEVER use {ROLE} placeholder)",
        "title": "specific title from currentData.leadership_roles if available",
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
Generate STANDARD tier dossier for {name} using the PREMIUM dossier shape (11 sections, ~30s, ~$0.057):

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

    COMPACT_TIMEOUT_FALLBACK_PROMPT = """
Generate a COMPACT dossier for {name} optimized for timeout fallback conditions.

Hard requirements:
1. Return valid JSON only
2. Include: metadata, executive_summary, quick_actions
3. Keep response concise and high-signal
4. Prioritize concrete procurement indicators and immediate next steps
5. Use {currentData} only (do not assume unavailable sources)
"""

    def __init__(self, claude_client: ClaudeClient, falkordb_client=None):
        """Initialize universal dossier generator."""
        super().__init__(claude_client, falkordb_client)
        self.model_query_timeout_seconds = float(os.getenv("DOSSIER_MODEL_QUERY_TIMEOUT_SECONDS", "0"))

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
            "STANDARD": self.UNIVERSAL_CLUB_DOSSIER_PROMPT,
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
            "has_hypothesis_signals": entity_data.get("has_hypothesis_signals", False),
            # PHASE 0: Add real leadership data if available
            "leadership_names": entity_data.get("leadership_names"),
            "leadership_roles": entity_data.get("leadership_roles"),
            "leadership_linkedins": entity_data.get("leadership_linkedins"),
            "target_personnel": entity_data.get("target_personnel_data", [])
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
        tier: str,
        max_tokens_override: Optional[int] = None,
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
        if getattr(self.claude_client, "_get_disabled_reason", None):
            disabled_reason = self.claude_client._get_disabled_reason()
            if disabled_reason:
                logger.warning(
                    f"⚠️ Claude API disabled ({disabled_reason}); returning minimal dossier for {entity_name}"
                )
                return self._create_minimal_dossier(entity_name)

        # Determine max tokens based on tier
        max_tokens_by_tier = {
            "BASIC": 2000,
            "STANDARD": 8000,
            "PREMIUM": 8000
        }
        max_tokens = max_tokens_by_tier.get(tier, 4000)
        if max_tokens_override is not None and max_tokens_override > 0:
            max_tokens = max_tokens_override

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
            response = await self._query_model_with_timeout(
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
            if not isinstance(e, asyncio.TimeoutError):
                logger.debug("Model generation failed with non-timeout error for %s", entity_name, exc_info=e)

        # Fallback to Sonnet if primary model failed
        if model != "sonnet":
            logger.info(f"🔄 Falling back to Sonnet for {entity_name}")
            try:
                response = await self._query_model_with_timeout(
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
                response = await self._query_model_with_timeout(
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

    async def _query_model_with_timeout(self, prompt: str, model: str, max_tokens: int) -> Dict[str, Any]:
        """
        Query the model with an optional timeout to avoid hangs in phase 0.
        """
        if self.model_query_timeout_seconds > 0:
            return await asyncio.wait_for(
                self.claude_client.query(
                    prompt=prompt,
                    model=model,
                    max_tokens=max_tokens,
                ),
                timeout=self.model_query_timeout_seconds,
            )

        return await self.claude_client.query(
            prompt=prompt,
            model=model,
            max_tokens=max_tokens,
        )

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

    def _derive_canonical_sources(self, entity_data: Dict[str, Any]) -> Dict[str, str]:
        """Build a compact canonical source map from known entity data fields."""
        if not isinstance(entity_data, dict):
            return {}

        canonical: Dict[str, str] = {}
        field_map = {
            "official_site": ("official_site_url", "official_website", "website", "url"),
            "careers": ("careers_url",),
            "press": ("press_url", "news_url"),
            "linkedin_company": ("linkedin_company_url",),
            "jobs_board": ("jobs_board_url",),
        }

        for key, candidates in field_map.items():
            for field in candidates:
                value = entity_data.get(field)
                if isinstance(value, str) and value.strip():
                    canonical[key] = value.strip()
                    break

        return canonical

    @staticmethod
    def _discovery_signal_rank(validation_state: str) -> int:
        normalized = str(validation_state or "").strip().lower()
        if normalized == "validated":
            return 3
        if normalized == "provisional":
            return 2
        return 1

    def _build_discovery_signal_pool(self, discovery_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        pool: List[Dict[str, Any]] = []
        if not isinstance(discovery_payload, dict):
            return pool

        for state, key in (
            ("validated", "signals_discovered"),
            ("provisional", "provisional_signals"),
        ):
            signals = discovery_payload.get(key)
            if not isinstance(signals, list):
                continue
            for signal in signals:
                if not isinstance(signal, dict):
                    continue
                text = str(signal.get("statement") or signal.get("text") or "").strip()
                if not text:
                    continue
                pool.append(
                    {
                        "validation_state": state,
                        "rank": self._discovery_signal_rank(state),
                        "text": text,
                        "content": str(signal.get("content") or "").strip(),
                        "url": str(signal.get("url") or "").strip(),
                        "subtype": str(signal.get("subtype") or signal.get("type") or "").strip(),
                        "source": "signal",
                    }
                )

        candidate_evaluations = discovery_payload.get("candidate_evaluations")
        if isinstance(candidate_evaluations, list):
            for item in candidate_evaluations:
                if not isinstance(item, dict):
                    continue
                if str(item.get("validation_state") or "").strip().lower() not in {"candidate", "diagnostic"}:
                    continue
                text = str(
                    item.get("evidence_snippet")
                    or item.get("evidence_statement")
                    or item.get("source_snippet")
                    or item.get("source_title")
                    or ""
                ).strip()
                if not text:
                    continue
                content_passages = item.get("evidence_content_passages")
                if isinstance(content_passages, list):
                    content = " ".join(str(p or "").strip() for p in content_passages if str(p or "").strip())
                else:
                    content = ""
                if not content:
                    content = str(item.get("evidence_content_item") or item.get("evidence_snippet") or "").strip()
                pool.append(
                    {
                        "validation_state": "candidate",
                        "rank": 1,
                        "text": text,
                        "content": content,
                        "url": str(item.get("source_url") or "").strip(),
                        "subtype": str(item.get("step_type") or "").strip(),
                        "source": "candidate_eval",
                    }
                )
        evidence_ledger = discovery_payload.get("evidence_ledger")
        if isinstance(evidence_ledger, list):
            for item in evidence_ledger:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("statement") or item.get("text") or "").strip()
                content = str(item.get("content") or item.get("raw_text") or "").strip()
                if not text and not content:
                    continue
                validation_state = str(item.get("validation_state") or "candidate").strip().lower()
                pool.append(
                    {
                        "validation_state": validation_state if validation_state in {"validated", "provisional"} else "candidate",
                        "rank": self._discovery_signal_rank(validation_state),
                        "text": text or self._truncate_prompt_value(content, 220),
                        "content": content,
                        "url": str(item.get("url") or "").strip(),
                        "subtype": str(item.get("subtype") or item.get("reason_code") or "").strip(),
                        "source": "evidence_ledger",
                    }
                )
        kimi_batch_outputs = discovery_payload.get("kimi_batch_outputs")
        if isinstance(kimi_batch_outputs, list):
            for batch in kimi_batch_outputs:
                if not isinstance(batch, dict):
                    continue
                for signal in batch.get("signals_found") or []:
                    if not isinstance(signal, dict):
                        continue
                    text = str(signal.get("summary") or signal.get("text") or "").strip()
                    if not text:
                        continue
                    pool.append(
                        {
                            "validation_state": "candidate",
                            "rank": 1,
                            "text": text,
                            "content": text,
                            "url": str(signal.get("url") or "").strip(),
                            "subtype": str(signal.get("signal_type") or "batch_signal").strip(),
                            "source": "kimi_batch_output",
                        }
                    )
        return pool

    def _extract_leadership_from_json_payload(self, text: str) -> List[Dict[str, str]]:
        payload = self._extract_last_valid_json_block(text)
        if not isinstance(payload, dict):
            raw = str(text or "")
            marker = raw.find('"decision_makers"')
            if marker >= 0:
                start = raw.rfind("{", 0, marker)
                if start >= 0:
                    depth = 0
                    end: Optional[int] = None
                    for index, ch in enumerate(raw[start:], start=start):
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                            if depth == 0:
                                end = index + 1
                                break
                    if end:
                        candidate = raw[start:end]
                        try:
                            parsed = json.loads(candidate)
                            if isinstance(parsed, dict):
                                payload = parsed
                        except Exception:
                            pass
        if not isinstance(payload, dict):
            return []
        people = payload.get("decision_makers")
        if not isinstance(people, list):
            return []
        extracted: List[Dict[str, str]] = []
        for person in people:
            if not isinstance(person, dict):
                continue
            name = str(person.get("name") or "").strip()
            role = str(person.get("role") or person.get("title") or "").strip()
            linkedin = str(person.get("linkedin_url") or person.get("linkedin") or "").strip()
            if not name:
                continue
            extracted.append({"name": name, "role": role, "linkedin_url": linkedin})
        return extracted

    def _extract_leadership_from_text(self, text: str) -> List[Dict[str, str]]:
        normalized = str(text or "").strip()
        if not normalized:
            return []
        leadership: List[Dict[str, str]] = []
        patterns = (
            re.compile(
                r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-,:]\s*(Chief[^.,;\n]{0,80}|Head of[^.,;\n]{0,80}|Director[^.,;\n]{0,80}|CEO[^.,;\n]{0,80})\b"
            ),
            re.compile(
                r"\b(Chief[^.,;\n]{0,80}|Head of[^.,;\n]{0,80}|Director[^.,;\n]{0,80}|CEO[^.,;\n]{0,80})\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b"
            ),
        )
        for pattern in patterns:
            for match in pattern.findall(normalized):
                if len(match) < 2:
                    continue
                first, second = str(match[0]).strip(), str(match[1]).strip()
                if pattern is patterns[0]:
                    name, role = first, second
                else:
                    role, name = first, second
                if len(name.split()) < 2:
                    continue
                leadership.append({"name": name, "role": role, "linkedin_url": ""})
        deduped: List[Dict[str, str]] = []
        seen: set[str] = set()
        for person in leadership:
            key = str(person.get("name") or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(person)
        return deduped

    def _extract_recent_news_from_pool(self, signal_pool: List[Dict[str, Any]], *, entity_name: str = "") -> List[Dict[str, Any]]:
        candidates: List[Dict[str, Any]] = []
        entity_tokens = [
            token
            for token in re.findall(r"[a-z0-9]+", str(entity_name or "").lower())
            if token and token not in {"fc", "football", "club"}
        ]
        for item in signal_pool:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            text = str(item.get("text") or "").strip()
            content = str(item.get("content") or "").strip()
            subtype = str(item.get("subtype") or "").strip().lower()
            if not text:
                continue
            grounding_blob = " ".join([text.lower(), content.lower(), url.lower()])
            if entity_tokens and not all(token in grounding_blob for token in entity_tokens[:2]):
                continue
            if not (
                any(token in subtype for token in ("news", "press", "partnership", "official"))
                or any(token in url.lower() for token in ("/news", "/press", "announcement", "media"))
            ):
                continue
            host = (urlparse(url).hostname or "").lower().lstrip("www.") if url else "unknown-source"
            date_match = re.search(
                r"\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2})\b",
                " ".join([text, content]),
            )
            headline = text.split(":")[0].strip()[:160]
            if len(headline) < 8:
                headline = text[:160]
            candidates.append(
                {
                    "headline": headline,
                    "summary": (content or text)[:260],
                    "source_site": host,
                    "publication_date": date_match.group(0) if date_match else None,
                    "validation_state": str(item.get("validation_state") or "candidate").strip().lower(),
                    "rank": int(item.get("rank") or 1),
                    "url": url,
                }
            )
        deduped: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for item in sorted(candidates, key=lambda row: (int(row.get("rank") or 1), bool(row.get("publication_date"))), reverse=True):
            key = f"{str(item.get('headline') or '').strip().lower()}|{str(item.get('source_site') or '').strip().lower()}"
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= 6:
                break
        return deduped

    def enrich_dossier_with_discovery_evidence(
        self,
        *,
        dossier_payload: Dict[str, Any],
        discovery_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        payload = dict(dossier_payload or {})
        sections = payload.get("sections")
        if not isinstance(sections, list):
            return payload

        signal_pool = self._build_discovery_signal_pool(discovery_payload)
        if not signal_pool:
            return payload

        leadership_candidates: List[Dict[str, Any]] = []
        for item in signal_pool:
            text_blob = " ".join(
                [str(item.get("text") or "").strip(), str(item.get("content") or "").strip()]
            ).strip()
            if not text_blob:
                continue
            extracted = self._extract_leadership_from_json_payload(text_blob)
            if not extracted:
                extracted = self._extract_leadership_from_text(text_blob)
            for person in extracted:
                leadership_candidates.append(
                    {
                        **person,
                        "validation_state": str(item.get("validation_state") or "candidate").strip().lower(),
                        "rank": int(item.get("rank") or 1),
                    }
                )

        deduped_leadership: List[Dict[str, Any]] = []
        seen_people: set[str] = set()
        for person in sorted(leadership_candidates, key=lambda row: int(row.get("rank") or 1), reverse=True):
            key = str(person.get("name") or "").strip().lower()
            if not key or key in seen_people:
                continue
            seen_people.add(key)
            deduped_leadership.append(person)
            if len(deduped_leadership) >= 6:
                break

        metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
        entity_name = str(payload.get("entity_name") or metadata.get("entity_name") or "").strip()
        recent_news = self._extract_recent_news_from_pool(signal_pool, entity_name=entity_name)
        prioritized_signal_pool = sorted(
            signal_pool,
            key=lambda row: (
                self._discovery_signal_rank(str(row.get("validation_state") or "candidate")),
                int(row.get("rank") or 1),
            ),
            reverse=True,
        )
        for section in sections:
            if not isinstance(section, dict):
                continue
            section_id = str(section.get("id") or "").strip().lower()
            if section_id == "leadership" and deduped_leadership:
                content: List[str] = []
                validated_count = 0
                for person in deduped_leadership:
                    prefix = ""
                    state = str(person.get("validation_state") or "candidate").strip().lower()
                    if state == "validated":
                        validated_count += 1
                    elif state == "provisional":
                        prefix = "[Unvalidated] "
                    else:
                        prefix = "[Unvalidated Candidate] "
                    snippet = f"{prefix}{person.get('name')} - {person.get('role') or 'Role unknown'}"
                    if str(person.get("linkedin_url") or "").strip():
                        snippet = f"{snippet} ({person.get('linkedin_url')})"
                    content.append(snippet)
                section["content"] = content[:6]
                section["metrics"] = [f"Decision makers identified: {len(deduped_leadership)}"]
                if validated_count > 0:
                    section["output_status"] = "completed_evidence_led"
                    section["reason_code"] = None
                    section["confidence"] = max(0.66, float(section.get("confidence") or 0.66))
                else:
                    section["output_status"] = "completed_with_sparse_fallback"
                    section["reason_code"] = "leadership_unvalidated_only"
                    section["confidence"] = 0.56
            elif section_id == "leadership" and evidence_available:
                section["output_status"] = "degraded_sparse_evidence"
                section["reason_code"] = "leadership_evidence_not_consumed"
                section["confidence"] = min(0.5, float(section.get("confidence") or 0.5))
            if section_id == "recent_news" and recent_news:
                content = []
                validated_news = 0
                for item in recent_news[:5]:
                    state = str(item.get("validation_state") or "candidate").strip().lower()
                    prefix = ""
                    if state == "validated":
                        validated_news += 1
                    elif state == "provisional":
                        prefix = "[Unvalidated] "
                    else:
                        prefix = "[Unvalidated Candidate] "
                    date_fragment = f", {item['publication_date']}" if item.get("publication_date") else ""
                    content.append(
                        f"{prefix}{item.get('headline')} ({item.get('source_site')}{date_fragment}): {str(item.get('summary') or '')[:180]}"
                    )
                section["content"] = content
                section["metrics"] = [f"News items captured: {len(recent_news)}"]
                if validated_news > 0:
                    section["output_status"] = "completed_evidence_led"
                    section["reason_code"] = None
                    section["confidence"] = max(0.62, float(section.get("confidence") or 0.62))
                else:
                    section["output_status"] = "completed_with_sparse_fallback"
                    section["reason_code"] = "recent_news_unvalidated_only"
                    section["confidence"] = 0.55
            elif section_id == "recent_news" and evidence_available:
                section["output_status"] = "degraded_sparse_evidence"
                section["reason_code"] = "recent_news_evidence_not_consumed"
                section["confidence"] = min(0.52, float(section.get("confidence") or 0.52))
            if section_id == "outreach_strategy":
                anchors: List[str] = []
                for item in prioritized_signal_pool[:3]:
                    if not isinstance(item, dict):
                        continue
                    url = str(item.get("url") or "").strip()
                    text = str(item.get("text") or item.get("content") or "").strip()
                    if not text and not url:
                        continue
                    anchor = self._truncate_prompt_value(text, 150) if text else url
                    if url:
                        anchor = f"{anchor} [{url}]"
                    anchors.append(anchor)
                if anchors:
                    section["content"] = [
                        f"Primary evidence anchor: {anchors[0]}",
                        "Sequence outreach in three steps: context proof, capability mapping, and low-friction pilot ask.",
                        "Every message should cite one explicit discovery anchor before making a capability claim.",
                    ]
                    section["recommendations"] = [
                        f"Use anchored evidence in opening outreach: {anchors[0]}",
                        f"Secondary proof point: {anchors[1]}" if len(anchors) > 1 else "Gather one more entity-grounded proof point before broad outreach.",
                    ]
                    has_validated_anchor = any(
                        str(item.get("validation_state") or "").strip().lower() == "validated"
                        for item in prioritized_signal_pool[:3]
                        if isinstance(item, dict)
                    )
                    section["output_status"] = "completed_evidence_led" if has_validated_anchor else "completed_with_sparse_fallback"
                    section["reason_code"] = None if has_validated_anchor else "outreach_unvalidated_anchors"
                    section["confidence"] = max(0.58, float(section.get("confidence") or 0.58))
                elif evidence_available:
                    section["output_status"] = "degraded_sparse_evidence"
                    section["reason_code"] = "outreach_evidence_not_consumed"
                    section["confidence"] = min(0.5, float(section.get("confidence") or 0.5))

        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            payload["metadata"] = metadata
        metadata["discovery_enrichment"] = {
            "validated_signals": len(discovery_payload.get("signals_discovered") or []),
            "provisional_signals": len(discovery_payload.get("provisional_signals") or []),
            "candidate_events": len(discovery_payload.get("candidate_evaluations") or []),
            "candidate_events_summary": dict(discovery_payload.get("candidate_events_summary") or {}),
            "lane_failures": dict(discovery_payload.get("lane_failures") or {}),
        }
        return payload

    def _build_field_extraction_results(
        self,
        *,
        entity_id: str,
        entity_name: str,
        entity_data: Dict[str, Any],
        dossier: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        canonical_sources = self._derive_canonical_sources(entity_data)
        source_url = canonical_sources.get("official_site") or canonical_sources.get("press")
        source_tier = "tier_1" if source_url else "tier_2"

        def _field_record(
            section_id: str,
            field_name: str,
            value: Any,
            value_type: str,
            *,
            required: bool = False,
            reason_code: str = "validated",
        ) -> Dict[str, Any]:
            value_text = json.dumps(value, ensure_ascii=True) if isinstance(value, (dict, list)) else str(value or "")
            grounding_passed = bool(value_text.strip())
            status = "validated" if grounding_passed else "rejected"
            content_hash = (
                hashlib.sha1(value_text.encode("utf-8", errors="ignore")).hexdigest() if value_text.strip() else None
            )
            evidence_pointer_ids = [f"ev:{content_hash[:16]}"] if content_hash else []
            return {
                "step_type": "dossier_field_extraction",
                "field_id": f"{section_id}.{field_name}",
                "section_id": section_id,
                "field_name": field_name,
                "required": bool(required),
                "value_type": value_type,
                "status": status,
                "reason_code": reason_code if grounding_passed else "missing_or_ungrounded",
                "value": value,
                "evidence_snippet": value_text[:240],
                "source_url": source_url,
                "source_tier": source_tier,
                "content_hash": content_hash,
                "grounding_passed": grounding_passed,
                "parse_path": "dossier_field_contract_v1",
                "model_used": "deterministic",
                "schema_valid": True,
                "evidence_pointer_ids": evidence_pointer_ids,
                "entity_id": entity_id,
                "entity_name": entity_name,
            }

        opportunities = (dossier.get("procurement_signals") or {}).get("upcoming_opportunities") or []
        leadership = (dossier.get("leadership_analysis") or {}).get("decision_makers") or []
        return [
            _field_record(
                "core_information",
                "entity_type",
                entity_data.get("entity_type") or dossier.get("metadata", {}).get("entity_type"),
                "string",
                required=True,
            ),
            _field_record(
                "core_information",
                "country",
                entity_data.get("country") or entity_data.get("entity_country"),
                "string",
            ),
            _field_record(
                "core_information",
                "website",
                entity_data.get("website") or entity_data.get("official_site_url"),
                "url",
                required=True,
            ),
            _field_record(
                "leadership",
                "decision_maker_count",
                len(leadership),
                "integer",
            ),
            _field_record(
                "leadership",
                "decision_maker_names",
                [str(item.get("name") or "") for item in leadership if isinstance(item, dict)],
                "string_array",
            ),
            _field_record(
                "procurement_signals",
                "upcoming_opportunity_count",
                len(opportunities),
                "integer",
            ),
            _field_record(
                "procurement_signals",
                "top_opportunity",
                (opportunities[0] if opportunities else {}),
                "object",
                reason_code="validated" if opportunities else "no_opportunity_detected",
            ),
            _field_record(
                "recent_news",
                "news_item_count",
                int(len(entity_data.get("news_items") or [])),
                "integer",
            ),
        ]

    async def generate_universal_dossier(
        self,
        entity_id: str,
        entity_name: str,
        entity_type: str = "CLUB",
        priority_score: int = 50,
        entity_data: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[..., Awaitable[None]]] = None,
        run_objective: Optional[str] = None,
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
        objective = normalize_run_objective(run_objective, default=DEFAULT_DOSSIER_OBJECTIVE)
        objective_profile = get_objective_profile(objective, default=DEFAULT_DOSSIER_OBJECTIVE)
        if run_objective is None:
            enable_leadership_enrichment = True
            enable_question_extraction = True
        else:
            enable_leadership_enrichment = bool(objective_profile.get("enable_leadership_enrichment", False))
            enable_question_extraction = bool(objective_profile.get("enable_question_extraction", False))

        # Determine tier
        tier = self._determine_tier(priority_score)
        logger.info(f"📊 Generating {tier} dossier for {entity_name} (priority: {priority_score})")
        phase0_collection_timed_out = bool(entity_data and entity_data.get("collection_timed_out"))
        collection_started_at = datetime.now(timezone.utc)
        collection_duration_seconds: Optional[float] = None

        claude_disabled_reason = None
        if getattr(self.claude_client, "_get_disabled_reason", None):
            claude_disabled_reason = self.claude_client._get_disabled_reason()

        if claude_disabled_reason and entity_data is None:
            logger.warning(
                f"⚠️ Claude API disabled ({claude_disabled_reason}); skipping data collection and returning minimal dossier for {entity_name}"
            )
            dossier = self._create_minimal_dossier(entity_name)
            dossier["metadata"]["entity_id"] = entity_id
            dossier["metadata"]["entity_name"] = entity_name
            dossier["metadata"]["generated_at"] = start_time.isoformat()
            dossier["metadata"]["tier"] = tier
            dossier["metadata"]["priority_score"] = priority_score
            dossier["metadata"]["hypothesis_count"] = 0
            dossier["metadata"]["signal_count"] = 0
            dossier["generation_time_seconds"] = (datetime.now(timezone.utc) - start_time).total_seconds()
            dossier["extracted_hypotheses"] = []
            dossier["extracted_signals"] = []
            return dossier

        # Collect entity data if not provided
        if entity_data is None and DATA_COLLECTOR_AVAILABLE:
            if progress_callback:
                await progress_callback("collect_entity_data", "running")
            collector = DossierDataCollector()
            collection_timeout_seconds = int(os.getenv("DOSSIER_COLLECTION_TIMEOUT_SECONDS", "180"))
            try:
                try:
                    dossier_data_obj = await asyncio.wait_for(
                        collector.collect_all(
                            entity_id,
                            entity_name,
                            entity_type=entity_type,
                            run_objective=objective,
                        ),
                        timeout=collection_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "⚠️ collect_entity_data timed out for %s after %ss; continuing with minimal data",
                        entity_id,
                        collection_timeout_seconds,
                    )
                    entity_data = {
                        "entity_id": entity_id,
                        "entity_name": entity_name,
                        "entity_type": entity_type,
                    }
                    if progress_callback:
                        await progress_callback(
                            "collect_entity_data",
                            "failed",
                            reason="timeout",
                            timeout_seconds=collection_timeout_seconds,
                        )
                    dossier_data_obj = None
                collection_duration_seconds = round(
                    (datetime.now(timezone.utc) - collection_started_at).total_seconds(),
                    2,
                )
                if dossier_data_obj is None:
                    phase0_collection_timed_out = True
                    entity_data = {
                        "entity_id": entity_id,
                        "entity_name": entity_name,
                        "entity_type": entity_type,
                        "collection_timed_out": True,
                    }
                else:
                    entity_data = self._dossier_data_to_dict(dossier_data_obj)
                    if progress_callback:
                        await progress_callback(
                            "collect_entity_data",
                            "completed",
                            source_count=int(entity_data.get("source_count") or 0),
                            source_timings=entity_data.get("source_timings") or {},
                        )
                    # PHASE 0 ENHANCEMENT: Collect real leadership data
                    if (
                        enable_leadership_enrichment
                        and hasattr(collector, "collect_leadership")
                        and not claude_disabled_reason
                    ):
                        try:
                            leadership_data = await collector.collect_leadership(entity_id, entity_name)
                            if leadership_data.get("decision_makers"):
                                entity_data["leadership_names"] = ", ".join(
                                    [
                                        dm.get("name", "")
                                        for dm in leadership_data.get("decision_makers", [])
                                        if dm.get("name") and dm.get("name") != "unknown"
                                    ]
                                )
                                entity_data["leadership_roles"] = ", ".join(
                                    [
                                        dm.get("role", "")
                                        for dm in leadership_data.get("decision_makers", [])
                                        if dm.get("role") and dm.get("role") != "unknown"
                                    ]
                                )
                                entity_data["leadership_linkedins"] = ", ".join(
                                    [
                                        dm.get("linkedin_url", "")
                                        for dm in leadership_data.get("decision_makers", [])
                                        if dm.get("linkedin_url")
                                    ]
                                )
                                entity_data["target_personnel_data"] = leadership_data.get("decision_makers", [])
                                logger.info(
                                    "✅ Collected %s leadership profiles",
                                    len(leadership_data.get("decision_makers", [])),
                                )
                        except Exception as e:
                            logger.warning(f"⚠️  Leadership data collection failed: {e}")
                    elif not enable_leadership_enrichment:
                        logger.info(
                            "⏭️ Skipping leadership enrichment for objective=%s (objective profile disabled)",
                            objective,
                        )
                    elif claude_disabled_reason:
                        logger.warning(
                            f"⚠️ Claude API disabled ({claude_disabled_reason}); skipping leadership enrichment for {entity_name}"
                        )
            finally:
                await collector.close()
        elif entity_data is None:
            # Fallback to minimal data
            entity_data = {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type
            }
            if progress_callback:
                await progress_callback("collect_entity_data", "skipped", reason="collector_unavailable")
        elif progress_callback:
            await progress_callback("collect_entity_data", "completed", source="preloaded_entity_data")

        # Select prompt based on tier
        generation_mode = "standard"
        max_tokens_override: Optional[int] = None
        if phase0_collection_timed_out:
            generation_mode = "compact_timeout_fallback"
            prompt_template = self.COMPACT_TIMEOUT_FALLBACK_PROMPT
            max_tokens_override = int(os.getenv("DOSSIER_COMPACT_MAX_TOKENS", "1200"))
        else:
            prompt_template = self._select_prompt_by_tier(tier)
        if progress_callback:
            await progress_callback(
                "generate_dossier_content",
                "running",
                generation_mode=generation_mode,
                model_max_tokens=max_tokens_override,
            )

        # Interpolate prompt with entity data
        interpolated_prompt = self._interpolate_prompt(prompt_template, entity_data)

        # Generate dossier using model cascade
        dossier = await self._generate_with_model_cascade(
            prompt=interpolated_prompt,
            entity_name=entity_name,
            tier=tier,
            max_tokens_override=max_tokens_override,
        )

        # Extract hypotheses and signals
        hypotheses = self._extract_hypotheses(dossier)
        signals = self._extract_signals(dossier)

        # Add metadata
        dossier["metadata"]["entity_id"] = entity_id
        dossier["metadata"]["entity_name"] = entity_name
        dossier["metadata"]["generated_at"] = start_time.isoformat()
        dossier["metadata"]["tier"] = tier
        dossier["metadata"]["priority_score"] = priority_score
        dossier["metadata"]["hypothesis_count"] = len(hypotheses)
        dossier["metadata"]["signal_count"] = len(signals)
        dossier["metadata"]["sources_used"] = list(entity_data.get("sources_used") or [])
        dossier["metadata"]["source_count"] = int(entity_data.get("source_count") or len(entity_data.get("sources_used") or []))
        dossier["metadata"]["collected_at"] = entity_data.get("collected_at")
        dossier["metadata"]["source_timings"] = entity_data.get("source_timings") or {}
        dossier["metadata"]["canonical_sources"] = self._derive_canonical_sources(entity_data)
        dossier["metadata"]["generation_mode"] = generation_mode
        dossier["metadata"]["collection_timed_out"] = bool(phase0_collection_timed_out)
        dossier["metadata"]["model_max_tokens"] = max_tokens_override
        dossier["metadata"]["run_objective"] = objective
        dossier["metadata"]["skipped_enrichment_reasons"] = []
        if not enable_leadership_enrichment:
            dossier["metadata"]["skipped_enrichment_reasons"].append("leadership_enrichment_disabled_by_objective")
        if not enable_question_extraction:
            dossier["metadata"]["skipped_enrichment_reasons"].append("question_extraction_disabled_by_objective")
        if collection_duration_seconds is not None:
            dossier["metadata"]["collection_time_seconds"] = collection_duration_seconds

        # Add core entity metadata from entity_data (scraped fields)
        if entity_data:
            core_fields = [
                "founded",
                "stadium",
                "capacity",
                "website",
                "employees",
                "hq",
                "headquarters",
                "entity_type",
                "sport",
                "country",
                "league_or_competition",
            ]
            for field in core_fields:
                if field in entity_data:
                    dossier["metadata"][field] = entity_data[field]

        # Attach hypotheses and signals
        dossier["extracted_hypotheses"] = hypotheses
        dossier["extracted_signals"] = signals
        field_extraction_results = self._build_field_extraction_results(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_data=entity_data,
            dossier=dossier,
        )
        validated_fields = [
            row for row in field_extraction_results
            if str(row.get("status") or "").strip().lower() == "validated"
        ]
        dossier["metadata"]["field_extraction_results"] = field_extraction_results
        dossier["metadata"]["field_extraction_summary"] = {
            "total_fields": len(field_extraction_results),
            "validated_fields": len(validated_fields),
            "rejected_fields": max(len(field_extraction_results) - len(validated_fields), 0),
        }
        dossier["metadata"]["section_synthesis"] = {
            "mode": "validated_fields_only",
            "validated_field_count": len(validated_fields),
            "placeholder_policy": "explicit_reason_codes",
        }
        persistence_context = apply_dossier_persistence_context(
            dossier,
            entity_id=entity_id,
            entity_name=entity_name,
            entity_data=entity_data,
            run_objective=objective,
        )
        dossier["metadata"].update(persistence_context)
        dossier["metadata"]["canonical_sources"] = dict(dossier["metadata"].get("canonical_sources") or {})
        dossier["metadata"]["canonical_sources"].setdefault("official_site", persistence_context["source_url"])

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
        if progress_callback:
            await progress_callback(
                "generate_dossier_content",
                "completed",
                hypothesis_count=len(hypotheses),
                signal_count=len(signals),
                generation_time_seconds=generation_time,
            )

        return dossier


# Example usage
async def main():
    """Example dossier generation"""
    from backend.claude_client import ClaudeClient

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
