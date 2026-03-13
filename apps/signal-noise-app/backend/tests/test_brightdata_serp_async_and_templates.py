import sys
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

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


def test_section_data_needs_repair_for_markdown_json_blob():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    section_data = {
        "content": [
            "```json\n{\"content\": [\"Signal\"], \"confidence\": 0.8\n```"
        ]
    }

    assert generator._section_data_needs_repair(section_data) is True


def test_coerce_unstructured_section_data_filters_meta_instruction_lines():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    coerced = generator._coerce_unstructured_section_data(
        """
Input: A partial JSON string labeled RAW_OUTPUT.
The user wants a role-specific outreach strategy.
FIBA is headquartered in Mies, Switzerland.
Official site: https://www.fiba.basketball/en.
Return valid JSON only.
        """
    )

    assert coerced is not None
    content = coerced["content"]
    assert all("input:" not in line.lower() for line in content)
    assert all("the user wants" not in line.lower() for line in content)
    assert any("FIBA is headquartered" in line for line in content)


def test_sanitize_section_content_strips_json_scaffolding_meta_lines():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    cleaned = generator._sanitize_section_content(
        [
            "Information Retrieval:** Facts about FIBA.",
            "Drafting Content:** Bullet points.",
            "Drafting Insights:** Strategic observations.",
            "`content`: array of strings.",
            "I need to complete this JSON object based on the keys requested.",
            "Let's analyze the input:",
            "Therefore, I must generate these missing keys.",
            "FIBA is headquartered in Mies, Switzerland.",
        ]
    )

    assert cleaned == ["FIBA is headquartered in Mies, Switzerland."]


def test_create_fallback_section_uses_deterministic_core_information_when_strict():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {
        "core_information",
        "recent_news",
        "current_performance",
        "leadership",
    }
    generator.section_templates = {
        "core_information": {
            "description": "Basic entity information",
        }
    }

    section = generator._create_fallback_section(
        "core_information",
        "haiku",
        entity_data={
            "entity_name": "FIBA",
            "entity_type": "FEDERATION",
            "entity_country": "Switzerland",
            "official_site_url": "https://www.fiba.basketball/en",
        },
    )

    assert section.confidence > 0.0
    assert "Section generation failed" not in " ".join(section.content)
    assert any("FIBA" in line for line in section.content)
    assert any("https://www.fiba.basketball/en" in line for line in section.content)


def test_create_fallback_section_uses_deterministic_recent_news_when_strict():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {
        "core_information",
        "recent_news",
        "current_performance",
        "leadership",
    }
    generator.section_templates = {
        "recent_news": {
            "description": "Recent news and developments",
        }
    }

    section = generator._create_fallback_section(
        "recent_news",
        "haiku",
        entity_data={
            "entity_name": "FIBA",
            "press_releases_summary": "- March 2026: New competition format announced\n- February 2026: Governance update published",
            "press_releases_count": 2,
        },
    )

    assert section.confidence > 0.0
    assert "Section generation failed" not in " ".join(section.content)
    assert any("March 2026" in line for line in section.content)


def test_create_fallback_section_uses_deterministic_contact_information_when_enabled():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {"core_information"}
    generator.deterministic_fallback_section_ids = {"contact_information"}
    generator.section_templates = {
        "contact_information": {
            "description": "Contact details and locations",
        }
    }

    section = generator._create_fallback_section(
        "contact_information",
        "haiku",
        entity_data={
            "entity_name": "FIBA",
            "official_site_url": "https://www.fiba.basketball/en",
            "entity_country": "Switzerland",
        },
    )

    assert section.confidence > 0.0
    assert "Section generation failed" not in " ".join(section.content)
    assert any("https://www.fiba.basketball/en" in line for line in section.content)


