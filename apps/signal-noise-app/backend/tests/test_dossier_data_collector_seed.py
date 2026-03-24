import sys
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from dossier_data_collector import DossierDataCollector, SupabaseDossierCache


def test_seed_official_site_url_normalizes_and_stores_preferred():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    seeded = collector.seed_official_site_url("FIBA", "www.fiba.basketball/en", persist_cache=False)

    assert seeded == "https://www.fiba.basketball/en"
    assert collector._get_preferred_official_site_url("FIBA") == "https://www.fiba.basketball/en"


def test_choose_official_site_url_prefers_non_commerce_candidate():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    chosen = collector._choose_official_site_url(
        "Coventry City FC",
        [
            {
                "url": "https://www.ccfcstore.com/",
                "title": "Official Coventry City Store",
                "snippet": "Official site and merch",
            },
            {
                "url": "https://www.ccfc.co.uk/news",
                "title": "Coventry City FC News",
                "snippet": "Latest official club news",
            },
        ],
    )

    assert chosen == "https://www.ccfc.co.uk/news"


def test_choose_official_site_url_skips_low_signal_matches_shell():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    chosen = collector._choose_official_site_url(
        "Coventry City FC",
        [
            {
                "url": "https://www.ccfc.co.uk/matches/first-team/2025/g2566847",
                "title": "Coventry City FC | Match Centre",
                "snippet": "Match details and ticketing",
            },
            {
                "url": "https://www.ccfc.co.uk/news",
                "title": "Coventry City FC News",
                "snippet": "Latest official club news",
            },
        ],
    )

    assert chosen == "https://www.ccfc.co.uk/news"


def test_choose_official_site_url_avoids_unrelated_media_domain():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    chosen = collector._choose_official_site_url(
        "Coventry City FC",
        [
            {
                "url": "https://www.ccfcstore.com/",
                "title": "Official Coventry City Store",
                "snippet": "Official shop",
            },
            {
                "url": "https://www.coventrytelegraph.net/all-about/coventry-city-fc",
                "title": "Coventry City FC News",
                "snippet": "Local coverage and rumours",
            },
        ],
    )

    assert chosen == "https://www.ccfcstore.com/"


def test_choose_official_site_url_avoids_binary_document_candidate():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    chosen = collector._choose_official_site_url(
        "Coventry City FC",
        [
            {
                "url": "https://images.gc.coventrycityfcservices.co.uk/asset.pdf",
                "title": "Coventry City FC",
                "snippet": "Official document",
            },
            {
                "url": "https://www.ccfc.co.uk/",
                "title": "Coventry City FC",
                "snippet": "Official website",
            },
        ],
    )

    assert chosen == "https://www.ccfc.co.uk"


def test_choose_official_site_url_rejects_binary_document_when_no_site_candidate():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    chosen = collector._choose_official_site_url(
        "Coventry City FC",
        [
            {
                "url": "https://images.gc.coventrycityfcservices.co.uk/asset.pdf",
                "title": "Coventry City FC",
                "snippet": "Official document",
            }
        ],
    )

    assert chosen == ""


@pytest.mark.asyncio
async def test_get_scraped_content_prefers_seeded_official_site(monkeypatch):
    async def _unexpected_search(**_kwargs):  # pragma: no cover
        raise AssertionError("search_engine should not be called when seeded official-site exists")

    collector = DossierDataCollector(brightdata_client=SimpleNamespace(search_engine=_unexpected_search))
    collector.seed_official_site_url("FIBA", "https://www.fiba.basketball/en", persist_cache=False)

    async def _fake_scrape_with_fallback(entity_name, official_url):
        assert entity_name == "FIBA"
        return official_url, {"status": "success", "content": "Founded in 1932."}, "live"

    async def _fake_extract(_content, _entity_name):
        return {"website": "https://www.fiba.basketball/en"}

    monkeypatch.setattr(collector, "_scrape_official_url_with_fallback", _fake_scrape_with_fallback)
    monkeypatch.setattr(collector, "_extract_entity_properties", _fake_extract)

    result = await collector._get_scraped_content("fiba", "FIBA")

    assert result is not None
    scraped_content, extracted_data, timings = result
    assert scraped_content.url == "https://www.fiba.basketball/en"
    assert extracted_data["website"] == "https://www.fiba.basketball/en"
    assert timings.get("official_site_source") == "seeded_preferred"


