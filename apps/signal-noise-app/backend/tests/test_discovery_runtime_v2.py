import pytest
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

try:
    from backend.discovery_runtime_v2 import DiscoveryRuntimeV2
except ImportError:
    from discovery_runtime_v2 import DiscoveryRuntimeV2


class _FakeClaude:
    async def query(self, **_kwargs):
        return {"content": '{"decision":"ACCEPT","reason":"mock"}'}


class _LaneChoosingClaude:
    async def query(self, **kwargs):
        prompt = str(kwargs.get("prompt") or "")
        if "key ordered_lanes" in prompt:
            return {"content": '{"ordered_lanes":["careers","official_site","trusted_news","press_release"]}'}
        return {"content": '{"decision":"NO_PROGRESS","reason":"mock"}'}


class _LengthStopClaude:
    async def query(self, **_kwargs):
        return {"content": '{"decision":"ACCEPT","reason":"truncated"}', "stop_reason": "length"}


class _CountingLengthStopClaude:
    def __init__(self):
        self.calls = 0

    async def query(self, **_kwargs):
        self.calls += 1
        return {"content": '{"decision":"ACCEPT","reason":"truncated"}', "stop_reason": "length"}


class _FakeBrightData:
    def __init__(self, *, results=None, content="", metadata=None):
        self._results = results or []
        self._content = content
        self._metadata = metadata or {}
        self.scrape_calls = 0

    async def search_engine(self, **_kwargs):
        return {"status": "success", "results": list(self._results)}

    async def scrape_as_markdown(self, _url):
        self.scrape_calls += 1
        return {
            "status": "success",
            "content": self._content,
            "metadata": dict(self._metadata),
        }


class _DomainSensitiveBrightData:
    def __init__(self):
        self.scrape_calls = 0

    async def search_engine(self, **_kwargs):
        return {
            "status": "success",
            "results": [
                {"url": "https://low-signal.example/news/a", "title": "Low A", "snippet": "thin"},
                {"url": "https://low-signal.example/news/b", "title": "Low B", "snippet": "thin"},
                {"url": "https://high-signal.example/press/c", "title": "High C", "snippet": "rich"},
            ],
        }

    async def scrape_as_markdown(self, url):
        self.scrape_calls += 1
        if "low-signal.example" in str(url):
            return {
                "status": "success",
                "content": "tiny",
                "metadata": {"low_signal_reason": "thin_low_signal_leaf"},
            }
        return {
            "status": "success",
            "content": "Coventry City FC digital commercial partnership procurement update " * 25,
            "metadata": {},
        }


class _GroundingFilterBrightData:
    def __init__(self):
        self.scraped_urls = []

    async def search_engine(self, **_kwargs):
        return {
            "status": "success",
            "results": [
                {"url": "https://example.com/random-procurement.pdf", "title": "Procurement document", "snippet": "supplier tender"},
                {
                    "url": "https://www.ccfc.co.uk/news/coventry-city-supplier-announcement",
                    "title": "Coventry City supplier announcement",
                    "snippet": "coventry city procurement supplier",
                },
            ],
        }

    async def scrape_as_markdown(self, url):
        self.scraped_urls.append(str(url))
        return {
            "status": "success",
            "content": "Coventry City FC supplier procurement partnership update " * 25,
            "metadata": {},
        }


@pytest.mark.asyncio
async def test_synthetic_origin_candidate_rejected():
    brightdata = _FakeBrightData()
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)

    async def _fake_candidates(**_kwargs):
        return [
            {
                "url": "https://example.com/procurement",
                "title": "Procurement",
                "snippet": "RFP details",
                "candidate_origin": "synthetic",
            }
        ]

    runtime._discover_candidates = _fake_candidates
    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }

    result = await runtime._run_lane(
        lane="rfp_procurement_tenders",
        entity_name="Arsenal FC",
        dossier={},
        official_domain="arsenal.com",
        state=state,
    )

    assert result["signal"] is None
    assert result["hop"]["dead_end_reason"] in {"no_eligible_candidate", "no_progress_repeated"}
    assert runtime._metrics["synthetic_url_attempt_count"] >= 1
    assert brightdata.scrape_calls == 0


