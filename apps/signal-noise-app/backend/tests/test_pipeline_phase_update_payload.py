#!/usr/bin/env python3
"""
Tests for live pipeline phase update metadata merging.
"""

import sys
from pathlib import Path
from pathlib import Path as _Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))
main_source = _Path(backend_dir / "main.py").read_text(encoding="utf-8")

from main import (
    build_dossier_response_metadata,
    build_dossier_running_phase_metadata,
    build_inference_runtime_metadata,
    determine_dossier_tier_from_priority,
)
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

    merged = merge_pipeline_phase_metadata(existing_metadata, "discovery", payload)

    assert merged["source"] == "manual_live_test"
    assert merged["priority_score"] == 50
    assert merged["phase_details"]["iteration"] == 2
    assert merged["phase_details_by_phase"]["discovery"]["iteration"] == 2
    assert merged["monitoring_summary"]["pages_fetched"] == 4
    assert merged["escalation_reason"] == "baseline_monitoring_ambiguous"
    assert merged["performance_summary"]["iterations_with_timings"] == 1
    assert merged["discovery_context"]["template_id"] == "federation_governing_body"


def test_merge_pipeline_phase_metadata_preserves_existing_phase0_substeps_when_dossier_completes():
    existing_metadata = {
        "phase_details_by_phase": {
            "dossier_generation": {
                "status": "running",
                "current_substep": "connect_brightdata",
                "phase0_substeps": {
                    "connect_falkordb": {"status": "completed", "duration_seconds": 0.4},
                    "connect_brightdata": {"status": "running"},
                },
            },
        },
    }
    payload = {
        "status": "completed",
        "source_count": 2,
        "sources_used": ["official_website", "wikipedia"],
    }

    merged = merge_pipeline_phase_metadata(existing_metadata, "dossier_generation", payload)

    dossier_details = merged["phase_details_by_phase"]["dossier_generation"]
    assert dossier_details["status"] == "completed"
    assert dossier_details["source_count"] == 2
    assert dossier_details["phase0_substeps"]["connect_falkordb"]["status"] == "completed"
    assert dossier_details["phase0_substeps"]["connect_brightdata"]["status"] == "running"


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
                "inference_runtime": {
                    "provider": "anthropic",
                    "chutes_model": None,
                    "chutes_fallback_model": None,
                    "chutes_timeout_seconds": 45.0,
                    "chutes_fallback_timeout_seconds": 90.0,
                    "chutes_stream_enabled": True,
                    "chutes_stream_idle_timeout_seconds": 45.0,
                    "chutes_max_retries": 1,
                },
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
    assert metadata["inference_runtime"]["provider"] == "anthropic"
    assert metadata["inference_runtime"]["chutes_stream_enabled"] is True


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
    assert payload["phase0_substeps"]["connect_falkordb"]["status"] == "pending"
    assert payload["phase0_substeps"]["brightdata_search_official"]["status"] == "pending"
    assert payload["phase0_substeps"]["persist_dossier"]["status"] == "pending"
    assert "inference_runtime" in payload
    assert payload["inference_runtime"]["provider"] in {"anthropic", "chutes_openai", "chutes_anthropic"}


def test_build_dossier_running_phase_metadata_includes_dynamic_source_substeps():
    payload = build_dossier_running_phase_metadata(
        entity_name="ICF Verification Alpha",
        entity_type="FEDERATION",
        priority_score=85,
        phase0_substeps={
            "connect_falkordb": {"status": "completed", "duration_seconds": 0.3},
            "custom_source_step": {"status": "timeout", "duration_seconds": 20.0},
        },
    )

    assert payload["phase0_substeps"]["connect_falkordb"]["status"] == "completed"
    assert payload["phase0_substeps"]["custom_source_step"]["status"] == "timeout"


def test_determine_dossier_tier_from_priority_marks_scores_above_50_as_premium():
    assert determine_dossier_tier_from_priority(50) == "STANDARD"
    assert determine_dossier_tier_from_priority(60) == "PREMIUM"


def test_build_inference_runtime_metadata_prefers_runtime_client_over_env(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "chutes_openai")
    monkeypatch.setenv("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    monkeypatch.setenv("CHUTES_STREAM_ENABLED", "false")
    monkeypatch.setenv("CHUTES_FALLBACK_TIMEOUT_SECONDS", "90")

    class RuntimeClaudeClient:
        provider = "anthropic"
        chutes_model = "unused"
        chutes_fallback_model = "fallback-model"
        chutes_timeout_seconds = 12
        chutes_fallback_timeout_seconds = 30
        chutes_stream_idle_timeout_seconds = 8
        chutes_stream_enabled = True
        chutes_max_retries = 3

    runtime = build_inference_runtime_metadata(RuntimeClaudeClient())

    assert runtime["provider"] == "anthropic"
    assert runtime["chutes_model"] == "unused"
    assert runtime["chutes_fallback_model"] == "fallback-model"
    assert runtime["chutes_timeout_seconds"] == 12
    assert runtime["chutes_fallback_timeout_seconds"] == 30
    assert runtime["chutes_stream_idle_timeout_seconds"] == 8
    assert runtime["chutes_stream_enabled"] is True
    assert runtime["chutes_max_retries"] == 3


def test_merge_pipeline_phase_metadata_keeps_non_null_dossier_inference_runtime_fields():
    existing_metadata = {
        "phase_details_by_phase": {
            "dossier_generation": {
                "status": "running",
                "current_substep": "generate_dossier_content",
            },
        },
    }
    payload = {
        "status": "completed",
        "reason": None,
        "inference_runtime": {
            "provider": "chutes_openai",
            "model_used": "zai-org/GLM-5-TEE",
            "streaming": True,
            "fallback_used": False,
            "chunk_count": 1196,
            "answer_channel_chars": 12372,
            "reasoning_channel_chars": 3851,
            "stop_reason": "stop",
        },
    }

    merged = merge_pipeline_phase_metadata(existing_metadata, "dossier_generation", payload)
    dossier_phase = merged["phase_details_by_phase"]["dossier_generation"]
    inference_runtime = dossier_phase["inference_runtime"]

    assert inference_runtime["provider"] == "chutes_openai"
    assert inference_runtime["model_used"] == "zai-org/GLM-5-TEE"
    assert inference_runtime["streaming"] is True
    assert inference_runtime["fallback_used"] is False
    assert inference_runtime["chunk_count"] > 0
    assert inference_runtime["answer_channel_chars"] > 0
    assert inference_runtime["reasoning_channel_chars"] >= 0
    assert isinstance(inference_runtime["stop_reason"], str)


def test_generate_dossier_route_uses_shared_tier_helper_for_persistence():
    assert 'tier = determine_dossier_tier_from_priority(request.priority_score)' in main_source


def test_run_entity_pipeline_prefers_dossier_response_runtime_metadata_for_final_phase_emit():
    assert 'dossier_response.metadata.get("inference_runtime") or phase0_runtime' in main_source
