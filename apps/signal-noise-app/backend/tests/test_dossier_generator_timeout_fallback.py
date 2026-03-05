#!/usr/bin/env python3

import asyncio
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dossier_generator import UniversalDossierGenerator


class _FakeClaudeClient:
    async def query(self, prompt: str, model: str = "haiku", max_tokens: int = 2000, **kwargs):
        return {
            "content": """
            {
              "metadata": {"data_freshness": 60, "confidence_overall": 0.4, "priority_signals": []},
              "executive_summary": {"overall_assessment": {"digital_maturity": {"score": 45, "trend": "stable", "key_strengths": [], "key_gaps": []}}, "quick_actions": [], "key_insights": []}
            }
            """
        }


def test_generate_universal_dossier_marks_compact_mode_when_collection_times_out(monkeypatch):
    monkeypatch.setenv("DOSSIER_COLLECTION_TIMEOUT_SECONDS", "1")
    monkeypatch.setenv("DOSSIER_COMPACT_MAX_TOKENS", "900")

    generator = UniversalDossierGenerator(_FakeClaudeClient())

    async def _run():
        # Force timeout/fallback path without external collectors by passing minimal entity_data
        dossier = await generator.generate_universal_dossier(
            entity_id="timeout-test-entity",
            entity_name="Timeout Test Entity",
            entity_type="FEDERATION",
            priority_score=80,
            entity_data={
                "entity_id": "timeout-test-entity",
                "entity_name": "Timeout Test Entity",
                "entity_type": "FEDERATION",
                "collection_timed_out": True,
            },
        )
        return dossier

    dossier = asyncio.run(_run())
    assert dossier["metadata"]["generation_mode"] == "compact_timeout_fallback"
    assert dossier["metadata"]["collection_timed_out"] is True
    assert dossier["metadata"]["model_max_tokens"] == 900

