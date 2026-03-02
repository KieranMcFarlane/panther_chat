import asyncio
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


if __name__ == "__main__":
    unittest.main()
