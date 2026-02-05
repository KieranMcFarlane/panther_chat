"""
BrightData Tool Registry for Claude Agent SDK

Exposes BrightData SDK capabilities as Claude Agent SDK tools with @tool decorator.

These tools enable autonomous agents to:
- Search Google, Bing, or Yandex
- Scrape URLs to markdown
- Batch scrape multiple URLs concurrently
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


# =============================================================================
# Tool Registry (will be registered with Claude Agent SDK)
# =============================================================================

async def search_engine_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search Google, Bing, or Yandex using BrightData SERP API

    Use this tool to:
    - Discover official domains for entities
    - Find press releases and news articles
    - Locate job postings and career pages
    - Research competitors and partnerships

    Args:
        query: Search query string
        engine: Search engine - "google" (default), "bing", or "yandex"
        num_results: Number of results to return (default: 10)
        country: Country code for localized results (default: "us")

    Returns:
        Search results with position, title, url, snippet for each result
    """
    from backend.brightdata_sdk_client import BrightDataSDKClient

    query = args.get("query", "")
    engine = args.get("engine", "google")
    num_results = args.get("num_results", 10)
    country = args.get("country", "us")

    logger.info(f"🔍 BrightData tool search: {query} (engine: {engine})")

    try:
        client = BrightDataSDKClient()
        result = await client.search_engine(
            query=query,
            engine=engine,
            num_results=num_results,
            country=country
        )

        if result.get("status") == "success":
            results = result.get("results", [])
            logger.info(f"✅ Search found {len(results)} results")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Found {len(results)} search results for '{query}' using {engine}. "
                           f"Top result: {results[0].get('title', 'N/A') if results else 'No results'}"
                }],
                "data": result  # Raw data for agent processing
            }
        else:
            error = result.get("error", "Unknown error")
            logger.warning(f"⚠️ Search failed: {error}")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Search failed: {error}"
                }],
                "data": result
            }

    except Exception as e:
        logger.error(f"❌ Search tool error: {e}")

        return {
            "content": [{
                "type": "text",
                "text": f"Search error: {str(e)}"
            }],
            "data": {
                "status": "error",
                "error": str(e),
                "query": query
            }
        }


