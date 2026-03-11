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
    assert discovery.evaluation_max_tokens_default == 700
    assert discovery.evaluation_max_tokens_press_release == 410
    assert discovery.evaluation_max_tokens_official_site == 420
    assert discovery.evaluation_max_tokens_careers_annual_report == 460
