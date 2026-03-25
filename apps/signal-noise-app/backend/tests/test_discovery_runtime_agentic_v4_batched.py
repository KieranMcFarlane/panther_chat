import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from backend.discovery_engine_factory import create_discovery_engine
from backend.discovery_runtime_agentic_v4_batched import (
    BATCH_PLANNER_JSON_SCHEMA,
    DiscoveryRuntimeAgenticV4Batched,
)


class _BatchPlannerJudgeClaude:
    def __init__(self):
        self.planner_calls = 0

    async def query(self, **kwargs):
        model = str(kwargs.get("model") or "")
        if model == "planner":
            self.planner_calls += 1
            if self.planner_calls == 1:
                return {
                    "content": (
                        '{"batch_assessment":"seed batch found official-domain commercial signal",'
                        '"signals_found":[{"url":"https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update",'
                        '"signal_type":"commercial_signal","summary":"Chief Commercial Officer leading supplier programme"}],'
                        '"missing_signals":["named procurement lead"],'
                        '"sitemap_updates":["/commercial","/partners"],'
                        '"ranked_followups":[{"url":"https://www.ccfc.co.uk/commercial","reason":"commercial route","score":0.88}],'
                        '"next_batch_plan":['
                        '{"action":"scrape_url","target":"https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update","purpose":"evidence_deepen","expected_signal_type":"commercial_signal","confidence":0.82},'
                        '{"action":"probe_same_domain","target":"site:ccfc.co.uk (commercial OR partners OR supplier)","purpose":"sitemap_expand","expected_signal_type":"commercial_signal","confidence":0.71}'
                        '],'
                        '"batch_confidence_delta":0.18,'
                        '"why_these_pages":"official-domain commercial and partnership evidence first",'
                        '"stop_or_continue":"continue",'
                        '"override_soft_skips":[]}'
                    )
                }
            return {
                "content": (
                    '{"batch_assessment":"enough evidence for now",'
                    '"signals_found":[],'
                    '"missing_signals":[],'
                    '"sitemap_updates":[],'
                    '"ranked_followups":[],'
                    '"next_batch_plan":[{"action":"stop","purpose":"enough_signal","expected_signal_type":"stop","confidence":0.9}],'
                    '"batch_confidence_delta":0.05,'
                    '"why_these_pages":"validated commercial leadership evidence already found",'
                    '"stop_or_continue":"stop",'
                    '"override_soft_skips":[]}'
                )
            }
        if model == "judge":
            return {
                "content": (
                    '{"validation_state":"validated","evidence_type":"commercial_signal",'
                    '"entity_grounding":0.92,"yellow_panther_relevance":0.89,'
                    '"confidence_contribution":0.14,"reason_code":"commercial_signal",'
                    '"actionability_score":86}'
                )
            }
        return {"content": "{}"}


class _PlannerCaptureClaude(_BatchPlannerJudgeClaude):
    def __init__(self):
        super().__init__()
        self.last_planner_max_tokens = None
        self.last_planner_prompt = None
        self.last_planner_json_schema = None

    async def query(self, **kwargs):
        if str(kwargs.get("model") or "") == "planner":
            self.last_planner_max_tokens = kwargs.get("max_tokens")
            self.last_planner_prompt = kwargs.get("prompt")
            self.last_planner_json_schema = kwargs.get("json_schema")
        return await super().query(**kwargs)


class _BatchBrightData:
    async def search_engine(self, **kwargs):
        query = str(kwargs.get("query") or "")
        return {
            "status": "success",
            "query": query,
            "results": [
                {
                    "position": 1,
                    "title": "Coventry City FC commercial partnership update",
                    "url": "https://www.ccfc.co.uk/news/2026/03/commercial-partnership-update",
                    "snippet": "Chief Commercial Officer leads supplier programme and commercial review.",
                },
                {
                    "position": 2,
                    "title": "Coventry City FC partners",
                    "url": "https://www.ccfc.co.uk/partners",
                    "snippet": "Club partners and sponsorship relationships.",
                },
            ],
        }

    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": (
                "Coventry City FC announced a commercial partnership review and supplier programme. "
                "Jane Smith, Chief Commercial Officer, is leading the review. "
                "The club will assess fan experience systems, hospitality partnerships, and supplier contracts."
            ),
            "raw_html": (
                '<html><body><a href="/commercial">Commercial</a>'
                '<a href="/partners">Partners</a></body></html>'
            ),
            "metadata": {"word_count": 31},
        }


