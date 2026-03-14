from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple


_MALFORMED_MARKERS = (
    "constraints:",
    "decision on truncation",
    "option a",
    "option b",
    "section generation failed",
    "invalid json",
    "return json only",
    "keys: content, metrics, insights, recommendations, confidence",
)

_ACTION_MARKERS = (
    "run ",
    "launch ",
    "prioritize ",
    "build ",
    "execute ",
    "create ",
    "implement ",
)

_INTELLIGENCE_MARKERS = (
    "likely",
    "suggests",
    "appears",
    "indicates",
    "may ",
    "could ",
)

_EVIDENCE_RE = re.compile(
    r"\[evidence_level=(?P<evidence_level>[^;\]]+)\s*;\s*"
    r"source_type=(?P<source_type>[^;\]]+)\s*;\s*"
    r"last_verified_at=(?P<last_verified_at>[^;\]]+)\s*;\s*"
    r"needs_review=(?P<needs_review>[^;\]]+)\s*\]",
    flags=re.IGNORECASE,
)


def _normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except Exception:  # noqa: BLE001
        return 0.5
    if confidence > 1.0:
        confidence = confidence / 100.0
    return max(0.0, min(confidence, 1.0))


def _classify_layer(text: str) -> str:
    lowered = str(text or "").strip().lower()
    if any(lowered.startswith(marker) for marker in _ACTION_MARKERS):
        return "actions"
    if any(marker in lowered for marker in _INTELLIGENCE_MARKERS):
        return "intelligence"
    return "facts"


def _extract_evidence_metadata(text: str) -> Tuple[str, Dict[str, Any]]:
    raw = str(text or "").strip()
    match = _EVIDENCE_RE.search(raw)
    if not match:
        return raw, {
            "evidence_level": "inferred",
            "source_type": "model_synthesis",
            "last_verified_at": "unknown",
            "needs_review": False,
        }

    metadata = {
        "evidence_level": str(match.group("evidence_level") or "inferred").strip().lower(),
        "source_type": str(match.group("source_type") or "model_synthesis").strip().lower(),
        "last_verified_at": str(match.group("last_verified_at") or "unknown").strip(),
        "needs_review": str(match.group("needs_review") or "false").strip().lower() == "true",
    }
    cleaned = raw[: match.start()].strip()
    return cleaned, metadata


def _is_malformed_section(section: Dict[str, Any]) -> Tuple[bool, List[str]]:
    reasons: List[str] = []
    lines = [str(line or "").strip().lower() for line in section.get("content", []) if str(line or "").strip()]
    combined = " ".join(lines)

    for marker in _MALFORMED_MARKERS:
        if marker in combined:
            reasons.append(marker)
    return bool(reasons), reasons


def _is_speculative_numeric(text: str, evidence_level: str) -> bool:
    has_numeric = re.search(r"\b\d[\d,\.]*(?:%|\+)?\b", str(text or "")) is not None
    return has_numeric and evidence_level != "verified"


def normalize_dossier(payload: Dict[str, Any]) -> Dict[str, Any]:
    sections = list(payload.get("sections", []) or [])
    now_iso = datetime.now(timezone.utc).isoformat()

    claims: List[Dict[str, Any]] = []
    quarantined_sections: List[Dict[str, Any]] = []

    for section in sections:
        malformed, reasons = _is_malformed_section(section)
        if malformed:
            quarantined_sections.append(
                {
                    "section_id": str(section.get("id") or "unknown"),
                    "title": str(section.get("title") or ""),
                    "reasons": reasons,
                    "raw_excerpt": [str(x) for x in list(section.get("content", []) or [])[:3]],
                }
            )
            continue

        section_id = str(section.get("id") or "unknown")
        section_confidence = _normalize_confidence(section.get("confidence", 0.5))
        for index, raw_line in enumerate(section.get("content", []) or []):
            line = str(raw_line or "").strip()
            if not line:
                continue
            cleaned_line, evidence = _extract_evidence_metadata(line)
            layer = _classify_layer(cleaned_line)
            speculative_numeric = _is_speculative_numeric(cleaned_line, evidence["evidence_level"])
            claim = {
                "claim_id": f"{section_id}:{index}",
                "section_id": section_id,
                "section_title": str(section.get("title") or ""),
                "text": cleaned_line,
                "layer": layer,
                "claim_confidence": section_confidence,
                "evidence_level": evidence["evidence_level"],
                "source_type": evidence["source_type"],
                "last_verified_at": evidence["last_verified_at"],
                "needs_review": bool(evidence["needs_review"] or speculative_numeric),
                "speculative_numeric": speculative_numeric,
                "generated_at": str(section.get("generated_at") or now_iso),
            }
            claims.append(claim)

    facts = [claim for claim in claims if claim["layer"] == "facts"]
    intelligence = [claim for claim in claims if claim["layer"] == "intelligence"]
    actions = [claim for claim in claims if claim["layer"] == "actions"]

    return {
        "entity": {
            "entity_id": payload.get("entity_id"),
            "entity_name": payload.get("entity_name"),
            "entity_type": payload.get("entity_type"),
            "tier": payload.get("tier"),
            "generated_at": payload.get("generated_at", now_iso),
        },
        "claims": claims,
        "facts": facts,
        "intelligence": intelligence,
        "actions": actions,
        "quarantined_sections": quarantined_sections,
        "quality_summary": {
            "total_claims": len(claims),
            "quarantined_sections": len(quarantined_sections),
            "speculative_claims": sum(1 for c in claims if c.get("speculative_numeric")),
            "needs_review_claims": sum(1 for c in claims if c.get("needs_review")),
        },
    }
