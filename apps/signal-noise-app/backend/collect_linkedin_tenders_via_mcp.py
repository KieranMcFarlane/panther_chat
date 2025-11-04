#!/usr/bin/env python3
"""
Collect LinkedIn tenders/RFPs via Bright Data MCP (HTTP wrapper) and save to JSON.

Search criteria:
- site:linkedin.com
- (RFP|Request for Proposal|Tender|EOI|RFI|RFQ)
- (website|digital|mobile app|apps|application|platform|web app|CMS|API|Android|iOS)
- last 12 months

Output JSON array items include:
  title, type, value, deadline, description, status, url, source, publishedDate, organization
"""

import os
import re
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List

import requests


BRIGHTDATA_MCP_URL = os.getenv("BRIGHTDATA_MCP_URL", "http://localhost:8014")
OUTPUT_PATH = "/Users/kieranmcfarlane/Downloads/panther_chat/tenders_from_mcp.json"


def normalize_https(url: str) -> str:
    if not url:
        return url
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    if not url.startswith("https://"):
        url = "https://" + url
    return url


def extract_org_from_url(url: str) -> str:
    try:
        m = re.search(r"linkedin\.com/(?:company|school)/([^/?#]+)", url, re.I)
        if m:
            org = m.group(1).replace("-", " ")
            return " ".join(w.capitalize() for w in org.split())
        m2 = re.search(r"linkedin\.com/in/([^/?#]+)", url, re.I)
        if m2:
            person = m2.group(1).replace("-", " ")
            return " ".join(w.capitalize() for w in person.split())
    except Exception:
        pass
    return ""


def search_candidates(limit: int = 50) -> List[str]:
    query = (
        'site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) '
        '(website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS)'
    )
    resp = requests.post(
        f"{BRIGHTDATA_MCP_URL}/tools/search_serp",
        headers={"Content-Type": "application/json"},
        json={"query": query, "engine": "google", "limit": limit, "time_range": "past_year"},
        timeout=60,
    )
    urls: List[str] = []
    if resp.ok:
        data = resp.json()
        results = data.get("results") or data.get("serpData", {}).get("results") or []
        for item in results:
            url = normalize_https(item.get("url", ""))
            if "linkedin.com" in url:
                urls.append(url)
    return urls


def scrape_text(url: str) -> str:
    sr = requests.post(
        f"{BRIGHTDATA_MCP_URL}/tools/scrape_as_markdown",
        headers={"Content-Type": "application/json"},
        json={"url": url, "format": "markdown"},
        timeout=60,
    )
    if not sr.ok:
        return ""
    body = sr.json()
    return body.get("markdown") or body.get("content") or ""


def collect(limit_candidates: int = 50, max_scrapes: int = 20) -> List[Dict[str, Any]]:
    rfpk = re.compile(r"(\bRFP\b|Request\s+for\s+Proposal|\bTender\b|\bEOI\b|\bRFI\b|\bRFQ\b)", re.I)
    servicek = re.compile(r"(website|digital|mobile\s+app|\bapps?\b|application|platform|web\s*app|CMS|API|Android|iOS)", re.I)
    deadlinek = re.compile(r"(deadline|due\s*date|closing)[:\s-]*([\w]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})", re.I)
    valuek = re.compile(r"([$£€]\s?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\s*(?:[kKmM]|million|bn)?|USD|GBP|EUR)")

    cutoff = datetime.now() - timedelta(days=365)
    urls = search_candidates(limit_candidates)

    collected: List[Dict[str, Any]] = []
    for url in urls[:max_scrapes]:
        text = scrape_text(url)
        if not text:
            continue

        if not rfpk.search(text) or not servicek.search(text):
            continue

        deadline_match = deadlinek.search(text)
        value_match = valuek.search(text)
        published = datetime.now()
        if published < cutoff:
            continue

        organization = extract_org_from_url(url)
        title = "RFP/Tender Opportunity"
        # Use first line as title if it seems meaningful
        first_line = text.strip().splitlines()[0:1]
        if first_line:
            fl = first_line[0].strip().strip('# ').strip()
            if 8 <= len(fl) <= 140:
                title = fl

        collected.append({
            "title": title if organization == "" else f"{title} - {organization}",
            "type": "RFP",
            "value": value_match.group(0) if value_match else "TBD",
            "deadline": deadline_match.group(2) if deadline_match else "",
            "description": "LinkedIn post mentioning RFP/Tender with digital/app keywords",
            "status": "Open",
            "url": url,
            "source": "LinkedIn",
            "publishedDate": published.strftime('%Y-%m-%d'),
            "organization": organization,
        })

        # Be polite
        time.sleep(0.5)

    return collected


def main() -> None:
    print("🔎 Collecting LinkedIn tenders via Bright Data MCP wrapper ...")
    items = collect(limit_candidates=50, max_scrapes=20)
    print(f"📦 Collected {len(items)} tenders")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"✅ Saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()