def test_factory_creates_agentic_v4_batched_runtime():
    runtime, name = create_discovery_engine(
        claude_client=_BatchPlannerJudgeClaude(),
        brightdata_client=_BatchBrightData(),
        engine="agentic_v4_batched",
    )

    assert name == "agentic_v4_batched"
    assert isinstance(runtime, DiscoveryRuntimeAgenticV4Batched)


@pytest.mark.asyncio
async def test_agentic_v4_batched_runtime_emits_batch_native_artifacts():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=3,
    )

    payload = result.to_dict()
    perf = payload["performance_summary"]

    assert payload["parse_path"] == "agentic_v4_batched"
    assert payload["batch_trace"]
    assert payload["evidence_packs"]
    assert payload["prior_run_memory"] is not None
    assert payload["kimi_batch_outputs"]
    assert payload["deepseek_audits"]
    assert payload["signals_discovered"]
    assert payload["evidence_ledger"][0]["raw_text"].startswith("Coventry City FC announced")
    assert perf["runtime_mode"] == "agentic_v4_batched"
    assert perf["batch_count"] >= 1
    assert perf["planner_decision_applied_rate"] > 0
    assert perf["batch_pages_processed"] >= 1
    assert perf["evidence_pack_token_estimate"] > 0


def test_agentic_v4_batched_soft_skip_memory_downranks_failed_paths():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())
    candidates = [
        {
            "url": "https://www.ccfc.co.uk/matches/fixtures",
            "title": "Fixtures",
            "snippet": "Match centre",
            "host": "ccfc.co.uk",
            "position": 1,
            "same_domain": True,
        },
        {
            "url": "https://www.ccfc.co.uk/commercial",
            "title": "Commercial",
            "snippet": "Commercial opportunities",
            "host": "ccfc.co.uk",
            "position": 2,
            "same_domain": True,
        },
    ]
    prior_run_memory = {
        "url_outcomes": {
            "https://www.ccfc.co.uk/matches/fixtures": {
                "low_signal_count": 2,
                "last_reason": "low_signal",
            }
        }
    }

    ranked, events = runtime._apply_soft_skip_memory(
        candidates=candidates,
        prior_run_memory=prior_run_memory,
        override_urls=set(),
    )

    assert ranked[0]["url"] == "https://www.ccfc.co.uk/commercial"
    assert events
    assert events[0]["event"] == "soft_skip_downrank"


def test_agentic_v4_batched_penalizes_shell_paths_in_ranking():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())
    candidates = [
        {
            "url": "https://www.ccfc.co.uk/news",
            "title": "News",
            "snippet": "Club news",
            "host": "ccfc.co.uk",
            "position": 1,
            "same_domain": True,
        },
        {
            "url": "https://www.ccfc.co.uk/videos",
            "title": "Videos",
            "snippet": "Club videos",
            "host": "ccfc.co.uk",
            "position": 2,
            "same_domain": True,
        },
        {
            "url": "https://www.ccfc.co.uk/fans/travel-and-parking",
            "title": "Travel and Parking",
            "snippet": "Travel details",
            "host": "ccfc.co.uk",
            "position": 3,
            "same_domain": True,
        },
        {
            "url": "https://www.ccfc.co.uk/commercial",
            "title": "Commercial",
            "snippet": "Commercial opportunities",
            "host": "ccfc.co.uk",
            "position": 4,
            "same_domain": True,
        },
    ]

    ranked, events = runtime._apply_soft_skip_memory(
        candidates=candidates,
        prior_run_memory={"url_outcomes": {}},
        override_urls=set(),
    )

    assert ranked[0]["url"] == "https://www.ccfc.co.uk/commercial"
    assert events == []


