from pathlib import Path
import json
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_inventory_builder import build_question_inventory, write_question_inventory


def test_build_question_inventory_combines_tier_questions_section_questions_and_arsenal_reviews(tmp_path):
    inventory = build_question_inventory(BACKEND_DIR)

    assert inventory["summary"]["entity_type_question_counts"] == {
        "SPORT_CLUB": 7,
        "SPORT_FEDERATION": 6,
        "SPORT_LEAGUE": 5,
    }
    assert inventory["summary"]["entity_type_question_total"] == 18
    assert inventory["summary"]["section_question_total"] == 50
    assert inventory["summary"]["arsenal_section_count"] == 11
    assert inventory["summary"]["artifact_question_total"] > 0
    assert inventory["summary"]["flat_question_total"] == inventory["summary"]["unique_question_count"]
    assert inventory["summary"]["flat_question_total"] > 70
    assert inventory["section_breakdown_candidates"]

    entity_type_questions = inventory["question_sets"]["entity_type_questions"]
    section_questions = inventory["question_sets"]["section_questions"]
    review_sections = inventory["review_sections"]
    flat_questions = inventory["flat_questions"]

    assert any(
        entry["question"] == "What mobile app or fan engagement platform investments are planned by {entity}?"
        for entry in entity_type_questions
    )
    assert any(
        entry["question"] == "What is the entity's official name, type, and primary sport/industry?"
        for entry in section_questions
    )
    assert any(
        section["entity_id"] == "arsenal-fc" and section["title"] == "Basic entity information"
        for section in review_sections
    )
    assert any(
        entry["question"] == "What is the entity's official name, type, and primary sport/industry?"
        for entry in flat_questions
    )
    assert any(
        item["section_id"] == "core_information" and item["question_count"] >= 5
        for item in inventory["section_breakdown_candidates"]
    )

    output_path = tmp_path / "dossier-question-inventory.json"
    write_question_inventory(output_path, inventory)

    written = json.loads(output_path.read_text())
    assert written["summary"]["entity_type_question_total"] == 18
    assert written["summary"]["arsenal_section_count"] == 11
    assert "flat_questions" in written
