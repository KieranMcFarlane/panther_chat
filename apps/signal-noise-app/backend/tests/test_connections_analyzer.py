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


def test_connections_analyzer_prefers_buyer_touching_direct_route_over_support_bridge():
    target_personnel = [
        analyzer.TargetPerson(
            entity_id="arsenal-fc",
            person_name="Juliet Slot",
            role="Chief Commercial Officer",
            decision_score=0.95,
            q11_score=0.95,
            path_type="primary_owner_of",
            recommended_yp_owner="Elliott Hillman",
            mutual_connections_yp="Elliott Hillman",
            count_second_degree_paths=1,
        ),
        analyzer.TargetPerson(
            entity_id="arsenal-fc",
            person_name="Omar Shaikh",
            role="Chief Financial Officer",
            decision_score=0.35,
            q11_score=0.35,
            path_type="supports",
            recommended_yp_owner="Stuart Cope",
        ),
    ]
    bridge_contacts = [
        analyzer.BridgeContact(
            contact_name="David Eames",
            relationship_to_yp="Stuart Cope",
            network_reach="Commercial partnerships",
            introduction_capability="Warm support-side intro",
        )
    ]
    yp_team_data = [
        {
            "yp_name": "Elliott Hillman",
            "direct_connections": 1,
            "mutual_connections": ["Juliet Slot"],
            "success_probability": 72.0,
            "target_person": "Juliet Slot",
            "target_role": "Chief Commercial Officer",
            "path_type": "direct_connection",
            "buyer_relevance": "decision_owner",
            "route_confidence": 0.92,
            "decision_score": 0.95,
            "q11_score": 0.95,
        },
        {
            "yp_name": "Stuart Cope",
            "direct_connections": 0,
            "mutual_connections": [],
            "success_probability": 35.0,
            "target_person": "Omar Shaikh",
            "target_role": "Chief Financial Officer",
            "path_type": "bridge_connection",
            "buyer_relevance": "support_stakeholder",
            "route_confidence": 0.44,
            "decision_score": 0.35,
            "q11_score": 0.35,
        },
    ]

    result = analyzer.ConnectionsAnalyzer().analyze_connections(
        entity_id="arsenal-fc",
        entity_name="Arsenal Football Club",
        target_personnel=target_personnel,
        bridge_contacts=bridge_contacts,
        yp_team_data=yp_team_data,
    )

    assert result.recommended_approach["yp_member"] == "Elliott Hillman"
    assert result.recommended_approach["target_person"] == "Juliet Slot"
    assert result.recommended_approach["buyer_relevance"] == "decision_owner"
    assert result.recommended_approach["introduction_path"] == "Direct (warm)"
    assert result.recommended_approach["route_confidence"] >= 0.9


def test_connections_analyzer_prefers_enrichment_direct_edge_over_generic_bridge_from_question_first_dossier(tmp_path):
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
                                {"node_id": "person:juliet-slot", "node_type": "person", "name": "Juliet Slot", "title": "Chief Commercial Officer"},
                                {"node_id": "person:omar-shaikh", "node_type": "person", "name": "Omar Shaikh", "title": "Chief Financial Officer"},
                            ],
                            "edges": [
                                {"from_id": "arsenal-fc", "to_id": "person:juliet-slot", "edge_type": "primary_owner_of"},
                                {"from_id": "arsenal-fc", "to_id": "person:omar-shaikh", "edge_type": "supports"},
                            ],
                        },
                        "connections_graph": {
                            "schema_version": "connections_graph_v1",
                            "nodes": [
                                {"node_id": "Elliott Hillman", "node_type": "yp_member", "name": "Elliott Hillman"},
                                {"node_id": "Stuart Cope", "node_type": "yp_member", "name": "Stuart Cope"},
                                {"node_id": "person:juliet-slot", "node_type": "person", "name": "Juliet Slot", "title": "Chief Commercial Officer"},
                                {"node_id": "person:omar-shaikh", "node_type": "person", "name": "Omar Shaikh", "title": "Chief Financial Officer"},
                                {"node_id": "bridge:david-eames", "node_type": "bridge_contact", "name": "David Eames", "relationship_to_yp": "Stuart Cope", "introduction_capability": "Warm support intro"},
                            ],
                            "edges": [
                                {"from_id": "Elliott Hillman", "to_id": "person:juliet-slot", "edge_type": "direct_connection", "confidence": 78.0},
                                {"from_id": "Stuart Cope", "to_id": "bridge:david-eames", "edge_type": "bridge_connection", "confidence": 52.0, "to_label": "David Eames"},
                                {"from_id": "bridge:david-eames", "to_id": "person:omar-shaikh", "edge_type": "bridge_to_target", "confidence": 55.0},
                            ],
                        },
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    result = analyzer.analyze_connections_from_question_first_dossier(str(dossier_path))

    assert result.recommended_approach["yp_member"] == "Elliott Hillman"
    assert result.recommended_approach["target_person"] == "Juliet Slot"
    assert result.recommended_approach["buyer_relevance"] == "decision_owner"
    assert result.recommended_approach["verification_needed"]
    assert all(item.yp_member["yp_name"] != "Gunjan Parikh" for item in result.primary_connections)
