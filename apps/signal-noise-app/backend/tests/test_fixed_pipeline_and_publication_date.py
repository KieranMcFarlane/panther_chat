import builtins
import asyncio
import json
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
        entity_type="FEDERATION",
    )

    assert result.final_confidence == 0.7
    assert captured["max_iterations"] == 7
    assert captured["entity_type"] == "FEDERATION"


@pytest.mark.asyncio
async def test_run_pipeline_passes_entity_type_to_phase1():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.output_dir = Path("/tmp")
    pipeline.schema_first_enabled = False
    pipeline.schema_first_result = None
    captured = {}

    async def _phase_1_generate_dossier(*, entity_id, entity_name, entity_type, tier_score):
        captured["entity_type"] = entity_type
        return SimpleNamespace(sections=[])

    async def _phase_2_run_discovery(*, entity_id, entity_name, dossier, max_iterations, template_id, entity_type=None):
        return SimpleNamespace(final_confidence=0.5, iterations_completed=1, signals_discovered=[])

    async def _phase_3_calculate_scores(*, entity_id, entity_name, dossier, discovery_result):
        return {"procurement_maturity": 40, "active_probability": 0.05, "sales_readiness": "NOT_READY"}

    async def _save_results(*args, **kwargs):
        return None

    pipeline._phase_1_generate_dossier = _phase_1_generate_dossier
    pipeline._phase_2_run_discovery = _phase_2_run_discovery
    pipeline._phase_3_calculate_scores = _phase_3_calculate_scores
    pipeline._save_results = _save_results

    await pipeline.run_pipeline(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
        tier_score=50,
        max_discovery_iterations=1,
        template_id="federation_procurement_template",
    )

    assert captured["entity_type"] == "FEDERATION"


@pytest.mark.asyncio
async def test_run_pipeline_executes_schema_first_prepass_when_enabled():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.output_dir = Path("/tmp")
    pipeline.schema_first_enabled = True
    pipeline.schema_first_result = None
    captured = {"schema": 0}

    async def _run_schema_first_prepass(*, entity_id, entity_name, entity_type):
        captured["schema"] += 1
        return {"fields": {"official_site": {"value": "https://www.ccfc.co.uk"}}}

    async def _phase_1_generate_dossier(*, entity_id, entity_name, entity_type, tier_score):
        return SimpleNamespace(sections=[], metadata={"canonical_sources": {}})

    async def _phase_2_run_discovery(*, entity_id, entity_name, dossier, max_iterations, template_id, entity_type=None):
        return SimpleNamespace(final_confidence=0.5, iterations_completed=1, signals_discovered=[])

    async def _phase_3_calculate_scores(*, entity_id, entity_name, dossier, discovery_result):
        return {"procurement_maturity": 40, "active_probability": 0.05, "sales_readiness": "NOT_READY"}

    async def _save_results(*args, **kwargs):
        return None

    pipeline._run_schema_first_prepass = _run_schema_first_prepass
    pipeline._phase_1_generate_dossier = _phase_1_generate_dossier
    pipeline._phase_2_run_discovery = _phase_2_run_discovery
    pipeline._phase_3_calculate_scores = _phase_3_calculate_scores
    pipeline._save_results = _save_results

    await pipeline.run_pipeline(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        entity_type="CLUB",
        tier_score=50,
        max_discovery_iterations=1,
        template_id="yellow_panther_agency",
    )

    assert captured["schema"] == 1
    assert pipeline.schema_first_result is not None
    assert pipeline.schema_first_result["fields"]["official_site"]["value"] == "https://www.ccfc.co.uk"


