#!/usr/bin/env python3
"""
Unit tests for Phase-0 dossier section schema gate and deterministic fallback metadata.
"""

import sys
import asyncio
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from dossier_generator import EntityDossierGenerator


@pytest.fixture(autouse=True)
def _disable_data_driven_section_baseline(monkeypatch):
    monkeypatch.setenv("DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE", "false")


class _FakeClaudeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def query(self, **kwargs):
        self.calls.append(kwargs)
        if self._responses:
            return {"content": self._responses.pop(0)}
        return {"content": ""}


class _SlowFakeClaudeClient:
    def __init__(self, delay_seconds: float):
        self.delay_seconds = delay_seconds
        self.calls = []

    async def query(self, **kwargs):
        self.calls.append(kwargs)
        await asyncio.sleep(self.delay_seconds)
        return {"content": '{"content": ["late response"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.8}'}


@pytest.mark.asyncio
async def test_generate_section_marks_repair_recovered_when_json_repair_succeeds(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{entity_name}")
    monkeypatch.setenv("DOSSIER_SECTION_JSON_MODE", "true")
    client = _FakeClaudeClient(
        [
            "Please analyze the request and provide output.",
            '{"content": ["Structured section"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.77}',
        ]
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "Test FC"},
        model="haiku",
    )

    assert section.reason_code == "section_json_repaired"
    assert section.parse_path == "json_repair_recovered"
    assert section.fallback_used is False
    assert section.output_status == "completed"
    assert len(client.calls) == 2
    assert client.calls[0]["json_mode"] is True
    assert client.calls[1]["json_mode"] is True


@pytest.mark.asyncio
async def test_generate_section_marks_deterministic_text_fallback_when_repair_still_invalid(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{entity_name}")
    monkeypatch.setenv("DOSSIER_SECTION_JSON_MODE", "true")
    client = _FakeClaudeClient(
        [
            "Please analyze the request and provide output.",
            "N/A",
        ]
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "Test FC"},
        model="haiku",
    )

    assert section.reason_code == "section_json_repair_failed_text_fallback"
    assert section.parse_path == "deterministic_text_fallback"
    assert section.fallback_used is True
    assert section.output_status == "completed_with_fallback"
    assert len(client.calls) == 2
    assert all(call["json_mode"] is True for call in client.calls)


@pytest.mark.asyncio
async def test_generate_section_skips_repair_when_primary_response_empty(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{entity_name}")
    monkeypatch.setenv("DOSSIER_SECTION_JSON_MODE", "true")
    client = _FakeClaudeClient([""])
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "Test FC"},
        model="haiku",
    )

    assert len(client.calls) == 1
    assert client.calls[0]["json_mode"] is True
    assert section.reason_code == "section_json_repair_failed_minimal_placeholder"
    assert section.parse_path == "minimal_placeholder_fallback"
    assert section.fallback_used is True
    assert section.output_status == "completed_with_fallback"


def test_create_fallback_section_sets_reason_code():
    generator = EntityDossierGenerator(_FakeClaudeClient([]))
    section = generator._create_fallback_section(
        section_id="core_information",
        model="haiku",
        reason_code="section_generation_exception",
    )

    assert section.reason_code == "section_generation_exception"
    assert section.parse_path == "section_exception_fallback"
    assert section.fallback_used is True
    assert section.output_status == "failed"


@pytest.mark.asyncio
async def test_generate_section_uses_data_driven_baseline_when_enabled(monkeypatch):
    monkeypatch.setenv("DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE", "true")
    client = _FakeClaudeClient(
        ['{"content": ["Structured section"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.8}']
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={
            "entity_name": "Test FC",
            "entity_type": "CLUB",
            "sport": "Football",
            "country": "UK",
            "league_or_competition": "Championship",
            "founded": "1883",
            "website": "https://example.com",
        },
        model="haiku",
    )

    assert section.parse_path == "deterministic_data_driven_primary"
    assert section.fallback_used is False
    assert section.output_status == "completed"
    assert len(client.calls) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("section_id", ["ai_reasoner_assessment", "challenges_opportunities"])
