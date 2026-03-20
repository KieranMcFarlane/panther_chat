import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
from discovery_url_policy import DiscoveryUrlPolicy


@pytest.mark.asyncio
async def test_resolve_official_site_url_caches_discovered_url():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None

    async def fake_search_engine_with_timeout(*, query, engine, num_results):
        return {
            "status": "success",
            "results": [{"url": "https://www.ccfc.co.uk/"}],
        }

    discovery._search_engine_with_timeout = fake_search_engine_with_timeout

    resolved = await discovery._resolve_official_site_url("Coventry City FC")
    assert resolved == "https://www.ccfc.co.uk/"
    assert discovery.current_official_site_url == "https://www.ccfc.co.uk/"


@pytest.mark.asyncio
async def test_official_site_hop_skips_fallback_query_loop_on_primary_failure():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = None
    discovery.url_resolution_timeout_seconds = 12
    discovery._last_url_resolution_metrics = {}

    calls = {"search": 0}

    async def fake_resolve_official_site_url(_entity_name):
        return None

    async def fake_get_cached_search(_query, _engine):
        return None

    async def fake_cache_search_result(_query, _engine, _result):
        return None

    async def fake_search_engine(*, query, engine, num_results):
        calls["search"] += 1
        return {"status": "error", "results": []}

    discovery._resolve_official_site_url = fake_resolve_official_site_url
    discovery._get_cached_search = fake_get_cached_search
    discovery._cache_search_result = fake_cache_search_result
    discovery.brightdata_client = SimpleNamespace(search_engine=fake_search_engine)

    state = SimpleNamespace(entity_name="Coventry City FC")
    hypothesis = SimpleNamespace()

    resolved = await discovery._get_url_for_hop(HopType.OFFICIAL_SITE, hypothesis, state)
    assert resolved is None
    # Official-site path should fail fast without burning retries on fallback queries.
    assert calls["search"] == 1
    assert discovery._last_url_resolution_metrics.get("fallback_queries_tried") == 0


def test_entity_relevant_candidate_rejects_official_site_off_host_when_official_known():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = "https://www.arsenal.com"
    discovery._get_cached_official_site_url = lambda _entity_name: None
    discovery._get_mapped_official_site_url = lambda _entity_name: "https://www.arsenal.com"

    rejected = discovery._is_entity_relevant_candidate(
        url="https://newsblogs.ihbc.org.uk/?p=34456",
        entity_name="Arsenal FC",
        hop_type=HopType.OFFICIAL_SITE,
        title="Arsenal story",
        snippet="Arsenal FC latest",
    )
    accepted = discovery._is_entity_relevant_candidate(
        url="https://www.arsenal.com/",
        entity_name="Arsenal FC",
        hop_type=HopType.OFFICIAL_SITE,
        title="Arsenal",
        snippet="Official site",
    )

    assert rejected is False
    assert accepted is True


def test_entity_relevant_candidate_rejects_official_site_legal_path_even_on_official_host():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = "https://www.arsenal.com"
    discovery._get_cached_official_site_url = lambda _entity_name: None
    discovery._get_mapped_official_site_url = lambda _entity_name: "https://www.arsenal.com"

    rejected = discovery._is_entity_relevant_candidate(
        url="https://www.arsenal.com/privacy",
        entity_name="Arsenal FC",
        hop_type=HopType.OFFICIAL_SITE,
        title="Privacy Policy",
        snippet="Arsenal privacy policy",
    )

    assert rejected is False


def test_discovery_url_policy_rejects_known_low_yield_procurement_shell_route():
    policy = DiscoveryUrlPolicy()
    decision = policy.evaluate(
        url="https://www.ccfc.co.uk/procurement",
        hop_type=HopType.RFP_PAGE,
        entity_name="Coventry City FC",
        title="Procurement",
        snippet="",
    )
    assert decision.allow is False
    assert decision.reason == "known_low_yield_route"


