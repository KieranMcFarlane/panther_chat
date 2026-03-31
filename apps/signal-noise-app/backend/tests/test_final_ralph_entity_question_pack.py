from pathlib import Path
import sys
import json


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import final_ralph_entity_question_pack as pack_module
from final_ralph_entity_question_pack import (
    build_final_ralph_entity_question_pack,
    write_final_ralph_entity_question_pack,
)

TEST_PACK_PATH = BACKEND_DIR / "tests" / "_tmp_dossier_question_final_ralph_pack.json"


def setup_function():
    pack_module._load_final_ralph_pack.cache_clear()
    if TEST_PACK_PATH.exists():
        TEST_PACK_PATH.unlink()


def teardown_function():
    pack_module._load_final_ralph_pack.cache_clear()
    if TEST_PACK_PATH.exists():
        TEST_PACK_PATH.unlink()


def test_build_final_ralph_entity_question_pack_returns_final_pack_shape():
    pack_module.FINAL_RALPH_PACK_PATH = TEST_PACK_PATH
    pack = build_final_ralph_entity_question_pack(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=6,
    )

    assert pack["pack_role"] == "discovery"
    assert pack["entity_name"] == "Arsenal FC"
    assert pack["entity_type"] == "SPORT_CLUB"
    assert pack["question_count"] == 6
    assert len(pack["questions"]) == 6
    assert pack["questions"][0]["question"].startswith("Verify whether")
    assert pack["questions"][0]["final_goal_bucket"] == "direct_revenue_signal"
    assert pack["prompt_context"].startswith("Final Ralph pack")
    assert pack["questions"][0]["yp_service_fit"]
    assert pack["questions"][0]["pack_role"] == "discovery"


def test_build_final_ralph_entity_question_pack_exposes_persisted_writeback_metadata():
    pack_module.FINAL_RALPH_PACK_PATH = TEST_PACK_PATH
    pack = build_final_ralph_entity_question_pack(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=2,
    )

    writeback = pack["service_context"]["writeback"]

    assert writeback["artifact_path"].endswith("dossier_question_final_ralph_pack.json")
    assert writeback["persisted"] is True
    assert writeback["question_count"] == pack["question_count"]


def test_write_final_ralph_entity_question_pack_persists_artifact(tmp_path, monkeypatch):
    monkeypatch.setattr(pack_module, "FINAL_RALPH_PACK_PATH", tmp_path / "dossier_question_final_ralph_pack.json")
    pack_module._load_final_ralph_pack.cache_clear()

    pack = build_final_ralph_entity_question_pack(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=2,
    )
    output_path = write_final_ralph_entity_question_pack(pack)

    assert output_path == tmp_path / "dossier_question_final_ralph_pack.json"
    persisted = json.loads(output_path.read_text(encoding="utf-8"))
    assert persisted["entity_name"] == "Arsenal FC"
    assert persisted["questions"][0]["question"] == pack["questions"][0]["question"]
    assert pack["service_context"]["writeback"]["persisted"] is True
