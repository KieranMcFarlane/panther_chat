"""
FastMCP client wrapper for the local BrightData service.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastmcp import Client

logger = logging.getLogger(__name__)


class BrightDataFastMCPClient:
    def __init__(self, mcp_url: Optional[str] = None, timeout: float = 20.0):
        self.mcp_url = (mcp_url or os.getenv("BRIGHTDATA_FASTMCP_URL") or "http://127.0.0.1:8000/mcp").strip()
        self.timeout = timeout
        self._client = Client(self.mcp_url)
        self._client_handle = None
        self._available = False
        logger.info("🌐 BrightDataFastMCPClient initialized (url=%s, timeout=%ss)", self.mcp_url, timeout)

    async def _ensure_session(self) -> None:
        if self._client_handle is not None:
            return
        try:
            logger.info("⏳ Connecting to FastMCP service at %s", self.mcp_url)
            self._client_handle = await asyncio.wait_for(self._client.__aenter__(), timeout=self.timeout)
            self._available = True
            logger.info("✅ FastMCP service connected")
        except Exception as exc:  # noqa: BLE001
            self._available = False
            self._client_handle = None
            logger.warning("⚠️ FastMCP service connection failed: %s", exc)

    async def _call_tool(self, name: str, arguments: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        await self._ensure_session()
        if not self._available or self._client_handle is None:
            return None

        try:
            result = await self._client_handle.call_tool(name=name, arguments=arguments)
        except TypeError:
            result = await self._client_handle.call_tool(name, arguments)
        except Exception as exc:  # noqa: BLE001
            logger.warning("⚠️ FastMCP tool call failed for %s: %s", name, exc)
            return None

        if isinstance(result, dict):
            return result
        if hasattr(result, "content"):
            text = ""
            for item in getattr(result, "content", []) or []:
                text += getattr(item, "text", "") or ""
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"status": "success", "content": text}
        if isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                return {"status": "success", "content": result}
        return {"status": "success", "result": str(result)}

    async def prewarm(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        if timeout is not None:
            self.timeout = float(timeout)
        result = await self._call_tool("prewarm", {"timeout": timeout})
        if result is None:
            return {"status": "error", "prewarmed": False, "timeout": timeout}
        return result

    async def search_engine(
        self,
        query: str,
        engine: str = "google",
        country: str = "us",
        num_results: int = 10,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        arguments: Dict[str, Any] = {
            "query": query,
            "engine": engine,
            "country": country,
            "num_results": num_results,
        }
        if cursor is not None:
            arguments["cursor"] = cursor
        result = await self._call_tool("search_engine", arguments)
        if result is None:
            return {"status": "error", "error": "FastMCP unavailable", "query": query, "transport_retryable": True}
        result.setdefault("timestamp", datetime.now().isoformat())
        return result

    async def scrape_as_markdown(self, url: str) -> Dict[str, Any]:
        result = await self._call_tool("scrape_as_markdown", {"url": url})
        if result is None:
            return {"status": "error", "error": "FastMCP unavailable", "url": url, "transport_retryable": True}
        result.setdefault("timestamp", datetime.now().isoformat())
        return result

    async def scrape_batch(self, urls: List[str]) -> Dict[str, Any]:
        result = await self._call_tool("scrape_batch", {"urls": urls})
        if result is None:
            return {"status": "error", "error": "FastMCP unavailable", "total_urls": len(urls), "transport_retryable": True}
        result.setdefault("timestamp", datetime.now().isoformat())
        return result

    async def scrape_jobs_board(self, entity_name: str, keywords: List[str]) -> Dict[str, Any]:
        return await self._call_tool("scrape_jobs_board", {"entity_name": entity_name, "keywords": keywords}) or {
            "status": "error",
            "error": "FastMCP unavailable",
            "entity_name": entity_name,
            "transport_retryable": True,
        }

    async def scrape_press_release(self, entity_name: str) -> Dict[str, Any]:
        return await self._call_tool("scrape_press_release", {"entity_name": entity_name}) or {
            "status": "error",
            "error": "FastMCP unavailable",
            "entity_name": entity_name,
            "transport_retryable": True,
        }

    async def close(self):
        if self._client_handle is not None:
            try:
                await self._client.__aexit__(None, None, None)
            finally:
                self._client_handle = None
                self._available = False


def create_brightdata_fastmcp_client(mcp_url: Optional[str] = None, timeout: float = 20.0) -> BrightDataFastMCPClient:
    return BrightDataFastMCPClient(mcp_url=mcp_url, timeout=timeout)