@pytest.mark.asyncio
async def test_get_scraped_content_promotes_extracted_canonical_site(monkeypatch):
    async def _fake_search(**_kwargs):
        return {
            "status": "success",
            "results": [
                {
                    "url": "https://www.ccfcstore.com/",
                    "title": "Official Coventry Store",
                    "snippet": "Official shop",
                }
            ],
        }

    collector = DossierDataCollector(brightdata_client=SimpleNamespace(search_engine=_fake_search))
    collector._official_site_url_cache = {}

    async def _fake_scrape_with_fallback(entity_name, official_url):
        assert entity_name == "Coventry City FC"
        assert official_url.rstrip("/") == "https://www.ccfcstore.com"
        return official_url, {"status": "success", "content": "Visit us at www.ccfc.co.uk"}, "live"

    async def _fake_extract(_content, _entity_name):
        return {"website": "https://www.ccfc.co.uk"}

    monkeypatch.setattr(collector, "_scrape_official_url_with_fallback", _fake_scrape_with_fallback)
    monkeypatch.setattr(collector, "_extract_entity_properties", _fake_extract)

    result = await collector._get_scraped_content("coventry-city-fc", "Coventry City FC")

    assert result is not None
    scraped_content, extracted_data, _timings = result
    assert scraped_content.url == "https://www.ccfc.co.uk"
    assert extracted_data["website"] == "https://www.ccfc.co.uk"
    assert collector._get_cached_official_site_url("Coventry City FC") == "https://www.ccfc.co.uk"


@pytest.mark.asyncio
async def test_get_scraped_content_does_not_cache_commerce_url_without_canonical_extraction(monkeypatch):
    async def _fake_search(**_kwargs):
        return {
            "status": "success",
            "results": [
                {
                    "url": "https://www.ccfcstore.com/",
                    "title": "Official Coventry Store",
                    "snippet": "Official shop",
                }
            ],
        }

    collector = DossierDataCollector(brightdata_client=SimpleNamespace(search_engine=_fake_search))
    collector._official_site_url_cache = {}

    async def _fake_scrape_with_fallback(_entity_name, official_url):
        return official_url, {"status": "success", "content": "Store content"}, "live"

    async def _fake_extract(_content, _entity_name):
        return {}

    monkeypatch.setattr(collector, "_scrape_official_url_with_fallback", _fake_scrape_with_fallback)
    monkeypatch.setattr(collector, "_extract_entity_properties", _fake_extract)

    result = await collector._get_scraped_content("coventry-city-fc", "Coventry City FC")

    assert result is not None
    assert collector._get_cached_official_site_url("Coventry City FC") is None


@pytest.mark.asyncio
async def test_get_scraped_content_enhanced_returns_tuple_with_merged_data(monkeypatch):
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    collector._brightdata_available = True
    collector.brightdata_client = SimpleNamespace()

    async def _fake_wiki(_entity_name):
        return {"source": "wikipedia", "url": "https://en.wikipedia.org/wiki/Arsenal_F.C.", "founded": "1886"}

    async def _fake_site(_entity_name):
        return {"source": "official", "url": "https://www.arsenal.com", "website": "https://www.arsenal.com"}

    async def _fake_field(_entity_name, _field_name):
        return {}

    async def _fake_league(_entity_name):
        return {"league": "Premier League", "country": "England"}

    monkeypatch.setattr(collector, "_scrape_wikipedia", _fake_wiki)
    monkeypatch.setattr(collector, "_scrape_official_site", _fake_site)
    monkeypatch.setattr(collector, "_scrape_field_specific", _fake_field)
    monkeypatch.setattr(collector, "_scrape_league_data", _fake_league)

    result = await collector._get_scraped_content_enhanced("arsenal-fc", "Arsenal FC", run_objective="dossier_core")

    assert result is not None
    scraped_content, extracted = result
    assert scraped_content.url == "https://www.arsenal.com"
    assert extracted["founded"] == "1886"
    assert extracted["league"] == "Premier League"
    assert extracted["country"] == "England"


def test_postprocess_decision_makers_filters_noisy_non_person_names():
    collector = DossierDataCollector(brightdata_client=SimpleNamespace())
    raw = [
        {"name": "Our Members", "role": "Commercial Director"},
        {"name": "Fiba Media", "role": "Chief Commercial Officer"},
        {"name": "Wayne Parrish", "role": "Chief Executive Officer"},
        {"name": "Jim Tooley", "role": "Managing Director"},
    ]
    filtered = collector._postprocess_decision_makers("FIBA", raw)

    names = {item["name"] for item in filtered}
    assert "Wayne Parrish" in names
    assert "Jim Tooley" in names
    assert "Our Members" not in names
    assert "Fiba Media" not in names


