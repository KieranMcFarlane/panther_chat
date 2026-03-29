"""BrightData MCP client for hosted BrightData MCP and explicit local transport comparison.

This module provides the BrightData retrieval client used by the pipeline and
the persistent FastMCP wrapper. It prefers the hosted BrightData MCP endpoint
when configured.
"""

import asyncio
import json
import logging
import os
import re
from abc import ABC, abstractmethod
from urllib.parse import quote
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
_HOSTED_MCP_DEFAULT_URL = "https://mcp.brightdata.com/mcp"


def _redact_token_in_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return url
    return re.sub(r"(token=)[^&]+", r"\1***", url)


class BrightDataClient(ABC):
    """
    Abstract interface for BrightData client

    All implementations must provide these methods.
    The agent doesn't know or care which implementation is used.
    """

    @abstractmethod
    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search using search engine"""
        pass

    @abstractmethod
    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """Scrape URL to markdown"""
        pass

    @abstractmethod
    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        """Scrape multiple URLs"""
        pass

    @abstractmethod
    async def scrape_jobs_board(
        self,
        entity_name: str,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """Search job boards for entity roles"""
        pass

    @abstractmethod
    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        """Scrape press releases for entity"""
        pass

    async def prewarm(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Prewarm any underlying connection/session state."""
        return {"status": "success", "prewarmed": False, "timeout": timeout}


