#!/usr/bin/env python3
"""
Regression tests for discovery behavior when scrape or validation inputs are empty.
"""

import sys
from pathlib import Path
from types import SimpleNamespace
import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
from search_result_validator import SearchResultValidator


def test_search_result_validator_handles_empty_model_response():
    validator = SearchResultValidator(claude_client=object())

    assert validator._parse_validation_response(None, 3) == {}
    assert validator._parse_validation_response("", 3) == {}
    assert validator._parse_validation_response("   ", 3) == {}


@pytest.mark.asyncio
async def test_execute_hop_returns_no_progress_for_empty_scrape_content():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.pdf_extractor = None
    discovery.total_cost_usd = 0.0
    discovery.brightdata_client = SimpleNamespace()

    async def fake_get_url_for_hop(hop_type, hypothesis, state):
        return "https://example.com/rfp"

    async def fake_scrape_as_markdown(url):
        return {
            "status": "success",
            "content": None,
            "url": url,
            "timestamp": "2026-03-02T10:00:00Z",
            "metadata": {},
        }

    discovery._get_url_for_hop = fake_get_url_for_hop
    discovery._is_pdf_url = lambda url: False
    discovery.brightdata_client.scrape_as_markdown = fake_scrape_as_markdown

    async def unexpected_evaluate_content_with_claude(**kwargs):
        raise AssertionError("Claude evaluation should not run for empty scrape content")

    discovery._evaluate_content_with_claude = unexpected_evaluate_content_with_claude

    state = SimpleNamespace(
        current_depth=0,
        last_failed_hop=None,
        hop_failure_counts={},
    )
    state.increment_depth_count = lambda depth: None

    hypothesis = SimpleNamespace(metadata={"entity_name": "Arsenal FC"})

    result = await discovery._execute_hop(HopType.RFP_PAGE, hypothesis, state)

    assert result["decision"] == "NO_PROGRESS"
    assert result["justification"] == "No content returned from scrape"
    assert result["url"] == "https://example.com/rfp"
    assert result["performance"]["total_duration_ms"] >= 0


@pytest.mark.asyncio
async def test_execute_hop_returns_timed_no_progress_for_scrape_failure():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.pdf_extractor = None
    discovery.total_cost_usd = 0.0
    discovery.brightdata_client = SimpleNamespace()

    async def fake_get_url_for_hop(hop_type, hypothesis, state):
        return "https://example.com/failure"

    async def fake_scrape_as_markdown(url):
        return {
            "status": "error",
            "error": "No content returned (data was None or empty)",
            "url": url,
        }

    discovery._get_url_for_hop = fake_get_url_for_hop
    discovery._is_pdf_url = lambda url: False
    discovery.brightdata_client.scrape_as_markdown = fake_scrape_as_markdown
    discovery._evaluate_content_with_claude = None

    state = SimpleNamespace(
        current_depth=0,
        last_failed_hop=None,
        hop_failure_counts={},
    )
    state.increment_depth_count = lambda depth: None

    hypothesis = SimpleNamespace(metadata={"entity_name": "Arsenal FC"})

    result = await discovery._execute_hop(HopType.RFP_PAGE, hypothesis, state)

    assert result["decision"] == "NO_PROGRESS"
    assert "Scraping failed" in result["justification"]
    assert result["url"] == "https://example.com/failure"
    assert result["performance"]["scrape_ms"] >= 0
    assert result["performance"]["total_duration_ms"] >= result["performance"]["scrape_ms"]


def test_score_url_penalizes_weak_linkedin_rfp_results():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    weak_score = discovery._score_url(
        url="https://www.linkedin.com/posts/example-company_random-post",
        hop_type=HopType.RFP_PAGE,
        entity_name="Arsenal FC",
        title="Partnership update",
        snippet="A general commercial update with no procurement signal",
    )
    strong_score = discovery._score_url(
        url="https://vendor.example.com/tenders/arsenal-rfp.pdf",
        hop_type=HopType.RFP_PAGE,
        entity_name="Arsenal FC",
        title="Arsenal FC digital transformation RFP",
        snippet="Request for proposal for CRM and fan engagement platform",
    )

    assert weak_score < 0.5
    assert strong_score >= 0.5


