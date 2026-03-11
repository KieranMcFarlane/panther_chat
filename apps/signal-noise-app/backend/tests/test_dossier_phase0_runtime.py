import asyncio
import sys
import time
from pathlib import Path
import json
import types

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dossier_data_collector import DossierDataCollector
from dossier_question_extractor import DossierQuestionExtractor
from schemas import DossierSection


class _BrightDataStub:
    async def scrape_jobs_board(self, **kwargs):
        await asyncio.sleep(0.2)
        return {"status": "success", "results": [{"title": "CRM Lead"}]}

    async def scrape_press_release(self, **kwargs):
        await asyncio.sleep(0.2)
        return {"status": "success", "results": [{"title": "Digital initiative"}]}

    async def search_engine(self, **kwargs):
        await asyncio.sleep(0.2)
        return {"status": "success", "results": [{"title": "LinkedIn", "url": "https://linkedin.com/company/icf"}]}


@pytest.mark.asyncio
async def test_multi_source_collection_runs_sources_concurrently():
    collector = DossierDataCollector()
    collector._brightdata_available = True
    collector.brightdata_client = _BrightDataStub()

    async def fake_official_site(entity_name):
        await asyncio.sleep(0.2)
        return {"url": "https://www.canoeicf.com", "summary": "Official site"}

    collector._scrape_official_site = fake_official_site

    started_at = time.perf_counter()
    result = await collector._collect_multi_source_intelligence("International Canoe Federation")
    elapsed = time.perf_counter() - started_at

    assert elapsed < 0.45
    assert set(result["sources_used"]) == {
        "official_website",
        "job_postings",
        "press_releases",
        "linkedin",
    }
    assert set(result["source_timings"].keys()) == {
        "official_website",
        "job_postings",
        "press_releases",
        "linkedin",
    }
    assert all(timing["duration_seconds"] >= 0 for timing in result["source_timings"].values())


def test_choose_official_site_url_prefers_primary_domain_over_store_domains():
    collector = DossierDataCollector()
    results = [
        {
            "title": "Official Coventry City Store",
            "url": "https://www.ccfcstore.com/",
            "snippet": "Official shop and ticketing",
        },
        {
            "title": "Coventry City FC | Official Website",
            "url": "https://www.ccfc.co.uk/",
            "snippet": "Official club site",
        },
    ]

    official_url = collector._choose_official_site_url("Coventry City FC", results)
    assert official_url == "https://www.ccfc.co.uk/"


def test_choose_official_site_url_prefers_root_homepage_over_deep_news_path():
    collector = DossierDataCollector()
    results = [
        {
            "title": "Coventry City FC News",
            "url": "https://www.ccfc.co.uk/news/",
            "snippet": "Latest updates",
        },
        {
            "title": "Coventry City FC",
            "url": "https://www.ccfc.co.uk/",
            "snippet": "Club homepage",
        },
    ]

    official_url = collector._choose_official_site_url("Coventry City FC", results)
    assert official_url == "https://www.ccfc.co.uk/"


class _ClaudeStub:
    async def query(self, *args, **kwargs):
        await asyncio.sleep(0.2)
        return {"content": "What is the procurement timeline?\nWhat CRM platform is in use?"}


@pytest.mark.asyncio
async def test_question_extraction_runs_sections_concurrently_and_parses_dict_response():
    extractor = DossierQuestionExtractor(_ClaudeStub())
    sections = [
        DossierSection(id="digital_maturity", title="Digital", content=["No explicit questions here."]),
        DossierSection(id="strategic_analysis", title="Strategy", content=["Still no explicit questions here."]),
        DossierSection(id="quick_actions", title="Quick actions", content=["Nothing in question form here either."]),
    ]

    started_at = time.perf_counter()
    questions = await extractor.extract_questions_from_dossier(
        sections,
        "International Canoe Federation",
        max_per_section=2,
    )
    elapsed = time.perf_counter() - started_at

    assert elapsed < 0.45
    assert len(questions) == 6
    assert all(question.question_text.endswith("?") for question in questions)


@pytest.mark.asyncio
async def test_get_scraped_content_reuses_cached_official_url_when_search_fails(tmp_path, monkeypatch):
    cache_file = tmp_path / "official_site_cache.json"
    monkeypatch.setenv("DOSSIER_OFFICIAL_SITE_CACHE_PATH", str(cache_file))

    collector = DossierDataCollector()
    collector._brightdata_available = False

    class _FallbackBrightDataStub:
        def __init__(self):
            self.scrape_urls = []

        async def search_engine(self, **kwargs):
            return {"status": "error", "results": []}

        async def scrape_as_markdown(self, url):
            self.scrape_urls.append(url)
            return {"status": "success", "content": "Cached official site content"}

    stub = _FallbackBrightDataStub()
    collector.brightdata_client = stub
    collector._store_cached_official_site_url("Coventry City FC", "https://www.ccfc.co.uk/")

    async def fake_extract_entity_properties(_content, _entity_name):
        return {}

    collector._extract_entity_properties = fake_extract_entity_properties
    scrape_result = await collector._get_scraped_content("coventry-city-fc", "Coventry City FC")

    assert scrape_result is not None
    scraped_content, extracted, timings = scrape_result
    assert scraped_content.url.rstrip("/") == "https://www.ccfc.co.uk"
    assert extracted == {}
    assert "search" in timings
    assert timings["official_content_source"] == "live"
    assert [url.rstrip("/") for url in stub.scrape_urls] == ["https://www.ccfc.co.uk"]
    persisted = json.loads(cache_file.read_text())
    assert persisted.get("coventry city fc") == "https://www.ccfc.co.uk/"