@pytest.mark.asyncio
async def test_run_schema_first_prepass_dispatches_to_schema_sweep_when_enabled(monkeypatch):
    calls = {}

    async def _fake_schema_sweep(**kwargs):
        calls["kwargs"] = kwargs
        return {"run_mode": "schema_sweep_single_pass", "fields": {}}

    monkeypatch.setitem(
        sys.modules,
        "backend.schema_sweep_runner",
        SimpleNamespace(run_schema_sweep=_fake_schema_sweep),
    )

    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.schema_sweep_enabled = True
    pipeline.schema_first_output_dir = "/tmp"
    pipeline.schema_first_max_results = 5
    pipeline.schema_first_max_candidates_per_query = 2
    pipeline.schema_first_fields = ["official_site"]
    pipeline.output_dir = Path("/tmp")

    result = await pipeline._run_schema_first_prepass(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
    )

    assert result["run_mode"] == "schema_sweep_single_pass"
    assert calls["kwargs"]["entity_id"] == "fiba"
    assert calls["kwargs"]["field_names"] == ["official_site"]


@pytest.mark.asyncio
async def test_run_pipeline_seeds_phase1_official_site_from_schema_first():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.output_dir = Path("/tmp")
    pipeline.schema_first_enabled = True
    pipeline.schema_first_result = None
    captured = {"seeded": None}

    class _Generator:
        def seed_official_site_url(self, entity_name, url):
            captured["seeded"] = (entity_name, url)
            return url

    async def _run_schema_first_prepass(*, entity_id, entity_name, entity_type):
        return {"fields": {"official_site": {"value": "https://www.fiba.basketball/en"}}}

    async def _phase_1_generate_dossier(*, entity_id, entity_name, entity_type, tier_score):
        return SimpleNamespace(sections=[], metadata={"canonical_sources": {}})

    async def _phase_2_run_discovery(*, entity_id, entity_name, dossier, max_iterations, template_id, entity_type=None):
        return SimpleNamespace(final_confidence=0.5, iterations_completed=1, signals_discovered=[])

    async def _phase_3_calculate_scores(*, entity_id, entity_name, dossier, discovery_result):
        return {"procurement_maturity": 40, "active_probability": 0.05, "sales_readiness": "NOT_READY"}

    async def _save_results(*args, **kwargs):
        return None

    pipeline.dossier_generator = _Generator()
    pipeline._run_schema_first_prepass = _run_schema_first_prepass
    pipeline._phase_1_generate_dossier = _phase_1_generate_dossier
    pipeline._phase_2_run_discovery = _phase_2_run_discovery
    pipeline._phase_3_calculate_scores = _phase_3_calculate_scores
    pipeline._save_results = _save_results

    await pipeline.run_pipeline(
        entity_id="fiba",
        entity_name="FIBA",
        entity_type="FEDERATION",
        tier_score=50,
        max_discovery_iterations=1,
        template_id="federation_procurement_template",
    )

    assert captured["seeded"] == ("FIBA", "https://www.fiba.basketball/en")


@pytest.mark.asyncio
async def test_pipeline_close_closes_brightdata_client():
    closed = False

    class _BrightData:
        async def close(self):
            nonlocal closed
            closed = True

    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.brightdata = _BrightData()
    await pipeline.close()

    assert closed is True


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


@pytest.mark.asyncio
async def test_phase2_seeds_discovery_official_site_from_generator_cache():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    captured = {}

    class _Discovery:
        current_official_site_url = None

        async def run_discovery_with_dossier_context(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(final_confidence=0.6, iterations_completed=1, signals_discovered=[])

    class _Generator:
        def get_last_official_site_url(self, entity_id):
            assert entity_id == "coventry-city-fc"
            return "https://www.ccfc.co.uk"

    pipeline.discovery = _Discovery()
    pipeline.dossier_generator = _Generator()

    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"entity_id": "coventry-city-fc"}),
        max_iterations=5,
        template_id="yellow_panther_agency",
    )

    assert result.final_confidence == 0.6
    assert pipeline.discovery.current_official_site_url == "https://www.ccfc.co.uk"
    assert captured["dossier"]["metadata"]["website"] == "https://www.ccfc.co.uk"
    assert captured["dossier"]["metadata"]["canonical_sources"]["official_site"] == "https://www.ccfc.co.uk"


