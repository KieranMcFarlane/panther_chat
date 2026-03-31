#!/usr/bin/env python3
"""
Dossier Section Prompts - Question-Driven Dossier Generation

This module defines prompt templates for each of the 11 dossier sections.
Each prompt is structured around specific questions to answer, required data sources,
and expected output format.

PURPOSE: Enable scalable dossier generation across 3,000+ entities by providing
structured, question-driven prompts that avoid generic/template responses.

SECTION STRUCTURE:
- Section ID and Tier (BASIC/STANDARD/PREMIUM)
- Questions to Answer: Specific questions this section answers
- Input Data Required: What data sources are needed
- BrightData Collection Queries: What web queries to run
- Prompt Template: The actual prompt for LLM generation

AUTHOR: Phase 0 Scalable Dossier System
DATE: 2026-02-22
"""

from typing import Dict, List, Any, Optional, Literal
from dataclasses import dataclass
from enum import Enum


class DossierTier(Enum):
    """Dossier generation tiers"""
    BASIC = "BASIC"       # 3 sections, ~5s, ~$0.0004
    STANDARD = "STANDARD" # 7 sections, ~15s, ~$0.0095
    PREMIUM = "PREMIUM"   # 11 sections, ~30s, ~$0.057


# =============================================================================
# YELLOW PANTHER SERVICE CONTEXT (Shared across all prompts)
# =============================================================================

YELLOW_PANTHER_SERVICE_CONTEXT = """
YELLOW PANTHER SERVICES & CAPABILITIES:

Service Categories:
- MOBILE_APPS: iOS/Android, React Native, Flutter, native apps, fan apps
  Budget: £80K-£300K | Timeline: 3-6 months
  Case Studies: Team GB (Olympic app, STA Award 2024), LNB (French basketball)

- DIGITAL_TRANSFORMATION: Modernization, cloud migration, legacy system upgrades
  Budget: £150K-£500K | Timeline: 6-12 months
  Case Study: Premier Padel (3-year strategic partnership)

- FAN_ENGAGEMENT: Fan platforms, supporter experience, fan communication
  Budget: £80K-£300K | Timeline: 3-6 months
  Case Studies: FIBA 3×3, ISU

- ANALYTICS: Data platforms, BI, reporting, sports analytics
  Budget: £100K-£400K | Timeline: 3-9 months
  Case Study: ISU (International Skating Union analytics platform)

- ECOMMERCE: Ticketing, merchandise, retail platforms, hospitality
  Budget: £80K-£250K | Timeline: 3-6 months
  Case Study: BNP Paribas Open (ticketing platform)

- UI_UX_DESIGN: User experience, website redesign, app design
  Budget: £50K-£200K | Timeline: 2-4 months

Ideal Project Profile: £80K-£500K budget, 3-12 months timeline, 2-8 developers

Positioning Strategies:
1. SOLUTION_PROVIDER: For RFP signals - respond to specific procurement needs
2. STRATEGIC_PARTNER: For digital initiatives - advisory relationship
3. CAPABILITY_PARTNER: For hiring signals - tool timing, scale with team
4. INNOVATION_PARTNER: For partnership seeking - co-creation mode
5. TRUSTED_ADVISOR: For mutual connections - referral mode
"""


SCORE_CONTEXT_REQUIREMENTS = """
CRITICAL: For EVERY score you provide, you MUST include:

1. **The Score**: Numeric value (0-100)
2. **What It Means**: Plain English explanation
3. **Why This Score**: Evidence-based reasoning
4. **Comparison**: Industry benchmark or context
5. **What To Do**: Actionable next step

Example format:
"Digital Maturity: 72/100 (High)
- **Meaning**: This entity has advanced digital capabilities with integrated systems
- **Why**: Recent CRM platform announcement, active social media, job postings for data analysts
- **Benchmark**: Above industry average (most clubs: 55-65)
- **Action**: Position Yellow Panther as strategic partner for next-phase optimization"

EVERY score in the dossier MUST include these 4 elements.
"""


# =============================================================================
# SECTION 1: CORE INFORMATION (BASIC Tier)
# =============================================================================

