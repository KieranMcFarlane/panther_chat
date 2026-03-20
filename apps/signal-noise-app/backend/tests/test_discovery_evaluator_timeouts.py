#!/usr/bin/env python3
"""
Focused tests for evaluator timeout retry handling.
"""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery
from hypothesis_driven_discovery import HopType


@pytest.mark.asyncio
async def test_query_evaluator_model_retries_on_timeout_then_succeeds():
    class _ClaudeStub:
        def __init__(self):
            self.calls = 0

        async def query(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                await asyncio.sleep(0.01)
                return {"content": "late"}
            return {"content": "ok"}

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.evaluation_query_timeout_seconds = 0.001
    discovery.evaluation_timeout_max_retries = 1
    discovery.evaluation_timeout_retry_backoff_seconds = 0.0
    discovery.evaluation_timeout_retry_backoff_cap_seconds = 0.0
    discovery.evaluation_timeout_retry_jitter_seconds = 0.0
    discovery.evaluation_timeout_model_escalation_enabled = True
    discovery.evaluation_timeout_escalation_model = "sonnet"

    response = await discovery._query_evaluator_model(
        prompt="test",
        max_tokens=32,
        system_prompt="Return JSON only",
        json_mode=True,
        requested_model="haiku",
    )

    assert response["content"] == "ok"
    assert discovery.claude_client.calls == 2


@pytest.mark.asyncio
async def test_query_evaluator_model_raises_after_timeout_retries_exhausted():
    class _ClaudeStub:
        def __init__(self):
            self.calls = 0

        async def query(self, **kwargs):
            self.calls += 1
            await asyncio.sleep(0.01)
            return {"content": "late"}

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.evaluation_query_timeout_seconds = 0.001
    discovery.evaluation_timeout_max_retries = 1
    discovery.evaluation_timeout_retry_backoff_seconds = 0.0
    discovery.evaluation_timeout_retry_backoff_cap_seconds = 0.0
    discovery.evaluation_timeout_retry_jitter_seconds = 0.0
    discovery.evaluation_timeout_model_escalation_enabled = False
    discovery.evaluation_timeout_escalation_model = "sonnet"

    with pytest.raises(TimeoutError):
        await discovery._query_evaluator_model(
            prompt="test",
            max_tokens=32,
            system_prompt="Return JSON only",
            json_mode=True,
            requested_model="haiku",
        )

    assert discovery.claude_client.calls == 2


@pytest.mark.asyncio
async def test_query_evaluator_model_sends_non_streaming_flag():
    captured_calls = []

    class _ClaudeStub:
        async def query(self, **kwargs):
            captured_calls.append(kwargs)
            return {"content": "ok"}

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.evaluation_query_timeout_seconds = 1.0
    discovery.evaluation_timeout_max_retries = 0
    discovery.evaluation_timeout_retry_backoff_seconds = 0.0
    discovery.evaluation_timeout_retry_backoff_cap_seconds = 0.0
    discovery.evaluation_timeout_retry_jitter_seconds = 0.0
    discovery.evaluation_timeout_model_escalation_enabled = False
    discovery.evaluation_timeout_escalation_model = "sonnet"

    response = await discovery._query_evaluator_model(
        prompt="test",
        max_tokens=32,
        system_prompt="Return JSON only",
        json_mode=True,
        requested_model="haiku",
    )

    assert response["content"] == "ok"
    assert captured_calls
    assert captured_calls[0].get("stream") is False


@pytest.mark.asyncio
async def test_query_evaluator_model_retries_on_empty_response_then_succeeds():
    class _ClaudeStub:
        def __init__(self):
            self.calls = 0

        async def query(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return {"content": "   "}
            return {"content": '{"decision":"NO_PROGRESS","confidence_delta":0.0}'}

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.evaluation_query_timeout_seconds = 1.0
    discovery.evaluation_timeout_max_retries = 0
    discovery.evaluation_timeout_retry_backoff_seconds = 0.0
    discovery.evaluation_timeout_retry_backoff_cap_seconds = 0.0
    discovery.evaluation_timeout_retry_jitter_seconds = 0.0
    discovery.evaluation_timeout_model_escalation_enabled = False
    discovery.evaluation_timeout_escalation_model = "sonnet"
    discovery.evaluation_empty_response_max_retries = 1
    discovery.evaluation_empty_response_retry_backoff_seconds = 0.0
    discovery.evaluation_empty_response_retry_backoff_cap_seconds = 0.0
    discovery.evaluation_empty_response_retry_jitter_seconds = 0.0

    response = await discovery._query_evaluator_model(
        prompt="test",
        max_tokens=32,
        system_prompt="Return JSON only",
        json_mode=True,
        requested_model="haiku",
    )

    assert response["content"].strip().startswith("{")
    assert discovery.claude_client.calls == 2


@pytest.mark.asyncio
async def test_evaluator_gates_positive_decision_without_evidence_payload():
    class _QueryStub:
        def __init__(self):
            self.calls = 0

        async def __call__(self, **kwargs):
            self.calls += 1
            return {
                "content": (
                    '{"decision":"ACCEPT","confidence_delta":0.06,'
                    '"justification":"signal found","evidence_found":"",'
                    '"evidence_type":"other","temporal_score":"recent_12mo"}'
                )
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    query_stub = _QueryStub()
    discovery._query_evaluator_model = query_stub
    discovery._extract_structured_evaluation_payload = lambda _response: None
    discovery._parse_evaluation_response_json = lambda _text: {
        "decision": "ACCEPT",
        "confidence_delta": 0.06,
        "justification": "signal found",
        "evidence_found": "",
        "evidence_type": "other",
        "temporal_score": "recent_12mo",
    }
    discovery._normalize_evaluator_result = lambda result: result
    discovery._validate_evaluator_schema = lambda _result: (True, "ok")
    discovery._update_llm_runtime_diagnostics = lambda **kwargs: None
    discovery._attempt_json_repair_pass = lambda _text: None
    discovery._deterministic_fallback_classification = lambda **kwargs: {
        "decision": "NO_PROGRESS",
        "confidence_delta": 0.0,
        "justification": "fallback",
        "evidence_found": "",
        "evidence_type": "none",
        "temporal_score": "older",
    }
    discovery._apply_min_evidence_salvage = lambda **kwargs: kwargs["result"]
    discovery._decorate_evaluation_result = lambda result, evaluation_mode=None: {
        **result,
        "evaluation_mode": evaluation_mode,
    }
    discovery._build_evaluation_context = lambda **kwargs: SimpleNamespace(
        entity_name="Arsenal FC",
        hypothesis_statement="Procurement activity likely",
        hypothesis_category="procurement",
        pattern_name="procurement_signal",
        current_confidence=0.5,
        iterations_attempted=1,
        early_indicators=[],
        keywords=["procurement"],
        recent_history=[],
        last_decision=None,
        hop_type=HopType.RFP_PAGE,
        channel_guidance="Focus procurement evidence",
        min_evidence_strength="medium",
        temporal_requirements="recent_12mo",
    )
    discovery._format_early_indicators = lambda _indicators: ""
    discovery._is_low_signal_content = lambda _content: False

    hypothesis = SimpleNamespace(
        metadata={"entity_name": "Arsenal FC"},
        category="procurement",
        confidence=0.5,
        iterations_attempted=1,
        statement="Procurement activity likely",
    )

    result = await discovery._evaluate_content_with_claude(
        content="Arsenal procurement update without direct quote",
        hypothesis=hypothesis,
        hop_type=HopType.RFP_PAGE,
        content_metadata={"source_url": "https://www.arsenal.com/news/procurement"},
    )

    assert query_stub.calls >= 2
    assert result["decision"] == "NO_PROGRESS"
    assert result["parse_path"] == "evidence_payload_gate"
    assert result["evidence_type"] == "missing_evidence_payload"
