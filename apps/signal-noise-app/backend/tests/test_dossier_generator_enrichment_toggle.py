#!/usr/bin/env python3
"""
Tests for post-collection enrichment toggle in dossier generation.
"""

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).parent.parent
app_dir = backend_dir.parent
sys.path.insert(0, str(app_dir))
sys.path.insert(0, str(backend_dir))

import dossier_generator as generator_module
from entity_type_dossier_questions import get_questions_for_entity_type
from dossier_generator import EntityDossierGenerator


class _FakeClaude:
    async def query(self, **_kwargs):
        return {"content": "{}"}


@pytest.mark.asyncio
async def test_generate_dossier_skips_duplicate_enrichment_by_default(monkeypatch):
    calls = {"collect_all": 0, "multi_source": 0, "leadership": 0, "close": 0}

    class _Collector:
        async def collect_all(self, *_args, **_kwargs):
            calls["collect_all"] += 1
            return SimpleNamespace(data_sources_used=["BrightData"], metadata=None)

        async def _collect_multi_source_intelligence(self, *_args, **_kwargs):
            calls["multi_source"] += 1
            return {}

        async def collect_leadership(self, *_args, **_kwargs):
            calls["leadership"] += 1
            return {"decision_makers": []}

        async def close(self):
            calls["close"] += 1

    monkeypatch.setenv("DOSSIER_RUN_POST_COLLECTION_ENRICHMENT", "false")
    monkeypatch.setenv("DOSSIER_DISABLE_QUESTION_EXTRACTION", "true")
    monkeypatch.setattr(generator_module, "DATA_COLLECTOR_AVAILABLE", True)
    monkeypatch.setattr(generator_module, "DossierDataCollector", _Collector)

    generator = EntityDossierGenerator(_FakeClaude())
    monkeypatch.setattr(
        generator,
        "_dossier_data_to_dict",
        lambda _obj: {
            "entity_name": "Test FC",
            "leadership_data": {"decision_makers": [{"name": "Alice Smith", "role": "CEO"}]},
            "leadership_count": 1,
        },
    )
    async def _leadership_section(*_args, **_kwargs):
        return [SimpleNamespace(id="leadership", title="Leadership", content=["Test FC leadership notes."])]

    monkeypatch.setattr(generator, "_generate_sections_parallel", _leadership_section)

    await generator.generate_dossier(
        entity_id="test-fc",
        entity_name="Test FC",
        entity_type="CLUB",
        priority_score=35,
    )

    assert calls["collect_all"] == 1
    assert calls["multi_source"] == 0
    assert calls["leadership"] == 0
    assert calls["close"] == 1


@pytest.mark.asyncio
async def test_generate_dossier_runs_post_collection_enrichment_when_enabled(monkeypatch):
    calls = {"collect_all": 0, "multi_source": 0, "leadership": 0, "close": 0}

    class _Collector:
        async def collect_all(self, *_args, **_kwargs):
            calls["collect_all"] += 1
            return SimpleNamespace(data_sources_used=["BrightData"], metadata=None)

        async def _collect_multi_source_intelligence(self, *_args, **_kwargs):
            calls["multi_source"] += 1
            return {
                "official_site": {"summary": "", "url": ""},
                "job_postings": [],
                "press_releases": [],
                "linkedin_posts": [],
                "freshness_score": 50,
                "sources_used": [],
            }

        async def collect_leadership(self, *_args, **_kwargs):
            calls["leadership"] += 1
            return {"decision_makers": []}

        async def close(self):
            calls["close"] += 1

    monkeypatch.setenv("DOSSIER_RUN_POST_COLLECTION_ENRICHMENT", "true")
    monkeypatch.setenv("DOSSIER_DISABLE_QUESTION_EXTRACTION", "true")
    monkeypatch.setattr(generator_module, "DATA_COLLECTOR_AVAILABLE", True)
    monkeypatch.setattr(generator_module, "DossierDataCollector", _Collector)

    generator = EntityDossierGenerator(_FakeClaude())
    monkeypatch.setattr(generator, "_dossier_data_to_dict", lambda _obj: {"entity_name": "Test FC"})
    async def _leadership_sections(*_args, **_kwargs):
        return [SimpleNamespace(id="leadership", title="Leadership", content=["Test FC leadership notes."])]

    monkeypatch.setattr(generator, "_generate_sections_parallel", _leadership_sections)

    await generator.generate_dossier(
        entity_id="test-fc",
        entity_name="Test FC",
        entity_type="CLUB",
        priority_score=35,
    )

    assert calls["collect_all"] == 1
    assert calls["multi_source"] == 1
    assert calls["leadership"] == 1
    assert calls["close"] == 1


@pytest.mark.asyncio
async def test_generate_dossier_uses_template_questions_in_question_first_mode(monkeypatch):
    calls = {"collect_all": 0, "close": 0, "query": 0}

    class _Collector:
        async def collect_all(self, *_args, **_kwargs):
            calls["collect_all"] += 1
            return SimpleNamespace(data_sources_used=["BrightData"], metadata=None)

        async def close(self):
            calls["close"] += 1

    class _CountingClaude:
        async def query(self, **_kwargs):
            calls["query"] += 1
            return {"content": "{}"}

    monkeypatch.setenv("DOSSIER_RUN_POST_COLLECTION_ENRICHMENT", "false")
    monkeypatch.setenv("DOSSIER_DISABLE_QUESTION_EXTRACTION", "false")
    monkeypatch.setattr(generator_module, "DATA_COLLECTOR_AVAILABLE", True)
    monkeypatch.setattr(generator_module, "DossierDataCollector", _Collector)

    generator = EntityDossierGenerator(_CountingClaude())
    monkeypatch.setattr(generator, "_dossier_data_to_dict", lambda _obj: {"entity_name": "Test FC"})

    async def _leadership_sections(*_args, **_kwargs):
        return [SimpleNamespace(id="leadership", title="Leadership", content=["Test FC leadership notes."])]

    monkeypatch.setattr(generator, "_generate_sections_parallel", _leadership_sections)

    dossier = await generator.generate_dossier(
        entity_id="test-fc",
        entity_name="Test FC",
        entity_type="CLUB",
        priority_score=35,
        run_objective="leadership_enrichment",
    )

    expected_question = get_questions_for_entity_type("SPORT_CLUB", 1)[0].question.format(entity="Test FC")

    assert calls["collect_all"] == 1
    assert calls["close"] == 1
    assert calls["query"] == 0
    assert dossier.questions
    assert dossier.questions[0].question_text == expected_question
