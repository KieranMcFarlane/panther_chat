from pathlib import Path
import json


def test_arsenal_atomic_smoke_source_exists_and_matches_question_source_shape():
    source_path = Path(__file__).resolve().parent.parent / "data" / "question_sources" / "arsenal_atomic_3.json"
    assert source_path.exists(), f"Missing checked-in atomic smoke source: {source_path}"

    payload = json.loads(source_path.read_text(encoding="utf-8"))
    assert payload["entity_id"] == "arsenal_fc"
    assert payload["entity_name"] == "Arsenal Football Club"
    assert payload["entity_type"] == "SPORT_CLUB"
    assert payload["preset"] == "arsenal-atomic-3"
    assert len(payload["questions"]) == 3

    for question in payload["questions"]:
      assert question["question_id"]
      assert question["question_type"] in {"foundation", "procurement", "poi"}
      assert "{entity}" in question["question"]
      assert question["query"]
      assert question["hop_budget"] >= 1
      assert question["source_priority"]
