import json
import sys
from pathlib import Path

import pytest

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import question_first_dossier_runner as runner


class _FakeConnectionsEnricher:
    async def enrich(self, *, connections_graph, poi_graph, entity_name):
        enriched = dict(connections_graph)
        enriched["edges"] = list(connections_graph.get("edges") or []) + [
            {
                "from_id": "Elliott Hillman",
                "to_id": "person:alberto-muti",
                "edge_type": "direct_connection",
                "confidence": 72.0,
            }
        ]
        return enriched


@pytest.mark.asyncio
async def test_run_question_first_dossier_from_payload_applies_connections_graph_enrichment(tmp_path):
    artifact_path = tmp_path / "icf_question_first_run_v1.json"
    artifact_path.write_text(
        json.dumps(
            {
                "schema_version": "question_first_run_v1",
                "generated_at": "2026-04-06T00:00:00+00:00",
                "run_started_at": "2026-04-06T00:00:00+00:00",
                "source": "opencode_agentic_batch",
                "status": "ready",
                "warnings": [],
                "entity": {
                    "entity_id": "international-canoe-federation",
                    "entity_name": "International Canoe Federation",
                    "entity_type": "SPORT_FEDERATION",
                },
                "preset": "icf",
                "question_source_path": "backend/data/question_sources/icf_atomic_matrix.json",
                "questions": [],
                "answers": [
                    {
                        "question_id": "q4",
                        "entity_id": "international-canoe-federation",
                        "entity_name": "International Canoe Federation",
                        "question_type": "decision_owner",
                        "signal_type": "DECISION_OWNER",
                        "answer": "Alberto Muti",
                        "confidence": 0.92,
                        "validation_state": "validated",
                        "evidence_url": "https://example.com/alberto-muti",
                        "primary_owner": {
                            "name": "Alberto Muti",
                            "title": "Secretary General",
                            "organization": "International Canoe Federation",
                        },
                    }
                ],
                "evidence_items": [],
                "promotion_candidates": [],
                "poi_graph": {"schema_version": "poi_graph_v1", "nodes": [], "edges": []},
                "categories": [],
                "run_rollup": {},
                "merge_patch": {"metadata": {}, "question_first": {}, "questions": []},
            }
        ),
        encoding="utf-8",
    )

    result = await runner.run_question_first_dossier_from_payload(
        source_payload={"entity_id": "international-canoe-federation", "entity_name": "International Canoe Federation"},
        question_first_run_path=artifact_path,
        connections_graph_enricher=_FakeConnectionsEnricher(),
    )

    edge_types = {
        (edge["from_id"], edge["edge_type"], edge["to_id"])
        for edge in result["connections_graph"]["edges"]
    }
    assert ("Elliott Hillman", "direct_connection", "person:alberto-muti") in edge_types
