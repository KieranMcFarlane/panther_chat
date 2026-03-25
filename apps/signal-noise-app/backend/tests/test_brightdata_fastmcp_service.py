import asyncio
import importlib
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


@pytest.mark.asyncio
async def test_fastmcp_service_avoids_fallback_client(monkeypatch):
    service = importlib.import_module("brightdata_fastmcp_service")

    class PureMcpClient:
        def __init__(self, *args, **kwargs):
            self.prewarm_calls = []

        async def prewarm(self, timeout=None):
            self.prewarm_calls.append(timeout)
            return {"status": "success", "prewarmed": True, "timeout": timeout}

    monkeypatch.setattr(service, "_PIPELINE_CLIENT", None, raising=False)
    monkeypatch.setattr(service, "BrightDataMCPClient", PureMcpClient)
    assert not hasattr(service, "BrightDataClientWithFallback")

    client = await asyncio.wait_for(service._get_pipeline_client(), timeout=1.0)

    assert isinstance(client, PureMcpClient)
