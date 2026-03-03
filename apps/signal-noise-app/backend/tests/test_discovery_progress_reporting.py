import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType


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
            "performance": {
                "total_duration_ms": 10.0,
                "scrape_cache_hit": True,
                "evaluation_cache_hit": True,
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
    assert progress_events[1]["performance_summary"]["iterations_with_timings"] == 1
    assert progress_events[1]["performance_summary"]["hop_timings"][0]["iteration"] == 1
    assert progress_events[1]["performance_summary"]["hop_timings"][0]["duration_ms"] == 10.0
    assert progress_events[1]["performance_summary"]["hop_timings"][0]["scrape_cache_hit"] is True
    assert progress_events[1]["performance_summary"]["hop_timings"][0]["evaluation_cache_hit"] is True
    assert progress_events[2]["iteration"] == 2
    assert progress_events[3]["performance_summary"]["iterations_with_timings"] == 2
    assert progress_events[-1]["stop_reason"] == "consecutive_no_progress"
