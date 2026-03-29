import asyncio
import json
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import question_first_dossier_runner as runner


class _FakeBrightDataClient:
    def __init__(self):
        self.queries = []

    async def search_engine(self, query, engine="google", country="us", num_results=10, cursor=None):
        self.queries.append(query)
        if "Leeds United" in query:
            return {
                "status": "success",
                "results": [
                    {
                        "title": "Leeds United",
                        "url": "https://www.leedsunited.com/",
                        "snippet": "Leeds United official site",
                    }
                ],
            }
        return {"status": "success", "results": []}

    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": "Leeds United were founded in 1919 and play at Elland Road.",
            "metadata": {"word_count": 11, "source": "mcp_client"},
        }


class _FakeClaudeClient:
    async def query(self, **kwargs):
        return {
            "content": json.dumps(
                {
                    "answer": "1919",
                    "confidence": 0.91,
                    "evidence_url": "https://www.leedsunited.com/",
                }
            ),
            "structured_output": {
                "answer": "1919",
                "confidence": 0.91,
                "evidence_url": "https://www.leedsunited.com/",
            },
            "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
            "tokens_used": {"total_tokens": 10},
            "stop_reason": "stop",
            "provider": "chutes_openai",
        }


@pytest.mark.asyncio
async def test_question_first_runner_uses_saved_questions_and_writes_plain_text_report(tmp_path):
    dossier_path = tmp_path / "leeds_dossier.json"
    dossier_path.write_text(
        json.dumps(
            {
                "entity_id": "leedsunited",
                "entity_name": "Leeds United",
                "tier": "PREMIUM",
                "questions": [
                    {
                        "question_id": "q1",
                        "section_id": "core_information",
                        "question_text": "When was Leeds United founded?",
                        "search_strategy": {
                            "search_queries": ["\"Leeds United\" founded"],
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    brightdata = _FakeBrightDataClient()
    claude = _FakeClaudeClient()
    output_dir = tmp_path / "out"

    result = await runner.run_question_first_dossier(
        question_source_path=dossier_path,
        output_dir=output_dir,
        brightdata_client=brightdata,
        claude_client=claude,
    )

    assert result["entity_name"] == "Leeds United"
    assert result["questions_answered"] == 1
    assert result["answers"][0]["answer"] == "1919"
    assert result["answers"][0]["search_hit"] is True
    assert result["answers"][0]["search_query"] == '"Leeds United" founded'

    json_report = output_dir / "leedsunited_question_first_dossier.json"
    txt_report = output_dir / "leedsunited_question_first_dossier.txt"
    assert json_report.exists()
    assert txt_report.exists()
    assert "When was Leeds United founded?" in txt_report.read_text()
    assert "1919" in txt_report.read_text()


@pytest.mark.asyncio
async def test_question_first_runner_groups_by_category_and_retries_on_empty_search(tmp_path):
    dossier_path = tmp_path / "leeds_dossier.json"
    dossier_path.write_text(
        json.dumps(
            {
                "entity_id": "leedsunited",
                "entity_name": "Leeds United",
                "tier": "PREMIUM",
                "questions": [
                    {
                        "question_id": "q1",
                        "section_id": "core_information",
                        "question_text": "When was Leeds United founded?",
                        "search_strategy": {"search_queries": ["\"Leeds United\" founded"]},
                    },
                    {
                        "question_id": "q2",
                        "section_id": "leadership",
                        "question_text": "Who is the current chairman of Leeds United?",
                        "search_strategy": {"search_queries": ["\"Leeds United\" chairman"]},
                    },
                ],
            }
        ),
        encoding="utf-8",
    )

    class RetryBrightDataClient(_FakeBrightDataClient):
        async def search_engine(self, query, engine="google", country="us", num_results=10, cursor=None):
            self.queries.append(query)
            if len(self.queries) == 1:
                return {"status": "success", "results": []}
            if "chairman" in query.lower():
                return {
                    "status": "success",
                    "results": [
                        {
                            "title": "Leeds United chairman",
                            "url": "https://www.leedsunited.com/",
                            "snippet": "Chairman information on the official site",
                        }
                    ],
                }
            return {
                "status": "success",
                "results": [
                    {
                        "title": "Leeds United",
                        "url": "https://www.leedsunited.com/",
                        "snippet": "Leeds United official site",
                    }
                ],
            }

    class RetryClaudeClient(_FakeClaudeClient):
        async def query(self, **kwargs):
            prompt = kwargs.get("prompt", "")
            question_line = ""
            for line in prompt.splitlines():
                if line.startswith("Question:"):
                    question_line = line.lower()
                    break
            if "founded" in question_line:
                return {
                    "content": json.dumps(
                        {
                            "answer": "1919",
                            "confidence": 0.91,
                            "evidence_url": "https://www.leedsunited.com/",
                        }
                    ),
                    "structured_output": {
                        "answer": "1919",
                        "confidence": 0.91,
                        "evidence_url": "https://www.leedsunited.com/",
                    },
                    "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
                    "tokens_used": {"total_tokens": 10},
                    "stop_reason": "stop",
                    "provider": "chutes_openai",
                }
            if "chairman" in question_line:
                return {
                    "content": json.dumps(
                        {
                            "answer": "Chairman answer",
                            "confidence": 0.88,
                            "evidence_url": "https://www.leedsunited.com/",
                        }
                    ),
                    "structured_output": {
                        "answer": "Chairman answer",
                        "confidence": 0.88,
                        "evidence_url": "https://www.leedsunited.com/",
                    },
                    "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
                    "tokens_used": {"total_tokens": 10},
                    "stop_reason": "stop",
                    "provider": "chutes_openai",
                }
            return {
                "content": json.dumps(
                    {
                        "answer": "Chairman answer",
                        "confidence": 0.88,
                        "evidence_url": "https://www.leedsunited.com/",
                    }
                ),
                "structured_output": {
                    "answer": "Chairman answer",
                    "confidence": 0.88,
                    "evidence_url": "https://www.leedsunited.com/",
                },
                "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
                "tokens_used": {"total_tokens": 10},
                "stop_reason": "stop",
                "provider": "chutes_openai",
            }

    brightdata = RetryBrightDataClient()
    claude = RetryClaudeClient()
    output_dir = tmp_path / "out"

    result = await runner.run_question_first_dossier(
        question_source_path=dossier_path,
        output_dir=output_dir,
        brightdata_client=brightdata,
        claude_client=claude,
        max_questions=2,
    )

    assert result["categories"][0]["category"] == "identity"
    assert any(cat["category"] == "leadership" for cat in result["categories"])
    assert len(result["answers"][0]["search_attempts"]) == 2
    assert result["answers"][0]["answer"] == "1919"
    assert result["answers"][1]["answer"] == "Chairman answer"
    assert result["answers"][1]["search_hit"] is True
    assert result["answers"][1]["search_query"] == '"Leeds United" chairman'
