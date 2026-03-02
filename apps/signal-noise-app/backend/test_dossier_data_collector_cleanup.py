import asyncio
import unittest

from backend.dossier_data_collector import DossierDataCollector


class _ClosableClient:
    def __init__(self):
        self.close_calls = 0

    async def close(self):
        self.close_calls += 1


class DossierDataCollectorCleanupTest(unittest.TestCase):
    def test_close_closes_brightdata_client_once(self):
        collector = DossierDataCollector()
        collector.brightdata_client = _ClosableClient()

        asyncio.run(collector.close())
        asyncio.run(collector.close())

        self.assertEqual(collector.brightdata_client, None)


if __name__ == "__main__":
    unittest.main()
