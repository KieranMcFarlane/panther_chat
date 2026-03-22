import json
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

try:
    from backend.discovery_runtime_v2 import DiscoveryRuntimeV2
except ImportError:
    from discovery_runtime_v2 import DiscoveryRuntimeV2


@pytest.mark.parametrize(
    ("raw_action", "expected"),
    [
        (
            json.dumps(
                {
                    "action": "search_queries",
                    "lane": "trusted_news",
                    "queries": ["Coventry City FC jobs", "Coventry City FC procurement"],
                    "reason": "expand search",
                }
            ),
            {
                "action": "search_queries",
                "lane": "trusted_news",
                "queries": ["Coventry City FC jobs", "Coventry City FC procurement"],
                "reason": "expand search",
            },
        ),
        (
            json.dumps(
                {
                    "action": "scrape_candidate",
                    "lane": "trusted_news",
                    "candidate_index": 1,
                    "reason": "scrape the strongest candidate",
                }
            ),
            {
                "action": "scrape_candidate",
                "lane": "trusted_news",
                "candidate_index": 1,
                "reason": "scrape the strongest candidate",
            },
        ),
        (
            json.dumps(
                {
                    "action": "same_domain_probe",
                    "lane": "official_site",
                    "url": "https://www.ccfc.co.uk/news",
                    "reason": "probe an internal page",
                }
            ),
            {
                "action": "same_domain_probe",
                "lane": "official_site",
                "url": "https://www.ccfc.co.uk/news",
                "reason": "probe an internal page",
            },
        ),
        (
            json.dumps(
                {
                    "action": "stop_lane",
                    "lane": "trusted_news",
                    "reason": "no more yield",
                }
            ),
            {
                "action": "stop_lane",
                "lane": "trusted_news",
                "reason": "no more yield",
            },
        ),
        (
            json.dumps(
                {
                    "action": "stop_run",
                    "reason": "enough signal already collected",
                }
            ),
            {
                "action": "stop_run",
                "reason": "enough signal already collected",
            },
        ),
    ],
)
def test_parse_controller_action_accepts_supported_actions(raw_action, expected):
    parsed = DiscoveryRuntimeV2.parse_controller_action(raw_action)
    assert parsed == expected


def test_parse_controller_action_rejects_prose_payload():
    raw_action = "Try a different lane and scrape the most promising result."

    parsed = DiscoveryRuntimeV2.parse_controller_action(raw_action)

    assert parsed is None


def test_parse_controller_action_rejects_unknown_action():
    raw_action = json.dumps(
        {
            "action": "open_in_browser",
            "lane": "trusted_news",
            "reason": "not supported",
        }
    )

    parsed = DiscoveryRuntimeV2.parse_controller_action(raw_action)

    assert parsed is None


@pytest.mark.parametrize(
    "raw_action",
    [
        json.dumps({"action": "search_queries", "lane": "trusted_news", "queries": ["a"], "reason": 123}),
        json.dumps({"action": "scrape_candidate", "lane": "trusted_news", "candidate_index": "1"}),
        json.dumps({"action": "scrape_candidate", "lane": "trusted_news", "candidate_index": True}),
        json.dumps({"action": "search_queries", "lane": "trusted_news", "queries": "not-a-list"}),
        json.dumps({"action": "search_queries", "lane": "trusted_news", "queries": ["ok", 7]}),
        json.dumps({"action": "same_domain_probe", "lane": "trusted_news", "url": "not a url"}),
        json.dumps({"action": "stop_lane", "lane": "not-a-real-lane"}),
        json.dumps({"action": "search_queries", "lane": "trusted_news", "queries": ["a"], "extra": "nope"}),
    ],
)
def test_parse_controller_action_rejects_malformed_payloads(raw_action):
    parsed = DiscoveryRuntimeV2.parse_controller_action(raw_action)
    assert parsed is None
