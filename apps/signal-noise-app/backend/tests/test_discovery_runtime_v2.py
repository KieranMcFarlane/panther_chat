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


class _CandidateChoosingClaude:
    async def query(self, **kwargs):
        prompt = str(kwargs.get("prompt") or "")
        if "Candidate batch:" in prompt:
            return {
                "content": (
                    '{"action":"scrape_candidate","lane":"trusted_news","candidate_index":1,'
                    '"reason":"strongest candidate in batch"}'
                )
            }
        if "key ordered_lanes" in prompt:
            return {"content": '{"ordered_lanes":["trusted_news","press_release","careers","official_site"]}'}
        return {"content": '{"decision":"NO_PROGRESS","reason":"mock"}'}


class _FarCandidateChoosingClaude:
    async def query(self, **kwargs):
        prompt = str(kwargs.get("prompt") or "")
        if "Candidate batch:" in prompt:
            return {
                "content": (
                    '{"action":"scrape_candidate","lane":"trusted_news","candidate_index":2,'
                    '"reason":"lift lower-ranked candidate into eval window"}'
                )
            }
        return {"content": '{"decision":"NO_PROGRESS","reason":"mock"}'}


class _PdfChoosingClaude:
    async def query(self, **kwargs):
        prompt = str(kwargs.get("prompt") or "")
        if "Candidate batch:" in prompt:
            return {
                "content": (
                    '{"action":"scrape_candidate","lane":"rfp_procurement_tenders","candidate_index":0,'
                    '"reason":"try the pdf candidate"}'
                )
            }
        return {"content": '{"decision":"NO_PROGRESS","reason":"mock"}'}


class _SameDomainProbeClaude:
    async def query(self, **kwargs):
        prompt = str(kwargs.get("prompt") or "")
        if "Candidate batch:" in prompt:
            return {
                "content": (
                    '{"action":"same_domain_probe","lane":"official_site",'
                    '"url":"https://www.ccfc.co.uk/matches",'
                    '"reason":"probe a stronger same-domain section"}'
                )
            }
        return {"content": '{"decision":"NO_PROGRESS","reason":"mock"}'}


class _RecordingClaude:
    def __init__(self):
        self.last_prompt = ""

    async def query(self, **kwargs):
        self.last_prompt = str(kwargs.get("prompt") or "")
        return {"content": '{"decision":"NO_PROGRESS","reason_code":"low_signal","confidence_delta_bucket":"NONE"}'}


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


class _CandidateOrderBrightData:
    def __init__(self):
        self.scraped_urls = []

    async def search_engine(self, **_kwargs):
        return {"status": "success", "results": []}

    async def scrape_as_markdown(self, url):
        current_url = str(url)
        self.scraped_urls.append(current_url)
        if current_url.endswith("/preferred"):
            return {
                "status": "success",
                "content": "Arsenal partnership and commercial transformation update " * 30,
                "metadata": {},
            }
        return {
            "status": "success",
            "content": "Arsenal partnership and commercial transformation update " * 30,
            "metadata": {},
        }


class _PdfGuardBrightData:
    def __init__(self):
        self.scraped_urls = []

    async def search_engine(self, **_kwargs):
        return {"status": "success", "results": []}

    async def scrape_as_markdown(self, url):
        current_url = str(url)
        self.scraped_urls.append(current_url)
        if current_url.endswith(".pdf"):
            return {
                "status": "success",
                "content": "xref startxref endobj /Filter/FlateDecode",
                "metadata": {},
            }
        return {
            "status": "success",
            "content": "Arsenal procurement supplier technology update " * 30,
            "metadata": {},
        }


