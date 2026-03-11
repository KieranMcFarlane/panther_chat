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
from claude_client import ClaudeClient, LLMRequestError


@pytest.fixture(autouse=True)
def _default_non_stream_for_legacy_tests(monkeypatch):
    monkeypatch.setenv("CHUTES_STREAM_ENABLED", "false")


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


def test_claude_client_supports_explicit_chutes_anthropic_provider(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "chutes_anthropic")
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_ANTHROPIC_BASE_URL", "https://llm.chutes.ai/anthropic")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")

    client = ClaudeClient()

    assert client.provider == "chutes_anthropic"
    assert client.api_key == "test-chutes-key"
    assert client.base_url == "https://llm.chutes.ai/anthropic"
    assert client.chutes_model == "zai-org/GLM-5-TEE"


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
    assert result["model_used"] == "zai-org/GLM-5-TEE"
    assert result["requested_model"] == "haiku"
    assert result["tokens_used"]["input_tokens"] == 11


@pytest.mark.asyncio
async def test_claude_client_queries_chutes_anthropic_messages(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "chutes_anthropic")
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_ANTHROPIC_BASE_URL", "https://llm.chutes.ai/anthropic")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")

    request_capture = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Anthropic-style Chutes response",
                    }
                ],
                "stop_reason": "end_turn",
                "usage": {
                    "input_tokens": 13,
                    "output_tokens": 8,
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

    assert request_capture["url"] == "https://llm.chutes.ai/anthropic/messages"
    assert request_capture["headers"]["x-api-key"] == "test-chutes-key"
    assert request_capture["headers"]["anthropic-version"] == "2023-06-01"
    assert request_capture["json"]["model"] == "zai-org/GLM-5-TEE"
    assert request_capture["json"]["system"] == "Be concise"
    assert request_capture["json"]["messages"] == [{"role": "user", "content": "Summarize this entity"}]
    assert result["content"] == "Anthropic-style Chutes response"
    assert result["provider"] == "chutes_anthropic"
    assert result["model_used"] == "zai-org/GLM-5-TEE"
    assert result["requested_model"] == "haiku"
    assert result["tokens_used"]["input_tokens"] == 13


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
async def test_claude_client_returns_empty_when_only_reasoning_content_present(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "zai-org/GLM-5-TEE")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": None,
                            "reasoning_content": "Fallback reasoning content",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15,
                },
            }

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            return FakeResponse()

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert result["content"] == ""
    assert result["inference_diagnostics"]["answer_channel_chars"] == 0
    assert result["inference_diagnostics"]["reasoning_channel_chars"] > 0


@pytest.mark.asyncio
async def test_claude_client_retries_chutes_rate_limits(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "zai-org/GLM-5-TEE")
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


