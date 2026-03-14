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
    discovery.official_site_resolution_engines = ["google", "bing"]
    discovery.official_site_resolution_num_results = 2

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        assert num_results == 2
        if engine == "google":
            return {
                "status": "success",
                "results": [{
                    "url": "https://shop.ccfc.co.uk/",
                    "title": "Coventry City FC Official Store",
                    "snippet": "Official Coventry City FC store",
                }],
            }
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
async def test_single_pass_mode_caps_fallback_query_attempts(monkeypatch):
    monkeypatch.setenv("DISCOVERY_RUN_MODE", "single_pass")
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None
    discovery.url_resolution_max_fallback_queries = 4
    discovery.url_resolution_max_fallback_queries_single_pass = 1
    discovery.url_resolution_max_site_specific_queries = 6
    discovery.url_resolution_max_site_specific_queries_single_pass = 2
    discovery._last_url_resolution_metrics = {}

    calls = {"search": 0}

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    async def fake_get_cached_search(_query, _engine):
        return None

    async def fake_cache_search_result(_query, _engine, _result):
        return None

    discovery._search_engine_with_timeout = fake_search_engine_with_timeout
    discovery._get_cached_search = fake_get_cached_search
    discovery._cache_search_result = fake_cache_search_result

    state = SimpleNamespace(entity_name="Coventry City FC")
    hypothesis = SimpleNamespace()
    resolved = await discovery._get_url_for_hop(HopType.CAREERS_PAGE, hypothesis, state)

    assert resolved is None
    # Single-pass mode should cap fallback exploration to one query.
    assert discovery._last_url_resolution_metrics.get("fallback_queries_tried") == 1
    assert calls["search"] >= 2


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
async def test_initialize_from_dossier_registers_hypotheses_with_manager_and_dedupes_ids():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._dossier_hypotheses_cache = {}

    class _HypothesisManagerStub:
        def __init__(self):
            self.calls = []

        async def register_hypotheses(self, entity_id, hypotheses, persist=False):
            self.calls.append((entity_id, hypotheses, persist))

    manager = _HypothesisManagerStub()
    discovery.hypothesis_manager = manager

    dossier_hypotheses = [
        {
            "statement": "Potential procurement opportunity for CRM.",
            "category": "procurement_opportunity",
            "confidence": 0.55,
            "signal_type": "RFP_SIGNAL",
            "pattern": "procurement_pattern",
        },
        {
            "statement": "Potential procurement opportunity for CRM duplicate.",
            "category": "procurement_opportunity",
            "confidence": 0.65,
            "signal_type": "RFP_SIGNAL",
            "pattern": "procurement_pattern",
        },
    ]

    added = await discovery.initialize_from_dossier("coventry-city-fc", dossier_hypotheses)
    assert added == 2
    assert "coventry-city-fc" in discovery._dossier_hypotheses_cache
    cached = discovery._dossier_hypotheses_cache["coventry-city-fc"]
    assert len(cached) == 1
    assert cached[0].confidence == pytest.approx(0.65, rel=1e-6)

    assert len(manager.calls) == 1
    call_entity_id, call_hypotheses, call_persist = manager.calls[0]
    assert call_entity_id == "coventry-city-fc"
    assert call_persist is False
    assert len(call_hypotheses) == 1


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


@pytest.mark.asyncio
async def test_try_site_specific_search_respects_max_queries():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    calls = {"search": 0}

    async def fake_resolve_official_site_url(_entity_name):
        return "https://www.ccfc.co.uk/"

    async def fake_try_direct_site_paths(_official_url, _hop_type):
        return None

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    discovery._resolve_official_site_url = fake_resolve_official_site_url
    discovery._try_direct_site_paths = fake_try_direct_site_paths
    discovery._search_engine_with_timeout = fake_search_engine_with_timeout
    discovery.current_entity_type = "SPORT_CLUB"

    result = await discovery._try_site_specific_search(
        "Coventry City FC",
        HopType.RFP_PAGE,
        max_queries=2,
    )
    assert result is None
    assert calls["search"] == 2


