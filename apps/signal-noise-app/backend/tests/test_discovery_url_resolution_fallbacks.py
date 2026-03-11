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


@pytest.mark.asyncio
async def test_rfp_hop_prefers_direct_site_path_before_primary_search():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = "https://www.ccfc.co.uk/"
    discovery._last_url_resolution_metrics = {}

    calls = {"search": 0}

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    async def fake_get_cached_search(_query, _engine):
        return None

    async def fake_resolve_official_site_url(_entity_name):
        return "https://www.ccfc.co.uk/"

    async def fake_try_direct_site_paths(_official_url, hop_type):
        assert hop_type == HopType.RFP_PAGE
        return "https://www.ccfc.co.uk/procurement"

    discovery._search_engine_with_timeout = fake_search_engine_with_timeout
    discovery._get_cached_search = fake_get_cached_search
    discovery._resolve_official_site_url = fake_resolve_official_site_url
    discovery._try_direct_site_paths = fake_try_direct_site_paths

    state = SimpleNamespace(entity_name="Coventry City FC")
    hypothesis = SimpleNamespace()

    resolved = await discovery._get_url_for_hop(HopType.RFP_PAGE, hypothesis, state)
    assert resolved == "https://www.ccfc.co.uk/procurement"
    assert calls["search"] == 0


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


@pytest.mark.asyncio
async def test_resolve_official_site_url_uses_mapped_domain_before_search():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None
    discovery._official_site_url_cache = {}
    discovery._official_site_domain_map = {
        "coventry city football club": "https://www.ccfc.co.uk"
    }
    discovery._official_site_resolution_failures = {}
    discovery.official_site_resolution_cooldown_seconds = 180.0

    async def _unexpected_search(*args, **kwargs):  # pragma: no cover - should never run
        raise AssertionError("search should not be called when mapped URL exists")

    discovery._search_engine_with_timeout = _unexpected_search

    resolved = await discovery._resolve_official_site_url("Coventry City FC")
    assert resolved == "https://www.ccfc.co.uk"
    assert discovery.current_official_site_url == "https://www.ccfc.co.uk"


def test_get_cached_official_site_url_reuses_alias_signature():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._official_site_url_cache = {
        "coventry city football club": "https://www.ccfc.co.uk",
    }

    resolved = discovery._get_cached_official_site_url("Coventry City FC")
    assert resolved == "https://www.ccfc.co.uk"


@pytest.mark.asyncio
async def test_resolve_official_site_url_uses_cooldown_after_search_failure():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None
    discovery._official_site_url_cache = {}
    discovery._official_site_domain_map = {}
    discovery._official_site_resolution_failures = {}
    discovery.official_site_resolution_cooldown_seconds = 180.0

    calls = {"search": 0}

    async def _failing_search(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    discovery._search_engine_with_timeout = _failing_search

    first = await discovery._resolve_official_site_url("Coventry City FC")
    second = await discovery._resolve_official_site_url("Coventry City FC")

    assert first is None
    assert second is None
    assert calls["search"] == 1


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


@pytest.mark.asyncio
async def test_execute_hop_increments_failure_counts_on_scrape_failure():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_resolution_timeout_seconds = 1.0
    discovery._last_url_resolution_metrics = {}
    discovery._resolved_url_context = {}
    discovery.total_cost_usd = 0.0
    discovery.max_content_chars_for_evaluation = 2000
    discovery.pdf_extractor = None

    async def _get_url_for_hop(*_args, **_kwargs):
        return "https://www.ccfc.co.uk/"

    class _FailingBrightDataClient:
        async def scrape_as_markdown(self, _url):
            return {"status": "error", "error": "timeout"}

    discovery._get_url_for_hop = _get_url_for_hop
    discovery.brightdata_client = _FailingBrightDataClient()

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


def test_derive_signals_from_dossier_sections_extracts_procurement_and_capability():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    dossier = {
        "sections": [
            {
                "title": "Digital transformation",
                "confidence": 72,
                "insights": [
                    "The club is evaluating a CRM and data analytics stack upgrade this season."
                ],
                "recommendations": [
                    "Run a structured procurement tender for supplier onboarding and integration."
                ],
            }
        ]
    }

    procurement, capabilities = discovery._derive_signals_from_dossier_sections(dossier)
    assert procurement
    assert capabilities
    assert procurement[0]["type"] == "[PROCUREMENT]"
    assert capabilities[0]["type"] == "[CAPABILITY]"


@pytest.mark.asyncio
async def test_evaluate_content_uses_heuristic_mode_when_llm_is_circuit_broken():
    class _ClaudeDisabledStub:
        provider = "chutes_openai"

        @staticmethod
        def _get_disabled_reason():
            return "insufficient balance"

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeDisabledStub()
    discovery.heuristic_fallback_on_llm_unavailable = True

    hypothesis = SimpleNamespace(
        statement="Coventry City FC is actively running procurement",
        category="procurement",
        metadata={"entity_name": "Coventry City FC", "template_id": ""},
        prior_probability=0.5,
        confidence=0.5,
        iterations_attempted=0,
        iterations_accepted=0,
        iterations_weak_accept=0,
        iterations_rejected=0,
        iterations_no_progress=0,
        last_delta=0.0,
    )

    result = await discovery._evaluate_content_with_claude(
        content="The club has launched a procurement tender and supplier onboarding process.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["decision"] == "WEAK_ACCEPT"
    assert result["evaluation_mode"] == "heuristic"
    assert result["llm_disable_reason"] == "insufficient balance"


def test_performance_summary_includes_llm_runtime_diagnostics():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._llm_runtime_diagnostics = {
        "llm_provider": "chutes_openai",
        "llm_retry_attempts": 3,
        "llm_last_status": "quota_exhausted",
        "llm_circuit_broken": True,
        "llm_disable_reason": "insufficient balance",
        "evaluation_mode": "heuristic",
    }

    state = SimpleNamespace(iteration_results=[])

    summary = discovery._build_performance_summary(state, total_duration_ms=12.3)

    assert summary["llm_provider"] == "chutes_openai"
    assert summary["llm_retry_attempts"] == 3
    assert summary["llm_last_status"] == "quota_exhausted"
    assert summary["llm_circuit_broken"] is True
    assert summary["llm_disable_reason"] == "insufficient balance"
    assert summary["evaluation_mode"] == "heuristic"