@pytest.mark.asyncio
async def test_claude_client_applies_jittered_backoff_without_retry_after(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")
    monkeypatch.setenv("CHUTES_RETRY_JITTER_SECONDS", "0.5")

    attempts = {"count": 0}
    sleeps = []

    class SuccessResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{"message": {"content": "Recovered after jitter backoff"}, "finish_reason": "stop"}],
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
                response = httpx.Response(429, request=request)
                raise httpx.HTTPStatusError("429 Too Many Requests", request=request, response=response)
            return SuccessResponse()

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(claude_client_module.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(claude_client_module.random, "uniform", lambda _a, _b: 0.25)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert attempts["count"] == 2
    assert sleeps == [1.25]
    assert result["content"] == "Recovered after jitter backoff"


@pytest.mark.asyncio
async def test_claude_client_retries_empty_length_responses_with_backoff(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")
    monkeypatch.setenv("CHUTES_RETRY_JITTER_SECONDS", "0")

    attempts = {"count": 0}
    sleeps = []

    class FakeResponse:
        def __init__(self, attempt: int):
            self.attempt = attempt

        def raise_for_status(self):
            return None

        def json(self):
            if self.attempt == 1:
                return {
                    "choices": [{"message": {"content": None}, "finish_reason": "length"}],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                }
            return {
                "choices": [{"message": {"content": "Recovered after empty-length retry"}, "finish_reason": "stop"}],
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
            return FakeResponse(attempts["count"])

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(claude_client_module.asyncio, "sleep", fake_sleep)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert attempts["count"] == 2
    assert sleeps == [1.0]
    assert result["content"] == "Recovered after empty-length retry"


@pytest.mark.asyncio
async def test_claude_client_falls_back_to_kimi_when_content_empty(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")

    request_models = []

    class FakeResponse:
        def __init__(self, model: str):
            self.model = model

        def raise_for_status(self):
            return None

        def json(self):
            if self.model == "zai-org/GLM-5-TEE":
                return {
                    "choices": [
                        {
                            "message": {"content": None, "reasoning_content": None},
                            "finish_reason": "length",
                        }
                    ],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                }
            return {
                "choices": [
                    {
                        "message": {"content": "Fallback model response"},
                        "finish_reason": "stop",
                    }
                ],
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
            model = json["model"]
            request_models.append(model)
            return FakeResponse(model)

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert request_models == ["zai-org/GLM-5-TEE", "moonshotai/Kimi-K2.5-TEE"]
    assert result["content"] == "Fallback model response"
    assert result["model_used"] == "moonshotai/Kimi-K2.5-TEE"


@pytest.mark.asyncio
async def test_claude_client_switches_to_fallback_after_retryable_timeout(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")

    request_models = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {"content": "Fallback after timeout"},
                        "finish_reason": "stop",
                    }
                ],
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
            model = json["model"]
            request_models.append(model)
            if model == "zai-org/GLM-5-TEE":
                raise httpx.TimeoutException("timed out")
            return FakeResponse()

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert request_models == ["zai-org/GLM-5-TEE", "moonshotai/Kimi-K2.5-TEE"]
    assert result["content"] == "Fallback after timeout"
    assert result["model_used"] == "moonshotai/Kimi-K2.5-TEE"


@pytest.mark.asyncio
async def test_claude_client_raises_retryable_error_when_rate_limited_after_retries(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "0")

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            request = httpx.Request("POST", url)
            response = httpx.Response(429, request=request)
            raise httpx.HTTPStatusError("429 Too Many Requests", request=request, response=response)

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    with pytest.raises(LLMRequestError) as exc_info:
        await client.query(prompt="retry me", model="haiku", max_tokens=64)

    assert exc_info.value.retryable is True
    assert exc_info.value.provider == ClaudeClient.PROVIDER_CHUTES_OPENAI
    assert exc_info.value.runtime_model == "zai-org/GLM-5-TEE"


@pytest.mark.asyncio
async def test_claude_client_streaming_parser_uses_answer_channel_and_tracks_reasoning(monkeypatch):
    monkeypatch.setenv("CHUTES_STREAM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")

    request_capture = {}

    class FakeStreamResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            lines = [
                "event: message",
                'data: {"choices":[{"delta":{"reasoning_content":"plan "},"finish_reason":null}]}',
                "data: not-json",
                'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
                'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}',
                "data: [DONE]",
            ]
            for line in lines:
                yield line

    class FakeAsyncClient:
        def __init__(self, timeout):
            request_capture["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def stream(self, method, url, headers=None, json=None):
            request_capture["method"] = method
            request_capture["url"] = url
            request_capture["headers"] = headers
            request_capture["json"] = json
            return FakeStreamResponse()

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="hello", model="haiku", max_tokens=64)

    assert request_capture["json"]["stream"] is True
    assert request_capture["url"] == "https://llm.chutes.ai/v1/chat/completions"
    assert result["content"] == "Hello world"
    assert result["tokens_used"]["total_tokens"] == 5
    assert result["inference_diagnostics"]["streaming"] is True
    assert result["inference_diagnostics"]["chunk_count"] == 3
    assert result["inference_diagnostics"]["answer_channel_chars"] == len("Hello world")
    assert result["inference_diagnostics"]["reasoning_channel_chars"] == len("plan ")


@pytest.mark.asyncio
async def test_claude_client_streaming_falls_back_when_answer_channel_empty(monkeypatch):
    monkeypatch.setenv("CHUTES_STREAM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")

    request_models = []

    class FakeStreamResponse:
        def __init__(self, model):
            self.model = model

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            if self.model == "zai-org/GLM-5-TEE":
                lines = [
                    'data: {"choices":[{"delta":{"reasoning_content":"thinking only"},"finish_reason":"stop"}]}',
                    "data: [DONE]",
                ]
            else:
                lines = [
                    'data: {"choices":[{"delta":{"content":"fallback answer"},"finish_reason":"stop"}]}',
                    "data: [DONE]",
                ]
            for line in lines:
                yield line

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def stream(self, method, url, headers=None, json=None):
            model = json["model"]
            request_models.append(model)
            return FakeStreamResponse(model)

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="hello", model="haiku", max_tokens=64)

    assert request_models == ["zai-org/GLM-5-TEE", "moonshotai/Kimi-K2.5-TEE"]
    assert result["content"] == "fallback answer"
    assert result["model_used"] == "moonshotai/Kimi-K2.5-TEE"
    assert result["inference_diagnostics"]["fallback_used"] is True


@pytest.mark.asyncio
async def test_claude_client_streaming_parses_list_content_parts(monkeypatch):
    monkeypatch.setenv("CHUTES_STREAM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")

    class FakeStreamResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            lines = [
                'data: {"choices":[{"delta":{"content":[{"type":"text","text":"Hello "}]}}]}',
                'data: {"choices":[{"delta":{"content":[{"type":"text","text":"world"}],"reasoning":[{"type":"text","text":"r"}]},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}',
                "data: [DONE]",
            ]
            for line in lines:
                yield line

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def stream(self, method, url, headers=None, json=None):
            return FakeStreamResponse()

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="hello", model="haiku", max_tokens=64)

    assert result["content"] == "Hello world"


@pytest.mark.asyncio
async def test_claude_client_streaming_length_empty_retries_non_stream_before_fallback(monkeypatch):
    monkeypatch.setenv("CHUTES_STREAM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    monkeypatch.setenv("CHUTES_API_KEY", "test-chutes-key")
    monkeypatch.setenv("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
    monkeypatch.setenv("CHUTES_MAX_RETRIES", "1")

    stream_calls = 0
    post_calls = []

    class FakeStreamResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            lines = [
                'data: {"choices":[{"delta":{"reasoning_content":"thinking"},"finish_reason":"length"}]}',
                "data: [DONE]",
            ]
            for line in lines:
                yield line

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        def stream(self, method, url, headers=None, json=None):
            nonlocal stream_calls
            stream_calls += 1
            return FakeStreamResponse()

        async def post(self, url, headers=None, json=None):
            post_calls.append(json)
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "choices": [
                        {
                            "message": {"content": "non-stream salvage"},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3},
                },
            )

    monkeypatch.setattr(claude_client_module.httpx, "AsyncClient", FakeAsyncClient)

    client = ClaudeClient()
    result = await client.query(prompt="hello", model="haiku", max_tokens=64)

    assert result["content"] == "non-stream salvage"
    assert stream_calls == 1
    assert len(post_calls) == 1
    assert post_calls[0]["stream"] is False
