#!/usr/bin/env python3
"""Answer a question using BrightData search."""
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
    query = 'site:majorleaguecricket.com "Major League Cricket"'
    
    search_result = await client.search_engine(query, engine="google", num_results=10)
    
    answer = ""
    context = ""
    sources = []
    confidence = 0
    
    if search_result.get("status") == "success" and search_result.get("results"):
        results = search_result["results"]
        sources = [r.get("url", "") for r in results if r.get("url")]
        
        relevant_results = [r for r in results if "majorleaguecricket.com" in r.get("url", "").lower()]
        
        for r in relevant_results:
            snippet = r.get("snippet", "") or r.get("title", "")
            if snippet:
                context += snippet + " "
        
        for r in relevant_results:
            snippet = (r.get("snippet", "") or "").lower()
            title = (r.get("title", "") or "").lower()
            
            import re
            years = re.findall(r'\b(20[0-9]{2})\b', snippet + " " + title)
            if years:
                for year in years:
                    if "launch" in snippet or "founded" in snippet or "started" in snippet or "began" in snippet or "inception" in snippet or "established" in snippet:
                        answer = year
                        confidence = 0.7
                        break
                    elif "2023" in snippet or "first season" in snippet or "inaugural" in snippet:
                        answer = "2023"
                        confidence = 0.8
                        break
        
        if not answer and relevant_results:
            for r in relevant_results:
                snippet = (r.get("snippet", "") or "").lower()
                title = (r.get("title", "") or "").lower()
                if "2023" in snippet or "2023" in title:
                    answer = "2023"
                    confidence = 0.6
                    break
        
        if not answer:
            for r in results:
                snippet = (r.get("snippet", "") or "").lower()
                title = (r.get("title", "") or "").lower()
                if "major league cricket" in (snippet + title):
                    years = re.findall(r'\b(20[0-9]{2})\b', snippet + " " + title)
                    if years:
                        answer = years[0]
                        confidence = 0.5
                        break
    
    result = {
        "question": "What year did Major League Cricket launch?",
        "answer": answer,
        "context": context.strip(),
        "sources": sources[:5],
        "confidence": confidence
    }
    
    print(json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    asyncio.run(answer_question())
