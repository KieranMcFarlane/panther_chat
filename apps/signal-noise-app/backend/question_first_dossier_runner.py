#!/usr/bin/env python3
"""Question-first dossier adapter around the canonical OpenCode artifact.

This module now consumes a versioned ``question_first_run_v2`` artifact emitted
by the OpenCode batch runner, merges it into a dossier payload, and optionally
launches the canonical OpenCode batch when an artifact path is not supplied.
"""

from __future__ import annotations

import asyncio
from copy import deepcopy
import json
import logging
import os
import re
import subprocess
import time
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError, ConfigDict, model_validator

try:
    from backend.brightdata_mcp_client import BrightDataMCPClient
    from backend.claude_client import ClaudeClient
    from backend.connections_graph_enricher import (
        build_default_connections_graph_enricher,
        connections_enrichment_enabled_by_default,
    )
    from backend.question_first_promoter import build_question_first_promotions
    from backend.yellow_panther_scorer import score_yp_fit
except ImportError:
    from brightdata_mcp_client import BrightDataMCPClient  # type: ignore
    from claude_client import ClaudeClient  # type: ignore
    from connections_graph_enricher import build_default_connections_graph_enricher, connections_enrichment_enabled_by_default  # type: ignore
    from question_first_promoter import build_question_first_promotions  # type: ignore
    from yellow_panther_scorer import score_yp_fit  # type: ignore

logger = logging.getLogger(__name__)


class CompletedWithoutArtifactError(FileNotFoundError):
    """Raised when a batch reaches a terminal success path but emits no canonical artifact."""


