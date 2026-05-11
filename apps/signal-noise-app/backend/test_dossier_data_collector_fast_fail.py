import asyncio
import os
import sys
import types
import unittest

from backend.claude_client import ClaudeClient
from backend.dossier_data_collector import DossierDataCollector


class _FastFailCollector(DossierDataCollector):
    def __init__(self):
        super().__init__()
        self.scrape_called = False

    async def _connect_falkordb(self):
        self._falkordb_connected = False
        return False

    async def _connect_brightdata(self):
        self._brightdata_available = True
        self.brightdata_client = object()
        return True

    async def _connect_claude(self):
        self.claude_client = ClaudeClient(api_key="test-key")
        return True

    async def _get_scraped_content_enhanced(self, entity_id: str, entity_name: str):
        self.scrape_called = True
        return None


class DossierDataCollectorFastFailTest(unittest.TestCase):
    def setUp(self):
        ClaudeClient._api_disabled_reason = "insufficient balance"

    def tearDown(self):
        ClaudeClient._api_disabled_reason = None

    def test_collect_all_skips_expensive_scraping_when_claude_api_is_disabled(self):
        collector = _FastFailCollector()

        data = asyncio.run(collector.collect_all("entity-123", "Example FC"))

        self.assertFalse(collector.scrape_called)
        self.assertEqual(data.metadata.data_source, "Generated")

    def test_local_falkordb_connection_omits_stale_cloud_auth(self):
        calls = []

        class _FakeGraph:
            def query(self, _query):
                return object()

        class _FakeFalkorDB:
            def __init__(self, **kwargs):
                calls.append(kwargs)

            def select_graph(self, _database):
                return _FakeGraph()

        previous_module = sys.modules.get("falkordb")
        sys.modules["falkordb"] = types.SimpleNamespace(FalkorDB=_FakeFalkorDB)
        previous_env = {
            key: os.environ.get(key)
            for key in ["FALKORDB_URI", "FALKORDB_USER", "FALKORDB_PASSWORD", "FALKORDB_LOCAL_AUTH"]
        }
        try:
            os.environ["FALKORDB_URI"] = "redis://localhost:6379"
            os.environ["FALKORDB_USER"] = "stale-cloud-user"
            os.environ["FALKORDB_PASSWORD"] = "stale-cloud-password"
            os.environ.pop("FALKORDB_LOCAL_AUTH", None)

            collector = DossierDataCollector()
            connected = asyncio.run(collector._connect_falkordb())

            self.assertTrue(connected)
            self.assertEqual(calls[0]["username"], None)
            self.assertEqual(calls[0]["password"], None)
        finally:
            if previous_module is None:
                sys.modules.pop("falkordb", None)
            else:
                sys.modules["falkordb"] = previous_module
            for key, value in previous_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


if __name__ == "__main__":
    unittest.main()
