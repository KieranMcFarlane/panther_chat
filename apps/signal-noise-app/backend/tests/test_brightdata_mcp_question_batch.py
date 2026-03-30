import asyncio
import json
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
scripts_dir = backend_dir.parent / "scripts"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(scripts_dir))

import brightdata_mcp_question_batch as batch


def test_build_question_records_uses_premium_questions_and_service_queries():
    records = batch.build_question_records(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        max_questions=2,
    )

    assert len(records) == 2
    first = records[0]

    assert first["question_id"] == "sl_league_mobile_app"
    assert first["question_text"] == "What evidence in the last 180 days shows Major League Cricket is planning or updating a league mobile app?"
    assert len(first["query_plan"]) == 1
    assert first["query_plan"][0]["kind"] == "direct_question_query"
    assert first["query_plan"][0]["query"] == '"Major League Cricket" RFP tender procurement'
    assert first["recovery_query_plan"] == []
    assert first["agentic_plan"]["source_priority"][0] == "google_serp"
    assert "stop after the first direct pass" in first["agentic_plan"]["stop_rule"]
    assert first["hypothesis"]["metadata"]["yp_service_fit"] == ["MOBILE_APPS", "FAN_ENGAGEMENT"]


def test_build_question_records_selects_one_best_search_question():
    records = batch.build_question_records(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        max_questions=1,
    )

    assert len(records[0]["query_plan"]) == 1
    assert records[0]["query_plan"][0]["query"] == '"Major League Cricket" RFP tender procurement'
    assert records[0]["query_plan"][0]["priority"] == 0
    assert records[0]["recovery_query_plan"] == []


def test_build_question_records_can_enable_agentic_recovery():
    records = batch.build_question_records(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        max_questions=1,
        agentic_recovery=True,
    )

    assert len(records[0]["recovery_query_plan"]) == 2
    assert records[0]["recovery_query_plan"][0]["kind"] == "recovery_linkedin_query"
    assert "LinkedIn" in records[0]["recovery_query_plan"][0]["query"]
    assert "continue to recovery queries" in records[0]["agentic_plan"]["stop_rule"]


def test_foundation_question_uses_official_site_priority():
    foundation = batch._build_foundation_question_record(  # type: ignore[attr-defined]
        "Major League Cricket",
        "major-league-cricket",
        "SPORT_LEAGUE",
    )

    assert foundation["agentic_plan"]["source_priority"][:3] == [
        "google_serp",
        "official_site",
        "wikipedia",
    ]
    assert "linkedin_posts" not in foundation["agentic_plan"]["source_priority"]


def test_poi_question_records_cover_five_contact_targets():
    records = batch.build_poi_question_records(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        max_questions=5,
    )

    assert len(records) == 5
    assert [record["question_type"] for record in records] == ["poi"] * 5
    assert records[0]["question_id"] == "poi_commercial_partnerships_lead"
    assert records[1]["question_id"] == "poi_digital_product_lead"
    assert records[2]["question_id"] == "poi_fan_engagement_lead"
    assert records[3]["question_id"] == "poi_marketing_comms_lead"
    assert records[4]["question_id"] == "poi_operations_lead"
    assert records[0]["agentic_plan"]["source_priority"][:5] == [
        "linkedin_company_profile",
        "linkedin_people_search",
        "linkedin_person_profile",
        "google_serp",
        "official_site",
    ]
    assert records[0]["query_plan"][0]["query"] == '"Major League Cricket" LinkedIn company profile'
    assert records[0]["query_plan"][1]["query"] == '"Major League Cricket" LinkedIn commercial partnerships business development'
    assert records[0]["recovery_query_plan"][0]["query"] == '"Major League Cricket" chief commercial officer'
    assert records[0]["recovery_query_plan"][-1]["query"] == '"Major League Cricket" managing director'


def test_build_major_league_cricket_preset_returns_foundation_procurement_and_pois():
    records = batch.build_preset_question_records(
        preset="major-league-cricket",
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
    )

    assert len(records) == 7
    assert [record["question_type"] for record in records] == ["foundation", "procurement", "poi", "poi", "poi", "poi", "poi"]
    assert records[0]["question_id"] == "entity_founded_year"
    assert records[1]["question_id"] == "sl_league_mobile_app"
    assert records[2]["question_id"] == "poi_commercial_partnerships_lead"


