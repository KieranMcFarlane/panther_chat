"""
Prompt templates for dossier section generation.

This module provides the template lookup API used by dossier generation and
legacy tests.
"""

from __future__ import annotations

from typing import Dict, List


def _json_prompt(task: str) -> str:
    return (
        f"{task} for {{entity_name}}.\n\n"
        "Return valid JSON only with this shape:\n"
        "{{\n"
        '  "content": ["bullet 1", "bullet 2"],\n'
        '  "metrics": [{{"label": "Metric", "value": "Value"}}],\n'
        '  "insights": ["insight"],\n'
        '  "recommendations": ["recommendation"],\n'
        '  "confidence": 0.7\n'
        "}}"
    )


_COMMON_TEMPLATES: Dict[str, str] = {
    "core_info_template": _json_prompt("Extract core organization profile"),
    "quick_actions_template": _json_prompt("Produce immediate outbound action plan"),
    "contact_info_template": _json_prompt("Summarize contact channels and key addresses"),
    "news_aggregation_template": _json_prompt("Summarize recent and relevant news"),
    "performance_data_template": _json_prompt("Summarize current performance indicators"),
    "digital_maturity_template": _json_prompt("Assess digital maturity and transformation posture"),
    "leadership_profiling_template": _json_prompt("Profile leadership priorities and themes"),
    "ai_assessment_template": _json_prompt("Assess AI readiness and automation opportunities"),
    "challenges_opportunities_template": _json_prompt("Identify key challenges and opportunities"),
    "strategic_analysis_template": _json_prompt("Deliver strategic analysis for sales pursuit"),
    "connections_analysis_template": _json_prompt("Map relevant network and partnership connections"),
    "outreach_strategy_template": _json_prompt("Build a role-specific outreach and conversation strategy"),
}


HAIKU_TEMPLATES: Dict[str, str] = dict(_COMMON_TEMPLATES)
SONNET_TEMPLATES: Dict[str, str] = dict(_COMMON_TEMPLATES)
OPUS_TEMPLATES: Dict[str, str] = dict(_COMMON_TEMPLATES)


def get_prompt_template(template_name: str, model: str = "haiku") -> str:
    """Return the prompt template for a section and model tier."""
    model_key = (model or "haiku").strip().lower()
    model_map = {
        "haiku": HAIKU_TEMPLATES,
        "sonnet": SONNET_TEMPLATES,
        "opus": OPUS_TEMPLATES,
    }.get(model_key, HAIKU_TEMPLATES)

    template = model_map.get(template_name) or _COMMON_TEMPLATES.get(template_name)
    if not template:
        raise KeyError(f"Unknown dossier template: {template_name}")
    return template


def list_all_templates() -> List[str]:
    """Return all known dossier prompt template names."""
    return sorted(_COMMON_TEMPLATES.keys())

