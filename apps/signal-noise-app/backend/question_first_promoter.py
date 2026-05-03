#!/usr/bin/env python3
"""Promote question-first evidence into dossier-facing summaries."""

from __future__ import annotations

from typing import Any, Dict, List

try:
    from backend.connections_analyzer import (
        ConnectionsAnalyzer,
        _merge_target_personnel,
        _target_personnel_from_poi_graph,
        _yp_team_data_from_connections_graph,
    )
    from backend.yp_team_roster import load_active_yp_team
except ImportError:
    from connections_analyzer import (  # type: ignore
        ConnectionsAnalyzer,
        _merge_target_personnel,
        _target_personnel_from_poi_graph,
        _yp_team_data_from_connections_graph,
    )
    from yp_team_roster import load_active_yp_team  # type: ignore


def _slugify(value: Any) -> str:
    return "".join(ch.lower() if str(ch).isalnum() else "-" for ch in str(value or "").strip()).strip("-") or "item"


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


_ROLLOUT_PHASE_RANK = {
    "phase_1_core": 1,
    "phase_2_conditional": 2,
    "phase_3_decision": 3,
}


def _rollout_phase_rank(value: Any) -> int:
    return _ROLLOUT_PHASE_RANK.get(str(value or "").strip(), _ROLLOUT_PHASE_RANK["phase_3_decision"])


def _infer_promotion_target(answer: Dict[str, Any]) -> str:
    question_type = str(answer.get("question_type") or "").strip().lower()
    signal_type = str(answer.get("signal_type") or "").strip().lower()
    combined = f"{question_type} {signal_type}".strip()

    if "foundation" in combined or "identity" in combined:
        return "profile"
    if "launch" in combined or "product" in combined:
        return "opportunity_signals"
    if "leadership" in combined:
        return "decision_owners"
    if "decision_owner" in combined or "decision owner" in combined:
        return "decision_owners"
    if "related_pois" in combined or "related pois" in combined:
        return "decision_owners"
    if "procurement" in combined or "rfp" in combined or "tender" in combined:
        return "opportunity_signals"
    if "poi" in combined or "connection" in combined or "partnership" in combined:
        return "decision_owners"
    return "opportunity_signals"


def _normalize_candidate(value: Any) -> Dict[str, Any] | None:
    if isinstance(value, str):
        name = value.strip()
        return {"name": name} if name else None
    if not isinstance(value, dict):
        return None
    name = str(value.get("name") or value.get("full_name") or value.get("person") or "").strip()
    if not name:
        return None
    candidate: Dict[str, Any] = {"name": name}
    for source_key, target_key in (
        ("title", "title"),
        ("role", "title"),
        ("organization", "organization"),
        ("company", "organization"),
        ("linkedin_url", "linkedin_url"),
        ("linkedin", "linkedin_url"),
        ("relevance", "relevance"),
    ):
        raw_value = str(value.get(source_key) or "").strip()
        if raw_value and target_key not in candidate:
            candidate[target_key] = raw_value
    return candidate


def _question_is_validated(answer: Dict[str, Any] | None) -> bool:
    if not isinstance(answer, dict):
        return False
    return str(answer.get("validation_state") or "").strip().lower() == "validated"


def _question_is_strong_provisional(answer: Dict[str, Any] | None, *, min_confidence: float = 0.55) -> bool:
    if not isinstance(answer, dict):
        return False
    return (
        str(answer.get("validation_state") or "").strip().lower() == "provisional"
        and _safe_float(answer.get("confidence")) >= min_confidence
    )


def _extract_raw_structured_output(answer: Dict[str, Any] | None) -> Dict[str, Any]:
    if not isinstance(answer, dict):
        return {}
    answer_value = answer.get("answer")
    if isinstance(answer_value, dict):
        raw_structured_output = answer_value.get("raw_structured_output")
        if isinstance(raw_structured_output, dict):
            return raw_structured_output
        return answer_value
    raw_structured_output = answer.get("raw_structured_output")
    return raw_structured_output if isinstance(raw_structured_output, dict) else {}