def test_entity_relevant_candidate_applies_url_policy_rejection():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = "https://www.ccfc.co.uk"
    discovery._get_cached_official_site_url = lambda _entity_name: None
    discovery._get_mapped_official_site_url = lambda _entity_name: "https://www.ccfc.co.uk"
    discovery.url_policy = DiscoveryUrlPolicy()

    allowed = discovery._is_entity_relevant_candidate(
        url="https://www.ccfc.co.uk/news/club-statement",
        entity_name="Coventry City FC",
        hop_type=HopType.PRESS_RELEASE,
        title="Club statement",
        snippet="Update from Coventry City FC",
    )
    rejected = discovery._is_entity_relevant_candidate(
        url="https://www.ccfc.co.uk/procurement",
        entity_name="Coventry City FC",
        hop_type=HopType.RFP_PAGE,
        title="Procurement",
        snippet="",
    )

    assert allowed is True
    assert rejected is False


def test_official_site_content_scoring_prefers_news_over_legal_policy_pages():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    privacy_text = (
        "Arsenal Football Club Privacy Policy. controller personal data and policy terms. " * 120
    )
    news_text = (
        "Arsenal announce digital transformation partnership with technology supplier "
        "for stadium platform and fan app. "
        * 25
    )

    privacy_score, _ = discovery._score_official_site_content_candidate(
        content_text=privacy_text,
        raw_html="<html></html>",
        hypothesis_category="procurement",
        url="https://www.arsenal.com/privacy",
    )
    news_score, _ = discovery._score_official_site_content_candidate(
        content_text=news_text,
        raw_html="<html></html>",
        hypothesis_category="procurement",
        url="https://www.arsenal.com/news",
    )

    assert news_score > privacy_score


def test_record_url_outcome_tracks_no_progress_and_clears_on_accept():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_no_progress_cooldown_hits = 2
    state = SimpleNamespace()

    discovery._record_url_outcome(state, HopType.PRESS_RELEASE, "https://www.ccfc.co.uk/", "NO_PROGRESS")
    discovery._record_url_outcome(state, HopType.PRESS_RELEASE, "https://www.ccfc.co.uk/", "NO_PROGRESS")

    assert discovery._is_url_in_no_progress_cooldown(state, HopType.PRESS_RELEASE, "https://www.ccfc.co.uk/") is True

    discovery._record_url_outcome(state, HopType.PRESS_RELEASE, "https://www.ccfc.co.uk/", "WEAK_ACCEPT")
    assert discovery._is_url_in_no_progress_cooldown(state, HopType.PRESS_RELEASE, "https://www.ccfc.co.uk/") is False


def test_collect_recent_hop_url_attempts_tracks_lookback_window():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_repeat_lookback_iterations = 3
    state = SimpleNamespace(
        iteration_results=[
            {
                "hop_type": HopType.OFFICIAL_SITE.value,
                "result": {"url": "https://www.fiba.basketball/en/news"},
            },
            {
                "hop_type": HopType.PRESS_RELEASE.value,
                "result": {"url": "https://www.fiba.basketball/en/news/a"},
            },
            {
                "hop_type": HopType.OFFICIAL_SITE.value,
                "result": {"url": "https://about.fiba.basketball/en/careers"},
            },
            {
                "hop_type": HopType.OFFICIAL_SITE.value,
                "result": {"url": "https://www.fiba.basketball/en/news"},
            },
        ]
    )

    counts = discovery._collect_recent_hop_url_attempts(state, HopType.OFFICIAL_SITE)
    assert counts["fiba.basketball/en/news"] == 1
    assert counts["about.fiba.basketball/en/careers"] == 1
    assert "fiba.basketball/en/news/a" not in counts


def test_template_hop_bias_prefers_evidence_routes_for_tier1_club():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_template_id = "tier_1_club_centralized_procurement"

    procurement_bias = discovery._apply_template_hop_bias(HopType.RFP_PAGE, depth=1)
    official_bias = discovery._apply_template_hop_bias(HopType.OFFICIAL_SITE, depth=1)

    assert official_bias > procurement_bias
    assert procurement_bias < 0


