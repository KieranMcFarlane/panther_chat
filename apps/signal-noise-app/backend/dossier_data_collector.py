#!/usr/bin/env python3
"""
Dossier Data Collector

Integrates multiple data sources for entity dossier generation:
- FalkorDB for entity metadata (name, sport, country, league, etc.)
- BrightData SDK for live web scraping (recent news, official site content)
- Hypothesis Manager for discovered signals (procurement patterns)

Usage:
    from dossier_data_collector import DossierDataCollector

    collector = DossierDataCollector()
    data = await collector.collect_all(entity_id="arsenal-fc", entity_name="Arsenal FC")
"""

import asyncio
import os
import logging
import time
import urllib.parse
import json
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path

# Load environment variables from .env (same pattern as graphiti_service.py)
project_root = Path(__file__).parent.parent
env_files = [
    project_root / '.env.local',
    project_root / '.env',
    Path('.env.local'),
    Path('.env')
]

for env_file in env_files:
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            break
        except ImportError:
            # Fallback: manual parsing
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip()
            break

logger = logging.getLogger(__name__)


# =============================================================================
# Data Structures
# =============================================================================

@dataclass
class EntityMetadata:
    """Entity metadata from FalkorDB"""
    entity_id: str
    entity_name: str
    entity_type: str  # CLUB, LEAGUE, VENUE, PERSON
    sport: Optional[str] = None
    country: Optional[str] = None
    league_or_competition: Optional[str] = None
    ownership_type: Optional[str] = None
    org_type: Optional[str] = None
    estimated_revenue_band: Optional[str] = None
    digital_maturity: Optional[str] = None
    description: Optional[str] = None

    # Additional properties from web scraping (Phase 2)
    founded: Optional[str] = None  # Year founded (e.g., "1886")
    stadium: Optional[str] = None  # Stadium/venue name
    capacity: Optional[str] = None  # Stadium capacity
    website: Optional[str] = None  # Official website URL
    employees: Optional[str] = None  # Employee count

    # Metadata about source
    data_source: str = "FalkorDB"
    retrieved_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ScrapedContent:
    """Content scraped from web sources"""
    url: str
    source_type: str  # OFFICIAL_SITE, CAREERS_PAGE, PRESS_RELEASE, etc.
    title: Optional[str] = None
    content: str = ""
    markdown_content: str = ""
    published_at: Optional[datetime] = None
    scraped_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    word_count: int = 0


@dataclass
class HypothesisSignal:
    """Signal discovered by Hypothesis Manager"""
    hypothesis_id: str
    category: str
    statement: str
    confidence: float
    status: str  # ACTIVE, PROMOTED, DEGRADED, SATURATED
    evidence_count: int
    discovered_at: datetime
    last_evidence: Optional[str] = None

    # Metadata
    reinforced_count: int = 0
    iterations_attempted: int = 0


@dataclass
class DossierData:
    """Complete data package for dossier generation"""
    entity_id: str
    entity_name: str

    # Data sources
    metadata: Optional[EntityMetadata] = None
    scraped_content: List[ScrapedContent] = field(default_factory=list)
    hypothesis_signals: List[HypothesisSignal] = field(default_factory=list)

    # Collection metadata
    collected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data_sources_used: List[str] = field(default_factory=list)
    source_timings: Dict[str, Dict[str, Any]] = field(default_factory=dict)


# =============================================================================
# Data Collector Implementation
# =============================================================================

