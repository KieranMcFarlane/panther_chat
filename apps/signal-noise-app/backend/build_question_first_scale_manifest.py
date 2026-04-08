#!/usr/bin/env python3
"""Build a filtered question-first scale manifest from Supabase cached_entities."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List

from question_first_archetype_smoke import build_filtered_scale_manifest
from supabase_dossier_collector import SupabaseDataCollector


ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_PATH = ROOT / "data" / "question_first_scale_batch_3000_live.json"


def _rows_from_supabase(limit: int | None = None, *, page_size: int = 500) -> List[Dict[str, Any]]:
    collector = SupabaseDataCollector()
    rows: List[Dict[str, Any]] = []
    start = 0

    while True:
        end = start + page_size - 1
        if limit is not None:
            remaining = limit - len(rows)
            if remaining <= 0:
                break
            end = start + min(page_size, remaining) - 1

        response = collector.client.table("cached_entities").select("*").range(start, end).execute()
        page = response.data or []
        if not page:
            break

        for raw_row in page:
            entity = collector._parse_entity_row(raw_row)  # noqa: SLF001
            if not entity:
                continue
            row = asdict(entity)
            metadata = row.get("metadata") or {}
            properties = metadata.get("properties") if isinstance(metadata, dict) else {}
            if isinstance(properties, dict):
                row["properties"] = properties
            rows.append(row)
            if limit is not None and len(rows) >= limit:
                return rows

        if len(page) < page_size:
            break
        start += len(page)
    return rows


def build_live_scale_manifest(*, limit: int | None = None, require_website: bool = True) -> Dict[str, Any]:
    rows = _rows_from_supabase(limit=limit)
    return build_filtered_scale_manifest(
        rows,
        batch_name="question-first-scale-3000-live",
        description="Live low-concurrency scale manifest generated from cached_entities for continuous dossier loop evidence.",
        require_website=require_website,
    )


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the filtered live question-first scale manifest")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path to write the generated manifest JSON",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit on source entities fetched from Supabase",
    )
    parser.add_argument(
        "--allow-missing-website",
        action="store_true",
        help="Include rows without a credible website",
    )
    args = parser.parse_args(argv)

    manifest = build_live_scale_manifest(
        limit=args.limit,
        require_website=not args.allow_missing_website,
    )
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(str(output_path))
    print(json.dumps(manifest.get("metrics") or {}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
