#!/usr/bin/env python3
"""
Tests for timeout-safe dossier generation behavior in phase 0.
"""

import asyncio
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from main import EntityPipelineRequest, run_entity_pipeline
from dossier_generator import UniversalDossierGenerator
from fastapi import HTTPException
try:
    from backend.claude_client import LLMRequestError
except ImportError:
    from claude_client import LLMRequestError


class _SlowClaudeClient:
    def __init__(self):
        self.calls = 0

    async def query(self, **_kwargs):
        self.calls += 1
        await asyncio.sleep(0.1)
        return {
            "content": '{"metadata": {"entity_id":"icf", "generated_at":"2026-01-01T00:00:00+00:00", "confidence_overall": 0.5, "priority_signals": []}, "executive_summary": {"overall_assessment": {"digital_maturity": {"score": 1, "trend": "up", "key_strengths": [], "key_gaps": []}, "key_strengths": [], "key_gaps": []}, "quick_actions": [], "key_insights": []}}'
        }


class _SingleModelFailingClaudeClient:
    provider = "chutes_openai"
    chutes_model = "zai-org/GLM-5-TEE"

    def __init__(self):
        self.calls = 0
        self.models: list[str] = []

    async def query(self, **kwargs):
        self.calls += 1
        self.models.append(str(kwargs.get("model")))
        raise LLMRequestError(
            "Chutes request failed (retryable=True): http_status=429",
            retryable=True,
            provider="chutes_openai",
            requested_model=str(kwargs.get("model")),
            runtime_model=self.chutes_model,
            status_code=429,
        )


class _StaticClaudeClient:
    provider = "anthropic"

    def __init__(self, content: str):
        self.content = content

    async def query(self, **_kwargs):
        return {"content": self.content}


def test_extract_last_valid_json_block_prefers_terminal_valid_object():
    generator = UniversalDossierGenerator(_StaticClaudeClient(""))
    text = (
        'preface {"metadata":{"entity_id":"first"},"executive_summary":{"first":true}} '
        'middle {"metadata":{"entity_id":"second"},"executive_summary":{"second":true}}'
    )

    parsed = generator._extract_last_valid_json_block(text)

    assert isinstance(parsed, dict)
    assert parsed["metadata"]["entity_id"] == "second"


def test_extract_last_valid_json_block_ignores_later_invalid_fragment():
    generator = UniversalDossierGenerator(_StaticClaudeClient(""))
    text = (
        '{"metadata":{"entity_id":"stable"},"executive_summary":{"ok":true}} '
        '{"metadata":{"entity_id":"broken"},"executive_summary":'
    )

    parsed = generator._extract_last_valid_json_block(text)

    assert isinstance(parsed, dict)
    assert parsed["metadata"]["entity_id"] == "stable"


def test_extract_last_valid_json_block_returns_none_when_no_valid_json():
    generator = UniversalDossierGenerator(_StaticClaudeClient(""))
    parsed = generator._extract_last_valid_json_block("no json here")
    assert parsed is None


@pytest.mark.asyncio
async def test_generate_with_model_query_timeout_falls_back_to_minimal_dossier(monkeypatch):
    monkeypatch.setenv("DOSSIER_MODEL_QUERY_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setattr("dossier_generator.random.random", lambda: 0.5)

    claude = _SlowClaudeClient()
    generator = UniversalDossierGenerator(claude)

    result = await generator._generate_with_model_cascade(
        "Ignore context, return a valid JSON object.",
        "International Canoe Federation",
        "STANDARD",
    )

    assert result["metadata"]["confidence_overall"] == 0
    assert result["executive_summary"]["overall_assessment"]["digital_maturity"]["score"] == 0


@pytest.mark.asyncio
async def test_generate_with_model_query_timeout_uses_single_attempt_for_chutes_provider():
    claude = _SingleModelFailingClaudeClient()
    generator = UniversalDossierGenerator(claude)

    with pytest.raises(LLMRequestError):
        await generator._generate_with_model_cascade(
            "Ignore context, return a valid JSON object.",
            "International Canoe Federation",
            "PREMIUM",
        )

    assert claude.calls == 1
    assert claude.models == ["opus"]


@pytest.mark.asyncio
async def test_run_entity_pipeline_surfaces_retryable_inference_http_error(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "180")
    monkeypatch.setenv("ENTITY_IMPORT_QUEUE_MODE", "in_process")
    monkeypatch.setenv("PIPELINE_PHASE0_TIMEOUT_MODE", "fail")

    async def retryable_inference_failure(*_args, **_kwargs):
        raise HTTPException(status_code=503, detail="inference_capacity_retryable: test")

    monkeypatch.setattr("main.generate_dossier", retryable_inference_failure)

    with pytest.raises(HTTPException) as exc_info:
        await run_entity_pipeline(
            EntityPipelineRequest(
                entity_id="icf-retryable",
                entity_name="International Canoe Federation",
                entity_type="FEDERATION",
                priority_score=85,
            )
        )

    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_run_entity_pipeline_degrades_when_phase0_retryable_inference_error_in_degraded_mode(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "180")
    monkeypatch.setenv("ENTITY_IMPORT_QUEUE_MODE", "durable_worker")
    monkeypatch.setenv("PIPELINE_PHASE0_TIMEOUT_MODE", "degraded")

    async def retryable_inference_failure(*_args, **_kwargs):
        raise HTTPException(status_code=503, detail="inference_capacity_retryable: test")

    monkeypatch.setattr("main.generate_dossier", retryable_inference_failure)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="icf-retryable-degraded",
            entity_name="International Canoe Federation",
            entity_type="FEDERATION",
            priority_score=85,
        )
    )

    assert result.phases["dossier_generation"]["status"] in {"completed", "failed"}
    assert result.artifacts["dossier"]["metadata"]["generation_mode"] == "timeout_degraded"


