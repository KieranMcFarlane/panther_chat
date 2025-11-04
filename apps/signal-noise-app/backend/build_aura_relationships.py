#!/usr/bin/env python3
"""
Create relationships in AuraDB from existing Entity properties.

- Country   -> (:Country)      via (:Entity)-[:BASED_IN]->(:Country)
- Sport     -> (:Sport)        via (:Entity)-[:PLAYS_IN]->(:Sport)
- Tier      -> (:Tier)         via (:Entity)-[:HAS_TIER]->(:Tier)
- Type      -> (:Type)         via (:Entity)-[:HAS_TYPE]->(:Type)
- Contacts  -> (:Contact)      via (:Entity)-[:HAS_CONTACT]->(:Contact)
- Tenders   -> (:Tender)       via (:Entity)-[:HAS_TENDER]->(:Tender)

Environment variables required (AuraDB):
  NEO4J_URI       e.g. neo4j+s://cce1f84b.databases.neo4j.io
  NEO4J_USER      usually 'neo4j'
  NEO4J_PASSWORD  your Aura password
  NEO4J_DATABASE  optional, defaults to 'neo4j'
"""

import os
import json
from typing import Any, Dict, List
from neo4j import GraphDatabase


NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://cce1f84b.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


def run_write(session, cypher: str, params: Dict[str, Any] | None = None):
    return session.run(cypher, params or {})


def create_basic_relationships(session):
    # Country
    run_write(session, """
    MATCH (e:Entity)
    WHERE e.country IS NOT NULL AND e.country <> ''
    MERGE (c:Country {name: e.country})
    MERGE (e)-[:BASED_IN]->(c)
    """)

    # Sport
    run_write(session, """
    MATCH (e:Entity)
    WHERE e.sport IS NOT NULL AND e.sport <> ''
    MERGE (s:Sport {name: e.sport})
    MERGE (e)-[:PLAYS_IN]->(s)
    """)

    # Tier
    run_write(session, """
    MATCH (e:Entity)
    WHERE e.tier IS NOT NULL AND e.tier <> ''
    MERGE (t:Tier {name: e.tier})
    MERGE (e)-[:HAS_TIER]->(t)
    """)

    # Type
    run_write(session, """
    MATCH (e:Entity)
    WHERE e.type IS NOT NULL AND e.type <> ''
    MERGE (t:Type {name: e.type})
    MERGE (e)-[:HAS_TYPE]->(t)
    """)


def fetch_entities_with_json(session, field: str) -> List[Dict[str, Any]]:
    result = run_write(session, f"""
    MATCH (e:Entity)
    WHERE e.{field} IS NOT NULL AND e.{field} <> ''
    RETURN e.name AS name, e.{field} AS payload
    """)
    rows: List[Dict[str, Any]] = []
    for rec in result:
        rows.append({"name": rec["name"], "payload": rec["payload"]})
    return rows


def ensure_contact(session, entity_name: str, contact: Dict[str, Any]):
    cypher = """
    MATCH (e:Entity {name: $entity_name})
    MERGE (c:Contact {name: $name, linkedin: $linkedin})
    ON CREATE SET c.role = $role
    ON MATCH SET c.role = coalesce(c.role, $role)
    MERGE (e)-[:HAS_CONTACT {role: $role}]->(c)
    """
    params = {
        "entity_name": entity_name,
        "name": contact.get("name") or "Unknown",
        "role": contact.get("role") or "",
        "linkedin": contact.get("linkedin") or "",
    }
    run_write(session, cypher, params)


def ensure_tender(session, entity_name: str, tender: Dict[str, Any]):
    # Use URL when available; otherwise build a synthetic key from entity+title
    key = tender.get("url") or f"{entity_name}::{tender.get('title','Tender')}"
    cypher = """
    MATCH (e:Entity {name: $entity_name})
    MERGE (t:Tender {key: $key})
    SET t.title = $title,
        t.type = $type,
        t.value = $value,
        t.deadline = $deadline,
        t.source = $source,
        t.url = $url,
        t.publishedDate = $publishedDate,
        t.description = $description
    MERGE (e)-[:HAS_TENDER]->(t)
    """
    params = {
        "entity_name": entity_name,
        "key": key,
        "title": tender.get("title"),
        "type": tender.get("type"),
        "value": tender.get("value"),
        "deadline": tender.get("deadline"),
        "source": tender.get("source"),
        "url": tender.get("url"),
        "publishedDate": tender.get("publishedDate"),
        "description": tender.get("description"),
    }
    run_write(session, cypher, params)


def parse_json_payload(payload: Any) -> List[Dict[str, Any]]:
    if not payload:
        return []
    if isinstance(payload, list):
        return payload
    try:
        return json.loads(payload)
    except Exception:
        return []


def build_contacts(session):
    rows = fetch_entities_with_json(session, "key_contacts")
    for row in rows:
        contacts = parse_json_payload(row.get("payload"))
        for contact in contacts:
            ensure_contact(session, row["name"], contact)


def build_tenders(session):
    rows = fetch_entities_with_json(session, "tenders_rfps")
    for row in rows:
        tenders = parse_json_payload(row.get("payload"))
        for tender in tenders:
            ensure_tender(session, row["name"], tender)


def main():
    if not NEO4J_PASSWORD:
        raise SystemExit("NEO4J_PASSWORD not set. Please export Aura credentials and retry.")

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session(database=NEO4J_DATABASE) as session:
        # Basic relationships
        create_basic_relationships(session)
        # Derived relationships from JSON properties
        build_contacts(session)
        build_tenders(session)

    driver.close()
    print("✅ Relationships built on AuraDB")


if __name__ == "__main__":
    main()