SECTION_1_CORE_INFO = {
    "section_id": "core_information",
    "title": "Core Information",
    "tier": DossierTier.BASIC,
    "questions_to_answer": [
        "What is the entity's official name, type, and primary sport/industry?",
        "When was it founded and where is it headquartered?",
        "What is the primary venue/facility and capacity?",
        "What is the official website URL?",
        "What is the employee count range?"
    ],
    "input_data_required": [
        "entity_id", "official_name", "type", "sport", "country",
        "league", "founded_year", "headquarters", "stadium_name",
        "capacity", "website_url", "employee_count", "description"
    ],
    "brightdata_queries": [
        "{entity} official website",
        "{entity} founded history",
        "{entity} stadium capacity",
        "{entity} headquarters location"
    ],
    "prompt_template": """
Generate Core Information section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}

YELLOW PANTHER SERVICES:
{YELLOW_PANTHER_SERVICE_CONTEXT}

QUESTIONS TO ANSWER:
1. What is the entity's official name, type, and primary sport/industry?
2. When was it founded and where is it headquartered?
3. What is the primary venue/facility and capacity?
4. What is the official website URL?
5. What is the employee count range?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Official Name: {entity_name}",
    "Type: [CLUB/LEAGUE/FEDERATION/VENUE/PERSON]",
    "Sport/Industry: [sport or industry]",
    "Founded: [year or 'unknown']",
    "Headquarters: [location or 'unknown']",
    "Primary Venue: [name or 'N/A']",
    "Capacity: [number or 'N/A']",
    "Website: [URL or 'unknown']",
    "Employee Count: [range or 'unknown']"
  ],
  "metrics": [
    {{"label": "Entity Age", "value": "[years since founding]", "context": "[benchmark vs similar entities]"}}
  ],
  "insights": [
    {{
      "insight": "Key observation about entity scale or reach",
      "signal_type": "[CAPABILITY]",
      "confidence": 0-100
    }}
  ]
}}

RULES:
- Use "unknown" when data is unavailable (NOT placeholders like {{founded_year}})
- All assertions require confidence scores with explanation
- Tag insights with signal types: [PROCUREMENT] [CAPABILITY] [TIMING] [CONTACT]
"""
}


# =============================================================================
# SECTION 2: DIGITAL TRANSFORMATION (STANDARD Tier)
# =============================================================================

SECTION_2_DIGITAL_TRANSFORMATION = {
    "section_id": "digital_transformation",
    "title": "Digital Transformation",
    "tier": DossierTier.STANDARD,
    "questions_to_answer": [
        "What is the digital maturity score (0-100) and what does it mean?",
        "What technology platforms are currently in use (website, CRM, analytics, mobile)?",
        "Who are the primary technology vendors/partners?",
        "What are the key digital weaknesses or gaps?",
        "What are strategic digital opportunities?"
    ],
    "input_data_required": [
        "website_platform", "crm_system", "analytics_platform", "mobile_apps",
        "ecommerce_platform", "ticketing_system", "tech_partner_primary",
        "tech_partner_secondary", "digital_maturity_score", "transformation_score"
    ],
    "brightdata_queries": [
        "{entity} technology stack CRM",
        "{entity} website platform built with",
        "{entity} analytics provider",
        "{entity} technology partner",
        "{entity} digital transformation initiative"
    ],
    "prompt_template": """
Generate Digital Transformation section for {entity_name}.

AVAILABLE DATA:
- Official Site: {official_site_url}
- Summary: {official_site_summary}
- Job Postings: {job_postings_summary}
- Press Releases: {press_releases_summary}

{YELLOW_PANTHER_SERVICE_CONTEXT}

{SCORE_CONTEXT_REQUIREMENTS}

QUESTIONS TO ANSWER:
1. What is the digital maturity score (0-100) and what does it mean?
2. What technology platforms are currently in use (website, CRM, analytics, mobile)?
3. Who are the primary technology vendors/partners?
4. What are the key digital weaknesses or gaps?
5. What are strategic digital opportunities?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Digital Maturity: [score]/100",
    "Website Platform: [detected platform or 'unknown']",
    "CRM System: [detected CRM or 'unknown']",
    "Analytics Platform: [detected analytics or 'unknown']",
    "Mobile Apps: [yes/no/partial - details if known]",
    "E-commerce: [yes/no/partial - details if known]",
    "Primary Tech Partners: [vendor names or 'unknown']"
  ],
  "metrics": [
    {{
      "label": "Digital Maturity Score",
      "value": [0-100],
      "meaning": "[plain English explanation]",
      "why": "[evidence-based reasoning]",
      "benchmark": "[industry comparison]",
      "action": "[specific next step]"
    }},
    {{
      "label": "Transformation Score",
      "value": [0-100],
      "meaning": "[plain English]",
      "why": "[evidence]",
      "benchmark": "[context]",
      "action": "[next step]"
    }}
  ],
  "insights": [
    {{
      "insight": "Key digital strength or gap",
      "signal_type": "[CAPABILITY]",
      "confidence": 0-100,
      "yp_service_fit": ["MOBILE_APPS", "DIGITAL_TRANSFORMATION", etc]
    }}
  ],
  "recommendations": [
    {{
      "opportunity": "Specific digital improvement opportunity",
      "yp_service": "Which Yellow Panther service applies",
      "priority": "HIGH|MEDIUM|LOW",
      "estimated_budget": "£XX-£XXX"
    }}
  ]
}}

RULES:
- Every score MUST include meaning, why, benchmark, action
- Tag opportunities with YP services: MOBILE_APPS, DIGITAL_TRANSFORMATION, ANALYTICS, etc.
- Use "unknown" when technology cannot be detected
"""
}


# =============================================================================
# SECTION 3: AI REASONER ASSESSMENT (PREMIUM Tier)
# =============================================================================

