#!/usr/bin/env python3
"""
Run schema-first BrightData pilot for a single entity.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


SCRIPT_PATH = Path(__file__).resolve()
APP_DIR = SCRIPT_PATH.parent.parent
BACKEND_DIR = APP_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(APP_DIR))

load_dotenv(APP_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

from schema_first_pilot import run_schema_first_pilot


def _slugify(value: str) -> str:
    import re

    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-") or "entity"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Schema-first BrightData pilot")
    parser.add_argument("--entity-name", required=True, help="Entity display name")
    parser.add_argument("--entity-id", default=None, help="Entity ID (default slugified entity-name)")
    parser.add_argument("--entity-type", default="SPORT_FEDERATION", help="Entity type")
    parser.add_argument(
        "--output-dir",
        default=str(APP_DIR / "backend" / "data" / "dossiers"),
        help="Artifact output directory",
    )
    parser.add_argument("--max-results", type=int, default=8, help="Search results per query")
    parser.add_argument("--max-candidates-per-query", type=int, default=4, help="Scraped candidates per query")
    parser.add_argument(
        "--fields",
        default="",
        help="Comma-separated field subset (official_site,founded_year,headquarters,procurement_signals)",
    )
    return parser


async def _run(args: argparse.Namespace) -> int:
    entity_id = args.entity_id or _slugify(args.entity_name)
    fields = [f.strip() for f in args.fields.split(",") if f.strip()] if args.fields else None
    result = await run_schema_first_pilot(
        entity_name=args.entity_name,
        entity_id=entity_id,
        entity_type=args.entity_type,
        output_dir=args.output_dir,
        max_results=args.max_results,
        max_candidates_per_query=args.max_candidates_per_query,
        field_names=fields,
    )
    print(json.dumps(result, indent=2))
    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())

