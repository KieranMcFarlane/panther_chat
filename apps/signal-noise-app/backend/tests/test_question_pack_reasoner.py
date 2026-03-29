from pathlib import Path
import json
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_inventory_builder import build_and_write_default_inventory
from question_pack_pruner import build_and_write_default_review_pack
from question_pack_reasoner import build_question_reasoned_pack, write_question_reasoned_pack


def test_build_question_reasoned_pack_creates_optimized_duplicate(tmp_path):
    inventory_path = build_and_write_default_inventory(BACKEND_DIR)
    review_pack_path = build_and_write_default_review_pack(inventory_path)
    reasoned_pack = build_question_reasoned_pack(review_pack_path)

    assert reasoned_pack["summary"]["reasoned_question_count"] == 77
    assert reasoned_pack["summary"]["section_count"] == 11
    assert len(reasoned_pack["reasoned_dossier_pack"]["questions"]) == 77
    assert len(reasoned_pack["reasoned_sections_to_keep"]) == 11

    optimized_questions = reasoned_pack["reasoned_dossier_pack"]["questions"]

    core_question = next(
        item for item in optimized_questions if item["question"] == "What is the entity's official name, type, and primary sport/industry?"
    )
    assert core_question["optimized_question"].startswith("Verify the entity's official name")
    assert "authoritative sources" in core_question["optimization_notes"]

    digital_question = next(
        item for item in optimized_questions if item["question"] == "What digital transformation initiatives is {entity} undertaking or planning?"
    )
    assert "official site" in digital_question["optimized_question"].lower()
    assert "job postings" in digital_question["optimized_question"].lower()

    split_section = next(
        section for section in reasoned_pack["reasoned_sections_to_keep"] if section["section_title"] == "AI Reasoner Assessment"
    )
    assert split_section["decision"] == "split"
    assert "evidence-gated" in split_section["optimization_hint"].lower()

    output_path = tmp_path / "dossier-question-reasoned-pack.json"
    write_question_reasoned_pack(output_path, reasoned_pack)

    written = json.loads(output_path.read_text())
    assert written["summary"]["reasoned_question_count"] == 77
    assert "reasoned_dossier_pack" in written