SECTION_3_AI_REASONER = {
    "section_id": "ai_reasoner_assessment",
    "title": "AI Reasoner Assessment",
    "tier": DossierTier.PREMIUM,
    "questions_to_answer": [
        "What is the overall assessment of this entity's digital posture?",
        "What is the Yellow Panther opportunity (service fit, entry point)?",
        "What are the key risk factors?",
        "What are competitive advantages to leverage?",
        "What is the recommended engagement approach?"
    ],
    "input_data_required": [
        "yp_service_fit", "entry_point_type", "competitive_positioning",
        "estimated_probability", "risk_factors", "competitive_advantages",
        "recommended_approach"
    ],
    "brightdata_queries": [
        "{entity} digital transformation projects",
        "{entity} stadium technology initiative",
        "{entity} partnership opportunities"
    ],
    "prompt_template": """
Generate AI Reasoner Assessment section for {entity_name}.

This is a strategic synthesis section that combines ALL available data.

AVAILABLE DATA:
{metadata_summary}
{official_site_summary}
{job_postings_summary}
{press_releases_summary}

{YELLOW_PANTHER_SERVICE_CONTEXT}

{SCORE_CONTEXT_REQUIREMENTS}

QUESTIONS TO ANSWER:
1. What is the overall assessment of this entity's digital posture?
2. What is the Yellow Panther opportunity (service fit, entry point)?
3. What are the key risk factors?
4. What are competitive advantages to leverage?
5. What is the recommended engagement approach?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "Overall Assessment: [executive summary]",
    "YP Opportunity: [specific services that match]",
    "Entry Point: [pilot/partnership/vendor replacement/new initiative]",
    "Estimated Probability: [0-100]%",
    "Risk Level: [LOW/MEDIUM/HIGH]"
  ],
  "metrics": [
    {{
      "label": "Strategic Fit Score",
      "value": [0-100],
      "meaning": "[how well entity matches YP ideal profile]",
      "why": "[evidence]",
      "benchmark": "[vs similar entities]",
      "action": "[approach recommendation]"
    }}
  ],
  "insights": [
    {{
      "insight": "Key strategic observation",
      "signal_type": "[PROCUREMENT]",
      "confidence": 0-100,
      "impact": "HIGH|MEDIUM|LOW"
    }}
  ],
  "recommendations": [
    {{
      "yp_service": "Specific Yellow Panther service",
      "fit_reason": "Why this service matches entity needs",
      "entry_strategy": "How to approach (pilot, advisory, RFP response)",
      "probability": 0-100,
      "estimated_budget": "£XX-£XXX",
      "timeline": "X-Y months"
    }}
  ],
  "risk_factors": [
    {{
      "risk": "Specific implementation or business risk",
      "probability": 0-100,
      "impact": "HIGH|MEDIUM|LOW",
      "mitigation": "How Yellow Panther can address this"
    }}
  ]
}}

RULES:
- This is the PRIMARY strategic synthesis - be specific and actionable
- Reference actual entity data (job postings, press releases, website content)
- Every score must have meaning, why, benchmark, action
- Tag all recommendations with YP services
"""
}


# =============================================================================
# SECTION 4: STRATEGIC OPPORTUNITIES (PREMIUM Tier)
# =============================================================================

SECTION_4_OPPORTUNITIES = {
    "section_id": "strategic_opportunities",
    "title": "Strategic Opportunities",
    "tier": DossierTier.PREMIUM,
    "questions_to_answer": [
        "What immediate launch opportunities exist (0-6 months)?",
        "What medium-term partnerships are viable (6-18 months)?",
        "What long-term initiatives align (18+ months)?",
        "What are the opportunity scores for each?",
        "What is the estimated budget/timeline for each?"
    ],
    "input_data_required": [
        "opportunity_name", "opportunity_type", "timeline_months",
        "estimated_budget", "probability_score", "yp_service_fit",
        "strategic_importance"
    ],
    "brightdata_queries": [
        "{entity} digital transformation projects",
        "{entity} stadium technology initiative",
        "{entity} partnership opportunities",
        "{entity} women's team digital expansion"
    ],
    "prompt_template": """
Generate Strategic Opportunities section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}
{official_site_summary}
{job_postings_summary}
{press_releases_summary}

{YELLOW_PANTHER_SERVICE_CONTEXT}

QUESTIONS TO ANSWER:
1. What immediate launch opportunities exist (0-6 months)?
2. What medium-term partnerships are viable (6-18 months)?
3. What long-term initiatives align (18+ months)?
4. What are the opportunity scores for each?
5. What is the estimated budget/timeline for each?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Immediate Opportunities]",
    "- [Opportunity 1]: [description]",
    "- [Opportunity 2]: [description]",
    "",
    "[Medium-Term Partnerships]",
    "- [Opportunity 3]: [description]",
    "",
    "[Long-Term Initiatives]",
    "- [Opportunity 4]: [description]"
  ],
  "metrics": [],
  "insights": [
    {{
      "insight": "High-priority opportunity observation",
      "signal_type": "[PROCUREMENT]",
      "confidence": 0-100,
      "urgency": "immediate|near-term|long-term"
    }}
  ],
  "recommendations": [
    {{
      "opportunity": "Specific opportunity name",
      "type": "immediate_launch|medium_term|long_term",
      "timeline": "X-Y months",
      "estimated_budget": "£XX-£XXX",
      "probability_score": 0-100,
      "yp_service_fit": ["MOBILE_APPS", "ANALYTICS", etc],
      "strategic_importance": "HIGH|MEDIUM|LOW",
      "entry_point": "How Yellow Panther should approach",
      "success_criteria": "What success looks like"
    }}
  ]
}}

RULES:
- Be specific about opportunity types (not generic "digital transformation")
- Reference actual entity data (job postings = hiring for specific tech)
- Tag each opportunity with YP services that apply
- Include realistic budget estimates aligned with YP pricing (£80K-£500K)
"""
}


