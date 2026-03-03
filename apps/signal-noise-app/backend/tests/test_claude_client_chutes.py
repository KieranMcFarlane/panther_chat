#!/usr/bin/env python3
"""
Tests for ClaudeClient provider selection and Chutes transport support.
"""

import sys
from pathlib import Path
import pytest
import httpx

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import claude_client as claude_client_module
from claude_client import ClaudeClient


def test_claude_client_prefers_chutes_when_configured(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_TIMEOUT_SECONDS", "33")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "2")

    client = ClaudeClient()

    assert client.provider == ClaudeClient.PROVIDER_CHUTES_OPENAI
    assert client.api_key == "test-chutes-key"
    assert client.base_url == "https://llm.chutes.ai/v1"
    assert client.chutes_model == "zai-org/GLM-5-TEE"
    assert client.chutes_timeout_seconds == 33.0
    assert client.chutes_max_retries == 2


@pytest.mark.asyncio
async def test_claude_client_queries_chutes_chat_completions(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")

    request_capture = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": "Chutes GLM response",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 11,
                    "completion_tokens": 7,
                    "total_tokens": 18,
                },
            }

    class FakeAsyncClient:
        def __init__(self, timeout):
            request_capture["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            request_capture["url"] = url
            request_capture["headers"] = headers
            request_capture["json"] = json
            return FakeResponse()

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(
        prompt="Summarize this entity",
        model="haiku",
        max_tokens=256,
        system_prompt="Be concise",
    )

    assert request_capture["url"] == "https://llm.chutes.ai/v1/chat/completions"
    assert request_capture["headers"]["Authorization"] == "Bearer test-chutes-key"
    assert request_capture["json"]["model"] == "zai-org/GLM-5-TEE"
    assert request_capture["json"]["messages"][0] == {"role": "system", "content": "Be concise"}
    assert request_capture["json"]["messages"][1] == {"role": "user", "content": "Summarize this entity"}
    assert result["content"] == "Chutes GLM response"
    assert result["provider"] == ClaudeClient.PROVIDER_CHUTES_OPENAI
    assert result["tokens_used"]["input_tokens"] == 11


@pytest.mark.asyncio
async def test_claude_client_retries_retryable_chutes_errors(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_TIMEOUT_SECONDS", "12")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")

    attempts = {"count": 0}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"message": {"content": "Recovered"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise httpx.TimeoutException("timed out")
            return FakeResponse()

    async def fake_sleep(seconds):
        return None

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(claude_client_module.asyncio, "sleep", fake_sleep)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert attempts["count"] == 2
    assert result["content"] == "Recovered"


@pytest.mark.asyncio
async def test_claude_client_retries_chutes_rate_limits(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")

    attempts = {"count": 0}
    sleeps = []

    class SuccessResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"message": {"content": "Recovered after 429"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            }

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            attempts["count"] += 1
            if attempts["count"] == 1:
                request = httpx.Request("POST", url)
                response = httpx.Response(429, request=request, headers={"Retry-After": "1"})
                raise httpx.HTTPStatusError("429 Too Many Requests", request=request, response=response)
            return SuccessResponse()

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(claude_client_module.asyncio, "sleep", fake_sleep)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert attempts["count"] == 2
    assert sleeps == [1.0]
    assert result["content"] == "Recovered after 429"
