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
        min_verified_claims=1,
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
        min_verified_claims=1,
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


def test_recovery_overrides_include_forced_hop_sequence():
    overrides = runner._recovery_overrides()
    assert overrides["DISCOVERY_FORCED_HOP_SEQUENCE"] == "official_site,press_release,careers_page"


def test_trusted_source_signal_accepts_hop_type():
    result = {
        "signals_discovered": [
            {"hop_type": "careers_page", "source_url": "https://example.com/careers"}
        ]
    }
    assert runner._trusted_source_signal(result) is True


def test_evaluate_gate_allows_deterministic_heuristic_promotion():
    result = {
        "final_confidence": 0.58,
        "decision": "WEAK_ACCEPT",
        "evaluation_mode": "heuristic",
        "signals_discovered": [
            {
                "hop_type": "careers_page",
                "evidence_type": "deterministic_careers_signal",
            }
        ],
    }
    gate = runner._evaluate_gate(result, min_confidence=0.55, strict_gate=True, min_verified_claims=1)
    assert gate["promotion_gate_passed"] is True
    assert "evaluation_mode_not_llm" not in gate["promotion_gate_reasons"]
    assert gate["verified_claims_count"] >= 1


def test_evaluate_gate_allows_heuristic_trusted_signal_without_evidence_type():
    result = {
        "final_confidence": 0.58,
        "decision": "WEAK_ACCEPT",
        "evaluation_mode": "heuristic",
        "signals_discovered": [{"hop_type": "careers_page"}],
    }
    gate = runner._evaluate_gate(result, min_confidence=0.55, strict_gate=True, min_verified_claims=1)
    assert gate["promotion_gate_passed"] is True
    assert gate["heuristic_trusted_signal"] is True
    assert gate["verified_claims_count"] >= 1


def test_evaluate_gate_blocks_when_verified_claim_count_below_minimum():
    result = {
        "final_confidence": 0.62,
        "decision": "WEAK_ACCEPT",
        "evaluation_mode": "llm",
        "signals_discovered": [{"hop_type": "careers_page", "confidence": 0.56}],
    }
    gate = runner._evaluate_gate(
        result,
        min_confidence=0.55,
        strict_gate=True,
        min_verified_claims=2,
    )
    assert gate["promotion_gate_passed"] is False
    assert "verified_claims_below_min" in gate["promotion_gate_reasons"]
    assert gate["verified_claims_count"] == 1
