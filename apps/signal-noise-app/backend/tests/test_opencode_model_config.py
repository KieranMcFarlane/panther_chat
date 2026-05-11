from pathlib import Path
import sys

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(backend_dir))

import main
import pipeline_orchestrator


def test_opencode_model_defaults_use_zai_coding_plan_glm_5_1():
    batch_script = (app_dir / "scripts" / "opencode_agentic_batch.mjs").read_text()

    assert main.DEFAULT_OPENCODE_PROVIDER == "zai-coding-plan"
    assert main.DEFAULT_OPENCODE_MODEL_ID == "glm-5.1"
    assert main.DEFAULT_OPENCODE_MODEL == "zai-coding-plan/glm-5.1"
    assert pipeline_orchestrator.DEFAULT_OPENCODE_MODEL == "zai-coding-plan/glm-5.1"
    assert "const FALLBACK_PREFETCH_MODEL_ID = 'glm-5.1';" in batch_script
    assert "const FALLBACK_SYNTHESIS_MODEL_ID = 'glm-5.1';" in batch_script
    assert "const FALLBACK_PREFETCH_MODEL_ID = 'glm-4.7-flash';" not in batch_script
    assert "const FALLBACK_SYNTHESIS_MODEL_ID = 'glm-4.5-air';" not in batch_script
