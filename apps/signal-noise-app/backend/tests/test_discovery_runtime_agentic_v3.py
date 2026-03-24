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


class _SearchEvidenceBrightData(_FakeBrightData):
    async def search_engine(self, **kwargs):
        return {
            "status": "success",
            "query": str(kwargs.get("query") or ""),
            "results": [
                {
                    "position": 1,
                    "title": "Coventry City FC commercial partnership update",
                    "url": "https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update",
                    "snippet": "Coventry City FC announces a supplier and commercial programme.",
                },
                {
                    "position": 2,
                    "title": "Coventry City FC official club news",
                    "url": "https://www.ccfc.co.uk/news/2026/03/club-news",
                    "snippet": "Coventry City FC official news and club updates.",
                },
            ],
        }


class _JudgeRaisesClaude(_PlannerJudgeClaude):
    async def query(self, **kwargs):
        model = str(kwargs.get("model") or "")
        if model == "judge":
            raise RuntimeError("judge_timeout")
        return await super().query(**kwargs)


class _DuplicateUrlPlannerClaude:
    async def query(self, **kwargs):
        model = str(kwargs.get("model") or "")
        if model == "planner":
            return {
                "content": (
                    '{"action":"scrape_url","target":"https://www.ccfc.co.uk/news/low-signal-shell",'
                    '"purpose":"evaluate_candidate","expected_signal_type":"procurement_signal",'
                    '"confidence":0.8,"reason":"low signal scrape"}'
                )
            }
        if model == "judge":
            return {"content": '{"validation_state":"candidate","reason_code":"candidate"}'}
        return {"content": "{}"}


class _LowSignalBrightData:
    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": "Enable JavaScript",
            "raw_html": "<html><body>Enable JavaScript</body></html>",
            "metadata": {"word_count": 2},
        }


def test_agentic_v3_search_results_prioritize_root_and_news_over_matches_shells():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _FakeBrightData())
    candidates = runtime._search_results_to_candidates(
        search_result={
            "status": "success",
            "results": [
                {
                    "position": 1,
                    "title": "Coventry City FC | Match Centre",
                    "url": "https://www.ccfc.co.uk/matches/first-team/2025/g2566847",
                    "snippet": "Match details and ticketing",
                },
                {
                    "position": 2,
                    "title": "Coventry City FC News",
                    "url": "https://www.ccfc.co.uk/news",
                    "snippet": "Latest club updates",
                },
                {
                    "position": 3,
                    "title": "Coventry City FC",
                    "url": "https://www.ccfc.co.uk/",
                    "snippet": "Official website",
                },
            ],
        },
        official_domains={"ccfc.co.uk"},
        query='site:ccfc.co.uk "Coventry City FC" official',
        state={"visited_urls": set()},
    )

    assert [item["url"] for item in candidates[:3]] == [
        "https://www.ccfc.co.uk/",
        "https://www.ccfc.co.uk/news",
        "https://www.ccfc.co.uk/matches/first-team/2025/g2566847",
    ]


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


