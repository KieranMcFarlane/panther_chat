#!/usr/bin/env python3
"""
Enrich specific teams with Bright Data MCP only (no Perplexity), and update Neo4j.

Usage:
  python3 enrich_specific_brightdata.py

Environment:
  BRIGHTDATA_MCP_URL  (default: http://localhost:8014)
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List

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
    if not url.startswith('https://'):
        url = 'https://' + url
    return url


def search_company_mcp(company_name: str) -> Dict[str, Any]:
    try:
        resp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/search_company",
            headers={"Content-Type": "application/json"},
            json={"query": company_name, "limit": 1},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get('success'):
                company = data.get('company', {})
                return {
                    "company_info": {
                        "industry": company.get('industry', 'Sports & Recreation'),
                        "company_size": company.get('size', '1000-5000 employees'),
                        "founded": company.get('founded', '1900s'),
                        "headquarters": company.get('location', 'Unknown'),
                        "description": company.get('description', ''),
                    }
                }
        return {"company_info": {}}
    except Exception as e:
        print(f"⚠️  Company MCP failed: {e}")
        return {"company_info": {}}


def search_linkedin_mcp(company_name: str) -> Dict[str, Any]:
    try:
        resp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/search_linkedin_profiles",
            headers={"Content-Type": "application/json"},
            json={"query": "Chief Executive Officer", "company": company_name, "limit": 3},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get('success'):
                profiles = data.get('profiles', [])
                contacts = []
                for p in profiles:
                    contacts.append({
                        "name": p.get('name', 'Unknown'),
                        "role": p.get('title', 'Unknown'),
                        "linkedin": normalize_https(p.get('profileUrl', '')),
                        "experience": p.get('experience', []),
                        "connections": p.get('connections', 0),
                    })
                return {
                    "contacts": contacts,
                    "social_media": {
                        "linkedin": normalize_https(f"https://linkedin.com/company/{company_name.lower().replace(' ', '-')}")
                    },
                }
        return {"contacts": [], "social_media": {}}
    except Exception as e:
        print(f"⚠️  LinkedIn MCP failed: {e}")
        return {"contacts": [], "social_media": {}}


def search_news_mcp(company_name: str) -> Dict[str, Any]:
    try:
        resp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/search_engine",
            headers={"Content-Type": "application/json"},
            json={"query": f"{company_name} latest news", "limit": 3},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get('success'):
                results = data.get('results', [])
                news = []
                for r in results:
                    news.append({
                        "title": r.get('title', 'News article'),
                        "date": datetime.now().strftime("%Y-%m-%d"),
                        "url": r.get('url', ''),
                        "snippet": r.get('snippet', ''),
                    })
                return {"recent_news": news}
        return {"recent_news": []}
    except Exception as e:
        print(f"⚠️  News MCP failed: {e}")
        return {"recent_news": []}


def search_linkedin_tenders_mcp(company_name: str) -> Dict[str, Any]:
    try:
        query = (
            'site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) '
            '(website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS) '
            f'"{company_name}"'
        )
        serp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/search_serp",
            headers={"Content-Type": "application/json"},
            json={"query": query, "engine": "google", "limit": 20, "time_range": "past_year"},
            timeout=45,
        )
        urls: List[str] = []
        if serp.status_code == 200:
            sdata = serp.json()
            results = sdata.get('results') or sdata.get('serpData', {}).get('results') or []
            for item in results:
                url = item.get('url') or ''
                if 'linkedin.com' in url:
                    urls.append(normalize_https(url))

        import re
        rfpk = re.compile(r"(\bRFP\b|Request\s+for\s+Proposal|\bTender\b|\bEOI\b|\bRFI\b|\bRFQ\b)", re.I)
        servicek = re.compile(r"(website|digital|mobile\s+app|\bapps?\b|application|platform|web\s*app|CMS|API|Android|iOS)", re.I)
        deadlinek = re.compile(r"(deadline|due\s*date|closing)[:\s-]*([\w]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})", re.I)
        valuek = re.compile(r"([$£€]\s?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\s*(?:[kKmM]|million|bn)?|USD|GBP|EUR)")

        cutoff = datetime.now() - timedelta(days=365)
        tenders: List[Dict[str, Any]] = []
        for url in urls[:10]:
            sr = requests.post(
                f"{BRIGHTDATA_MCP_URL}/tools/scrape_as_markdown",
                headers={"Content-Type": "application/json"},
                json={"url": url, "format": "markdown"},
                timeout=60,
            )
            if sr.status_code != 200:
                continue
            data = sr.json()
            text = data.get('markdown') or data.get('content') or ''
            if not text:
                continue
            if not rfpk.search(text) or not servicek.search(text):
                continue
            deadline_match = deadlinek.search(text)
            value_match = valuek.search(text)
            published = datetime.now()
            if published < cutoff:
                continue
            tenders.append({
                'title': f"RFP/Tender Opportunity - {company_name}",
                'type': 'RFP',
                'value': value_match.group(0) if value_match else 'TBD',
                'deadline': deadline_match.group(2) if deadline_match else '',
                'description': 'Detected LinkedIn post mentioning RFP/Tender with digital/app keywords',
                'status': 'Open',
                'url': url,
                'source': 'LinkedIn',
                'publishedDate': published.strftime('%Y-%m-%d'),
            })
        return {"tenders_rfps": tenders}
    except Exception as e:
        print(f"⚠️  LinkedIn tenders MCP failed: {e}")
        return {"tenders_rfps": []}


def generate_summary(team: Dict[str, Any], bright: Dict[str, Any]) -> str:
    parts: List[str] = []
    parts.append(f"{team['name']} is a {team.get('sport','')} club based in {team.get('country','')}.")
    if bright.get('recent_news'):
        parts.append(f"Recent Developments: {len(bright['recent_news'])} news items identified.")
    if bright.get('contacts'):
        parts.append(f"Key Contacts: {len(bright['contacts'])} business contacts found.")
    if bright.get('tenders_rfps'):
        parts.append(f"Active Tenders/RFPs: {len(bright['tenders_rfps'])} detected from LinkedIn.")
    return " ".join(parts)


def fetch_team(neo: Neo4jMCPClient, name: str) -> Dict[str, Any]:
    q = (
        "MATCH (e:Entity {name: $name}) RETURN e.name AS name, e.sport AS sport, e.country AS country, "
        "e.level AS level, e.website AS website, e.linkedin AS linkedin LIMIT 1"
    )
    res = neo.execute_cypher_query(q, {"name": name})
    rows = res.get('results') or []
    return rows[0] if rows else {}


def update_neo4j_entity(neo: Neo4jMCPClient, team: Dict[str, Any], bright: Dict[str, Any]) -> bool:
    update = {
        'name': team['name'],
        'enrichment_summary': generate_summary(team, bright),
        'enriched_at': datetime.now().isoformat(),
        'company_info': json.dumps(bright.get('company_info', {})),
        'tenders_rfps': json.dumps(bright.get('tenders_rfps', [])),
        'key_contacts': json.dumps(bright.get('contacts', [])),
        'data_sources': json.dumps({
            'brightdata_mcp': 'success',
            'enriched_at': datetime.now().isoformat(),
        }),
    }
    cq = (
        "MATCH (e:Entity {name: $name}) "
        "SET e.enrichment_summary = $enrichment_summary, "
        "    e.enriched_at = $enriched_at, "
        "    e.company_info = $company_info, "
        "    e.tenders_rfps = $tenders_rfps, "
        "    e.key_contacts = $key_contacts, "
        "    e.data_sources = $data_sources "
        "RETURN e"
    )
    r = neo.execute_cypher_query(cq, update)
    return r.get('status') == 'success'


def enrich_team_brightdata_only(neo: Neo4jMCPClient, name: str) -> bool:
    print(f"\n🚀 Enriching (Bright Data only): {name}")
    team = fetch_team(neo, name)
    if not team:
        print(f"❌ Not found in Neo4j: {name}")
        return False

    company = search_company_mcp(name)
    contacts = search_linkedin_mcp(name)
    news = search_news_mcp(name)
    tenders = search_linkedin_tenders_mcp(name)

    combined = {
        'company_info': company.get('company_info', {}),
        'contacts': contacts.get('contacts', []),
        'social_media': contacts.get('social_media', {}),
        'recent_news': news.get('recent_news', []),
        'tenders_rfps': tenders.get('tenders_rfps', []),
    }

    ok = update_neo4j_entity(neo, {'name': name, **team}, combined)
    if ok:
        print(f"✅ Updated Neo4j: {name}")
    else:
        print(f"❌ Failed to update Neo4j: {name}")
    return ok


def main():
    target_names = [
        "1. FC Köln (csv_seed)",
        "1. FC Nürnberg (csv_seed)",
        "AC Milan (csv_seed)",
        "AIK Fotboll (csv_seed)",
        "AJ Auxerre (csv_seed)",
        "AS Monaco (csv_seed)",
        "AS Roma (csv_seed)",
        "AZ Alkmaar (csv_seed)",
        "Aberdeen (csv_seed)",
    ]

    print("🏈 Bright Data-only Enrichment for specific teams")
    print(f"🔌 Bright Data MCP: {BRIGHTDATA_MCP_URL}")

    neo = Neo4jMCPClient()
    success = 0
    for idx, name in enumerate(target_names, 1):
        print("\n" + "=" * 60)
        print(f"🎯 {idx}/{len(target_names)}: {name}")
        print("=" * 60)
        if enrich_team_brightdata_only(neo, name):
            success += 1
        # brief pause to be gentle with MCP tools
        time.sleep(2)

    print("\n" + "=" * 60)
    print("🎉 Completed")
    print(f"✅ Successful: {success}")
    print(f"❌ Failed: {len(target_names) - success}")


if __name__ == "__main__":
    main()








