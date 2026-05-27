#!/usr/bin/env python3
"""Audit and optionally repair misleading question-first dossier run rows."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

try:
    import psycopg2
    import psycopg2.extras
except ImportError:  # pragma: no cover
    psycopg2 = None


DOWNSTREAM_ONLY_QUESTIONS = {"q13_capability_gap", "q14_yp_fit", "q15_outreach_strategy"}
DIRECT_SIGNAL_QUESTIONS = {"q6_launch_signal", "q7_procurement_signal", "q8_explicit_rfp", "q9_news_signal", "q10_hiring_signal"}
GENERIC_ENTITY_NAMES = {
    "africa",
    "asia",
    "europe",
    "north america",
    "south america",
    "oceania",
    "antarctica",
    "middle east",
    "central america",
    "latin america",
    "caribbean",
    "global",
    "international",
    "world",
}


def _answers(metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    checkpoint = metadata.get("question_first_checkpoint") if isinstance(metadata.get("question_first_checkpoint"), dict) else {}
    answer_records = checkpoint.get("answer_records") if isinstance(checkpoint.get("answer_records"), list) else []
    return [answer for answer in answer_records if isinstance(answer, dict)]


def _text(value: Any) -> str:
    if isinstance(value, str):
        return "" if value.strip().lower() == "[object object]" else value.strip()
    if isinstance(value, dict):
        return " ".join(_text(item) for item in value.values()).strip()
    if isinstance(value, list):
        return " ".join(_text(item) for item in value).strip()
    return ""


def _has_bad_evidence(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() == "[object object]"
    if isinstance(value, dict):
        return any(_has_bad_evidence(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_bad_evidence(item) for item in value)
    return False


def _source_urls(answer: Dict[str, Any]) -> List[str]:
    urls: List[str] = []

    def add(value: Any) -> None:
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            urls.append(value)
        elif isinstance(value, dict):
            add(value.get("url") or value.get("source_url") or value.get("evidence_url") or value.get("href"))
        elif isinstance(value, list):
            for item in value:
                add(item)

    for key in ("url", "source_url", "evidence_url", "sources", "evidence", "display_answer", "raw_structured_output", "answer"):
        add(answer.get(key))
    return sorted(set(urls))


def analyze_row(row: Dict[str, Any]) -> List[str]:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    reasons: List[str] = []
    entity_name = str(row.get("entity_name") or "").strip().lower()
    if entity_name in GENERIC_ENTITY_NAMES:
        reasons.append("generic_geography_entity")

    answers = _answers(metadata)
    if any(_has_bad_evidence(answer) for answer in answers):
        reasons.append("invalid_object_evidence")

    direct_supported = False
    downstream_only_supported = False
    contaminated_no_signal = False
    for answer in answers:
        question_id = str(answer.get("question_id") or "").strip()
        state = str(answer.get("validation_state") or answer.get("status") or "").strip().lower()
        has_sources = bool(_source_urls(answer))
        answer_text = _text(answer.get("answer") or answer.get("summary") or answer.get("display_answer"))
        if question_id in DIRECT_SIGNAL_QUESTIONS and state in {"validated", "checked", "confirmed", "provisional"} and has_sources:
            direct_supported = True
        if question_id in DOWNSTREAM_ONLY_QUESTIONS and state in {"validated", "checked", "confirmed", "provisional"}:
            downstream_only_supported = True
        if state in {"no_signal", "no signal", "insufficient_signal"} and answer_text and "no signal" not in answer_text.lower():
            contaminated_no_signal = True

    sales_readiness = str((metadata.get("scores") or {}).get("sales_readiness") or row.get("sales_readiness") or "").strip()
    if sales_readiness in {"MONITOR", "ENGAGE", "HIGH_PRIORITY", "LIVE"} and downstream_only_supported and not direct_supported:
        reasons.append("downstream_only_scoring")
    if contaminated_no_signal:
        reasons.append("contaminated_no_signal_answer")
    return sorted(set(reasons))


def repaired_metadata(metadata: Dict[str, Any], reasons: List[str]) -> Dict[str, Any]:
    next_metadata = sanitize_metadata(dict(metadata))
    scores = dict(next_metadata.get("scores") or {})
    scores.update(
        {
            "sales_readiness": "NOT_READY",
            "active_probability": 0.05,
            "procurement_maturity": 0.0,
            "quality_repair_previous_scores": next_metadata.get("scores") or {},
        }
    )
    next_metadata.update(
        {
            "scores": scores,
            "reconcile_required": True,
            "publication_status": "published_degraded",
            "publication_mode": "quality_repair",
            "repair_state": "queued",
            "quality_repair_reasons": reasons,
            "failure_class": "dossier_quality_repair",
        }
    )
    return next_metadata


def sanitize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
    metadata = _drop_object_object_strings(metadata)
    checkpoint = metadata.get("question_first_checkpoint")
    if not isinstance(checkpoint, dict):
        return metadata
    answer_records = checkpoint.get("answer_records")
    if not isinstance(answer_records, list):
        return metadata

    sanitized_records = []
    for answer in answer_records:
        if not isinstance(answer, dict):
            sanitized_records.append(answer)
            continue
        next_answer = json.loads(json.dumps(answer))
        for key in ("evidence", "sources", "evidence_refs", "checked_sources"):
            values = next_answer.get(key)
            if isinstance(values, list):
                next_answer[key] = [value for value in values if not _has_bad_evidence(value)]
        display_answer = next_answer.get("display_answer")
        if isinstance(display_answer, dict):
            evidence = display_answer.get("evidence")
            if isinstance(evidence, list):
                display_answer["evidence"] = [value for value in evidence if not _has_bad_evidence(value)]
        nested = next_answer.get("answer")
        if isinstance(nested, dict):
            raw = nested.get("raw_structured_output")
            if isinstance(raw, dict):
                for key in ("evidence", "sources", "evidence_refs", "checked_sources"):
                    values = raw.get(key)
                    if isinstance(values, list):
                        raw[key] = [value for value in values if not _has_bad_evidence(value)]

        state = str(next_answer.get("validation_state") or next_answer.get("status") or "").strip().lower()
        answer_text = _text(next_answer.get("answer") or next_answer.get("summary") or next_answer.get("display_answer"))
        if state in {"no_signal", "no signal", "insufficient_signal"} and answer_text and "no signal" not in answer_text.lower():
            next_answer["validation_state"] = "reconcile_required"
            next_answer["terminal_state"] = "reconcile_required"
            nested_answer = next_answer.get("answer")
            if isinstance(nested_answer, dict):
                nested_answer["validation_state"] = "reconcile_required"
                nested_answer["terminal_state"] = "reconcile_required"
        sanitized_records.append(next_answer)

    checkpoint["answer_records"] = sanitized_records
    metadata["question_first_checkpoint"] = checkpoint
    return metadata


def _drop_object_object_strings(value: Any) -> Any:
    if isinstance(value, str):
        return "" if value.strip().lower() == "[object object]" else value
    if isinstance(value, list):
        return [_drop_object_object_strings(item) for item in value]
    if isinstance(value, dict):
        return {key: _drop_object_object_strings(item) for key, item in value.items()}
    return value


def connect(database_url: str):
    if psycopg is not None:
        return psycopg.connect(database_url)
    if psycopg2 is not None:
        return psycopg2.connect(database_url)
    raise RuntimeError("Install psycopg or psycopg2 to run this repair script")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL") or "postgresql:///signal_noise_app?host=/var/run/postgresql")
    args = parser.parse_args()

    with connect(args.database_url) as conn:
        cursor_factory = None
        if psycopg2 is not None and conn.__class__.__module__.startswith("psycopg2"):
            cursor_factory = psycopg2.extras.RealDictCursor
        with (conn.cursor(cursor_factory=cursor_factory) if cursor_factory else conn.cursor()) as cur:
            cur.execute(
                """
                select id, entity_name, sales_readiness, metadata
                from entity_pipeline_runs
                where status = 'completed'
                order by completed_at desc nulls last
                limit %s
                """,
                (args.limit,),
            )
            rows = cur.fetchall()
            if rows and not isinstance(rows[0], dict):
                columns = [desc[0] for desc in cur.description]
                rows = [dict(zip(columns, row)) for row in rows]

            findings = []
            for row in rows:
                reasons = analyze_row(row)
                if not reasons:
                    continue
                findings.append({"id": row["id"], "entity_name": row["entity_name"], "reasons": reasons})
                if args.apply:
                    metadata = repaired_metadata(row.get("metadata") or {}, reasons)
                    cur.execute(
                        """
                        update entity_pipeline_runs
                        set sales_readiness = 'NOT_READY',
                            rfp_count = 0,
                            metadata = %s
                        where id = %s
                        """,
                        (json.dumps(metadata), row["id"]),
                    )
            if args.apply:
                conn.commit()
            print(json.dumps({"apply": args.apply, "scanned": len(rows), "findings": findings}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
