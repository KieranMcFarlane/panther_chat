from pathlib import Path
import json
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from question_inventory_builder import build_question_inventory, write_question_inventory


def test_build_question_inventory_separates_dossier_and_discovery_questions(tmp_path):
    inventory = build_question_inventory(BACKEND_DIR)

    assert inventory["summary"]["entity_type_question_counts"] == {
        "SPORT_CLUB": 7,
        "SPORT_FEDERATION": 6,
        "SPORT_LEAGUE": 6,
    }
    assert inventory["summary"]["entity_type_question_total"] == 19
    assert inventory["summary"]["section_question_total"] == 50
    assert inventory["summary"]["dossier_question_total"] > 0
    assert inventory["summary"]["discovery_question_total"] > 0
    assert inventory["summary"]["artifact_question_total"] >= 0
    assert inventory["summary"]["flat_question_total"] == inventory["summary"]["unique_question_count"]
    assert inventory["summary"]["flat_question_total"] >= 69
    assert inventory["section_breakdown_candidates"]
    assert inventory["pack_role"] == "dossier"

    entity_type_questions = inventory["question_sets"]["entity_type_questions"]
    section_questions = inventory["question_sets"]["section_questions"]
    dossier_questions = inventory["question_sets"]["dossier_questions"]
    discovery_questions = inventory["question_sets"]["discovery_questions"]
    review_sections = inventory["review_sections"]
    flat_questions = inventory["flat_questions"]

    assert any(
        "mobile app" in entry["question"].lower()
        and "last 180 days" in entry["question"].lower()
        for entry in entity_type_questions
    )
    assert any(
        "fan experience" in entry["question"].lower()
        and "last 180 days" in entry["question"].lower()
        for entry in entity_type_questions
    )
    assert any(
        entry["question"] == "What is the entity's official name, type, and primary sport/industry?"
        for entry in section_questions
    )
    assert any(question["pack_role"] == "dossier" for question in dossier_questions)
    assert any(question["pack_role"] == "discovery" for question in discovery_questions)
    assert any(
        question["metadata"].get("section_id") == "core_information" and question["pack_role"] == "dossier"
        for question in dossier_questions
    )
    assert any(
        question["metadata"].get("section_id") == "ai_reasoner_assessment" and question["pack_role"] == "discovery"
        for question in discovery_questions
    )
    assert isinstance(review_sections, list)
    assert inventory["summary"]["review_section_count"] == len(review_sections)
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
    assert written["summary"]["entity_type_question_total"] == 19
    assert written["summary"]["dossier_question_total"] > 0
    assert written["summary"]["discovery_question_total"] > 0
    assert "flat_questions" in written