class _ProbeRecoveringBrightData:
    def __init__(self):
        self.scraped_urls = []
        self.probe_urls = []

    async def search_engine(self, **_kwargs):
        return {"status": "success", "results": []}

    async def scrape_as_markdown(self, url):
        self.scraped_urls.append(str(url))
        return {
            "status": "success",
            "content": "tiny",
            "metadata": {"low_signal_reason": "thin_low_signal_leaf"},
        }

    async def _recover_with_domain_probe(self, url):
        self.probe_urls.append(str(url))
        return {
            "status": "success",
            "url": "https://www.ccfc.co.uk/news/commercial-partnership",
            "content": "Coventry City FC commercial partnership supplier technology rollout update " * 30,
            "metadata": {"extraction_mode": "domain_probe_recovery", "probe_host": "www.ccfc.co.uk"},
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
async def test_planner_can_choose_candidate_from_ranked_batch():
    runtime = DiscoveryRuntimeV2(_CandidateChoosingClaude(), _FakeBrightData())
    runtime.enable_llm_hop_selection = True

    action = await runtime._choose_candidate_action_from_batch(
        lane="trusted_news",
        entity_name="Coventry City FC",
        objective="rfp_web",
        candidates=[
            {"url": "https://weak.example/result", "title": "Weak", "snippet": "weak", "candidate_origin": "search"},
            {"url": "https://bbc.com/story", "title": "Strong", "snippet": "strong signal", "candidate_origin": "search"},
        ],
        state={"lane_exhausted": set()},
    )

    assert action is not None
    assert action["action"] == "scrape_candidate"
    assert action["candidate_index"] == 1


@pytest.mark.asyncio
async def test_run_lane_scrapes_planner_selected_candidate_first():
    brightdata = _CandidateOrderBrightData()
    runtime = DiscoveryRuntimeV2(_CandidateChoosingClaude(), brightdata)
    runtime.enable_llm_hop_selection = True
    runtime.enable_llm_eval = False

    async def _fake_candidates(**_kwargs):
        return [
            {
                "url": "https://weak.example/first",
                "title": "Weak first result",
                "snippet": "thin",
                "candidate_origin": "search",
            },
            {
                "url": "https://bbc.com/preferred",
                "title": "Preferred result",
                "snippet": "entity-grounded signal",
                "candidate_origin": "search",
            },
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
        lane="trusted_news",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
        budget={"max_evals_per_hop": 2, "max_hops": 5, "per_iteration_timeout": 30, "max_retries": 1, "max_same_domain_revisits": 2},
        run_objective="rfp_web",
    )

    assert brightdata.scraped_urls
    assert brightdata.scraped_urls[0] == "https://bbc.com/preferred"
    assert (result["hop"].get("planner_action") or {}).get("action") == "scrape_candidate"


@pytest.mark.asyncio
async def test_planner_can_lift_candidate_into_eval_window_beyond_max_evals():
    brightdata = _CandidateOrderBrightData()
    runtime = DiscoveryRuntimeV2(_FarCandidateChoosingClaude(), brightdata)
    runtime.enable_llm_hop_selection = True
    runtime.enable_llm_eval = False

    async def _fake_candidates(**_kwargs):
        return [
            {"url": "https://weak.example/first", "title": "First", "snippet": "thin", "candidate_origin": "search"},
            {"url": "https://weak.example/second", "title": "Second", "snippet": "thin", "candidate_origin": "search"},
            {"url": "https://bbc.com/preferred", "title": "Preferred", "snippet": "entity-grounded signal", "candidate_origin": "search"},
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

    await runtime._run_lane(
        lane="trusted_news",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
        budget={"max_evals_per_hop": 1, "max_hops": 5, "per_iteration_timeout": 30, "max_retries": 1, "max_same_domain_revisits": 2},
        run_objective="rfp_web",
    )

    assert brightdata.scraped_urls == ["https://bbc.com/preferred"]


@pytest.mark.asyncio
async def test_planner_action_still_respects_veto_rails():
    brightdata = _PdfGuardBrightData()
    runtime = DiscoveryRuntimeV2(_PdfChoosingClaude(), brightdata)
    runtime.enable_llm_hop_selection = True
    runtime.enable_llm_eval = False

    async def _fake_candidates(**_kwargs):
        return [
            {
                "url": "https://arsenal.com/procurement/tender.pdf",
                "title": "Tender PDF",
                "snippet": "supplier procurement",
                "candidate_origin": "search",
            },
            {
                "url": "https://arsenal.com/procurement/update",
                "title": "Procurement update",
                "snippet": "supplier procurement",
                "candidate_origin": "search",
            },
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
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        official_domain="arsenal.com",
        state=state,
        budget={"max_evals_per_hop": 1, "max_hops": 5, "per_iteration_timeout": 30, "max_retries": 1, "max_same_domain_revisits": 2},
        run_objective="rfp_pdf",
    )

    assert brightdata.scraped_urls == ["https://arsenal.com/procurement/tender.pdf"]
    assert result["signal"] is None
    assert runtime._quality_metrics["pdf_binary_reject_count"] >= 1


@pytest.mark.asyncio
async def test_planner_same_domain_probe_uses_recovered_page_before_seed_scrape():
    brightdata = _ProbeRecoveringBrightData()
    runtime = DiscoveryRuntimeV2(_SameDomainProbeClaude(), brightdata)
    runtime.enable_llm_hop_selection = True
    runtime.enable_llm_eval = False

    async def _fake_candidates(**_kwargs):
        return [
            {
                "url": "https://www.ccfc.co.uk/matches",
                "title": "Coventry City FC matches",
                "snippet": "fixtures and results",
                "candidate_origin": "search",
            },
            {
                "url": "https://www.ccfc.co.uk/",
                "title": "Coventry City FC official site",
                "snippet": "official site",
                "candidate_origin": "search",
            },
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
        lane="official_site",
        entity_name="Coventry City FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.ccfc.co.uk"}}},
        official_domain="ccfc.co.uk",
        state=state,
        budget={"max_evals_per_hop": 1, "max_hops": 5, "per_iteration_timeout": 30, "max_retries": 1, "max_same_domain_revisits": 2},
        run_objective="rfp_web",
    )

    assert brightdata.probe_urls == ["https://www.ccfc.co.uk/matches"]
    assert brightdata.scraped_urls == []
    assert result["hop"]["url"] == "https://www.ccfc.co.uk/news/commercial-partnership"
    assert (result["signal"] or result["diagnostic"]) is not None
    assert (result["signal"] or result["diagnostic"])["url"] == "https://www.ccfc.co.uk/news/commercial-partnership"
    assert (result["hop"].get("planner_action") or {}).get("action") == "same_domain_probe"


