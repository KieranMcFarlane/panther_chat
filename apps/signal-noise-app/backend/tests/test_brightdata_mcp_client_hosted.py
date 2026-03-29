import asyncio
import importlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


class _FakeFastMCPClient:
    def __init__(self, url, timeout=5, **kwargs):
        self.url = url
        self.timeout = timeout
        self.entered = False
        self.calls = []
        self.last_arguments = None

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def call_tool(self, name, arguments=None):
        self.calls.append((name, arguments or {}))
        self.last_arguments = arguments or {}
        if name == "search_engine":
            payload = {
                "organic": [
                    {
                        "title": "Arsenal FC Official Website | Home | Arsenal.com",
                        "link": "https://www.arsenal.com/",
                        "description": "Arsenal Football Club Official Website.",
                    }
                ],
                "current_page": 1,
            }
        else:
            payload = {
                "status": "success",
                "results": [
                    {
                        "title": "Arsenal FC founded in 1886",
                        "url": "https://en.wikipedia.org/wiki/Arsenal_F.C.",
                        "snippet": "Arsenal were founded in 1886.",
                    }
                ],
            }
        return SimpleNamespace(content=[SimpleNamespace(text=json.dumps(payload))])


class _FlakySession:
    def __init__(self, *, fail_once: bool, payload: dict[str, object]):
        self.fail_once = fail_once
        self.payload = payload
        self.calls = 0

    async def call_tool(self, name, arguments=None):
        self.calls += 1
        if self.fail_once and self.calls == 1:
            raise RuntimeError("Client is not connected. Use the 'async with client:' context manager first.")
        return SimpleNamespace(content=[SimpleNamespace(text=json.dumps(self.payload))])


@pytest.mark.asyncio
async def test_brightdata_mcp_client_uses_hosted_sse(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_MCP_HOSTED_URL", "https://mcp.brightdata.com/sse?token=test-token")
    monkeypatch.setenv("BRIGHTDATA_MCP_USE_HOSTED", "true")
    monkeypatch.delenv("BRIGHTDATA_MCP_SERVER_COMMAND", raising=False)
    monkeypatch.delenv("BRIGHTDATA_MCP_SERVER_PATH", raising=False)

    module = importlib.import_module("brightdata_mcp_client")
    monkeypatch.setattr(module, "_HOSTED_MCP_DEFAULT_URL", "https://mcp.brightdata.com/mcp", raising=False)
    monkeypatch.setattr("fastmcp.Client", _FakeFastMCPClient)
    monkeypatch.setattr("mcp.client.stdio.stdio_client", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("stdio path should not be used")))

    client = module.BrightDataMCPClient(timeout=1.0)
    result = await asyncio.wait_for(client.search_engine("Arsenal founded", num_results=1), timeout=2.0)

    assert result["status"] == "success"
    assert result["results"][0]["snippet"] == "Arsenal Football Club Official Website."
    assert client._transport == "hosted_sse"
    assert client._hosted_mcp_url == "https://mcp.brightdata.com/sse?token=test-token"
    assert client.session.last_arguments == {
        "query": "Arsenal founded",
        "engine": "google",
        "geo_location": "us",
    }


def test_brightdata_mcp_client_defaults_to_hosted_mcp_endpoint(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.delenv("BRIGHTDATA_MCP_HOSTED_URL", raising=False)
    monkeypatch.delenv("BRIGHTDATA_MCP_USE_HOSTED", raising=False)

    module = importlib.import_module("brightdata_mcp_client")
    client = module.BrightDataMCPClient(timeout=1.0)

    assert client._hosted_mcp_url == "https://mcp.brightdata.com/mcp?token=test-token"
    assert client._transport == "hosted_sse"


@pytest.mark.asyncio
async def test_brightdata_mcp_client_reconnects_after_stale_session(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_MCP_USE_HOSTED", "true")

    module = importlib.import_module("brightdata_mcp_client")
    monkeypatch.setattr(module, "_HOSTED_MCP_DEFAULT_URL", "https://mcp.brightdata.com/mcp", raising=False)

    client = module.BrightDataMCPClient(timeout=1.0)
    first_session = _FlakySession(
        fail_once=True,
        payload={"results": [{"title": "stale", "url": "https://example.com/stale", "snippet": "stale"}]},
    )
    second_session = _FlakySession(
        fail_once=False,
        payload={"results": [{"title": "recovered", "url": "https://example.com/recovered", "snippet": "fresh"}]},
    )
    client.session = first_session
    client._available = True
    client._mcp_available = True
    client._transport_context = None

    reconnects = {"count": 0}

    async def fake_ensure_session():
        reconnects["count"] += 1
        if reconnects["count"] == 1:
            client.session = first_session
            client._available = True
        else:
            client.session = second_session
            client._available = True

    monkeypatch.setattr(client, "_ensure_session", fake_ensure_session)

    result = await client.search_engine("Major League Cricket RFP tender procurement", num_results=1)

    assert result["status"] == "success"
    assert result["results"][0]["title"] == "recovered"
    assert reconnects["count"] == 2
