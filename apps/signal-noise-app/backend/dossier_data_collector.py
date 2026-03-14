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

import os
import logging
import urllib.parse
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from pathlib import Path
from functools import lru_cache
import asyncio
import json
import hashlib

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

try:
    from official_site_resolver import choose_canonical_official_site, rank_official_site_candidates
except ImportError:  # pragma: no cover - package import path fallback
    from backend.official_site_resolver import choose_canonical_official_site, rank_official_site_candidates

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
    headquarters: Optional[str] = None  # HQ location (alias for hq)

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

    # Phase 0 Enhanced Data Collection (by section)
    digital_transformation: Dict[str, Any] = field(default_factory=dict)  # Section 2
    strategic_opportunities: Dict[str, Any] = field(default_factory=dict)  # Section 4
    leadership: Dict[str, Any] = field(default_factory=dict)  # Section 5
    recent_news: Dict[str, Any] = field(default_factory=dict)  # Section 7
    performance: Dict[str, Any] = field(default_factory=dict)  # Section 8

    # Collection metadata
    collected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data_sources_used: List[str] = field(default_factory=list)


# =============================================================================
# Cache Manager for Web Scraping Results
# =============================================================================

class ScrapingCache:
    """
    LRU cache for web scraping results with TTL support.

    Reduces duplicate API calls by caching scraped content for 24 hours.
    """

    def __init__(self, cache_dir: str = "/tmp/dossier_scraping_cache", ttl_hours: int = 24):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = timedelta(hours=ttl_hours)
        self._memory_cache: Dict[str, tuple] = {}  # (data, timestamp)

    def _get_cache_key(self, operation: str, **kwargs) -> str:
        """Generate cache key from operation and parameters"""
        key_dict = {"operation": operation, **kwargs}
        key_str = json.dumps(key_dict, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()

    def get(self, operation: str, **kwargs) -> Optional[Any]:
        """Get cached result if available and not expired"""
        cache_key = self._get_cache_key(operation, **kwargs)

        # Check memory cache first
        if cache_key in self._memory_cache:
            data, timestamp = self._memory_cache[cache_key]
            if datetime.now(timezone.utc) - timestamp < self.ttl:
                logger.debug(f"✅ Cache HIT (memory): {operation}")
                return data
            else:
                del self._memory_cache[cache_key]

        # Check disk cache
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file) as f:
                    cached = json.load(f)
                cached_time = datetime.fromisoformat(cached.get("timestamp", ""))

                if datetime.now(timezone.utc) - cached_time < self.ttl:
                    logger.debug(f"✅ Cache HIT (disk): {operation}")
                    # Also populate memory cache
                    self._memory_cache[cache_key] = (cached["data"], cached_time)
                    return cached["data"]
                else:
                    cache_file.unlink()
            except Exception as e:
                logger.debug(f"Cache read error: {e}")

        logger.debug(f"❌ Cache MISS: {operation}")
        return None

    def set(self, operation: str, data: Any, **kwargs):
        """Store result in cache"""
        cache_key = self._get_cache_key(operation, **kwargs)
        timestamp = datetime.now(timezone.utc)

        # Store in memory cache
        self._memory_cache[cache_key] = (data, timestamp)

        # Store in disk cache
        cache_file = self.cache_dir / f"{cache_key}.json"
        try:
            with open(cache_file, "w") as f:
                json.dump({
                    "data": data,
                    "timestamp": timestamp.isoformat()
                }, f)
        except Exception as e:
            logger.debug(f"Cache write error: {e}")

    def clear(self):
        """Clear all cache"""
        self._memory_cache.clear()
        for file in self.cache_dir.glob("*.json"):
            file.unlink()


# Global cache instance
_scraping_cache = ScrapingCache()


# =============================================================================
# Supabase Cache Integration
# =============================================================================

