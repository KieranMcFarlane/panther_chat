#!/usr/bin/env python3
"""
Tests for live pipeline phase update metadata merging.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from pipeline_run_metadata import merge_pipeline_phase_metadata


def test_merge_pipeline_phase_metadata_preserves_existing_fields_and_adds_discovery_summary():
    existing_metadata = {
        "source": "manual_live_test",
        "priority_score": 50,
        "phase_details": {"status": "running", "iteration": 1},
    }
    payload = {
        "status": "running",
        "iteration": 2,
        "hop_type": "official_site",
        "performance_summary": {
            "iterations_with_timings": 1,
            "hop_timings": [{"iteration": 1, "duration_ms": 1200.0}],
        },
        "discovery_context": {
            "template_id": "federation_governing_body",
        },
    }

    merged = merge_pipeline_phase_metadata(existing_metadata, payload)

    assert merged["source"] == "manual_live_test"
    assert merged["priority_score"] == 50
    assert merged["phase_details"]["iteration"] == 2
    assert merged["performance_summary"]["iterations_with_timings"] == 1
    assert merged["discovery_context"]["template_id"] == "federation_governing_body"
