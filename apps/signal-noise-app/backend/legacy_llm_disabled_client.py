#!/usr/bin/env python3
"""Explicit disabled legacy-LLM client for OpenCode-first pipeline runs."""

from __future__ import annotations

from typing import Any, Dict, Optional


class LegacyLLMDisabledClient:
    provider = "disabled_legacy"
    requested_model = "disabled"
    runtime_model = "disabled"
    chutes_stream_enabled = False
    chutes_timeout_seconds = 0.0
    chutes_fallback_timeout_seconds = 0.0
    chutes_stream_idle_timeout_seconds = 0.0
    chutes_max_retries = 0

    def __init__(self, reason: str = "legacy_llm_disabled_for_opencode"):
        self.reason = str(reason or "legacy_llm_disabled_for_opencode")

    def _get_disabled_reason(self) -> Optional[str]:
        return self.reason

    def get_runtime_diagnostics(self) -> Dict[str, Any]:
        return {
            "llm_provider": self.provider,
            "llm_last_status": "disabled",
            "llm_circuit_broken": True,
            "llm_disable_reason": self.reason,
            "evaluation_mode": "question_first_only",
        }

    async def query(self, *args, **kwargs):  # pragma: no cover - defensive guard
        raise RuntimeError(self.reason)
