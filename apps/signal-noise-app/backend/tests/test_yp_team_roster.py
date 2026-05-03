from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest

from yp_team_roster import load_active_yp_team, load_full_yp_team, normalize_linkedin_profile_url


def test_load_full_yp_team_includes_excluded_members():
    rows = load_full_yp_team()

    assert any(row["yp_name"] == "Gunjan Parikh" and row["status"] == "excluded" for row in rows)
    assert any(row["yp_name"] == "Stuart Cope" and row["status"] == "active" for row in rows)


def test_load_active_yp_team_filters_excluded_members():
    rows = load_active_yp_team()

    assert all(row["status"] == "active" for row in rows)
    assert all(row["yp_name"] != "Gunjan Parikh" for row in rows)


def test_normalize_linkedin_profile_url_rejects_non_profile_urls():
    with pytest.raises(ValueError):
        normalize_linkedin_profile_url("https://www.linkedin.com/company/yellow-panther/")


def test_normalize_linkedin_profile_url_normalizes_regional_hosts():
    assert (
        normalize_linkedin_profile_url("https://uk.linkedin.com/in/stuart-cope-54392b16/?trk=public_profile")
        == "https://www.linkedin.com/in/stuart-cope-54392b16/"
    )
