import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).resolve().parent.parent
scripts_dir = backend_dir.parent / "scripts"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(scripts_dir))

import brightdata_mcp_fact_smoke as smoke


class _FakeBrightDataMCPClient:
    def __init__(self, *args, **kwargs):
        self.closed = False

    async def prewarm(self, timeout=None):
        return {"status": "success", "prewarmed": True, "timeout": timeout}

    async def search_engine(self, query, engine="google"):
        return {
            "status": "success",
            "results": [
                {
                    "title": "OpenAI",
                    "url": "https://openai.com/",
                    "snippet": "OpenAI is an AI research organization.",
                }
            ],
        }

    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": "Arsenal were founded in 1886.",
            "metadata": {"word_count": 5, "source": "mcp_client"},
        }

    async def close(self):
        self.closed = True


class _FakeClaudeClient:
    async def query(self, **kwargs):
        return {
            "content": json.dumps(
                {
                    "answer": "1886",
                    "confidence": 1.0,
                    "evidence_url": "https://en.wikipedia.org/wiki/Arsenal_F.C.",
                }
            ),
            "structured_output": {
                "answer": "1886",
                "confidence": 1.0,
                "evidence_url": "https://en.wikipedia.org/wiki/Arsenal_F.C.",
            },
            "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
            "tokens_used": {"total_tokens": 10},
            "stop_reason": "stop",
            "provider": "chutes_openai",
        }


@pytest.mark.asyncio
async def test_fact_smoke_report_separates_search_scrape_and_answer(tmp_path, monkeypatch):
    monkeypatch.setattr(smoke, "BrightDataMCPClient", _FakeBrightDataMCPClient)
    monkeypatch.setattr(smoke, "ClaudeClient", _FakeClaudeClient)

    output_path = tmp_path / "report.json"
    rc = await smoke.run_smoke(
        "Arsenal founded",
        "https://en.wikipedia.org/wiki/Arsenal_F.C.",
        output_path,
        "When was Arsenal founded?",
    )
    assert rc == 0

    report = json.loads(output_path.read_text())
    assert report["retrieval"]["search_hit"] is True
    assert report["retrieval"]["scrape_used"] is True
    assert report["retrieval"]["scrape_source"] == "search_result[0]"
    assert report["reasoning"]["final_answer"] == "1886"
    assert report["reasoning"]["evidence_url"] == "https://en.wikipedia.org/wiki/Arsenal_F.C."