class SupabaseDossierCache:
    """
    Aggressive caching layer using Supabase for dossier data.

    Reduces API calls by storing collected data with configurable TTL.
    """

    def __init__(self):
        self.supabase_client = None
        self._connected = False

    async def connect(self) -> bool:
        """Initialize Supabase connection"""
        if self._connected:
            return True

        try:
            from supabase import create_client
            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

            if not supabase_url or not supabase_key:
                logger.debug("Supabase credentials not configured")
                return False

            self.supabase_client = create_client(supabase_url, supabase_key)
            self._connected = True
            return True
        except Exception as e:
            logger.debug(f"Supabase connection failed: {e}")
            return False

    async def get_cached_data(self, entity_id: str, data_type: str = "collected_data") -> Optional[Dict]:
        """
        Get cached collected data from Supabase.

        Args:
            entity_id: Entity identifier
            data_type: Type of data (leadership, digital_transformation, etc.)
        """
        if not await self.connect():
            return None

        try:
            result = self.supabase_client.table("dossier_scraping_cache").select("*").eq("entity_id", entity_id).eq("data_type", data_type).execute()

            if result.data:
                cached = result.data[0]
                expires_at = datetime.fromisoformat(cached["expires_at"]) if cached.get("expires_at") else None

                if expires_at and datetime.now(timezone.utc) < expires_at:
                    logger.debug(f"✅ Supabase cache HIT: {entity_id}/{data_type}")
                    return cached.get("data")
                else:
                    # Delete expired entry
                    self.supabase_client.table("dossier_scraping_cache").delete().eq("entity_id", entity_id).eq("data_type", data_type).execute()
        except Exception as e:
            logger.debug(f"Supabase cache read error: {e}")

        return None

    async def set_cached_data(self, entity_id: str, data_type: str, data: Any, ttl_hours: int = 24):
        """Store collected data in Supabase cache"""
        if not await self.connect():
            return

        try:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)

            # Upsert cache entry
            self.supabase_client.table("dossier_scraping_cache").upsert({
                "entity_id": entity_id,
                "data_type": data_type,
                "data": data,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()

            logger.debug(f"✅ Supabase cache SET: {entity_id}/{data_type}")
        except Exception as e:
            logger.debug(f"Supabase cache write error: {e}")


# Global Supabase cache instance
_supabase_cache = SupabaseDossierCache()


# =============================================================================
# Data Collector Implementation
# =============================================================================

class DossierDataCollector:
    """
    Collect entity data from multiple sources for dossier generation

    Optimized with:
    - LRU cache for web scraping results (24h TTL)
    - Supabase cache for persistent storage
    - Parallel async requests for independent data sources

    Uses same .env loading pattern as graphiti_service.py for consistency.
    """

    def __init__(self, falkordb_client=None, brightdata_client=None, hypothesis_manager=None, claude_client=None,
                 use_cache: bool = True, parallel_scraping: bool = True):
        """
        Initialize data collector

        Args:
            falkordb_client: Optional FalkorDB client (will create if None)
            brightdata_client: Optional BrightData SDK client (will create if None)
            hypothesis_manager: Optional HypothesisManager (will create if None)
            claude_client: Optional ClaudeClient for Ralph Loop validation (will create if None)
            use_cache: Enable caching (default: True)
            parallel_scraping: Enable parallel async scraping (default: True)
        """
        self.falkordb_client = falkordb_client
        self.brightdata_client = brightdata_client
        self.hypothesis_manager = hypothesis_manager
        self.claude_client = claude_client

        self._falkordb_connected = False
        self._brightdata_available = False
        self._hypothesis_available = False
        self.use_cache = use_cache
        self.parallel_scraping = parallel_scraping

    async def close(self):
        """Close any async clients owned by the collector."""
        if self.brightdata_client and hasattr(self.brightdata_client, "close"):
            await self.brightdata_client.close()
        self.brightdata_client = None

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

    def _host_from_url(self, candidate: Optional[str]) -> str:
        normalized = self._normalize_http_url(candidate)
        if not normalized:
            return ""
        parsed = urllib.parse.urlparse(normalized)
        host = (parsed.netloc or "").strip().lower()
        if host.startswith("www."):
            host = host[4:]
        return host

    def _is_commerce_host(self, candidate: Optional[str]) -> bool:
        host = self._host_from_url(candidate)
        if not host:
            return False
        host_tokens = set(part for part in re.split(r"[^a-z0-9]+", host) if part)
        commerce_tokens = {"store", "shop", "ticket", "tickets", "merch"}
        if host_tokens & commerce_tokens:
            return True
        for token in host_tokens:
            for commerce_token in commerce_tokens:
                if commerce_token in token:
                    return True
        return False

    def _looks_like_entity_domain(self, entity_name: str, candidate_url: Optional[str]) -> bool:
        host = self._host_from_url(candidate_url)
        if not host:
            return False

        compact_host = "".join(ch for ch in host if ch.isalnum())
        tokens = [token for token in re.split(r"[^a-z0-9]+", (entity_name or "").lower()) if token]
        if not tokens:
            return False

        stopwords = {"the", "club", "football", "sport", "sports", "association", "team", "official", "website"}
        suffix_tokens = {"fc", "afc", "cf", "ac", "sc"}
        informative = [token for token in tokens if token not in stopwords and token not in suffix_tokens and len(token) >= 3]

        aliases: List[str] = []
        full_compact = "".join(ch for ch in (entity_name or "").lower() if ch.isalnum())
        if len(full_compact) >= 3:
            aliases.append(full_compact)
        informative_compact = "".join(informative)
        if len(informative_compact) >= 3:
            aliases.append(informative_compact)
        informative_initials = "".join(token[0] for token in informative if token)
        if len(informative_initials) >= 2:
            aliases.append(informative_initials)
            aliases.append(f"{informative_initials}fc")
        all_initials = "".join(token[0] for token in tokens if token)
        if len(all_initials) >= 2:
            aliases.append(all_initials)

        return any(alias in compact_host for alias in aliases if len(alias) >= 3)
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

        max_candidates = max(
            1,
            int(os.getenv("DOSSIER_OFFICIAL_SITE_SELECTION_MAX_CANDIDATES", "10")),
        )
        ranked = rank_official_site_candidates(
            entity_name=entity_name,
            candidates=results,
            max_candidates=max_candidates,
        )
        for candidate in ranked:
            url = self._normalize_http_url(candidate.get("url"))
            if not url:
                continue
            if not self._is_commerce_host(url) and self._looks_like_entity_domain(entity_name, url):
                return url

        return choose_canonical_official_site(
            entity_name=entity_name,
            candidates=results,
            max_candidates=max_candidates,
        )

    async def _connect_falkordb(self):
        """Connect to FalkorDB using native Python client"""
        if self._falkordb_connected:
            return True

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

            # Connect
            # IMPORTANT: FalkorDB Cloud uses redis:// NOT rediss:// (no SSL/TLS)
            self.falkordb_client = FalkorDB(
                host=host,
                port=port,
                username=username,
                password=password,
                ssl=use_ssl,
            )

            # Test connection
            g = self.falkordb_client.select_graph(database)
            g.query("RETURN 1 AS test")

            self._falkordb_connected = True
            logger.info("✅ FalkorDB connected")
            return True

        except ImportError:
            logger.warning("⚠️ falkordb not installed - FalkorDB integration disabled")
            return False
        except Exception as e:
            logger.error(f"❌ FalkorDB connection failed: {e}")
            return False

    async def _connect_claude(self):
        """Connect to Claude AI for Ralph Loop validation"""
        if self.claude_client:
            return True

        try:
            from backend.claude_client import ClaudeClient
            self.claude_client = ClaudeClient()
            logger.info("✅ Claude client connected for Ralph Loop validation")
            return True
        except ImportError:
            logger.warning("⚠️ claude_client not available - Ralph Loop validation disabled")
            return False
        except Exception as e:
            logger.warning(f"⚠️ Claude client connection failed: {e}")
            return False

    async def collect_all(self, entity_id: str, entity_name: str = None) -> DossierData:
        """
        Collect all available data for dossier generation

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            DossierData with all collected information
        """
        logger.info(f"🔍 Collecting dossier data for {entity_name or entity_id}")

        # Connect to all data sources
        await self._connect_falkordb()
        await self._connect_brightdata()
        await self._connect_claude()

        dossier_data = DossierData(
            entity_id=entity_id,
            entity_name=entity_name or entity_id.replace("-", " ").title()
        )

        # Collect entity metadata from FalkorDB
        metadata = None
        if self._falkordb_connected:
            metadata = await self._get_entity_metadata(entity_id)
            if metadata:
                dossier_data.metadata = metadata
                dossier_data.data_sources_used.append("FalkorDB")

        # Create basic metadata if not found in FalkorDB or FalkorDB unavailable
        if not dossier_data.metadata:
            logger.info("📝 Creating basic metadata (entity not in FalkorDB or FalkorDB unavailable)")
            dossier_data.metadata = EntityMetadata(
                entity_id=entity_id,
                entity_name=entity_name or entity_id.replace("-", " ").title(),
                entity_type="CLUB",
                data_source="Generated"
            )

        # When Claude API is unavailable for the current process, skip expensive
        # BrightData enrichment that depends on Claude-based extraction anyway.
        if self.claude_client and getattr(self.claude_client, "_get_disabled_reason", None):
            disabled_reason = self.claude_client._get_disabled_reason()
            if disabled_reason:
                logger.warning(
                    f"⚠️ Claude API disabled ({disabled_reason}); skipping expensive dossier enrichment for {dossier_data.entity_name}"
                )
                return dossier_data

        # Scrape additional data from web (Phase 2) - Using Enhanced Multi-Source Scraping
        if self._brightdata_available:
            scrape_result = await self._get_scraped_content_enhanced(entity_id, dossier_data.entity_name)

            if scrape_result:
                scraped_content, extracted_data = scrape_result

                # Add scraped content to dossier
                dossier_data.scraped_content.append(scraped_content)
                dossier_data.data_sources_used.append("BrightData")

                # Use Ralph Loop Field Validator for core fields
                if dossier_data.metadata and self.claude_client:
                    logger.info("🔍 Applying Ralph Loop field validation...")
                    try:
                        validator = RalphLoopFieldValidator(
                            claude_client=self.claude_client,
                            brightdata_client=self.brightdata_client
                        )

                        # Build field sources from scraped data
                        field_sources = validator._extract_field_sources(extracted_data)

                        # Validate each field and update metadata
                        for field_name in ["founded", "stadium", "website", "employees", "hq"]:
                            sources = field_sources.get(field_name, [])
                            if sources:
                                result = await validator.validate_field(
                                    entity_name=dossier_data.entity_name,
                                    field_name=field_name,
                                    raw_sources=sources
                                )

                                if result.value and result.confidence > 0.5:
                                    if field_name == "hq":
                                        # hq maps to headquarters in metadata
                                        setattr(dossier_data.metadata, "headquarters", result.value)
                                    else:
                                        setattr(dossier_data.metadata, field_name, result.value)

                                    logger.info(f"  ✅ {field_name}: {result.value} (confidence: {result.confidence:.2f})")

                        logger.info("✅ Ralph Loop field validation complete")

                    except Exception as e:
                        logger.warning(f"⚠️ Ralph Loop validation failed: {e}, falling back to basic extraction")

                # Fallback: Update metadata with basic extracted data
                if dossier_data.metadata and extracted_data:
                    if extracted_data.get('founded') and not dossier_data.metadata.founded:
                        dossier_data.metadata.founded = extracted_data['founded']
                    if extracted_data.get('stadium') and not dossier_data.metadata.stadium:
                        dossier_data.metadata.stadium = extracted_data['stadium']
                    if extracted_data.get('capacity') and not dossier_data.metadata.capacity:
                        dossier_data.metadata.capacity = extracted_data['capacity']
                    if extracted_data.get('website') and not dossier_data.metadata.website:
                        dossier_data.metadata.website = extracted_data['website']
                    if extracted_data.get('employees') and not dossier_data.metadata.employees:
                        dossier_data.metadata.employees = extracted_data['employees']
                    if extracted_data.get('league') and not dossier_data.metadata.league_or_competition:
                        dossier_data.metadata.league_or_competition = extracted_data['league']
                    if extracted_data.get('country') and not dossier_data.metadata.country:
                        dossier_data.metadata.country = extracted_data['country']

                    logger.info(f"✅ Enhanced metadata with BrightData data")

        # =============================================================================
        # ADDITIONAL DATA COLLECTION FOR DOSSIER SECTIONS (Phase 0 Enhancement)
        # =============================================================================
        # OPTIMIZED: Parallel async scraping with caching support
        logger.info("📊 Collecting additional dossier section data (parallel mode)...")

        async def collect_with_cache(data_type: str, collect_func, cache_key: str = None):
            """Collect data with cache support"""
            if self.use_cache and cache_key:
                # Try Supabase cache first
                cached = await _supabase_cache.get_cached_data(entity_id, cache_key)
                if cached:
                    logger.info(f"  ✅ {data_type}: FROM CACHE")
                    return cached

                # Try local cache
                local_cached = _scraping_cache.get(cache_key, entity_id=entity_id)
                if local_cached:
                    logger.info(f"  ✅ {data_type}: FROM LOCAL CACHE")
                    # Also populate Supabase cache
                    asyncio.create_task(_supabase_cache.set_cached_data(entity_id, cache_key, local_cached))
                    return local_cached

            # Collect fresh data
            result = await collect_func()

            # Store in cache
            if self.use_cache and cache_key and result:
                _scraping_cache.set(cache_key, result, entity_id=entity_id)
                asyncio.create_task(_supabase_cache.set_cached_data(entity_id, cache_key, result))

            return result

        if self.parallel_scraping:
            # PARALLEL MODE: Run all independent collection tasks concurrently
            # This reduces total time from sum(all) to max(slowest)
            tasks = []

            # Section 2: Digital Transformation - Tech stack detection
            async def collect_digital():
                try:
                    return await collect_with_cache(
                        "Digital Transformation",
                        lambda: self.collect_digital_transformation_data(entity_id, dossier_data.entity_name),
                        cache_key="digital_transformation"
                    )
                except Exception as e:
                    logger.warning(f"  ⚠️ Digital Transformation collection failed: {e}")
                    return {}
            tasks.append(("digital_transformation", collect_digital()))

            # Section 4: Strategic Opportunities
            async def collect_opportunities():
                try:
                    return await collect_with_cache(
                        "Strategic Opportunities",
                        lambda: self.collect_strategic_opportunities(entity_id, dossier_data.entity_name),
                        cache_key="strategic_opportunities"
                    )
                except Exception as e:
                    logger.warning(f"  ⚠️ Strategic Opportunities collection failed: {e}")
                    return {}
            tasks.append(("strategic_opportunities", collect_opportunities()))

            # Section 7: Recent News
            async def collect_news():
                try:
                    return await collect_with_cache(
                        "Recent News",
                        lambda: self.collect_recent_news_data(entity_id, dossier_data.entity_name),
                        cache_key="recent_news"
                    )
                except Exception as e:
                    logger.warning(f"  ⚠️ Recent News collection failed: {e}")
                    return {}
            tasks.append(("recent_news", collect_news()))

            # Section 8: Performance
            async def collect_performance():
                try:
                    return await collect_with_cache(
                        "Performance",
                        lambda: self.collect_performance_data(entity_id, dossier_data.entity_name),
                        cache_key="performance"
                    )
                except Exception as e:
                    logger.warning(f"  ⚠️ Performance collection failed: {e}")
                    return {}
            tasks.append(("performance", collect_performance()))

            # Section 5: Leadership (always collected, critical)
            async def collect_leadership():
                try:
                    return await collect_with_cache(
                        "Leadership",
                        lambda: self.collect_leadership(entity_id, dossier_data.entity_name),
                        cache_key="leadership"
                    )
                except Exception as e:
                    logger.warning(f"  ⚠️ Leadership collection failed: {e}")
                    return {}
            tasks.append(("leadership", collect_leadership()))

            # Execute all tasks in parallel and wait for completion
            logger.info(f"🚀 Running {len(tasks)} collection tasks in parallel...")
            results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)

            # Process results
            for (key, _), result in zip(tasks, results):
                if isinstance(result, Exception):
                    logger.warning(f"⚠️ {key} task failed: {result}")
                    continue

                if not result:
                    continue

                if key == "digital_transformation":
                    dossier_data.digital_transformation = result
                    logger.info(f"  ✅ Digital Transformation: {len(result.get('sources_used', []))} sources")
                elif key == "strategic_opportunities":
                    dossier_data.strategic_opportunities = result
                    logger.info(f"  ✅ Strategic Opportunities: {len(result.get('opportunities', []))} found")
                elif key == "recent_news":
                    dossier_data.recent_news = result
                    logger.info(f"  ✅ Recent News: {len(result.get('news_items', []))} items")
                elif key == "performance":
                    dossier_data.performance = result
                    logger.info(f"  ✅ Performance: position {result.get('league_position', 'unknown')}")
                elif key == "leadership":
                    dossier_data.leadership = result
                    logger.info(f"  ✅ Leadership: {len(result.get('decision_makers', []))} decision makers")

        else:
            # SEQUENTIAL MODE: Original behavior (for debugging)
            logger.info("📊 Running in sequential mode...")

            # Section 2: Digital Transformation - Tech stack detection
            try:
                digital_data = await self.collect_digital_transformation_data(entity_id, dossier_data.entity_name)
                dossier_data.digital_transformation = digital_data
                logger.info(f"  ✅ Digital Transformation: {len(digital_data.get('sources_used', []))} sources")
            except Exception as e:
                logger.warning(f"  ⚠️ Digital Transformation collection failed: {e}")

            # Section 4: Strategic Opportunities - Initiative detection
            try:
                opportunities_data = await self.collect_strategic_opportunities(entity_id, dossier_data.entity_name)
                dossier_data.strategic_opportunities = opportunities_data
                logger.info(f"  ✅ Strategic Opportunities: {len(opportunities_data.get('opportunities', []))} found")
            except Exception as e:
                logger.warning(f"  ⚠️ Strategic Opportunities collection failed: {e}")

            # Section 7: Recent News - News scraping
            try:
                news_data = await self.collect_recent_news_data(entity_id, dossier_data.entity_name)
                dossier_data.recent_news = news_data
                logger.info(f"  ✅ Recent News: {len(news_data.get('news_items', []))} items")
            except Exception as e:
                logger.warning(f"  ⚠️ Recent News collection failed: {e}")

            # Section 8: Current Performance - League table
            try:
                performance_data = await self.collect_performance_data(entity_id, dossier_data.entity_name)
                dossier_data.performance = performance_data
                logger.info(f"  ✅ Performance: position {performance_data.get('league_position', 'unknown')}")
            except Exception as e:
                logger.warning(f"  ⚠️ Performance collection failed: {e}")

            # Section 5: Leadership - Decision makers (already done, but let's ensure it's accessible)
            try:
                leadership_data = await self.collect_leadership(entity_id, dossier_data.entity_name)
                dossier_data.leadership = leadership_data
                logger.info(f"  ✅ Leadership: {len(leadership_data.get('decision_makers', []))} decision makers")
            except Exception as e:
                logger.warning(f"  ⚠️ Leadership collection failed: {e}")

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

        try:
            from backend.brightdata_sdk_client import BrightDataSDKClient

            self.brightdata_client = BrightDataSDKClient()

            # Test connection with a simple search
            test_result = await self.brightdata_client.search_engine(
                query="test",
                engine="google",
                num_results=1
            )

            if test_result.get('status') == 'success':
                self._brightdata_available = True
                logger.info("✅ BrightData SDK connected")
                return True
            else:
                logger.warning("⚠️ BrightData SDK test failed")
                return False

        except ImportError:
            logger.warning("⚠️ brightdata_sdk_client not installed - web scraping disabled")
            return False
        except Exception as e:
            logger.error(f"❌ BrightData SDK connection failed: {e}")
            return False

    async def _get_scraped_content_enhanced(self, entity_id: str, entity_name: str) -> Optional[tuple]:
        """
        Enhanced multi-source scraping for comprehensive entity data collection.

        Scrapes multiple sources:
        1. Official website homepage
        2. Wikipedia page (for reliable historical data)
        3. Sports databases (PremierLeague.com, etc.)
        4. Specific pages for each field type

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            Tuple of (ScrapedContent, extracted_data_dict)
        """
        if not self._brightdata_available or not self.brightdata_client:
            logger.warning("BrightData not available for scraping")
            return None

        logger.info(f"🌐 Starting enhanced multi-source scraping for {entity_name}")

        # Store all collected data
        all_extracted_data = {}
        scraped_urls = []

        # Source 1: Wikipedia (reliable for founded year, stadium, basic info)
        wiki_data = await self._scrape_wikipedia(entity_name)
        if wiki_data:
            all_extracted_data.update(wiki_data)
            scraped_urls.append(wiki_data.get("url", ""))
            logger.info(f"✅ Wikipedia data collected: {list(wiki_data.keys())}")

        # Source 2: Official website homepage
        official_site_data = await self._scrape_official_site(entity_name)
        if official_site_data:
            all_extracted_data.update(official_site_data)
            scraped_urls.append(official_site_data.get("url", ""))
            logger.info(f"✅ Official site data collected: {list(official_site_data.keys())}")

        # Source 3: Field-specific searches for missing data
        if not all_extracted_data.get("founded"):
            founded_data = await self._scrape_field_specific(entity_name, "founded")
            if founded_data:
                all_extracted_data.update(founded_data)

        if not all_extracted_data.get("stadium"):
            stadium_data = await self._scrape_field_specific(entity_name, "stadium")
            if stadium_data:
                all_extracted_data.update(stadium_data)

        if not all_extracted_data.get("website"):
            all_extracted_data["website"] = all_extracted_data.get("official_site_url", "")

        # Source 4: League/Premier League data
        league_data = await self._scrape_league_data(entity_name)
        if league_data:
            all_extracted_data.update(league_data)

        # Create scraped content object
        official_url = all_extracted_data.get("website", "")
        if not official_url and scraped_urls:
            official_url = scraped_urls[0]

        scraped_content = ScrapedContent(
            url=official_url,
            source_type="MULTI_SOURCE",
            title=entity_name,
            content=all_extracted_data.get("official_site_content", ""),
            markdown_content=all_extracted_data.get("official_site_markdown", ""),
            word_count=0
        )

        logger.info(f"✅ Enhanced scraping complete: {len(all_extracted_data)} fields collected")
        logger.info(f"   Fields found: {list(all_extracted_data.keys())}")

        return scraped_content, all_extracted_data

    async def _scrape_wikipedia(self, entity_name: str) -> Dict[str, Any]:
        """
        Scrape Wikipedia for reliable entity information.

        Wikipedia is excellent for:
        - Founded year
        - Stadium name
        - Basic club information
        """
        try:
            # Search for Wikipedia page
            search_query = f"{entity_name} Wikipedia"
            search_results = await self.brightdata_client.search_engine(
                query=search_query,
                engine="google",
                num_results=3
            )

            if search_results.get('status') != 'success':
                return {}

            # Find Wikipedia URL
            wiki_url = None
            for result in search_results.get('results', []):
                url = result.get('url', '')
                if 'wikipedia.org' in url:
                    wiki_url = url
                    break

            if not wiki_url:
                return {}

            logger.info(f"📖 Scraping Wikipedia: {wiki_url}")

            # Scrape Wikipedia content
            scrape_result = await self.brightdata_client.scrape_as_markdown(wiki_url)

            if scrape_result.get('status') != 'success':
                return {}

            content = scrape_result.get('content', '')

            # Extract field-specific data from Wikipedia
            extracted = await self._extract_fields_from_wikipedia(content, entity_name)

            extracted["url"] = wiki_url
            extracted["source"] = "wikipedia"

            logger.info(f"✅ Wikipedia extraction: {list(extracted.keys())}")
            return extracted

        except Exception as e:
            logger.warning(f"⚠️ Wikipedia scraping failed: {e}")
            return {}

    async def _scrape_official_site(self, entity_name: str) -> Dict[str, Any]:
        """
        Scrape official website for entity information.
        """
        try:
            # Search for official website
            search_results = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            if search_results.get('status') != 'success':
                return {}

            # Find official URL
            official_url = None
            for result in search_results.get('results', []):
                url = result.get('url', '')
                title = result.get('title', '').lower()
                snippet = result.get('snippet', '').lower()

                # Look for official site indicators
                if (entity_name.lower().replace(' ', '') in url.lower() or
                    'official' in title or 'official' in snippet):
                    official_url = url
                    break

            if not official_url:
                return {}

            logger.info(f"🏠 Scraping official site: {official_url}")

            # Scrape homepage
            scrape_result = await self.brightdata_client.scrape_as_markdown(official_url)

            if scrape_result.get('status') != 'success':
                return {}

            content = scrape_result.get('content', '')
            markdown = scrape_result.get('content', '')

            # Extract data from homepage
            extracted = await self._extract_fields_from_content(content, entity_name)

            extracted["official_site_url"] = official_url
            extracted["official_site_markdown"] = markdown
            extracted["official_site_content"] = content[:5000]

            return extracted

        except Exception as e:
            logger.warning(f"⚠️ Official site scraping failed: {e}")
            return {}

    async def _scrape_field_specific(self, entity_name: str, field: str) -> Dict[str, Any]:
        """
        Field-specific scraping for missing data.

        Uses targeted search queries for each field type.
        """
        field_queries = {
            "founded": [
                f'"{entity_name}" founded year history',
                f'"{entity_name}" established 1886 Wikipedia',
                f'when was "{entity_name}" founded'
            ],
            "stadium": [
                f'"{entity_name}" stadium name capacity',
                f'{entity_name} plays at stadium',
                f'"{entity_name}" home ground'
            ],
            "hq": [
                f'"{entity_name}" headquarters location address',
                f'{entity_name} training ground address',
                f'where is "{entity_name}" located'
            ],
            "employees": [
                f'"{entity_name}" staff count employees',
                f'how many employees does "{entity_name}" have'
            ]
        }

        try:
            queries = field_queries.get(field, [])
            if not queries:
                return {}

            # Use first query
            search_results = await self.brightdata_client.search_engine(
                query=queries[0],
                engine="google",
                num_results=5
            )

            if search_results.get('status') != 'success':
                return {}

            # Get top result and scrape
            top_url = search_results.get('results', [{}])[0].get('url', '')

            if not top_url:
                return {}

            logger.info(f"🔍 Field-specific scraping for {field}: {top_url}")

            # Scrape the URL
            scrape_result = await self.brightdata_client.scrape_as_markdown(top_url)

            if scrape_result.get('status') != 'success':
                return {}

            content = scrape_result.get('content', '')

            # Extract the specific field
            extracted = await self._extract_single_field(content, entity_name, field)

            return extracted

        except Exception as e:
            logger.warning(f"⚠️ Field-specific scraping failed for {field}: {e}")
            return {}

    async def _scrape_league_data(self, entity_name: str) -> Dict[str, Any]:
        """
        Scrape league/competition data for the entity.
        """
        try:
            # Check if it's a Premier League club
            league_queries = [
                f'"{entity_name}" Premier League club information',
                f'{entity_name} Premier League stats position'
            ]

            search_results = await self.brightdata_client.search_engine(
                query=league_queries[0],
                engine="google",
                num_results=3
            )

            if search_results.get('status') != 'success':
                return {}

            for result in search_results.get('results', []):
                url = result.get('url', '')
                if 'premierleague.com' in url or 'official' in result.get('title', '').lower():
                    logger.info(f"⚽ Scraping league data: {url}")
                    # Could extract league info here
                    return {"league_source": "premier_league"}

            return {}

        except Exception as e:
            logger.warning(f"⚠️ League data scraping failed: {e}")
            return {}

    async def collect_leadership(self, entity_id: str, entity_name: str) -> Dict[str, Any]:
        """
        Collect real leadership data using BrightData SDK for Sections 5 & 6.

        Scrapes multiple sources to find real names, roles, and LinkedIn URLs:
        1. Job postings for executive roles (CTO, CDO, Commercial Director, etc.)
        2. Press releases for executive appointments
        3. LinkedIn company pages for leadership mentions
        4. Official website "About" and "Leadership" pages
        5. Wikipedia for key personnel

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            Dict with:
            - decision_makers: List of {name, role, linkedin_url, confidence, influence_level}
            - sources_used: List of data sources that worked
            - fresh_signals_count: Number of recent hiring/appointment signals
        """
        logger.info(f"🎯 Collecting leadership data for {entity_name}")

        if not self._brightdata_available or not self.brightdata_client:
            logger.warning("BrightData not available for leadership collection")
            return {"decision_makers": [], "sources_used": [], "fresh_signals_count": 0}

        # Executive role keywords for sports clubs
        executive_roles = [
            "CEO", "Chief Executive", "Managing Director", "MD",
            "CTO", "Chief Technology Officer", "Head of Technology",
            "CDO", "Chief Digital Officer", "Head of Digital",
            "Commercial Director", "Commercial Director",
            "Marketing Director", "Director of Marketing",
            "Operations Director", "Head of Operations",
            "Finance Director", "CFO", "Chief Financial Officer",
            "Technical Director", "Sporting Director",
            "General Manager", "GM",
            "President", "Vice President", "VP",
            "Chairman", "Chair", "Owner"
        ]

        decision_makers = []
        sources_used = []
        fresh_signals_count = 0
        seen_names = set()  # Deduplicate

        # =============================================================================
        # SOURCE 1: Wikipedia - Key Personnel Section
        # =============================================================================
        try:
            logger.info("📖 Searching Wikipedia for key personnel...")
            wiki_search = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" Wikipedia key personnel chairman',
                engine="google",
                num_results=2
            )

            if wiki_search.get('status') == 'success':
                for result in wiki_search.get('results', []):
                    if 'wikipedia.org' in result.get('url', ''):
                        wiki_url = result['url']
                        logger.info(f"  Scraping Wikipedia: {wiki_url}")

                        wiki_scrape = await self.brightdata_client.scrape_as_markdown(wiki_url)
                        if wiki_scrape.get('status') == 'success':
                            content = wiki_scrape.get('content', '')

                            # Extract leadership from Wikipedia using Claude
                            extracted = await self._extract_leadership_from_content(
                                content, entity_name, "Wikipedia"
                            )

                            for person in extracted.get('people', []):
                                name = person.get('name', '').strip()
                                if name and name not in seen_names:
                                    seen_names.add(name)
                                    decision_makers.append({
                                        'name': name,
                                        'role': person.get('role', 'Executive'),
                                        'linkedin_url': person.get('linkedin_url', ''),
                                        'confidence': person.get('confidence', 75),
                                        'influence_level': person.get('influence_level', 'HIGH'),
                                        'source': 'Wikipedia',
                                        'source_url': wiki_url
                                    })

                            if extracted.get('people'):
                                sources_used.append('Wikipedia')
                                logger.info(f"  ✅ Wikipedia: {len(extracted.get('people', []))} people found")
                            break
        except Exception as e:
            logger.warning(f"  ⚠️ Wikipedia leadership search failed: {e}")

        # =============================================================================
        # SOURCE 2: Official Website - About/Leadership/Team pages
        # =============================================================================
        try:
            logger.info("🏠 Searching official website for leadership...")

            # First, find the official site
            site_search = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            official_url = None
            if site_search.get('status') == 'success':
                for result in site_search.get('results', []):
                    url = result.get('url', '')
                    if 'wikipedia' not in url:
                        official_url = url
                        break

            if official_url:
                # Try common leadership page URLs
                leadership_paths = [
                    '/about', '/about-us', '/team', '/leadership',
                    '/management', '/executives', '/board', '/our-team',
                    '/people', '/staff', '/leadership-team'
                ]

                base_url = official_url.rstrip('/')
                urls_to_try = [official_url] + [f"{base_url}{path}" for path in leadership_paths]

                for url in urls_to_try[:5]:  # Limit to 5 URLs
                    try:
                        logger.info(f"  Scraping: {url}")
                        scrape = await self.brightdata_client.scrape_as_markdown(url)

                        if scrape.get('status') == 'success':
                            content = scrape.get('content', '')

                            # Check if page has leadership content
                            leadership_keywords = ['ceo', 'director', 'chairman', 'president', 'executive', 'leadership', 'management']
                            has_leadership = any(kw.lower() in content.lower() for kw in leadership_keywords)

                            if has_leadership:
                                extracted = await self._extract_leadership_from_content(
                                    content, entity_name, "Official Website"
                                )

                                for person in extracted.get('people', []):
                                    name = person.get('name', '').strip()
                                    if name and name not in seen_names:
                                        seen_names.add(name)
                                        decision_makers.append({
                                            'name': name,
                                            'role': person.get('role', 'Executive'),
                                            'linkedin_url': person.get('linkedin_url', ''),
                                            'confidence': person.get('confidence', 85),
                                            'influence_level': person.get('influence_level', 'HIGH'),
                                            'source': 'Official Website',
                                            'source_url': url
                                        })

                                if extracted.get('people'):
                                    sources_used.append('Official Website')
                                    logger.info(f"  ✅ Official site: {len(extracted.get('people', []))} people found")
                                    break  # Found leadership page, stop trying other URLs
                    except Exception as e:
                        logger.debug(f"    Failed to scrape {url}: {e}")
                        continue
        except Exception as e:
            logger.warning(f"  ⚠️ Official website leadership search failed: {e}")

        # =============================================================================
        # SOURCE 3: Job Postings - Executive Roles (Fresh Signals)
        # =============================================================================
        try:
            logger.info("💼 Searching job postings for executive hires...")

            # Search for recent executive job postings
            job_queries = [
                f'"{entity_name}" "Chief Executive" job',
                f'"{entity_name}" "Chief Technology" job',
                f'"{entity_name}" "Commercial Director" job',
                f'"{entity_name}" "Digital Director" job',
                f'"{entity_name}" "Finance Director" job'
            ]

            for query in job_queries[:3]:  # Limit to 3 queries
                job_search = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=3
                )

                if job_search.get('status') == 'success':
                    for result in job_search.get('results', []):
                        url = result.get('url', '')
                        # Check if it's a recent posting (LinkedIn, company site, etc.)
                        if any(site in url for site in ['linkedin.com', 'indeed.com', 'company']):
                            logger.info(f"  Found job posting: {url[:60]}...")
                            fresh_signals_count += 1

            if fresh_signals_count > 0:
                sources_used.append('Job Postings')
                logger.info(f"  ✅ Job postings: {fresh_signals_count} executive hiring signals")
        except Exception as e:
            logger.warning(f"  ⚠️ Job posting search failed: {e}")

        # =============================================================================
        # SOURCE 4: Press Releases - Executive Appointments
        # =============================================================================
        try:
            logger.info("📰 Searching press releases for appointments...")

            press_queries = [
                f'"{entity_name}" appoints "Chief Executive"',
                f'"{entity_name}" appoints director',
                f'"{entity_name}" new "Chief Technology"',
                f'"{entity_name}" announces "Commercial Director"'
            ]

            for query in press_queries[:2]:
                press_search = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=3
                )

                if press_search.get('status') == 'success':
                    for result in press_search.get('results', []):
                        snippet = result.get('snippet', '')
                        title = result.get('title', '')

                        # Extract names from press mentions using Claude
                        combined_text = f"{title}. {snippet}"
                        names = await self._extract_names_from_text(combined_text, entity_name)

                        for name_data in names:
                            name = name_data.get('name', '').strip()
                            if name and name not in seen_names:
                                seen_names.add(name)
                                decision_makers.append({
                                    'name': name,
                                    'role': name_data.get('role', 'Executive'),
                                    'linkedin_url': '',
                                    'confidence': name_data.get('confidence', 70),
                                    'influence_level': name_data.get('influence_level', 'HIGH'),
                                    'source': 'Press Release',
                                    'source_url': result.get('url', '')
                                })

            if any('appoint' in q.lower() for q in press_queries):
                sources_used.append('Press Releases')
                logger.info(f"  ✅ Press releases: appointment announcements found")
        except Exception as e:
            logger.warning(f"  ⚠️ Press release search failed: {e}")

        # =============================================================================
        # SOURCE 5: LinkedIn - Company Page and People
        # =============================================================================
        try:
            logger.info("💼 Searching LinkedIn for leadership...")

            linkedin_queries = [
                f'site:linkedin.com "{entity_name}" "chief executive"',
                f'site:linkedin.com "{entity_name}" "commercial director"',
                f'site:linkedin.com/company "{entity_name}" "people" "management"'
            ]

            for query in linkedin_queries[:2]:
                linkedin_search = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=3
                )

                if linkedin_search.get('status') == 'success':
                    for result in linkedin_search.get('results', []):
                        url = result.get('url', '')

                        # Scrape LinkedIn profile/company page
                        if 'linkedin.com' in url:
                            try:
                                linkedin_scrape = await self.brightdata_client.scrape_as_markdown(url)
                                if linkedin_scrape.get('status') == 'success':
                                    content = linkedin_scrape.get('content', '')

                                    # Extract leadership info from LinkedIn
                                    extracted = await self._extract_leadership_from_content(
                                        content, entity_name, "LinkedIn"
                                    )

                                    for person in extracted.get('people', []):
                                        name = person.get('name', '').strip()
                                        if name and name not in seen_names:
                                            seen_names.add(name)
                                            decision_makers.append({
                                                'name': name,
                                                'role': person.get('role', 'Executive'),
                                                'linkedin_url': url if 'in/' in url else person.get('linkedin_url', ''),
                                                'confidence': person.get('confidence', 90),
                                                'influence_level': person.get('influence_level', 'HIGH'),
                                                'source': 'LinkedIn',
                                                'source_url': url
                                            })
                            except Exception as e:
                                logger.debug(f"    Failed to scrape LinkedIn: {e}")

            if decision_makers and any(dm.get('source') == 'LinkedIn' for dm in decision_makers):
                sources_used.append('LinkedIn')
                logger.info(f"  ✅ LinkedIn: leadership profiles found")
        except Exception as e:
            logger.warning(f"  ⚠️ LinkedIn search failed: {e}")

        # =============================================================================
        # FINAL: Deduplicate and Rank by Influence
        # =============================================================================
        # Remove exact duplicates (by name) already done via seen_names
        # Now rank by confidence and influence
        decision_makers.sort(key=lambda x: (
            x.get('influence_level', 'MEDIUM') != 'HIGH',
            -x.get('confidence', 0)
        ))

        # Keep top 10 decision makers
        decision_makers = decision_makers[:10]

        logger.info(f"✅ Leadership collection complete:")
        logger.info(f"   Decision makers found: {len(decision_makers)}")
        logger.info(f"   Sources used: {sources_used}")
        logger.info(f"   Fresh hiring signals: {fresh_signals_count}")

        for dm in decision_makers[:5]:  # Log top 5
            logger.info(f"   - {dm['name']}: {dm['role']} (confidence: {dm['confidence']}, source: {dm['source']})")

        return {
            'decision_makers': decision_makers,
            'sources_used': sources_used,
            'fresh_signals_count': fresh_signals_count
        }

    async def _extract_leadership_from_content(
        self,
        content: str,
        entity_name: str,
        source_type: str
    ) -> Dict[str, Any]:
        """
        Extract leadership information from content using Claude.

        Args:
            content: Text content to parse
            entity_name: Name of the entity
            source_type: Type of source (Wikipedia, Official Website, LinkedIn)

        Returns:
            Dict with 'people' list containing {name, role, linkedin_url, confidence, influence_level}
        """
        if not self.claude_client:
            return {'people': []}

        try:
            prompt = f"""Extract leadership and executive information from this {source_type} content about {entity_name}.

Content (first 6000 chars):
{content[:6000]}

Extract and return ONLY a JSON object (no markdown):
{{
  "people": [
    {{
      "name": "Full Name",
      "role": "Job Title (e.g., CEO, Chief Executive, Commercial Director)",
      "linkedin_url": "LinkedIn profile URL if found, otherwise empty string",
      "confidence": 75-100 based on how clearly the information is presented,
      "influence_level": "HIGH" for C-level executives, "MEDIUM" for directors, "LOW" for managers
    }}
  ]
}}

Rules:
- Only include people who are clearly executives, directors, or senior leaders
- Use real names found in the content, never make up names
- If no clear leadership information is found, return {{"people": []}}
- confidence should be 90-100 for official bios/pages, 75-85 for mentions
- Return ONLY valid JSON, no other text"""

            result = await self.claude_client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=800
            )

            import json
            import re

            response_text = result.get('content', '')
            json_match = re.search(r'\{[\s\S]*?\}', response_text)
            if json_match:
                try:
                    extracted = json.loads(json_match.group(0))
                    if 'people' in extracted:
                        return extracted
                except json.JSONDecodeError:
                    pass

            return {'people': []}

        except Exception as e:
            logger.warning(f"Leadership extraction from {source_type} failed: {e}")
            return {'people': []}

    async def _extract_names_from_text(
        self,
        text: str,
        entity_name: str
    ) -> List[Dict[str, Any]]:
        """
        Extract executive names from press release text using Claude.

        Args:
            text: Text content (title + snippet)
            entity_name: Entity name

        Returns:
            List of {name, role, confidence, influence_level}
        """
        if not self.claude_client:
            return []

        try:
            prompt = f"""Extract executive names from this press announcement about {entity_name}.

Text: {text}

Extract and return ONLY a JSON object:
{{
  "names": [
    {{
      "name": "Full Name (person being appointed or mentioned)",
      "role": "Job Title being appointed or held",
      "confidence": 70-85 (press mentions are reliable but may lack full detail),
      "influence_level": "HIGH" for C-level, "MEDIUM" for directors
    }}
  ]
}}

Only include people who are clearly being appointed to or holding executive positions.
Return ONLY valid JSON."""

            result = await self.claude_client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=500
            )

            import json
            import re

            response_text = result.get('content', '')
            json_match = re.search(r'\{[\s\S]*?\}', response_text)
            if json_match:
                try:
                    extracted = json.loads(json_match.group(0))
                    return extracted.get('names', [])
                except json.JSONDecodeError:
                    pass

            return []

        except Exception as e:
            logger.debug(f"Name extraction failed: {e}")
            return []

    async def _extract_fields_from_wikipedia(self, content: str, entity_name: str) -> Dict[str, Any]:
        """
        Extract entity fields from Wikipedia content using Claude.

        Wikipedia typically has structured infoboxes with reliable data.
        """
        try:
            from backend.claude_client import ClaudeClient

            client = ClaudeClient()

            prompt = f"""Extract the following information from this Wikipedia article about {entity_name}:

Wikipedia Content (first 4000 chars):
{content[:4000]}

Extract and return ONLY a JSON object (no markdown):
{{
  "founded": "year (4 digits) or null",
  "stadium": "stadium name or null",
  "capacity": "capacity or null",
  "website": "official website URL or null",
  "league": "league name or null",
  "country": "country or null",
  "hq": "headquarters location or null"
}}

Use null for any information not found in the article. Return ONLY valid JSON."""

            result = await client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=500
            )

            import json
            import re

            response_text = result.get('content', '')
            json_match = re.search(r'\{[^{}]*\}', response_text)
            if json_match:
                try:
                    extracted = json.loads(json_match.group(0))
                    return {k: v for k, v in extracted.items() if v is not None}
                except json.JSONDecodeError:
                    pass

            return {}

        except Exception as e:
            logger.warning(f"Wikipedia extraction failed: {e}")
            return {}

    async def _extract_fields_from_content(self, content: str, entity_name: str) -> Dict[str, Any]:
        """
        Extract entity fields from website content.
        """
        try:
            from backend.claude_client import ClaudeClient

            client = ClaudeClient()

            prompt = f"""Extract the following information from this website content about {entity_name}:

Website Content (first 3000 chars):
{content[:3000]}

Extract and return ONLY a JSON object:
{{
  "founded": "Year founded (4 digits) or null",
  "stadium": "Stadium or venue name or null",
  "capacity": "Capacity or null",
  "website": "Official website URL or null",
  "employees": "Employee count or null",
  "hq": "Headquarters location or null"
}}

Use null for information not found. Return ONLY valid JSON."""

            result = await client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=500
            )

            import json
            import re

            response_text = result.get('content', '')
            json_match = re.search(r'\{[^{}]*\}', response_text)
            if json_match:
                try:
                    extracted = json.loads(json_match.group(0))
                    return {k: v for k, v in extracted.items() if v is not None}
                except json.JSONDecodeError:
                    pass

            return {}

        except Exception as e:
            logger.warning(f"Content extraction failed: {e}")
            return {}

    async def _extract_single_field(self, content: str, entity_name: str, field: str) -> Dict[str, Any]:
        """
        Extract a single field value from content.
        """
        try:
            from backend.claude_client import ClaudeClient

            client = ClaudeClient()

            field_prompts = {
                "founded": f"What year was {entity_name} founded? Return ONLY a 4-digit year or 'null'.",
                "stadium": f"What is the name of {entity_name}'s stadium? Return ONLY the name or 'null'.",
                "hq": f"Where is {entity_name} headquartered? Return ONLY the location or 'null'.",
                "employees": f"How many employees does {entity_name} have? Return ONLY the number or 'null'."
            }

            prompt = field_prompts.get(field, f"Extract {field} for {entity_name}")

            result = await client.query(
                prompt=f"""{prompt}

Content:
{content[:2000]}

Return ONLY the value (no extra text).""",
                model="haiku",
                max_tokens=100
            )

            response_text = result.get('content', '').strip()

            # Clean up response
            if response_text.lower() in ['null', 'not found', 'unknown', 'n/a']:
                return {field: None}

            # Try to extract year for founded field
            if field == "founded":
                import re
                year_match = re.search(r'\d{4}', response_text)
                if year_match:
                    response_text = year_match.group(0)

            return {field: response_text}

        except Exception as e:
            logger.warning(f"Single field extraction failed for {field}: {e}")
            return {}
        """
        Scrape official website for entity details

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            ScrapedContent with entity details or None
        """
        if not self._brightdata_available or not self.brightdata_client:
            logger.warning("BrightData not available for scraping")
            return None

        try:
            # Step 1: Search for official website
            logger.info(f"🔍 Searching for official website: {entity_name}")
            search_results = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            if search_results.get('status') != 'success':
                logger.warning(f"Search failed for {entity_name}")
                return None

            results = search_results.get('results', [])
            if not results:
                logger.warning(f"No search results for {entity_name}")
                return None

            # Step 2: Find official website URL
            official_url = None
            for result in results[:5]:
                url = result.get('url', '')
                title = result.get('title', '').lower()
                snippet = result.get('snippet', '').lower()

                # Look for official site indicators
                if (entity_name.lower().replace(' ', '') in url.lower() or
                    'official' in title or 'official' in snippet or
                    '.com' in url and 'wikipedia' not in url and 'espn' not in url):
                    official_url = url
                    logger.info(f"✅ Found official website: {official_url}")
                    break

            if not official_url:
                # Fallback: use first result
                official_url = results[0].get('url', '')
                logger.info(f"⚠️ Using fallback URL: {official_url}")

            # Step 3: Scrape official website content
            logger.info(f"📄 Scraping content from {official_url}")
            scrape_result = await self.brightdata_client.scrape_as_markdown(official_url)

            if scrape_result.get('status') != 'success':
                logger.warning(f"Scraping failed for {official_url}")
                return None

            content = scrape_result.get('content', '')
            if not content:
                logger.warning(f"No content scraped from {official_url}")
                return None

            # Step 4: Extract entity properties using AI
            extracted_data = await self._extract_entity_properties(content, entity_name)

            extracted_website = self._normalize_http_url(extracted_data.get("website"))
            if extracted_website:
                extracted_data["website"] = extracted_website
                if self._is_commerce_host(official_url) and not self._is_commerce_host(extracted_website):
                    logger.info(
                        "♻️ Promoting extracted canonical website over commerce domain for %s: %s -> %s",
                        entity_name,
                        official_url,
                        extracted_website,
                    )
                    official_url = extracted_website
                    self._store_cached_official_site_url(entity_name, official_url)

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
            return scraped_content, extracted_data

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
            from backend.claude_client import ClaudeClient

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

            response_text = result.get('content', '')

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
            connected = await self._connect_brightdata()
            if not connected or not self.brightdata_client:
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
            "freshness_score": 0
        }

        # Source 1: Official website
        try:
            logger.info(f"📄 Scraping official website for {entity_name}")
            site_result = await self._scrape_official_site(entity_name)
            if site_result:
                results["official_site"] = site_result
                results["sources_used"].append("official_website")
                logger.info(f"✅ Official website scraped: {site_result.get('url')}")
        except Exception as e:
            logger.warning(f"⚠️ Official website scraping failed: {e}")

        # Source 2: Job postings (digital/tech roles)
        try:
            logger.info(f"💼 Scraping job postings for {entity_name}")
            jobs_result = await self.brightdata_client.scrape_jobs_board(
                entity_name=entity_name,
                keywords=["CRM", "Digital", "Data", "Analytics", "Marketing", "Technology", "CRM", "Cloud"]
            )
            if jobs_result.get('status') == 'success':
                jobs = jobs_result.get('results', [])[:10]  # Limit to 10 most recent
                results["job_postings"] = jobs
                results["sources_used"].append("job_postings")
                logger.info(f"✅ Found {len(jobs)} relevant job postings")
        except Exception as e:
            logger.warning(f"⚠️ Job posting scraping failed: {e}")

        # Source 3: Press releases and news
        try:
            logger.info(f"📰 Scraping press releases for {entity_name}")
            press_result = await self.brightdata_client.scrape_press_release(entity_name=entity_name)
            if press_result.get('status') == 'success':
                press = press_result.get('results', [])[:10]  # Limit to 10 most recent
                results["press_releases"] = press
                results["sources_used"].append("press_releases")
                logger.info(f"✅ Found {len(press)} press releases")
        except Exception as e:
            logger.warning(f"⚠️ Press release scraping failed: {e}")

        # Source 4: LinkedIn (company page and posts)
        try:
            logger.info(f"💼 Searching LinkedIn for {entity_name}")
            linkedin_search = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" site:linkedin.com/company',
                engine='google',
                num_results=5
            )
            if linkedin_search.get('status') == 'success':
                linkedin_results = linkedin_search.get('results', [])
                results["linkedin_posts"] = linkedin_results
                results["sources_used"].append("linkedin")
                logger.info(f"✅ Found {len(linkedin_results)} LinkedIn references")
        except Exception as e:
            logger.warning(f"⚠️ LinkedIn scraping failed: {e}")

        # Calculate freshness score based on recency and source count
        freshness_score = self._calculate_freshness_score(results)
        results["freshness_score"] = freshness_score

        logger.info(f"✅ Multi-source collection complete: {len(results['sources_used'])} sources, freshness: {freshness_score}/100")

        return results

    async def _scrape_official_site(self, entity_name: str) -> Optional[Dict[str, Any]]:
        """
        Scrape official website for entity details

        Args:
            entity_name: Entity name to search for

        Returns:
            Dict with url, content, summary, and metadata
        """
        if not self._brightdata_available or not self.brightdata_client:
            return None

        try:
            # Search for official website
            search_results = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            if search_results.get('status') != 'success':
                return None

            results = search_results.get('results', [])
            if not results:
                return None

            # Find official website URL
            official_url = None
            for result in results[:5]:
                url = result.get('url', '')
                title = result.get('title', '').lower()
                snippet = result.get('snippet', '').lower()

                if (entity_name.lower().replace(' ', '') in url.lower() or
                    'official' in title or 'official' in snippet or
                    '.com' in url and 'wikipedia' not in url and 'espn' not in url):
                    official_url = url
                    break

            if not official_url:
                official_url = results[0].get('url', '')

            # Scrape official website content
            scrape_result = await self.brightdata_client.scrape_as_markdown(official_url)

            if scrape_result.get('status') != 'success':
                return None

            content = scrape_result.get('content', '')
            if not content:
                return None

            # Generate summary (first 500 chars)
            summary = content[:500] + "..." if len(content) > 500 else content

            return {
                "url": official_url,
                "content": content,
                "summary": summary,
                "word_count": len(content.split()),
                "source": "official_website",
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

    async def collect_leadership(
        self,
        entity_id: str,
        entity_name: str
    ) -> Dict[str, Any]:
        """
        Collect real leadership data using BrightData SDK.

        This is the critical method for eliminating placeholder data like {CTO}
        from dossier sections. It scrapes:
        1. Job postings for executive roles (CTO, CDO, Commercial Director, etc.)
        2. Press releases for executive appointments
        3. LinkedIn company pages for leadership mentions
        4. Official website "About" pages

        Args:
            entity_id: Unique entity identifier (e.g., "arsenal-fc")
            entity_name: Entity name (e.g., "Arsenal FC")

        Returns:
            Dict with:
            - decision_makers: List of {name, role, linkedin_url, confidence}
            - sources_used: List of data sources that worked
            - fresh_signals_count: Number of recent hiring/appointment signals
            - raw_leadership_data: Full scraped data for reference
        """
        logger.info(f"🎯 Collecting leadership data for {entity_name}")

        # Ensure BrightData is connected
        if not self._brightdata_available:
            connected = await self._connect_brightdata()
            if not connected or not self.brightdata_client:
                logger.warning("BrightData not available for leadership collection")
                return {
                    "decision_makers": [],
                    "sources_used": [],
                    "fresh_signals_count": 0,
                    "raw_leadership_data": {}
                }

        results = {
            "decision_makers": [],
            "sources_used": [],
            "fresh_signals_count": 0,
            "raw_leadership_data": {}
        }

        # Executive role keywords to search for
        executive_keywords = [
            "Commercial Director",
            "Chief Executive",
            "CEO",
            "Managing Director",
            "MD",
            "Technical Director",
            "CTO",
            "Chief Technology Officer",
            "Chief Digital Officer",
            "CDO",
            "Head of Digital",
            "Director of Operations",
            "Chief Operating Officer",
            "COO",
            "Marketing Director",
            "Head of Marketing",
            "Finance Director",
            "CFO",
            "Chief Financial Officer"
        ]

        # Source 1: Job postings for executive roles
        try:
            logger.info(f"💼 Searching executive job postings for {entity_name}")
            jobs_result = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" {" OR ".join(executive_keywords[:5])} job vacancy',
                engine="google",
                num_results=10
            )

            if jobs_result.get('status') == 'success':
                jobs = jobs_result.get('results', [])[:10]
                results["raw_leadership_data"]["job_postings"] = jobs
                results["sources_used"].append("job_postings")

                # Extract leadership hints from job postings
                fresh_signals = 0
                for job in jobs:
                    title = job.get('title', '').lower()
                    snippet = job.get('snippet', '').lower()

                    # Check for executive role keywords
                    for keyword in executive_keywords:
                        if keyword.lower() in title or keyword.lower() in snippet:
                            fresh_signals += 1
                            break

                results["fresh_signals_count"] += fresh_signals
                logger.info(f"✅ Found {len(jobs)} job postings with {fresh_signals} executive signals")
        except Exception as e:
            logger.warning(f"⚠️ Job postings search failed: {e}")

        # Source 2: LinkedIn company page for leadership
        try:
            logger.info(f"💼 Searching LinkedIn for {entity_name} leadership")
            linkedin_result = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" site:linkedin.com/company "leadership" OR "team" OR "board"',
                engine="google",
                num_results=5
            )

            if linkedin_result.get('status') == 'success':
                linkedin_results = linkedin_result.get('results', [])
                results["raw_leadership_data"]["linkedin"] = linkedin_results
                results["sources_used"].append("linkedin")
                logger.info(f"✅ Found {len(linkedin_results)} LinkedIn references")
        except Exception as e:
            logger.warning(f"⚠️ LinkedIn search failed: {e}")

        # Source 3: Press releases for executive appointments
        try:
            logger.info(f"📰 Searching press releases for {entity_name} appointments")
            press_result = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" appoints OR "appointed" OR "named" {" OR ".join(executive_keywords[:8])}',
                engine="google",
                num_results=10
            )

            if press_result.get('status') == 'success':
                press = press_result.get('results', [])[:10]
                results["raw_leadership_data"]["press_releases"] = press
                results["sources_used"].append("press_releases")
                logger.info(f"✅ Found {len(press)} press releases about appointments")
        except Exception as e:
            logger.warning(f"⚠️ Press release search failed: {e}")

        # Source 4: Official website leadership/board page
        try:
            logger.info(f"🌐 Searching official site for {entity_name} leadership")
            site_result = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" "leadership team" OR "board" OR "executives" OR "management" site:{entity_name.lower().replace(" ", "")}.com OR site:{entity_name.lower().replace(" ", "")}.co.uk OR site:{entity_name.lower().replace(" ", "")}.org',
                engine="google",
                num_results=5
            )

            if site_result.get('status') == 'success':
                site_results = site_result.get('results', [])
                results["raw_leadership_data"]["official_site"] = site_results
                results["sources_used"].append("official_site")
                logger.info(f"✅ Found {len(site_results)} official site pages")

                # Scrape the most relevant leadership page
                if site_results:
                    leadership_url = site_results[0].get('url', '')
                    if leadership_url:
                        scrape_result = await self.brightdata_client.scrape_as_markdown(leadership_url)
                        if scrape_result.get('status') == 'success':
                            content = scrape_result.get('content', '')
                            results["raw_leadership_data"]["leadership_page_content"] = content[:5000]
        except Exception as e:
            logger.warning(f"⚠️ Official site leadership search failed: {e}")

        # Use Claude to extract real names from scraped data
        if results["raw_leadership_data"]:
            try:
                decision_makers = await self._extract_leadership_from_scraped(
                    entity_name,
                    results["raw_leadership_data"]
                )
                results["decision_makers"] = decision_makers
                logger.info(f"✅ Extracted {len(decision_makers)} decision makers")

                # NEW: Search for individual LinkedIn profiles
                decision_makers_with_linkedin = await self._search_linkedin_profiles(
                    entity_name,
                    decision_makers
                )
                results["decision_makers"] = decision_makers_with_linkedin
                logger.info(f"✅ Found LinkedIn profiles for {sum(1 for dm in decision_makers_with_linkedin if dm.get('linkedin_url'))} decision makers")
            except Exception as e:
                logger.warning(f"⚠️ Leadership extraction failed: {e}")

        logger.info(f"✅ Leadership collection complete: {len(results['decision_makers'])} decision makers, {len(results['sources_used'])} sources")

        return results

    async def _extract_leadership_from_scraped(
        self,
        entity_name: str,
        scraped_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Extract leadership names and roles from scraped data using Claude AI.

        Args:
            entity_name: Name of the entity
            scraped_data: Raw scraped data from various sources

        Returns:
            List of decision maker dicts with name, role, linkedin_url, confidence
        """
        try:
            from backend.claude_client import ClaudeClient

            client = ClaudeClient()

            # Build context from scraped data
            context_parts = []

            if "job_postings" in scraped_data:
                jobs = scraped_data["job_postings"][:5]
                context_parts.append("JOB POSTINGS:")
                for job in jobs:
                    context_parts.append(f"- {job.get('title', '')}: {job.get('snippet', '')}")

            if "press_releases" in scraped_data:
                press = scraped_data["press_releases"][:5]
                context_parts.append("\nPRESS RELEASES:")
                for pr in press:
                    context_parts.append(f"- {pr.get('title', '')}")

            if "linkedin" in scraped_data:
                linkedin = scraped_data["linkedin"][:3]
                context_parts.append("\nLINKEDIN:")
                for li in linkedin:
                    context_parts.append(f"- {li.get('title', '')}")

            if "leadership_page_content" in scraped_data:
                context_parts.append(f"\nLEADERSHIP PAGE:\n{scraped_data['leadership_page_content'][:2000]}")

            context = "\n".join(context_parts)

            prompt = f"""Extract REAL leadership names and roles for {entity_name} from this scraped data:

{context}

CRITICAL RULES:
1. Extract ONLY real names - NO placeholders like {{Commercial Director}}
2. If a name is not found, use "unknown" for that role
3. Include confidence scores (0-100) for each extraction
4. Focus on decision-making roles: Commercial Director, CEO, CTO, CDO, Head of Digital, etc.

Return JSON:
{{
  "decision_makers": [
    {{
      "name": "REAL NAME or 'unknown'",
      "role": "specific title",
      "influence_level": "HIGH|MEDIUM|LOW",
      "confidence": 0-100,
      "source": "job_posting|press_release|linkedin|official_site",
      "linkedin_url": "URL if detected"
    }}
  ]
}}

If you cannot find ANY real names, return an empty array - do not invent names."""

            result = await client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=1500
            )

            response_text = result.get('content', '')

            # Parse JSON response
            import json
            import re

            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                extracted = json.loads(json_match.group(0))
                return extracted.get('decision_makers', [])
            else:
                logger.warning("Could not parse leadership extraction response")
                return []

        except Exception as e:
            logger.error(f"❌ Leadership extraction failed: {e}")
            return []

    async def _search_linkedin_profiles(
        self,
        entity_name: str,
        decision_makers: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Search LinkedIn for individual profile URLs for each decision maker.

        Args:
            entity_name: Entity name for context
            decision_makers: List of decision maker dicts with name and role

        Returns:
            Updated decision_makers with linkedin_url added where found
        """
        logger.info(f"🔍 Searching LinkedIn profiles for {len(decision_makers)} decision makers")

        for dm in decision_makers:
            name = dm.get('name', '')
            if not name or name == 'unknown':
                continue

            try:
                # Search for person's LinkedIn profile
                logger.debug(f"  Searching LinkedIn for: {name}")
                linkedin_search = await self.brightdata_client.search_engine(
                    query=f'"{name}" "{entity_name}" site:linkedin.com/in',
                    engine="google",
                    num_results=3
                )

                if linkedin_search.get('status') == 'success':
                    results = linkedin_search.get('results', [])

                    # Look for LinkedIn profile URLs in results
                    for result in results:
                        url = result.get('url', '')
                        if 'linkedin.com/in/' in url:
                            dm['linkedin_url'] = url
                            logger.info(f"  ✅ Found LinkedIn for {name}: {url}")
                            break
                    else:
                        dm['linkedin_url'] = None
                else:
                    dm['linkedin_url'] = None

            except Exception as e:
                logger.debug(f"  ⚠️ LinkedIn search failed for {name}: {e}")
                dm['linkedin_url'] = None

        return decision_makers

    async def collect_digital_transformation_data(self, entity_id: str, entity_name: str) -> Dict[str, Any]:
        """
        Collect real digital transformation data for Section 2.

        Detects actual technology stack by:
        1. Parsing HTML/JavaScript for tech fingerprints (React, Vue, Angular, etc.)
        2. Analyzing job postings for tech requirements
        3. Detecting analytics scripts (Google Analytics, Adobe, etc.)
        4. Finding CRM/tech partner mentions in content

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity name

        Returns:
            Dict with tech_stack, digital_maturity_signals, vendor_relationships
        """
        logger.info(f"🔧 Collecting digital transformation data for {entity_name}")

        if not self._brightdata_available:
            return {"tech_stack": {}, "digital_maturity_signals": [], "vendor_relationships": [], "capability_gaps": [], "sources_used": []}

        result = {
            "tech_stack": {},
            "digital_maturity_signals": [],
            "vendor_relationships": [],
            "capability_gaps": [],
            "sources_used": []
        }

        # First get the official website URL
        official_url = None
        try:
            site_search = await self.brightdata_client.search_engine(
                query=f'"{entity_name}" official website',
                engine="google",
                num_results=5
            )

            if site_search.get('status') == 'success':
                for r in site_search.get('results', []):
                    url = r.get('url', '')
                    if 'wikipedia' not in url:
                        official_url = url
                        break
        except Exception as e:
            logger.warning(f"Failed to find official URL: {e}")

        if not official_url:
            return result

        # Source 1: Tech stack detection from HTML
        try:
            logger.info(f"  🔍 Detecting tech stack from {official_url}")

            # Scrape the full HTML (not markdown) to detect scripts
            scrape_result = await self.brightdata_client.scrape_as_markdown(official_url)

            if scrape_result.get('status') == 'success':
                content = scrape_result.get('content', '')

                # Detect technology fingerprints using Claude
                tech_prompt = f"""Analyze this website content and detect the technology stack used by {entity_name}.

Content (first 8000 chars):
{content[:8000]}

Look for evidence of:
- Frontend frameworks: React, Vue, Angular, Next.js, Nuxt, Svelte
- Backend: Node.js, Python, PHP, Java, .NET
- CMS: WordPress, Drupal, Contentful, Sanity
- Analytics: Google Analytics, Adobe Analytics, Mixpanel, Amplitude
- CRM: Salesforce, HubSpot
- E-commerce: Shopify, Magento, Custom
- CDN: Cloudflare, AWS CloudFront, Akamai
- Payment: Stripe, PayPal, Adyen

Return ONLY JSON:
{{
  "frontend": "detected framework or 'unknown'",
  "backend": "detected backend or 'unknown'",
  "cms": "detected CMS or 'unknown'",
  "analytics": "detected analytics or 'none'",
  "crm": "detected CRM or 'unknown'",
  "ecommerce": "detected e-commerce or 'none'",
  "cdn": "detected CDN or 'none'",
  "confidence": "high" if clear evidence found, "medium" if partial, "low" if inferred",
  "evidence": ["list of specific clues found"]
}}

Use 'unknown' if no evidence found. Be conservative - only report what you can actually see."""

                response = await self.claude_client.query(
                    prompt=tech_prompt,
                    model="haiku",
                    max_tokens=500
                )

                import json
                import re

                response_text = response.get('content', '')
                json_match = re.search(r'\{[\s\S]*?\}', response_text)
                if json_match:
                    try:
                        tech_data = json.loads(json_match.group(0))
                        result["tech_stack"] = tech_data
                        result["sources_used"].append("HTML Analysis")
                        logger.info(f"    ✅ Tech stack detected: {tech_data.get('frontend', 'N/A')}")
                    except json.JSONDecodeError:
                        pass

        except Exception as e:
            logger.warning(f"  ⚠️ Tech stack detection failed: {e}")

        # Source 2: Job postings for tech requirements
        try:
            logger.info(f"  💼 Analyzing job postings for tech requirements...")

            tech_job_queries = [
                f'"{entity_name}" "software engineer" job',
                f'"{entity_name}" "data analyst" job',
                f'"{entity_name}" "CRM" job',
                f'"{entity_name}" "Salesforce" job',
                f'"{entity_name}" "developer" job'
            ]

            tech_keywords_found = set()

            for query in tech_job_queries[:3]:
                job_search = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=3
                )

                if job_search.get('status') == 'success':
                    for job_result in job_search.get('results', []):
                        snippet = job_result.get('snippet', '').lower()
                        title = job_result.get('title', '').lower()

                        # Look for tech keywords
                        tech_indicators = [
                            'react', 'angular', 'vue', 'nodejs', 'python', 'java',
                            'salesforce', 'hubspot', 'sap', 'oracle', 'aws', 'azure',
                            'google cloud', 'azure', 'aws', 'tableau', 'powerbi',
                            'sql', 'nosql', 'mongodb', 'postgresql', 'snowflake',
                            'docker', 'kubernetes', 'git', 'jenkins'
                        ]

                        for indicator in tech_indicators:
                            if indicator in snippet or indicator in title:
                                tech_keywords_found.add(indicator)

            if tech_keywords_found:
                result["digital_maturity_signals"].append({
                    "type": "tech_hiring",
                    "technologies": list(tech_keywords_found),
                    "confidence": 85,
                    "source": "job_postings"
                })
                result["sources_used"].append("Job Postings")
                logger.info(f"    ✅ Tech keywords in jobs: {tech_keywords_found}")

        except Exception as e:
            logger.warning(f"  ⚠️ Job posting analysis failed: {e}")

        # Source 3: Press releases for vendor partnerships
        try:
            logger.info(f"  📰 Scanning press releases for vendor partnerships...")

            partnership_queries = [
                f'"{entity_name}" partnership "digital"',
                f'"{entity_name}" partnership "technology"',
                f'"{entity_name}" announces partnership with'
            ]

            vendors_found = []

            for query in partnership_queries[:2]:
                press_search = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=3
                )

                if press_search.get('status') == 'success':
                    for press_result in press_search.get('results', []):
                        snippet = press_result.get('snippet', '')
                        title = press_result.get('title', '')

                        # Look for well-known tech vendors
                        major_vendors = [
                            'Salesforce', 'HubSpot', 'Adobe', 'Microsoft', 'Google',
                            'AWS', 'Amazon', 'Oracle', 'SAP', 'IBM',
                            'NTT DATA', 'Infosys', 'Wipro', 'Accenture',
                            'Epicor', 'Ticketmaster', 'SeatGeek'
                        ]

                        for vendor in major_vendors:
                            if vendor.lower() in snippet.lower() or vendor.lower() in title.lower():
                                vendors_found.append({
                                    "vendor": vendor,
                                    "context": snippet[:100],
                                    "source_url": press_result.get('url', '')
                                })

            if vendors_found:
                result["vendor_relationships"] = vendors_found
                result["sources_used"].append("Press Releases")
                logger.info(f"    ✅ Vendor partnerships found: {[v['vendor'] for v in vendors_found]}")

        except Exception as e:
            logger.warning(f"  ⚠️ Press release scanning failed: {e}")

        logger.info(f"✅ Digital transformation data collected from {len(result.get('sources_used', []))} sources")
        return result

    async def collect_recent_news_data(self, entity_id: str, entity_name: str, days_back: int = 90) -> Dict[str, Any]:
        """
        Collect real recent news for Section 7.

        Scrapes:
        1. Major sports news sites (BBC Sport, Sky Sports, ESPN)
        2. Official club news pages
        3. General news mentions (partnerships, signings, etc.)

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity name
            days_back: How many days to look back

        Returns:
            Dict with news_items, relevance_signals, category_breakdown
        """
        logger.info(f"📰 Collecting recent news for {entity_name}")

        if not self._brightdata_available:
            return {"news_items": [], "sources": []}

        result = {
            "news_items": [],
            "sources_used": []
        }

        # News sources to search
        news_queries = [
            f'{entity_name} news BBC Sport',
            f'{entity_name} news Sky Sports',
            f'{entity_name} news official site',
            f'{entity_name} partnership announcement',
            f'{entity_name} signing transfer news'
        ]

        seen_urls = set()

        for query in news_queries[:4]:
            try:
                search_results = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=5
                )

                if search_results.get('status') == 'success':
                    for item in search_results.get('results', []):
                        url = item.get('url', '')

                        # Skip duplicates
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        # Extract news data using Claude
                        try:
                            scrape = await self.brightdata_client.scrape_as_markdown(url)
                            if scrape.get('status') == 'success':
                                content = scrape.get('content', '')[:3000]

                                news_prompt = f"""Extract key news information from this article about {entity_name}.

Content:
{content}

Extract and return ONLY JSON:
{{
  "headline": "main headline or title",
  "date": "date mentioned or 'recent'",
  "category": "partnership|signing|performance|stadium|finance|other",
  "summary": "2-3 sentence summary",
  "relevance_score": 85-100 based on how relevant to business partnerships/tech
}}

Return ONLY valid JSON."""

                                response = await self.claude_client.query(
                                    prompt=news_prompt,
                                    model="haiku",
                                    max_tokens=300
                                )

                                import json
                                import re

                                response_text = response.get('content', '')
                                json_match = re.search(r'\{[\s\S]*?\}', response_text)
                                if json_match:
                                    try:
                                        news_data = json.loads(json_match.group(0))
                                        news_data['source_url'] = url
                                        news_data['source_site'] = self._extract_site_name(url)

                                        # Only include high-relevance items
                                        if news_data.get('relevance_score', 0) >= 70:
                                            result["news_items"].append(news_data)
                                    except json.JSONDecodeError:
                                        pass

                        except Exception as e:
                            logger.debug(f"    Failed to scrape news item: {e}")
                            continue

            except Exception as e:
                logger.debug(f"News query failed: {query} - {e}")
                continue

        # Sort by relevance and limit
        result["news_items"].sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        result["news_items"] = result["news_items"][:10]

        # Count sources
        if result["news_items"]:
            result["sources_used"] = list(set(item.get('source_site', 'unknown') for item in result["news_items"]))

        logger.info(f"✅ Recent news collected: {len(result['news_items'])} items from {len(result['sources_used'])} sources")
        return result

    def _extract_site_name(self, url: str) -> str:
        """Extract site name from URL"""
        from urllib.parse import urlparse

        try:
            parsed = urlparse(url)
            domain = parsed.netloc.replace('www.', '')

            # Clean up common domains
            if 'bbc.co.uk' in domain:
                return 'BBC Sport'
            elif 'skysports' in domain:
                return 'Sky Sports'
            elif 'espn' in domain:
                return 'ESPN'
            elif 'premierleague' in domain:
                return 'Premier League'
            else:
                return domain.split('.')[0].title()
        except:
            return 'unknown'

    async def collect_performance_data(self, entity_id: str, entity_name: str) -> Dict[str, Any]:
        """
        Collect real performance data for Section 8.

        Scrapes:
        1. Premier League table (position, points, goals)
        2. Recent form (last 5 matches)
        3. Key statistics

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity name

        Returns:
            Dict with league_position, points, form, statistics
        """
        logger.info(f"⚽ Collecting performance data for {entity_name}")

        if not self._brightdata_available:
            return {"league_position": "unknown", "points": "unknown"}

        result = {
            "league_position": "unknown",
            "points": "unknown",
            "wins": "unknown",
            "draws": "unknown",
            "losses": "unknown",
            "goals_for": "unknown",
            "goals_against": "unknown",
            "goal_difference": "unknown",
            "recent_form": [],
            "sources_used": []
        }

        try:
            # Search for Premier League table or club stats
            search_queries = [
                f'{entity_name} Premier League table 2025 position points',
                f'{entity_name} Premier League stats',
                f'Premier League table 2025 standings {entity_name}'
            ]

            for query in search_queries[:2]:
                search_results = await self.brightdata_client.search_engine(
                    query=query,
                    engine="google",
                    num_results=3
                )

                if search_results.get('status') == 'success':
                    for item in search_results.get('results', []):
                        url = item.get('url', '')

                        # Prioritize official Premier League site
                        if 'premierleague.com' in url:
                            logger.info(f"  ⚽ Scraping Premier League data: {url}")

                            try:
                                scrape = await self.brightdata_client.scrape_as_markdown(url)
                                if scrape.get('status') == 'success':
                                    content = scrape.get('content', '')

                                    # Extract performance data using Claude
                                    perf_prompt = f"""Extract Premier League performance data for {entity_name} from this content.

Content:
{content[:5000]}

Extract and return ONLY JSON:
{{
  "position": "league position number or 'unknown'",
  "points": "total points or 'unknown'",
  "wins": "wins or 'unknown'",
  "draws": "draws or 'unknown'",
  "losses": "losses or 'unknown'",
  "goals_for": "goals scored or 'unknown'",
  "goals_against": "goals conceded or 'unknown'",
  "goal_difference": "goal difference (+/-) or 'unknown'",
  "recent_form": ["list of last 5 results W/D/L"] or [],
  "season": "current season or 'unknown'"
}}

Return ONLY valid JSON."""

                                    response = await self.claude_client.query(
                                        prompt=perf_prompt,
                                        model="haiku",
                                        max_tokens=300
                                    )

                                    import json
                                    import re

                                    response_text = response.get('content', '')
                                    json_match = re.search(r'\{[\s\S]*?\}', response_text)
                                    if json_match:
                                        try:
                                            perf_data = json.loads(json_match.group(0))

                                            # Update result with found data
                                            for key, value in perf_data.items():
                                                if value != 'unknown':
                                                    result[key] = value

                                            result["sources_used"].append("Premier League")
                                            logger.info(f"    ✅ Performance data: position {result.get('position')}, {result.get('points')} points")

                                            # Got data, stop searching
                                            break
                                        except json.JSONDecodeError:
                                            pass

                            except Exception as e:
                                logger.debug(f"Failed to scrape PL data: {e}")

                    if result["league_position"] != "unknown":
                        break  # Got the data we need

        except Exception as e:
            logger.warning(f"Performance data collection failed: {e}")

        logger.info(f"✅ Performance data: position {result['league_position']}, {result['points']} points")
        return result

    async def collect_strategic_opportunities(self, entity_id: str, entity_name: str) -> Dict[str, Any]:
        """
        Collect real strategic opportunity data for Section 4.

        Scrapes:
        1. Press releases for new initiatives
        2. Job postings for expansion roles
        3. Partnership announcements
        4. Stadium/facility development news

        Args:
            entity_id: Unique entity identifier
            entity_name: Entity name

        Returns:
            Dict with opportunities, timeline, budget_indicators
        """
        logger.info(f"🎯 Collecting strategic opportunities for {entity_name}")

        if not self._brightdata_available:
            return {"opportunities": [], "sources": []}

        result = {
            "opportunities": [],
            "sources_used": []
        }

        opportunity_keywords = [
            ('expansion', ['expansion', 'grow', 'new market', 'international']),
            ('digital', ['digital platform', 'app launch', 'website', 'technology', 'analytics']),
            ('stadium', ['stadium expansion', 'renovation', 'new stand', 'facility']),
            ('partnership', ['partnership', 'sponsor', 'collaboration', 'joint venture']),
            ('sustainability', ['sustainability', 'green', 'environmental', 'carbon'])
        ]

        for opp_type, keywords in opportunity_keywords:
            try:
                for keyword in keywords[:2]:
                    query = f'"{entity_name}" {keyword}'
                    search_results = await self.brightdata_client.search_engine(
                        query=query,
                        engine="google",
                        num_results=3
                    )

                    if search_results.get('status') == 'success':
                        for item in search_results.get('results', []):
                            snippet = item.get('snippet', '')
                            title = item.get('title', '')
                            url = item.get('url', '')

                            # Analyze for opportunity signals
                            opp_prompt = f"""Analyze this news about {entity_name} and identify if it represents a strategic opportunity.

Title: {title}
Snippet: {snippet}

Determine:
1. Is this a strategic opportunity? (partnership, expansion, investment, initiative)
2. What type of opportunity?
3. What's the estimated timeline? (immediate, 0-6 months, 6-18 months, 18+ months)
4. What's the estimated budget level? (low, medium, high)

Return ONLY JSON:
{{
  "is_opportunity": true/false,
  "opportunity_type": "partnership|expansion|digital|stadium|sustainability|other",
  "title": "brief title",
  "description": "1-2 sentence description",
  "timeline": "immediate|0-6 months|6-18 months|18+ months",
  "budget_level": "low|medium|high|unknown",
  "confidence": 70-95
}}

Return ONLY valid JSON."""

                            try:
                                response = await self.claude_client.query(
                                    prompt=opp_prompt,
                                    model="haiku",
                                    max_tokens=250
                                )

                                import json
                                import re

                                response_text = response.get('content', '')
                                json_match = re.search(r'\{[\s\S]*?\}', response_text)
                                if json_match:
                                    try:
                                        opp_data = json.loads(json_match.group(0))
                                        if opp_data.get('is_opportunity') and opp_data.get('confidence', 0) > 70:
                                            opp_data['source_url'] = url
                                            opp_data['source_snippet'] = snippet[:150]
                                            result["opportunities"].append(opp_data)
                                    except json.JSONDecodeError:
                                        pass
                            except Exception:
                                pass

            except Exception:
                continue

        # Deduplicate and rank by confidence
        seen_titles = set()
        unique_opps = []
        for opp in result["opportunities"]:
            title = opp.get('title', '')
            if title and title not in seen_titles:
                seen_titles.add(title)
                unique_opps.append(opp)

        unique_opps.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        result["opportunities"] = unique_opps[:5]

        if result["opportunities"]:
            result["sources_used"] = ["News & Press Releases"]

        logger.info(f"✅ Strategic opportunities: {len(result['opportunities'])} found")
        return result

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
# RALPH LOOP FIELD VALIDATION
# =============================================================================

