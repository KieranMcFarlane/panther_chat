#!/usr/bin/env python3
"""Prune the consolidated question inventory into a reviewable dossier pack.

Outputs:
- ultimate_dossier_pack: the actual questions we want to evaluate as the final pack
- sections_to_keep: the section list plus keep/split guidance
- questions_to_drop_or_merge: raw artifact groups that should be merged or dropped
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Union


SOURCE_PRIORITY = {
    "entity_type_question": 0,
    "tier_section_question": 1,
    "artifact_question": 2,
}


def _normalize_question(text: str) -> str:
    return " ".join(str(text).strip().split()).lower().rstrip(" .")


def _load_inventory(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    if isinstance(source, Mapping):
        return dict(source)
    path = Path(source)
    return json.loads(path.read_text(encoding="utf-8"))


def _primary_source_kind(source_kinds: List[str]) -> str:
    if not source_kinds:
        return "artifact_question"
    return sorted(source_kinds, key=lambda item: SOURCE_PRIORITY.get(item, 99))[0]


def _group_artifact_questions(artifact_questions: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for item in artifact_questions:
        question = item.get("question")
        if not isinstance(question, str) or not question.strip():
            continue
        normalized = _normalize_question(question)
        bucket = grouped.setdefault(
            normalized,
            {
                "canonical_question": question.strip(),
                "normalized_question": normalized,
                "occurrence_count": 0,
                "source_kinds": set(),
                "source_labels": set(),
                "sample_sources": [],
            },
        )
        bucket["occurrence_count"] += 1
        bucket["source_kinds"].add(str(item.get("source_kind") or "artifact_question"))
        bucket["source_labels"].add(str(item.get("source_label") or ""))
        if len(bucket["sample_sources"]) < 3:
            bucket["sample_sources"].append(
                {
                    "source_path": item.get("source_path"),
                    "source_label": item.get("source_label"),
                }
            )

    groups: List[Dict[str, Any]] = []
    for bucket in grouped.values():
        groups.append(
            {
                "canonical_question": bucket["canonical_question"],
                "normalized_question": bucket["normalized_question"],
                "occurrence_count": bucket["occurrence_count"],
                "source_kinds": sorted(k for k in bucket["source_kinds"] if k),
                "source_labels": sorted(l for l in bucket["source_labels"] if l),
                "sample_sources": bucket["sample_sources"],
            }
        )
    groups.sort(key=lambda item: (-item["occurrence_count"], item["canonical_question"].lower()))
    return groups


def build_question_review_pack(source: Union[Path, str, Mapping[str, Any]]) -> Dict[str, Any]:
    inventory = _load_inventory(source)

    flat_questions = list(inventory.get("flat_questions", []))
    artifact_questions = list(inventory.get("artifact_questions", []))
    section_candidates = list(inventory.get("section_breakdown_candidates", []))

    ultimate_questions: List[Dict[str, Any]] = []
    for item in flat_questions:
        sources = list(item.get("sources", []))
        source_kinds = list(item.get("source_kinds", []))
        source_labels = list(item.get("source_labels", []))
        primary_kind = _primary_source_kind(source_kinds)
        ultimate_questions.append(
            {
                "question": item["question"],
                "normalized_question": item["normalized_question"],
                "primary_source_kind": primary_kind,
                "source_kinds": source_kinds,
                "source_labels": source_labels,
                "source_count": len(sources),
                "sources": sources,
                "recommendation": "keep" if primary_kind != "artifact_question" else "merge_review",
            }
        )

    ultimate_questions.sort(
        key=lambda item: (
            SOURCE_PRIORITY.get(item["primary_source_kind"], 99),
            item["question"].lower(),
        )
    )

    promoted_set = {item["normalized_question"] for item in ultimate_questions}
    grouped_artifacts = _group_artifact_questions(artifact_questions)
    questions_to_drop_or_merge: List[Dict[str, Any]] = []
    for group in grouped_artifacts:
        if group["normalized_question"] in promoted_set:
            action = "merge"
            reason = "Already represented in the final pack; keep one canonical version."
        else:
            action = "drop"
            reason = "Artifact-derived question does not appear in the final pack."
        if group["occurrence_count"] > 1 or action == "drop":
            questions_to_drop_or_merge.append(
                {
                    **group,
                    "recommended_action": action,
                    "reason": reason,
                }
            )

    sections_to_keep: List[Dict[str, Any]] = []
    for index, section in enumerate(section_candidates, start=1):
        question_count = int(section.get("question_count") or 0)
        decision = "split" if question_count >= 5 else "keep"
        sections_to_keep.append(
            {
                **section,
                "decision": decision,
                "review_order": index,
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "ultimate_question_count": len(ultimate_questions),
            "section_count": len(sections_to_keep),
            "merge_or_drop_count": len(questions_to_drop_or_merge),
            "artifact_group_count": len(grouped_artifacts),
        },
        "ultimate_dossier_pack": {
            "description": "Canonical questions to use in the Ralph loop and final dossier pack",
            "questions": ultimate_questions,
        },
        "sections_to_keep": sections_to_keep,
        "questions_to_drop_or_merge": questions_to_drop_or_merge,
    }


def write_question_review_pack(output_path: Path, pack: Dict[str, Any]) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return output_path


def build_and_write_default_review_pack(inventory_source: Union[Path, str, Mapping[str, Any]]) -> Path:
    pack = build_question_review_pack(inventory_source)
    if isinstance(inventory_source, Mapping):
        output_path = Path("dossier_question_review_pack.json")
    else:
        output_path = Path(inventory_source).with_name("dossier_question_review_pack.json")
    return write_question_review_pack(output_path, pack)


if __name__ == "__main__":  # pragma: no cover - helper
    backend_dir = Path(__file__).resolve().parent
    source = backend_dir / "data" / "dossier_question_inventory.json"
    print(build_and_write_default_review_pack(source))
