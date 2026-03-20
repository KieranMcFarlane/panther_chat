try:
    from backend.discovery_url_policy import DiscoveryUrlPolicy
except ImportError:
    from discovery_url_policy import DiscoveryUrlPolicy


def test_blocks_known_low_yield_ccfc_routes_for_high_value_hop():
    policy = DiscoveryUrlPolicy()
    decision = policy.evaluate(
        url="https://www.ccfc.co.uk/news",
        hop_type="rfp_page",
        entity_name="Coventry City FC",
        title="News",
        snippet="Latest updates",
    )
    assert decision.allow is False
    assert decision.reason in {"known_low_yield_route", "generic_low_yield_route"}


def test_blocks_generic_shell_routes_when_not_entity_grounded():
    policy = DiscoveryUrlPolicy()
    decision = policy.evaluate(
        url="https://example-football-club.com/news",
        hop_type="tenders_page",
        entity_name="Arsenal FC",
        title="Latest News",
        snippet="Updates from the club",
    )
    assert decision.allow is False
    assert decision.reason == "generic_low_yield_route"


def test_allows_procurement_route_even_if_news_prefix():
    policy = DiscoveryUrlPolicy()
    decision = policy.evaluate(
        url="https://example-football-club.com/news/procurement-opportunities",
        hop_type="rfp_page",
        entity_name="Arsenal FC",
        title="Procurement opportunities",
        snippet="Supplier tender and RFP notices",
    )
    assert decision.allow is True
    assert decision.reason == "allow"


def test_non_high_value_hops_bypass_policy():
    policy = DiscoveryUrlPolicy()
    decision = policy.evaluate(
        url="https://example-football-club.com/",
        hop_type="official_site",
        entity_name="Arsenal FC",
        title="Home",
        snippet="Official site",
    )
    assert decision.allow is True
    assert decision.reason == "allow"
