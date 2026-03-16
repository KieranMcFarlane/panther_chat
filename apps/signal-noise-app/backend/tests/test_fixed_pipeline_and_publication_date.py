import builtins
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from bs4 import BeautifulSoup

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from brightdata_sdk_client import BrightDataSDKClient
from run_fixed_dossier_pipeline import FixedDossierFirstPipeline


@pytest.mark.asyncio
async def test_phase2_uses_passed_max_iterations():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    captured = {}

    class _Discovery:
        async def run_discovery_with_dossier_context(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(final_confidence=0.7, iterations_completed=1, signals_discovered=[])

    pipeline.discovery = _Discovery()
    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"x": 1}),
        max_iterations=7,
        template_id="yellow_panther_agency",
    )

    assert result.final_confidence == 0.7
    assert captured["max_iterations"] == 7


@pytest.mark.asyncio
async def test_phase2_handles_discovery_signature_without_template_id():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    captured = {}

    class _Discovery:
        async def run_discovery_with_dossier_context(
            self,
            *,
            entity_id,
            entity_name,
            dossier,
            max_iterations,
            progress_callback=None,
        ):
            captured.update(
                {
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "dossier": dossier,
                    "max_iterations": max_iterations,
                    "progress_callback": progress_callback,
                }
            )
            return SimpleNamespace(final_confidence=0.8, iterations_completed=2, signals_discovered=[])

    pipeline.discovery = _Discovery()
    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"x": 2}),
        max_iterations=9,
        template_id="yellow_panther_agency",
    )

    assert result.final_confidence == 0.8
    assert captured["max_iterations"] == 9
    assert captured["dossier"] == {"x": 2}


def test_extract_publication_date_handles_missing_dateutil(monkeypatch):
    client = BrightDataSDKClient(token="test-token")
    soup = BeautifulSoup("<html><head></head><body><h1>No date</h1></body></html>", "html.parser")

    real_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "dateutil" or name.startswith("dateutil."):
            raise ImportError("dateutil unavailable")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    # Should not raise even when python-dateutil is unavailable.
    dt = client._extract_publication_date(
        soup=soup,
        html_content=str(soup),
        url="https://example.com/news/2025/01/15/test-story",
    )
    assert dt is not None
    assert dt.year == 2025
    assert dt.month == 1
    assert dt.day == 15
