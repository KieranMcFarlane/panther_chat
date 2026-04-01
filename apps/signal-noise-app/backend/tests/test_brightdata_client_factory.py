import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import brightdata_client_factory as factory
from brightdata_mcp_client import BrightDataClientWithFallback, BrightDataMCPClient, _resolve_stdio_server_path


def test_should_use_brightdata_mcp_requires_token(monkeypatch):
    monkeypatch.delenv("BRIGHTDATA_API_TOKEN", raising=False)
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_MCP", "true")
    assert factory.should_use_brightdata_mcp() is False


def test_should_use_brightdata_mcp_defaults_to_enabled_with_token(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "token")
    monkeypatch.delenv("PIPELINE_USE_BRIGHTDATA_MCP", raising=False)
    assert factory.should_use_brightdata_mcp() is True


def test_create_pipeline_brightdata_client_prefers_mcp_when_enabled(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "token")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_MCP", "true")
    monkeypatch.delenv("BRIGHTDATA_FASTMCP_URL", raising=False)
    monkeypatch.delenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE", None, raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY", None, raising=False)

    captured = {}

    def fake_mcp_factory(*, use_fallback, mcp_timeout):
        captured["use_fallback"] = use_fallback
        captured["mcp_timeout"] = mcp_timeout
        return SimpleNamespace(kind="mcp")

    client = factory.create_pipeline_brightdata_client(
        mcp_factory=fake_mcp_factory,
        sdk_factory=lambda: SimpleNamespace(kind="sdk"),
        mcp_timeout=7.5,
    )

    assert client.kind == "mcp"
    assert captured == {"use_fallback": True, "mcp_timeout": 7.5}


def test_create_pipeline_brightdata_client_uses_sdk_when_disabled(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "token")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_MCP", "false")
    monkeypatch.delenv("BRIGHTDATA_FASTMCP_URL", raising=False)
    monkeypatch.delenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE", None, raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY", None, raising=False)

    client = factory.create_pipeline_brightdata_client(
        mcp_factory=lambda **kwargs: SimpleNamespace(kind="mcp"),
        sdk_factory=lambda: SimpleNamespace(kind="sdk"),
    )

    assert client.kind == "sdk"


def test_create_pipeline_brightdata_client_prefers_fastmcp_service(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "token")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", "true")
    monkeypatch.setenv("BRIGHTDATA_FASTMCP_URL", "http://127.0.0.1:8000/mcp")
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE", None, raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY", None, raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE", None, raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY", None, raising=False)

    captured = {}

    def fake_fastmcp_factory(*, mcp_url, timeout):
        captured["mcp_url"] = mcp_url
        captured["timeout"] = timeout
        return SimpleNamespace(kind="fastmcp")

    client = factory.create_pipeline_brightdata_client(
        mcp_timeout=4.5,
        fastmcp_factory=fake_fastmcp_factory,
        sdk_factory=lambda: SimpleNamespace(kind="sdk"),
        mcp_factory=lambda **kwargs: SimpleNamespace(kind="mcp"),
    )

    assert client.kind == "fastmcp"
    assert captured == {"mcp_url": "http://127.0.0.1:8000/mcp", "timeout": 4.5}


def test_create_pipeline_brightdata_client_reuses_shared_instance(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "token")
    monkeypatch.setenv("PIPELINE_USE_BRIGHTDATA_MCP", "true")
    monkeypatch.setenv("PIPELINE_BRIGHTDATA_SHARED_CLIENT", "true")
    monkeypatch.delenv("BRIGHTDATA_FASTMCP_URL", raising=False)
    monkeypatch.delenv("PIPELINE_USE_BRIGHTDATA_FASTMCP", raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE", None, raising=False)
    monkeypatch.setattr(factory, "_PIPELINE_BRIGHTDATA_CLIENT_CACHE_KEY", None, raising=False)

    calls = {"count": 0}

    def fake_mcp_factory(*, use_fallback, mcp_timeout):
        calls["count"] += 1
        return SimpleNamespace(kind="mcp", use_fallback=use_fallback, mcp_timeout=mcp_timeout)

    first = factory.create_pipeline_brightdata_client(
        mcp_factory=fake_mcp_factory,
        sdk_factory=lambda: SimpleNamespace(kind="sdk"),
        mcp_timeout=9.0,
    )
    second = factory.create_pipeline_brightdata_client(
        mcp_factory=fake_mcp_factory,
        sdk_factory=lambda: SimpleNamespace(kind="sdk"),
        mcp_timeout=9.0,
    )

    assert first is second
    assert calls["count"] == 1
    assert getattr(first, "_pipeline_shared_client", False) is True


@pytest.mark.asyncio
async def test_prewarm_pipeline_brightdata_client_uses_hook_when_available():
    calls = []

    class _Client:
        async def prewarm(self, timeout=None):
            calls.append(timeout)
            return {"status": "success", "prewarmed": True}

    client = _Client()
    warmed = await factory.prewarm_pipeline_brightdata_client(client, timeout=12.5, background=False)

    assert warmed is client
    assert calls == [12.5]


@pytest.mark.asyncio
async def test_prewarm_pipeline_brightdata_client_background_mode_attaches_task(monkeypatch):
    created = []

    class _Task:
        def done(self):
            return False

    class _Client:
        async def prewarm(self, timeout=None):
            created.append(timeout)
            return {"status": "success", "prewarmed": True}

    def _fake_create_task(coro):
        coro.close()
        return _Task()

    monkeypatch.setattr(factory.asyncio, "create_task", _fake_create_task)
    client = _Client()
    warmed = await factory.prewarm_pipeline_brightdata_client(client, timeout=9.5, background=True)

    assert warmed is client
    assert hasattr(client, "_pipeline_prewarm_task")


@pytest.mark.asyncio
async def test_brightdata_client_with_fallback_accepts_num_results(monkeypatch):
    client = BrightDataClientWithFallback.__new__(BrightDataClientWithFallback)

    class _Mcp:
        async def search_engine(self, query, engine="google", country="us", num_results=10, cursor=None):
            return {
                "status": "success",
                "results": [{"title": query, "url": "https://example.com", "snippet": str(num_results)}],
                "cursor": cursor,
            }

    class _Http:
        async def search_engine(self, query, engine="google", country="us", num_results=10, cursor=None):
            return {"status": "success", "results": [], "cursor": cursor}

    client.mcp_client = _Mcp()
    client.http_client = _Http()
    client._using_mcp = False

    result = await BrightDataClientWithFallback.search_engine(
        client,
        "coventry city fc",
        engine="google",
        country="gb",
        num_results=3,
    )

    assert result["status"] == "success"
    assert result["results"][0]["snippet"] == "3"


def test_brightdata_mcp_client_defaults_to_repo_stdio_server_path(monkeypatch):
    monkeypatch.delenv("BRIGHTDATA_MCP_SERVER_PATH", raising=False)
    resolved = _resolve_stdio_server_path()
    assert resolved.endswith("apps/signal-noise-app/src/mcp-brightdata-server.js")
