import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType


def test_entity_type_hop_bias_prefers_official_site_for_federations():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.current_entity_type = "FEDERATION"

    assert discovery._apply_entity_type_hop_bias(HopType.OFFICIAL_SITE, depth=1) > 0
    assert discovery._apply_entity_type_hop_bias(HopType.PRESS_RELEASE, depth=1) > 0
    assert discovery._apply_entity_type_hop_bias(HopType.RFP_PAGE, depth=1) < 0


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
        dossier={"metadata": {}},
        max_iterations=5,
    )

    assert result == {"status": "ok"}
    assert captured["template_id"] == "yellow_panther_agency"
    assert discovery.current_entity_type == "FEDERATION"
