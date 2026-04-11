import json
import os
import socket
import threading
import time
import logging
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
STALE_MINUTES = int(os.getenv("ENTITY_PIPELINE_STALE_MINUTES", "30"))
LEASE_SECONDS = int(os.getenv("ENTITY_PIPELINE_LEASE_SECONDS", "90"))
MAX_RUN_ATTEMPTS = int(os.getenv("ENTITY_PIPELINE_MAX_RUN_ATTEMPTS", "2"))
DEFAULT_REPAIR_RETRY_BUDGET = int(os.getenv("ENTITY_PIPELINE_REPAIR_RETRY_BUDGET", "3"))
TERMINAL_BATCH_STATUSES = {"completed", "failed"}


def read_pipeline_control_state() -> Dict[str, Any]:
    try:
        payload = json.loads(PIPELINE_CONTROL_STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {
            "is_paused": False,
            "pause_reason": None,
            "updated_at": None,
            "desired_state": "running",
            "requested_state": "running",
            "observed_state": "running",
            "transition_state": "running",
        }

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
    return {
        "is_paused": bool(payload.get("is_paused")),
        "pause_reason": str(payload.get("pause_reason") or "").strip() or None,
        "updated_at": str(payload.get("updated_at") or "").strip() or None,
        "desired_state": desired_state,
        "requested_state": requested_state,
        "observed_state": observed_state,
        "transition_state": transition_state,
    }


def write_pipeline_control_state(payload: Dict[str, Any]) -> Dict[str, Any]:
    requested_state = str(payload.get("requested_state") or "").strip().lower()
    if requested_state not in PIPELINE_CONTROL_REQUESTED_STATES:
        requested_state = "paused" if payload.get("is_paused") is True else "running"
    transition_state = str(payload.get("transition_state") or "").strip().lower()
    if transition_state not in PIPELINE_CONTROL_OBSERVED_STATES:
        transition_state = "stopping" if requested_state == "paused" else "starting"
    observed_state = str(payload.get("observed_state") or "").strip().lower()
    if observed_state not in PIPELINE_CONTROL_OBSERVED_STATES:
        observed_state = transition_state
    desired_state = str(payload.get("desired_state") or "").strip().lower()
    if desired_state not in PIPELINE_CONTROL_REQUESTED_STATES:
        desired_state = requested_state
    is_paused = bool(payload.get("is_paused")) or requested_state == "paused" or observed_state == "paused"
    next_state = {
        "is_paused": is_paused,
        "pause_reason": (str(payload.get("pause_reason") or "").strip() or None) if is_paused else None,
        "updated_at": str(payload.get("updated_at") or "").strip() or datetime.now(timezone.utc).isoformat(),
        "desired_state": desired_state,
        "requested_state": requested_state,
        "observed_state": observed_state,
        "transition_state": transition_state,
    }
    PIPELINE_CONTROL_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PIPELINE_CONTROL_STATE_PATH.write_text(json.dumps(next_state, indent=2), encoding="utf-8")
    return next_state


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
    metadata["attempt_count"] = int(metadata.get("attempt_count", 0) or 0) + 1
    metadata["lease_owner"] = worker_id
    metadata["lease_expires_at"] = (datetime.fromisoformat(now_iso) + timedelta(seconds=lease_seconds)).isoformat()
    metadata["retryable"] = False
    metadata["retry_state"] = "running"
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
        heartbeat_metadata = build_batch_heartbeat_metadata(
            metadata,
            now_iso=self._now_iso(),
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

    def claim_next_batch(self) -> Optional[Dict[str, Any]]:
        control_state = read_pipeline_control_state()
        if control_state.get("is_paused") is True:
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
            return None
        self.recover_stale_batches()
        response = self.supabase.rpc(
            "claim_next_entity_import_batch",
            {
                "worker_id": self.worker_id,
                "lease_seconds": self.lease_seconds,
            },
        ).execute()
        batches = response.data or []
        if not batches:
            return None
        write_pipeline_control_state(
            {
                **control_state,
                "requested_state": "running",
                "observed_state": "running",
                "transition_state": "running",
                "is_paused": False,
                "updated_at": self._now_iso(),
            }
        )
        return batches[0]

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
        return response_body

    def sync_cached_entity(self, batch_id: str, run: Dict[str, Any], result: Optional[Dict[str, Any]], status: str) -> None:
        run_metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
        canonical_entity_id = str(
            run.get("canonical_entity_id")
            or run_metadata.get("canonical_entity_id")
            or ""
        ).strip()
        if canonical_entity_id:
            lookup = (
                self.supabase.table("cached_entities")
                .select("id, properties")
                .eq("canonical_entity_id", canonical_entity_id)
                .limit(1)
                .execute()
            )
        else:
            lookup = (
                self.supabase.table("cached_entities")
                .select("id, properties")
                .eq("neo4j_id", run["entity_id"])
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
            update_query = self.supabase.table("cached_entities").update({"properties": properties}).eq("id", cache_row_id)
        elif canonical_entity_id:
            update_query = self.supabase.table("cached_entities").update({"properties": properties}).eq(
                "canonical_entity_id", canonical_entity_id
            )
        else:
            update_query = self.supabase.table("cached_entities").update({"properties": properties}).eq(
                "neo4j_id", run["entity_id"]
            )
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
            existing_batch = self._get_batch_record(existing_batch_id) if existing_batch_id else {}
            existing_status = self._normalize_follow_on_batch_status(
                batch_status=existing_batch.get("status") if isinstance(existing_batch, dict) else None,
                run_status=existing.get("status"),
            )
            return {
                "batch_id": existing_batch_id,
                "status": existing_status,
                "queue_source": "reused",
            }

        now_iso = self._now_iso()
        follow_on_batch_id = self._build_follow_on_repair_batch_id()
        queue_mode = str(latest_metadata.get("queue_mode") or QUEUE_MODE)
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
                "next_repair_question_id": question_id,
                "next_repair_status": "queued",
                "next_repair_batch_id": follow_on_batch_id,
                "next_repair_batch_status": "queued",
                "reconciliation_state": "pending" if reconcile_required else "healthy",
                "rerun_reason": f"Auto-repair queued for {question_id}",
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
                "next_repair_question_id": question_id,
                "next_repair_status": "queued",
                "next_repair_batch_id": follow_on_batch_id,
                "next_repair_batch_status": "queued",
                "reconciliation_state": "pending" if reconcile_required else "healthy",
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

        next_retry_count = repair_retry_count + 1
        if next_retry_count > repair_retry_budget:
            skipped_at = self._now_iso()
            skip_reason = "retry_exhausted"
            skip_note = _derive_skip_note(latest_metadata)
            skip_error_class = str(latest_metadata.get("last_error_type") or "retry_exhausted").strip() or None
            skipped_question_ids.add(next_repair_question_id)
            self._apply_skip_to_dossier_payload(
                dossier if isinstance(dossier, dict) else {},
                question_id=next_repair_question_id,
                skip_reason=skip_reason,
                skip_note=skip_note,
                skip_error_class=skip_error_class,
                skipped_at=skipped_at,
            )
            self._persist_skip_to_entity_dossier(
                entity_id=run.get("entity_id") or "",
                canonical_entity_id=str(run.get("canonical_entity_id") or latest_metadata.get("canonical_entity_id") or "").strip() or None,
                question_id=next_repair_question_id,
                skip_reason=skip_reason,
                skip_note=skip_note,
                skip_error_class=skip_error_class,
                skipped_at=skipped_at,
            )
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
            return {
                **base_metadata,
                "repair_state": "repairing" if next_repair_status == "running" else ("queued" if next_repair_status == "queued" else "idle"),
                "repair_retry_count": 1,
                "next_repair_question_id": follow_on_question_id,
                "next_repair_status": next_repair_status,
                "next_repair_batch_id": queued_batch_id,
                "next_repair_batch_status": next_repair_status if queued_batch_id else None,
                "repair_queue_source": queue_result.get("queue_source") or "auto",
                "queued_repair_batch_id": queued_batch_id,
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
            question_id=next_repair_question_id,
            repair_retry_count=next_retry_count,
            repair_retry_budget=repair_retry_budget,
            reconcile_required=reconcile_required,
        )
        next_repair_status = str(queue_result.get("status") or "planned").strip().lower() or "planned"
        queued_batch_id = str(queue_result.get("batch_id") or "").strip() or None
        return {
            **base_metadata,
            "repair_state": "repairing" if next_repair_status == "running" else ("queued" if next_repair_status == "queued" else "idle"),
            "repair_retry_count": next_retry_count,
            "next_repair_question_id": next_repair_question_id,
            "next_repair_status": next_repair_status,
            "next_repair_batch_id": queued_batch_id,
            "next_repair_batch_status": next_repair_status if queued_batch_id else None,
            "repair_queue_source": queue_result.get("queue_source") or "auto",
            "queued_repair_batch_id": queued_batch_id,
        }

    def process_batch(self, batch: Dict[str, Any]) -> None:
        batch_id = batch["id"]
        max_run_attempts = getattr(self, "max_run_attempts", MAX_RUN_ATTEMPTS)
        lease_seconds = getattr(self, "lease_seconds", LEASE_SECONDS)
        worker_id = getattr(self, "worker_id", "worker-test")
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
                final_status = "completed" if publication_succeeded else "failed"
                if final_status == "completed":
                    self.persist_monitoring_outputs(batch_id, run, result)
                    self.sync_cached_entity(batch_id, run, result, "completed")
                else:
                    self.sync_cached_entity(batch_id, run, result, "failed")
                self.update_run(
                    batch_id,
                    run["entity_id"],
                    {
                        "status": final_status,
                        "phase": last_phase,
                        "dossier_id": ((result.get("artifacts") or {}).get("dossier_id")) or run["entity_id"],
                        "sales_readiness": result.get("sales_readiness"),
                        "rfp_count": int(result.get("rfp_count") or 0),
                        "error_message": None if publication_succeeded else ("dual_write_incomplete" if not dual_write_ok else None),
                        "completed_at": self._now_iso(),
                        "metadata": metadata,
                    },
                )
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
                retryable, error_type = self._classify_error(error)
                latest_metadata = self._get_run_metadata(batch_id, run["entity_id"])
                retry_metadata = build_run_retry_metadata(
                    latest_metadata if isinstance(latest_metadata, dict) else run_metadata,
                    retryable=retryable,
                    error_type=error_type,
                    error_message=str(error),
                    now_iso=self._now_iso(),
                )
                attempts = int(retry_metadata.get("attempt_count", 0) or 0)
                should_retry = retryable and attempts < max_run_attempts
                rerun_mode = str(run_metadata.get("rerun_mode") or retry_metadata.get("rerun_mode") or "").strip().lower()
                question_id = str(run_metadata.get("question_id") or retry_metadata.get("question_id") or "").strip()
                canonical_entity_id = str(
                    run.get("canonical_entity_id")
                    or run_metadata.get("canonical_entity_id")
                    or ""
                ).strip() or None
                if not should_retry and rerun_mode == "question" and question_id and _is_question_local_failure(error_type):
                    skipped_at = self._now_iso()
                    skip_reason = error_type
                    skip_note = str(error)
                    skip_error_class = error_type
                    skipped_question_ids = {
                        str(question).strip()
                        for question in (latest_metadata.get("skipped_question_ids") or [])
                        if str(question or "").strip()
                    }
                    skipped_question_ids.add(question_id)
                    self._persist_skip_to_entity_dossier(
                        entity_id=run.get("entity_id") or "",
                        canonical_entity_id=canonical_entity_id,
                        question_id=question_id,
                        skip_reason=skip_reason,
                        skip_note=skip_note,
                        skip_error_class=skip_error_class,
                        skipped_at=skipped_at,
                    )
                    retry_metadata.update(
                        {
                            "skipped_question_ids": sorted(skipped_question_ids),
                            "last_skipped_question_id": question_id,
                            "last_skip_reason": skip_reason,
                            "last_skip_note": skip_note,
                            "last_skip_error_class": skip_error_class,
                            "last_skipped_at": skipped_at,
                        }
                    )
                    _, dossier = self._load_persisted_dossier(run.get("entity_id") or "", canonical_entity_id)
                    if isinstance(dossier, dict):
                        self._apply_skip_to_dossier_payload(
                            dossier,
                            question_id=question_id,
                            skip_reason=skip_reason,
                            skip_note=skip_note,
                            skip_error_class=skip_error_class,
                            skipped_at=skipped_at,
                        )
                    questions = dossier.get("questions") if isinstance(dossier, dict) and isinstance(dossier.get("questions"), list) else []
                    next_question_id = select_repair_root_question_id(
                        source_payload={"questions": questions},
                        canonical_dossier=dossier if isinstance(dossier, dict) else {"questions": questions},
                        exhausted_question_ids=set(latest_metadata.get("exhausted_question_ids") or []).union(skipped_question_ids),
                    )
                    if next_question_id:
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
                        retry_metadata.update(
                            {
                                "repair_state": "queued" if next_repair_status == "queued" else "idle",
                                "repair_retry_count": 1,
                                "next_repair_question_id": next_question_id,
                                "next_repair_status": next_repair_status,
                                "next_repair_batch_id": str(queue_result.get("batch_id") or "").strip() or None,
                                "next_repair_batch_status": next_repair_status if queue_result.get("batch_id") else None,
                                "repair_queue_source": queue_result.get("queue_source") or "auto",
                            }
                        )
                next_status = "retrying" if should_retry else "failed"
                if next_status == "failed":
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

    def run_forever(self) -> None:
        while True:
            try:
                batch = self.claim_next_batch()
            except Exception as error:
                logger.warning("Worker claim cycle failed: %s", error)
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
        worker = EntityPipelineWorker()
        worker.run_forever()
    except SystemExit:
        raise
    except Exception as error:
        logger.exception("Entity pipeline worker crashed: %s", error)
        raise


if __name__ == "__main__":
    main()
