import sys
import asyncio
from pathlib import Path

import pytest

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from brightdata_sdk_client import BrightDataSDKClient
from dossier_generator import EntityDossierGenerator


def test_dossier_templates_module_provides_required_apis():
    from dossier_templates import get_prompt_template, list_all_templates

    template_names = list_all_templates()
    assert "core_info_template" in template_names
    assert "digital_maturity_template" in template_names
    prompt = get_prompt_template("core_info_template", "haiku")
    assert "{entity_name}" in prompt


def test_entity_dossier_generator_exposes_json_extraction_helper():
    assert hasattr(EntityDossierGenerator, "_extract_last_valid_json_block")


@pytest.mark.asyncio
async def test_search_engine_fallback_resolves_async_serp_response_id(monkeypatch):
    class _FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload
            self.text = str(payload)

        def json(self):
            return self._payload

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            self.post_calls = []
            self.get_calls = []

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, endpoint, headers=None, json=None):
            self.post_calls.append((endpoint, json))
            return _FakeResponse(200, {"response_id": "resp-123"})

        async def get(self, endpoint, headers=None, params=None):
            self.get_calls.append((endpoint, params))
            if endpoint.endswith("/serp/get_result") and params.get("response_id") == "resp-123":
                return _FakeResponse(
                    200,
                    {
                        "organic": [
                            {
                                "position": 1,
                                "title": "Coventry City FC Official Site",
                                "url": "https://www.ccfc.co.uk/",
                                "description": "Official website",
                            }
                        ]
                    },
                )
            return _FakeResponse(404, {"error": "not found"})

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    client = BrightDataSDKClient(token="test-token")
    client.api_url = "https://api.brightdata.com"
    client.serp_timeout_seconds = 1

    result = await client._search_engine_fallback(
        query="Coventry City FC official website",
        engine="google",
        country="us",
        num_results=5,
    )

    assert result["status"] == "success"
    assert result["results"]
    assert result["results"][0]["url"] == "https://www.ccfc.co.uk/"
    assert result["metadata"]["endpoint"].endswith("/serp/req")


@pytest.mark.asyncio
async def test_scrape_as_markdown_uses_browser_zone_when_initial_sdk_result_is_empty(monkeypatch):
    class _FakeResult:
        def __init__(self, data, method="web_unlocker"):
            self.data = data
            self.method = method

    class _FakeClient:
        def __init__(self):
            self.calls = []

        async def scrape_url(self, url, response_format="raw", zone=None):
            self.calls.append({"url": url, "response_format": response_format, "zone": zone})
            if zone is None:
                # Empty after script/style cleanup.
                return _FakeResult("<html><body><script>boot()</script></body></html>", method="web_unlocker")
            return _FakeResult("<html><body><main><p>Rendered page content</p></main></body></html>", method="browser_api")

    fake_client = _FakeClient()
    client = BrightDataSDKClient(token="test-token")
    client.browser_zone = "mcp_browser"

    async def _fake_get_client():
        return fake_client

    monkeypatch.setattr(client, "_get_client", _fake_get_client)

    result = await client.scrape_as_markdown("https://example.com")

    assert result["status"] == "success"
    assert "Rendered page content" in result["content"]
    assert result["metadata"]["method"] == "browser_api"
    assert any(call.get("zone") == "mcp_browser" for call in fake_client.calls)


def test_extract_text_and_publication_date_uses_metadata_when_body_is_empty():
    client = BrightDataSDKClient(token="test-token")
    html = """
    <html>
      <head>
        <title>Coventry City FC</title>
        <meta name="description" content="Official Coventry City FC website" />
      </head>
      <body>
        <script>window.__APP__ = true;</script>
      </body>
    </html>
    """

    content, publication_date = client._extract_text_and_publication_date(html, "https://www.ccfc.co.uk/")
    assert "Coventry City FC" in content
    assert "Official Coventry City FC website" in content
    assert publication_date is None


def test_extract_text_and_publication_date_uses_script_fallback_for_js_heavy_pages():
    client = BrightDataSDKClient(token="test-token")
    html = """
    <html>
      <head></head>
      <body>
        <script>
          window.__NUXT__={};
          window.__NUXT__.config={public:{
            VUE_APP_SITE_DOMAIN:"https://cms.gc.coventrycityfcservices.co.uk",
            VUE_APP_FIXTURE:"https://matches.football.admin.gc.coventrycityfcservices.co.uk"
          }};
        </script>
      </body>
    </html>
    """

    content, publication_date = client._extract_text_and_publication_date(html, "https://www.ccfc.co.uk/")
    assert "Script data:" in content
    assert "https://" in content
    assert publication_date is None


def test_normalize_serp_results_unwraps_google_redirect_urls():
    client = BrightDataSDKClient(token="test-token")

    normalized = client._normalize_serp_results(
        payload={
            "organic": [
                {
                    "position": 1,
                    "title": "Coventry City FC Official Site",
                    "url": "https://www.google.com/goto?url=https%3A%2F%2Fwww.ccfc.co.uk%2F",
                    "description": "Official website",
                }
            ]
        },
        num_results=5,
    )

    assert normalized
    assert normalized[0]["url"] == "https://www.ccfc.co.uk/"


def test_dossier_generator_get_last_official_site_url_normalizes_domain():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator._last_entity_data_by_id = {
        "coventry-city-fc": {"official_site_url": "www.ccfc.co.uk"}
    }

    assert generator.get_last_official_site_url("coventry-city-fc") == "https://www.ccfc.co.uk"


def test_dossier_generator_respects_disable_question_extraction_env(monkeypatch):
    monkeypatch.setenv("DOSSIER_DISABLE_QUESTION_EXTRACTION", "true")
    generator = EntityDossierGenerator(claude_client=object())
    assert generator.disable_question_extraction is True


@pytest.mark.asyncio
async def test_generate_sections_parallel_respects_section_parallelism():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.section_parallelism = 1
    generator.section_max_tokens_cap = 0
    peak = 0
    active = 0

    async def _fake_generate_section(section_id, entity_data, model):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.01)
        active -= 1
        return section_id

    generator._generate_section = _fake_generate_section

    results = await generator._generate_sections_parallel(
        section_ids=["a", "b", "c"],
        entity_data={},
        model="haiku",
    )

    assert peak == 1
    assert results == []


@pytest.mark.asyncio
async def test_generate_section_applies_max_tokens_cap():
    class _FakeClaude:
        def __init__(self):
            self.max_tokens_seen = None

        async def query(self, prompt, model, max_tokens):
            self.max_tokens_seen = max_tokens
            return {"content": "{\"content\": [\"ok\"], \"confidence\": 0.8}"}

    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.claude_client = _FakeClaude()
    generator.section_max_tokens_cap = 1200
    generator.section_parallelism = 1
    generator.section_templates = {
        "core_information": {
            "model": "haiku",
            "prompt_template": "core_info_template",
            "max_tokens": 4000,
            "description": "Basic entity information",
        }
    }

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "Coventry City FC"},
        model="haiku",
    )

    assert generator.claude_client.max_tokens_seen == 1200
    assert section.id == "core_information"
