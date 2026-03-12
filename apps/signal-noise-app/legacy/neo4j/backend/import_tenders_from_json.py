#!/usr/bin/env python3
"""
Import LinkedIn tenders/RFPs (exported as JSON) into Neo4j.
Accepts a file containing an array of tenders with fields:
  title, type, value, deadline, description, status, url, source, publishedDate, organization (optional)

Creates/updates Tender nodes and links to existing Entity nodes by organization name when available.
"""

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.neo4j_client import Neo4jMCPClient  # type: ignore


def load_tenders(path: str) -> List[Dict[str, Any]]:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict) and 'tenders' in data:
            return data['tenders']
        if isinstance(data, list):
            return data
        raise ValueError('Unsupported JSON format')


def upsert_tender(neo: Neo4jMCPClient, tender: Dict[str, Any]) -> None:
    url = tender.get('url') or ''
    if not url:
        return
    title = tender.get('title') or 'Tender/RFP'
    ttype = tender.get('type') or 'RFP'
    value = tender.get('value') or 'TBD'
    deadline = tender.get('deadline') or ''
    description = tender.get('description') or ''
    status = tender.get('status') or 'Open'
    source = tender.get('source') or 'LinkedIn'
    published = tender.get('publishedDate') or datetime.now().strftime('%Y-%m-%d')
    organization = tender.get('organization') or ''

    query = (
        "MERGE (t:Tender {url: $url}) "
        "SET t.title=$title, t.type=$type, t.value=$value, t.deadline=$deadline, "
        "    t.description=$description, t.status=$status, t.source=$source, t.publishedDate=$published "
        "RETURN t"
    )
    res = neo.execute_cypher_query(query, {
        'url': url,
        'title': title,
        'type': ttype,
        'value': value,
        'deadline': deadline,
        'description': description,
        'status': status,
        'source': source,
        'published': published,
    })
    if res.get('status') != 'success':
        print(f"❌ Failed to upsert Tender node for {url}: {res.get('error')}")

    if organization:
        link_q = (
            "MATCH (e:Entity {name: $org}), (t:Tender {url: $url}) "
            "MERGE (e)-[:HAS_TENDER]->(t) "
            "RETURN e, t"
        )
        link_res = neo.execute_cypher_query(link_q, {'org': organization, 'url': url})
        if link_res.get('status') != 'success':
            print(f"⚠️  Could not link Tender to Entity '{organization}'")


def main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python3 import_tenders_from_json.py <path_to_json>')
        sys.exit(1)
    path = sys.argv[1]
    tenders = load_tenders(path)
    print(f"📦 Importing {len(tenders)} tenders from {path}")
    neo = Neo4jMCPClient()
    imported = 0
    for t in tenders:
        upsert_tender(neo, t)
        imported += 1
    print(f"✅ Imported {imported} tenders into Neo4j")


if __name__ == '__main__':
    main()




