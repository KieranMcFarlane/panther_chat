from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_inventory_builder import build_and_write_default_inventory
from question_pack_pruner import build_and_write_default_review_pack
from question_pack_final_ralph import build_final_ralph_pack


def test_build_final_ralph_pack_prunes_weak_tail_and_splits_dense_sections():
    inventory_path = build_and_write_default_inventory(BACKEND_DIR)
    review_pack_path = build_and_write_default_review_pack(inventory_path)

    final_pack = build_final_ralph_pack(review_pack_path)
    questions = final_pack["final_ralph_pack"]["questions"]

    assert final_pack["summary"]["final_question_count"] < 77
    assert final_pack["summary"]["final_question_count"] > 30
    assert len(questions) == final_pack["summary"]["final_question_count"]
    assert questions == sorted(questions, key=lambda item: item["final_goal_score"], reverse=True)
    assert len({item["normalized_prompt"] for item in questions}) == len(questions)

    assert all(item["final_goal_bucket"] != "weak_signal" for item in questions)
    assert not any("top competitors" in item["prompt"].lower() for item in questions)
    assert any("website platform is in use" in item["prompt"].lower() for item in questions)
    assert any("crm system is in use" in item["prompt"].lower() for item in questions)
    assert any("analytics platform is in use" in item["prompt"].lower() for item in questions)
    assert any(item["section_title"] == "Digital Transformation" for item in questions)
