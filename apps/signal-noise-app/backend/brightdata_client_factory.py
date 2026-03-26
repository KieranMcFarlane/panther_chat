"""
BrightData client factory for the pipeline.

This keeps the pipeline model-agnostic and lets us prefer the MCP-backed
BrightData path when BRIGHTDATA_API_TOKEN is present.
"""

from __future__ import annotations

import asyncio
import logging
import os
import warnings
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)
_PIPELINE_BRIGHTDATA_CLIENT_CACHE: Any | None = None
_PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY: tuple[Any, ...] | None = None


def _env_flag(name: str, default: str = "false") -> bool:
    return str(os.getenv(name, default)).strip().lower() in {"1", "true", "yes", "on"}


def should_use_brightdata_mcp() -> bool:
    """Return True when the pipeline should prefer the BrightData MCP path."""
    token = str(os.getenv("BRIGHTDATA_API_TOKEN") or "").strip()
    if not token:
        return False
    return _env_flag("PIPELINE_USE_BRIGHTDATA_MCP", "true")


def _strict_brightdata_only() -> bool:
    """Return True when the pipeline must not use the legacy SDK client."""
    return (
        _env_flag("PIPELINE_V5_STRICT_MCP", "true")
        or _env_flag("BRIGHTDATA_FORCE_ONLY", "false")
        or _env_flag("PIPELINE_FORCE_BRIGHTDATA", "false")
    )


def create_pipeline_brightdata_client(
    *,
    use_mcp: Optional[bool] = None,
    mcp_timeout: Optional[float] = None,
    use_fallback: bool = True,
    fastmcp_factory: Optional[Callable[..., Any]] = None,
    mcp_factory: Optional[Callable[..., Any]] = None,
    sdk_factory: Optional[Callable[..., Any]] = None,
) -> Any:
    """
    Create the BrightData client used by the pipeline.

    Defaults to MCP when BRIGHTDATA_API_TOKEN is present. In strict v5 mode,
    the pipeline must stay on BrightData MCP or FastMCP only.
    """
    strict_mcp_only = _strict_brightdata_only()
    token_present = bool(str(os.getenv("BRIGHTDATA_API_TOKEN") or "").strip())
    prefer_mcp = should_use_brightdata_mcp() if use_mcp is None else bool(use_mcp)
    if strict_mcp_only and token_present and not prefer_mcp:
        prefer_mcp = True
    resolved_mcp_timeout = (
        float(os.getenv("BRIGHTDATA_MCP_TIMEOUT_SECONDS", "20.0"))
        if mcp_timeout is None
        else float(mcp_timeout)
    )
    shared_client_enabled = _env_flag("PIPELINE_BRIGHTDATA_SHARED_CLIENT", "true")
    fastmcp_url = str(os.getenv("BRIGHTDATA_FASTMCP_URL") or "").strip()
    prefer_fastmcp = _env_flag("PIPELINE_USE_BRIGHTDATA_FASTMCP", "false") or bool(fastmcp_url)
    cache_key = (prefer_mcp, use_fallback, resolved_mcp_timeout, shared_client_enabled, prefer_fastmcp, fastmcp_url)

    global _PIPELINE_BRIGHTDATA_CLIENT_CACHE, _PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY
    if shared_client_enabled and _PIPELINE_BRIGHTDATA_CLIENT_CACHE is not None and _PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY == cache_key:
        logger.info("🌐 BrightData pipeline client: reusing shared warm client")
        return _PIPELINE_BRIGHTDATA_CLIENT_CACHE

    if prefer_fastmcp:
        if not fastmcp_url:
            fastmcp_url = "http://127.0.0.1:8000/mcp"
        if fastmcp_factory is None:
            try:
                from backend.brightdata_fastmcp_client import create_brightdata_fastmcp_client as fastmcp_factory  # type: ignore
            except ImportError:
                from brightdata_fastmcp_client import create_brightdata_fastmcp_client as fastmcp_factory  # type: ignore

        logger.info("🌐 BrightData pipeline client: FastMCP service preferred (url=%s)", fastmcp_url)
        client = fastmcp_factory(mcp_url=fastmcp_url, timeout=resolved_mcp_timeout)
        if shared_client_enabled:
            setattr(client, "_pipeline_shared_client", True)
            _PIPELINE_BRIGHTDATA_CLIENT_CACHE = client
            _PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY = cache_key
        return client

    if prefer_mcp:
        if mcp_factory is None:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", DeprecationWarning)
                try:
                    from backend.brightdata_mcp_client import create_brightdata_client as mcp_factory  # type: ignore
                except ImportError:
                    from brightdata_mcp_client import create_brightdata_client as mcp_factory  # type: ignore

        logger.info(
            "🌐 BrightData pipeline client: MCP preferred (use_fallback=%s, timeout=%ss)",
            False if strict_mcp_only else use_fallback,
            resolved_mcp_timeout,
        )
        client = mcp_factory(
            use_fallback=False if strict_mcp_only else use_fallback,
            mcp_timeout=resolved_mcp_timeout,
        )
        if shared_client_enabled:
            setattr(client, "_pipeline_shared_client", True)
            _PIPELINE_BRIGHTDATA_CLIENT_CACHE = client
            _PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY = cache_key
        return client

    if strict_mcp_only:
        raise RuntimeError(
            "BrightData MCP is required in strict v5 mode, but no MCP or FastMCP client could be selected"
        )

    if sdk_factory is None:
        try:
            from backend.brightdata_sdk_client import BrightDataSDKClient as sdk_factory  # type: ignore
        except ImportError:
            from brightdata_sdk_client import BrightDataSDKClient as sdk_factory  # type: ignore

        logger.info("🌐 BrightData pipeline client: legacy SDK client selected")
    client = sdk_factory()
    if shared_client_enabled:
        setattr(client, "_pipeline_shared_client", True)
        _PIPELINE_BRIGHTDATA_CLIENT_CACHE = client
        _PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY = cache_key
    return client


async def prewarm_pipeline_brightdata_client(
    client: Any | None = None,
    *,
    timeout: Optional[float] = None,
    background: Optional[bool] = None,
) -> Any:
    """
    Prewarm the pipeline BrightData client so the MCP session is established
    before the first entity-level search.
    """
    pipeline_client = client or create_pipeline_brightdata_client()
    prewarm_fn = getattr(pipeline_client, "prewarm", None)
    if callable(prewarm_fn):
        background = _env_flag("BRIGHTDATA_MCP_WARM_SERVICE", "true") if background is None else bool(background)
        if background:
            task = asyncio.create_task(prewarm_fn(timeout=timeout))
            setattr(pipeline_client, "_pipeline_prewarm_task", task)
        else:
            await prewarm_fn(timeout=timeout)
        return pipeline_client

    # Preserve async signature even if the selected client has no prewarm hook.
    await asyncio.sleep(0)
    return pipeline_client
