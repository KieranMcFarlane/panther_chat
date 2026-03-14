#!/usr/bin/env python3
"""
Focused tests for evaluator timeout retry handling.
"""

import asyncio
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery


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
