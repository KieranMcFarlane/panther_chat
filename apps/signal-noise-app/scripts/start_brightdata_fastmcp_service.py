#!/usr/bin/env python3
"""Launch the local BrightData FastMCP service."""

import os
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None  # type: ignore

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _find_repo_env(start_path: Path) -> Optional[Path]:
    for ancestor in Path(start_path).resolve().parents:
        env_path = ancestor / "apps" / "signal-noise-app" / ".env"
        if env_path.exists():
            return env_path
    return None


def _load_repo_env(start_path: Path | None = None) -> Optional[Path]:
    if load_dotenv is None:
        return None
    env_path = _find_repo_env(start_path or Path(__file__))
    if env_path is None:
        return None
    load_dotenv(env_path, override=False)
    return env_path


def main() -> None:
    _load_repo_env(Path(__file__))
    os.environ["BRIGHTDATA_MCP_USE_HOSTED"] = "false"
    os.environ.setdefault("BRIGHTDATA_MCP_HOSTED_URL", "")
    from backend.brightdata_fastmcp_service import main as service_main

    service_main()


if __name__ == "__main__":
    main()