# =============================================================================
# SECTION 5: KEY DECISION MAKERS (STANDARD Tier)
# =============================================================================

SECTION_5_LEADERSHIP = {
    "section_id": "leadership",
    "title": "Key Decision Makers",
    "tier": DossierTier.STANDARD,
    "questions_to_answer": [
        "Which leaders own procurement, digital, and commercial decisions?",
        "What is their approval scope and authority?",
        "How do they communicate and assess risk?",
        "What decision criteria are visible from public evidence?",
        "Which outreach angle is most defensible based on evidence?"
    ],
    "input_data_required": [
        "person_name", "role", "title", "influence_level", "decision_scope",
        "communication_style", "risk_profile", "tech_savviness",
        "linkedin_url", "email", "phone"
    ],
    "brightdata_queries": [
        "{entity} leadership team executive",
        "{entity} Commercial Director name",
        "{entity} CEO Managing Director",
        "{entity} CTO CDO digital leadership",
        "{entity} board of directors"
    ],
    "prompt_template": """
Generate Key Decision Makers section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}
{official_site_summary}
{job_postings_summary}

CRITICAL CONTACT VALIDATION RULES:
- Use REAL names only (NO placeholders like {{FEDERATION PRESIDENT}})
- Specific titles required (e.g., "Commercial Director" not "Director")
- Use "unknown" when specific person cannot be identified
- Mark confidence levels for all contact assertions

QUESTIONS TO ANSWER:
1. Who are the key decision makers (name, role, influence level)?
2. What is their decision scope and authority?
3. What is their communication style and risk profile?
4. What are their decision criteria?
5. What are the strategic hooks for Yellow Panther engagement?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Decision Maker 1]",
    "Name: [REAL NAME or 'unknown']",
    "Title: [specific title with qualifier]",
    "Influence: HIGH|MEDIUM|LOW",
    "Scope: [what they control]",
    "",
    "[Decision Maker 2]",
    "Name: [REAL NAME or 'unknown']",
    "Title: [specific title]",
    "Influence: HIGH|MEDIUM|LOW",
    "Scope: [what they control]"
  ],
  "metrics": [
    {{
      "label": "Leadership Accessibility",
      "value": 0-100,
      "meaning": "[how accessible decision makers are]",
      "why": "[contact availability evidence]",
      "benchmark": "[vs industry average]",
      "action": "[approach recommendation]"
    }}
  ],
  "insights": [
    {{
      "insight": "Leadership team observation",
      "signal_type": "[CONTACT]",
      "confidence": 0-100
    }}
  ],
  "recommendations": [
    {{
      "decision_maker": "Name or 'Leadership Team'",
      "yp_angle": "How to frame Yellow Panther value",
      "messaging": "What resonates with this person/team",
      "service_fit": ["relevant YP services"],
      "contact_channel": "email|linkedin|warm_intro|conference"
    }}
  ]
}}

CONTACT VALIDATION:
- REAL names only - reject {{ROLE}}, {{FEDERATION PRESIDENT}}, {{TECHNOLOGY DIRECTOR}}
- Specific titles: "Commercial Director", "Technical Director", "Head of Digital"
- Use "unknown" when contact cannot be identified
- Include LinkedIn URLs when detectable

RULES:
- Never use placeholder names like {{Commercial Director}}
- If you cannot find a real name, use "unknown" or "Commercial Director (unknown name)"
- Tag insights with [CONTACT] signal type
- Confidence scores required for all assertions
"""
}


# =============================================================================
# SECTION 6: CONNECTIONS ANALYSIS (PREMIUM Tier)
# =============================================================================