@pytest.mark.asyncio
async def test_phase2_uses_schema_first_official_site_when_generator_cache_missing():
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.schema_first_result = {"fields": {"official_site": {"value": "https://www.ccfc.co.uk"}}}
    captured = {}

    class _Discovery:
        current_official_site_url = None

        async def run_discovery_with_dossier_context(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(final_confidence=0.6, iterations_completed=1, signals_discovered=[])

    class _Generator:
        def get_last_official_site_url(self, entity_id):
            return None

    pipeline.discovery = _Discovery()
    pipeline.dossier_generator = _Generator()
    pipeline._lookup_official_site_from_recent_artifacts = lambda _entity_id: None

    result = await pipeline._phase_2_run_discovery(
        entity_id="coventry-city-fc",
        entity_name="Coventry City FC",
        dossier=SimpleNamespace(to_dict=lambda: {"entity_id": "coventry-city-fc"}),
        max_iterations=5,
        template_id="yellow_panther_agency",
    )

    assert result.final_confidence == 0.6
    assert pipeline.discovery.current_official_site_url == "https://www.ccfc.co.uk"
    assert captured["dossier"]["metadata"]["canonical_sources"]["official_site"] == "https://www.ccfc.co.uk"


def test_lookup_official_site_from_recent_artifacts_uses_latest_entry(tmp_path):
    pipeline = FixedDossierFirstPipeline.__new__(FixedDossierFirstPipeline)
    pipeline.output_dir = tmp_path

    older = tmp_path / "coventry-city-fc_dossier_fixed_20260310_010101.json"
    latest = tmp_path / "coventry-city-fc_dossier_fixed_20260311_020202.json"
    older.write_text(json.dumps({"metadata": {"canonical_sources": {"official_site": "https://old.example.com"}}}))
    latest.write_text(json.dumps({"metadata": {"canonical_sources": {"official_site": "www.ccfc.co.uk"}}}))

    assert pipeline._lookup_official_site_from_recent_artifacts("coventry-city-fc") == "https://www.ccfc.co.uk"


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


@pytest.mark.asyncio
async def test_brightdata_sdk_client_initializes_once_under_concurrency(monkeypatch):
    enter_calls = 0
    shared_client = object()

    class _FakeBrightDataClient:
        def __init__(self, token):
            self.token = token

        async def __aenter__(self):
            nonlocal enter_calls
            enter_calls += 1
            await asyncio.sleep(0.01)
            return shared_client

        async def __aexit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setitem(sys.modules, "brightdata", SimpleNamespace(BrightDataClient=_FakeBrightDataClient))

    client = BrightDataSDKClient(token="test-token")
    clients = await asyncio.gather(client._get_client(), client._get_client(), client._get_client())

    assert enter_calls == 1
    assert clients[0] is shared_client
    assert clients[1] is shared_client
    assert clients[2] is shared_client
    await client.close()


@pytest.mark.asyncio
async def test_scrape_as_markdown_falls_back_when_sdk_content_is_empty(monkeypatch):
    class _Result:
        data = "<html><body><script>window.__APP__ = true;</script></body></html>"

    class _Client:
        async def scrape_url(self, url, response_format="raw"):
            return _Result()

    client = BrightDataSDKClient(token="test-token")

    async def _fake_get_client():
        return _Client()

    async def _fake_fallback(url):
        return {
            "status": "success",
            "url": url,
            "content": "fallback content",
            "metadata": {"source": "test_fallback"},
        }

    monkeypatch.setattr(client, "_get_client", _fake_get_client)
    monkeypatch.setattr(client, "_scrape_as_markdown_fallback", _fake_fallback)

    result = await client.scrape_as_markdown("https://example.com")
    assert result["status"] == "success"
    assert result["content"] == "fallback content"
    assert result["metadata"]["source"] == "test_fallback"
