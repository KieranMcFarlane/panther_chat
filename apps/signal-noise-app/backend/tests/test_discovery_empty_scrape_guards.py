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


@pytest.mark.asyncio
async def test_execute_hop_reuses_official_site_scrape_cache():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.pdf_extractor = None
    discovery.total_cost_usd = 0.0
    discovery.brightdata_client = SimpleNamespace()
    discovery._official_site_content_cache = {}

    scrape_calls = {"count": 0}

    async def fake_get_url_for_hop(hop_type, hypothesis, state):
        return "https://www.canoeicf.com/home"

    async def fake_scrape_as_markdown(url):
        scrape_calls["count"] += 1
        return {
            "status": "success",
            "content": "Official federation site content",
            "url": url,
            "timestamp": "2026-03-03T10:00:00Z",
            "metadata": {"word_count": 4},
        }

    async def fake_evaluate_content_with_claude(**kwargs):
        return {
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "justification": "No signal",
            "evidence_found": "",
        }

    discovery._get_url_for_hop = fake_get_url_for_hop
    discovery._is_pdf_url = lambda url: False
    discovery.brightdata_client.scrape_as_markdown = fake_scrape_as_markdown
    discovery._evaluate_content_with_claude = fake_evaluate_content_with_claude

    state = SimpleNamespace(
        current_depth=0,
        last_failed_hop=None,
        hop_failure_counts={},
    )
    state.increment_depth_count = lambda depth: None

    hypothesis = SimpleNamespace(metadata={"entity_name": "International Canoe Federation"})

    first = await discovery._execute_hop(HopType.OFFICIAL_SITE, hypothesis, state)
    second = await discovery._execute_hop(HopType.OFFICIAL_SITE, hypothesis, state)

    assert first["decision"] == "NO_PROGRESS"
    assert second["decision"] == "NO_PROGRESS"
    assert scrape_calls["count"] == 1
    assert second["performance"]["scrape_ms"] == 0.0


@pytest.mark.asyncio
async def test_execute_hop_reuses_official_site_evaluation_for_unchanged_content():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.pdf_extractor = None
    discovery.total_cost_usd = 0.0
    discovery.brightdata_client = SimpleNamespace()
    discovery._official_site_content_cache = {}
    discovery._official_site_evaluation_cache = {}

    scrape_calls = {"count": 0}
    evaluation_calls = {"count": 0}

    async def fake_get_url_for_hop(hop_type, hypothesis, state):
        return "https://www.canoeicf.com/home"

    async def fake_scrape_as_markdown(url):
        scrape_calls["count"] += 1
        return {
            "status": "success",
            "content": "Official federation site content that does not change",
            "url": url,
            "timestamp": "2026-03-03T10:00:00Z",
            "metadata": {"word_count": 8},
        }

    async def fake_evaluate_content_with_claude(**kwargs):
        evaluation_calls["count"] += 1
        return {
            "decision": "WEAK_ACCEPT",
            "confidence_delta": 0.02,
            "justification": "Stable digital transformation signal",
            "evidence_found": "Digital transformation roadmap",
        }

    discovery._get_url_for_hop = fake_get_url_for_hop
    discovery._is_pdf_url = lambda url: False
    discovery.brightdata_client.scrape_as_markdown = fake_scrape_as_markdown
    discovery._evaluate_content_with_claude = fake_evaluate_content_with_claude

    state = SimpleNamespace(
        current_depth=0,
        last_failed_hop=None,
        hop_failure_counts={},
    )
    state.increment_depth_count = lambda depth: None

    hypothesis = SimpleNamespace(
        hypothesis_id="icf_digital_programme",
        metadata={"entity_name": "International Canoe Federation"},
    )

    first = await discovery._execute_hop(HopType.OFFICIAL_SITE, hypothesis, state)
    second = await discovery._execute_hop(HopType.OFFICIAL_SITE, hypothesis, state)

    assert first["decision"] == "WEAK_ACCEPT"
    assert second["decision"] == "WEAK_ACCEPT"
    assert scrape_calls["count"] == 1
    assert evaluation_calls["count"] == 1
    assert second["performance"]["scrape_ms"] == 0.0
    assert second["performance"]["evaluation_ms"] == 0.0
    assert second["performance"]["evaluation_cache_hit"] is True


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