SECTION_6_CONNECTIONS = {
    "section_id": "connections",
    "title": "Connections Analysis",
    "tier": DossierTier.PREMIUM,
    "questions_to_answer": [
        "Which Yellow Panther team members have connections to target entity?",
        "What direct and mutual connection paths exist for each YP member?",
        "Which bridge contacts can reach the target most credibly?",
        "Which introduction path is strongest across the team?",
        "What is the relative likelihood of success for each path?"
    ],
    "input_data_required": [
        # YELLOW PANTHER TEAM CSV (static)
        "yp_name", "yp_role", "yp_linkedin", "yp_weight",
        "yp_expertise_1", "yp_expertise_2", "yp_expertise_3",
        # TARGET ENTITY PERSONNEL
        "target_person_name", "target_role", "target_linkedin",
        "mutual_connections_yp", "count_second_degree_paths"
    ],
    "brightdata_queries": [
        "Stuart Cope connections to {entity}",
        "Gunjan Parikh connections to {entity}",
        "Andrew Rapley connections to {entity}",
        "Sarfraz Hussain connections to {entity}",
        "Elliott Hillman connections to {entity}",
        "Stuart Cope {target_person} mutual connections LinkedIn",
        "{yp_member} connections football industry"
    ],
    "prompt_template": """
Generate Connections Analysis section for {entity_name}.

YELLOW PANTHER TEAM DATA:
{yp_team_data}

TARGET ENTITY PERSONNEL:
{target_personnel_data}

BRIDGE CONTACTS:
{bridge_contacts_data}

QUESTIONS TO ANSWER:
1. Which Yellow Panther team members have connections to target entity?
2. What are the direct connection counts and mutual connections FOR EACH YP MEMBER?
3. What are the Tier 2 bridge contacts available for EACH YP MEMBER?
4. What is the recommended introduction strategy considering ALL YP team members?
5. What is the success probability for each path?

IMPORTANT: Analyze connections FOR EACH YELLOW PANTHER TEAM MEMBER individually:
- Stuart Cope (Co-Founder & COO)
- Gunjan Parikh (Founder & CEO)
- Andrew Rapley (Head of Projects)
- Sarfraz Hussain (Head of Strategy)
- Elliott Hillman (Senior Client Partner)

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Primary Connection Analysis]",
    "",
    "[Stuart Cope]:",
    "- Direct Connections: [count or 'none detected']",
    "- Mutual Connections: [names if available]",
    "- Connection Strength: [strong/medium/weak/none]",
    "",
    "[Gunjan Parikh]:",
    "- Direct Connections: [count or 'none detected']",
    "- Mutual Connections: [names if available]",
    "- Connection Strength: [strong/medium/weak/none]",
    "",
    "[Andrew Rapley]:",
    "...",
    "",
    "[Tier 2 Bridge Paths]",
    "- [Bridge Contact 1]: [path to target]",
    "- [Bridge Contact 2]: [path to target]",
    "",
    "[Recommended Approach]: [which YP member should lead and why]"
  ],
  "metrics": [
    {{
      "label": "Connection Strength",
      "value": 0-100,
      "meaning": "[overall connection quality]",
      "why": "[evidence from network analysis]",
      "benchmark": "[vs other targets]",
      "action": "[approach recommendation]"
    }}
  ],
  "insights": [
    {{
      "insight": "Network analysis observation",
      "signal_type": "[CONTACT]",
      "confidence": 0-100
    }}
  ],
  "recommendations": [
    {{
      "yp_member": "Which Yellow Panther team member should lead",
      "introduction_path": "Direct / Tier 2 bridge / Cold",
      "mutual_connections": ["names if available"],
      "talking_points": ["specific conversation hooks"],
      "success_probability": 0-100,
      "rationale": "Why this member/approach"
    }}
  ]
}}

DATA NOTES:
- Yellow Panther team has 5 UK members with varying expertise
- Bridge contacts may include sports industry connections
- Target personnel data from leadership section or LinkedIn research
- Mutual connections determined via LinkedIn analysis

RULES:
- Analyze EACH YP team member's connection potential
- Recommend the SINGLE best approach considering all team members
- Use "unknown" when connection data unavailable
- Tag insights with [CONTACT] signal type
"""
}


# =============================================================================
# SECTION 7: RECENT NEWS (BASIC Tier)
# =============================================================================

SECTION_7_RECENT_NEWS = {
    "section_id": "recent_news",
    "title": "Recent News",
    "tier": DossierTier.BASIC,
    "questions_to_answer": [
        "What recent news (last 90 days) is relevant to procurement/partnerships?",
        "What is the relevance score for each news item?",
        "What category does each item fall into (technology, partnership, operations)?",
        "What insights do news items provide about entity priorities?"
    ],
    "input_data_required": [
        "date", "headline", "source", "category", "relevance_score",
        "summary", "signals"
    ],
    "brightdata_queries": [
        "{entity} news 2025",
        "{entity} press release technology",
        "{entity} partnership announcement",
        "{entity} digital initiative"
    ],
    "prompt_template": """
Generate Recent News section for {entity_name}.

AVAILABLE DATA:
{press_releases_summary}
{official_site_summary}

QUESTIONS TO ANSWER:
1. What recent news (last 90 days) is relevant to procurement/partnerships?
2. What is the relevance score for each news item?
3. What category does each item fall into (technology, partnership, operations)?
4. What insights do news items provide about entity priorities?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Recent News - Last 90 Days]",
    "",
    "[Date] - [Headline]",
    "Source: [source]",
    "Category: [technology|partnership|operations|other]",
    "Relevance: [score]%",
    "Summary: [brief description]",
    "Signals: [PROCUREMENT|CAPABILITY|TIMING|CONTACT]",
    "",
    "[Date] - [Headline]",
    "..."
  ],
  "metrics": [
    {{
      "label": "News Relevance Score",
      "value": 0-100,
      "meaning": "[how relevant recent news is to YP services]",
      "why": "[analysis of news content]",
      "benchmark": "[vs industry average]",
      "action": "[how to use this news in outreach]"
    }}
  ],
  "insights": [
    {{
      "insight": "Strategic signal from news",
      "signal_type": "[PROCUREMENT|CAPABILITY|TIMING|CONTACT]",
      "confidence": 0-100,
      "source": "news article title or description"
    }}
  ],
  "recommendations": []
}}

RULES:
- Focus on procurement/partnership relevant news (not general sports results)
- Tag each news item with signal type
- Use relevance scores to prioritize
- If no recent news, state "No procurement-relevant news found in last 90 days"
"""
}


