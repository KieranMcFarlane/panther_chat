#!/usr/bin/env python3
"""
Dossier Templates - Template wrapper for dossier generation

This module provides backward compatibility for dossier_generator.py by wrapping
the section prompts from dossier_section_prompts.py into the format expected
by get_prompt_template().

AUTHOR: Phase 0 Scalable Dossier System
DATE: 2026-02-23
"""

from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

# Import section definitions from dossier_section_prompts
try:
    from backend.dossier_section_prompts import (
        YELLOW_PANTHER_SERVICE_CONTEXT,
        SCORE_CONTEXT_REQUIREMENTS,
        SECTION_1_CORE_INFO,
        SECTION_2_DIGITAL_TRANSFORMATION,
        SECTION_3_AI_REASONER,
        SECTION_4_OPPORTUNITIES,
        SECTION_5_LEADERSHIP,
        SECTION_6_CONNECTIONS,
        SECTION_7_RECENT_NEWS,
        SECTION_8_PERFORMANCE,
        SECTION_9_OUTREACH,
        SECTION_10_RISK,
        SECTION_11_LEAGUE,
        ALL_SECTIONS,
        interpolate_prompt as interpolate_section_prompt
    )
    SECTION_PROMPTS_AVAILABLE = True
except ImportError:
    logger.warning("dossier_section_prompts not available - using fallback templates")
    SECTION_PROMPTS_AVAILABLE = False


# =============================================================================
# TEMPLATE NAME MAPPING
# Maps template names used in dossier_generator.py to section definitions
# =============================================================================

TEMPLATE_MAPPING = {
    # Core info templates
    "core_info_template": ("core_information", SECTION_1_CORE_INFO if SECTION_PROMPTS_AVAILABLE else None),

    # Digital transformation templates
    "digital_maturity_template": ("digital_transformation", SECTION_2_DIGITAL_TRANSFORMATION if SECTION_PROMPTS_AVAILABLE else None),

    # Leadership templates
    "leadership_profiling_template": ("leadership", SECTION_5_LEADERSHIP if SECTION_PROMPTS_AVAILABLE else None),

    # AI reasoner templates
    "ai_assessment_template": ("ai_reasoner_assessment", SECTION_3_AI_REASONER if SECTION_PROMPTS_AVAILABLE else None),

    # Challenges/Opportunities templates
    "challenges_opportunities_template": ("ai_reasoner_assessment", SECTION_3_AI_REASONER if SECTION_PROMPTS_AVAILABLE else None),

    # Strategic analysis templates
    "strategic_analysis_template": ("ai_reasoner_assessment", SECTION_3_AI_REASONER if SECTION_PROMPTS_AVAILABLE else None),

    # Connections templates
    "connections_analysis_template": ("connections", SECTION_6_CONNECTIONS if SECTION_PROMPTS_AVAILABLE else None),

    # News templates
    "news_aggregation_template": ("recent_news", SECTION_7_RECENT_NEWS if SECTION_PROMPTS_AVAILABLE else None),

    # Performance templates
    "performance_data_template": ("current_performance", SECTION_8_PERFORMANCE if SECTION_PROMPTS_AVAILABLE else None),

    # Outreach templates
    "outreach_strategy_template": ("outreach_strategy", SECTION_9_OUTREACH if SECTION_PROMPTS_AVAILABLE else None),

    # Risk templates
    "risk_assessment_template": ("risk_assessment", SECTION_10_RISK if SECTION_PROMPTS_AVAILABLE else None),

    # Quick actions templates (map to core info)
    "quick_actions_template": ("core_information", SECTION_1_CORE_INFO if SECTION_PROMPTS_AVAILABLE else None),

    # Contact info templates (map to core info)
    "contact_info_template": ("core_information", SECTION_1_CORE_INFO if SECTION_PROMPTS_AVAILABLE else None),
}


# =============================================================================
# FALLBACK TEMPLATES (used when dossier_section_prompts unavailable)
# =============================================================================

