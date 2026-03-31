from backend.yellow_panther_catalog import build_entity_question_pack


def test_build_entity_question_pack_returns_catalog_questions_and_prompt_context():
    pack = build_entity_question_pack(
        entity_type="SPORT_CLUB",
        entity_name="Arsenal FC",
        entity_id="arsenal-fc",
        max_questions=3,
    )

    assert pack["pack_role"] == "discovery"
    assert pack["entity_type"] == "SPORT_CLUB"
    assert pack["entity_name"] == "Arsenal FC"
    assert pack["question_count"] == 3
    assert len(pack["questions"]) == 3
    assert "YELLOW PANTHER SERVICE CONTEXT" in pack["prompt_context"]
    assert "GRAPHITI DISCOVERY LENS" in pack["prompt_context"]
    assert pack["questions"][0]["question"].startswith("What evidence")
    assert pack["questions"][0]["pack_role"] == "discovery"
    assert pack["hypotheses"][0]["metadata"]["positioning_strategy"]
    assert pack["hypotheses"][0]["metadata"]["yp_service_fit"]
    assert pack["hypotheses"][0]["metadata"]["graphiti_focus"]
    assert pack["questions"][0]["graphiti_focus"]
