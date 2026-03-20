from pathlib import Path


def test_regression_batch_script_sets_dossier_runtime_contract():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "run-pipeline-regression-batch.sh"
    script_text = script_path.read_text()

    assert "DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS" in script_text
    assert "DOSSIER_PARALLEL_COLLECTION_TIMEOUT_SECONDS" in script_text
    assert "DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE" in script_text
    assert "DISCOVERY_ENGINE" in script_text
    assert "DISCOVERY_POLICY_EVIDENCE_FIRST" in script_text
    assert "PIPELINE_LEAN_VERIFY" in script_text
    assert "DISCOVERY_PER_ITERATION_TIMEOUT_SECONDS" in script_text
    assert "DISCOVERY_MAX_RETRIES" in script_text
    assert "DISCOVERY_MAX_SAME_DOMAIN_REVISITS" in script_text
    assert "BATCH_SUMMARY_PATH" in script_text
    assert "--template-id" not in script_text
    assert "resolve_template_id" not in script_text