def test_extract_evidence_includes_content_passages():
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    evidence = runtime._extract_evidence(
        lane="trusted_news",
        entity_name="Coventry City FC",
        title="Coventry partnership update",
        snippet="club update",
        content=(
            "Coventry City FC announced a new digital partnership with a named supplier. "
            "The club said the rollout will improve supporter experience and data operations. "
            "Commercial and technology teams are involved in the next phase."
        ),
    )

    passages = evidence.get("content_passages") or []
    assert passages
    assert any("Coventry City FC announced a new digital partnership" in passage for passage in passages)


@pytest.mark.asyncio
async def test_llm_eval_receives_structured_evidence_packet():
    runtime = DiscoveryRuntimeV2(_RecordingClaude(), _FakeBrightData())
    runtime.enable_llm_eval = True

    evidence = {
        "snippet": "short summary",
        "content_item": "important extracted line",
        "content_passages": [
            "passage one with grounded evidence",
            "passage two with more grounded evidence",
        ],
        "quality_score": 0.8,
        "statement": "signal",
        "tokens": ["digital", "partnership"],
    }

    await runtime._maybe_llm_evaluate(
        lane="trusted_news",
        entity_name="Coventry City FC",
        url="https://bbc.com/story",
        evidence=evidence,
        run_objective="rfp_web",
    )

    assert "passage one with grounded evidence" in runtime.claude_client.last_prompt
    assert "passage two with more grounded evidence" in runtime.claude_client.last_prompt


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


def test_pdf_binary_noise_text_is_rejected_from_quality_gate():
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    noisy = "<5A375F999EDE6E4B960EF6243E7BDF70>] /Filter/FlateDecode/Length 17515>>"
    assert runtime._pdf_text_quality_ok(content=noisy) is False
    clean = (
        "The International Canoe Federation tender document invites suppliers to submit procurement proposals "
        "for event technology and timing systems."
    )
    assert runtime._pdf_text_quality_ok(content=clean) is True


@pytest.mark.asyncio
async def test_procurement_lanes_require_procurement_lexicon_for_validation():
    brightdata = _FakeBrightData(
        results=[
            {
                "url": "https://www.canoeicf.com/sites/default/files/icf_statutes_2024-marked-up.pdf",
                "title": "ICF Statutes 2024",
                "snippet": "governance policy document",
            }
        ],
        content="International Canoe Federation governance code and statutes update " * 30,
    )
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
        lane="governance_pdf",
        entity_name="International Canoe Federation",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.canoeicf.com"}}},
        official_domain="canoeicf.com",
        state=state,
        run_objective="rfp_pdf",
    )
    signal = lane_result.get("signal") or lane_result.get("diagnostic") or {}
    assert signal.get("validation_state") in {"candidate", "diagnostic"}
    assert "missing_procurement_lexicon" in list(signal.get("accept_reject_reasons") or [])


@pytest.mark.asyncio
async def test_rfp_pdf_lane_uses_official_document_indexing_candidates():
    brightdata = _FakeBrightData(results=[])
    runtime = DiscoveryRuntimeV2(_FakeClaude(), brightdata)
    runtime.enable_llm_hop_selection = False

    async def _mock_official_pdf_candidates(**_kwargs):
        return [
            {
                "url": "https://www.canoeicf.com/sites/default/files/icf_tender_notice.pdf",
                "title": "ICF tender notice",
                "snippet": "Official-domain sitemap indexed document candidate",
                "candidate_origin": "sitemap",
            }
        ]

    runtime._discover_official_pdf_candidates = _mock_official_pdf_candidates
    candidates = await runtime._discover_candidates(
        lane="governance_pdf",
        entity_name="International Canoe Federation",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.canoeicf.com/home"}}},
        state={},
        objective="rfp_pdf",
    )
    assert len(candidates) >= 1
    assert candidates[0]["candidate_origin"] == "sitemap"
    assert "canoeicf.com" in str(candidates[0]["url"])


