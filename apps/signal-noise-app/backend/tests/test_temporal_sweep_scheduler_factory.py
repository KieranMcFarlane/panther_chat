#!/usr/bin/env python3
"""
Tests for BrightData factory usage in TemporalSweepScheduler.
"""

import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(backend_dir))

import temporal_sweep_scheduler as scheduler_module
from temporal_sweep_scheduler import TemporalSweepScheduler


class _DummyClaudeClient:
    pass


def test_temporal_sweep_scheduler_defaults_to_pipeline_brightdata_factory(monkeypatch):
    factory_calls = []

    class _FakeBrightDataClient:
        pass

    def _fake_factory(*args, **kwargs):
        factory_calls.append((args, kwargs))
        return _FakeBrightDataClient()

    monkeypatch.setattr(scheduler_module, "create_pipeline_brightdata_client", _fake_factory, raising=False)

    scheduler = TemporalSweepScheduler(_DummyClaudeClient())

    assert factory_calls, "Expected TemporalSweepScheduler to call create_pipeline_brightdata_client()"
    assert isinstance(scheduler.brightdata, _FakeBrightDataClient)
