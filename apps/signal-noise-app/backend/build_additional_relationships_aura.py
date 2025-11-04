#!/usr/bin/env python3
"""
Create additional semantic relationships in AuraDB:

- MEMBER_OF: (:Entity {type:'Club'|'Team'|'Organization'})-[:MEMBER_OF]->(:Entity {type:'League'})
  Heuristic: match entity.level to league.name (case-insensitive substring either direction)

- GOVERNED_BY: (:Entity {type:'Club'|'League'})-[:GOVERNED_BY]->(:Entity {type:'Federation'|'International Federation'|'Continental Federation'})
  Heuristic: same sport (case-insensitive). For 'Federation' also same country. For 'International Federation' ignore country.

Env (AuraDB):
  NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, optional NEO4J_DATABASE
"""

import os
from neo4j import GraphDatabase


NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://cce1f84b.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


def run(session, cypher: str):
    session.run(cypher)


def main():
    if not NEO4J_PASSWORD:
        raise SystemExit("NEO4J_PASSWORD not set.")

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session(database=NEO4J_DATABASE) as session:
        # MEMBER_OF: entity.level ~ league.name, skip if entity itself is League
        run(session, """
        MATCH (e:Entity)
        WHERE coalesce(e.level,'') <> '' AND toLower(coalesce(e.type,'')) <> 'league'
        MATCH (le:Entity {type: 'League'})
        WHERE (
          toLower(e.level) CONTAINS toLower(le.name)
          OR toLower(le.name) CONTAINS toLower(e.level)
        )
        MERGE (e)-[:MEMBER_OF]->(le)
        """)

        # GOVERNED_BY: national federations by same sport & country
        run(session, """
        MATCH (e:Entity)
        WHERE e.type IN ['Club','League'] AND coalesce(e.sport,'') <> '' AND coalesce(e.country,'') <> ''
        MATCH (fed:Entity {type: 'Federation'})
        WHERE toLower(coalesce(fed.sport,'')) = toLower(e.sport)
          AND toLower(coalesce(fed.country,'')) = toLower(e.country)
        MERGE (e)-[:GOVERNED_BY]->(fed)
        """)

        # GOVERNED_BY: international federations by same sport, ignore country
        run(session, """
        MATCH (e:Entity)
        WHERE e.type IN ['Club','League'] AND coalesce(e.sport,'') <> ''
        MATCH (fed:Entity)
        WHERE fed.type IN ['International Federation','Continental Federation']
          AND toLower(coalesce(fed.sport,'')) = toLower(e.sport)
        MERGE (e)-[:GOVERNED_BY]->(fed)
        """)

    driver.close()
    print("✅ Additional relationships (MEMBER_OF, GOVERNED_BY) built on AuraDB")


if __name__ == "__main__":
    main()








