import sys
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
