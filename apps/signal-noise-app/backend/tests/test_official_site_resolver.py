import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from official_site_resolver import choose_canonical_official_site, rank_official_site_candidates


def test_resolver_prefers_canonical_club_domain_over_store_and_women_subbrand():
    candidates = [
        {
            "url": "https://www.ccfcstore.com/",
            "title": "Official Coventry City Store",
            "snippet": "Shop and ticketing for supporters",
        },
        {
            "url": "https://www.ccwgfc.co.uk/",
            "title": "Coventry City Women FC",
            "snippet": "The official website of Coventry City Women FC",
        },
        {
            "url": "https://www.ccfc.co.uk/",
            "title": "Coventry City FC | Official Website",
            "snippet": "Official club site",
        },
    ]

    chosen = choose_canonical_official_site("Coventry City FC", candidates)
    assert chosen == "https://www.ccfc.co.uk/"


def test_resolver_prefers_root_homepage_over_deep_news_url():
    candidates = [
        {
            "url": "https://www.ccfc.co.uk/news/article-123",
            "title": "Coventry City FC news",
            "snippet": "Latest updates",
        },
        {
            "url": "https://www.ccfc.co.uk/",
            "title": "Coventry City FC",
            "snippet": "Official website",
        },
    ]

    ranked = rank_official_site_candidates("Coventry City FC", candidates)
    assert ranked[0]["url"] == "https://www.ccfc.co.uk/"
    assert ranked[0]["score"] > ranked[1]["score"]


def test_resolver_demotes_social_profiles():
    candidates = [
        {
            "url": "https://www.youtube.com/c/CoventryCityFC/about",
            "title": "Coventry City FC - YouTube",
            "snippet": "Official channel",
        },
        {
            "url": "https://www.ccfc.co.uk/",
            "title": "Coventry City FC",
            "snippet": "Official website",
        },
    ]

    chosen = choose_canonical_official_site("Coventry City FC", candidates)
    assert chosen == "https://www.ccfc.co.uk/"
