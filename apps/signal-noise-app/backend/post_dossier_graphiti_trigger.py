from __future__ import annotations

import json
import logging
import os
import threading
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)


def _base_url() -> str:
    return (
        os.getenv("INTERNAL_APP_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("APP_URL")
        or "http://localhost:3005"
    ).rstrip("/")


def _post_trigger(canonical_entity_id: str, entity_id: Optional[str], dossier_id: Optional[str], source: str) -> None:
    secret = (os.getenv("CRON_SECRET") or "").strip()
    if not secret:
        logger.warning("post_dossier_graphiti_trigger_skipped_missing_cron_secret")
        return

    payload = {
        "canonical_entity_id": canonical_entity_id,
        "entity_id": entity_id,
        "dossier_id": dossier_id,
        "source": source,
    }
    request = urllib.request.Request(
        f"{_base_url()}/api/internal/graphiti/opportunities/process-dossier",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {secret}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=2.5) as response:
            response.read(512)
    except Exception as error:  # noqa: BLE001
        logger.warning(
            "post_dossier_graphiti_trigger_failed",
            extra={
                "canonical_entity_id": canonical_entity_id,
                "entity_id": entity_id,
                "error": str(error),
            },
        )


def notify_post_dossier_graphiti_opportunity_trigger(
    *,
    canonical_entity_id: Optional[str],
    entity_id: Optional[str] = None,
    dossier_id: Optional[str] = None,
    source: str = "pipeline_dossier_completed",
) -> None:
    canonical = str(canonical_entity_id or "").strip()
    if not canonical:
        return

    thread = threading.Thread(
        target=_post_trigger,
        kwargs={
            "canonical_entity_id": canonical,
            "entity_id": str(entity_id or "").strip() or None,
            "dossier_id": str(dossier_id or "").strip() or None,
            "source": source,
        },
        daemon=True,
    )
    thread.start()
