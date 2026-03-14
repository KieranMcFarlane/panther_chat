#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = (SCRIPT_DIR / ".." / "backend").resolve()
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dossier_normalizer import normalize_dossier  # noqa: E402


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize dossier JSON into production-friendly claim schema")
    parser.add_argument("--input", required=True, help="Path to source dossier JSON")
    parser.add_argument("--output", required=False, help="Optional output path")
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    source_path = Path(args.input).resolve()
    if not source_path.exists():
        print(json.dumps({"error": f"Input file not found: {source_path}"}, indent=2))
        return 1

    payload = json.loads(source_path.read_text())
    normalized = normalize_dossier(payload)

    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = source_path.with_name(f"{source_path.stem}_normalized.json")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(normalized, indent=2))

    print(
        json.dumps(
            {
                "input": str(source_path),
                "output": str(output_path),
                "claims": len(normalized.get("claims", [])),
                "quarantined_sections": len(normalized.get("quarantined_sections", [])),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

