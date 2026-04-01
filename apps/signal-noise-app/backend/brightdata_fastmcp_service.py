"""
FastMCP service wrapper for BrightData.

This exposes the pipeline BrightData client as a persistent localhost MCP
service so the pipeline can talk to a warm, long-lived endpoint instead of
cold-starting the BrightData MCP process on every run.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP
from starlette.responses import PlainTextResponse

from backend.brightdata_mcp_client import BrightDataMCPClient
from backend.brightdata_sdk_client import BrightDataSDKClient

logger = logging.getLogger(__name__)

mcp = FastMCP("BrightDataPipelineService")
_PIPELINE_CLIENT: Any | None = None
_PIPELINE_CLIENT_LOCK = asyncio.Lock()


def _resolve_fastmcp_backend() -> str:
    return str(os.getenv("BRIGHTDATA_FASTMCP_BACKEND", "sdk") or "sdk").strip().lower()


async def _get_pipeline_client() -> Any:
    global _PIPELINE_CLIENT
    if _PIPELINE_CLIENT is not None:
        return _PIPELINE_CLIENT

    async with _PIPELINE_CLIENT_LOCK:
        if _PIPELINE_CLIENT is None:
            backend = _resolve_fastmcp_backend()
            if backend == "mcp":
                warmup_timeout = float(os.getenv("BRIGHTDATA_FASTMCP_WARMUP_TIMEOUT_SECONDS", "60") or "60")
                _PIPELINE_CLIENT = BrightDataMCPClient(timeout=warmup_timeout)
                logger.info("🌐 BrightData FastMCP backend selected: mcp")
            else:
                _PIPELINE_CLIENT = BrightDataSDKClient()
                logger.info("🌐 BrightData FastMCP backend selected: sdk")
    return _PIPELINE_CLIENT


@mcp.tool
async def prewarm(timeout: Optional[float] = None) -> Dict[str, Any]:
    """Warm the underlying BrightData client in the background."""
    client = await _get_pipeline_client()
    prewarm_fn = getattr(client, "prewarm", None)
    if callable(prewarm_fn):
        return await prewarm_fn(timeout=timeout)
    return {
        "status": "success",
        "prewarmed": True,
        "backend": str(os.getenv("BRIGHTDATA_FASTMCP_BACKEND", "sdk") or "sdk").strip().lower(),
        "timeout": timeout,
    }


@mcp.tool
async def search_engine(
    query: str,
    engine: str = "google",
    country: str = "us",
    num_results: int = 10,
    cursor: Optional[str] = None,
) -> Dict[str, Any]:
    client = await _get_pipeline_client()
    if _resolve_fastmcp_backend() == "sdk" or isinstance(client, BrightDataSDKClient):
        return await client.search_engine(
            query=query,
            engine=engine,
            country=country,
            num_results=num_results,
        )
    return await client.search_engine(
        query=query,
        engine=engine,
        country=country,
        num_results=num_results,
        cursor=cursor,
    )


@mcp.tool
async def scrape_as_markdown(url: str) -> Dict[str, Any]:
    client = await _get_pipeline_client()
    return await client.scrape_as_markdown(url)


@mcp.tool
async def scrape_batch(urls: List[str]) -> Dict[str, Any]:
    client = await _get_pipeline_client()
    return await client.scrape_batch(urls)


@mcp.tool
async def scrape_jobs_board(entity_name: str, keywords: List[str]) -> Dict[str, Any]:
    client = await _get_pipeline_client()
    return await client.scrape_jobs_board(entity_name, keywords)


@mcp.tool
async def scrape_press_release(entity_name: str) -> Dict[str, Any]:
    client = await _get_pipeline_client()
    return await client.scrape_press_release(entity_name)


@mcp.custom_route("/health", methods=["GET"])
async def health_check(_request) -> PlainTextResponse:
    return PlainTextResponse("OK")


def main() -> None:
    host = os.getenv("BRIGHTDATA_FASTMCP_HOST", "127.0.0.1")
    port = int(os.getenv("BRIGHTDATA_FASTMCP_PORT", "8000"))
    logger.info("🌐 Starting BrightData FastMCP service on http://%s:%s/mcp", host, port)
    mcp.run(transport="http", host=host, port=port)


if __name__ == "__main__":
    main()
