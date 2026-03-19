try:
    from backend.hypothesis_driven_discovery import resolve_template_id
except ImportError:
    from hypothesis_driven_discovery import resolve_template_id


def test_template_routing_club_championship_to_tier2():
    resolved = resolve_template_id(
        None,
        entity_type="CLUB",
        league_or_competition="EFL Championship",
    )
    assert resolved == "tier_2_club_mixed_procurement"


def test_template_routing_club_premier_league_to_tier1():
    resolved = resolve_template_id(
        None,
        entity_type="CLUB",
        league_or_competition="Premier League",
    )
    assert resolved == "tier_1_club_centralized_procurement"


def test_template_routing_entity_override_arsenal_to_tier1():
    resolved = resolve_template_id(
        None,
        entity_type="CLUB",
        entity_id="arsenal-fc",
        league_or_competition=None,
    )
    assert resolved == "tier_1_club_centralized_procurement"


def test_template_routing_agency_to_yellow_panther():
    resolved = resolve_template_id(None, entity_type="AGENCY")
    assert resolved == "yellow_panther_agency"


def test_template_routing_federation_procurement_to_centralized():
    resolved = resolve_template_id(
        None,
        entity_type="FEDERATION",
        league_or_competition="Global supplier procurement framework",
    )
    assert resolved == "federation_centralized_procurement"
