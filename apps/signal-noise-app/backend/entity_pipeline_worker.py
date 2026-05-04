import json
import os
import socket
import threading
import time
import logging
from uuid import UUID
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
try:
    from supabase import create_client
except ImportError:  # pragma: no cover - allows unit tests without supabase package
    create_client = None
from local_pg_client import create_local_pg_client, should_use_local_pg
from pipeline_run_metadata import (
    derive_discovery_context,
    derive_monitoring_summary,
    merge_pipeline_run_metadata,
)
from repair_root_selector import select_repair_root_question_id

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.getenv("ENTITY_PIPELINE_WORKER_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

DEFAULT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
PIPELINE_CONTROL_STATE_PATH = Path(__file__).resolve().parents[1] / "tmp" / "pipeline-control-state.json"
PIPELINE_CONTROL_REQUESTED_STATES = {"running", "paused"}
PIPELINE_CONTROL_OBSERVED_STATES = {"starting", "running", "stopping", "paused"}
TERMINAL_STOP_REASONS = {
    "question_retry_exhausted",
    "question_skipped_and_next_failed",
    "orchestrator_unhealthy",
    "worker_heartbeat_stale",
    "backend_route_missing",
    "provider_infrastructure_failure",
    "queue_exhausted",
    "manual_stop",
}
RECOVERABLE_PIPELINE_PAUSE_REASONS = {
    "backend_route_missing",
    "orchestrator_unhealthy",
    "question_retry_exhausted",
    "entity_pipeline_timeout",
    "question_skipped_and_next_failed",
    "queue_exhausted",
    "provider_infrastructure_failure",
}
OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR = "OpenCodeProviderInsufficientBalanceError"


def load_worker_environment(env_path: Optional[Path] = None) -> None:
    dotenv_path = env_path or DEFAULT_ENV_PATH
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path, override=False)


load_worker_environment()

def resolve_fastapi_url(
    fastapi_url: Optional[str],
    python_backend_url: Optional[str],
) -> str:
    url = fastapi_url or python_backend_url or "http://127.0.0.1:8000"
    return url.replace("http://localhost:", "http://127.0.0.1:")


FASTAPI_URL = resolve_fastapi_url(os.getenv("FASTAPI_URL"), os.getenv("PYTHON_BACKEND_URL"))
PIPELINE_TIMEOUT_SECONDS = int(os.getenv("ENTITY_PIPELINE_TIMEOUT_SECONDS", "1800"))
QUEUE_MODE = os.getenv("ENTITY_IMPORT_QUEUE_MODE", "durable_worker")
POLL_INTERVAL_SECONDS = int(os.getenv("ENTITY_PIPELINE_WORKER_POLL_SECONDS", "10"))
STALE_MINUTES = int(os.getenv("ENTITY_PIPELINE_STALE_MINUTES", "5"))
LEASE_SECONDS = int(os.getenv("ENTITY_PIPELINE_LEASE_SECONDS", "90"))
MAX_RUN_ATTEMPTS = int(os.getenv("ENTITY_PIPELINE_MAX_RUN_ATTEMPTS", "3"))
DEFAULT_REPAIR_RETRY_BUDGET = int(os.getenv("ENTITY_PIPELINE_REPAIR_RETRY_BUDGET", "3"))
MAX_QUESTION_FIRST_CONTINUATION_ATTEMPTS = int(os.getenv("ENTITY_PIPELINE_MAX_QF_CONTINUATION_ATTEMPTS", "2"))
TERMINAL_BATCH_STATUSES = {"completed", "failed"}
WORKER_PID_PATH = Path(__file__).resolve().parents[1] / "tmp" / "entity-pipeline-worker.pid"
WORKER_STATE_PATH = Path(__file__).resolve().parents[1] / "tmp" / "entity-pipeline-worker-state.json"
WORKER_STARTED_AT: Optional[str] = None
WORKER_ACTIVITY: Dict[str, Optional[str]] = {}
ACTIVE_WORKER_STATE_FIELDS = (
    "current_batch_id",
    "current_entity_id",
    "current_canonical_entity_id",
    "current_entity_name",
    "current_question_id",
    "current_question_text",
    "current_action",
    "current_phase",
    "current_started_at",
    "current_activity_at",
)
ACTIVE_PIPELINE_RUNTIME_STATE_FIELDS = ACTIVE_WORKER_STATE_FIELDS + ("cursor_source",)
PIPELINE_CONTROL_STATE_TABLE = "pipeline_control_state"
PIPELINE_CONTROL_STATE_ROW_ID = "pipeline"
PIPELINE_RECOVERY_STATE_VALUES = {
    "healthy",
    "degraded",
    "recovering",
    "blocked_backend",
    "blocked_provider",
    "blocked_manual",
    "stale_state_repair",
}
PIPELINE_LAST_SELF_HEAL_FIELDS = (
    "last_self_heal_action",
    "last_self_heal_reason",
    "last_self_heal_at",
)


def _default_pipeline_control_state() -> Dict[str, Any]:
    return {
        "is_paused": False,
        "pause_reason": None,
        "stop_reason": None,
        "stop_details": None,
        "updated_at": None,
        "desired_state": "running",
        "requested_state": "running",
        "observed_state": "running",
        "transition_state": "running",
        "current_batch_id": None,
        "current_entity_id": None,
        "current_canonical_entity_id": None,
        "current_entity_name": None,
        "current_question_id": None,
        "current_question_text": None,
        "current_action": None,
        "current_phase": None,
        "current_started_at": None,
        "current_activity_at": None,
        "cursor_source": None,
        "state": "healthy",
        "health_class": "healthy",
        "recovery_source": None,
        "last_self_heal_action": None,
        "last_self_heal_reason": None,
        "last_self_heal_at": None,
    }


def _write_supervisor_state(
    status: str,
    error: Optional[str] = None,
    stopped_at: Optional[str] = None,
) -> None:
    """Write the worker state JSON and PID file so the frontend supervisor can reconcile."""
    global WORKER_STARTED_AT
    now_iso = datetime.now(timezone.utc).isoformat()
    if status in ("running", "starting") and WORKER_STARTED_AT is None:
        WORKER_STARTED_AT = now_iso

    state = {
        "worker_process_state": status,
        "worker_pid": os.getpid(),
        "worker_command": "npm run worker:entity-pipeline",
        "worker_state_path": str(WORKER_STATE_PATH),
        "worker_pid_path": str(WORKER_PID_PATH),
        "started_at": WORKER_STARTED_AT or now_iso,
        "stopped_at": stopped_at,
        "updated_at": now_iso,
        "last_error": error,
    }
    state.update(WORKER_ACTIVITY)
    try:
        WORKER_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        WORKER_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
        WORKER_PID_PATH.write_text(f"{os.getpid()}\n", encoding="utf-8")
    except Exception as exc:
        logger.warning("Failed to write supervisor state: %s", exc)


def _heartbeat_supervisor_state() -> None:
    """Lightweight heartbeat — just update updated_at."""
    try:
        raw = WORKER_STATE_PATH.read_text(encoding="utf-8")
        state = json.loads(raw)
    except Exception:
        state = {}
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    state["worker_process_state"] = "running"
    state["worker_pid"] = os.getpid()
    for key in ACTIVE_WORKER_STATE_FIELDS:
        if key in WORKER_ACTIVITY:
            state[key] = WORKER_ACTIVITY[key]
        else:
            state.pop(key, None)
    try:
        WORKER_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except Exception:
        pass


def _set_supervisor_activity(**activity: Optional[str]) -> None:
    WORKER_ACTIVITY.clear()
    now_iso = datetime.now(timezone.utc).isoformat()
    normalized = {
        key: (str(value).strip() if value is not None and str(value).strip() else None)
        for key, value in activity.items()
        if key in ACTIVE_WORKER_STATE_FIELDS
    }
    normalized["current_activity_at"] = normalized.get("current_activity_at") or now_iso
    WORKER_ACTIVITY.update(normalized)
    _heartbeat_supervisor_state()


def _touch_supervisor_activity(now_iso: Optional[str] = None) -> None:
    if not WORKER_ACTIVITY:
        return
    WORKER_ACTIVITY["current_activity_at"] = now_iso or datetime.now(timezone.utc).isoformat()
    _heartbeat_supervisor_state()


def _clear_supervisor_activity() -> None:
    WORKER_ACTIVITY.clear()
    _heartbeat_supervisor_state()


def _is_distinct_follow_on_batch_id(current_batch_id: Optional[str], next_batch_id: Optional[str]) -> bool:
    current = str(current_batch_id or "").strip()
    follow_on = str(next_batch_id or "").strip()
    return bool(follow_on) and follow_on != current


def _is_legacy_manual_pause_state(payload: Dict[str, Any]) -> bool:
    stop_reason = str(payload.get("stop_reason") or "").strip().lower()
    pause_reason = str(payload.get("pause_reason") or "").strip().lower()
    return stop_reason == "manual_stop" or (
        not stop_reason and pause_reason in {"paused from live ops", "manual stop"}
    )


def _normalize_pipeline_control_state_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    normalized = _default_pipeline_control_state()
    if not isinstance(payload, dict):
        return normalized

    if _is_legacy_manual_pause_state(payload):
        normalized["updated_at"] = str(payload.get("updated_at") or "").strip() or None
        return normalized

    requested_state = str(payload.get("requested_state") or "").strip().lower()
    if requested_state not in PIPELINE_CONTROL_REQUESTED_STATES:
        requested_state = "paused" if payload.get("is_paused") is True else "running"
    observed_state = str(payload.get("observed_state") or "").strip().lower()
    if observed_state not in PIPELINE_CONTROL_OBSERVED_STATES:
        observed_state = "paused" if requested_state == "paused" else "running"
    transition_state = str(payload.get("transition_state") or "").strip().lower()
    if transition_state not in PIPELINE_CONTROL_OBSERVED_STATES:
        transition_state = observed_state
    desired_state = str(payload.get("desired_state") or "").strip().lower()
    if desired_state not in PIPELINE_CONTROL_REQUESTED_STATES:
        desired_state = requested_state

    normalized.update(
        {
            "is_paused": bool(payload.get("is_paused")),
            "pause_reason": str(payload.get("pause_reason") or "").strip() or None,
            "stop_reason": str(payload.get("stop_reason") or "").strip() or None,
            "stop_details": payload.get("stop_details") if isinstance(payload.get("stop_details"), dict) else None,
            "updated_at": str(payload.get("updated_at") or "").strip() or None,
            "desired_state": desired_state,
            "requested_state": requested_state,
            "observed_state": observed_state,
            "transition_state": transition_state,
            "current_batch_id": str(payload.get("current_batch_id") or "").strip() or None,
            "current_entity_id": str(payload.get("current_entity_id") or "").strip() or None,
            "current_canonical_entity_id": str(payload.get("current_canonical_entity_id") or "").strip() or None,
            "current_entity_name": str(payload.get("current_entity_name") or "").strip() or None,
            "current_question_id": str(payload.get("current_question_id") or "").strip() or None,
            "current_question_text": str(payload.get("current_question_text") or "").strip() or None,
            "current_action": str(payload.get("current_action") or "").strip() or None,
            "current_phase": str(payload.get("current_phase") or "").strip() or None,
            "current_started_at": str(payload.get("current_started_at") or "").strip() or None,
            "current_activity_at": str(payload.get("current_activity_at") or "").strip() or None,
            "cursor_source": str(payload.get("cursor_source") or "").strip() or None,
            "state": str(payload.get("state") or "").strip().lower() or "healthy",
            "health_class": str(payload.get("health_class") or "").strip().lower() or "healthy",
            "recovery_source": str(payload.get("recovery_source") or "").strip() or None,
            "last_self_heal_action": str(payload.get("last_self_heal_action") or "").strip() or None,
            "last_self_heal_reason": str(payload.get("last_self_heal_reason") or "").strip() or None,
            "last_self_heal_at": str(payload.get("last_self_heal_at") or "").strip() or None,
        }
    )
    if normalized["state"] not in PIPELINE_RECOVERY_STATE_VALUES:
        normalized["state"] = "healthy"
    if normalized["health_class"] not in PIPELINE_RECOVERY_STATE_VALUES:
        normalized["health_class"] = "healthy"
    return normalized


def _read_pipeline_control_state_from_store() -> Optional[Dict[str, Any]]:
    if not should_use_local_pg():
        return None
    try:
        client = create_local_pg_client()
        response = client.table(PIPELINE_CONTROL_STATE_TABLE).select("*").eq("id", PIPELINE_CONTROL_STATE_ROW_ID).maybe_single()
        row = response.data if hasattr(response, "data") else None
        if isinstance(row, dict):
            state = row.get("state")
            if isinstance(state, dict):
                return state
            return row
    except Exception as error:
        logger.warning("Failed to read pipeline control state from Postgres: %s", error)
    return None


def _read_pipeline_control_state_from_file() -> Optional[Dict[str, Any]]:
    try:
        if not PIPELINE_CONTROL_STATE_PATH.exists():
            return None
        parsed = json.loads(PIPELINE_CONTROL_STATE_PATH.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, dict) else None
    except Exception as error:
        logger.warning("Failed to read pipeline control state file: %s", error)
        return None


