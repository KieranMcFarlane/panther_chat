#!/usr/bin/env python3
"""Objective-scoped runtime profiles for evidence-first pipeline execution."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

VALID_RUN_OBJECTIVES = {
    "rfp_pdf",
    "rfp_web",
    "dossier_core",
    "leadership_enrichment",
    "news_signals",
}

DEFAULT_PIPELINE_OBJECTIVE = "rfp_web"
DEFAULT_DOSSIER_OBJECTIVE = "dossier_core"

OBJECTIVE_PROFILES: Dict[str, Dict[str, Any]] = {
    "rfp_pdf": {
        "enable_leadership_enrichment": False,
        "enable_question_extraction": False,
        "strict_json_extraction": True,
        "fast_fail_length": True,
        "pass_a_lanes": ["governance_pdf", "annual_report", "rfp_procurement_tenders"],
        "pass_b_lanes": ["press_release", "trusted_news"],
        "budget": {
            "max_hops": 4,
            "max_evals_per_hop": 2,
            "per_iteration_timeout": 25.0,
            "max_retries": 2,
            "max_same_domain_revisits": 1,
        },
    },
    "rfp_web": {
        "enable_leadership_enrichment": False,
        "enable_question_extraction": False,
        "strict_json_extraction": True,
        "fast_fail_length": True,
        "pass_a_lanes": ["official_site", "press_release", "trusted_news", "careers"],
        "pass_b_lanes": ["rfp_procurement_tenders", "governance_pdf", "annual_report"],
        "budget": {
            "max_hops": 5,
            "max_evals_per_hop": 2,
            "per_iteration_timeout": 30.0,
            "max_retries": 2,
            "max_same_domain_revisits": 2,
        },
    },
    "dossier_core": {
        "enable_leadership_enrichment": False,
        "enable_question_extraction": False,
        "strict_json_extraction": True,
        "fast_fail_length": True,
        "pass_a_lanes": ["official_site", "press_release", "careers", "trusted_news"],
        "pass_b_lanes": ["annual_report", "rfp_procurement_tenders"],
        "budget": {
            "max_hops": 5,
            "max_evals_per_hop": 2,
            "per_iteration_timeout": 30.0,
            "max_retries": 2,
            "max_same_domain_revisits": 2,
        },
    },
    "leadership_enrichment": {
        "enable_leadership_enrichment": True,
        "enable_question_extraction": True,
        "strict_json_extraction": True,
        "fast_fail_length": True,
        "pass_a_lanes": ["official_site", "careers", "trusted_news", "linkedin_jobs"],
        "pass_b_lanes": ["press_release", "broader_press"],
        "budget": {
            "max_hops": 6,
            "max_evals_per_hop": 2,
            "per_iteration_timeout": 35.0,
            "max_retries": 2,
            "max_same_domain_revisits": 2,
        },
    },
    "news_signals": {
        "enable_leadership_enrichment": False,
        "enable_question_extraction": False,
        "strict_json_extraction": True,
        "fast_fail_length": True,
        "pass_a_lanes": ["press_release", "trusted_news", "broader_press"],
        "pass_b_lanes": ["official_site", "annual_report"],
        "budget": {
            "max_hops": 4,
            "max_evals_per_hop": 2,
            "per_iteration_timeout": 25.0,
            "max_retries": 2,
            "max_same_domain_revisits": 2,
        },
    },
}


def normalize_run_objective(run_objective: str | None, *, default: str = DEFAULT_PIPELINE_OBJECTIVE) -> str:
    raw = str(run_objective or "").strip().lower()
    if raw in VALID_RUN_OBJECTIVES:
        return raw
    return default


def get_objective_profile(run_objective: str | None, *, default: str = DEFAULT_PIPELINE_OBJECTIVE) -> Dict[str, Any]:
    normalized = normalize_run_objective(run_objective, default=default)
    base = OBJECTIVE_PROFILES.get(normalized) or OBJECTIVE_PROFILES[default]
    return deepcopy(base)


def apply_objective_runtime_overrides(claude_client: Any, run_objective: str) -> Dict[str, Any]:
    """Apply objective-specific LLM retry posture to a client instance."""
    profile = get_objective_profile(run_objective)
    if not profile.get("fast_fail_length"):
        return {}

    applied: Dict[str, Any] = {}
    for attr, value in (
        ("chutes_empty_retries_before_fallback", 1),
        ("chutes_retries_before_fallback", 1),
        ("chutes_max_retries", 1),
    ):
        if hasattr(claude_client, attr):
            try:
                setattr(claude_client, attr, value)
                applied[attr] = value
            except Exception:
                continue
    return applied
