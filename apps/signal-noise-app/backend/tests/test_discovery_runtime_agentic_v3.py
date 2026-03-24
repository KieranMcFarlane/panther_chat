import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from backend.discovery_runtime_agentic_v3 import DiscoveryRuntimeAgenticV3
from backend.dossier_generator import EntityDossierGenerator
from run_fixed_dossier_pipeline import FixedDossierFirstPipeline


class _PlannerJudgeClaude:
    async def query(self, **kwargs):
        prompt = str(kwargs.get("prompt") or "")
        model = str(kwargs.get("model") or "")
        if model == "planner":
            if "Candidate options: []" in prompt:
                return {
                    "content": (
                        '{"action":"search_site","target":"\\"Coventry City FC\\" commercial partner",'
                        '"purpose":"official_domain_search","expected_signal_type":"procurement_signal",'
                        '"confidence":0.82,"reason":"start from official domain"}'
                    )
                }
            return {
                "content": (
                    '{"action":"scrape_url","candidate_index":0,"purpose":"evaluate_candidate",'
                    '"expected_signal_type":"procurement_signal","confidence":0.79,'
                    '"reason":"top same-domain candidate"}'
                )
            }
        if model == "judge":
            return {
                "content": (
                    '{"validation_state":"validated","evidence_type":"procurement_signal",'
                    '"entity_grounding":0.9,"yellow_panther_relevance":0.88,'
                    '"confidence_contribution":0.12,"reason_code":"procurement_signal",'
                    '"actionability_score":88}'
                )
            }
        return {"content": "{}"}


class _FakeBrightData:
    async def search_engine(self, **kwargs):
        query = str(kwargs.get("query") or "")
        return {
            "status": "success",
            "query": query,
            "results": [
                {
                    "position": 1,
                    "title": "Coventry City FC names Chief Commercial Officer",
                    "url": "https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update",
                    "snippet": "Coventry City FC announces a commercial partnership review and supplier programme.",
                }
            ],
        }

    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": (
                "Coventry City FC announced a new procurement and supplier review for its digital and commercial "
                "operations. Jane Smith, Chief Commercial Officer, is leading the programme. The club expects "
                "supplier engagement and platform decisions during 2026."
            ),
            "raw_html": (
                '<html><body><a href="/partners">Partners</a>'
                '<a href="/commercial">Commercial</a></body></html>'
            ),
            "metadata": {"word_count": 35},
        }


class _PlannerBadConfidenceClaude:
    async def query(self, **kwargs):
        model = str(kwargs.get("model") or "")
        if model == "planner":
            return {
                "content": (
                    '{"action":"search_web","target":"Coventry City FC procurement",'
                    '"purpose":"seed_search","expected_signal_type":"procurement_signal",'
                    '"confidence":"high","reason":"bad_confidence_type"}'
                )
            }
        if model == "judge":
            return {"content": '{"validation_state":"candidate","reason_code":"candidate"}'}
        return {"content": "{}"}


class _PlannerRaisesClaude:
    async def query(self, **kwargs):
        model = str(kwargs.get("model") or "")
        if model == "planner":
            raise RuntimeError("planner_timeout")
        return {"content": "{}"}


class _SearchRaisesBrightData:
    async def search_engine(self, **kwargs):
        raise RuntimeError("search_timeout")

    async def scrape_as_markdown(self, url):
        return {"status": "error", "url": url}


class _JudgeRaisesClaude(_PlannerJudgeClaude):
    async def query(self, **kwargs):
        model = str(kwargs.get("model") or "")
        if model == "judge":
            raise RuntimeError("judge_timeout")
        return await super().query(**kwargs)


