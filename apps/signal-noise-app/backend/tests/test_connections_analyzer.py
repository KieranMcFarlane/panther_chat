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
