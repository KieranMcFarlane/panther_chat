#!/usr/bin/env python3
"""
Assert bounded 3-entity regression gate criteria for production promotion.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def _is_true(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Assert bounded regression gate criteria")
    parser.add_argument("--summary", required=True, help="Path to regression_batch_*.json summary")
    parser.add_argument("--expected-entities", type=int, default=3)
    parser.add_argument("--min-pass-count", type=int, default=2)
    args = parser.parse_args()

    summary_path = Path(args.summary)
    if not summary_path.exists():
        raise SystemExit(f"Summary file not found: {summary_path}")

    rows = json.loads(summary_path.read_text())
    if not isinstance(rows, list):
        raise SystemExit("Summary payload is not a JSON list")
    if len(rows) < args.expected_entities:
        raise SystemExit(f"Expected at least {args.expected_entities} entities, found {len(rows)}")

    pass_count = 0
    import_context_failures = 0
    bad_zero_signal_rows = []
    nonzero_exit_rows = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        entity_id = str(row.get("entity_id") or "unknown")
        exit_code_value = row.get("exit_code")
        try:
            exit_code = int(exit_code_value) if exit_code_value is not None else 1
        except (TypeError, ValueError):
            exit_code = 1
        if exit_code != 0:
            nonzero_exit_rows.append(entity_id)

        if _is_true(row.get("acceptance_gate_passed")):
            pass_count += 1

        import_failure = int(row.get("import_context_failure") or 0)
        import_context_failures += import_failure

        signals = row.get("signals_discovered")
        low_signal_content = int(row.get("low_signal_content") or 0)
        if isinstance(signals, int) and signals == 0 and low_signal_content == 0:
            bad_zero_signal_rows.append(entity_id)

    failures = []
    if nonzero_exit_rows:
        failures.append(f"Non-zero pipeline exits: {', '.join(nonzero_exit_rows)}")
    if pass_count < args.min_pass_count:
        failures.append(
            f"Acceptance gate pass count {pass_count} is below required {args.min_pass_count}"
        )
    if import_context_failures != 0:
        failures.append(f"import_context_failure total must be 0, got {import_context_failures}")
    if bad_zero_signal_rows:
        failures.append(
            "signals_discovered=0 without low_signal_content flag for: "
            + ", ".join(bad_zero_signal_rows)
        )

    if failures:
        print("❌ Regression gate failed")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("✅ Regression gate passed")
    print(f"- pass_count={pass_count}")
    print(f"- import_context_failures={import_context_failures}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
