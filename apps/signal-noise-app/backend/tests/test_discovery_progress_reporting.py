import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType, EvaluationContext


@pytest.mark.asyncio
async def test_run_discovery_loop_emits_progress_updates_and_stops_after_consecutive_no_progress():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.max_depth = 7
    discovery.max_consecutive_no_progress_iterations = 2

    async def noop_rescore(hypotheses):
        return None

    async def select_top(hypotheses, state):
        return hypotheses[0]

    async def execute_hop(**kwargs):
        return {
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "justification": "No useful evidence",
            "evidence_found": "",
            "hop_type": HopType.RFP_PAGE.value,
            "performance": {"total_duration_ms": 10.0},
        }

    async def update_state(hypothesis, result, state):
        state.current_confidence = 0.5
        state.iterations_completed += 1

    async def build_final_result(state, hypotheses, total_duration_ms):
        return {
            "iterations_completed": state.iterations_completed,
            "performance_summary": {"total_duration_ms": total_duration_ms},
        }

    discovery._rescore_hypotheses_by_eig = noop_rescore
    discovery._select_top_hypothesis = select_top
    discovery._choose_next_hop = lambda hypothesis, state: HopType.RFP_PAGE
    discovery._execute_hop = execute_hop
    discovery._update_hypothesis_state = update_state
    discovery._build_final_result = build_final_result

    hypothesis = SimpleNamespace(
        hypothesis_id="h-1",
        expected_information_gain=0.9,
        confidence=0.5,
        status="ACTIVE",
    )
    state = SimpleNamespace(
        active_hypotheses=[hypothesis],
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        current_depth=1,
        global_saturated=False,
        confidence_saturated=False,
        is_actionable=False,
        iterations_completed=0,
        iteration_results=[],
        current_confidence=0.5,
        should_dig_deeper=lambda hypothesis: False,
    )

    progress_events = []

    async def progress_callback(payload):
        progress_events.append(payload)

    result = await discovery._run_discovery_loop(
        state=state,
        max_iterations=10,
        progress_callback=progress_callback,
    )

    assert result["iterations_completed"] == 2
    assert len(progress_events) == 5
    assert progress_events[0]["status"] == "running"
    assert progress_events[0]["iteration"] == 1
    assert progress_events[1]["status"] == "running"
    assert progress_events[2]["iteration"] == 2
    assert progress_events[-1]["stop_reason"] == "consecutive_no_progress"


@pytest.mark.asyncio
async def test_run_discovery_loop_stops_early_for_repeated_unchanged_official_site_no_progress():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.max_depth = 7
    discovery.max_consecutive_no_progress_iterations = 5

    async def noop_rescore(hypotheses):
        return None

    async def select_top(hypotheses, state):
        return hypotheses[0]

    async def execute_hop(**kwargs):
        return {
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "justification": "No useful evidence",
            "evidence_found": "",
            "hop_type": HopType.OFFICIAL_SITE.value,
            "performance": {
                "total_duration_ms": 8.0,
                "scrape_cache_hit": True,
                "evaluation_cache_hit": True,
                "content_hash": "abc123",
            },
        }

    async def update_state(hypothesis, result, state):
        state.current_confidence = 0.5
        state.iterations_completed += 1

    async def build_final_result(state, hypotheses, total_duration_ms):
        return {
            "iterations_completed": state.iterations_completed,
            "performance_summary": {"total_duration_ms": total_duration_ms},
        }

    discovery._rescore_hypotheses_by_eig = noop_rescore
    discovery._select_top_hypothesis = select_top
    discovery._choose_next_hop = lambda hypothesis, state: HopType.OFFICIAL_SITE
    discovery._execute_hop = execute_hop
    discovery._update_hypothesis_state = update_state
    discovery._build_final_result = build_final_result

    hypothesis = SimpleNamespace(
        hypothesis_id="h-1",
        expected_information_gain=0.9,
        confidence=0.5,
        status="ACTIVE",
    )
    state = SimpleNamespace(
        active_hypotheses=[hypothesis],
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        current_depth=1,
        global_saturated=False,
        confidence_saturated=False,
        is_actionable=False,
        iterations_completed=0,
        iteration_results=[],
        current_confidence=0.5,
        should_dig_deeper=lambda hypothesis: False,
    )

    progress_events = []

    async def progress_callback(payload):
        progress_events.append(payload)

    result = await discovery._run_discovery_loop(
        state=state,
        max_iterations=10,
        progress_callback=progress_callback,
    )

    assert result["iterations_completed"] == 1
    assert progress_events[1]["performance_summary"]["hop_timings"][0]["content_hash"] == "abc123"
    assert progress_events[-1]["stop_reason"] == "repeated_unchanged_official_site_no_progress"