def test_score_url_prefers_official_domain_over_store_domain_for_official_site():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    official_score = discovery._score_url(
        url="https://www.ccfc.co.uk",
        hop_type=HopType.OFFICIAL_SITE,
        entity_name="Coventry City FC",
        title="Coventry City FC | Official Site",
        snippet="Official website for Coventry City FC",
    )
    store_score = discovery._score_url(
        url="https://www.ccfcstore.com",
        hop_type=HopType.OFFICIAL_SITE,
        entity_name="Coventry City FC",
        title="CCFC Store",
        snippet="Official merchandise and ticketing store",
    )

    assert official_score > store_score


def test_score_url_prefers_grounded_procurement_over_video_noise():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    noisy_score = discovery._score_url(
        url="https://www.youtube.com/watch?v=abcd1234",
        hop_type=HopType.RFP_PAGE,
        entity_name="Coventry City FC",
        title="Coventry highlights and fan reactions",
        snippet="Matchday analysis and fan commentary",
    )
    grounded_score = discovery._score_url(
        url="https://www.coventry.gov.uk/procurement/tender-opportunity-123",
        hop_type=HopType.RFP_PAGE,
        entity_name="Coventry City FC",
        title="Coventry City FC procurement tender opportunity",
        snippet="Request for proposal and supplier submission deadline",
    )

    assert grounded_score > noisy_score


@pytest.mark.asyncio
async def test_press_release_evaluation_uses_reduced_prompt_budget():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    captured = {}

    class RecordingClaudeClient:
        async def query(self, prompt, model, max_tokens):
            captured["prompt"] = prompt
            captured["model"] = model
            captured["max_tokens"] = max_tokens
            return {
                "content": '{"decision":"NO_PROGRESS","confidence_delta":0.0,"justification":"none","evidence_found":"","temporal_score":"older"}'
            }

    discovery.claude_client = RecordingClaudeClient()
    discovery._format_early_indicators = lambda indicators: ""
    discovery._fallback_result = lambda: {
        "decision": "NO_PROGRESS",
        "confidence_delta": 0.0,
        "justification": "fallback",
        "evidence_found": "",
    }
    discovery._build_evaluation_context = lambda **kwargs: SimpleNamespace(
        entity_name="International Canoe Federation",
        hypothesis_statement="Potential procurement activity",
        hypothesis_category="procurement",
        pattern_name="federation_procurement_programme",
        current_confidence=0.5,
        iterations_attempted=0,
        early_indicators=[],
        keywords=[],
        recent_history=[],
        last_decision=None,
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="Search for federation strategy signals",
        min_evidence_strength="medium",
        temporal_requirements="recent_12mo",
    )

    hypothesis = SimpleNamespace(
        metadata={"entity_name": "International Canoe Federation"},
        category="procurement",
        confidence=0.5,
        iterations_attempted=0,
        statement="Potential procurement activity",
    )

    content = "A" * 4000 + "TAIL_MARKER"

    result = await discovery._evaluate_content_with_claude(
        content=content,
        hypothesis=hypothesis,
        hop_type=HopType.PRESS_RELEASE,
        content_metadata={},
    )

    assert result["decision"] == "NO_PROGRESS"
    assert captured["max_tokens"] == 250
    assert "TAIL_MARKER" not in captured["prompt"]
    assert "A" * 1500 not in captured["prompt"]


