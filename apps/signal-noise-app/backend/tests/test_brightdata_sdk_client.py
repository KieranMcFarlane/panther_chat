#!/usr/bin/env python3
"""
Tests for BrightData client fallback scraping behavior.
"""

import sys
import time
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


@pytest.mark.asyncio
async def test_search_engine_fallback_uses_brightdata_http_serp(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    client.token = "test-token"

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "organic_results": [
                    {
                        "position": 1,
                        "title": "Coventry City procurement update",
                        "link": "https://example.org/procurement",
                        "description": "RFP issued for CRM platform",
                    }
                ]
            }

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects):
            self.timeout = timeout
            self.follow_redirects = follow_redirects

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            assert "/request" in url
            assert headers["Authorization"] == "Bearer test-token"
            assert json["zone"] == "sdk_serp"
            assert "google.com/search" in json["url"]
            return FakeResponse()

        async def get(self, url, params=None):
            raise AssertionError("legacy /serp endpoint should not be used when /request succeeds")

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)
    async def fake_whitelist(self):
        return {"sdk_serp", "sdk_unlocker"}
    monkeypatch.setattr(BrightDataSDKClient, "_get_request_zone_whitelist", fake_whitelist)

    result = await BrightDataSDKClient._search_engine_fallback(
        client,
        query="coventry city fc rfp",
        engine="google",
        country="us",
        num_results=5,
    )

    assert result["status"] == "success"
    assert len(result["results"]) == 1
    assert result["results"][0]["url"] == "https://example.org/procurement"
    assert result["metadata"]["source"] == "brightdata_http_fallback"


@pytest.mark.asyncio
async def test_search_engine_fallback_returns_error_without_mock_results(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    client.token = "test-token"

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects):
            self.timeout = timeout
            self.follow_redirects = follow_redirects

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            raise httpx.ReadTimeout("timeout")

        async def get(self, url, params=None):
            raise httpx.ReadTimeout("timeout")

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setenv("BRIGHTDATA_FALLBACK_SEARCH_MAX_ATTEMPTS", "1")
    async def fake_whitelist(self):
        return {"sdk_serp", "sdk_unlocker"}
    monkeypatch.setattr(BrightDataSDKClient, "_get_request_zone_whitelist", fake_whitelist)

    result = await BrightDataSDKClient._search_engine_fallback(
        client,
        query="coventry city fc rfp",
        engine="google",
        country="us",
        num_results=5,
    )

    assert result["status"] == "error"
    assert result["results"] == []
    assert result["metadata"]["source"] == "brightdata_http_fallback"


@pytest.mark.asyncio
async def test_search_engine_fallback_skips_cooled_down_zone(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    client.token = "test-token"
    client._zone_cooldowns = {"sdk_serp": time.monotonic() + 999}

    zone_calls = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"organic_results": [{"title": "Result", "link": "https://example.org"}]}

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects):
            self.timeout = timeout
            self.follow_redirects = follow_redirects

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            zone_calls.append(json["zone"])
            return FakeResponse()

        async def get(self, url, params=None):
            raise AssertionError("legacy path should not be used")

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)
    async def fake_whitelist(self):
        return {"sdk_serp", "sdk_unlocker"}
    monkeypatch.setattr(BrightDataSDKClient, "_get_request_zone_whitelist", fake_whitelist)

    result = await BrightDataSDKClient._search_engine_fallback(
        client,
        query="coventry city fc rfp",
        engine="google",
        country="us",
        num_results=5,
    )

    assert result["status"] == "success"
    assert zone_calls == ["sdk_unlocker"]


@pytest.mark.asyncio
async def test_search_engine_fallback_disables_not_found_zone(monkeypatch):
    client = BrightDataSDKClient.__new__(BrightDataSDKClient)
    client.token = "test-token"

    zone_calls = []

    class FakeResponse:
        def __init__(self, zone):
            self.zone = zone
            self.text = 'zone "sdk_serp" not found'
            self.status_code = 400 if zone == "sdk_serp" else 200
            self.request = httpx.Request("POST", "https://api.brightdata.com/request")

        def raise_for_status(self):
            if self.status_code >= 400:
                raise httpx.HTTPStatusError(
                    "bad request",
                    request=self.request,
                    response=httpx.Response(self.status_code, text=self.text, request=self.request),
                )
            return None

        def json(self):
            return {"organic_results": [{"title": "Result", "link": "https://example.org"}]}

    class FakeAsyncClient:
        def __init__(self, timeout, follow_redirects):
            self.timeout = timeout
            self.follow_redirects = follow_redirects

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            zone = json["zone"]
            zone_calls.append(zone)
            return FakeResponse(zone)

        async def get(self, url, params=None):
            raise AssertionError("legacy path should not be used")

    monkeypatch.setattr(brightdata_module.httpx, "AsyncClient", FakeAsyncClient)
    async def fake_whitelist(self):
        return {"sdk_serp", "sdk_unlocker"}
    monkeypatch.setattr(BrightDataSDKClient, "_get_request_zone_whitelist", fake_whitelist)

    result_1 = await BrightDataSDKClient._search_engine_fallback(
        client,
        query="coventry city fc rfp",
        engine="google",
        country="us",
        num_results=5,
    )
    assert result_1["status"] == "success"
    assert "sdk_serp" in client._invalid_request_zones

    zone_calls.clear()
    result_2 = await BrightDataSDKClient._search_engine_fallback(
        client,
        query="coventry city fc rfp 2",
        engine="google",
        country="us",
        num_results=5,
    )
    assert result_2["status"] == "success"
    assert zone_calls == ["sdk_unlocker"]
