import asyncio
import sys
import time
from pathlib import Path

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