@pytest.mark.asyncio
async def test_fallback_accept_blocked_when_evidence_guard_fails():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/press/club-announcement", "title": "News", "snippet": "Latest"}],
        content="Arsenal partnership and commercial transformation update with sufficient detail " * 15,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = True
    runtime._extract_evidence = lambda **_kwargs: {
        "snippet": "Arsenal confirmed a commercial technology partnership with named vendor and deployment timeline.",
        "content_item": "Arsenal confirmed a commercial technology partnership with named vendor and deployment timeline.",
        "quality_score": 0.92,
        "statement": "Arsenal partnership signal",
        "tokens": ["commercial", "technology", "partnership"],
    }

    # Force low-quality evidence so accept guard fails.
    runtime._extract_evidence = lambda **_kwargs: {
        "snippet": "",
        "content_item": "",
        "quality_score": 0.8,
        "statement": "mock",
        "tokens": [],
    }

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }
    result = await runtime._run_lane(
        lane="press_release",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
    )

    assert result["signal"] is None or result["signal"]["validation_state"] != "validated"
    assert runtime._metrics["fallback_accept_block_count"] >= 1


@pytest.mark.asyncio
async def test_no_progress_decision_never_promotes_to_validated(monkeypatch):
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/news", "title": "News", "snippet": "Latest"}],
        content="Arsenal announced partnership and technology updates with concrete details " * 20,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = True

    async def _forced_no_progress(**_kwargs):
        return {
            "decision": "NO_PROGRESS",
            "parse_path": "llm_json",
            "llm_last_status": "ok",
            "reason_code": "evidence_partial",
            "confidence_delta_bucket": "NONE",
            "model_used": "test-model",
            "schema_valid": True,
        }

    monkeypatch.setattr(runtime, "_maybe_llm_evaluate", _forced_no_progress)
    monkeypatch.setattr(runtime, "_is_evidence_grounded_in_content", lambda **_kwargs: True)

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }

    result = await runtime._run_lane(
        lane="press_release",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
    )

    signal = result["signal"]
    assert signal is not None
    assert signal["validation_state"] in {"candidate", "diagnostic"}
    assert signal["validation_state"] != "validated"
    assert signal["accept_guard_passed"] is False
    assert "llm_no_progress" in (signal.get("accept_reject_reasons") or [])


@pytest.mark.asyncio
async def test_no_progress_can_promote_when_evidence_guard_and_tier_are_strong(monkeypatch):
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.bbc.com/sport/football/teams/arsenal", "title": "BBC Arsenal", "snippet": "Arsenal commercial partnership update"}],
        content="Arsenal confirmed a commercial technology partnership with named vendor and deployment timeline. " * 25,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = True
    runtime._extract_evidence = lambda **_kwargs: {
        "snippet": "Arsenal confirmed a commercial technology partnership with named vendor and deployment timeline.",
        "content_item": "Arsenal confirmed a commercial technology partnership with named vendor and deployment timeline.",
        "quality_score": 0.92,
        "statement": "Arsenal partnership signal",
        "tokens": ["commercial", "technology", "partnership"],
    }

    async def _forced_no_progress(**_kwargs):
        return {
            "decision": "NO_PROGRESS",
            "parse_path": "llm_json",
            "llm_last_status": "ok",
            "reason_code": "evidence_partial",
            "confidence_delta_bucket": "NONE",
            "model_used": "test-model",
            "schema_valid": True,
        }

    monkeypatch.setattr(runtime, "_maybe_llm_evaluate", _forced_no_progress)
    monkeypatch.setattr(runtime, "_is_evidence_grounded_in_content", lambda **_kwargs: True)

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }

    result = await runtime._run_lane(
        lane="trusted_news",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
    )

    signal = result["signal"]
    assert signal is not None
    assert signal["source_tier"] == "tier_2"
    assert signal["accept_guard_passed"] is True
    assert signal["validation_state"] == "validated"
    assert "llm_no_progress" not in (signal.get("accept_reject_reasons") or [])
    assert result["hop"]["candidate_micro_eval"]["decision"] == "WEAK_ACCEPT_CANDIDATE"