@pytest.mark.asyncio
async def test_run_question_batch_uses_major_league_cricket_preset_bundle(tmp_path, monkeypatch):
    monkeypatch.setattr(batch, "BrightDataMCPClient", _FakeBrightDataMCPClient)

    result = await batch.run_question_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        output_dir=tmp_path,
        preset="major-league-cricket",
        judge_client=_FakeClaudeClient(),
    )

    assert result["questions_total"] == 7
    meta_path = Path(result["meta_result_path"])
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert len(meta["questions"]) == 7
    assert meta["questions"][0]["question_id"] == "entity_founded_year"
    assert meta["questions"][1]["question_id"] == "sl_league_mobile_app"
    assert meta["questions"][2]["question_id"] == "poi_commercial_partnerships_lead"
    assert meta["questions"][-1]["question_id"] == "poi_operations_lead"


def test_rank_search_results_prefers_procurement_hit():
    query = "Major League Cricket RFP tender procurement"
    results = [
        {
            "title": "Major League Cricket",
            "url": "https://www.majorleaguecricket.com/",
            "snippet": "Official league website.",
        },
        {
            "title": "American Cricket Enterprises seeks Digital Transformation ...",
            "url": "https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6",
            "snippet": "ACE issued an RFP for a Digital Transformation Project.",
        },
    ]

    best, ranked = batch.rank_search_results(query, results)

    assert "linkedin.com/posts/majorleaguecricket" in best["url"]
    assert "linkedin.com/posts/majorleaguecricket" in ranked[0]["url"]
    assert ranked[0]["score"] >= ranked[1]["score"]


@pytest.mark.asyncio
async def test_run_question_batch_uses_scrape_batch_for_noisy_results(tmp_path, monkeypatch):
    client = _FakeBrightDataMCPClient()

    async def _search_engine(query, engine="google", country="us", num_results=10, cursor=None):
        return {
            "status": "success",
            "query": query,
            "results": [
                {
                    "title": "Generic procurement portal",
                    "url": "https://example.com/procurement-portal",
                    "snippet": "RFP tender procurement listing.",
                },
                {
                    "title": "American Cricket Enterprises seeks Digital Transformation ...",
                    "url": "https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6",
                    "snippet": "ACE issued an RFP for a Digital Transformation Project.",
                },
            ],
        }

    client.search_engine = _search_engine
    monkeypatch.setattr(batch, "BrightDataMCPClient", lambda *args, **kwargs: client)
    monkeypatch.setattr(batch, "_should_scrape_top_k", lambda *args, **kwargs: True)

    result = await batch.run_question_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        output_dir=tmp_path,
        max_questions=1,
        judge_client=_FakeClaudeClient(),
    )

    assert client.scrape_batch_calls
    assert len(client.scrape_batch_calls[0]) == 2
    meta_path = Path(result["meta_result_path"])
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert len(meta["questions"][0]["scraped_results"]) == 2


def test_build_reasoning_prompt_requests_json_schema():
    prompt = batch.build_reasoning_prompt(
        question_text="Is there an RFP or tender for Major League Cricket?",
        evidence_url="https://www.linkedin.com/posts/majorleaguecricket/example",
        evidence_excerpt="ACE issued an RFP for a Digital Transformation Project.",
    )

    assert "Answer only in JSON" in prompt
    assert "signal_type" in prompt
    assert "confidence" in prompt
    assert "recommended_next_query" in prompt


def test_question_batch_persists_raw_serp_snapshot_in_attempts(tmp_path, monkeypatch):
    monkeypatch.setattr(batch, "BrightDataMCPClient", _FakeBrightDataMCPClient)

    result = asyncio.run(
        batch.run_question_batch(
            entity_type="SPORT_LEAGUE",
            entity_name="Major League Cricket",
            entity_id="major-league-cricket",
            output_dir=tmp_path,
            max_questions=1,
            judge_client=_FakeClaudeClient(),
        )
    )

    meta_path = Path(result["meta_result_path"])
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    attempt = meta["questions"][0]["search_attempts"][0]
    assert "Major League Cricket" in attempt["serp_summary"]
    assert len(attempt["raw_search_results"]) == 2
    assert attempt["raw_search_results"][0]["title"] == "Major League Cricket"
    assert attempt["raw_search_results"][1]["title"].startswith("American Cricket Enterprises seeks")
    assert len(meta["questions"][0]["raw_search_results"]) == 2
    assert "Major League Cricket" in meta["questions"][0]["serp_summary"]


