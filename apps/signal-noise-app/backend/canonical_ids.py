from __future__ import annotations

from typing import Any, Optional
from uuid import UUID, uuid5


ENTITY_PUBLIC_ID_NAMESPACE = UUID("f5c2b2b8-9cf2-4e66-a1c2-38cde7bc3f4e")


def normalize_canonical_entity_id(value: Any) -> Optional[str]:
    candidate = str(value or "").strip()
    if not candidate:
        return None
    try:
        return str(UUID(candidate))
    except (TypeError, ValueError, AttributeError):
        return str(uuid5(ENTITY_PUBLIC_ID_NAMESPACE, candidate))
