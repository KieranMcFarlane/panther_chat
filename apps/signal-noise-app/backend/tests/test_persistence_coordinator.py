#!/usr/bin/env python3
"""
Tests for dual-write persistence coordinator.
"""

import sys
from pathlib import Path
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from persistence_coordinator import DualWritePersistenceCoordinator


@pytest.mark.asyncio
async def test_dual_write_coordinator_succeeds_when_both_writers_succeed():
    async def supabase_writer(payload):
        return None

    async def falkordb_writer(payload):
        return None

    coordinator = DualWritePersistenceCoordinator(
        supabase_writer=supabase_writer,
        falkordb_writer=falkordb_writer,
        max_attempts=2,
    )
    result = await coordinator.persist_run_artifacts(
        run_id="run-1",
        entity_id="arsenal-fc",
        phase="dashboard_scoring",
        record_type="pipeline_run",
        record_id="arsenal-fc",
        payload={"score": 1},
    )
    assert result["dual_write_ok"] is True
    assert result["supabase"]["ok"] is True
    assert result["falkordb"]["ok"] is True
    assert result["reconcile_required"] is False


@pytest.mark.asyncio
async def test_dual_write_coordinator_retries_then_succeeds():
    state = {"supabase_calls": 0}

    async def supabase_writer(payload):
        state["supabase_calls"] += 1
        if state["supabase_calls"] < 2:
            raise TimeoutError("temporary")

    async def falkordb_writer(payload):
        return None

    coordinator = DualWritePersistenceCoordinator(
        supabase_writer=supabase_writer,
        falkordb_writer=falkordb_writer,
        max_attempts=3,
    )
    result = await coordinator.persist_run_artifacts(
        run_id="run-1",
        entity_id="arsenal-fc",
        phase="dashboard_scoring",
        record_type="pipeline_run",
        record_id="arsenal-fc",
        payload={"score": 1},
    )
    assert result["dual_write_ok"] is True
    assert result["supabase"]["attempts"] == 2


@pytest.mark.asyncio
async def test_dual_write_coordinator_reports_reconcile_payload_on_failure():
    async def supabase_writer(payload):
        raise RuntimeError("write failed")

    coordinator = DualWritePersistenceCoordinator(
        supabase_writer=supabase_writer,
        falkordb_writer=None,
        max_attempts=2,
    )
    result = await coordinator.persist_run_artifacts(
        run_id="run-2",
        entity_id="fiba",
        phase="dashboard_scoring",
        record_type="pipeline_run",
        record_id="fiba",
        payload={"score": 2},
    )
    assert result["dual_write_ok"] is False
    assert result["reconcile_required"] is True
    assert result["reconciliation_payload"]["idempotency_key"]
    assert result["falkordb"]["error_class"] == "missing_writer"
