import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

backend_dir = Path(__file__).resolve().parent.parent
scripts_dir = backend_dir.parent / "scripts"
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(scripts_dir))

import run_v5_two_entity_smoke as smoke


class _FakePipeline:
    def __init__(self):
        self.calls = []

    async def run_pipeline(self, **kwargs):
        self.calls.append(kwargs)
        entity_id = kwargs["entity_id"]
        if entity_id == "major-league-cricket":
            return {
                "entity_id": entity_id,
                "entity_name": kwargs["entity_name"],
                "final_confidence": 0.72,
                "signals_validated_count": 1,
                "acceptance_gate": {"passed": True},
                "dual_write_ok": True,
                "run_report_path": f"/tmp/{entity_id}_run_report.json",
            }
        return {
            "entity_id": entity_id,
            "entity_name": kwargs["entity_name"],
            "final_confidence": 0.41,
            "signals_validated_count": 0,
            "acceptance_gate": {"passed": False},
            "dual_write_ok": True,
            "run_report_path": f"/tmp/{entity_id}_run_report.json",
        }

    async def close(self):
        return None


@pytest.mark.asyncio
async def test_two_entity_smoke_writes_summary(tmp_path, monkeypatch):
    fake_pipeline = _FakePipeline()
    monkeypatch.setattr(smoke, "FixedDossierFirstPipeline", lambda: fake_pipeline)

    output_path = tmp_path / "two_entity_smoke.json"
    rc = await smoke.run_smoke(smoke.DEFAULT_TWO_ENTITY_BATCH, output_path)

    assert rc == 0
    payload = json.loads(output_path.read_text())
    assert payload["entities_total"] == 2
    assert payload["entities_completed"] == 2
    assert payload["entities_failed"] == 0
    assert payload["entities_with_validated_signals"] == 1
    assert payload["entities_acceptance_passed"] == 1
    assert payload["entities"][0]["entity_id"] == "major-league-cricket"
    assert payload["entities"][1]["entity_id"] == "international-canoe-federation"
