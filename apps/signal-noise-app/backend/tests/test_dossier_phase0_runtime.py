import asyncio
import sys
import time
from pathlib import Path
from types import SimpleNamespace
import types
from uuid import uuid4

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dossier_data_collector import DossierDataCollector, ScrapedContent
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
async def test_collect_all_emits_source_level_phase0_progress_events():
    collector = DossierDataCollector()
    collector.source_timeout_seconds = 0.25

    async def fake_connect_falkordb():
        collector._falkordb_connected = True
        return True

    async def fake_connect_brightdata():
        collector._brightdata_available = True
        return True

    async def fake_get_entity_metadata(_entity_id):
        return None

    async def fake_get_scraped_content(_entity_id, _entity_name, progress_callback=None):
        if progress_callback:
            await progress_callback("brightdata_search_official", "completed", duration_seconds=0.01, result_count=1)
            await progress_callback("brightdata_scrape_official", "completed", duration_seconds=0.02, url="https://example.com")
            await progress_callback("extract_entity_properties", "completed", duration_seconds=0.01, extracted_fields=["website"])
        return (
            ScrapedContent(
                url="https://example.com",
                source_type="OFFICIAL_SITE",
                title="Example",
                content="hello world",
                markdown_content="hello world",
                word_count=2,
            ),
            {"website": "https://example.com"},
            {"search": 0.01, "scrape": 0.02, "extract": 0.01},
        )

    collector._connect_falkordb = fake_connect_falkordb
    collector._connect_brightdata = fake_connect_brightdata
    collector._get_entity_metadata = fake_get_entity_metadata
    collector._get_scraped_content = fake_get_scraped_content

    events = []

    async def progress_callback(step: str, status: str, **details):
        events.append((step, status, details))

    data = await collector.collect_all("icf", "International Canoe Federation", progress_callback=progress_callback)
    assert "BrightData" in data.data_sources_used

    by_step = {step: status for step, status, _ in events}
    assert by_step["connect_falkordb"] == "completed"
    assert by_step["connect_brightdata"] == "completed"
    assert by_step["fetch_falkordb_metadata"] in {"completed", "failed"}
    assert by_step["brightdata_search_official"] == "completed"
    assert by_step["brightdata_scrape_official"] == "completed"
    assert by_step["extract_entity_properties"] == "completed"


@pytest.mark.asyncio
async def test_blocking_falkordb_query_is_bounded_by_source_timeout():
    collector = DossierDataCollector()
    collector.source_timeout_seconds = 0.01
    collector._falkordb_connected = True

    class _SlowGraph:
        def query(self, *_args, **_kwargs):
            time.sleep(0.2)
            return SimpleNamespace(result_set=[])

    class _SlowClient:
        def select_graph(self, _database):
            return _SlowGraph()

    collector.falkordb_client = _SlowClient()

    result, timing = await collector._run_with_timeout(
        "fetch_falkordb_metadata",
        collector._get_entity_metadata("icf"),
        default_result=None,
    )

    assert result is None
    assert timing["status"] == "timeout"
    assert timing["duration_seconds"] <= 0.05


@pytest.mark.asyncio
async def test_connect_falkordb_uses_uri_scheme_to_choose_ssl(monkeypatch):
    collector = DossierDataCollector()
    calls = []

    class _Graph:
        def query(self, _query):
            return None

    class _FalkorClient:
        def __init__(self, **kwargs):
            calls.append(kwargs)

        def select_graph(self, _database):
            return _Graph()

    monkeypatch.setitem(sys.modules, "falkordb", types.SimpleNamespace(FalkorDB=_FalkorClient))
    monkeypatch.setenv("FALKORDB_USER", "falkordb")
    monkeypatch.setenv("FALKORDB_PASSWORD", "")
    monkeypatch.setenv("FALKORDB_DATABASE", "sports_intelligence")

    monkeypatch.setenv("FALKORDB_URI", "redis://localhost:6379")
    assert await collector._connect_falkordb() is True
    assert calls[-1]["ssl"] is False

    collector._falkordb_connected = False
    collector.falkordb_client = None

    monkeypatch.setenv("FALKORDB_URI", "rediss://example.com:50743")
    assert await collector._connect_falkordb() is True
    assert calls[-1]["ssl"] is True


