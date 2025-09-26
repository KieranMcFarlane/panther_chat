#!/usr/bin/env python3
"""
Enrich three teams using Bright Data MCP's LinkedIn profiles search.

Usage:
  BRIGHTDATA_MCP_URL=http://localhost:8014 python3 linkedin_enrich_three.py "Team A" "Team B" "Team C"

If no teams are provided, defaults are used.
"""

import os
import sys
import json
import time
from typing import Any, Dict, List

import requests


BRIGHTDATA_MCP_URL = os.getenv("BRIGHTDATA_MCP_URL", "http://localhost:8014")


def search_linkedin_profiles(company: str, query: str = "Chief Executive Officer", limit: int = 5) -> Dict[str, Any]:
    try:
        resp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/search_linkedin_profiles",
            headers={"Content-Type": "application/json"},
            json={"query": query, "company": company, "limit": limit},
            timeout=45,
        )
        if not resp.ok:
            return {"success": False, "error": f"HTTP {resp.status_code}"}
        return resp.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


def main() -> None:
    # Teams from CLI or defaults
    teams: List[str] = [t for t in sys.argv[1:] if t.strip()]
    if len(teams) == 0:
        teams = [
            "Cricket West Indies",
            "Leeds Rhinos",
            "Arsenal FC",
        ]

    print(f"🔌 Bright Data MCP: {BRIGHTDATA_MCP_URL}")
    print(f"🎯 Teams: {', '.join(teams[:3])}")

    results: Dict[str, Any] = {"source": "BrightData MCP", "teams": []}

    for idx, team in enumerate(teams[:3], 1):
        print(f"\n[{idx}/3] 👥 Searching LinkedIn profiles for: {team}")
        data = search_linkedin_profiles(company=team, query="Chief Executive Officer", limit=5)
        if not data.get("success"):
            print(f"❌ Failed for {team}: {data.get('error', 'Unknown error')}")
            results["teams"].append({"team": team, "success": False, "error": data.get("error")})
            continue

        profiles = data.get("profiles", [])
        print(f"✅ Found {len(profiles)} profiles for {team}")
        slim = [
            {
                "name": p.get("name"),
                "title": p.get("title"),
                "company": p.get("company"),
                "location": p.get("location"),
                "profileUrl": p.get("profileUrl"),
            }
            for p in profiles
        ]
        results["teams"].append({
            "team": team,
            "success": True,
            "totalProfiles": len(slim),
            "profiles": slim,
        })
        time.sleep(1)

    print("\n" + json.dumps(results, indent=2))


if __name__ == "__main__":
    main()









