import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from question_first_promoter import build_question_first_connections_graph, build_question_first_promotions


def test_build_question_first_promotions_emits_promoted_summary_and_filters_weak_candidates():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q1",
                "question_text": "Is there evidence of a ticketing rebuild?",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.88,
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
            },
            {
                "question_id": "q2",
                "question_text": "Who is the current chairman?",
                "answer": "Unknown",
                "confidence": 0.55,
                "validation_state": "provisional",
                "signal_type": "FOUNDATION",
            },
        ],
        evidence_items=[
            {
                "evidence_id": "ev:q1",
                "question_id": "q1",
                "entity_id": "major-league-cricket",
                "signal_type": "PROCUREMENT_SIGNAL",
                "evidence_focus": "opportunity_signal",
                "promotion_target": "opportunity_signals",
                "answer_kind": "signal",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.88,
                "validation_state": "validated",
                "evidence_url": "https://example.com/ticketing",
            },
            {
                "evidence_id": "ev:q2",
                "question_id": "q2",
                "entity_id": "major-league-cricket",
                "signal_type": "FOUNDATION",
                "evidence_focus": "entity_fact",
                "promotion_target": "profile",
                "answer_kind": "fact",
                "answer": "Unknown",
                "confidence": 0.55,
                "validation_state": "provisional",
                "evidence_url": "",
            },
        ],
        promotion_candidates=[
            {
                "candidate_id": "q1:opportunity_signals",
                "question_id": "q1",
                "promotion_target": "opportunity_signals",
                "signal_type": "PROCUREMENT_SIGNAL",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.88,
                "promotion_candidate": True,
            },
            {
                "candidate_id": "q2:profile",
                "question_id": "q2",
                "promotion_target": "profile",
                "signal_type": "FOUNDATION",
                "answer": "Unknown",
                "confidence": 0.55,
                "promotion_candidate": True,
            },
        ],
    )

    assert result["dossier_promotions"][0]["question_id"] == "q1"
    assert result["dossier_promotions"][0]["promotion_target"] == "opportunity_signals"
    assert result["dossier_promotions"][0]["evidence_url"] == "https://example.com/ticketing"
    assert result["discovery_summary"]["promoted_count"] == 1
    assert result["discovery_summary"]["supporting_evidence_count"] == 1
    assert result["discovery_summary"]["promotion_targets"] == ["opportunity_signals"]
    assert result["discovery_summary"]["opportunity_signals"][0]["candidate_id"] == "q1:opportunity_signals"


def test_build_question_first_promotions_derives_evidence_from_validated_answers():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_foundation",
                "question_text": "When was Arsenal Football Club founded?",
                "question_type": "foundation",
                "answer": "1886",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://www.arsenal.com/history",
            },
            {
                "question_id": "q_procurement",
                "question_text": "Is there evidence of a ticketing rebuild?",
                "question_type": "procurement",
                "answer": "The league is replacing its ticketing platform in 2026.",
                "confidence": 0.86,
                "validation_state": "validated",
                "signal_type": "PROCUREMENT_SIGNAL",
                "evidence_url": "https://example.com/ticketing",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
    )

    assert result["discovery_summary"]["promoted_count"] == 2
    assert result["discovery_summary"]["supporting_evidence_count"] == 2
    assert result["discovery_summary"]["promotion_targets"] == ["opportunity_signals", "profile"]
    assert result["discovery_summary"]["profile"][0]["question_id"] == "q_foundation"
    assert result["discovery_summary"]["opportunity_signals"][0]["question_id"] == "q_procurement"


