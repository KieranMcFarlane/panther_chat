import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType


@pytest.mark.asyncio
async def test_resolve_official_site_url_caches_discovered_url():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        return {
            "status": "success",
            "results": [{"url": "https://www.ccfc.co.uk/"}],
        }

    discovery._search_engine_with_timeout = fake_search_engine_with_timeout

    resolved = await discovery._resolve_official_site_url("Coventry City FC")
    assert resolved == "https://www.ccfc.co.uk/"
    assert discovery.current_official_site_url == "https://www.ccfc.co.uk/"


@pytest.mark.asyncio
async def test_official_site_hop_skips_fallback_query_loop_on_primary_failure():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None
    discovery.url_resolution_timeout_seconds = 12
    discovery._last_url_resolution_metrics = {}

    calls = {"search": 0}

    async def fake_resolve_official_site_url(_entity_name):
        return None

    async def fake_get_cached_search(_query, _engine):
        return None

    async def fake_cache_search_result(_query, _engine, _result):
        return None

    async def fake_search_engine(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    discovery._resolve_official_site_url = fake_resolve_official_site_url
    discovery._get_cached_search = fake_get_cached_search
    discovery._cache_search_result = fake_cache_search_result
    discovery.brightdata_client = SimpleNamespace(search_engine=fake_search_engine)

    state = SimpleNamespace(entity_name="Coventry City FC")
    hypothesis = SimpleNamespace()

    resolved = await discovery._get_url_for_hop(HopType.OFFICIAL_SITE, hypothesis, state)
    assert resolved is None
    # Official-site path should fail fast without burning retries on fallback queries.
    assert calls["search"] == 1
    assert discovery._last_url_resolution_metrics.get("fallback_queries_tried") == 0
