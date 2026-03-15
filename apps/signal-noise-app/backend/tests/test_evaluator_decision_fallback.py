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