@pytest.mark.asyncio
async def test_connect_falkordb_does_not_invent_auth_for_local_redis(monkeypatch):
    collector = DossierDataCollector()
    calls = []

    class _Graph:
        def query(self, _query):
            return None

    class _FalkorClient:
        def __init__(self, **kwargs):
            calls.append(kwargs)

        def select_graph(self, _database):
            return _Graph()

    monkeypatch.setitem(sys.modules, "falkordb", types.SimpleNamespace(FalkorDB=_FalkorClient))
    monkeypatch.delenv("FALKORDB_USER", raising=False)
    monkeypatch.delenv("FALKORDB_PASSWORD", raising=False)
    monkeypatch.setenv("FALKORDB_DATABASE", "sports_intelligence")
    monkeypatch.setenv("FALKORDB_URI", "redis://localhost:6379")

    assert await collector._connect_falkordb() is True
    assert calls[-1].get("username") in {None, ""}
    assert calls[-1].get("password") in {None, ""}


@pytest.mark.asyncio
async def test_get_entity_metadata_falls_back_to_neo4j_id_for_uuid_pipeline_entity(monkeypatch):
    collector = DossierDataCollector()
    collector._falkordb_connected = True
    canonical_id = str(uuid4())
    query_calls = []

    class _Result:
        def __init__(self, rows):
            self.result_set = rows

    class _Graph:
        def query(self, cypher, params=None):
            query_calls.append((cypher, params))
            if params == {"entity_id": canonical_id}:
                return _Result([])
            if params == {"neo4j_id": "544"}:
                return _Result([["544", "1. FC Köln", "Football", "Germany", "Bundesliga", None, None, "Club", None, None]])
            return _Result([])

    class _Client:
        def select_graph(self, _database):
            return _Graph()

    collector.falkordb_client = _Client()

    async def fake_resolve_neo4j_id(entity_id: str):
        assert entity_id == canonical_id
        return "544"

    collector._resolve_neo4j_id_for_entity = fake_resolve_neo4j_id

    metadata = await collector._get_entity_metadata(canonical_id)

    assert metadata is not None
    assert metadata.entity_id == "544"
    assert metadata.entity_name == "1. FC Köln"
    assert any(params == {"entity_id": canonical_id} for _, params in query_calls)
    assert any(params == {"neo4j_id": "544"} for _, params in query_calls)


@pytest.mark.asyncio
async def test_get_entity_metadata_rejects_legacy_graph_match_when_name_conflicts(monkeypatch):
    collector = DossierDataCollector()
    collector._falkordb_connected = True
    canonical_id = str(uuid4())

    class _Result:
        def __init__(self, rows):
            self.result_set = rows

    class _Graph:
        def query(self, _cypher, params=None):
            if params == {"entity_id": canonical_id}:
                return _Result([])
            if params == {"neo4j_id": "544"}:
                return _Result([["544", "Egyptian Premier League", "Football", "Egypt", None, None, None, "League", None, None]])
            return _Result([])

    class _Client:
        def select_graph(self, _database):
            return _Graph()

    collector.falkordb_client = _Client()

    async def fake_resolve_neo4j_id(entity_id: str):
        assert entity_id == canonical_id
        return "544"

    async def fake_resolve_canonical_identity(entity_id: str):
        assert entity_id == canonical_id
        return {
            "id": canonical_id,
            "neo4j_id": "544",
            "name": "1. FC Köln",
        }

    collector._resolve_neo4j_id_for_entity = fake_resolve_neo4j_id
    collector._resolve_cached_entity_identity = fake_resolve_canonical_identity

    metadata = await collector._get_entity_metadata(canonical_id)

    assert metadata is None
