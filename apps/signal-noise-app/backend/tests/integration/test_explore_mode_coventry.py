import sys
from pathlib import Path

import pytest

repo_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(repo_root))

from scripts.benchmark_explore_mode import evaluate_explore_mode_gate


@pytest.mark.integration
def test_coventry_explore_mode_beats_baseline_confidence():
    run_summary = {
        "entity": "coventry-city-fc",
        "discovery_confidence": 0.71,
        "official_site_selected_url": "https://www.ccfc.co.uk",
        "official_site_lane_statuses": {"search:google": "hit"},
        "official_site_dead_end": False,
    }

    gate = evaluate_explore_mode_gate(
        run_summary,
        baseline_confidence=0.50,
        target_confidence=0.65,
        expected_domain="ccfc.co.uk",
    )

    assert gate["passed"] is True
