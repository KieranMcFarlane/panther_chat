"""
DEPRECATED: BrightData MCP Client (Legacy Implementation)

⚠️  This module is DEPRECATED and kept only for backward compatibility.

Please use backend/brightdata_sdk_client.py (BrightDataSDKClient) instead.

Migration guide:
- OLD: from backend.brightdata_mcp_client import BrightDataClient, create_brightdata_client
- NEW: from backend.brightdata_sdk_client import BrightDataSDKClient

Why deprecated:
- MCP integration had timeout issues (5-second timeout)
- SDK provides direct HTTP calls (faster, simpler)
- New implementation includes automatic HTTP fallback
- Pay-per-success pricing with SDK

Last updated: 2026-01-28
Status: Deprecated - Use brightdata_sdk_client.py

====================================================================

LEGACY DOCUMENTATION (below kept for reference only):

BrightData Client with MCP and HTTP fallback

Architecture:
1. Abstract BrightDataClient interface
2. Two implementations: BrightDataMCPClient, BrightDataHTTPClient
3. Runtime selection with timeout protection
4. Agent doesn't know or care which is being used

This is a data plane service - Claude Agent SDK handles reasoning.
"""

import asyncio
import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Issue deprecation warning when module is imported
import warnings
warnings.warn(
    "brightdata_mcp_client is deprecated. Use brightdata_sdk_client instead.",
    DeprecationWarning,
    stacklevel=2
)


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

                for div in soup.find_all('div', class_='result')[:10]:
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
        self._stdio_context = None
        self._available = False

        # Check if MCP package is available
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
            self._mcp_available = True
        except ImportError:
            self._mcp_available = False
            logger.warning("⚠️ mcp package not installed")

        logger.info(f"🌐 BrightDataMCPClient initialized (timeout: {timeout}s, mcp_available: {self._mcp_available})")

    async def _ensure_session(self):
        """Initialize MCP session with timeout protection"""
        # If already failed or session exists, skip
        if not self._mcp_available:
            return

        if self.session:
            return

        # Mark as unavailable permanently after first attempt
        self._mcp_available = False

        try:
            logger.info(f"⏳ Initializing MCP session (timeout: {self.timeout}s)...")

            # Use asyncio.wait_for to enforce timeout
            await asyncio.wait_for(self._init_mcp_session(), timeout=self.timeout)

            self._available = True
            self._mcp_available = True  # Re-enable if successful
            logger.info("✅ MCP session initialized")

        except asyncio.TimeoutError:
            logger.warning(f"⚠️ MCP initialization timed out after {self.timeout}s - will use HTTP fallback")
            self._available = False
            self.session = None
        except Exception as e:
            logger.error(f"❌ MCP initialization failed: {e} - will use HTTP fallback")
            self._available = False
            self.session = None

    async def _init_mcp_session(self):
        """Actual MCP initialization (separated for timeout)"""
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        server_params = StdioServerParameters(
            command="npx",
            args=["-y", "@brightdata/mcp"],
            env={
                "API_TOKEN": self.api_token or "",
                "PRO_MODE": "true" if self.pro_mode else "false"
            }
        )

        self._stdio_context = stdio_client(server_params)
        stdio, write = await self._stdio_context.__aenter__()

        self.session = ClientSession(stdio, write)
        await self.session.initialize()

    async def close(self):
        """Close MCP session"""
        if self._stdio_context:
            try:
                await self._stdio_context.__aexit__(None, None, None)
                logger.info("✅ MCP session closed")
            except Exception as e:
                logger.error(f"❌ Error closing MCP session: {e}")
            finally:
                self.session = None
                self._stdio_context = None
                self._available = False

    async def _call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call MCP tool, return None if unavailable"""
        await self._ensure_session()

        if not self.session or not self._available:
            logger.info(f"ℹ️ MCP unavailable for {tool_name}")
            return None

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

        except Exception as e:
            logger.error(f"❌ MCP tool call failed: {e}")
            return None

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search via MCP, return error if unavailable (caller can use HTTP fallback)"""
        logger.info(f"🔍 MCP search: {query}")

        arguments = {"query": query, "engine": engine}
        if cursor:
            arguments["cursor"] = cursor

        result = await self._call_tool("mcp__brightData__search_engine", arguments)

        if result is None or result.get("status") == "error":
            return {
                "status": "error",
                "error": "MCP unavailable",
                "query": query,
                "engine": engine,
                "use_http_fallback": True
            }

        return {
            "status": "success",
            "engine": engine,
            "query": query,
            "results": result.get("results", []),
            "cursor": result.get("cursor"),
            "timestamp": datetime.now().isoformat(),
            "metadata": {"source": "mcp_client", "pro_mode": self.pro_mode}
        }

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """Scrape via MCP, return error if unavailable (caller can use HTTP fallback)"""
        logger.info(f"📄 MCP scrape: {url}")

        result = await self._call_tool("mcp__brightData__scrape_as_markdown", {"url": url})

        if result is None or result.get("status") == "error":
            return {
                "status": "error",
                "error": "MCP unavailable",
                "url": url,
                "use_http_fallback": True
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
        """Batch scrape via MCP, return error if unavailable (caller can use HTTP fallback)"""
        if len(urls) > 10:
            urls = urls[:10]

        logger.info(f"📦 MCP batch scrape: {len(urls)} URLs")

        result = await self._call_tool("mcp__brightData__scrape_batch", {"urls": urls})

        if result is None or result.get("status") == "error":
            return {
                "status": "error",
                "error": "MCP unavailable",
                "total_urls": len(urls),
                "use_http_fallback": True
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
        if result and result.get("status") == "success" and not result.get("use_http_fallback"):
            self._using_mcp = True
            logger.info(f"✅ MCP succeeded for {method_name}")
            return result

        # Fall back to HTTP
        logger.info(f"🔄 MCP unavailable, using HTTP fallback for {method_name}")
        self._using_mcp = False

        http_method = getattr(self.http_client, method_name)
        return await http_method(*args, **kwargs)

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search with MCP + HTTP fallback"""
        return await self._try_with_fallback("search_engine", query, engine, cursor)

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        """Scrape with MCP + HTTP fallback"""
        return await self._try_with_fallback("scrape_as_markdown", url)

    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        """Batch scrape with MCP + HTTP fallback"""
        return await self._try_with_fallback("scrape_batch", urls)

    async def scrape_jobs_board(
        self,
        entity_name: str,
        keywords: List[str]
    ) -> Dict[str, Any]:
        """Search job boards with MCP + HTTP fallback"""
        return await self._try_with_fallback("scrape_jobs_board", entity_name, keywords)

    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        """Scrape press releases with MCP + HTTP fallback"""
        return await self._try_with_fallback("scrape_press_release", entity_name)

    async def close(self):
        """Cleanup MCP session if open"""
        await self.mcp_client.close()


# =============================================================================
# Factory Function
# =============================================================================

def create_brightdata_client(use_fallback: bool = True, mcp_timeout: float = 5.0) -> BrightDataClient:
    """
    Create BrightData client with automatic fallback

    Args:
        use_fallback: If True, use MCP with HTTP fallback. If False, MCP only.
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