class DossierDataCollector:
    """
    Collect entity data from multiple sources for dossier generation

    Uses same .env loading pattern as graphiti_service.py for consistency.
    """

    def __init__(self, falkordb_client=None, brightdata_client=None, hypothesis_manager=None):
        """
        Initialize data collector

        Args:
            falkordb_client: Optional FalkorDB client (will create if None)
            brightdata_client: Optional BrightData SDK client (will create if None)
            hypothesis_manager: Optional HypothesisManager (will create if None)
        """
        self.falkordb_client = falkordb_client
        self.brightdata_client = brightdata_client
        self.hypothesis_manager = hypothesis_manager

        self._falkordb_connected = False
        self._brightdata_available = False
        self._hypothesis_available = False
        self.source_timeout_seconds = float(os.getenv("DOSSIER_SOURCE_TIMEOUT_SECONDS", "20"))
        self.connect_timeout_seconds = float(os.getenv("DOSSIER_CONNECT_TIMEOUT_SECONDS", "6"))
        self._falkordb_connect_attempted = False
        self._brightdata_connect_attempted = False
        self._brightdata_connect_probe_enabled = self._parse_bool_env(
            os.getenv("DOSSIER_BRIGHTDATA_CONNECT_PROBE"),
            default=False,
        )
        self._preferred_official_site_urls: Dict[str, str] = {}
        self._official_site_url_cache = self._load_official_site_url_cache()
        self._official_site_content_cache = self._load_official_site_content_cache()

    @staticmethod
    def _parse_bool_env(value: Optional[str], *, default: bool) -> bool:
        if value is None:
            return default
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        return default

    def _official_site_cache_file(self) -> Path:
        cache_path = os.getenv(
            "DOSSIER_OFFICIAL_SITE_CACHE_PATH",
            "backend/data/dossiers/official_site_cache.json",
        )
        path = Path(cache_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / cache_path
        return path

    def _official_site_content_cache_file(self) -> Path:
        cache_path = os.getenv(
            "DOSSIER_OFFICIAL_SITE_CONTENT_CACHE_PATH",
            "backend/data/dossiers/official_site_content_cache.json",
        )
        path = Path(cache_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent.parent / cache_path
        return path

    def _normalize_official_site_cache_key(self, entity_name: str) -> str:
        return " ".join((entity_name or "").strip().lower().split())

    def _normalize_http_url(self, candidate: Optional[str]) -> Optional[str]:
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

    def _load_official_site_url_cache(self) -> Dict[str, str]:
        cache_file = self._official_site_cache_file()
        try:
            if not cache_file.exists():
                return {}
            raw = json.loads(cache_file.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return {}
            cache: Dict[str, str] = {}
            for key, value in raw.items():
                if isinstance(key, str) and isinstance(value, str) and value.strip():
                    cache[self._normalize_official_site_cache_key(key)] = value.strip()
            return cache
        except Exception as error:  # noqa: BLE001
            logger.debug("Failed loading official-site cache %s: %s", cache_file, error)
            return {}

    def _load_official_site_content_cache(self) -> Dict[str, Dict[str, Any]]:
        cache_file = self._official_site_content_cache_file()
        try:
            if not cache_file.exists():
                return {}
            raw = json.loads(cache_file.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return {}
            cache: Dict[str, Dict[str, Any]] = {}
            for key, value in raw.items():
                if isinstance(key, str) and isinstance(value, dict):
                    content = value.get("content")
                    url = value.get("url")
                    if isinstance(content, str) and content.strip() and isinstance(url, str) and url.strip():
                        cache[key] = value
            return cache
        except Exception as error:  # noqa: BLE001
            logger.debug("Failed loading official-site content cache %s: %s", cache_file, error)
            return {}

    def _get_cached_official_site_url(self, entity_name: str) -> Optional[str]:
        key = self._normalize_official_site_cache_key(entity_name)
        if not key:
            return None
        value = self._official_site_url_cache.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def _store_cached_official_site_url(self, entity_name: str, url: str) -> None:
        normalized_url = self._normalize_http_url(url)
        key = self._normalize_official_site_cache_key(entity_name)
        if not key or not normalized_url:
            return

        self._official_site_url_cache[key] = normalized_url

        cache_file = self._official_site_cache_file()
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(
                json.dumps(self._official_site_url_cache, indent=2, sort_keys=True),
                encoding="utf-8",
            )
        except Exception as error:  # noqa: BLE001
            logger.debug("Failed persisting official-site cache %s: %s", cache_file, error)

    def seed_official_site_url(
        self,
        entity_name: str,
        url: str,
        *,
        persist_cache: bool = True,
    ) -> Optional[str]:
        normalized_url = self._normalize_http_url(url)
        key = self._normalize_official_site_cache_key(entity_name)
        if not key or not normalized_url:
            return None

        self._preferred_official_site_urls[key] = normalized_url
        if persist_cache:
            self._store_cached_official_site_url(entity_name, normalized_url)
        return normalized_url

    def _get_preferred_official_site_url(self, entity_name: str) -> Optional[str]:
        key = self._normalize_official_site_cache_key(entity_name)
        if not key:
            return None
        value = self._preferred_official_site_urls.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None

    def _official_site_content_cache_key(self, entity_name: str, url: str) -> str:
        parsed = urllib.parse.urlparse(str(url or "").strip())
        host = parsed.netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        entity_key = self._normalize_official_site_cache_key(entity_name)
        return f"{entity_key}|{host}"

    def _store_cached_official_site_content(self, entity_name: str, url: str, scrape_result: Dict[str, Any]) -> None:
        content = str(scrape_result.get("content") or "").strip()
        normalized_url = str(url or "").strip()
        if not content or not normalized_url:
            return
        key = self._official_site_content_cache_key(entity_name, normalized_url)
        if not key:
            return

        metadata = scrape_result.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
        snapshot = {
            "url": normalized_url,
            "content": content[:50000],
            "metadata": metadata,
            "publication_date": scrape_result.get("publication_date"),
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }
        self._official_site_content_cache[key] = snapshot

        cache_file = self._official_site_content_cache_file()
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(
                json.dumps(self._official_site_content_cache, indent=2, sort_keys=True),
                encoding="utf-8",
            )
        except Exception as error:  # noqa: BLE001
            logger.debug("Failed persisting official-site content cache %s: %s", cache_file, error)

    def _get_cached_official_site_content(self, entity_name: str, url: str) -> Optional[Dict[str, Any]]:
        key = self._official_site_content_cache_key(entity_name, url)
        snapshot = self._official_site_content_cache.get(key)
        if not isinstance(snapshot, dict):
            return None
        content = snapshot.get("content")
        cached_url = snapshot.get("url")
        if not isinstance(content, str) or not content.strip() or not isinstance(cached_url, str) or not cached_url.strip():
            return None
        metadata = snapshot.get("metadata") if isinstance(snapshot.get("metadata"), dict) else {}
        return {
            "status": "success",
            "url": cached_url,
            "content": content,
            "publication_date": snapshot.get("publication_date"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                **metadata,
                "source": "official_site_content_cache",
                "cached_snapshot": True,
                "cached_at": snapshot.get("cached_at"),
            },
        }

    def _official_site_fallback_urls(self, official_url: str) -> List[str]:
        parsed = urllib.parse.urlparse(official_url)
        if not parsed.scheme or not parsed.netloc:
            return []

        root = f"{parsed.scheme}://{parsed.netloc}"
        candidates = [
            root,
            urllib.parse.urljoin(root + "/", "news"),
            urllib.parse.urljoin(root + "/", "about"),
            urllib.parse.urljoin(root + "/", "club"),
            urllib.parse.urljoin(root + "/", "latest-news"),
        ]
        primary = official_url.rstrip("/")
        unique: List[str] = []
        for candidate in candidates:
            candidate = candidate.rstrip("/")
            if not candidate or candidate == primary or candidate in unique:
                continue
            unique.append(candidate)
        return unique

    async def _scrape_official_url_with_fallback(
        self,
        entity_name: str,
        official_url: str,
    ) -> tuple[str, Dict[str, Any], str]:
        if not self.brightdata_client:
            return official_url, {"status": "error", "error": "BrightData client unavailable"}, "none"

        attempt_urls = [official_url.rstrip("/")] + self._official_site_fallback_urls(official_url)
        last_result: Dict[str, Any] = {"status": "error", "error": "No scrape attempts executed"}
        selected_url = official_url.rstrip("/")

        for idx, candidate_url in enumerate(attempt_urls):
            selected_url = candidate_url
            scrape_result = await self.brightdata_client.scrape_as_markdown(candidate_url)
            if not isinstance(scrape_result, dict):
                last_result = {"status": "error", "error": "Invalid scrape payload"}
                continue

            last_result = scrape_result
            content = str(scrape_result.get("content") or "").strip()
            if scrape_result.get("status") == "success" and content:
                if idx > 0:
                    logger.info("♻️ Official-site scrape recovered content via fallback URL: %s", candidate_url)
                self._store_cached_official_site_content(entity_name, candidate_url, scrape_result)
                return candidate_url, scrape_result, ("subpath" if idx > 0 else "live")

        cached_snapshot = self._get_cached_official_site_content(entity_name, official_url)
        if cached_snapshot is not None:
            cached_url = str(cached_snapshot.get("url") or official_url)
            logger.info(
                "♻️ Reusing cached official-site content snapshot for %s from %s",
                entity_name,
                cached_url,
            )
            return cached_url, cached_snapshot, "cached_snapshot"

        return selected_url, last_result, "none"

    def _choose_official_site_url(self, entity_name: str, results: List[Dict[str, Any]]) -> str:
        """Choose the best official-site candidate while demoting ecommerce domains."""
        if not results:
            return ""

        compact_name = "".join(ch for ch in entity_name.lower() if ch.isalnum())
        entity_tokens = [
            token
            for token in entity_name.lower().replace("&", " ").replace("-", " ").split()
            if len(token) >= 3 and token not in {"the", "club", "football", "fc", "cf", "afc"}
        ]
        blocked_domains = ("wikipedia.org", "espn.com", "facebook.com", "linkedin.com", "twitter.com", "x.com")
        ecommerce_terms = ("store", "shop", "ticket", "tickets", "merch", "retail")

        best_url = ""
        best_score = float("-inf")
        for idx, result in enumerate(results[:5]):
            url = str(result.get("url") or "").strip()
            if not url:
                continue

            lowered_url = url.lower()
            title = str(result.get("title") or "").lower()
            snippet = str(result.get("snippet") or "").lower()
            text = f"{lowered_url} {title} {snippet}"
            parsed_url = urllib.parse.urlparse(url)
            host = parsed_url.netloc.lower()
            if host.startswith("www."):
                host = host[4:]
            path = (parsed_url.path or "").strip("/")
            host_tokens = [token for token in re.split(r"[^a-z0-9]+", host) if token]

            score = 0.0
            if compact_name and compact_name in "".join(ch for ch in lowered_url if ch.isalnum()):
                score += 4.0
            score += min(sum(1 for token in entity_tokens if token in text), 3)
            if "official" in title or "official" in snippet:
                score += 3.0
            if host.endswith((".co.uk", ".com", ".org")):
                score += 1.0
            if any(domain in host for domain in blocked_domains):
                score -= 8.0
            if any(term in text for term in ecommerce_terms):
                score -= 5.0
            # Domain-level commerce indicators are much stronger than snippet words.
            if any(term in host_tokens for term in ecommerce_terms):
                score -= 9.0
            # Prefer root/home pages over deep content routes when selecting an official site.
            if not path:
                score += 1.5
            else:
                first_segment = path.split("/", 1)[0]
                score -= min(len(path.split("/")), 3) * 0.6
                if first_segment in {"news", "blog", "press", "updates", "fixtures", "results"}:
                    score -= 1.0
            score -= idx * 0.1

            if score > best_score:
                best_score = score
                best_url = url

        if best_url:
            return best_url
        return str(results[0].get("url") or "").strip()

    async def _connect_falkordb(self):
        """Connect to FalkorDB using native Python client"""
        if self._falkordb_connected:
            return True
        if self._falkordb_connect_attempted:
            return False
        self._falkordb_connect_attempted = True

        try:
            from falkordb import FalkorDB

            # Load from environment (already loaded in module header)
            uri = os.getenv("FALKORDB_URI")
            username = os.getenv("FALKORDB_USER", "falkordb")
            password = os.getenv("FALKORDB_PASSWORD")
            database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

            if not uri:
                logger.warning("⚠️ FALKORDB_URI not set - FalkorDB integration disabled")
                return False

            # Parse host and port from URI
            parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
            host = parsed.hostname or "localhost"
            port = parsed.port or 6379
            parsed_scheme = urllib.parse.urlparse(uri).scheme.lower()
            use_ssl = parsed_scheme == "rediss"
            ssl_override = os.getenv("FALKORDB_SSL")
            if isinstance(ssl_override, str) and ssl_override.strip():
                normalized_override = ssl_override.strip().lower()
                if normalized_override in {"1", "true", "yes", "on"}:
                    use_ssl = True
                elif normalized_override in {"0", "false", "no", "off"}:
                    use_ssl = False

            logger.info(f"🔗 Connecting to FalkorDB at {host}:{port}...")

            def _connect_and_test():
                client = FalkorDB(
                    host=host,
                    port=port,
                    username=username,
                    password=password,
                    ssl=use_ssl,
                )
                g = client.select_graph(database)
                g.query("RETURN 1 AS test")
                return client

            self.falkordb_client = await asyncio.wait_for(
                asyncio.to_thread(_connect_and_test),
                timeout=self.connect_timeout_seconds,
            )

            self._falkordb_connected = True
            logger.info("✅ FalkorDB connected")
            return True

        except asyncio.TimeoutError:
            logger.error(
                "❌ FalkorDB connection timed out after %.1fs",
                self.connect_timeout_seconds,
            )
            return False
        except ImportError:
            logger.warning("⚠️ falkordb not installed - FalkorDB integration disabled")
            return False
        except Exception as e:
            logger.error(f"❌ FalkorDB connection failed: {e}")
            return False

    async def collect_all(self, entity_id: str, entity_name: str = None, entity_type: str = "CLUB") -> DossierData:
        """
        Collect all available data for dossier generation

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            DossierData with all collected information
        """
        logger.info(f"🔍 Collecting dossier data for {entity_name or entity_id}")

        collect_started_at = time.perf_counter()

        # Connect to all data sources
        connect_falkordb_started_at = time.perf_counter()
        await self._connect_falkordb()
        connect_falkordb_duration = round(time.perf_counter() - connect_falkordb_started_at, 3)

        connect_brightdata_started_at = time.perf_counter()
        await self._connect_brightdata()
        connect_brightdata_duration = round(time.perf_counter() - connect_brightdata_started_at, 3)

        dossier_data = DossierData(
            entity_id=entity_id,
            entity_name=entity_name or entity_id.replace("-", " ").title()
        )
        dossier_data.source_timings["connect_falkordb"] = {
            "duration_seconds": connect_falkordb_duration,
            "status": "success" if self._falkordb_connected else "skipped",
        }
        dossier_data.source_timings["connect_brightdata"] = {
            "duration_seconds": connect_brightdata_duration,
            "status": "success" if self._brightdata_available else "skipped",
        }

        # Collect entity metadata from FalkorDB
        if self._falkordb_connected:
            metadata_started_at = time.perf_counter()
            metadata = await self._get_entity_metadata(entity_id)
            dossier_data.source_timings["falkordb_metadata"] = {
                "duration_seconds": round(time.perf_counter() - metadata_started_at, 3),
                "status": "success" if metadata else "empty",
            }
            if metadata:
                dossier_data.metadata = metadata
                dossier_data.data_sources_used.append("FalkorDB")
        else:
            # Create basic metadata if FalkorDB unavailable
            logger.info("📝 Creating basic metadata (FalkorDB unavailable)")
            dossier_data.metadata = EntityMetadata(
                entity_id=entity_id,
                entity_name=entity_name or entity_id.replace("-", " ").title(),
                entity_type=entity_type,
                data_source="Generated"
            )

        # Scrape additional data from web (Phase 2)
        if self.brightdata_client and self._brightdata_available:
            scrape_started_at = time.perf_counter()
            scrape_result = await self._get_scraped_content(entity_id, dossier_data.entity_name)
            scrape_step_timings: Dict[str, Any] = {}
            if isinstance(scrape_result, tuple) and len(scrape_result) >= 3 and isinstance(scrape_result[2], dict):
                scrape_step_timings = scrape_result[2]
            dossier_data.source_timings["brightdata_scrape"] = {
                "duration_seconds": round(time.perf_counter() - scrape_started_at, 3),
                "status": "success" if scrape_result else "empty",
                "steps": scrape_step_timings,
            }

            if scrape_result:
                scraped_content = scrape_result[0]
                extracted_data = scrape_result[1]

                # Add scraped content to dossier
                dossier_data.scraped_content.append(scraped_content)
                dossier_data.data_sources_used.append("BrightData")

                # Update metadata with scraped properties
                if dossier_data.metadata and extracted_data:
                    if extracted_data.get('founded'):
                        dossier_data.metadata.founded = extracted_data['founded']
                    if extracted_data.get('stadium'):
                        dossier_data.metadata.stadium = extracted_data['stadium']
                    if extracted_data.get('capacity'):
                        dossier_data.metadata.capacity = extracted_data['capacity']
                    if extracted_data.get('website'):
                        dossier_data.metadata.website = extracted_data['website']
                    if extracted_data.get('employees'):
                        dossier_data.metadata.employees = extracted_data['employees']
                    if extracted_data.get('league'):
                        dossier_data.metadata.league_or_competition = extracted_data['league']
                    if extracted_data.get('country'):
                        dossier_data.metadata.country = extracted_data['country']

                    logger.info(f"✅ Enhanced metadata with BrightData data")

        dossier_data.source_timings["collect_all_total"] = {
            "duration_seconds": round(time.perf_counter() - collect_started_at, 3),
            "status": "success",
        }

        logger.info(f"✅ Collected data from {len(dossier_data.data_sources_used)} sources")
        return dossier_data

    async def _get_entity_metadata(self, entity_id: str) -> Optional[EntityMetadata]:
        """
        Get entity metadata from FalkorDB

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")

        Returns:
            EntityMetadata object or None if not found
        """
        if not self.falkordb_client or not self._falkordb_connected:
            logger.warning("No FalkorDB client available")
            return None

        try:
            database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")
            g = self.falkordb_client.select_graph(database)

            # Query entity metadata (matches schema from load_all_entities.py)
            cypher = """
            MATCH (e:Entity {entity_id: $entity_id})
            RETURN
                e.entity_id as entity_id,
                e.name as name,
                e.sport as sport,
                e.country as country,
                e.league_or_competition as league_or_competition,
                e.ownership_type as ownership_type,
                e.org_type as org_type,
                e.estimated_revenue_band as estimated_revenue_band,
                e.digital_maturity as digital_maturity,
                e.description as description
            """

            result = g.query(cypher, {"entity_id": entity_id})

            if result.result_set:
                row = result.result_set[0]
                return EntityMetadata(
                    entity_id=row[0] or entity_id,
                    entity_name=row[1] or entity_id.replace("-", " ").title(),
                    entity_type=row[7] or "CLUB",  # org_type
                    sport=row[2],
                    country=row[3],
                    league_or_competition=row[4],
                    ownership_type=row[5],
                    org_type=row[7],
                    estimated_revenue_band=row[6],
                    digital_maturity=row[8],
                    description=row[9]
                )
            else:
                logger.warning(f"⚠️ No metadata found for {entity_id} in FalkorDB")
                return None

        except Exception as e:
            logger.error(f"❌ FalkorDB metadata query failed: {e}")
            return None

    async def _connect_brightdata(self):
        """Initialize BrightData SDK client"""
        if self._brightdata_available:
            return True
        if self._brightdata_connect_attempted:
            return False
        self._brightdata_connect_attempted = True

        try:
            from brightdata_sdk_client import BrightDataSDKClient

            if not self.brightdata_client:
                self.brightdata_client = BrightDataSDKClient()

            if not self._brightdata_connect_probe_enabled:
                self._brightdata_available = self.brightdata_client is not None
                if self._brightdata_available:
                    logger.info("✅ BrightData SDK client ready (probe skipped)")
                return self._brightdata_available

            # Test connection with a simple search
            test_result = await asyncio.wait_for(
                self.brightdata_client.search_engine(
                    query="test",
                    engine="google",
                    num_results=1,
                ),
                timeout=self.connect_timeout_seconds,
            )

            if test_result.get('status') == 'success':
                self._brightdata_available = True
                logger.info("✅ BrightData SDK connected")
                return True
            else:
                logger.warning("⚠️ BrightData SDK test failed")
                return False

        except asyncio.TimeoutError:
            logger.error(
                "❌ BrightData connect probe timed out after %.1fs",
                self.connect_timeout_seconds,
            )
            return False
        except ImportError:
            logger.warning("⚠️ brightdata_sdk_client not installed - web scraping disabled")
            return False
        except Exception as e:
            logger.error(f"❌ BrightData SDK connection failed: {e}")
            return False

    async def _get_scraped_content(self, entity_id: str, entity_name: str) -> Optional[tuple[ScrapedContent, Dict[str, Any], Dict[str, Any]]]:
        """
        Scrape official website for entity details

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            ScrapedContent with entity details or None
        """
        if not self.brightdata_client:
            logger.warning("BrightData not available for scraping")
            return None

        try:
            step_timings: Dict[str, Any] = {}

            official_url = ""
            search_results: Dict[str, Any] = {"status": "seeded", "results": []}
            preferred_url = self._get_preferred_official_site_url(entity_name)
            if preferred_url:
                official_url = preferred_url
                step_timings["search"] = 0.0
                step_timings["url_select"] = 0.0
                step_timings["official_site_source"] = "seeded_preferred"
                logger.info("🎯 Using seeded official website for %s: %s", entity_name, official_url)
            else:
                # Step 1: Search for official website
                logger.info(f"🔍 Searching for official website: {entity_name}")
                search_started_at = time.perf_counter()
                search_results = await self.brightdata_client.search_engine(
                    query=f'"{entity_name}" official website',
                    engine="google",
                    num_results=5
                )
                step_timings["search"] = round(time.perf_counter() - search_started_at, 3)

                if search_results.get('status') == 'success':
                    results = search_results.get('results', [])
                    if results:
                        # Step 2: Find official website URL
                        url_select_started_at = time.perf_counter()
                        official_url = self._choose_official_site_url(entity_name, results)
                        step_timings["url_select"] = round(time.perf_counter() - url_select_started_at, 3)
                        if official_url:
                            self._store_cached_official_site_url(entity_name, official_url)

            if not official_url:
                official_url = self._get_cached_official_site_url(entity_name) or ""
                if official_url:
                    logger.info("♻️ Reusing cached official website URL for %s: %s", entity_name, official_url)

            if not official_url:
                if search_results.get('status') != 'success':
                    logger.warning(f"Search failed for {entity_name}")
                else:
                    logger.warning(f"No search results for {entity_name}")
                return None

            url_select_started_at = time.perf_counter()
            logger.info(f"✅ Found official website: {official_url}")
            step_timings["url_select"] = round(time.perf_counter() - url_select_started_at, 3)

            # Step 3: Scrape official website content
            logger.info(f"📄 Scraping content from {official_url}")
            scrape_started_at = time.perf_counter()
            scraped_url, scrape_result, content_source = await self._scrape_official_url_with_fallback(entity_name, official_url)
            step_timings["scrape"] = round(time.perf_counter() - scrape_started_at, 3)
            step_timings["official_content_source"] = content_source
            logger.info("📊 Official content source for %s: %s", entity_name, content_source)

            if scrape_result.get('status') != 'success':
                logger.warning(f"Scraping failed for {scraped_url}")
                return None

            content = scrape_result.get('content', '')
            if not content:
                logger.warning(f"No content scraped from {scraped_url}")
                return None
            official_url = scraped_url

            # Step 4: Extract entity properties using AI
            extract_started_at = time.perf_counter()
            extracted_data = await self._extract_entity_properties(content, entity_name)
            step_timings["extract"] = round(time.perf_counter() - extract_started_at, 3)

            scraped_content = ScrapedContent(
                url=official_url,
                source_type="OFFICIAL_SITE",
                title=entity_name,
                content=content[:5000],  # Store first 5000 chars
                markdown_content=content,
                word_count=len(content.split())
            )

            logger.info(f"✅ Scraped {len(content)} chars from {official_url}")
            logger.info(f"   Extracted properties: {list(extracted_data.keys())}")

            # Merge scraped data into metadata
            step_timings["total"] = round(
                sum(value for value in step_timings.values() if isinstance(value, (int, float))),
                3,
            )
            return scraped_content, extracted_data, step_timings

        except Exception as e:
            logger.error(f"❌ Web scraping failed: {e}")
            return None

    async def _extract_entity_properties(self, content: str, entity_name: str) -> Dict[str, Any]:
        """
        Extract entity properties from scraped content using Claude AI

        Args:
            content: Scraped markdown content
            entity_name: Name of the entity

        Returns:
            Dictionary with extracted properties
        """
        try:
            from claude_client import ClaudeClient

            client = ClaudeClient()

            prompt = f"""Extract the following information from this website content about {entity_name}:

Website Content (first 3000 chars):
{content[:3000]}

Extract and return ONLY a JSON object with these fields:
{{
  "founded": "Year founded (e.g., 1886)",
  "stadium": "Stadium or venue name (e.g., Emirates Stadium)",
  "capacity": "Stadium capacity (e.g., 60,704)",
  "website": "Official website URL",
  "employees": "Number of employees if mentioned",
  "league": "League or competition name",
  "country": "Country"
}}

If a field is not found, use null. Return ONLY valid JSON, no other text."""

            result = await client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=500
            )

            response_text = result.get('content', '') or ''

            # Parse JSON response
            import json
            import re

            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*"fought"[^{}]*\}', response_text, re.DOTALL)
            if not json_match:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)

            if json_match:
                extracted = json.loads(json_match.group(0))
                logger.info(f"✅ Extracted properties: {extracted}")
                return extracted
            else:
                logger.warning("Could not parse extraction response")
                return {}

        except Exception as e:
            logger.error(f"❌ Property extraction failed: {e}")
            return {}

    async def _collect_multi_source_intelligence(
        self,
        entity_name: str
    ) -> Dict[str, Any]:
        """
        Collect real-time intelligence from multiple sources using BrightData SDK.

        Args:
            entity_name: Name of the entity to research

        Returns:
            Dict with:
            - official_site: Scraped official website content
            - job_postings: Recent relevant job postings (CRM, Digital, Data)
            - press_releases: Recent press releases and news
            - linkedin_posts: LinkedIn activity (if available via scraping)
            - sources_used: List of successfully accessed sources
            - freshness_score: Overall data freshness score (0-100)
        """
        # Ensure BrightData is connected
        if not self._brightdata_available:
            await self._connect_brightdata()
            if not self.brightdata_client:
                logger.warning("BrightData not available for multi-source collection")
                return {
                    "official_site": {},
                    "job_postings": [],
                    "press_releases": [],
                    "linkedin_posts": [],
                    "sources_used": [],
                    "freshness_score": 0
                }

        logger.info(f"🔍 Collecting multi-source intelligence for {entity_name}")

        results = {
            "official_site": {},
            "job_postings": [],
            "press_releases": [],
            "linkedin_posts": [],
            "sources_used": [],
            "freshness_score": 0,
            "source_timings": {},
        }

        source_results = await asyncio.gather(
            self._run_multi_source_task("official_website", self._scrape_official_site(entity_name)),
            self._run_multi_source_task(
                "job_postings",
                self.brightdata_client.scrape_jobs_board(
                    entity_name=entity_name,
                    keywords=["CRM", "Digital", "Data", "Analytics", "Marketing", "Technology", "CRM", "Cloud"],
                ),
            ),
            self._run_multi_source_task(
                "press_releases",
                self.brightdata_client.scrape_press_release(entity_name=entity_name),
            ),
            self._run_multi_source_task(
                "linkedin",
                self.brightdata_client.search_engine(
                    query=f'"{entity_name}" site:linkedin.com/company',
                    engine='google',
                    num_results=5,
                ),
            ),
        )

        for source_name, payload, timing in source_results:
            results["source_timings"][source_name] = timing
            if not payload:
                continue

            if source_name == "official_website":
                results["official_site"] = payload
                results["sources_used"].append(source_name)
                logger.info(f"✅ Official website scraped: {payload.get('url')}")
                continue

            if payload.get('status') != 'success':
                continue

            if source_name == "job_postings":
                jobs = payload.get('results', [])[:10]
                results["job_postings"] = jobs
                results["sources_used"].append(source_name)
                logger.info(f"✅ Found {len(jobs)} relevant job postings")
            elif source_name == "press_releases":
                press = payload.get('results', [])[:10]
                results["press_releases"] = press
                results["sources_used"].append(source_name)
                logger.info(f"✅ Found {len(press)} press releases")
            elif source_name == "linkedin":
                linkedin_results = payload.get('results', [])
                results["linkedin_posts"] = linkedin_results
                results["sources_used"].append(source_name)
                logger.info(f"✅ Found {len(linkedin_results)} LinkedIn references")

        # Calculate freshness score based on recency and source count
        freshness_score = self._calculate_freshness_score(results)
        results["freshness_score"] = freshness_score

        logger.info(f"✅ Multi-source collection complete: {len(results['sources_used'])} sources, freshness: {freshness_score}/100")

        return results

    async def _run_multi_source_task(self, source_name: str, coro):
        started_at = time.perf_counter()
        try:
            logger.info(f"🔎 Collecting {source_name} for dossier enrichment")
            payload = await asyncio.wait_for(coro, timeout=self.source_timeout_seconds)
            return source_name, payload, {
                "duration_seconds": round(time.perf_counter() - started_at, 3),
                "status": "success",
            }
        except asyncio.TimeoutError:
            logger.warning(f"⚠️ {source_name} timed out after {self.source_timeout_seconds:.1f}s")
            return source_name, None, {
                "duration_seconds": round(time.perf_counter() - started_at, 3),
                "status": "timeout",
            }
        except Exception as e:
            logger.warning(f"⚠️ {source_name} collection failed: {e}")
            return source_name, None, {
                "duration_seconds": round(time.perf_counter() - started_at, 3),
                "status": "failed",
                "error": str(e),
            }

    async def _scrape_official_site(self, entity_name: str) -> Optional[Dict[str, Any]]:
        """
        Scrape official website for entity details

        Args:
            entity_name: Entity name to search for

        Returns:
            Dict with url, content, summary, and metadata
        """
        if not self.brightdata_client:
            return None

        try:
            official_url = ""
            search_results: Dict[str, Any] = {"status": "seeded", "results": []}
            preferred_url = self._get_preferred_official_site_url(entity_name)
            if preferred_url:
                official_url = preferred_url
                logger.info("🎯 Using seeded official website for %s: %s", entity_name, official_url)
            else:
                # Search for official website
                search_results = await self.brightdata_client.search_engine(
                    query=f'"{entity_name}" official website',
                    engine="google",
                    num_results=5
                )

                if search_results.get('status') == 'success':
                    results = search_results.get('results', [])
                    if results:
                        official_url = self._choose_official_site_url(entity_name, results)
                        if official_url:
                            self._store_cached_official_site_url(entity_name, official_url)

            if not official_url:
                official_url = self._get_cached_official_site_url(entity_name) or ""
                if official_url:
                    logger.info("♻️ Reusing cached official website URL for %s: %s", entity_name, official_url)
            if not official_url:
                return None

            # Scrape official website content
            scraped_url, scrape_result, content_source = await self._scrape_official_url_with_fallback(entity_name, official_url)
            logger.info("📊 Official content source for %s: %s", entity_name, content_source)

            if scrape_result.get('status') != 'success':
                return None

            content = scrape_result.get('content', '')
            if not content:
                return None
            official_url = scraped_url

            # Generate summary (first 500 chars)
            summary = content[:500] + "..." if len(content) > 500 else content

            return {
                "url": official_url,
                "content": content,
                "summary": summary,
                "word_count": len(content.split()),
                "source": "official_website",
                "content_source": content_source,
                "context": "Official website provides current technology stack, vendor mentions, and strategic messaging",
                "freshness": "real-time",
                "confidence_explanation": "Directly from entity's official communications"
            }

        except Exception as e:
            logger.error(f"❌ Official site scraping failed: {e}")
            return None

    def _calculate_freshness_score(self, results: Dict[str, Any]) -> int:
        """
        Calculate data freshness score based on sources and recency

        Args:
            results: Multi-source collection results

        Returns:
            Freshness score (0-100)
        """
        score = 0

        # Base score from number of sources
        sources_count = len(results.get('sources_used', []))
        score += sources_count * 20  # Each source = 20 points

        # Bonus for having job postings (indicates active hiring/changes)
        jobs = results.get('job_postings', [])
        if jobs:
            score += 10

        # Bonus for having press releases (indicates recent news)
        press = results.get('press_releases', [])
        if press:
            score += 10

        # Bonus for LinkedIn (indicates active social presence)
        linkedin = results.get('linkedin_posts', [])
        if linkedin:
            score += 10

        return min(score, 100)  # Cap at 100

    async def _connect_hypothesis_manager(self):
        """Initialize Hypothesis Manager (for Phase 3)"""
        # Placeholder for Phase 3 implementation
        return False


# =============================================================================
# Convenience Functions
# =============================================================================

async def collect_dossier_data(entity_id: str, entity_name: str = None) -> DossierData:
    """
    Convenience function to collect all dossier data

    Usage:
        from dossier_data_collector import collect_dossier_data

        data = await collect_dossier_data("arsenal-fc", "Arsenal FC")
        print(f"Metadata: {data.metadata}")
        print(f"Sources: {data.data_sources_used}")
    """
    collector = DossierDataCollector()
    return await collector.collect_all(entity_id, entity_name)


# =============================================================================
# Test / Main
# =============================================================================

async def test_falkordb_integration():
    """Test FalkorDB integration with Arsenal FC"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    print("\n" + "=" * 70)
    print("PHASE 1: FALKORDB INTEGRATION TEST")
    print("=" * 70)

    collector = DossierDataCollector()
    data = await collector.collect_all(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC"
    )

    print("\n📊 Collection Results:")
    print(f"  Entity: {data.entity_name} ({data.entity_id})")
    print(f"  Data Sources: {', '.join(data.data_sources_used)}")
    print(f"  Collected At: {data.collected_at}")

    if data.metadata:
        print(f"\n✅ FalkorDB Metadata:")
        print(f"  Entity ID: {data.metadata.entity_id}")
        print(f"  Name: {data.metadata.entity_name}")
        print(f"  Type: {data.metadata.entity_type}")
        print(f"  Sport: {data.metadata.sport}")
        print(f"  Country: {data.metadata.country}")
        print(f"  League: {data.metadata.league_or_competition}")
        print(f"  Ownership: {data.metadata.ownership_type}")
        print(f"  Revenue Band: {data.metadata.estimated_revenue_band}")
        print(f"  Digital Maturity: {data.metadata.digital_maturity}")
        if data.metadata.description:
            desc = data.metadata.description[:100] + "..." if len(data.metadata.description) > 100 else data.metadata.description
            print(f"  Description: {desc}")
    else:
        print("\n❌ No metadata retrieved")

    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)

    # Return success status
    return data.metadata is not None


if __name__ == "__main__":
    import asyncio
    success = asyncio.run(test_falkordb_integration())
    exit(0 if success else 1)
