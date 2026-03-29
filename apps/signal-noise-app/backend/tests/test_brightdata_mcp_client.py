import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

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

