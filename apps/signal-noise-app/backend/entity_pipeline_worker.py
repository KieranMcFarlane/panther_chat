import json
import os
import socket
import time
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from supabase import create_client


FASTAPI_URL = os.getenv("FASTAPI_URL") or os.getenv("PYTHON_BACKEND_URL") or "http://localhost:8000"
PIPELINE_TIMEOUT_SECONDS = int(os.getenv("ENTITY_PIPELINE_TIMEOUT_SECONDS", "300"))
QUEUE_MODE = os.getenv("ENTITY_IMPORT_QUEUE_MODE", "in_process")
POLL_INTERVAL_SECONDS = int(os.getenv("ENTITY_PIPELINE_WORKER_POLL_SECONDS", "10"))
STALE_MINUTES = int(os.getenv("ENTITY_PIPELINE_STALE_MINUTES", "30"))


def should_process_in_process(queue_mode: Optional[str]) -> bool:
    return (queue_mode or "in_process") != "durable_worker"


def build_run_detail_url(batch_id: str, entity_id: str) -> str:
    return f"/entity-import/{batch_id}/{entity_id}"


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
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        )
        if not supabase_url or not supabase_key:
            raise RuntimeError("Supabase credentials are required for entity pipeline worker")
        self.supabase = create_client(supabase_url, supabase_key)
        self.worker_id = f"{socket.gethostname()}-{os.getpid()}"

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _batch_metadata(self, batch: Dict[str, Any]) -> Dict[str, Any]:
        metadata = batch.get("metadata") or {}
        return metadata if isinstance(metadata, dict) else {}

    def recover_stale_batches(self) -> None:
        response = (
            self.supabase.table("entity_import_batches")
            .select("*")
            .eq("status", "running")
            .execute()
        )
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)
        for batch in response.data or []:
            metadata = self._batch_metadata(batch)
            heartbeat_at = metadata.get("heartbeat_at") or metadata.get("claimed_at")
            if not heartbeat_at:
                continue
            try:
                heartbeat_dt = datetime.fromisoformat(str(heartbeat_at).replace("Z", "+00:00"))
            except ValueError:
                continue
            if heartbeat_dt >= cutoff:
                continue
            metadata["recovered_at"] = self._now_iso()
            metadata["queue_mode"] = "durable_worker"
            self.supabase.table("entity_import_batches").update(
                {"status": "queued", "metadata": metadata}
            ).eq("id", batch["id"]).execute()

    def claim_next_batch(self) -> Optional[Dict[str, Any]]:
        self.recover_stale_batches()
        response = (
            self.supabase.table("entity_import_batches")
            .select("*")
            .eq("status", "queued")
            .order("started_at")
            .limit(1)
            .execute()
        )
        batches = response.data or []
        if not batches:
            return None
        batch = batches[0]
        metadata = self._batch_metadata(batch)
        metadata.update(
            {
                "queue_mode": "durable_worker",
                "worker_id": self.worker_id,
                "claimed_at": self._now_iso(),
                "heartbeat_at": self._now_iso(),
            }
        )
        self.supabase.table("entity_import_batches").update(
            {"status": "running", "metadata": metadata}
        ).eq("id", batch["id"]).execute()
        batch["metadata"] = metadata
        batch["status"] = "running"
        return batch

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
        self.supabase.table("cached_entities").update({"properties": properties}).eq(
            "neo4j_id", run["entity_id"]
        ).execute()

    def update_run(self, batch_id: str, entity_id: str, updates: Dict[str, Any]) -> None:
        self.supabase.table("entity_pipeline_runs").update(updates).eq(
            "batch_id", batch_id
        ).eq("entity_id", entity_id).execute()

    def process_batch(self, batch: Dict[str, Any]) -> None:
        batch_id = batch["id"]
        failed_runs = 0
        for run in self.get_batch_runs(batch_id):
            if run.get("status") == "completed":
                continue
            self.update_run(
                batch_id,
                run["entity_id"],
                {
                    "status": "running",
                    "phase": "dossier_generation",
                    "error_message": None,
                },
            )
            try:
                result = self.call_pipeline(run, batch_id)
                phases = result.get("phases") or {}
                completed_phases = [name for name, detail in phases.items() if detail.get("status") == "completed"]
                last_phase = completed_phases[-1] if completed_phases else "dashboard_scoring"
                metadata = deepcopy(run.get("metadata") or {})
                metadata.update(
                    {
                        "phases": phases,
                        "scores": ((result.get("artifacts") or {}).get("scores")),
                        "performance_summary": (((result.get("artifacts") or {}).get("discovery_result") or {}).get("performance_summary")),
                        "completed_at": result.get("completed_at"),
                    }
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
                failed_runs += 1
                self.sync_cached_entity(batch_id, run, None, "failed")
                self.update_run(
                    batch_id,
                    run["entity_id"],
                    {
                        "status": "failed",
                        "error_message": str(error),
                        "completed_at": self._now_iso(),
                    },
                )
            metadata = self._batch_metadata(batch)
            metadata["heartbeat_at"] = self._now_iso()
            self.supabase.table("entity_import_batches").update({"metadata": metadata}).eq(
                "id", batch_id
            ).execute()
        self.supabase.table("entity_import_batches").update(
            {"status": "failed" if failed_runs > 0 else "completed", "completed_at": self._now_iso()}
        ).eq("id", batch_id).execute()

    def run_forever(self) -> None:
        while True:
            batch = self.claim_next_batch()
            if not batch:
                time.sleep(POLL_INTERVAL_SECONDS)
                continue
            self.process_batch(batch)


def main() -> None:
    if should_process_in_process(QUEUE_MODE):
        raise SystemExit("ENTITY_IMPORT_QUEUE_MODE must be 'durable_worker' to run this worker")
    worker = EntityPipelineWorker()
    worker.run_forever()


if __name__ == "__main__":
    main()
