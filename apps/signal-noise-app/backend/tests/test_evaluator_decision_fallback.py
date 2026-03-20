#!/usr/bin/env python3
"""
Unit tests for evaluator decision token fallback parsing.
"""

import sys
from pathlib import Path
from types import SimpleNamespace

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HopType, HypothesisDrivenDiscovery


def _discovery_stub():
    return HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)


def test_extract_decision_token_handles_space_variant():
    discovery = _discovery_stub()
    text = "Final Decision: NO PROGRESS due to insufficient evidence."
    assert discovery._extract_decision_token(text) == "NO_PROGRESS"


def test_extract_decision_token_handles_weak_accept_variant():
    discovery = _discovery_stub()
    text = "Decision should be weak-accept because signals are partial."
    assert discovery._extract_decision_token(text) == "WEAK_ACCEPT"


def test_extract_decision_token_uses_semantic_hint():
    discovery = _discovery_stub()
    text = "There is insufficient evidence to support the hypothesis."
    assert discovery._extract_decision_token(text) == "NO_PROGRESS"


def test_evidence_gate_requires_snippet_for_accept():
    discovery = _discovery_stub()
    assert discovery._should_force_evidence_reask({"decision": "ACCEPT", "evidence_found": ""}) is True
    assert discovery._should_force_evidence_reask({"decision": "WEAK_ACCEPT", "evidence_found": "short"}) is True
    assert discovery._should_force_evidence_reask({"decision": "ACCEPT", "evidence_found": "Specific quote from source"}) is False
    assert discovery._should_force_evidence_reask({"decision": "NO_PROGRESS", "evidence_found": ""}) is False


def test_normalize_evaluator_result_canonicalizes_decision():
    discovery = _discovery_stub()
    normalized = discovery._normalize_evaluator_result(
        {"decision": "weak-accept", "evidence_found": "  evidence here  ", "justification": "  why  "}
    )
    assert normalized["decision"] == "WEAK_ACCEPT"
    assert normalized["evidence_found"] == "evidence here"
    assert normalized["justification"] == "why"


def test_deterministic_fallback_does_not_emit_accept_when_policy_enabled():
    discovery = _discovery_stub()
    discovery.discovery_policy_evidence_first = True
    context = SimpleNamespace(
        keywords=["procurement", "digital"],
        entity_name="Arsenal FC",
        hop_type=HopType.RFP_PAGE,
    )

    fallback = discovery._extract_evidence_pack(
        content="Arsenal procurement platform digital supplier tender announcement with full details",
        context=context,
        mcp_matches=[{"total_confidence": 0.35}],
    )
    assert fallback["decision"] != "ACCEPT"
    assert fallback["decision"] in {"WEAK_ACCEPT_CANDIDATE", "WEAK_ACCEPT", "NO_PROGRESS"}


def test_policy_constraints_block_accept_without_evidence_and_tier3():
    discovery = _discovery_stub()
    discovery.discovery_policy_evidence_first = True
    discovery._policy_metrics = {
        "synthetic_url_attempt_count": 0,
        "dead_end_event_count": 0,
        "fallback_accept_block_count": 0,
    }
    state = SimpleNamespace(iteration_results=[])

    constrained = discovery._enforce_policy_decision_constraints(
        evaluation={
            "decision": "ACCEPT",
            "confidence_delta": 0.06,
            "evidence_type": "deterministic_fallback",
            "evidence_found": "",
            "_source_tier": "tier_3",
            "_evidence_quality_score": 0.1,
        },
        content="",
        state=state,
        hypothesis_id="h1",
        hop_type=HopType.RFP_PAGE,
    )

    assert constrained["decision"] == "NO_PROGRESS"
    assert constrained["accept_guard_passed"] is False
    assert "empty_evidence_found" in constrained["accept_reject_reasons"]
    assert "tier3_without_corroboration" in constrained["accept_reject_reasons"]
