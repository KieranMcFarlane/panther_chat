#!/usr/bin/env python3
"""Question-first dossier adapter around the canonical OpenCode artifact.

This module now consumes a versioned ``question_first_run_v1`` artifact emitted
by the OpenCode batch runner, merges it into a dossier payload, and optionally
launches the canonical OpenCode batch when an artifact path is not supplied.
"""

from __future__ import annotations

import asyncio
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
from pydantic import BaseModel, Field, ValidationError

try:
    from backend.brightdata_mcp_client import BrightDataMCPClient
    from backend.claude_client import ClaudeClient
    from backend.connections_graph_enricher import (
        build_default_connections_graph_enricher,
        connections_enrichment_enabled_by_default,
    )
    from backend.question_first_promoter import build_question_first_promotions
except ImportError:
    from brightdata_mcp_client import BrightDataMCPClient  # type: ignore
    from claude_client import ClaudeClient  # type: ignore
    from connections_graph_enricher import build_default_connections_graph_enricher, connections_enrichment_enabled_by_default  # type: ignore
    from question_first_promoter import build_question_first_promotions  # type: ignore

logger = logging.getLogger(__name__)


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
    while time.monotonic() <= deadline:
        if state_path.exists():
            try:
                last_state = json.loads(state_path.read_text(encoding="utf-8"))
            except Exception:
                last_state = {}
            if str(last_state.get("run_phase") or "").lower() == "completed":
                return last_state
        await asyncio.sleep(max(poll_interval_ms, 1) / 1000.0)
    raise TimeoutError(
        f"Timed out waiting for question-first batch to reach completed state at {state_path}"
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
    schema_version: Literal["question_first_run_v1"]
    generated_at: str
    run_started_at: str
    source: str
    status: str
    warnings: List[str] = Field(default_factory=list)
    entity: Dict[str, Any] = Field(default_factory=dict)
    preset: Optional[str] = None
    question_source_path: Optional[str] = None
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    answers: List[Dict[str, Any]] = Field(default_factory=list)
    question_timings: Dict[str, Any] = Field(default_factory=dict)
    evidence_items: List[Dict[str, Any]] = Field(default_factory=list)
    promotion_candidates: List[Dict[str, Any]] = Field(default_factory=list)
    poi_graph: Dict[str, Any] = Field(default_factory=dict)
    categories: List[Dict[str, Any]] = Field(default_factory=list)
    run_rollup: Dict[str, Any] = Field(default_factory=dict)
    merge_patch: Dict[str, Any] = Field(default_factory=dict)


def _load_question_first_run_artifact(artifact_path: Path | str) -> QuestionFirstRunArtifact:
    path = Path(artifact_path)
    try:
        return QuestionFirstRunArtifact.model_validate_json(path.read_text(encoding="utf-8"))
    except ValidationError as exc:
        raise ValueError(f"Invalid question_first_run artifact at {path}") from exc


def _merge_question_first_run_patch(
    *,
    dossier_payload: Dict[str, Any],
    artifact: QuestionFirstRunArtifact,
) -> Dict[str, Any]:
    payload = dict(dossier_payload or {})
    patch = artifact.merge_patch if isinstance(artifact.merge_patch, dict) else {}

    metadata = payload.setdefault("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
        payload["metadata"] = metadata

    patch_metadata = patch.get("metadata") if isinstance(patch.get("metadata"), dict) else {}
    if isinstance(patch_metadata, dict):
        metadata.update(patch_metadata)

    if "question_first" in patch and isinstance(patch["question_first"], dict):
        payload["question_first"] = patch["question_first"]

    if "questions" in patch and isinstance(patch["questions"], list):
        payload["questions"] = patch["questions"]

    payload.setdefault("question_first", {})
    if isinstance(payload["question_first"], dict):
        payload["question_first"].setdefault("schema_version", artifact.schema_version)
        payload["question_first"].setdefault("generated_at", artifact.generated_at)
        payload["question_first"].setdefault("run_rollup", artifact.run_rollup)
        payload["question_first"].setdefault("categories", artifact.categories)
        payload["question_first"].setdefault("answers", artifact.answers)
        payload["question_first"].setdefault("question_timings", artifact.question_timings)
        payload["question_first"].setdefault("evidence_items", artifact.evidence_items)
        payload["question_first"].setdefault("promotion_candidates", artifact.promotion_candidates)
        payload["question_first"].setdefault("poi_graph", artifact.poi_graph)
        payload["question_first"].setdefault("questions_answered", len(artifact.answers))

    metadata.setdefault("question_first", {})
    if isinstance(metadata["question_first"], dict):
        metadata["question_first"].setdefault("schema_version", artifact.schema_version)
        metadata["question_first"].setdefault("generated_at", artifact.generated_at)
        metadata["question_first"].setdefault("questions_answered", len(artifact.answers))
        metadata["question_first"].setdefault("categories", artifact.categories)
        metadata["question_first"].setdefault("question_timings", artifact.question_timings)
        metadata["question_first"].setdefault("evidence_items", artifact.evidence_items)
        metadata["question_first"].setdefault("promotion_candidates", artifact.promotion_candidates)
        metadata["question_first"].setdefault("poi_graph", artifact.poi_graph)
        metadata["question_first"].setdefault("question_source_path", artifact.question_source_path)
        metadata["question_first"].setdefault("run_rollup", artifact.run_rollup)

    payload["question_first_run"] = artifact.model_dump()
    return payload


def merge_question_first_run_artifact_into_dossier(
    *,
    dossier_payload: Dict[str, Any],
    artifact: Dict[str, Any] | QuestionFirstRunArtifact,
) -> Dict[str, Any]:
    artifact_model = artifact if isinstance(artifact, QuestionFirstRunArtifact) else QuestionFirstRunArtifact.model_validate(artifact)
    return _merge_question_first_run_patch(dossier_payload=dossier_payload, artifact=artifact_model)


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
    return output_dir / f"{_slugify(entity_id)}_question_first_run_v1.json"


def _find_existing_question_first_run_artifact(output_dir: Path, source_payload: Dict[str, Any]) -> Optional[Path]:
    canonical_path = _artifact_output_path(output_dir, source_payload)
    if canonical_path.exists():
        return canonical_path
    candidates = sorted(
        output_dir.glob("*_question_first_run_v1.json"),
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

            proc = subprocess.Popen(
                command,
                cwd=str(worktree_root),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=dict(os.environ),
            )
            state_path = _build_question_first_state_path(
                output_dir=output_dir,
                source_payload=source_payload,
                preset=preset,
            )
            deadline = time.monotonic() + max(opencode_timeout_ms, 1) / 1000.0
            stdout_text = ""
            stderr_text = ""
            result: Dict[str, Any] = {}

            while time.monotonic() <= deadline:
                if state_path.exists():
                    try:
                        state_payload = json.loads(state_path.read_text(encoding="utf-8"))
                    except Exception:
                        state_payload = {}
                    if str(state_payload.get("run_phase") or "").strip().lower() == "completed":
                        stdout_text, stderr_text = await _terminate_process(proc)
                        result = _parse_opencode_batch_stdout(stdout_text)
                        question_first_run_path = result.get("question_first_run_path") or state_payload.get("question_first_run_path")
                        if question_first_run_path:
                            return Path(str(question_first_run_path)), state_path
                        artifact_path = _find_existing_question_first_run_artifact(output_dir, source_payload)
                        if artifact_path is not None:
                            return artifact_path, state_path
                        raise FileNotFoundError(
                            "OpenCode batch reached completed state without producing a canonical question_first_run artifact"
                        )

                returncode = proc.poll()
                if returncode is not None:
                    stdout_text, stderr_text = await asyncio.to_thread(proc.communicate)
                    result = _parse_opencode_batch_stdout(stdout_text)
                    if returncode != 0:
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
                    raise FileNotFoundError("OpenCode batch completed without producing a canonical question_first_run artifact")

                await asyncio.sleep(0.25)

            stdout_text, stderr_text = await _terminate_process(proc)
            raise TimeoutError(
                "Timed out waiting for OpenCode question-first batch to complete "
                f"at {state_path}: {stderr_text.strip() or stdout_text.strip()}"
            )
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
        if answer.get("search_hit") and float(answer.get("confidence") or 0.0) >= 0.5:
            bucket["validated_count"] += 1
        elif answer.get("search_hit"):
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
    answers = [answer for answer in artifact.answers if isinstance(answer, dict)]
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
                        "answer": answer.get("answer"),
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
    artifact_path_value = question_first_run_path or source.get("question_first_run_path")
    if artifact_path_value:
        artifact_path = Path(artifact_path_value)
    else:
        target_output_dir = Path(output_dir) if output_dir is not None else Path(tempfile.mkdtemp(prefix="question-first-run-"))
        artifact_path, state_path = await _launch_opencode_question_first_batch(
            source_payload=source,
            output_dir=target_output_dir,
            preset=preset or source.get("preset") or source.get("question_source_label") or None,
            worktree_root=worktree_root,
            opencode_timeout_ms=opencode_timeout_ms,
        )
        await _wait_for_question_first_run_completion(state_path, timeout_ms=opencode_timeout_ms)

    artifact = _load_question_first_run_artifact(artifact_path)
    merged = merge_question_first_run_artifact_into_dossier(dossier_payload=source, artifact=artifact)
    promotions = build_question_first_promotions(
        answers=artifact.answers,
        evidence_items=artifact.evidence_items,
        promotion_candidates=artifact.promotion_candidates,
        bridge_contacts=source.get("bridge_contacts") if isinstance(source.get("bridge_contacts"), list) else None,
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

    if output_dir is not None:
      output_dir = Path(output_dir)
      output_dir.mkdir(parents=True, exist_ok=True)
      entity_name = str(artifact.entity.get("entity_name") or source.get("entity_name") or source.get("entity_id") or "entity")
      entity_id = str(artifact.entity.get("entity_id") or source.get("entity_id") or _slugify(entity_name))
      json_path = output_dir / f"{_slugify(entity_id)}_question_first_dossier.json"
      txt_path = output_dir / f"{_slugify(entity_id)}_question_first_dossier.txt"
      report = {
          "generated_at": artifact.generated_at,
          "entity_id": entity_id,
          "entity_name": entity_name,
          "tier": source.get("tier"),
          "question_source_path": question_source_label or artifact.question_source_path or source.get("question_source_path") or source.get("source_path") or None,
          "questions_answered": len(artifact.answers),
          "answers": artifact.answers,
          "categories": artifact.categories,
          "run_rollup": artifact.run_rollup,
          "schema_version": artifact.schema_version,
          "connections_graph_enrichment_enabled": connections_graph_enrichment_enabled,
          "connections_graph_enrichment_status": connections_graph_enrichment_status,
          **durable_batch_metrics,
      }
      json_path.write_text(json.dumps({**report, "merged_dossier": merged}, indent=2, default=str), encoding="utf-8")
      txt_path.write_text(
          _render_plain_text_report(
              {
                  "entity_name": entity_name,
                  "generated_at": artifact.generated_at,
                  "question_source_path": report["question_source_path"],
                  "questions_answered": report["questions_answered"],
                  "answers": artifact.answers,
                  "categories": artifact.categories,
              }
          ),
          encoding="utf-8",
      )
      merged.setdefault("question_first_report", {})
      if isinstance(merged["question_first_report"], dict):
          merged["question_first_report"].update(
              {
                  "json_report_path": str(json_path),
                  "plain_text_path": str(txt_path),
                  "connections_graph_enrichment_enabled": connections_graph_enrichment_enabled,
                  "connections_graph_enrichment_status": connections_graph_enrichment_status,
                  **durable_batch_metrics,
              }
          )

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
    parser.add_argument("--question-first-run-path", default=None, help="Path to a canonical question_first_run_v1 artifact")
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
