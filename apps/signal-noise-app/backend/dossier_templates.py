"""
Prompt templates for dossier section generation.

This module provides the template lookup API used by dossier generation and
legacy tests.
"""

from __future__ import annotations

from typing import Dict, List, Optional


def _json_prompt(
    task: str,
    *,
    mode: str,
    section_rules: Optional[List[str]] = None,
    require_evidence_tags: bool = False,
) -> str:
    rules = section_rules or []
    rules_text = "\n".join(f"- {rule}" for rule in rules)
    content_shape = (
        '  "content": ["bullet 1 [evidence_level=...; source_type=...; last_verified_at=...; needs_review=...]"],\n'
        if require_evidence_tags
        else '  "content": ["bullet 1", "bullet 2"],\n'
    )
    metrics_shape = (
        '  "metrics": [{{"label": "Metric", "value": "Value", "source_type": "official|news|internal_analysis|model_synthesis", "last_verified_at": "YYYY-MM-DD|unknown", "needs_review": false}}],\n'
        if require_evidence_tags
        else '  "metrics": [{{"label": "Metric", "value": "Value"}}],\n'
    )
    insights_shape = (
        '  "insights": [{{"text": "insight", "evidence_level": "verified|inferred|speculative", "source_type": "official|news|internal_analysis|model_synthesis", "last_verified_at": "YYYY-MM-DD|unknown", "needs_review": false}}],\n'
        if require_evidence_tags
        else '  "insights": ["insight"],\n'
    )
    recommendations_shape = (
        '  "recommendations": [{{"text": "recommendation", "source_type": "internal_analysis", "needs_review": true}}],\n'
        if require_evidence_tags
        else '  "recommendations": ["recommendation"],\n'
    )
    prompt = (
        f"{task} for {{entity_name}}.\n\n"
        f"Section mode: {mode}.\n"
        "Primary objective: produce user-facing output only.\n"
        "Hard output rules:\n"
        "- No process commentary, no chain-of-thought, no markdown fences.\n"
        "- No placeholders like 'Item 1', 'TBD', '...'.\n"
        "- Do not invent numbers; if unknown, say 'Unknown' and lower confidence.\n"
        "- Keep claims concise and attributable.\n"
    )
    if require_evidence_tags:
        prompt += (
            "- Every factual bullet in content MUST end with metadata tags in this exact format:\n"
            "  [evidence_level=verified|inferred|speculative; source_type=official|news|internal_analysis|model_synthesis; "
            "last_verified_at=YYYY-MM-DD|unknown; needs_review=true|false]\n"
        )
    if rules_text:
        prompt += f"{rules_text}\n"

    prompt += (
        "\nReturn valid JSON only with this shape:\n"
        "{{\n"
        f"{content_shape}"
        f"{metrics_shape}"
        f"{insights_shape}"
        f"{recommendations_shape}"
        '  "confidence": 0.7\n'
        "}}"
    )
    return prompt


_COMMON_TEMPLATES: Dict[str, str] = {
    "core_info_template": _json_prompt(
        "Extract core organization profile",
        mode="factual_profile",
        require_evidence_tags=True,
        section_rules=[
            "Include legal/known name, entity type, country/HQ, founding year (if known), and official website.",
            "Do not output generic filler text; each bullet must be entity-specific.",
            "If a field is unavailable, say so explicitly instead of guessing.",
        ],
    ),
    "quick_actions_template": _json_prompt(
        "Produce immediate outbound action plan",
        mode="commercial_outreach",
        section_rules=[
            "Treat actions as hypotheses, not confirmed facts.",
            "Recommendations should be practical and sequenced.",
        ],
    ),
    "contact_info_template": _json_prompt(
        "Summarize contact channels and key addresses",
        mode="factual_profile",
        require_evidence_tags=False,
        section_rules=[
            "Prioritize official channels and include URLs where available.",
        ],
    ),
    "news_aggregation_template": _json_prompt(
        "Summarize recent and relevant news",
        mode="factual_profile",
        require_evidence_tags=True,
        section_rules=[
            "Include publication/event date in each bullet.",
            "Separate confirmed events from interpretation.",
            "Mark anything older than 180 days as historical context.",
        ],
    ),
    "performance_data_template": _json_prompt(
        "Summarize current performance indicators",
        mode="factual_profile",
        require_evidence_tags=True,
        section_rules=[
            "Require measurable KPIs, rankings, or outcomes with as-of dates.",
            "Do not include internal process text, reasoning artifacts, or options.",
            "If no reliable current KPI exists, state data unavailable and reduce confidence.",
        ],
    ),
    "digital_maturity_template": _json_prompt(
        "Assess digital maturity and transformation posture",
        mode="strategic_recommendations",
        section_rules=[
            "Clearly distinguish observations from inferred analysis.",
        ],
    ),
    "leadership_profiling_template": _json_prompt(
        "Profile leadership team and governance priorities",
        mode="factual_profile",
        require_evidence_tags=True,
        section_rules=[
            "Include named leaders, roles, and decision scope when available.",
            "If names are unavailable, say leadership roster unavailable.",
            "Do not replace leadership facts with generic strategic advice.",
        ],
    ),
    "ai_assessment_template": _json_prompt(
        "Assess AI readiness and automation opportunities",
        mode="strategic_recommendations",
    ),
    "challenges_opportunities_template": _json_prompt(
        "Identify key challenges and opportunities",
        mode="strategic_recommendations",
    ),
    "strategic_analysis_template": _json_prompt(
        "Deliver strategic analysis for sales pursuit",
        mode="strategic_recommendations",
    ),
    "connections_analysis_template": _json_prompt(
        "Map relevant network and partnership connections",
        mode="factual_profile",
    ),
    "outreach_strategy_template": _json_prompt(
        "Build a role-specific outreach and conversation strategy",
        mode="commercial_outreach",
        section_rules=[
            "Keep this section recommendation-focused and avoid presenting hypotheses as verified facts.",
        ],
    ),
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
