"""
BrightData SDK Client

Direct Python SDK wrapper for BrightData's Web Scraper API.
Used by Claude Agent SDK for template validation and expansion.

Architecture:
- Uses official brightdata-sdk package (not MCP)
- Falls back to httpx + BeautifulSoup if SDK unavailable
- No MCP timeout issues
- Pay-per-success pricing model (when using SDK)
"""

import asyncio
import json
import logging
import re
import time
import random
import hashlib
from typing import Dict, List, Any, Optional
from datetime import datetime
import os
from urllib.parse import parse_qs, unquote, urlparse, urljoin
from urllib.parse import urlencode
import httpx

logger = logging.getLogger(__name__)


class BrightDataSDKClient:
    """
    BrightData Web Scraper API client using official Python SDK

    Features:
    - Generic URL scraping (async batch supported)
    - SERP APIs (Google, Bing, Yandex)
    - Social media scraping (LinkedIn, Instagram, Facebook)
    - Proxy rotation and anti-bot protection
    - Pay-per-success pricing model

    Usage:
        client = BrightDataSDKClient()
        results = await client.search_engine("Arsenal FC CRM", engine="google")
        content = await client.scrape_as_markdown("https://arsenal.com")
    """

    def __init__(self, token: Optional[str] = None):
        """
        Initialize BrightData SDK client

        Args:
            token: Optional API token. If not provided, loads from BRIGHTDATA_API_TOKEN env var
        """
        from dotenv import load_dotenv
        from pathlib import Path

        # Ensure Python SSL trust store is initialized on macOS/Homebrew installs.
        if "SSL_CERT_FILE" not in os.environ:
            try:
                import certifi
                os.environ["SSL_CERT_FILE"] = certifi.where()
            except Exception:
                pass

        # Try current directory first, then parent directory
        env_loaded = load_dotenv()  # Current directory

        # Also try parent directory explicitly (for backend/ scripts)
        parent_env = Path(__file__).parent.parent / '.env'
        if parent_env.exists():
            load_dotenv(parent_env, override=True)
            logger.info(f"✅ Loaded .env from parent directory: {parent_env}")

        # Store token from environment if not provided
        if token is None:
            token = os.getenv('BRIGHTDATA_API_TOKEN')

        self.token = token
        self.request_timeout_seconds = float(os.getenv("BRIGHTDATA_SDK_TIMEOUT_SECONDS", "45"))
        self._client = None
        self._invalid_request_zones = set()
        self._zone_cooldowns: Dict[str, float] = {}
        self._request_zone_whitelist: Optional[set] = None
        self._request_zone_whitelist_checked_at: float = 0.0
        self.serp_poll_attempts = int(os.getenv("BRIGHTDATA_SERP_POLL_ATTEMPTS", "6"))
        self.serp_poll_interval_seconds = float(os.getenv("BRIGHTDATA_SERP_POLL_INTERVAL_SECONDS", "1.2"))
        self._domain_probe_last_run: Dict[str, float] = {}
        self._low_signal_url_cache: Dict[str, Dict[str, Any]] = {}
        self._low_signal_url_cooldown_seconds = float(
            os.getenv("BRIGHTDATA_LOW_SIGNAL_URL_COOLDOWN_SECONDS", "600")
        )
        self.generous_retry_enabled = os.getenv("BRIGHTDATA_GENEROUS_RETRY", "true").strip().lower() in {"1", "true", "yes", "on"}
        self.enable_modern_auto_scrape = os.getenv("BRIGHTDATA_ENABLE_MODERN_AUTO", "false").strip().lower() in {"1", "true", "yes", "on"}
        self.retry_base_backoff_seconds = float(os.getenv("BRIGHTDATA_RETRY_BACKOFF_SECONDS", "1.0"))
        self.retry_backoff_cap_seconds = float(os.getenv("BRIGHTDATA_RETRY_BACKOFF_CAP_SECONDS", "10.0"))
        self.retry_jitter_seconds = float(os.getenv("BRIGHTDATA_RETRY_JITTER_SECONDS", "0.35"))

        if not self.token:
            logger.warning("⚠️ BRIGHTDATA_API_TOKEN not found in environment")

    def _force_brightdata_only(self) -> bool:
        return os.getenv("BRIGHTDATA_FORCE_ONLY", "false").strip().lower() in {"1", "true", "yes", "on"}

    def _resolve_retry_attempts(self, env_key: str, normal_default: int = 2, generous_default: int = 5) -> int:
        generous_retry_enabled = bool(
            getattr(
                self,
                "generous_retry_enabled",
                os.getenv("BRIGHTDATA_GENEROUS_RETRY", "true").strip().lower() in {"1", "true", "yes", "on"},
            )
        )
        default_value = generous_default if generous_retry_enabled else normal_default
        return max(1, int(os.getenv(env_key, str(default_value))))

    def _normalize_low_signal_cache_key(self, url: str) -> str:
        parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
        if not parsed.scheme or not parsed.netloc:
            return str(url or "").strip().lower()
        path = parsed.path or "/"
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}".rstrip("/")

    def _mark_low_signal_url(self, url: str, reason: str) -> None:
        key = self._normalize_low_signal_cache_key(url)
        if not key:
            return
        cache = getattr(self, "_low_signal_url_cache", None)
        if not isinstance(cache, dict):
            cache = {}
            self._low_signal_url_cache = cache
        now = time.time()
        entry = cache.get(key) or {}
        cache[key] = {
            "count": int(entry.get("count", 0) or 0) + 1,
            "last_reason": str(reason or "low_signal"),
            "last_seen": now,
        }

    def _cached_low_signal_entry(self, url: str) -> Optional[Dict[str, Any]]:
        key = self._normalize_low_signal_cache_key(url)
        cache = getattr(self, "_low_signal_url_cache", None)
        if not key or not isinstance(cache, dict):
            return None
        entry = cache.get(key)
        if not isinstance(entry, dict):
            return None
        count = int(entry.get("count", 0) or 0)
        last_seen = float(entry.get("last_seen", 0.0) or 0.0)
        cooldown = float(getattr(self, "_low_signal_url_cooldown_seconds", 600.0) or 600.0)
        if count < 1:
            return None
        if (time.time() - last_seen) > cooldown:
            return None
        return entry

    def _minimum_words_for_url(self, url: str) -> int:
        base = int(os.getenv("BRIGHTDATA_MIN_WORDS", "80"))
        parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
        path = (parsed.path or "/").lower()
        if any(token in path for token in ("/news", "/article", "/press", "/blog")):
            return max(base, int(os.getenv("BRIGHTDATA_MIN_WORDS_NEWS", "120")))
        return base

    def _detect_low_signal_shell(self, *, url: str, content: str, raw_html: str) -> Optional[str]:
        words = len((content or "").split())
        min_words = self._minimum_words_for_url(url)
        if words < min_words:
            return f"thin_content<{min_words}"
        lowered_html = (raw_html or "").lower()
        lowered_content = (content or "").lower()
        nav_tokens = ("fixtures", "matches", "results", "tickets", "shop", "menu")
        nav_hits = sum(1 for token in nav_tokens if token in lowered_html)
        if nav_hits >= 4 and words < max(min_words + 40, 160):
            return "nav_heavy_shell"
        repeated = ["official website", "club website", "cookies", "javascript"]
        repeated_hits = sum(1 for token in repeated if lowered_content.count(token) >= 2)
        if repeated_hits >= 2:
            return "boilerplate_repetition"
        path = (urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}").path or "/").lower()
        if any(path.rstrip("/").endswith(f"/{leaf}") for leaf in ("matches", "fixtures", "news")) and words < max(min_words + 30, 140):
            return "thin_low_signal_leaf"
        return None

    def _entity_grounding_status(self, url: str, content: str) -> str:
        parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
        host = (parsed.netloc or "").lower()
        text = (content or "").lower()
        if host and host.split(".")[0] and host.split(".")[0] in text:
            return "grounded_by_domain_token"
        if host:
            return "domain_only"
        return "unknown"

    def _enrich_provenance(
        self,
        result: Dict[str, Any],
        *,
        lane: str,
        attempt: int,
        selected_candidate_url: Optional[str] = None,
        fallback_reason: Optional[str] = None,
        low_signal_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = dict(result or {})
        metadata = payload.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
        content = str(payload.get("content") or "")
        final_url = str(payload.get("url") or selected_candidate_url or "")
        metadata["lane"] = lane
        metadata["attempt"] = attempt
        metadata["word_count"] = len(content.split())
        metadata["selected_candidate_url"] = selected_candidate_url or final_url or None
        metadata["entity_grounding_status"] = self._entity_grounding_status(final_url, content)
        metadata["extract_hash"] = hashlib.sha256(content.encode("utf-8")).hexdigest() if content else None
        metadata["fallback_reason"] = fallback_reason or metadata.get("fallback_reason")
        metadata["low_signal_reason"] = low_signal_reason
        payload["metadata"] = metadata
        return payload

    def _retry_backoff_delay(self, attempt_index: int) -> float:
        # attempt_index is 1-based retry index
        retry_backoff_cap_seconds = float(
            getattr(self, "retry_backoff_cap_seconds", os.getenv("BRIGHTDATA_RETRY_BACKOFF_CAP_SECONDS", "10.0"))
        )
        retry_base_backoff_seconds = float(
            getattr(self, "retry_base_backoff_seconds", os.getenv("BRIGHTDATA_RETRY_BACKOFF_SECONDS", "1.0"))
        )
        retry_jitter_seconds = float(
            getattr(self, "retry_jitter_seconds", os.getenv("BRIGHTDATA_RETRY_JITTER_SECONDS", "0.35"))
        )
        delay = min(
            retry_backoff_cap_seconds,
            retry_base_backoff_seconds * (2 ** max(0, attempt_index - 1)),
        )
        if retry_jitter_seconds > 0:
            delay += float(random.uniform(0.0, retry_jitter_seconds))
        return max(0.0, delay)

    async def _with_timeout(self, awaitable):
        timeout_seconds = float(
            getattr(self, "request_timeout_seconds", os.getenv("BRIGHTDATA_SDK_TIMEOUT_SECONDS", "45"))
        )
        return await asyncio.wait_for(awaitable, timeout=timeout_seconds)

    async def _get_client(self):
        """Get or create async client context"""
        if self._client is None:
            try:
                from brightdata import BrightDataClient
                self._client_manager = BrightDataClient(self.token)
                self._client = await self._with_timeout(self._client_manager.__aenter__())
                logger.info("✅ BrightData SDK client initialized")
            except ImportError as e:
                logger.warning(f"⚠️ BrightData SDK client class unavailable: {e}")
                logger.info("ℹ️ Installed brightdata package does not expose BrightDataClient; using fallback client")
                self._client = False
            except Exception as e:
                manager = getattr(self, "_client_manager", None)
                if manager is not None:
                    try:
                        aexit = getattr(manager, "__aexit__", None)
                        if callable(aexit):
                            await aexit(None, None, None)
                    except Exception:
                        pass
                    try:
                        close_fn = getattr(manager, "close", None)
                        if callable(close_fn):
                            maybe_coro = close_fn()
                            if asyncio.iscoroutine(maybe_coro):
                                await maybe_coro
                    except Exception:
                        pass
                    self._client_manager = None
                logger.warning(f"⚠️ BrightData SDK initialization failed: {e}")
                logger.info("ℹ️ Will use fallback httpx client for scraping")
                # Set to None to indicate SDK unavailable
                self._client = False
        if self._client is False:
            raise RuntimeError("BrightData SDK unavailable, fallback will be used")
        return self._client

    async def close(self):
        """Close the BrightData SDK client session if it was initialized."""
        client_manager = getattr(self, "_client_manager", None)
        if client_manager is not None:
            try:
                aexit = getattr(client_manager, "__aexit__", None)
                if callable(aexit):
                    await aexit(None, None, None)
            except Exception:
                pass
            try:
                close_fn = getattr(client_manager, "close", None)
                if callable(close_fn):
                    maybe_coro = close_fn()
                    if asyncio.iscoroutine(maybe_coro):
                        await maybe_coro
            except Exception:
                pass
        self._client_manager = None
        self._client = None

    @property
    def client(self):
        """Get client (must be called within async context)"""
        raise RuntimeError("Use 'await self._get_client()' instead of 'self.client' - SDK requires async context manager")

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10
    ) -> Dict[str, Any]:
        """
        Search using BrightData SERP API

        Args:
            query: Search query
            engine: 'google', 'bing', or 'yandex'
            country: Country code (default: 'us')
            num_results: Number of results (default: 10)

        Returns:
            Search results with position, title, url, snippet
        """
        try:
            logger.info(f"🔍 BrightData search: {query} (engine: {engine})")

            try:
                client = await self._get_client()
            except RuntimeError:
                # SDK unavailable, use fallback directly
                logger.info("ℹ️ Using fallback search (SDK unavailable)")
                return await self._search_engine_fallback(query, engine, country, num_results)

            search_timeout = float(os.getenv("BRIGHTDATA_SEARCH_TIMEOUT_SECONDS", "30"))

            max_attempts = self._resolve_retry_attempts("BRIGHTDATA_SEARCH_MAX_ATTEMPTS")
            last_error: Optional[Exception] = None
            result = None
            for attempt in range(1, max_attempts + 1):
                try:
                    # Call search directly (SDK methods are async)
                    if engine.lower() == "google":
                        result = await asyncio.wait_for(
                            client.search.google(
                                query=query,
                                country=country,
                                num=num_results,
                            ),
                            timeout=search_timeout,
                        )
                    elif engine.lower() == "bing":
                        result = await asyncio.wait_for(
                            client.search.bing(
                                query=query,
                                country=country,
                                num=num_results,
                            ),
                            timeout=search_timeout,
                        )
                    elif engine.lower() == "yandex":
                        result = await asyncio.wait_for(
                            client.search.yandex(
                                query=query,
                                num=num_results,
                            ),
                            timeout=search_timeout,
                        )
                    else:
                        return {
                            "status": "error",
                            "error": f"Unsupported search engine: {engine}",
                            "query": query,
                            "engine": engine
                        }

                    # Check if result has data and data is not None
                    if result and hasattr(result, 'data') and result.data is not None:
                        break

                    last_error = RuntimeError("No results returned")
                except Exception as exc:
                    last_error = exc

                if attempt < max_attempts:
                    delay = self._retry_backoff_delay(attempt)
                    logger.warning(
                        "⚠️ BrightData search attempt %s/%s failed for query=%r (%s); retrying in %.2fs",
                        attempt,
                        max_attempts,
                        query,
                        type(last_error).__name__ if last_error else "unknown",
                        delay,
                    )
                    if delay > 0:
                        await asyncio.sleep(delay)

            if not result or not hasattr(result, 'data') or result.data is None:
                return {
                    "status": "error",
                    "error": f"No results returned after {max_attempts} attempts: {last_error}",
                    "query": query,
                    "engine": engine
                }

            # Format results based on data structure
            results = []
            content = result.data

            # Handle data format (list of dicts)
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        raw_url = item.get('url') or item.get('link') or ''
                        results.append({
                            "position": item.get('position'),
                            "title": item.get('title'),
                            "url": self._normalize_search_result_url(raw_url),
                            "snippet": item.get('description', '') or item.get('snippet', '')
                        })

            logger.info(f"✅ Search returned {len(results)} results")

            return {
                "status": "success",
                "engine": engine,
                "query": query,
                "results": results,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "source": "brightdata_sdk",
                    "country": country
                }
            }

        except Exception as e:
            logger.warning(f"⚠️ BrightData search failed, using fallback: {e}")
            # Fall back to mock search
            return await self._search_engine_fallback(query, engine, country, num_results)

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """
        Scrape URL to markdown using BrightData Web Scraper API

        Args:
            url: URL to scrape (must include https://)

        Returns:
            Scraped content in markdown format
        """
        try:
            logger.info(f"📄 BrightData scrape: {url}")

            # Ensure URL has protocol
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'
            cached_low_signal = self._cached_low_signal_entry(url)
            if cached_low_signal:
                logger.info(
                    "ℹ️ Short-circuiting repeated low-signal URL scrape: %s",
                    url,
                )
                return {
                    "status": "success",
                    "url": url,
                    "content": "",
                    "raw_html": "",
                    "timestamp": datetime.now().isoformat(),
                    "metadata": {
                        "source": "brightdata_cached_guard",
                        "lane": "cached_guard",
                        "attempt": 0,
                        "word_count": 0,
                        "fallback_reason": "cached_repeated_low_signal_url",
                        "low_signal_reason": "cached_repeated_low_signal_url",
                        "previous_reason": str(cached_low_signal.get("last_reason") or "low_signal"),
                        "cache_count": int(cached_low_signal.get("count", 0) or 0),
                    },
                }
            best_brightdata_result: Optional[Dict[str, Any]] = None

            # lane_1: BrightData direct snapshot
            lane_1_attempt = 1
            lane_1_result: Optional[Dict[str, Any]] = None
            try:
                client = await self._get_client()
                scrape_timeout = float(os.getenv("BRIGHTDATA_SCRAPE_TIMEOUT_SECONDS", "35"))
                max_attempts = self._resolve_retry_attempts("BRIGHTDATA_SCRAPE_MAX_ATTEMPTS")
                sdk_result = None
                last_error: Optional[Exception] = None
                for attempt in range(1, max_attempts + 1):
                    lane_1_attempt = attempt
                    try:
                        sdk_result = await asyncio.wait_for(
                            client.scrape_url(url, response_format="raw"),
                            timeout=scrape_timeout,
                        )
                        break
                    except Exception as exc:
                        last_error = exc
                        if attempt < max_attempts:
                            delay = self._retry_backoff_delay(attempt)
                            if delay > 0:
                                await asyncio.sleep(delay)
                if sdk_result is None and last_error is not None:
                    raise last_error
                html_content = sdk_result.data if sdk_result and hasattr(sdk_result, "data") and sdk_result.data is not None else ""
                parse_result = self._extract_text_from_html(str(html_content))
                content = parse_result["content"]
                soup = parse_result["soup"]
                try:
                    publication_date = self._extract_publication_date(soup, html_content, url)
                except Exception:
                    publication_date = None
                lane_1_result = self._enrich_provenance(
                    {
                        "status": "success",
                        "url": url,
                        "content": content,
                        "raw_html": html_content,
                        "timestamp": datetime.now().isoformat(),
                        "publication_date": publication_date.isoformat() if publication_date else None,
                        "metadata": {
                            "source": "brightdata_sdk",
                            "has_publication_date": publication_date is not None,
                            "extraction_mode": "sdk_direct",
                        },
                    },
                    lane="lane_1",
                    attempt=lane_1_attempt,
                )
            except RuntimeError:
                modern_result = await self._scrape_with_modern_sdk(url)
                if modern_result and modern_result.get("status") == "success":
                    return self._enrich_provenance(
                        modern_result,
                        lane="lane_1",
                        attempt=1,
                        selected_candidate_url=modern_result.get("url"),
                    )
                lane_1_result = None
            except Exception:
                lane_1_result = None

            if lane_1_result and lane_1_result.get("status") == "success":
                best_brightdata_result = lane_1_result
                low_signal_reason = self._detect_low_signal_shell(
                    url=url,
                    content=str(lane_1_result.get("content") or ""),
                    raw_html=str(lane_1_result.get("raw_html") or ""),
                )
                if low_signal_reason is None:
                    return lane_1_result

            # lane_2: BrightData rendered probe on target URL
            lane_2_result = await self._scrape_with_browser_request_api(url, insecure_ssl_used=False)
            if lane_2_result and lane_2_result.get("status") == "success":
                lane_2_result = self._enrich_provenance(
                    lane_2_result,
                    lane="lane_2",
                    attempt=1,
                    selected_candidate_url=lane_2_result.get("url"),
                )
                lane_2_reason = self._detect_low_signal_shell(
                    url=str(lane_2_result.get("url") or url),
                    content=str(lane_2_result.get("content") or ""),
                    raw_html=str(lane_2_result.get("raw_html") or ""),
                )
                lane_2_result["metadata"]["low_signal_reason"] = lane_2_reason
                if best_brightdata_result is None or len(str(lane_2_result.get("content") or "").split()) > len(str(best_brightdata_result.get("content") or "").split()):
                    best_brightdata_result = lane_2_result
                if lane_2_reason is None:
                    return lane_2_result
                self._mark_low_signal_url(url, lane_2_reason)

            # lane_3: same-domain rendered candidate probes
            lane_3_result = await self._recover_with_domain_probe(url)
            if lane_3_result and lane_3_result.get("status") == "success":
                lane_3_result = self._enrich_provenance(
                    lane_3_result,
                    lane="lane_3",
                    attempt=1,
                    selected_candidate_url=lane_3_result.get("url"),
                )
                lane_3_reason = self._detect_low_signal_shell(
                    url=str(lane_3_result.get("url") or url),
                    content=str(lane_3_result.get("content") or ""),
                    raw_html=str(lane_3_result.get("raw_html") or ""),
                )
                lane_3_result["metadata"]["low_signal_reason"] = lane_3_reason
                if best_brightdata_result is None or len(str(lane_3_result.get("content") or "").split()) > len(str(best_brightdata_result.get("content") or "").split()):
                    best_brightdata_result = lane_3_result
                if lane_3_reason is None:
                    return lane_3_result
                self._mark_low_signal_url(url, lane_3_reason)

            # lane_4: strict non-BrightData fallback only if improved over best BrightData result
            fallback_result = {
                "status": "error",
                "url": url,
                "error": "lane_4_not_executed",
            }
            if not self._force_brightdata_only():
                fallback_reason = "lane_4_strict_fallback_after_low_signal"
                fallback_result = await self._scrape_as_markdown_fallback(url, reason=fallback_reason)
                if fallback_result.get("status") == "success":
                    fallback_result = self._enrich_provenance(
                        fallback_result,
                        lane="lane_4",
                        attempt=1,
                        fallback_reason=fallback_reason,
                        selected_candidate_url=fallback_result.get("url"),
                        low_signal_reason=self._detect_low_signal_shell(
                            url=str(fallback_result.get("url") or url),
                            content=str(fallback_result.get("content") or ""),
                            raw_html=str(fallback_result.get("raw_html") or ""),
                        ),
                    )
                    best_word_count = len(str((best_brightdata_result or {}).get("content") or "").split())
                    fallback_word_count = len(str(fallback_result.get("content") or "").split())
                    if fallback_word_count > best_word_count:
                        fallback_low_signal_reason = str(
                            fallback_result.get("metadata", {}).get("low_signal_reason")
                            or ""
                        ).strip()
                        if fallback_word_count == 0 or fallback_low_signal_reason:
                            self._mark_low_signal_url(
                                url,
                                fallback_low_signal_reason or "fallback_empty_content",
                            )
                        return fallback_result

            if best_brightdata_result and best_brightdata_result.get("status") == "success":
                cached_reason = str(
                    best_brightdata_result.get("metadata", {}).get("low_signal_reason")
                    or ""
                ).strip()
                if cached_reason:
                    self._mark_low_signal_url(url, cached_reason)
                return best_brightdata_result
            if fallback_result.get("status") == "success":
                fallback_words = len(str(fallback_result.get("content") or "").split())
                fallback_reason = str(
                    fallback_result.get("metadata", {}).get("low_signal_reason")
                    or fallback_result.get("metadata", {}).get("fallback_reason")
                    or ""
                ).strip()
                if fallback_words == 0 or fallback_reason:
                    self._mark_low_signal_url(url, fallback_reason or "fallback_empty_content")
            return fallback_result

        except Exception as e:
            logger.warning(f"⚠️ BrightData scrape failed, using fallback: {e}")
            # Fall back to httpx scraping
            return await self._scrape_as_markdown_fallback(url, reason=f"sdk_exception:{type(e).__name__}")

    async def _scrape_with_modern_sdk(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrape via modern brightdata package API (`scrape_url_async`) when
        `BrightDataClient` class is unavailable in the installed package.
        """
        if not getattr(self, "enable_modern_auto_scrape", False):
            return None
        try:
            from brightdata import scrape_url_async
        except Exception:
            return None

        target_url = url if url.startswith(("http://", "https://")) else f"https://{url}"

        try:
            result = await scrape_url_async(
                target_url,
                bearer_token=self.token,
                fallback_to_browser_api=True,
                flexible_timeout=True,
            )
        except Exception as e:
            logger.warning(f"⚠️ Modern brightdata auto scrape failed: {e}")
            return None

        if not result:
            return None

        # Result can be ScrapeResult, dict, or nested by url depending on SDK path.
        if isinstance(result, dict):
            if target_url in result:
                result = result[target_url]
            elif result:
                result = next(iter(result.values()))

        success = bool(getattr(result, "success", False))
        html_content = getattr(result, "data", None)
        if not success or not html_content:
            return None

        parse_result = self._extract_text_from_html(str(html_content))
        content = parse_result["content"]
        try:
            publication_date = self._extract_publication_date(parse_result["soup"], str(html_content), target_url)
        except Exception as e:
            logger.warning(f"⚠️ Publication date extraction failed: {e}")
            publication_date = None
        method = getattr(result, "method", None)

        return {
            "status": "success",
            "url": target_url,
            "content": content,
            "raw_html": str(html_content),
            "timestamp": datetime.now().isoformat(),
            "publication_date": publication_date.isoformat() if publication_date else None,
            "metadata": {
                "word_count": len(content.split()),
                "source": "brightdata_sdk_auto",
                "method": method,
                "has_publication_date": publication_date is not None,
            },
        }

    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        """
        Batch scrape multiple URLs concurrently

        Args:
            urls: List of URLs (SDK handles batching)

        Returns:
            Batch scrape results
        """
        try:
            logger.info(f"📦 BrightData batch scrape: {len(urls)} URLs")

            try:
                client = await self._get_client()
            except RuntimeError:
                # SDK unavailable, use fallback directly
                logger.info("ℹ️ Using fallback batch scrape (SDK unavailable)")
                return await self._scrape_batch_fallback(urls)

            # Ensure all URLs have protocol
            cleaned_urls = []
            for url in urls:
                if not url.startswith(('http://', 'https://')):
                    url = f'https://{url}'
                cleaned_urls.append(url)

            # Use SDK batch scraping (async mode for concurrent)
            results = await self._with_timeout(
                client.scrape_url(
                    cleaned_urls,
                    mode='async',
                )
            )

            successful_results = []
            failed_count = 0

            # Handle results
            if isinstance(results, list):
                for idx, result in enumerate(results):
                    if result and hasattr(result, 'data') and result.data is not None:
                        # Convert to markdown
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(result.data, 'html.parser')

                        for tag in soup(["script", "style", "nav", "footer", "header"]):
                            tag.decompose()

                        main = soup.find('main') or soup.find('article') or soup.body
                        if main:
                            content = self._html_to_text(main)
                        else:
                            content = soup.get_text(separator='\n', strip=True)

                        lines = [line.strip() for line in content.split('\n') if line.strip()]
                        content = '\n'.join(lines)

                        url = cleaned_urls[idx] if idx < len(cleaned_urls) else "unknown"

                        successful_results.append({
                            "url": url,
                            "status": "success",
                            "content": content,
                            "metadata": {
                                "word_count": len(content.split())
                            }
                        })
                    else:
                        failed_count += 1
                        url = cleaned_urls[idx] if idx < len(cleaned_urls) else "unknown"
                        successful_results.append({
                            "url": url,
                            "status": "error",
                            "error": "No content returned"
                        })
            else:
                # Single result
                if results and hasattr(results, 'data'):
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(results.data, 'html.parser')

                    for tag in soup(["script", "style", "nav", "footer", "header"]):
                        tag.decompose()

                    main = soup.find('main') or soup.find('article') or soup.body
                    if main:
                        content = self._html_to_text(main)
                    else:
                        content = soup.get_text(separator='\n', strip=True)

                    lines = [line.strip() for line in content.split('\n') if line.strip()]
                    content = '\n'.join(lines)

                    successful_results.append({
                        "url": urls[0],
                        "status": "success",
                        "content": content,
                        "metadata": {
                            "word_count": len(content.split())
                        }
                    })

            successful = len([r for r in successful_results if r['status'] == 'success'])

            logger.info(f"✅ Batch scrape complete: {successful}/{len(urls)} successful")

            return {
                "status": "success",
                "total_urls": len(urls),
                "successful": successful,
                "failed": failed_count,
                "results": successful_results,
                "timestamp": datetime.now().isoformat(),
                "metadata": {"source": "brightdata_sdk"}
            }

        except Exception as e:
            logger.warning(f"⚠️ BrightData batch scrape failed, using fallback: {e}")
            # Fall back to httpx batch scraping
            return await self._scrape_batch_fallback(urls)

    async def scrape_jobs_board(
        self,
        entity_name: str,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """Convenience method: Search job boards"""
        keyword_str = " ".join(keywords[:3])
        query = f'"{entity_name}" {keyword_str} jobs careers'
        return await self.search_engine(query, engine="google")

    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        """Convenience method: Search press releases"""
        query = f'"{entity_name}" press release announcement news'
        return await self.search_engine(query, engine="google")

    # ============== FALLBACK METHODS (httpx) ==============
    # These are used when BrightData SDK is unavailable

    async def _search_engine_fallback(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10
    ) -> Dict[str, Any]:
        """Fallback: Use BrightData SERP HTTP API directly when SDK search is unstable."""
        logger.warning(f"⚠️ Using BrightData HTTP SERP fallback: {query}")
        token = getattr(self, "token", None)
        if not token:
            return {
                "status": "error",
                "engine": engine,
                "query": query,
                "results": [],
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "source": "brightdata_http_fallback",
                    "error": "BRIGHTDATA_API_TOKEN missing for HTTP fallback",
                },
            }

        api_base = os.getenv("BRIGHTDATA_API_BASE", "https://api.brightdata.com").rstrip("/")
        timeout = float(os.getenv("BRIGHTDATA_FALLBACK_SEARCH_TIMEOUT_SECONDS", "20"))
        max_attempts = self._resolve_retry_attempts("BRIGHTDATA_FALLBACK_SEARCH_MAX_ATTEMPTS")

        last_error: Optional[str] = None
        request_zones = await self._get_adaptive_request_zones("serp")
        target_url = self._build_serp_target_url(engine, query, country, num_results)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json,text/html",
        }

        for zone in request_zones:
            payload = {"zone": zone, "url": target_url, "format": "json", "country": country}
            for attempt in range(max_attempts):
                try:
                    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                        response = await client.post(f"{api_base}/request", headers=headers, json=payload)
                        response.raise_for_status()
                    payload_json = response.json()
                    results = self._extract_serp_results(payload_json, num_results)
                    if not results and isinstance(payload_json, dict):
                        response_id = payload_json.get("response_id")
                        if isinstance(response_id, str) and response_id.strip():
                            payload_json = await self._poll_serp_result_payload(
                                response_id=response_id.strip(),
                                zone=zone,
                            )
                            results = self._extract_serp_results(payload_json, num_results)
                    return {
                        "status": "success",
                        "engine": engine,
                        "query": query,
                        "results": results,
                        "timestamp": datetime.now().isoformat(),
                        "metadata": {
                            "source": "brightdata_http_fallback",
                            "country": country,
                            "endpoint": f"{api_base}/request",
                            "zone": zone,
                            "async_polling": True,
                        },
                    }
                except httpx.HTTPStatusError as e:
                    body = ""
                    try:
                        body = (e.response.text or "")[:200]
                    except Exception:
                        pass
                    if e.response is not None and e.response.status_code == 400 and "zone" in body.lower() and "not found" in body.lower():
                        last_error = str(e)
                        self._mark_zone_not_found(zone)
                        logger.warning(f"⚠️ BrightData SERP request zone not found, skipping zone={zone}")
                        break
                    last_error = str(e)
                    self._mark_zone_timeout(zone, e)
                    logger.warning(
                        "⚠️ BrightData /request SERP fallback failed (zone=%s, attempt %s/%s): %s",
                        zone,
                        attempt + 1,
                        max_attempts,
                        e,
                    )
                    continue
                except Exception as e:
                    last_error = str(e)
                    self._mark_zone_timeout(zone, e)
                    logger.warning(
                        "⚠️ BrightData /request SERP fallback failed (zone=%s, attempt %s/%s): %s",
                        zone,
                        attempt + 1,
                        max_attempts,
                        e,
                    )
                    continue

        # Legacy fallback path (older endpoint variants).
        endpoint = f"{api_base}/serp/{engine.lower()}"
        params = {
            "query": query,
            "num_results": str(num_results),
            "api_key": token,
            "country": country,
            "language": "en",
        }
        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    response = await client.get(endpoint, params=params)
                    response.raise_for_status()
                payload = response.json()
                results = self._extract_serp_results(payload, num_results)

                return {
                    "status": "success",
                    "engine": engine,
                    "query": query,
                    "results": results,
                    "timestamp": datetime.now().isoformat(),
                    "metadata": {
                        "source": "brightdata_http_fallback",
                        "country": country,
                        "endpoint": endpoint,
                    },
                }
            except Exception as e:
                last_error = str(e)
                logger.warning(
                    "⚠️ BrightData HTTP SERP fallback failed (attempt %s/%s): %s",
                    attempt + 1,
                    max_attempts,
                    e,
                )
                continue

        return {
            "status": "error",
            "engine": engine,
            "query": query,
            "results": [],
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "source": "brightdata_http_fallback",
                "country": country,
                "endpoint": endpoint,
                "error": last_error or "unknown fallback error",
            },
        }

    async def _poll_serp_result_payload(self, response_id: str, zone: str) -> Dict[str, Any]:
        """Poll BrightData async SERP results for a response_id."""
        token = getattr(self, "token", None)
        if not token:
            return {"status": "error", "error": "missing token", "response_id": response_id}

        api_base = os.getenv("BRIGHTDATA_API_BASE", "https://api.brightdata.com").rstrip("/")
        endpoint = f"{api_base}/serp/get_result"
        headers = {"Authorization": f"Bearer {token}"}
        params = {"response_id": response_id}
        if zone:
            params["zone"] = zone

        timeout = float(os.getenv("BRIGHTDATA_FALLBACK_SEARCH_TIMEOUT_SECONDS", "20"))
        attempts = max(int(getattr(self, "serp_poll_attempts", 6) or 6), 1)
        poll_interval_seconds = float(getattr(self, "serp_poll_interval_seconds", 1.2) or 1.2)
        last_payload: Dict[str, Any] = {}

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            for attempt in range(attempts):
                try:
                    response = await client.get(endpoint, headers=headers, params=params)
                    if response.status_code == 202:
                        if attempt < attempts - 1:
                            await asyncio.sleep(poll_interval_seconds)
                            continue
                        return {"status": "pending", "response_id": response_id}
                    if response.status_code >= 500:
                        if attempt < attempts - 1:
                            await asyncio.sleep(poll_interval_seconds)
                            continue
                    if response.status_code >= 400:
                        if response.status_code == 404 and attempt < attempts - 1:
                            await asyncio.sleep(poll_interval_seconds)
                            continue
                        return {"status": "error", "error": response.text[:220], "response_id": response_id}

                    payload = response.json() if response.text else {}
                    if isinstance(payload, dict):
                        last_payload = payload
                        if self._extract_serp_results(payload, num_results=10):
                            return payload
                    await asyncio.sleep(poll_interval_seconds)
                except Exception as poll_error:
                    logger.debug("SERP get_result polling failed (attempt=%s): %s", attempt + 1, poll_error)
                    if attempt < attempts - 1:
                        await asyncio.sleep(poll_interval_seconds)

        return last_payload or {"status": "error", "error": "SERP polling exhausted", "response_id": response_id}

    def _build_serp_target_url(self, engine: str, query: str, country: str, num_results: int) -> str:
        """Build target SERP URL for BrightData /request fallback."""
        normalized_engine = (engine or "google").lower()
        if normalized_engine == "bing":
            base = "https://www.bing.com/search"
            params = {"q": query, "count": min(max(num_results, 1), 50), "setlang": "en"}
        elif normalized_engine == "yandex":
            base = "https://yandex.com/search/"
            params = {"text": query}
        else:
            base = "https://www.google.com/search"
            params = {"q": query}
            if num_results > 0:
                params["num"] = min(num_results, 100)
            if country:
                params["gl"] = country.lower()
            params["hl"] = "en"
        return f"{base}?{urlencode(params)}"

    def _mark_zone_not_found(self, zone: str) -> None:
        invalid = getattr(self, "_invalid_request_zones", set())
        invalid.add(zone)
        self._invalid_request_zones = invalid

    def _mark_zone_timeout(self, zone: str, error: Exception) -> None:
        timeout_like = isinstance(error, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.TimeoutException, asyncio.TimeoutError))
        if not timeout_like:
            return
        cooldown_seconds = float(os.getenv("BRIGHTDATA_ZONE_TIMEOUT_COOLDOWN_SECONDS", "120"))
        cooldowns = getattr(self, "_zone_cooldowns", {})
        cooldowns[zone] = time.monotonic() + max(1.0, cooldown_seconds)
        self._zone_cooldowns = cooldowns

    def _zone_in_cooldown(self, zone: str) -> bool:
        cooldowns = getattr(self, "_zone_cooldowns", {})
        until = cooldowns.get(zone, 0.0)
        return until > time.monotonic()

    async def _get_request_zone_whitelist(self) -> Optional[set]:
        token = getattr(self, "token", None)
        if not token:
            return None
        ttl_seconds = float(os.getenv("BRIGHTDATA_ZONE_PREFLIGHT_TTL_SECONDS", "600"))
        now = time.monotonic()
        cached_whitelist = getattr(self, "_request_zone_whitelist", None)
        checked_at = float(getattr(self, "_request_zone_whitelist_checked_at", 0.0))
        if cached_whitelist is not None and (now - checked_at) < ttl_seconds:
            return cached_whitelist

        api_base = os.getenv("BRIGHTDATA_API_BASE", "https://api.brightdata.com").rstrip("/")
        timeout = float(os.getenv("BRIGHTDATA_ZONE_PREFLIGHT_TIMEOUT_SECONDS", "8"))
        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(f"{api_base}/zone/whitelist", headers=headers)
                response.raise_for_status()
            payload = response.json()
            zones = self._extract_zone_names(payload)
            self._request_zone_whitelist = zones
            self._request_zone_whitelist_checked_at = now
            return zones
        except Exception as e:
            logger.warning(f"⚠️ BrightData zone preflight failed: {e}")
            self._request_zone_whitelist_checked_at = now
            self._request_zone_whitelist = None
            return None

    def _extract_zone_names(self, payload: Any) -> set:
        zones = set()
        if isinstance(payload, dict):
            candidates = payload.get("zones") or payload.get("data") or payload.get("whitelist") or payload.get("results")
        else:
            candidates = payload
        if not isinstance(candidates, list):
            candidates = [candidates] if candidates else []
        for item in candidates:
            if isinstance(item, str) and item.strip():
                zones.add(item.strip())
            elif isinstance(item, dict):
                for key in ("zone", "name", "id"):
                    value = item.get(key)
                    if isinstance(value, str) and value.strip():
                        zones.add(value.strip())
                        break
        return zones

    async def _get_adaptive_request_zones(self, request_kind: str) -> List[str]:
        if request_kind == "serp":
            candidates = [
                os.getenv("BRIGHTDATA_SERP_ZONE", "").strip(),
                "sdk_serp",
                os.getenv("BRIGHTDATA_UNLOCKER_ZONE", "").strip(),
                "sdk_unlocker",
            ]
        else:
            candidates = [
                os.getenv("BRIGHTDATA_UNLOCKER_ZONE", "").strip(),
                "sdk_unlocker",
                os.getenv("BRIGHTDATA_BROWSER_ZONE", "").strip(),
            ]
        invalid = getattr(self, "_invalid_request_zones", set())
        ordered = [z for z in dict.fromkeys(candidates) if z and z not in invalid and not self._zone_in_cooldown(z)]
        whitelist = await self._get_request_zone_whitelist()
        if not whitelist:
            return ordered
        whitelisted = [z for z in ordered if z in whitelist]
        return whitelisted or ordered

    def _extract_serp_results(self, payload: Dict[str, Any], num_results: int) -> List[Dict[str, Any]]:
        """Normalize common BrightData SERP response shapes into list of results."""
        if not isinstance(payload, dict):
            return []
        raw_results = (
            payload.get("organic_results")
            or payload.get("results")
            or payload.get("organic")
            or payload.get("response", {}).get("organic_results")
            or payload.get("serp", {}).get("organic_results")
            or []
        )
        if not isinstance(raw_results, list):
            return []

        results = []
        for idx, item in enumerate(raw_results[:num_results], 1):
            if not isinstance(item, dict):
                continue
            raw_url = item.get("url") or item.get("link") or item.get("target_url") or ""
            results.append({
                "position": item.get("position") or item.get("rank") or idx,
                "title": item.get("title") or item.get("text"),
                "url": self._normalize_search_result_url(raw_url),
                "snippet": item.get("description", "") or item.get("snippet", ""),
            })
        return results

    async def _scrape_as_markdown_fallback(self, url: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Fallback: Use httpx + BeautifulSoup when SDK unavailable"""
        from bs4 import BeautifulSoup

        force_only = self._force_brightdata_only()
        if force_only:
            logger.warning(f"⚠️ BRIGHTDATA_FORCE_ONLY enabled; skipping raw httpx fallback for: {url}")
            try:
                if not url.startswith(('http://', 'https://')):
                    url = f'https://{url}'
                modern_result = await self._scrape_with_modern_sdk(url)
                if modern_result and modern_result.get("status") == "success":
                    metadata = modern_result.setdefault("metadata", {})
                    metadata.setdefault("fallback_reason", reason or "force_only_modern_sdk")
                    return modern_result

                browser_result = await self._scrape_with_browser_request_api(url, insecure_ssl_used=False)
                if browser_result and browser_result.get("status") == "success":
                    metadata = browser_result.setdefault("metadata", {})
                    metadata.setdefault("fallback_reason", reason or "force_only_request_api")
                    return browser_result

                return {
                    "status": "error",
                    "error": "BRIGHTDATA_FORCE_ONLY enabled and no BrightData scrape path produced usable content",
                    "url": url,
                    "metadata": {
                        "source": "brightdata_force_only",
                        "fallback_reason": reason or "force_only_no_usable_result",
                    },
                }
            except Exception as e:
                return {
                    "status": "error",
                    "error": f"BRIGHTDATA_FORCE_ONLY scrape failed: {e}",
                    "url": url,
                    "metadata": {
                        "source": "brightdata_force_only",
                        "fallback_reason": reason or f"force_only_exception:{type(e).__name__}",
                    },
                }

        logger.warning(f"⚠️ Using fallback scraping (not BrightData): {url}")

        try:
            # Ensure URL has protocol
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'

            try:
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=True) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                insecure_ssl_used = False
            except Exception as initial_error:
                response = getattr(initial_error, "response", None)
                status_code = getattr(response, "status_code", None)
                if status_code in {401, 403, 429}:
                    logger.info(
                        "ℹ️ Fallback direct scrape blocked with HTTP %s, escalating to BrightData rendered request API",
                        status_code,
                    )
                    browser_result = await self._scrape_with_browser_request_api(url, insecure_ssl_used=False)
                    if browser_result and browser_result.get("status") == "success":
                        metadata = browser_result.setdefault("metadata", {})
                        metadata.setdefault("fallback_reason", f"http_status_{status_code}")
                        metadata.setdefault("source_chain", "fallback_httpx->brightdata_request_api")
                        return browser_result

                allow_insecure_retry = (os.getenv("BRIGHTDATA_FALLBACK_SSL_RETRY_INSECURE", "true").lower() in {"1", "true", "yes", "on"})
                if not allow_insecure_retry:
                    raise
                err_text = str(initial_error).lower()
                ssl_related = "certificate_verify_failed" in err_text or "ssl" in err_text
                if not ssl_related:
                    raise
                logger.warning("⚠️ SSL verification failed during fallback scrape, retrying without verification")
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                insecure_ssl_used = True

            parse_result = self._extract_text_from_html(response.text)
            content = parse_result["content"]
            logger.info(f"✅ Fallback scraped {len(content)} characters")
            raw_html_for_output = response.text

            extraction_mode = "direct"
            min_words = int(os.getenv("BRIGHTDATA_MIN_WORDS", "80"))
            if self._should_retry_with_rendered_fallback(response.text, content):
                # JS-heavy pages often return shell HTML on first pass.
                # Prefer modern BrightData browser-capable scrape when available.
                modern_result = await self._scrape_with_modern_sdk(url)
                if modern_result and modern_result.get("status") == "success":
                    modern_content = modern_result.get("content", "")
                    if len(modern_content.strip()) > len(content.strip()):
                        parse_result = self._extract_text_from_html(modern_result.get("raw_html", ""))
                        content = modern_content
                        raw_html_for_output = modern_result.get("raw_html", raw_html_for_output)
                        extraction_mode = "rendered_fallback_modern_sdk"
                else:
                    browser_result = await self._scrape_with_browser_request_api(url, insecure_ssl_used=insecure_ssl_used)
                    if browser_result and browser_result.get("status") == "success":
                        browser_content = browser_result.get("content", "")
                        if len(browser_content.strip()) > len(content.strip()):
                            parse_result = self._extract_text_from_html(browser_result.get("raw_html", ""))
                            content = browser_content
                            raw_html_for_output = browser_result.get("raw_html", raw_html_for_output)
                            extraction_mode = browser_result.get("metadata", {}).get(
                                "extraction_mode",
                                "rendered_fallback_brightdata_request_api",
                            )
                    if extraction_mode.startswith("rendered_fallback_brightdata_request_api"):
                        pass
                    else:
                        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=not insecure_ssl_used) as client:
                            rendered_response = await client.get(url)
                            rendered_response.raise_for_status()
                        rendered_parse = self._extract_text_from_html(rendered_response.text)
                        if len(rendered_parse["content"].strip()) > len(content.strip()):
                            parse_result = rendered_parse
                            content = parse_result["content"]
                            raw_html_for_output = rendered_response.text
                            extraction_mode = "rendered_fallback"

            # If the target URL remains low-signal after rendered attempts, probe
            # higher-signal pages on the same domain via SERP and rendered scraping.
            if (
                len((content or "").split()) == 0
                or self._should_retry_with_rendered_fallback(raw_html_for_output, content)
            ):
                recovered = await self._recover_with_domain_probe(url)
                if recovered and recovered.get("status") == "success":
                    recovered_content = recovered.get("content", "")
                    if len(recovered_content.split()) > len((content or "").split()):
                        content = recovered_content
                        raw_html_for_output = recovered.get("raw_html", raw_html_for_output)
                        parse_result = self._extract_text_from_html(raw_html_for_output)
                        extraction_mode = recovered.get("metadata", {}).get(
                            "extraction_mode",
                            "domain_probe_recovery",
                        )

            try:
                publication_date = self._extract_publication_date(parse_result["soup"], raw_html_for_output, url)
            except Exception as e:
                logger.warning(f"⚠️ Publication date extraction failed: {e}")
                publication_date = None

            return {
                "status": "success",
                "url": url,
                "content": content,
                "raw_html": raw_html_for_output,
                "timestamp": datetime.now().isoformat(),
                "publication_date": publication_date.isoformat() if publication_date else None,
                "metadata": {
                    "word_count": len(content.split()),
                    "source": "fallback_httpx",
                    "warning": "BrightData SDK unavailable, using httpx",
                    "fallback_reason": reason or "fallback_path_invoked",
                    "has_publication_date": publication_date is not None,
                    "extraction_mode": extraction_mode,
                    "insecure_ssl_used": insecure_ssl_used,
                }
            }
        except Exception as e:
            logger.error(f"❌ Fallback scrape failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "url": url
            }

    async def _scrape_with_browser_request_api(
        self,
        url: str,
        insecure_ssl_used: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """
        Scrape via BrightData `/request` API using browser/unlocker zones.
        Intended for JS-heavy pages where direct HTML is sparse.
        """
        token = getattr(self, "token", None)
        if not token:
            return None

        api_base = os.getenv("BRIGHTDATA_API_BASE", "https://api.brightdata.com").rstrip("/")
        zones = await self._get_adaptive_request_zones("browser")
        if not zones:
            return None

        target_url = url if url.startswith(("http://", "https://")) else f"https://{url}"
        probe_urls = self._build_render_probe_urls(target_url)
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "text/html,application/json",
        }

        request_timeout = float(os.getenv("BRIGHTDATA_REQUEST_TIMEOUT_SECONDS", "18"))
        max_attempts = self._resolve_retry_attempts("BRIGHTDATA_REQUEST_MAX_ATTEMPTS")
        min_words = int(os.getenv("BRIGHTDATA_MIN_WORDS", "80"))
        low_signal_hard_stop_repeats = max(
            1,
            int(os.getenv("BRIGHTDATA_LOW_SIGNAL_HARD_STOP_REPEATS", "2")),
        )
        best_low_signal_result: Optional[Dict[str, Any]] = None
        low_signal_shell_repeats = 0

        for zone in zones:
            for probe_index, probe_url in enumerate(probe_urls):
                payload = {
                    "zone": zone,
                    "url": probe_url,
                    "format": "raw",
                }
                for attempt in range(max_attempts):
                    try:
                        async with httpx.AsyncClient(
                            timeout=request_timeout,
                            follow_redirects=True,
                            verify=not insecure_ssl_used,
                        ) as client:
                            response = await client.post(f"{api_base}/request", headers=headers, json=payload)
                            response.raise_for_status()
                        html_content = response.text or ""
                        if not html_content.strip():
                            continue
                        parse_result = self._extract_text_from_html(html_content)
                        content = parse_result["content"]
                        if not content.strip():
                            continue

                        word_count = len(content.split())
                        low_signal_reason = self._detect_low_signal_shell(
                            url=probe_url,
                            content=content,
                            raw_html=html_content,
                        )
                        if low_signal_reason:
                            low_signal_shell_repeats += 1
                        should_probe_next = (
                            (word_count < min_words or bool(low_signal_reason))
                            and probe_index + 1 < len(probe_urls)
                        )
                        try:
                            publication_date = self._extract_publication_date(parse_result["soup"], html_content, probe_url)
                        except Exception:
                            publication_date = None
                        result_payload = {
                            "status": "success",
                            "url": probe_url,
                            "content": content,
                            "raw_html": html_content,
                            "timestamp": datetime.now().isoformat(),
                            "publication_date": publication_date.isoformat() if publication_date else None,
                            "metadata": {
                                "word_count": word_count,
                                "source": "brightdata_request_api",
                                "zone": zone,
                                "probe_url": probe_url,
                                "probe_index": probe_index,
                                "has_publication_date": publication_date is not None,
                                "extraction_mode": "rendered_fallback_brightdata_request_api",
                                "low_signal_reason": low_signal_reason,
                            },
                        }

                        if (
                            not best_low_signal_result
                            or word_count > int(best_low_signal_result.get("metadata", {}).get("word_count", 0))
                        ):
                            best_low_signal_result = result_payload

                        if low_signal_shell_repeats >= low_signal_hard_stop_repeats:
                            result_payload["metadata"]["low_signal_hard_stop_triggered"] = True
                            result_payload["metadata"]["low_signal_reason"] = "repeated_rendered_shell"
                            return result_payload

                        if should_probe_next:
                            logger.info(
                                "ℹ️ BrightData rendered page is low-signal (%s words), probing next candidate",
                                word_count,
                            )
                            break

                        return result_payload
                    except httpx.HTTPStatusError as e:
                        body = ""
                        try:
                            body = (e.response.text or "")[:200]
                        except Exception:
                            pass
                        if e.response is not None and e.response.status_code == 400 and "not found" in body.lower():
                            self._mark_zone_not_found(zone)
                            logger.warning(f"⚠️ BrightData /request zone not found, disabling zone={zone}")
                            break
                        self._mark_zone_timeout(zone, e)
                        logger.warning(f"⚠️ BrightData /request render failed for zone={zone}: {e}")
                        if attempt + 1 >= max_attempts:
                            break
                        continue
                    except Exception as e:
                        self._mark_zone_timeout(zone, e)
                        logger.warning(f"⚠️ BrightData /request render failed for zone={zone}: {e}")
                        if attempt + 1 >= max_attempts:
                            break
                        continue

        if best_low_signal_result:
            best_low_signal_result.setdefault("metadata", {})["low_signal_rendered"] = True
            best_low_signal_result.setdefault("metadata", {}).setdefault(
                "low_signal_hard_stop_triggered",
                low_signal_shell_repeats >= low_signal_hard_stop_repeats,
            )
            best_low_signal_result.setdefault("metadata", {}).setdefault(
                "low_signal_reason",
                "repeated_rendered_shell" if low_signal_shell_repeats >= low_signal_hard_stop_repeats else None,
            )
            return best_low_signal_result
        return None

    async def _recover_with_domain_probe(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Recover sparse scrapes by probing same-domain high-signal pages from SERP.
        """
        parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
        host = (parsed.netloc or "").lower()
        if not host:
            return None

        now = time.time()
        cooldown_seconds = int(os.getenv("BRIGHTDATA_DOMAIN_PROBE_COOLDOWN_SECONDS", "300"))
        probe_runs = getattr(self, "_domain_probe_last_run", None)
        if not isinstance(probe_runs, dict):
            probe_runs = {}
            self._domain_probe_last_run = probe_runs
        last_run = float(probe_runs.get(host, 0.0))
        if (now - last_run) < cooldown_seconds:
            return None

        # Keep domain probe to high-level or known low-signal routes to prevent
        # long retries on deep article URLs.
        path = (parsed.path or "/").strip("/")
        low_signal_leafs = {"matches", "fixtures", "results", "scores", "schedule", "watch", "news"}
        is_root = not path
        leaf = path.split("/")[-1] if path else ""
        if not is_root and leaf not in low_signal_leafs and len(path.split("/")) > 2:
            return None

        probe_runs[host] = now
        probe_query = (
            f'site:{host} ("news" OR "careers" OR "vacancies" OR "commercial" '
            f'OR "partnership" OR "procurement" OR "tender" OR "supplier")'
        )
        search_timeout = float(os.getenv("BRIGHTDATA_DOMAIN_PROBE_SEARCH_TIMEOUT_SECONDS", "10"))
        try:
            search = await asyncio.wait_for(
                self.search_engine(probe_query, engine="google", country="us", num_results=8),
                timeout=search_timeout,
            )
        except Exception:
            return None
        if search.get("status") != "success":
            return None

        candidates: List[str] = []
        preferred_path_terms = ("procurement", "tender", "supplier", "commercial", "careers", "vacancies", "news")
        for row in search.get("results", []):
            candidate_url = str(row.get("url") or "").strip()
            if not candidate_url:
                continue
            candidate_host = (urlparse(candidate_url).netloc or "").lower()
            if candidate_host.endswith(host) or host.endswith(candidate_host):
                candidates.append(candidate_url)
        candidates = sorted(
            list(dict.fromkeys(candidates)),
            key=lambda candidate: (
                sum(1 for token in preferred_path_terms if token in candidate.lower()),
                len(candidate),
            ),
            reverse=True,
        )
        max_candidates = max(1, int(os.getenv("BRIGHTDATA_DOMAIN_PROBE_MAX_CANDIDATES", "3")))
        candidates = candidates[:max_candidates]
        if not candidates:
            return None

        per_candidate_timeout = float(os.getenv("BRIGHTDATA_DOMAIN_PROBE_PER_CANDIDATE_TIMEOUT_SECONDS", "12"))
        best: Optional[Dict[str, Any]] = None
        best_score = -1
        for candidate_url in candidates:
            try:
                rendered = await asyncio.wait_for(
                    self._scrape_with_browser_request_api(candidate_url, insecure_ssl_used=False),
                    timeout=per_candidate_timeout,
                )
            except Exception:
                continue
            if not rendered or rendered.get("status") != "success":
                continue
            words = int(rendered.get("metadata", {}).get("word_count", 0))
            path_bonus = sum(1 for token in preferred_path_terms if token in candidate_url.lower()) * 20
            score = words + path_bonus
            if not best or score > best_score:
                best = rendered
                best_score = score
            if words >= int(os.getenv("BRIGHTDATA_MIN_WORDS", "80")):
                break

        if best:
            best.setdefault("metadata", {})["extraction_mode"] = "domain_probe_recovery"
            best["metadata"]["probe_host"] = host
        return best

    def _build_render_probe_urls(self, url: str) -> List[str]:
        """
        Build a small set of high-signal subpaths for JS-heavy sites where homepages are shell-only.
        """
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return [url]

        base_root = f"{parsed.scheme}://{parsed.netloc}/"
        normalized_path = (parsed.path or "/").strip()

        subpaths_env = os.getenv(
            "BRIGHTDATA_CONTENT_PROBE_SUBPATHS",
            "news,club,first-team,about,team,commercial,partners,careers,procurement,tenders,suppliers",
        )
        subpaths = [
            part.strip().strip("/")
            for part in subpaths_env.split(",")
            if part.strip().strip("/")
        ]
        low_signal_leaf_env = os.getenv(
            "BRIGHTDATA_LOW_SIGNAL_LEAF_PATHS",
            "matches,fixtures,results,scores,schedule,watch,procurement,tenders,rfp",
        )
        low_signal_leafs = {
            part.strip().strip("/")
            for part in low_signal_leaf_env.split(",")
            if part.strip().strip("/")
        }

        # Root pages get broad probing. Known low-signal leaf routes (e.g. /matches)
        # also get probing to recover useful content from adjacent canonical sections.
        if normalized_path in {"", "/"}:
            probe_urls = [base_root.rstrip("/")]
        else:
            leaf = normalized_path.strip("/").split("/")[-1]
            if leaf in low_signal_leafs:
                probe_urls = [url.rstrip("/")]
            else:
                return [url]

        for subpath in subpaths:
            probe_urls.append(urljoin(base_root, f"{subpath}/").rstrip("/"))
        return list(dict.fromkeys(probe_urls))

    def _normalize_search_result_url(self, url: str) -> str:
        """
        Normalize SERP URLs and unwrap common Google redirect links.
        """
        if not url:
            return url
        try:
            parsed = urlparse(url)
            host = (parsed.netloc or "").lower()
            if "google." in host and parsed.path in {"/url", "/goto"}:
                params = parse_qs(parsed.query or "")
                for key in ("url", "q"):
                    values = params.get(key) or []
                    if not values:
                        continue
                    candidate = unquote(values[0]).strip()
                    if candidate.startswith(("http://", "https://")):
                        return candidate
        except Exception:
            return url
        return url

    def _extract_text_from_html(self, html: str) -> Dict[str, Any]:
        from bs4 import BeautifulSoup

        original_soup = BeautifulSoup(html, 'html.parser')
        soup = BeautifulSoup(html, 'html.parser')
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        main = soup.find('article') or soup.find('main') or soup.body
        if main:
            content = self._html_to_text(main)
        else:
            content = soup.get_text(separator='\n', strip=True)

        lines = [line.strip() for line in content.split('\n') if line.strip()]
        content = '\n'.join(lines)

        # Fallback for JS-heavy pages where strict pruning removes all meaningful text.
        if len(content.split()) < 10:
            permissive_soup = BeautifulSoup(html, 'html.parser')
            for tag in permissive_soup(["script", "style", "noscript"]):
                tag.decompose()
            permissive_body = permissive_soup.body or permissive_soup
            permissive_text = permissive_body.get_text(separator='\n', strip=True)
            permissive_lines = [line.strip() for line in permissive_text.split('\n') if line.strip()]
            permissive_content = '\n'.join(permissive_lines)
            if len(permissive_content.split()) > len(content.split()):
                content = permissive_content

        # Final fallback: structured metadata if body text is still sparse.
        if len(content.split()) < 10:
            meta_parts = []
            title_tag = original_soup.find("title")
            if title_tag and title_tag.get_text(strip=True):
                meta_parts.append(title_tag.get_text(strip=True))
            for selector in [
                ('meta', {'name': 'description'}),
                ('meta', {'property': 'og:description'}),
                ('meta', {'name': 'twitter:description'}),
            ]:
                tag = original_soup.find(selector[0], attrs=selector[1])
                if tag and tag.get('content'):
                    meta_parts.append(str(tag.get('content')).strip())

            # Try JSON-LD extraction for JS-heavy sites.
            for script in original_soup.find_all("script", attrs={"type": "application/ld+json"}):
                raw = script.string or script.get_text(strip=True)
                if not raw:
                    continue
                try:
                    payload = json.loads(raw)
                except Exception:
                    continue
                candidates = payload if isinstance(payload, list) else [payload]
                for node in candidates:
                    if not isinstance(node, dict):
                        continue
                    for key in ("headline", "description", "name", "articleBody"):
                        value = node.get(key)
                        if isinstance(value, str) and value.strip():
                            meta_parts.append(value.strip())

            # Try extracting readable strings from client-side JSON app state.
            # This helps on JS-heavy shells where visible HTML is mostly empty.
            json_state_parts = self._extract_json_state_text(original_soup)
            if json_state_parts:
                meta_parts.extend(json_state_parts)
            if meta_parts:
                content = '\n'.join(dict.fromkeys([p for p in meta_parts if p]))

        # Normalize collapsed text boundaries and remove obvious boilerplate fragments.
        content = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", content)
        content = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", content)
        content = re.sub(r"(?<=[0-9])(?=[A-Za-z])", " ", content)
        boilerplate_markers = (
            "accept all cookies",
            "privacy policy",
            "terms and conditions",
            "sign up",
            "log in",
        )
        lines = [line.strip() for line in str(content or "").split("\n") if line.strip()]
        lines = [line for line in lines if not any(marker in line.lower() for marker in boilerplate_markers)]
        content = "\n".join(lines)

        return {"soup": soup, "content": content}

    def _extract_json_state_text(self, soup) -> List[str]:
        """
        Extract human-readable strings from inline JSON blobs.

        Many modern sites embed useful page data in scripts like __NEXT_DATA__,
        application/json state blobs, or hydration payloads.
        """
        candidates: List[str] = []

        def collect_strings(value: Any):
            if isinstance(value, str):
                text = value.strip()
                # Keep only reasonably informative text fragments.
                if (
                    len(text) >= 30
                    and len(text) <= 500
                    and " " in text
                    and not text.startswith(("http://", "https://", "/"))
                    and re.search(r"[A-Za-z]{3,}", text)
                ):
                    candidates.append(text)
                return
            if isinstance(value, list):
                for item in value:
                    collect_strings(item)
                return
            if isinstance(value, dict):
                for item in value.values():
                    collect_strings(item)

        for script in soup.find_all("script"):
            script_id = (script.get("id") or "").lower()
            script_type = (script.get("type") or "").lower()
            raw = script.string or script.get_text(strip=True)
            if not raw:
                continue

            looks_like_json = (
                script_id in {"__next_data__", "__nuxt_data__"}
                or script_type in {"application/json", "application/ld+json"}
                or raw.startswith("{")
                or raw.startswith("[")
            )
            if not looks_like_json:
                continue

            try:
                payload = json.loads(raw)
            except Exception:
                continue

            collect_strings(payload)

        # Dedupe while preserving order and limit expansion noise.
        deduped = list(dict.fromkeys(candidates))
        return deduped[:80]

    def _should_retry_with_rendered_fallback(self, html: str, content: str) -> bool:
        min_words = int(os.getenv("BRIGHTDATA_MIN_WORDS", "80"))
        force_on_thin = os.getenv("BRIGHTDATA_FORCE_RENDER_ON_THIN", "true").strip().lower() in {"1", "true", "yes", "on"}
        word_count = len((content or "").split())
        html_lower = (html or "").lower()
        html_len = len(html or "")
        js_shell_signals = (
            "__next_data__" in html_lower
            or "id=\"__next\"" in html_lower
            or "id='__next'" in html_lower
            or "id=\"app\"" in html_lower
            or "id='app'" in html_lower
            or "window.__" in html_lower
        )
        large_but_empty = word_count == 0 and html_len > 10000
        if force_on_thin and word_count < min_words:
            return True
        return word_count < min_words and (js_shell_signals or large_but_empty)

    async def _scrape_batch_fallback(self, urls: List[str]) -> Dict[str, Any]:
        """Fallback: Batch scrape with httpx"""
        import httpx
        from bs4 import BeautifulSoup

        logger.warning(f"⚠️ Using fallback batch scraping (not BrightData): {len(urls)} URLs")

        results = []
        failed_count = 0

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for url in urls:
                try:
                    # Ensure URL has protocol
                    if not url.startswith(('http://', 'https://')):
                        url = f'https://{url}'

                    response = await client.get(url)
                    response.raise_for_status()

                    # Parse HTML
                    soup = BeautifulSoup(response.text, 'html.parser')

                    # Remove scripts/styles
                    for tag in soup(["script", "style", "nav", "footer", "header"]):
                        tag.decompose()

                    # Extract main content
                    main = soup.find('main') or soup.find('article') or soup.body
                    if main:
                        content = self._html_to_text(main)
                    else:
                        content = soup.get_text(separator='\n', strip=True)

                    # Clean up
                    lines = [line.strip() for line in content.split('\n') if line.strip()]
                    content = '\n'.join(lines)

                    results.append({
                        "url": url,
                        "status": "success",
                        "content": content,
                        "metadata": {
                            "word_count": len(content.split()),
                            "source": "fallback_httpx"
                        }
                    })

                except Exception as e:
                    failed_count += 1
                    results.append({
                        "url": url,
                        "status": "error",
                        "error": str(e)
                    })

        successful = len([r for r in results if r['status'] == 'success'])

        logger.info(f"✅ Fallback batch scrape complete: {successful}/{len(urls)} successful")

        return {
            "status": "success",
            "total_urls": len(urls),
            "successful": successful,
            "failed": failed_count,
            "results": results,
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "source": "fallback_httpx",
                "warning": "BrightData SDK unavailable, using httpx"
            }
        }

    def _html_to_text(self, element) -> str:
        """Convert HTML element to plain text"""
        if not element:
            return ""

        lines = []
        for child in element.descendants:
            if child.name in ['h1', 'h2', 'h3']:
                text = child.get_text(strip=True)
                if text:
                    lines.append(f"{'#' * child.name.index('h')} {text}")
            elif child.name in ['p', 'div', 'li']:
                text = child.get_text(strip=True)
                if text:
                    lines.append(text)
            elif child.name == 'a':
                text = child.get_text(strip=True)
                href = child.get('href', '')
                if text and href:
                    lines.append(f"[{text}]({href})")

        return '\n\n'.join(lines) if lines else element.get_text(separator='\n', strip=True)

    def _extract_publication_date(
        self,
        soup,
        html_content: str,
        url: str
    ) -> Optional[datetime]:
        """
        Extract publication date from HTML metadata

        Looks for publication dates in common locations:
        - <meta property="article:published_time">
        - <meta property="article:modified_time">
        - <meta name="date" content="...">
        - <meta name="pubdate" content="...">
        - <time datetime="...">
        - JSON-LD schema.org datePublished
        - Open Graph article:published_time
        - URL patterns (e.g., /2024/01/15/)

        Args:
            soup: BeautifulSoup parsed HTML
            html_content: Raw HTML content
            url: Page URL (for fallback date extraction)

        Returns:
            datetime object if found, None otherwise
        """
        from datetime import datetime
        import re
        try:
            from dateutil import parser as date_parser
        except Exception:
            date_parser = None

        date_formats = [
            # ISO 8601 formats
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}',
            r'\d{4}-\d{2}-\d{2}',
            # Common date formats
            r'\d{1,2}/\d{1,2}/\d{4}',
            r'\d{4}/\d{1,2}/\d{1,2}',
            r'\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}',
            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}',
        ]

        # 1. Check meta tags for article published time
        for meta_name in ['article:published_time', 'article:modified_time', 'article:published', 'pubdate', 'date', 'publish-date', 'publish_date']:
            if date_parser is None:
                break
            meta = soup.find('meta', property=meta_name) or soup.find('meta', attrs={'name': meta_name})
            if meta:
                content = meta.get('content', '')
                if content:
                    try:
                        dt = date_parser.parse(content)
                        logger.debug(f"Found publication date in {meta_name}: {dt}")
                        return dt
                    except:
                        continue

        # 2. Check <time> tags
        for time_tag in soup.find_all('time'):
            if date_parser is None:
                break
            datetime_attr = time_tag.get('datetime')
            if datetime_attr:
                try:
                    dt = date_parser.parse(datetime_attr)
                    logger.debug(f"Found publication date in <time>: {dt}")
                    return dt
                except:
                    continue

        # 3. Check JSON-LD schema.org data
        for script in soup.find_all('script', type='application/ld+json'):
            if date_parser is None:
                break
            try:
                import json
                data = json.loads(script.string)
                # Handle both single object and array
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if isinstance(item, dict):
                        # Check for datePublished or dateModified
                        for date_field in ['datePublished', 'dateModified', 'uploadDate', 'publicationDate']:
                            if date_field in item:
                                try:
                                    dt = date_parser.parse(item[date_field])
                                    logger.debug(f"Found publication date in JSON-LD {date_field}: {dt}")
                                    return dt
                                except:
                                    continue
            except:
                continue

        # 4. Check Open Graph meta tags
        og_article = soup.find('meta', property='article:published_time')
        if og_article and date_parser is not None:
            content = og_article.get('content', '')
            if content:
                try:
                    dt = date_parser.parse(content)
                    logger.debug(f"Found publication date in OG article:published_time: {dt}")
                    return dt
                except:
                    pass

        # 5. Extract date from URL patterns (e.g., /2024/01/15/article-slug)
        url_date_match = re.search(r'/(\d{4})/(\d{1,2})/(\d{1,2})/', url)
        if url_date_match:
            year, month, day = url_date_match.groups()
            try:
                dt = datetime(int(year), int(month), int(day))
                logger.debug(f"Found publication date in URL: {dt}")
                return dt
            except:
                pass

        # 5b. Check for date patterns in URL path like /news/2024/january/article
        url_date_match2 = re.search(r'/(\d{4})/(january|february|march|april|may|june|july|august|september|october|november|december)/', url, re.IGNORECASE)
        if url_date_match2:
            year, month_name = url_date_match2.groups()
            try:
                month_num = {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
                    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
                }[month_name.lower()]
                dt = datetime(int(year), month_num, 1)
                logger.debug(f"Found publication date in URL (month name): {dt}")
                return dt
            except:
                pass

        # 5c. Check for common sports news URL patterns like /news/20250115/
        url_date_match3 = re.search(r'/(news|posts|article)/(\d{8})/', url)
        if url_date_match3:
            date_str = url_date_match3.group(2)
            try:
                dt = datetime.strptime(date_str, '%Y%m%d')
                logger.debug(f"Found publication date in URL (YYYYMMDD): {dt}")
                return dt
            except:
                pass

        # 6. Look for common date patterns in the content (last resort)
        # Check for dates in heading elements near the title
        for tag in soup.find_all(['h1', 'h2', 'h3']):
            if date_parser is None:
                break
            text = tag.get_text(strip=True)
            # Pattern: "Published January 15, 2024" or similar
            date_match = re.search(r'(?:published|posted|updated|on)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})', text, re.IGNORECASE)
            if date_match:
                try:
                    dt = date_parser.parse(date_match.group(1))
                    # Sanity check: date shouldn't be in the future
                    if dt.year <= datetime.now().year + 1:  # Allow for timezone differences
                        logger.debug(f"Found publication date in heading: {dt}")
                        return dt
                except:
                    pass

        logger.debug("No publication date found in HTML")
        return None


# Test client instantiation
if __name__ == "__main__":
    import asyncio

    async def test_client():
        """Test BrightData SDK client"""
        client = BrightDataSDKClient()

        # Test search
        print("Testing Google search...")
        search_result = await client.search_engine("Arsenal FC CRM", engine="google", num_results=3)
        print(f"Search result status: {search_result['status']}")
        if search_result['status'] == 'success':
            print(f"Found {len(search_result['results'])} results")
            for i, result in enumerate(search_result['results'][:2], 1):
                print(f"  {i}. {result.get('title')}")
                print(f"     {result.get('url')}")

        # Test scrape
        print("\nTesting URL scrape...")
        scrape_result = await client.scrape_as_markdown("https://arsenal.com")
        print(f"Scrape result status: {scrape_result['status']}")
        if scrape_result['status'] == 'success':
            content_len = len(scrape_result['content'])
            print(f"Scraped {content_len} characters")
            print(f"Preview: {scrape_result['content'][:200]}...")

    asyncio.run(test_client())
