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


class _FailingInsertTable:
    def __init__(self, name: str):
        self.name = name
        self.last_op = None

    def insert(self, _payload):
        self.last_op = "insert"
        return self

    def upsert(self, _payload):
        self.last_op = "upsert"
        return self

    def execute(self):
        if self.last_op == "insert":
            raise RuntimeError("401 unauthorized")
        raise RuntimeError("409 conflict")


class _FallbackConflictSupabase:
    def table(self, name: str):
        return _FailingInsertTable(name)


@pytest.mark.asyncio
async def test_persist_unified_rfp_treats_fallback_conflict_as_idempotent_success():
    service = GraphitiService()
    service.use_supabase = True
    service.supabase_client = _FallbackConflictSupabase()

    result = await service.persist_unified_rfp(
        {
            "rfp_id": "rfp-123",
            "title": "Example RFP",
            "organization": "Arsenal FC",
            "source_url": "https://example.com/rfp",
        }
    )

    assert result["rfp_id"] == "rfp-123"
    assert result["status"] == "fallback_tracking_existing"
