#!/usr/bin/env python3
"""
Tests for BrightData client fallback scraping behavior.
"""

import sys
from pathlib import Path
import pytest
import httpx

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
        def __init__(self, timeout, follow_redirects, verify=True):
            self.timeout = timeout
            self.follow_redirects = follow_redirects
            self.verify = verify

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


@pytest.mark.asyncio
async def test_scrape_as_markdown_uses_modern_sdk_auto_path_when_legacy_client_missing(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    client.token = "token"
    client._client = None

    async def fake_get_client():
        raise RuntimeError("BrightData SDK unavailable, fallback will be used")

    async def fake_modern_scrape(url):
        return {
            "status": "success",
            "url": url,
            "content": "Rendered content from modern SDK",
            "raw_html": "<html><body>Rendered content from modern SDK</body></html>",
            "timestamp": "2026-03-14T13:00:00Z",
            "publication_date": None,
            "metadata": {
                "word_count": 5,
                "source": "brightdata_sdk_auto",
                "method": "browser_api",
            },
        }

    async def unexpected_http_fallback(url):
        raise AssertionError("http fallback should not run when modern sdk path succeeds")

    client._get_client = fake_get_client
    client._scrape_with_modern_sdk = fake_modern_scrape
    client._scrape_as_markdown_fallback = unexpected_http_fallback

    result = await BrightDataSDKClient.scrape_as_markdown(client, "https://www.ccfc.co.uk")

    assert result["status"] == "success"
    assert result["metadata"]["source"] == "brightdata_sdk_auto"
    assert "Rendered content" in result["content"]


@pytest.mark.asyncio
async def test_fallback_scrape_retries_without_ssl_verification_on_cert_failure(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    calls = {"count": 0, "verify_values": []}

    class FakeResponse:
        text = "<html><body><main><p>SSL fallback content</p></main></body></html>"

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects, verify=True):
            self.verify = verify
            calls["verify_values"].append(verify)

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            calls["count"] += 1
            if calls["count"] == 1 and self.verify is True:
                raise httpx.ConnectError("[SSL: CERTIFICATE_VERIFY_FAILED]")
            return FakeResponse()

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)

    result = await BrightDataSDKClient._scrape_as_markdown_fallback(client, "https://example.com")

    assert result["status"] == "success"
    assert "SSL fallback content" in result["content"]
    assert calls["verify_values"][:2] == [True, False]


@pytest.mark.asyncio
async def test_fallback_scrape_survives_publication_date_import_failure(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)

    class FakeResponse:
        text = "<html><body><main><p>No date parser installed but content exists</p></main></body></html>"

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects, verify=True):
            self.verify = verify

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url):
            return FakeResponse()

    def fake_extract_publication_date(*args, **kwargs):
        raise ImportError("No module named 'dateutil'")

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(client, "_extract_publication_date", fake_extract_publication_date)

    result = await BrightDataSDKClient._scrape_as_markdown_fallback(client, "https://example.com")

    assert result["status"] == "success"
    assert "No date parser installed" in result["content"]


def test_extract_text_from_html_uses_json_state_for_js_heavy_pages():
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    html = """
    <html>
      <head>
        <script id="__NEXT_DATA__" type="application/json">
          {
            "props": {
              "pageProps": {
                "hero": {
                  "description": "Coventry City FC has issued a request for proposals for digital fan engagement and CRM services."
                }
              }
            }
          }
        </script>
      </head>
      <body><div id="__next"></div></body>
    </html>
    """

    parsed = BrightDataSDKClient._extract_text_from_html(client, html)
    assert "request for proposals" in parsed["content"].lower()


@pytest.mark.asyncio
async def test_browser_request_api_render_returns_extracted_content(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    client.token = "test-token"

    class FakeResponse:
        def __init__(self):
            self.text = """
            <html><body><main>
            <h1>Vacancies</h1>
            <p>Coventry City FC seeks digital transformation and CRM suppliers.</p>
            </main></body></html>
            """

        def raise_for_status(self):
            return None

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects, verify=True):
            self.timeout = timeout
            self.follow_redirects = follow_redirects
            self.verify = verify

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            return FakeResponse()

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setenv("BRIGHTDATA_BROWSER_ZONE", "sdk_browser")

    result = await BrightDataSDKClient._scrape_with_browser_request_api(client, "https://www.ccfc.co.uk")

    assert result is not None
    assert result["status"] == "success"
    assert "crm suppliers" in result["content"].lower()
    assert result["metadata"]["source"] == "brightdata_request_api"
    assert result["metadata"]["extraction_mode"] == "rendered_fallback_brightdata_request_api"