def test_agentic_v4_batched_explicit_target_consumes_matching_pending_candidate():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())
    state = {
        "pending_candidates": [
            {
                "url": "https://www.ccfc.co.uk/fans/travel-and-parking",
                "title": "Travel and Parking",
                "snippet": "",
                "host": "ccfc.co.uk",
                "position": 1,
                "same_domain": True,
            },
            {
                "url": "https://www.ccfc.co.uk/commercial",
                "title": "Commercial",
                "snippet": "",
                "host": "ccfc.co.uk",
                "position": 2,
                "same_domain": True,
            },
        ],
        "prior_run_memory": {"url_outcomes": {}},
        "soft_skip_events": [],
    }

    url = runtime._resolve_batch_action_url(
        action={"target": "https://www.ccfc.co.uk/fans/travel-and-parking"},
        state=state,
        override_urls=set(),
    )

    assert url == "https://www.ccfc.co.uk/fans/travel-and-parking"
    assert [candidate["url"] for candidate in state["pending_candidates"]] == [
        "https://www.ccfc.co.uk/commercial"
    ]


@pytest.mark.asyncio
async def test_agentic_v4_batched_can_enforce_requested_iteration_cap(monkeypatch):
    monkeypatch.setenv("PIPELINE_ENFORCE_DISCOVERY_ITERATION_CAP", "true")
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())

    result = await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    payload = result.to_dict()
    assert payload["iterations_completed"] <= 1
    assert (payload.get("performance_summary") or {}).get("batch_count") <= 1


def test_agentic_v4_batched_uses_smaller_seed_and_domain_pack_budgets():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())

    assert runtime._batch_input_token_target_for_type("seed_batch") < runtime.batch_input_token_target
    assert runtime._batch_input_token_target_for_type("official_domain_map_batch") <= runtime.batch_input_token_target
    assert runtime._batch_input_token_target_for_type("targeted_discovery_batch") <= runtime.batch_input_token_target


@pytest.mark.asyncio
async def test_agentic_v4_batched_uses_reduced_planner_max_tokens(monkeypatch):
    monkeypatch.delenv("AGENTIC_V4_PLANNER_MAX_TOKENS", raising=False)
    claude = _PlannerCaptureClaude()
    runtime = DiscoveryRuntimeAgenticV4Batched(claude, _BatchBrightData())

    await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    assert claude.last_planner_max_tokens == 700


def test_agentic_v4_batched_uses_compact_planner_schema():
    assert BATCH_PLANNER_JSON_SCHEMA["required"] == ["next_batch_plan", "stop_or_continue"]
    assert "batch_assessment" not in BATCH_PLANNER_JSON_SCHEMA["properties"]
    assert "why_these_pages" not in BATCH_PLANNER_JSON_SCHEMA["properties"]
    assert "ranked_followups" not in BATCH_PLANNER_JSON_SCHEMA["properties"]
    assert "sitemap_updates" not in BATCH_PLANNER_JSON_SCHEMA["properties"]
    assert "missing_signals" in BATCH_PLANNER_JSON_SCHEMA["properties"]


def test_agentic_v4_batched_normalizes_batch_plan_aliases():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())

    normalized = runtime._normalize_batch_plan_payload(
        payload={
            "plan": [
                {
                    "action": "scrape_url",
                    "target": "https://www.ccfc.co.uk/commercial",
                    "purpose": "commercial_followup",
                    "expected_signal_type": "commercial_signal",
                    "confidence": 0.81,
                }
            ],
            "stop_or_continue": "continue",
            "missing_signals": ["named commercial lead"],
            "override_soft_skips": ["https://www.ccfc.co.uk/commercial"],
        },
        state={"pending_candidates": []},
    )

    assert normalized is not None
    assert normalized["stop_or_continue"] == "continue"
    assert normalized["missing_signals"] == ["named commercial lead"]
    assert normalized["override_soft_skips"] == ["https://www.ccfc.co.uk/commercial"]
    assert normalized["next_batch_plan"][0]["target"] == "https://www.ccfc.co.uk/commercial"