@pytest.mark.asyncio
async def test_run_entity_pipeline_forces_phase0_regeneration(monkeypatch):
    captured = {}

    async def fake_generate_dossier(request):
        captured["force_refresh"] = request.force_refresh
        raise HTTPException(status_code=503, detail="stop after capture")

    monkeypatch.setattr("main.generate_dossier", fake_generate_dossier)

    with pytest.raises(HTTPException):
        await run_entity_pipeline(
            EntityPipelineRequest(
                entity_id="fc-koln",
                entity_name="1. FC Koln",
                entity_type="CLUB",
                priority_score=60,
            )
        )

    assert captured["force_refresh"] is True


@pytest.mark.asyncio
async def test_run_entity_pipeline_times_out_with_clear_http_error(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setenv("ENTITY_IMPORT_QUEUE_MODE", "in_process")
    monkeypatch.delenv("PIPELINE_PHASE0_TIMEOUT_MODE", raising=False)

    async def slow_generate_dossier(*_args, **_kwargs):
        await asyncio.sleep(0.1)
        raise RuntimeError("should not return")

    monkeypatch.setattr("main.generate_dossier", slow_generate_dossier)

    with pytest.raises(HTTPException) as exc_info:
        await run_entity_pipeline(
            EntityPipelineRequest(
                entity_id="icf",
                entity_name="International Canoe Federation",
                entity_type="FEDERATION",
                priority_score=85,
            )
        )

    assert exc_info.value.status_code == 504
    assert "timed out" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_run_entity_pipeline_degrades_when_phase0_timeout_mode_is_degraded(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setenv("ENTITY_IMPORT_QUEUE_MODE", "in_process")
    monkeypatch.setenv("PIPELINE_PHASE0_TIMEOUT_MODE", "degraded")

    async def slow_generate_dossier(*_args, **_kwargs):
        await asyncio.sleep(0.1)
        raise RuntimeError("should not return")

    monkeypatch.setattr("main.generate_dossier", slow_generate_dossier)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="icf-degraded",
            entity_name="International Canoe Federation",
            entity_type="FEDERATION",
            priority_score=85,
        )
    )

    assert result.phases["dossier_generation"]["status"] in {"completed", "failed"}
    assert result.artifacts["dossier"]["metadata"]["generation_mode"] == "timeout_degraded"


@pytest.mark.asyncio
async def test_run_entity_pipeline_defaults_to_degraded_timeout_mode_for_durable_worker(monkeypatch):
    monkeypatch.setenv("DOSSIER_PHASE0_TIMEOUT_SECONDS", "0.01")
    monkeypatch.setenv("ENTITY_IMPORT_QUEUE_MODE", "durable_worker")
    monkeypatch.delenv("PIPELINE_PHASE0_TIMEOUT_MODE", raising=False)

    async def slow_generate_dossier(*_args, **_kwargs):
        await asyncio.sleep(0.1)
        raise RuntimeError("should not return")

    monkeypatch.setattr("main.generate_dossier", slow_generate_dossier)

    result = await run_entity_pipeline(
        EntityPipelineRequest(
            entity_id="icf-degraded-default",
            entity_name="International Canoe Federation",
            entity_type="FEDERATION",
            priority_score=85,
        )
    )

    assert result.phases["dossier_generation"]["status"] in {"completed", "failed"}
    assert result.artifacts["dossier"]["metadata"]["generation_mode"] == "timeout_degraded"