@pytest.mark.asyncio
async def test_evaluate_content_with_claude_returns_fallback_when_query_raises():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    class FailingClaudeClient:
        async def query(self, *args, **kwargs):
            raise RuntimeError("transport failed")

    discovery.claude_client = FailingClaudeClient()
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
        pattern_name="test-pattern",
        current_confidence=0.5,
        iterations_attempted=0,
        early_indicators=[],
        keywords=[],
        recent_history=[],
        last_decision=None,
        hop_type=HopType.RFP_PAGE,
        channel_guidance="Search for procurement signals",
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

    result = await discovery._evaluate_content_with_claude(
        content="Example content",
        hypothesis=hypothesis,
        hop_type=HopType.RFP_PAGE,
        content_metadata={},
    )

    assert result["decision"] == "NO_PROGRESS"
    assert result["justification"] == "fallback"


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
async def test_official_site_evaluation_uses_reduced_prompt_budget():
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
        current_confidence=0.78,
        iterations_attempted=0,
        early_indicators=[],
        keywords=[],
        recent_history=[],
        last_decision=None,
        hop_type=HopType.OFFICIAL_SITE,
        channel_guidance="Search for federation strategy signals",
        min_evidence_strength="medium",
        temporal_requirements="recent_12mo",
    )

    hypothesis = SimpleNamespace(
        metadata={"entity_name": "International Canoe Federation"},
        category="procurement",
        confidence=0.78,
        iterations_attempted=0,
        statement="Potential procurement activity",
    )

    content = "B" * 3000 + "OFFICIAL_TAIL"

    result = await discovery._evaluate_content_with_claude(
        content=content,
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={},
    )

    assert result["decision"] == "NO_PROGRESS"
    assert captured["max_tokens"] == 280
    assert "OFFICIAL_TAIL" not in captured["prompt"]
    assert "B" * 1300 not in captured["prompt"]


@pytest.mark.asyncio
async def test_official_site_evaluation_uses_compact_evidence_pack():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    captured = {}

    class RecordingClaudeClient:
        async def query(self, prompt, model, max_tokens):
            captured["prompt"] = prompt
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
        current_confidence=0.78,
        iterations_attempted=0,
        early_indicators=["digital transformation"],
        keywords=["procurement", "roadmap"],
        recent_history=[],
        last_decision=None,
        hop_type=HopType.OFFICIAL_SITE,
        channel_guidance="Search for federation strategy signals",
        min_evidence_strength="medium",
        temporal_requirements="recent_12mo",
    )

    hypothesis = SimpleNamespace(
        metadata={"entity_name": "International Canoe Federation"},
        category="procurement",
        confidence=0.78,
        iterations_attempted=0,
        statement="Potential procurement activity",
    )

    content = "\n".join(
        [
            "Welcome to the federation.",
            "General history section.",
            "Digital transformation roadmap for the next three seasons.",
            "This procurement programme will modernise the platform stack.",
            "Leadership team overview.",
            "Archived supporter story.",
        ]
    )

    result = await discovery._evaluate_content_with_claude(
        content=content,
        hypothesis=hypothesis,
        hop_type=HopType.OFFICIAL_SITE,
        content_metadata={},
    )

    assert result["decision"] == "NO_PROGRESS"
    assert "Digital transformation roadmap" in captured["prompt"]
    assert "procurement programme" in captured["prompt"]
    assert "Archived supporter story." not in captured["prompt"]


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
async def test_validate_search_results_returns_original_results_on_timeout():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.search_validation_timeout_seconds = 0.01

    class SlowValidator:
        async def validate_search_results(self, **kwargs):
            import asyncio
            await asyncio.sleep(0.1)
            return [], kwargs["results"]

    discovery.search_validator = SlowValidator()

    results = [{"url": "https://example.com/rfp", "title": "RFP"}]

    valid, rejected = await discovery._validate_search_results(
        results=results,
        entity_name="International Canoe Federation",
        entity_type="SPORT_FEDERATION",
        search_query="icf rfp",
        hypothesis_context="procurement",
    )

    assert valid == results
    assert rejected == []


@pytest.mark.asyncio
async def test_search_engine_with_timeout_returns_error_result():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.search_timeout_seconds = 0.01

    class SlowBrightData:
        async def search_engine(self, **kwargs):
            import asyncio
            await asyncio.sleep(0.1)
            return {"status": "success", "results": [{"url": "https://example.com"}]}

    discovery.brightdata_client = SlowBrightData()

    result = await discovery._search_engine_with_timeout(
        query="icf rfp",
        engine="google",
        num_results=3,
    )

    assert result["status"] == "error"
    assert result["error"] == "Search timeout"


@pytest.mark.asyncio
async def test_execute_hop_returns_no_progress_when_url_resolution_times_out():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_resolution_timeout_seconds = 0.01
    discovery.pdf_extractor = None
    discovery.total_cost_usd = 0.0
    discovery.brightdata_client = SimpleNamespace()

    async def slow_get_url_for_hop(hop_type, hypothesis, state):
        import asyncio
        await asyncio.sleep(0.1)
        return "https://example.com/slow"

    discovery._get_url_for_hop = slow_get_url_for_hop
    discovery._is_pdf_url = lambda url: False

    state = SimpleNamespace(
        current_depth=0,
        last_failed_hop=None,
        hop_failure_counts={},
    )
    state.increment_depth_count = lambda depth: None

    hypothesis = SimpleNamespace(metadata={"entity_name": "International Canoe Federation"})

    result = await discovery._execute_hop(HopType.RFP_PAGE, hypothesis, state)

    assert result["decision"] == "NO_PROGRESS"
    assert "URL resolution timed out" in result["justification"]