# =============================================================================
# SECTION 8: CURRENT PERFORMANCE (BASIC Tier - Sports Only)
# =============================================================================

SECTION_8_PERFORMANCE = {
    "section_id": "current_performance",
    "title": "Current Performance",
    "tier": DossierTier.BASIC,
    "questions_to_answer": [
        "What is current league position and points?",
        "What is recent form (last 5 matches)?",
        "What are key statistics (wins, goals for/against)?",
        "How does this compare to top competitors?"
    ],
    "input_data_required": [
        "league_position", "points", "wins", "draws", "losses",
        "goals_for", "goals_against", "goal_difference", "recent_form",
        "mini_table"
    ],
    "brightdata_queries": [
        "{entity} Premier League table 2025",
        "{entity} current standings",
        "{entity} last 5 results"
    ],
    "prompt_template": """
Generate Current Performance section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}

QUESTIONS TO ANSWER:
1. What is current league position and points?
2. What is recent form (last 5 matches)?
3. What are key statistics (wins, goals for/against)?
4. How does this compare to top competitors?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Current Season Performance]",
    "League Position: [position]",
    "Points: [points]",
    "Recent Form: [last 5 results]",
    "",
    "[Key Statistics]",
    "Wins: [count], Draws: [count], Losses: [count]",
    "Goals For: [count], Goals Against: [count]",
    "Goal Difference: [+/- GD]",
    "",
    "[Comparison to Top 3]",
    "- [Competitor 1]: [position, points]",
    "- [Competitor 2]: [position, points]",
    "- [Competitor 3]: [position, points]"
  ],
  "metrics": [
    {{
      "label": "Performance Index",
      "value": 0-100,
      "meaning": "[how entity is performing vs expectations]",
      "why": "[analysis of standings and form]",
      "benchmark": "[vs historical performance]",
      "action": "[performance context for outreach]"
    }}
  ],
  "insights": [
    {{
      "insight": "Performance-based observation",
      "signal_type": "[CAPABILITY]",
      "confidence": 0-100
    }}
  ],
  "recommendations": []
}}

RULES:
- If entity is not a sports club, use "N/A - not a sports entity"
- Performance context helps understand organizational pressure/urgency
- Tag insights with relevant signal types
"""
}


# =============================================================================
# SECTION 9: OUTREACH STRATEGY (STANDARD Tier)
# =============================================================================

SECTION_9_OUTREACH = {
    "section_id": "outreach_strategy",
    "title": "Outreach Strategy",
    "tier": DossierTier.STANDARD,
    "questions_to_answer": [
        "What is the best outreach approach based on evidence?",
        "What contact channels and timing are most credible?",
        "What entity-specific personalization tokens should be used?",
        "What conversation starters map to recent evidence?",
        "What anti-patterns should be avoided?"
    ],
    "input_data_required": [
        "approach_type", "primary_channel", "messaging_angle",
        "optimal_timing", "personalization_tokens", "conversation_starters",
        "anti_patterns"
    ],
    "brightdata_queries": [
        "{entity} recent initiatives",
        "{entity} upcoming events",
        "{entity} partnerships announcements"
    ],
    "prompt_template": """
Generate Outreach Strategy section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}
{official_site_summary}
{job_postings_summary}
{press_releases_summary}

QUESTIONS TO ANSWER:
1. What is the recommended approach (warm/lukewarm/cold)?
2. What are the best contact channels and timing?
3. What personalization tokens should be used?
4. What conversation starters are relevant?
5. What anti-patterns should be avoided?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Approach Type]: [warm|lukewarm|cold]",
    "",
    "[Contact Strategy]",
    "Primary Channel: [email|linkedin|warm_intro|phone]",
    "Optimal Timing: [when to reach out]",
    "",
    "[Personalization Tokens]",
    "- [{{recent_initiative}}]: [specific example]",
    "- [{{specific_technology}}]: [specific example]",
    "- [{{event_name}}]: [specific example]",
    "",
    "[Conversation Starters]",
    "1. [Topic] - [why this matters] - [talking points]",
    "2. [Topic] - [why this matters] - [talking points]",
    "",
    "[Anti-Patterns to Avoid]",
    "- [mistake 1]",
    "- [mistake 2]"
  ],
  "metrics": [
    {{
      "label": "Approach Confidence",
      "value": 0-100,
      "meaning": "[confidence this approach will work]",
      "why": "[evidence from entity research]",
      "benchmark": "[vs industry response rates]",
      "action": "[how to execute this approach]"
    }}
  ],
  "insights": [
    {{
      "insight": "Strategic observation for outreach",
      "signal_type": "[CONTACT]",
      "confidence": 0-100
    }}
  ],
  "recommendations": [
    {{
      "approach": "warm|lukewarm|cold",
      "primary_channel": "email|linkedin|warm_intro|phone",
      "messaging_angle": "how to frame Yellow Panther value",
      "timing": "specific timeframe",
      "personalization": ["{{token1}}", "{{token2}}"],
      "expected_response_rate": 0-100
    }}
  ]
}}

RULES:
- Base approach on actual connection intelligence (if available)
- Personalization tokens must be entity-specific (not generic)
- Conversation starters should reference actual entity initiatives
- Anti-patterns help avoid common mistakes
- Tag insights with [CONTACT] signal type
"""
}


