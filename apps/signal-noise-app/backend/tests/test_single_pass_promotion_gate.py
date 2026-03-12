import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
scripts_dir = app_dir / "scripts"
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(scripts_dir))

from run_single_pass_entity import _has_trusted_source_signal, _promotion_gate


def test_promotion_gate_passes_with_llm_trusted_signal_and_confidence():
    payload = {
        "final_confidence": 0.62,
        "signals_discovered": [{"source": "official_site", "url": "https://example.com/procurement"}],
        "performance_summary": {
            "evaluation_mode": "llm",
            "hop_timings": [{"decision": "WEAK_ACCEPT"}],
        },
    }

    gate = _promotion_gate(payload, min_confidence=0.55)

    assert gate["promotion_gate_passed"] is True
    assert gate["promotion_gate_reasons"] == []


def test_promotion_gate_blocks_heuristic_or_no_progress_paths():
    payload = {
        "final_confidence": 0.70,
        "signals_discovered": [{"source": "official_site"}],
        "performance_summary": {
            "evaluation_mode": "heuristic",
            "hop_timings": [{"decision": "NO_PROGRESS"}],
        },
    }

    gate = _promotion_gate(payload, min_confidence=0.55)

    assert gate["promotion_gate_passed"] is False
    assert "evaluation_mode_not_llm" in gate["promotion_gate_reasons"]
    assert "decision_no_progress" in gate["promotion_gate_reasons"]


def test_has_trusted_source_signal_detects_official_tokens():
    assert _has_trusted_source_signal([
        {"source": "verified_press", "url": "https://example.com/press/news"}
    ]) is True
    assert _has_trusted_source_signal([
        {"source": "social", "url": "https://x.com/post"}
    ]) is False