async def scrape_url_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Scrape URL to markdown using BrightData Web Scraper API

    Use this tool to:
    - Extract entity profile information
    - Collect technology stack details
    - Find vendor partnerships and integrations
    - Identify digital maturity indicators

    Args:
        url: URL to scrape (must include https://)
        max_length: Maximum character length (default: 50000)

    Returns:
        Scraped content in markdown format with metadata
    """
    from backend.brightdata_sdk_client import BrightDataSDKClient

    url = args.get("url", "")
    max_length = args.get("max_length", 50000)

    logger.info(f"📄 BrightData tool scrape: {url}")

    try:
        client = BrightDataSDKClient()
        result = await client.scrape_as_markdown(url)

        if result.get("status") == "success":
            content = result.get("content", "")
            word_count = result.get("metadata", {}).get("word_count", len(content.split()))

            # Truncate if too long
            if len(content) > max_length:
                content = content[:max_length] + "\n\n[Content truncated due to length limit]"

            logger.info(f"✅ Scraped {word_count} words")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Successfully scraped {url} ({word_count} words). "
                           f"Preview: {content[:200]}..."
                }],
                "data": result  # Full data including content
            }
        else:
            error = result.get("error", "Unknown error")
            logger.warning(f"⚠️ Scrape failed: {error}")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Scrape failed: {error}"
                }],
                "data": result
            }

    except Exception as e:
        logger.error(f"❌ Scrape tool error: {e}")

        return {
            "content": [{
                "type": "text",
                "text": f"Scrape error: {str(e)}"
            }],
            "data": {
                "status": "error",
                "error": str(e),
                "url": url
            }
        }


async def scrape_batch_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Scrape multiple URLs concurrently using BrightData Web Scraper API

    Use this tool to:
    - Batch process multiple domains at once
    - Compare content across multiple sources
    - Efficiently gather evidence from multiple pages

    Args:
        urls: List of URLs to scrape (max 10 recommended)
        max_per_url: Maximum characters per URL (default: 25000)

    Returns:
        Batch scrape results with success/failure counts
    """
    from backend.brightdata_sdk_client import BrightDataSDKClient

    urls = args.get("urls", [])
    max_per_url = args.get("max_per_url", 25000)

    if not urls:
        return {
            "content": [{
                "type": "text",
                "text": "No URLs provided for batch scraping"
            }],
            "data": {
                "status": "error",
                "error": "urls parameter is required"
            }
        }

    logger.info(f"📦 BrightData tool batch scrape: {len(urls)} URLs")

    try:
        client = BrightDataSDKClient()
        result = await client.scrape_batch(urls)

        if result.get("status") == "success":
            successful = result.get("successful", 0)
            total = result.get("total_urls", len(urls))
            failed = result.get("failed", 0)

            logger.info(f"✅ Batch scrape complete: {successful}/{total} successful")

            # Truncate content if needed
            for item in result.get("results", []):
                if item.get("status") == "success" and "content" in item:
                    content = item["content"]
                    if len(content) > max_per_url:
                        item["content"] = content[:max_per_url] + "\n\n[Content truncated due to length limit]"

            return {
                "content": [{
                    "type": "text",
                    "text": f"Batch scraping complete: {successful}/{total} URLs successful, {failed} failed"
                }],
                "data": result
            }
        else:
            error = result.get("error", "Unknown error")
            logger.warning(f"⚠️ Batch scrape failed: {error}")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Batch scrape failed: {error}"
                }],
                "data": result
            }

    except Exception as e:
        logger.error(f"❌ Batch scrape tool error: {e}")

        return {
            "content": [{
                "type": "text",
                "text": f"Batch scrape error: {str(e)}"
            }],
            "data": {
                "status": "error",
                "error": str(e),
                "urls": urls
            }
        }


async def search_jobs_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search job boards for relevant postings using BrightData SERP API

    Use this tool to:
    - Find CRM/Analytics job postings
    - Discover Digital Transformation hiring
    - Identify technology adoption through hiring

    Args:
        entity_name: Name of the entity (e.g., "Arsenal FC")
        keywords: List of keywords to search for (e.g., ["CRM", "Digital", "Data"])
        num_results: Number of results (default: 10)

    Returns:
        Search results for job postings
    """
    from backend.brightdata_sdk_client import BrightDataSDKClient

    entity_name = args.get("entity_name", "")
    keywords = args.get("keywords", [])
    num_results = args.get("num_results", 10)

    if not entity_name:
        return {
            "content": [{
                "type": "text",
                "text": "entity_name parameter is required"
            }],
            "data": {
                "status": "error",
                "error": "entity_name parameter is required"
            }
        }

    logger.info(f"💼 Job search for {entity_name}: {keywords}")

    try:
        client = BrightDataSDKClient()
        result = await client.scrape_jobs_board(
            entity_name=entity_name,
            keywords=keywords
        )

        if result.get("status") == "success":
            results = result.get("results", [])
            logger.info(f"✅ Found {len(results)} job postings")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Found {len(results)} job postings for {entity_name} with keywords: {', '.join(keywords[:3])}"
                }],
                "data": result
            }
        else:
            error = result.get("error", "Unknown error")
            logger.warning(f"⚠️ Job search failed: {error}")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Job search failed: {error}"
                }],
                "data": result
            }

    except Exception as e:
        logger.error(f"❌ Job search tool error: {e}")

        return {
            "content": [{
                "type": "text",
                "text": f"Job search error: {str(e)}"
            }],
            "data": {
                "status": "error",
                "error": str(e)
            }
        }


async def search_press_releases_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Search for press releases and announcements using BrightData SERP API

    Use this tool to:
    - Find digital transformation announcements
    - Discover vendor partnership announcements
    - Identify procurement signals

    Args:
        entity_name: Name of the entity (e.g., "Arsenal FC")
        num_results: Number of results (default: 10)

    Returns:
        Search results for press releases
    """
    from backend.brightdata_sdk_client import BrightDataSDKClient

    entity_name = args.get("entity_name", "")
    num_results = args.get("num_results", 10)

    if not entity_name:
        return {
            "content": [{
                "type": "text",
                "text": "entity_name parameter is required"
            }],
            "data": {
                "status": "error",
                "error": "entity_name parameter is required"
            }
        }

    logger.info(f"📰 Press release search for {entity_name}")

    try:
        client = BrightDataSDKClient()
        result = await client.scrape_press_release(entity_name=entity_name)

        if result.get("status") == "success":
            results = result.get("results", [])
            logger.info(f"✅ Found {len(results)} press releases")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Found {len(results)} press releases and announcements for {entity_name}"
                }],
                "data": result
            }
        else:
            error = result.get("error", "Unknown error")
            logger.warning(f"⚠️ Press release search failed: {error}")

            return {
                "content": [{
                    "type": "text",
                    "text": f"Press release search failed: {error}"
                }],
                "data": result
            }

    except Exception as e:
        logger.error(f"❌ Press release search tool error: {e}")

        return {
            "content": [{
                "type": "text",
                "text": f"Press release search error: {str(e)}"
            }],
            "data": {
                "status": "error",
                "error": str(e)
            }
        }


