import asyncio
import sys
import types
import unittest
from unittest.mock import patch

fake_schemas = types.ModuleType("backend.schemas")
fake_schemas.EntityDossier = object
fake_schemas.DossierTier = object
fake_schemas.CacheStatus = object


class _FakeDossierSection:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


fake_schemas.DossierSection = _FakeDossierSection
sys.modules.setdefault("backend.schemas", fake_schemas)

from backend.dossier_generator import UniversalDossierGenerator


class _DisabledClaudeClient:
    def __init__(self):
        self.query_calls = 0

    @staticmethod
    def _get_disabled_reason():
        return "insufficient balance"

    async def query(self, *args, **kwargs):
        self.query_calls += 1
        raise RuntimeError("Claude API disabled: insufficient balance")


class DossierGeneratorFastFailTest(unittest.TestCase):
    def test_model_cascade_returns_minimal_dossier_without_querying_when_claude_is_disabled(self):
        claude_client = _DisabledClaudeClient()
        generator = UniversalDossierGenerator(claude_client)

        dossier = asyncio.run(
            generator._generate_with_model_cascade(
                prompt="Generate dossier",
                entity_name="Example FC",
                tier="PREMIUM"
            )
        )

        self.assertEqual(claude_client.query_calls, 0)
        self.assertEqual(dossier["metadata"]["entity_id"], "Example FC")
        self.assertIn("executive_summary", dossier)

    def test_universal_generation_skips_leadership_collection_when_claude_is_disabled(self):
        claude_client = _DisabledClaudeClient()
        generator = UniversalDossierGenerator(claude_client)

        class _FakeCollector:
            leadership_calls = 0

            async def collect_all(self, entity_id, entity_name):
                return types.SimpleNamespace(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    metadata=None,
                    scraped_content=[],
                    hypothesis_signals=[],
                    digital_transformation={},
                    strategic_opportunities={},
                    leadership={},
                    recent_news={},
                    performance={}
                )

            async def collect_leadership(self, entity_id, entity_name):
                type(self).leadership_calls += 1
                return {"decision_makers": []}

        fake_collector = _FakeCollector()

        with patch("backend.dossier_generator.DATA_COLLECTOR_AVAILABLE", True), patch(
            "backend.dossier_generator.DossierDataCollector", return_value=fake_collector
        ):
            dossier = asyncio.run(
                generator.generate_universal_dossier(
                    entity_id="entity-123",
                    entity_name="Example FC",
                    priority_score=70
                )
            )

        self.assertEqual(fake_collector.leadership_calls, 0)
        self.assertEqual(dossier["metadata"]["entity_name"], "Example FC")

    def test_universal_generation_skips_collector_entirely_when_claude_is_disabled(self):
        claude_client = _DisabledClaudeClient()
        generator = UniversalDossierGenerator(claude_client)

        with patch("backend.dossier_generator.DATA_COLLECTOR_AVAILABLE", True), patch(
            "backend.dossier_generator.DossierDataCollector",
            side_effect=AssertionError("collector should not be created when Claude is disabled")
        ):
            dossier = asyncio.run(
                generator.generate_universal_dossier(
                    entity_id="entity-123",
                    entity_name="Example FC",
                    priority_score=70
                )
            )

        self.assertEqual(dossier["metadata"]["entity_name"], "Example FC")


if __name__ == "__main__":
    unittest.main()
