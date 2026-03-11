#!/usr/bin/env python3
"""Bounded runtime smoke for Chutes quota resilience + discovery heuristic fallback.

This script deterministically simulates Chutes 429 insufficient-balance responses,
verifies retry/circuit-break diagnostics, then exercises discovery evaluation fallback.
"""

from __future__ import annotations

import asyncio
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import httpx

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from dotenv import load_dotenv
except Exception:  # noqa: BLE001
    load_dotenv = None

import claude_client as claude_client_module
from claude_client import ClaudeClient, LLMRequestError
from hypothesis_driven_discovery import HopType, HypothesisDrivenDiscovery


class _AlwaysQuota429AsyncClient:
    """Fake httpx.AsyncClient that always returns 429 insufficient-balance."""

    def __init__(self, timeout=None):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        request = httpx.Request("POST", url)
        response = httpx.Response(
            429,
            request=request,
            headers={"content-type": "application/json"},
            content=b'{"error":{"code":"1113","message":"insufficient balance / no resource package"}}',
        )
        raise httpx.HTTPStatusError("429 Too Many Requests", request=request, response=response)


async def _run(*, live: bool) -> int:
    if load_dotenv:
        load_dotenv(ROOT / ".env")

    # Chutes config for smoke runs.
    os.environ.setdefault("LLM_PROVIDER", ClaudeClient.PROVIDER_CHUTES_OPENAI)
    os.environ.setdefault("CHUTES_BASE_URL", "https://llm.chutes.ai/v1")
    os.environ.setdefault("CHUTES_MODEL", "zai-org/GLM-5-TEE")
    os.environ.setdefault("CHUTES_FALLBACK_MODEL", "moonshotai/Kimi-K2.5-TEE")
    os.environ.setdefault("CHUTES_STREAM_ENABLED", "false")
    os.environ.setdefault("CHUTES_MAX_RETRIES", "3")
    os.environ.setdefault("CHUTES_429_POLICY", "header_exponential")
    os.environ.setdefault("CHUTES_CIRCUIT_BREAK_ON_QUOTA", "true")
    os.environ.setdefault("LLM_PROVIDER_VALIDATION_STRICT", "true")
    os.environ.setdefault("DISCOVERY_HEURISTIC_FALLBACK_ON_LLM_UNAVAILABLE", "true")
    os.environ.setdefault("CHUTES_TIMEOUT_SECONDS", "20")
    os.environ.setdefault("CHUTES_FALLBACK_TIMEOUT_SECONDS", "30")

    # Patch network + sleep for bounded runtime.
    original_async_client = claude_client_module.httpx.AsyncClient
    original_sleep = claude_client_module.asyncio.sleep
    slept = []

    async def _fake_sleep(seconds):
        slept.append(float(seconds))

    if not live:
        os.environ.setdefault("CHUTES_API_KEY", "smoke-test-key")
        claude_client_module.httpx.AsyncClient = _AlwaysQuota429AsyncClient
        claude_client_module.asyncio.sleep = _fake_sleep
    elif not os.getenv("CHUTES_API_KEY"):
        raise SystemExit("CHUTES_API_KEY is required for --live mode")

    try:
        client = ClaudeClient()

        llm_error = None
        try:
            await client.query(
                prompt="quota resilience smoke",
                model="haiku",
                max_tokens=32,
            )
        except LLMRequestError as exc:
            llm_error = str(exc)

        # Build minimal discovery object without heavy runtime deps.
        discovery = HypothesisDrivenDiscovery.__new__(HypothesisDrivenDiscovery)
        discovery.claude_client = client
        discovery.heuristic_fallback_on_llm_unavailable = True
        discovery.evaluation_max_tokens_default = 640
        discovery.evaluation_max_tokens_press_release = 384
        discovery.evaluation_max_tokens_official_site = 384
        discovery.evaluation_max_tokens_careers_annual_report = 448
        discovery._llm_runtime_diagnostics = {
            **client.get_runtime_diagnostics(),
            "evaluation_mode": "llm",
        }

        hypothesis = SimpleNamespace(
            statement="Coventry City FC is actively running procurement",
            category="procurement",
            metadata={"entity_name": "Coventry City FC", "template_id": ""},
            prior_probability=0.5,
            confidence=0.5,
            iterations_attempted=0,
            iterations_accepted=0,
            iterations_weak_accept=0,
            iterations_rejected=0,
            iterations_no_progress=0,
            last_delta=0.0,
        )

        evaluation = await discovery._evaluate_content_with_claude(
            content="The club has launched a procurement tender and supplier onboarding process.",
            hypothesis=hypothesis,
            hop_type=HopType.OFFICIAL_SITE,
            content_metadata={"content_type": "text/html"},
        )

        performance_summary = discovery._build_performance_summary(
            SimpleNamespace(iteration_results=[]),
            total_duration_ms=1.0,
        )

        artifact = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "mode": "live" if live else "mocked_429",
            "llm_query_error": llm_error,
            "llm_sleep_profile_seconds": slept,
            "llm_runtime_diagnostics": client.get_runtime_diagnostics(),
            "evaluation_result": evaluation,
            "performance_summary": performance_summary,
        }

        out_dir = Path("backend/data/dossiers")
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"chutes_quota_resilience_smoke_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
        out_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")

        print(f"artifact={out_path}")
        print(f"retry_attempts={artifact['llm_runtime_diagnostics'].get('llm_retry_attempts')}")
        print(f"llm_last_status={artifact['llm_runtime_diagnostics'].get('llm_last_status')}")
        print(f"llm_circuit_broken={artifact['llm_runtime_diagnostics'].get('llm_circuit_broken')}")
        print(f"evaluation_mode={evaluation.get('evaluation_mode')}")
        print(f"decision={evaluation.get('decision')}")

        return 0
    finally:
        if not live:
            claude_client_module.httpx.AsyncClient = original_async_client
            claude_client_module.asyncio.sleep = original_sleep


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Run against real Chutes API instead of mocked 429s")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(live=args.live)))
