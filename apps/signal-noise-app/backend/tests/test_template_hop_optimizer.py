import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from template_hop_optimizer import compute_objective_score, select_recommended_cap, CapThresholds


def test_score_prefers_gate_pass_and_lower_runtime():
    a = {
        "gate_passed": True,
        "signals_discovered": 2,
        "final_confidence": 0.6,
        "runtime_seconds": 300,
        "schema_gate_fallback": 0,
        "url_timeout_hits": 0,
        "low_signal_hits": 0,
    }
    b = {
        "gate_passed": False,
        "signals_discovered": 3,
        "final_confidence": 0.7,
        "runtime_seconds": 200,
        "schema_gate_fallback": 0,
        "url_timeout_hits": 0,
        "low_signal_hits": 0,
    }
    assert compute_objective_score(a) > compute_objective_score(b)


def test_score_penalizes_schema_fallback_and_low_signal():
    clean = {
        "gate_passed": True,
        "signals_discovered": 2,
        "final_confidence": 0.6,
        "runtime_seconds": 200,
        "schema_gate_fallback": 0,
        "url_timeout_hits": 0,
        "low_signal_hits": 0,
    }
    noisy = dict(clean)
    noisy["schema_gate_fallback"] = 2
    noisy["low_signal_hits"] = 2
    assert compute_objective_score(clean) > compute_objective_score(noisy)


def test_select_knee_prefers_smallest_cap_meeting_thresholds():
    rows = [
        {"hop_cap": 1, "gate_passed": False, "signals_discovered": 1, "final_confidence": 0.58, "runtime_seconds": 200},
        {"hop_cap": 2, "gate_passed": True, "signals_discovered": 2, "final_confidence": 0.58, "runtime_seconds": 300},
        {"hop_cap": 3, "gate_passed": True, "signals_discovered": 3, "final_confidence": 0.67, "runtime_seconds": 500},
    ]
    rec = select_recommended_cap(rows, thresholds=CapThresholds(min_confidence=0.55, min_signals=2))
    assert rec["recommended_cap"] == 2
    assert rec["needs_tuning"] is False


def test_select_flags_needs_tuning_when_none_pass():
    rows = [
        {"hop_cap": 1, "gate_passed": False, "signals_discovered": 1, "final_confidence": 0.52, "runtime_seconds": 100},
        {"hop_cap": 2, "gate_passed": False, "signals_discovered": 1, "final_confidence": 0.54, "runtime_seconds": 150},
    ]
    rec = select_recommended_cap(rows)
    assert rec["needs_tuning"] is True
    assert rec["recommended_cap"] in {1, 2}