class BrightDataHTTPClient(BrightDataClient):
    """
    HTTP implementation of BrightData client

    Uses httpx + BeautifulSoup for web scraping and search.
    """

    def __init__(self):
        self.api_token = os.getenv("BRIGHTDATA_API_TOKEN")
        self.pro_mode = os.getenv("BRIGHTDATA_PRO_MODE", "true").lower() == "true"
        logger.info("🌐 BrightDataHTTPClient initialized")

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search using DuckDuckGo (no API key needed)"""
        try:
            import httpx
            from bs4 import BeautifulSoup
        except ImportError:
            return {
                "status": "error",
                "error": "httpx or beautifulsoup4 not installed",
                "query": query
            }

        try:
            logger.info(f"🔍 HTTP search: {query}")

            async with httpx.AsyncClient(timeout=30.0) as client:
                ddg_url = "https://html.duckduckgo.com/html/"
                params = {"q": query, "kl": "us-en"}

                response = await client.get(ddg_url, params=params, follow_redirects=True)
                response.raise_for_status()

                soup = BeautifulSoup(response.text, 'html.parser')
                results = []

                for div in soup.find_all('div', class_='result')[: max(1, int(num_results or 10))]:
                    title_elem = div.find('a', class_='result__a')
                    snippet_elem = div.find('a', class_='result__snippet')

                    if title_elem:
                        results.append({
                            "title": title_elem.get_text(strip=True),
                            "url": title_elem.get('href', ''),
                            "snippet": snippet_elem.get_text(strip=True) if snippet_elem else ""
                        })

                logger.info(f"✅ HTTP search returned {len(results)} results")

                return {
                    "status": "success",
                    "engine": engine,
                    "query": query,
                    "results": results,
                    "cursor": None,
                    "timestamp": datetime.now().isoformat(),
                    "metadata": {"source": "http_client", "search_engine": "duckduckgo"}
                }

        except Exception as e:
            logger.error(f"❌ HTTP search failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "query": query,
                "engine": engine
            }

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """Scrape URL using httpx + BeautifulSoup"""
        try:
            import httpx
            from bs4 import BeautifulSoup
        except ImportError:
            return {
                "status": "error",
                "error": "httpx or beautifulsoup4 not installed",
                "url": url
            }

        try:
            logger.info(f"📄 HTTP scrape: {url}")

            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                }

                response = await client.get(url, headers=headers)
                response.raise_for_status()

                soup = BeautifulSoup(response.text, 'html.parser')

                # Remove non-content elements
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()

                # Find main content
                main_content = (
                    soup.find('main') or
                    soup.find('article') or
                    soup.find('div', class_='content') or
                    soup.body
                )

                if main_content:
                    content = self._html_to_markdown(main_content)
                else:
                    content = soup.get_text(separator='\n', strip=True)

                # Clean up
                lines = [line.strip() for line in content.split('\n') if line.strip()]
                content = '\n'.join(lines)

                logger.info(f"✅ HTTP scraped {len(content)} characters")

                return {
                    "status": "success",
                    "url": url,
                    "content": content,
                    "timestamp": datetime.now().isoformat(),
                    "metadata": {
                        "word_count": len(content.split()),
                        "source": "http_client"
                    }
                }

        except Exception as e:
            logger.error(f"❌ HTTP scrape failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "url": url
            }

    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        """Scrape multiple URLs concurrently"""
        if len(urls) > 10:
            logger.warning("⚠️ Batch limit is 10 URLs, truncating")
            urls = urls[:10]

        logger.info(f"📦 HTTP batch scrape: {len(urls)} URLs")

        tasks = [self.scrape_as_markdown(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful_results = []
        failed_count = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_count += 1
                successful_results.append({
                    "url": urls[i],
                    "status": "error",
                    "error": str(result)
                })
            elif result.get("status") == "success":
                successful_results.append(result)
            else:
                failed_count += 1
                successful_results.append(result)

        successful = len(results) - failed_count

        logger.info(f"✅ HTTP batch scrape complete: {successful}/{len(urls)} successful")

        return {
            "status": "success",
            "total_urls": len(urls),
            "successful": successful,
            "failed": failed_count,
            "results": successful_results,
            "timestamp": datetime.now().isoformat(),
            "metadata": {"source": "http_client"}
        }

    def _html_to_markdown(self, element) -> str:
        """Convert HTML to markdown-like text"""
        if not element:
            return ""

        lines = []

        for child in element.descendants:
            if child.name == 'h1':
                text = child.get_text(strip=True)
                if text:
                    lines.append(f"# {text}")
            elif child.name == 'h2':
                text = child.get_text(strip=True)
                if text:
                    lines.append(f"## {text}")
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

    async def scrape_jobs_board(
        self,
        entity_name: str,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """Search job boards for entity roles"""
        keyword_str = " ".join(keywords[:3])  # Limit to 3 keywords
        query = f'"{entity_name}" {keyword_str} jobs careers'
        return await self.search_engine(query, engine="google")

    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        """Scrape press releases for entity"""
        query = f'"{entity_name}" press release announcement news'
        return await self.search_engine(query, engine="google")


class BrightDataMCPClient(BrightDataClient):
    """
    MCP implementation of BrightData client

    Uses stdio transport to @brightdata/mcp npm package.
    Falls back gracefully if MCP unavailable.
    """

    def __init__(self, timeout: float = 5.0):
        self.api_token = os.getenv("BRIGHTDATA_API_TOKEN")
        self.pro_mode = os.getenv("BRIGHTDATA_PRO_MODE", "true").lower() == "true"
        self.timeout = timeout
        self.session = None
        self._transport_context = None
        self._available = False
        self._session_init_task: Optional[asyncio.Task] = None
        self._warm_service_enabled = os.getenv("BRIGHTDATA_MCP_WARM_SERVICE", "true").strip().lower() in {"1", "true", "yes", "on"}
        self._hosted_mcp_url = self._resolve_hosted_mcp_url()
        self._transport = "hosted_sse" if self._hosted_mcp_url else "stdio"

        # Check if MCP package is available
        try:
            from fastmcp import Client as FastMCPClient
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
            from mcp.client.sse import sse_client
            self._mcp_available = True
        except ImportError:
            self._mcp_available = False
            logger.warning("⚠️ mcp package not installed")

        logger.info(
            "🌐 BrightDataMCPClient initialized (timeout: %ss, transport=%s, mcp_available=%s)",
            timeout,
            self._transport,
            self._mcp_available,
        )

    def _resolve_hosted_mcp_url(self) -> Optional[str]:
        """Resolve the hosted Bright Data MCP URL if enabled."""
        hosted_url = str(os.getenv("BRIGHTDATA_MCP_HOSTED_URL") or "").strip()
        if hosted_url:
            return hosted_url

        if os.getenv("BRIGHTDATA_MCP_USE_HOSTED", "").strip().lower() in {"0", "false", "no", "off"}:
            return None

        token = str(self.api_token or "").strip()
        if not token:
            return None

        return f"{_HOSTED_MCP_DEFAULT_URL}?token={quote(token, safe='')}"

    async def _ensure_session(self):
        """Initialize MCP session with timeout protection"""
        # If already failed or session exists, skip
        if not self._mcp_available:
            return

        if self.session and self._available:
            return

        if self.session and not self._available:
            await self._reset_session_state()

        try:
            logger.info(f"⏳ Initializing MCP session (timeout: {self.timeout}s)...")

            if self._session_init_task is None or self._session_init_task.done():
                self._session_init_task = asyncio.create_task(self._init_mcp_session())

            # Use asyncio.wait_for to enforce timeout while warm-service mode keeps
            # the MCP process starting in the background.
            await asyncio.wait_for(asyncio.shield(self._session_init_task), timeout=self.timeout)

            self._available = True
            self._mcp_available = True  # Re-enable if successful
            logger.info("✅ MCP session initialized")

        except asyncio.TimeoutError:
            if self._warm_service_enabled:
                logger.warning(f"⚠️ MCP initialization timed out after {self.timeout}s - warm service continues in background")
            else:
                logger.warning(f"⚠️ MCP initialization timed out after {self.timeout}s - will use alternate transport")
            self._available = False
            if not self._warm_service_enabled:
                self._mcp_available = False
                self.session = None
        except Exception as e:
            logger.error(f"❌ MCP initialization failed: {e} - will use alternate transport")
            self._available = False
            self.session = None
            self._mcp_available = False
            self._session_init_task = None

    async def _reset_session_state(self):
        """Clear any stale MCP session so a fresh connection can be established."""
        if self._transport_context:
            try:
                await self._transport_context.__aexit__(None, None, None)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Ignoring error while closing stale MCP transport: %s", exc)
        self.session = None
        self._transport_context = None
        self._available = False
        self._session_init_task = None

    async def prewarm(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Force MCP session initialization ahead of the first real search."""
        if timeout is None:
            timeout = self.timeout

        if not self._mcp_available:
            return {"status": "error", "error": "mcp_unavailable", "prewarmed": False, "timeout": timeout}

        if self.session and self._available:
            return {"status": "success", "prewarmed": True, "timeout": timeout}

        original_timeout = self.timeout
        self.timeout = float(timeout)
        try:
            await self._ensure_session()
            return {
                "status": "success" if self.session and self._available else ("warming" if self._warm_service_enabled else "error"),
                "prewarmed": bool(self.session and self._available),
                "timeout": timeout,
                "warming": bool(self._warm_service_enabled and self._session_init_task and not self._session_init_task.done()),
            }
        finally:
            self.timeout = original_timeout

    async def _init_mcp_session(self):
        """Actual MCP initialization (separated for timeout)"""
        from fastmcp import Client as FastMCPClient
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
        from mcp.client.sse import sse_client

        if self._hosted_mcp_url:
            logger.info(
                "🌐 Initializing hosted BrightData MCP session via FastMCP: %s",
                _redact_token_in_url(self._hosted_mcp_url),
            )
            self._transport_context = FastMCPClient(self._hosted_mcp_url, timeout=self.timeout)
            self.session = await self._transport_context.__aenter__()
            return

        server_command = os.getenv("BRIGHTDATA_MCP_SERVER_COMMAND", "node")
        server_path = os.getenv("BRIGHTDATA_MCP_SERVER_PATH")
        if not server_path:
          server_path = str(
              Path(__file__).resolve().parent.parent
              / "mcp-servers"
              / "src"
              / "mcp-servers"
              / "brightdata-server.js"
          )

        server_params = StdioServerParameters(
            command=server_command,
            args=[server_path] if server_command != "npx" else ["-y", os.getenv("BRIGHTDATA_MCP_SERVER_PACKAGE", "@brightdata/mcp")],
            env={
                "BRIGHTDATA_API_TOKEN": self.api_token or "",
                "BRIGHTDATA_TOKEN": self.api_token or "",
                "BRIGHTDATA_ZONE": os.getenv("BRIGHTDATA_ZONE", ""),
                "BRIGHTDATA_API_URL": os.getenv("BRIGHTDATA_API_URL", "https://api.brightdata.com"),
                "PRO_MODE": "true" if self.pro_mode else "false",
            }
        )

        self._transport_context = stdio_client(server_params)
        stdio, write = await self._transport_context.__aenter__()

        self.session = ClientSession(stdio, write)
        await self.session.initialize()

    async def close(self):
        """Close MCP session"""
        if getattr(self, "_pipeline_shared_client", False):
            logger.info("ℹ️ Shared pipeline MCP client close skipped (warm service mode)")
            return
        if self._transport_context:
            try:
                await self._transport_context.__aexit__(None, None, None)
                logger.info("✅ MCP session closed")
            except Exception as e:
                logger.error(f"❌ Error closing MCP session: {e}")
            finally:
                self.session = None
                self._transport_context = None
                self._available = False
        if self._session_init_task and not self._session_init_task.done():
            self._session_init_task.cancel()

    async def _call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call MCP tool, return None if unavailable"""
        await self._ensure_session()

        if not self.session or not self._available:
            logger.info(f"ℹ️ MCP unavailable for {tool_name}")
            return None

        async def _invoke_once() -> Optional[Dict[str, Any]]:
            try:
                result = await self.session.call_tool(tool_name, arguments=arguments)

                if hasattr(result, 'content'):
                    content_text = ""
                    for item in result.content:
                        if hasattr(item, 'text'):
                            content_text += item.text

                    try:
                        return json.loads(content_text)
                    except json.JSONDecodeError:
                        return {"status": "success", "content": content_text}
                else:
                    return {"status": "success", "result": str(result)}
            except Exception as exc:  # noqa: BLE001
                logger.error(f"❌ MCP tool call failed: {exc}")
                return None

        try:
            result = await _invoke_once()
            if result is not None:
                return result

            retryable = self.session is not None and self._available
            if not retryable:
                return None

            await self._reset_session_state()
            await self._ensure_session()
            if not self.session or not self._available:
                return None

            logger.info("🔁 Retrying MCP tool call once after reconnect: %s", tool_name)
            return await _invoke_once()
        except Exception as exc:  # noqa: BLE001
            logger.error(f"❌ MCP tool call failed: {exc}")
            return None

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search via MCP and return an error if unavailable."""
        logger.info(f"🔍 MCP search: {query}")

        arguments: Dict[str, Any] = {"query": query, "engine": engine}
        if self._transport == "hosted_sse":
            if country:
                arguments["geo_location"] = country
        else:
            arguments["country"] = country
            arguments["num_results"] = num_results
        if cursor:
            arguments["cursor"] = cursor

        result = await self._call_tool("search_engine", arguments)

        if result is None or result.get("status") == "error":
            return {
                "status": "error",
                "error": "MCP unavailable",
                "query": query,
                "engine": engine,
                "transport_retryable": True
            }

        normalized_results = list(result.get("results") or [])
        if not normalized_results and isinstance(result.get("organic"), list):
            for item in result.get("organic", []):
                normalized_results.append(
                    {
                        "title": item.get("title"),
                        "url": item.get("link") or item.get("url"),
                        "snippet": item.get("description") or item.get("snippet"),
                    }
                )

        return {
            "status": "success",
            "engine": engine,
            "query": query,
            "results": normalized_results,
            "cursor": result.get("cursor"),
            "timestamp": datetime.now().isoformat(),
            "metadata": {"source": "mcp_client", "pro_mode": self.pro_mode}
        }

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """Scrape via MCP and return an error if unavailable."""
        logger.info(f"📄 MCP scrape: {url}")

        result = await self._call_tool("scrape_as_markdown", {"url": url})

        if result is None or result.get("status") == "error":
            return {
                "status": "error",
                "error": "MCP unavailable",
                "url": url,
                "transport_retryable": True
            }

        content = result.get("content") or result.get("markdown") or result.get("text", "")

        return {
            "status": "success",
            "url": url,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "word_count": len(content.split()),
                "source": "mcp_client",
                "pro_mode": self.pro_mode
            }
        }

    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        """Batch scrape via MCP and return an error if unavailable."""
        if len(urls) > 10:
            urls = urls[:10]

        logger.info(f"📦 MCP batch scrape: {len(urls)} URLs")

        result = await self._call_tool("scrape_batch", {"urls": urls})

        if result is None:
            return {
                "status": "error",
                "error": "MCP unavailable",
                "total_urls": len(urls),
                "transport_retryable": True
            }

        if isinstance(result, list):
            results = result
            successful = sum(1 for item in results if isinstance(item, dict) and item.get("status") != "error")
            failed = max(len(urls) - successful, 0)
            return {
                "status": "success",
                "total_urls": len(urls),
                "successful": successful,
                "failed": failed,
                "results": results,
                "timestamp": datetime.now().isoformat(),
                "metadata": {"source": "mcp_client", "pro_mode": self.pro_mode},
            }

        if result.get("status") == "error":
            return {
                "status": "error",
                "error": result.get("error") or "MCP unavailable",
                "total_urls": len(urls),
                "transport_retryable": True
            }

        results = result.get("results", [])

        return {
            "status": "success",
            "total_urls": len(urls),
            "successful": result.get("successful", len(results)),
            "failed": result.get("failed", 0),
            "results": results,
            "timestamp": datetime.now().isoformat(),
            "metadata": {"source": "mcp_client", "pro_mode": self.pro_mode}
        }

    async def scrape_jobs_board(
        self,
        entity_name: str,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """Search job boards via MCP"""
        keyword_str = " ".join(keywords[:3])
        query = f'"{entity_name}" {keyword_str} jobs careers'
        return await self.search_engine(query, engine="google")

    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        """Scrape press releases via MCP"""
        query = f'"{entity_name}" press release announcement news'
        return await self.search_engine(query, engine="google")


class BrightDataClientWithFallback(BrightDataClient):
    """
    Smart client that tries MCP first, falls back to HTTP

    Usage:
        client = BrightDataClientWithFallback()
        result = await client.search_engine("query")  # Tries MCP, uses HTTP if needed
    """

    def __init__(self, mcp_timeout: float = 5.0):
        self.mcp_client = BrightDataMCPClient(timeout=mcp_timeout)
        self.http_client = BrightDataHTTPClient()
        self._using_mcp = False

        logger.info(f"🌐 BrightDataClientWithFallback initialized (MCP timeout: {mcp_timeout}s)")

    async def _try_with_fallback(self, method_name: str, *args, **kwargs):
        """Try MCP, fall back to HTTP if needed"""
        # Try MCP first
        method = getattr(self.mcp_client, method_name)
        result = await method(*args, **kwargs)

        # Check if MCP succeeded
        if result and result.get("status") == "success" and not result.get("transport_retryable"):
            self._using_mcp = True
            logger.info(f"✅ MCP succeeded for {method_name}")
            return result

        # Fall back to HTTP
        logger.info(f"🔄 MCP unavailable, using alternate transport for {method_name}")
        self._using_mcp = False

        http_method = getattr(self.http_client, method_name)
        return await http_method(*args, **kwargs)

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search with MCP plus alternate transport handling."""
        return await self._try_with_fallback("search_engine", query, engine, country, num_results, cursor)

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """Scrape with MCP plus alternate transport handling."""
        return await self._try_with_fallback("scrape_as_markdown", url)

    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        """Batch scrape with MCP plus alternate transport handling."""
        return await self._try_with_fallback("scrape_batch", urls)

    async def scrape_jobs_board(
        self,
        entity_name: str,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """Search job boards with MCP plus alternate transport handling."""
        return await self._try_with_fallback("scrape_jobs_board", entity_name, keywords)

    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        """Scrape press releases with MCP plus alternate transport handling."""
        return await self._try_with_fallback("scrape_press_release", entity_name)

    async def close(self):
        """Cleanup MCP session if open"""
        if getattr(self, "_pipeline_shared_client", False):
            logger.info("ℹ️ Shared pipeline MCP client close skipped (warm service mode)")
            return
        await self.mcp_client.close()

    async def prewarm(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Prewarm the underlying MCP session before the first real tool call."""
        return await self.mcp_client.prewarm(timeout=timeout)


# =============================================================================
# Factory Function
# =============================================================================

def create_brightdata_client(use_fallback: bool = True, mcp_timeout: float = 5.0) -> BrightDataClient:
    """
    Create BrightData client with automatic transport selection.

    Args:
        use_fallback: If True, allow alternate transport handling when MCP is unavailable.
        mcp_timeout: Seconds to wait for MCP initialization

    Returns:
        BrightDataClient instance
    """
    if use_fallback:
        return BrightDataClientWithFallback(mcp_timeout=mcp_timeout)
    else:
        return BrightDataMCPClient(timeout=mcp_timeout)


# =============================================================================
# Convenience Functions (backward compatibility)
# =============================================================================

class BrightDataMCPClient_Legacy(BrightDataClientWithFallback):
    """Legacy name for backward compatibility"""
    pass


# =============================================================================
# Convenience Functions
# =============================================================================

async def search_brightdata(
    query: str,
    engine: str = "google"
) -> Dict[str, Any]:
    """Convenience function to search"""
    client = create_brightdata_client()
    return await client.search_engine(query, engine)


async def scrape_url(url: str) -> Dict[str, Any]:
    """Convenience function to scrape"""
    client = create_brightdata_client()
    return await client.scrape_as_markdown(url)


# =============================================================================
# Test / Main
# =============================================================================

if __name__ == "__main__":
    async def test_client():
        """Test BrightData client with fallback"""

        print("=== BrightData Client Test ===\n")

        client = create_brightdata_client(mcp_timeout=5.0)

        # Test 1: Search
        print("=== Test 1: Search ===")
        result = await client.search_engine("Arsenal FC CRM job")
        print(f"Status: {result.get('status')}")
        print(f"Source: {result.get('metadata', {}).get('source', 'unknown')}")
        if result.get('status') == 'success':
            print(f"Results: {len(result.get('results', []))} items")
        print()

        # Test 2: Scrape
        print("=== Test 2: Scrape ===")
        result = await client.scrape_as_markdown("https://arsenal.com")
        print(f"Status: {result.get('status')}")
        print(f"Source: {result.get('metadata', {}).get('source', 'unknown')}")
        if result.get('status') == 'success':
            preview = result.get('content', '')[:200]
            print(f"Content preview: {preview}...")
        print()

        # Test 3: Batch
        print("=== Test 3: Batch Scrape ===")
        result = await client.scrape_batch(["https://arsenal.com", "https://linkedin.com"])
        print(f"Status: {result.get('status')}")
        print(f"Source: {result.get('metadata', {}).get('source', 'unknown')}")
        if result.get('status') == 'success':
            print(f"Successful: {result.get('successful')}/{result.get('total_urls')}")

        await client.close()

    asyncio.run(test_client())