def test_official_doc_index_cache_round_trip(tmp_path):
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    runtime.doc_index_cache_dir = tmp_path
    runtime.doc_index_cache_ttl_seconds = 3600
    runtime.doc_index_cache_max_urls = 10

    runtime._save_doc_index_cache(
        entity_id="international-canoe-federation",
        official_domain="canoeicf.com",
        items=[
            {
                "url": "https://www.canoeicf.com/sites/default/files/tender_notice.pdf",
                "title": "Tender Notice",
                "snippet": "Official-domain sitemap indexed document candidate",
                "candidate_origin": "sitemap",
            }
        ],
    )
    loaded = runtime._load_doc_index_cache(
        entity_id="international-canoe-federation",
        official_domain="canoeicf.com",
    )
    assert len(loaded) == 1
    assert loaded[0]["candidate_origin"] == "sitemap"
    assert "canoeicf.com" in str(loaded[0]["url"])


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


@pytest.mark.asyncio
async def test_dynamic_hop_credits_extend_budget_on_new_validated_signals(monkeypatch):
    monkeypatch.setenv("DISCOVERY_DYNAMIC_HOP_CREDITS_ENABLED", "true")
    monkeypatch.setenv("DISCOVERY_HOP_CREDIT_PER_SIGNAL", "2")
    monkeypatch.setenv("DISCOVERY_HOP_CREDIT_CAP", "8")
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    runtime.enable_llm_eval = False
    runtime.enable_llm_hop_selection = False
    runtime.enable_agentic_router = False
    call_count = {"n": 0}

    async def _fake_run_lane(**kwargs):
        call_count["n"] += 1
        lane = str(kwargs.get("lane") or "unknown")
        if call_count["n"] <= 2:
            signal_id = f"{lane}:{call_count['n']}"
            return {
                "hop": {
                    "hop_type": lane,
                    "llm_last_status": "ok",
                    "parse_path": "llm_json",
                },
                "signal": {
                    "id": signal_id,
                    "validation_state": "validated",
                    "url": f"https://www.arsenal.com/{signal_id}",
                },
                "diagnostic": None,
                "candidate_evaluations": [],
            }
        return {
            "hop": {
                "hop_type": lane,
                "llm_last_status": "ok",
                "parse_path": "llm_json",
            },
            "signal": None,
            "diagnostic": None,
            "candidate_evaluations": [],
        }

    runtime._run_lane = _fake_run_lane

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier={"metadata": {"canonical_sources": {"official_site": "https://www.arsenal.com"}}},
        run_objective="rfp_web",
        max_iterations=2,
    )
    summary = result.performance_summary or {}
    assert int(summary.get("hop_budget_initial") or 0) == 2
    assert int(summary.get("hop_budget_final") or 0) >= 4
    assert int(summary.get("hop_credits_earned") or 0) >= 2
    assert int(summary.get("hop_credit_events") or 0) >= 1


def test_rfp_tier_priority_prefers_official_tier_a_candidates():
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    official_domain = "arsenal.com"
    tier_a = {
        "url": "https://www.arsenal.com/procurement/tenders/it-rfp.pdf",
        "title": "Arsenal procurement tender",
        "snippet": "official supplier rfp",
        "candidate_origin": "sitemap",
    }
    tier_c = {
        "url": "https://aggregator.example/arsenal-procurement-rumour",
        "title": "Aggregator procurement post",
        "snippet": "unverified",
        "candidate_origin": "search",
    }
    assert (
        runtime._rfp_tier_priority(candidate=tier_a, official_domain=official_domain)
        > runtime._rfp_tier_priority(candidate=tier_c, official_domain=official_domain)
    )


def test_extract_evidence_normalizes_collapsed_spacing_and_truncates_cleanly():
    runtime = DiscoveryRuntimeV2(_FakeClaude(), _FakeBrightData())
    raw = (
        "Coventry City of Culture 2021 is hiring for these roles nowThere are some amazing jobs "
        "up for grabs and some impressive salaries tooNewsEnda Mullen05:00, 12 Feb 2019"
    )
    evidence = runtime._extract_evidence(
        lane="careers",
        entity_name="Coventry City FC",
        content=raw,
        title="",
        snippet="",
    )
    statement = str(evidence.get("statement") or "")
    assert "now There" in statement
    assert "Mullen 05:00" in statement
    assert "nowThere" not in statement
    assert "Mullen05:00" not in statement
    assert len(statement) <= (len("Coventry City FC: ") + 363)
    if statement.endswith("..."):
        assert not statement.endswith(" ...")
