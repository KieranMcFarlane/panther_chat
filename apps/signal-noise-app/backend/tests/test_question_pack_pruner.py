from pathlib import Path
import json
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_inventory_builder import build_and_write_default_inventory
from question_pack_pruner import build_question_review_pack, write_question_review_pack


def test_build_question_review_pack_creates_ultimate_pack_sections_and_merge_queue(tmp_path):
    inventory_path = build_and_write_default_inventory(BACKEND_DIR)
    review_pack = build_question_review_pack(inventory_path)

    assert review_pack["summary"]["ultimate_question_count"] == 77
    assert review_pack["summary"]["section_count"] == 11
    assert review_pack["summary"]["merge_or_drop_count"] > 0

    assert len(review_pack["ultimate_dossier_pack"]["questions"]) == 77
    assert len(review_pack["sections_to_keep"]) == 11
    assert review_pack["questions_to_drop_or_merge"]

    arsenal_section = next(
        section for section in review_pack["sections_to_keep"] if section["section_title"] == "AI Reasoner Assessment"
    )
    assert arsenal_section["decision"] == "split"

    merge_item = review_pack["questions_to_drop_or_merge"][0]
    assert "normalized_question" in merge_item
    assert "recommended_action" in merge_item

    output_path = tmp_path / "question-review-pack.json"
    write_question_review_pack(output_path, review_pack)

    written = json.loads(output_path.read_text())
    assert written["summary"]["ultimate_question_count"] == 77
    assert written["sections_to_keep"][0]["section_title"]