def test_create_fallback_section_uses_deterministic_outreach_strategy_when_enabled():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {"core_information"}
    generator.deterministic_fallback_section_ids = {"outreach_strategy"}
    generator.section_templates = {
        "outreach_strategy": {
            "description": "Outreach strategy with conversation trees",
        }
    }

    section = generator._create_fallback_section(
        "outreach_strategy",
        "sonnet",
        entity_data={
            "entity_name": "FIBA",
            "entity_type": "FEDERATION",
            "entity_country": "Switzerland",
        },
    )

    assert section.confidence > 0.0
    assert "Section generation failed" not in " ".join(section.content)
    assert any("outreach" in line.lower() or "contact" in line.lower() for line in section.content)


def test_collect_section_quality_issues_detects_meta_and_placeholder_leaks():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {"current_performance"}
    generator.strict_numeric_claim_source_required = True

    section_data = {
        "content": [
            "Constraints:** No markdown, extra text, or invalid JSON.",
            "Item 1: Add growth assumptions.",
            "5B annual views expected.",
        ]
    }

    issues = generator._collect_section_quality_issues("current_performance", section_data)
    assert "meta_text_leak" in issues
    assert "placeholder_text" in issues
    assert "numeric_claim_without_source" in issues


def test_collect_section_quality_issues_rejects_schema_instruction_leakage():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {"current_performance"}
    generator.strict_numeric_claim_source_required = True

    section_data = {
        "content": [
            "The JSON must have specific keys: `content`, `metrics`, `insights`, `recommendations`, `confidence`.",
            "`confidence` is a number between 0-1.",
        ]
    }

    issues = generator._collect_section_quality_issues("current_performance", section_data)
    assert "meta_text_leak" in issues


def test_collect_section_quality_issues_requires_named_leadership_roles():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {"leadership"}
    generator.strict_numeric_claim_source_required = True

    section_data = {
        "content": [
            "Leadership focuses on digital growth [evidence_level=inferred; source_type=internal_analysis; last_verified_at=2026-03-10; needs_review=true]"
        ]
    }

    issues = generator._collect_section_quality_issues("leadership", section_data)
    assert "leadership_missing_named_roles" in issues


def test_collect_section_quality_issues_requires_dated_recent_news():
    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_ids = {"recent_news"}
    generator.strict_numeric_claim_source_required = True

    section_data = {
        "content": [
            "FIBA announced expanded 24-team format up from previous 24-team structure [evidence_level=verified; source_type=news; last_verified_at=unknown; needs_review=true]"
        ]
    }

    issues = generator._collect_section_quality_issues("recent_news", section_data)
    assert "recent_news_missing_dated_facts" in issues
    assert "recent_news_self_contradiction" in issues


def test_resolve_sdk_variant_detects_legacy_and_functional_layouts():
    class _LegacyClient:
        pass

    legacy_module = SimpleNamespace(BrightDataClient=_LegacyClient)
    functional_module = SimpleNamespace(scrape_url_async=lambda *args, **kwargs: None)

    legacy_variant, _ = BrightDataSDKClient._resolve_sdk_variant(legacy_module)
    functional_variant, _ = BrightDataSDKClient._resolve_sdk_variant(functional_module)

    assert legacy_variant == "legacy_client"
    assert functional_variant == "functional_api"


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
    generator.section_json_repair_attempt = True
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
    generator.section_json_repair_attempt = True
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


@pytest.mark.asyncio
async def test_generate_section_repairs_prompt_echo_response_with_json_retry():
    class _FakeClaude:
        def __init__(self):
            self.calls = 0

        async def query(self, prompt, model, max_tokens):
            self.calls += 1
            if self.calls == 1:
                return {"content": "1. **Analyze the Request:** this is instruction echo, not section output."}
            return {"content": "{\"content\":[\"Recovered section content\"],\"confidence\":0.82}"}

    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.claude_client = _FakeClaude()
    generator.section_max_tokens_cap = 0
    generator.section_parallelism = 1
    generator.section_json_repair_attempt = True
    generator.deterministic_fallback_section_ids = set()
    generator.section_templates = {
        "core_information": {
            "model": "haiku",
            "prompt_template": "core_info_template",
            "max_tokens": 1200,
            "description": "Basic entity information",
        }
    }

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "FIBA"},
        model="haiku",
    )

    assert section.content == ["Recovered section content"]
    assert section.confidence == 0.82
    assert generator.claude_client.calls == 2


