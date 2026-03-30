#!/usr/bin/env python3
"""Generate a reasoned duplicate of the question review pack.

The goal is not to change the question coverage. The goal is to rewrite the
pack into evidence-gated, action-oriented prompts that are easier to use in the
Ralph loop and easier to execute with BrightData/OpenCode.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Union

SECTION_REASONING = {
    "core_information": {
        "optimized_question": "Verify the entity's official name, type, sport/industry, founding year, headquarters, primary venue, website, and employee count from authoritative sources.",
        "optimization_notes": "Use authoritative sources first and treat missing facts as blockers before any deeper dossier work.",
        "ralph_focus": "Canonical identity grounding",
    },
    "digital_transformation": {
        "optimized_question": "Map the current website, CRM, analytics, mobile, and e-commerce stack from the official site, job postings, and press releases, then identify modernization triggers.",
        "optimization_notes": "Prioritize stack evidence that implies replacement, migration, or fresh procurement intent.",
        "ralph_focus": "Digital stack and modernization signals",
    },
    "leadership": {
        "optimized_question": "Identify named decision-makers, their authority, and outreach hooks using official leadership pages, LinkedIn, and recent news.",
        "optimization_notes": "Require real names and a usable introduction path; reject placeholder roles.",
        "ralph_focus": "Decision makers and contactability",
    },
    "recent_news": {
        "optimized_question": "Collect the last 90 days of procurement-relevant news and score each item for relevance to Yellow Panther services.",
        "optimization_notes": "Prefer signals that indicate urgency, budget, platform change, or partnership activity.",
        "ralph_focus": "Recent trigger events",
    },
    "current_performance": {
        "optimized_question": "Capture current league position, recent form, and key stats, then compare them with the top competitors.",
        "optimization_notes": "Use performance only where it changes urgency, stakeholder pressure, or timing.",
        "ralph_focus": "Competitive pressure and context",
    },
    "ai_reasoner_assessment": {
        "optimized_question": "Synthesize the gathered evidence into an evidence-gated Yellow Panther fit assessment and an explicit next-step recommendation.",
        "optimization_notes": "Force the model to justify fit, entry point, and risks from the accumulated evidence only.",
        "ralph_focus": "Strategic synthesis",
    },
    "strategic_opportunities": {
        "optimized_question": "Prioritize immediate, medium-term, and long-term opportunities with budgets, timelines, and likely entry points.",
        "optimization_notes": "Split by time horizon so Ralph can validate one opportunity at a time.",
        "ralph_focus": "Opportunity queue",
    },
    "connections": {
        "optimized_question": "Identify which Yellow Panther team members have connections and the strongest introduction path for the entity.",
        "optimization_notes": "Prefer ranked introduction paths and avoid ungrounded network claims.",
        "ralph_focus": "Warm-path routing",
    },
    "outreach_strategy": {
        "optimized_question": "Turn the evidence into a contact channel, timing, personalization plan, and anti-pattern checklist.",
        "optimization_notes": "Optimize for a usable outreach sequence rather than generic messaging advice.",
        "ralph_focus": "Message execution",
    },
    "risk_assessment": {
        "optimized_question": "Identify implementation, organizational, and competitive risks, then explain how Yellow Panther differentiates and mitigates each one.",
        "optimization_notes": "Keep risk language specific and tie every risk to a mitigation or offer angle.",
        "ralph_focus": "Risk and differentiation",
    },
    "league_context": {
        "optimized_question": "Establish the competitive and contextual league landscape that shapes urgency, fit, and account strategy.",
        "optimization_notes": "Use league context to sharpen timing and relevance, not to pad the dossier.",
        "ralph_focus": "Market framing",
    },
}

ENTITY_TYPE_REASONING = [
    ("mobile app", "Verify whether {entity} has a mobile or fan engagement initiative and whether the signal points to an RFP, vendor replacement, or partnership brief."),
    ("digital transformation", "Verify whether {entity} is undertaking a digital transformation initiative using the official site, job postings, and press releases, and identify timing, budget, or vendor change signals."),
    ("ticketing", "Verify whether {entity} has ticketing or e-commerce pain points that suggest a replacement, upgrade, or new vendor process."),
    ("analytics", "Verify whether {entity} has analytics or data platform needs and what downstream fan or performance use case is driving them."),
    ("fan engagement", "Verify whether {entity} has fan engagement gaps or platform needs that could support a Yellow Panther pilot."),
    ("stadium", "Verify whether {entity} has stadium or venue technology upgrades planned and what triggers them."),
    ("legacy", "Verify whether {entity} is replacing legacy systems and what evidence points to procurement timing."),
]


def _load_review_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    if isinstance(source, Mapping):
        return dict(source)
    return json.loads(Path(source).read_text(encoding="utf-8"))


def _normalize_question(text: str) -> str:
    return " ".join(str(text).strip().split()).lower().rstrip(" .")


def _reason_entity_type_question(question: str) -> str:
    lower = question.lower()
    for needle, template in ENTITY_TYPE_REASONING:
        if needle in lower:
            return template.format(entity="{entity}")
    return (
        f"Use verified evidence to decide whether {{entity}} has a real Yellow Panther opportunity, "
        f"then tie it to timing, budget, and procurement intent."
    )


def _reasoned_question_for(item: Dict[str, Any]) -> Dict[str, Any]:
    question = item["question"]
    source_kinds = list(item.get("source_kinds", []))
    source_labels = list(item.get("source_labels", []))
    primary_kind = item.get("primary_source_kind") or (source_kinds[0] if source_kinds else "artifact_question")

    section_id = None
    section_title = None
    for source in item.get("sources", []):
        metadata = source.get("metadata") or {}
        if metadata.get("section_id"):
            section_id = metadata["section_id"]
            section_title = metadata.get("section_title")
            break

    if not section_id and source_labels:
        candidate = source_labels[0]
        if candidate in SECTION_REASONING:
            section_id = candidate

    if section_id in SECTION_REASONING:
        rule = SECTION_REASONING[section_id]
        optimized_question = rule["optimized_question"]
        optimization_notes = rule["optimization_notes"]
        ralph_focus = rule["ralph_focus"]
    elif primary_kind == "entity_type_question":
        optimized_question = _reason_entity_type_question(question)
        optimization_notes = "Use source-gated evidence and turn vague platform language into procurement intent, timing, and budget."
        ralph_focus = "Entity-specific opportunity grounding"
    else:
        optimized_question = f"Use verified evidence to answer: {question}"
        optimization_notes = "Keep the question grounded in direct evidence and convert generic phrasing into an evidence-backed decision point."
        ralph_focus = "Evidence-backed refinement"

    preferred_sources = []
    for source in item.get("sources", []):
        source_kind = source.get("source_kind")
        if source_kind == "entity_type_question":
            preferred_sources.extend(["official site", "job postings", "press releases"])
        elif source_kind == "tier_section_question":
            section_hint = source.get("metadata", {}).get("section_id")
            if section_hint == "core_information":
                preferred_sources.extend(["official site", "wikipedia", "company registry"])
            elif section_hint == "digital_transformation":
                preferred_sources.extend(["official site", "job postings", "press releases"])
            elif section_hint == "leadership":
                preferred_sources.extend(["official leadership pages", "LinkedIn", "press releases"])
            elif section_hint == "recent_news":
                preferred_sources.extend(["news", "press releases", "official site"])
            elif section_hint == "current_performance":
                preferred_sources.extend(["league tables", "official competition pages", "news"])
            elif section_hint == "connections":
                preferred_sources.extend(["LinkedIn", "team network graph", "bridge contacts"])
            elif section_hint == "outreach_strategy":
                preferred_sources.extend(["all evidence", "contact records", "recent news"])
            elif section_hint == "risk_assessment":
                preferred_sources.extend(["official site", "press releases", "procurement signals"])
            elif section_hint == "strategic_opportunities":
                preferred_sources.extend(["official site", "press releases", "job postings"])
            elif section_hint == "ai_reasoner_assessment":
                preferred_sources.extend(["all evidence"])
            elif section_hint == "league_context":
                preferred_sources.extend(["league tables", "official competition pages"])
        else:
            preferred_sources.extend(["artifact context", "review pack"])

    preferred_sources = sorted(dict.fromkeys(preferred_sources))

    if section_title:
        section_label = section_title
    elif section_id:
        section_label = section_id.replace("_", " ").title()
    else:
        section_label = "Unclassified"

    return {
        "question": question,
        "normalized_question": _normalize_question(question),
        "optimized_question": optimized_question,
        "optimization_notes": optimization_notes,
        "ralph_focus": ralph_focus,
        "primary_source_kind": primary_kind,
        "source_kinds": source_kinds,
        "source_labels": source_labels,
        "section_id": section_id,
        "section_title": section_label,
        "preferred_sources": preferred_sources,
        "source_count": len(item.get("sources", [])),
        "sources": item.get("sources", []),
        "recommendation": item.get("recommendation", "keep"),
    }


def build_question_reasoned_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    review_pack = _load_review_pack(source)
    questions = [
        _reasoned_question_for(item)
        for item in review_pack.get("ultimate_dossier_pack", {}).get("questions", [])
    ]

    sections_to_keep = []
    for section in review_pack.get("sections_to_keep", []):
        decision = section.get("decision", "keep")
        hint = "Evidence-gated refinement: ask one concrete question at a time." if decision == "split" else "Evidence-gated consolidation: keep this section as a single prompt."
        sections_to_keep.append(
            {
                **section,
                "optimization_hint": hint,
                "reasoned_pack_role": "split-first" if decision == "split" else "single-pass",
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "reasoned_question_count": len(questions),
            "section_count": len(sections_to_keep),
            "source_question_count": len(review_pack.get("ultimate_dossier_pack", {}).get("questions", [])),
        },
        "reasoned_dossier_pack": {
            "description": "Reasoned duplicate of the ultimate dossier pack for Ralph-loop execution",
            "questions": questions,
        },
        "reasoned_sections_to_keep": sections_to_keep,
    }


def write_question_reasoned_pack(output_path: Path, pack: Dict[str, Any]) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return output_path


def build_and_write_default_reasoned_pack(review_pack_source: Union[Path, str, Mapping[str, Any]]) -> Path:
    pack = build_question_reasoned_pack(review_pack_source)
    if isinstance(review_pack_source, Mapping):
        output_path = Path("dossier_question_reasoned_pack.json")
    else:
        output_path = Path(review_pack_source).with_name("dossier_question_reasoned_pack.json")
    return write_question_reasoned_pack(output_path, pack)


if __name__ == "__main__":  # pragma: no cover - helper
    backend_dir = Path(__file__).resolve().parent
    source = backend_dir / "data" / "dossier_question_review_pack.json"
    print(build_and_write_default_reasoned_pack(source))
