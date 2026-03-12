import os
import sys
from pathlib import Path
from unittest.mock import patch

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from hypothesis_driven_discovery import HypothesisDrivenDiscovery


def test_discovery_runtime_limits_can_be_configured_from_env():
    with patch.dict(
        os.environ,
        {
            "DISCOVERY_MAX_CONSECUTIVE_NO_PROGRESS": "3",
            "DISCOVERY_SEARCH_TIMEOUT_SECONDS": "9",
            "DISCOVERY_SEARCH_VALIDATION_TIMEOUT_SECONDS": "5",
            "DISCOVERY_URL_RESOLUTION_TIMEOUT_SECONDS": "12",
            "DISCOVERY_URL_RESOLUTION_MAX_FALLBACK_QUERIES": "4",
            "DISCOVERY_URL_RESOLUTION_MAX_FALLBACK_QUERIES_SINGLE_PASS": "1",
            "DISCOVERY_URL_RESOLUTION_MAX_SITE_SPECIFIC_QUERIES": "7",
            "DISCOVERY_URL_RESOLUTION_MAX_SITE_SPECIFIC_QUERIES_SINGLE_PASS": "2",
            "DISCOVERY_DOSSIER_CONTEXT_TARGETED_SEARCH_ENABLED": "true",
            "DISCOVERY_DOSSIER_CONTEXT_MAX_TARGETED_QUERIES": "5",
            "DISCOVERY_DOSSIER_CONTEXT_MAX_TARGETED_QUERIES_SINGLE_PASS": "0",
            "DISCOVERY_DOSSIER_CONTEXT_TARGETED_SEARCH_CONCURRENCY": "3",
            "DISCOVERY_OFFICIAL_SITE_RESOLUTION_NUM_RESULTS": "4",
            "DISCOVERY_OFFICIAL_SITE_RESOLUTION_ENGINES": "google,bing",
            "DISCOVERY_EVALUATION_MAX_TOKENS_DEFAULT": "700",
            "DISCOVERY_EVALUATION_MAX_TOKENS_PRESS_RELEASE": "410",
            "DISCOVERY_EVALUATION_MAX_TOKENS_OFFICIAL_SITE": "420",
            "DISCOVERY_EVALUATION_MAX_TOKENS_CAREERS_ANNUAL_REPORT": "460",
        },
        clear=False,
    ):
        discovery = HypothesisDrivenDiscovery(
            claude_client=object(),
            brightdata_client=object(),
        )

    assert discovery.max_consecutive_no_progress_iterations == 3
    assert discovery.search_timeout_seconds == 9.0
    assert discovery.search_validation_timeout_seconds == 5.0
    assert discovery.url_resolution_timeout_seconds == 12.0
    assert discovery.url_resolution_max_fallback_queries == 4
    assert discovery.url_resolution_max_fallback_queries_single_pass == 1
    assert discovery.url_resolution_max_site_specific_queries == 7
    assert discovery.url_resolution_max_site_specific_queries_single_pass == 2
    assert discovery.dossier_context_targeted_search_enabled is True
    assert discovery.dossier_context_max_targeted_queries == 5
    assert discovery.dossier_context_max_targeted_queries_single_pass == 0
    assert discovery.dossier_context_targeted_search_concurrency == 3
    assert discovery.official_site_resolution_num_results == 4
    assert discovery.official_site_resolution_engines == ["google", "bing"]
    assert discovery.evaluation_max_tokens_default == 700
    assert discovery.evaluation_max_tokens_press_release == 410
    assert discovery.evaluation_max_tokens_official_site == 420
    assert discovery.evaluation_max_tokens_careers_annual_report == 460
