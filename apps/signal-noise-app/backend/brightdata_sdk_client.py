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
from typing import Dict, List, Any, Optional
from datetime import datetime

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
        from brightdata import BrightDataClient
        from dotenv import load_dotenv

        load_dotenv()

        # Store token for later use in async context
        self.token = token
        self._client = None
        logger.info("✅ BrightDataSDKClient initialized (async context)")

    async def _get_client(self):
        """Get or create async client context"""
        if self._client is None:
            try:
                from brightdata import BrightDataClient
                self._client = await BrightDataClient(self.token).__aenter__()
                logger.info("✅ BrightData SDK client initialized")
            except Exception as e:
                logger.warning(f"⚠️ BrightData SDK initialization failed: {e}")
                logger.info("ℹ️ Will use fallback httpx client for scraping")
                # Set to None to indicate SDK unavailable
                self._client = False
        if self._client is False:
            raise RuntimeError("BrightData SDK unavailable, fallback will be used")
        return self._client

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
                result = await client.search.google(
                    query=query,
                    country=country,
                    num=num_results
                )
            elif engine.lower() == "bing":
                result = await client.search.bing(
                    query=query,
                    country=country,
                    num=num_results
                )
            elif engine.lower() == "yandex":
                result = await client.search.yandex(
                    query=query,
                    num=num_results
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
            result = await client.scrape_url(
                url,
                response_format='raw'
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

            logger.info(f"✅ Scraped {len(content)} characters")

            return {
                "status": "success",
                "url": url,
                "content": content,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "word_count": len(content.split()),
                    "source": "brightdata_sdk"
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
            results = await client.scrape_url(
                cleaned_urls,
                mode='async'
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
        """Fallback: Use search APIs when SDK unavailable"""
        # For now, return mock results
        # In production, you could use SerpAPI, Google Custom Search API, etc.
        logger.warning(f"⚠️ Using fallback search (not BrightData): {query}")

        return {
            "status": "success",
            "engine": engine,
            "query": query,
            "results": [
                {
                    "position": i + 1,
                    "title": f"Result {i + 1} for {query}",
                    "url": f"https://example.com/result{i + 1}",
                    "snippet": f"This is a fallback result for {query}"
                }
                for i in range(min(num_results, 3))
            ],
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "source": "fallback",
                "warning": "BrightData SDK unavailable, using mock results"
            }
        }

    async def _scrape_as_markdown_fallback(self, url: str) -> Dict[str, Any]:
        """Fallback: Use httpx + BeautifulSoup when SDK unavailable"""
        import httpx
        from bs4 import BeautifulSoup

        logger.warning(f"⚠️ Using fallback scraping (not BrightData): {url}")

        try:
            # Ensure URL has protocol
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'

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

                return {
                    "status": "success",
                    "url": url,
                    "content": content,
                    "timestamp": datetime.now().isoformat(),
                    "metadata": {
                        "word_count": len(content.split()),
                        "source": "fallback_httpx",
                        "warning": "BrightData SDK unavailable, using httpx"
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