def test_agentic_v4_batched_normalizes_stringified_and_wrapper_batch_payloads():
    runtime = DiscoveryRuntimeAgenticV4Batched(_BatchPlannerJudgeClaude(), _BatchBrightData())

    stringified = runtime._normalize_batch_plan_payload(
        payload=(
            '{"plan":[{"action":"scrape_url","target":"https://www.ccfc.co.uk/news/",'
            '"purpose":"news_followup","expected_signal_type":"news_signal","confidence":0.74}],'
            '"stop_or_continue":"continue"}'
        ),
        state={"pending_candidates": []},
    )
    wrapped = runtime._normalize_batch_plan_payload(
        payload={
            "content": {
                "batch_plan": [
                    {
                        "action": "search_site",
                        "target": "site:ccfc.co.uk commercial",
                        "purpose": "commercial_probe",
                        "expected_signal_type": "commercial_signal",
                        "confidence": 0.63,
                    }
                ],
                "stop_or_continue": "stop",
            }
        },
        state={"pending_candidates": []},
    )

    assert stringified is not None
    assert stringified["next_batch_plan"][0]["target"] == "https://www.ccfc.co.uk/news/"
    assert wrapped is not None
    assert wrapped["stop_or_continue"] == "stop"
    assert wrapped["next_batch_plan"][0]["action"] == "search_site"


@pytest.mark.asyncio
async def test_agentic_v4_batched_records_raw_parse_failure_telemetry():
    class _BadPlannerClaude(_BatchPlannerJudgeClaude):
        async def query(self, **kwargs):
            if str(kwargs.get("model") or "") == "planner":
                return {
                    "content": (
                        '{"next_batch_plan":[{"purpose":"commercial_followup",'
                        '"target":"https://www.ccfc.co.uk/commercial"}],'
                        '"stop_or_continue":"continue"}'
                    )
                }
            return await super().query(**kwargs)

    runtime = DiscoveryRuntimeAgenticV4Batched(_BadPlannerClaude(), _BatchBrightData())
    state = {
        "mission_brief": "Find procurement need for Coventry City FC",
        "entity_profile": {},
        "official_site_url": "https://www.ccfc.co.uk",
        "official_domains": {"ccfc.co.uk"},
        "visited_urls": set(),
        "visited_queries": set(),
        "pending_candidates": [],
        "failed_paths": {},
        "open_hypotheses": [],
        "remaining_credits": 1,
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
        "batch_trace": [],
        "evidence_packs": [],
        "soft_skip_events": [],
        "kimi_batch_outputs": [],
        "deepseek_audits": [],
        "sitemap_candidates": [],
        "prior_run_memory": {},
        "planner_parse_failure_events": [],
    }
    result = await runtime._plan_batch(
        entity_name="Coventry City FC",
        objective="dossier_core",
        state=state,
        evidence_pack={"packed_items": []},
        last_batch_result={"summary": "seed bootstrap"},
        batch_type="seed_batch",
    )

    assert result["stop_or_continue"] == "continue"
    assert runtime._metrics["planner_decision_parse_fail_count"] == 1
    assert runtime._metrics["schema_fail_count"] == 1
    assert runtime._metrics["planner_repair_count"] == 1
    assert runtime._metrics["planner_repair_fallback_count"] == 1
    assert runtime._metrics["llm_last_status"] == "planner_repair_fallback"
    assert runtime._metrics["planner_parse_failure_events"]
    event = runtime._metrics["planner_parse_failure_events"][0]
    assert event["failure_reason"] == "invalid_batch_action_shape"
    assert "commercial_followup" in event["raw_content"]
    assert result["planner_fallback_reason"] == "invalid_batch_action_shape"
    assert result["planner_source"] == "deterministic_recovery"
    assert state["planner_parse_failure_events"]
    assert state["planner_parse_failure_events"][0]["failure_reason"] == "invalid_batch_action_shape"


@pytest.mark.asyncio
async def test_agentic_v4_batched_uses_compact_planner_prompt(monkeypatch):
    monkeypatch.delenv("AGENTIC_V4_PLANNER_MAX_TOKENS", raising=False)
    claude = _PlannerCaptureClaude()
    runtime = DiscoveryRuntimeAgenticV4Batched(claude, _BatchBrightData())

    await runtime.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"metadata": {"website": "https://www.ccfc.co.uk"}},
        max_iterations=1,
    )

    assert claude.last_planner_prompt is not None
    assert "Prior-run memory:" not in claude.last_planner_prompt
    assert "Official-domain sitemap candidates:" not in claude.last_planner_prompt
    assert "why_these_pages" not in claude.last_planner_prompt
    assert "ranked_followups" not in claude.last_planner_prompt