@pytest.mark.asyncio
async def test_tier3_cannot_validate_without_corroboration():
    brightdata = _FakeBrightData(
        results=[
            {
                "url": "https://random-blog.example/arsenal-signals",
                "title": "Arsenal FC club digital procurement",
                "snippet": "arsenal fc supplier",
            }
        ],
        content="Arsenal procurement supplier digital platform partnership opportunity with evidence-rich details " * 25,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }
    result = await runtime._run_lane(
        lane="rfp_procurement_tenders",
        entity_name="Arsenal FC",
        dossier={},
        official_domain="arsenal.com",
        state=state,
    )

    signal = result["signal"] or result["diagnostic"]
    assert signal is not None
    assert signal["source_tier"] == "tier_3"
    assert signal["validation_state"] in {"candidate", "diagnostic"}
    assert signal["accept_guard_passed"] is False
    assert "tier3_without_corroboration" in (signal.get("accept_reject_reasons") or [])


@pytest.mark.asyncio
async def test_repeated_low_signal_exhausts_lane():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/news", "title": "Latest News", "snippet": "club updates"}],
        content="too short",
        metadata={"low_signal_reason": "thin_low_signal_leaf"},
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }

    await runtime._run_lane(
        lane="press_release",
        entity_name="Arsenal FC",
        dossier={},
        official_domain="arsenal.com",
        state=state,
    )
    second = await runtime._run_lane(
        lane="press_release",
        entity_name="Arsenal FC",
        dossier={},
        official_domain="arsenal.com",
        state=state,
    )

    assert "press_release" in state["lane_exhausted"]
    assert second["hop"]["lane_exhausted"] is True or second["hop"]["dead_end_reason"] in {
        "lane_already_exhausted",
        "no_progress_repeated",
    }


@pytest.mark.asyncio
async def test_rejected_low_signal_url_not_retried_across_lanes():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.ccfc.co.uk/news/vacancy", "title": "Vacancy", "snippet": "club update"}],
        content="",
        metadata={"low_signal_reason": "thin_low_signal_leaf"},
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "rejected_urls": set(),
        "iterations_completed": 0,
    }

    await runtime._run_lane(
        lane="press_release",
        entity_name="Coventry City FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.ccfc.co.uk"}}},
        official_domain="ccfc.co.uk",
        state=state,
    )
    await runtime._run_lane(
        lane="careers",
        entity_name="Coventry City FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.ccfc.co.uk"}}},
        official_domain="ccfc.co.uk",
        state=state,
    )

    assert brightdata.scrape_calls == 1


@pytest.mark.asyncio
async def test_rfp_pdf_objective_uses_pdf_first_lane_order():
    brightdata = _FakeBrightData(
        results=[{"url": "https://example.com/doc.pdf", "title": "Tender PDF", "snippet": "Procurement"}],
        content="procurement tender supplier bid document " * 40,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="fiba",
        entity_name="International Canoe Federation",
        dossier={},
        run_objective="rfp_pdf",
        max_iterations=3,
    )

    hop_lanes = [
        str(hop.get("hop_type") or "")
        for hop in ((result.performance_summary or {}).get("hop_timings") or [])
    ]
    assert hop_lanes
    assert hop_lanes[0] in {"governance_pdf", "annual_report", "rfp_procurement_tenders"}