@pytest.mark.asyncio
async def test_get_scraped_content_falls_back_to_subpaths_when_homepage_is_empty():
    collector = DossierDataCollector()

    class _EmptyHomepageStub:
        def __init__(self):
            self.scrape_urls = []

        async def search_engine(self, **kwargs):
            return {
                "status": "success",
                "results": [{"title": "Coventry City FC", "url": "https://www.ccfc.co.uk/"}],
            }

        async def scrape_as_markdown(self, url):
            self.scrape_urls.append(url)
            if url.rstrip("/") == "https://www.ccfc.co.uk":
                return {"status": "success", "content": ""}
            if url.rstrip("/") == "https://www.ccfc.co.uk/news":
                return {"status": "success", "content": "Latest club updates"}
            return {"status": "error", "error": "not found"}

    stub = _EmptyHomepageStub()
    collector.brightdata_client = stub
    collector._brightdata_available = True

    async def fake_extract_entity_properties(_content, _entity_name):
        return {}

    collector._extract_entity_properties = fake_extract_entity_properties
    scrape_result = await collector._get_scraped_content("coventry-city-fc", "Coventry City FC")

    assert scrape_result is not None
    scraped_content, extracted, timings = scrape_result
    assert scraped_content.url.rstrip("/") == "https://www.ccfc.co.uk/news"
    assert extracted == {}
    assert "scrape" in timings
    assert timings["official_content_source"] == "subpath"
    assert [url.rstrip("/") for url in stub.scrape_urls[:2]] == [
        "https://www.ccfc.co.uk",
        "https://www.ccfc.co.uk/news",
    ]


@pytest.mark.asyncio
async def test_get_scraped_content_uses_cached_content_snapshot_when_live_pages_are_empty(tmp_path, monkeypatch):
    content_cache_file = tmp_path / "official_site_content_cache.json"
    monkeypatch.setenv("DOSSIER_OFFICIAL_SITE_CONTENT_CACHE_PATH", str(content_cache_file))

    collector = DossierDataCollector()

    class _AlwaysEmptyStub:
        def __init__(self):
            self.scrape_urls = []

        async def search_engine(self, **kwargs):
            return {
                "status": "success",
                "results": [{"title": "Coventry City FC", "url": "https://www.ccfc.co.uk/"}],
            }

        async def scrape_as_markdown(self, url):
            self.scrape_urls.append(url)
            return {"status": "success", "content": ""}

    stub = _AlwaysEmptyStub()
    collector.brightdata_client = stub
    collector._brightdata_available = True
    collector._store_cached_official_site_content(
        "Coventry City FC",
        "https://www.ccfc.co.uk/",
        {"content": "Cached historical official content", "metadata": {"word_count": 4}},
    )

    async def fake_extract_entity_properties(_content, _entity_name):
        return {}

    collector._extract_entity_properties = fake_extract_entity_properties
    scrape_result = await collector._get_scraped_content("coventry-city-fc", "Coventry City FC")

    assert scrape_result is not None
    scraped_content, extracted, _timings = scrape_result
    assert scraped_content.url.rstrip("/") == "https://www.ccfc.co.uk"
    assert "Cached historical official content" in scraped_content.content
    assert extracted == {}
    assert _timings["official_content_source"] == "cached_snapshot"
    persisted = json.loads(content_cache_file.read_text())
    assert persisted


@pytest.mark.asyncio
async def test_connect_falkordb_uses_ssl_false_for_redis_scheme(monkeypatch):
    monkeypatch.setenv("FALKORDB_URI", "redis://example.com:6379")
    monkeypatch.setenv("FALKORDB_USER", "falkordb")
    monkeypatch.setenv("FALKORDB_PASSWORD", "secret")
    monkeypatch.setenv("FALKORDB_DATABASE", "sports_intelligence")
    monkeypatch.delenv("FALKORDB_SSL", raising=False)

    captured = {}

    class _Graph:
        def query(self, _q):
            return None

    class _FakeFalkorDB:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def select_graph(self, _db):
            return _Graph()

    monkeypatch.setitem(sys.modules, "falkordb", types.SimpleNamespace(FalkorDB=_FakeFalkorDB))

    collector = DossierDataCollector()
    ok = await collector._connect_falkordb()
    assert ok is True
    assert captured["ssl"] is False


@pytest.mark.asyncio
async def test_connect_falkordb_respects_rediss_and_ssl_override(monkeypatch):
    monkeypatch.setenv("FALKORDB_URI", "rediss://secure.example.com:6380")
    monkeypatch.setenv("FALKORDB_USER", "falkordb")
    monkeypatch.setenv("FALKORDB_PASSWORD", "secret")
    monkeypatch.setenv("FALKORDB_DATABASE", "sports_intelligence")

    captured = {}

    class _Graph:
        def query(self, _q):
            return None

    class _FakeFalkorDB:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def select_graph(self, _db):
            return _Graph()

    monkeypatch.setitem(sys.modules, "falkordb", types.SimpleNamespace(FalkorDB=_FakeFalkorDB))

    collector = DossierDataCollector()
    ok = await collector._connect_falkordb()
    assert ok is True
    assert captured["ssl"] is True

    monkeypatch.setenv("FALKORDB_SSL", "false")
    captured.clear()
    collector = DossierDataCollector()
    ok = await collector._connect_falkordb()
    assert ok is True
    assert captured["ssl"] is False
