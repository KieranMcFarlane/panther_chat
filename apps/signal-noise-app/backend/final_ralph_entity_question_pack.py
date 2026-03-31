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
    from backend.question_pack_atomic_discovery import build_atomic_discovery_pack_questions
except ImportError:  # pragma: no cover - fallback for direct module execution
    from question_pack_atomic_discovery import build_atomic_discovery_pack_questions  # type: ignore

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
    pack_questions = build_atomic_discovery_pack_questions(
        source_questions=questions,
        entity_name=entity_name,
        max_questions=max_questions,
    )

    prompt_context = (
        f"Atomic discovery pack for {entity_name}. "
        f"{len(questions)} source prompts available; showing top {len(pack_questions)} evidence-seeking prompts "
        "that should produce structured meta-json before any dossier promotion."
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