def _choose_newest_pipeline_control_state(
    store_payload: Optional[Dict[str, Any]],
    file_payload: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if store_payload is None:
        return file_payload
    if file_payload is None:
        return store_payload

    def timestamp(payload: Dict[str, Any]) -> float:
        raw = str(payload.get("updated_at") or "").strip()
        if not raw:
            return 0.0
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0

    return file_payload if timestamp(file_payload) > timestamp(store_payload) else store_payload


def _write_pipeline_control_state_to_store(state: Dict[str, Any]) -> None:
    if not should_use_local_pg():
        return
    client = create_local_pg_client()
    client.table(PIPELINE_CONTROL_STATE_TABLE).upsert(
        {
            "id": PIPELINE_CONTROL_STATE_ROW_ID,
            "state": state,
            "updated_at": state.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="id",
    ).execute()


def _write_pipeline_control_state_to_file(state: Dict[str, Any]) -> None:
    PIPELINE_CONTROL_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PIPELINE_CONTROL_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def read_pipeline_control_state() -> Dict[str, Any]:
    store_payload = _read_pipeline_control_state_from_store()
    file_payload = _read_pipeline_control_state_from_file()
    payload = _choose_newest_pipeline_control_state(store_payload, file_payload)
    if payload is not None:
        return _normalize_pipeline_control_state_payload(payload)
    return _default_pipeline_control_state()


def write_pipeline_control_state(payload: Dict[str, Any]) -> Dict[str, Any]:
    current_state = read_pipeline_control_state()
    merged_payload = {**current_state, **payload}
    requested_state = str(merged_payload.get("requested_state") or "").strip().lower()
    if requested_state not in PIPELINE_CONTROL_REQUESTED_STATES:
        requested_state = "paused" if merged_payload.get("is_paused") is True else "running"
    transition_state = str(merged_payload.get("transition_state") or "").strip().lower()
    if transition_state not in PIPELINE_CONTROL_OBSERVED_STATES:
        transition_state = "stopping" if requested_state == "paused" else "starting"
    observed_state = str(merged_payload.get("observed_state") or "").strip().lower()
    if observed_state not in PIPELINE_CONTROL_OBSERVED_STATES:
        observed_state = transition_state
    desired_state = str(merged_payload.get("desired_state") or "").strip().lower()
    if desired_state not in PIPELINE_CONTROL_REQUESTED_STATES:
        desired_state = requested_state
    is_paused = bool(merged_payload.get("is_paused")) or requested_state == "paused" or observed_state == "paused"
    control_state = str(merged_payload.get("state") or "").strip().lower() or None
    health_class = str(merged_payload.get("health_class") or "").strip().lower() or None
    if control_state not in PIPELINE_RECOVERY_STATE_VALUES:
        control_state = "blocked_manual" if str(merged_payload.get("stop_reason") or "").strip().lower() == "manual_stop" else ("recovering" if transition_state in {"starting", "stopping"} else "healthy")
    if health_class not in PIPELINE_RECOVERY_STATE_VALUES:
        health_class = control_state
    next_state = {
        "is_paused": is_paused,
        "pause_reason": (str(merged_payload.get("pause_reason") or "").strip() or None) if is_paused else None,
        "stop_reason": str(merged_payload.get("stop_reason") or "").strip() or None,
        "stop_details": merged_payload.get("stop_details") if isinstance(merged_payload.get("stop_details"), dict) else None,
        "updated_at": str(merged_payload.get("updated_at") or "").strip() or datetime.now(timezone.utc).isoformat(),
        "desired_state": desired_state,
        "requested_state": requested_state,
        "observed_state": observed_state,
        "transition_state": transition_state,
        "current_batch_id": str(merged_payload.get("current_batch_id") or "").strip() or None,
        "current_entity_id": str(merged_payload.get("current_entity_id") or "").strip() or None,
        "current_canonical_entity_id": str(merged_payload.get("current_canonical_entity_id") or "").strip() or None,
        "current_entity_name": str(merged_payload.get("current_entity_name") or "").strip() or None,
        "current_question_id": str(merged_payload.get("current_question_id") or "").strip() or None,
        "current_question_text": str(merged_payload.get("current_question_text") or "").strip() or None,
        "current_action": str(merged_payload.get("current_action") or "").strip() or None,
        "current_phase": str(merged_payload.get("current_phase") or "").strip() or None,
        "current_started_at": str(merged_payload.get("current_started_at") or "").strip() or None,
        "current_activity_at": str(merged_payload.get("current_activity_at") or "").strip() or None,
        "cursor_source": str(merged_payload.get("cursor_source") or "").strip() or None,
        "state": control_state,
        "health_class": health_class,
        "recovery_source": str(merged_payload.get("recovery_source") or "").strip() or None,
        "last_self_heal_action": str(merged_payload.get("last_self_heal_action") or "").strip() or None,
        "last_self_heal_reason": str(merged_payload.get("last_self_heal_reason") or "").strip() or None,
        "last_self_heal_at": str(merged_payload.get("last_self_heal_at") or "").strip() or None,
    }
    try:
        _write_pipeline_control_state_to_store(next_state)
    except Exception as error:
        logger.warning("Failed to persist pipeline control state to Postgres: %s", error)
    try:
        _write_pipeline_control_state_to_file(next_state)
    except Exception as error:
        logger.warning("Failed to persist pipeline control state file: %s", error)
    return next_state


def _extract_pipeline_cursor_state(control_state: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    current_entity_id = str(control_state.get("current_entity_id") or "").strip() or None
    current_canonical_entity_id = str(control_state.get("current_canonical_entity_id") or "").strip() or None
    if current_canonical_entity_id:
        return current_entity_id or current_canonical_entity_id, current_canonical_entity_id
    if current_entity_id:
        return current_entity_id, current_entity_id
    return None, None


def _project_live_cursor_fields(
    *,
    batch: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    now_iso: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    batch = batch if isinstance(batch, dict) else {}
    metadata = metadata if isinstance(metadata, dict) else {}
    phase = str(batch.get("phase") or metadata.get("phase") or "").strip() or "dossier_generation"
    phase_details = metadata.get("phase_details_by_phase") if isinstance(metadata.get("phase_details_by_phase"), dict) else {}
    detail = phase_details.get(phase) if isinstance(phase_details.get(phase), dict) else {}
    checkpoint = extract_question_first_checkpoint_from_payload(metadata) or {}

    question_id = (
        str(detail.get("current_question_id") or detail.get("question_id") or "").strip()
        or str(checkpoint.get("current_question_id") or checkpoint.get("next_question_id") or "").strip()
        or str(metadata.get("current_question_id") or metadata.get("question_id") or metadata.get("active_question_id") or "").strip()
        or None
    )
    question_text = (
        str(detail.get("current_question_text") or detail.get("question_text") or "").strip()
        or str(checkpoint.get("current_question_text") or "").strip()
        or str(metadata.get("current_question_text") or "").strip()
        or None
    )
    current_action = (
        str(detail.get("current_action") or detail.get("question_id") or "").strip()
        or question_id
        or str(batch.get("phase") or "").strip()
        or None
    )
    return {
        "current_batch_id": str(batch.get("id") or "").strip() or None,
        "current_entity_id": str(batch.get("entity_id") or "").strip() or None,
        "current_canonical_entity_id": str(
            batch.get("canonical_entity_id")
            or metadata.get("canonical_entity_id")
            or batch.get("entity_id")
            or ""
        ).strip() or None,
        "current_entity_name": str(batch.get("entity_name") or "").strip() or None,
        "current_question_id": question_id,
        "current_question_text": question_text,
        "current_action": current_action,
        "current_phase": phase,
        "current_started_at": str(batch.get("started_at") or "").strip() or None,
        "current_activity_at": now_iso or datetime.now(timezone.utc).isoformat(),
    }


def _clear_pipeline_runtime_state_fields(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    next_payload = dict(payload or {})
    for key in ACTIVE_PIPELINE_RUNTIME_STATE_FIELDS:
        next_payload[key] = None
    return next_payload


def build_post_batch_idle_control_state(
    control_state: Optional[Dict[str, Any]],
    *,
    now_iso: str,
) -> Dict[str, Any]:
    """Clear the live cursor after a batch without overriding an operator pause."""
    current = dict(control_state or {})
    pause_requested = (
        current.get("is_paused") is True
        or str(current.get("requested_state") or "").strip().lower() == "paused"
        or str(current.get("observed_state") or "").strip().lower() == "paused"
    )
    if pause_requested:
        return _mark_recovery_state(
            {
                **_clear_pipeline_runtime_state_fields(current),
                "is_paused": True,
                "desired_state": "paused",
                "requested_state": "paused",
                "observed_state": "paused",
                "transition_state": "paused",
                "updated_at": now_iso,
            },
            state="blocked_manual" if str(current.get("stop_reason") or "").strip().lower() == "manual_stop" else "degraded",
            health_class="blocked_manual" if str(current.get("stop_reason") or "").strip().lower() == "manual_stop" else "degraded",
        )
    return {
        "is_paused": False,
        "pause_reason": None,
        "stop_reason": None,
        "stop_details": None,
        "desired_state": "running",
        "requested_state": "running",
        "observed_state": "running",
        "transition_state": "running",
        "updated_at": now_iso,
    }


def should_skip_manifest_auto_advance_for_batch_metadata(batch_metadata: Optional[Dict[str, Any]]) -> bool:
    metadata = batch_metadata if isinstance(batch_metadata, dict) else {}
    source = str(metadata.get("source") or metadata.get("queue_source") or "").strip().lower()
    repair_source = str(metadata.get("repair_source") or metadata.get("repair_queue_source") or "").strip().lower()
    rerun_mode = str(metadata.get("rerun_mode") or "").strip().lower()
    question_id = str(metadata.get("question_id") or metadata.get("current_question_id") or "").strip()
    return bool(question_id) or rerun_mode == "question" or source == "self_healing_repair" or repair_source == "self_healing_repair"


def _mark_recovery_state(
    payload: Optional[Dict[str, Any]],
    *,
    state: str,
    health_class: Optional[str] = None,
    recovery_source: Optional[str] = None,
    last_self_heal_action: Optional[str] = None,
    last_self_heal_reason: Optional[str] = None,
    last_self_heal_at: Optional[str] = None,
) -> Dict[str, Any]:
    next_payload = dict(payload or {})
    next_payload["state"] = state
    next_payload["health_class"] = health_class or state
    next_payload["recovery_source"] = str(recovery_source or "").strip() or None
    if last_self_heal_action is not None:
        next_payload["last_self_heal_action"] = str(last_self_heal_action or "").strip() or None
    elif "last_self_heal_action" not in next_payload:
        next_payload["last_self_heal_action"] = None
    if last_self_heal_reason is not None:
        next_payload["last_self_heal_reason"] = str(last_self_heal_reason or "").strip() or None
    elif "last_self_heal_reason" not in next_payload:
        next_payload["last_self_heal_reason"] = None
    if last_self_heal_at is not None:
        next_payload["last_self_heal_at"] = str(last_self_heal_at or "").strip() or None
    elif "last_self_heal_at" not in next_payload:
        next_payload["last_self_heal_at"] = None
    return next_payload


def _should_auto_resume_from_pause(control_state: Dict[str, Any]) -> bool:
    stop_reason = str(control_state.get("stop_reason") or "").strip().lower()
    pause_reason = str(control_state.get("pause_reason") or "").strip().lower()
    reason = stop_reason or pause_reason
    return reason in RECOVERABLE_PIPELINE_PAUSE_REASONS


def normalize_pipeline_control_state_for_worker_start(now_iso: Optional[str] = None) -> Dict[str, Any]:
    control_state = read_pipeline_control_state()
    if control_state.get("is_paused") is True and not _should_auto_resume_from_pause(control_state):
        return write_pipeline_control_state(
            _mark_recovery_state({
                **control_state,
                "requested_state": "paused",
                "observed_state": "paused",
                "transition_state": "paused",
                "desired_state": "paused",
                "updated_at": now_iso or datetime.now(timezone.utc).isoformat(),
            },
                state="blocked_manual" if str(control_state.get("stop_reason") or "").strip().lower() == "manual_stop" else "degraded",
                health_class="blocked_manual" if str(control_state.get("stop_reason") or "").strip().lower() == "manual_stop" else "degraded",
            )
        )
    next_state = {
        **control_state,
        "is_paused": False,
        "pause_reason": None,
        "stop_reason": None,
        "stop_details": None,
        "desired_state": "running",
        "requested_state": "running",
        "observed_state": "running",
        "transition_state": "running",
        "updated_at": now_iso or datetime.now(timezone.utc).isoformat(),
    }
    return write_pipeline_control_state(_mark_recovery_state(next_state, state="healthy", health_class="healthy"))


def build_stop_reason_details(
    *,
    reason: str,
    entity_id: Optional[str] = None,
    canonical_entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    question_id: Optional[str] = None,
    phase: Optional[str] = None,
    error_type: Optional[str] = None,
    error_message: Optional[str] = None,
    batch_id: Optional[str] = None,
    attempts: Optional[int] = None,
) -> Dict[str, Any]:
    return {
        "reason": str(reason or "").strip() or None,
        "entity_id": str(entity_id or "").strip() or None,
        "canonical_entity_id": str(canonical_entity_id or "").strip() or None,
        "entity_name": str(entity_name or "").strip() or None,
        "question_id": str(question_id or "").strip() or None,
        "phase": str(phase or "").strip() or None,
        "error_type": str(error_type or "").strip() or None,
        "error_message": str(error_message or "").strip() or None,
        "batch_id": str(batch_id or "").strip() or None,
        "attempts": int(attempts) if attempts is not None else None,
    }


def log_worker_transition(event: str, **fields: Any) -> None:
    payload = {
        "event": str(event or "").strip() or "worker_transition",
        "worker_id": fields.pop("worker_id", None),
        "batch_id": fields.pop("batch_id", None),
        "entity_id": fields.pop("entity_id", None),
        "entity_name": fields.pop("entity_name", None),
        "question_id": fields.pop("question_id", None),
        "phase": fields.pop("phase", None),
        "status": fields.pop("status", None),
        "retry_state": fields.pop("retry_state", None),
        "stop_reason": fields.pop("stop_reason", None),
        "error_type": fields.pop("error_type", None),
        "attempts": fields.pop("attempts", None),
        "current_action": fields.pop("current_action", None),
        "message": fields.pop("message", None),
    }
    payload.update({key: value for key, value in fields.items() if value is not None})
    logger.info("WORKER %s", json.dumps(payload, sort_keys=True, default=str))


def should_process_in_process(queue_mode: Optional[str]) -> bool:
    return (queue_mode or "durable_worker") != "durable_worker"


def choose_supabase_key(
    *,
    service_role_key: Optional[str],
    anon_key: Optional[str],
    public_anon_key: Optional[str],
) -> Optional[str]:
    return anon_key or public_anon_key or service_role_key


def build_run_detail_url(batch_id: str, entity_id: str) -> str:
    return f"/entity-import/{batch_id}/{entity_id}"


def resolve_pipeline_timeout(timeout_seconds: int) -> Optional[int]:
    if timeout_seconds <= 0:
        return None
    return timeout_seconds


def is_uuid_like(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except (TypeError, ValueError, AttributeError):
        return False


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def should_defer_retry_for_fresh_backend_heartbeat(
    *,
    error_type: str,
    metadata: Optional[Dict[str, Any]],
    now_iso: Optional[str] = None,
    stale_seconds: int = LEASE_SECONDS,
) -> bool:
    if str(error_type or "").strip().lower() != "timeout":
        return False
    run_metadata = metadata if isinstance(metadata, dict) else {}
    if not str(run_metadata.get("backend_run_token") or "").strip():
        return False
    heartbeat_at = _parse_iso_datetime(
        run_metadata.get("backend_heartbeat_at")
        or run_metadata.get("backend_last_heartbeat_at")
        or run_metadata.get("backend_run_heartbeat_at")
    )
    if heartbeat_at is None:
        return False
    now = _parse_iso_datetime(now_iso) or datetime.now(timezone.utc)
    return (now - heartbeat_at) <= timedelta(seconds=max(1, int(stale_seconds or 1)))


def build_batch_claim_metadata(existing_metadata: Optional[Dict[str, Any]], *, worker_id: str, now_iso: str) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["attempt_count"] = int(metadata.get("attempt_count", 0) or 0) + 1
    metadata.update(
        {
            "queue_mode": "durable_worker",
            "worker_id": worker_id,
            "claimed_at": now_iso,
            "heartbeat_at": now_iso,
            "lease_expires_at": (datetime.fromisoformat(now_iso) + timedelta(seconds=LEASE_SECONDS)).isoformat(),
            "last_error": None,
        }
    )
    return metadata


def build_run_retry_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    retryable: bool,
    error_type: str,
    error_message: str,
    now_iso: str,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["attempt_count"] = int(metadata.get("attempt_count", 0) or 0) + 1
    metadata["retryable"] = retryable
    metadata["last_error_type"] = error_type
    metadata["last_error"] = error_message
    metadata["last_error_at"] = now_iso
    metadata["retry_state"] = "retrying" if retryable else "failed"
    return metadata


def _is_question_local_failure(error_type: str) -> bool:
    error_type = str(error_type or "").strip().lower()
    return error_type in {
        "question_processing_error",
        "question_schema_error",
        "question_model_error",
        "question_timeout",
        "question_runner_timeout",
        "json_decode",
        "value_error",
    }


def _is_nonblocking_terminal_failure(error_type: str) -> bool:
    error_type = str(error_type or "").strip().lower()
    if not error_type.startswith("http_"):
        return False
    try:
        status_code = int(error_type.split("_", 1)[1])
    except (TypeError, ValueError):
        return False
    return status_code in {400, 401, 403, 404, 410, 422}


def has_provider_infrastructure_failure(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        normalized = value.lower()
        return (
            OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR.lower() in normalized
            or "provider_infrastructure_failure" in normalized
            or "insufficient balance" in normalized
            or "no resource package" in normalized
        )
    if isinstance(value, list):
        return any(has_provider_infrastructure_failure(item) for item in value)
    if isinstance(value, dict):
        failure_name = str(value.get("failure_name") or "").strip()
        failure_class = str(value.get("failure_class") or value.get("failure_reason") or "").strip().lower()
        error_type = str(value.get("error_type") or value.get("last_error_type") or "").strip().lower()
        if (
            failure_name == OPENCODE_PROVIDER_INSUFFICIENT_BALANCE_ERROR
            or failure_class == "provider_infrastructure_failure"
            or error_type == "provider_infrastructure_failure"
        ):
            return True
        return any(has_provider_infrastructure_failure(item) for item in value.values())
    return False


def clear_provider_infrastructure_failure_metadata(existing_metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    if str(metadata.get("failure_class") or "").strip().lower() == "provider_infrastructure_failure":
        metadata.pop("failure_class", None)
    if str(metadata.get("failure_reason") or "").strip().lower() == "provider_infrastructure_failure":
        metadata.pop("failure_reason", None)
    if str(metadata.get("last_error_type") or "").strip().lower() == "provider_infrastructure_failure":
        metadata.pop("last_error_type", None)
    if str(metadata.get("stop_reason") or "").strip().lower() == "provider_infrastructure_failure":
        metadata.pop("stop_reason", None)
    if metadata.get("provider_failure") is True:
        metadata.pop("provider_failure", None)
    if metadata.get("stop_details") and str(metadata.get("stop_details", {}).get("reason") or "").strip().lower() == "provider_infrastructure_failure":
        metadata.pop("stop_details", None)
    return metadata


def _resolve_anthropic_compatible_base_url() -> str:
    return str(os.getenv("ANTHROPIC_BASE_URL") or "https://api.z.ai/api/anthropic/v1").strip() or "https://api.z.ai/api/anthropic/v1"


def _is_zai_anthropic_base_url(base_url: str) -> bool:
    return "api.z.ai" in str(base_url or "").strip().lower()


def _resolve_anthropic_compatible_api_key(base_url: str) -> Optional[str]:
    if _is_zai_anthropic_base_url(base_url):
        return (
            str(os.getenv("ZAI_API_KEY") or "").strip()
            or str(os.getenv("ANTHROPIC_AUTH_TOKEN") or "").strip()
            or str(os.getenv("ANTHROPIC_API_KEY") or "").strip()
            or None
        )
    return (
        str(os.getenv("ANTHROPIC_API_KEY") or "").strip()
        or str(os.getenv("ANTHROPIC_AUTH_TOKEN") or "").strip()
        or str(os.getenv("ZAI_API_KEY") or "").strip()
        or None
    )


def _anthropic_messages_url(base_url: str) -> str:
    normalized = str(base_url or "").rstrip("/")
    return f"{normalized}/messages" if normalized.endswith("/v1") else f"{normalized}/v1/messages"


def build_run_provider_infrastructure_failure_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    now_iso: str,
    error_message: str = "OpenCode provider infrastructure failure",
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["retryable"] = False
    metadata["retry_state"] = "failed"
    metadata["failure_class"] = "provider_infrastructure_failure"
    metadata["failure_reason"] = "provider_infrastructure_failure"
    metadata["provider_failure"] = True
    metadata["continue_pipeline_on_failure"] = False
    metadata["last_error"] = error_message
    metadata["last_error_type"] = "provider_infrastructure_failure"
    metadata["last_error_at"] = now_iso
    return metadata


def build_batch_heartbeat_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    now_iso: str,
    lease_seconds: int = LEASE_SECONDS,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["heartbeat_at"] = now_iso
    metadata["lease_expires_at"] = (datetime.fromisoformat(now_iso) + timedelta(seconds=lease_seconds)).isoformat()
    return metadata


def build_batch_running_update(existing_metadata: Optional[Dict[str, Any]], *, now_iso: str) -> Dict[str, Any]:
    return {
        "status": "running",
        "metadata": build_batch_heartbeat_metadata(existing_metadata, now_iso=now_iso),
    }


def build_batch_retry_update(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    now_iso: str,
    error_message: str,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["heartbeat_at"] = now_iso
    metadata["lease_expires_at"] = None
    metadata["last_error"] = error_message
    metadata["last_error_at"] = now_iso
    metadata["retry_state"] = "retrying"
    return {
        "status": "queued",
        "completed_at": None,
        "metadata": metadata,
    }


def build_batch_completed_update(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    worker_id: str,
    now_iso: str,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["worker_id"] = worker_id
    metadata["heartbeat_at"] = now_iso
    metadata["completed_at"] = now_iso
    metadata["lease_expires_at"] = None
    metadata["retry_state"] = "completed"
    return {
        "status": "completed",
        "completed_at": now_iso,
        "metadata": metadata,
    }


def build_batch_failed_update(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    now_iso: str,
) -> Dict[str, Any]:
    metadata = build_batch_heartbeat_metadata(existing_metadata, now_iso=now_iso)
    metadata["lease_expires_at"] = None
    metadata["retry_state"] = "failed"
    return {
        "status": "failed",
        "completed_at": now_iso,
        "metadata": metadata,
    }


def build_run_start_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    worker_id: str,
    now_iso: str,
    lease_seconds: int,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    for key in (
        "failure_class",
        "infrastructure_failure",
        "continue_pipeline_on_failure",
        "stop_reason",
        "stop_details",
    ):
        metadata.pop(key, None)
    metadata["attempt_count"] = int(metadata.get("attempt_count", 0) or 0) + 1
    metadata["lease_owner"] = worker_id
    metadata["lease_expires_at"] = (datetime.fromisoformat(now_iso) + timedelta(seconds=lease_seconds)).isoformat()
    metadata["retryable"] = False
    metadata["retry_state"] = "running"
    metadata["last_error"] = None
    metadata["last_error_type"] = None
    metadata["last_error_at"] = None
    if str(metadata.get("rerun_mode") or "").strip().lower() == "question" or str(metadata.get("repair_state") or "").strip().lower() == "queued":
        metadata["repair_state"] = "repairing"
        metadata["next_repair_status"] = "running"
        metadata["next_repair_batch_status"] = "running"
    return metadata


def build_run_success_metadata(existing_metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["retryable"] = False
    metadata["retry_state"] = "completed"
    metadata["last_error"] = None
    metadata["last_error_at"] = None
    metadata["last_error_type"] = None
    return metadata


def build_run_exhausted_retry_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    now_iso: str,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["retryable"] = False
    metadata["retry_state"] = "failed"
    metadata["last_error"] = metadata.get("last_error") or "Retry attempts exhausted"
    metadata["last_error_type"] = metadata.get("last_error_type") or "retry_exhausted"
    metadata["last_error_at"] = metadata.get("last_error_at") or now_iso
    return metadata


def build_run_timeout_failure_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    now_iso: str,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["retryable"] = False
    metadata["retry_state"] = "failed"
    metadata["failure_class"] = "entity_pipeline_timeout"
    metadata["continue_pipeline_on_failure"] = True
    metadata["last_error"] = "timed out"
    metadata["last_error_type"] = metadata.get("last_error_type") or "timeout"
    metadata["last_error_at"] = metadata.get("last_error_at") or now_iso
    return metadata


def question_first_checkpoint_answer_count(checkpoint: Optional[Dict[str, Any]]) -> int:
    if not isinstance(checkpoint, dict):
        return 0
    raw_count = checkpoint.get("questions_answered")
    if raw_count is not None:
        try:
            return max(0, int(raw_count or 0))
        except (TypeError, ValueError):
            pass
    answer_records = checkpoint.get("answer_records")
    if isinstance(answer_records, list):
        return len([record for record in answer_records if isinstance(record, dict)])
    answers = checkpoint.get("answers")
    if isinstance(answers, list):
        return len([answer for answer in answers if isinstance(answer, dict)])
    return 0


def extract_question_first_checkpoint_from_payload(payload: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None

    direct = payload.get("question_first_checkpoint")
    if isinstance(direct, dict):
        return deepcopy(direct)

    metadata = payload.get("metadata")
    if isinstance(metadata, dict) and isinstance(metadata.get("question_first_checkpoint"), dict):
        return deepcopy(metadata["question_first_checkpoint"])

    dossier_data = payload.get("dossier_data")
    if isinstance(dossier_data, dict):
        extracted = extract_question_first_checkpoint_from_payload(dossier_data)
        if extracted:
            return extracted

    question_first = payload.get("question_first")
    if isinstance(question_first, dict):
        answers = question_first.get("answers")
        if isinstance(answers, list) and answers:
            last_answer = next((answer for answer in reversed(answers) if isinstance(answer, dict)), {})
            return {
                "schema_version": "question_first_checkpoint_v1",
                "questions_answered": int(question_first.get("questions_answered") or len(answers)),
                "questions_total": question_first.get("questions_total"),
                "last_completed_question_id": str(last_answer.get("question_id") or "").strip() or None,
                "current_question_id": str(last_answer.get("question_id") or "").strip() or None,
                "answer_records": deepcopy(answers),
            }

    question_first_run = payload.get("question_first_run")
    if isinstance(question_first_run, dict):
        answer_records = question_first_run.get("answer_records")
        if isinstance(answer_records, list) and answer_records:
            last_answer = next((answer for answer in reversed(answer_records) if isinstance(answer, dict)), {})
            return {
                "schema_version": "question_first_checkpoint_v1",
                "questions_answered": int(question_first_run.get("questions_answered") or len(answer_records)),
                "questions_total": question_first_run.get("questions_total"),
                "last_completed_question_id": str(last_answer.get("question_id") or "").strip() or None,
                "current_question_id": str(last_answer.get("question_id") or "").strip() or None,
                "answer_records": deepcopy(answer_records),
            }

    return None


def should_queue_question_first_continuation(
    *,
    run_metadata: Optional[Dict[str, Any]],
    checkpoint: Optional[Dict[str, Any]],
    max_attempts: int,
) -> bool:
    if not isinstance(checkpoint, dict):
        return False
    next_question_id = str(checkpoint.get("next_question_id") or "").strip()
    if not next_question_id:
        return False
    questions_answered = question_first_checkpoint_answer_count(checkpoint)
    try:
        questions_total = int(checkpoint.get("questions_total") or 0)
    except (TypeError, ValueError):
        questions_total = 0
    if questions_total > 0 and questions_answered >= questions_total:
        return False
    metadata = run_metadata if isinstance(run_metadata, dict) else {}
    try:
        attempts = int(metadata.get("question_first_continuation_attempts") or 0)
    except (TypeError, ValueError):
        attempts = 0
    return attempts < max(0, int(max_attempts or 0))


def _derive_skip_note(metadata: Dict[str, Any]) -> str:
    note = str(metadata.get("last_error") or "").strip()
    if note:
        return note
    return "Question skipped after exhausting retry budget"


def merge_cached_entity_properties(
    existing_properties: Optional[Dict[str, Any]],
    *,
    batch_id: str,
    entity_id: str,
    status: str,
    sales_readiness: Optional[str],
    rfp_count: int,
    dossier: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    properties = deepcopy(existing_properties or {})
    if dossier:
        properties["dossier_data"] = json.dumps(dossier)
    properties["sales_readiness"] = sales_readiness
    properties["rfp_count"] = rfp_count
    properties["last_pipeline_batch_id"] = batch_id
    properties["last_pipeline_run_detail_url"] = build_run_detail_url(batch_id, entity_id)
    properties["last_pipeline_status"] = status
    properties["last_pipeline_run_at"] = datetime.now(timezone.utc).isoformat()
    return properties

class EntityPipelineWorker:
    def __init__(self) -> None:
        if should_use_local_pg():
            self.supabase = create_local_pg_client()
            self.worker_id = f"{socket.gethostname()}-{os.getpid()}"
            self.lease_seconds = LEASE_SECONDS
            self.max_run_attempts = MAX_RUN_ATTEMPTS
            self.repair_retry_budget = DEFAULT_REPAIR_RETRY_BUDGET
            return
        if create_client is None:
            raise RuntimeError("supabase package is required for entity pipeline worker runtime")
        supabase_url = (
            os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        )
        supabase_key = choose_supabase_key(
            service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
            anon_key=os.getenv("SUPABASE_ANON_KEY"),
            public_anon_key=os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        )
        if not supabase_url or not supabase_key:
            raise RuntimeError("Supabase credentials are required for entity pipeline worker")
        self.supabase = create_client(supabase_url, supabase_key)
        self.worker_id = f"{socket.gethostname()}-{os.getpid()}"
        self.lease_seconds = LEASE_SECONDS
        self.max_run_attempts = MAX_RUN_ATTEMPTS
        self.repair_retry_budget = DEFAULT_REPAIR_RETRY_BUDGET

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _batch_metadata(self, batch: Dict[str, Any]) -> Dict[str, Any]:
        metadata = batch.get("metadata") or {}
        return metadata if isinstance(metadata, dict) else {}

    def _write_terminal_stop_state(
        self,
        *,
        reason: str,
        pause_reason: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ) -> Dict[str, Any]:
        normalized_reason = str(reason or "").strip() or "orchestrator_unhealthy"
        if normalized_reason not in TERMINAL_STOP_REASONS:
            normalized_reason = "orchestrator_unhealthy"
        summary = str(pause_reason or "").strip() or normalized_reason.replace("_", " ")
        recovery_state = "degraded"
        if normalized_reason == "provider_infrastructure_failure":
            recovery_state = "blocked_provider"
        elif normalized_reason == "backend_route_missing":
            recovery_state = "blocked_backend"
        elif normalized_reason == "manual_stop":
            recovery_state = "blocked_manual"
        state = write_pipeline_control_state(
            _mark_recovery_state(
                _clear_pipeline_runtime_state_fields(
                    {
                        "is_paused": True,
                        "pause_reason": summary,
                        "stop_reason": normalized_reason,
                        "stop_details": details or None,
                        "desired_state": "paused",
                        "requested_state": "paused",
                        "observed_state": "paused",
                        "transition_state": "paused",
                    }
                ),
                state=recovery_state,
                health_class=recovery_state,
            )
        )
        log_worker_transition(
            "pipeline_control_stopped",
            worker_id=getattr(self, "worker_id", "worker-test"),
            stop_reason=normalized_reason,
            message=summary,
            **(details or {}),
        )
        return state

    def _backend_preflight(self) -> tuple[bool, str]:
        try:
            with urlopen(f"{FASTAPI_URL}/health", timeout=5) as response:
                health = json.loads(response.read().decode("utf-8"))
            if health.get("status") != "healthy" or health.get("version") != "2.0.0":
                return False, "backend_route_missing"
            with urlopen(f"{FASTAPI_URL}/openapi.json", timeout=5) as response:
                openapi = json.loads(response.read().decode("utf-8"))
            if "/api/pipeline/run-entity" not in (openapi.get("paths") or {}):
                return False, "backend_route_missing"
            return True, ""
        except Exception:
            return False, "backend_route_missing"

    def _provider_preflight(self) -> tuple[bool, str]:
        base_url = _resolve_anthropic_compatible_base_url()
        api_key = _resolve_anthropic_compatible_api_key(base_url)
        if not api_key:
            return False, "provider_infrastructure_failure"
        request = Request(
            _anthropic_messages_url(base_url),
            data=json.dumps(
                {
                    "model": (
                        str(os.getenv("ANTHROPIC_DEFAULT_OPUS_MODEL") or "").strip()
                        or str(os.getenv("ANTHROPIC_DEFAULT_SONNET_MODEL") or "").strip()
                        or "GLM-5.1"
                    ),
                    "max_tokens": 16,
                    "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
                }
            ).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-api-key": api_key,
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=10) as response:
                return (200 <= int(getattr(response, "status", 0) or 0) < 300), ""
        except HTTPError as error:
            try:
                error_body = error.read().decode("utf-8", errors="replace")
            except Exception:
                error_body = str(error)
            logger.warning("Provider preflight failed: %s", error_body)
            return False, "provider_infrastructure_failure"
        except Exception as error:
            logger.warning("Provider preflight failed: %s", error)
            return False, "provider_infrastructure_failure"

    def _is_backend_route_missing_error(self, error: Exception) -> bool:
        if not isinstance(error, HTTPError):
            return False
        return error.code == 404 and "/api/pipeline/run-entity" in str(getattr(error, "url", ""))

    def _requeue_infrastructure_blocked_batch(
        self,
        *,
        batch_id: str,
        batch: Dict[str, Any],
        run: Dict[str, Any],
        run_metadata: Dict[str, Any],
        error: Exception,
    ) -> None:
        latest_metadata = self._get_run_metadata(batch_id, run["entity_id"])
        now_iso = self._now_iso()
        metadata_source = latest_metadata if isinstance(latest_metadata, dict) and latest_metadata else run_metadata
        run_update_metadata = {
            **(metadata_source if isinstance(metadata_source, dict) else {}),
            "retry_state": "queued",
            "infrastructure_failure": True,
            "failure_class": "backend_route_missing",
            "last_error_type": "backend_route_missing",
            "last_error": str(error),
            "last_error_at": now_iso,
        }
        self.update_run(
            batch_id,
            run["entity_id"],
            {
                "status": "queued",
                "phase": run.get("phase") or "entity_registration",
                "error_message": "backend_route_missing",
                "completed_at": None,
                "metadata": run_update_metadata,
            },
        )
        batch_metadata = self._batch_metadata(batch)
        blocked_batch_metadata = {
            **batch_metadata,
            "blocked_by_infrastructure": True,
            "failure_class": "backend_route_missing",
            "last_error": str(error),
            "last_error_at": now_iso,
        }
        self._safe_execute(
            lambda: self.supabase.table("entity_import_batches").update(
                {
                    "status": "queued",
                    "completed_at": None,
                    "metadata": blocked_batch_metadata,
                }
            ).eq("id", batch_id).execute(),
            context=f"requeue infrastructure blocked batch {batch_id}",
        )
        self._write_terminal_stop_state(
            reason="backend_route_missing",
            pause_reason="backend pipeline route missing",
            details=build_stop_reason_details(
                reason="backend_route_missing",
                entity_id=run.get("entity_id"),
                canonical_entity_id=run.get("canonical_entity_id") or run_metadata.get("canonical_entity_id"),
                entity_name=run.get("entity_name"),
                question_id=run_metadata.get("question_id") or run_metadata.get("current_question_id"),
                phase=run.get("phase"),
                error_type="backend_route_missing",
                error_message=str(error),
                batch_id=batch_id,
            ),
        )

    def _safe_execute(self, operation, *, context: str) -> bool:
        try:
            operation()
            return True
        except Exception as error:
            logger.warning("Worker Supabase operation failed during %s: %s", context, error)
            return False

    def refresh_batch_heartbeat(self, batch_id: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        lease_seconds = getattr(self, "lease_seconds", LEASE_SECONDS)
        worker_id = getattr(self, "worker_id", "worker-test")
        now_iso = self._now_iso()
        _touch_supervisor_activity(now_iso)
        heartbeat_metadata = build_batch_heartbeat_metadata(
            metadata,
            now_iso=now_iso,
            lease_seconds=lease_seconds,
        )
        self._safe_execute(
            lambda: self.supabase.rpc(
                "renew_entity_import_batch_lease",
                {
                    "batch_id": batch_id,
                    "worker_id": worker_id,
                    "lease_seconds": lease_seconds,
                },
            ).execute(),
            context=f"heartbeat refresh for {batch_id}",
        )
        try:
            active_runs_response = self.supabase.table("entity_pipeline_runs").select("id, metadata").eq("batch_id", batch_id).in_(
                "status",
                ["queued", "claiming", "running", "retrying"],
            ).execute()
            active_runs = active_runs_response.data or []
        except Exception as error:
            logger.warning("Worker could not refresh active run metadata for %s: %s", batch_id, error)
            active_runs = []
        for active_run in active_runs:
            if not isinstance(active_run, dict):
                continue
            run_id = str(active_run.get("id") or "").strip()
            if not run_id:
                continue
            run_metadata = active_run.get("metadata") if isinstance(active_run.get("metadata"), dict) else {}
            merged_metadata = build_batch_heartbeat_metadata(
                run_metadata,
                now_iso=now_iso,
                lease_seconds=lease_seconds,
            )
            merged_metadata["worker_id"] = worker_id
            self._safe_execute(
                lambda run_id=run_id, merged_metadata=merged_metadata: self.supabase.table("entity_pipeline_runs").update(
                    {"metadata": merged_metadata}
                ).eq("id", run_id).execute(),
                context=f"heartbeat refresh for run {batch_id}/{run_id}",
            )
        return heartbeat_metadata

    def _start_batch_heartbeat(self, batch_id: str, metadata: Optional[Dict[str, Any]]) -> tuple[threading.Event, threading.Thread]:
        stop_event = threading.Event()

        def heartbeat_loop() -> None:
            current_metadata = deepcopy(metadata or {})
            while not stop_event.wait(POLL_INTERVAL_SECONDS):
                current_metadata = self.refresh_batch_heartbeat(batch_id, current_metadata)

        thread = threading.Thread(target=heartbeat_loop, daemon=True)
        thread.start()
        return stop_event, thread

    def recover_stale_batches(self) -> None:
        stale_before = (datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)).isoformat()
        self._safe_execute(
            lambda: self.supabase.rpc(
                "requeue_stale_entity_import_batches",
                {"stale_before": stale_before},
            ).execute(),
            context="stale batch recovery",
        )

    def reconcile_stale_pipeline_state(self) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        stale_runs: list[dict[str, Any]] = []
        try:
            response = (
                self.supabase.table("entity_pipeline_runs")
                .select("batch_id, entity_id, canonical_entity_id, entity_name, status, phase, started_at, completed_at, metadata")
                .in_("status", ["running", "retrying"])
                .order("started_at", desc=False)
                .limit(200)
                .execute()
            )
            stale_runs = response.data or []
        except Exception as error:
            logger.warning("Failed to inspect stale pipeline runs: %s", error)
            return {"quarantined_runs": 0, "cleared_current_pointer": False}

        quarantined_runs = 0
        stale_batch_ids: set[str] = set()
        stale_entity_ids: set[str] = set()
        for row in stale_runs:
            if not isinstance(row, dict):
                continue
            metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
            lease_expires_at = _parse_iso_datetime(metadata.get("lease_expires_at"))
            heartbeat_at = _parse_iso_datetime(metadata.get("heartbeat_at"))
            started_at = _parse_iso_datetime(row.get("started_at"))
            is_stale = False
            if lease_expires_at is not None:
                is_stale = lease_expires_at <= now
            elif heartbeat_at is not None:
                is_stale = heartbeat_at <= (now - timedelta(minutes=STALE_MINUTES))
            elif started_at is not None:
                is_stale = started_at <= (now - timedelta(minutes=STALE_MINUTES))
            if not is_stale:
                continue

            stale_batch_id = str(row.get("batch_id") or "").strip()
            stale_entity_id = str(row.get("entity_id") or "").strip()
            stale_batch_ids.add(stale_batch_id)
            stale_entity_ids.add(stale_entity_id)
            next_metadata = deepcopy(metadata)
            next_metadata["failure_class"] = "stale_pipeline_run_quarantined"
            next_metadata["continue_pipeline_on_failure"] = True
            next_metadata["retry_state"] = "failed"
            next_metadata["recovery_source"] = "stale_run_quarantine"
            next_metadata["last_error_type"] = "stale_pipeline_run_quarantined"
            next_metadata["last_error"] = "stale pipeline run quarantined"
            next_metadata["last_error_at"] = now_iso
            next_metadata["stop_reason"] = "stale_pipeline_run_quarantined"
            next_metadata["stop_details"] = build_stop_reason_details(
                reason="stale_pipeline_run_quarantined",
                entity_id=stale_entity_id or None,
                canonical_entity_id=str(row.get("canonical_entity_id") or metadata.get("canonical_entity_id") or "").strip() or None,
                entity_name=str(row.get("entity_name") or "").strip() or None,
                question_id=str(metadata.get("question_id") or metadata.get("current_question_id") or "").strip() or None,
                phase=str(row.get("phase") or "").strip() or None,
                error_type="stale_pipeline_run_quarantined",
                error_message="stale pipeline run quarantined",
                batch_id=stale_batch_id or None,
            )
            self.update_run(
                stale_batch_id,
                stale_entity_id,
                {
                    "status": "failed",
                    "phase": row.get("phase") or "dossier_generation",
                    "error_message": "stale pipeline run quarantined",
                    "completed_at": now_iso,
                    "metadata": next_metadata,
                },
            )
            quarantined_runs += 1

        control_state = read_pipeline_control_state()
        current_batch_id = str(control_state.get("current_batch_id") or "").strip()
        current_entity_id = str(control_state.get("current_entity_id") or "").strip()
        should_clear_current_pointer = (
            (current_batch_id and current_batch_id in stale_batch_ids)
            or (current_entity_id and current_entity_id in stale_entity_ids)
        )
        if quarantined_runs > 0 or should_clear_current_pointer:
            next_state = dict(control_state)
            if should_clear_current_pointer:
                next_state = _clear_pipeline_runtime_state_fields(next_state)
            next_state.update(
                {
                    "requested_state": "running",
                    "observed_state": "running",
                    "transition_state": "running",
                    "desired_state": "running",
                    "is_paused": False,
                    "pause_reason": None,
                    "stop_reason": None,
                    "stop_details": None,
                    "updated_at": now_iso,
                }
            )
            next_state = _mark_recovery_state(
                next_state,
                state="stale_state_repair",
                health_class="stale_state_repair",
                recovery_source="stale_run_quarantine",
                last_self_heal_action="stale_run_quarantine",
                last_self_heal_reason="quarantined stale pipeline runs",
                last_self_heal_at=now_iso,
            )
            write_pipeline_control_state(next_state)
        return {
            "quarantined_runs": quarantined_runs,
            "cleared_current_pointer": should_clear_current_pointer,
        }

    def claim_next_batch(self) -> Optional[Dict[str, Any]]:
        control_state = read_pipeline_control_state()
        cursor_entity_id, cursor_canonical_entity_id = _extract_pipeline_cursor_state(control_state)
        backend_ready = False
        backend_stop_reason = None
        provider_ready = False
        provider_stop_reason = None
        if control_state.get("is_paused") is True:
            if _should_auto_resume_from_pause(control_state):
                backend_ready, backend_stop_reason = self._backend_preflight()
                if backend_ready:
                    provider_ready, provider_stop_reason = self._provider_preflight()
                if backend_ready and provider_ready:
                    control_state = write_pipeline_control_state(
                        _mark_recovery_state(
                            _clear_pipeline_runtime_state_fields(
                                {
                                    **control_state,
                                    "requested_state": "running",
                                    "observed_state": "running",
                                    "transition_state": "running",
                                    "is_paused": False,
                                    "pause_reason": None,
                                    "stop_reason": None,
                                    "stop_details": None,
                                    "updated_at": self._now_iso(),
                                }
                            ),
                            state="recovering",
                            health_class="recovering",
                            recovery_source="provider_auto_resume",
                            last_self_heal_action="provider_auto_resume",
                            last_self_heal_reason="provider preflight recovered",
                            last_self_heal_at=self._now_iso(),
                        )
                    )
                    logger.info(
                        "Pipeline intake self-healed from pause; reason=%s",
                        control_state.get("pause_reason") or control_state.get("stop_reason") or "unspecified",
                    )
                    log_worker_transition(
                        "claim_auto_resumed",
                        worker_id=getattr(self, "worker_id", "worker-test"),
                        status="running",
                        stop_reason=control_state.get("stop_reason"),
                        message=control_state.get("pause_reason") or "auto-resumed",
                    )
                elif backend_ready and provider_stop_reason == "provider_infrastructure_failure":
                    logger.info("Pipeline intake remains paused; provider preflight failed")
                    log_worker_transition(
                        "claim_auto_resume_blocked",
                        worker_id=getattr(self, "worker_id", "worker-test"),
                        status="paused",
                        stop_reason="provider_infrastructure_failure",
                        message="provider preflight failed",
                    )
                    return None
                else:
                    self._write_terminal_stop_state(
                        reason=backend_stop_reason,
                        pause_reason="backend pipeline route missing",
                        details={
                            "backend_url": FASTAPI_URL,
                            "pipeline_route": "/api/pipeline/run-entity",
                        },
                    )
                    return None
            else:
                write_pipeline_control_state(
                    {
                        **control_state,
                        "requested_state": "paused",
                        "observed_state": "paused",
                        "transition_state": "paused",
                        "updated_at": self._now_iso(),
                    }
                )
                logger.info(
                    "Pipeline intake is paused; skipping queue claim. reason=%s",
                    control_state.get("pause_reason") or "unspecified",
                )
                log_worker_transition(
                    "claim_skipped_paused",
                    worker_id=getattr(self, "worker_id", "worker-test"),
                    status="paused",
                    stop_reason=control_state.get("stop_reason"),
                    message=control_state.get("pause_reason") or "paused",
                )
                return None
        if not backend_ready:
            backend_ready, backend_stop_reason = self._backend_preflight()
            if not backend_ready:
                self._write_terminal_stop_state(
                    reason=backend_stop_reason,
                    pause_reason="backend pipeline route missing",
                    details={
                        "backend_url": FASTAPI_URL,
                        "pipeline_route": "/api/pipeline/run-entity",
                    },
                )
                return None
        control_state = write_pipeline_control_state(
            _mark_recovery_state(
                {
                    **control_state,
                    "requested_state": "running",
                    "observed_state": "running",
                    "transition_state": "running",
                    "is_paused": False,
                    "pause_reason": None,
                    "stop_reason": None,
                    "stop_details": None,
                    "updated_at": self._now_iso(),
                },
                state="healthy",
                health_class="healthy",
            )
        )
        log_worker_transition(
            "pipeline_control_running",
            worker_id=getattr(self, "worker_id", "worker-test"),
            status="running",
            message="pipeline intake running",
        )
        self.reconcile_stale_pipeline_state()
        self.recover_stale_batches()
        response = self.supabase.rpc(
            "claim_next_entity_import_batch",
            {
                "worker_id": self.worker_id,
                "lease_seconds": self.lease_seconds,
            },
        ).execute()
        batches = response.data or []
        if batches:
            claimed = batches[0]
            self._persist_pipeline_cursor_state(
                claimed,
                cursor_source="queued_claim",
                control_state=control_state,
            )
            log_worker_transition(
                "batch_claimed",
                worker_id=getattr(self, "worker_id", "worker-test"),
                batch_id=claimed.get("id"),
                entity_id=claimed.get("entity_id"),
                entity_name=claimed.get("entity_name"),
                phase=claimed.get("phase"),
                status=str(claimed.get("status") or "queued").strip().lower() or "queued",
                cursor_source="queued_claim",
                message="claimed queued entity batch",
            )
            return claimed

        if self._should_stop_after_scoped_batch(control_state):
            log_worker_transition(
                "claim_cycle_scoped_batch_boundary",
                worker_id=getattr(self, "worker_id", "worker-test"),
                batch_id=control_state.get("current_batch_id"),
                entity_id=control_state.get("current_entity_id"),
                entity_name=control_state.get("current_entity_name"),
                status="idle",
                message="scoped batch completed; cursor resume disabled",
            )
            return None

        if cursor_entity_id or cursor_canonical_entity_id:
            resume_candidate = self._select_next_entity_cursor_candidate(
                current_entity_id=cursor_entity_id or "",
                current_canonical_entity_id=cursor_canonical_entity_id,
                include_manifest_fallback=False,
            )
            if resume_candidate:
                materialized_batch_id = self._materialize_entity_cursor_candidate(
                    resume_candidate,
                    queue_mode="durable_worker",
                )
                if materialized_batch_id:
                    claimed_batches = self.supabase.rpc(
                        "claim_next_entity_import_batch",
                        {
                            "worker_id": self.worker_id,
                            "lease_seconds": self.lease_seconds,
                        },
                    ).execute().data or []
                    if claimed_batches:
                        claimed = claimed_batches[0]
                        self._persist_pipeline_cursor_state(
                            claimed,
                            cursor_source="resume_claim",
                            control_state=control_state,
                        )
                        log_worker_transition(
                            "batch_claimed",
                            worker_id=getattr(self, "worker_id", "worker-test"),
                            batch_id=claimed.get("id"),
                            entity_id=claimed.get("entity_id"),
                            entity_name=claimed.get("entity_name"),
                            phase=claimed.get("phase"),
                            status=str(claimed.get("status") or "queued").strip().lower() or "queued",
                            cursor_source="resume_claim",
                            message="claimed resumable entity cursor batch",
                        )
                        return claimed

        candidate = self._select_next_entity_cursor_candidate(
            current_entity_id=cursor_entity_id or "",
            current_canonical_entity_id=cursor_canonical_entity_id,
            include_manifest_fallback=True,
        )
        if candidate:
            materialized_batch_id = self._materialize_entity_cursor_candidate(
                candidate,
                queue_mode="durable_worker",
            )
            if materialized_batch_id:
                claimed_batches = self.supabase.rpc(
                    "claim_next_entity_import_batch",
                    {
                        "worker_id": self.worker_id,
                        "lease_seconds": self.lease_seconds,
                    },
                ).execute().data or []
                if claimed_batches:
                    claimed = claimed_batches[0]
                    self._persist_pipeline_cursor_state(
                        claimed,
                        cursor_source="manifest_next_claim",
                        control_state=control_state,
                    )
                    log_worker_transition(
                        "batch_claimed",
                        worker_id=getattr(self, "worker_id", "worker-test"),
                        batch_id=claimed.get("id"),
                        entity_id=claimed.get("entity_id"),
                        entity_name=claimed.get("entity_name"),
                        phase=claimed.get("phase"),
                        status=str(claimed.get("status") or "queued").strip().lower() or "queued",
                        cursor_source="manifest_next_claim",
                        message="claimed manifest-next entity cursor batch",
                    )
                    return claimed
        log_worker_transition(
            "claim_cycle_empty",
            worker_id=getattr(self, "worker_id", "worker-test"),
            status="idle",
            message="no claimable batch available",
        )
        return None

    def _should_stop_after_scoped_batch(self, control_state: Dict[str, Any]) -> bool:
        batch_id = str((control_state or {}).get("current_batch_id") or "").strip()
        if not batch_id:
            return False
        try:
            batch = self._get_batch_record(batch_id)
        except Exception:
            return False
        metadata = batch.get("metadata") if isinstance(batch, dict) and isinstance(batch.get("metadata"), dict) else {}
        return (
            metadata.get("suppress_cursor_resume_after_batch") is True
            or metadata.get("targeted_pilot") is True
            or str(metadata.get("auto_advance_guard") or "").strip().lower() in {"manual_batch_only", "pilot_batch_only"}
        )

    def _persist_pipeline_cursor_state(
        self,
        batch: Dict[str, Any],
        *,
        cursor_source: str,
        control_state: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not isinstance(batch, dict):
            return
        next_state = dict(control_state or read_pipeline_control_state())
        metadata = batch.get("metadata") if isinstance(batch.get("metadata"), dict) else {}
        projected_cursor = _project_live_cursor_fields(batch=batch, metadata=metadata, now_iso=self._now_iso())
        batch_identity = self._resolve_batch_cursor_identity(batch)
        next_state.update(
            {
                **projected_cursor,
                "current_entity_id": batch_identity.get("current_entity_id") or projected_cursor.get("current_entity_id") or next_state.get("current_entity_id"),
                "current_canonical_entity_id": batch_identity.get("current_canonical_entity_id") or projected_cursor.get("current_canonical_entity_id") or next_state.get("current_canonical_entity_id"),
                "current_entity_name": batch_identity.get("current_entity_name") or projected_cursor.get("current_entity_name") or next_state.get("current_entity_name"),
                "cursor_source": cursor_source,
            }
        )
        next_state = _mark_recovery_state(
            next_state,
            state="healthy",
            health_class="healthy",
            recovery_source=cursor_source,
        )
        try:
            write_pipeline_control_state(next_state)
        except Exception as error:
            logger.warning("Failed to persist pipeline cursor state: %s", error)

    def _resolve_batch_cursor_identity(self, batch: Dict[str, Any]) -> Dict[str, Optional[str]]:
        metadata = batch.get("metadata") if isinstance(batch.get("metadata"), dict) else {}
        current_entity_id = str(batch.get("entity_id") or "").strip() or None
        current_canonical_entity_id = str(
            batch.get("canonical_entity_id")
            or metadata.get("canonical_entity_id")
            or ""
        ).strip() or None
        current_entity_name = str(batch.get("entity_name") or "").strip() or None

        batch_id = str(batch.get("id") or "").strip()
        if batch_id and (current_entity_id is None or current_entity_name is None):
            looked_up: Dict[str, Any] = {}

            def _lookup_batch_run_identity() -> None:
                response = self.supabase.table("entity_pipeline_runs").select(
                    "entity_id, entity_name, canonical_entity_id"
                ).eq("batch_id", batch_id).limit(1).execute()
                rows = getattr(response, "data", None) or []
                if isinstance(rows, list) and rows and isinstance(rows[0], dict):
                    looked_up.update(rows[0])

            if self._safe_execute(_lookup_batch_run_identity, context=f"resolve batch identity {batch_id}"):
                current_entity_id = current_entity_id or str(looked_up.get("entity_id") or "").strip() or None
                current_canonical_entity_id = current_canonical_entity_id or str(
                    looked_up.get("canonical_entity_id") or looked_up.get("entity_id") or ""
                ).strip() or None
                current_entity_name = current_entity_name or str(looked_up.get("entity_name") or "").strip() or None

        if current_entity_id and not current_canonical_entity_id:
            current_canonical_entity_id = current_entity_id
        if current_entity_id and not current_entity_name:
            current_entity_name = current_entity_id
        return {
            "current_entity_id": current_entity_id,
            "current_canonical_entity_id": current_canonical_entity_id,
            "current_entity_name": current_entity_name,
        }

    def get_batch_runs(self, batch_id: str) -> list[Dict[str, Any]]:
        response = (
            self.supabase.table("entity_pipeline_runs")
            .select("*")
            .eq("batch_id", batch_id)
            .order("started_at")
            .execute()
        )
        return response.data or []

    def call_pipeline(self, run: Dict[str, Any], batch_id: str) -> Dict[str, Any]:
        batch_metadata = self._get_batch_metadata(batch_id) if hasattr(self, "supabase") else {}
        run_metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
        canonical_entity_id = str(
            run.get("canonical_entity_id")
            or run_metadata.get("canonical_entity_id")
            or batch_metadata.get("canonical_entity_id")
            or ""
        ).strip() or None
        merged_metadata = {
            **(batch_metadata if isinstance(batch_metadata, dict) else {}),
            **(run_metadata if isinstance(run_metadata, dict) else {}),
        }
        if canonical_entity_id:
            merged_metadata["canonical_entity_id"] = canonical_entity_id
        payload = {
            "batch_id": batch_id,
            "entity_id": run["entity_id"],
            "canonical_entity_id": canonical_entity_id,
            "entity_name": run["entity_name"],
            "entity_type": str(merged_metadata.get("entity_type") or "CLUB"),
            "priority_score": int(merged_metadata.get("priority_score") or 50),
            "run_objective": str(merged_metadata.get("run_objective") or "dossier_core"),
            "metadata": merged_metadata,
        }
        started_at = time.perf_counter()
        logger.info(
            "Calling pipeline endpoint for batch=%s entity=%s phase=%s timeout_seconds=%s",
            batch_id,
            run.get("entity_id"),
            run.get("phase"),
            PIPELINE_TIMEOUT_SECONDS,
        )
        log_worker_transition(
            "pipeline_call_start",
            worker_id=getattr(self, "worker_id", "worker-test"),
            batch_id=batch_id,
            entity_id=run.get("entity_id"),
            entity_name=run.get("entity_name"),
            phase=run.get("phase"),
            status=str(run.get("status") or "").strip().lower() or None,
            current_action=str(run.get("phase") or "").strip() or None,
            message=f"calling {FASTAPI_URL}/api/pipeline/run-entity",
        )
        request = Request(
            f"{FASTAPI_URL}/api/pipeline/run-entity",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=resolve_pipeline_timeout(PIPELINE_TIMEOUT_SECONDS)) as response:
            response_body = json.loads(response.read().decode("utf-8"))
        logger.info(
            "Pipeline response received for batch=%s entity=%s duration_seconds=%.2f",
            batch_id,
            run.get("entity_id"),
            time.perf_counter() - started_at,
        )
        log_worker_transition(
            "pipeline_call_complete",
            worker_id=getattr(self, "worker_id", "worker-test"),
            batch_id=batch_id,
            entity_id=run.get("entity_id"),
            entity_name=run.get("entity_name"),
            phase=run.get("phase"),
            status=str(response_body.get("status") or "").strip().lower() or None,
            current_action=str(response_body.get("phase") or response_body.get("current_action") or run.get("phase") or "").strip() or None,
            message="pipeline response received",
            duration_seconds=round(time.perf_counter() - started_at, 2),
        )
        return response_body

    def sync_cached_entity(self, batch_id: str, run: Dict[str, Any], result: Optional[Dict[str, Any]], status: str) -> None:
        run_metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
        canonical_entity_id = str(
            run.get("canonical_entity_id")
            or run_metadata.get("canonical_entity_id")
            or ""
        ).strip()
        entity_id = canonical_entity_id or str(run.get("entity_id") or "").strip()

        lookup = None
        if canonical_entity_id or is_uuid_like(entity_id):
            lookup = (
                self.supabase.table("canonical_entities")
                .select("id, properties")
                .eq("id", entity_id)
                .limit(1)
                .execute()
            )
        # Fallback: match by source_neo4j_ids containing the entity_id
        if lookup is None or not (lookup.data or []):
            lookup = (
                self.supabase.table("canonical_entities")
                .select("id, properties")
                .contains("source_neo4j_ids", [entity_id])
                .limit(1)
                .execute()
            )
        cached_entity = (lookup.data or [{}])[0]
        properties = merge_cached_entity_properties(
            cached_entity.get("properties"),
            batch_id=batch_id,
            entity_id=run["entity_id"],
            status=status,
            sales_readiness=(result or {}).get("sales_readiness"),
            rfp_count=int((result or {}).get("rfp_count") or 0),
            dossier=((result or {}).get("artifacts") or {}).get("dossier"),
        )
        cache_row_id = cached_entity.get("id")
        if cache_row_id:
            update_query = self.supabase.table("canonical_entities").update({"properties": properties}).eq("id", cache_row_id)
        else:
            logger.warning("sync_cached_entity: no canonical_entities row found for entity_id=%s, skipping update", entity_id)
            return
        self._safe_execute(
            lambda: update_query.execute(),
            context=f"sync cached entity {run['entity_id']}",
        )

    def persist_monitoring_outputs(self, batch_id: str, run: Dict[str, Any], result: Dict[str, Any]) -> None:
        artifacts = (result or {}).get("artifacts") or {}
        dossier = artifacts.get("dossier") or {}
        dossier_metadata = dossier.get("metadata") if isinstance(dossier, dict) else {}
        monitoring_result = artifacts.get("monitoring_result") or {}

        canonical_sources = dossier_metadata.get("canonical_sources") if isinstance(dossier_metadata, dict) else {}
        if isinstance(canonical_sources, dict) and canonical_sources:
            registry_rows = [
                {
                    "entity_id": run["entity_id"],
                    "page_class": page_class,
                    "url": url,
                    "source": "dossier_generation",
                    "confidence": 0.9,
                    "is_canonical": True,
                    "last_verified_at": self._now_iso(),
                    "metadata": {
                        "batch_id": batch_id,
                        "run_id": run.get("id") or f"{batch_id}_{run['entity_id']}",
                    },
                }
                for page_class, url in canonical_sources.items()
                if isinstance(url, str) and url.strip()
            ]
            if registry_rows:
                self._safe_execute(
                    lambda: self.supabase.table("entity_source_registry").upsert(
                        registry_rows,
                        on_conflict="entity_id,page_class,url",
                    ).execute(),
                    context=f"persist source registry {run['entity_id']}",
                )

        snapshots = monitoring_result.get("snapshots") or []
        if snapshots:
            snapshot_rows = [
                {
                    "entity_id": snapshot.get("entity_id") or run["entity_id"],
                    "page_class": snapshot.get("page_class"),
                    "url": snapshot.get("url"),
                    "content_hash": snapshot.get("content_hash"),
                    "fetched_at": snapshot.get("fetched_at"),
                    "changed": bool(snapshot.get("changed")),
                    "metadata": snapshot.get("metadata") or {},
                }
                for snapshot in snapshots
                if snapshot.get("page_class") and snapshot.get("url") and snapshot.get("content_hash")
            ]
            if snapshot_rows:
                self._safe_execute(
                    lambda: self.supabase.table("entity_source_snapshots").insert(snapshot_rows).execute(),
                    context=f"persist source snapshots {run['entity_id']}",
                )

        candidates = monitoring_result.get("candidates") or []
        if candidates:
            candidate_rows = [
                {
                    "entity_id": candidate.get("entity_id") or run["entity_id"],
                    "batch_id": candidate.get("batch_id") or batch_id,
                    "run_id": candidate.get("run_id") or run.get("id") or f"{batch_id}_{run['entity_id']}",
                    "page_class": candidate.get("page_class"),
                    "url": candidate.get("url"),
                    "content_hash": candidate.get("content_hash"),
                    "candidate_type": candidate.get("candidate_type"),
                    "score": candidate.get("score") or 0,
                    "evidence_excerpt": candidate.get("evidence_excerpt"),
                    "metadata": {
                        **(candidate.get("metadata") or {}),
                        "validation_result": ((candidate.get("metadata") or {}).get("validation_result") or None),
                    },
                }
                for candidate in candidates
                if candidate.get("page_class") and candidate.get("url") and candidate.get("candidate_type")
            ]
            if candidate_rows:
                self._safe_execute(
                    lambda: self.supabase.table("entity_monitoring_candidates").insert(candidate_rows).execute(),
                    context=f"persist monitoring candidates {run['entity_id']}",
                )

    def update_run(self, batch_id: str, entity_id: str, updates: Dict[str, Any]) -> None:
        self._safe_execute(
            lambda: self.supabase.table("entity_pipeline_runs").update(updates).eq(
                "batch_id", batch_id
            ).eq("entity_id", entity_id).execute(),
            context=f"update run {batch_id}/{entity_id}",
        )

    def _get_run_metadata(self, batch_id: str, entity_id: str) -> Dict[str, Any]:
        response = (
            self.supabase.table("entity_pipeline_runs")
            .select("metadata")
            .eq("batch_id", batch_id)
            .eq("entity_id", entity_id)
            .limit(1)
            .execute()
        )
        metadata = ((response.data or [{}])[0]).get("metadata")
        return metadata if isinstance(metadata, dict) else {}

    def _get_batch_metadata(self, batch_id: str) -> Dict[str, Any]:
        response = (
            self.supabase.table("entity_import_batches")
            .select("metadata")
            .eq("id", batch_id)
            .limit(1)
            .execute()
        )
        metadata = ((response.data or [{}])[0]).get("metadata")
        return metadata if isinstance(metadata, dict) else {}

    def _get_batch_record(self, batch_id: str) -> Dict[str, Any]:
        response = (
            self.supabase.table("entity_import_batches")
            .select("*")
            .eq("id", batch_id)
            .limit(1)
            .execute()
        )
        batch = (response.data or [{}])[0]
        return batch if isinstance(batch, dict) else {}

    def _load_manifest_entities(self) -> list[Dict[str, Any]]:
        entities: list[Dict[str, Any]] = []
        start = 0
        page_size = 500

        while True:
            response = (
                self.supabase.table("canonical_entities")
                .select("id, name, entity_type, sport, country, league, labels, properties, source_neo4j_ids")
                .range(start, start + page_size - 1)
                .execute()
            )
            rows = response.data or []
            if not rows:
                break

            for row in rows:
                if not isinstance(row, dict):
                    continue
                entity_id = str(row.get("id") or "").strip()
                if not entity_id:
                    continue
                properties = row.get("properties") if isinstance(row.get("properties"), dict) else {}
                source_neo4j_ids = row.get("source_neo4j_ids") if isinstance(row.get("source_neo4j_ids"), list) else []
                entities.append(
                    {
                        "cache_row_id": row.get("id"),
                        "entity_id": entity_id,
                        "canonical_entity_id": entity_id,
                        "entity_name": str(row.get("name") or entity_id).strip(),
                        "entity_type": str(row.get("entity_type") or "ENTITY").strip() or "ENTITY",
                        "properties": properties,
                        "source_neo4j_ids": source_neo4j_ids,
                    }
                )

            if len(rows) < page_size:
                break
            start += len(rows)

        return sorted(entities, key=lambda entity: str(entity.get("entity_id") or "").strip())

    def _has_active_pipeline_run(self, entity_id: str, canonical_entity_id: Optional[str] = None) -> bool:
        def _parse_timestamp(value: Any) -> Optional[datetime]:
            text = str(value or "").strip()
            if not text:
                return None
            normalized = text.replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(normalized)
            except ValueError:
                return None
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)

        def _run_is_still_active(run: Dict[str, Any]) -> bool:
            status = str(run.get("status") or "").strip().lower()
            if status in {"queued", "claiming"}:
                return True
            if status not in {"running", "retrying"}:
                return False

            metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
            now = datetime.now(timezone.utc)
            lease_expires_at = _parse_timestamp(metadata.get("lease_expires_at"))
            if lease_expires_at is not None:
                return lease_expires_at >= now

            heartbeat_at = _parse_timestamp(metadata.get("heartbeat_at"))
            if heartbeat_at is not None:
                return (now - heartbeat_at) <= timedelta(minutes=STALE_MINUTES)

            started_at = _parse_timestamp(run.get("started_at"))
            if started_at is not None:
                return (now - started_at) <= timedelta(minutes=STALE_MINUTES)

            return True

        candidate_ids = [
            str(entity_id or "").strip(),
            str(canonical_entity_id or "").strip(),
        ]
        candidate_ids = [candidate_id for candidate_id in candidate_ids if candidate_id]
        if not candidate_ids:
            return False

        for candidate_id in candidate_ids:
            response = (
                self.supabase.table("entity_pipeline_runs")
                .select("id, status, started_at, metadata")
                .eq("entity_id", candidate_id)
                .in_("status", ["queued", "claiming", "running", "retrying"])
                .limit(20)
                .execute()
            )
            if any(_run_is_still_active(run) for run in (response.data or []) if isinstance(run, dict)):
                return True

            if candidate_id != candidate_ids[0]:
                continue

            if canonical_entity_id and canonical_entity_id != candidate_id:
                canonical_response = (
                    self.supabase.table("entity_pipeline_runs")
                    .select("id, status, started_at, metadata")
                    .eq("canonical_entity_id", canonical_entity_id)
                    .in_("status", ["queued", "claiming", "running", "retrying"])
                    .limit(20)
                    .execute()
                )
                if any(_run_is_still_active(run) for run in (canonical_response.data or []) if isinstance(run, dict)):
                    return True

        return False

    def _find_next_manifest_entity(
        self,
        *,
        current_entity_id: str,
        current_canonical_entity_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        manifest_entities = self._load_manifest_entities()
        if not manifest_entities:
            return None

        current_ids = {
            str(current_entity_id or "").strip(),
            str(current_canonical_entity_id or "").strip(),
        }
        current_ids = {candidate_id for candidate_id in current_ids if candidate_id}

        current_index = -1
        for index, entity in enumerate(manifest_entities):
            entity_ids = {
                str(entity.get("entity_id") or "").strip(),
                str(entity.get("canonical_entity_id") or "").strip(),
            }
            entity_ids = {candidate_id for candidate_id in entity_ids if candidate_id}
            if entity_ids.intersection(current_ids):
                current_index = index
                break

        if current_index < 0:
            search_order = manifest_entities
        else:
            search_order = manifest_entities[current_index + 1:] + manifest_entities[:current_index]

        for entity in search_order:
            entity_id = str(entity.get("entity_id") or "").strip()
            canonical_entity_id = str(entity.get("canonical_entity_id") or "").strip() or None
            if not entity_id:
                continue
            if self._has_active_pipeline_run(entity_id, canonical_entity_id):
                continue
            return entity

        return None

    def _select_next_entity_cursor_candidate(
        self,
        *,
        current_entity_id: str,
        current_canonical_entity_id: Optional[str] = None,
        include_manifest_fallback: bool = True,
    ) -> Optional[Dict[str, Any]]:
        current_entity_id = str(current_entity_id or "").strip()
        current_canonical_entity_id = str(current_canonical_entity_id or "").strip() or None

        try:
            response = self.supabase.rpc(
                "select_next_entity_cursor_candidate",
                {
                    "current_entity_id": current_entity_id,
                    "current_canonical_entity_id": current_canonical_entity_id or current_entity_id,
                },
            ).execute()
            candidates = response.data or []
            if candidates:
                candidate = candidates[0]
                if isinstance(candidate, dict) and str(candidate.get("candidate_kind") or "").strip() in {"resume_entity", "resume_repair"}:
                    return candidate
        except Exception:
            pass

        if not include_manifest_fallback:
            return None

        next_entity = self._find_next_manifest_entity(
            current_entity_id=current_entity_id,
            current_canonical_entity_id=current_canonical_entity_id,
        )
        if not next_entity:
            return None

        return {
            "candidate_kind": "next_entity",
            "entity_id": str(next_entity.get("entity_id") or "").strip() or None,
            "canonical_entity_id": str(next_entity.get("canonical_entity_id") or "").strip() or None,
            "entity_name": str(next_entity.get("entity_name") or "").strip() or None,
            "entity_type": str(next_entity.get("entity_type") or "ENTITY").strip() or "ENTITY",
            "question_id": None,
            "current_question_id": None,
            "next_repair_question_id": None,
        }

    def _materialize_entity_cursor_candidate(
        self,
        candidate: Dict[str, Any],
        *,
        queue_mode: Optional[str] = None,
    ) -> Optional[str]:
        candidate_kind = str(candidate.get("candidate_kind") or "").strip()
        entity_id = str(candidate.get("entity_id") or "").strip()
        canonical_entity_id = str(candidate.get("canonical_entity_id") or "").strip() or None
        entity_name = str(candidate.get("entity_name") or entity_id).strip()
        entity_type = str(candidate.get("entity_type") or "ENTITY").strip() or "ENTITY"
        if not entity_id:
            return None

        now_iso = self._now_iso()
        batch_id = self._build_follow_on_repair_batch_id()
        normalized_queue_mode = str(queue_mode or QUEUE_MODE)
        question_id = str(
            candidate.get("question_id")
            or candidate.get("next_repair_question_id")
            or candidate.get("current_question_id")
            or ""
        ).strip() or None
        rerun_mode = "question" if candidate_kind == "resume_repair" and question_id else "full"
        cascade_dependents = False if rerun_mode == "question" else True

        batch_row = {
            "id": batch_id,
            "filename": None,
            "status": "queued",
            "total_rows": 1,
            "created_rows": 0,
            "updated_rows": 0,
            "invalid_rows": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": {
                "source": "entity_cursor_resume",
                "queue_mode": normalized_queue_mode,
                "entity_id": entity_id,
                "canonical_entity_id": canonical_entity_id,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "rerun_mode": rerun_mode,
                "question_id": question_id,
                "cascade_dependents": cascade_dependents,
                "current_question_id": str(candidate.get("current_question_id") or "").strip() or None,
                "next_repair_question_id": str(candidate.get("next_repair_question_id") or "").strip() or None,
                "cursor_candidate_kind": candidate_kind or "next_entity",
            },
        }
        run_row = {
            "id": f"{batch_id}_{entity_id}",
            "batch_id": batch_id,
            "entity_id": entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": entity_name,
            "status": "queued",
            "phase": "entity_registration",
            "error_message": None,
            "dossier_id": None,
            "sales_readiness": None,
            "rfp_count": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": {
                "source": "entity_cursor_resume",
                "queue_mode": normalized_queue_mode,
                "canonical_entity_id": canonical_entity_id,
                "entity_type": entity_type,
                "rerun_mode": rerun_mode,
                "question_id": question_id,
                "cascade_dependents": cascade_dependents,
                "current_question_id": str(candidate.get("current_question_id") or "").strip() or None,
                "next_repair_question_id": str(candidate.get("next_repair_question_id") or "").strip() or None,
                "cursor_candidate_kind": candidate_kind or "next_entity",
            },
        }

        batch_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_import_batches").insert(batch_row).execute(),
            context=f"insert entity cursor batch {batch_id}",
        )
        run_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_pipeline_runs").insert([run_row]).execute(),
            context=f"insert entity cursor run {batch_id}/{entity_id}",
        )
        if not (batch_inserted and run_inserted):
            return None
        return batch_id

    def _queue_manifest_auto_advance(
        self,
        *,
        batch_id: str,
        source_run: Dict[str, Any],
        batch_metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        control_state = read_pipeline_control_state()
        if control_state.get("requested_state") == "paused" or control_state.get("observed_state") == "paused":
            return None
        if should_skip_manifest_auto_advance_for_batch_metadata(batch_metadata):
            return None

        current_metadata = source_run.get("metadata") if isinstance(source_run.get("metadata"), dict) else {}
        next_entity = self._find_next_manifest_entity(
            current_entity_id=str(source_run.get("entity_id") or "").strip(),
            current_canonical_entity_id=str(
                source_run.get("canonical_entity_id")
                or current_metadata.get("canonical_entity_id")
                or ""
            ).strip() or None,
        )
        if not next_entity:
            return None

        now_iso = self._now_iso()
        queue_mode = str((batch_metadata or {}).get("queue_mode") or QUEUE_MODE)
        next_entity_id = str(next_entity.get("entity_id") or "").strip()
        canonical_entity_id = str(next_entity.get("canonical_entity_id") or "").strip() or None
        next_entity_name = str(next_entity.get("entity_name") or next_entity_id).strip()
        next_entity_type = str(next_entity.get("entity_type") or "ENTITY").strip() or "ENTITY"
        next_properties = next_entity.get("properties") if isinstance(next_entity.get("properties"), dict) else {}
        next_batch_id = self._build_follow_on_repair_batch_id()

        batch_row = {
            "id": next_batch_id,
            "filename": None,
            "status": "queued",
            "total_rows": 1,
            "created_rows": 0,
            "updated_rows": 0,
            "invalid_rows": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": {
                "source": "manifest_auto_advance",
                "queue_mode": queue_mode,
                "auto_advance_from_batch_id": batch_id,
                "auto_advance_from_entity_id": str(source_run.get("entity_id") or "").strip(),
                "auto_advance_from_canonical_entity_id": str(
                    source_run.get("canonical_entity_id")
                    or current_metadata.get("canonical_entity_id")
                    or ""
                ).strip() or None,
                "auto_advance_target_entity_id": next_entity_id,
                "auto_advance_target_entity_name": next_entity_name,
                "auto_advance_target_entity_type": next_entity_type,
                "entity_id": next_entity_id,
                "canonical_entity_id": canonical_entity_id or next_entity_id,
                "entity_name": next_entity_name,
                "entity_type": next_entity_type,
                "priority_score": next_properties.get("priority_score"),
                "sport": next_properties.get("sport"),
                "country": next_properties.get("country"),
                "website": next_properties.get("website"),
                "league": next_properties.get("league"),
            },
        }
        run_row = {
            "id": f"{next_batch_id}_{next_entity_id}",
            "batch_id": next_batch_id,
            "entity_id": next_entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": next_entity_name,
            "status": "queued",
            "phase": "entity_registration",
            "error_message": None,
            "dossier_id": None,
            "sales_readiness": None,
            "rfp_count": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": {
                "source": "manifest_auto_advance",
                "queue_mode": queue_mode,
                "auto_advance_from_batch_id": batch_id,
                "auto_advance_from_entity_id": str(source_run.get("entity_id") or "").strip(),
                "auto_advance_from_canonical_entity_id": str(
                    source_run.get("canonical_entity_id")
                    or current_metadata.get("canonical_entity_id")
                    or ""
                ).strip() or None,
                "auto_advance_target_entity_id": next_entity_id,
                "auto_advance_target_entity_name": next_entity_name,
                "auto_advance_target_entity_type": next_entity_type,
                "priority_score": next_properties.get("priority_score"),
                "entity_type": next_entity_type,
                "sport": next_properties.get("sport"),
                "country": next_properties.get("country"),
                "website": next_properties.get("website"),
                "league": next_properties.get("league"),
                "canonical_entity_id": canonical_entity_id,
            },
        }

        batch_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_import_batches").insert(batch_row).execute(),
            context=f"insert auto-advance batch {next_batch_id}",
        )
        run_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_pipeline_runs").insert([run_row]).execute(),
            context=f"insert auto-advance run {next_batch_id}/{next_entity_id}",
        )
        if not (batch_inserted and run_inserted):
            return None

        return {
            "batch_id": next_batch_id,
            "entity_id": next_entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": next_entity_name,
            "entity_type": next_entity_type,
        }

    def _classify_error(self, error: Exception) -> tuple[bool, str]:
        if isinstance(error, TimeoutError):
            return True, "timeout"
        if isinstance(error, HTTPError):
            return error.code >= 500, f"http_{error.code}"
        if isinstance(error, URLError):
            return True, "network"
        if isinstance(error, json.JSONDecodeError):
            return False, "json_decode"
        if isinstance(error, ValueError):
            return False, "value_error"
        return False, error.__class__.__name__.lower()

    def _load_persisted_dossier(self, entity_id: str, canonical_entity_id: Optional[str]) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        query = self.supabase.table("entity_dossiers").select("id, dossier_data").limit(1)
        if canonical_entity_id:
            query = query.eq("canonical_entity_id", canonical_entity_id)
        else:
            query = query.eq("entity_id", entity_id)
        response = query.execute()
        row = (response.data or [{}])[0]
        if not isinstance(row, dict):
            return None, None
        dossier = row.get("dossier_data")
        return (row.get("id") if row.get("id") else None), (dossier if isinstance(dossier, dict) else None)

    def _load_persisted_question_first_checkpoint(
        self,
        *,
        entity_id: str,
        canonical_entity_id: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        _row_id, dossier = self._load_persisted_dossier(entity_id, canonical_entity_id)
        return extract_question_first_checkpoint_from_payload(dossier)

    def _queue_question_first_continuation(
        self,
        *,
        batch_id: str,
        source_run: Dict[str, Any],
        batch_metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        run_metadata = source_run.get("metadata") if isinstance(source_run.get("metadata"), dict) else {}
        entity_id = str(source_run.get("entity_id") or "").strip()
        if not entity_id:
            return None
        canonical_entity_id = str(
            source_run.get("canonical_entity_id")
            or run_metadata.get("canonical_entity_id")
            or (batch_metadata or {}).get("canonical_entity_id")
            or ""
        ).strip() or None

        source_checkpoint = (
            run_metadata.get("question_first_checkpoint")
            if isinstance(run_metadata.get("question_first_checkpoint"), dict)
            else None
        )
        try:
            persisted_checkpoint = self._load_persisted_question_first_checkpoint(
                entity_id=entity_id,
                canonical_entity_id=canonical_entity_id,
            )
        except Exception as error:
            logger.warning(
                "Failed to load persisted question-first checkpoint for timeout continuation %s: %s",
                entity_id,
                error,
            )
            persisted_checkpoint = None
        checkpoint_candidates = [
            checkpoint
            for checkpoint in (source_checkpoint, persisted_checkpoint)
            if isinstance(checkpoint, dict)
        ]
        checkpoint = max(
            checkpoint_candidates,
            key=question_first_checkpoint_answer_count,
            default=None,
        )
        max_attempts = int(
            getattr(
                self,
                "max_question_first_continuation_attempts",
                MAX_QUESTION_FIRST_CONTINUATION_ATTEMPTS,
            )
            or 0
        )
        if not should_queue_question_first_continuation(
            run_metadata=run_metadata,
            checkpoint=checkpoint,
            max_attempts=max_attempts,
        ):
            return None

        if self._has_active_pipeline_run(entity_id=entity_id, canonical_entity_id=canonical_entity_id):
            return None

        now_iso = self._now_iso()
        continuation_batch_id = self._build_follow_on_repair_batch_id()
        queue_mode = str((batch_metadata or {}).get("queue_mode") or run_metadata.get("queue_mode") or QUEUE_MODE)
        entity_name = str(source_run.get("entity_name") or run_metadata.get("entity_name") or entity_id).strip()
        entity_type = str(run_metadata.get("entity_type") or (batch_metadata or {}).get("entity_type") or "ENTITY").strip() or "ENTITY"
        next_question_id = str((checkpoint or {}).get("next_question_id") or "").strip()
        continuation_attempts = int(run_metadata.get("question_first_continuation_attempts") or 0) + 1
        checkpoint_count = question_first_checkpoint_answer_count(checkpoint)
        common_metadata = {
            "source": "question_first_timeout_continuation",
            "queue_mode": queue_mode,
            "entity_id": entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "run_objective": str(run_metadata.get("run_objective") or "dossier_core"),
            "question_first_checkpoint": deepcopy(checkpoint),
            "question_first_resume": True,
            "question_first_resume_from_question_id": next_question_id,
            "question_first_continuation_attempts": continuation_attempts,
            "question_first_continuation_from_batch_id": batch_id,
            "question_first_continuation_from_run_id": source_run.get("id"),
            "question_first_continuation_from_questions_answered": checkpoint_count,
            "question_first_continuation_reason": "entity_pipeline_timeout",
            "last_completed_question_id": (checkpoint or {}).get("last_completed_question_id"),
            "current_question_id": next_question_id,
        }

        batch_row = {
            "id": continuation_batch_id,
            "filename": None,
            "status": "queued",
            "total_rows": 1,
            "created_rows": 0,
            "updated_rows": 0,
            "invalid_rows": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": common_metadata,
        }
        run_row = {
            "id": f"{continuation_batch_id}_{entity_id}",
            "batch_id": continuation_batch_id,
            "entity_id": entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": entity_name,
            "status": "queued",
            "phase": "entity_registration",
            "error_message": None,
            "dossier_id": None,
            "sales_readiness": None,
            "rfp_count": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": common_metadata,
        }

        batch_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_import_batches").insert(batch_row).execute(),
            context=f"insert question-first continuation batch {continuation_batch_id}",
        )
        run_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_pipeline_runs").insert([run_row]).execute(),
            context=f"insert question-first continuation run {continuation_batch_id}/{entity_id}",
        )
        if not (batch_inserted and run_inserted):
            return None

        return {
            "batch_id": continuation_batch_id,
            "entity_id": entity_id,
            "canonical_entity_id": canonical_entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "next_question_id": next_question_id,
            "questions_answered": checkpoint_count,
        }

    def _apply_skip_to_dossier_payload(
        self,
        dossier: Dict[str, Any],
        *,
        question_id: str,
        skip_reason: str,
        skip_note: str,
        skip_error_class: Optional[str],
        skipped_at: str,
    ) -> bool:
        if not isinstance(dossier, dict) or not question_id:
            return False
        summary_parts = [part for part in [skip_reason, skip_note] if part]
        terminal_summary = f"Skipped: {'. '.join(summary_parts)}" if summary_parts else "Skipped due to repeated failures"
        updated = False

        def apply_to_record(record: Dict[str, Any]) -> None:
            nonlocal updated
            record["terminal_state"] = "skipped"
            record["validation_state"] = "skipped"
            record["terminal_summary"] = terminal_summary
            record["skip_reason"] = skip_reason
            record["skip_note"] = skip_note
            record["skipped_at"] = skipped_at
            if skip_error_class:
                record["skip_error_class"] = skip_error_class
            if isinstance(record.get("answer"), dict):
                record["answer"]["terminal_state"] = "skipped"
                record["answer"]["validation_state"] = "skipped"
                record["answer"]["summary"] = terminal_summary
                record["answer"]["skip_reason"] = skip_reason
                record["answer"]["skip_note"] = skip_note
                record["answer"]["skipped_at"] = skipped_at
                if skip_error_class:
                    record["answer"]["skip_error_class"] = skip_error_class
            if isinstance(record.get("question_first_answer"), dict):
                record["question_first_answer"]["terminal_state"] = "skipped"
                record["question_first_answer"]["validation_state"] = "skipped"
                record["question_first_answer"]["terminal_summary"] = terminal_summary
                record["question_first_answer"]["skip_reason"] = skip_reason
                record["question_first_answer"]["skip_note"] = skip_note
                record["question_first_answer"]["skipped_at"] = skipped_at
                if skip_error_class:
                    record["question_first_answer"]["skip_error_class"] = skip_error_class
            updated = True

        questions = dossier.get("questions") if isinstance(dossier.get("questions"), list) else []
        for question in questions:
            if not isinstance(question, dict):
                continue
            if str(question.get("question_id") or "").strip() == question_id:
                apply_to_record(question)

        question_first = dossier.get("question_first") if isinstance(dossier.get("question_first"), dict) else {}
        answers = question_first.get("answers") if isinstance(question_first.get("answers"), list) else []
        for answer in answers:
            if not isinstance(answer, dict):
                continue
            if str(answer.get("question_id") or "").strip() == question_id:
                apply_to_record(answer)

        question_first_run = dossier.get("question_first_run") if isinstance(dossier.get("question_first_run"), dict) else {}
        answer_records = question_first_run.get("answer_records") if isinstance(question_first_run.get("answer_records"), list) else []
        for answer in answer_records:
            if not isinstance(answer, dict):
                continue
            if str(answer.get("question_id") or "").strip() == question_id:
                apply_to_record(answer)

        metadata = dossier.get("metadata") if isinstance(dossier.get("metadata"), dict) else {}
        qf_meta = metadata.get("question_first") if isinstance(metadata.get("question_first"), dict) else {}
        skipped = qf_meta.get("skipped_questions") if isinstance(qf_meta.get("skipped_questions"), list) else []
        skipped.append(
            {
                "question_id": question_id,
                "skip_reason": skip_reason,
                "skip_note": skip_note,
                "skipped_at": skipped_at,
                "skip_error_class": skip_error_class,
            }
        )
        qf_meta["skipped_questions"] = skipped
        metadata["question_first"] = qf_meta
        dossier["metadata"] = metadata
        return updated

    def _persist_skip_to_entity_dossier(
        self,
        *,
        entity_id: str,
        canonical_entity_id: Optional[str],
        question_id: str,
        skip_reason: str,
        skip_note: str,
        skip_error_class: Optional[str],
        skipped_at: str,
    ) -> bool:
        row_id, dossier = self._load_persisted_dossier(entity_id, canonical_entity_id)
        if not dossier:
            return False
        updated = self._apply_skip_to_dossier_payload(
            dossier,
            question_id=question_id,
            skip_reason=skip_reason,
            skip_note=skip_note,
            skip_error_class=skip_error_class,
            skipped_at=skipped_at,
        )
        if not updated:
            return False
        update_query = self.supabase.table("entity_dossiers").update({"dossier_data": dossier})
        if row_id:
            update_query = update_query.eq("id", row_id)
        elif canonical_entity_id:
            update_query = update_query.eq("canonical_entity_id", canonical_entity_id)
        else:
            update_query = update_query.eq("entity_id", entity_id)
        return self._safe_execute(
            lambda: update_query.execute(),
            context=f"persist skipped question {entity_id}/{question_id}",
        )

    def _build_skip_metadata(
        self,
        *,
        entity_id: str,
        canonical_entity_id: Optional[str],
        existing_metadata: Dict[str, Any],
        dossier: Optional[Dict[str, Any]],
        question_id: str,
        skip_reason: str,
        skip_note: str,
        skip_error_class: Optional[str],
        skipped_at: str,
    ) -> tuple[Dict[str, Any], set[str], Optional[Dict[str, Any]]]:
        skipped_question_ids = {
            str(question).strip()
            for question in (existing_metadata.get("skipped_question_ids") or [])
            if str(question or "").strip()
        }
        skipped_question_ids.add(question_id)
        self._persist_skip_to_entity_dossier(
            entity_id=entity_id,
            canonical_entity_id=canonical_entity_id,
            question_id=question_id,
            skip_reason=skip_reason,
            skip_note=skip_note,
            skip_error_class=skip_error_class,
            skipped_at=skipped_at,
        )
        retry_metadata = {
            "skipped_question_ids": sorted(skipped_question_ids),
            "last_skipped_question_id": question_id,
            "last_skip_reason": skip_reason,
            "last_skip_note": skip_note,
            "last_skip_error_class": skip_error_class,
            "last_skipped_at": skipped_at,
        }
        if dossier is None:
            _, dossier = self._load_persisted_dossier(entity_id, canonical_entity_id)
        if isinstance(dossier, dict):
            self._apply_skip_to_dossier_payload(
                dossier,
                question_id=question_id,
                skip_reason=skip_reason,
                skip_note=skip_note,
                skip_error_class=skip_error_class,
                skipped_at=skipped_at,
            )
        return retry_metadata, skipped_question_ids, dossier

    def find_active_repair_run(
        self,
        entity_id: str,
        question_id: str,
        cascade_dependents: bool = True,
        canonical_entity_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        query = (
            self.supabase.table("entity_pipeline_runs")
            .select("*")
            .limit(20)
        )
        if canonical_entity_id:
            query = query.eq("canonical_entity_id", canonical_entity_id)
            single_response = query.maybe_single()
            runs = [single_response.data] if getattr(single_response, "data", None) else []
        else:
            query = query.eq("entity_id", entity_id)
            response = query.execute()
            runs = response.data or []
        for run in runs:
            if str(run.get("status") or "").strip().lower() not in {"queued", "claiming", "running", "retrying"}:
                continue
            batch_id = str(run.get("batch_id") or "").strip()
            if batch_id:
                batch = self._get_batch_record(batch_id)
                batch_status = str(batch.get("status") or "").strip().lower()
                if batch_status in TERMINAL_BATCH_STATUSES:
                    continue
            metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
            if (
                str(metadata.get("rerun_mode") or "full").strip().lower() == "question"
                and str(metadata.get("question_id") or "").strip() == question_id
                and bool(metadata.get("cascade_dependents", True)) == bool(cascade_dependents)
            ):
                return run
        return None

    def _build_follow_on_repair_batch_id(self) -> str:
        return f"import_{int(time.time() * 1000)}"

    def _normalize_follow_on_batch_status(
        self,
        *,
        batch_status: Optional[str] = None,
        run_status: Optional[str] = None,
    ) -> str:
        normalized_batch_status = str(batch_status or "").strip().lower()
        normalized_run_status = str(run_status or "").strip().lower()
        if normalized_batch_status in {"running", "retrying"} or normalized_run_status in {"running", "retrying"}:
            return "running"
        if normalized_batch_status in {"queued", "claiming"} or normalized_run_status in {"queued", "claiming"}:
            return "queued"
        if normalized_batch_status == "completed" or normalized_run_status == "completed":
            return "completed"
        if normalized_batch_status == "failed" or normalized_run_status == "failed":
            return "failed"
        return "planned"

    def _queue_follow_on_repair(
        self,
        *,
        run: Dict[str, Any],
        latest_metadata: Dict[str, Any],
        result: Dict[str, Any],
        question_id: str,
        repair_retry_count: int,
        repair_retry_budget: int,
        reconcile_required: bool,
    ) -> Dict[str, Optional[str]]:
        canonical_entity_id = str(
            run.get("canonical_entity_id")
            or latest_metadata.get("canonical_entity_id")
            or ""
        ).strip() or None
        if canonical_entity_id:
            existing = self.find_active_repair_run(
                run["entity_id"],
                question_id,
                cascade_dependents=True,
                canonical_entity_id=canonical_entity_id,
            )
        else:
            existing = self.find_active_repair_run(
                run["entity_id"],
                question_id,
                cascade_dependents=True,
            )
        if existing:
            existing_batch_id = str(existing.get("batch_id") or "").strip() or None
            if not _is_distinct_follow_on_batch_id(run.get("batch_id"), existing_batch_id):
                existing = None
                existing_batch_id = None
            else:
                existing_batch = self._get_batch_record(existing_batch_id) if existing_batch_id else {}
                existing_status = self._normalize_follow_on_batch_status(
                    batch_status=existing_batch.get("status") if isinstance(existing_batch, dict) else None,
                    run_status=existing.get("status"),
                )
                log_worker_transition(
                    "follow_on_repair_reused",
                    worker_id=getattr(self, "worker_id", "worker-test"),
                    batch_id=existing_batch_id,
                    entity_id=run.get("entity_id"),
                    entity_name=run.get("entity_name"),
                    question_id=question_id,
                    status=existing_status,
                    current_action=f"repair question {question_id}",
                    message="reused active follow-on repair batch",
                )
                return {
                    "batch_id": existing_batch_id,
                    "status": existing_status,
                    "queue_source": "reused",
                }

        now_iso = self._now_iso()
        follow_on_batch_id = self._build_follow_on_repair_batch_id()
        queue_mode = str(latest_metadata.get("queue_mode") or QUEUE_MODE)
        scoped_repair_metadata = {
            key: latest_metadata.get(key)
            for key in (
                "targeted_pilot",
                "pilot_id",
                "auto_advance_guard",
                "suppress_cursor_resume_after_batch",
            )
            if latest_metadata.get(key) is not None
        }
        batch_row = {
            "id": follow_on_batch_id,
            "filename": None,
            "status": "queued",
            "total_rows": 1,
            "created_rows": 0,
            "updated_rows": 0,
            "invalid_rows": 0,
            "started_at": now_iso,
            "completed_at": None,
            "metadata": {
                "source": "self_healing_repair",
                "queue_mode": queue_mode,
                "canonical_entity_id": canonical_entity_id,
                "rerun_mode": "question",
                "question_id": question_id,
                "cascade_dependents": True,
                "repair_queue_source": "auto",
                "repair_state": "queued",
                "repair_retry_count": repair_retry_count,
                "repair_retry_budget": repair_retry_budget,
                "next_repair_question_id": None,
                "next_repair_status": None,
                "next_repair_batch_id": None,
                "next_repair_batch_status": None,
                "reconciliation_state": "pending" if reconcile_required else "healthy",
                "rerun_reason": f"Auto-repair queued for {question_id}",
                **scoped_repair_metadata,
            },
        }
        run_row = {
            "id": f"{follow_on_batch_id}_{run['entity_id']}",
            "batch_id": follow_on_batch_id,
            "entity_id": run["entity_id"],
            "canonical_entity_id": canonical_entity_id,
            "entity_name": run["entity_name"],
            "status": "queued",
            "phase": "entity_registration",
            "error_message": None,
            "dossier_id": run["entity_id"],
            "sales_readiness": result.get("sales_readiness"),
            "rfp_count": int(result.get("rfp_count") or 0),
            "started_at": now_iso,
            "completed_at": None,
            "metadata": {
                "source": "self_healing_repair",
                "priority_score": latest_metadata.get("priority_score"),
                "entity_type": latest_metadata.get("entity_type"),
                "sport": latest_metadata.get("sport"),
                "country": latest_metadata.get("country"),
                "website": latest_metadata.get("website"),
                "league": latest_metadata.get("league"),
                "queue_mode": queue_mode,
                "canonical_entity_id": canonical_entity_id,
                "rerun_mode": "question",
                "question_id": question_id,
                "cascade_dependents": True,
                "repair_source_run_id": run.get("id") or f"{run.get('batch_id')}_{run['entity_id']}",
                "repair_queue_source": "auto",
                "repair_state": "queued",
                "repair_retry_count": repair_retry_count,
                "repair_retry_budget": repair_retry_budget,
                "next_repair_question_id": None,
                "next_repair_status": None,
                "next_repair_batch_id": None,
                "next_repair_batch_status": None,
                "reconciliation_state": "pending" if reconcile_required else "healthy",
                **scoped_repair_metadata,
            },
        }
        batch_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_import_batches").insert(batch_row).execute(),
            context=f"insert self-healing batch {follow_on_batch_id}",
        )
        run_inserted = self._safe_execute(
            lambda: self.supabase.table("entity_pipeline_runs").insert([run_row]).execute(),
            context=f"insert self-healing run {follow_on_batch_id}/{run['entity_id']}",
        )
        next_status = "queued" if batch_inserted and run_inserted else "planned"
        log_worker_transition(
            "follow_on_repair_queued",
            worker_id=getattr(self, "worker_id", "worker-test"),
            batch_id=follow_on_batch_id if batch_inserted else None,
            entity_id=run.get("entity_id"),
            entity_name=run.get("entity_name"),
            question_id=question_id,
            status=next_status,
            current_action=f"repair question {question_id}",
            message="queued self-healing follow-on repair batch",
        )
        return {
            "batch_id": follow_on_batch_id if batch_inserted else None,
            "status": next_status,
            "queue_source": "auto",
        }

    def _derive_follow_on_repair_metadata(
        self,
        *,
        run: Dict[str, Any],
        latest_metadata: Dict[str, Any],
        result: Dict[str, Any],
        publication_succeeded: bool,
        reconcile_required: bool,
    ) -> Dict[str, Any]:
        repair_retry_budget = int(
            latest_metadata.get("repair_retry_budget")
            or getattr(self, "repair_retry_budget", DEFAULT_REPAIR_RETRY_BUDGET)
            or DEFAULT_REPAIR_RETRY_BUDGET
        )
        repair_retry_count = int(latest_metadata.get("repair_retry_count", 0) or 0)
        exhausted_question_ids = {
            str(question_id).strip()
            for question_id in (latest_metadata.get("exhausted_question_ids") or [])
            if str(question_id or "").strip()
        }
        skipped_question_ids = {
            str(question_id).strip()
            for question_id in (latest_metadata.get("skipped_question_ids") or [])
            if str(question_id or "").strip()
        }
        base_metadata = {
            "repair_state": "idle",
            "repair_retry_count": repair_retry_count,
            "repair_retry_budget": repair_retry_budget,
            "next_repair_question_id": None,
            "next_repair_status": None,
            "next_repair_batch_id": None,
            "next_repair_batch_status": None,
            "reconciliation_state": "pending" if reconcile_required else "healthy",
            "repair_queue_source": latest_metadata.get("repair_queue_source") or None,
            "exhausted_question_ids": sorted(exhausted_question_ids),
            "skipped_question_ids": sorted(skipped_question_ids),
        }
        if not publication_succeeded:
            return base_metadata

        dossier = ((result.get("artifacts") or {}).get("dossier") or {})
        quality_state = str(dossier.get("quality_state") or "").strip().lower()
        if quality_state not in {"blocked", "partial"}:
            return base_metadata

        questions = dossier.get("questions") if isinstance(dossier.get("questions"), list) else []
        next_repair_question_id = select_repair_root_question_id(
            source_payload={"questions": questions},
            canonical_dossier=dossier if isinstance(dossier, dict) else {"questions": questions},
            exhausted_question_ids=exhausted_question_ids.union(skipped_question_ids),
        )
        if not next_repair_question_id:
            return {
                **base_metadata,
                "repair_state": "exhausted",
                "next_repair_status": "exhausted",
            }

        current_repair_question_id = str(
            latest_metadata.get("question_id")
            or latest_metadata.get("current_question_id")
            or ""
        ).strip()
        rerun_mode = str(latest_metadata.get("rerun_mode") or "").strip().lower()
        cascade_dependents = bool(latest_metadata.get("cascade_dependents", True))
        if (
            current_repair_question_id
            and next_repair_question_id == current_repair_question_id
        ):
            exhausted_question_ids.add(next_repair_question_id)
            return {
                **base_metadata,
                "repair_state": "exhausted",
                "next_repair_status": "exhausted",
                "exhausted_question_ids": sorted(exhausted_question_ids),
            }

        next_retry_count = repair_retry_count + 1
        if next_retry_count > repair_retry_budget:
            skipped_at = self._now_iso()
            skip_reason = "retry_exhausted"
            skip_note = _derive_skip_note(latest_metadata)
            skip_error_class = str(latest_metadata.get("last_error_type") or "retry_exhausted").strip() or None
            skip_metadata, skipped_question_ids, dossier = self._build_skip_metadata(
                entity_id=run.get("entity_id") or "",
                canonical_entity_id=str(run.get("canonical_entity_id") or latest_metadata.get("canonical_entity_id") or "").strip() or None,
                existing_metadata=latest_metadata if isinstance(latest_metadata, dict) else {},
                dossier=dossier if isinstance(dossier, dict) else None,
                question_id=next_repair_question_id,
                skip_reason=skip_reason,
                skip_note=skip_note,
                skip_error_class=skip_error_class,
                skipped_at=skipped_at,
            )
            skipped_question_ids.add(next_repair_question_id)
            questions = dossier.get("questions") if isinstance(dossier.get("questions"), list) else []
            follow_on_question_id = select_repair_root_question_id(
                source_payload={"questions": questions},
                canonical_dossier=dossier if isinstance(dossier, dict) else {"questions": questions},
                exhausted_question_ids=exhausted_question_ids.union(skipped_question_ids),
            )
            if not follow_on_question_id:
                return {
                    **base_metadata,
                    "repair_state": "exhausted",
                    "next_repair_status": "exhausted",
                    "exhausted_question_ids": sorted(exhausted_question_ids),
                    "skipped_question_ids": sorted(skipped_question_ids),
                    "last_skipped_question_id": next_repair_question_id,
                    "last_skip_reason": skip_reason,
                    "last_skip_note": skip_note,
                    "last_skip_error_class": skip_error_class,
                    "last_skipped_at": skipped_at,
                }

            queue_result = self._queue_follow_on_repair(
                run=run,
                latest_metadata=latest_metadata,
                result=result,
                question_id=follow_on_question_id,
                repair_retry_count=1,
                repair_retry_budget=repair_retry_budget,
                reconcile_required=reconcile_required,
            )
            next_repair_status = str(queue_result.get("status") or "planned").strip().lower() or "planned"
            queued_batch_id = str(queue_result.get("batch_id") or "").strip() or None
            has_distinct_follow_on = _is_distinct_follow_on_batch_id(run.get("batch_id"), queued_batch_id)
            return {
                **base_metadata,
                "repair_state": (
                    "repairing" if has_distinct_follow_on and next_repair_status == "running"
                    else ("queued" if has_distinct_follow_on and next_repair_status == "queued" else "idle")
                ),
                "repair_retry_count": 1,
                "next_repair_question_id": follow_on_question_id,
                "next_repair_status": next_repair_status if has_distinct_follow_on else None,
                "next_repair_batch_id": queued_batch_id if has_distinct_follow_on else None,
                "next_repair_batch_status": next_repair_status if has_distinct_follow_on and queued_batch_id else None,
                "repair_queue_source": queue_result.get("queue_source") or "auto",
                "queued_repair_batch_id": queued_batch_id if has_distinct_follow_on else None,
                **skip_metadata,
            }

        queue_result = self._queue_follow_on_repair(
            run=run,
            latest_metadata=latest_metadata,
            result=result,
            question_id=next_repair_question_id,
            repair_retry_count=next_retry_count,
            repair_retry_budget=repair_retry_budget,
            reconcile_required=reconcile_required,
        )
        next_repair_status = str(queue_result.get("status") or "planned").strip().lower() or "planned"
        queued_batch_id = str(queue_result.get("batch_id") or "").strip() or None
        has_distinct_follow_on = _is_distinct_follow_on_batch_id(run.get("batch_id"), queued_batch_id)
        return {
            **base_metadata,
            "repair_state": (
                "repairing" if has_distinct_follow_on and next_repair_status == "running"
                else ("queued" if has_distinct_follow_on and next_repair_status == "queued" else "idle")
            ),
            "repair_retry_count": next_retry_count,
            "next_repair_question_id": next_repair_question_id,
            "next_repair_status": next_repair_status if has_distinct_follow_on else None,
            "next_repair_batch_id": queued_batch_id if has_distinct_follow_on else None,
            "next_repair_batch_status": next_repair_status if has_distinct_follow_on and queued_batch_id else None,
            "repair_queue_source": queue_result.get("queue_source") or "auto",
            "queued_repair_batch_id": queued_batch_id if has_distinct_follow_on else None,
        }

    def process_batch(self, batch: Dict[str, Any]) -> None:
        batch_id = batch["id"]
        max_run_attempts = getattr(self, "max_run_attempts", MAX_RUN_ATTEMPTS)
        lease_seconds = getattr(self, "lease_seconds", LEASE_SECONDS)
        worker_id = getattr(self, "worker_id", "worker-test")
        log_worker_transition(
            "batch_processing_start",
            worker_id=worker_id,
            batch_id=batch_id,
            status=str(batch.get("status") or "").strip().lower() or None,
            message="processing claimed batch",
        )
        claimed_batch = self._get_batch_record(batch_id)
        claimed_batch_status = str(claimed_batch.get("status") or batch.get("status") or "").strip().lower()
        if claimed_batch_status in TERMINAL_BATCH_STATUSES:
            latest_batch_metadata = self._batch_metadata(claimed_batch or batch)
            completed_at = str(claimed_batch.get("completed_at") or "").strip()
            terminal_update = (
                build_batch_failed_update(latest_batch_metadata, now_iso=self._now_iso())
                if claimed_batch_status == "failed"
                else build_batch_completed_update(
                    latest_batch_metadata,
                    worker_id=worker_id,
                    now_iso=completed_at or self._now_iso(),
                )
            )
            batch["metadata"] = terminal_update["metadata"]
            self._safe_execute(
                lambda: self.supabase.table("entity_import_batches").update(
                    terminal_update
                ).eq("id", batch_id).execute(),
                context=f"normalize already-terminal batch metadata {batch_id}",
            )
            logger.info("Skipping claimed terminal batch %s with status=%s", batch_id, claimed_batch_status)
            log_worker_transition(
                "batch_terminal_skip",
                worker_id=worker_id,
                batch_id=batch_id,
                status=claimed_batch_status,
                message="skipped already-terminal batch",
            )
            return
        batch["metadata"] = build_batch_claim_metadata(
            self._batch_metadata(batch),
            worker_id=worker_id,
            now_iso=self._now_iso(),
        )
        heartbeat_stop, heartbeat_thread = self._start_batch_heartbeat(batch_id, self._batch_metadata(batch))
        for run in self.get_batch_runs(batch_id):
            if run.get("status") == "completed":
                continue
            run_metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
            attempt_count = int(run_metadata.get("attempt_count", 0) or 0)
            if attempt_count >= max_run_attempts and run.get("status") == "retrying":
                exhausted_metadata = build_run_exhausted_retry_metadata(
                    run_metadata,
                    now_iso=self._now_iso(),
                )
                if str(run_metadata.get("last_error_type") or "").strip().lower() == "timeout":
                    exhausted_metadata = build_run_timeout_failure_metadata(
                        exhausted_metadata,
                        now_iso=self._now_iso(),
                    )
                    exhausted_metadata["stop_reason"] = "entity_pipeline_timeout"
                    exhausted_metadata["stop_details"] = build_stop_reason_details(
                        reason="entity_pipeline_timeout",
                        entity_id=run.get("entity_id"),
                        canonical_entity_id=run.get("canonical_entity_id") or run_metadata.get("canonical_entity_id"),
                        entity_name=run.get("entity_name"),
                        phase=run.get("phase"),
                        error_type="timeout",
                        error_message=str(run_metadata.get("last_error") or "timed out"),
                        batch_id=batch_id,
                        attempts=attempt_count,
                    )
                    log_worker_transition(
                        "run_failed_nonblocking",
                        worker_id=worker_id,
                        batch_id=batch_id,
                        entity_id=run.get("entity_id"),
                        entity_name=run.get("entity_name"),
                        phase=run.get("phase"),
                        status="failed",
                        retry_state="failed",
                        stop_reason="entity_pipeline_timeout",
                        error_type="timeout",
                        attempts=attempt_count,
                        current_action=run.get("phase"),
                        message="timed out",
                    )
                self.sync_cached_entity(batch_id, run, None, "failed")
                self.update_run(
                    batch_id,
                    run["entity_id"],
                    {
                        "status": "failed",
                        "phase": run.get("phase") or "entity_registration",
                        "error_message": exhausted_metadata.get("last_error"),
                        "completed_at": self._now_iso(),
                        "metadata": exhausted_metadata,
                    },
                )
                continue
            if attempt_count >= max_run_attempts and run.get("status") == "failed":
                continue
            now_iso = self._now_iso()
            log_worker_transition(
                "run_start",
                worker_id=worker_id,
                batch_id=batch_id,
                entity_id=run.get("entity_id"),
                entity_name=run.get("entity_name"),
                phase="dossier_generation",
                status="running",
                current_action=str(run_metadata.get("question_id") or run_metadata.get("active_question_id") or run.get("phase") or "").strip() or None,
                attempts=attempt_count + 1,
                message="starting run execution",
            )
            self.update_run(
                batch_id,
                run["entity_id"],
                {
                    "status": "running",
                    "phase": "dossier_generation",
                    "error_message": None,
                    "metadata": build_run_start_metadata(
                        run_metadata,
                        worker_id=worker_id,
                        now_iso=now_iso,
                        lease_seconds=lease_seconds,
                    ),
                },
            )
            run = {
                **run,
                "status": "running",
                "phase": "dossier_generation",
                "error_message": None,
                "metadata": build_run_start_metadata(
                    run_metadata,
                    worker_id=worker_id,
                    now_iso=now_iso,
                    lease_seconds=lease_seconds,
                ),
            }
            run_metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
            _set_supervisor_activity(
                current_batch_id=batch_id,
                current_entity_id=str(run.get("entity_id") or "").strip() or None,
                current_canonical_entity_id=str(
                    run.get("canonical_entity_id")
                    or run_metadata.get("canonical_entity_id")
                    or run.get("entity_id")
                    or ""
                ).strip() or None,
                current_entity_name=str(run.get("entity_name") or "").strip() or None,
                current_question_id=str(
                    run_metadata.get("question_id")
                    or run_metadata.get("current_question_id")
                    or run_metadata.get("active_question_id")
                    or ""
                ).strip() or None,
                current_question_text=str(run_metadata.get("current_question_text") or "").strip() or None,
                current_action=str(
                    run_metadata.get("question_id")
                    or run_metadata.get("active_question_id")
                    or run.get("phase")
                    or "entity_registration"
                ).strip() or None,
                current_phase="dossier_generation",
                current_started_at=now_iso,
                current_activity_at=now_iso,
            )
            try:
                result = self.call_pipeline(run, batch_id)
                phases = result.get("phases") or {}
                completed_phases = [name for name, detail in phases.items() if detail.get("status") == "completed"]
                last_phase = completed_phases[-1] if completed_phases else "dashboard_scoring"
                latest_metadata = self._get_run_metadata(batch_id, run["entity_id"])
                publication_status = str(result.get("publication_status") or "").strip().lower()
                dual_write_ok = bool(result.get("dual_write_ok", True))
                publication_succeeded = publication_status in {"published", "published_degraded"} or dual_write_ok
                reconcile_required = bool(
                    result.get("reconcile_required")
                    or ((result.get("persistence_status") or {}).get("reconcile_required"))
                )
                follow_on_repair_metadata = self._derive_follow_on_repair_metadata(
                    run=run,
                    latest_metadata=latest_metadata if isinstance(latest_metadata, dict) else run_metadata,
                    result=result,
                    publication_succeeded=publication_succeeded,
                    reconcile_required=reconcile_required,
                )
                metadata = merge_pipeline_run_metadata(
                    build_run_success_metadata(latest_metadata if isinstance(latest_metadata, dict) else run_metadata),
                    phases=phases,
                    phase_details_by_phase=(result.get("phase_details_by_phase") or phases),
                    scores=((result.get("artifacts") or {}).get("scores")),
                    monitoring_summary=derive_monitoring_summary(result),
                    escalation_reason=(result.get("artifacts") or {}).get("escalation_reason"),
                    performance_summary=(((result.get("artifacts") or {}).get("discovery_result") or {}).get("performance_summary")),
                    discovery_context=derive_discovery_context(result),
                    acceptance_gate=result.get("acceptance_gate"),
                    failure_taxonomy=result.get("failure_taxonomy"),
                    run_profile=result.get("run_profile"),
                    degraded_mode=result.get("degraded_mode"),
                    persistence_status=result.get("persistence_status"),
                    publication_status=result.get("publication_status"),
                    publication_mode=result.get("publication_mode"),
                    reconcile_required=reconcile_required,
                    repair_state=follow_on_repair_metadata.get("repair_state"),
                    repair_retry_count=follow_on_repair_metadata.get("repair_retry_count"),
                    repair_retry_budget=follow_on_repair_metadata.get("repair_retry_budget"),
                    next_repair_question_id=follow_on_repair_metadata.get("next_repair_question_id"),
                    next_repair_status=follow_on_repair_metadata.get("next_repair_status"),
                    next_repair_batch_id=follow_on_repair_metadata.get("next_repair_batch_id"),
                    next_repair_batch_status=follow_on_repair_metadata.get("next_repair_batch_status"),
                    reconciliation_state=follow_on_repair_metadata.get("reconciliation_state"),
                    reconciliation_payload=((result.get("persistence_status") or {}).get("reconciliation_payload")),
                    reconciliation_payloads=(
                        (((result.get("persistence_status") or {}).get("step_artifacts") or {}).get("reconciliation_payloads"))
                    ),
                    step_artifact_counts=result.get("step_artifact_counts"),
                    step_failure_taxonomy=result.get("step_failure_taxonomy"),
                    promoted_rfp_ids=[],
                    completed_at=result.get("completed_at"),
                )
                if follow_on_repair_metadata.get("repair_queue_source") is not None:
                    metadata["repair_queue_source"] = follow_on_repair_metadata.get("repair_queue_source")
                if follow_on_repair_metadata.get("queued_repair_batch_id") is not None:
                    metadata["queued_repair_batch_id"] = follow_on_repair_metadata.get("queued_repair_batch_id")
                if follow_on_repair_metadata.get("next_repair_status") is not None:
                    metadata["next_repair_status"] = follow_on_repair_metadata.get("next_repair_status")
                if follow_on_repair_metadata.get("next_repair_batch_id") is not None:
                    metadata["next_repair_batch_id"] = follow_on_repair_metadata.get("next_repair_batch_id")
                if follow_on_repair_metadata.get("next_repair_batch_status") is not None:
                    metadata["next_repair_batch_status"] = follow_on_repair_metadata.get("next_repair_batch_status")
                if follow_on_repair_metadata.get("exhausted_question_ids") is not None:
                    metadata["exhausted_question_ids"] = follow_on_repair_metadata.get("exhausted_question_ids")
                if follow_on_repair_metadata.get("skipped_question_ids") is not None:
                    metadata["skipped_question_ids"] = follow_on_repair_metadata.get("skipped_question_ids")
                for field in ("last_skipped_question_id", "last_skip_reason", "last_skip_note", "last_skip_error_class", "last_skipped_at"):
                    if follow_on_repair_metadata.get(field) is not None:
                        metadata[field] = follow_on_repair_metadata.get(field)
                fresh_runtime_provider_failure = has_provider_infrastructure_failure(result)
                if publication_succeeded and not fresh_runtime_provider_failure:
                    metadata = clear_provider_infrastructure_failure_metadata(metadata)
                if fresh_runtime_provider_failure:
                    publication_succeeded = False
                    metadata = build_run_provider_infrastructure_failure_metadata(
                        metadata,
                        now_iso=self._now_iso(),
                        error_message="OpenCode provider insufficient balance or resource package unavailable",
                    )
                    metadata["stop_reason"] = "provider_infrastructure_failure"
                    metadata["stop_details"] = build_stop_reason_details(
                        reason="provider_infrastructure_failure",
                        entity_id=run.get("entity_id"),
                        canonical_entity_id=run.get("canonical_entity_id") or run_metadata.get("canonical_entity_id"),
                        entity_name=run.get("entity_name"),
                        question_id=metadata.get("question_id") or metadata.get("current_question_id"),
                        phase=run.get("phase"),
                        error_type="provider_infrastructure_failure",
                        error_message=metadata["last_error"],
                        batch_id=batch_id,
                    )
                    self._write_terminal_stop_state(
                        reason="provider_infrastructure_failure",
                        pause_reason="provider infrastructure failure: OpenCode insufficient balance",
                        details=metadata["stop_details"],
                    )
                final_status = "completed" if publication_succeeded else "failed"
                live_cursor = _project_live_cursor_fields(batch=batch, metadata=metadata, now_iso=self._now_iso())
                live_cursor["current_entity_id"] = str(run.get("entity_id") or "").strip() or live_cursor.get("current_entity_id")
                live_cursor["current_canonical_entity_id"] = str(
                    run.get("canonical_entity_id")
                    or metadata.get("canonical_entity_id")
                    or run.get("entity_id")
                    or ""
                ).strip() or live_cursor.get("current_canonical_entity_id")
                live_cursor["current_entity_name"] = str(run.get("entity_name") or "").strip() or live_cursor.get("current_entity_name")
                _set_supervisor_activity(**live_cursor)
                write_pipeline_control_state(
                    {
                        **live_cursor,
                        "cursor_source": "live_runtime_projection",
                        "updated_at": self._now_iso(),
                    }
                )
                if final_status == "completed":
                    self.persist_monitoring_outputs(batch_id, run, result)
                    self.sync_cached_entity(batch_id, run, result, "completed")
                else:
                    self.sync_cached_entity(batch_id, run, result, "failed")
                log_worker_transition(
                    "run_completed" if final_status == "completed" else "run_failed",
                    worker_id=worker_id,
                    batch_id=batch_id,
                    entity_id=run.get("entity_id"),
                    entity_name=run.get("entity_name"),
                    phase=last_phase,
                    status=final_status,
                    current_action=str(
                        follow_on_repair_metadata.get("next_repair_question_id")
                        or latest_metadata.get("question_id")
                        or run_metadata.get("question_id")
                        or last_phase
                        or ""
                    ).strip() or None,
                    stop_reason=follow_on_repair_metadata.get("next_repair_status") if final_status != "completed" else None,
                    message="run finished",
                )
                self.update_run(
                    batch_id,
                    run["entity_id"],
                    {
                        "status": final_status,
                        "phase": last_phase,
                        "dossier_id": ((result.get("artifacts") or {}).get("dossier_id")) or run["entity_id"],
                        "sales_readiness": result.get("sales_readiness"),
                        "rfp_count": int(result.get("rfp_count") or 0),
                        "error_message": (
                            None
                            if publication_succeeded
                            else (
                                metadata.get("last_error")
                                if fresh_runtime_provider_failure
                                else ("dual_write_incomplete" if not dual_write_ok else None)
                            )
                        ),
                        "completed_at": self._now_iso(),
                        "metadata": metadata,
                    },
                )
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
                if self._is_backend_route_missing_error(error):
                    self._requeue_infrastructure_blocked_batch(
                        batch_id=batch_id,
                        batch=batch,
                        run=run,
                        run_metadata=run_metadata,
                        error=error,
                    )
                    heartbeat_stop.set()
                    heartbeat_thread.join(timeout=1)
                    _clear_supervisor_activity()
                    return
                retryable, error_type = self._classify_error(error)
                latest_metadata = self._get_run_metadata(batch_id, run["entity_id"])
                retry_metadata = build_run_retry_metadata(
                    latest_metadata if isinstance(latest_metadata, dict) else run_metadata,
                    retryable=retryable,
                    error_type=error_type,
                    error_message=str(error),
                    now_iso=self._now_iso(),
                )
                fresh_runtime_provider_failure = has_provider_infrastructure_failure(error)
                if not fresh_runtime_provider_failure:
                    retry_metadata = clear_provider_infrastructure_failure_metadata(retry_metadata)
                if fresh_runtime_provider_failure:
                    retry_metadata = build_run_provider_infrastructure_failure_metadata(
                        retry_metadata,
                        now_iso=self._now_iso(),
                        error_message=str(error),
                    )
                    retry_metadata["stop_reason"] = "provider_infrastructure_failure"
                    retry_metadata["stop_details"] = build_stop_reason_details(
                        reason="provider_infrastructure_failure",
                        entity_id=run.get("entity_id"),
                        canonical_entity_id=run.get("canonical_entity_id") or run_metadata.get("canonical_entity_id"),
                        entity_name=run.get("entity_name"),
                        question_id=retry_metadata.get("question_id") or retry_metadata.get("current_question_id"),
                        phase=run.get("phase"),
                        error_type="provider_infrastructure_failure",
                        error_message=str(error),
                        batch_id=batch_id,
                    )
                    self._write_terminal_stop_state(
                        reason="provider_infrastructure_failure",
                        pause_reason="provider infrastructure failure: OpenCode insufficient balance",
                        details=retry_metadata["stop_details"],
                    )
                    self.sync_cached_entity(batch_id, run, None, "failed")
                    self.update_run(
                        batch_id,
                        run["entity_id"],
                        {
                            "status": "failed",
                            "phase": run.get("phase") or "dossier_generation",
                            "error_message": str(error),
                            "completed_at": self._now_iso(),
                            "metadata": retry_metadata,
                        },
                    )
                    continue
                if should_defer_retry_for_fresh_backend_heartbeat(
                    error_type=error_type,
                    metadata=latest_metadata if isinstance(latest_metadata, dict) else run_metadata,
                    now_iso=self._now_iso(),
                    stale_seconds=max(lease_seconds, STALE_MINUTES * 60),
                ):
                    retry_metadata["retry_state"] = "backend_still_processing"
                    retry_metadata["current_execution_state"] = "backend still processing"
                    retry_metadata["backend_timeout_observed_at"] = self._now_iso()
                    retry_metadata["retryable"] = True
                    log_worker_transition(
                        "run_timeout_deferred",
                        worker_id=worker_id,
                        batch_id=batch_id,
                        entity_id=run.get("entity_id"),
                        entity_name=run.get("entity_name"),
                        phase=run.get("phase"),
                        status="running",
                        retry_state="backend_still_processing",
                        error_type=error_type,
                        current_action=run.get("phase"),
                        message="client timeout observed while backend heartbeat is fresh",
                    )
                    self.update_run(
                        batch_id,
                        run["entity_id"],
                        {
                            "status": "running",
                            "phase": run.get("phase") or "dossier_generation",
                            "error_message": str(error),
                            "completed_at": None,
                            "metadata": retry_metadata,
                        },
                    )
                    continue
                attempts = int(retry_metadata.get("attempt_count", 0) or 0)
                should_retry = retryable and attempts < max_run_attempts
                rerun_mode = str(run_metadata.get("rerun_mode") or retry_metadata.get("rerun_mode") or "").strip().lower()
                question_id = str(run_metadata.get("question_id") or retry_metadata.get("question_id") or "").strip()
                canonical_entity_id = str(
                    run.get("canonical_entity_id")
                    or run_metadata.get("canonical_entity_id")
                    or ""
                ).strip() or None
                stop_reason = None
                stop_details = None
                if not should_retry and rerun_mode == "question" and question_id and _is_question_local_failure(error_type):
                    prior_skipped_question_ids = {
                        str(question).strip()
                        for question in (latest_metadata.get("skipped_question_ids") or [])
                        if str(question or "").strip()
                    }
                    skipped_at = self._now_iso()
                    skip_reason = error_type
                    skip_note = str(error)
                    skip_error_class = error_type
                    skip_metadata, skipped_question_ids, dossier = self._build_skip_metadata(
                        entity_id=run.get("entity_id") or "",
                        canonical_entity_id=canonical_entity_id,
                        existing_metadata=latest_metadata if isinstance(latest_metadata, dict) else {},
                        dossier=None,
                        question_id=question_id,
                        skip_reason=skip_reason,
                        skip_note=skip_note,
                        skip_error_class=skip_error_class,
                        skipped_at=skipped_at,
                    )
                    retry_metadata.update(skip_metadata)
                    questions = dossier.get("questions") if isinstance(dossier, dict) and isinstance(dossier.get("questions"), list) else []
                    next_question_id = select_repair_root_question_id(
                        source_payload={"questions": questions},
                        canonical_dossier=dossier if isinstance(dossier, dict) else {"questions": questions},
                        exhausted_question_ids=set(latest_metadata.get("exhausted_question_ids") or []).union(skipped_question_ids),
                    )
                    if prior_skipped_question_ids:
                        stop_reason = "question_skipped_and_next_failed"
                        stop_details = build_stop_reason_details(
                            reason=stop_reason,
                            entity_id=run.get("entity_id"),
                            canonical_entity_id=canonical_entity_id,
                            entity_name=run.get("entity_name"),
                            question_id=question_id,
                            phase=run.get("phase"),
                            error_type=skip_error_class,
                            error_message=skip_note,
                            batch_id=batch_id,
                            attempts=attempts,
                        )
                        log_worker_transition(
                            "run_stopped",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id,
                            phase=run.get("phase"),
                            status="stopped",
                            stop_reason=stop_reason,
                            error_type=skip_error_class,
                            attempts=attempts,
                            current_action=f"question {question_id}",
                            message=skip_note,
                        )
                    elif next_question_id:
                        repair_retry_budget = int(
                            latest_metadata.get("repair_retry_budget")
                            or getattr(self, "repair_retry_budget", DEFAULT_REPAIR_RETRY_BUDGET)
                            or DEFAULT_REPAIR_RETRY_BUDGET
                        )
                        queue_result = self._queue_follow_on_repair(
                            run=run,
                            latest_metadata=latest_metadata if isinstance(latest_metadata, dict) else run_metadata,
                            result={},
                            question_id=next_question_id,
                            repair_retry_count=1,
                            repair_retry_budget=repair_retry_budget,
                            reconcile_required=False,
                        )
                        next_repair_status = str(queue_result.get("status") or "planned").strip().lower() or "planned"
                        queued_batch_id = str(queue_result.get("batch_id") or "").strip() or None
                        has_distinct_follow_on = _is_distinct_follow_on_batch_id(run.get("batch_id"), queued_batch_id)
                        retry_metadata.update(
                            {
                                "repair_state": "queued" if has_distinct_follow_on and next_repair_status == "queued" else "idle",
                                "repair_retry_count": 1,
                                "next_repair_question_id": next_question_id,
                                "next_repair_status": next_repair_status if has_distinct_follow_on else None,
                                "next_repair_batch_id": queued_batch_id if has_distinct_follow_on else None,
                                "next_repair_batch_status": next_repair_status if has_distinct_follow_on and queued_batch_id else None,
                                "repair_queue_source": queue_result.get("queue_source") or "auto",
                            }
                        )
                        retry_metadata["retry_state"] = "skipping"
                        log_worker_transition(
                            "run_skipping",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id,
                            phase=run.get("phase"),
                            status="skipping",
                            retry_state="skipping",
                            error_type=error_type,
                            attempts=attempts,
                            current_action=f"repair question {next_question_id}",
                            message="question exhausted; skipping to next repair root",
                        )
                    else:
                        stop_reason = "queue_exhausted"
                        stop_details = build_stop_reason_details(
                            reason=stop_reason,
                            entity_id=run.get("entity_id"),
                            canonical_entity_id=canonical_entity_id,
                            entity_name=run.get("entity_name"),
                            question_id=question_id,
                            phase=run.get("phase"),
                            error_type=skip_error_class,
                            error_message=skip_note,
                            batch_id=batch_id,
                            attempts=attempts,
                        )
                        log_worker_transition(
                            "run_stopped",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id,
                            phase=run.get("phase"),
                            status="stopped",
                            stop_reason=stop_reason,
                            error_type=skip_error_class,
                            attempts=attempts,
                            current_action=f"question {question_id}",
                            message=skip_note,
                        )
                elif not should_retry:
                    if _is_nonblocking_terminal_failure(error_type):
                        retry_metadata["continue_pipeline_on_failure"] = True
                        log_worker_transition(
                            "run_failed_nonblocking",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id or None,
                            phase=run.get("phase"),
                            status="failed",
                            error_type=error_type,
                            attempts=attempts,
                            current_action=f"question {question_id}" if question_id else run.get("phase"),
                            message=str(error),
                        )
                    else:
                        stop_reason = "orchestrator_unhealthy" if retryable else "question_retry_exhausted"
                        stop_details = build_stop_reason_details(
                            reason=stop_reason,
                            entity_id=run.get("entity_id"),
                            canonical_entity_id=canonical_entity_id,
                            entity_name=run.get("entity_name"),
                            question_id=question_id or None,
                            phase=run.get("phase"),
                            error_type=error_type,
                            error_message=str(error),
                            batch_id=batch_id,
                            attempts=attempts,
                        )
                        log_worker_transition(
                            "run_stopped",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id or None,
                            phase=run.get("phase"),
                            status="stopped",
                            stop_reason=stop_reason,
                            error_type=error_type,
                            attempts=attempts,
                            current_action=f"question {question_id}" if question_id else run.get("phase"),
                            message=str(error),
                        )
                next_status = "retrying" if should_retry else "failed"
                if should_retry:
                    log_worker_transition(
                        "run_retrying",
                        worker_id=worker_id,
                        batch_id=batch_id,
                        entity_id=run.get("entity_id"),
                        entity_name=run.get("entity_name"),
                        question_id=question_id or None,
                        phase=run.get("phase"),
                        status="retrying",
                        retry_state="retrying",
                        error_type=error_type,
                        attempts=attempts,
                        current_action=f"question {question_id}" if question_id else run.get("phase"),
                        message=str(error),
                    )
                if next_status == "failed":
                    if error_type == "timeout":
                        retry_metadata = build_run_timeout_failure_metadata(
                            retry_metadata,
                            now_iso=self._now_iso(),
                        )
                        retry_metadata["stop_reason"] = "entity_pipeline_timeout"
                        retry_metadata["stop_details"] = build_stop_reason_details(
                            reason="entity_pipeline_timeout",
                            entity_id=run.get("entity_id"),
                            canonical_entity_id=canonical_entity_id,
                            entity_name=run.get("entity_name"),
                            question_id=question_id or None,
                            phase=run.get("phase"),
                            error_type=error_type,
                            error_message=str(error),
                            batch_id=batch_id,
                            attempts=attempts,
                        )
                        log_worker_transition(
                            "run_failed_nonblocking",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id or None,
                            phase=run.get("phase"),
                            status="failed",
                            retry_state="failed",
                            stop_reason="entity_pipeline_timeout",
                            error_type=error_type,
                            attempts=attempts,
                            current_action=f"question {question_id}" if question_id else run.get("phase"),
                            message="timed out",
                        )
                    elif _is_nonblocking_terminal_failure(error_type):
                        retry_metadata["continue_pipeline_on_failure"] = True
                        log_worker_transition(
                            "run_failed_nonblocking",
                            worker_id=worker_id,
                            batch_id=batch_id,
                            entity_id=run.get("entity_id"),
                            entity_name=run.get("entity_name"),
                            question_id=question_id or None,
                            phase=run.get("phase"),
                            status="failed",
                            error_type=error_type,
                            attempts=attempts,
                            current_action=f"question {question_id}" if question_id else run.get("phase"),
                            message=str(error),
                        )
                    else:
                        retry_metadata["retry_state"] = retry_metadata.get("retry_state") or "failed"
                        if stop_reason:
                            retry_metadata["stop_reason"] = stop_reason
                            retry_metadata["stop_details"] = stop_details
                            self._write_terminal_stop_state(
                                reason=stop_reason,
                                pause_reason=f"{stop_reason.replace('_', ' ')}",
                                details=stop_details,
                            )
                    self.sync_cached_entity(batch_id, run, None, "failed")
                self.update_run(
                    batch_id,
                    run["entity_id"],
                    {
                        "status": next_status,
                        "phase": run.get("phase") or "entity_registration",
                        "error_message": str(error),
                        "completed_at": None if next_status == "queued" else self._now_iso(),
                        "metadata": retry_metadata,
                    },
                )
                self._safe_execute(
                    lambda: self.supabase.rpc(
                        "fail_entity_pipeline_run",
                        {
                            "batch_id": batch_id,
                            "entity_id": run["entity_id"],
                            "error_message": str(error),
                            "retryable": should_retry,
                        },
                    ).execute(),
                    context=f"mark run failure {batch_id}/{run['entity_id']}",
                )
            batch["metadata"] = self.refresh_batch_heartbeat(batch_id, self._batch_metadata(batch))
        heartbeat_stop.set()
        heartbeat_thread.join(timeout=1)
        _clear_supervisor_activity()
        final_runs = self.get_batch_runs(batch_id)
        if any(run.get("status") == "retrying" for run in final_runs):
            self._safe_execute(
                lambda: self.supabase.table("entity_import_batches").update(
                    build_batch_retry_update(
                        self._batch_metadata(batch),
                        now_iso=self._now_iso(),
                        error_message="Retrying one or more pipeline runs",
                    )
                ).eq("id", batch_id).execute(),
                context=f"requeue batch {batch_id}",
            )
        elif any(run.get("status") == "failed" for run in final_runs):
            self._safe_execute(
                lambda: self.supabase.table("entity_import_batches").update(
                    build_batch_failed_update(
                        self._batch_metadata(batch),
                        now_iso=self._now_iso(),
                    )
                ).eq("id", batch_id).execute(),
                context=f"finalize failed batch {batch_id}",
            )
            failed_source_run = next(
                (
                    candidate
                    for candidate in final_runs
                    if str(candidate.get("status") or "").strip().lower() == "failed"
                ),
                None,
            )
            failed_metadata = failed_source_run.get("metadata") if isinstance(failed_source_run, dict) and isinstance(failed_source_run.get("metadata"), dict) else {}
            if failed_source_run and failed_metadata.get("continue_pipeline_on_failure") is True:
                latest_batch_metadata = self._batch_metadata(batch)
                try:
                    fetched_batch_metadata = self._get_batch_metadata(batch_id)
                    if fetched_batch_metadata:
                        latest_batch_metadata = fetched_batch_metadata
                except Exception as error:
                    logger.warning("Failed to fetch batch metadata for failed auto-advance %s: %s", batch_id, error)
                continuation_result = None
                if str(failed_metadata.get("failure_class") or "").strip().lower() == "entity_pipeline_timeout":
                    continuation_result = self._queue_question_first_continuation(
                        batch_id=batch_id,
                        source_run=failed_source_run,
                        batch_metadata=latest_batch_metadata,
                    )
                if continuation_result:
                    failed_batch_metadata = {
                        **latest_batch_metadata,
                        "question_first_continuation_next_batch_id": continuation_result["batch_id"],
                        "question_first_continuation_next_entity_id": continuation_result["entity_id"],
                        "question_first_continuation_next_entity_name": continuation_result["entity_name"],
                        "question_first_continuation_next_entity_type": continuation_result["entity_type"],
                        "question_first_continuation_next_question_id": continuation_result["next_question_id"],
                        "question_first_continuation_questions_answered": continuation_result["questions_answered"],
                        "question_first_continuation_state": "queued",
                    }
                    self._safe_execute(
                        lambda: self.supabase.table("entity_import_batches").update(
                            {"metadata": failed_batch_metadata}
                        ).eq("id", batch_id).execute(),
                        context=f"mark failed question-first continuation batch {batch_id}",
                    )
                else:
                    auto_advance_result = self._queue_manifest_auto_advance(
                        batch_id=batch_id,
                        source_run=failed_source_run,
                        batch_metadata=latest_batch_metadata,
                    )
                    if auto_advance_result:
                        failed_batch_metadata = {
                            **latest_batch_metadata,
                            "auto_advance_next_batch_id": auto_advance_result["batch_id"],
                            "auto_advance_next_entity_id": auto_advance_result["entity_id"],
                            "auto_advance_next_entity_name": auto_advance_result["entity_name"],
                            "auto_advance_next_entity_type": auto_advance_result["entity_type"],
                            "auto_advance_state": "queued",
                        }
                        self._safe_execute(
                            lambda: self.supabase.table("entity_import_batches").update(
                                {"metadata": failed_batch_metadata}
                            ).eq("id", batch_id).execute(),
                            context=f"mark failed auto-advance batch {batch_id}",
                        )
        else:
            self._safe_execute(
                lambda: self.supabase.rpc(
                    "complete_entity_import_batch",
                    {"batch_id": batch_id, "worker_id": worker_id},
                ).execute(),
                context=f"finalize batch {batch_id}",
            )
            latest_batch_metadata = self._batch_metadata(batch)
            try:
                fetched_batch_metadata = self._get_batch_metadata(batch_id)
                if fetched_batch_metadata:
                    latest_batch_metadata = fetched_batch_metadata
            except Exception as error:
                logger.warning("Failed to fetch batch metadata for normalization %s: %s", batch_id, error)
            completed_update = build_batch_completed_update(
                latest_batch_metadata,
                worker_id=worker_id,
                now_iso=self._now_iso(),
            )
            batch["metadata"] = completed_update["metadata"]
            self._safe_execute(
                lambda: self.supabase.table("entity_import_batches").update(
                    completed_update
                ).eq("id", batch_id).execute(),
                context=f"normalize completed batch metadata {batch_id}",
            )
            auto_advance_result = self._queue_manifest_auto_advance(
                batch_id=batch_id,
                source_run=final_runs[-1] if final_runs else {},
                batch_metadata=latest_batch_metadata,
            )
            if auto_advance_result:
                auto_advance_metadata = {
                    **completed_update["metadata"],
                    "auto_advance_next_batch_id": auto_advance_result["batch_id"],
                    "auto_advance_next_entity_id": auto_advance_result["entity_id"],
                    "auto_advance_next_entity_name": auto_advance_result["entity_name"],
                    "auto_advance_next_entity_type": auto_advance_result["entity_type"],
                    "auto_advance_state": "queued",
                }
                self._safe_execute(
                    lambda: self.supabase.table("entity_import_batches").update(
                        {"metadata": auto_advance_metadata}
                    ).eq("id", batch_id).execute(),
                    context=f"mark auto-advance batch {batch_id}",
                )
            elif final_runs:
                write_pipeline_control_state(
                    build_post_batch_idle_control_state(
                        read_pipeline_control_state(),
                        now_iso=self._now_iso(),
                    )
                )
                log_worker_transition(
                    "claim_cycle_empty",
                    worker_id=worker_id,
                    batch_id=batch_id,
                    status="idle",
                    message="no resumable or manifest follow-on entity available",
                )

    def run_forever(self) -> None:
        claim_failure_streak = 0
        while True:
            _heartbeat_supervisor_state()
            try:
                batch = self.claim_next_batch()
                claim_failure_streak = 0
            except Exception as error:
                logger.warning("Worker claim cycle failed: %s", error)
                log_worker_transition(
                    "claim_cycle_failed",
                    worker_id=getattr(self, "worker_id", "worker-test"),
                    status="retrying",
                    error_type=type(error).__name__,
                    message=str(error),
                )
                claim_failure_streak += 1
                if claim_failure_streak >= 3:
                    self._write_terminal_stop_state(
                        reason="orchestrator_unhealthy",
                        pause_reason="orchestrator unhealthy",
                        details=build_stop_reason_details(
                            reason="orchestrator_unhealthy",
                            error_type=type(error).__name__,
                            error_message=str(error),
                            attempts=claim_failure_streak,
                        ),
                    )
                    log_worker_transition(
                        "pipeline_stopped",
                        worker_id=getattr(self, "worker_id", "worker-test"),
                        status="stopped",
                        stop_reason="orchestrator_unhealthy",
                        message="claim cycle failed too many times",
                    )
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            if not batch:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            logger.info("Worker claimed batch %s", batch.get("id"))
            try:
                self.process_batch(batch)
                logger.info("Worker finished batch %s", batch.get("id"))
            except Exception as error:
                logger.exception("Worker failed while processing batch %s: %s", batch.get("id"), error)
                time.sleep(POLL_INTERVAL_SECONDS)


def main() -> None:
    try:
        logger.info("Starting entity pipeline worker")
        logger.info("Worker queue mode=%s fastapi_url=%s", QUEUE_MODE, FASTAPI_URL)
        if should_process_in_process(QUEUE_MODE):
            raise SystemExit("ENTITY_IMPORT_QUEUE_MODE must be 'durable_worker' to run this worker")
        _write_supervisor_state("running")
        normalize_pipeline_control_state_for_worker_start()
        worker = EntityPipelineWorker()
        worker.run_forever()
    except SystemExit:
        _write_supervisor_state("stopped")
        raise
    except Exception as error:
        logger.exception("Entity pipeline worker crashed: %s", error)
        _write_supervisor_state("crashed", error=str(error), stopped_at=datetime.now(timezone.utc).isoformat())
        raise


if __name__ == "__main__":
    main()
