from pathlib import Path
import json


def test_mlc_rfp_broad_source_exists_and_matches_question_source_shape():
    source_path = Path(__file__).resolve().parent.parent / "data" / "question_sources" / "mlc_rfp_broad.json"
    assert source_path.exists(), f"Missing checked-in canary source: {source_path}"

    payload = json.loads(source_path.read_text(encoding="utf-8"))
    assert payload["entity_id"] == "major-league-cricket"
    assert payload["entity_name"] == "Major League Cricket"
    assert payload["entity_type"] == "SPORT_LEAGUE"
    assert payload["preset"] == "mlc-rfp-broad"
    assert len(payload["questions"]) == 7

    expected = [
        ("q1_rfp", "Major League Cricket RFP"),
        ("q2_tender", "Major League Cricket tender"),
        ("q3_procurement", "Major League Cricket procurement"),
        ("q4_vendor", "Major League Cricket vendor"),
        ("q5_digital_transformation", "Major League Cricket digital transformation"),
        ("q6_broadcast_partner", "Major League Cricket broadcast partner"),
        ("q7_fan_engagement_platform", "Major League Cricket fan engagement platform"),
    ]
    for question, (question_id, query) in zip(payload["questions"], expected, strict=True):
        assert question["question_id"] == question_id
        assert question["question_type"] == "procurement"
        assert "{entity}" in question["question"]
        assert question["query"] == query
        assert question["hop_budget"] == 2
        assert question["evidence_extension_confidence_threshold"] == 0.65
        assert question["source_priority"] == [
            "google_serp",
            "linkedin_posts",
            "news",
            "press_release",
            "official_site",
        ]
