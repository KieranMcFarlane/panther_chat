#!/usr/bin/env python3
"""Promote question-first evidence into dossier-facing summaries."""

from __future__ import annotations

from typing import Any, Dict, List

try:
    from backend.connections_analyzer import ConnectionsAnalyzer, YELLOW_PANTHER_TEAM
except ImportError:
    from connections_analyzer import ConnectionsAnalyzer, YELLOW_PANTHER_TEAM  # type: ignore


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

    for member in YELLOW_PANTHER_TEAM:
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

    poi_graph = build_question_first_poi_graph(answers=answers)
    connections_graph = build_question_first_connections_graph(poi_graph=poi_graph, bridge_contacts=bridge_contacts)

    discovery_summary: Dict[str, Any] = {
        "promoted_count": len(promoted),
        "supporting_evidence_count": len({item["evidence_id"] or item["candidate_id"] for item in promoted}),
        "promotion_targets": targets,
        "promotion_rollout_phase": allowed_rollout_phase,
    }
    discovery_summary.update(grouped)

    return {
        "dossier_promotions": promoted,
        "discovery_summary": discovery_summary,
        "promotion_candidates": promotion_candidates,
        "poi_graph": poi_graph,
        "connections_graph": connections_graph,
    }
