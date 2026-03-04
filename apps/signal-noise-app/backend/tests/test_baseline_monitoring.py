#!/usr/bin/env python3
"""
Tests for the baseline monitoring runner.
"""

import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from baseline_monitoring import BaselineMonitoringRunner


class FakeScraper:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    async def scrape(self, url: str):
        self.calls.append(url)
        return self.responses[url]


@pytest.mark.asyncio
async def test_baseline_monitoring_fetches_each_canonical_source_once():
    scraper = FakeScraper(
        {
            "https://example.com": {"content": "Digital transformation and procurement roadmap"},
            "https://example.com/news": {"content": "Press release about platform partner"},
        }
    )
    runner = BaselineMonitoringRunner(scrape_func=scraper.scrape)

    result = await runner.run_monitoring(
        entity_id="example-fc",
        batch_id="batch-1",
        run_id="run-1",
        canonical_sources={
            "official_site": "https://example.com",
            "press_release": "https://example.com/news",
        },
    )

    assert scraper.calls == ["https://example.com", "https://example.com/news"]
    assert result["pages_fetched"] == 2
    assert result["pages_changed"] == 2
    assert len(result["snapshots"]) == 2


@pytest.mark.asyncio
async def test_baseline_monitoring_skips_unchanged_content_after_hash_compare():
    scraper = FakeScraper(
        {
            "https://example.com": {"content": "Digital transformation and procurement roadmap"},
        }
    )
    runner = BaselineMonitoringRunner(scrape_func=scraper.scrape)

    first_run = await runner.run_monitoring(
        entity_id="example-fc",
        batch_id="batch-1",
        run_id="run-1",
        canonical_sources={"official_site": "https://example.com"},
    )
    second_run = await runner.run_monitoring(
        entity_id="example-fc",
        batch_id="batch-2",
        run_id="run-2",
        canonical_sources={"official_site": "https://example.com"},
        previous_snapshots=first_run["snapshots"],
    )

    assert first_run["pages_changed"] == 1
    assert second_run["pages_changed"] == 0
    assert second_run["pages_unchanged"] == 1
    assert second_run["candidates"] == []


@pytest.mark.asyncio
async def test_baseline_monitoring_emits_candidates_when_changed_content_has_procurement_signals():
    scraper = FakeScraper(
        {
            "https://example.com/procurement": {
                "content": "Tender notice: CRM procurement programme. Submission deadline 15 April 2026."
            },
        }
    )
    runner = BaselineMonitoringRunner(scrape_func=scraper.scrape)

    result = await runner.run_monitoring(
        entity_id="example-fc",
        batch_id="batch-3",
        run_id="run-3",
        canonical_sources={"procurement_page": "https://example.com/procurement"},
    )

    assert result["pages_changed"] == 1
    assert len(result["candidates"]) == 1
    candidate = result["candidates"][0]
    assert candidate["entity_id"] == "example-fc"
    assert candidate["page_class"] == "procurement_page"
    assert candidate["candidate_type"] == "procurement_signal"
    assert candidate["score"] >= 0.8
    assert "Tender notice" in candidate["evidence_excerpt"]


@pytest.mark.asyncio
async def test_baseline_monitoring_emits_jobs_candidates_for_relevant_hiring_signals():
    scraper = FakeScraper(
        {
            "https://jobs.example.com": {
                "content": "We are hiring a Head of Procurement and CRM Manager to lead vendor selection and digital transformation."
            },
        }
    )
    runner = BaselineMonitoringRunner(scrape_func=scraper.scrape)

    result = await runner.run_monitoring(
        entity_id="example-fc",
        batch_id="batch-4",
        run_id="run-4",
        canonical_sources={"jobs_board": "https://jobs.example.com"},
    )

    assert result["candidate_count"] == 1
    candidate = result["candidates"][0]
    assert candidate["page_class"] == "jobs_board"
    assert candidate["candidate_type"] == "hiring_signal"
    assert candidate["score"] >= 0.5
    assert "Head of Procurement" in candidate["evidence_excerpt"]
    assert candidate["metadata"]["validation_mode"] == "jobs_compact"
    assert candidate["metadata"]["requires_llm_validation"] is True
    assert "head of procurement" in candidate["metadata"]["evidence_pack"]["signals"]


@pytest.mark.asyncio
async def test_baseline_monitoring_emits_linkedin_candidates_for_procurement_adjacent_posts():
    scraper = FakeScraper(
        {
            "https://linkedin.example.com/posts/example": {
                "content": "We are hiring and launching a digital transformation partnership. Procurement and vendor platform decisions follow next quarter."
            },
        }
    )
    runner = BaselineMonitoringRunner(scrape_func=scraper.scrape)

    result = await runner.run_monitoring(
        entity_id="example-fc",
        batch_id="batch-5",
        run_id="run-5",
        canonical_sources={"linkedin_posts": "https://linkedin.example.com/posts/example"},
    )

    assert result["candidate_count"] == 1
    candidate = result["candidates"][0]
    assert candidate["page_class"] == "linkedin_posts"
    assert candidate["candidate_type"] == "social_signal"
    assert candidate["score"] >= 0.5
    assert "digital transformation partnership" in candidate["evidence_excerpt"]
    assert candidate["metadata"]["validation_mode"] == "social_compact"
    assert candidate["metadata"]["requires_llm_validation"] is True
    assert "digital transformation" in candidate["metadata"]["evidence_pack"]["signals"]
