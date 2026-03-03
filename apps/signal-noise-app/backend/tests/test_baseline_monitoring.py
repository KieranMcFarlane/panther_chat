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
