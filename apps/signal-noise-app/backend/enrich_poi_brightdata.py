#!/usr/bin/env python3
"""
Use Bright Data MCP to enrich specific targets and add 3 persons of interest (key contacts) each.

Targets are hardcoded per user request. For each target:
- Search LinkedIn profiles with role queries: CEO, Head of Digital, Marketing Director
- Merge up to 3 unique contacts into the entity's key_contacts JSON property
- Also refresh company_info, recent_news, and tenders via MCP
- Update Neo4j (AuraDB via env) on the Entity node

Env:
  BRIGHTDATA_MCP_URL (default http://localhost:8014)
  NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, optional NEO4J_DATABASE
"""

import os
import sys
import json
import time
from typing import Dict, Any, List
from datetime import datetime
import requests

# Local backend imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.neo4j_client import Neo4jMCPClient


BRIGHTDATA_MCP_URL = os.getenv('BRIGHTDATA_MCP_URL', 'http://localhost:8014')


def normalize_https(url: str) -> str:
    if not url:
        return url
    if url.startswith('http://'):
        url = 'https://' + url[len('http://'):]
    if not url.startswith('https://') and not url.startswith('http'):
        url = 'https://' + url
    return url


def post(tool: str, payload: Dict[str, Any], timeout: int = 40) -> Dict[str, Any]:
    r = requests.post(
        f"{BRIGHTDATA_MCP_URL}{tool}",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    if r.status_code != 200:
        return {"success": False, "error": f"HTTP {r.status_code}"}
    return r.json()


def search_profiles(company: str, roles: List[str], limit_per_role: int = 3) -> List[Dict[str, Any]]:
    contacts: List[Dict[str, Any]] = []
    seen = set()
    for role in roles:
        data = post("/tools/search_linkedin_profiles", {"query": role, "company": company, "limit": limit_per_role})
        if not data.get('success'):
            continue
        for p in data.get('profiles', []):
            name = p.get('name') or 'Unknown'
            li = normalize_https(p.get('profileUrl', ''))
            key = (name, li)
            if key in seen:
                continue
            seen.add(key)
            contacts.append({
                "name": name,
                "role": p.get('title', role),
                "linkedin": li,
                "experience": p.get('experience', []),
                "connections": p.get('connections', 0),
            })
            if len(contacts) >= 3:
                break
        if len(contacts) >= 3:
            break
    return contacts


def search_company(company: str) -> Dict[str, Any]:
    data = post("/tools/search_company", {"query": company, "limit": 1}, timeout=30)
    if data.get('success'):
        c = data.get('company', {})
        return {
            "industry": c.get('industry', ''),
            "company_size": c.get('size', ''),
            "founded": c.get('founded', ''),
            "headquarters": c.get('location', ''),
            "description": c.get('description', ''),
        }
    return {}


def search_news(company: str) -> List[Dict[str, Any]]:
    data = post("/tools/search_engine", {"query": f"{company} latest news", "limit": 3}, timeout=30)
    news: List[Dict[str, Any]] = []
    if data.get('success'):
        for r in data.get('results', []):
            news.append({
                "title": r.get('title', 'News'),
                "url": r.get('url', ''),
                "snippet": r.get('snippet', ''),
            })
    return news


def search_linkedin_tenders(company: str) -> List[Dict[str, Any]]:
    query = (
        'site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) '
        '(website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS) '
        f'"{company}"'
    )
    serp = post("/tools/search_serp", {"query": query, "engine": "google", "limit": 10, "time_range": "past_year"}, timeout=45)
    urls: List[str] = []
    results = serp.get('results') or serp.get('serpData', {}).get('results') or []
    for item in results:
        url = item.get('url') or ''
        if 'linkedin.com' in url:
            urls.append(normalize_https(url))
    tenders: List[Dict[str, Any]] = []
    import re
    rfpk = re.compile(r"(\bRFP\b|Request\s+for\s+Proposal|\bTender\b|\bEOI\b|\bRFI\b|\bRFQ\b)", re.I)
    servicek = re.compile(r"(website|digital|mobile\s+app|\bapps?\b|application|platform|web\s*app|CMS|API|Android|iOS)", re.I)
    for u in urls[:6]:
        page = post("/tools/scrape_as_markdown", {"url": u, "format": "markdown"}, timeout=60)
        text = page.get('markdown') or page.get('content') or ''
        if not text:
            continue
        if not rfpk.search(text) or not servicek.search(text):
            continue
        tenders.append({
            'title': f"RFP/Tender Opportunity - {company}",
            'type': 'RFP',
            'value': 'TBD',
            'deadline': '',
            'description': 'Detected LinkedIn post mentioning RFP/Tender with digital/app keywords',
            'status': 'Open',
            'url': u,
            'source': 'LinkedIn',
        })
    return tenders


def update_entity(neo: Neo4jMCPClient, name: str, enrichment: Dict[str, Any]) -> bool:
    q = (
        "MATCH (e:Entity {name: $name}) "
        "SET e.company_info = $company_info, "
        "    e.tenders_rfps = $tenders_rfps, "
        "    e.key_contacts = $key_contacts, "
        "    e.enrichment_summary = $summary, "
        "    e.enriched_at = $enriched_at, "
        "    e.data_sources = $data_sources, "
        "    e.enriched = true "
        "RETURN e"
    )
    params = {
        "name": name,
        "company_info": json.dumps(enrichment.get('company_info', {})),
        "tenders_rfps": json.dumps(enrichment.get('tenders', [])),
        "key_contacts": json.dumps(enrichment.get('contacts', [])),
        "summary": enrichment.get('summary', ''),
        "enriched_at": datetime.now().isoformat(),
        "data_sources": json.dumps({"brightdata_mcp": "success"}),
    }
    res = neo.execute_cypher_query(q, params)
    return res.get('status') == 'success'


def main():
    targets = [
        "1. FC Köln",
        "1. FC Nürnberg",
        "2. Bundesliga",
        "Bayer 04 Leverkusen",
        "Bayern München",
        "Borussia Dortmund",
    ]

    print(f"🔌 Bright Data MCP: {BRIGHTDATA_MCP_URL}")
    neo = Neo4jMCPClient()

    for idx, name in enumerate(targets, 1):
        print("\n" + "=" * 60)
        print(f"🎯 {idx}/{len(targets)}: {name}")
        print("=" * 60)

        contacts = search_profiles(name, [
            "Chief Executive Officer",
            "Head of Digital",
            "Marketing Director",
        ], limit_per_role=5)

        company_info = search_company(name)
        news = search_news(name)
        tenders = search_linkedin_tenders(name)

        summary = (
            f"Auto-enriched via Bright Data MCP. Added {len(contacts)} persons of interest, "
            f"{len(news)} news items, and {len(tenders)} potential LinkedIn tenders."
        )

        enrichment = {
            "contacts": contacts[:3],
            "company_info": company_info,
            "tenders": tenders,
            "summary": summary,
        }

        ok = update_entity(neo, name, enrichment)
        print("✅ Updated" if ok else "❌ Update failed")
        time.sleep(2)

    print("\n✅ Completed Bright Data MCP enrichment for specified targets")


if __name__ == "__main__":
    main()


