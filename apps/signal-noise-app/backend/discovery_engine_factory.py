#!/usr/bin/env python3
"""Factory for discovery engine selection during strangler cutover."""

from __future__ import annotations

import logging
import os
from typing import Any, Tuple

logger = logging.getLogger(__name__)


def _normalize_engine_name(value: str) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"legacy", "v1", "hypothesis"}:
        return "legacy"
    if raw in {"v2", "evidence_first", "discovery_v2"}:
        return "v2"
    if raw in {"agentic_v3", "v3", "agentic", "planner_led"}:
        return "agentic_v3"
    if raw in {"agentic_v4_batched", "v4", "batched", "batched_agentic"}:
        return "agentic_v4_batched"
    return "v2"


def create_discovery_engine(
    *,
    claude_client: Any,
    brightdata_client: Any,
    graphiti_service: Any = None,
    falkordb_client: Any = None,
    engine: str | None = None,
) -> Tuple[Any, str]:
    """
    Build discovery engine for current runtime.

    Returns:
      (engine_instance, engine_name)
    """
    selected = _normalize_engine_name(engine or os.getenv("DISCOVERY_ENGINE", "v2"))
    if selected == "legacy":
        try:
            from backend.hypothesis_driven_discovery import HypothesisDrivenDiscovery
        except ImportError:
            from hypothesis_driven_discovery import HypothesisDrivenDiscovery
        instance = HypothesisDrivenDiscovery(
            claude_client=claude_client,
            brightdata_client=brightdata_client,
            falkordb_client=falkordb_client,
            graphiti_service=graphiti_service,
        )
        logger.info("🧠 Discovery engine selected: legacy")
        return instance, "legacy"

    if selected == "agentic_v3":
        try:
            from backend.discovery_runtime_agentic_v3 import DiscoveryRuntimeAgenticV3
        except ImportError:
            from discovery_runtime_agentic_v3 import DiscoveryRuntimeAgenticV3

        instance = DiscoveryRuntimeAgenticV3(
            claude_client=claude_client,
            brightdata_client=brightdata_client,
        )
        logger.info("🧠 Discovery engine selected: agentic_v3")
        return instance, "agentic_v3"

    if selected == "agentic_v4_batched":
        try:
            from backend.discovery_runtime_agentic_v4_batched import DiscoveryRuntimeAgenticV4Batched
        except ImportError:
            from discovery_runtime_agentic_v4_batched import DiscoveryRuntimeAgenticV4Batched

        instance = DiscoveryRuntimeAgenticV4Batched(
            claude_client=claude_client,
            brightdata_client=brightdata_client,
        )
        logger.info("🧠 Discovery engine selected: agentic_v4_batched")
        return instance, "agentic_v4_batched"

    try:
        from backend.discovery_runtime_v2 import DiscoveryRuntimeV2
    except ImportError:
        from discovery_runtime_v2 import DiscoveryRuntimeV2

    instance = DiscoveryRuntimeV2(
        claude_client=claude_client,
        brightdata_client=brightdata_client,
    )
    logger.info("🧠 Discovery engine selected: v2")
    return instance, "v2"
