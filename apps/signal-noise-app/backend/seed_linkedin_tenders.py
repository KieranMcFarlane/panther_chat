#!/usr/bin/env python3
"""
Seed LinkedIn tenders/RFPs into Neo4j using Bright Data MCP HTTP tools (SERP + scrape).
Filters: last 12 months; services: website, digital, apps, mobile apps, application, platform, web app, CMS, API, Android, iOS.
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List

import requests

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.neo4j_client import Neo4jMCPClient  # type: ignore


BRIGHTDATA_MCP_URL = os.getenv('BRIGHTDATA_MCP_URL', 'http://localhost:8014')


def normalize_https(url: str) -> str:
    if not url:
        return url
    if url.startswith('http://'):
        url = 'https://' + url[len('http://'):]
    if not url.startswith('https://'):
        url = 'https://' + url
    return url


def search_linkedin_tenders_for_org(mcp_url: str, organization: str, limit: int = 20) -> List[Dict[str, Any]]:
    query = (
        'site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) '
        '(website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS) '
        f'"{organization}"'
    )
    try:
        resp = requests.post(
            f"{mcp_url}/tools/search_serp",
            headers={"Content-Type": "application/json"},
            json={"query": query, "engine": "google", "limit": limit, "time_range": "past_year"},
            timeout=45,
        )
    except Exception as e:
        print(f"❌ SERP request failed for {organization}: {e}")
        return []

    urls: List[str] = []
    if resp.ok:
        data = resp.json()
        results = data.get('results') or data.get('serpData', {}).get('results') or []
        for item in results:
            url = item.get('url') or ''
            if 'linkedin.com' in url:
                urls.append(normalize_https(url))

    tenders: List[Dict[str, Any]] = []
    import re
    rfpk = re.compile(r"(\bRFP\b|Request\s+for\s+Proposal|\bTender\b|\bEOI\b|\bRFI\b|\bRFQ\b)", re.I)
    servicek = re.compile(r"(website|digital|mobile\s+app|\bapps?\b|application|platform|web\s*app|CMS|API|Android|iOS)", re.I)
    deadlinek = re.compile(r"(deadline|due\s*date|closing)[:\s-]*([\w]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})", re.I)
    valuek = re.compile(r"([$£€]\s?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\s*(?:[kKmM]|million|bn)?|USD|GBP|EUR)")

    cutoff = datetime.now() - timedelta(days=365)

    for url in urls[:10]:
        try:
            sr = requests.post(
                f"{mcp_url}/tools/scrape_as_markdown",
                headers={"Content-Type": "application/json"},
                json={"url": url, "format": "markdown"},
                timeout=60,
            )
            if not sr.ok:
                continue
            body = sr.json()
            text = body.get('markdown') or body.get('content') or ''
            if not text:
                continue
        except Exception as e:
            print(f"⚠️  Scrape failed for {url}: {e}")
            continue

        if not rfpk.search(text) or not servicek.search(text):
            continue

        deadline_match = deadlinek.search(text)
        value_match = valuek.search(text)
        published = datetime.now()
        if published < cutoff:
            continue

        tenders.append({
            'title': f"RFP/Tender Opportunity - {organization}",
            'type': 'RFP',
            'value': value_match.group(0) if value_match else 'TBD',
            'deadline': deadline_match.group(2) if deadline_match else '',
            'description': 'LinkedIn post mentioning RFP/Tender with digital/app keywords',
            'status': 'Open',
            'url': url,
            'source': 'LinkedIn',
            'publishedDate': published.strftime('%Y-%m-%d'),
        })

    return tenders


def upsert_tenders_for_org(neo: Neo4jMCPClient, organization: str, tenders: List[Dict[str, Any]]) -> bool:
    if not tenders:
        return True
    try:
        query = (
            "MATCH (e:Entity {name: $name}) "
            "SET e.tenders_rfps = $tenders, e.enriched_at = $enriched_at "
            "RETURN e"
        )
        params = {
            'name': organization,
            'tenders': json.dumps(tenders),
            'enriched_at': datetime.now().isoformat(),
        }
        res = neo.execute_cypher_query(query, params)
        return res.get('status') == 'success'
    except Exception as e:
        print(f"❌ Neo4j upsert failed for {organization}: {e}")
        return False


def get_target_orgs(neo: Neo4jMCPClient, limit: int = 10) -> List[str]:
    q = (
        "MATCH (e:Entity) "
        "WHERE e.source = 'sports_csv_seeder' "
        "RETURN e.name AS name "
        "LIMIT $limit"
    )
    res = neo.execute_cypher_query(q, {'limit': limit})
    orgs: List[str] = []
    if res.get('status') == 'success':
        for row in res.get('results', []):
            name = row.get('name') or row.get('e.name')
            if name:
                orgs.append(name)
    return orgs


def main() -> None:
    print("🏁 Seeding LinkedIn tenders/RFPs via Bright Data MCP (SERP+scrape)")
    print(f"🔌 MCP: {BRIGHTDATA_MCP_URL}")
    neo = Neo4jMCPClient()

    orgs = get_target_orgs(neo, limit=10)
    if not orgs:
        print("❌ No organizations found to enrich")
        sys.exit(1)

    total_added = 0
    for idx, org in enumerate(orgs, 1):
        print(f"\n[{idx}/{len(orgs)}] 🔎 {org}")
        tenders = search_linkedin_tenders_for_org(BRIGHTDATA_MCP_URL, org)
        print(f"→ found {len(tenders)} tenders")
        if tenders:
            if upsert_tenders_for_org(neo, org, tenders):
                print("✅ Neo4j updated")
                total_added += len(tenders)
            else:
                print("❌ Neo4j update failed")
        time.sleep(2)

    print(f"\n🎉 Done. Total tenders seeded: {total_added}")


if __name__ == '__main__':
    main()




