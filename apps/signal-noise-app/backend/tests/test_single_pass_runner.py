import argparse
import asyncio
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[4]
SCRIPT_DIR = REPO_ROOT / "apps" / "signal-noise-app" / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import run_single_pass_entity as runner


class _FakeResult:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return dict(self._payload)


class _FakeClaude:
    pass


class _FakeBrightData:
    async def close(self):
        return None


@pytest.mark.asyncio
async def test_single_pass_runs_recovery_when_initial_gate_fails(monkeypatch, tmp_path):
    calls = {"count": 0}

    class _FakeDiscovery:
        def __init__(self, claude_client, brightdata_client):
            self._id = id(self)

        async def run_discovery(self, **kwargs):
            calls["count"] += 1
            if calls["count"] == 1:
                return _FakeResult(
                    {
                        "entity_id": "arsenal-fc",
                        "entity_name": "Arsenal FC",
                        "final_confidence": 0.50,
                        "signals_discovered": [],
                        "performance_summary": {"evaluation_mode": "llm", "hop_timings": [{"decision": "NO_PROGRESS"}]},
                    }
                )
            return _FakeResult(
                {
                    "entity_id": "arsenal-fc",
                    "entity_name": "Arsenal FC",
                    "final_confidence": 0.62,
                    "signals_discovered": [{"source_type": "press_release"}],
                    "performance_summary": {"evaluation_mode": "llm", "hop_timings": [{"decision": "WEAK_ACCEPT", "parse_path": "json_direct"}]},
                }
            )

    monkeypatch.setattr(runner, "ClaudeClient", _FakeClaude)
    monkeypatch.setattr(runner, "BrightDataSDKClient", _FakeBrightData)
    monkeypatch.setattr(runner, "HypothesisDrivenDiscovery", _FakeDiscovery)

    args = argparse.Namespace(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        template_id="yellow_panther_agency",
        profile="test",
        output_dir=str(REPO_ROOT / "apps" / "signal-noise-app" / "backend" / "data" / "dossiers"),
        min_confidence=0.55,
        strict_gate=True,
        fetch_timeout_seconds=1.0,
    )

    summary = await runner.run_single_pass(args)

    assert calls["count"] == 2
    assert summary["promotion_gate_passed"] is True


@pytest.mark.asyncio
async def test_single_pass_skips_recovery_when_initial_gate_passes(monkeypatch, tmp_path):
    calls = {"count": 0}

    class _FakeDiscovery:
        def __init__(self, claude_client, brightdata_client):
            self._id = id(self)

        async def run_discovery(self, **kwargs):
            calls["count"] += 1
            return _FakeResult(
                {
                    "entity_id": "arsenal-fc",
                    "entity_name": "Arsenal FC",
                    "final_confidence": 0.66,
                    "signals_discovered": [{"source_type": "official_site"}],
                    "performance_summary": {"evaluation_mode": "llm", "hop_timings": [{"decision": "WEAK_ACCEPT", "parse_path": "json_direct"}]},
                }
            )

    monkeypatch.setattr(runner, "ClaudeClient", _FakeClaude)
    monkeypatch.setattr(runner, "BrightDataSDKClient", _FakeBrightData)
    monkeypatch.setattr(runner, "HypothesisDrivenDiscovery", _FakeDiscovery)

    args = argparse.Namespace(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        template_id="yellow_panther_agency",
        profile="test",
        output_dir=str(REPO_ROOT / "apps" / "signal-noise-app" / "backend" / "data" / "dossiers"),
        min_confidence=0.55,
        strict_gate=True,
        fetch_timeout_seconds=1.0,
    )

    summary = await runner.run_single_pass(args)

    assert calls["count"] == 1
    assert summary["promotion_gate_passed"] is True


def test_resolve_single_pass_template_prefers_club_procurement_template():
    template_id = runner._resolve_single_pass_template(
        requested_template_id="yellow_panther_agency",
        entity_name="Arsenal FC",
    )
    assert template_id == "tier_1_club_centralized_procurement"


def test_resolve_single_pass_template_prefers_federation_template():
    template_id = runner._resolve_single_pass_template(
        requested_template_id="yellow_panther_agency",
        entity_name="International Canoe Federation",
    )
    assert template_id == "federation_governing_body"
