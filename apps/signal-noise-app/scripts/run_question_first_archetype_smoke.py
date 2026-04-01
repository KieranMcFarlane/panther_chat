#!/usr/bin/env python3
"""CLI wrapper for the serial question-first archetype smoke."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from question_first_archetype_smoke import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())