@pytest.mark.asyncio
async def test_agentic_v3_runtime_produces_planner_led_validated_signal():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _FakeBrightData())
    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=4,
    )

    payload = result.to_dict()
    performance = payload["performance_summary"]

    assert payload["parse_path"] == "agentic_v3_planner_led"
    assert len(payload["signals_discovered"]) >= 1
    assert performance["planner_turn_count"] >= 1
    assert performance["planner_decision_applied_count"] >= 1
    assert performance["planner_decision_applied_rate"] > 0
    assert payload["actionability_score"] >= 70
    assert payload["entity_grounded_signal_count"] >= 1
    assert payload["turn_trace"]
    assert payload["credit_ledger"]


def test_dual_compare_prefers_agentic_runtime_when_actionability_is_higher():
    pipeline = object.__new__(FixedDossierFirstPipeline)
    v2_payload = {
        "signals_discovered": [{"validation_state": "validated", "subtype": "operational_signal", "text": "club update"}],
        "provisional_signals": [],
        "candidate_evaluations": [{"reason_code": "low_signal", "validation_state": "candidate"}],
        "performance_summary": {
            "planner_decision_applied_rate": 0.0,
            "off_entity_reject_rate": 0.0,
            "schema_fail_count": 0,
            "total_duration_ms": 500.0,
            "actionability_score": 25.0,
        },
        "actionability_score": 25.0,
        "entity_grounded_signal_count": 1,
        "controller_health_reasons": ["no_planner_actions_applied"],
    }
    agentic_payload = {
        "signals_discovered": [{"validation_state": "validated", "subtype": "procurement_signal", "text": "Chief Commercial Officer leading supplier review"}],
        "provisional_signals": [{"validation_state": "provisional", "subtype": "commercial_signal", "text": "commercial partnership planning"}],
        "candidate_evaluations": [],
        "performance_summary": {
            "planner_decision_applied_rate": 0.75,
            "off_entity_reject_rate": 0.0,
            "schema_fail_count": 0,
            "total_duration_ms": 650.0,
            "actionability_score": 86.0,
        },
        "actionability_score": 86.0,
        "entity_grounded_signal_count": 2,
        "controller_health_reasons": ["healthy"],
    }

    comparison = pipeline._compare_discovery_payloads(v2_payload=v2_payload, agentic_payload=agentic_payload)

    assert comparison["winner_runtime"] == "agentic_v3"
    assert comparison["runtimes"]["agentic_v3"]["weighted_total"] > comparison["runtimes"]["v2"]["weighted_total"]


@pytest.mark.asyncio
async def test_agentic_v3_runtime_handles_non_numeric_planner_confidence_without_crashing():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerBadConfidenceClaude(), _FakeBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    payload = result.to_dict()
    performance = payload["performance_summary"]
    planner_decisions = payload.get("planner_decisions") or []

    assert payload["parse_path"] == "agentic_v3_planner_led"
    assert performance["planner_decision_parse_fail_count"] == 0
    assert performance["planner_decision_applied_count"] >= 1
    assert planner_decisions and planner_decisions[0]["confidence"] == 0.5


@pytest.mark.asyncio
async def test_agentic_v3_runtime_respects_max_iterations_bound():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerBadConfidenceClaude(), _FakeBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    assert result.iterations_completed <= 1


@pytest.mark.asyncio
async def test_agentic_v3_runtime_handles_planner_query_error_without_crashing():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerRaisesClaude(), _FakeBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=2,
    )

    payload = result.to_dict()
    performance = payload["performance_summary"]

    assert payload["iterations_completed"] == 0
    assert performance["stop_reason"] == "planner_schema_failed"
    assert performance["planner_decision_parse_fail_count"] >= 1


@pytest.mark.asyncio
async def test_agentic_v3_runtime_handles_search_provider_error_without_crashing():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerBadConfidenceClaude(), _SearchRaisesBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    payload = result.to_dict()
    performance = payload["performance_summary"]

    assert payload["parse_path"] == "agentic_v3_planner_led"
    assert payload["iterations_completed"] == 1
    assert performance["stop_reason"] in {"credit_exhausted", "no_progress_budget_stop"}


