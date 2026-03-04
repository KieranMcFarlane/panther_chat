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
from supabase import create_client
from pipeline_run_metadata import (
    derive_discovery_context,
    derive_monitoring_summary,
    merge_pipeline_run_metadata,
)

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.getenv("ENTITY_PIPELINE_WORKER_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

DEFAULT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


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
QUEUE_MODE = os.getenv("ENTITY_IMPORT_QUEUE_MODE", "in_process")
POLL_INTERVAL_SECONDS = int(os.getenv("ENTITY_PIPELINE_WORKER_POLL_SECONDS", "10"))
STALE_MINUTES = int(os.getenv("ENTITY_PIPELINE_STALE_MINUTES", "30"))
LEASE_SECONDS = int(os.getenv("ENTITY_PIPELINE_LEASE_SECONDS", "90"))
MAX_RUN_ATTEMPTS = int(os.getenv("ENTITY_PIPELINE_MAX_RUN_ATTEMPTS", "2"))


def should_process_in_process(queue_mode: Optional[str]) -> bool:
    return (queue_mode or "in_process") != "durable_worker"


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
    metadata["lease_owner"] = worker_id
    metadata["lease_expires_at"] = (datetime.fromisoformat(now_iso) + timedelta(seconds=lease_seconds)).isoformat()
    metadata["retryable"] = False
    metadata["retry_state"] = "running"
    return metadata


def build_run_phase_start_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    worker_id: str,
    now_iso: str,
    lease_seconds: int,
    phase: str,
    entity_name: str,
) -> Dict[str, Any]:
    metadata = build_run_start_metadata(
        existing_metadata,
        worker_id=worker_id,
        now_iso=now_iso,
        lease_seconds=lease_seconds,
    )
    metadata["phase_details"] = {
        "status": "running",
        "phase": phase,
        "entity_name": entity_name,
        "entity_type": metadata.get("entity_type"),
        "priority_score": metadata.get("priority_score"),
    }
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
        payload = {
            "batch_id": batch_id,
            "entity_id": run["entity_id"],
            "entity_name": run["entity_name"],
            "entity_type": str((run.get("metadata") or {}).get("entity_type") or "CLUB"),
            "priority_score": int((run.get("metadata") or {}).get("priority_score") or 50),
        }
        request = Request(
            f"{FASTAPI_URL}/api/pipeline/run-entity",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=resolve_pipeline_timeout(PIPELINE_TIMEOUT_SECONDS)) as response:
            return json.loads(response.read().decode("utf-8"))

    def sync_cached_entity(self, batch_id: str, run: Dict[str, Any], result: Optional[Dict[str, Any]], status: str) -> None:
        lookup = (
            self.supabase.table("cached_entities")
            .select("properties")
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
        self._safe_execute(
            lambda: self.supabase.table("cached_entities").update({"properties": properties}).eq(
                "neo4j_id", run["entity_id"]
            ).execute(),
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

    def _classify_error(self, error: Exception) -> tuple[bool, str]:
        if isinstance(error, TimeoutError):
            return True, "timeout"
        if isinstance(error, URLError):
            return True, "network"
        if isinstance(error, HTTPError):
            return error.code >= 500, f"http_{error.code}"
        if isinstance(error, json.JSONDecodeError):
            return False, "json_decode"
        if isinstance(error, ValueError):
            return False, "value_error"
        return False, error.__class__.__name__.lower()

    def process_batch(self, batch: Dict[str, Any]) -> None:
        batch_id = batch["id"]
        max_run_attempts = getattr(self, "max_run_attempts", MAX_RUN_ATTEMPTS)
        lease_seconds = getattr(self, "lease_seconds", LEASE_SECONDS)
        worker_id = getattr(self, "worker_id", "worker-test")
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
                    "metadata": build_run_phase_start_metadata(
                        run_metadata,
                        worker_id=worker_id,
                        now_iso=now_iso,
                        lease_seconds=lease_seconds,
                        phase="dossier_generation",
                        entity_name=run["entity_name"],
                    ),
                },
            )
            try:
                result = self.call_pipeline(run, batch_id)
                phases = result.get("phases") or {}
                completed_phases = [name for name, detail in phases.items() if detail.get("status") == "completed"]
                last_phase = completed_phases[-1] if completed_phases else "dashboard_scoring"
                latest_metadata = self._get_run_metadata(batch_id, run["entity_id"])
                metadata = merge_pipeline_run_metadata(
                    build_run_success_metadata(latest_metadata if isinstance(latest_metadata, dict) else run_metadata),
                    phases=phases,
                    scores=((result.get("artifacts") or {}).get("scores")),
                    monitoring_summary=derive_monitoring_summary(result),
                    escalation_reason=(result.get("artifacts") or {}).get("escalation_reason"),
                    performance_summary=(((result.get("artifacts") or {}).get("discovery_result") or {}).get("performance_summary")),
                    discovery_context=derive_discovery_context(result),
                    promoted_rfp_ids=[],
                    completed_at=result.get("completed_at"),
                )
                self.persist_monitoring_outputs(batch_id, run, result)
                self.sync_cached_entity(batch_id, run, result, "completed")
                self.update_run(
                    batch_id,
                    run["entity_id"],
                    {
                        "status": "completed",
                        "phase": last_phase,
                        "dossier_id": ((result.get("artifacts") or {}).get("dossier_id")) or run["entity_id"],
                        "sales_readiness": result.get("sales_readiness"),
                        "rfp_count": int(result.get("rfp_count") or 0),
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
                            "retryable": retryable,
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
