#!/usr/bin/env python3
"""Enrich seeded connections graphs with relationship evidence."""

from __future__ import annotations

import os
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from backend.linkedin_profiler import LinkedInProfiler
except ImportError:
    from linkedin_profiler import LinkedInProfiler  # type: ignore


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_name(value: Any) -> str:
    return str(value or "").strip().lower()


def _graph_nodes(graph: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [node for node in (graph.get("nodes") or []) if isinstance(node, dict)]


def _graph_edges(graph: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [edge for edge in (graph.get("edges") or []) if isinstance(edge, dict)]


def _find_node_id_by_name(graph: Dict[str, Any], *, node_type: str, name: str) -> Optional[str]:
    wanted_name = _normalize_name(name)
    wanted_type = _normalize_name(node_type)
    for node in _graph_nodes(graph):
        if _normalize_name(node.get("node_type")) != wanted_type:
            continue
        if _normalize_name(node.get("name")) == wanted_name:
            return str(node.get("node_id") or "").strip() or None
    return None


def _yp_members_from_graph(graph: Dict[str, Any]) -> List[Dict[str, Any]]:
    members = []
    for node in _graph_nodes(graph):
        if _normalize_name(node.get("node_type")) != "yp_member":
            continue
        members.append(
            {
                "node_id": str(node.get("node_id") or "").strip(),
                "name": str(node.get("name") or "").strip(),
                "title": str(node.get("title") or "").strip(),
                "linkedin_url": str(node.get("linkedin_url") or "").strip(),
            }
        )
    return members


def _target_people_from_graph(graph: Dict[str, Any]) -> List[Dict[str, Any]]:
    people = []
    for node in _graph_nodes(graph):
        if _normalize_name(node.get("node_type")) != "person":
            continue
        people.append(
            {
                "node_id": str(node.get("node_id") or "").strip(),
                "name": str(node.get("name") or "").strip(),
                "title": str(node.get("title") or "").strip(),
                "linkedin_url": str(node.get("linkedin_url") or "").strip(),
            }
        )
    return people


def _bridge_contacts_from_graph(graph: Dict[str, Any]) -> List[Dict[str, Any]]:
    contacts = []
    for node in _graph_nodes(graph):
        if _normalize_name(node.get("node_type")) != "bridge_contact":
            continue
        contacts.append(
            {
                "node_id": str(node.get("node_id") or "").strip(),
                "name": str(node.get("name") or "").strip(),
                "linkedin_url": str(node.get("linkedin_url") or "").strip(),
            }
        )
    return contacts


class LinkedInBrightDataConnectionsProvider:
    """Thin adapter over the existing LinkedIn profiler."""

    def __init__(self, brightdata_client: Any):
        self.profiler = LinkedInProfiler(brightdata_client)

    async def collect_connection_observations(
        self,
        *,
        entity_name: str,
        target_people: List[Dict[str, Any]],
        yp_members: List[Dict[str, Any]],
        bridge_contacts: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        observations: List[Dict[str, Any]] = []
        bridge_names = {_normalize_name(item.get("name")) for item in bridge_contacts}

        for yp_member in yp_members[:4]:
            yp_name = str(yp_member.get("name") or "").strip()
            if not yp_name:
                continue
            for target_person in target_people[:5]:
                target_name = str(target_person.get("name") or "").strip()
                if not target_name:
                    continue
                mutuals = await self.profiler._find_mutual_connections(yp_name, target_name)
                for mutual_name in mutuals[:3]:
                    observations.append(
                        {
                            "yp_member": yp_name,
                            "target_person": target_name,
                            "edge_type": "mutual_connection",
                            "mutual_name": mutual_name,
                            "confidence": 55.0 if _normalize_name(mutual_name) in bridge_names else 48.0,
                            "evidence_url": str(target_person.get("linkedin_url") or "").strip() or None,
                            "source": "linkedin_profiler._find_mutual_connections",
                            "entity_name": entity_name,
                        }
                    )
        return observations


class ConnectionsGraphEnricher:
    def __init__(self, provider: Any):
        self.provider = provider

    async def enrich(
        self,
        *,
        connections_graph: Dict[str, Any],
        poi_graph: Optional[Dict[str, Any]] = None,
        entity_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await enrich_connections_graph(
            connections_graph=connections_graph,
            poi_graph=poi_graph,
            provider=self.provider,
            entity_name=entity_name,
        )


async def enrich_connections_graph(
    *,
    connections_graph: Dict[str, Any],
    provider: Any,
    poi_graph: Optional[Dict[str, Any]] = None,
    entity_name: Optional[str] = None,
) -> Dict[str, Any]:
    graph = deepcopy(connections_graph if isinstance(connections_graph, dict) else {})
    yp_members = _yp_members_from_graph(graph)
    target_people = _target_people_from_graph(graph)
    bridge_contacts = _bridge_contacts_from_graph(graph)
    resolved_entity_name = str(entity_name or graph.get("entity_name") or (poi_graph or {}).get("entity_name") or "").strip()

    if not yp_members or not target_people or provider is None:
        return graph

    observations = await provider.collect_connection_observations(
        entity_name=resolved_entity_name,
        target_people=target_people,
        yp_members=yp_members,
        bridge_contacts=bridge_contacts,
    )

    seen_edges = {
        (
            str(edge.get("from_id") or "").strip(),
            str(edge.get("edge_type") or "").strip(),
            str(edge.get("to_id") or "").strip(),
            str(edge.get("mutual_name") or "").strip(),
        )
        for edge in _graph_edges(graph)
    }

    def add_edge(edge: Dict[str, Any]) -> None:
        key = (
            str(edge.get("from_id") or "").strip(),
            str(edge.get("edge_type") or "").strip(),
            str(edge.get("to_id") or "").strip(),
            str(edge.get("mutual_name") or "").strip(),
        )
        if not key[0] or not key[1] or not key[2] or key in seen_edges:
            return
        seen_edges.add(key)
        graph.setdefault("edges", []).append(edge)

    for observation in observations:
        if not isinstance(observation, dict):
            continue
        yp_name = str(observation.get("yp_member") or "").strip()
        target_name = str(observation.get("target_person") or "").strip()
        edge_type = str(observation.get("edge_type") or "").strip().lower()
        if edge_type not in {"direct_connection", "mutual_connection"}:
            continue
        from_id = _find_node_id_by_name(graph, node_type="yp_member", name=yp_name) or yp_name
        to_id = _find_node_id_by_name(graph, node_type="person", name=target_name)
        if not to_id:
            continue
        mutual_name = str(observation.get("mutual_name") or "").strip()
        add_edge(
            {
                "from_id": from_id,
                "to_id": to_id,
                "edge_type": edge_type,
                "confidence": float(observation.get("confidence") or 0.0),
                "mutual_name": mutual_name or None,
                "evidence_url": str(observation.get("evidence_url") or "").strip() or None,
                "source": str(observation.get("source") or "").strip() or None,
            }
        )
        if edge_type == "mutual_connection" and mutual_name:
            bridge_id = _find_node_id_by_name(graph, node_type="bridge_contact", name=mutual_name)
            if bridge_id:
                add_edge(
                    {
                        "from_id": bridge_id,
                        "to_id": to_id,
                        "edge_type": "bridge_to_target",
                        "confidence": float(observation.get("confidence") or 0.0),
                        "source": str(observation.get("source") or "").strip() or None,
                    }
                )

    graph["enriched_at"] = _iso_now()
    graph["enrichment_source"] = str(graph.get("enrichment_source") or "connections_graph_enricher")
    return graph


def build_default_connections_graph_enricher(brightdata_client: Any | None = None) -> Optional[ConnectionsGraphEnricher]:
    if brightdata_client is None:
        return None
    return ConnectionsGraphEnricher(LinkedInBrightDataConnectionsProvider(brightdata_client))


def connections_enrichment_enabled_by_default() -> bool:
    raw = str(os.getenv("QUESTION_FIRST_ENABLE_CONNECTIONS_ENRICHMENT", "")).strip().lower()
    return raw in {"1", "true", "yes", "on"}