@pytest.mark.asyncio
async def test_collect_all_parallel_section_timeout_isolated(monkeypatch):
    monkeypatch.setenv("DOSSIER_SECTION_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setenv("DOSSIER_COLLECT_PARALLEL_LEADERSHIP", "true")

    class _TimeoutCollector(DossierDataCollector):
        async def _connect_falkordb(self):
            self._falkordb_connected = False
            return False

        async def _connect_brightdata(self):
            self._brightdata_available = False
            return False

        async def _connect_claude(self):
            self.claude_client = None
            return False

        async def collect_digital_transformation_data(self, *_args, **_kwargs):
            await asyncio.sleep(0.05)
            return {"sources_used": ["slow"]}

        async def collect_strategic_opportunities(self, *_args, **_kwargs):
            return {"opportunities": [{"title": "Fast"}]}

        async def collect_recent_news_data(self, *_args, **_kwargs):
            return {"news_items": [{"title": "News"}]}

        async def collect_performance_data(self, *_args, **_kwargs):
            return {"league_position": 10}

        async def collect_leadership(self, *_args, **_kwargs):
            return {"decision_makers": [{"name": "Alex Smith", "role": "CEO"}]}

    collector = _TimeoutCollector(use_cache=False, parallel_scraping=True)
    data = await collector.collect_all("test-entity", "Test Entity")

    assert data.digital_transformation == {}
    assert len(data.strategic_opportunities.get("opportunities", [])) == 1
    assert len(data.recent_news.get("news_items", [])) == 1
    assert len(data.leadership.get("decision_makers", [])) == 1


@pytest.mark.asyncio
async def test_collect_all_parallel_respects_per_section_timeout_overrides(monkeypatch):
    monkeypatch.setenv("DOSSIER_SECTION_TIMEOUT_SECONDS", "0.2")
    monkeypatch.setenv("DOSSIER_COLLECTION_TIMEOUT_DIGITAL_TRANSFORMATION_SECONDS", "0.01")
    monkeypatch.setenv("DOSSIER_COLLECTION_TIMEOUT_STRATEGIC_OPPORTUNITIES_SECONDS", "0.2")
    monkeypatch.setenv("DOSSIER_COLLECTION_TIMEOUT_RECENT_NEWS_SECONDS", "0.2")
    monkeypatch.setenv("DOSSIER_COLLECTION_TIMEOUT_PERFORMANCE_SECONDS", "0.2")

    class _TimeoutOverrideCollector(DossierDataCollector):
        async def _connect_falkordb(self):
            self._falkordb_connected = False
            return False

        async def _connect_brightdata(self):
            self._brightdata_available = False
            return False

        async def _connect_claude(self):
            self.claude_client = None
            return False

        async def collect_digital_transformation_data(self, *_args, **_kwargs):
            await asyncio.sleep(0.05)
            return {"sources_used": ["slow"]}

        async def collect_strategic_opportunities(self, *_args, **_kwargs):
            await asyncio.sleep(0.05)
            return {"opportunities": [{"title": "Strategic"}]}

        async def collect_recent_news_data(self, *_args, **_kwargs):
            await asyncio.sleep(0.05)
            return {"news_items": [{"title": "News"}]}

        async def collect_performance_data(self, *_args, **_kwargs):
            await asyncio.sleep(0.05)
            return {"league_position": 3}

    collector = _TimeoutOverrideCollector(use_cache=False, parallel_scraping=True)
    data = await collector.collect_all("test-entity", "Test Entity")

    assert data.digital_transformation == {}
    assert len(data.strategic_opportunities.get("opportunities", [])) == 1
    assert len(data.recent_news.get("news_items", [])) == 1
    assert data.performance.get("league_position") == 3


@pytest.mark.asyncio
async def test_supabase_cache_disables_after_missing_table_error():
    class _Always404Table:
        def __init__(self, parent):
            self.parent = parent

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            self.parent.calls += 1
            raise RuntimeError("404 Not Found: dossier_scraping_cache")

    class _FakeSupabaseClient:
        def __init__(self):
            self.calls = 0

        def table(self, *_args, **_kwargs):
            return _Always404Table(self)

    cache = SupabaseDossierCache()
    cache._connected = True
    cache.supabase_client = _FakeSupabaseClient()

    first = await cache.get_cached_data("entity-1", "recent_news")
    second = await cache.get_cached_data("entity-1", "recent_news")

    assert first is None and second is None
    assert cache.supabase_client.calls == 1


@pytest.mark.asyncio
async def test_scrape_field_specific_handles_empty_results_without_exception_warning(monkeypatch):
    class _FakeBrightData:
        async def search_engine(self, **_kwargs):
            return {"status": "success", "results": []}

    collector = DossierDataCollector(brightdata_client=_FakeBrightData())

    from dossier_data_collector import logger as collector_logger

    original_warning = collector_logger.warning

    def _guard_warning(msg, *args, **kwargs):
        rendered = str(msg) % args if args else str(msg)
        if "Field-specific scraping failed" in rendered:
            raise AssertionError("unexpected exception-path warning for empty result set")
        return original_warning(msg, *args, **kwargs)

    monkeypatch.setattr(collector_logger, "warning", _guard_warning)
    result = await collector._scrape_field_specific("Coventry City FC", "stadium")
    assert result == {}
