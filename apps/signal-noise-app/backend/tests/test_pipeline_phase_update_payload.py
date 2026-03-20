#!/usr/bin/env python3
"""
Tests for live pipeline phase update metadata merging.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from pipeline_run_metadata import merge_pipeline_phase_metadata, validate_runtime_imports


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


def test_merge_pipeline_phase_metadata_supports_explicit_phase_and_normalized_status():
    existing_metadata = {
        "phase_details_by_phase": {
            "dossier_generation": {"status": "completed"},
        }
    }
    payload = {
        "status": "unknown_status",
        "iteration": 3,
    }

    merged = merge_pipeline_phase_metadata(existing_metadata, "discovery", payload)

    assert merged["phase_details"]["phase"] == "discovery"
    assert merged["phase_details"]["status"] == "running"
    assert merged["phase_details_by_phase"]["dossier_generation"]["status"] == "completed"
    assert merged["phase_details_by_phase"]["discovery"]["iteration"] == 3
    assert merged["phase_details_by_phase"]["discovery"]["status"] == "running"


def test_validate_runtime_imports_returns_single_failure_class():
    payload = validate_runtime_imports(
        {
            "json_module": ("json",),
            "missing_module": ("missing_module_that_should_not_exist_123",),
        }
    )

    assert payload["status"] == "failed"
    assert payload["checked"]["json_module"] == "json"
    assert payload["missing"] == ["missing_module"]
    assert payload["failure_class"] == "import_context_failure"


def test_validate_runtime_imports_default_targets_load_in_canonical_context():
    payload = validate_runtime_imports()

    assert payload["status"] == "ok"
    assert "template_loader" in payload["checked"]
    assert "dossier_question_extractor" in payload["checked"]
    assert payload["missing"] == []
