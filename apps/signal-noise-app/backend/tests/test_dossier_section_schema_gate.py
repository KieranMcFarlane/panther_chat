#!/usr/bin/env python3
"""
Unit tests for Phase-0 dossier section schema gate and deterministic fallback metadata.
"""

import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

from dossier_generator import EntityDossierGenerator


class _FakeClaudeClient:
    def __init__(self, responses):
        self._responses = list(responses)

    async def query(self, **_kwargs):
        if self._responses:
            return {"content": self._responses.pop(0)}
        return {"content": ""}


@pytest.mark.asyncio
async def test_generate_section_marks_repair_recovered_when_json_repair_succeeds(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{entity_name}")
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


@pytest.mark.asyncio
async def test_generate_section_marks_deterministic_text_fallback_when_repair_still_invalid(monkeypatch):
    from backend import dossier_templates

    monkeypatch.setattr(dossier_templates, "get_prompt_template", lambda *_args, **_kwargs: "{entity_name}")
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
