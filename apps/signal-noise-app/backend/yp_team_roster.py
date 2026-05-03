#!/usr/bin/env python3
"""CSV-backed Yellow Panther roster utilities."""

from __future__ import annotations

import csv
import logging
import re
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

YP_TEAM_CSV_PATH = Path(__file__).resolve().parent / "data" / "dossier_templates" / "yp_team.csv"
VALID_MEMBER_STATUSES = {"active", "excluded"}

DEFAULT_YP_TEAM_ROSTER: List[Dict[str, Any]] = [
    {
        "member_id": "stuart-cope",
        "display_order": 10,
        "yp_name": "Stuart Cope",
        "yp_role": "Co-Founder & COO",
        "yp_linkedin": "https://www.linkedin.com/in/stuart-cope-54392b16/",
        "yp_weight": 1.5,
        "yp_expertise_1": "Operations",
        "yp_expertise_2": "Client Relationships",
        "yp_expertise_3": "Strategic Partnerships",
        "status": "active",
    },
    {
        "member_id": "andrew-rapley",
        "display_order": 20,
        "yp_name": "Andrew Rapley",
        "yp_role": "Head of Projects",
        "yp_linkedin": "https://www.linkedin.com/in/andrew-rapley/",
        "yp_weight": 1.3,
        "yp_expertise_1": "Project Management",
        "yp_expertise_2": "Delivery Excellence",
        "yp_expertise_3": "Client Success",
        "status": "active",
    },
    {
        "member_id": "sarfraz-hussain",
        "display_order": 30,
        "yp_name": "Sarfraz Hussain",
        "yp_role": "Head of Strategy",
        "yp_linkedin": "https://www.linkedin.com/in/sarfraz-hussain/",
        "yp_weight": 1.2,
        "yp_expertise_1": "Strategic Planning",
        "yp_expertise_2": "Market Analysis",
        "yp_expertise_3": "Growth Strategy",
        "status": "active",
    },
    {
        "member_id": "elliott-hillman",
        "display_order": 40,
        "yp_name": "Elliott Hillman",
        "yp_role": "Senior Client Partner",
        "yp_linkedin": "https://www.linkedin.com/in/elliott-hillman/",
        "yp_weight": 1.2,
        "yp_expertise_1": "Client Partnerships",
        "yp_expertise_2": "Sports Industry",
        "yp_expertise_3": "Business Development",
        "status": "active",
    },
    {
        "member_id": "gunjan-parikh",
        "display_order": 50,
        "yp_name": "Gunjan Parikh",
        "yp_role": "Founder & CEO",
        "yp_linkedin": "https://www.linkedin.com/in/gunjan-parikh/",
        "yp_weight": 1.3,
        "yp_expertise_1": "Strategic Vision",
        "yp_expertise_2": "Business Development",
        "yp_expertise_3": "Client Strategy",
        "status": "excluded",
    },
]


def _slugify(value: Any) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())).strip("-") or "member"


def normalize_linkedin_profile_url(url: Any) -> str:
    value = str(url or "").strip()
    if not value:
        raise ValueError("LinkedIn URL is required")

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("LinkedIn URL must start with http:// or https://")

    host = (parsed.netloc or "").lower()
    if "linkedin.com" not in host:
        raise ValueError("LinkedIn URL must point to linkedin.com")

    path = re.sub(r"/+", "/", parsed.path or "").rstrip("/")
    match = re.fullmatch(r"/in/([^/?#]+)", path)
    if not match:
        raise ValueError("LinkedIn URL must be a person profile URL like https://www.linkedin.com/in/name/")

    return f"https://www.linkedin.com/in/{match.group(1)}/"


def _coerce_display_order(value: Any, *, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return parsed if parsed > 0 else fallback


def _coerce_weight(value: Any) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = 1.0
    return parsed if parsed > 0 else 1.0


def normalize_yp_team_member(row: Dict[str, Any], *, fallback_order: int) -> Dict[str, Any]:
    member_id = str(row.get("member_id") or "").strip() or _slugify(row.get("yp_name"))
    yp_name = str(row.get("yp_name") or "").strip()
    yp_role = str(row.get("yp_role") or "").strip()
    if not yp_name:
        raise ValueError("yp_name is required")
    if not yp_role:
        raise ValueError("yp_role is required")

    status = str(row.get("status") or "").strip().lower() or "active"
    if status not in VALID_MEMBER_STATUSES:
        raise ValueError("status must be active or excluded")

    return {
        "member_id": member_id,
        "display_order": _coerce_display_order(row.get("display_order"), fallback=fallback_order),
        "yp_name": yp_name,
        "yp_role": yp_role,
        "yp_linkedin": normalize_linkedin_profile_url(row.get("yp_linkedin")),
        "yp_weight": _coerce_weight(row.get("yp_weight")),
        "yp_expertise_1": str(row.get("yp_expertise_1") or "").strip(),
        "yp_expertise_2": str(row.get("yp_expertise_2") or "").strip(),
        "yp_expertise_3": str(row.get("yp_expertise_3") or "").strip(),
        "status": status,
    }


def _sort_roster(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(rows, key=lambda item: (int(item.get("display_order") or 0), str(item.get("yp_name") or "").lower()))


def load_yp_team_roster(
    *,
    csv_path: Optional[str | Path] = None,
    include_excluded: bool = True,
) -> List[Dict[str, Any]]:
    path = Path(csv_path) if csv_path is not None else YP_TEAM_CSV_PATH
    if not path.exists():
        logger.warning("YP roster CSV missing at %s; using embedded fallback roster", path)
        rows = deepcopy(DEFAULT_YP_TEAM_ROSTER)
    else:
        rows = []
        with open(path, "r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for index, raw_row in enumerate(reader, start=1):
                if not isinstance(raw_row, dict):
                    continue
                if not any(str(value or "").strip() for value in raw_row.values()):
                    continue
                rows.append(normalize_yp_team_member(raw_row, fallback_order=index * 10))

    if not include_excluded:
        rows = [row for row in rows if row.get("status") == "active"]
    return _sort_roster(rows)


def load_active_yp_team(*, csv_path: Optional[str | Path] = None) -> List[Dict[str, Any]]:
    return load_yp_team_roster(csv_path=csv_path, include_excluded=False)


def load_full_yp_team(*, csv_path: Optional[str | Path] = None) -> List[Dict[str, Any]]:
    return load_yp_team_roster(csv_path=csv_path, include_excluded=True)
