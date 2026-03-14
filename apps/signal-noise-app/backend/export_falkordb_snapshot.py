#!/usr/bin/env python3
"""
Export FalkorDB graph snapshot (entities + relationships) as JSON.
"""

import json
import os
import sys
import urllib.parse
from pathlib import Path

from dotenv import load_dotenv
from falkordb import FalkorDB


def _load_env() -> None:
    repo_env = Path(__file__).resolve().parent.parent / ".env"
    if repo_env.exists():
        load_dotenv(repo_env)


def _connect():
    uri = os.getenv("FALKORDB_URI")
    if not uri:
        raise RuntimeError("FALKORDB_URI is required")

    username = os.getenv("FALKORDB_USER", "falkordb")
    password = os.getenv("FALKORDB_PASSWORD", "")
    database = os.getenv("FALKORDB_DATABASE", "sports_intelligence")

    parsed = urllib.parse.urlparse(uri.replace("rediss://", "http://"))
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379

    db = FalkorDB(host=host, port=port, username=username, password=password, ssl=False)
    graph = db.select_graph(database)
    return graph


def _to_entity_rows(graph):
    result = graph.query(
        """
        MATCH (n)
        RETURN
          id(n) as internal_id,
          coalesce(n.neo4j_id, toString(id(n))) as graph_id,
          labels(n) as labels,
          properties(n) as props
        ORDER BY graph_id
        """
    )
    entities = []
    for row in result.result_set:
        internal_id, graph_id, labels, props = row
        entities.append(
            {
                "id": str(internal_id),
                "neo4j_id": str(graph_id),
                "labels": labels or [],
                "properties": dict(props or {}),
            }
        )
    return entities


def _to_relationship_rows(graph):
    result = graph.query(
        """
        MATCH (n1)-[r]->(n2)
        RETURN
          id(n1) as source_internal_id,
          coalesce(n1.neo4j_id, toString(id(n1))) as source_graph_id,
          labels(n1) as source_labels,
          coalesce(n1.name, '') as source_name,
          type(r) as relationship_type,
          properties(r) as relationship_props,
          id(n2) as target_internal_id,
          coalesce(n2.neo4j_id, toString(id(n2))) as target_graph_id,
          labels(n2) as target_labels,
          coalesce(n2.name, '') as target_name
        """
    )
    relationships = []
    for row in result.result_set:
        (
            source_internal_id,
            source_graph_id,
            source_labels,
            source_name,
            relationship_type,
            relationship_props,
            target_internal_id,
            target_graph_id,
            target_labels,
            target_name,
        ) = row

        relationships.append(
            {
                "source_element_id": str(source_internal_id),
                "source_neo4j_id": str(source_graph_id),
                "source_labels": source_labels or [],
                "source_name": source_name or "",
                "relationship_type": relationship_type,
                "relationship_properties": dict(relationship_props or {}),
                "target_element_id": str(target_internal_id),
                "target_neo4j_id": str(target_graph_id),
                "target_labels": target_labels or [],
                "target_name": target_name or "",
            }
        )
    return relationships


def main() -> int:
    try:
        _load_env()
        graph = _connect()

        entities = _to_entity_rows(graph)
        relationships = _to_relationship_rows(graph)

        payload = {
            "success": True,
            "entities": entities,
            "relationships": relationships,
            "counts": {"entities": len(entities), "relationships": len(relationships)},
        }
        print(json.dumps(payload))
        return 0
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