def test_build_question_first_promotions_supports_launch_and_decision_owner_questions():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_launch",
                "question_text": "Is there evidence Arsenal Football Club has launched or is replacing a public app?",
                "question_type": "launch",
                "answer": "Arsenal launched a new app experience.",
                "confidence": 0.86,
                "validation_state": "validated",
                "signal_type": "LAUNCH_SIGNAL",
                "evidence_url": "https://example.com/arsenal-launch",
            },
            {
                "question_id": "q_owner",
                "question_text": "Who is the most suitable person for commercial partnerships or business development at Arsenal Football Club?",
                "question_type": "decision_owner",
                "answer": "Jane Doe",
                "confidence": 0.88,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/jane-doe",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    assert result["discovery_summary"]["promotion_targets"] == ["decision_owners", "opportunity_signals"]
    assert result["discovery_summary"]["opportunity_signals"][0]["question_id"] == "q_launch"
    assert result["discovery_summary"]["decision_owners"][0]["question_id"] == "q_owner"


def test_build_question_first_promotions_supports_related_pois_questions():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_related",
                "question_text": "Which 3 to 5 people are the most relevant commercial, partnerships, or business development contacts at Arsenal Football Club?",
                "question_type": "related_pois",
                "answer": "Juliet Slot",
                "confidence": 0.87,
                "validation_state": "validated",
                "signal_type": "RELATED_POIS",
                "evidence_url": "https://example.com/juliet-slot",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    assert result["discovery_summary"]["promotion_targets"] == ["decision_owners"]
    assert result["discovery_summary"]["decision_owners"][0]["question_id"] == "q_related"


def test_build_question_first_promotions_emits_poi_graph_for_people_answers():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_owner",
                "entity_id": "arsenal-fc",
                "entity_name": "Arsenal Football Club",
                "question_text": "Who is the most suitable person for commercial partnerships or business development at Arsenal Football Club?",
                "question_type": "decision_owner",
                "answer": "Juliet Slot",
                "confidence": 0.93,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/juliet-slot",
                "primary_owner": {
                    "name": "Juliet Slot",
                    "title": "Chief Commercial Officer",
                    "organization": "Arsenal Football Club",
                },
                "supporting_candidates": [
                    {
                        "name": "Omar Shaikh",
                        "title": "Chief Financial Officer",
                        "organization": "Arsenal Football Club",
                        "relevance": "Supports commercial decision making",
                    }
                ],
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    assert result["poi_graph"]["schema_version"] == "poi_graph_v1"
    assert result["poi_graph"]["entity_id"] == "arsenal-fc"
    assert len(result["poi_graph"]["nodes"]) == 3
    assert len(result["poi_graph"]["edges"]) == 2
    assert result["poi_graph"]["edges"][0]["edge_type"] == "primary_owner_of"
    assert result["connections_graph"]["schema_version"] == "connections_graph_v1"
    assert any(node["node_type"] == "yp_member" for node in result["connections_graph"]["nodes"])


def test_build_question_first_connections_graph_accepts_explicit_bridge_contacts():
    poi_graph = {
        "schema_version": "poi_graph_v1",
        "entity_id": "celtic-fc",
        "entity_name": "Celtic FC",
        "nodes": [
            {"node_id": "celtic-fc", "node_type": "entity", "name": "Celtic FC"},
            {"node_id": "person:michael-nicholson", "node_type": "person", "name": "Michael Nicholson", "title": "Chief Executive"},
        ],
        "edges": [
            {"from_id": "celtic-fc", "to_id": "person:michael-nicholson", "edge_type": "primary_owner_of"},
        ],
    }

    graph = build_question_first_connections_graph(
        poi_graph=poi_graph,
        bridge_contacts=[
            {
                "contact_name": "David Eames",
                "relationship_to_yp": "Stuart Cope",
                "network_reach": "Sports marketing",
                "introduction_capability": "Warm commercial intro",
                "linkedin_url": "https://www.linkedin.com/in/david-eames/",
                "target_connections_count": 2,
            }
        ],
    )

    assert any(node["node_type"] == "bridge_contact" and node["name"] == "David Eames" for node in graph["nodes"])
    assert any(
        edge["from_id"] == "Stuart Cope" and edge["edge_type"] == "bridge_connection" and edge["to_id"] == "bridge:david-eames"
        for edge in graph["edges"]
    )


def test_build_question_first_connections_graph_omits_excluded_yp_members():
    poi_graph = {
        "schema_version": "poi_graph_v1",
        "entity_id": "arsenal-fc",
        "entity_name": "Arsenal FC",
        "nodes": [{"node_id": "arsenal-fc", "node_type": "entity", "name": "Arsenal FC"}],
        "edges": [],
    }

    graph = build_question_first_connections_graph(
        poi_graph=poi_graph,
        yp_team=[
            {
                "member_id": "elliott-hillman",
                "display_order": 10,
                "yp_name": "Elliott Hillman",
                "yp_role": "Senior Client Partner",
                "yp_linkedin": "https://www.linkedin.com/in/elliott-hillman/",
                "yp_weight": 1.2,
                "yp_expertise_1": "Client Partnerships",
                "yp_expertise_2": "Sports Industry",
                "yp_expertise_3": "Business Development",
                "status": "active",
            }
        ],
    )

    yp_member_names = {node["name"] for node in graph["nodes"] if node["node_type"] == "yp_member"}
    assert yp_member_names == {"Elliott Hillman"}


def test_build_question_first_promotions_phase_gates_decision_outputs_by_default():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q_owner",
                "question_text": "Who is the most suitable person for commercial partnerships or business development at Arsenal Football Club?",
                "question_type": "decision_owner",
                "answer": "Jane Doe",
                "confidence": 0.88,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/jane-doe",
                "rollout_phase": "phase_3_decision",
            },
        ],
        question_specs=[
            {
                "question_id": "q_owner",
                "rollout_phase": "phase_3_decision",
                "execution_class": "atomic_retrieval",
                "structured_output_schema": "decision_owner_v1",
            }
        ],
        evidence_items=[],
        promotion_candidates=[],
    )

    assert result["discovery_summary"]["promoted_count"] == 0
    assert result["discovery_summary"]["promotion_rollout_phase"] == "phase_1_core"