def test_template_hop_bias_penalizes_procurement_for_federation_governing_body():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_template_id = "federation_governing_body"

    procurement_bias = discovery._apply_template_hop_bias(HopType.RFP_PAGE, depth=1)
    official_bias = discovery._apply_template_hop_bias(HopType.OFFICIAL_SITE, depth=1)

    assert procurement_bias < 0
    assert official_bias > 0


def test_rank_urls_with_diversity_prefers_unseen_candidate_when_available():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_repeat_penalty = 0.18
    discovery.url_repeat_max_hits = 1

    ranked = discovery._rank_urls_with_diversity(
        results=[
            {"url": "https://about.fiba.basketball/en/careers", "_url_score": 0.94},
            {"url": "https://www.fiba.basketball/en/news", "_url_score": 0.76},
        ],
        recent_url_attempts={"about.fiba.basketball/en/careers": 1},
    )

    assert ranked[0]["url"] == "https://www.fiba.basketball/en/news"
    assert ranked[0]["_recent_hits"] == 0


def test_build_official_site_derived_hop_url_returns_none_when_evidence_first_policy_enabled():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.discovery_policy_evidence_first = True
    discovery.current_official_site_url = "https://www.arsenal.com"
    discovery._get_cached_official_site_url = lambda _entity_name: "https://www.arsenal.com"
    discovery._get_mapped_official_site_url = lambda _entity_name: "https://www.arsenal.com"

    assert discovery._build_official_site_derived_hop_url(
        hop_type=HopType.RFP_PAGE,
        entity_name="Arsenal FC",
    ) is None


def test_record_url_outcome_exhausts_lane_after_repeated_no_progress_under_policy():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.discovery_policy_evidence_first = True
    discovery.url_no_progress_cooldown_hits = 2
    discovery._policy_metrics = {
        "synthetic_url_attempt_count": 0,
        "dead_end_event_count": 0,
        "fallback_accept_block_count": 0,
    }
    state = SimpleNamespace()

    discovery._record_url_outcome(state, HopType.RFP_PAGE, "https://www.arsenal.com/news", "NO_PROGRESS")
    discovery._record_url_outcome(state, HopType.RFP_PAGE, "https://www.arsenal.com/news", "NO_PROGRESS")

    assert getattr(state, "lane_exhausted", {}).get(HopType.RFP_PAGE.value) is True
    assert discovery._policy_metrics["dead_end_event_count"] >= 1


def test_template_hop_bias_dampens_procurement_at_start_in_evidence_first_mode():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_template_id = "tier_1_club_centralized_procurement"
    discovery.current_entity_type = "CLUB"

    discovery.discovery_policy_evidence_first = False
    baseline_procurement_bias = discovery._apply_template_hop_bias(HopType.RFP_PAGE, depth=1)

    discovery.discovery_policy_evidence_first = True
    damped_procurement_bias = discovery._apply_template_hop_bias(HopType.RFP_PAGE, depth=1)
    press_bias = discovery._apply_template_hop_bias(HopType.PRESS_RELEASE, depth=1)

    assert damped_procurement_bias < baseline_procurement_bias
    assert press_bias >= damped_procurement_bias


def test_diversified_hop_order_for_clubs_prefers_press_then_careers():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_entity_type = "CLUB"
    order = discovery._get_diversified_hop_order()
    assert order[:3] == [HopType.PRESS_RELEASE, HopType.CAREERS_PAGE, HopType.OFFICIAL_SITE]


def test_template_hop_bias_is_disabled_when_template_agnostic_policy_enabled():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_template_id = "tier_1_club_centralized_procurement"
    discovery.discovery_policy_ignore_templates = True
    bias = discovery._apply_template_hop_bias(HopType.RFP_PAGE, depth=1)
    assert bias == 0.0


