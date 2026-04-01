from pathlib import Path
import json


def test_arsenal_procurement_webfirst_source_exists_and_matches_question_source_shape():
    source_path = Path(__file__).resolve().parent.parent / "data" / "question_sources" / "arsenal_procurement_webfirst.json"
    assert source_path.exists(), f"Missing checked-in atomic smoke source: {source_path}"

    payload = json.loads(source_path.read_text(encoding="utf-8"))
    assert payload["entity_id"] == "arsenal_fc"
    assert payload["entity_name"] == "Arsenal Football Club"
    assert payload["entity_type"] == "SPORT_CLUB"
    assert payload["preset"] == "arsenal-procurement-webfirst"
    assert len(payload["questions"]) == 1

    question = payload["questions"][0]
    assert question["question_id"] == "q2b_public_procurement_or_tender"
    assert question["question_type"] == "procurement"
    assert "{entity}" in question["question"]
    assert question["query"] == "Arsenal Football Club procurement tender digital work"
    assert question["hop_budget"] == 1
    assert question["evidence_extension_confidence_threshold"] == 0.65
    assert question["source_priority"] == [
        "google_serp",
        "news",
        "press_release",
        "linkedin_posts",
        "official_site",
    ]