@pytest.mark.asyncio
async def test_agentic_v3_runtime_does_not_promote_validated_signals_when_judge_falls_back():
    runtime = DiscoveryRuntimeAgenticV3(_JudgeRaisesClaude(), _FakeBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=2,
    )

    payload = result.to_dict()
    performance = payload["performance_summary"]

    assert payload["signals_discovered"] == []
    assert payload["provisional_signals"] == []
    assert performance["llm_last_status"] == "judge_fallback"
    assert "judge_fallback_used" in payload["controller_health_reasons"]


@pytest.mark.asyncio
async def test_rejected_evidence_keeps_official_domain_source_tier():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _FakeBrightData())

    evidence = await runtime._evaluate_scrape(
        entity_name="Coventry City FC",
        entity_tokens=runtime._entity_tokens("Coventry City FC"),
        url="https://www.ccfc.co.uk/news/empty-shell",
        scrape_result={
            "status": "success",
            "content": "Enable JavaScript",
            "raw_html": "<html><body>Enable JavaScript</body></html>",
            "metadata": {"word_count": 2, "request_type": "rendered_request"},
        },
        action={"action": "render_url", "purpose": "official_domain_news"},
        official_domains={"ccfc.co.uk"},
    )

    assert isinstance(evidence, dict)
    assert evidence["reason_code"] == "low_signal"
    assert evidence["source_tier"] == "tier_1"


def test_resolve_action_url_pops_matching_candidate_when_target_and_candidate_index_both_supplied():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _FakeBrightData())
    state = {
        "pending_candidates": [
            {"url": "https://www.ccfc.co.uk/news/one"},
            {"url": "https://www.ccfc.co.uk/news/two"},
            {"url": "https://www.ccfc.co.uk/news/three"},
        ]
    }

    resolved = runtime._resolve_action_url(
        action={"target": "https://www.ccfc.co.uk/news/two", "candidate_index": 1},
        state=state,
    )

    assert resolved == "https://www.ccfc.co.uk/news/two"
    assert [item["url"] for item in state["pending_candidates"]] == [
        "https://www.ccfc.co.uk/news/one",
        "https://www.ccfc.co.uk/news/three",
    ]


def test_dossier_enrichment_marks_evidence_led_sections():
    generator = EntityDossierGenerator(_PlannerJudgeClaude())
    dossier_payload = {
        "entity_name": "Coventry City FC",
        "metadata": {"entity_name": "Coventry City FC"},
        "sections": [
            {"id": "leadership", "content": [], "confidence": 0.4},
            {"id": "recent_news", "content": [], "confidence": 0.4},
            {"id": "outreach_strategy", "content": [], "confidence": 0.4},
        ],
    }
    discovery_payload = {
        "signals_discovered": [
            {
                "validation_state": "validated",
                "text": "Jane Smith - Chief Commercial Officer",
                "content": "Jane Smith was appointed Chief Commercial Officer in 2026.",
                "url": "https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update",
                "subtype": "leadership_signal",
                "rank": 3,
            },
            {
                "validation_state": "validated",
                "text": "Commercial partnership update: Coventry City FC begins supplier review",
                "content": "Commercial partnership update: Coventry City FC begins supplier review in 2026.",
                "url": "https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update",
                "subtype": "news_official",
                "rank": 3,
            },
        ],
        "provisional_signals": [],
        "candidate_evaluations": [],
        "actionability_score": 84,
        "entity_grounded_signal_count": 2,
    }

    enriched = generator.enrich_dossier_with_discovery_evidence(
        dossier_payload=dossier_payload,
        discovery_payload=discovery_payload,
    )
    by_id = {section["id"]: section for section in enriched["sections"]}

    assert by_id["leadership"]["output_status"] == "completed_evidence_led"
    assert by_id["recent_news"]["output_status"] == "completed_evidence_led"
    assert by_id["outreach_strategy"]["output_status"] == "completed_evidence_led"
    assert "https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update" in by_id["outreach_strategy"]["content"][0]
