from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import final_ralph_entity_question_pack as pack_module
from final_ralph_entity_question_pack import build_final_ralph_entity_question_pack

TEST_PACK_PATH = BACKEND_DIR / "tests" / "_tmp_atomic_dossier_question_final_ralph_pack.json"


def setup_function():
    pack_module._load_final_ralph_pack.cache_clear()
    if TEST_PACK_PATH.exists():
        TEST_PACK_PATH.unlink()


def teardown_function():
    pack_module._load_final_ralph_pack.cache_clear()
    if TEST_PACK_PATH.exists():
        TEST_PACK_PATH.unlink()


def test_build_final_ralph_entity_question_pack_exposes_atomic_discovery_shape():
    pack_module.FINAL_RALPH_PACK_PATH = TEST_PACK_PATH

    pack = build_final_ralph_entity_question_pack(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=6,
    )

    assert pack["pack_role"] == "discovery"
    assert pack["pack_stage"] == "final_ralph"
    assert pack["question_count"] == 6
    assert all(question["pack_role"] == "discovery" for question in pack["questions"])
    assert all(question["question_shape"] == "atomic" for question in pack["questions"])
    assert all(question["evidence_focus"] for question in pack["questions"])
    assert all(question["promotion_target"] for question in pack["questions"])
    assert all(question["answer_kind"] for question in pack["questions"])
    assert all(
        "recommendation" not in question["question"].lower()
        and "strategic hooks" not in question["question"].lower()
        and "success probability" not in question["question"].lower()
        for question in pack["questions"]
    )