class _FakeBrightDataMCPClient:
    def __init__(self, *args, **kwargs):
        self.closed = False
        self.scrape_batch_calls = []

    async def prewarm(self, timeout=None):
        return {"status": "success", "prewarmed": True, "timeout": timeout}

    async def search_engine(self, query, engine="google", country="us", num_results=10, cursor=None):
        return {
            "status": "success",
            "query": query,
            "results": [
                {
                    "title": "Major League Cricket",
                    "url": "https://www.majorleaguecricket.com/",
                    "snippet": "Official league website.",
                },
                {
                    "title": "American Cricket Enterprises seeks Digital Transformation ...",
                    "url": "https://www.linkedin.com/posts/majorleaguecricket_american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6",
                    "snippet": "ACE issued an RFP for a Digital Transformation Project.",
                },
            ],
        }

    async def scrape_as_markdown(self, url):
        return {
            "status": "success",
            "url": url,
            "content": "ACE issued an RFP for a Digital Transformation Project from Major League Cricket.",
            "metadata": {"word_count": 12, "source": "mcp_client"},
        }

    async def scrape_batch(self, urls):
        self.scrape_batch_calls.append(list(urls))
        return {
            "status": "success",
            "total_urls": len(urls),
            "successful": len(urls),
            "failed": 0,
            "results": [
                {
                    "status": "success",
                    "url": url,
                    "content": "ACE issued an RFP for a Digital Transformation Project from Major League Cricket.",
                }
                for url in urls
            ],
        }

    async def close(self):
        self.closed = True


class _FakeClaudeClient:
    async def query(self, **kwargs):
        return {
            "content": json.dumps(
                {
                    "answer": "Yes, there is an RFP or tender signal.",
                    "signal_type": "RFP",
                    "confidence": 0.9,
                    "validation_state": "validated",
                    "evidence_url": "https://www.linkedin.com/posts/majorleaguecricket/american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6",
                    "recommended_next_query": "Major League Cricket digital transformation procurement",
                    "notes": "ACE issued an RFP for a Digital Transformation Project.",
                }
            ),
            "structured_output": {
                "answer": "Yes, there is an RFP or tender signal.",
                "signal_type": "RFP",
                "confidence": 0.9,
                "validation_state": "validated",
                "evidence_url": "https://www.linkedin.com/posts/majorleaguecricket/american-cricket-enterprises-has-issued-an-activity-7371974338536861696-zCn6",
                "recommended_next_query": "Major League Cricket digital transformation procurement",
                "notes": "ACE issued an RFP for a Digital Transformation Project.",
            },
            "model_used": "deepseek-ai/DeepSeek-V3.2-TEE",
            "tokens_used": {"total_tokens": 10},
            "stop_reason": "stop",
            "provider": "chutes_openai",
        }


@pytest.mark.asyncio
async def test_run_question_batch_persists_question_level_and_rollup_reports(tmp_path, monkeypatch):
    monkeypatch.setattr(batch, "BrightDataMCPClient", _FakeBrightDataMCPClient)

    result = await batch.run_question_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        output_dir=tmp_path,
        max_questions=1,
        judge_client=_FakeClaudeClient(),
    )

    rollup_path = Path(result["rollup_path"])
    transcript_path = Path(result["transcript_path"])
    meta_path = Path(result["meta_result_path"])

    assert rollup_path.exists()
    assert transcript_path.exists()
    assert meta_path.exists()
    assert len(result["question_result_paths"]) == 1
    assert Path(result["question_result_paths"][0]).exists()

    rollup = json.loads(rollup_path.read_text())
    assert rollup["entity_name"] == "Major League Cricket"
    assert rollup["questions_total"] == 1
    assert rollup["questions_validated"] == 1
    assert rollup["questions_no_signal"] == 0

    question_results = json.loads(meta_path.read_text())
    assert len(question_results["questions"]) == 1
    first = question_results["questions"][0]
    assert "linkedin.com/posts/majorleaguecricket" in first["selected_result"]["url"]
    assert first["reasoning"]["structured_output"]["signal_type"] == "RFP"
    assert first["validation_state"] == "validated"
    assert len(first["search_attempts"]) == 1


@pytest.mark.asyncio
async def test_run_question_batch_can_select_a_single_question(tmp_path, monkeypatch):
    monkeypatch.setattr(batch, "BrightDataMCPClient", _FakeBrightDataMCPClient)

    result = await batch.run_question_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        output_dir=tmp_path,
        question_id="sl_league_mobile_app",
        judge_client=_FakeClaudeClient(),
    )

    assert result["questions_total"] == 1
    assert len(result["question_result_paths"]) == 1
    meta_path = Path(result["meta_result_path"])
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert len(meta["questions"]) == 1
    assert meta["questions"][0]["question_id"] == "sl_league_mobile_app"


