#!/usr/bin/env python3
"""Build a consolidated dossier question inventory for review and refinement.

This module pulls together:
- the entity-type question bank (SPORT_CLUB / SPORT_FEDERATION / SPORT_LEAGUE)
- the tiered dossier section question prompts (BASIC / STANDARD / PREMIUM)
- explicit question-like strings embedded in generated dossier artifacts
- dossier section headings from Arsenal and other generated dossier markdown files

The output is a single JSON artifact that can be reviewed before running the
Ralph loop and BrightData/OpenCode enrichment passes.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    from yellow_panther_catalog import SPORT_CLUB_QUESTIONS, SPORT_FEDERATION_QUESTIONS, SPORT_LEAGUE_QUESTIONS
except ImportError:  # pragma: no cover - fallback for alternate import paths
    from backend.yellow_panther_catalog import (  # type: ignore
        SPORT_CLUB_QUESTIONS,
        SPORT_FEDERATION_QUESTIONS,
        SPORT_LEAGUE_QUESTIONS,
    )

try:
    from dossier_section_prompts import (
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
    )
except ImportError:  # pragma: no cover - fallback for alternate import paths
    from backend.dossier_section_prompts import (  # type: ignore
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
    )


TIER_SECTION_PROMPTS = [
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

QUESTION_KEYS = ("question", "question_text", "prompt", "prompt_template")
QUESTION_TEXT_RE = re.compile(r"^(what|who|when|where|why|how)\b", re.IGNORECASE)
DOSSIER_SECTION_IDS = {
    "core_information",
    "digital_transformation",
    "leadership",
    "recent_news",
    "current_performance",
    "connections",
    "league_context",
}
DISCOVERY_SECTION_IDS = {
    "ai_reasoner_assessment",
    "strategic_opportunities",
    "outreach_strategy",
    "risk_assessment",
}


@dataclass(frozen=True)
class QuestionEntry:
    question: str
    source_kind: str
    source_label: str
    source_path: str
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        pack_role = self.metadata.get("pack_role")
        if not pack_role:
            if self.source_kind == "entity_type_question":
                pack_role = "discovery"
            elif self.source_kind == "tier_section_question":
                section_id = str(self.metadata.get("section_id") or "").strip()
                if section_id in DOSSIER_SECTION_IDS:
                    pack_role = "dossier"
                elif section_id in DISCOVERY_SECTION_IDS:
                    pack_role = "discovery"
                else:
                    pack_role = "dossier"
            elif self.source_kind in {"artifact_question", "dossier_json_section", "dossier_markdown_section"}:
                pack_role = "dossier"
            else:
                pack_role = "dossier"
        payload = {
            "question": self.question,
            "source_kind": self.source_kind,
            "source_label": self.source_label,
            "source_path": self.source_path,
            "pack_role": pack_role,
        }
        if self.metadata:
            payload["metadata"] = self.metadata
        return payload


def _repo_relative(path: Path, backend_dir: Path) -> str:
    return str(path.resolve().relative_to(backend_dir.resolve()))


def _normalize_question(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text.strip())
    normalized = normalized.rstrip(" .")
    return normalized.lower()


def _question_from_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _maybe_question_from_text(text: Any) -> Optional[str]:
    if not isinstance(text, str):
        return None
    cleaned = _question_from_text(text)
    if not cleaned:
        return None
    if cleaned.endswith("?") or QUESTION_TEXT_RE.match(cleaned):
        return cleaned
    return None


def _build_entity_type_question_entries(backend_dir: Path) -> List[QuestionEntry]:
    entries: List[QuestionEntry] = []
    mapping = [
        ("SPORT_CLUB", SPORT_CLUB_QUESTIONS),
        ("SPORT_FEDERATION", SPORT_FEDERATION_QUESTIONS),
        ("SPORT_LEAGUE", SPORT_LEAGUE_QUESTIONS),
    ]
    for entity_type, questions in mapping:
        for question in questions:
            cleaned = _maybe_question_from_text(question.question)
            if not cleaned:
                continue
            entries.append(
                QuestionEntry(
                    question=cleaned,
                    source_kind="entity_type_question",
                    source_label=entity_type,
                    source_path=_repo_relative(backend_dir / "yellow_panther_catalog.py", backend_dir),
                    metadata={
                        "question_id": question.question_id,
                        "yp_service_fit": [service.value for service in question.yp_service_fit],
                        "budget_range": question.budget_range,
                        "positioning_strategy": question.positioning_strategy.value,
                        "hop_types": list(question.hop_types),
                        "accept_criteria": question.accept_criteria,
                        "confidence_boost": question.confidence_boost,
                    },
                )
            )
    return entries


def _build_section_question_entries(backend_dir: Path) -> List[QuestionEntry]:
    entries: List[QuestionEntry] = []
    for section in TIER_SECTION_PROMPTS:
        tier = section["tier"].value
        for index, question in enumerate(section["questions_to_answer"], start=1):
            cleaned = _maybe_question_from_text(question)
            if not cleaned:
                continue
            entries.append(
                QuestionEntry(
                    question=cleaned,
                    source_kind="tier_section_question",
                    source_label=section["section_id"],
                    source_path=_repo_relative(backend_dir / "dossier_section_prompts.py", backend_dir),
                    metadata={
                        "tier": tier,
                        "section_id": section["section_id"],
                        "section_title": section["title"],
                        "question_index": index,
                        "brightdata_queries": list(section.get("brightdata_queries", [])),
                    },
                )
            )
    return entries


def _collect_json_question_entries(path: Path, backend_dir: Path) -> List[QuestionEntry]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []

    entries: List[QuestionEntry] = []

    def walk(node: Any, trail: Tuple[str, ...] = ()) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                key_lower = key.lower()
                next_trail = trail + (key,)
                if isinstance(value, str) and any(token in key_lower for token in QUESTION_KEYS):
                    cleaned = _maybe_question_from_text(value)
                    if not cleaned:
                        continue
                    entries.append(
                        QuestionEntry(
                            question=cleaned,
                            source_kind="artifact_question",
                            source_label=".".join(trail) if trail else path.stem,
                            source_path=_repo_relative(path, backend_dir),
                            metadata={
                                "field": key,
                                "trail": list(trail),
                            },
                        )
                    )
                elif key_lower == "questions_to_answer" and isinstance(value, list):
                    for index, item in enumerate(value, start=1):
                        cleaned = _maybe_question_from_text(item)
                        if cleaned:
                            entries.append(
                                QuestionEntry(
                                    question=cleaned,
                                    source_kind="artifact_question",
                                    source_label=".".join(trail) if trail else path.stem,
                                    source_path=_repo_relative(path, backend_dir),
                                    metadata={
                                        "field": key,
                                        "item_index": index,
                                        "trail": list(trail),
                                    },
                                )
                            )
                elif key_lower == "questions" and isinstance(value, list):
                    for index, item in enumerate(value, start=1):
                        if isinstance(item, str):
                            cleaned = _maybe_question_from_text(item)
                            if not cleaned:
                                continue
                            entries.append(
                                QuestionEntry(
                                    question=cleaned,
                                    source_kind="artifact_question",
                                    source_label=".".join(trail) if trail else path.stem,
                                    source_path=_repo_relative(path, backend_dir),
                                    metadata={
                                        "field": key,
                                        "item_index": index,
                                        "trail": list(trail),
                                    },
                                )
                            )
                        elif isinstance(item, dict):
                            for nested_key in QUESTION_KEYS:
                                nested_value = item.get(nested_key)
                                cleaned = _maybe_question_from_text(nested_value)
                                if cleaned:
                                    entries.append(
                                        QuestionEntry(
                                            question=cleaned,
                                            source_kind="artifact_question",
                                            source_label=".".join(trail) if trail else path.stem,
                                            source_path=_repo_relative(path, backend_dir),
                                            metadata={
                                                "field": f"{key}.{nested_key}",
                                                "item_index": index,
                                                "trail": list(trail),
                                            },
                                        )
                                    )
                walk(value, next_trail)
        elif isinstance(node, list):
            for index, item in enumerate(node, start=1):
                walk(item, trail + (f"[{index}]",))

    walk(payload)
    return entries


def _extract_markdown_review_sections(path: Path, backend_dir: Path) -> List[Dict[str, Any]]:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return []

    entity_id = path.stem.split("_dossier_")[0]
    entity_name = entity_id.replace("-", " ").title()
    sections: List[Dict[str, Any]] = []
    seen_titles: set[str] = set()
    current_title: Optional[str] = None
    current_level: Optional[int] = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("#"):
            continue
        level = len(line) - len(line.lstrip("#"))
        title = line[level:].strip()
        if not title:
            continue
        if title in {
            "Dossier Sections",
            "Details",
            "Metrics",
            "Recommendations",
            "Insights",
            "Metadata",
            "Entity Dossier",
        }:
            continue
        if "Entity Dossier" in title:
            continue
        title = re.sub(r"^\d+\.\s*", "", title)
        if title in seen_titles:
            continue
        seen_titles.add(title)
        current_title = title
        current_level = level
        sections.append(
            {
                "entity_id": entity_id,
                "entity_name": entity_name,
                "title": title,
                "source_kind": "dossier_markdown_section",
                "source_path": _repo_relative(path, backend_dir),
                "heading_level": level,
            }
        )

    return sections


def _collect_review_sections(backend_dir: Path) -> List[Dict[str, Any]]:
    dossiers_root = backend_dir / "data" / "dossiers"
    review_sections: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for json_path in sorted(dossiers_root.rglob("*.json")):
        try:
            payload = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        entity_id = str(payload.get("entity_id") or json_path.stem.split("_")[0])
        entity_name = str(payload.get("entity_name") or entity_id.replace("-", " ").title())
        sections = payload.get("sections", [])
        if not isinstance(sections, list):
            continue
        for section in sections:
            if not isinstance(section, dict):
                continue
            title = str(section.get("title") or section.get("id") or "").strip()
            if not title:
                continue
            key = (entity_id, title)
            review_sections.setdefault(
                key,
                {
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "title": title,
                    "source_kind": "dossier_json_section",
                    "source_path": _repo_relative(json_path, backend_dir),
                    "section_id": section.get("id"),
                    "generated_by": section.get("generated_by"),
                    "confidence": section.get("confidence"),
                    "output_status": section.get("output_status"),
                    "fallback_used": section.get("fallback_used"),
                },
            )

    for md_path in sorted(dossiers_root.rglob("*.md")):
        for section in _extract_markdown_review_sections(md_path, backend_dir):
            key = (section["entity_id"], section["title"])
            review_sections.setdefault(key, section)

    return sorted(review_sections.values(), key=lambda item: (item["entity_id"], item["title"]))


def _dedupe_questions(entries: Iterable[QuestionEntry]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        key = _normalize_question(entry.question)
        bucket = grouped.setdefault(
            key,
            {
                "question": entry.question,
                "normalized_question": key,
                "sources": [],
                "source_kinds": set(),
                "source_labels": set(),
                "pack_roles": set(),
            },
        )
        bucket["sources"].append(entry.to_dict())
        bucket["source_kinds"].add(entry.source_kind)
        bucket["source_labels"].add(entry.source_label)
        bucket["pack_roles"].add(entry.to_dict().get("pack_role", "dossier"))

    deduped: List[Dict[str, Any]] = []
    for bucket in grouped.values():
        pack_role = sorted(bucket["pack_roles"])[0] if bucket["pack_roles"] else "dossier"
        metadata = dict(bucket["sources"][0].get("metadata", {})) if bucket["sources"] else {}
        deduped.append(
            {
                "question": bucket["question"],
                "normalized_question": bucket["normalized_question"],
                "source_kinds": sorted(bucket["source_kinds"]),
                "source_labels": sorted(bucket["source_labels"]),
                "metadata": metadata,
                "pack_role": pack_role,
                "pack_roles": sorted(bucket["pack_roles"]),
                "sources": bucket["sources"],
            }
        )
    deduped.sort(key=lambda item: item["question"].lower())
    return deduped


def build_question_inventory(backend_dir: Path) -> Dict[str, Any]:
    backend_dir = Path(backend_dir)

    entity_type_entries = _build_entity_type_question_entries(backend_dir)
    section_entries = _build_section_question_entries(backend_dir)
    review_sections = _collect_review_sections(backend_dir)

    artifact_entries: List[QuestionEntry] = []
    dossiers_root = backend_dir / "data" / "dossiers"
    mcp_root = backend_dir / "data" / "mcp_smokes"
    for root in (dossiers_root, mcp_root):
        if not root.exists():
            continue
        for path in sorted(root.rglob("*.json")):
            artifact_entries.extend(_collect_json_question_entries(path, backend_dir))

    all_question_entries = entity_type_entries + section_entries + artifact_entries
    deduped_questions = _dedupe_questions(all_question_entries)
    dossier_entries = [
        entry
        for entry in all_question_entries
        if entry.to_dict().get("pack_role") == "dossier"
    ]
    discovery_entries = [
        entry
        for entry in all_question_entries
        if entry.to_dict().get("pack_role") == "discovery"
    ]
    dossier_questions = _dedupe_questions(dossier_entries)
    discovery_questions = _dedupe_questions(discovery_entries)

    section_breakdown_candidates = []
    for section in TIER_SECTION_PROMPTS:
        questions = [str(q).strip() for q in section.get("questions_to_answer", []) if str(q).strip()]
        section_breakdown_candidates.append(
            {
                "section_id": section["section_id"],
                "section_title": section["title"],
                "tier": section["tier"].value,
                "question_count": len(questions),
                "questions": questions,
                "suggested_split": "split" if len(questions) >= 5 else "keep",
                "breakdown_reason": "High prompt density" if len(questions) >= 5 else "Compact section",
            }
        )
    section_breakdown_candidates.sort(key=lambda item: (-item["question_count"], item["section_title"].lower()))

    entity_type_question_counts: Dict[str, int] = defaultdict(int)
    for entry in entity_type_entries:
        entity_type_question_counts[entry.source_label] += 1

    section_question_counts_by_tier: Dict[str, int] = defaultdict(int)
    for entry in section_entries:
        section_question_counts_by_tier[str(entry.metadata["tier"])] += 1

    review_section_count = len(review_sections)
    arsenal_section_count = sum(1 for section in review_sections if section["entity_id"] == "arsenal-fc")

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "entity_type_question_counts": dict(sorted(entity_type_question_counts.items())),
            "entity_type_question_total": len(entity_type_entries),
            "section_question_counts_by_tier": dict(sorted(section_question_counts_by_tier.items())),
            "section_question_total": len(section_entries),
            "review_section_count": review_section_count,
            "arsenal_section_count": arsenal_section_count,
            "artifact_question_total": len(artifact_entries),
            "dossier_question_total": len(dossier_questions),
            "discovery_question_total": len(discovery_questions),
            "unique_question_count": len(deduped_questions),
            "flat_question_total": len(deduped_questions),
        },
        "question_sets": {
            "entity_type_questions": [entry.to_dict() for entry in entity_type_entries],
            "section_questions": [entry.to_dict() for entry in section_entries],
            "dossier_questions": dossier_questions,
            "discovery_questions": discovery_questions,
            "tier_section_questions": {
                tier: [entry.to_dict() for entry in section_entries if entry.metadata.get("tier") == tier]
                for tier in sorted(section_question_counts_by_tier.keys())
            },
        },
        "artifact_questions": [entry.to_dict() for entry in artifact_entries],
        "review_sections": review_sections,
        "flat_questions": deduped_questions,
        "deduped_questions": deduped_questions,
        "section_breakdown_candidates": section_breakdown_candidates,
        "pack_role": "dossier",
    }


def write_question_inventory(output_path: Path, inventory: Dict[str, Any]) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return output_path


def build_and_write_default_inventory(backend_dir: Path) -> Path:
    backend_dir = Path(backend_dir)
    inventory = build_question_inventory(backend_dir)
    output_path = backend_dir / "data" / "dossier_question_inventory.json"
    return write_question_inventory(output_path, inventory)


if __name__ == "__main__":  # pragma: no cover - manual execution helper
    backend_dir = Path(__file__).resolve().parent
    output = build_and_write_default_inventory(backend_dir)
    print(output)
