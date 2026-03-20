from pathlib import Path


def test_model_comparison_script_wires_parallel_model_runs():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "run-model-comparison.sh"
    script_text = script_path.read_text()

    assert "CHUTES_MODEL_PRIMARY=\"$model\"" in script_text
    assert "CHUTES_MODEL_SECONDARY=\"$model\"" in script_text
    assert "CHUTES_MODEL_TERTIARY=\"$model\"" in script_text
    assert "PIPELINE_LEAN_VERIFY" in script_text
    assert "BATCH_SUMMARY_PATH" in script_text
    assert "bash scripts/run-pipeline-regression-batch.sh" in script_text
    assert "&" in script_text