@pytest.mark.asyncio
async def test_llm_eval_hard_fails_non_json_when_strict_schema_enabled():
    class _ProseClaude:
        async def query(self, **_kwargs):
            return {"content": "Decision: ACCEPT because looks good.", "stop_reason": "stop"}

    brightdata = _FakeBrightData(
        results=[{"url": "https://example.com/procurement", "title": "Procurement", "snippet": "RFP"}],
        content="procurement tender supplier bid document " * 40,
    )
    runtime = DiscoveryRuntimeV2(_ProseClaude(), brightdata)
    runtime.enable_llm_eval = True

    eval_result = await runtime._maybe_llm_evaluate(
        lane="rfp_procurement_tenders",
        entity_name="International Canoe Federation",
        url="https://example.com/procurement",
        evidence={"snippet": "procurement bid", "content_item": "procurement bid"},
    )
    assert eval_result["parse_path"] == "schema_gate_hard_fail"
    assert eval_result["decision"] == "NO_PROGRESS"


@pytest.mark.asyncio
async def test_llm_inference_can_reorder_hops_within_budget():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/news/example", "title": "News", "snippet": "signal"}],
        content="Arsenal partnership and commercial transformation update " * 30,
    )
    runtime = DiscoveryRuntimeV2(_LaneChoosingClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = True

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier={},
        run_objective="rfp_web",
        max_iterations=2,
    )

    selected = (((result.performance_summary or {}).get("two_pass") or {}).get("pass_a") or {}).get("selected_lanes") or []
    assert selected
    assert selected[0] == "careers"
    assert result.iterations_completed <= 2


@pytest.mark.asyncio
async def test_llm_eval_treats_length_stop_as_hard_fail_even_with_json_payload():
    brightdata = _FakeBrightData(
        results=[{"url": "https://example.com/rfp", "title": "RFP", "snippet": "procurement"}],
        content="procurement bid supplier opportunity " * 25,
    )
    runtime = DiscoveryRuntimeV2(_LengthStopClaude(), brightdata)
    runtime.enable_llm_eval = True

    eval_result = await runtime._maybe_llm_evaluate(
        lane="rfp_procurement_tenders",
        entity_name="International Canoe Federation",
        url="https://example.com/rfp",
        evidence={"snippet": "procurement bid", "content_item": "procurement bid"},
        run_objective="rfp_pdf",
    )
    assert eval_result["decision"] == "NO_PROGRESS"
    assert eval_result["parse_path"] == "length_stop_hard_fail"


@pytest.mark.asyncio
async def test_accept_guard_rejects_ungrounded_evidence_snippet():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/press/club-announcement", "title": "News", "snippet": "Latest"}],
        content="Arsenal partnership and commercial update with detailed evidence " * 20,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime._extract_evidence = lambda **_kwargs: {
        "snippet": "This sentence does not appear in source content",
        "content_item": "This sentence does not appear in source content",
        "quality_score": 0.95,
        "statement": "mock",
        "tokens": ["arsenal", "partnership"],
    }

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "iterations_completed": 0,
    }
    result = await runtime._run_lane(
        lane="press_release",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
    )

    signal = result["signal"] or result["diagnostic"]
    assert signal is not None
    assert signal["accept_guard_passed"] is False
    assert "evidence_not_grounded_in_source_content" in (signal.get("accept_reject_reasons") or [])


@pytest.mark.asyncio
async def test_llm_eval_opens_length_stop_circuit_and_short_circuits_next_calls():
    claude = _CountingLengthStopClaude()
    runtime = DiscoveryRuntimeV2(claude, _FakeBrightData())
    runtime.enable_llm_eval = True

    first = await runtime._maybe_llm_evaluate(
        lane="trusted_news",
        entity_name="Arsenal FC",
        url="https://example.com/one",
        evidence={"snippet": "signal", "content_item": "signal"},
        run_objective="rfp_web",
    )
    second = await runtime._maybe_llm_evaluate(
        lane="careers",
        entity_name="Arsenal FC",
        url="https://example.com/two",
        evidence={"snippet": "signal", "content_item": "signal"},
        run_objective="rfp_web",
    )
    third = await runtime._maybe_llm_evaluate(
        lane="press_release",
        entity_name="Arsenal FC",
        url="https://example.com/three",
        evidence={"snippet": "signal", "content_item": "signal"},
        run_objective="rfp_web",
    )

    assert first["parse_path"] == "length_stop_hard_fail"
    assert second["parse_path"] == "length_stop_hard_fail"
    assert third["parse_path"] == "llm_circuit_open"
    assert claude.calls == 2


