import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
from discovery_page_registry import get_page_priority, get_site_path_shortcuts


def test_entity_type_hop_bias_prefers_official_site_for_federations():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_entity_type = "FEDERATION"

    assert discovery._apply_entity_type_hop_bias(HopType.OFFICIAL_SITE, depth=1) > 0
    assert discovery._apply_entity_type_hop_bias(HopType.PRESS_RELEASE, depth=1) > 0
    assert discovery._apply_entity_type_hop_bias(HopType.RFP_PAGE, depth=1) < 0


def test_discovery_page_registry_prioritizes_federation_pages():
    priority = get_page_priority("FEDERATION")

    assert priority[:3] == ["official_site", "tenders_page", "procurement_page"]
    assert "document" in priority


def test_discovery_page_registry_exposes_federation_path_shortcuts():
    shortcuts = get_site_path_shortcuts("FEDERATION", "tenders_page")

    assert "/tenders" in shortcuts
    assert "/procurement" in shortcuts


@pytest.mark.asyncio
async def test_dossier_context_fallback_uses_explicit_entity_type():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery._dossier_hypotheses_cache = {}

    captured = {}

    async def fake_run_discovery(**kwargs):
        captured.update(kwargs)
        return {"status": "ok"}

    async def fake_initialize_from_dossier(entity_id, hypotheses):
        return None

    discovery.initialize_from_dossier = fake_initialize_from_dossier
    discovery.run_discovery = fake_run_discovery
    discovery._normalize_dossier_signal = lambda raw_signal: None
    discovery._normalize_dossier_opportunity_signal = lambda opportunity: None
    discovery.current_entity_type = None
    discovery.max_depth = 7
    discovery.brightdata_client = SimpleNamespace(search_engine=None)

    result = await discovery.run_discovery_with_dossier_context(
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        entity_type="FEDERATION",
        dossier={"metadata": {"website": "https://www.canoeicf.com"}},
        max_iterations=5,
    )

    assert result == {"status": "ok"}
    assert captured["template_id"] == "federation_governing_body"
    assert discovery.current_entity_type == "FEDERATION"
    assert discovery.current_official_site_url == "https://www.canoeicf.com"


@pytest.mark.asyncio
async def test_resolve_official_site_url_uses_known_dossier_url():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_official_site_url = "https://www.fiba.basketball"

    result = await discovery._resolve_official_site_url("FIBA")

    assert result == "https://www.fiba.basketball"


@pytest.mark.asyncio
async def test_site_specific_search_prefers_direct_federation_paths():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_entity_type = "FEDERATION"

    async def fake_resolve_official_site_url(entity_name):
        assert entity_name == "International Canoe Federation"
        return "https://www.canoeicf.com/"

    scraped_urls = []

    async def fake_scrape_as_markdown(url):
        scraped_urls.append(url)
        if url.endswith("/tenders"):
            return {"status": "success", "content": "Tenders and procurement opportunities"}
        return {"status": "error", "content": ""}

    discovery._resolve_official_site_url = fake_resolve_official_site_url
    discovery.brightdata_client = SimpleNamespace(scrape_as_markdown=fake_scrape_as_markdown)

    result = await discovery._try_site_specific_search(
        "International Canoe Federation",
        HopType.TENDERS_PAGE,
    )

    assert result == "https://www.canoeicf.com/tenders"
    assert scraped_urls[0] == "https://www.canoeicf.com/tenders"
