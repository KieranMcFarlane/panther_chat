import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from entity_pipeline_worker import (
    build_run_detail_url,
    merge_cached_entity_properties,
    should_process_in_process,
)


def test_should_process_in_process_defaults_true_for_local_mode():
    assert should_process_in_process(None) is True
    assert should_process_in_process("in_process") is True
    assert should_process_in_process("durable_worker") is False


def test_build_run_detail_url_points_to_import_run_detail_page():
    assert (
        build_run_detail_url("batch-1", "entity-1")
        == "/entity-import/batch-1/entity-1"
    )


def test_merge_cached_entity_properties_persists_pipeline_status_fields():
    merged = merge_cached_entity_properties(
        {"name": "International Canoe Federation"},
        batch_id="batch-1",
        entity_id="icf",
        status="completed",
        sales_readiness="MONITOR",
        rfp_count=2,
        dossier={"entity_id": "icf"},
    )

    assert merged["last_pipeline_batch_id"] == "batch-1"
    assert merged["last_pipeline_run_detail_url"] == "/entity-import/batch-1/icf"
    assert merged["last_pipeline_status"] == "completed"
    assert merged["rfp_count"] == 2
    assert merged["sales_readiness"] == "MONITOR"
    assert merged["dossier_data"] is not None
