#!/usr/bin/env python3
"""
Tests for live pipeline phase update metadata merging.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from main import build_dossier_response_metadata, build_dossier_running_phase_metadata
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
        "monitoring_summary": {
            "pages_fetched": 4,
            "candidate_count": 2,
        },
        "escalation_reason": "baseline_monitoring_ambiguous",
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
    assert merged["monitoring_summary"]["pages_fetched"] == 4
    assert merged["escalation_reason"] == "baseline_monitoring_ambiguous"
    assert merged["performance_summary"]["iterations_with_timings"] == 1
    assert merged["discovery_context"]["template_id"] == "federation_governing_body"


def test_build_dossier_response_metadata_includes_phase0_source_details():
    metadata = build_dossier_response_metadata(
        {
            "generation_time_seconds": 42.5,
            "metadata": {
                "hypothesis_count": 3,
                "signal_count": 2,
                "data_freshness": 95,
                "source_count": 4,
                "sources_used": ["official_website", "job_postings"],
                "source_timings": {
                    "official_website": {"duration_seconds": 2.1, "status": "success"},
                },
                "collection_time_seconds": 7.8,
                "canonical_sources": {
                    "official_site": "https://www.canoeicf.com",
                },
                "generation_mode": "compact_timeout_fallback",
                "collection_timed_out": True,
                "model_max_tokens": 900,
            },
        },
        tier="STANDARD",
        priority_score=85,
        total_cost_usd=0.42,
    )

    assert metadata["tier"] == "STANDARD"
    assert metadata["priority_score"] == 85
    assert metadata["generation_time_seconds"] == 42.5
    assert metadata["source_count"] == 4
    assert metadata["sources_used"] == ["official_website", "job_postings"]
    assert metadata["source_timings"]["official_website"]["duration_seconds"] == 2.1
    assert metadata["collection_time_seconds"] == 7.8
    assert metadata["canonical_sources"]["official_site"] == "https://www.canoeicf.com"
    assert metadata["generation_mode"] == "compact_timeout_fallback"
    assert metadata["collection_timed_out"] is True
    assert metadata["model_max_tokens"] == 900


def test_build_dossier_running_phase_metadata_includes_known_phase0_context():
    payload = build_dossier_running_phase_metadata(
        entity_name="ICF Verification Alpha",
        entity_type="FEDERATION",
        priority_score=85,
    )

    assert payload["status"] == "running"
    assert payload["entity_name"] == "ICF Verification Alpha"
    assert payload["entity_type"] == "FEDERATION"
    assert payload["priority_score"] == 85
    assert payload["current_substep"] == "cache_lookup"
    assert payload["phase0_substeps"]["cache_lookup"]["status"] == "pending"
    assert payload["phase0_substeps"]["persist_dossier"]["status"] == "pending"
    assert "inference_runtime" in payload
    assert payload["inference_runtime"]["provider"] in {"anthropic", "chutes_openai"}
