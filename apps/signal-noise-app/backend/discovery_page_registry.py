"""
Deterministic page targeting for discovery by entity type.
"""

from __future__ import annotations

from typing import Dict, List


ENTITY_TYPE_PAGE_PRIORITIES: Dict[str, List[str]] = {
    "FEDERATION": [
        "official_site",
        "tenders_page",
        "procurement_page",
        "press_release",
        "careers_page",
        "document",
    ],
    "GOVERNING_BODY": [
        "official_site",
        "tenders_page",
        "procurement_page",
        "press_release",
        "careers_page",
        "document",
    ],
    "LEAGUE": [
        "official_site",
        "press_release",
        "careers_page",
        "tenders_page",
        "procurement_page",
        "document",
    ],
    "CLUB": [
        "official_site",
        "careers_page",
        "press_release",
        "rfp_page",
        "tenders_page",
        "procurement_page",
        "document",
    ],
}


ENTITY_TYPE_SITE_PATHS: Dict[str, Dict[str, List[str]]] = {
    "FEDERATION": {
        "tenders_page": ["/tenders", "/procurement", "/opportunities"],
        "procurement_page": ["/procurement", "/vendor-opportunities", "/suppliers"],
        "press_release": ["/news", "/press", "/media"],
        "official_site": ["/", "/about", "/about-us"],
        "document": ["/documents", "/resources", "/library"],
    },
    "GOVERNING_BODY": {
        "tenders_page": ["/tenders", "/procurement", "/opportunities"],
        "procurement_page": ["/procurement", "/vendor-opportunities", "/suppliers"],
        "press_release": ["/news", "/press", "/media"],
        "official_site": ["/", "/about", "/about-us"],
        "document": ["/documents", "/resources", "/library"],
    },
    "LEAGUE": {
        "official_site": ["/", "/about"],
        "press_release": ["/news", "/press"],
        "careers_page": ["/careers", "/jobs"],
        "tenders_page": ["/procurement", "/partners"],
    },
    "CLUB": {
        "official_site": ["/", "/club", "/about"],
        "careers_page": ["/careers", "/jobs"],
        "press_release": ["/news", "/press"],
        "rfp_page": ["/partners", "/commercial"],
    },
}


def normalize_entity_type(entity_type: str | None) -> str:
    normalized = str(entity_type or "").upper()
    if "FEDERATION" in normalized:
        return "FEDERATION"
    if "GOVERN" in normalized:
        return "GOVERNING_BODY"
    if "LEAGUE" in normalized:
        return "LEAGUE"
    return "CLUB"


def get_page_priority(entity_type: str | None) -> List[str]:
    return list(ENTITY_TYPE_PAGE_PRIORITIES[normalize_entity_type(entity_type)])


def get_page_rank(entity_type: str | None, hop_type: str) -> int:
    priority = get_page_priority(entity_type)
    try:
        return priority.index(hop_type)
    except ValueError:
        return len(priority) + 1


def get_site_path_shortcuts(entity_type: str | None, hop_type: str) -> List[str]:
    normalized = normalize_entity_type(entity_type)
    entity_paths = ENTITY_TYPE_SITE_PATHS.get(normalized, {})
    return list(entity_paths.get(hop_type, []))
