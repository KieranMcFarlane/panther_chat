#!/usr/bin/env python3
"""Retry Falkor-only persistence failures without touching canonical Supabase publication."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from typing import Any, Awaitable, Callable, Dict, Optional


PersistFn = Callable[[Dict[str, Any]], Awaitable[None]]


class ReconciliationWorker:
    def __init__(
        self,
        *,
        supabase: Any,
        falkordb_writer: PersistFn,
        max_attempts: int = 3,
    ) -> None:
        self.supabase = supabase
        self.falkordb_writer = falkordb_writer
        self.max_attempts = max(1, int(max_attempts))

    def _get_run(self, batch_id: str, entity_id: str, canonical_entity_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        query = (
            self.supabase.table("entity_pipeline_runs")
            .select("*")
            .eq("batch_id", batch_id)
        )
        if canonical_entity_id:
            query = query.eq("canonical_entity_id", canonical_entity_id)
        else:
            query = query.eq("entity_id", entity_id)

        response = query.limit(1).execute()
        data = response.data or []
        return data[0] if data else None

    def _update_run_metadata(
        self,
        batch_id: str,
        entity_id: str,
        metadata: Dict[str, Any],
        canonical_entity_id: Optional[str] = None,
    ) -> None:
        query = (
            self.supabase.table("entity_pipeline_runs")
            .update({"metadata": metadata})
            .eq("batch_id", batch_id)
        )
        if canonical_entity_id:
            query = query.eq("canonical_entity_id", canonical_entity_id)
        else:
            query = query.eq("entity_id", entity_id)
        query.execute()

    async def process_run(self, batch_id: str, entity_id: str) -> Dict[str, Any]:
        run = self._get_run(batch_id, entity_id)
        if not run:
            return {"status": "missing"}

        metadata = deepcopy(run.get("metadata") or {})
        canonical_entity_id = str(
            run.get("canonical_entity_id")
            or (metadata.get("canonical_entity_id") if isinstance(metadata, dict) else "")
            or ""
        ).strip() or None
        if not isinstance(metadata, dict) or not metadata.get("reconcile_required"):
            return {"status": "skipped"}

        retry_count = int(metadata.get("reconciliation_retry_count", 0) or 0)
        payloads = []
        if isinstance(metadata.get("reconciliation_payload"), dict):
            payloads.append(metadata["reconciliation_payload"])
        if isinstance(metadata.get("reconciliation_payloads"), list):
            payloads.extend([item for item in metadata["reconciliation_payloads"] if isinstance(item, dict)])

        if not payloads:
            metadata["reconcile_required"] = False
            metadata["reconciliation_state"] = "healthy"
            self._update_run_metadata(batch_id, entity_id, metadata, canonical_entity_id=canonical_entity_id)
            return {"status": "completed"}

        failures = []
        for payload in payloads:
            envelope = payload.get("envelope") if isinstance(payload.get("envelope"), dict) else None
            if not envelope:
                failures.append({"error": "missing_envelope"})
                continue
            try:
                await self.falkordb_writer(envelope)
            except Exception as exc:  # noqa: BLE001
                failures.append({"error": str(exc)})

        if not failures:
            metadata["reconcile_required"] = False
            metadata["reconciliation_state"] = "healthy"
            metadata["reconciliation_retry_count"] = retry_count
            metadata["reconciliation_payload"] = None
            metadata["reconciliation_payloads"] = []
            self._update_run_metadata(batch_id, entity_id, metadata, canonical_entity_id=canonical_entity_id)
            return {"status": "completed"}

        retry_count += 1
        metadata["reconcile_required"] = True
        metadata["reconciliation_retry_count"] = retry_count
        if retry_count >= self.max_attempts:
            metadata["reconciliation_state"] = "exhausted"
            self._update_run_metadata(batch_id, entity_id, metadata, canonical_entity_id=canonical_entity_id)
            return {"status": "exhausted", "failures": failures}

        metadata["reconciliation_state"] = "retrying"
        self._update_run_metadata(batch_id, entity_id, metadata, canonical_entity_id=canonical_entity_id)
        return {"status": "retrying", "failures": failures}
