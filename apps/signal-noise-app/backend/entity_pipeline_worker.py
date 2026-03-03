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

logger = logging.getLogger(__name__)

DEFAULT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def load_worker_environment(env_path: Optional[Path] = None) -> None:
    dotenv_path = env_path or DEFAULT_ENV_PATH
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path, override=False)


load_worker_environment()

FASTAPI_URL = os.getenv("FASTAPI_URL") or os.getenv("PYTHON_BACKEND_URL") or "http://localhost:8000"
PIPELINE_TIMEOUT_SECONDS = int(os.getenv("ENTITY_PIPELINE_TIMEOUT_SECONDS", "300"))
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


def build_batch_claim_metadata(existing_metadata: Optional[Dict[str, Any]], *, worker_id: str, now_iso: str) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata.update(
        {
            "queue_mode": "durable_worker",
            "worker_id": worker_id,
            "claimed_at": now_iso,
            "heartbeat_at": now_iso,
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
    return metadata


def build_batch_heartbeat_metadata(existing_metadata: Optional[Dict[str, Any]], *, now_iso: str) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    metadata["heartbeat_at"] = now_iso
    return metadata


def build_batch_running_update(existing_metadata: Optional[Dict[str, Any]], *, now_iso: str) -> Dict[str, Any]:
    return {
        "status": "running",
        "metadata": build_batch_heartbeat_metadata(existing_metadata, now_iso=now_iso),
    }


def merge_pipeline_run_metadata(
    existing_metadata: Optional[Dict[str, Any]],
    *,
    phases: Optional[Dict[str, Any]] = None,
    scores: Optional[Dict[str, Any]] = None,
    performance_summary: Optional[Dict[str, Any]] = None,
    discovery_context: Optional[Dict[str, Any]] = None,
    promoted_rfp_ids: Optional[list[str]] = None,
    completed_at: Optional[str] = None,
) -> Dict[str, Any]:
    metadata = deepcopy(existing_metadata or {})
    if phases is not None:
        metadata["phases"] = phases
    if scores is not None:
        metadata["scores"] = scores
    if performance_summary is not None:
        metadata["performance_summary"] = performance_summary
    if discovery_context is not None:
        metadata["discovery_context"] = discovery_context
    if promoted_rfp_ids is not None:
        metadata["promoted_rfp_ids"] = promoted_rfp_ids
    if completed_at is not None:
        metadata["completed_at"] = completed_at
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


def derive_discovery_context(result: Dict[str, Any]) -> Dict[str, Any]:
    discovery_result = ((result.get("artifacts") or {}).get("discovery_result") or {})
    hypotheses = discovery_result.get("hypotheses") or []
    if not isinstance(hypotheses, list):
        hypotheses = []
    performance_summary = discovery_result.get("performance_summary") or {}
    slowest_iteration = performance_summary.get("slowest_iteration") or {}

    lead_hypothesis = hypotheses[0] if hypotheses else None
    slowest_hypothesis = None
    if slowest_iteration.get("hypothesis_id"):
        for hypothesis in hypotheses:
            if str(hypothesis.get("hypothesis_id") or "") == str(slowest_iteration.get("hypothesis_id")):
                slowest_hypothesis = hypothesis
                break

    lead_metadata = lead_hypothesis.get("metadata") if isinstance(lead_hypothesis, dict) else {}
    slowest_metadata = slowest_hypothesis.get("metadata") if isinstance(slowest_hypothesis, dict) else {}

    template_id = (
        (slowest_metadata or {}).get("template_id")
        or (lead_metadata or {}).get("template_id")
    )

    return {
        "template_id": template_id,
        "lead_hypothesis_id": lead_hypothesis.get("hypothesis_id") if isinstance(lead_hypothesis, dict) else None,
        "lead_pattern_name": (lead_metadata or {}).get("pattern_name"),
        "lead_confidence": lead_hypothesis.get("confidence") if isinstance(lead_hypothesis, dict) else None,
        "slowest_hypothesis_id": slowest_iteration.get("hypothesis_id"),
        "slowest_hop_type": slowest_iteration.get("hop_type"),
    }


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
        heartbeat_metadata = build_batch_heartbeat_metadata(metadata, now_iso=self._now_iso())
        self._safe_execute(
            lambda: self.supabase.rpc(
                "renew_entity_import_batch_lease",
                {
                    "batch_id": batch_id,
                    "worker_id": self.worker_id,
                    "lease_seconds": self.lease_seconds,
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
        with urlopen(request, timeout=PIPELINE_TIMEOUT_SECONDS) as response:
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
        failed_runs = 0
        max_run_attempts = getattr(self, "max_run_attempts", MAX_RUN_ATTEMPTS)
        lease_seconds = getattr(self, "lease_seconds", LEASE_SECONDS)
        worker_id = getattr(self, "worker_id", "worker-test")
        heartbeat_stop, heartbeat_thread = self._start_batch_heartbeat(batch_id, self._batch_metadata(batch))
        for run in self.get_batch_runs(batch_id):
            if run.get("status") == "completed":
                continue
            run_metadata = run.get("metadata") if isinstance(run.get("metadata"), dict) else {}
            attempt_count = int(run_metadata.get("attempt_count", 0) or 0)
            if attempt_count >= max_run_attempts and run.get("status") == "failed":
                failed_runs += 1
                continue
            self.update_run(
                batch_id,
                run["entity_id"],
                {
                    "status": "running",
                    "phase": "dossier_generation",
                    "error_message": None,
                        "metadata": {
                            **run_metadata,
                            "lease_owner": worker_id,
                            "lease_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=lease_seconds)).isoformat(),
                        },
                },
            )
            try:
                result = self.call_pipeline(run, batch_id)
                phases = result.get("phases") or {}
                completed_phases = [name for name, detail in phases.items() if detail.get("status") == "completed"]
                last_phase = completed_phases[-1] if completed_phases else "dashboard_scoring"
                latest_metadata = self._get_run_metadata(batch_id, run["entity_id"])
                metadata = merge_pipeline_run_metadata(
                    latest_metadata if isinstance(latest_metadata, dict) else run_metadata,
                    phases=phases,
                    scores=((result.get("artifacts") or {}).get("scores")),
                    performance_summary=(((result.get("artifacts") or {}).get("discovery_result") or {}).get("performance_summary")),
                    discovery_context=derive_discovery_context(result),
                    promoted_rfp_ids=[],
                    completed_at=result.get("completed_at"),
                )
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
                next_status = "queued" if retryable and attempts < max_run_attempts else "failed"
                if next_status == "failed":
                    failed_runs += 1
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
        if failed_runs > 0:
            self._safe_execute(
                lambda: self.supabase.table("entity_import_batches").update(
                    {
                        "status": "failed",
                        "completed_at": self._now_iso(),
                        "metadata": build_batch_heartbeat_metadata(self._batch_metadata(batch), now_iso=self._now_iso()),
                    }
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
    if should_process_in_process(QUEUE_MODE):
        raise SystemExit("ENTITY_IMPORT_QUEUE_MODE must be 'durable_worker' to run this worker")
    worker = EntityPipelineWorker()
    worker.run_forever()


if __name__ == "__main__":
    main()
