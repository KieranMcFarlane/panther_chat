#!/usr/bin/env python3
"""
Normalize and assign sport categories for Entities in AuraDB.

- Builds (:SportCategory {name}) and (e)-[:IN_SPORT_CATEGORY]->(:SportCategory)
- Heuristics handle CSV/JSON schema differences and missing/empty sports.

ENV:
  NEO4J_URI=neo4j+s://cce1f84b.databases.neo4j.io
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=...
  NEO4J_DATABASE=neo4j (optional)
"""

import os
import re
from typing import Optional
from neo4j import GraphDatabase


NEO4J_URI = os.getenv("NEO4J_URI", "neo4j+s://cce1f84b.databases.neo4j.io")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


def canonical_sport(raw: Optional[str], name: str, level: str) -> str:
    s = (raw or "").strip().lower()
    if s in ("soccer", "football", "association football"):
        return "Football"
    if s in ("rugby", "rugby union", "rugby league"):
        return "Rugby"
    if s in ("cricket",):
        return "Cricket"
    if s in ("basketball",):
        return "Basketball"
    if s in ("tennis",):
        return "Tennis"
    if s in ("ice hockey", "hockey"):  # prefer ice hockey
        return "Ice Hockey"
    if s in ("cycling",):
        return "Cycling"
    if s in ("motorsport", "formula 1", "f1", "motogp"):
        return "Motorsport"

    # Heuristics from name/level
    n = (name or "").lower()
    l = (level or "").lower()

    football_kw = [
        "premier league", "bundesliga", "serie a", "la liga", "ligue 1", "eredivisie",
        "efl", "championship", "fc ", " ac ", " sc ", " afc ", " united", " city", " rangers",
        "cup", "fa ", "uefa", "europa", "champions league"
    ]
    if any(k in n for k in [" fc", " afc", " sc ", " united", " athletic", " calcio"]) or any(k in l for k in football_kw) or any(k in n for k in football_kw):
        return "Football"

    rugby_kw = ["urc", "top 14", "premiership rugby", "six nations", "super rugby"]
    if any(k in n for k in rugby_kw) or any(k in l for k in rugby_kw):
        return "Rugby"

    cricket_kw = ["ipl", "big bash", "county", "cricket"]
    if any(k in n for k in cricket_kw) or any(k in l for k in cricket_kw):
        return "Cricket"

    tennis_kw = ["atp", "wta", "tennis"]
    if any(k in n for k in tennis_kw) or any(k in l for k in tennis_kw):
        return "Tennis"

    basketball_kw = ["nba", "euroleague", "basketball"]
    if any(k in n for k in basketball_kw) or any(k in l for k in basketball_kw):
        return "Basketball"

    ice_kw = ["nhl", "khl", "ice hockey"]
    if any(k in n for k in ice_kw) or any(k in l for k in ice_kw):
        return "Ice Hockey"

    motors_kw = ["f1", "formula 1", "motogp", "indycar"]
    if any(k in n for k in motors_kw) or any(k in l for k in motors_kw):
        return "Motorsport"

    # Esports hint
    if "esports" in n or "esport" in n:
        return "Esports"

    return "Unknown"


def main():
    if not NEO4J_PASSWORD:
        raise SystemExit("NEO4J_PASSWORD not set.")

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session(database=NEO4J_DATABASE) as session:
        # Pull entities in manageable chunks
        result = session.run(
            """
            MATCH (e:Entity)
            RETURN e.name AS name, coalesce(e.sport,'') AS sport, coalesce(e.level,'') AS level
            """
        )
        rows = list(result)

        for rec in rows:
            name = rec["name"]
            sport = rec["sport"]
            level = rec["level"]
            category = canonical_sport(sport, name, level)

            # Create/attach SportCategory
            session.run(
                """
                MATCH (e:Entity {name: $name})
                MERGE (sc:SportCategory {name: $category})
                MERGE (e)-[:IN_SPORT_CATEGORY]->(sc)
                """,
                {"name": name, "category": category},
            )

        # Optional: return a quick distribution
        dist = session.run(
            """
            MATCH (sc:SportCategory)<-[:IN_SPORT_CATEGORY]-(:Entity)
            RETURN sc.name AS category, count(*) AS c ORDER BY c DESC
            """
        )
        print("Category distribution:")
        for d in dist:
            print(f"  {d['category']}: {d['c']}")

    driver.close()
    print("✅ Sport categories assigned")


if __name__ == "__main__":
    main()








