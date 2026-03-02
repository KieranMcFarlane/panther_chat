import asyncio
import os
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
        return None


class ClaudeClientEnvDisableTest(unittest.TestCase):
    def setUp(self):
        _FakeAnthropic.calls = 0
        claude_client_module.ClaudeClient._api_disabled_reason = None

    def tearDown(self):
        claude_client_module.ClaudeClient._api_disabled_reason = None

    def test_env_flag_disables_claude_before_any_api_call(self):
        with patch.dict(os.environ, {"DISABLE_CLAUDE_API": "1"}, clear=False), patch.object(
            claude_client_module, "ANTHROPIC_SDK_AVAILABLE", True
        ), patch.object(claude_client_module, "Anthropic", _FakeAnthropic, create=True):
            client = claude_client_module.ClaudeClient(api_key="test-key")

            with self.assertRaisesRegex(RuntimeError, "disabled"):
                asyncio.run(client.query("prompt"))

        self.assertEqual(_FakeAnthropic.calls, 0)


if __name__ == "__main__":
    unittest.main()
