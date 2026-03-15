#!/usr/bin/env python3
"""
Unit tests for evaluator decision token fallback parsing.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery


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