def test_build_question_first_promotions_marks_client_ready_only_with_foundation_leadership_and_buyer_signals():
    not_ready = build_question_first_promotions(
        answers=[
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "answer": "Drupal 10",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "DIGITAL_STACK",
                "evidence_url": "https://example.com/stack",
            },
            {
                "question_id": "q11_decision_owner",
                "question_type": "decision_owner",
                "answer": "Juliet Slot",
                "confidence": 0.97,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/owner",
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": "Target Juliet Slot via cold route",
                "confidence": 0.58,
                "validation_state": "provisional",
                "signal_type": "OUTREACH_STRATEGY",
                "evidence_url": "https://example.com/strategy",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    assert not_ready["discovery_summary"]["client_ready"] is False
    assert "q1_foundation" in not_ready["discovery_summary"]["client_ready_blockers"]
    assert "q3_leadership" in not_ready["discovery_summary"]["client_ready_blockers"]

    ready = build_question_first_promotions(
        answers=[
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "answer": "1886",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://example.com/foundation",
            },
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "answer": "Drupal 10",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "DIGITAL_STACK",
                "evidence_url": "https://example.com/stack",
            },
            {
                "question_id": "q3_leadership",
                "question_type": "leadership",
                "answer": "Leadership pool available",
                "confidence": 0.91,
                "validation_state": "validated",
                "signal_type": "LEADERSHIP",
                "evidence_url": "https://example.com/leadership",
            },
            {
                "question_id": "q11_decision_owner",
                "question_type": "decision_owner",
                "answer": "Juliet Slot",
                "confidence": 0.97,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/owner",
                "primary_owner": {"name": "Juliet Slot", "title": "Chief Commercial Officer"},
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": "Target Juliet Slot via cold route",
                "confidence": 0.58,
                "validation_state": "provisional",
                "signal_type": "OUTREACH_STRATEGY",
                "evidence_url": "https://example.com/strategy",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    assert ready["discovery_summary"]["client_ready"] is True
    assert ready["discovery_summary"]["client_ready_blockers"] == []


def test_build_question_first_promotions_emits_graphiti_sales_brief_when_buyer_signals_exist():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "answer": "1886",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://example.com/foundation",
            },
            {
                "question_id": "q2_digital_stack",
                "question_type": "digital_stack",
                "answer": "Drupal 10",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "DIGITAL_STACK",
                "evidence_url": "https://example.com/stack",
            },
            {
                "question_id": "q3_leadership",
                "question_type": "leadership",
                "answer": "Leadership pool available",
                "confidence": 0.91,
                "validation_state": "validated",
                "signal_type": "LEADERSHIP",
                "evidence_url": "https://example.com/leadership",
            },
            {
                "question_id": "q11_decision_owner",
                "question_type": "decision_owner",
                "answer": "Juliet Slot",
                "confidence": 0.97,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/owner",
                "primary_owner": {"name": "Juliet Slot", "title": "Chief Commercial Officer"},
            },
            {
                "question_id": "q12_connections",
                "question_type": "connections",
                "answer": "Juliet Slot",
                "confidence": 0.35,
                "validation_state": "provisional",
                "signal_type": "CONNECTIONS",
                "evidence_url": "",
                "answer": {
                    "raw_structured_output": {
                        "candidate_paths": [{"name": "Juliet Slot", "best_yp_owner": "Elliott Hillman", "path_type": "cold", "decision_score": 0.194}]
                    }
                },
            },
            {
                "question_id": "q13_capability_gap",
                "question_type": "capability_gap",
                "answer": {
                    "raw_structured_output": {"top_gap": "digital_stack_maturity"}
                },
                "confidence": 0.6,
                "validation_state": "provisional",
                "signal_type": "CAPABILITY_GAP",
                "evidence_url": "",
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": {
                    "raw_structured_output": {"recommended_target": "Juliet Slot", "recommended_route": "cold", "recommended_angle": "commercial_intelligence"}
                },
                "confidence": 0.58,
                "validation_state": "provisional",
                "signal_type": "OUTREACH_STRATEGY",
                "evidence_url": "",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    brief = result["discovery_summary"]["graphiti_sales_brief"]
    assert brief["status"] == "available"
    assert brief["buyer_name"] == "Juliet Slot"
    assert brief["best_path_owner"] == "Elliott Hillman"
    assert brief["capability_gap"] == "digital_stack_maturity"


def test_build_question_first_promotions_rejects_year_like_decision_owner_as_buyer():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q1_foundation",
                "question_type": "foundation",
                "answer": "1875",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "FOUNDATION",
                "evidence_url": "https://example.com/history",
            },
            {
                "question_id": "q3_leadership",
                "question_type": "leadership",
                "answer": "History page says the club was founded in 1875.",
                "confidence": 0.91,
                "validation_state": "validated",
                "signal_type": "LEADERSHIP",
                "evidence_url": "https://example.com/history",
            },
            {
                "question_id": "q11_decision_owner",
                "question_type": "decision_owner",
                "answer": "1875",
                "confidence": 0.97,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "primary_owner": {"name": "1875", "title": "Commercial Director"},
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": {
                    "raw_structured_output": {"recommended_target": "1875", "recommended_route": "cold"}
                },
                "confidence": 0.58,
                "validation_state": "provisional",
                "signal_type": "OUTREACH_STRATEGY",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    summary = result["discovery_summary"]
    assert summary["graphiti_sales_brief"]["status"] == "insufficient_signal"
    assert summary["client_ready"] is False
    assert "q11_decision_owner" in summary["client_ready_blockers"]


def test_build_question_first_promotions_prefers_deterministic_connections_for_graphiti_sales_brief():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q11_decision_owner",
                "entity_id": "doncaster-rovers",
                "entity_name": "Doncaster Rovers",
                "question_type": "decision_owner",
                "answer": "Shaun Lockwood",
                "confidence": 0.94,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "evidence_url": "https://example.com/owner",
                "primary_owner": {
                    "name": "Shaun Lockwood",
                    "title": "Chief Commercial Officer",
                    "organization": "Club Doncaster",
                },
            },
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "answer": {
                    "raw_structured_output": {
                        "best_service": "commercial_partnerships",
                        "fit_rationale": "Commercial leadership plus fresh hiring signal suggests sponsorship and revenue support needs.",
                    }
                },
                "confidence": 0.74,
                "validation_state": "provisional",
                "signal_type": "YP_FIT",
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": {
                    "raw_structured_output": {
                        "recommended_target": "Shaun Lockwood",
                        "recommended_angle": "Use the current commercial hiring motion to start a sponsorship operations discussion.",
                    }
                },
                "confidence": 0.66,
                "validation_state": "provisional",
                "signal_type": "OUTREACH_STRATEGY",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        bridge_contacts=[
            {
                "contact_name": "Bridge Contact",
                "relationship_to_yp": "Stuart Cope",
                "network_reach": "Commercial leadership",
                "introduction_capability": "Warm route into sponsorship teams",
                "linkedin_url": "https://example.com/bridge",
                "target_connections_count": 1,
            }
        ],
        allowed_rollout_phase="phase_3_decision",
    )

    brief = result["discovery_summary"]["graphiti_sales_brief"]
    assert brief["status"] == "available"
    assert brief["buyer_name"] == "Shaun Lockwood"
    assert brief["best_path_owner"] == "Stuart Cope"
    assert brief["path_type"] == "Tier 2 bridge"
    assert brief["yp_fit_service"] == "commercial_partnerships"
    assert brief["buyer_relevance"] == "decision_owner"
    assert brief["route_confidence"] is not None
    assert "verify" in brief["verification_needed"].lower()