@pytest.mark.asyncio
async def test_get_url_for_hop_handles_single_candidate_after_diversity_ranking():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.search_engines = ["google"]
    discovery.search_validator = object()
    discovery.url_resolution_timeout_seconds = 12
    discovery._last_url_resolution_metrics = {}
    discovery._last_url_candidates = []
    discovery.current_entity_type = "CLUB"
    discovery.current_hypothesis_context = None
    discovery._append_search_diagnostic = lambda *args, **kwargs: None
    discovery._get_fallback_queries = lambda *args, **kwargs: []
    discovery._try_site_specific_search = lambda *args, **kwargs: None
    discovery._build_entity_domain_candidates = lambda _entity_name: []
    discovery._is_url_in_no_progress_cooldown = lambda *args, **kwargs: False
    discovery._is_entity_relevant_candidate = lambda **kwargs: True
    discovery._score_url = lambda *args, **kwargs: 0.9
    discovery._collect_recent_hop_url_attempts = lambda *_args, **_kwargs: {"arsenal.com/news": 1}
    discovery._rank_urls_with_diversity = lambda results, _recent: [dict(results[0], _selection_score=0.8)]

    async def fake_get_cached_search(_query, _engine):
        return None

    async def fake_cache_search_result(_query, _engine, _result):
        return None

    async def fake_search_engine(*, query, engine, num_results):
        return {
            "status": "success",
            "results": [
                {"url": "https://www.arsenal.com/news", "title": "News", "snippet": "Club news"},
                {"url": "https://www.arsenal.com/about", "title": "About", "snippet": "Club info"},
            ],
        }

    async def should_not_validate(*args, **kwargs):
        raise AssertionError("Validation should not run when diversity ranking leaves one candidate")

    discovery._get_cached_search = fake_get_cached_search
    discovery._cache_search_result = fake_cache_search_result
    discovery._validate_search_results = should_not_validate
    discovery.brightdata_client = SimpleNamespace(search_engine=fake_search_engine)

    state = SimpleNamespace(entity_name="Arsenal FC", iteration_results=[])
    hypothesis = SimpleNamespace()

    resolved = await discovery._get_url_for_hop(HopType.OFFICIAL_SITE, hypothesis, state)
    assert resolved == "https://www.arsenal.com/news"


@pytest.mark.asyncio
async def test_get_url_for_hop_skips_derived_url_when_it_is_in_cooldown():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.url_no_progress_cooldown_hits = 2
    discovery.current_official_site_url = "https://www.ccfc.co.uk"
    discovery._get_cached_official_site_url = lambda _entity_name: "https://www.ccfc.co.uk"
    discovery._get_mapped_official_site_url = lambda _entity_name: "https://www.ccfc.co.uk"
    discovery._normalize_http_url = lambda url: url
    discovery._last_url_resolution_metrics = {}
    discovery._search_cache = {}
    discovery._cache_ttl = 0
    discovery._last_url_candidates = []
    discovery.url_resolution_timeout_seconds = 12
    discovery._append_search_diagnostic = lambda *args, **kwargs: None

    async def fake_get_cached_search(_query, _engine):
        return None

    async def fake_cache_search_result(_query, _engine, _result):
        return None

    async def fake_search_engine(**kwargs):
        return {"status": "error", "results": []}

    discovery._get_cached_search = fake_get_cached_search
    discovery._cache_search_result = fake_cache_search_result
    discovery.brightdata_client = SimpleNamespace(search_engine=fake_search_engine)
    discovery._is_entity_relevant_candidate = lambda **kwargs: True
    discovery._score_url = lambda *args, **kwargs: 1.0
    discovery._get_fallback_queries = lambda *args, **kwargs: []
    discovery._try_site_specific_search = lambda *args, **kwargs: None
    discovery._build_entity_domain_candidates = lambda _entity_name: []

    state = SimpleNamespace(entity_name="Coventry City FC")
    # Pre-fill cooldown to block derived fallback.
    discovery._record_url_outcome(state, HopType.OFFICIAL_SITE, "https://www.ccfc.co.uk", "NO_PROGRESS")
    discovery._record_url_outcome(state, HopType.OFFICIAL_SITE, "https://www.ccfc.co.uk", "NO_PROGRESS")

    resolved = await discovery._get_url_for_hop(HopType.OFFICIAL_SITE, SimpleNamespace(), state)
    assert resolved is None