# =============================================================================
# SECTION 10: RISK ASSESSMENT (PREMIUM Tier)
# =============================================================================

SECTION_10_RISK = {
    "section_id": "risk_assessment",
    "title": "Risk Assessment",
    "tier": DossierTier.PREMIUM,
    "questions_to_answer": [
        "What implementation risks are visible in the evidence?",
        "Which incumbents or alternatives are actually present?",
        "What switching costs are implied by the evidence?",
        "How should Yellow Panther position against them?"
    ],
    "input_data_required": [
        "risk_category", "risk_description", "probability", "impact",
        "mitigation_strategy"
    ],
    "brightdata_queries": [
        "{entity} technology vendors",
        "{entity} incumbent providers",
        "{entity} existing partnerships"
    ],
    "prompt_template": """
Generate Risk Assessment section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}
{official_site_summary}
{job_postings_summary}
{press_releases_summary}

QUESTIONS TO ANSWER:
1. What are implementation risks (technical, organizational)?
2. What is the competitive landscape (incumbents, alternatives)?
3. What are switching costs?
4. How can Yellow Panther differentiate?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[Implementation Risks]",
    "- [Risk 1]: [description] - Probability: [0-100%] - Impact: [HIGH/MEDIUM/LOW]",
    "- [Risk 2]: [description] - Probability: [0-100%] - Impact: [HIGH/MEDIUM/LOW]",
    "",
    "[Competitive Landscape]",
    "Incumbents: [vendor names if known]",
    "Alternatives: [vendor types]",
    "Switching Costs: [description]",
    "",
    "[Yellow Panther Differentiation]",
    "- [Advantage 1]",
    "- [Advantage 2]"
  ],
  "metrics": [
    {{
      "label": "Risk-Adjusted Opportunity Score",
      "value": 0-100,
      "meaning": "[opportunity score adjusted for risk]",
      "why": "[risk vs reward analysis]",
      "benchmark": "[vs industry average]",
      "action": "[how to mitigate identified risks]"
    }}
  ],
  "insights": [
    {{
      "insight": "Risk or competitive landscape observation",
      "signal_type": "[CAPABILITY]",
      "confidence": 0-100
    }}
  ],
  "recommendations": [
    {{
      "risk": "Specific implementation or competitive risk",
      "probability": 0-100,
      "impact": "HIGH|MEDIUM|LOW",
      "mitigation": "How Yellow Panther addresses this",
      "yp_differentiation": "Competitive advantage"
    }}
  ]
}}

RULES:
- Be specific about risks (not generic "technical challenges")
- Identify actual incumbents when detectable
- Focus on actionable mitigation strategies
- Tag insights with relevant signal types
"""
}


# =============================================================================
# SECTION 11: LEAGUE CONTEXT (BASIC Tier - Sports Only)
# =============================================================================

SECTION_11_LEAGUE = {
    "section_id": "league_context",
    "title": "League Context",
    "tier": DossierTier.BASIC,
    "questions_to_answer": [
        "What is the current league standing?",
        "Which teams are closest in the standings?",
        "What differentiates them on the table?"
    ],
    "input_data_required": [
        "league_name", "current_position", "clubs_in_league", "season_phase",
        "top_competitor_1", "top_competitor_2", "top_competitor_3"
    ],
    "brightdata_queries": [
        "{entity} league table 2025",
        "{entity} competitors comparison"
    ],
    "prompt_template": """
Generate League Context section for {entity_name}.

AVAILABLE DATA:
{metadata_summary}

QUESTIONS TO ANSWER:
1. What is the current league standing?
2. Which teams are closest in the standings?
3. What are the key performance differentiators?

OUTPUT FORMAT (JSON):
{{
  "content": [
    "[League Context]",
    "League: [league name]",
    "Current Position: [position]/[total clubs]",
    "Season Phase: [early/mid/late season]",
    "",
    "[Top 3 Competitors]",
    "1. [Competitor 1]: [position, points, key differentiator]",
    "2. [Competitor 2]: [position, points, key differentiator]",
    "3. [Competitor 3]: [position, points, key differentiator]",
    "",
    "[Competitive Positioning]",
    "[How entity compares to top competitors]"
  ],
  "metrics": [
    {{
      "label": "Competitive Position",
      "value": 0-100,
      "meaning": "[relative competitive strength]",
      "why": "[analysis of standing vs competitors]",
      "benchmark": "[vs league average]",
      "action": "[context for outreach]"
    }}
  ],
  "insights": [
    {{
      "insight": "Competitive landscape observation",
      "signal_type": "[CAPABILITY]",
      "confidence": 0-100
    }}
  ],
  "recommendations": []
}}

RULES:
- If entity is not in a league, use "N/A - not applicable"
- Competitive context helps understand organizational priorities
- Tag insights with relevant signal types
"""
}


