from __future__ import annotations

import os
import re
import time
from typing import Any

import redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


FALKORDB_HOST = os.environ.get("FALKORDB_HOST", "127.0.0.1")
FALKORDB_PORT = int(os.environ.get("FALKORDB_PORT", "6379"))
GRAPH_NAME = os.environ.get("SIGNAL_GRAPH_NAME", "signal_noise_poc")
MAX_NODE_SCAN = int(os.environ.get("SIGNAL_GRAPH_MAX_NODE_SCAN", "1000"))

IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class NodeRef(BaseModel):
    label: str
    id: str


class GraphNode(BaseModel):
    label: str
    id: str
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphRelationship(BaseModel):
    from_: NodeRef = Field(alias="from")
    type: str
    to: NodeRef
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphUpsertRequest(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    relationships: list[GraphRelationship] = Field(default_factory=list)


class GraphSearchRequest(BaseModel):
    query: str
    limit: int = 10
    labels: list[str] = Field(default_factory=list)


class GraphContextRequest(BaseModel):
    query: str = ""
    entityId: str | None = None
    limit: int = 5


def client() -> redis.Redis:
    return redis.Redis(host=FALKORDB_HOST, port=FALKORDB_PORT, decode_responses=True)


def validate_identifier(value: str, kind: str) -> str:
    if not IDENTIFIER_RE.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {kind}: {value}")
    return value


def cypher_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def cypher_value(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(cypher_value(item) for item in value) + "]"
    return cypher_string(str(value))


def cypher_map(properties: dict[str, Any]) -> str:
    safe_items = []
    for key, value in properties.items():
        validate_identifier(key, "property")
        safe_items.append(f"{key}: {cypher_value(value)}")
    return "{" + ", ".join(safe_items) + "}"


def graph_query(query: str) -> list[Any]:
    return client().execute_command("GRAPH.QUERY", GRAPH_NAME, query)


def first_label(labels: Any) -> str:
    if isinstance(labels, list) and labels:
        return str(labels[0])
    if isinstance(labels, str):
        match = re.match(r"^\[([A-Za-z_][A-Za-z0-9_]*)\]$", labels.strip())
        if match:
            return match.group(1)
    return str(labels or "")


def tokenize(value: str) -> set[str]:
    stop = {
        "about",
        "and",
        "around",
        "find",
        "for",
        "from",
        "has",
        "have",
        "the",
        "this",
        "where",
        "with",
    }
    tokens = set()
    for token in re.findall(r"[a-z0-9']+", value.lower()):
        if len(token) <= 2 or token in stop:
            continue
        tokens.add(token)
        if token.endswith("s") and len(token) > 3:
            tokens.add(token[:-1])
    return tokens


def node_text(node: dict[str, Any]) -> str:
    values = [
        node.get("label"),
        node.get("id"),
        node.get("name"),
        node.get("title"),
        node.get("description"),
        node.get("domain"),
        node.get("status"),
        node.get("text"),
    ]
    return " ".join(str(value or "") for value in values)


def fetch_nodes(limit: int = MAX_NODE_SCAN) -> list[dict[str, Any]]:
    response = graph_query(
        "MATCH (n) "
        "RETURN labels(n), n.id, n.name, n.title, n.description, n.domain, n.status, n.text "
        f"LIMIT {int(limit)}"
    )
    rows = response[1] if len(response) > 1 else []
    nodes: list[dict[str, Any]] = []
    for row in rows:
        labels, node_id, name, title, description, domain, status, text = row
        nodes.append(
            {
                "label": first_label(labels),
                "id": node_id,
                "name": name,
                "title": title,
                "description": description,
                "domain": domain,
                "status": status,
                "text": text,
            }
        )
    return nodes


def score_nodes(query: str, labels: list[str] | None = None, limit: int = 10) -> list[dict[str, Any]]:
    query_tokens = tokenize(query)
    wanted_labels = {label.lower() for label in labels or []}
    scored: list[tuple[int, dict[str, Any]]] = []

    for node in fetch_nodes():
        if wanted_labels and node.get("label", "").lower() not in wanted_labels:
            continue
        text = node_text(node)
        node_tokens = tokenize(text)
        score = len(query_tokens & node_tokens) * 10
        lowered = text.lower()
        for token in query_tokens:
            if token in lowered:
                score += 3
        if node.get("label") in {"Opportunity", "Tender"}:
            score += 6
        if score:
            scored.append((score, node))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [{**node, "score": score} for score, node in scored[: max(1, min(limit, 25))]]


def relationship_context(entity_id: str, limit: int = 20) -> list[dict[str, Any]]:
    query = (
        f"MATCH (n {{id: {cypher_string(entity_id)}}})-[r]-(m) "
        "RETURN labels(n), n.id, coalesce(n.name, n.title, n.id), "
        "type(r), labels(m), m.id, coalesce(m.name, m.title, m.id), "
        "m.description, m.status "
        f"LIMIT {max(1, min(limit, 50))}"
    )
    response = graph_query(query)
    rows = response[1] if len(response) > 1 else []
    edges = []
    for row in rows:
        source_labels, source_id, source_name, rel_type, target_labels, target_id, target_name, target_description, target_status = row
        edges.append(
            {
                "source": {
                    "label": first_label(source_labels),
                    "id": source_id,
                    "name": source_name,
                },
                "type": rel_type,
                "target": {
                    "label": first_label(target_labels),
                    "id": target_id,
                    "name": target_name,
                    "description": target_description,
                    "status": target_status,
                },
            }
        )
    return edges


def warm_opportunities(limit: int = 10) -> list[dict[str, Any]]:
    query = (
        "MATCH (p:Person)-[:WORKS_WITH]->(c:Company)-[:SPONSORED]->(club:Club)-[:HAS_TENDER]->(t:Tender) "
        "OPTIONAL MATCH (p)-[i:INTERACTED_WITH]->(us:Source {id: 'source:signal-noise'}) "
        "RETURN p.name, c.name, club.name, t.title, t.status, i.date "
        f"LIMIT {max(1, min(limit, 25))}"
    )
    response = graph_query(query)
    rows = response[1] if len(response) > 1 else []
    return [
        {
            "person": row[0],
            "company": row[1],
            "club": row[2],
            "tender": row[3],
            "status": row[4],
            "lastInteraction": row[5],
        }
        for row in rows
    ]


app = FastAPI(title="Signal Noise Graph POC")


@app.get("/health")
async def health() -> dict[str, Any]:
    pong = client().ping()
    node_count_response = graph_query("MATCH (n) RETURN count(n)")
    node_count = node_count_response[1][0][0] if len(node_count_response) > 1 and node_count_response[1] else 0
    return {
        "status": "healthy" if pong else "unhealthy",
        "graph": GRAPH_NAME,
        "host": FALKORDB_HOST,
        "port": FALKORDB_PORT,
        "nodes": node_count,
        "time": time.time(),
    }


@app.post("/graph/upsert")
async def upsert(request: GraphUpsertRequest) -> dict[str, Any]:
    for node in request.nodes:
        label = validate_identifier(node.label, "label")
        properties = {"id": node.id, **node.properties}
        graph_query(f"MERGE (n:{label} {{id: {cypher_string(node.id)}}}) SET n += {cypher_map(properties)}")

    for relationship in request.relationships:
        from_label = validate_identifier(relationship.from_.label, "from label")
        to_label = validate_identifier(relationship.to.label, "to label")
        rel_type = validate_identifier(relationship.type, "relationship type")
        properties = relationship.properties
        query = (
            f"MERGE (a:{from_label} {{id: {cypher_string(relationship.from_.id)}}}) "
            f"MERGE (b:{to_label} {{id: {cypher_string(relationship.to.id)}}}) "
            f"MERGE (a)-[r:{rel_type}]->(b) "
            f"SET r += {cypher_map(properties)} "
            "RETURN a.id, type(r), b.id"
        )
        graph_query(query)

    return {
        "ok": True,
        "nodesUpserted": len(request.nodes),
        "relationshipsUpserted": len(request.relationships),
        "graph": GRAPH_NAME,
    }


@app.post("/graph/search")
async def search(request: GraphSearchRequest) -> dict[str, Any]:
    return {
        "query": request.query,
        "results": score_nodes(request.query, request.labels, request.limit),
    }


@app.post("/graph/context")
async def context(request: GraphContextRequest) -> dict[str, Any]:
    seeds = []
    if request.entityId:
        matching = [node for node in fetch_nodes() if node.get("id") == request.entityId]
        seeds.extend({**node, "score": 999} for node in matching)
    if request.query:
        seeds.extend(score_nodes(request.query, limit=request.limit))

    deduped: dict[str, dict[str, Any]] = {}
    for seed in seeds:
        if seed.get("id") and seed["id"] not in deduped:
            deduped[seed["id"]] = seed

    selected = list(deduped.values())[: max(1, min(request.limit, 10))]
    edges = []
    for node in selected:
        if node.get("id"):
            edges.extend(relationship_context(node["id"], limit=12))

    opportunities = warm_opportunities() if re.search(r"\b(warm|opportunit|tender|club|connected)\b", request.query.lower()) else []

    return {
        "query": request.query,
        "seeds": selected,
        "relationships": edges,
        "warmOpportunities": opportunities,
    }