@pytest.mark.asyncio
async def test_run_discovery_resets_official_site_context_between_entities():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = "https://www.ccfc.co.uk/"
    discovery._resolved_url_context = {"https://www.ccfc.co.uk/": {"title": "Coventry"}}
    discovery.max_iterations = 1
    discovery.max_depth = 1
    discovery.max_cost_per_entity = 2.0
    discovery.current_entity_type = None
    discovery._llm_runtime_diagnostics = {}

    class _HypothesisManagerStub:
        async def initialize_hypotheses(self, **_kwargs):
            return [SimpleNamespace(status="ACTIVE", expected_information_gain=0.5)]

    async def fake_run_discovery_iterations(state, hypotheses, **_kwargs):
        return {"ok": True, "entity": state.entity_name, "hypothesis_count": len(hypotheses)}

    discovery.hypothesis_manager = _HypothesisManagerStub()
    discovery._run_discovery_iterations = fake_run_discovery_iterations
    discovery._extract_entity_type_from_template = lambda _template_id: "SPORT_CLUB"

    result = await discovery.run_discovery(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        template_id="yellow_panther_agency",
        max_iterations=1,
        max_depth=1,
    )

    assert result["ok"] is True
    assert discovery.current_official_site_url is None
    assert discovery._resolved_url_context == {}


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
        "run_profile": "test",
        "run_mode": "single_pass",
    }

    state = SimpleNamespace(iteration_results=[])

    summary = discovery._build_performance_summary(state, total_duration_ms=12.3)

    assert summary["llm_provider"] == "chutes_openai"
    assert summary["llm_retry_attempts"] == 3
    assert summary["llm_last_status"] == "quota_exhausted"
    assert summary["llm_circuit_broken"] is True
    assert summary["llm_disable_reason"] == "insufficient balance"
    assert summary["evaluation_mode"] == "heuristic"
    assert summary["run_profile"] == "test"
    assert summary["run_mode"] == "single_pass"
    assert "field_statuses" in summary
    assert "claims_count" in summary
    assert "verified_fields_count" in summary


def test_failure_result_includes_schema_first_metrics_defaults():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    result = discovery._build_failure_result("entity-1", "Entity One", "failed")
    result_dict = result.to_dict()
    assert result_dict["field_statuses"] == {}
    assert result_dict["claims_count"] == 0
    assert result_dict["verified_fields_count"] == 0


def test_record_schema_first_claim_from_iteration_populates_metrics_on_success():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    state = SimpleNamespace(entity_id="entity-1", iterations_completed=1)
    hypothesis = SimpleNamespace(
        hypothesis_id="entity-1_hypothesis",
        statement="Entity is recruiting for digital procurement roles",
        confidence=0.62,
    )
    result = {
        "decision": "WEAK_ACCEPT",
        "url": "https://example.com/careers",
        "evidence_found": "Careers page lists digital procurement manager role.",
    }

    discovery._record_schema_first_claim_from_iteration(
        state=state,
        hypothesis=hypothesis,
        hop_type=HopType.CAREERS_PAGE,
        result=result,
    )
    metrics = discovery._schema_first_metrics()
    assert metrics["claims_count"] == 1
    assert metrics["verified_fields_count"] == 1
    assert metrics["field_statuses"]["contact_information"] == "verified"


def test_choose_schema_first_hop_prioritizes_lowest_attempt_pending_field():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._initialize_schema_first_runtime()
    discovery._active_schema_fields = ["core_information", "recent_news"]
    discovery._active_field_planner.record_attempt("core_information", success=False)

    state = SimpleNamespace(hop_failure_counts={})
    hop = discovery._choose_schema_first_hop(state)
    assert hop == HopType.PRESS_RELEASE


def test_choose_schema_first_hop_skips_official_site_when_diversification_forced():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._initialize_schema_first_runtime()
    discovery._active_schema_fields = ["core_information"]

    state = SimpleNamespace(hop_failure_counts={}, force_non_official_next_hop=True)
    hop = discovery._choose_schema_first_hop(state)
    assert hop == HopType.ANNUAL_REPORT


def test_parse_evaluation_response_json_extracts_fenced_json_block():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    response_text = """
I evaluated the page.

```json
{
  "decision": "WEAK_ACCEPT",
  "confidence_delta": 0.06,
  "justification": "evidence found",
  "evidence_found": "procurement tender",
  "evidence_type": "PROCUREMENT_SIGNAL",
  "temporal_score": "recent_12mo"
}
```
"""
    parsed = discovery._parse_evaluation_response_json(response_text)
    assert parsed is not None
    assert parsed["decision"] == "WEAK_ACCEPT"
    assert parsed["confidence_delta"] == 0.06
    assert discovery._last_parse_path in {"json_direct", "json_fenced"}


def test_parse_evaluation_response_json_salvages_prose_and_trailing_comma():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    response_text = """
Let me analyze this page and provide structured output.
{
  "decision": "NO_PROGRESS",
  "confidence_delta": 0.0,
  "justification": "No relevant procurement signals found.",
  "evidence_found": "",
  "evidence_type": "none",
  "temporal_score": "unknown",
}
Additional explanation that should be ignored.
"""
    parsed = discovery._parse_evaluation_response_json(response_text)
    assert parsed is not None
    assert parsed["decision"] == "NO_PROGRESS"
    assert parsed["temporal_score"] == "unknown"
    assert discovery._last_parse_path == "json_salvaged"


