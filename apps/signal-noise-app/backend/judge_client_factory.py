from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Iterator

from dotenv import load_dotenv


def _load_judge_env() -> None:
    root = Path(__file__).resolve().parent.parent
    cwd = Path.cwd()

    def _candidate_paths(base: Path) -> Iterator[Path]:
        yield base / ".env"
        yield base / "backend" / ".env"
        yield base / "apps" / "signal-noise-app" / ".env"
        yield base / "apps" / "signal-noise-app" / "backend" / ".env"

    candidates: Iterable[Path] = []
    seen: set[Path] = set()
    for base in [cwd, *cwd.parents, root, *root.parents]:
        for candidate in _candidate_paths(base):
            if candidate in seen:
                continue
            seen.add(candidate)
            candidates = (*candidates, candidate)
    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate, override=False)


def build_deepseek_judge_client():
    """
    Build a Chutes-backed judge client for DeepSeek reasoning.

    This is intentionally strict: if CHUTES_API_KEY is missing, fail fast
    instead of silently falling back to Anthropic.
    """
    _load_judge_env()
    api_key = (os.getenv("CHUTES_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError(
            "CHUTES_API_KEY is required for the DeepSeek judge path. "
            "Set CHUTES_API_KEY and use the Chutes-backed judge provider."
        )

    from claude_client import ClaudeClient

    os.environ["LLM_PROVIDER"] = ClaudeClient.PROVIDER_CHUTES_OPENAI
    os.environ.setdefault("CHUTES_MODEL_JUDGE", "deepseek-ai/DeepSeek-V3.2-TEE")
    return ClaudeClient()
