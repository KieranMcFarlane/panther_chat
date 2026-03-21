#!/usr/bin/env python3
"""
Audit deterministic discovery template assignments for all entities.

Usage:
  PYTHONPATH=backend python3 scripts/audit-template-assignment.py
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

from hypothesis_driven_discovery import resolve_template_id


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENTITIES_PATH = PROJECT_ROOT / "data" / "all_entities.json"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "data" / "template_assignment_audit_latest.json"


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _infer_entity_type(row: Dict[str, Any]) -> str:
    org_type = _normalize_text(row.get("org_type"))
    if any(token in org_type for token in ("federation", "governing", "association", "confederation")):
        return "FEDERATION"
    if "league" in org_type:
        return "LEAGUE"
    if any(token in org_type for token in ("agency", "consult", "vendor", "service")):
        return "AGENCY"
    return "CLUB"


def _iter_entities(payload: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    entities = payload.get("entities")
    if not isinstance(entities, list):
        return []
    return (row for row in entities if isinstance(row, dict))


def _build_mismatch_reason(
    *,
    entity_type: str,
    league: str,
    template_id: str,
) -> str | None:
    league_l = _normalize_text(league)
    template_l = _normalize_text(template_id)
    type_l = _normalize_text(entity_type)

    if "federation" in type_l and not template_l.startswith("federation_"):
        return "federation_not_on_federation_template"
    if "league" in type_l and template_l.startswith("yellow_panther"):
        return "league_on_agency_template"
    if any(marker in league_l for marker in ("premier league", "la liga", "serie a", "bundesliga", "ligue 1")):
        if "tier_2_club" in template_l:
            return "top_tier_league_on_tier2_template"
    if any(marker in league_l for marker in ("championship", "league one", "league two", "national league")):
        if "tier_1_club" in template_l:
            return "lower_tier_league_on_tier1_template"
    return None


def run_audit(entities_path: Path, output_path: Path) -> Dict[str, Any]:
    payload = json.loads(entities_path.read_text())
    rows = list(_iter_entities(payload))

    template_counts: Counter[str] = Counter()
    type_to_template_counts: Dict[str, Counter[str]] = defaultdict(Counter)
    mismatches: list[Dict[str, Any]] = []
    assignments: list[Dict[str, Any]] = []

    for row in rows:
        entity_id = str(row.get("entity_id") or "").strip()
        entity_name = str(row.get("name") or "").strip()
        league = row.get("league_or_competition")
        org_type = row.get("org_type")
        entity_type = _infer_entity_type(row)

        template_id = resolve_template_id(
            template_id=None,
            entity_type=entity_type,
            league_or_competition=league,
            org_type=org_type,
            entity_id=entity_id,
            entity_name=entity_name,
        )

        template_counts[template_id] += 1
        type_to_template_counts[entity_type][template_id] += 1

        mismatch_reason = _build_mismatch_reason(
            entity_type=entity_type,
            league=str(league or ""),
            template_id=template_id,
        )
        assignment = {
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type_inferred": entity_type,
            "league_or_competition": league,
            "org_type": org_type,
            "resolved_template_id": template_id,
            "mismatch_reason": mismatch_reason,
        }
        assignments.append(assignment)
        if mismatch_reason:
            mismatches.append(assignment)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entities_path": str(entities_path),
        "total_entities": len(rows),
        "template_counts": dict(template_counts),
        "type_to_template_counts": {
            k: dict(v) for k, v in sorted(type_to_template_counts.items())
        },
        "mismatch_count": len(mismatches),
        "mismatches": mismatches[:200],
        "assignments": assignments,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2))
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit deterministic template assignment coverage.")
    parser.add_argument("--entities", default=str(DEFAULT_ENTITIES_PATH), help="Path to all_entities JSON")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Output JSON report path")
    args = parser.parse_args()

    report = run_audit(Path(args.entities), Path(args.output))
    print(f"total_entities={report['total_entities']}")
    print(f"mismatch_count={report['mismatch_count']}")
    print("template_counts:")
    for key, value in sorted(report["template_counts"].items(), key=lambda item: (-item[1], item[0])):
        print(f"  {key}: {value}")
    print(f"report_path={args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
