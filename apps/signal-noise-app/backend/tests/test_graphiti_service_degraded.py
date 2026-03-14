#!/usr/bin/env python3
"""
Regression tests for GraphitiService behavior when no DB backend is configured.
"""

import sys
from pathlib import Path
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from graphiti_service import GraphitiService


@pytest.mark.asyncio
async def test_graphiti_add_rfp_episode_returns_not_stored_without_connections():
    service = GraphitiService()
    service.use_supabase = False
    service.supabase_client = None
    service.driver = None

    result = await service.add_rfp_episode(
        {
            "rfp_id": "rfp-1",
            "organization": "Coventry City FC",
            "entity_type": "Club",
            "title": "Test",
        }
    )

    assert result["status"] == "not_stored"
    assert result["episode_id"] == "temp"


@pytest.mark.asyncio
async def test_graphiti_get_entity_timeline_returns_empty_without_connections():
    service = GraphitiService()
    service.use_supabase = False
    service.supabase_client = None
    service.driver = None

    timeline = await service.get_entity_timeline("coventry-city-fc")

    assert timeline == []