def test_main_can_merge_existing_question_json_files(tmp_path, monkeypatch, capsys):
    first_question_path = tmp_path / "question_001.json"
    second_question_path = tmp_path / "question_002.json"
    first_question_path.write_text(
        json.dumps(
            {
                "run_started_at": "2026-03-26T00:00:00+00:00",
                "entity_name": "Major League Cricket",
                "entity_id": "major-league-cricket",
                "entity_type": "SPORT_LEAGUE",
                "question": {
                    "question_id": "entity_founded_year",
                    "question_text": "When was Major League Cricket founded?",
                    "validation_state": "validated",
                    "reasoning": {
                        "structured_output": {
                            "answer": "Major League Cricket was founded in 2019.",
                            "signal_type": "FOUNDATION",
                            "confidence": 0.99,
                        }
                    },
                },
            }
        ),
        encoding="utf-8",
    )
    second_question_path.write_text(
        json.dumps(
            {
                "run_started_at": "2026-03-26T00:00:00+00:00",
                "entity_name": "Major League Cricket",
                "entity_id": "major-league-cricket",
                "entity_type": "SPORT_LEAGUE",
                "question": {
                    "question_id": "sl_league_mobile_app",
                    "question_text": "What evidence in the last 180 days shows Major League Cricket is planning or updating a league mobile app?",
                    "validation_state": "validated",
                    "reasoning": {
                        "structured_output": {
                            "answer": "ACE issued an RFP for a Digital Transformation Project.",
                            "signal_type": "RFP",
                            "confidence": 0.9,
                        }
                    },
                },
            }
        ),
        encoding="utf-8",
    )

    output_dir = tmp_path / "out"
    monkeypatch.setattr(
        batch.sys,
        "argv",
        [
            "brightdata_mcp_question_batch.py",
            "--merge-jsons",
            str(first_question_path),
            str(second_question_path),
            "--output-dir",
            str(output_dir),
        ],
    )

    exit_code = batch.main()
    assert exit_code == 0

    stdout = json.loads(capsys.readouterr().out)
    meta_path = Path(stdout["meta_result_path"])
    assert meta_path.exists()
    merged = json.loads(meta_path.read_text(encoding="utf-8"))
    assert len(merged["questions"]) == 2
    assert merged["questions"][0]["question_id"] == "entity_founded_year"
    assert merged["questions"][1]["question_id"] == "sl_league_mobile_app"


def test_main_allows_major_league_cricket_preset_without_entity_args(tmp_path, monkeypatch, capsys):
    captured = {}

    async def _fake_run_question_batch(**kwargs):
        captured.update(kwargs)
        return {
            "questions_total": 7,
            "questions_validated": 0,
            "questions_no_signal": 7,
            "questions_provisional": 0,
            "rollup_path": str(tmp_path / "rollup.json"),
            "meta_result_path": str(tmp_path / "meta.json"),
            "question_result_paths": [],
            "question_results_path": str(tmp_path / "meta.json"),
            "transcript_path": str(tmp_path / "transcript.txt"),
        }

    monkeypatch.setattr(batch, "run_question_batch", _fake_run_question_batch)
    monkeypatch.setattr(
        batch.sys,
        "argv",
        [
            "brightdata_mcp_question_batch.py",
            "--preset",
            "major-league-cricket",
            "--output-dir",
            str(tmp_path / "out"),
        ],
    )

    exit_code = batch.main()
    assert exit_code == 0
    stdout = json.loads(capsys.readouterr().out)
    assert stdout["questions_total"] == 7
    assert captured["entity_name"] == "Major League Cricket"
    assert captured["entity_id"] == "major-league-cricket"
    assert captured["entity_type"] == "SPORT_LEAGUE"
    assert captured["preset"] == "major-league-cricket"


@pytest.mark.asyncio
async def test_run_question_batch_with_foundation_question_can_select_foundation(tmp_path, monkeypatch):
    monkeypatch.setattr(batch, "BrightDataMCPClient", _FakeBrightDataMCPClient)

    result = await batch.run_question_batch(
        entity_type="SPORT_LEAGUE",
        entity_name="Major League Cricket",
        entity_id="major-league-cricket",
        output_dir=tmp_path,
        include_foundation_question=True,
        question_id="entity_founded_year",
        judge_client=_FakeClaudeClient(),
    )

    assert result["questions_total"] == 1
    meta_path = Path(result["meta_result_path"])
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert len(meta["questions"]) == 1
    assert meta["questions"][0]["question_id"] == "entity_founded_year"
