import sys
from pathlib import Path

import httpx
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import http_client_pool as http_client_pool_module
from http_client_pool import HttpClientPool


@pytest.mark.asyncio
async def test_http_pool_reuses_async_client_and_closes_once(monkeypatch):
    calls = {"created": 0, "closed": 0}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            calls["created"] += 1

        async def aclose(self):
            calls["closed"] += 1

    monkeypatch.setattr(http_client_pool_module.httpx, "AsyncClient", FakeAsyncClient)

    pool = HttpClientPool()
    client_a = await pool.get_client(profile="brightdata_serp", timeout=30.0, follow_redirects=False)
    client_b = await pool.get_client(profile="brightdata_serp", timeout=30.0, follow_redirects=False)

    assert client_a is client_b
    assert calls["created"] == 1

    await pool.close()
    await pool.close()
    assert calls["closed"] == 1


@pytest.mark.asyncio
async def test_http_pool_applies_connect_read_pool_timeouts(monkeypatch):
    captured = {}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def aclose(self):
            return None

    monkeypatch.setattr(http_client_pool_module.httpx, "AsyncClient", FakeAsyncClient)

    timeout = httpx.Timeout(timeout=30.0, connect=5.0, read=15.0, write=10.0, pool=2.0)

    pool = HttpClientPool()
    await pool.get_client(profile="chutes_openai", timeout=timeout, follow_redirects=True)

    configured_timeout = captured["timeout"]
    assert isinstance(configured_timeout, httpx.Timeout)
    assert configured_timeout.connect == 5.0
    assert configured_timeout.read == 15.0
    assert configured_timeout.write == 10.0
    assert configured_timeout.pool == 2.0
    assert captured["follow_redirects"] is True