FALLBACK_TEMPLATES = {
    "core_info_template": """Generate Core Information section for {entity_name}.

Extract core information including official name, type, founded year, headquarters, primary venue, capacity, and website.

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Official Name: {entity_name}",
    "Type: [CLUB/LEAGUE/FEDERATION/VENUE]",
    "Sport: [sport]",
    "Founded: [year or 'unknown']",
    "Headquarters: [location or 'unknown']",
    "Primary Venue: [name or 'N/A']",
    "Capacity: [number or 'N/A']",
    "Website: [URL or 'unknown']"
  ],
  "metrics": [
    {{"label": "Entity Age", "value": "[years]", "context": "[benchmark]"}}
  ],
  "insights": [
    {{"insight": "Key observation", "signal_type": "[CAPABILITY]", "confidence": 0-100}}
  ]
}},

Use "unknown" when data is unavailable. Include confidence scores with explanation.
""",

    "digital_maturity_template": """Generate Digital Transformation section for {entity_name}.

Assess digital maturity, technology platforms, vendors, and strategic opportunities.

AVAILABLE DATA:
- Official Site: {official_site_url}
- Job Postings: {job_postings_summary}

{YELLOW_PANTHER_SERVICE_CONTEXT}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Digital Maturity: [score]/100",
    "Website Platform: [detected or 'unknown']",
    "CRM System: [detected or 'unknown']",
    "Analytics: [detected or 'unknown']",
    "Mobile Apps: [yes/no/partial]",
    "Primary Tech Partners: [vendors or 'unknown']"
  ],
  "metrics": [
    {{
      "label": "Digital Maturity Score",
      "value": [0-100],
      "meaning": "[explanation]",
      "why": "[evidence]",
      "benchmark": "[vs industry]",
      "action": "[next step]"
    }}
  ],
  "insights": [
    {{"insight": "Digital strength or gap", "signal_type": "[CAPABILITY]", "confidence": 0-100}}
  ]
}}

Every score MUST include meaning, why, benchmark, action.
""",

    "leadership_profiling_template": """Generate Key Decision Makers section for {entity_name}.

CRITICAL CONTACT VALIDATION RULES:
- Use REAL names only (NO placeholders like FEDERATION PRESIDENT)
- Specific titles required
- Use "unknown" when specific person cannot be identified
- Mark confidence levels for all contact assertions

AVAILABLE DATA:
{metadata_summary}
Leadership Names Found: {leadership_names}
Leadership Roles: {leadership_roles}
LinkedIn URLs: {leadership_linkedins}

OUTPUT FORMAT (JSON):
{
  "content": [
    "Decision Maker 1: Name: REAL NAME or unknown, Title: specific title, Influence: HIGH or MEDIUM or LOW, Scope: what they control",
    "Decision Maker 2: Name: REAL NAME or unknown, Title: specific title, Influence: HIGH or MEDIUM or LOW, Scope: what they control"
  ],
  "metrics": [
    {
      "label": "Leadership Accessibility",
      "value": 0-100,
      "meaning": "how accessible decision makers are",
      "why": "contact availability evidence",
      "benchmark": "vs industry average",
      "action": "approach recommendation"
    }
  ],
  "insights": [
    {
      "insight": "Leadership team observation",
      "signal_type": "CONTACT",
      "confidence": 0-100
    }
  ],
  "recommendations": [
    {
      "decision_maker": "Name or Leadership Team",
      "yp_angle": "How to frame Yellow Panther value",
      "messaging": "What resonates with this person",
      "service_fit": "relevant YP services",
      "contact_channel": "email or linkedin or warm_intro"
    }
  ]
}

CONTACT VALIDATION:
- REAL names only - reject ROLE placeholders
- Specific titles: Commercial Director, Technical Director, Head of Digital
- Use unknown when contact cannot be identified
""",

    "ai_assessment_template": """Generate AI Reasoner Assessment section for {entity_name}.

Strategic synthesis combining all available data.

{YELLOW_PANTHER_SERVICE_CONTEXT}

AVAILABLE DATA:
{metadata_summary}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Overall Assessment: [executive summary]",
    "YP Opportunity: [specific services]",
    "Entry Point: [pilot/partnership]",
    "Estimated Probability: [0-100]%",
    "Risk Level: [LOW|MEDIUM|HIGH]"
  ],
  "metrics": [
    {{
      "label": "Strategic Fit Score",
      "value": [0-100],
      "meaning": "[how well entity matches]",
      "why": "[evidence]",
      "benchmark": "[vs similar]",
      "action": "[approach]"
    }}
  ],
  "insights": [
    {{"insight": "Strategic observation", "signal_type": "[PROCUREMENT]", "confidence": 0-100}}
  ],
  "recommendations": [
    {{
      "yp_service": "Specific service",
      "fit_reason": "Why it matches",
      "entry_strategy": "How to approach",
      "probability": 0-100,
      "estimated_budget": "£XX-£XXX",
      "timeline": "X-Y months"
    }}
  ]
}}
""",

    "connections_analysis_template": """Generate Connections Analysis section for {entity_name}.

YELLOW PANTHER TEAM DATA:
{yp_team_data}

TARGET ENTITY PERSONNEL:
{target_personnel_data}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Primary Connection Analysis]",
    "",
    "[Stuart Cope]:",
    "- Direct Connections: [count or 'none']",
    "- Connection Strength: [strong/medium/weak/none]",
    "",
    "[Gunjan Parikh]:",
    "...",
    "",
    "[Recommended Approach]: [which YP member should lead]"
  ],
  "metrics": [
    {{
      "label": "Connection Strength",
      "value": 0-100,
      "meaning": "[overall quality]",
      "why": "[evidence]",
      "benchmark": "[vs others]",
      "action": "[approach]"
    }}
  ],
  "insights": [
    {{"insight": "Network observation", "signal_type": "[CONTACT]", "confidence": 0-100}}
  ],
  "recommendations": [
    {{
      "yp_member": "Which member should lead",
      "introduction_path": "Direct/Bridge/Cold",
      "mutual_connections": ["names"],
      "talking_points": ["hooks"],
      "success_probability": 0-100,
      "rationale": "Why this approach"
    }}
  ]
}}
""",

    "news_aggregation_template": """Generate Recent News section for {entity_name}.

AVAILABLE DATA:
{press_releases_summary}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Recent News - Last 90 Days]",
    "[Date] - [Headline]",
    "Source: [source]",
    "Category: [technology|partnership|operations]",
    "Signals: [PROCUREMENT|CAPABILITY|TIMING|CONTACT]"
  ],
  "metrics": [
    {{
      "label": "News Relevance Score",
      "value": 0-100,
      "meaning": "[how relevant]",
      "why": "[analysis]",
      "benchmark": "[vs average]",
      "action": "[how to use]"
    }}
  ],
  "insights": [
    {{"insight": "Strategic signal", "signal_type": "[PROCUREMENT]", "confidence": 0-100}
  ]
}}

If no recent news: "No procurement-relevant news found in last 90 days"
""",

    "performance_data_template": """Generate Current Performance section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Current Season Performance]",
    "League Position: [position]",
    "Points: [points]",
    "Recent Form: [last 5]",
    "",
    "[Key Statistics]",
    "Wins: [count], Draws: [count], Losses: [count]"
  ],
  "metrics": [
    {{
      "label": "Performance Index",
      "value": 0-100,
      "meaning": "[vs expectations]",
      "why": "[analysis]",
      "benchmark": "[vs history]",
      "action": "[context for outreach]"
    }}
  ],
  "insights": [
    {{"insight": "Performance observation", "signal_type": "[CAPABILITY]", "confidence": 0-100}
  ]
}}

If not sports entity: "N/A - not a sports entity"
""",

    "outreach_strategy_template": """Generate Outreach Strategy section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}
{job_postings_summary}

OUTPUT FORMAT (JSON):
{
  "content": [
    "Approach Type: warm or lukewarm or cold",
    "Contact Strategy: Primary Channel is email or linkedin or warm_intro",
    "Optimal Timing: when to reach out",
    "Personalization Tokens: recent_initiative example, specific_technology example",
    "Conversation Starters: Topic with why and talking points",
    "Anti-Patterns to Avoid: mistake 1, mistake 2"
  ],
  "metrics": [
    {
      "label": "Approach Confidence",
      "value": 0-100,
      "meaning": "confidence this approach will work",
      "why": "evidence from entity research",
      "benchmark": "vs industry response rates",
      "action": "how to execute this approach"
    }
  ],
  "insights": [
    {
      "insight": "Strategic observation for outreach",
      "signal_type": "CONTACT",
      "confidence": 0-100
    }
  ],
  "recommendations": [
    {
      "approach": "warm or lukewarm or cold",
      "primary_channel": "email or linkedin",
      "messaging_angle": "how to frame Yellow Panther value",
      "timing": "specific timeframe",
      "personalization": "token1, token2",
      "expected_response_rate": 0-100
    }
  ]
}
""",

    "risk_assessment_template": """Generate Risk Assessment section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Implementation Risks]",
    "- [Risk]: Probability: [0-100] - Impact: [HIGH|MEDIUM|LOW]",
    "",
    "[Competitive Landscape]",
    "Incumbents: [vendors]",
    "Switching Costs: [description]",
    "",
    "[Yellow Panther Differentiation]",
    "- [Advantage]"
  ],
  "metrics": [
    {{
      "label": "Risk-Adjusted Opportunity Score",
      "value": 0-100,
      "meaning": "[opportunity adjusted for risk]",
      "why": "[risk vs reward]",
      "benchmark": "[vs average]",
      "action": "[mitigation]"
    }}
  ],
  "insights": [
    {{"insight": "Risk observation", "signal_type": "[CAPABILITY]", "confidence": 0-100}
  ],
  "recommendations": [
    {{
      "risk": "Specific risk",
      "probability": 0-100,
      "impact": "HIGH|MEDIUM|LOW",
      "mitigation": "How YP addresses",
      "yp_differentiation": "Advantage"
    }}
  ]
}}
""",

    "quick_actions_template": """Generate Quick Actions section for {entity_name}.

Provide immediate actionable next steps.

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Immediate Actions]",
    "1. [Action] - Priority: [HIGH|MEDIUM|LOW] - Timeline: [when]",
    "2. [Action] - Priority: [HIGH|MEDIUM|LOW] - Timeline: [when]",
    "3. [Action] - Priority: [HIGH|MEDIUM|LOW] - Timeline: [when]"
  ],
  "metrics": [],
  "insights": [
    {{"insight": "Action recommendation", "signal_type": "[PROCUREMENT]", "confidence": 0-100}
  ],
  "recommendations": []
}}
""",

    "contact_info_template": """Generate Contact Information section for {entity_name}.

Provide location and contact details.

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Headquarters: [location or 'unknown']",
    "Primary Venue: [name or 'N/A']",
    "Website: [URL or 'unknown']",
    "Email: [available or 'unknown']",
    "Phone: [available or 'unknown']"
  ],
  "metrics": [],
  "insights": [],
  "recommendations": []
}}
""",

    "challenges_opportunities_template": """Generate Challenges and Opportunities section for {entity_name}.

Identify key challenges and strategic opportunities.

{YELLOW_PANTHER_SERVICE_CONTEXT}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Key Challenges]",
    "- [Challenge 1]: [description]",
    "- [Challenge 2]: [description]",
    "",
    "[Strategic Opportunities]",
    "- [Opportunity 1]: [description]",
    "- [Opportunity 2]: [description]"
  ],
  "metrics": [
    {{
      "label": "Opportunity Score",
      "value": 0-100,
      "meaning": "[overall opportunity]",
      "why": "[evidence]",
      "benchmark": "[vs others]",
      "action": "[pursuit strategy]"
    }}
  ],
  "insights": [
    {{"insight": "Opportunity observation", "signal_type": "[PROCUREMENT]", "confidence": 0-100}
  ],
  "recommendations": [
    {{
      "opportunity": "Specific opportunity",
      "yp_service": "Service fit",
      "priority": "HIGH|MEDIUM|LOW",
      "estimated_budget": "£XX-£XXX"
    }}
  ]
}}
""",

    "strategic_analysis_template": """Generate Strategic Analysis section for {entity_name}.

Deep strategic analysis with Yellow Panther opportunity assessment.

{YELLOW_PANTHER_SERVICE_CONTEXT}

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Strategic Assessment]",
    "Overall: [executive summary]",
    "YP Opportunity: [specific services]",
    "Entry Point: [pilot/partnership]",
    "",
    "[Competitive Positioning]",
    "Strengths: [list]",
    "Gaps: [list]"
  ],
  "metrics": [
    {{
      "label": "Strategic Fit",
      "value": 0-100,
      "meaning": "[how well entity fits]",
      "why": "[evidence]",
      "benchmark": "[vs ideal profile]",
      "action": "[engagement approach]"
    }}
  ],
  "insights": [
    {{"insight": "Strategic insight", "signal_type": "[PROCUREMENT]", "confidence": 0-100}
  ],
  "recommendations": [
    {{
      "yp_service": "Service",
      "fit_reason": "Why it matches",
      "probability": 0-100,
      "estimated_budget": "£XX-£XXX"
    }}
  ]
}}
""",
}


