#!/usr/bin/env python3
"""
Convert a CSV of global sports entities to JSON, purge previous CSV seeds, and seed into AuraDB.

Usage:
  python3 csv_to_json_and_seed.py \
    --csv "/Users/kieranmcfarlane/Downloads/panther_chat/yellow-panther-ai/scraping_data/Global Sports Entities_AI Biz Tool(merged).csv" \
    --out converted_entities.json

Env (AuraDB):
  NEO4J_URI=neo4j+s://cce1f84b.databases.neo4j.io
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=...
  NEO4J_DATABASE=neo4j (optional)
"""

import csv
import json
import argparse
import os
from typing import Dict, Any, List
from neo4j import GraphDatabase


NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://cce1f84b.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


def pick(row: Dict[str, Any], keys: List[str], default: Any = "") -> Any:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
    return default


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    s = str(value or "").strip().lower()
    return s in ("1", "true", "yes", "y", "t")


def normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    # Handle varied key casings/names between CSV and JSON schemas
    name = pick(row, ["name", "Name", "organization", "Organization", "Entity", "Club", "Entity Name"]) or ""
    sport = pick(row, ["sport", "Sport", "Category", "Discipline"]) or ""
    country = pick(row, ["country", "Country", "Nation", "Country/Region"]) or ""
    level = pick(row, ["level", "Level", "Division", "League", "Level/Division"]) or ""
    website = pick(row, ["website", "Website", "URL", "Site", "Website "]) or ""
    linkedin = pick(row, ["linkedin", "LinkedIn", "Linkedin", "LinkedIn URL", "LinkedIn Profile URL"]) or ""
    description = pick(row, ["description", "Description", "Notes", "Summary"]) or ""
    tier = pick(row, ["tier", "Tier", "TIER"]) or ""
    priority_score = pick(row, ["priorityScore", "PriorityScore", "Score", "Priority"])
    estimated_value = pick(row, ["estimatedValue", "Estimated Value", "Budget", "Value"]) or ""
    type_ = pick(row, ["type", "Type", "Entity Type"]) or ""
    opportunity_type = pick(row, ["opportunityType", "Opportunity Type"]) or ""
    digital_weakness = pick(row, ["digitalWeakness", "Digital Weakness"]) or ""
    mobile_app = pick(row, ["mobileApp", "MobileApp", "Mobile App"]) or ""
    notes = pick(row, ["notes", "Notes"]) or ""

    try:
        priority_score = float(priority_score) if str(priority_score).strip() != "" else None
    except Exception:
        priority_score = None

    return {
        "name": name.strip() if isinstance(name, str) else name,
        "description": description,
        "sport": sport,
        "website": website,
        "mobileApp": to_bool(mobile_app) if mobile_app != "" else "",
        "digitalWeakness": digital_weakness,
        "opportunityType": opportunity_type,
        "notes": notes,
        "tier": tier,
        "priorityScore": priority_score if priority_score is not None else "",
        "estimatedValue": estimated_value,
        "type": type_,
        "country": country,
        "level": level,
        "linkedin": linkedin,
        "source": "csv_seed",
    }


def read_csv(path: str) -> List[Dict[str, Any]]:
    entities: List[Dict[str, Any]] = []
    with open(path, "r", encoding="latin-1", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except Exception:
            dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        for row in reader:
            # Drop trailing empty header columns like ''
            row = {k: v for k, v in row.items() if k is not None and k != ''}
            norm = normalize_row(row)
            if norm.get("name"):
                entities.append(norm)
    return entities


def write_json(path: str, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def seed_auradb(entities: List[Dict[str, Any]]):
    if not NEO4J_PASSWORD:
        raise SystemExit("NEO4J_PASSWORD not set. Export Aura credentials and retry.")

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session(database=NEO4J_DATABASE) as session:
        # Remove old CSV seeds
        session.run("""
            MATCH (e:Entity)
            WHERE e.source IN ['csv_seed','sports_csv_seeder']
            DETACH DELETE e
        """)

        # Insert new entities
        cypher = """
        CREATE (e:Entity {
            name: $name,
            description: $description,
            sport: $sport,
            website: $website,
            mobileApp: $mobileApp,
            digitalWeakness: $digitalWeakness,
            opportunityType: $opportunityType,
            notes: $notes,
            tier: $tier,
            priorityScore: $priorityScore,
            estimatedValue: $estimatedValue,
            type: $type,
            country: $country,
            level: $level,
            linkedin: $linkedin,
            source: $source
        })
        """
        for e in entities:
            session.run(cypher, e)

    driver.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument("--out", default="converted_entities.json", help="Output JSON path")
    args = parser.parse_args()

    entities = read_csv(args.csv)
    write_json(args.out, entities)
    print(f"✅ Wrote JSON: {args.out} ({len(entities)} entities)")

    seed_auradb(entities)
    print("✅ Seeded entities into AuraDB")


if __name__ == "__main__":
    main()


