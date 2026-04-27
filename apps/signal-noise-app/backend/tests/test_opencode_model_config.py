from pathlib import Path
import json
import sys

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import main
import pipeline_orchestrator


def test_opencode_model_defaults_use_zai_coding_plan_glm_5_1():
    config_path = Path(__file__).resolve().parents[4] / "opencode.json"
    config = json.loads(config_path.read_text())

    assert main.DEFAULT_OPENCODE_PROVIDER == "zai-coding-plan"
    assert main.DEFAULT_OPENCODE_MODEL_ID == "glm-5.1"
    assert main.DEFAULT_OPENCODE_MODEL == "zai-coding-plan/glm-5.1"
    assert pipeline_orchestrator.DEFAULT_OPENCODE_MODEL == "zai-coding-plan/glm-5.1"
    assert config["model"] == "zai-coding-plan/glm-5.1"
    assert "glm-5.1" in config["provider"]["zai-coding-plan"]["models"]