# =============================================================================
# PUBLIC API FUNCTIONS
# =============================================================================

def get_prompt_template(template_name: str, model: str = "haiku") -> str:
    """
    Get a prompt template by name.

    Args:
        template_name: Name of the template (e.g., "core_info_template")
        model: Model variant (haiku/sonnet/opus) - for future customization

    Returns:
        Prompt template string with placeholders

    Raises:
        ValueError: If template_name is not found
    """
    if SECTION_PROMPTS_AVAILABLE and template_name in TEMPLATE_MAPPING:
        section_id, section_def = TEMPLATE_MAPPING[template_name]
        if section_def:
            # Get prompt from section definition
            prompt = section_def.get("prompt_template", "")
            # Inject context if needed
            prompt = prompt.replace("{YELLOW_PANTHER_SERVICE_CONTEXT}", YELLOW_PANTHER_SERVICE_CONTEXT)
            prompt = prompt.replace("{SCORE_CONTEXT_REQUIREMENTS}", SCORE_CONTEXT_REQUIREMENTS)
            return prompt

    # Fallback to hardcoded templates
    if template_name in FALLBACK_TEMPLATES:
        template = FALLBACK_TEMPLATES[template_name]
        # Inject YP context if needed
        if "{YELLOW_PANTHER_SERVICE_CONTEXT}" in template:
            try:
                from dossier_section_prompts import YELLOW_PANTHER_SERVICE_CONTEXT as YP_CONTEXT
                template = template.replace("{YELLOW_PANTHER_SERVICE_CONTEXT}", YP_CONTEXT)
            except ImportError:
                pass
        return template

    raise ValueError(f"Unknown template: {template_name}")


def list_all_templates() -> Dict[str, str]:
    """
    List all available templates.

    Returns:
        Dict mapping template names to descriptions
    """
    templates = {}
    for name, (section_id, section_def) in TEMPLATE_MAPPING.items():
        if section_def:
            templates[name] = section_def.get("title", section_id)
        else:
            templates[name] = f"{section_id} (fallback)"
    return templates


def get_template_names() -> list:
    """
    Get list of all template names.

    Returns:
        List of template name strings
    """
    return list(TEMPLATE_MAPPING.keys())


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    "get_prompt_template",
    "list_all_templates",
    "get_template_names",
    "TEMPLATE_MAPPING",
    "FALLBACK_TEMPLATES"
]
