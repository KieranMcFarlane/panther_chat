import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from dossier_data_collector import DossierDataCollector


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