@pytest.mark.asyncio
async def test_run_discovery_loop_stops_early_for_empty_response_streak():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.max_depth = 7
    discovery.max_consecutive_no_progress_iterations = 10
    discovery.max_empty_response_no_progress_streak = 2

    async def noop_rescore(hypotheses):
        return None

    async def select_top(hypotheses, state):
        return hypotheses[0]

    async def execute_hop(**kwargs):
        return {
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "justification": "No useful evidence",
            "evidence_found": "",
            "hop_type": HopType.PRESS_RELEASE.value,
            "llm_last_status": "empty_response_deterministic_fallback",
            "parse_path": "empty_response_fallback",
            "performance": {"total_duration_ms": 10.0},
        }

    async def update_state(hypothesis, result, state):
        state.current_confidence = 0.5
        state.iterations_completed += 1

    async def build_final_result(state, hypotheses, total_duration_ms):
        return {
            "iterations_completed": state.iterations_completed,
            "performance_summary": {"total_duration_ms": total_duration_ms},
        }

    discovery._rescore_hypotheses_by_eig = noop_rescore
    discovery._select_top_hypothesis = select_top
    discovery._choose_next_hop = lambda hypothesis, state: HopType.PRESS_RELEASE
    discovery._execute_hop = execute_hop
    discovery._update_hypothesis_state = update_state
    discovery._build_final_result = build_final_result

    hypothesis = SimpleNamespace(
        hypothesis_id="h-1",
        expected_information_gain=0.9,
        confidence=0.5,
        status="ACTIVE",
    )
    state = SimpleNamespace(
        active_hypotheses=[hypothesis],
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        current_depth=1,
        global_saturated=False,
        confidence_saturated=False,
        is_actionable=False,
        iterations_completed=0,
        iteration_results=[],
        current_confidence=0.5,
        should_dig_deeper=lambda hypothesis: False,
    )

    progress_events = []

    async def progress_callback(payload):
        progress_events.append(payload)

    result = await discovery._run_discovery_loop(
        state=state,
        max_iterations=10,
        progress_callback=progress_callback,
    )

    assert result["iterations_completed"] == 2
    assert progress_events[-1]["stop_reason"] == "empty_response_no_progress_streak"


def test_min_evidence_salvage_promotes_no_progress_when_grounded_lexical_hits_exist():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=["procurement", "vendor"],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="FIBA",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )
    content = "FIBA appoints technology partner and procurement vendor for digital platform expansion."
    result = {
        "decision": "NO_PROGRESS",
        "confidence_delta": 0.0,
        "justification": "empty",
        "parse_path": "schema_gate_deterministic_fallback",
    }

    salvaged = discovery._apply_min_evidence_salvage(
        result=result,
        content=content,
        context=context,
        hop_type=HopType.PRESS_RELEASE,
    )

    assert salvaged["decision"] == "WEAK_ACCEPT"
    assert salvaged["confidence_delta"] <= 0.02
    assert salvaged["parse_path"] == "schema_gate_deterministic_fallback"
    assert salvaged["evidence_type"] == "minimum_evidence_salvage"


def test_min_evidence_salvage_keeps_no_progress_for_off_entity_content():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=["procurement", "vendor"],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="FIBA",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )
    content = "Premier League club appoints technology vendor and procurement partner."
    result = {
        "decision": "NO_PROGRESS",
        "confidence_delta": 0.0,
        "justification": "empty",
        "parse_path": "schema_gate_deterministic_fallback",
    }

    unchanged = discovery._apply_min_evidence_salvage(
        result=result,
        content=content,
        context=context,
        hop_type=HopType.PRESS_RELEASE,
    )

    assert unchanged["decision"] == "NO_PROGRESS"


def test_min_evidence_salvage_uses_url_grounding_for_snippet_fallback_content():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=["procurement", "vendor"],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="Coventry City FC",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )
    content = "Procurement vendor appointment announced for digital platform delivery."
    result = {
        "decision": "NO_PROGRESS",
        "confidence_delta": 0.0,
        "justification": "empty",
        "parse_path": "empty_response_fallback",
    }

    salvaged = discovery._apply_min_evidence_salvage(
        result=result,
        content=content,
        context=context,
        hop_type=HopType.PRESS_RELEASE,
        source_url="https://www.ccfc.co.uk/news/vendor-appointment",
    )

    assert salvaged["decision"] == "WEAK_ACCEPT"


def test_entity_grounding_accepts_distinctive_entity_token():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    grounded = discovery._is_entity_grounded(
        content="Arsenal announce a new digital platform partnership for supporter services.",
        url="https://example.com/news/story",
        entity_name="Arsenal FC",
    )
    assert grounded is True


def test_extract_evidence_pack_salvages_single_lexical_hit_when_grounded():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=[],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="Arsenal FC",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )

    payload = discovery._extract_evidence_pack(
        content="Arsenal confirms a new digital programme for fan services this season.",
        context=context,
        mcp_matches=[],
    )

    assert payload["decision"] == "WEAK_ACCEPT"


def test_extract_evidence_pack_salvages_grounded_rich_content_without_keywords():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=[],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.OFFICIAL_SITE,
        channel_guidance="test",
        entity_name="Arsenal FC",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )

    rich_content = "Arsenal " + ("supporter experience operations roadmap. " * 200)
    payload = discovery._extract_evidence_pack(
        content=rich_content,
        context=context,
        mcp_matches=[],
    )

    assert payload["decision"] == "WEAK_ACCEPT"


