#!/usr/bin/env python3
"""
Search LinkedIn for RFP/Tender posts via Bright Data MCP SERP + Markdown scraping.

Steps implemented:
1) SERP search (engine=google, time_range=past_year, limit=50) with the exact query:
   site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) (website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS)
2) For each LinkedIn URL returned → scrape_as_markdown
3) Keep only posts that match BOTH:
   - RFP/tender: (RFP|Request for Proposal|Tender|EOI|RFI|RFQ)
   - Services: (website|digital|mobile app|apps|application|platform|web app|CMS|API|Android|iOS)

Environment:
- BRIGHTDATA_MCP_URL (default: http://localhost:8014)

Usage:
  python3 signal-noise-app/search_linkedin_rfps.py
  BRIGHTDATA_MCP_URL=http://localhost:8014 python3 signal-noise-app/search_linkedin_rfps.py
"""

import os
import json
import time
import re
from typing import Any, Dict, List

import requests


BRIGHTDATA_MCP_URL = os.getenv("BRIGHTDATA_MCP_URL", "http://localhost:8014")

# Exact query from requirements
BASE_QUERY = (
    'site:linkedin.com (RFP OR "request for proposal" OR tender OR EOI OR RFI OR RFQ) '
    '(website OR digital OR "mobile app" OR apps OR application OR platform OR "web app" OR CMS OR API OR Android OR iOS)'
)


def _extract_serp_results(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return a uniform list of result objects with at least a url field.
    Supports multiple response shapes seen across MCP servers.
    """
    if not isinstance(payload, dict):
        return []

    # Common shapes observed in this repo
    candidates = [
        payload.get("results"),
        payload.get("serpResults", {}).get("results") if isinstance(payload.get("serpResults"), dict) else None,
        payload.get("serpData", {}).get("results") if isinstance(payload.get("serpData"), dict) else None,
    ]

    for cand in candidates:
        if isinstance(cand, list):
            return cand
    return []


def search_serp(query: str, limit: int = 50, engine: str = "google", time_range: str = "past_year") -> List[str]:
    """Call MCP SERP tool and return LinkedIn URLs only."""
    try:
        resp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/search_serp",
            headers={"Content-Type": "application/json"},
            json={"query": query, "engine": engine, "limit": limit, "time_range": time_range},
            timeout=60,
        )
        if not resp.ok:
            print(f"❌ SERP request failed: HTTP {resp.status_code}")
            return []

        data = resp.json()
        results = _extract_serp_results(data)
        urls: List[str] = []
        for item in results:
            if not isinstance(item, dict):
                continue
            url = item.get("url") or ""
            if url and "linkedin.com" in url:
                # Normalize to https
                if url.startswith("http://"):
                    url = "https://" + url[len("http://"):]
                if not url.startswith("https://"):
                    url = "https://" + url
                urls.append(url)

        return urls
    except Exception as e:
        print(f"❌ SERP error: {e}")
        return []


def scrape_as_markdown(url: str) -> str:
    """Scrape a URL to markdown via MCP; return markdown/content text or empty string."""
    try:
        resp = requests.post(
            f"{BRIGHTDATA_MCP_URL}/tools/scrape_as_markdown",
            headers={"Content-Type": "application/json"},
            json={"url": url, "format": "markdown"},
            timeout=90,
        )
        if not resp.ok:
            return ""
        data = resp.json()
        return data.get("markdown") or data.get("content") or ""
    except Exception:
        return ""


def filter_posts(text: str) -> bool:
    """Return True if text matches BOTH RFP/tender and services keyword groups."""
    if not text:
        return False
    rfpk = re.compile(r"(\bRFP\b|Request\s+for\s+Proposal|\bTender\b|\bEOI\b|\bRFI\b|\bRFQ\b)", re.I)
    servicek = re.compile(r"(website|digital|mobile\s+app|\bapps?\b|application|platform|web\s*app|CMS|API|Android|iOS)", re.I)
    return bool(rfpk.search(text) and servicek.search(text))


def main() -> None:
    print("🔎 Running LinkedIn RFP/Tender search via Bright Data MCP...")
    print(f"🔌 MCP: {BRIGHTDATA_MCP_URL}")

    query = BASE_QUERY
    print(f"🧠 Query: {query}")

    urls = search_serp(query=query, limit=50, engine="google", time_range="past_year")
    print(f"🔗 SERP LinkedIn URLs: {len(urls)}")

    kept: List[Dict[str, Any]] = []
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] 📄 Scraping: {url}")
        md = scrape_as_markdown(url)
        if not md:
            continue
        if filter_posts(md):
            kept.append({
                "url": url,
                "matched": True
            })
        time.sleep(1)  # be nice

    print(f"\n✅ Kept posts: {len(kept)}")
    print(json.dumps({"count": len(kept), "results": kept}, indent=2))


if __name__ == "__main__":
    main()








