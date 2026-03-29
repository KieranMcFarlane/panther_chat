def test_canonical_catalog_exports_services_and_questions():
    try:
        from backend.yellow_panther_catalog import (
            YELLOW_PANTHER_PROFILE,
            YELLOW_PANTHER_SERVICE_CONTEXT,
            get_questions_for_entity_type,
        )
    except ImportError:
        from yellow_panther_catalog import (  # type: ignore
            YELLOW_PANTHER_PROFILE,
            YELLOW_PANTHER_SERVICE_CONTEXT,
            get_questions_for_entity_type,
        )

    assert "mobile_apps" in YELLOW_PANTHER_SERVICE_CONTEXT.lower()
    assert "digital_transformation" in YELLOW_PANTHER_SERVICE_CONTEXT.lower()
    assert len(YELLOW_PANTHER_PROFILE["competitive_differentiators"]) >= 3

    club_questions = get_questions_for_entity_type("SPORT_CLUB")
    fed_questions = get_questions_for_entity_type("SPORT_FEDERATION")
    league_questions = get_questions_for_entity_type("SPORT_LEAGUE")

    assert len(club_questions) >= 5
    assert len(fed_questions) >= 5
    assert len(league_questions) >= 5


def test_legacy_question_import_still_works():
    try:
        from backend.entity_type_dossier_questions import get_questions_for_entity_type
    except ImportError:
        from entity_type_dossier_questions import get_questions_for_entity_type  # type: ignore

    questions = get_questions_for_entity_type("SPORT_CLUB", max_questions=1)
    assert len(questions) == 1
    assert hasattr(questions[0], "question")
