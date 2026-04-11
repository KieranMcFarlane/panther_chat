#!/usr/bin/env python3
"""Answer ICF founding year question using BrightData."""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

os.environ["BRIGHTDATA_API_TOKEN"] = "bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4"
os.environ["BRIGHTDATA_TOKEN"] = "bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4"
os.environ["BRIGHTDATA_ZONE"] = "linkedin_posts_monitor"
os.environ["PIPELINE_USE_BRIGHTDATA_MCP"] = "false"

from brightdata_mcp_client import BrightDataHTTPClient

async def answer_question():
    client = BrightDataHTTPClient()
    query = 'International Canoe Federation founded year'
    
    search_result = await client.search_engine(query, engine="google", num_results=10)
    
    print(f"DEBUG: search_result status = {search_result.get('status')}", file=sys.stderr)
    print(f"DEBUG: results count = {len(search_result.get('results', []))}", file=sys.stderr)
    
    answer = ""
    context = ""
    sources = []
    confidence = 0
    
    if search_result.get("status") == "success" and search_result.get("results"):
        results = search_result["results"]
        sources = [r.get("url", "") for r in results if r.get("url")]
        
        for r in results:
            snippet = r.get("snippet", "") or ""
            title = r.get("title", "") or ""
            context += f"{title}: {snippet} "
        
        patterns = [
            r'founded\s*(?:in\s*)?(\d{4})',
            r'established\s*(?:in\s*)?(\d{4})',
            r'(\d{4})',
        ]
        
        keywords = ['founded', 'established', 'created', 'formed', 'inception']
        
        for r in results:
            snippet = (r.get("snippet", "") or "").lower()
            title = (r.get("title", "") or "").lower()
            text = snippet + " " + title
            
            if "international canoe federation" in text:
                for pattern in patterns:
                    years = re.findall(pattern, text)
                    for year in years:
                        year_int = int(year)
                        if 1900 <= year_int <= 2000:
                            for kw in keywords:
                                if kw in text:
                                    answer = year
                                    confidence = 0.9
                                    break
                            if not answer:
                                answer = year
                                confidence = 0.7
                            break
                    if answer:
                        break
            if answer:
                break
    
    result = {
        "question": "What year was International Canoe Federation founded?",
        "answer": answer,
        "context": context.strip()[:500],
        "sources": sources[:5],
        "confidence": confidence
    }
    
    print(json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    asyncio.run(answer_question())
