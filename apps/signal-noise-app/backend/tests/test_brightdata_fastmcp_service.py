import asyncio
import importlib
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


@pytest.mark.asyncio
async def test_fastmcp_service_uses_sdk_backend_by_default(monkeypatch):
    service = importlib.import_module("brightdata_fastmcp_service")

    class PureSdkClient:
        def __init__(self, *args, **kwargs):
            self.search_calls = []

        async def search_engine(self, *args, **kwargs):
            self.search_calls.append((args, kwargs))
            return {"status": "success", "results": []}

    monkeypatch.setattr(service, "_PIPELINE_CLIENT", None, raising=False)
    monkeypatch.setattr(service, "BrightDataSDKClient", PureSdkClient)
    monkeypatch.delenv("BRIGHTDATA_FASTMCP_BACKEND", raising=False)

    client = await asyncio.wait_for(service._get_pipeline_client(), timeout=1.0)

    assert isinstance(client, PureSdkClient)


@pytest.mark.asyncio
async def test_fastmcp_service_search_engine_ignores_cursor_for_sdk_backend(monkeypatch):
    service = importlib.import_module("brightdata_fastmcp_service")

    class PureSdkClient:
        async def search_engine(self, query, engine="google", country="us", num_results=10):
            return {
                "status": "success",
                "query": query,
                "engine": engine,
                "country": country,
                "num_results": num_results,
            }

    monkeypatch.setattr(service, "_PIPELINE_CLIENT", PureSdkClient(), raising=False)
    monkeypatch.setenv("BRIGHTDATA_FASTMCP_BACKEND", "sdk")

    result = await service.search_engine(
        query="Arsenal Football Club founded year",
        engine="google",
        country="us",
        num_results=5,
        cursor="ignored-cursor",
    )

    assert result["status"] == "success"
    assert result["num_results"] == 5