@pytest.mark.asyncio
async def test_evaluate_content_requests_json_mode_and_parses_embedded_json():
    class _ClaudeStub:
        provider = "chutes_openai"

        def __init__(self):
            self.last_kwargs = None

        async def query(self, **kwargs):
            self.last_kwargs = kwargs
            return {
                "content": 'Analysis done. {"decision":"ACCEPT","confidence_delta":0.12,"justification":"Clear tender","evidence_found":"Procurement tender launched","evidence_type":"PROCUREMENT_SIGNAL","temporal_score":"recent_12mo"}',
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    claude_stub = _ClaudeStub()
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = claude_stub
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448

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

    assert claude_stub.last_kwargs is not None
    assert claude_stub.last_kwargs.get("json_mode") is True
    assert result["decision"] == "ACCEPT"
    assert result["evaluation_mode"] == "llm"
    assert result["parse_path"] == "json_direct"


@pytest.mark.asyncio
async def test_evaluate_content_recovers_partial_json_decision():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": '{"decision":"ACCEPT","confidence_delta":0.08,"justification":"truncated',
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448

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
        content="The club has launched a procurement tender.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["decision"] == "ACCEPT"
    assert result["confidence_delta"] == 0.08
    assert result["evaluation_mode"] == "llm"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_salvages_truncated_json_before_fallback():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": (
                    "Quick assessment:\n"
                    "{\n"
                    "  \"decision\": \"NO_PROGRESS\",\n"
                    "  \"confidence_delta\": 0.0,\n"
                    "  \"justification\": \"No procurement evidence in this sports news content.\",\n"
                    "  \"evidence_found\": \"\",\n"
                    "  \"evidence_type\": \"none\",\n"
                    "  \"temporal_score\": \"unknown\",\n"
                ),
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Fixture list and score updates for home and away matches.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "llm"
    assert result["decision"] == "NO_PROGRESS"
    assert result["parse_path"] == "json_salvaged"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_recovers_decision_from_hard_truncated_json_prefix():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": '{"decision":"NO_PROGRESS","confidence_delta":',
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Fixture list and score updates for home and away matches.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "llm"
    assert result["decision"] == "NO_PROGRESS"
    assert result["parse_path"] == "json_truncated_recovered"
    assert result["llm_last_status"] == "strict_truncated_json_recovered"


@pytest.mark.asyncio
async def test_evaluate_content_recovers_decision_from_narrative_heading():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": "Decision: ACCEPT\\nThe content clearly shows active procurement tender activity.",
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448

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
        content="The club has launched a procurement tender.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["decision"] == "ACCEPT"
    assert result["evaluation_mode"] == "llm"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_avoids_narrative_recovery():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": "Decision: ACCEPT\nThe content appears to show progress.",
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Fixture list and score updates for home and away matches.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "heuristic"
    assert result["parse_path"] == "heuristic_fallback"
    assert result["llm_last_status"] == "strict_json_enforced"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_recovers_structured_key_value_payload():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": (
                    "decision: WEAK_ACCEPT\n"
                    "confidence_delta: 0.08\n"
                    "justification: Multiple dated procurement-related signals were observed.\n"
                    "evidence_found: RFP timeline and vendor onboarding language.\n"
                    "evidence_type: PROCUREMENT_SIGNAL\n"
                    "temporal_score: recent_12mo"
                ),
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Dated procurement and vendor process snippets.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "llm"
    assert result["decision"] == "WEAK_ACCEPT"
    assert result["parse_path"] == "key_value_recovered"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_recovers_partial_key_value_payload_with_defaults():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": (
                    "decision: NO_PROGRESS\n"
                    "confidence_delta: 0.0\n"
                    "justification: Content is mostly score updates and no procurement indicators."
                ),
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Fixture list and score updates for home and away matches.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "llm"
    assert result["decision"] == "NO_PROGRESS"
    assert result["parse_path"] == "key_value_recovered"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_recovers_no_progress_from_narrative_markers():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": (
                    "This appears to be mostly navigation and promotional content. "
                    "No relevant evidence of procurement activity was found in this page."
                ),
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Fixture list and score updates for home and away matches.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "llm"
    assert result["decision"] == "NO_PROGRESS"
    assert result["parse_path"] == "text_no_progress_recovered"
    assert result["llm_last_status"] == "strict_text_no_progress_recovered"


