#!/usr/bin/env python3
"""
Tests for BrightData client fallback scraping behavior.
"""

import sys
from pathlib import Path
import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import brightdata_sdk_client as brightdata_module
from brightdata_sdk_client import BrightDataSDKClient


@pytest.mark.asyncio
async def test_fallback_scrape_uses_rendered_retry_for_low_content_js_pages(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)

    calls = {"count": 0, "urls": []}

    class FakeResponse:
        def __init__(self, text):
            self.text = text

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects):
            self.timeout = timeout
            self.follow_redirects = follow_redirects

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            calls["count"] += 1
            calls["urls"].append(url)
            if calls["count"] == 1:
                return FakeResponse(
                    """
                    <html><body>
                    <div id="app"></div>
                    <script>window.__BOOTSTRAP__ = true;</script>
                    </body></html>
                    """
                )
            return FakeResponse(
                """
                <html><body><main>
                <h1>Coventry City FC</h1>
                <p>Official club website with first team, tickets, and news.</p>
                </main></body></html>
                """
            )

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)

    result = await BrightDataSDKClient._scrape_as_markdown_fallback(client, "https://www.ccfc.co.uk")

    assert result["status"] == "success"
    assert "Official club website" in result["content"]
    assert calls["count"] == 2
    assert "metadata" in result
    assert result["metadata"].get("extraction_mode") == "rendered_fallback"