def test_dual_compare_prefers_batched_runtime_when_actionability_is_higher():
    pipeline = object.__new__(FixedDossierFirstPipeline)
    v3_payload = {
        "signals_discovered": [{"validation_state": "validated", "subtype": "operational_signal", "text": "club update"}],
        "provisional_signals": [],
        "candidate_evaluations": [{"reason_code": "low_signal", "validation_state": "candidate"}],
        "performance_summary": {
            "planner_decision_applied_rate": 0.35,
            "off_entity_reject_rate": 0.0,
            "schema_fail_count": 0,
            "total_duration_ms": 500.0,
            "actionability_score": 25.0,
        },
        "actionability_score": 25.0,
        "entity_grounded_signal_count": 1,
        "controller_health_reasons": ["healthy"],
    }
    batched_payload = {
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

    comparison = pipeline._compare_discovery_payloads(v2_payload=v3_payload, agentic_payload=batched_payload)

    assert comparison["winner_runtime"] == "agentic_v4_batched"
    assert comparison["runtimes"]["agentic_v4_batched"]["weighted_total"] > comparison["runtimes"]["agentic_v3"]["weighted_total"]


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
async def test_agentic_v3_can_enforce_requested_iteration_cap_even_when_credits_are_earned(monkeypatch):
    monkeypatch.setenv("PIPELINE_ENFORCE_DISCOVERY_ITERATION_CAP", "true")
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _FakeBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    assert result.iterations_completed <= 1
    assert (result.to_dict().get("performance_summary") or {}).get("stop_reason") in {
        "requested_iteration_cap_reached",
        "credit_exhausted",
    }


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

    assert payload["iterations_completed"] >= 1
    assert performance["planner_repair_count"] >= 1
    assert performance["planner_turn_count"] >= 1
    assert performance["planner_decision_applied_count"] >= 1
    assert performance["planner_decision_parse_fail_count"] == 0
    assert any(
        isinstance(row, dict) and row.get("planner_action", {}).get("generated_by") == "planner_repair"
        for row in payload["turn_trace"]
    )


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
    assert all(
        str(item.get("validation_state") or "").strip().lower() == "provisional"
        for item in payload["provisional_signals"]
    )
    assert performance["llm_last_status"] == "judge_fallback"
    assert "judge_fallback_used" in payload["controller_health_reasons"]


@pytest.mark.asyncio
async def test_agentic_v3_runtime_reports_blocked_planner_action_without_counting_it_as_applied():
    runtime = DiscoveryRuntimeAgenticV3(_DuplicateUrlPlannerClaude(), _LowSignalBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    payload = result.to_dict()
    performance = payload["performance_summary"]

    assert performance["planner_turn_count"] == 1
    assert performance["planner_decision_applied_count"] == 0
    assert performance["planner_decision_applied_rate"] == 0.0
    assert performance["planner_block_reason_counts"]["planner_action_blocked_low_signal_exhausted"] == 1
    assert payload["turn_trace"][0]["planner_status"] == "blocked"
    assert payload["turn_trace"][0]["planner_block_reason"] == "planner_action_blocked_low_signal_exhausted"


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


def test_planner_repair_skips_low_signal_candidate_urls():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _FakeBrightData())
    state = {
        "pending_candidates": [
            {"url": "https://www.ccfc.co.uk/matches/fixtures"},
            {
                "url": "https://www.ccfc.co.uk/commercial/partnerships",
                "title": "Commercial partnerships",
                "snippet": "Official club commercial opportunities",
            },
        ],
        "failed_urls": {"https://www.ccfc.co.uk/matches/fixtures"},
    }

    repair_action = runtime._deterministic_planner_repair_action(
        state=state,
        entity_name="Coventry City FC",
        objective="dossier_core",
        last_observation={"summary": "previous scrape was low signal"},
        entity_tokens=["coventry", "city", "fc"],
    )

    assert repair_action is not None
    assert repair_action["target"] == "https://www.ccfc.co.uk/commercial/partnerships"
    assert repair_action["action"] == "scrape_url"


@pytest.mark.asyncio
async def test_search_results_can_promote_provisional_evidence():
    runtime = DiscoveryRuntimeAgenticV3(_PlannerJudgeClaude(), _SearchEvidenceBrightData())
    state = {
        "visited_queries": set(),
        "visited_urls": set(),
        "pending_candidates": [],
        "failed_urls": {},
        "failed_paths": {},
        "open_hypotheses": [],
        "remaining_credits": 10,
        "current_confidence": 0.35,
        "consecutive_no_signal": 0,
        "consecutive_low_signal_by_branch": {},
        "turn_trace": [],
        "planner_decisions": [],
        "executed_actions": [],
        "credit_ledger": [],
        "evidence_ledger": [],
        "validated_signals": [],
        "provisional_signals": [],
        "candidate_evaluations": [],
        "lane_failures": {},
        "official_domains": {"ccfc.co.uk"},
    }

    execution = await runtime._execute_action(
        action={
            "action": "search_site",
            "target": 'site:ccfc.co.uk "Coventry City FC" official',
            "purpose": "official_domain_search",
            "expected_signal_type": "procurement_signal",
        },
        entity_name="Coventry City FC",
        state=state,
        entity_tokens=["coventry", "city", "fc"],
        official_domains={"ccfc.co.uk"},
    )

    assert execution["kind"] == "search"
    assert len(state["provisional_signals"]) >= 2
    assert len(state["candidate_evaluations"]) >= 2
    assert all(item["validation_state"] == "provisional" for item in state["provisional_signals"][:2])


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


def test_dossier_enrichment_surfaces_unconsumed_evidence_and_richer_metadata():
    generator = EntityDossierGenerator(_PlannerJudgeClaude())
    dossier_payload = {
        "entity_name": "Coventry City FC",
        "metadata": {"entity_name": "Coventry City FC"},
        "sections": [
            {"id": "leadership", "content": ["placeholder"], "confidence": 0.4, "output_status": "completed"},
            {"id": "recent_news", "content": ["placeholder"], "confidence": 0.4, "output_status": "completed"},
            {"id": "outreach_strategy", "content": ["placeholder"], "confidence": 0.4, "output_status": "completed"},
        ],
    }
    discovery_payload = {
        "signals_discovered": [],
        "provisional_signals": [
            {
                "validation_state": "provisional",
                "text": "Coventry City FC official commercial planning update with supplier programme",
                "content": "Coventry City FC official commercial planning update with supplier programme and platform review.",
                "url": "https://www.ccfc.co.uk/news/2026/03/commercial-planning-update",
                "subtype": "commercial_signal",
                "rank": 2,
            }
        ],
        "candidate_evaluations": [
            {
                "source_url": "https://www.ccfc.co.uk/news/2026/03/commercial-planning-update",
                "evidence_snippet": "Commercial planning update",
                "evidence_content_item": "Commercial planning update with supplier programme.",
                "validation_state": "candidate",
                "reason_code": "commercial_signal",
            }
        ],
        "candidate_events_summary": {"total": 1, "by_reason_code": {"commercial_signal": 1}},
        "lane_failures": {"official_domain_news": {"low_signal": 2}},
        "actionability_score": 61,
        "entity_grounded_signal_count": 1,
    }

    enriched = generator.enrich_dossier_with_discovery_evidence(
        dossier_payload=dossier_payload,
        discovery_payload=discovery_payload,
    )
    by_id = {section["id"]: section for section in enriched["sections"]}

    assert by_id["leadership"]["output_status"] == "degraded_sparse_evidence"
    assert by_id["leadership"]["reason_code"] == "leadership_evidence_not_consumed"
    assert by_id["recent_news"]["output_status"] == "completed_with_sparse_fallback"
    assert by_id["outreach_strategy"]["output_status"] == "completed_with_sparse_fallback"
    assert enriched["metadata"]["discovery_enrichment"]["candidate_events_summary"]["total"] == 1
    assert enriched["metadata"]["discovery_enrichment"]["lane_failures"]["official_domain_news"]["low_signal"] == 2
