import json
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import connections_analyzer as analyzer


def test_target_personnel_from_poi_graph_converts_people_nodes():
    poi_graph = {
        "schema_version": "poi_graph_v1",
        "entity_id": "arsenal-fc",
        "entity_name": "Arsenal Football Club",
        "nodes": [
            {"node_id": "arsenal-fc", "node_type": "entity", "name": "Arsenal Football Club"},
            {
                "node_id": "person:juliet-slot",
                "node_type": "person",
                "name": "Juliet Slot",
                "title": "Chief Commercial Officer",
                "organization": "Arsenal Football Club",
                "linkedin_url": "https://www.linkedin.com/in/juliet-slot/",
            },
            {
                "node_id": "person:omar-shaikh",
                "node_type": "person",
                "name": "Omar Shaikh",
                "title": "Chief Financial Officer",
                "organization": "Arsenal Football Club",
            },
        ],
        "edges": [
            {"from_id": "arsenal-fc", "to_id": "person:juliet-slot", "edge_type": "primary_owner_of"},
            {"from_id": "arsenal-fc", "to_id": "person:omar-shaikh", "edge_type": "supports"},
        ],
    }

    people = analyzer._target_personnel_from_poi_graph(entity_id="arsenal-fc", poi_graph=poi_graph)

    assert len(people) == 2
    assert people[0].person_name == "Juliet Slot"
    assert people[0].role == "Chief Commercial Officer"
    assert people[0].linkedin_url == "https://www.linkedin.com/in/juliet-slot/"
    assert people[1].person_name == "Omar Shaikh"


def test_analyze_connections_from_question_first_dossier_uses_poi_graph(tmp_path):
    dossier_path = tmp_path / "arsenal-fc_question_first_dossier.json"
    dossier_path.write_text(
        json.dumps(
            {
                "entity_id": "arsenal-fc",
                "entity_name": "Arsenal Football Club",
                "merged_dossier": {
                    "question_first": {
                        "poi_graph": {
                            "schema_version": "poi_graph_v1",
                            "entity_id": "arsenal-fc",
                            "entity_name": "Arsenal Football Club",
                            "nodes": [
                                {"node_id": "arsenal-fc", "node_type": "entity", "name": "Arsenal Football Club"},
                                {
                                    "node_id": "person:juliet-slot",
                                    "node_type": "person",
                                    "name": "Juliet Slot",
                                    "title": "Chief Commercial Officer",
                                    "organization": "Arsenal Football Club",
                                },
                            ],
                            "edges": [
                                {"from_id": "arsenal-fc", "to_id": "person:juliet-slot", "edge_type": "primary_owner_of"},
                            ],
                        }
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    result = analyzer.analyze_connections_from_question_first_dossier(str(dossier_path))

    assert result.entity_id == "arsenal-fc"
    assert result.entity_name == "Arsenal Football Club"
    assert len(result.primary_connections) == 4
    assert result.recommended_approach["yp_member"] == "Stuart Cope"


def test_analyze_connections_from_question_first_dossier_prefers_connections_graph_edges(tmp_path):
    dossier_path = tmp_path / "icf_question_first_dossier.json"
    dossier_path.write_text(
        json.dumps(
            {
                "entity_id": "international-canoe-federation",
                "entity_name": "International Canoe Federation",
                "merged_dossier": {
                    "question_first": {
                        "poi_graph": {
                            "schema_version": "poi_graph_v1",
                            "entity_id": "international-canoe-federation",
                            "entity_name": "International Canoe Federation",
                            "nodes": [
                                {"node_id": "international-canoe-federation", "node_type": "entity", "name": "International Canoe Federation"},
                                {"node_id": "person:alberto-muti", "node_type": "person", "name": "Alberto Muti", "title": "Secretary General"},
                            ],
                            "edges": [
                                {"from_id": "international-canoe-federation", "to_id": "person:alberto-muti", "edge_type": "primary_owner_of"},
                            ],
                        },
                        "connections_graph": {
                            "schema_version": "connections_graph_v1",
                            "nodes": [
                                {"node_id": "Elliott Hillman", "node_type": "yp_member", "name": "Elliott Hillman"},
                                {"node_id": "person:alberto-muti", "node_type": "person", "name": "Alberto Muti", "title": "Secretary General"},
                                {"node_id": "bridge:david-eames", "node_type": "bridge_contact", "name": "David Eames", "relationship_to_yp": "Stuart Cope", "introduction_capability": "Marketing bridge"},
                            ],
                            "edges": [
                                {"from_id": "Elliott Hillman", "to_id": "person:alberto-muti", "edge_type": "direct_connection", "confidence": 72.0},
                                {"from_id": "Stuart Cope", "to_id": "bridge:david-eames", "edge_type": "bridge_connection", "confidence": 42.0, "to_label": "David Eames"},
                            ],
                        },
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    result = analyzer.analyze_connections_from_question_first_dossier(str(dossier_path))

    assert result.entity_id == "international-canoe-federation"
    assert result.recommended_approach["yp_member"] == "Elliott Hillman"
    assert result.recommended_approach["introduction_path"] == "Direct (lukewarm)"
    elliott = next(item for item in result.primary_connections if item.yp_member["yp_name"] == "Elliott Hillman")
    assert elliott.direct_connections == 1
    assert elliott.success_probability >= 70.0