@pytest.mark.asyncio
async def test_rfp_web_hop_cap_can_be_overridden_for_experiments(monkeypatch):
    monkeypatch.setenv("DISCOVERY_MAX_HOPS_OVERRIDE", "7")
    brightdata = _FakeBrightData(
        results=[{"url": "https://example.com/signal", "title": "Signal", "snippet": "procurement"}],
        content="procurement supplier partnership digital transformation evidence " * 40,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = False
    runtime.enable_agentic_router = False

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier={},
        run_objective="rfp_web",
        max_iterations=7,
    )
    summary = result.performance_summary or {}
    budget = summary.get("budget") or {}

    assert int(budget.get("max_hops") or 0) == 7
    assert result.iterations_completed <= 7


@pytest.mark.asyncio
async def test_discovery_result_exposes_candidate_micro_evaluations_contract():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/news/example", "title": "News", "snippet": "signal"}],
        content="Arsenal partnership and commercial transformation update " * 35,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = True
    runtime.enable_llm_hop_selection = False

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        run_objective="rfp_web",
        max_iterations=2,
    )
    candidate_evaluations = result.candidate_evaluations
    assert isinstance(candidate_evaluations, list)
    assert candidate_evaluations
    first = candidate_evaluations[0]
    assert first["step_type"] == "discovery_candidate_eval"
    assert "decision" in first
    assert "reason_code" in first
    assert "schema_valid" in first


@pytest.mark.asyncio
async def test_discovery_performance_summary_exposes_strict_eval_model_metrics():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/news/example", "title": "News", "snippet": "signal"}],
        content="Arsenal partnership and commercial transformation update " * 35,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = True
    runtime.enable_llm_hop_selection = False

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        run_objective="rfp_web",
        max_iterations=1,
    )

    summary = result.performance_summary or {}
    strict_metrics = summary.get("strict_eval_metrics_by_model") or {}
    assert isinstance(strict_metrics, dict)
    assert strict_metrics
    first_metrics = next(iter(strict_metrics.values()))
    assert "length_stop_count" in first_metrics
    assert "schema_fail_count" in first_metrics
    assert "empty_content_count" in first_metrics
    assert "median_eval_latency_ms" in first_metrics


@pytest.mark.asyncio
async def test_low_signal_domain_family_is_suppressed_across_attempts():
    brightdata = _DomainSensitiveBrightData()
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = False

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "rejected_urls": set(),
        "rejected_domain_families": {},
        "iterations_completed": 0,
    }

    await runtime._run_lane(
        lane="press_release",
        entity_name="Coventry City FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.ccfc.co.uk"}}},
        official_domain="ccfc.co.uk",
        state=state,
        run_objective="rfp_web",
    )
    await runtime._run_lane(
        lane="trusted_news",
        entity_name="Coventry City FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.ccfc.co.uk"}}},
        official_domain="ccfc.co.uk",
        state=state,
        run_objective="rfp_web",
    )

    # Low-signal family should be remembered and deprioritized/suppressed.
    assert int(state.get("rejected_domain_families", {}).get("low-signal.example", 0) or 0) >= 2


@pytest.mark.asyncio
async def test_off_entity_prefilter_rejects_unrelated_pdf_before_scrape():
    brightdata = _GroundingFilterBrightData()
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = False

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "rejected_urls": set(),
        "rejected_domain_families": {},
        "iterations_completed": 0,
    }

    lane_result = await runtime._run_lane(
        lane="rfp_procurement_tenders",
        entity_name="Coventry City FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.ccfc.co.uk"}}},
        official_domain="ccfc.co.uk",
        state=state,
        run_objective="rfp_web",
    )

    assert lane_result["signal"] is not None
    assert "ccfc.co.uk" in str((lane_result["signal"] or {}).get("url") or "")
    assert all("example.com/random-procurement.pdf" not in url for url in brightdata.scraped_urls)
    assert runtime._candidate_passes_entity_grounding(
        lane="rfp_procurement_tenders",
        candidate={"url": "https://example.com/random-procurement.pdf", "title": "Procurement document", "snippet": "supplier tender"},
        entity_name="Coventry City FC",
        official_domain="ccfc.co.uk",
    ) is False


