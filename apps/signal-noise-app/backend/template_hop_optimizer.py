#!/usr/bin/env python3
"""Utilities for scoring template hop-cap sweep runs and selecting recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


DEFAULT_WEIGHTS: Dict[str, float] = {
    "gate_pass": 100.0,
    "signals": 15.0,
    "confidence": 20.0,
    "runtime_penalty": 0.03,
    "schema_fallback_penalty": 8.0,
    "url_timeout_penalty": 4.0,
    "low_signal_penalty": 2.0,
}


@dataclass
class CapThresholds:
    min_confidence: float = 0.55
    min_signals: int = 2



def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default



def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default



def compute_objective_score(row: Dict[str, Any], weights: Optional[Dict[str, float]] = None) -> float:
    w = dict(DEFAULT_WEIGHTS)
    if isinstance(weights, dict):
        w.update(weights)

    gate_pass = bool(row.get("gate_passed"))
    signals = _as_int(row.get("signals_discovered"))
    confidence = _as_float(row.get("final_confidence"))
    runtime_seconds = _as_float(row.get("runtime_seconds"))
    schema_fallback = _as_int(row.get("schema_gate_fallback"))
    url_timeouts = _as_int(row.get("url_timeout_hits"))
    low_signal_hits = _as_int(row.get("low_signal_hits"))

    return (
        (w["gate_pass"] if gate_pass else 0.0)
        + w["signals"] * signals
        + w["confidence"] * confidence
        - w["runtime_penalty"] * runtime_seconds
        - w["schema_fallback_penalty"] * schema_fallback
        - w["url_timeout_penalty"] * url_timeouts
        - w["low_signal_penalty"] * low_signal_hits
    )



def _meets_thresholds(row: Dict[str, Any], thresholds: CapThresholds) -> bool:
    return (
        bool(row.get("gate_passed"))
        and _as_float(row.get("final_confidence")) >= thresholds.min_confidence
        and _as_int(row.get("signals_discovered")) >= thresholds.min_signals
    )



def select_recommended_cap(
    rows_for_template: List[Dict[str, Any]],
    thresholds: Optional[CapThresholds] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    if not rows_for_template:
        return {
            "recommended_cap": None,
            "needs_tuning": True,
            "reason": "no_rows",
            "best_row": None,
        }

    thresholds = thresholds or CapThresholds()
    enriched: List[Dict[str, Any]] = []
    for row in rows_for_template:
        copy = dict(row)
        copy["objective_score"] = compute_objective_score(copy, weights=weights)
        enriched.append(copy)

    passing_rows = [row for row in enriched if _meets_thresholds(row, thresholds)]
    if passing_rows:
        passing_rows.sort(
            key=lambda r: (
                _as_int(r.get("hop_cap"), 9999),
                -_as_float(r.get("objective_score"), -1e9),
            )
        )
        best = passing_rows[0]
        return {
            "recommended_cap": _as_int(best.get("hop_cap")),
            "needs_tuning": False,
            "reason": "smallest_cap_meeting_thresholds",
            "best_row": best,
        }

    enriched.sort(key=lambda r: _as_float(r.get("objective_score"), -1e9), reverse=True)
    best = enriched[0]
    return {
        "recommended_cap": _as_int(best.get("hop_cap")),
        "needs_tuning": True,
        "reason": "no_cap_meets_thresholds",
        "best_row": best,
    }
