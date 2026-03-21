import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dossier_data_collector import DossierDataCollector
from hypothesis_driven_discovery import resolve_template_id


def test_resolve_template_id_falls_back_to_available_default():
    assert resolve_template_id("tier_1_club_centralized_procurement", "FEDERATION") == "federation_governing_body"
    assert resolve_template_id(None, "FEDERATION") == "federation_governing_body"
    assert resolve_template_id(None, "CLUB") == "tier_2_club_mixed_procurement"


async def _noop(*args, **kwargs):
    return None


@pytest.mark.asyncio
async def test_collect_all_preserves_requested_entity_type():
    collector = DossierDataCollector()
    collector._connect_falkordb = _noop
    collector._connect_brightdata = _noop
    collector._falkordb_connected = False
    collector._brightdata_available = False

    dossier_data = await collector.collect_all(
        entity_id="international-canoe-federation",
        entity_name="International Canoe Federation",
        entity_type="FEDERATION",
    )

    assert dossier_data.metadata is not None
    assert dossier_data.metadata.entity_type == "FEDERATION"