@pytest.mark.asyncio
async def test_club_pdf_prefilter_rejects_city_council_context():
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    council_candidate = {
        "url": "https://edemocracy.coventry.gov.uk/documents/public-report.pdf",
        "title": "Coventry City Council report",
        "snippet": "coventry city procurement tender",
    }
    club_candidate = {
        "url": "https://www.ccfc.co.uk/club/coventry-city-football-club-procurement",
        "title": "Coventry City Football Club procurement",
        "snippet": "coventry city fc procurement",
    }
    assert runtime._candidate_passes_entity_grounding(
        lane="governance_pdf",
        candidate=council_candidate,
        entity_name="Coventry City FC",
        official_domain="ccfc.co.uk",
    ) is False
    assert runtime._candidate_passes_entity_grounding(
        lane="governance_pdf",
        candidate=club_candidate,
        entity_name="Coventry City FC",
        official_domain="ccfc.co.uk",
    ) is True


@pytest.mark.asyncio
async def test_schema_invalid_length_stop_demotes_validated_to_candidate():
    brightdata = _FakeBrightData(
        results=[{"url": "https://www.arsenal.com/news/procurement-update", "title": "Arsenal FC procurement update", "snippet": "arsenal fc supplier procurement"}],
        content="Arsenal FC football club procurement supplier commercial partnership update " * 35,
    )
    runtime = DiscoveryRuntimeV2(_LengthStopClaude(), brightdata)
    runtime.enable_llm_eval = True
    runtime.enable_llm_hop_selection = False

    state = {
        "visited_urls": set(),
        "visited_hashes": set(),
        "accepted_signatures": set(),
        "domain_visits": {},
        "lane_failures": {},
        "lane_exhausted": set(),
        "trusted_corroboration_tokens": set(),
        "rejected_urls": set(),
        "rejected_domain_families": {},
        "iterations_completed": 0,
    }
    result = await runtime._run_lane(
        lane="rfp_procurement_tenders",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
        run_objective="rfp_web",
    )
    signal = result["signal"] or result["diagnostic"]
    assert signal is not None
    assert signal["validation_state"] == "candidate"
    assert signal["accept_guard_passed"] is False
    assert "llm_schema_invalid_demoted" in list(signal.get("accept_reject_reasons") or [])


@pytest.mark.asyncio
async def test_pass_b_executes_with_candidate_signals_when_no_validated_signals():
    brightdata = _FakeBrightData(
        results=[{"url": "https://random-blog.example/post", "title": "Market update", "snippet": "commercial"}],
        content="International Canoe Federation commercial partnership digital supplier update " * 30,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = False

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="fiba",
        entity_name="International Canoe Federation",
        dossier={},
        run_objective="rfp_web",
        max_iterations=5,
    )
    two_pass = (result.performance_summary or {}).get("two_pass") or {}
    assert two_pass.get("pass_b_executed") is True
    assert int((result.performance_summary or {}).get("candidate_signals_count") or 0) >= 1


@pytest.mark.asyncio
async def test_candidate_mode_extends_budget_when_early_progress_is_only_candidates():
    brightdata = _FakeBrightData(
        results=[{"url": "https://random-blog.example/procurement", "title": "Procurement", "snippet": "rfp"}],
        content="International Canoe Federation procurement tender digital transformation supplier " * 35,
    )
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = False

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="fiba",
        entity_name="International Canoe Federation",
        dossier={},
        run_objective="rfp_web",
        max_iterations=5,
    )
    summary = result.performance_summary or {}
    budget = summary.get("budget") or {}
    assert summary.get("adaptive_candidate_mode_applied") is True
    assert int(budget.get("max_hops") or 0) >= 7