DEFAULT_MIN_PUBLISH_QUESTION_COUNT = 15


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso_timestamp(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()
    except ValueError:
        try:
            return float(text)
        except (TypeError, ValueError):
            return None


def _seconds_between(start_value: Any, end_value: Any) -> float:
    start_ts = _parse_iso_timestamp(start_value)
    end_ts = _parse_iso_timestamp(end_value)
    if start_ts is None or end_ts is None:
        return 0.0
    return round(max(end_ts - start_ts, 0.0), 3)


def _slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", str(value or "").strip().lower())
    return re.sub(r"-+", "-", value).strip("-") or "entity"


def _parse_opencode_batch_stdout(stdout_text: str) -> Dict[str, Any]:
    lines = [line.strip() for line in str(stdout_text or "").splitlines() if line.strip()]
    if not lines:
        return {}
    try:
        parsed = json.loads(lines[-1])
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def _terminate_process(proc: subprocess.Popen[str], *, grace_seconds: float = 2.0) -> Tuple[str, str]:
    if proc.poll() is None:
        proc.terminate()
        try:
            stdout, stderr = await asyncio.to_thread(proc.communicate, timeout=grace_seconds)
            return stdout or "", stderr or ""
        except subprocess.TimeoutExpired:
            proc.kill()
    stdout, stderr = await asyncio.to_thread(proc.communicate)
    return stdout or "", stderr or ""


def _build_question_first_state_path(
    *,
    output_dir: Path,
    source_payload: Dict[str, Any],
    preset: Optional[str] = None,
    artifact: Optional[QuestionFirstRunArtifact] = None,
) -> Path:
    entity_name = str(
        (artifact.entity if artifact else source_payload).get("entity_name")
        or source_payload.get("entity_name")
        or source_payload.get("entity_id")
        or "entity"
    )
    entity_id = str(
        (artifact.entity if artifact else source_payload).get("entity_id")
        or source_payload.get("entity_id")
        or _slugify(entity_name)
    )
    resolved_preset = str(
        preset
        or (artifact.preset if artifact else None)
        or source_payload.get("preset")
        or source_payload.get("question_source_label")
        or "question-first"
    )
    return output_dir / f"{_slugify(entity_id)}_{_slugify(resolved_preset)}_state.json"


def _derive_question_first_batch_timeout_ms(
    *,
    source_payload: Dict[str, Any],
    opencode_timeout_ms: int,
) -> int:
    questions = source_payload.get("questions") if isinstance(source_payload, dict) else None
    question_count = len(questions) if isinstance(questions, list) and questions else 1
    base_timeout_ms = max(int(opencode_timeout_ms or 0), 1)
    if question_count <= 1:
        return base_timeout_ms
    buffer_ms = min(60000, base_timeout_ms)
    return max(base_timeout_ms, base_timeout_ms * question_count + buffer_ms)


def _classify_question_first_batch_timeout(
    *,
    state_payload: Optional[Dict[str, Any]],
    state_path: Path,
    last_progress_mtime: Optional[float],
    progress_window_seconds: float = 30.0,
) -> str:
    payload = state_payload if isinstance(state_payload, dict) else {}
    run_phase = str(payload.get("run_phase") or "").strip().lower()
    if run_phase == "completed":
        return "completed_not_harvested"
    if last_progress_mtime is not None and (time.time() - float(last_progress_mtime)) <= max(progress_window_seconds, 0.0):
        return "still_progressing"
    if payload or state_path.exists():
        return "stalled"
    return "true_timeout"


@contextmanager
def _acquire_question_first_launch_lock(worktree_root: Path):
    lock_dir = Path(worktree_root) / ".locks"
    lock_dir.mkdir(parents=True, exist_ok=True)
    lock_path = lock_dir / "question-first-batch.lock"
    lock_path.touch(exist_ok=True)
    lock_file = lock_path.open("a+")
    try:
        try:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        except ImportError as exc:  # pragma: no cover - platform fallback
            raise RuntimeError("question-first launch locking requires fcntl on this platform") from exc
        yield lock_path
    finally:
        try:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass
        lock_file.close()


async def _wait_for_question_first_run_completion(
    state_path: Path,
    *,
    timeout_ms: int = 300000,
    poll_interval_ms: int = 250,
) -> Dict[str, Any]:
    deadline = time.monotonic() + max(timeout_ms, 1) / 1000.0
    last_state: Dict[str, Any] = {}
    last_progress_mtime: Optional[float] = None
    while time.monotonic() <= deadline:
        if state_path.exists():
            try:
                last_state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                last_state = {}
            try:
                current_mtime = state_path.stat().st_mtime
            except OSError:
                current_mtime = None
            if current_mtime is not None and current_mtime != last_progress_mtime:
                last_progress_mtime = current_mtime
            if str(last_state.get("run_phase") or "").lower() == "completed":
                return last_state
        await asyncio.sleep(max(poll_interval_ms, 1) / 1000.0)
    classification = _classify_question_first_batch_timeout(
        state_payload=last_state,
        state_path=state_path,
        last_progress_mtime=last_progress_mtime,
    )
    raise TimeoutError(
        f"Timed out waiting for question-first batch to reach completed state at {state_path} ({classification})"
    )


def _resolve_question_first_worktree_root(worktree_root: Optional[Path] = None) -> Path:
    """Prefer the dedicated question-first worktree when no explicit root is provided."""
    if worktree_root is not None:
        return Path(worktree_root)

    repo_root = Path(__file__).resolve().parents[3]
    preferred = repo_root / ".worktrees" / "opencode-question-first-ssot"
    if preferred.exists():
        return preferred
    return repo_root


class QuestionFirstRunArtifact(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: Literal["question_first_run_v1", "question_first_run_v2"]
    run_id: Optional[str] = None
    generated_at: str
    run_started_at: str
    source: str
    status: str
    warnings: List[str] = Field(default_factory=list)
    entity: Dict[str, Any] = Field(default_factory=dict)
    preset: Optional[str] = None
    question_source_path: Optional[str] = None
    question_specs: List[Dict[str, Any]] = Field(default_factory=list)
    answer_records: List[Dict[str, Any]] = Field(default_factory=list)
    question_timings: Dict[str, Any] = Field(default_factory=dict)
    evidence_items: List[Dict[str, Any]] = Field(default_factory=list)
    promotion_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    poi_graph: Dict[str, Any] = Field(default_factory=dict)
    trace_index: List[Dict[str, Any]] = Field(default_factory=list)
    categories: List[Dict[str, Any]] = Field(default_factory=list)
    run_rollup: Dict[str, Any] = Field(default_factory=dict)
    merge_patch: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _upgrade_v1_fields(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        upgraded = dict(value)
        if "question_specs" not in upgraded and isinstance(upgraded.get("questions"), list):
            upgraded["question_specs"] = upgraded.get("questions")
        if "answer_records" not in upgraded and isinstance(upgraded.get("answers"), list):
            upgraded["answer_records"] = upgraded.get("answers")
        if "trace_index" not in upgraded:
            upgraded["trace_index"] = []
        return upgraded

    @property
    def questions(self) -> List[Dict[str, Any]]:
        return list(self.question_specs or [])

    @property
    def answers(self) -> List[Dict[str, Any]]:
        return list(self.answer_records or [])


def _load_question_first_run_artifact(artifact_path: Path | str) -> QuestionFirstRunArtifact:
    path = Path(artifact_path)
    try:
        return QuestionFirstRunArtifact.model_validate_json(path.read_text(encoding="utf-8"))
    except ValidationError as exc:
        raise ValueError(f"Invalid question_first_run artifact at {path}") from exc


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        nested = value.get("url") or value.get("href") or value.get("source_url")
        if nested is not None:
            return str(nested).strip()
    return str(value).strip()


def _has_readable_value(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (int, float, bool)):
        return True
    if isinstance(value, list):
        return len(value) > 0
    return value is not None


def _collect_answer_sources(answer_payload: Dict[str, Any], timeout_salvage: Dict[str, Any]) -> List[str]:
    raw_structured_output = answer_payload.get("raw_structured_output") if isinstance(answer_payload.get("raw_structured_output"), dict) else {}
    structured_sources = raw_structured_output.get("sources") if isinstance(raw_structured_output.get("sources"), list) else []
    salvage_sources = timeout_salvage.get("candidate_evidence_urls") if isinstance(timeout_salvage.get("candidate_evidence_urls"), list) else []
    sources: List[str] = []
    for candidate in [*structured_sources, *salvage_sources]:
        text = _coerce_text(candidate)
        if text and text not in sources:
            sources.append(text)
    return sources


def _trusted_people_fallback_candidates(timeout_salvage: Dict[str, Any]) -> List[Dict[str, str]]:
    raw_candidates = timeout_salvage.get("fallback_candidates") if isinstance(timeout_salvage.get("fallback_candidates"), list) else []
    trusted_source_types = {"official_site", "official_website", "wikipedia", "linkedin_company_profile", "linkedin_person_profile", "linkedin_people_search", "news", "press_release"}
    trusted_domains = ("linkedin.com", "wikipedia.org")
    trusted_candidates: List[Dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for candidate in raw_candidates:
        if not isinstance(candidate, dict):
            continue
        name = _coerce_text(candidate.get("name"))
        title = _coerce_text(candidate.get("title"))
        source_url = _coerce_text(candidate.get("source_url"))
        source_type = _coerce_text(candidate.get("source_type")).lower()
        if not name or not title or not source_url:
            continue
        is_trusted = source_type in trusted_source_types or any(domain in source_url.lower() for domain in trusted_domains)
        if not is_trusted:
            continue
        key = (name.lower(), title.lower(), source_url.lower())
        if key in seen:
            continue
        seen.add(key)
        trusted_candidates.append(
            {
                "name": name,
                "title": title,
                "source_url": source_url,
                "source_type": source_type or "trusted_fallback",
            }
        )
    return trusted_candidates


def _normalize_people_candidate(candidate: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(candidate, dict):
        return None
    normalized = dict(candidate)
    name = _coerce_text(normalized.get("name") or normalized.get("full_name") or normalized.get("person"))
    title = _coerce_text(normalized.get("title") or normalized.get("role"))
    source_url = _coerce_text(normalized.get("source_url") or normalized.get("url") or normalized.get("href"))
    if not name or not title:
        return None
    normalized["name"] = name
    normalized["title"] = title
    if source_url:
        normalized["source_url"] = source_url
    elif "source_url" in normalized:
        normalized.pop("source_url", None)
    for field in ("linkedin_url", "email", "bio", "recent_post_summary"):
        value = _coerce_text(normalized.get(field))
        if value:
            normalized[field] = value
        elif field in normalized:
            normalized.pop(field, None)
    if isinstance(normalized.get("recent_post_urls"), list):
        normalized["recent_post_urls"] = [_coerce_text(item) for item in normalized["recent_post_urls"] if _coerce_text(item)]
    return normalized


def _normalize_people_candidate_list(candidates: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    if not isinstance(candidates, list):
        return normalized
    for candidate in candidates:
        normalized_candidate = _normalize_people_candidate(candidate)
        if not normalized_candidate:
            continue
        key = (
            normalized_candidate["name"].lower(),
            normalized_candidate["title"].lower(),
            _coerce_text(normalized_candidate.get("source_url")).lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        normalized.append(normalized_candidate)
    return normalized


def _decision_owner_rank(candidate: Dict[str, str]) -> tuple[int, int, str]:
    title = _coerce_text(candidate.get("title")).lower()
    operating_priority = [
        "chief commercial officer",
        "commercial director",
        "chief executive officer",
        "ceo",
        "managing director",
        "director general",
        "secretary general",
        "head of partnerships",
        "partnerships manager",
        "marketing director",
        "chief marketing officer",
        "chief digital officer",
        "technology director",
    ]
    governance_priority = [
        "chairman",
        "chair",
        "president",
        "vice chairman",
        "vice president",
        "secretary",
        "treasurer",
    ]
    for index, role in enumerate(operating_priority):
        if role in title:
            return (0, index, title)
    for index, role in enumerate(governance_priority):
        if role in title:
            return (1, index, title)
    return (2, 999, title)


def _rank_decision_owner_candidates(candidates: List[Dict[str, str]]) -> List[Dict[str, str]]:
    return sorted(candidates, key=_decision_owner_rank)


def _derive_terminal_state(*, question: Dict[str, Any], answer: Dict[str, Any], answer_payload: Dict[str, Any], raw_structured_output: Dict[str, Any], raw_answer_value: Any) -> str:
    validation_state = _coerce_text(answer.get("validation_state")).lower()
    has_answer_text = (
        _has_readable_value(answer_payload.get("summary"))
        or _has_readable_value(answer_payload.get("value"))
        or _has_readable_value(raw_structured_output.get("answer"))
        or _has_readable_value(raw_answer_value)
    )
    blocking_note = _coerce_text(answer.get("notes") or raw_structured_output.get("notes") or raw_structured_output.get("context")).lower()
    depends_on = question.get("depends_on") if isinstance(question.get("depends_on"), list) else []

    if validation_state == "skipped" or _coerce_text(answer.get("skip_reason")):
        return "skipped"

    if has_answer_text and validation_state in {"validated", "partially_validated", "deterministic_detected", "provisional", "inferred"}:
        return "answered"
    if (
        "question conditions were not met" in blocking_note
        or "no capability-gap inference" in blocking_note
        or "upstream signals are available yet" in blocking_note
        or (depends_on and validation_state == "no_signal" and not has_answer_text)
    ):
        return "blocked"
    return "no_signal"


def _derive_terminal_summary(
    *,
    question: Dict[str, Any],
    answer: Dict[str, Any],
    answer_payload: Dict[str, Any],
    raw_structured_output: Dict[str, Any],
    timeout_salvage: Dict[str, Any],
    terminal_state: str,
    raw_answer_value: Any,
) -> str:
    commercial_interpretation = answer_payload.get("commercial_interpretation") if isinstance(answer_payload.get("commercial_interpretation"), dict) else {}
    summary_candidates = [
        answer_payload.get("summary"),
        answer_payload.get("value"),
        raw_answer_value if not isinstance(raw_answer_value, dict) else None,
        raw_structured_output.get("summary"),
        raw_structured_output.get("answer"),
        commercial_interpretation.get("summary") if isinstance(commercial_interpretation, dict) else "",
        raw_structured_output.get("context"),
        raw_structured_output.get("notes"),
        answer.get("notes"),
    ]
    for candidate in summary_candidates:
        text = _coerce_text(candidate)
        if text:
            return text

    salvage_summary = _coerce_text(timeout_salvage.get("candidate_summary"))
    if salvage_summary:
        return f"Evidence retained during timeout, but no validated answer was produced. {salvage_summary}"

    if terminal_state == "skipped":
        reason = _coerce_text(answer.get("skip_reason"))
        note = _coerce_text(answer.get("skip_note"))
        if reason and note:
            return f"Skipped: {reason}. {note}"
        if reason:
            return f"Skipped: {reason}"
        if note:
            return f"Skipped: {note}"

    if terminal_state == "blocked":
        depends_on = question.get("depends_on") if isinstance(question.get("depends_on"), list) else []
        if depends_on:
            return f"Blocked by upstream question state: {', '.join(_coerce_text(item) for item in depends_on if _coerce_text(item))}"

    return "No deterministic answer was produced for this question."


def _normalize_answer_record(answer: Dict[str, Any], question: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    normalized = dict(answer or {})
    question_spec = question if isinstance(question, dict) else {}
    answer_payload = normalized.get("answer") if isinstance(normalized.get("answer"), dict) else {}
    raw_answer_value = normalized.get("answer")
    answer_payload = dict(answer_payload)
    raw_structured_output = answer_payload.get("raw_structured_output") if isinstance(answer_payload.get("raw_structured_output"), dict) else {}
    raw_structured_output = dict(raw_structured_output)
    timeout_salvage = normalized.get("timeout_salvage") if isinstance(normalized.get("timeout_salvage"), dict) else {}
    timeout_salvage = dict(timeout_salvage)
    question_type = _coerce_text(normalized.get("question_type") or question_spec.get("question_type")).lower()
    existing_candidates = _normalize_people_candidate_list(
        normalized.get("candidates")
        if isinstance(normalized.get("candidates"), list)
        else raw_structured_output.get("candidates")
        if isinstance(raw_structured_output.get("candidates"), list)
        else answer_payload.get("value")
        if isinstance(answer_payload.get("value"), list)
        else []
    )
    existing_primary_owner = _normalize_people_candidate(normalized.get("primary_owner"))
    existing_supporting_candidates = _normalize_people_candidate_list(normalized.get("supporting_candidates"))
    trusted_people_candidates = _trusted_people_fallback_candidates(timeout_salvage) if question_type in {"leadership", "decision_owner"} else []
    if question_type == "leadership" and trusted_people_candidates:
        normalized["validation_state"] = "partially_validated"
        answer_payload["kind"] = "list"
        answer_payload["value"] = trusted_people_candidates
        answer_payload["summary"] = f"Recovered {len(trusted_people_candidates)} leadership candidates from trusted fallback sources."
        raw_structured_output["answer"] = trusted_people_candidates
        raw_structured_output["summary"] = answer_payload["summary"]
        raw_structured_output["validation_state"] = "partially_validated"
        raw_answer_value = trusted_people_candidates
    elif question_type == "leadership" and existing_candidates:
        normalized["candidates"] = existing_candidates
        answer_payload["kind"] = "list"
        answer_payload["value"] = existing_candidates
        raw_structured_output["candidates"] = existing_candidates
        if isinstance(raw_structured_output.get("answer"), list):
            raw_structured_output["answer"] = existing_candidates
        raw_answer_value = existing_candidates
    elif question_type == "decision_owner" and trusted_people_candidates:
        ranked_candidates = _rank_decision_owner_candidates(trusted_people_candidates)
        primary_owner = ranked_candidates[0]
        supporting_candidates = ranked_candidates[1:]
        normalized["validation_state"] = "partially_validated"
        normalized["primary_owner"] = primary_owner
        normalized["supporting_candidates"] = supporting_candidates
        normalized["candidates"] = ranked_candidates
        answer_payload["kind"] = "list"
        answer_payload["value"] = ranked_candidates
        answer_payload["summary"] = f"Recovered {len(ranked_candidates)} decision-owner candidates from trusted fallback sources."
        raw_structured_output["answer"] = primary_owner.get("name")
        raw_structured_output["primary_owner"] = primary_owner
        raw_structured_output["candidates"] = ranked_candidates
        raw_structured_output["summary"] = answer_payload["summary"]
        raw_structured_output["validation_state"] = "partially_validated"
        raw_answer_value = ranked_candidates
    elif question_type == "decision_owner" and (existing_primary_owner or existing_candidates):
        ranked_candidates = _rank_decision_owner_candidates(existing_candidates or ([existing_primary_owner] if existing_primary_owner else []))
        primary_owner = existing_primary_owner or (ranked_candidates[0] if ranked_candidates else None)
        supporting_candidates = existing_supporting_candidates or ([candidate for candidate in ranked_candidates if not primary_owner or candidate != primary_owner])
        if primary_owner:
            normalized["primary_owner"] = primary_owner
            raw_structured_output["primary_owner"] = primary_owner
        normalized["supporting_candidates"] = supporting_candidates
        normalized["candidates"] = ranked_candidates
        answer_payload["kind"] = "list"
        answer_payload["value"] = ranked_candidates
        raw_structured_output["candidates"] = ranked_candidates
        raw_answer_value = ranked_candidates
    elif question_type == "leadership" and _coerce_text(normalized.get("validation_state")).lower() == "failed":
        normalized["validation_state"] = "no_signal"
        answer_payload["summary"] = "No trusted leadership candidates could be recovered from fallback sources."
        raw_structured_output["summary"] = answer_payload["summary"]
        raw_structured_output["validation_state"] = "no_signal"
    elif question_type == "decision_owner" and _coerce_text(normalized.get("validation_state")).lower() == "failed":
        normalized["validation_state"] = "no_signal"
        normalized["primary_owner"] = None
        normalized["supporting_candidates"] = []
        normalized["candidates"] = []
        answer_payload["summary"] = "No trusted decision-owner candidates could be recovered from fallback sources."
        raw_structured_output["summary"] = answer_payload["summary"]
        raw_structured_output["validation_state"] = "no_signal"
    terminal_state = _derive_terminal_state(
        question=question_spec,
        answer=normalized,
        answer_payload=answer_payload,
        raw_structured_output=raw_structured_output,
        raw_answer_value=raw_answer_value,
    )
    terminal_summary = _derive_terminal_summary(
        question=question_spec,
        answer=normalized,
        answer_payload=answer_payload,
        raw_structured_output=raw_structured_output,
        timeout_salvage=timeout_salvage,
        terminal_state=terminal_state,
        raw_answer_value=raw_answer_value,
    )
    blocked_by = [
        _coerce_text(item)
        for item in (question_spec.get("depends_on") if isinstance(question_spec.get("depends_on"), list) else [])
        if _coerce_text(item)
    ] if terminal_state == "blocked" else []
    sources = _collect_answer_sources(answer_payload, timeout_salvage)

    normalized["notes"] = _coerce_text(normalized.get("notes")) or terminal_summary
    normalized["terminal_state"] = terminal_state
    normalized["terminal_summary"] = terminal_summary
    normalized["blocked_by"] = blocked_by
    normalized["answer"] = {
        **answer_payload,
        "summary": _coerce_text(answer_payload.get("summary")) or (_coerce_text(raw_answer_value) if not isinstance(raw_answer_value, dict) else "") or terminal_summary,
        "value": answer_payload.get("value", raw_answer_value if not isinstance(raw_answer_value, dict) else answer_payload.get("value")),
        "raw_structured_output": {
            **raw_structured_output,
            "answer": raw_structured_output.get("answer") if raw_structured_output.get("answer") is not None else raw_answer_value,
            "summary": _coerce_text(raw_structured_output.get("summary")) or (_coerce_text(raw_answer_value) if not isinstance(raw_answer_value, dict) else "") or terminal_summary,
            "context": _coerce_text(raw_structured_output.get("context")) or terminal_summary,
            "notes": _coerce_text(raw_structured_output.get("notes")) or terminal_summary,
            "validation_state": _coerce_text(raw_structured_output.get("validation_state")) or _coerce_text(normalized.get("validation_state")) or "no_signal",
            "sources": sources,
        },
        "terminal_state": terminal_state,
        "blocked_by": blocked_by,
    }
    if question_type == "leadership":
        normalized["candidates"] = _normalize_people_candidate_list(normalized.get("candidates"))
        if isinstance(normalized["answer"].get("raw_structured_output"), dict):
            normalized["answer"]["raw_structured_output"]["candidates"] = _normalize_people_candidate_list(
                normalized["answer"]["raw_structured_output"].get("candidates")
            )
    if question_type == "decision_owner":
        normalized["primary_owner"] = _normalize_people_candidate(normalized.get("primary_owner"))
        normalized["supporting_candidates"] = _normalize_people_candidate_list(normalized.get("supporting_candidates"))
        normalized["candidates"] = _normalize_people_candidate_list(normalized.get("candidates"))
        if isinstance(normalized["answer"].get("raw_structured_output"), dict):
            normalized["answer"]["raw_structured_output"]["primary_owner"] = _normalize_people_candidate(
                normalized["answer"]["raw_structured_output"].get("primary_owner")
            )
            normalized["answer"]["raw_structured_output"]["candidates"] = _normalize_people_candidate_list(
                normalized["answer"]["raw_structured_output"].get("candidates")
            )
    return normalized


def _extract_raw_structured_output(answer: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(answer, dict):
        return {}
    answer_payload = answer.get("answer")
    if isinstance(answer_payload, dict):
        raw = answer_payload.get("raw_structured_output")
        if isinstance(raw, dict):
            return dict(raw)
    raw = answer.get("raw_structured_output")
    return dict(raw) if isinstance(raw, dict) else {}


def _synthesize_yp_fit_answer_record(
    *,
    q14_answer: Optional[Dict[str, Any]],
    q13_answer: Optional[Dict[str, Any]],
    q7_answer: Optional[Dict[str, Any]],
    entity_name: str,
    entity_type: str,
) -> Optional[Dict[str, Any]]:
    q13_state = _validation_state_for_answer(q13_answer or {})
    q7_state = _validation_state_for_answer(q7_answer or {})
    if q13_state not in {"validated", "partially_validated", "deterministic_detected", "provisional", "inferred"}:
        return None
    if q7_state not in {"validated", "partially_validated", "deterministic_detected", "provisional", "inferred"}:
        return None

    existing_q14_raw = _extract_raw_structured_output(q14_answer)
    if _has_readable_value(existing_q14_raw.get("best_service")) or _has_readable_value(existing_q14_raw.get("recommended_service")):
        return None

    q13_raw = _extract_raw_structured_output(q13_answer)
    q7_raw = _extract_raw_structured_output(q7_answer)
    top_gap = _coerce_text(q13_raw.get("top_gap"))
    gap_scorecard = q13_raw.get("gap_scorecard") if isinstance(q13_raw.get("gap_scorecard"), list) else []
    if not top_gap and gap_scorecard and isinstance(gap_scorecard[0], dict):
        top_gap = _coerce_text(gap_scorecard[0].get("capability"))
    if not top_gap:
        return None

    evidence_content: List[str] = [
        _coerce_text((q7_answer or {}).get("answer", {}).get("summary") if isinstance((q7_answer or {}).get("answer"), dict) else ""),
        _coerce_text(q7_raw.get("answer")),
        _coerce_text(q13_raw.get("answer")),
        _coerce_text(q13_raw.get("summary")),
        top_gap.replace("_", " "),
    ]
    q7_themes = q7_raw.get("themes") if isinstance(q7_raw.get("themes"), list) else []
    q13_themes = q13_raw.get("themes") if isinstance(q13_raw.get("themes"), list) else []
    q13_recommendations = q13_raw.get("recommendations") if isinstance(q13_raw.get("recommendations"), list) else []
    evidence_content.extend(_coerce_text(theme.get("theme") if isinstance(theme, dict) else theme) for theme in q7_themes)
    evidence_content.extend(_coerce_text(theme) for theme in q13_themes)
    evidence_content.extend(_coerce_text(item) for item in q13_recommendations)
    evidence = [{"content": " ".join(part for part in evidence_content if part)}]
    signal = {
        "signal_category": top_gap.replace("_", " "),
        "evidence": evidence,
        "confidence": max(float((q13_answer or {}).get("confidence") or 0.0), 0.6),
    }
    entity_context = {
        "name": entity_name,
        "type": entity_type,
    }
    yp_fit = score_yp_fit(signal, entity_context)
    service_alignment = yp_fit.get("service_alignment") if isinstance(yp_fit.get("service_alignment"), list) else []
    if not service_alignment:
        return None

    best_service = _coerce_text(service_alignment[0])
    summary = f"Yellow Panther fits best around {best_service} for {entity_name}, driven by the {top_gap.replace('_', ' ')} capability gap."
    return {
        "question_id": "q14_yp_fit",
        "question_type": "yp_fit",
        "status": "ready",
        "validation_state": "provisional",
        "confidence": max(float(yp_fit.get("fit_score") or 0.0) / 100.0, 0.6),
        "signal_type": "YP_FIT",
        "execution_class": "derived_inference",
        "answer": {
            "kind": "summary",
            "value": best_service,
            "summary": summary,
            "top_signals": [],
            "commercial_interpretation": {
                "summary": summary,
                "themes": [_coerce_text(top_gap)],
                "implication_strength": "medium",
            },
            "opportunity_hypotheses": [],
            "maturity_signal": None,
            "raw_structured_output": {
                "answer": summary,
                "summary": summary,
                "context": summary,
                "notes": summary,
                "validation_state": "provisional",
                "terminal_state": "answered",
                "blocked_by": [],
                "top_gap": top_gap,
                "best_service": best_service,
                "recommended_service": best_service,
                "service_alignment": service_alignment,
                "fit_score": yp_fit.get("fit_score"),
                "priority": yp_fit.get("priority"),
                "budget_alignment": yp_fit.get("budget_alignment"),
                "recommended_actions": yp_fit.get("recommended_actions") if isinstance(yp_fit.get("recommended_actions"), list) else [],
                "yp_advantages": yp_fit.get("yp_advantages") if isinstance(yp_fit.get("yp_advantages"), list) else [],
                "sources": [],
            },
            "terminal_state": "answered",
            "blocked_by": [],
        },
        "notes": summary,
    }


def _apply_synthesized_derived_answers(
    *,
    question_specs: List[Dict[str, Any]],
    answers: List[Dict[str, Any]],
    entity_name: str,
    entity_type: str,
) -> List[Dict[str, Any]]:
    answer_index: Dict[str, Dict[str, Any]] = {}
    for answer in answers:
        if not isinstance(answer, dict):
            continue
        question_id = str(answer.get("question_id") or "").strip()
        if question_id and question_id not in answer_index:
            answer_index[question_id] = dict(answer)

    synthesized_q14 = _synthesize_yp_fit_answer_record(
        q14_answer=answer_index.get("q14_yp_fit"),
        q13_answer=answer_index.get("q13_capability_gap"),
        q7_answer=answer_index.get("q7_procurement_signal"),
        entity_name=entity_name,
        entity_type=entity_type,
    )
    if synthesized_q14:
        answer_index["q14_yp_fit"] = synthesized_q14

    ordered_answers: List[Dict[str, Any]] = []
    for question in question_specs:
        question_id = str(question.get("question_id") or "").strip()
        if question_id and question_id in answer_index:
            ordered_answers.append(answer_index[question_id])
    for answer in answers:
        question_id = str(answer.get("question_id") or "").strip()
        if question_id and all(str(existing.get("question_id") or "").strip() != question_id for existing in ordered_answers):
            ordered_answers.append(answer_index[question_id])
    return ordered_answers


def _build_legacy_merged_questions(artifact: QuestionFirstRunArtifact) -> List[Dict[str, Any]]:
    merged_questions: List[Dict[str, Any]] = []
    synthesized_answers = _apply_synthesized_derived_answers(
        question_specs=artifact.questions or [],
        answers=artifact.answers or [],
        entity_name=str((artifact.entity or {}).get("entity_name") or ""),
        entity_type=str((artifact.entity or {}).get("entity_type") or ""),
    )
    answer_index = {
        str(answer.get("question_id") or "").strip(): dict(answer)
        for answer in synthesized_answers
        if isinstance(answer, dict) and str(answer.get("question_id") or "").strip()
    }

    for question in artifact.questions:
        if not isinstance(question, dict):
            continue
        question_copy = dict(question)
        question_id = str(question_copy.get("question_id") or "").strip()
        timing = artifact.question_timings.get(question_id) if isinstance(artifact.question_timings, dict) else {}
        if isinstance(timing, dict):
            question_copy.update({key: value for key, value in timing.items() if value is not None})
        raw_answer = answer_index.get(question_id)
        answer = _normalize_answer_record(raw_answer, question_copy) if isinstance(raw_answer, dict) else None
        if isinstance(answer, dict):
            answer_payload = {
                "question_id": answer.get("question_id"),
                "question_type": answer.get("question_type"),
                "answer": answer.get("answer"),
                "confidence": answer.get("confidence"),
                "validation_state": answer.get("validation_state"),
                "evidence_refs": answer.get("evidence_refs") or [],
                "signal_type": answer.get("signal_type"),
                "trace_ref": answer.get("trace_ref"),
                "notes": answer.get("notes"),
                "terminal_state": answer.get("terminal_state"),
                "terminal_summary": answer.get("terminal_summary"),
                "blocked_by": answer.get("blocked_by") or [],
                "timeout_salvage": answer.get("timeout_salvage"),
            }
            question_copy.update(
                {
                    "answer": (
                        answer.get("answer")
                        if isinstance(raw_answer, dict) and isinstance(raw_answer.get("answer"), dict)
                        else (raw_answer.get("answer") if isinstance(raw_answer, dict) else answer.get("answer"))
                    ),
                    "confidence": answer.get("confidence"),
                    "validation_state": answer.get("validation_state"),
                    "evidence_refs": answer.get("evidence_refs") or [],
                    "signal_type": answer.get("signal_type"),
                    "question_first_answer": answer_payload,
                    "terminal_state": answer.get("terminal_state"),
                    "terminal_summary": answer.get("terminal_summary"),
                    "blocked_by": answer.get("blocked_by") or [],
                }
            )
        merged_questions.append(question_copy)
    return merged_questions


def _merge_question_first_run_patch(
    *,
    dossier_payload: Dict[str, Any],
    artifact: QuestionFirstRunArtifact,
) -> Dict[str, Any]:
    payload = dict(dossier_payload or {})
    patch = artifact.merge_patch if isinstance(artifact.merge_patch, dict) else {}
    synthesized_answers = _apply_synthesized_derived_answers(
        question_specs=artifact.questions or [],
        answers=artifact.answers or [],
        entity_name=str((artifact.entity or {}).get("entity_name") or ""),
        entity_type=str((artifact.entity or {}).get("entity_type") or ""),
    )
    artifact_payload = artifact.model_dump()
    artifact_payload["answer_records"] = synthesized_answers

    metadata = payload.setdefault("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
        payload["metadata"] = metadata

    patch_metadata = patch.get("metadata") if isinstance(patch.get("metadata"), dict) else {}
    if isinstance(patch_metadata, dict):
        metadata.update(patch_metadata)

    if "question_first" in patch and isinstance(patch["question_first"], dict):
        payload["question_first"] = {
            **patch["question_first"],
            "answers": synthesized_answers if synthesized_answers else patch["question_first"].get("answers") or [],
        }

    payload["questions"] = _build_legacy_merged_questions(artifact)

    existing_question_first = payload.get("question_first") if isinstance(payload.get("question_first"), dict) else {}
    payload["question_first"] = {
        **existing_question_first,
        "schema_version": artifact.schema_version,
        "generated_at": artifact.generated_at,
        "run_rollup": artifact.run_rollup,
        "categories": artifact.categories,
        "answers": synthesized_answers,
        "question_timings": artifact.question_timings,
        "evidence_items": artifact.evidence_items,
        "promotion_candidates": artifact.promotion_candidates,
        "poi_graph": artifact.poi_graph,
        "questions_answered": len(synthesized_answers),
        **({"repair_run": getattr(artifact, "repair_run")} if getattr(artifact, "repair_run", None) else {}),
    }

    metadata.setdefault("question_first", {})
    if isinstance(metadata["question_first"], dict):
        metadata["question_first"] = {
            **metadata["question_first"],
            "schema_version": artifact.schema_version,
            "generated_at": artifact.generated_at,
            "questions_answered": len(synthesized_answers),
            "categories": artifact.categories,
            "question_timings": artifact.question_timings,
            "evidence_items": artifact.evidence_items,
            "promotion_candidates": artifact.promotion_candidates,
            "poi_graph": artifact.poi_graph,
            "question_source_path": artifact.question_source_path,
            "run_rollup": artifact.run_rollup,
            **({"repair_run": getattr(artifact, "repair_run")} if getattr(artifact, "repair_run", None) else {}),
        }

    payload["question_first_run"] = artifact_payload
    merged_dossier = payload.get("merged_dossier") if isinstance(payload.get("merged_dossier"), dict) else None
    if merged_dossier is not None:
        merged_dossier["questions"] = deepcopy(payload.get("questions") or [])
        merged_dossier["question_first"] = {
            **(merged_dossier.get("question_first") if isinstance(merged_dossier.get("question_first"), dict) else {}),
            **deepcopy(payload.get("question_first") or {}),
        }
        if isinstance(payload.get("metadata"), dict):
            merged_dossier["metadata"] = {
                **(merged_dossier.get("metadata") if isinstance(merged_dossier.get("metadata"), dict) else {}),
                "question_first": deepcopy((payload.get("metadata") or {}).get("question_first") or {}),
            }
        merged_dossier["question_first_run"] = deepcopy(artifact_payload)
    return payload


def merge_question_first_run_artifact_into_dossier(
    *,
    dossier_payload: Dict[str, Any],
    artifact: Dict[str, Any] | QuestionFirstRunArtifact,
) -> Dict[str, Any]:
    artifact_model = artifact if isinstance(artifact, QuestionFirstRunArtifact) else QuestionFirstRunArtifact.model_validate(artifact)
    return _merge_question_first_run_patch(dossier_payload=dossier_payload, artifact=artifact_model)


def _extract_question_first_repair(source_payload: Dict[str, Any]) -> Dict[str, Any]:
    metadata = source_payload.get("metadata") if isinstance(source_payload.get("metadata"), dict) else {}
    repair = metadata.get("question_first_repair") if isinstance(metadata.get("question_first_repair"), dict) else {}
    if not repair:
        return {}
    repaired_question_ids = repair.get("repaired_question_ids")
    if not isinstance(repaired_question_ids, list) or not repaired_question_ids:
        repaired_question_ids = [repair.get("question_id")] if repair.get("question_id") else []
    return {
        "mode": str(repair.get("mode") or "full").strip().lower() or "full",
        "question_id": str(repair.get("question_id") or "").strip() or None,
        "repaired_question_ids": [str(value).strip() for value in repaired_question_ids if str(value or "").strip()],
        "cascade_dependents": bool(repair.get("cascade_dependents", True)),
        "repair_source_run_id": str(repair.get("repair_source_run_id") or "").strip() or None,
        "repair_source_run_path": str(repair.get("repair_source_run_path") or "").strip() or None,
        "repair_source_dossier_path": str(repair.get("repair_source_dossier_path") or "").strip() or None,
    }


def _is_no_signal_validation_state(state: str) -> bool:
    return state in {"no_signal", "failed", "tool_call_missing", "exhausted", "skipped"}


def _is_provisional_validation_state(state: str) -> bool:
    return state in {"pending", "provisional", "partially_validated", "deterministic_detected", "inferred"}


def _dedupe_evidence_items(items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        key = json.dumps(item, sort_keys=True, default=str)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _recompute_run_rollup(question_specs: List[Dict[str, Any]], answer_records: List[Dict[str, Any]], artifact: QuestionFirstRunArtifact) -> Dict[str, Any]:
    provisional_count = 0
    validated_count = 0
    no_signal_count = 0
    for answer in answer_records:
        state = _validation_state_for_answer(answer)
        if state == "validated":
            validated_count += 1
        elif _is_no_signal_validation_state(state):
            no_signal_count += 1
        elif _is_provisional_validation_state(state):
            provisional_count += 1
    return {
        **(artifact.run_rollup if isinstance(artifact.run_rollup, dict) else {}),
        "questions_total": len(question_specs),
        "questions_validated": validated_count,
        "questions_no_signal": no_signal_count,
        "questions_provisional": provisional_count,
        "entity_id": (artifact.entity or {}).get("entity_id"),
        "entity_name": (artifact.entity or {}).get("entity_name"),
        "entity_type": (artifact.entity or {}).get("entity_type"),
        "preset": artifact.preset,
    }


def _merge_repair_artifact(
    *,
    base_artifact: QuestionFirstRunArtifact,
    repair_artifact: QuestionFirstRunArtifact,
    repair_context: Dict[str, Any],
) -> QuestionFirstRunArtifact:
    base_question_index = {
        str(question.get("question_id") or "").strip(): question
        for question in (base_artifact.questions or [])
        if isinstance(question, dict)
    }
    normalized_base_answers = [
        _normalize_answer_record(answer, base_question_index.get(str(answer.get("question_id") or "").strip()))
        for answer in (base_artifact.answers or [])
        if isinstance(answer, dict)
    ]
    repaired_question_ids = repair_context.get("repaired_question_ids") or [
        str(answer.get("question_id") or "").strip()
        for answer in repair_artifact.answers
        if isinstance(answer, dict) and str(answer.get("question_id") or "").strip()
    ]
    repaired_question_ids = [question_id for question_id in repaired_question_ids if question_id]

    base_payload = base_artifact.model_dump()
    base_payload["answer_records"] = normalized_base_answers
    question_specs = [
        question
        for question in (base_payload.get("question_specs") or [])
        if isinstance(question, dict)
    ]
    repair_question_specs = {
        str(question.get("question_id") or "").strip(): question
        for question in (repair_artifact.question_specs or [])
        if isinstance(question, dict) and str(question.get("question_id") or "").strip()
    }
    merged_question_specs = [
        repair_question_specs.get(str(question.get("question_id") or "").strip(), question)
        for question in question_specs
    ]

    base_answers = {
        str(answer.get("question_id") or "").strip(): answer
        for answer in (base_payload.get("answer_records") or [])
        if isinstance(answer, dict) and str(answer.get("question_id") or "").strip()
    }
    repair_answers = {
        str(answer.get("question_id") or "").strip(): answer
        for answer in (repair_artifact.answers or [])
        if isinstance(answer, dict) and str(answer.get("question_id") or "").strip()
    }
    base_answers.update(repair_answers)
    merged_answer_records = [
        base_answers[str(question.get("question_id") or "").strip()]
        for question in merged_question_specs
        if str(question.get("question_id") or "").strip() in base_answers
    ]
    merged_answer_records = _apply_synthesized_derived_answers(
        question_specs=merged_question_specs,
        answers=merged_answer_records,
        entity_name=str((repair_artifact.entity or {}).get("entity_name") or (base_artifact.entity or {}).get("entity_name") or ""),
        entity_type=str((repair_artifact.entity or {}).get("entity_type") or (base_artifact.entity or {}).get("entity_type") or ""),
    )

    merged_question_timings = _normalize_question_timings(base_artifact.question_timings)
    merged_question_timings.update(_normalize_question_timings(repair_artifact.question_timings))
    merged_evidence_items = _dedupe_evidence_items([*(base_artifact.evidence_items or []), *(repair_artifact.evidence_items or [])])
    merged_promotion_candidates = _dedupe_evidence_items([*(base_artifact.promotion_candidates or []), *(repair_artifact.promotion_candidates or [])])
    merged_categories = _build_category_summary(merged_answer_records)

    merged_payload = {
        **base_payload,
        "generated_at": repair_artifact.generated_at,
        "status": repair_artifact.status,
        "question_specs": merged_question_specs,
        "answer_records": merged_answer_records,
        "question_timings": merged_question_timings,
        "evidence_items": merged_evidence_items,
        "promotion_candidates": merged_promotion_candidates,
        "categories": merged_categories,
        "run_rollup": _recompute_run_rollup(merged_question_specs, merged_answer_records, base_artifact),
        "repair_run": {
            "mode": "question",
            "repaired_question_ids": repaired_question_ids,
            "question_id": repair_context.get("question_id"),
            "cascade_dependents": bool(repair_context.get("cascade_dependents", True)),
            "repair_timestamp": repair_artifact.generated_at,
            "repair_source_run_id": repair_context.get("repair_source_run_id"),
            "repair_source_run_path": repair_context.get("repair_source_run_path"),
            "repair_artifact_run_id": repair_artifact.run_id,
        },
    }
    return QuestionFirstRunArtifact.model_validate(merged_payload)


def _artifact_output_path(output_dir: Path, source_payload: Dict[str, Any], artifact: QuestionFirstRunArtifact | None = None) -> Path:
    entity_name = str(
        (artifact.entity if artifact else source_payload).get("entity_name")
        or source_payload.get("entity_name")
        or source_payload.get("entity_id")
        or "entity"
    )
    entity_id = str(
        (artifact.entity if artifact else source_payload).get("entity_id")
        or source_payload.get("entity_id")
        or _slugify(entity_name)
    )
    suffix = "question_first_run_v2.json"
    return output_dir / f"{_slugify(entity_id)}_{suffix}"


def _find_existing_question_first_run_artifact(output_dir: Path, source_payload: Dict[str, Any]) -> Optional[Path]:
    canonical_path = _artifact_output_path(output_dir, source_payload)
    if canonical_path.exists():
        return canonical_path
    candidates = sorted(
        list(output_dir.glob("*_question_first_run_v2.json")) + list(output_dir.glob("*_question_first_run_v1.json")),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def _find_existing_question_first_dossier_artifact(output_dir: Path) -> Optional[Path]:
    canonical_candidates = sorted(
        output_dir.glob("*_question_first_dossier.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return canonical_candidates[0] if canonical_candidates else None


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _extract_report_publish_metrics(payload: Dict[str, Any]) -> Dict[str, Any]:
    merged_dossier = payload.get("merged_dossier") if isinstance(payload.get("merged_dossier"), dict) else {}
    question_first = merged_dossier.get("question_first") if isinstance(merged_dossier.get("question_first"), dict) else {}
    metadata_question_first = merged_dossier.get("metadata", {}).get("question_first") if isinstance(merged_dossier.get("metadata"), dict) and isinstance(merged_dossier.get("metadata", {}).get("question_first"), dict) else {}
    run_rollup = payload.get("run_rollup") if isinstance(payload.get("run_rollup"), dict) else {}
    answer_records = merged_dossier.get("question_first_run", {}).get("answer_records") if isinstance(merged_dossier.get("question_first_run"), dict) else []
    answers = answer_records if isinstance(answer_records, list) else []
    no_signal_count = sum(
        1
        for answer in answers
        if str((answer or {}).get("validation_state") or "").strip().lower() in {"no_signal", "failed", "tool_call_missing", "exhausted"}
    )
    return {
        "questions_answered": _coerce_int(payload.get("questions_answered"), _coerce_int(question_first.get("questions_answered"), len(answers))),
        "questions_validated": _coerce_int(run_rollup.get("questions_validated")),
        "questions_no_signal": _coerce_int(run_rollup.get("questions_no_signal"), no_signal_count),
        "generated_at": _coerce_text(payload.get("generated_at") or merged_dossier.get("generated_at")),
        "checkpoint_consistent": bool(
            question_first.get("checkpoint_consistent")
            if question_first.get("checkpoint_consistent") is not None
            else metadata_question_first.get("checkpoint_consistent", True)
        ),
        "non_terminal_question_ids": (
            question_first.get("non_terminal_question_ids")
            if isinstance(question_first.get("non_terminal_question_ids"), list)
            else metadata_question_first.get("non_terminal_question_ids")
            if isinstance(metadata_question_first.get("non_terminal_question_ids"), list)
            else []
        ),
    }


def _publish_rank(metrics: Dict[str, Any]) -> Tuple[int, int, int, float]:
    generated_at = _parse_iso_timestamp(metrics.get("generated_at")) or 0.0
    return (
        _coerce_int(metrics.get("questions_answered")),
        _coerce_int(metrics.get("questions_validated")),
        -_coerce_int(metrics.get("questions_no_signal")),
        generated_at,
    )


def _derive_dossier_quality_summary(*, merged_dossier: Dict[str, Any], expected_question_count: int) -> Dict[str, Any]:
    def _is_non_blocking_question(question: Dict[str, Any]) -> bool:
        summary = _coerce_text(question.get("terminal_summary") or question.get("question_first_answer", {}).get("terminal_summary"))
        return "entity type" in summary.lower() and "is outside" in summary.lower()

    questions = merged_dossier.get("questions") if isinstance(merged_dossier.get("questions"), list) else []
    normalized_questions = [question for question in questions if isinstance(question, dict)]
    answered_questions = [
        question
        for question in normalized_questions
        if _coerce_text(question.get("terminal_state") or question.get("question_first_answer", {}).get("terminal_state")).lower() == "answered"
    ]
    blocked_questions = [
        question
        for question in normalized_questions
        if _coerce_text(question.get("terminal_state") or question.get("question_first_answer", {}).get("terminal_state")).lower() == "blocked"
    ]
    skipped_questions = [
        question
        for question in normalized_questions
        if _coerce_text(question.get("terminal_state") or question.get("question_first_answer", {}).get("terminal_state")).lower() == "skipped"
    ]
    non_blocking_questions = [question for question in blocked_questions if _is_non_blocking_question(question)]
    blocking_questions = [question for question in blocked_questions if not _is_non_blocking_question(question)]
    satisfied_questions = answered_questions + non_blocking_questions + skipped_questions
    missing_count = max(expected_question_count - len(normalized_questions), 0)
    quality_state = "complete"
    quality_summary = "Complete dossier: the persisted artifact includes the full expected question pack."
    quality_blockers: List[str] = []
    if len(normalized_questions) < max(expected_question_count, 1):
        quality_state = "partial"
        quality_summary = f"Partial dossier: only {len(normalized_questions)} of {expected_question_count} expected questions are present."
        quality_blockers.append(f"{missing_count} expected questions are still missing.")
    elif blocking_questions:
        quality_state = "blocked"
        quality_summary = "Blocked dossier: the persisted artifact exists, but downstream questions are still unresolved."
        quality_blockers.extend(
            [
                _coerce_text(question.get("terminal_summary") or question.get("question_first_answer", {}).get("terminal_summary"))
                for question in blocking_questions
                if _coerce_text(question.get("terminal_summary") or question.get("question_first_answer", {}).get("terminal_summary"))
            ]
        )
    elif len(satisfied_questions) < max(expected_question_count, 1):
        quality_state = "partial"
        quality_summary = f"Partial dossier: only {len(satisfied_questions)} of {expected_question_count} expected questions reached answered or non-applicable state."
        quality_blockers.append(f"{expected_question_count - len(satisfied_questions)} questions are present but still unresolved.")
    return {
        "quality_state": quality_state,
        "quality_summary": quality_summary,
        "quality_blockers": quality_blockers,
    }


def _expected_publish_question_count(*, source_payload: Dict[str, Any], artifact: QuestionFirstRunArtifact) -> int:
    source_questions = source_payload.get("questions") if isinstance(source_payload.get("questions"), list) else []
    source_count = len(source_questions)
    artifact_count = len(artifact.questions or [])
    known_count = max(source_count, artifact_count)
    if known_count > 0:
        return known_count
    return DEFAULT_MIN_PUBLISH_QUESTION_COUNT


def _should_publish_dossier_report(
    *,
    staged_payload: Dict[str, Any],
    existing_payload: Optional[Dict[str, Any]],
    min_question_count: int,
) -> bool:
    staged_metrics = _extract_report_publish_metrics(staged_payload)
    if not staged_metrics["checkpoint_consistent"]:
        return False
    if staged_metrics["non_terminal_question_ids"]:
        return False
    if staged_metrics["questions_answered"] < max(min_question_count, 1):
        return False
    if existing_payload is None:
        return True
    existing_metrics = _extract_report_publish_metrics(existing_payload)
    return _publish_rank(staged_metrics) >= _publish_rank(existing_metrics)


def _read_json_if_exists(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _publish_question_first_dossier_reports(
    *,
    output_dir: Path,
    entity_id: str,
    json_payload: Dict[str, Any],
    plain_text_report: str,
    min_question_count: int,
) -> Dict[str, Any]:
    slug = _slugify(entity_id)
    staged_json_path = output_dir / f"{slug}_question_first_dossier.staged.json"
    staged_txt_path = output_dir / f"{slug}_question_first_dossier.staged.txt"
    published_json_path = output_dir / f"{slug}_question_first_dossier.json"
    published_txt_path = output_dir / f"{slug}_question_first_dossier.txt"

    staged_payload = dict(json_payload)
    staged_payload["publish_status"] = "staged"
    staged_json_path.write_text(json.dumps(staged_payload, indent=2, default=str), encoding="utf-8")
    staged_txt_path.write_text(plain_text_report, encoding="utf-8")

    existing_payload = _read_json_if_exists(published_json_path)
    should_publish = _should_publish_dossier_report(
        staged_payload=staged_payload,
        existing_payload=existing_payload,
        min_question_count=min_question_count,
    )
    publish_status = "staged"

    if should_publish:
        published_payload = dict(staged_payload)
        published_payload["publish_status"] = "published"
        staged_json_path.write_text(json.dumps(published_payload, indent=2, default=str), encoding="utf-8")
        os.replace(staged_json_path, published_json_path)
        os.replace(staged_txt_path, published_txt_path)
        publish_status = "published"

    return {
        "publish_status": publish_status,
        "staged_json_report_path": str(staged_json_path),
        "staged_plain_text_path": str(staged_txt_path),
        "json_report_path": str(published_json_path if should_publish else staged_json_path),
        "plain_text_path": str(published_txt_path if should_publish else staged_txt_path),
        "published_json_report_path": str(published_json_path) if should_publish else (str(published_json_path) if published_json_path.exists() else None),
        "published_plain_text_path": str(published_txt_path) if should_publish else (str(published_txt_path) if published_txt_path.exists() else None),
    }


def _question_first_resume_attempt_limit() -> int:
    raw_value = os.getenv("QUESTION_FIRST_RESUME_ATTEMPTS") or "2"
    return max(_coerce_int(raw_value, 2), 0)


def _should_retry_question_first_launch(
    *,
    state_payload: Dict[str, Any],
    timeout_classification: Optional[str] = None,
    attempt: int = 0,
    max_resume_attempts: int = 0,
) -> bool:
    if attempt >= max_resume_attempts:
        return False
    failure_category = _coerce_text(state_payload.get("failure_category")).lower()
    retryable = bool(state_payload.get("retryable"))
    run_phase = _coerce_text(state_payload.get("run_phase")).lower()
    if retryable and failure_category not in {"infrastructure_failure", "parser_failure"}:
        return True
    if timeout_classification in {"stalled", "completed_not_harvested"}:
        return failure_category != "infrastructure_failure"
    return run_phase in {"retryable_failure", "stalled", "question_runner_timeout", "resume_needed"} or failure_category == "checkpoint_inconsistency"


def has_complete_question_first_artifacts(
    *,
    output_dir: Path,
    source_payload: Dict[str, Any],
    preset: Optional[str] = None,
) -> bool:
    artifact_path = _find_existing_question_first_run_artifact(output_dir, source_payload)
    if artifact_path is None:
        return False
    dossier_path = _find_existing_question_first_dossier_artifact(output_dir)
    return artifact_path.exists() and dossier_path is not None and dossier_path.exists()


async def _launch_opencode_question_first_batch(
    *,
    source_payload: Dict[str, Any],
    output_dir: Path,
    preset: Optional[str] = None,
    worktree_root: Optional[Path] = None,
    opencode_timeout_ms: int = 300000,
    max_resume_attempts: Optional[int] = None,
) -> Tuple[Path, Optional[Path]]:
    backend_root = Path(__file__).resolve().parent
    app_root = backend_root.parent
    script_path = app_root / "scripts" / "opencode_agentic_batch.mjs"
    worktree_root = _resolve_question_first_worktree_root(worktree_root)
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as temp_source:
        json.dump(source_payload, temp_source, indent=2, default=str)
        temp_source_path = Path(temp_source.name)

    try:
        with _acquire_question_first_launch_lock(worktree_root):
            state_path = _build_question_first_state_path(
                output_dir=output_dir,
                source_payload=source_payload,
                preset=preset,
            )
            batch_timeout_ms = _derive_question_first_batch_timeout_ms(
                source_payload=source_payload,
                opencode_timeout_ms=opencode_timeout_ms,
            )
            max_resume_attempts = _question_first_resume_attempt_limit() if max_resume_attempts is None else max(max_resume_attempts, 0)
            attempt = 0
            should_resume = False

            while True:
                command = [
                    "node",
                    str(script_path),
                    "--question-source",
                    str(temp_source_path),
                    "--output-dir",
                    str(output_dir),
                    "--opencode-timeout-ms",
                    str(opencode_timeout_ms),
                ]
                if preset:
                    command.extend(["--preset", preset])
                if should_resume:
                    command.append("--resume")

                proc = subprocess.Popen(
                    command,
                    cwd=str(worktree_root),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=dict(os.environ),
                )
                deadline = time.monotonic() + max(batch_timeout_ms, 1) / 1000.0
                stdout_text = ""
                stderr_text = ""
                result: Dict[str, Any] = {}
                last_state_payload: Dict[str, Any] = {}
                last_progress_mtime: Optional[float] = None

                while time.monotonic() <= deadline:
                    if state_path.exists():
                        try:
                            state_payload = json.loads(state_path.read_text(encoding="utf-8"))
                        except Exception:
                            state_payload = {}
                        last_state_payload = state_payload if isinstance(state_payload, dict) else {}
                        try:
                            current_mtime = state_path.stat().st_mtime
                        except OSError:
                            current_mtime = None
                        if current_mtime is not None and current_mtime != last_progress_mtime:
                            last_progress_mtime = current_mtime
                        if str(state_payload.get("run_phase") or "").strip().lower() == "completed":
                            if state_payload.get("checkpoint_consistent") is False or state_payload.get("non_terminal_question_ids"):
                                if _should_retry_question_first_launch(
                                    state_payload=last_state_payload,
                                    attempt=attempt,
                                    max_resume_attempts=max_resume_attempts,
                                ):
                                    attempt += 1
                                    should_resume = True
                                    break
                                raise RuntimeError(
                                    "OpenCode batch reported completed with an inconsistent checkpoint"
                                )
                            stdout_text, stderr_text = await _terminate_process(proc)
                            result = _parse_opencode_batch_stdout(stdout_text)
                            question_first_run_path = result.get("question_first_run_path") or state_payload.get("question_first_run_path")
                            if question_first_run_path:
                                return Path(str(question_first_run_path)), state_path
                            artifact_path = _find_existing_question_first_run_artifact(output_dir, source_payload)
                            if artifact_path is not None:
                                return artifact_path, state_path
                            raise CompletedWithoutArtifactError(
                                "OpenCode batch reached completed state without producing a canonical question_first_run artifact"
                            )

                    returncode = proc.poll()
                    if returncode is not None:
                        stdout_text, stderr_text = await asyncio.to_thread(proc.communicate)
                        result = _parse_opencode_batch_stdout(stdout_text)
                        if returncode != 0:
                            if _should_retry_question_first_launch(
                                state_payload=last_state_payload,
                                attempt=attempt,
                                max_resume_attempts=max_resume_attempts,
                            ):
                                attempt += 1
                                should_resume = True
                                break
                            raise RuntimeError(
                                "OpenCode question-first batch failed with exit code "
                                f"{returncode}: {stderr_text.strip() or stdout_text.strip()}"
                            )
                        question_first_run_path = result.get("question_first_run_path")
                        state_path = Path(result.get("state_path") or state_path)
                        if question_first_run_path:
                            return Path(str(question_first_run_path)), state_path
                        artifact_path = _find_existing_question_first_run_artifact(output_dir, source_payload)
                        if artifact_path is not None:
                            return artifact_path, state_path
                        raise CompletedWithoutArtifactError(
                            "OpenCode batch completed without producing a canonical question_first_run artifact"
                        )

                    await asyncio.sleep(0.25)
                else:
                    stdout_text, stderr_text = await _terminate_process(proc)
                    timeout_classification = _classify_question_first_batch_timeout(
                        state_payload=last_state_payload,
                        state_path=state_path,
                        last_progress_mtime=last_progress_mtime,
                    )
                    if _should_retry_question_first_launch(
                        state_payload=last_state_payload,
                        timeout_classification=timeout_classification,
                        attempt=attempt,
                        max_resume_attempts=max_resume_attempts,
                    ):
                        attempt += 1
                        should_resume = True
                        continue
                    raise TimeoutError(
                        "Timed out waiting for OpenCode question-first batch to complete "
                        f"at {state_path} ({timeout_classification}): {stderr_text.strip() or stdout_text.strip()}"
                    )
                continue
    finally:
        try:
            temp_source_path.unlink(missing_ok=True)
        except Exception:
            pass


def _load_question_source(question_source_path: Path) -> Dict[str, Any]:
    payload = json.loads(question_source_path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        return payload
    raise ValueError("question_source_path must point to a JSON dossier object")


def _question_list_from_payload(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    questions = payload.get("questions") or []
    if not isinstance(questions, list):
        raise ValueError("dossier JSON questions field must be a list")
    return [q for q in questions if isinstance(q, dict)]


def _question_search_hints(question: Dict[str, Any], entity_name: str) -> List[str]:
    question_text = str(question.get("question_text") or "").strip().rstrip("?")
    section_id = str(question.get("section_id") or "").strip().lower()
    text = question_text.lower()
    entity_prefix = f'"{entity_name}"' if entity_name else ""

    hints: List[str] = []

    def add(*parts: str) -> None:
        query = " ".join(part for part in parts if part).strip()
        if query and query not in hints:
            hints.append(query)

    if "mobile app" in text or "fan engagement platform" in text:
        add(entity_prefix, "mobile app")
        add(entity_prefix, "fan app")
        add(entity_prefix, "official app")
        add(entity_prefix, "fan engagement platform")
        add(entity_prefix, "React Native")
    elif "ticketing" in text or "e-commerce" in text or "ecommerce" in text:
        add(entity_prefix, "ticketing system")
        add(entity_prefix, "e-commerce platform")
        add(entity_prefix, "mobile ticketing")
        add(entity_prefix, "checkout")
        add(entity_prefix, "fan engagement platform")
    elif "digital transformation" in text or "modernization" in text or "modernisation" in text:
        add(entity_prefix, "digital transformation")
        add(entity_prefix, "modernization")
        add(entity_prefix, "cloud migration")
        add(entity_prefix, "technology stack")
    elif "analytics" in text or "data platform" in text or "fan insights" in text:
        add(entity_prefix, "analytics platform")
        add(entity_prefix, "data platform")
        add(entity_prefix, "crm platform")
        add(entity_prefix, "fan insights")

    if section_id in {"core_information", "contact_information"}:
        if "found" in text or "founded" in text:
            add(entity_prefix, "founded")
        if "stadium" in text or "venue" in text:
            add(entity_prefix, "stadium")
            add(entity_prefix, "Elland Road")
        if "website" in text or "url" in text:
            add(entity_prefix, "official website")
        if "country" in text or "sport" in text or "league" in text:
            add(entity_prefix, "club")
            add(entity_prefix, "league")
        if "headquarters" in text or "address" in text or "postal" in text:
            add(entity_prefix, "headquarters")
            add(entity_prefix, "address")
        add(entity_prefix, "official site")
    elif section_id == "quick_actions":
        if "fiscal year" in text or "year end" in text:
            add(entity_prefix, "annual report")
            add(entity_prefix, "financial year end")
            add(entity_prefix, "accounts")
        if "budget" in text or "spend" in text or "transfer" in text or "recruitment" in text:
            add(entity_prefix, "transfer budget")
            add(entity_prefix, "recruitment budget")
            add(entity_prefix, "annual report")
            add(entity_prefix, "financials")
        if "procurement" in text or "decision-maker" in text or "decision maker" in text or "who" in text:
            add(entity_prefix, "chairman")
            add(entity_prefix, "director")
            add(entity_prefix, "board")
            add(entity_prefix, "owner")
        if "procurement" in text or "tender" in text or "rfp" in text:
            add(entity_prefix, "tender")
            add(entity_prefix, "RFP")
            add(entity_prefix, "procurement")
        add(entity_prefix, "official site")
    elif section_id in {"recent_news", "challenges_opportunities", "outreach_strategy"}:
        if "news" in text or "recent" in text:
            add(entity_prefix, "news")
            add(entity_prefix, "press release")
        if "partnership" in text or "commercial" in text:
            add(entity_prefix, "commercial partnership")
        if "stadium" in text or "upgrade" in text:
            add(entity_prefix, "stadium")
            add(entity_prefix, "project")
        if "leadership" in text or "ownership" in text:
            add(entity_prefix, "ownership")
            add(entity_prefix, "chairman")
    elif section_id in {"leadership", "digital_maturity", "ai_reasoner_assessment"}:
        if "leadership" in text or "chairman" in text or "ceo" in text:
            add(entity_prefix, "chairman")
            add(entity_prefix, "ceo")
            add(entity_prefix, "director")
        if "crm" in text or "analytics" in text or "cms" in text or "technology" in text or "stack" in text:
            add(entity_prefix, "crm")
            add(entity_prefix, "analytics")
            add(entity_prefix, "cms")
        if "ai" in text:
            add(entity_prefix, "AI")
            add(entity_prefix, "data strategy")
        add(entity_prefix, "official site")
    elif section_id in {"strategic_analysis", "connections"}:
        if "partnership" in text or "connections" in text:
            add(entity_prefix, "partners")
            add(entity_prefix, "sponsors")
        if "commercial" in text or "strategy" in text:
            add(entity_prefix, "commercial")
            add(entity_prefix, "strategy")
        add(entity_prefix, "official site")

    if not hints:
        add(entity_prefix, question_text)
    return hints


def _search_queries_for_question(question: Dict[str, Any], entity_name: str) -> List[str]:
    question_text = str(question.get("question_text") or "").strip().rstrip("?")
    entity_prefix = f'"{entity_name}" ' if entity_name else ""
    derived_query = f"{entity_prefix}{question_text}".strip()

    search_strategy = question.get("search_strategy") or {}
    strategy_queries = search_strategy.get("search_queries") or []
    queries = _question_search_hints(question, entity_name)
    if derived_query and derived_query not in queries:
        queries.append(derived_query)
    queries.extend(str(q).strip() for q in strategy_queries if str(q).strip())

    deduped: List[str] = []
    seen = set()
    for query in queries:
        if query and query not in seen:
            deduped.append(query)
            seen.add(query)
    return deduped


def _retry_query_for_question(question: Dict[str, Any], entity_name: str) -> str:
    question_text = str(question.get("question_text") or "").strip().rstrip("?")
    section_id = str(question.get("section_id") or "").strip().lower()
    category_suffix = {
        "core_information": "official site",
        "contact_information": "official site contact",
        "leadership": "official site chairman director",
        "quick_actions": "official site procurement",
        "recent_news": "news press release",
        "digital_maturity": "official site analytics crm",
        "ai_reasoner_assessment": "official site analytics ai",
        "challenges_opportunities": "news official site",
        "outreach_strategy": "press release official site",
        "strategic_analysis": "official site strategy",
        "connections": "official site partners",
    }.get(section_id, "official site")
    parts = [f'"{entity_name}"' if entity_name else "", question_text, category_suffix]
    return " ".join(part for part in parts if part).strip()


def _category_for_section(section_id: str) -> str:
    section = str(section_id or "").strip().lower()
    mapping = {
        "core_information": "identity",
        "contact_information": "identity",
        "leadership": "leadership",
        "quick_actions": "procurement_opportunity",
        "recent_news": "news_signals",
        "digital_maturity": "digital_maturity",
        "ai_reasoner_assessment": "digital_maturity",
        "challenges_opportunities": "strategy",
        "outreach_strategy": "strategy",
        "strategic_analysis": "strategy",
        "connections": "connections",
    }
    return mapping.get(section, "general")


def _build_category_summary(answers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    summary: Dict[str, Dict[str, Any]] = {}
    for answer in answers:
        category = _category_for_section(answer.get("section_id"))
        bucket = summary.setdefault(
            category,
            {
                "category": category,
                "question_count": 0,
                "validated_count": 0,
                "pending_count": 0,
                "no_signal_count": 0,
                "retry_count": 0,
            },
        )
        bucket["question_count"] += 1
        bucket["retry_count"] += int(answer.get("retry_count") or 0)
        state = _validation_state_for_answer(answer)
        if state == "validated":
            bucket["validated_count"] += 1
        elif state in {"pending", "provisional", "partially_validated", "deterministic_detected", "inferred"}:
            bucket["pending_count"] += 1
        else:
            bucket["no_signal_count"] += 1
    return list(summary.values())


def build_question_first_durable_batch_metrics(
    *,
    artifact: QuestionFirstRunArtifact,
    output_dir: Optional[Path] = None,
    connections_graph_enrichment_enabled: bool = False,
    connections_graph_enrichment_status: str = "optional",
) -> Dict[str, Any]:
    answers = _apply_synthesized_derived_answers(
        question_specs=[question for question in artifact.questions if isinstance(question, dict)],
        answers=[answer for answer in artifact.answers if isinstance(answer, dict)],
        entity_name=str((artifact.entity or {}).get("entity_name") or ""),
        entity_type=str((artifact.entity or {}).get("entity_type") or ""),
    )
    questions = [question for question in artifact.questions if isinstance(question, dict)]
    answer_index: Dict[str, Dict[str, Any]] = {}
    for answer in answers:
        question_id = str(answer.get("question_id") or "").strip()
        if question_id:
            answer_index[question_id] = answer

    validation_by_question: Dict[str, Dict[str, int]] = {}
    validation_by_entity_type: Dict[str, Dict[str, int]] = {}
    deterministic_path_counts: Dict[str, int] = {}
    retrieval_path_counts: Dict[str, int] = {}

    entity_type = str((artifact.entity or {}).get("entity_type") or "").strip() or "unknown"
    entity_bucket = validation_by_entity_type.setdefault(
        entity_type,
        {"validated": 0, "no_signal": 0, "provisional": 0, "pending": 0},
    )

    for question in questions:
        question_id = str(question.get("question_id") or "").strip()
        if not question_id:
            continue
        answer = answer_index.get(question_id, {})
        state = str(answer.get("validation_state") or "").strip().lower() or "no_signal"
        if state not in {"validated", "no_signal", "provisional", "pending"}:
            state = "pending"
        question_bucket = validation_by_question.setdefault(
            question_id,
            {"validated": 0, "no_signal": 0, "provisional": 0, "pending": 0},
        )
        question_bucket[state] += 1
        entity_bucket[state] += 1
        if question.get("deterministic_tools"):
            deterministic_path_counts[question_id] = deterministic_path_counts.get(question_id, 0) + 1
        else:
            retrieval_path_counts[question_id] = retrieval_path_counts.get(question_id, 0) + 1

    question_runtime_seconds: Dict[str, float] = {}
    contract_question_timings = _normalize_question_timings(getattr(artifact, "question_timings", {}))
    if contract_question_timings:
        for question in questions:
            question_id = str(question.get("question_id") or "").strip()
            if not question_id:
                continue
            question_timing = contract_question_timings.get(question_id)
            if not question_timing:
                continue
            duration_value = question_timing.get("duration_seconds")
            if duration_value is None and question_timing.get("started_at") and question_timing.get("completed_at"):
                duration_value = _seconds_between(question_timing["started_at"], question_timing["completed_at"])
            if duration_value is None:
                continue
            try:
                question_runtime_seconds[question_id] = round(float(duration_value), 3)
            except (TypeError, ValueError):
                continue

    if output_dir is not None and questions:
        output_path = Path(output_dir)
        question_paths = sorted(
            [
                path
                for path in output_path.glob("*_question_*.json")
                if "question_first" not in path.name
            ],
            key=lambda path: (path.stat().st_mtime, path.name),
        )
        start_ts = _parse_iso_timestamp(artifact.run_started_at)
        previous_ts = start_ts
        legacy_question_runtime_seconds: Dict[str, float] = {}
        for question, path in zip(questions, question_paths):
            question_id = str(question.get("question_id") or "").strip()
            if not question_id:
                continue
            current_ts = path.stat().st_mtime
            if previous_ts is None:
                duration = 0.0
            else:
                duration = round(max(current_ts - previous_ts, 0.0), 3)
            legacy_question_runtime_seconds[question_id] = duration
            previous_ts = current_ts
        for question_id, duration in legacy_question_runtime_seconds.items():
            question_runtime_seconds.setdefault(question_id, duration)

    return {
        "entity_runtime_seconds": _seconds_between(artifact.run_started_at, artifact.generated_at),
        "question_runtime_seconds": question_runtime_seconds,
        "validation_by_question": validation_by_question,
        "validation_by_entity_type": validation_by_entity_type,
        "deterministic_path_counts": deterministic_path_counts,
        "retrieval_path_counts": retrieval_path_counts,
        "baseline_features": {
            "enrichment_enabled": bool(connections_graph_enrichment_enabled),
            "connections_graph_enrichment_enabled": bool(connections_graph_enrichment_enabled),
            "connections_graph_enrichment_status": connections_graph_enrichment_status,
            "question_first_enabled": True,
        },
    }


def _validation_state_for_answer(answer: Dict[str, Any]) -> str:
    explicit_state = str(answer.get("validation_state") or "").strip().lower()
    if explicit_state:
        if explicit_state in {"validated", "partially_validated", "deterministic_detected", "provisional", "inferred", "failed", "no_signal", "pending", "skipped"}:
            return explicit_state
        if explicit_state in {"tool_call_missing", "exhausted"}:
            return "no_signal"
    if not answer.get("search_hit"):
        return "no_signal"
    confidence = float(answer.get("confidence") or 0.0)
    if confidence >= 0.5:
        return "validated"
    return "pending"


def _normalize_question_timings(question_timings: Any) -> Dict[str, Dict[str, Any]]:
    normalized: Dict[str, Dict[str, Any]] = {}
    if not isinstance(question_timings, dict):
        return normalized
    for question_id, timing in question_timings.items():
        if not question_id or not isinstance(timing, dict):
            continue
        entry: Dict[str, Any] = {}
        started_at = str(timing.get("started_at") or "").strip()
        completed_at = str(timing.get("completed_at") or "").strip()
        duration_seconds = timing.get("duration_seconds")
        if started_at:
            entry["started_at"] = started_at
        if completed_at:
            entry["completed_at"] = completed_at
        if duration_seconds is not None:
            try:
                entry["duration_seconds"] = round(float(duration_seconds), 3)
            except (TypeError, ValueError):
                pass
        if entry:
            normalized[str(question_id)] = entry
    return normalized


def _render_plain_text_report(report: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append(f"Question-First Dossier: {report.get('entity_name')}")
    lines.append(f"Generated at: {report.get('generated_at')}")
    lines.append(f"Source dossier: {report.get('question_source_path')}")
    lines.append("")
    lines.append(f"Questions answered: {report.get('questions_answered', 0)}")
    lines.append("")

    for idx, answer in enumerate(report.get("answers") or [], start=1):
        lines.append(f"{idx}. {answer.get('question_text')}")
        lines.append(f"   Search query: {answer.get('search_query')}")
        lines.append(f"   Search hit: {answer.get('search_hit')}")
        lines.append(f"   Search results: {answer.get('search_results_count')}")
        lines.append(f"   Scrape URL: {answer.get('scrape_url')}")
        lines.append(f"   Answer: {answer.get('answer')}")
        lines.append(f"   Confidence: {answer.get('confidence')}")
        lines.append(f"   Category: {answer.get('category')}")
        lines.append(f"   Retry count: {answer.get('retry_count')}")
        lines.append("")

    if report.get("categories"):
        lines.append("Category summary:")
        for category in report.get("categories") or []:
            lines.append(
                f"- {category.get('category')}: questions={category.get('question_count')}, "
                f"validated={category.get('validated_count')}, pending={category.get('pending_count')}, "
                f"no_signal={category.get('no_signal_count')}, retries={category.get('retry_count')}"
            )

    return "\n".join(lines).rstrip() + "\n"


async def _answer_question(
    question: Dict[str, Any],
    *,
    entity_name: str,
    brightdata_client: BrightDataMCPClient,
    claude_client: ClaudeClient,
) -> Dict[str, Any]:
    search_queries = _search_queries_for_question(question, entity_name)
    search_attempts: List[Dict[str, Any]] = []
    search_results: List[Dict[str, Any]] = []
    scrape: Dict[str, Any] = {}
    scrape_url: Optional[str] = None
    search_query_used: Optional[str] = None
    retry_count = 0

    for query in search_queries:
        search = await brightdata_client.search_engine(query, engine="google")
        result_count = len(search.get("results", []) or [])
        search_attempts.append(
            {
                "query": query,
                "status": search.get("status"),
                "result_count": result_count,
            }
        )
        if result_count > 0:
            search_query_used = query
            search_results = [
                {
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "snippet": item.get("snippet"),
                }
                for item in (search.get("results") or [])[:5]
            ]
            scrape_url = str((search.get("results") or [{}])[0].get("url") or "").strip() or None
            break

    if not scrape_url:
        retry_count = 1
        retry_query = _retry_query_for_question(question, entity_name)
        search = await brightdata_client.search_engine(retry_query, engine="google")
        result_count = len(search.get("results", []) or [])
        search_attempts.append(
            {
                "query": retry_query,
                "status": search.get("status"),
                "result_count": result_count,
                "retry": True,
            }
        )
        if result_count > 0:
            search_query_used = retry_query
            search_results = [
                {
                    "title": item.get("title"),
                    "url": item.get("url"),
                    "snippet": item.get("snippet"),
                }
                for item in (search.get("results") or [])[:5]
            ]
            scrape_url = str((search.get("results") or [{}])[0].get("url") or "").strip() or None

    if scrape_url:
        scrape = await brightdata_client.scrape_as_markdown(scrape_url)
        scrape_content = str(scrape.get("content") or "")
        evidence_excerpt = scrape_content[:4000]
        reasoning_prompt = (
            "You are answering a dossier question using BrightData MCP evidence.\n"
            "Answer only in JSON with keys: answer, confidence, evidence_url.\n"
            f"Entity: {entity_name}\n"
            f"Question: {question.get('question_text')}\n"
            f"Evidence URL: {scrape_url}\n"
            f"Evidence excerpt: {evidence_excerpt}\n"
        )
        reasoning = await claude_client.query(
            prompt=reasoning_prompt,
            model="judge",
            max_tokens=400,
            json_mode=True,
        )
        structured = reasoning.get("structured_output") or {}
        answer_text = structured.get("answer")
        confidence = structured.get("confidence")
        evidence_url = structured.get("evidence_url") or scrape_url
        model_used = reasoning.get("model_used")
    else:
        scrape_content = ""
        reasoning = {
            "model_used": None,
            "structured_output": {
                "answer": "No answer found",
                "confidence": 0.0,
                "evidence_url": None,
            },
            "tokens_used": None,
            "stop_reason": "no_search_hit",
            "provider": None,
        }
        answer_text = "No answer found"
        confidence = 0.0
        evidence_url = None
        model_used = None

    return {
        "question_id": question.get("question_id"),
        "section_id": question.get("section_id"),
        "question_text": question.get("question_text"),
        "search_queries": search_queries,
        "search_query": search_query_used or (search_queries[0] if search_queries else None),
        "search_attempts": search_attempts,
        "search_results": search_results,
        "search_hit": bool(search_results),
        "search_results_count": len(search_results),
        "scrape_url": scrape_url,
        "scrape": {
            "status": scrape.get("status") if scrape else None,
            "word_count": (scrape.get("metadata") or {}).get("word_count") if scrape else None,
            "source": (scrape.get("metadata") or {}).get("source") if scrape else None,
            "content_preview": scrape_content[:1200],
        },
        "answer": answer_text,
        "confidence": confidence,
        "evidence_url": evidence_url,
        "reasoning_model_used": model_used,
        "retry_count": retry_count,
        "category": _category_for_section(question.get("section_id")),
    }


def merge_question_first_report_into_dossier(
    *,
    dossier_payload: Dict[str, Any],
    report: Dict[str, Any],
) -> Dict[str, Any]:
    payload = dict(dossier_payload or {})
    metadata = payload.setdefault("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
        payload["metadata"] = metadata

    question_answers = report.get("answers") or []
    question_answer_index: Dict[str, Dict[str, Any]] = {}
    for answer in question_answers:
        if not isinstance(answer, dict):
            continue
        question_id = str(answer.get("question_id") or "").strip()
        question_text = str(answer.get("question_text") or "").strip().lower()
        if question_id:
            question_answer_index[question_id] = answer
        if question_text and question_text not in question_answer_index:
            question_answer_index[question_text] = answer

    questions = payload.get("questions")
    if isinstance(questions, list):
        merged_questions: List[Dict[str, Any]] = []
        for question in questions:
            if not isinstance(question, dict):
                merged_questions.append(question)
                continue
            question_copy = dict(question)
            lookup_key = str(question_copy.get("question_id") or "").strip()
            if not lookup_key:
                lookup_key = str(question_copy.get("question_text") or "").strip().lower()
            answer = question_answer_index.get(lookup_key)
            if isinstance(answer, dict):
                question_copy.update(
                {
                    "answer": raw_answer.get("answer") if isinstance(raw_answer, dict) else answer.get("answer"),
                    "confidence": answer.get("confidence"),
                        "search_query": answer.get("search_query"),
                        "search_queries": answer.get("search_queries"),
                        "search_hit": answer.get("search_hit"),
                        "search_results_count": answer.get("search_results_count"),
                        "search_attempts": answer.get("search_attempts"),
                        "scrape_url": answer.get("scrape_url"),
                        "evidence_url": answer.get("evidence_url"),
                        "reasoning_model_used": answer.get("reasoning_model_used"),
                        "category": answer.get("category"),
                        "retry_count": answer.get("retry_count"),
                        "validation_state": _validation_state_for_answer(answer),
                        "question_first_answer": answer,
                    }
                )
            merged_questions.append(question_copy)
        payload["questions"] = merged_questions

    metadata["question_first"] = {
        "enabled": True,
        "questions_answered": int(report.get("questions_answered") or 0),
        "categories": report.get("categories") or [],
        "question_source_path": report.get("question_source_path"),
        "generated_at": report.get("generated_at"),
    }
    payload["question_first"] = {
        "enabled": True,
        "questions_answered": int(report.get("questions_answered") or 0),
        "categories": report.get("categories") or [],
        "answers": question_answers,
        "report": report,
    }
    return payload


async def run_question_first_dossier_from_payload(
    *,
    source_payload: Dict[str, Any],
    launch_source_payload: Optional[Dict[str, Any]] = None,
    output_dir: Optional[Path] = None,
    question_first_run_path: Optional[Path | str] = None,
    worktree_root: Optional[Path] = None,
    opencode_timeout_ms: int = 300000,
    preset: Optional[str] = None,
    question_source_label: Optional[str] = None,
    connections_graph_enricher: Any | None = None,
    **_legacy_kwargs: Any,
) -> Dict[str, Any]:
    source = dict(source_payload or {})
    launch_source = dict(launch_source_payload or source)
    repair_context = _extract_question_first_repair(source)
    artifact_path_value = question_first_run_path or source.get("question_first_run_path")
    if artifact_path_value:
        artifact_path = Path(artifact_path_value)
    else:
        target_output_dir = Path(output_dir) if output_dir is not None else Path(tempfile.mkdtemp(prefix="question-first-run-"))
        artifact_path, state_path = await _launch_opencode_question_first_batch(
            source_payload=launch_source,
            output_dir=target_output_dir,
            preset=preset or launch_source.get("preset") or source.get("question_source_label") or None,
            worktree_root=worktree_root,
            opencode_timeout_ms=opencode_timeout_ms,
        )
        await _wait_for_question_first_run_completion(
            state_path,
            timeout_ms=_derive_question_first_batch_timeout_ms(
                source_payload=launch_source,
                opencode_timeout_ms=opencode_timeout_ms,
            ),
        )

    artifact = _load_question_first_run_artifact(artifact_path)
    question_index = {
        str(question.get("question_id") or "").strip(): question
        for question in (artifact.questions or [])
        if isinstance(question, dict)
    }
    normalized_answer_records = [
        _normalize_answer_record(answer, question_index.get(str(answer.get("question_id") or "").strip()))
        for answer in (artifact.answers or [])
        if isinstance(answer, dict)
    ]
    artifact_payload = artifact.model_dump()
    artifact_payload["answer_records"] = normalized_answer_records
    artifact = QuestionFirstRunArtifact.model_validate(artifact_payload)
    if repair_context.get("mode") == "question" and repair_context.get("repair_source_run_path"):
        base_artifact = _load_question_first_run_artifact(repair_context["repair_source_run_path"])
        artifact = _merge_repair_artifact(
            base_artifact=base_artifact,
            repair_artifact=artifact,
            repair_context=repair_context,
        )
        artifact_payload = artifact.model_dump()
    synthesized_answer_records = _apply_synthesized_derived_answers(
        question_specs=[question for question in artifact.questions if isinstance(question, dict)],
        answers=[answer for answer in artifact.answers if isinstance(answer, dict)],
        entity_name=str((artifact.entity or {}).get("entity_name") or source.get("entity_name") or ""),
        entity_type=str((artifact.entity or {}).get("entity_type") or source.get("entity_type") or ""),
    )
    artifact_payload["answer_records"] = synthesized_answer_records
    artifact = QuestionFirstRunArtifact.model_validate(artifact_payload)
    if artifact_path:
        Path(artifact_path).write_text(json.dumps(artifact_payload, indent=2, default=str), encoding="utf-8")
    if output_dir is not None:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        canonical_artifact_path = _artifact_output_path(Path(output_dir), source, artifact)
        canonical_artifact_path.write_text(json.dumps(artifact_payload, indent=2, default=str), encoding="utf-8")

    merged = merge_question_first_run_artifact_into_dossier(dossier_payload=source, artifact=artifact)
    promotions = build_question_first_promotions(
        answers=artifact.answers,
        question_specs=artifact.question_specs,
        evidence_items=artifact.evidence_items,
        promotion_candidates=artifact.promotion_candidates,
        bridge_contacts=source.get("bridge_contacts") if isinstance(source.get("bridge_contacts"), list) else None,
        allowed_rollout_phase=str(os.getenv("QUESTION_FIRST_PROMOTION_PHASE") or "phase_1_core").strip() or "phase_1_core",
    )
    active_connections_graph = promotions["connections_graph"]
    connections_graph_enrichment_enabled = False
    connections_graph_enrichment_status = "optional"
    if connections_graph_enricher is None and connections_enrichment_enabled_by_default():
        brightdata_client = BrightDataMCPClient()
        connections_graph_enricher = build_default_connections_graph_enricher(brightdata_client)
    if connections_graph_enricher is not None:
        connections_graph_enrichment_enabled = True
        connections_graph_enrichment_status = "enabled"
        enrich_callable = getattr(connections_graph_enricher, "enrich", None)
        if callable(enrich_callable):
            try:
                active_connections_graph = await enrich_callable(
                    connections_graph=active_connections_graph,
                    poi_graph=promotions["poi_graph"],
                    entity_name=str(artifact.entity.get("entity_name") or source.get("entity_name") or source.get("entity_id") or ""),
                )
            except Exception as exc:
                logger.warning("connections graph enrichment failed: %s", exc)
    durable_batch_metrics = build_question_first_durable_batch_metrics(
        artifact=artifact,
        output_dir=output_dir,
        connections_graph_enrichment_enabled=connections_graph_enrichment_enabled,
        connections_graph_enrichment_status=connections_graph_enrichment_status,
    )
    merged["question_first_run"] = artifact_payload
    merged["dossier_promotions"] = promotions["dossier_promotions"]
    merged["discovery_summary"] = promotions["discovery_summary"]
    merged["poi_graph"] = promotions["poi_graph"]
    merged["connections_graph"] = active_connections_graph
    merged.setdefault("question_first", {})
    if isinstance(merged["question_first"], dict):
        merged["question_first"]["dossier_promotions"] = promotions["dossier_promotions"]
        merged["question_first"]["discovery_summary"] = promotions["discovery_summary"]
        merged["question_first"]["poi_graph"] = artifact.poi_graph or promotions["poi_graph"]
        merged["question_first"]["connections_graph"] = active_connections_graph
        merged["question_first"]["connections_graph_enrichment_enabled"] = connections_graph_enrichment_enabled
        merged["question_first"]["connections_graph_enrichment_status"] = connections_graph_enrichment_status
        merged["question_first"].update(durable_batch_metrics)
    merged.update(durable_batch_metrics)
    merged_dossier = merged.get("merged_dossier") if isinstance(merged.get("merged_dossier"), dict) else None
    if merged_dossier is not None:
        merged_dossier.update(durable_batch_metrics)
        merged_dossier.setdefault("question_first", {})
        if isinstance(merged_dossier.get("question_first"), dict):
            merged_dossier["question_first"].update(durable_batch_metrics)
    quality = _derive_dossier_quality_summary(
        merged_dossier=merged,
        expected_question_count=_expected_publish_question_count(source_payload=source, artifact=artifact),
    )
    merged.update(quality)

    if output_dir is not None:
      output_dir = Path(output_dir)
      output_dir.mkdir(parents=True, exist_ok=True)
      entity_name = str(artifact.entity.get("entity_name") or source.get("entity_name") or source.get("entity_id") or "entity")
      entity_id = str(artifact.entity.get("entity_id") or source.get("entity_id") or _slugify(entity_name))
      report = {
          "generated_at": artifact.generated_at,
          "entity_id": entity_id,
          "entity_name": entity_name,
          "tier": source.get("tier"),
          "question_source_path": question_source_label or artifact.question_source_path or source.get("question_source_path") or source.get("source_path") or None,
          "questions_answered": len(synthesized_answer_records),
          "answers": synthesized_answer_records,
          "categories": artifact.categories,
          "run_rollup": artifact.run_rollup,
          "schema_version": artifact.schema_version,
          "connections_graph_enrichment_enabled": connections_graph_enrichment_enabled,
          "connections_graph_enrichment_status": connections_graph_enrichment_status,
          **durable_batch_metrics,
      }
      published_payload = {
          **merged,
          **quality,
          "generated_at": artifact.generated_at,
          "entity_id": entity_id,
          "entity_name": entity_name,
          "tier": source.get("tier"),
          "question_source_path": report["question_source_path"],
          "questions_answered": len(synthesized_answer_records),
          "answers": synthesized_answer_records,
          "categories": artifact.categories,
          "run_rollup": artifact.run_rollup,
          "schema_version": artifact.schema_version,
          "connections_graph_enrichment_enabled": connections_graph_enrichment_enabled,
          "connections_graph_enrichment_status": connections_graph_enrichment_status,
          "merged_dossier": merged,
          **durable_batch_metrics,
      }
      plain_text_report = _render_plain_text_report(
          {
              "entity_name": entity_name,
              "generated_at": artifact.generated_at,
              "question_source_path": report["question_source_path"],
              "questions_answered": report["questions_answered"],
              "answers": synthesized_answer_records,
              "categories": artifact.categories,
          }
      )
      publish_result = _publish_question_first_dossier_reports(
          output_dir=output_dir,
          entity_id=entity_id,
          json_payload=published_payload,
          plain_text_report=plain_text_report,
          min_question_count=_expected_publish_question_count(source_payload=source, artifact=artifact),
      )
      merged.setdefault("question_first_report", {})
      if isinstance(merged["question_first_report"], dict):
          merged["question_first_report"].update(
              {
                  "connections_graph_enrichment_enabled": connections_graph_enrichment_enabled,
                  "connections_graph_enrichment_status": connections_graph_enrichment_status,
                  **publish_result,
                  **durable_batch_metrics,
              }
          )
      if isinstance(merged.get("question_first"), dict):
          merged["question_first"]["publish_status"] = publish_result["publish_status"]

    return merged


async def run_question_first_dossier(
    *,
    question_source_path: Path,
    output_dir: Path,
    question_first_run_path: Optional[Path | str] = None,
    worktree_root: Optional[Path] = None,
    opencode_timeout_ms: int = 300000,
    preset: Optional[str] = None,
    **_legacy_kwargs: Any,
) -> Dict[str, Any]:
    load_dotenv(Path(".env"), override=False)
    load_dotenv(Path("apps/signal-noise-app/.env"), override=False)
    load_dotenv(Path("apps/signal-noise-app/backend/.env"), override=False)
    source = _load_question_source(question_source_path)
    return await run_question_first_dossier_from_payload(
        source_payload=source,
        output_dir=output_dir,
        question_first_run_path=question_first_run_path or source.get("question_first_run_path"),
        worktree_root=worktree_root,
        opencode_timeout_ms=opencode_timeout_ms,
        preset=preset,
        question_source_label=str(question_source_path),
    )


def main(argv: Optional[List[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Run a question-first dossier using the canonical OpenCode artifact")
    parser.add_argument("--question-source", required=True, help="Path to a dossier JSON file with questions")
    parser.add_argument("--output-dir", default="backend/data/question_first_dossiers")
    parser.add_argument("--question-first-run-path", default=None, help="Path to a canonical question_first_run_v2 artifact")
    parser.add_argument("--opencode-timeout-ms", type=int, default=300000)
    parser.add_argument("--preset", default=None)
    args = parser.parse_args(argv)

    result = asyncio.run(
        run_question_first_dossier(
            question_source_path=Path(args.question_source),
            output_dir=Path(args.output_dir),
            question_first_run_path=Path(args.question_first_run_path) if args.question_first_run_path else None,
            opencode_timeout_ms=args.opencode_timeout_ms,
            preset=args.preset,
        )
    )
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
