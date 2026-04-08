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
