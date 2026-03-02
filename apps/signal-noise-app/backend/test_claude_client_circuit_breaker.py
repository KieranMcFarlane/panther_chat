import asyncio
import unittest
from unittest.mock import patch

from backend import claude_client as claude_client_module


class _FakeAnthropic:
    calls = 0

    def __init__(self, *args, **kwargs):
        pass

    @property
    def messages(self):
        return self

    def create(self, **kwargs):
        type(self).calls += 1
        raise Exception(
            "Error code: 429 - {'error': {'code': '1113', 'message': 'Insufficient balance or no resource package. Please recharge.'}}"
        )


class ClaudeClientCircuitBreakerTest(unittest.TestCase):
    def setUp(self):
        _FakeAnthropic.calls = 0

    def test_insufficient_balance_disables_future_api_calls_for_process(self):
        with patch.object(claude_client_module, "ANTHROPIC_SDK_AVAILABLE", True), patch.object(
            claude_client_module, "Anthropic", _FakeAnthropic, create=True
        ):
            first_client = claude_client_module.ClaudeClient(api_key="test-key")

            with self.assertRaises(Exception):
                asyncio.run(first_client.query("first prompt"))

            second_client = claude_client_module.ClaudeClient(api_key="test-key")
            with self.assertRaisesRegex(RuntimeError, "disabled"):
                asyncio.run(second_client.query("second prompt"))

        self.assertEqual(_FakeAnthropic.calls, 1)


if __name__ == "__main__":
    unittest.main()
