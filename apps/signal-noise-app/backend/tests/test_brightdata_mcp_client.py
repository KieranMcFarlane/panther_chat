import asyncio
import logging
import sys
from types import ModuleType, SimpleNamespace
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import brightdata_mcp_client as brightdata_mcp_client_module
from brightdata_mcp_client import BrightDataMCPClient


@pytest.mark.asyncio
async def test_scrape_batch_normalizes_list_response(monkeypatch):
    client = BrightDataMCPClient.__new__(BrightDataMCPClient)
    client._transport = "hosted_sse"
    client._available = True
    client.pro_mode = False

    async def _noop_ensure_session():
        return None

    async def _fake_call_tool(tool_name, arguments):
        assert tool_name == "scrape_batch"
        assert arguments["urls"] == ["https://example.com/one", "https://example.com/two"]
        return [
            {
                "status": "success",
                "url": "https://example.com/one",
                "content": "First result",
            },
            {
                "status": "success",
                "url": "https://example.com/two",
                "content": "Second result",
            },
        ]

    client._ensure_session = _noop_ensure_session  # type: ignore[method-assign]
    client._call_tool = _fake_call_tool  # type: ignore[method-assign]

    result = await client.scrape_batch(["https://example.com/one", "https://example.com/two"])

    assert result["status"] == "success"
    assert result["total_urls"] == 2
    assert result["successful"] == 2
    assert result["failed"] == 0
    assert len(result["results"]) == 2
    assert result["results"][0]["url"] == "https://example.com/one"


@pytest.mark.asyncio
async def test_call_tool_wraps_json_list_response(monkeypatch):
    client = BrightDataMCPClient.__new__(BrightDataMCPClient)
    client._transport = "hosted_sse"
    client._available = True
    client.pro_mode = False

    class _FakeContentItem:
        def __init__(self, text):
            self.text = text

    class _FakeResult:
        def __init__(self, text):
            self.content = [_FakeContentItem(text)]

    async def _noop_ensure_session():
        return None

    async def _fake_call_tool(self, tool_name, arguments):
        assert tool_name == "scrape_batch"
        return _FakeResult(
            '[{"status":"success","url":"https://example.com/one"},{"status":"error","url":"https://example.com/two"}]'
        )

    client._ensure_session = _noop_ensure_session  # type: ignore[method-assign]
    client.session = type("S", (), {"call_tool": _fake_call_tool})()  # type: ignore[assignment]

    result = await client._call_tool("scrape_batch", {"urls": ["https://example.com/one", "https://example.com/two"]})

    assert result["status"] == "success"
    assert result["successful"] == 1
    assert result["failed"] == 1
    assert len(result["results"]) == 2


@pytest.mark.asyncio
async def test_close_exits_session_context_before_transport():
    client = BrightDataMCPClient.__new__(BrightDataMCPClient)
    client._pipeline_shared_client = False
    client._session_init_task = None
    client._available = True
    client.session = object()
    calls = []

    class _SessionContext:
        async def __aexit__(self, exc_type, exc, tb):
            calls.append("session")
            return False

    class _TransportContext:
        async def __aexit__(self, exc_type, exc, tb):
            calls.append("transport")
            return False

    client._session_context = _SessionContext()
    client._transport_context = _TransportContext()

    await BrightDataMCPClient.close(client)

    assert calls == ["session", "transport"]
    assert client.session is None
    assert client._session_context is None
    assert client._transport_context is None
    assert client._available is False


@pytest.mark.asyncio
async def test_close_cancels_inflight_init_task_before_teardown():
    client = BrightDataMCPClient.__new__(BrightDataMCPClient)
    client._pipeline_shared_client = False
    client._available = True
    client.session = None
    client._session_context = None
    client._transport_context = None

    started = asyncio.Event()

    async def _never_finishes():
        started.set()
        await asyncio.sleep(60)

    client._session_init_task = asyncio.create_task(_never_finishes())
    await started.wait()

    await BrightDataMCPClient.close(client)

    assert client._session_init_task is None


@pytest.mark.asyncio
async def test_close_does_not_log_cross_task_cancel_scope_error(monkeypatch, caplog):
    monkeypatch.setenv("BRIGHTDATA_MCP_USE_HOSTED", "false")
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_MCP_WARM_SERVICE", "false")

    enter_task = None

    class _FakeTransportContext:
        async def __aenter__(self):
            nonlocal enter_task
            enter_task = asyncio.current_task()
            return ("stdio", "write")

        async def __aexit__(self, exc_type, exc, tb):
            if asyncio.current_task() is not enter_task:
                raise RuntimeError(
                    "Attempted to exit cancel scope in a different task than it was entered in"
                )
            return False

    class _FakeClientSession:
        def __init__(self, stdio, write):
            self.stdio = stdio
            self.write = write

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def initialize(self):
            return None

    monkeypatch.setattr(BrightDataMCPClient, "_resolve_hosted_mcp_url", lambda self: None)
    fake_fastmcp = ModuleType("fastmcp")
    fake_fastmcp.Client = lambda *args, **kwargs: SimpleNamespace(__aenter__=lambda: None, __aexit__=lambda *a, **k: False)

    fake_mcp = ModuleType("mcp")
    fake_mcp.ClientSession = _FakeClientSession
    fake_mcp.StdioServerParameters = lambda **kwargs: SimpleNamespace(**kwargs)

    fake_mcp_client = ModuleType("mcp.client")
    fake_mcp_client_stdio = ModuleType("mcp.client.stdio")
    fake_mcp_client_sse = ModuleType("mcp.client.sse")
    fake_mcp_client_stdio.stdio_client = lambda server_params: _FakeTransportContext()
    fake_mcp_client_sse.sse_client = lambda *args, **kwargs: None

    monkeypatch.setitem(sys.modules, "fastmcp", fake_fastmcp)
    monkeypatch.setitem(sys.modules, "mcp", fake_mcp)
    monkeypatch.setitem(sys.modules, "mcp.client", fake_mcp_client)
    monkeypatch.setitem(sys.modules, "mcp.client.stdio", fake_mcp_client_stdio)
    monkeypatch.setitem(sys.modules, "mcp.client.sse", fake_mcp_client_sse)

    client = BrightDataMCPClient(timeout=0.1)
    client._mcp_available = True

    with caplog.at_level(logging.WARNING):
        await client._ensure_session()
        await client.close()

    assert client.session is None
    assert client._transport_context is None
    assert "Attempted to exit cancel scope in a different task" not in caplog.text
    assert "Error closing MCP transport" not in caplog.text
