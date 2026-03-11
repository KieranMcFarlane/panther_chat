import asyncio
import sys
import json
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
    discovery._resolved_url_context = {}

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        return {
            "status": "success",
            "results": [{
                "url": "https://www.ccfc.co.uk/",
                "title": "Coventry City FC Official Site",
                "snippet": "Official Coventry City FC website",
            }],
        }

    discovery._search_engine_with_timeout = fake_search_engine_with_timeout

    resolved = await discovery._resolve_official_site_url("Coventry City FC")
    assert resolved == "https://www.ccfc.co.uk/"
    assert discovery.current_official_site_url == "https://www.ccfc.co.uk/"
    assert discovery._resolved_url_context["https://www.ccfc.co.uk/"]["title"] == "Coventry City FC Official Site"
    assert discovery._resolved_url_context["https://www.ccfc.co.uk/"]["snippet"] == "Official Coventry City FC website"


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

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    discovery._resolve_official_site_url = fake_resolve_official_site_url
    discovery._get_cached_search = fake_get_cached_search
    discovery._cache_search_result = fake_cache_search_result
    discovery._search_engine_with_timeout = fake_search_engine_with_timeout

    state = SimpleNamespace(entity_name="Coventry City FC")
    hypothesis = SimpleNamespace()

    resolved = await discovery._get_url_for_hop(HopType.OFFICIAL_SITE, hypothesis, state)
    assert resolved is None
    # Official-site path should fail fast without burning retries on fallback queries.
    assert calls["search"] == 1


def test_normalize_http_url_adds_https_for_bare_domain():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    assert discovery._normalize_http_url("www.ccfc.co.uk") == "https://www.ccfc.co.uk"
    assert discovery._normalize_http_url("ccfc.co.uk") == "https://ccfc.co.uk"


def test_fallback_result_with_reason_uses_heuristic_keyword_signal():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = SimpleNamespace(
        keywords=["digital", "procurement"],
        early_indicators=["React developer job posting"],
    )

    result = discovery._fallback_result_with_reason(
        "Empty model response",
        content="Digital procurement programme launched for supplier onboarding.",
        hop_type=HopType.OFFICIAL_SITE,
        context=context,
    )

    assert result["decision"] == "WEAK_ACCEPT"
    assert result["confidence_delta"] > 0
    assert result["evidence_type"] == "heuristic_keyword_fallback"


def test_fallback_result_with_reason_detects_careers_terms_without_context_keywords():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = SimpleNamespace(
        keywords=[],
        early_indicators=[],
    )

    result = discovery._fallback_result_with_reason(
        "Empty model response",
        content="Current vacancies and careers opportunities are listed on this page.",
        hop_type=HopType.CAREERS_PAGE,
        context=context,
    )

    assert result["decision"] == "WEAK_ACCEPT"
    assert result["confidence_delta"] > 0


@pytest.mark.asyncio
async def test_resolve_official_site_url_uses_persistent_cache_before_search():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None
    discovery._official_site_url_cache = {"coventry city fc": "https://www.ccfc.co.uk"}

    async def _unexpected_search(*args, **kwargs):  # pragma: no cover - should never run
        raise AssertionError("search should not be called when cache has official URL")

    discovery._search_engine_with_timeout = _unexpected_search

    resolved = await discovery._resolve_official_site_url("Coventry City FC")
    assert resolved == "https://www.ccfc.co.uk"
    assert discovery.current_official_site_url == "https://www.ccfc.co.uk"


def test_store_cached_official_site_url_persists_to_disk(tmp_path, monkeypatch):
    cache_file = tmp_path / "official_site_cache.json"
    monkeypatch.setenv("DISCOVERY_OFFICIAL_SITE_CACHE_PATH", str(cache_file))

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._official_site_url_cache = {}

    discovery._store_cached_official_site_url("Coventry City FC", "www.ccfc.co.uk")

    assert cache_file.exists()
    payload = json.loads(cache_file.read_text())
    assert payload["coventry city fc"] == "https://www.ccfc.co.uk"


@pytest.mark.asyncio
async def test_execute_hop_increments_failure_counts_on_url_resolution_timeout():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_resolution_timeout_seconds = 0.01
    discovery._last_url_resolution_metrics = {}
    discovery.max_content_chars_for_evaluation = 2000
    discovery.total_cost_usd = 0.0

    async def _slow_get_url_for_hop(*_args, **_kwargs):
        await asyncio.sleep(0.2)
        return "https://example.com"

    discovery._get_url_for_hop = _slow_get_url_for_hop

    state = SimpleNamespace(
        current_depth=1,
        increment_depth_count=lambda _depth: None,
        hop_failure_counts={},
        last_failed_hop=None,
    )
    hypothesis = SimpleNamespace(metadata={})

    result = await discovery._execute_hop(HopType.OFFICIAL_SITE, hypothesis, state)

    assert result["decision"] == "NO_PROGRESS"
    assert state.hop_failure_counts.get("official_site") == 1
    assert state.last_failed_hop == "official_site"