def test_build_question_first_promotions_uses_direct_buyer_route_fields_when_connections_analyzer_is_richer():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q11_decision_owner",
                "entity_id": "arsenal-fc",
                "entity_name": "Arsenal Football Club",
                "question_type": "decision_owner",
                "answer": "Juliet Slot",
                "confidence": 0.95,
                "validation_state": "validated",
                "signal_type": "DECISION_OWNER",
                "primary_owner": {
                    "name": "Juliet Slot",
                    "title": "Chief Commercial Officer",
                    "organization": "Arsenal Football Club",
                },
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": {
                    "raw_structured_output": {
                        "recommended_target": "Juliet Slot",
                        "recommended_angle": "Use the commercial remit and current platform work to open a revenue systems conversation.",
                    }
                },
                "confidence": 0.68,
                "validation_state": "provisional",
                "signal_type": "OUTREACH_STRATEGY",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
        bridge_contacts=[
            {
                "contact_name": "David Eames",
                "relationship_to_yp": "Stuart Cope",
                "network_reach": "Commercial partnerships",
                "introduction_capability": "Warm support intro",
            }
        ],
        poi_graph={
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
        connections_graph={
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
    )

    brief = result["discovery_summary"]["graphiti_sales_brief"]
    assert brief["best_path_owner"] == "Elliott Hillman"
    assert brief["path_type"] == "Direct (warm)"
    assert brief["buyer_relevance"] == "decision_owner"
    assert brief["outreach_target"] == "Juliet Slot"


def test_build_question_first_promotions_synthesizes_yp_fit_and_outreach_from_adjacent_signal():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q6_launch_signal",
                "entity_id": "major-league-cricket",
                "entity_name": "Major League Cricket",
                "question_type": "launch_signal",
                "answer": "Major League Cricket is replacing its digital ticketing platform before the 2026 season.",
                "confidence": 0.86,
                "validation_state": "validated",
                "signal_type": "LAUNCH_SIGNAL",
                "evidence_url": "https://example.com/mlc-ticketing-launch",
            },
            {
                "question_id": "q11_decision_owner",
                "entity_id": "major-league-cricket",
                "entity_name": "Major League Cricket",
                "question_type": "decision_owner",
                "answer": "A commercial operations lead is the likely buyer.",
                "confidence": 0.62,
                "validation_state": "provisional",
                "signal_type": "DECISION_OWNER",
                "primary_owner": {
                    "name": "Commercial Operations Lead",
                    "title": "Commercial Operations",
                    "organization": "Major League Cricket",
                },
            },
            {
                "question_id": "q12_connections",
                "question_type": "connections",
                "answer": {
                    "raw_structured_output": {
                        "candidate_paths": [
                            {
                                "best_yp_owner": "Elliott Hillman",
                                "path_type": "Cold",
                                "buyer_relevance": "decision_owner",
                                "route_confidence": 25,
                            }
                        ]
                    }
                },
                "confidence": 0.35,
                "validation_state": "no_signal",
                "signal_type": "CONNECTIONS",
            },
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "answer": None,
                "confidence": 0,
                "validation_state": "no_signal",
                "signal_type": "YP_FIT",
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": None,
                "confidence": 0,
                "validation_state": "no_signal",
                "signal_type": "OUTREACH_STRATEGY",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    summary = result["discovery_summary"]
    yp_fit = summary["yellow_panther_fit"]
    outreach = summary["outreach_strategy"]
    brief = summary["graphiti_sales_brief"]

    assert yp_fit["status"] == "available"
    assert yp_fit["best_service"] == "DIGITAL_TRANSFORMATION"
    assert "ticketing platform" in yp_fit["fit_rationale"].lower()
    assert outreach["status"] == "available"
    assert outreach["recommended_target"] == "Commercial Operations Lead"
    assert outreach["recommended_route"] == "Cold"
    assert "ticketing platform" in outreach["recommended_angle"].lower()
    assert brief["status"] == "available"
    assert brief["buyer_name"] == "Commercial Operations Lead"
    assert brief["outreach_target"] == "Commercial Operations Lead"
    assert brief["outreach_angle"]


def test_build_question_first_promotions_returns_insufficient_signal_fit_without_fake_negative_lookup():
    result = build_question_first_promotions(
        answers=[
            {
                "question_id": "q14_yp_fit",
                "question_type": "yp_fit",
                "answer": None,
                "confidence": 0,
                "validation_state": "no_signal",
                "signal_type": "YP_FIT",
            },
            {
                "question_id": "q15_outreach_strategy",
                "question_type": "outreach_strategy",
                "answer": None,
                "confidence": 0,
                "validation_state": "no_signal",
                "signal_type": "OUTREACH_STRATEGY",
            },
        ],
        evidence_items=[],
        promotion_candidates=[],
        allowed_rollout_phase="phase_3_decision",
    )

    yp_fit = result["discovery_summary"]["yellow_panther_fit"]
    outreach = result["discovery_summary"]["outreach_strategy"]

    assert yp_fit["status"] == "insufficient_signal"
    assert yp_fit["fit_rationale"] == "insufficient_signal"
    assert "panther" not in " ".join(str(value) for value in yp_fit.values()).lower()
    assert outreach["status"] == "insufficient_signal"
