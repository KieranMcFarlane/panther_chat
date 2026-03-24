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
