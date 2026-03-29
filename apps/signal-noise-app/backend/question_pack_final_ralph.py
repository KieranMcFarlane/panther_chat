#!/usr/bin/env python3
"""Generate the final Ralph-loop dossier question pack.

This pack is derived from the business-goal-ranked pack, then:
- prunes weak-signal questions
- splits dense sections into smaller atomic prompts
- preserves the strongest Yellow Panther fit questions at the top
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Union

from question_pack_business_reasoner import build_business_goal_reasoned_pack


SECTION_SPLITS = {
    "Digital Transformation": [
        "What technology platforms are currently in use at {entity}?",
        "What website platform is in use at {entity}?",
        "What CRM system is in use at {entity}?",
        "What analytics platform is in use at {entity}?",
        "What mobile apps are in use or planned at {entity}?",
        "Who are the primary technology vendors or partners?",
        "What strategic digital opportunities exist?",
        "What key digital weaknesses or gaps exist?",
        "What is the digital maturity score and what does it mean?",
    ],
    "Key Decision Makers": [
        "Who are the key decision makers at {entity}?",
        "What are their titles and influence levels?",
        "What are their decision criteria?",
        "What is their decision scope and authority?",
        "What is their communication style and risk profile?",
        "What strategic hooks support Yellow Panther engagement?",
    ],
    "Outreach Strategy": [
        "What are the best contact channels?",
        "What timing windows are best?",
        "What anti-patterns should be avoided?",
        "What conversation starters are relevant?",
        "What personalization tokens should be used?",
        "What is the recommended approach (warm/lukewarm/cold)?",
    ],
    "Connections Analysis": [
        "Which Yellow Panther team members have connections to {entity}?",
        "What are the direct connection counts and mutual connections for each Yellow Panther team member?",
        "What are the Tier 2 bridge contacts available?",
        "What is the recommended introduction strategy?",
        "What is the success probability for each path?",
    ],
    "AI Reasoner Assessment": [
        "What is the overall assessment of this entity's digital posture?",
        "What is the Yellow Panther opportunity (service fit, entry point)?",
        "What are the key risk factors?",
        "What are the competitive advantages to leverage?",
        "What is the recommended engagement approach?",
    ],
    "Strategic Opportunities": [
        "What immediate launch opportunities exist (0-6 months)?",
        "What medium-term partnerships are viable (6-18 months)?",
        "What long-term initiatives align (18+ months)?",
        "What are the estimated budget/timeline expectations?",
        "What are the opportunity scores for each path?",
    ],
    "Recent News": [
        "What procurement-relevant news is there in the last 90 days?",
        "What items indicate urgency or timing pressure?",
        "What items indicate budget or vendor change signals?",
        "What items indicate partnership or platform change signals?",
    ],
    "Risk Assessment": [
        "What implementation risks should Yellow Panther plan for?",
        "What organizational risks should Yellow Panther plan for?",
        "What competitive risks should Yellow Panther plan for?",
        "What mitigation or differentiation should Yellow Panther lead with?",
    ],
    "League Context": [
        "What is the competitive landscape for {entity}?",
        "What league context affects timing and urgency?",
        "What market structure or governance context matters?",
    ],
}


def _load_business_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    if isinstance(source, Mapping):
        return dict(source)
    return build_business_goal_reasoned_pack(source)


def _normalize(text: str) -> str:
    return " ".join(str(text).strip().split()).lower().rstrip(" .")


def _rank_bucket(bucket: str) -> int:
    ordering = {
        "direct_revenue_signal": 0,
        "high_signal": 1,
        "context_support": 2,
        "weak_signal": 3,
    }
    return ordering.get(bucket, 9)


def _derive_section_score(items: Sequence[Mapping[str, Any]]) -> int:
    if not items:
        return 0
    return max(int(item.get("business_goal_score", 0)) for item in items)


def _emit_atomic_prompt(
    prompt: str,
    source_items: Sequence[Mapping[str, Any]],
    section_title: str,
    score: int,
    bucket: str,
    source_question_count: int,
    prompt_index: int,
    split_from: Sequence[str],
) -> Dict[str, Any]:
    source_questions = sorted({str(question) for question in split_from})
    rationale = "Split from dense section into an atomic Ralph-loop prompt."
    if source_items:
        rationale = str(source_items[0].get("business_goal_rationale", rationale))
    final_score = max(0, score - prompt_index)
    return {
        "prompt": prompt,
        "normalized_prompt": _normalize(prompt),
        "source_question_normalized": _normalize(source_questions[0]) if source_questions else "",
        "section_title": section_title,
        "final_goal_score": final_score,
        "final_goal_bucket": bucket,
        "final_goal_rank": 0,
        "source_question_count": source_question_count,
        "source_questions": source_questions,
        "split_from_section": section_title,
        "split_reason": "Dense section split into atomic prompts for the Ralph loop.",
        "final_goal_rationale": rationale,
    }


def build_final_ralph_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    business_pack = _load_business_pack(source)
    source_questions = list(business_pack.get("business_goal_reasoned_pack", {}).get("questions", []))

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in source_questions:
        bucket = str(item.get("final_goal_bucket") or item.get("business_goal_bucket") or "weak_signal")
        if bucket == "weak_signal":
            continue
        grouped.setdefault(str(item.get("section_title", "Unclassified")), []).append(item)

    final_questions: List[Dict[str, Any]] = []
    pruned_questions: List[Dict[str, Any]] = []
    split_sections: List[Dict[str, Any]] = []

    for section_title, items in grouped.items():
        section_bucket = min((str(item.get("business_goal_bucket", "weak_signal")) for item in items), key=_rank_bucket)
        section_score = _derive_section_score(items)

        if section_title in SECTION_SPLITS:
            split_templates = SECTION_SPLITS[section_title]
            split_sections.append(
                {
                    "section_title": section_title,
                    "original_question_count": len(items),
                    "split_prompt_count": len(split_templates),
                    "business_goal_score": section_score,
                    "business_goal_bucket": section_bucket,
                    "decision": "split",
                }
            )
            source_texts = [item["question"] for item in items]
            for prompt_index, template in enumerate(split_templates):
                prompt = template.format(entity="{entity}")
                final_questions.append(
                    _emit_atomic_prompt(
                        prompt=prompt,
                        source_items=items,
                        section_title=section_title,
                        score=section_score,
                        bucket=section_bucket,
                        source_question_count=len(items),
                        prompt_index=prompt_index,
                        split_from=source_texts,
                    )
                )
            continue

        for item in items:
            prompt = item.get("optimized_question", item.get("question", ""))
            final_questions.append(
                {
                    "prompt": prompt,
                    "normalized_prompt": _normalize(prompt),
                    "source_question_normalized": item.get("normalized_question") or _normalize(item.get("question", "")),
                    "section_title": item.get("section_title", "Unclassified"),
                    "final_goal_score": int(item.get("business_goal_score", 0)),
                    "final_goal_bucket": item.get("business_goal_bucket", "weak_signal"),
                    "final_goal_rank": 0,
                    "source_question_count": 1,
                    "source_questions": [item.get("question", "")],
                    "split_from_section": None,
                    "split_reason": "Kept as a single focused Ralph-loop prompt.",
                    "final_goal_rationale": item.get("business_goal_rationale", ""),
                }
            )

    deduped_questions: List[Dict[str, Any]] = []
    dedupe_index: Dict[str, Dict[str, Any]] = {}
    for item in final_questions:
        key = str(item.get("normalized_prompt") or _normalize(item["prompt"]))
        existing = dedupe_index.get(key)
        if existing is None:
            copy = {
                **item,
                "source_questions": list(dict.fromkeys(item.get("source_questions", []))),
            }
            dedupe_index[key] = copy
            deduped_questions.append(copy)
            continue

        existing["source_questions"] = list(
            dict.fromkeys(existing.get("source_questions", []) + list(item.get("source_questions", [])))
        )
        existing["source_question_count"] = len(existing["source_questions"])
        existing["final_goal_score"] = max(int(existing["final_goal_score"]), int(item["final_goal_score"]))
        if item.get("final_goal_rationale") and item["final_goal_rationale"] not in existing.get("final_goal_rationale", ""):
            existing["final_goal_rationale"] = (
                existing.get("final_goal_rationale", "").rstrip("; ")
                + ("; " if existing.get("final_goal_rationale") else "")
                + str(item["final_goal_rationale"])
            )

    deduped_questions.sort(
        key=lambda item: (
            -int(item["final_goal_score"]),
            _rank_bucket(str(item["final_goal_bucket"])),
            item["section_title"],
            item["prompt"],
        )
    )

    for index, item in enumerate(deduped_questions, start=1):
        item["final_goal_rank"] = index

    pruned_questions = [
        {
            "question": item.get("question", ""),
            "section_title": item.get("section_title", "Unclassified"),
            "business_goal_bucket": item.get("business_goal_bucket", "weak_signal"),
            "business_goal_score": item.get("business_goal_score", 0),
        }
        for item in source_questions
        if str(item.get("business_goal_bucket", "weak_signal")) == "weak_signal"
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "source_question_count": len(source_questions),
            "final_question_count": len(deduped_questions),
            "deduplicated_question_count": len(final_questions) - len(deduped_questions),
            "pruned_question_count": len(pruned_questions),
            "split_section_count": len(split_sections),
            "split_prompt_count": sum(section["split_prompt_count"] for section in split_sections),
        },
        "final_ralph_pack": {
            "description": "Pruned and split Ralph-loop question pack ranked for Yellow Panther business goals",
            "questions": deduped_questions,
        },
        "split_sections": split_sections,
        "pruned_questions": pruned_questions,
    }


def write_final_ralph_pack(output_path: Path, pack: Dict[str, Any]) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return output_path


def build_and_write_default_final_ralph_pack(source: Union[Path, str, Mapping[str, Any]]) -> Path:
    pack = build_final_ralph_pack(source)
    if isinstance(source, Mapping):
        output_path = Path("dossier_question_final_ralph_pack.json")
    else:
        output_path = Path(source).with_name("dossier_question_final_ralph_pack.json")
    return write_final_ralph_pack(output_path, pack)


if __name__ == "__main__":  # pragma: no cover - helper
    backend_dir = Path(__file__).resolve().parent
    source = backend_dir / "data" / "dossier_question_review_pack.json"
    print(build_and_write_default_final_ralph_pack(source))