async def test_generate_long_sections_use_data_driven_baseline_when_enabled(monkeypatch, section_id):
    monkeypatch.setenv("DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE", "true")
    client = _FakeClaudeClient(
        ['{"content": ["Structured section"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.8}']
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id=section_id,
        entity_data={"entity_name": "Test FC", "entity_type": "CLUB", "country": "UK"},
        model="sonnet",
    )

    assert section.parse_path == "deterministic_data_driven_primary"
    assert section.fallback_used is False
    assert section.output_status == "completed"
    assert len(client.calls) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("section_id", "expected_reason"),
    [
        ("recent_news", "recent_news_empty"),
        ("leadership", "leadership_sparse"),
        ("outreach_strategy", "outreach_low_evidence"),
        ("contact_information", "no_leadership_contacts"),
    ],
)
async def test_data_driven_sections_mark_degraded_when_evidence_is_sparse(monkeypatch, section_id, expected_reason):
    monkeypatch.setenv("DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE", "true")
    generator = EntityDossierGenerator(_FakeClaudeClient([]))

    section = await generator._generate_section(
        section_id=section_id,
        entity_data={"entity_name": "Test FC", "entity_type": "CLUB"},
        model="haiku",
    )

    assert section.parse_path == "deterministic_data_driven_primary"
    assert section.output_status == "degraded"
    assert section.reason_code == expected_reason
    assert section.fallback_used is True


@pytest.mark.asyncio
async def test_data_driven_quick_actions_mark_degraded_when_no_actionable_signals(monkeypatch):
    monkeypatch.setenv("DOSSIER_SECTION_USE_DATA_DRIVEN_BASELINE", "true")
    generator = EntityDossierGenerator(_FakeClaudeClient([]))

    section = await generator._generate_section(
        section_id="quick_actions",
        entity_data={"entity_name": "Test FC", "entity_type": "CLUB"},
        model="haiku",
    )

    assert section.parse_path == "deterministic_data_driven_primary"
    assert section.output_status == "degraded"
    assert section.reason_code == "no_actionable_signals"
    assert section.fallback_used is True


def test_get_last_official_site_url_prefers_entity_payload_fields():
    generator = EntityDossierGenerator(_FakeClaudeClient([]))
    generator._last_entity_data_by_id["test-fc"] = {"website": "https://example.com"}

    assert generator.get_last_official_site_url("test-fc") == "https://example.com"


@pytest.mark.asyncio
async def test_generate_section_tolerates_missing_template_placeholders(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(
        dossier_templates,
        "get_prompt_template",
        lambda *_args, **_kwargs: (
            "{entity_name} {official_site_url} {official_site_summary} {press_releases_summary}"
        ),
    )
    client = _FakeClaudeClient(
        ['{"content": ["Structured section"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.8}']
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "Test FC"},
        model="haiku",
    )

    assert section.output_status == "completed"
    assert section.fallback_used is False
    assert section.content == ["Structured section"]


@pytest.mark.asyncio
async def test_generate_section_truncates_long_prompt_fields(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{metadata_summary}")
    client = _FakeClaudeClient(
        ['{"content": ["Structured section"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.8}']
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "Test FC", "metadata_summary": "x" * 5000},
        model="haiku",
    )

    assert section.output_status == "completed"
    assert section.fallback_used is False
    assert len(client.calls) == 1
    prompt = client.calls[0]["prompt"]
    assert "[truncated" in prompt
    assert len(prompt) < 900


@pytest.mark.asyncio
async def test_generate_section_applies_compact_budget_for_long_sections(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{metadata_summary}")
    client = _FakeClaudeClient(
        ['{"content": ["Structured section"], "metrics": [], "insights": [], "recommendations": [], "confidence": 0.8}']
    )
    generator = EntityDossierGenerator(client)

    section = await generator._generate_section(
        section_id="outreach_strategy",
        entity_data={"entity_name": "Test FC", "metadata_summary": "brief summary"},
        model="sonnet",
    )

    assert section.output_status == "completed"
    assert len(client.calls) == 1
    assert "STRICT RESPONSE BUDGET" in client.calls[0]["prompt"]
    assert client.calls[0]["max_tokens"] <= 1800
    assert client.calls[0]["model"] == "haiku"


@pytest.mark.asyncio
async def test_generate_sections_parallel_times_out_and_uses_fallback(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{entity_name}")
    monkeypatch.setenv("DOSSIER_SECTION_GENERATION_TIMEOUT_SECONDS", "0.01")
    client = _SlowFakeClaudeClient(delay_seconds=0.2)
    generator = EntityDossierGenerator(client)

    sections = await generator._generate_sections_parallel(
        section_ids=["core_information"],
        entity_data={"entity_name": "Test FC"},
        model="haiku",
    )

    assert len(sections) == 1
    section = sections[0]
    assert section.reason_code == "section_generation_timeout"
    assert section.output_status == "failed"
    assert section.fallback_used is True
