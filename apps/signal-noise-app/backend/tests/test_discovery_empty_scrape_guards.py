#!/usr/bin/env python3
"""
Regression tests for discovery behavior when scrape or validation inputs are empty.
"""

import sys
from pathlib import Path
from types import SimpleNamespace
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery, HopType
from search_result_validator import SearchResultValidator


def test_search_result_validator_handles_empty_model_response():
    validator = SearchResultValidator(claude_client=object())

    assert validator._parse_validation_response(None, 3) == {}
    assert validator._parse_validation_response("", 3) == {}
    assert validator._parse_validation_response("   ", 3) == {}


@pytest.mark.asyncio
async def test_execute_hop_returns_no_progress_for_empty_scrape_content():
    discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
    discovery.pdf_extractor = None
    discovery.total_cost_usd = 0.0
    discovery.brightdata_client = SimpleNamespace()

    async def fake_get_url_for_hop(hop_type, hypothesis, state):
        return "https://example.com/rfp"

    async def fake_scrape_as_markdown(url):
        return {
            "status": "success",
            "content": None,
            "url": url,
            "timestamp": "2026-03-02T10:00:00Z",
            "metadata": {},
        }

    discovery._get_url_for_hop = fake_get_url_for_hop
    discovery._is_pdf_url = lambda url: False
    discovery.brightdata_client.scrape_as_markdown = fake_scrape_as_markdown

    async def unexpected_evaluate_content_with_claude(**kwargs):
        raise AssertionError("Claude evaluation should not run for empty scrape content")

    discovery._evaluate_content_with_claude = unexpected_evaluate_content_with_claude

    state = SimpleNamespace(
        current_depth=0,
        last_failed_hop=None,
        hop_failure_counts={},
    )
    state.increment_depth_count = lambda depth: None

    hypothesis = SimpleNamespace(metadata={"entity_name": "Arsenal FC"})

    result = await discovery._execute_hop(HopType.RFP_PAGE, hypothesis, state)

    assert result["decision"] == "NO_PROGRESS"
    assert result["justification"] == "No content returned from scrape"
    assert result["url"] == "https://example.com/rfp"