@pytest.mark.asyncio
async def test_evaluate_content_strict_json_mode_recovers_no_progress_from_not_found_checklist():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": (
                    "Let me analyze this content against the hypothesis.\n\n"
                    "Looking for indicators:\n"
                    "- Python developer job: NOT FOUND\n"
                    "- Data engineer hiring: NOT FOUND\n"
                    "- Analytics platform development: NOT FOUND\n"
                    "- Data processing pipeline: NOT FOUND\n"
                    "- Python data project: NOT FOUND\n"
                ),
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True
    discovery.strict_evaluator_json_response = True

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
        content="Fixture list and score updates for home and away matches.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["evaluation_mode"] == "llm"
    assert result["decision"] == "NO_PROGRESS"
    assert result["parse_path"] == "text_no_progress_recovered"
    assert result["llm_last_status"] == "strict_text_no_progress_recovered"


@pytest.mark.asyncio
async def test_evaluate_content_recovers_no_progress_from_narrative_text():
    class _ClaudeStub:
        provider = "chutes_openai"

        async def query(self, **kwargs):
            return {
                "content": "This is just script data and does not indicate procurement activity. No relevant evidence found.",
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448

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
        content="Script data: ...",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert result["decision"] == "NO_PROGRESS"
    assert result["evaluation_mode"] == "llm"


@pytest.mark.asyncio
async def test_evaluate_content_uses_json_repair_pass_for_unparseable_response():
    class _ClaudeStub:
        provider = "chutes_openai"

        def __init__(self):
            self.calls = 0

        async def query(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return {
                    "content": "Narrative only. This appears to indicate procurement progress but not in JSON.",
                    "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
                }
            return {
                "content": '{"decision":"WEAK_ACCEPT","confidence_delta":0.05,"justification":"repair","evidence_found":"signal","evidence_type":"PROCUREMENT_SIGNAL","temporal_score":"recent_12mo"}',
                "inference_diagnostics": {"llm_retry_attempts": 0, "llm_last_status": "ok"},
            }

    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.claude_client = _ClaudeStub()
    discovery.heuristic_fallback_on_llm_unavailable = True
    discovery.evaluation_max_tokens_default = 640
    discovery.evaluation_max_tokens_press_release = 384
    discovery.evaluation_max_tokens_official_site = 384
    discovery.evaluation_max_tokens_careers_annual_report = 448
    discovery.evaluation_json_repair_attempt = True

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
        content="Some noisy site copy with weak structure.",
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={"content_type": "text/html"},
    )

    assert discovery.claude_client.calls == 2
    assert result["decision"] == "WEAK_ACCEPT"
    assert result["evaluation_mode"] == "llm"


def test_assess_low_yield_content_detects_script_heavy_page():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.content_min_text_chars = 240
    discovery.content_max_script_density = 0.12
    discovery.content_min_keyword_sentences = 1
    reason = discovery._assess_low_yield_content(
        content_text="window.__DATA__ = {};\nvar x=1;\n",
        raw_html="<html><script>one</script><script>two</script><script>three</script><p>x</p></html>",
        hypothesis_category="procurement",
    )
    assert isinstance(reason, str)
    assert "script_density" in reason or "text_chars" in reason


def test_assess_low_yield_content_skips_keyword_gate_for_unknown_category():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.content_min_text_chars = 240
    discovery.content_max_script_density = 0.12
    discovery.content_min_keyword_sentences = 1

    long_text = "Arsenal official club news and fixtures. " * 40
    reason = discovery._assess_low_yield_content(
        content_text=long_text,
        raw_html="<html><body><p>Arsenal official club news and fixtures.</p></body></html>",
        hypothesis_category="ui/ux_design_project",
    )

    assert reason is None


def test_assess_low_yield_content_skips_keyword_gate_for_long_procurement_page():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.content_min_text_chars = 240
    discovery.content_max_script_density = 0.12
    discovery.content_min_keyword_sentences = 1

    long_text = ("Arsenal official site navigation and fixtures content. " * 200).strip()
    reason = discovery._assess_low_yield_content(
        content_text=long_text,
        raw_html="<html><body><p>Arsenal official site navigation and fixtures content.</p></body></html>",
        hypothesis_category="procurement",
    )

    assert reason is None


def test_extract_deterministic_trusted_signal_detects_press_language():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    signal = discovery._extract_deterministic_trusted_signal(
        content_text="Official announcement: strategic partnership signed with supplier for platform rollout.",
        hop_type=HopType.PRESS_RELEASE,
    )
    assert signal is not None
    assert signal["evidence_type"] == "deterministic_trusted_source_signal"


def test_extract_deterministic_trusted_signal_detects_careers_language():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    signal = discovery._extract_deterministic_trusted_signal(
        content_text="Careers at Example Club\\nOpen vacancies\\nCommercial Manager\\nApply now",
        hop_type=HopType.CAREERS_PAGE,
    )
    assert signal is not None
    assert signal["evidence_type"] == "deterministic_careers_signal"