# =============================================================================
# Tool Export (for SDK registration)
# =============================================================================

BRIGHTDATA_TOOLS = {
    "search_engine": {
        "function": search_engine_tool,
        "description": "Search Google, Bing, or Yandex for web search results",
        "parameters": {
            "query": {"type": "string", "description": "Search query string"},
            "engine": {"type": "string", "description": "Search engine: google, bing, or yandex (default: google)"},
            "num_results": {"type": "integer", "description": "Number of results to return (default: 10)"},
            "country": {"type": "string", "description": "Country code for localized results (default: us)"}
        }
    },
    "scrape_url": {
        "function": scrape_url_tool,
        "description": "Scrape a single URL to markdown format",
        "parameters": {
            "url": {"type": "string", "description": "URL to scrape (must include https://)"},
            "max_length": {"type": "integer", "description": "Maximum character length (default: 50000)"}
        }
    },
    "scrape_batch": {
        "function": scrape_batch_tool,
        "description": "Scrape multiple URLs concurrently",
        "parameters": {
            "urls": {"type": "array", "description": "List of URLs to scrape"},
            "max_per_url": {"type": "integer", "description": "Maximum characters per URL (default: 25000)"}
        }
    },
    "search_jobs": {
        "function": search_jobs_tool,
        "description": "Search job boards for relevant postings",
        "parameters": {
            "entity_name": {"type": "string", "description": "Name of the entity"},
            "keywords": {"type": "array", "description": "List of keywords to search for"},
            "num_results": {"type": "integer", "description": "Number of results (default: 10)"}
        }
    },
    "search_press_releases": {
        "function": search_press_releases_tool,
        "description": "Search for press releases and announcements",
        "parameters": {
            "entity_name": {"type": "string", "description": "Name of the entity"},
            "num_results": {"type": "integer", "description": "Number of results (default: 10)"}
        }
    }
}


# =============================================================================
# Convenience Functions
# =============================================================================

def get_tool_names() -> List[str]:
    """Get list of available BrightData tool names"""
    return list(BRIGHTDATA_TOOLS.keys())


def get_tool_definition(tool_name: str) -> Dict[str, Any]:
    """Get tool definition by name"""
    return BRIGHTDATA_TOOLS.get(tool_name, {})


if __name__ == "__main__":
    # Test tools
    import asyncio

    async def test_search():
        print("Testing search_engine_tool...")
        result = await search_engine_tool({
            "query": "Arsenal FC official website",
            "engine": "google",
            "num_results": 3
        })
        print(f"Result: {result['content'][0]['text']}")

    asyncio.run(test_search())
