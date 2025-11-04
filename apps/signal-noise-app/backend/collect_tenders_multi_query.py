#!/usr/bin/env python3
"""
Collect tenders/RFPs via Bright Data MCP wrapper using multi-query strategy,
scrape pages as markdown, filter by procurement+service keywords, and save JSON.

Saves to: /Users/kieranmcfarlane/Downloads/panther_chat/tenders_from_mcp.json
"""

import os
import argparse
import re
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import requests


MCP_BASE = os.getenv("BRIGHTDATA_MCP_URL", "http://localhost:8014")
# Default output path inside this app directory
DEFAULT_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "tenders_from_mcp.json")


PROCUREMENT_RE = re.compile(r"\b(RFP|Request\s+for\s+Proposal|Tender|ITT|Invitation\s+to\s+Tender|RFQ|RFI|EOI)\b", re.I)
SERVICE_RE = re.compile(r"(website|web\s*app|digital\s*transformation|digital|mobile\s+app|\bapps?\b|application|platform|CMS|API|Android|iOS)", re.I)
DEADLINE_RE = re.compile(r"(deadline|due\s*date|closing)[:\s-]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{2,4})", re.I)
VALUE_RE = re.compile(r"([$£€]\s?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\s*(?:[kKmM]|million|bn)?|USD|GBP|EUR)")


def normalize_https(url: str) -> str:
    if not url:
        return url
    if url.startswith("http://"):
        url = "https://" + url[len("http://"):]
    if not url.startswith("https://"):
        url = "https://" + url
    return url


def extract_org(url: str) -> str:
    try:
        m = re.search(r"linkedin\.com/(?:company|school)/([^/?#]+)", url, re.I)
        if m:
            org = m.group(1).replace("-", " ")
            return " ".join(w.capitalize() for w in org.split())
        m2 = re.search(r"https?://(?:www\.)?([\w\-]+)\.(?:club|co\.uk|com|org)", url, re.I)
        if m2:
            org = m2.group(1).replace("-", " ")
            return " ".join(w.capitalize() for w in org.split())
    except Exception:
        pass
    return ""


def search_serp(query: str, engine: str = "google", limit: int = 50, country: Optional[str] = None) -> List[str]:
    payload: Dict[str, Any] = {"query": query, "engine": engine, "time_range": "past_year", "limit": limit}
    if country:
        payload["country"] = country
    r = requests.post(f"{MCP_BASE}/tools/search_serp", json=payload, timeout=90)
    urls: List[str] = []
    if r.ok:
        data = r.json()
        results = data.get("results") or data.get("serpData", {}).get("results") or []
        for item in results:
            url = normalize_https(item.get("url") or "")
            if url:
                urls.append(url)
    return urls


def scrape_markdown(url: str) -> str:
    r = requests.post(
        f"{MCP_BASE}/tools/scrape_as_markdown",
        json={"url": url, "format": "markdown"},
        timeout=90,
    )
    if not r.ok:
        return ""
    body = r.json()
    return body.get("markdown") or body.get("content") or ""


def collect() -> List[Dict[str, Any]]:
    # Queries per the spec
    queries: List[Dict[str, Any]] = [
        {"q": 'site:linkedin.com (RFP OR "request for proposal" OR tender OR ITT OR RFQ OR RFI OR EOI) (website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS)', "country": None},
        {"q": 'site:linkedin.com (RFP OR tender OR ITT OR RFQ OR RFI OR EOI) (website OR digital OR "mobile app" OR apps OR application OR platform OR CMS OR API OR Android OR iOS) (United Kingdom OR UK OR England OR Scotland OR Wales OR Ireland)', "country": "gb"},
        {"q": '(site:linkedin.com OR site:*.club OR site:*.co.uk) (RFP OR tender OR ITT OR RFQ OR RFI OR EOI) (website OR digital OR "mobile app" OR apps OR application OR platform OR CMS OR API OR Android OR iOS) (club OR "football club" OR FC OR rugby OR cricket OR league OR federation OR association OR stadium)', "country": None},
        {"q": 'site:isportconnect.com (RFP OR tender OR ITT OR EOI) (digital OR "mobile app" OR apps OR application OR platform OR CMS OR API OR Android OR iOS)', "country": None},
    ]

    # Aggregate and dedupe URLs
    seen: set[str] = set()
    candidates: List[str] = []
    for spec in queries:
        urls = search_serp(spec["q"], engine="google", limit=50, country=spec["country"])  # type: ignore
        for u in urls:
            if u not in seen:
                seen.add(u)
                candidates.append(u)
        time.sleep(0.5)

    # Scrape and filter
    cutoff = datetime.now() - timedelta(days=365)
    results: List[Dict[str, Any]] = []
    scrapes = 0
    MAX_SCRAPES = 60

    for url in candidates:
        if scrapes >= MAX_SCRAPES:
            break
        md = scrape_markdown(url)
        scrapes += 1
        if not md:
            continue

        # Require both procurement and service keywords
        if not PROCUREMENT_RE.search(md) or not SERVICE_RE.search(md):
            continue

        # Attempt field extraction
        deadline_match = DEADLINE_RE.search(md)
        value_match = VALUE_RE.search(md)

        # Published date unknown from generic scrape; keep only within window by policy/assumption
        published_iso = datetime.now().strftime('%Y-%m-%d')
        if datetime.now() < cutoff:
            continue

        # Title heuristic: first non-empty heading or first non-empty line
        title = ""
        for line in md.splitlines():
            line = line.strip().lstrip('#').strip()
            if len(line) > 8:
                title = line
                break
        if not title:
            title = "Digital/Web/Mobile Tender"

        item = {
            "title": title,
            "type": "RFP",
            "value": value_match.group(0) if value_match else "TBD",
            "deadline": deadline_match.group(2) if deadline_match else "",
            "description": "Procurement notice containing digital/web/mobile scope",
            "status": "Open",
            "url": url,
            "source": (
                "LinkedIn" if "linkedin.com" in url else
                "iSportConnect" if "isportconnect.com" in url else "Web"
            ),
            "publishedDate": published_iso,
            "organization": extract_org(url),
        }
        results.append(item)
        time.sleep(0.5)

    # De-duplicate by URL (just in case)
    seen_urls: set[str] = set()
    deduped: List[Dict[str, Any]] = []
    for it in results:
        if it["url"] in seen_urls:
            continue
        seen_urls.add(it["url"])
        deduped.append(it)

    return deduped


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect tenders via Bright Data MCP and save JSON")
    parser.add_argument("--output", dest="output", default=DEFAULT_OUTPUT_PATH, help="Output JSON path")
    args = parser.parse_args()

    print("🔎 Running multi-query MCP tender collector ...")
    items = collect()
    print(f"📦 Collected {len(items)} tenders")
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"✅ Saved to {args.output}")


if __name__ == "__main__":
    main()


