#!/usr/bin/env python3
"""Build the browser-facing entity question pack from the final Ralph pack."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

try:
    from backend.yellow_panther_catalog import get_yp_service_summary
except ImportError:  # pragma: no cover - fallback for direct module execution
    from yellow_panther_catalog import get_yp_service_summary  # type: ignore

try:
    from backend.question_inventory_builder import build_question_inventory
    from backend.question_pack_pruner import build_question_review_pack
    from backend.question_pack_reasoner import build_question_reasoned_pack
    from backend.question_pack_business_reasoner import build_business_goal_reasoned_pack
    from backend.question_pack_final_ralph import write_final_ralph_pack, build_final_ralph_pack
except ImportError:  # pragma: no cover - fallback for direct module execution
    from question_inventory_builder import build_question_inventory  # type: ignore
    from question_pack_pruner import build_question_review_pack  # type: ignore
    from question_pack_reasoner import build_question_reasoned_pack  # type: ignore
    from question_pack_business_reasoner import build_business_goal_reasoned_pack  # type: ignore
    from question_pack_final_ralph import write_final_ralph_pack, build_final_ralph_pack  # type: ignore


BACKEND_DIR = Path(__file__).resolve().parent
FINAL_RALPH_PACK_PATH = BACKEND_DIR / "data" / "dossier_question_final_ralph_pack.json"

SERVICE_KEYWORDS = {
    "MOBILE_APPS": ["mobile app", "mobile", "ios", "android", "app"],
    "DIGITAL_TRANSFORMATION": ["digital transformation", "modernization", "modernisation", "migration", "legacy", "platform"],
    "FAN_ENGAGEMENT": ["fan engagement", "fan experience", "supporter", "loyalty"],
    "ANALYTICS": ["analytics", "data", "reporting", "insight", "dashboard"],
    "ECOMMERCE": ["e-commerce", "ecommerce", "ticketing", "merchandise", "shop", "checkout"],
    "UI_UX_DESIGN": ["ui", "ux", "design", "experience", "interface"],
}

BUDGET_MAP = {
    "MOBILE_APPS": "£80K-£300K",
    "DIGITAL_TRANSFORMATION": "£150K-£500K",
    "FAN_ENGAGEMENT": "£80K-£250K",
    "ANALYTICS": "£100K-£400K",
    "ECOMMERCE": "£100K-£500K",
    "UI_UX_DESIGN": "£50K-£150K",
}

POSITIONING_MAP = {
    "direct_revenue_signal": "SOLUTION_PROVIDER",
    "high_signal": "STRATEGIC_PARTNER",
    "context_support": "CAPABILITY_PARTNER",
    "weak_signal": "TRUSTED_ADVISOR",
}


@lru_cache(maxsize=1)
def _load_final_ralph_pack() -> Dict[str, Any]:
    if not FINAL_RALPH_PACK_PATH.exists():
        _ensure_final_ralph_pack(FINAL_RALPH_PACK_PATH)
    if not FINAL_RALPH_PACK_PATH.exists():
        raise FileNotFoundError(f"Missing final Ralph pack at {FINAL_RALPH_PACK_PATH}")
    return json.loads(FINAL_RALPH_PACK_PATH.read_text(encoding="utf-8"))


def _ensure_final_ralph_pack(output_path: Path) -> Path:
    output_path = Path(output_path)
    if output_path.exists():
        return output_path

    inventory = build_question_inventory(BACKEND_DIR)
    review_pack = build_question_review_pack(inventory)
    reasoned_pack = build_question_reasoned_pack(review_pack)
    business_goal_pack = build_business_goal_reasoned_pack(reasoned_pack)
    final_pack = build_final_ralph_pack(business_goal_pack)
    write_final_ralph_pack(output_path, final_pack)
    return output_path


def _normalize(text: str) -> str:
    return " ".join(str(text).strip().split()).lower().rstrip(" .")


def _derive_services(prompt: str, section_title: str = "") -> List[str]:
    normalized = _normalize(prompt)
    section = _normalize(section_title)
    services: List[str] = []

    for service, keywords in SERVICE_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords) or (
            service == "DIGITAL_TRANSFORMATION" and "digital transformation" in section
        ):
            services.append(service)

    if not services:
        services = ["DIGITAL_TRANSFORMATION"] if "digital" in normalized else ["MOBILE_APPS"]

    return list(dict.fromkeys(services))


def _derive_accept_criteria(prompt: str, bucket: str) -> str:
    if "?" in prompt:
        stem = prompt.rstrip("?")
    else:
        stem = prompt
    if bucket == "direct_revenue_signal":
        return f"Evidence of direct Yellow Panther fit for: {stem}"
    if bucket == "high_signal":
        return f"Evidence that supports a high-priority Yellow Panther opportunity for: {stem}"
    if bucket == "context_support":
        return f"Supporting evidence that sharpens the Ralph loop for: {stem}"
    return f"Fallback evidence only if nothing stronger exists for: {stem}"


def _derive_next_signals(services: List[str], bucket: str) -> List[str]:
    signals = ["official site", "press releases", "job postings"]
    if "ECOMMERCE" in services:
        signals = ["official site", "ticketing vendor", "press releases", "procurement notices"]
    if "ANALYTICS" in services:
        signals = ["official site", "job postings", "press releases", "data stack clues"]
    if "FAN_ENGAGEMENT" in services or "MOBILE_APPS" in services:
        signals = ["official site", "app store", "press releases", "social channels"]
    if bucket == "context_support":
        signals.append("supporting context")
    return list(dict.fromkeys(signals))


def _derive_hypothesis_template(entity_name: str, prompt: str, bucket: str) -> str:
    if bucket == "direct_revenue_signal":
        return f"{entity_name} may have an active opportunity matching: {prompt}"
    if bucket == "high_signal":
        return f"{entity_name} may warrant a Yellow Panther pilot around: {prompt}"
    return f"{entity_name} may use this prompt as supporting context: {prompt}"


def _derive_yp_advantage(services: List[str]) -> str:
    if "ECOMMERCE" in services:
        return "Position Yellow Panther around revenue-adjacent digital commerce and fan conversion"
    if "ANALYTICS" in services:
        return "Position Yellow Panther around measurable insight, reporting, and decision support"
    if "MOBILE_APPS" in services or "FAN_ENGAGEMENT" in services:
        return "Position Yellow Panther around fan experience and mobile-first engagement"
    return "Position Yellow Panther around evidence-backed digital execution"


def build_final_ralph_entity_question_pack(
    entity_type: str,
    entity_name: str,
    entity_id: str | None = None,
    max_questions: int = 10,
) -> Dict[str, Any]:
    """Return the browser-facing question pack derived from the final Ralph pack."""

    final_pack = _load_final_ralph_pack()
    questions = list(final_pack.get("final_ralph_pack", {}).get("questions", []))
    if not questions:
        raise ValueError("Final Ralph pack contains no questions")

    entity_id_value = str(entity_id or entity_name or entity_type).strip() or entity_type
    max_questions = max(1, min(int(max_questions or 10), len(questions)))
    selected_questions = questions[:max_questions]

    pack_questions: List[Dict[str, Any]] = []
    for index, item in enumerate(selected_questions, start=1):
        prompt = str(item.get("prompt") or item.get("question") or "").strip()
        bucket = str(item.get("final_goal_bucket") or "context_support")
        services = _derive_services(prompt, str(item.get("section_title", "")))
        pack_questions.append(
            {
                "question_id": f"frq_{index:03d}",
                "question": prompt,
                "pack_role": "discovery",
                "yp_service_fit": services,
                "budget_range": BUDGET_MAP.get(services[0], "£80K-£500K"),
                "yp_advantage": _derive_yp_advantage(services),
                "positioning_strategy": POSITIONING_MAP.get(bucket, "STRATEGIC_PARTNER"),
                "hypothesis_template": _derive_hypothesis_template(entity_name, prompt, bucket),
                "next_signals": _derive_next_signals(services, bucket),
                "hop_types": ["OFFICIAL_SITE", "PRESS_RELEASE", "CAREERS_PAGE", "PROCUREMENT_PAGE"],
                "accept_criteria": _derive_accept_criteria(prompt, bucket),
                "confidence_boost": round(min(0.30, float(item.get("final_goal_score", 0)) / 1000 + 0.10), 2),
                "final_goal_bucket": bucket,
                "final_goal_score": item.get("final_goal_score", 0),
                "final_goal_rank": item.get("final_goal_rank", index),
                "section_title": item.get("section_title", "Unclassified"),
                "source_questions": item.get("source_questions", []),
                "final_goal_rationale": item.get("final_goal_rationale", ""),
            }
        )

    prompt_context = (
        f"Final Ralph pack for {entity_name}. "
        f"{len(questions)} source prompts available; showing top {len(pack_questions)} ranked prompts "
        "optimized for Yellow Panther business goals, direct procurement signals, and Ralph-loop evidence gating."
    )

    writeback_metadata = {
        "artifact_path": str(FINAL_RALPH_PACK_PATH),
        "persisted": FINAL_RALPH_PACK_PATH.exists(),
        "question_count": len(pack_questions),
    }

    return {
        "entity_id": entity_id_value,
        "entity_name": entity_name,
        "entity_type": entity_type,
        "source_entity_type": entity_type,
        "pack_role": "discovery",
        "pack_stage": "final_ralph",
        "question_count": len(pack_questions),
        "prompt_context": prompt_context,
        "questions": pack_questions,
        "hypotheses": [
            {
                "hypothesis_id": f"{entity_id_value}-frq-{index:03d}",
                "entity_id": entity_id_value,
                "entity_name": entity_name,
                "statement": item["hypothesis_template"],
                "category": item["final_goal_bucket"],
                "prior_probability": min(0.99, 0.50 + float(item["confidence_boost"])),
                "confidence": min(0.99, 0.55 + float(item["confidence_boost"])),
                "status": "active",
                "metadata": {
                    "yp_service_fit": item["yp_service_fit"],
                    "positioning_strategy": item["positioning_strategy"],
                    "budget_range": item["budget_range"],
                    "confidence_boost": item["confidence_boost"],
                    "source_questions": item["source_questions"],
                },
            }
            for index, item in enumerate(pack_questions, start=1)
        ],
        "service_context": {
            **get_yp_service_summary(),
            "writeback": writeback_metadata,
        },
    }


def write_final_ralph_entity_question_pack(
    pack: Dict[str, Any],
    output_path: Path | None = None,
) -> Path:
    """Persist the browser-facing final Ralph entity question pack to disk."""

    target_path = Path(output_path or FINAL_RALPH_PACK_PATH)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    service_context = pack.setdefault("service_context", {})
    writeback = service_context.setdefault("writeback", {})
    writeback["artifact_path"] = str(target_path)
    writeback["persisted"] = True
    writeback["question_count"] = int(pack.get("question_count", len(pack.get("questions", []))))
    _load_final_ralph_pack.cache_clear()
    return target_path


__all__ = ["build_final_ralph_entity_question_pack", "write_final_ralph_entity_question_pack"]