@dataclass
class FieldValidationResult:
    """Result of validating a single entity field"""
    field_name: str
    value: Optional[str]
    confidence: float  # 0.0 to 1.0
    sources_used: List[str]
    validation_notes: str
    conflicting_data: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.conflicting_data is None:
            self.conflicting_data = []


class RalphLoopFieldValidator:
    """
    Ralph Loop for field-level data validation.

    Uses 3-pass validation for core entity fields:
    - Pass 1: Rule-based filtering (source credibility, format validation)
    - Pass 2: LLM cross-check (detect conflicts, apply confidence scores)
    - Pass 3: Final confirmation (select best source, document decision)

    Fields validated:
    - founded: Year founded (e.g., "1886")
    - stadium: Stadium/venue name (e.g., "Emirates Stadium")
    - website: Official website URL (e.g., "https://arsenal.com")
    - employees: Employee count (e.g., "500-1000")
    - hq: Headquarters location (e.g., "London, England")
    """

    # Source credibility weights
    SOURCE_CREDIBILITY = {
        "official_website": 1.0,
        "wikipedia": 0.9,
        "premier_league": 0.95,
        "uefa": 0.95,
        "fifa": 0.95,
        "sports_database": 0.85,
        "news_article": 0.7,
        "social_media": 0.5,
    }

    FIELD_VALIDATION_RULES = {
        "founded": {
            "pattern": r"^\d{4}$",
            "min_value": 1800,
            "max_value": 2025,
            "required": False,
        },
        "stadium": {
            "min_length": 2,
            "max_length": 100,
            "required": False,
        },
        "website": {
            "pattern": r"^https?://[\w\-.]+(:\d+)?(/[\w\-./?%&=]*)?$",
            "required": False,
        },
        "employees": {
            "pattern": r"^[\d,]+-[\d,]+$|^\d+$",
            "required": False,
        },
        "hq": {
            "min_length": 2,
            "required": False,
        },
    }

    def __init__(self, claude_client=None, brightdata_client=None):
        """
        Initialize the field validator.

        Args:
            claude_client: Optional ClaudeClient for LLM validation
            brightdata_client: Optional BrightDataSDKClient for scraping
        """
        self.claude_client = claude_client
        self.brightdata_client = brightdata_client
        logger.info("✅ RalphLoopFieldValidator initialized")

    async def validate_field(
        self,
        entity_name: str,
        field_name: str,
        raw_sources: List[Dict[str, Any]]
    ) -> FieldValidationResult:
        """
        Validate a single field using 3-pass Ralph Loop.

        Args:
            entity_name: Name of the entity (e.g., "Arsenal FC")
            field_name: Field to validate (founded, stadium, website, employees, hq)
            raw_sources: List of raw data sources with 'value', 'source', 'url' keys

        Returns:
            FieldValidationResult with validated value and confidence
        """
        logger.info(f"🔍 Ralph Loop: Validating {field_name} for {entity_name}")

        # PASS 1: Rule-based filtering
        pass1_candidates = self._pass1_rule_based_filtering(field_name, raw_sources)
        logger.info(f"  Pass 1: {len(pass1_candidates)} candidates passed rules")

        if not pass1_candidates:
            return FieldValidationResult(
                field_name=field_name,
                value=None,
                confidence=0.0,
                sources_used=[],
                validation_notes="No candidates passed rule-based filtering"
            )

        # PASS 2: LLM cross-check
        pass2_ranked = await self._pass2_llm_cross_check(entity_name, field_name, pass1_candidates)
        logger.info(f"  Pass 2: Ranked {len(pass2_ranked)} candidates")

        # PASS 3: Final confirmation
        final_result = self._pass3_final_confirmation(field_name, pass2_ranked)
        logger.info(f"  Pass 3: Final value = {final_result.value} (confidence: {final_result.confidence:.2f})")

        return final_result

    def _pass1_rule_based_filtering(
        self,
        field_name: str,
        raw_sources: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Pass 1: Filter candidates based on rules and source credibility.
        """
        rules = self.FIELD_VALIDATION_RULES.get(field_name, {})

        candidates = []

        for source in raw_sources:
            value = source.get("value", "").strip()
            source_type = source.get("source", "unknown")
            url = source.get("url", "")

            if not value or value.lower() in ["unknown", "n/a", "none", "-"]:
                continue

            # Check format validation
            if "pattern" in rules:
                import re
                if not re.match(rules["pattern"], value, re.IGNORECASE):
                    logger.debug(f"  ❌ Pattern failed: {value} from {source_type}")
                    continue

            # Check range validation for founded year
            if field_name == "founded":
                try:
                    year = int(value)
                    if year < rules.get("min_value", 1800) or year > rules.get("max_value", 2025):
                        continue
                except ValueError:
                    continue

            # Check length validation
            if "min_length" in rules and len(value) < rules["min_length"]:
                continue
            if "max_length" in rules and len(value) > rules["max_length"]:
                continue

            # Calculate source credibility score
            credibility = self.SOURCE_CREDIBILITY.get(source_type, 0.5)

            candidates.append({
                "value": value,
                "source": source_type,
                "url": url,
                "credibility": credibility,
                "raw_source": source
            })

        # Sort by credibility
        candidates.sort(key=lambda x: x["credibility"], reverse=True)

        return candidates[:5]  # Top 5 candidates

    async def _pass2_llm_cross_check(
        self,
        entity_name: str,
        field_name: str,
        candidates: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Pass 2: Use LLM to cross-check candidates and detect conflicts.
        """
        if not self.claude_client:
            # No LLM available, return candidates with credibility as confidence
            for c in candidates:
                c["llm_confidence"] = c["credibility"]
            return candidates

        # Build context for LLM
        context = f"""Entity: {entity_name}
Field: {field_name}

Candidates to evaluate:
"""
        for i, c in enumerate(candidates, 1):
            context += f"{i}. Value: \"{c['value']}\" (Source: {c['source']}, Credibility: {c['credibility']:.2f})\n"

        prompt = f"""{context}

TASK: Analyze these candidates and:
1. Detect if any values conflict (e.g., different years for founded)
2. Identify which value is most likely correct
3. Assign a confidence score (0-100) to each value

Return JSON:
{{
  "analysis": "brief explanation of conflicts and reasoning",
  "ranked_candidates": [
    {{"index": 1, "confidence": 85, "reason": "from official website"}},
    {{"index": 2, "confidence": 70, "reason": "from Wikipedia but agrees with official"}}
  ]
}}

If all candidates agree on the same value, give them all high confidence (90-100).
If there are conflicts, explain in analysis and rank accordingly."""

        try:
            response = await self.claude_client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=500
            )

            import json
            import re

            json_match = re.search(r'\{[\s\S]*\}', response.get("content", ""))
            if json_match:
                result = json.loads(json_match.group(0))

                # Update candidates with LLM confidence
                for ranking in result.get("ranked_candidates", []):
                    idx = ranking["index"] - 1
                    if 0 <= idx < len(candidates):
                        candidates[idx]["llm_confidence"] = ranking["confidence"] / 100
                        candidates[idx]["llm_reason"] = ranking.get("reason", "")

                # Re-sort by LLM confidence
                candidates.sort(key=lambda x: x.get("llm_confidence", x["credibility"]), reverse=True)

        except Exception as e:
            logger.warning(f"LLM cross-check failed: {e}, using source credibility")
            # Fallback to source credibility
            for c in candidates:
                c["llm_confidence"] = c["credibility"]

        return candidates

    def _pass3_final_confirmation(
        self,
        field_name: str,
        ranked_candidates: List[Dict[str, Any]]
    ) -> FieldValidationResult:
        """
        Pass 3: Final confirmation - select best value and document decision.
        """
        if not ranked_candidates:
            return FieldValidationResult(
                field_name=field_name,
                value=None,
                confidence=0.0,
                sources_used=[],
                validation_notes="No candidates available"
            )

        # Select top candidate
        top = ranked_candidates[0]
        value = top["value"]
        llm_conf = top.get("llm_confidence", top["credibility"])
        source_cred = top["credibility"]

        # Combined confidence (weighted average)
        combined_conf = (llm_conf * 0.7) + (source_cred * 0.3)

        # Collect conflicting data
        conflicting = []
        for c in ranked_candidates[1:]:
            if c["value"] != value:
                conflicting.append({
                    "value": c["value"],
                    "source": c["source"],
                    "confidence": c.get("llm_confidence", c["credibility"])
                })

        # Build validation notes
        notes = f"Selected from {top['source']}"
        if "llm_reason" in top:
            notes += f" - {top['llm_reason']}"

        sources_used = [top["source"]]
        if top.get("url"):
            sources_used.append(top["url"])

        return FieldValidationResult(
            field_name=field_name,
            value=value,
            confidence=combined_conf,
            sources_used=sources_used,
            validation_notes=notes,
            conflicting_data=conflicting if conflicting else None
        )

    async def validate_all_core_fields(
        self,
        entity_name: str,
        entity_id: str,
        scraped_data: Dict[str, Any]
    ) -> Dict[str, FieldValidationResult]:
        """
        Validate all core fields for an entity.

        Args:
            entity_name: Name of the entity
            entity_id: Entity ID for reference
            scraped_data: Scraped data containing potential values

        Returns:
            Dict mapping field names to validation results
        """
        results = {}

        # Build raw sources for each field from scraped data
        field_sources = self._extract_field_sources(scraped_data)

        # Fields to validate
        fields_to_validate = ["founded", "stadium", "website", "employees", "hq"]

        for field in fields_to_validate:
            sources = field_sources.get(field, [])
            if sources:
                result = await self.validate_field(entity_name, field, sources)
                results[field] = result
            else:
                # No sources found for this field
                results[field] = FieldValidationResult(
                    field_name=field,
                    value=None,
                    confidence=0.0,
                    sources_used=[],
                    validation_notes="No data sources found"
                )

        return results

    def _extract_field_sources(
        self,
        extracted_data: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract field values from extracted_data dictionary.

        Returns dict mapping field_name -> list of sources with 'value', 'source', 'url'
        """
        field_sources = {
            "founded": [],
            "stadium": [],
            "website": [],
            "employees": [],
            "hq": [],
            "capacity": [],
            "league": [],
            "country": [],
        }

        # Map extracted_data keys to field names with source credibility
        # Wikipedia keys have high credibility, official site keys have highest
        field_mapping = [
            ("founded", "founded", "wikipedia", 0.9),
            ("stadium", "stadium", "wikipedia", 0.9),
            ("capacity", "capacity", "wikipedia", 0.9),
            ("website", "website", "wikipedia", 0.9),
            ("league", "league", "wikipedia", 0.9),
            ("country", "hq", "wikipedia", 0.9),  # country maps to hq
            ("hq", "hq", "wikipedia", 0.9),
            ("official_site_url", "website", "official_website", 1.0),
        ]

        url = extracted_data.get("url", extracted_data.get("wikipedia_url", ""))
        source_type = extracted_data.get("source", extracted_data.get("source_type", "wikipedia"))

        for extracted_key, field_name, default_source, credibility in field_mapping:
            value = extracted_data.get(extracted_key)
            if value and value not in ["null", None, ""]:
                field_sources[field_name].append({
                    "value": str(value),
                    "source": source_type if extracted_key != "official_site_url" else "official_website",
                    "url": url,
                    "credibility": credibility
                })

        return field_sources

    def _extract_fields_from_content(
        self,
        content: str,
        source_type: str,
        url: str
    ) -> Dict[str, Optional[str]]:
        """
        Use LLM to extract field values from content.

        Returns dict with field names as keys and values as values.
        """
        prompt = f"""Extract the following information from this website content:
- Founded year (4 digits, e.g., 1886) - key "founded"
- Stadium name - key "stadium"
- Website URL - key "website"
- Employee count - key "employees"
- Headquarters location - key "hq"

Content (first 3000 chars):
{content[:3000]}

Return ONLY JSON like this (no markdown, no explanation):
{{"founded": "1886", "stadium": "Emirates Stadium", "website": "https://arsenal.com", "employees": null, "hq": "London"}}

Use null if information is not found."""

        try:
            response = self.claude_client.query(
                prompt=prompt,
                model="haiku",
                max_tokens=200
            )

            import json
            import re

            response_text = response.get("content", "")
            # Try to find JSON
            json_match = re.search(r'\{[^{}]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group(0))
                return result
        except Exception as e:
            logger.warning(f"Field extraction from content failed: {e}")

        return {}


async def test_falkordb_integration():
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
