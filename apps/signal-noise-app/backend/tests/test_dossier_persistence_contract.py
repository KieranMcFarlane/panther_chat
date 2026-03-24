import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import main  # noqa: E402
from dossier_persistence import (  # noqa: E402
    apply_dashboard_score_persistence_context,
    build_dossier_persistence_context,
    finalize_run_report_payload,
)
from dossier_generator import EntityDossierGenerator  # noqa: E402


def test_build_dossier_persistence_context_adds_browser_and_source_urls_and_monitor_state():
    dossier = {
        "metadata": {
            "entity_id": "international-canoe-federation",
            "generated_at": "2026-03-24T15:16:53+00:00",
            "canonical_sources": {
                "official_site": "https://canoeicf.com",
            },
        },
        "procurement_signals": {
            "upcoming_opportunities": [],
        },
        "leadership_analysis": {
            "decision_makers": [],
        },
    }

    enrichment = build_dossier_persistence_context(
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        dossier=dossier,
        entity_data={"official_site_url": "https://canoeicf.com"},
        run_objective="dossier_core",
    )

    assert enrichment["browser_dossier_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert enrichment["source_url"] == "https://canoeicf.com"
    assert enrichment["page_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert enrichment["opportunity_score"] == 0
    assert enrichment["rfp_confidence"] == 0.0
    assert enrichment["signal_state"] == "monitor_no_opportunity"
    assert "No procurement opportunity detected" in enrichment["decision_summary"]
    assert enrichment["last_pipeline_run_ref"]["entity_id"] == "international-canoe-federation"


def test_build_dossier_persistence_context_scores_detected_opportunities():
    dossier = {
        "metadata": {
            "entity_id": "arsenal-fc",
            "generated_at": "2026-03-24T15:16:53+00:00",
            "canonical_sources": {
                "official_site": "https://arsenal.com",
            },
        },
        "procurement_signals": {
            "upcoming_opportunities": [
                {
                    "opportunity": "CRM refresh",
                    "rfp_probability": 82,
                    "type": "implementation",
                    "timeline": "6-12 months",
                }
            ],
        },
        "leadership_analysis": {
            "decision_makers": [
                {"name": "Jane Doe", "role": "Commercial Director"},
            ],
        },
    }

    enrichment = build_dossier_persistence_context(
        entity_id="arsenal-fc",
        entity_name="Arsenal FC",
        dossier=dossier,
        entity_data={"website": "https://arsenal.com"},
        run_objective="rfp_web",
    )

    assert enrichment["browser_dossier_url"] == "/entity-browser/arsenal-fc/dossier"
    assert enrichment["source_url"] == "https://arsenal.com"
    assert enrichment["opportunity_score"] == 82
    assert enrichment["rfp_confidence"] == pytest.approx(0.82)
    assert enrichment["signal_state"] == "opportunity_high"
    assert "1 opportunity signal" in enrichment["decision_summary"]
    assert "Commercial Director" in enrichment["decision_summary"]


def test_finalize_run_report_payload_backfills_report_paths_before_write():
    payload = {
        "entity_id": "coventry-city-fc",
        "report_path": None,
        "run_report_path": None,
        "artifacts": {
            "dossier_path": "/tmp/coventry-dossier.json",
            "run_report_path": None,
        },
        "persistence_status": {"dual_write_ok": True},
    }

    finalized = finalize_run_report_payload(payload, "/tmp/coventry-report.json")

    assert finalized["report_path"] == "/tmp/coventry-report.json"
    assert finalized["run_report_path"] == "/tmp/coventry-report.json"
    assert finalized["artifacts"]["report_path"] == "/tmp/coventry-report.json"
    assert finalized["artifacts"]["run_report_path"] == "/tmp/coventry-report.json"
    assert finalized["persistence_status"]["dual_write_ok"] is True


def test_build_dossier_response_metadata_exposes_persistence_fields():
    dossier = {
        "generation_time_seconds": 42.5,
        "metadata": {
            "hypothesis_count": 3,
            "signal_count": 1,
            "data_freshness": 88,
            "source_count": 2,
            "sources_used": ["BrightData"],
            "source_timings": {"official_site": 1.2},
            "collection_time_seconds": 12.5,
            "canonical_sources": {"official_site": "https://canoeicf.com"},
            "page_url": "/entity-browser/international-canoe-federation/dossier",
            "browser_dossier_url": "/entity-browser/international-canoe-federation/dossier",
            "source_url": "https://canoeicf.com",
            "opportunity_score": 0,
            "rfp_confidence": 0.0,
            "signal_state": "monitor_no_opportunity",
            "decision_summary": "No procurement opportunity detected; decision makers: none; signal state: monitor_no_opportunity.",
            "last_pipeline_run_ref": {"entity_id": "international-canoe-federation"},
            "generation_mode": "standard",
            "collection_timed_out": False,
            "model_max_tokens": 1200,
            "inference_runtime": {"provider": "chutes_openai"},
        },
    }

    metadata = main.build_dossier_response_metadata(
        dossier,
        tier="STANDARD",
        priority_score=75,
        total_cost_usd=0.0142,
    )

    assert metadata["page_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert metadata["browser_dossier_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert metadata["source_url"] == "https://canoeicf.com"
    assert metadata["opportunity_score"] == 0
    assert metadata["rfp_confidence"] == 0.0
    assert metadata["signal_state"] == "monitor_no_opportunity"
    assert metadata["decision_summary"].startswith("No procurement opportunity detected")


def test_apply_dashboard_score_persistence_context_preserves_monitor_state_for_low_signal_entities():
    dossier = {
        "metadata": {
            "entity_id": "international-canoe-federation",
            "entity_name": "International Canoe Federation",
            "browser_dossier_url": "/entity-browser/international-canoe-federation/dossier",
            "source_url": "https://canoeicf.com",
            "signal_state": "monitor_no_opportunity",
            "opportunity_score": 0,
            "rfp_confidence": 0.0,
        }
    }

    enriched = apply_dashboard_score_persistence_context(
        dossier,
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        dashboard_scores={
            "procurement_maturity": 50.0,
            "active_probability": 0.10,
            "sales_readiness": "MONITOR",
        },
    )

    assert enriched["metadata"]["browser_dossier_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert enriched["metadata"]["source_url"] == "https://canoeicf.com"
    assert enriched["metadata"]["signal_state"] == "monitor_no_opportunity"
    assert enriched["metadata"]["opportunity_score"] == 0
    assert enriched["metadata"]["rfp_confidence"] == 0.0
    assert "monitor" in enriched["metadata"]["decision_summary"].lower()
    assert enriched["metadata"]["last_pipeline_run_ref"]["sales_readiness"] == "MONITOR"


def test_entity_dossier_generator_build_metadata_includes_persistence_urls():
    generator = EntityDossierGenerator(claude_client=object())

    metadata = generator._build_dossier_metadata(
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        entity_type="FEDERATION",
        priority_score=75,
        tier="PREMIUM",
        objective="dossier_core",
        entity_data={
            "official_site_url": "https://canoeicf.com",
            "entity_website": "https://canoeicf.com",
            "sport": "Canoeing",
        },
        dossier_data_obj=None,
    )

    assert metadata["browser_dossier_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert metadata["page_url"] == "/entity-browser/international-canoe-federation/dossier"
    assert metadata["source_url"] == "https://canoeicf.com"
    assert metadata["signal_state"] == "monitor_no_opportunity"
    assert metadata["last_pipeline_run_ref"]["entity_id"] == "international-canoe-federation"