def test_extract_evidence_pack_rejects_low_signal_navigation_shell():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=[],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="Coventry City FC",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )
    nav_shell = (
        "Coventry City FC contact us privacy policy terms and conditions tickets store "
        "club site accessibility careers job hiring contact us privacy policy tickets store "
        "club site accessibility careers job hiring contact us privacy policy tickets store."
    )
    payload = discovery._extract_evidence_pack(
        content=nav_shell,
        context=context,
        mcp_matches=[],
    )

    assert payload["decision"] == "NO_PROGRESS"


def test_extract_evidence_pack_uses_higher_delta_for_grounded_trusted_signal():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=[],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="Arsenal FC",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )
    content = (
        "Arsenal appoints a technology supplier and procurement partner for a new digital platform rollout."
    )
    payload = discovery._extract_evidence_pack(
        content=content,
        context=context,
        mcp_matches=[],
    )

    assert payload["decision"] == "WEAK_ACCEPT"
    assert payload["confidence_delta"] >= 0.03


def test_extract_off_domain_corroboration_count_counts_unique_domains():
    content = """
[CORROBORATION_SOURCE] bbc.co.uk | Coventry City explore supplier tender process
Coventry City FC are reviewing digital procurement options.
[CORROBORATION_SOURCE] theguardian.com | Coventry City announce technology partner
Club statement references procurement planning.
[CORROBORATION_SOURCE] bbc.co.uk | Duplicate source should not increase count
"""
    count = HypothesisDrivenDiscovery._extract_off_domain_corroboration_count(content)
    assert count == 2


def test_min_evidence_salvage_promotes_on_corroboration_even_without_lexical_hits():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    context = EvaluationContext(
        hypothesis_statement="Entity shows active procurement intent",
        hypothesis_category="procurement",
        pattern_name="test",
        early_indicators=[],
        keywords=[],
        confidence_weight=0.5,
        current_confidence=0.5,
        iterations_attempted=1,
        last_decision=None,
        recent_history=[],
        hop_type=HopType.PRESS_RELEASE,
        channel_guidance="test",
        entity_name="Coventry City FC",
        content_length=0,
        min_evidence_strength="medium",
        temporal_requirements="recent",
    )
    result = {
        "decision": "NO_PROGRESS",
        "confidence_delta": 0.0,
        "justification": "schema fallback",
        "parse_path": "schema_gate_deterministic_fallback",
    }
    corroboration_only = """
[CORROBORATION_SOURCE] bbc.co.uk | Coventry City FC announces digital programme
Club statement confirms supplier shortlist activity.
[CORROBORATION_SOURCE] skysports.com | Coventry City FC leadership update
Related article cites procurement team planning.
"""

    salvaged = discovery._apply_min_evidence_salvage(
        result=result,
        content=corroboration_only,
        context=context,
        hop_type=HopType.PRESS_RELEASE,
    )

    assert salvaged["decision"] == "WEAK_ACCEPT"
    assert salvaged["confidence_delta"] <= 0.02
    assert salvaged["corroboration_count"] >= 2


@pytest.mark.asyncio
async def test_update_hypothesis_state_does_not_drop_global_confidence_on_lower_hypothesis_no_progress():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    class _HypothesisManager:
        async def update_hypothesis(self, **kwargs):
            return None

    discovery.hypothesis_manager = _HypothesisManager()
    discovery._create_signal_from_hop_result = lambda **kwargs: None

    hypothesis = SimpleNamespace(
        hypothesis_id="h-dup",
        confidence=0.54,
        iterations_attempted=0,
        iterations_accepted=0,
        iterations_weak_accept=0,
        iterations_rejected=0,
        iterations_no_progress=0,
        reinforced_count=0,
        weakened_count=0,
        last_delta=0.0,
        last_updated=None,
        category="digital_transformation",
        metadata={},
        statement="test",
        status="ACTIVE",
    )

    state = SimpleNamespace(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        current_confidence=0.60,
        current_depth=1,
        iterations_completed=0,
        update_confidence=lambda value: setattr(state, "current_confidence", value),
        should_dig_deeper=lambda _hypothesis: False,
    )

    await discovery._update_hypothesis_state(
        hypothesis=hypothesis,
        result={
            "decision": "NO_PROGRESS",
            "confidence_delta": 0.0,
            "hop_type": HopType.RFP_PAGE.value,
            "url": "https://example.com/rfp",
        },
        state=state,
    )

    assert state.current_confidence >= 0.60


def test_seed_state_confidence_from_hypotheses_uses_highest_prior():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)

    state = SimpleNamespace(
        current_confidence=0.20,
        update_confidence=lambda value: setattr(state, "current_confidence", value),
    )
    hypotheses = [
        SimpleNamespace(confidence=0.54, prior_probability=0.54),
        SimpleNamespace(confidence=0.58, prior_probability=0.58),
        SimpleNamespace(confidence=0.50, prior_probability=0.50),
    ]

    discovery._seed_state_confidence_from_hypotheses(state, hypotheses)

    assert state.current_confidence >= 0.58
