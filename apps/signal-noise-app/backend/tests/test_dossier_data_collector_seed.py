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