# =============================================================================
# SECTION REGISTRY
# =============================================================================

# All sections in order
ALL_SECTIONS = [
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
]

# Sections by tier
SECTIONS_BY_TIER = {
    DossierTier.BASIC: [
        "core_information",
        "recent_news",
        "current_performance",
        "league_context",
    ],
    DossierTier.STANDARD: [
        "core_information",
        "digital_transformation",
        "recent_news",
        "current_performance",
        "leadership",
        "outreach_strategy",
        "league_context",
    ],
    DossierTier.PREMIUM: [
        "core_information",
        "digital_transformation",
        "ai_reasoner_assessment",
        "strategic_opportunities",
        "leadership",
        "connections",
        "recent_news",
        "current_performance",
        "outreach_strategy",
        "risk_assessment",
        "league_context",
    ]
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_section_prompt(section_id: str) -> Optional[Dict[str, Any]]:
    """
    Get section definition by ID.

    Args:
        section_id: Section identifier

    Returns:
        Section definition dict or None if not found
    """
    for section in ALL_SECTIONS:
        if section["section_id"] == section_id:
            return section
    return None


def get_sections_for_tier(tier: DossierTier) -> List[str]:
    """
    Get list of section IDs for a given tier.

    Args:
        tier: Dossier tier (BASIC/STANDARD/PREMIUM)

    Returns:
        List of section IDs
    """
    return SECTIONS_BY_TIER.get(tier, SECTIONS_BY_TIER[DossierTier.BASIC])


def interpolate_prompt(template: str, entity_data: Dict[str, Any]) -> str:
    """
    Interpolate prompt template with entity data.

    Args:
        template: Prompt template with placeholders
        entity_data: Dictionary containing entity information

    Returns:
        Interpolated prompt string
    """
    # Add YP context if not present
    if "{YELLOW_PANTHER_SERVICE_CONTEXT}" in template:
        template = template.replace("{YELLOW_PANTHER_SERVICE_CONTEXT}", YELLOW_PANTHER_SERVICE_CONTEXT)

    if "{SCORE_CONTEXT_REQUIREMENTS}" in template:
        template = template.replace("{SCORE_CONTEXT_REQUIREMENTS}", SCORE_CONTEXT_REQUIREMENTS)

    # Replace entity placeholders
    entity_name = entity_data.get("entity_name", "Unknown Entity")
    template = template.replace("{entity_name}", entity_name)

    # Replace data placeholders
    replacements = {
        "{metadata_summary}": entity_data.get("metadata_summary", "N/A"),
        "{official_site_url}": entity_data.get("official_site_url", "N/A"),
        "{official_site_summary}": entity_data.get("official_site_summary", "N/A"),
        "{job_postings_summary}": entity_data.get("job_postings_summary", "No recent job postings"),
        "{press_releases_summary}": entity_data.get("press_releases_summary", "No recent press releases"),
        "{yp_team_data}": entity_data.get("yp_team_data", "Yellow Panther team data not provided"),
        "{target_personnel_data}": entity_data.get("target_personnel_data", "Target personnel data not provided"),
        "{bridge_contacts_data}": entity_data.get("bridge_contacts_data", "Bridge contacts data not provided"),
    }

    for placeholder, value in replacements.items():
        template = template.replace(placeholder, value)

    return template


def get_brightdata_queries(section_id: str, entity_name: str) -> List[str]:
    """
    Get BrightData collection queries for a section.

    Args:
        section_id: Section identifier
        entity_name: Name of entity to query for

    Returns:
        List of search query strings
    """
    section = get_section_prompt(section_id)
    if not section:
        return []

    queries = section.get("brightdata_queries", [])
    return [q.replace("{entity}", entity_name) for q in queries]


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    # Enums
    "DossierTier",

    # Context
    "YELLOW_PANTHER_SERVICE_CONTEXT",
    "SCORE_CONTEXT_REQUIREMENTS",

    # Section definitions
    "SECTION_1_CORE_INFO",
    "SECTION_2_DIGITAL_TRANSFORMATION",
    "SECTION_3_AI_REASONER",
    "SECTION_4_OPPORTUNITIES",
    "SECTION_5_LEADERSHIP",
    "SECTION_6_CONNECTIONS",
    "SECTION_7_RECENT_NEWS",
    "SECTION_8_PERFORMANCE",
    "SECTION_9_OUTREACH",
    "SECTION_10_RISK",
    "SECTION_11_LEAGUE",

    # Collections
    "ALL_SECTIONS",
    "SECTIONS_BY_TIER",

    # Functions
    "get_section_prompt",
    "get_sections_for_tier",
    "interpolate_prompt",
    "get_brightdata_queries",
]