def _target_personnel_from_connections_graph(connections_graph: Dict[str, Any] | None, *, entity_id: str) -> List[Any]:
    if not isinstance(connections_graph, dict):
        return []
    nodes = {
        str(node.get("node_id") or "").strip(): node
        for node in (connections_graph.get("nodes") or [])
        if isinstance(node, dict) and str(node.get("node_id") or "").strip()
    }
    people: List[Any] = []
    seen = set()
    for edge in connections_graph.get("edges") or []:
        if not isinstance(edge, dict):
            continue
        to_id = str(edge.get("to_id") or "").strip()
        person_node = nodes.get(to_id)
        if not person_node or str(person_node.get("node_type") or "").strip().lower() != "person":
            continue
        name = str(person_node.get("name") or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        people.append(
            {
                "entity_id": entity_id,
                "person_name": name,
                "role": str(person_node.get("title") or "").strip(),
                "linkedin_url": str(person_node.get("linkedin_url") or "").strip(),
                "mutual_connections_yp": "",
                "count_second_degree_paths": 0,
            }
        )
    try:
        from backend.connections_analyzer import TargetPerson  # type: ignore
    except ImportError:
        from connections_analyzer import TargetPerson  # type: ignore
    return [TargetPerson(**person) for person in people]


def _bridge_contacts_from_connections_graph(connections_graph: Dict[str, Any] | None) -> List[Any]:
    if not isinstance(connections_graph, dict):
        return []
    try:
        from backend.connections_analyzer import BridgeContact  # type: ignore
    except ImportError:
        from connections_analyzer import BridgeContact  # type: ignore
    bridge_contacts: List[Any] = []
    for node in connections_graph.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        if str(node.get("node_type") or "").strip().lower() != "bridge_contact":
            continue
        bridge_contacts.append(
            BridgeContact(
                contact_name=str(node.get("name") or "").strip(),
                relationship_to_yp=str(node.get("relationship_to_yp") or "").strip(),
                network_reach=str(node.get("network_reach") or "").strip(),
                introduction_capability=str(node.get("introduction_capability") or "").strip(),
                linkedin_url=str(node.get("linkedin_url") or "").strip(),
                target_connections_count=int(node.get("target_connections_count") or 0),
            )
        )
    return bridge_contacts


def _build_deterministic_connections_summary(
    *,
    entity_id: str,
    entity_name: str,
    poi_graph: Dict[str, Any] | None = None,
    connections_graph: Dict[str, Any] | None,
) -> Dict[str, Any]:
    if not isinstance(connections_graph, dict):
        return {}
    analyzer = ConnectionsAnalyzer()
    target_personnel = _target_personnel_from_connections_graph(connections_graph, entity_id=entity_id)
    if isinstance(poi_graph, dict):
        target_personnel = _merge_target_personnel(
            _target_personnel_from_poi_graph(entity_id=entity_id, poi_graph=poi_graph),
            target_personnel,
        )
    bridge_contacts = _bridge_contacts_from_connections_graph(connections_graph)
    yp_team_data = _yp_team_data_from_connections_graph(connections_graph, yp_team=analyzer.yp_team)
    if not target_personnel and not bridge_contacts:
        return {}
    result = analyzer.analyze_connections(
        entity_id=entity_id,
        entity_name=entity_name,
        target_personnel=target_personnel,
        bridge_contacts=bridge_contacts or None,
        yp_team_data=yp_team_data or None,
    )
    recommended = result.recommended_approach if isinstance(result.recommended_approach, dict) else {}
    if not recommended:
        return {}
    return {
        "best_path_owner": str(recommended.get("yp_member") or "").strip() or None,
        "path_type": str(recommended.get("introduction_path") or "").strip() or None,
        "route_type": str(recommended.get("route_type") or "").strip() or None,
        "target_person": str(recommended.get("target_person") or "").strip() or None,
        "target_role": str(recommended.get("target_role") or "").strip() or None,
        "buyer_relevance": str(recommended.get("buyer_relevance") or "").strip() or None,
        "route_confidence": recommended.get("route_confidence"),
        "success_probability": recommended.get("success_probability"),
        "talking_points": recommended.get("talking_points") or [],
        "verification_needed": str(recommended.get("verification_needed") or "").strip() or None,
        "rationale": str(recommended.get("rationale") or "").strip() or None,
        "source": "connections_analyzer",
    }


def _build_client_ready_summary(answer_by_question: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    required_questions = [
        "q1_foundation",
        "q2_digital_stack",
        "q3_leadership",
        "q11_decision_owner",
    ]
    blockers = [
        question_id
        for question_id in required_questions
        if not _question_is_validated(answer_by_question.get(question_id))
    ]
    buyer_support_questions = ["q12_connections", "q13_capability_gap", "q15_outreach_strategy"]
    has_buyer_support = any(
        _question_is_validated(answer_by_question.get(question_id))
        or _question_is_strong_provisional(answer_by_question.get(question_id))
        for question_id in buyer_support_questions
    )
    if not has_buyer_support:
        blockers.append("buyer_signal_support")
    return {
        "client_ready": len(blockers) == 0,
        "client_ready_blockers": blockers,
    }


def _build_graphiti_sales_brief(
    answer_by_question: Dict[str, Dict[str, Any]],
    *,
    deterministic_connections: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    decision_owner = answer_by_question.get("q11_decision_owner") or {}
    if not _question_is_validated(decision_owner):
        return {"status": "insufficient_signal"}

    primary_owner = decision_owner.get("primary_owner") if isinstance(decision_owner.get("primary_owner"), dict) else {}
    buyer_name = str(primary_owner.get("name") or decision_owner.get("answer") or "").strip()
    buyer_title = str(primary_owner.get("title") or primary_owner.get("role") or "").strip() or None

    connections = _extract_raw_structured_output(answer_by_question.get("q12_connections"))
    candidate_paths = connections.get("candidate_paths") if isinstance(connections.get("candidate_paths"), list) else []
    best_path = candidate_paths[0] if candidate_paths and isinstance(candidate_paths[0], dict) else {}
    deterministic_connections = deterministic_connections if isinstance(deterministic_connections, dict) else {}

    capability_gap = _extract_raw_structured_output(answer_by_question.get("q13_capability_gap"))
    outreach_strategy = _extract_raw_structured_output(answer_by_question.get("q15_outreach_strategy"))
    yp_fit = _extract_raw_structured_output(answer_by_question.get("q14_yp_fit"))

    summary = {
        "status": "available",
        "buyer_name": buyer_name or None,
        "buyer_title": buyer_title,
        "best_path_owner": str(
            best_path.get("best_yp_owner")
            or best_path.get("recommended_yp_owner")
            or deterministic_connections.get("best_path_owner")
            or ""
        ).strip() or None,
        "path_type": str(best_path.get("path_type") or deterministic_connections.get("path_type") or "").strip() or None,
        "buyer_relevance": str(best_path.get("buyer_relevance") or deterministic_connections.get("buyer_relevance") or "").strip() or None,
        "route_confidence": best_path.get("route_confidence") or deterministic_connections.get("route_confidence"),
        "capability_gap": str(capability_gap.get("top_gap") or capability_gap.get("gap_label") or "").strip() or None,
        "yp_fit_service": str(yp_fit.get("best_service") or yp_fit.get("recommended_service") or "").strip() or None,
        "outreach_target": str(outreach_strategy.get("recommended_target") or deterministic_connections.get("target_person") or buyer_name or "").strip() or None,
        "outreach_route": str(
            outreach_strategy.get("recommended_route")
            or best_path.get("path_type")
            or deterministic_connections.get("path_type")
            or ""
        ).strip() or None,
        "outreach_angle": str(outreach_strategy.get("recommended_angle") or "").strip() or None,
        "verification_needed": str(outreach_strategy.get("verification_needed") or deterministic_connections.get("verification_needed") or "").strip() or None,
        "source": "question_first_promotions",
    }
    if not any(summary.get(key) for key in ("best_path_owner", "capability_gap", "outreach_target", "outreach_angle")):
        return {"status": "insufficient_signal"}
    return summary


def build_question_first_poi_graph(*, answers: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    answers = [item for item in (answers or []) if isinstance(item, dict)]
    entity_id = ""
    entity_name = ""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    seen_nodes = set()
    seen_edges = set()

    def add_node(node: Dict[str, Any]) -> None:
        node_id = str(node.get("node_id") or "").strip()
        if not node_id or node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    def add_edge(edge: Dict[str, Any]) -> None:
        key = (
            str(edge.get("from_id") or "").strip(),
            str(edge.get("edge_type") or "").strip(),
            str(edge.get("to_id") or "").strip(),
        )
        if not all(key) or key in seen_edges:
            return
        seen_edges.add(key)
        edges.append(edge)

    for answer in answers:
        validation_state = str(answer.get("validation_state") or "").strip().lower()
        question_type = str(answer.get("question_type") or "").strip().lower()
        if validation_state != "validated":
            continue
        if question_type not in {"decision_owner", "related_pois", "leadership"}:
            continue

        entity_id = entity_id or str(answer.get("entity_id") or "").strip()
        entity_name = entity_name or str(answer.get("entity_name") or "").strip()
        entity_node_id = entity_id or f"entity:{_slugify(entity_name)}"
        add_node(
            {
                "node_id": entity_node_id,
                "node_type": "entity",
                "entity_id": entity_id or None,
                "name": entity_name or entity_id or "entity",
            }
        )

        primary_owner = _normalize_candidate(answer.get("primary_owner"))
        supporting_candidates = [
            candidate
            for candidate in (
                _normalize_candidate(item) for item in (answer.get("supporting_candidates") or [])
            )
            if candidate
        ]
        candidates = [
            candidate
            for candidate in (
                _normalize_candidate(item) for item in (answer.get("candidates") or [])
            )
            if candidate
        ]

        merged_candidates: List[Dict[str, Any]] = []
        seen_people = set()
        for candidate in [primary_owner, *supporting_candidates, *candidates]:
            if not candidate:
                continue
            person_key = str(candidate.get("name") or "").strip().lower()
            if not person_key or person_key in seen_people:
                continue
            seen_people.add(person_key)
            merged_candidates.append(candidate)

        for candidate in merged_candidates:
            person_id = f"person:{_slugify(candidate['name'])}"
            add_node(
                {
                    "node_id": person_id,
                    "node_type": "person",
                    "name": candidate["name"],
                    "title": candidate.get("title"),
                    "organization": candidate.get("organization"),
                    "linkedin_url": candidate.get("linkedin_url"),
                }
            )
            add_edge(
                {
                    "from_id": entity_node_id,
                    "to_id": person_id,
                    "edge_type": "primary_owner_of" if primary_owner and candidate["name"] == primary_owner["name"] else "supports",
                    "confidence": _safe_float(answer.get("confidence")),
                    "source_question_id": str(answer.get("question_id") or "").strip(),
                    "evidence_url": str(answer.get("evidence_url") or "").strip() or None,
                    "relevance": candidate.get("relevance"),
                }
            )

    return {
        "schema_version": "poi_graph_v1",
        "entity_id": entity_id or None,
        "entity_name": entity_name or None,
        "nodes": nodes,
        "edges": edges,
    }


def build_question_first_connections_graph(
    *,
    poi_graph: Dict[str, Any] | None = None,
    bridge_contacts: List[Dict[str, Any]] | None = None,
    yp_team: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    graph = poi_graph if isinstance(poi_graph, dict) else {}
    entity_id = str(graph.get("entity_id") or "").strip() or None
    entity_name = str(graph.get("entity_name") or "").strip() or None
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    seen_nodes = set()
    seen_edges = set()

    def add_node(node: Dict[str, Any]) -> None:
        node_id = str(node.get("node_id") or "").strip()
        if not node_id or node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    def add_edge(edge: Dict[str, Any]) -> None:
        key = (
            str(edge.get("from_id") or "").strip(),
            str(edge.get("edge_type") or "").strip(),
            str(edge.get("to_id") or "").strip(),
        )
        if not all(key) or key in seen_edges:
            return
        seen_edges.add(key)
        edges.append(edge)

    for node in graph.get("nodes") or []:
        if isinstance(node, dict):
            add_node(dict(node))

    for edge in graph.get("edges") or []:
        if isinstance(edge, dict):
            add_edge(dict(edge))

    configured_yp_team = yp_team or load_active_yp_team()
    for member in configured_yp_team:
        yp_name = str(member.get("yp_name") or "").strip()
        if not yp_name:
            continue
        add_node(
            {
                "node_id": yp_name,
                "node_type": "yp_member",
                "name": yp_name,
                "title": str(member.get("yp_role") or "").strip() or None,
                "linkedin_url": str(member.get("yp_linkedin") or "").strip() or None,
                "weight": member.get("yp_weight"),
            }
        )

    analyzer = ConnectionsAnalyzer()
    configured_bridge_contacts = bridge_contacts if bridge_contacts is not None else [
        {
            "contact_name": bridge.contact_name,
            "relationship_to_yp": bridge.relationship_to_yp,
            "network_reach": bridge.network_reach,
            "introduction_capability": bridge.introduction_capability,
            "linkedin_url": bridge.linkedin_url,
            "target_connections_count": bridge.target_connections_count,
        }
        for bridge in analyzer.bridge_contacts
    ]
    for bridge_payload in configured_bridge_contacts:
        bridge_name = str(bridge_payload.get("contact_name") or bridge_payload.get("name") or "").strip()
        if not bridge_name:
            continue
        bridge_id = f"bridge:{_slugify(bridge_name)}"
        add_node(
            {
                "node_id": bridge_id,
                "node_type": "bridge_contact",
                "name": bridge_name,
                "relationship_to_yp": str(bridge_payload.get("relationship_to_yp") or "").strip(),
                "network_reach": str(bridge_payload.get("network_reach") or "").strip(),
                "introduction_capability": str(bridge_payload.get("introduction_capability") or "").strip(),
                "linkedin_url": str(bridge_payload.get("linkedin_url") or "").strip() or None,
                "target_connections_count": int(bridge_payload.get("target_connections_count") or 0),
            }
        )
        relationship_to_yp = str(bridge_payload.get("relationship_to_yp") or "").strip()
        if relationship_to_yp:
            for yp_name in [item.strip() for item in relationship_to_yp.split(",") if item.strip()]:
                add_edge(
                    {
                        "from_id": yp_name,
                        "to_id": bridge_id,
                        "edge_type": "bridge_connection",
                        "confidence": 35.0,
                        "to_label": bridge_name,
                    }
                )

    return {
        "schema_version": "connections_graph_v1",
        "entity_id": entity_id,
        "entity_name": entity_name,
        "nodes": nodes,
        "edges": edges,
    }


def build_question_first_promotions(
    *,
    answers: List[Dict[str, Any]] | None = None,
    question_specs: List[Dict[str, Any]] | None = None,
    evidence_items: List[Dict[str, Any]] | None = None,
    promotion_candidates: List[Dict[str, Any]] | None = None,
    bridge_contacts: List[Dict[str, Any]] | None = None,
    poi_graph: Dict[str, Any] | None = None,
    connections_graph: Dict[str, Any] | None = None,
    min_confidence: float = 0.7,
    allowed_rollout_phase: str = "phase_1_core",
) -> Dict[str, Any]:
    answers = [item for item in (answers or []) if isinstance(item, dict)]
    question_specs = [item for item in (question_specs or []) if isinstance(item, dict)]
    evidence_items = [item for item in (evidence_items or []) if isinstance(item, dict)]
    promotion_candidates = [item for item in (promotion_candidates or []) if isinstance(item, dict)]
    question_specs_by_id = {
        str(item.get("question_id") or "").strip(): item
        for item in question_specs
        if str(item.get("question_id") or "").strip()
    }
    allowed_phase_rank = _rollout_phase_rank(allowed_rollout_phase)

    if not evidence_items or not promotion_candidates:
        synthetic_evidence_items: List[Dict[str, Any]] = []
        synthetic_promotion_candidates: List[Dict[str, Any]] = []
        for answer in answers:
            question_id = str(answer.get("question_id") or "").strip()
            if not question_id:
                continue
            question_spec = question_specs_by_id.get(question_id, {})
            rollout_phase = str(answer.get("rollout_phase") or question_spec.get("rollout_phase") or "phase_1_core").strip()
            execution_class = str(answer.get("execution_class") or question_spec.get("execution_class") or "").strip()
            structured_output_schema = str(answer.get("structured_output_schema") or question_spec.get("structured_output_schema") or "").strip()
            if _rollout_phase_rank(rollout_phase) > allowed_phase_rank:
                continue
            confidence = _safe_float(answer.get("confidence"))
            validation_state = str(answer.get("validation_state") or "").strip().lower()
            if validation_state != "validated" or confidence < min_confidence:
                continue

            promotion_target = _infer_promotion_target(answer)
            evidence_focus = "entity_fact" if promotion_target == "profile" else "opportunity_signal"
            answer_kind = "fact" if promotion_target == "profile" else "signal"
            evidence_url = str(answer.get("evidence_url") or "").strip()

            synthetic_evidence_items.append(
                {
                    "evidence_id": f"{question_id}:evidence",
                    "question_id": question_id,
                    "entity_id": str(answer.get("entity_id") or ""),
                    "signal_type": str(answer.get("signal_type") or ""),
                    "evidence_focus": evidence_focus,
                    "promotion_target": promotion_target,
                    "answer_kind": answer_kind,
                    "answer": str(answer.get("answer") or "").strip(),
                    "confidence": confidence,
                    "validation_state": validation_state,
                    "evidence_url": evidence_url,
                    "rollout_phase": rollout_phase,
                    "execution_class": execution_class,
                    "structured_output_schema": structured_output_schema,
                }
            )
            synthetic_promotion_candidates.append(
                {
                    "candidate_id": f"{question_id}:{promotion_target}",
                    "question_id": question_id,
                    "promotion_target": promotion_target,
                    "signal_type": str(answer.get("signal_type") or ""),
                    "answer": str(answer.get("answer") or "").strip(),
                    "confidence": confidence,
                    "promotion_candidate": True,
                    "rollout_phase": rollout_phase,
                    "execution_class": execution_class,
                    "structured_output_schema": structured_output_schema,
                }
            )

        if not evidence_items:
            evidence_items = synthetic_evidence_items
        if not promotion_candidates:
            promotion_candidates = synthetic_promotion_candidates

    answer_by_question = {
        str(answer.get("question_id") or "").strip(): answer
        for answer in answers
        if str(answer.get("question_id") or "").strip()
    }
    evidence_by_question = {
        str(item.get("question_id") or "").strip(): item
        for item in evidence_items
        if str(item.get("question_id") or "").strip()
    }

    promoted: List[Dict[str, Any]] = []
    for candidate in promotion_candidates:
        if not candidate.get("promotion_candidate"):
            continue
        question_id = str(candidate.get("question_id") or "").strip()
        question_spec = question_specs_by_id.get(question_id, {})
        rollout_phase = str(candidate.get("rollout_phase") or question_spec.get("rollout_phase") or "phase_1_core").strip()
        execution_class = str(candidate.get("execution_class") or question_spec.get("execution_class") or "").strip()
        structured_output_schema = str(candidate.get("structured_output_schema") or question_spec.get("structured_output_schema") or "").strip()
        if _rollout_phase_rank(rollout_phase) > allowed_phase_rank:
            continue
        confidence = _safe_float(candidate.get("confidence"))
        if confidence < min_confidence:
            continue

        evidence = evidence_by_question.get(question_id, {})
        validation_state = str(evidence.get("validation_state") or "").strip().lower()
        evidence_url = str(evidence.get("evidence_url") or "").strip()
        if validation_state != "validated" or not evidence_url:
            continue

        answer = answer_by_question.get(question_id, {})
        promoted_item = {
            "candidate_id": str(candidate.get("candidate_id") or f"{question_id}:{candidate.get('promotion_target') or 'promotion'}"),
            "question_id": question_id,
            "question_text": str(answer.get("question_text") or answer.get("question") or ""),
            "promotion_target": str(candidate.get("promotion_target") or evidence.get("promotion_target") or "discovery_summary"),
            "signal_type": str(candidate.get("signal_type") or evidence.get("signal_type") or answer.get("signal_type") or ""),
            "answer": str(candidate.get("answer") or evidence.get("answer") or answer.get("answer") or "").strip(),
            "confidence": confidence,
            "evidence_url": evidence_url,
            "evidence_id": str(evidence.get("evidence_id") or ""),
            "evidence_focus": str(evidence.get("evidence_focus") or ""),
            "answer_kind": str(evidence.get("answer_kind") or ""),
            "validation_state": validation_state,
            "rollout_phase": rollout_phase,
            "execution_class": execution_class,
            "structured_output_schema": structured_output_schema,
        }
        promoted.append(promoted_item)

    promoted.sort(key=lambda item: (item["confidence"], item["candidate_id"]), reverse=True)

    targets = sorted({item["promotion_target"] for item in promoted})
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for target in targets:
        grouped[target] = [item for item in promoted if item["promotion_target"] == target]

    poi_graph = poi_graph if isinstance(poi_graph, dict) else build_question_first_poi_graph(answers=answers)
    connections_graph = (
        connections_graph
        if isinstance(connections_graph, dict)
        else build_question_first_connections_graph(poi_graph=poi_graph, bridge_contacts=bridge_contacts)
    )
    deterministic_connections = _build_deterministic_connections_summary(
        entity_id=str((poi_graph or {}).get("entity_id") or ""),
        entity_name=str((poi_graph or {}).get("entity_name") or ""),
        poi_graph=poi_graph,
        connections_graph=connections_graph,
    )

    discovery_summary: Dict[str, Any] = {
        "promoted_count": len(promoted),
        "supporting_evidence_count": len({item["evidence_id"] or item["candidate_id"] for item in promoted}),
        "promotion_targets": targets,
        "promotion_rollout_phase": allowed_rollout_phase,
    }
    discovery_summary.update(_build_client_ready_summary(answer_by_question))
    discovery_summary["graphiti_sales_brief"] = _build_graphiti_sales_brief(
        answer_by_question,
        deterministic_connections=deterministic_connections,
    )
    if deterministic_connections:
        discovery_summary["deterministic_connections"] = deterministic_connections
    discovery_summary.update(grouped)

    return {
        "dossier_promotions": promoted,
        "discovery_summary": discovery_summary,
        "promotion_candidates": promotion_candidates,
        "poi_graph": poi_graph,
        "connections_graph": connections_graph,
    }