@pytest.mark.asyncio
async def test_update_hypothesis_state_falls_back_to_in_memory_hypothesis():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.hypothesis_manager = SimpleNamespace()
    discovery._create_signal_from_hop_result = lambda **kwargs: None

    async def fake_update_hypothesis(**kwargs):
        return None

    discovery.hypothesis_manager.update_hypothesis = fake_update_hypothesis

    class FakeBlacklist:
        def record_failure(self, source_type):
            return None
        def record_success(self, source_type):
            return None
        def get_failure_count(self, source_type):
            return 0

    state = SimpleNamespace(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        channel_blacklist=FakeBlacklist(),
        current_depth=1,
        iterations_completed=0,
        raw_signals=[],
    )
    state.update_confidence = lambda confidence: setattr(state, "updated_confidence", confidence)
    state.should_dig_deeper = lambda updated_hypothesis: False

    hypothesis = SimpleNamespace(
        hypothesis_id="h1",
        confidence=0.61,
        iterations_attempted=0,
        iterations_accepted=0,
        iterations_weak_accept=0,
        iterations_rejected=0,
        iterations_no_progress=0,
        reinforced_count=0,
        weakened_count=0,
        last_delta=0.0,
        last_updated=None,
        category="procurement",
        metadata={},
        statement="Potential procurement activity",
    )

    await discovery._update_hypothesis_state(
        hypothesis=hypothesis,
        result={
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "hop_type": "rfp_page",
        },
        state=state,
    )

    assert hypothesis.iterations_attempted == 1
    assert hypothesis.iterations_no_progress == 1
    assert state.updated_confidence == hypothesis.confidence


@pytest.mark.asyncio
async def test_site_specific_search_uses_official_domain_not_store_domain():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    captured_queries = []

    class FakeBrightData:
        async def search_engine(self, query, engine="google", num_results=5):
            captured_queries.append(query)
            if query == '"Coventry City FC" official website':
                return {
                    "status": "success",
                    "results": [
                        {"url": "https://www.ccfcstore.com", "title": "CCFC Store", "snippet": "Official store"},
                        {"url": "https://www.ccfc.co.uk", "title": "Coventry City FC Official Site", "snippet": "Official website"},
                    ],
                }
            return {"status": "success", "results": []}

    discovery.brightdata_client = FakeBrightData()

    result = await discovery._try_site_specific_search("Coventry City FC", HopType.RFP_PAGE)

    assert result is None
    assert any(q.startswith("site:ccfc.co.uk ") for q in captured_queries)
    assert not any(q.startswith("site:ccfcstore.com ") for q in captured_queries)


@pytest.mark.asyncio
async def test_dossier_context_fallback_uses_existing_default_template():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._dossier_hypotheses_cache = {}
    discovery.max_depth = 2
    discovery.brightdata_client = SimpleNamespace()

    async def fake_search_engine(**kwargs):
        return {"status": "error", "results": []}

    discovery.brightdata_client.search_engine = fake_search_engine

    async def fake_initialize_from_dossier(entity_id, dossier_hypotheses):
        return None

    async def fake_run_discovery(entity_id, entity_name, template_id, max_iterations):
        return {"template_id": template_id, "max_iterations": max_iterations}

    discovery.initialize_from_dossier = fake_initialize_from_dossier
    discovery.run_discovery = fake_run_discovery

    result = await discovery.run_discovery_with_dossier_context(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier={"extracted_signals": [], "procurement_signals": {"upcoming_opportunities": []}},
        max_iterations=3,
    )

    assert result["template_id"] == "yellow_panther_agency"


def test_performance_summary_includes_selected_url_and_domain():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    state = SimpleNamespace(
        iteration_results=[
            {
                "iteration": 1,
                "hop_type": "rfp_page",
                "hypothesis_id": "h1",
                "result": {
                    "url": "https://www.ccfc.co.uk/news/2026/rfp",
                    "decision": "NO_PROGRESS",
                    "performance": {
                        "total_duration_ms": 1234.0,
                        "url_resolution_ms": 700.0,
                        "scrape_ms": 500.0,
                        "evaluation_ms": 34.0,
                        "url_resolution": {"validation_ms": 0.0},
                    },
                },
            }
        ]
    )

    summary = discovery._build_performance_summary(state, total_duration_ms=1234.0)
    first = summary["hop_timings"][0]

    assert first["selected_url"] == "https://www.ccfc.co.uk/news/2026/rfp"
    assert first["selected_domain"] == "www.ccfc.co.uk"