@pytest.mark.asyncio
async def test_generate_section_strict_qa_regenerates_on_invalid_current_performance():
    class _FakeClaude:
        def __init__(self):
            self.calls = 0

        async def query(self, prompt, model, max_tokens):
            self.calls += 1
            if self.calls == 1:
                return {
                    "content": json.dumps(
                        {
                            "content": [
                                "Constraints:** No markdown. Option A only.",
                                "5B+ annual content views",
                            ],
                            "metrics": [],
                            "insights": [],
                            "recommendations": [],
                            "confidence": 0.9,
                        }
                    )
                }
            return {
                "content": json.dumps(
                    {
                        "content": [
                            "Revenue grew 7% as of 2025-12-31 (official annual report) [evidence_level=verified; source_type=official; last_verified_at=2026-03-01; needs_review=false]"
                        ],
                        "metrics": [{"label": "Revenue growth", "value": "7%"}],
                        "insights": [],
                        "recommendations": [],
                        "confidence": 0.76,
                    }
                )
            }

    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.claude_client = _FakeClaude()
    generator.section_max_tokens_cap = 0
    generator.section_parallelism = 1
    generator.section_json_repair_attempt = True
    generator.strict_section_qa_enabled = True
    generator.strict_section_qa_max_attempts = 2
    generator.strict_section_qa_ids = {"current_performance"}
    generator.strict_numeric_claim_source_required = True
    generator.section_templates = {
        "current_performance": {
            "model": "haiku",
            "prompt_template": "performance_data_template",
            "max_tokens": 1200,
            "description": "Current performance metrics",
        }
    }

    section = await generator._generate_section(
        section_id="current_performance",
        entity_data={"entity_name": "FIBA"},
        model="haiku",
    )

    assert generator.claude_client.calls == 2
    assert "Revenue grew 7%" in section.content[0]


@pytest.mark.asyncio
async def test_generate_sections_parallel_falls_back_when_json_repair_fails():
    class _FakeClaude:
        async def query(self, prompt, model, max_tokens):
            return {"content": "Please review the request context and produce output."}

    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.claude_client = _FakeClaude()
    generator.section_max_tokens_cap = 0
    generator.section_parallelism = 1
    generator.section_json_repair_attempt = True
    generator.deterministic_fallback_section_ids = set()
    generator.section_templates = {
        "core_information": {
            "model": "haiku",
            "prompt_template": "core_info_template",
            "max_tokens": 1200,
            "description": "Basic entity information",
        }
    }

    sections = await generator._generate_sections_parallel(
        section_ids=["core_information"],
        entity_data={"entity_name": "FIBA"},
        model="haiku",
    )

    assert len(sections) == 1
    assert sections[0].content == ["Section generation failed. Please try again later."]
    assert sections[0].confidence == 0.0


@pytest.mark.asyncio
async def test_generate_section_uses_heuristic_when_json_repair_still_unstructured():
    class _FakeClaude:
        def __init__(self):
            self.calls = 0

        async def query(self, prompt, model, max_tokens):
            self.calls += 1
            if self.calls == 1:
                return {"content": "Analyze the request and return JSON."}
            return {
                "content": (
                    "Please review the request context.\n"
                    "FIBA is headquartered in Mies, Switzerland.\n"
                    "The official website is https://www.fiba.basketball/en."
                )
            }

    generator = EntityDossierGenerator.__new__(EntityDossierGenerator)
    generator.claude_client = _FakeClaude()
    generator.section_max_tokens_cap = 0
    generator.section_parallelism = 1
    generator.section_json_repair_attempt = True
    generator.section_templates = {
        "core_information": {
            "model": "haiku",
            "prompt_template": "core_info_template",
            "max_tokens": 1200,
            "description": "Basic entity information",
        }
    }

    section = await generator._generate_section(
        section_id="core_information",
        entity_data={"entity_name": "FIBA"},
        model="haiku",
    )

    assert section.confidence > 0.0
    assert any("FIBA is headquartered" in item for item in section.content)
    assert generator.claude_client.calls == 2
