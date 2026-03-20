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
async def test_tier3_cannot_validate_without_corroboration():
    brightdata = _FakeBrightData(
        results=[{"url": "https://random-blog.example/signals", "title": "Digital procurement", "snippet": "supplier"}],
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
