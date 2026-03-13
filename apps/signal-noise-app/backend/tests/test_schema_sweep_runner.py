import json
import sys
from pathlib import Path

import pytest


backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))


from schema_first_pilot import FieldConfig
import schema_sweep_runner as sweep


class FakeBrightDataClient:
    def __init__(self, *, search_rows=None, scrape_map=None):
        self.search_rows = search_rows or []
        self.scrape_map = scrape_map or {}
        self.search_calls = []
        self.scrape_calls = []

    async def search_engine(self, *, query, engine, num_results, country="us"):
        self.search_calls.append(
            {
                "query": query,
                "engine": engine,
                "num_results": num_results,
                "country": country,
            }
        )
        return {"status": "success", "results": list(self.search_rows)}

    async def scrape_as_markdown(self, url):
        self.scrape_calls.append(url)
        content = self.scrape_map.get(url, "")
        return {
            "status": "success",
            "content": content,
            "metadata": {"word_count": len(content.split())},
        }


def _read_jsonl(path: Path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


@pytest.mark.asyncio
async def test_schema_sweep_verifies_field_and_writes_step_logs(tmp_path):
    client = FakeBrightDataClient(
        search_rows=[
            {
                "title": "What we do | About FIBA",
                "url": "https://about.fiba.basketball/en/organization/what-we-do",
            }
        ],
        scrape_map={
            "https://about.fiba.basketball/en/organization/what-we-do": (
                "FIBA was founded in 1932 and is headquartered in Mies, Switzerland."
            )
        },
    )

    result = await sweep.run_schema_sweep(
        entity_name="FIBA",
        entity_id="fiba",
        entity_type="FEDERATION",
        output_dir=str(tmp_path),
        field_names=["founded_year"],
        brightdata_client=client,
    )

    assert result["run_mode"] == "schema_sweep_single_pass"
    assert result["fields"]["founded_year"]["value"] == "1932"
    assert result["fields"]["founded_year"]["status"] == "verified"
    assert result["field_traces"][0]["status"] == "verified"

    step_log_path = Path(result["step_log_path"])
    assert step_log_path.exists()
    rows = _read_jsonl(step_log_path)
    assert any(row["action"] == "search_engine" and row["cache_hit"] is False for row in rows)
    assert any(row["action"] == "scrape_url" and row["cache_hit"] is False for row in rows)


@pytest.mark.asyncio
async def test_schema_sweep_uses_query_and_scrape_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(
        sweep,
        "_default_field_configs",
        lambda _name, _type: [
            FieldConfig(name="official_site", queries=["fiba official website"]),
            FieldConfig(name="founded_year", queries=["fiba official website"]),
        ],
    )
    client = FakeBrightDataClient(
        search_rows=[
            {"title": "FIBA", "url": "https://www.fiba.basketball/en"},
        ],
        scrape_map={
            "https://www.fiba.basketball/en": "FIBA was founded in 1932.",
        },
    )

    result = await sweep.run_schema_sweep(
        entity_name="FIBA",
        entity_id="fiba",
        entity_type="FEDERATION",
        output_dir=str(tmp_path),
        brightdata_client=client,
    )

    assert len(client.search_calls) == 1
    assert len(client.scrape_calls) == 1

    rows = _read_jsonl(Path(result["step_log_path"]))
    assert any(row["action"] == "search_engine" and row["cache_hit"] is True for row in rows)
    assert any(row["action"] == "scrape_url" and row["cache_hit"] is True for row in rows)


@pytest.mark.asyncio
async def test_schema_sweep_marks_field_inconclusive_after_budget(tmp_path):
    client = FakeBrightDataClient(
        search_rows=[
            {"title": "FIBA homepage", "url": "https://www.fiba.basketball/en"},
        ],
        scrape_map={
            "https://www.fiba.basketball/en": "Welcome to FIBA. Basketball for good.",
        },
    )

    result = await sweep.run_schema_sweep(
        entity_name="FIBA",
        entity_id="fiba",
        entity_type="FEDERATION",
        output_dir=str(tmp_path),
        field_names=["founded_year"],
        max_hops_per_field=1,
        brightdata_client=client,
    )

    assert result["fields"]["founded_year"]["status"] == "inconclusive"
    assert result["fields"]["founded_year"]["value"] is None
    assert "founded_year" in result["unanswered_fields"]
