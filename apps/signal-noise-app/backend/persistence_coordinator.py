#!/usr/bin/env python3
"""
Dual-write persistence coordinator for pipeline runs.

Coordinates writes to Supabase + FalkorDB and reports a normalized status payload.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, Optional


PersistFn = Callable[[Dict[str, Any]], Awaitable[None]]


@dataclass
class BackendStatus:
    ok: bool
    attempts: int
    error_class: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "attempts": self.attempts,
            "error_class": self.error_class,
            "error_message": self.error_message,
        }


class DualWritePersistenceCoordinator:
    def __init__(
        self,
        *,
        supabase_writer: Optional[PersistFn],
        falkordb_writer: Optional[PersistFn],
        max_attempts: int = 3,
    ) -> None:
        self.supabase_writer = supabase_writer
        self.falkordb_writer = falkordb_writer
        self.max_attempts = max(1, int(max_attempts))

    @staticmethod
    def _build_envelope(
        *,
        run_id: str,
        entity_id: str,
        phase: str,
        record_type: str,
        record_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "idempotency_key": f"{run_id}:{entity_id}:{phase}:{record_type}:{record_id}",
            "run_id": run_id,
            "entity_id": entity_id,
            "phase": phase,
            "record_type": record_type,
            "record_id": record_id,
            "payload": payload,
            "persisted_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _run_writer(self, writer: Optional[PersistFn], payload: Dict[str, Any]) -> BackendStatus:
        if writer is None:
            return BackendStatus(
                ok=False,
                attempts=0,
                error_class="missing_writer",
                error_message="writer_not_configured",
            )
        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                await writer(payload)
                return BackendStatus(ok=True, attempts=attempt)
            except Exception as error:  # noqa: BLE001
                last_error = error
                if attempt < self.max_attempts:
                    await asyncio.sleep(min(2.0, 0.25 * (2 ** (attempt - 1))))
        return BackendStatus(
            ok=False,
            attempts=self.max_attempts,
            error_class=last_error.__class__.__name__ if last_error else "unknown_error",
            error_message=str(last_error) if last_error else "unknown_error",
        )

    async def persist_run_artifacts(
        self,
        *,
        run_id: str,
        entity_id: str,
        phase: str,
        record_type: str,
        record_id: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        envelope = self._build_envelope(
            run_id=run_id,
            entity_id=entity_id,
            phase=phase,
            record_type=record_type,
            record_id=record_id,
            payload=payload,
        )
        supabase_status = await self._run_writer(self.supabase_writer, envelope)
        falkordb_status = await self._run_writer(self.falkordb_writer, envelope)
        dual_write_ok = bool(supabase_status.ok and falkordb_status.ok)
        return {
            "dual_write_ok": dual_write_ok,
            "supabase": supabase_status.to_dict(),
            "falkordb": falkordb_status.to_dict(),
            "reconcile_required": not dual_write_ok,
            "reconciliation_payload": None
            if dual_write_ok
            else {
                "idempotency_key": envelope["idempotency_key"],
                "run_id": run_id,
                "entity_id": entity_id,
                "phase": phase,
                "record_type": record_type,
                "record_id": record_id,
                "envelope": envelope,
                "retry_after_seconds": 30,
            },
        }

    async def persist_step_artifacts(
        self,
        *,
        run_id: str,
        entity_id: str,
        phase: str,
        artifacts: list[Dict[str, Any]],
    ) -> Dict[str, Any]:
        normalized_artifacts = [item for item in (artifacts or []) if isinstance(item, dict)]
        persisted_count = 0
        failed_count = 0
        supabase_failures = 0
        falkordb_failures = 0
        reconciliation_payloads: list[Dict[str, Any]] = []
        status_matrix: list[Dict[str, Any]] = []

        for index, artifact in enumerate(normalized_artifacts):
            step_type = str(artifact.get("step_type") or "unknown_step")
            step_id = str(artifact.get("step_id") or f"{step_type}_{index + 1}")
            envelope = self._build_envelope(
                run_id=run_id,
                entity_id=entity_id,
                phase=phase,
                record_type=step_type,
                record_id=step_id,
                payload=artifact,
            )
            supabase_status = await self._run_writer(self.supabase_writer, envelope)
            falkordb_status = await self._run_writer(self.falkordb_writer, envelope)
            dual_write_ok = bool(supabase_status.ok and falkordb_status.ok)
            if dual_write_ok:
                persisted_count += 1
            else:
                failed_count += 1
                supabase_failures += int(not supabase_status.ok)
                falkordb_failures += int(not falkordb_status.ok)
                reconciliation_payloads.append(
                    {
                        "idempotency_key": envelope["idempotency_key"],
                        "run_id": run_id,
                        "entity_id": entity_id,
                        "phase": phase,
                        "record_type": step_type,
                        "record_id": step_id,
                        "envelope": envelope,
                        "retry_after_seconds": 30,
                    }
                )
            status_matrix.append(
                {
                    "step_type": step_type,
                    "step_id": step_id,
                    "dual_write_ok": dual_write_ok,
                    "supabase": supabase_status.to_dict(),
                    "falkordb": falkordb_status.to_dict(),
                }
            )

        return {
            "total_count": len(normalized_artifacts),
            "persisted_count": persisted_count,
            "failed_count": failed_count,
            "dual_write_ok": failed_count == 0,
            "status_matrix": status_matrix,
            "reconcile_required": failed_count > 0,
            "reconciliation_payloads": reconciliation_payloads,
            "failure_taxonomy": {
                "supabase_write_failure": supabase_failures,
                "falkordb_write_failure": falkordb_failures,
                "dual_write_incomplete": int(failed_count > 0),
            },
        }
