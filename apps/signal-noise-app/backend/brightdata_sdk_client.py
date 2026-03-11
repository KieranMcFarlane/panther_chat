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
import logging
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
from urllib.parse import urlparse

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
        try:
            from dotenv import load_dotenv
            from pathlib import Path

            # Try current directory first, then parent directory
            load_dotenv()  # Current directory

            # Also try parent directory explicitly (for backend/ scripts)
            parent_env = Path(__file__).parent.parent / '.env'
            if parent_env.exists():
                load_dotenv(parent_env, override=True)
                logger.info(f"✅ Loaded .env from parent directory: {parent_env}")
        except Exception:
            # dotenv is optional in production envs where variables are already injected
            logger.debug("python-dotenv unavailable; relying on process environment")

        # Store token from environment if not provided
        if token is None:
            token = os.getenv('BRIGHTDATA_API_TOKEN')

        self.token = token
        self.request_timeout_seconds = float(os.getenv("BRIGHTDATA_SDK_TIMEOUT_SECONDS", "45"))
        self.api_url = os.getenv("BRIGHTDATA_API_URL", "https://api.brightdata.com").rstrip("/")
        self.default_zone = os.getenv("BRIGHTDATA_ZONE")
        self.serp_zone = os.getenv("BRIGHTDATA_SERP_ZONE")
        self.unlocker_zone = os.getenv("BRIGHTDATA_UNLOCKER_ZONE")
        self.serp_timeout_seconds = float(os.getenv("BRIGHTDATA_SERP_TIMEOUT_SECONDS", "30"))
        self.serp_poll_attempts = int(os.getenv("BRIGHTDATA_SERP_POLL_ATTEMPTS", "6"))
        self.serp_poll_interval_seconds = float(os.getenv("BRIGHTDATA_SERP_POLL_INTERVAL_SECONDS", "1.2"))
        self._client = None
        self._client_context = None
        self._client_lock = asyncio.Lock()

        if not self.token:
            logger.warning("⚠️ BRIGHTDATA_API_TOKEN not found in environment")

    async def _with_timeout(self, awaitable):
        return await asyncio.wait_for(awaitable, timeout=self.request_timeout_seconds)

    async def _get_client(self):
        """Get or create async client context"""
        async with self._client_lock:
            if self._client is None:
                try:
                    from brightdata import BrightDataClient
                    self._client_context = BrightDataClient(self.token)
                    self._client = await self._with_timeout(self._client_context.__aenter__())
                    logger.info("✅ BrightData SDK client initialized")
                except Exception as e:
                    logger.warning(f"⚠️ BrightData SDK initialization failed: {e}")
                    logger.info("ℹ️ Will use fallback httpx client for scraping")
                    # Set to None to indicate SDK unavailable
                    self._client = False
                    self._client_context = None
        if self._client is False:
            raise RuntimeError("BrightData SDK unavailable, fallback will be used")
        return self._client

    async def close(self) -> None:
        """Close the underlying BrightData SDK session if one was opened."""
        async with self._client_lock:
            if self._client_context is None or self._client is False:
                self._client = None if self._client is not False else False
                return

            try:
                await self._client_context.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"⚠️ BrightData SDK client close failed: {e}")
            finally:
                self._client = None
                self._client_context = None

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

            # Call search directly (SDK methods are async)
            if engine.lower() == "google":
                result = await self._with_timeout(
                    client.search.google(
                        query=query,
                        country=country,
                        num=num_results,
                    )
                )
            elif engine.lower() == "bing":
                result = await self._with_timeout(
                    client.search.bing(
                        query=query,
                        country=country,
                        num=num_results,
                    )
                )
            elif engine.lower() == "yandex":
                result = await self._with_timeout(
                    client.search.yandex(
                        query=query,
                        num=num_results,
                    )
                )
            else:
                return {
                    "status": "error",
                    "error": f"Unsupported search engine: {engine}",
                    "query": query,
                    "engine": engine
                }

            # Check if result has data
            if not result or not hasattr(result, 'data'):
                return {
                    "status": "error",
                    "error": "No results returned",
                    "query": query,
                    "engine": engine
                }

            # Format results based on data structure
            results = []
            content = result.data if hasattr(result, 'data') else []

            # Handle data format (list of dicts)
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        results.append({
                            "position": item.get('position'),
                            "title": item.get('title'),
                            "url": item.get('url'),
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

            try:
                client = await self._get_client()
            except RuntimeError:
                # SDK unavailable, use fallback directly
                logger.info("ℹ️ Using fallback scrape (SDK unavailable)")
                return await self._scrape_as_markdown_fallback(url)

            # Ensure URL has protocol
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'

            # Async scraping (SDK method is async)
            result = await self._with_timeout(
                client.scrape_url(
                    url,
                    response_format='raw',
                )
            )

            # Check result
            if not result or not hasattr(result, 'data'):
                return {
                    "status": "error",
                    "error": "No content returned",
                    "url": url
                }

            # Convert HTML to markdown
            from bs4 import BeautifulSoup
            html_content = result.data if hasattr(result, 'data') else ""
            soup = BeautifulSoup(html_content, 'html.parser')

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

            if not content:
                logger.warning("⚠️ SDK scrape returned empty content for %s, falling back to HTTP request path", url)
                return await self._scrape_as_markdown_fallback(url)

            logger.info(f"✅ Scraped {len(content)} characters")

            # Extract publication date from HTML metadata
            publication_date = self._extract_publication_date(soup, html_content, url)

            return {
                "status": "success",
                "url": url,
                "content": content,
                "raw_html": html_content,  # Include raw HTML for PDF link extraction
                "timestamp": datetime.now().isoformat(),
                "publication_date": publication_date.isoformat() if publication_date else None,
                "metadata": {
                    "word_count": len(content.split()),
                    "source": "brightdata_sdk",
                    "has_publication_date": publication_date is not None
                }
            }

        except Exception as e:
            logger.warning(f"⚠️ BrightData scrape failed, using fallback: {e}")
            # Fall back to httpx scraping
            return await self._scrape_as_markdown_fallback(url)

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
                    if result and hasattr(result, 'data'):
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
        """Fallback: Use BrightData SERP HTTP API when SDK unavailable."""
        import httpx

        if not self.token:
            return {
                "status": "error",
                "error": "BRIGHTDATA_API_TOKEN not configured",
                "query": query,
                "engine": engine,
                "metadata": {
                    "source": "brightdata_http_fallback",
                },
            }

        zone_candidates = self._resolve_serp_zone_candidates(engine=engine, query=query)
        endpoint_candidates = self._resolve_serp_endpoint_candidates()
        attempts: List[Dict[str, Any]] = []

        logger.info(
            "🔍 BrightData HTTP fallback search: %s (zones=%s, endpoints=%s)",
            query,
            zone_candidates,
            endpoint_candidates,
        )
        try:
            async with httpx.AsyncClient(timeout=self.serp_timeout_seconds) as client:
                for endpoint in endpoint_candidates:
                    for zone in zone_candidates:
                        if endpoint.rstrip("/").endswith("/serp/req"):
                            payload: Dict[str, Any] = {
                                "zone": zone,
                                "query": {"q": query},
                                "brd_json": "json",
                            }
                            if country:
                                payload["query"]["country"] = country
                            if num_results:
                                payload["query"]["num"] = num_results
                        else:
                            payload = {
                                "query": query,
                                "format": "json",
                                "zone": zone,
                            }
                            if country:
                                payload["country"] = country
                            if num_results:
                                payload["num_results"] = num_results

                        try:
                            response = await client.post(
                                endpoint,
                                headers={
                                    "Authorization": f"Bearer {self.token}",
                                    "Content-Type": "application/json",
                                },
                                json=payload,
                            )
                            if response.status_code >= 400:
                                preview = response.text[:220]
                                attempts.append(
                                    {
                                        "endpoint": endpoint,
                                        "zone": zone,
                                        "status_code": response.status_code,
                                        "preview": preview,
                                    }
                                )
                                continue

                            raw = response.json()
                            normalized_results = self._normalize_serp_results(raw, num_results=num_results)
                            if not normalized_results and isinstance(raw, dict):
                                response_id = raw.get("response_id")
                                if isinstance(response_id, str) and response_id.strip():
                                    raw = await self._poll_serp_result_payload(
                                        client=client,
                                        response_id=response_id.strip(),
                                        zone=zone,
                                    )
                                    normalized_results = self._normalize_serp_results(raw, num_results=num_results)

                            if not normalized_results:
                                attempts.append(
                                    {
                                        "endpoint": endpoint,
                                        "zone": zone,
                                        "status_code": response.status_code,
                                        "preview": "empty normalized results",
                                    }
                                )
                                continue

                            return {
                                "status": "success",
                                "engine": engine,
                                "query": query,
                                "results": normalized_results,
                                "timestamp": datetime.now().isoformat(),
                                "metadata": {
                                    "source": "brightdata_http_fallback",
                                    "zone": zone,
                                    "endpoint": endpoint,
                                    "country": country,
                                    "async_polling": True,
                                    "raw_result_count": len(raw.get("results", [])) if isinstance(raw, dict) else None,
                                },
                            }
                        except Exception as endpoint_error:
                            attempts.append(
                                {
                                    "endpoint": endpoint,
                                    "zone": zone,
                                    "error": str(endpoint_error)[:220],
                                }
                            )
        except Exception as e:
            logger.error("❌ BrightData HTTP fallback client exception: %s", e)
            return {
                "status": "error",
                "error": str(e),
                "query": query,
                "engine": engine,
                "metadata": {
                    "source": "brightdata_http_fallback",
                    "attempts": attempts[:6],
                },
            }

        logger.error("❌ BrightData HTTP fallback exhausted all endpoint/zone candidates")
        return {
            "status": "error",
            "error": "BrightData SERP fallback exhausted endpoint/zone candidates",
            "query": query,
            "engine": engine,
            "metadata": {
                "source": "brightdata_http_fallback",
                "attempts": attempts[:8],
            },
        }

    def _resolve_serp_zone_candidates(self, engine: str, query: str) -> List[str]:
        """Choose SERP zones to try for HTTP fallback based on query intent and engine."""
        query_l = (query or "").lower()
        zones: List[str] = []
        if self.serp_zone:
            zones.append(self.serp_zone)
        if self.default_zone:
            zones.append(self.default_zone)
        zones.append("sdk_serp")

        if "linkedin.com" in query_l or "linkedin " in query_l:
            zones.append("linkedin_posts_monitor")
        elif engine.lower() == "bing":
            zones.append("bing_search")
        elif engine.lower() == "yandex":
            zones.append("yandex_search")
        else:
            zones.append("google_search")

        # Preserve order and drop empties/duplicates
        unique: List[str] = []
        for zone in zones:
            if zone and zone not in unique:
                unique.append(zone)
        return unique or ["sdk_serp", "google_search"]

    async def _poll_serp_result_payload(self, client, response_id: str, zone: str) -> Dict[str, Any]:
        """Poll BrightData async SERP results for a response_id."""
        endpoint = f"{self.api_url.rstrip('/')}/serp/get_result"
        headers = {"Authorization": f"Bearer {self.token}"}
        params = {"response_id": response_id}
        if zone:
            params["zone"] = zone

        last_payload: Dict[str, Any] = {}
        for attempt in range(max(self.serp_poll_attempts, 1)):
            try:
                response = await client.get(endpoint, headers=headers, params=params)
                if response.status_code == 202:
                    if attempt < self.serp_poll_attempts - 1:
                        await asyncio.sleep(self.serp_poll_interval_seconds)
                        continue
                    return {"status": "pending", "response_id": response_id}
                if response.status_code >= 500:
                    await asyncio.sleep(self.serp_poll_interval_seconds)
                    continue
                if response.status_code >= 400:
                    # 404 can occur while result is still warming up.
                    if response.status_code == 404 and attempt < self.serp_poll_attempts - 1:
                        await asyncio.sleep(self.serp_poll_interval_seconds)
                        continue
                    return {"status": "error", "error": response.text[:220], "response_id": response_id}

                payload = response.json() if response.text else {}
                if isinstance(payload, dict):
                    last_payload = payload
                    if self._normalize_serp_results(payload, num_results=10):
                        return payload
                await asyncio.sleep(self.serp_poll_interval_seconds)
            except Exception as poll_error:
                logger.debug("SERP get_result polling failed (attempt=%s): %s", attempt + 1, poll_error)
                if attempt < self.serp_poll_attempts - 1:
                    await asyncio.sleep(self.serp_poll_interval_seconds)

        if last_payload:
            return last_payload
        return {"status": "error", "error": "SERP polling exhausted", "response_id": response_id}

    def _resolve_unlocker_zone_candidates(self) -> List[str]:
        """Choose request/unlocker zones to try for direct URL scraping."""
        zones: List[str] = []
        if self.unlocker_zone:
            zones.append(self.unlocker_zone)
        if self.default_zone:
            zones.append(self.default_zone)
        zones.extend(["sdk_unlocker", "mcp_unlocker"])

        unique: List[str] = []
        for zone in zones:
            if zone and zone not in unique:
                unique.append(zone)
        return unique or ["sdk_unlocker"]

    def _resolve_serp_endpoint_candidates(self) -> List[str]:
        """Resolve BrightData SERP endpoint candidates for account/API variants."""
        base = self.api_url.rstrip("/")
        if base.endswith("/serp") or base.endswith("/serp/req"):
            return [base]
        return [f"{base}/serp/req"]

    def _normalize_serp_results(self, payload: Any, num_results: int) -> List[Dict[str, Any]]:
        """Normalize BrightData SERP payloads into pipeline result schema."""
        if isinstance(payload, list):
            candidates = payload
        elif isinstance(payload, dict):
            if isinstance(payload.get("results"), list):
                candidates = payload.get("results", [])
            elif isinstance(payload.get("organic_results"), list):
                candidates = payload.get("organic_results", [])
            elif isinstance(payload.get("organic"), list):
                candidates = payload.get("organic", [])
            elif isinstance(payload.get("items"), list):
                candidates = payload.get("items", [])
            else:
                candidates = []
        else:
            candidates = []

        normalized: List[Dict[str, Any]] = []
        for idx, item in enumerate(candidates[:max(num_results, 1)]):
            if not isinstance(item, dict):
                continue
            url = (
                item.get("url")
                or item.get("link")
                or item.get("displayed_link")
                or item.get("domain")
                or ""
            )
            if url and not str(url).startswith(("http://", "https://")):
                parsed = str(url).strip("/")
                if "." in parsed:
                    url = f"https://{parsed}"

            snippet = (
                item.get("description")
                or item.get("snippet")
                or item.get("body")
                or item.get("text")
                or ""
            )
            title = item.get("title") or item.get("name") or str(urlparse(url).netloc or "Untitled")
            position = item.get("position") or item.get("rank") or (idx + 1)

            normalized.append(
                {
                    "position": position,
                    "title": str(title),
                    "url": str(url),
                    "snippet": str(snippet),
                }
            )

        return normalized

    async def _scrape_as_markdown_fallback(self, url: str) -> Dict[str, Any]:
        """Fallback: Try BrightData HTTP request API, then plain httpx."""
        import httpx
        from bs4 import BeautifulSoup

        logger.warning(f"⚠️ BrightData SDK unavailable, trying HTTP request fallback: {url}")

        try:
            # Ensure URL has protocol
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'

            # First: try BrightData request API using known unlocker-capable zones
            if self.token:
                zone_candidates = self._resolve_unlocker_zone_candidates()
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as api_client:
                    for zone in zone_candidates:
                        try:
                            bd_response = await api_client.post(
                                f"{self.api_url.rstrip('/')}/request",
                                headers={
                                    "Authorization": f"Bearer {self.token}",
                                    "Content-Type": "application/json",
                                },
                                json={
                                    "zone": zone,
                                    "url": url,
                                    "format": "raw",
                                },
                            )
                            if bd_response.status_code >= 400:
                                logger.debug(
                                    "BrightData request fallback failed: zone=%s status=%s preview=%s",
                                    zone,
                                    bd_response.status_code,
                                    bd_response.text[:160],
                                )
                                continue

                            html_body = bd_response.text
                            if html_body:
                                soup = BeautifulSoup(html_body, 'html.parser')

                                for tag in soup(["script", "style", "nav", "footer", "header"]):
                                    tag.decompose()

                                main = soup.find('main') or soup.find('article') or soup.body
                                if main:
                                    content = self._html_to_text(main)
                                else:
                                    content = soup.get_text(separator='\n', strip=True)

                                lines = [line.strip() for line in content.split('\n') if line.strip()]
                                content = '\n'.join(lines)
                                publication_date = self._extract_publication_date(soup, html_body, url)

                                return {
                                    "status": "success",
                                    "url": url,
                                    "content": content,
                                    "raw_html": html_body,
                                    "timestamp": datetime.now().isoformat(),
                                    "publication_date": publication_date.isoformat() if publication_date else None,
                                    "metadata": {
                                        "word_count": len(content.split()),
                                        "source": "brightdata_http_request_fallback",
                                        "zone": zone,
                                        "has_publication_date": publication_date is not None
                                    }
                                }
                        except Exception as zone_error:
                            logger.debug("BrightData request fallback exception (zone=%s): %s", zone, zone_error)

            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
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

                logger.info(f"✅ Fallback scraped {len(content)} characters")

                # Extract publication date from HTML metadata
                publication_date = self._extract_publication_date(soup, response.text, url)

                return {
                    "status": "success",
                    "url": url,
                    "content": content,
                    "raw_html": response.text,  # Include raw HTML for PDF link extraction
                    "timestamp": datetime.now().isoformat(),
                    "publication_date": publication_date.isoformat() if publication_date else None,
                    "metadata": {
                        "word_count": len(content.split()),
                        "source": "fallback_httpx",
                        "warning": "BrightData SDK unavailable, using httpx",
                        "has_publication_date": publication_date is not None
                    }
                }

        except Exception as e:
            logger.error(f"❌ Fallback scrape failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "url": url
            }

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
        from email.utils import parsedate_to_datetime
        import re

        try:
            from dateutil import parser as date_parser  # type: ignore
        except Exception:
            date_parser = None

        def _parse_date(value: Any) -> Optional[datetime]:
            if value is None:
                return None
            raw = str(value).strip()
            if not raw:
                return None

            if date_parser is not None:
                try:
                    return date_parser.parse(raw)
                except Exception:
                    pass

            # Fallback parser path when python-dateutil is unavailable.
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except Exception:
                pass

            try:
                parsed = parsedate_to_datetime(raw)
                return parsed
            except Exception:
                return None

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
            meta = soup.find('meta', property=meta_name) or soup.find('meta', attrs={'name': meta_name})
            if meta:
                content = meta.get('content', '')
                if content:
                    dt = _parse_date(content)
                    if dt is not None:
                        logger.debug(f"Found publication date in {meta_name}: {dt}")
                        return dt

        # 2. Check <time> tags
        for time_tag in soup.find_all('time'):
            datetime_attr = time_tag.get('datetime')
            if datetime_attr:
                dt = _parse_date(datetime_attr)
                if dt is not None:
                    logger.debug(f"Found publication date in <time>: {dt}")
                    return dt

        # 3. Check JSON-LD schema.org data
        for script in soup.find_all('script', type='application/ld+json'):
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
                                dt = _parse_date(item[date_field])
                                if dt is not None:
                                    logger.debug(f"Found publication date in JSON-LD {date_field}: {dt}")
                                    return dt
            except:
                continue

        # 4. Check Open Graph meta tags
        og_article = soup.find('meta', property='article:published_time')
        if og_article:
            content = og_article.get('content', '')
            if content:
                dt = _parse_date(content)
                if dt is not None:
                    logger.debug(f"Found publication date in OG article:published_time: {dt}")
                    return dt

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
            text = tag.get_text(strip=True)
            # Pattern: "Published January 15, 2024" or similar
            date_match = re.search(r'(?:published|posted|updated|on)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})', text, re.IGNORECASE)
            if date_match:
                dt = _parse_date(date_match.group(1))
                # Sanity check: date shouldn't be in the future
                if dt is not None and dt.year <= datetime.now().year + 1:  # Allow for timezone differences
                    logger.debug(f"Found publication date in heading: {dt}")
                    return dt

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
