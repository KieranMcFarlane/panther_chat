#!/usr/bin/env python3
"""
MCP Perplexity RFP Detector
Simple Python script to call Perplexity API for RFP detection
"""

import json
import sys
import os
import requests
from datetime import datetime

def call_perplexity_api(search_query):
    """
    Call Perplexity API to search for RFP opportunities
    """
    api_key = os.getenv('PERPLEXITY_API_KEY', 'pplx-7qR3K2yVd4vB8nX6tJmP4rHkL9sWfQ3xZc5vN2bG1oU')
    
    if not api_key:
        return {
            "error": "PERPLEXITY_API_KEY not found in environment",
            "status": "missing_api_key"
        }
    
    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Enhanced prompt for RFP detection
    prompt = f"""Search for RFP (Request for Proposal) and tender opportunities related to: {search_query}

Focus specifically on:
- Digital transformation projects
- Mobile app development tenders
- Web development RFPs
- Software development opportunities
- Technology platform procurement
- Digital platform initiatives

IMPORTANT: Return ONLY real, verified URLs. Do not fabricate or create placeholder URLs.
Exclude non-digital projects like stadium construction, hospitality, apparel, F&B, or event production.

Return results in this exact JSON format:
{{
    "search_query": "{search_query}",
    "status": "success|error",
    "results": [
        {{
            "title": "RFP Title",
            "description": "Brief description",
            "url": "https://actual-url-here.com",
            "source": "perplexity",
            "relevance_score": 0.95,
            "is_digital": true,
            "has_deadline": true,
            "deadline_date": "2025-12-01"
        }}
    ],
    "total_results": 2,
    "search_timestamp": "{datetime.now().isoformat()}"
}}"""

    payload = {
        "model": "llama-3.1-sonar-small-128k-online",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 2000,
        "temperature": 0.1
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'choices' in data and len(data['choices']) > 0:
                content = data['choices'][0]['message']['content']
                
                # Try to parse JSON from the response
                try:
                    # Look for JSON in the response
                    import re
                    json_match = re.search(r'\{.*\}', content, re.DOTALL)
                    if json_match:
                        result_data = json.loads(json_match.group())
                        return result_data
                    else:
                        # Fallback: create structured response from raw content
                        return {
                            "search_query": search_query,
                            "status": "success",
                            "raw_response": content,
                            "results": [],
                            "total_results": 0,
                            "search_timestamp": datetime.now().isoformat()
                        }
                except json.JSONDecodeError:
                    return {
                        "search_query": search_query,
                        "status": "json_parse_error",
                        "raw_response": content,
                        "results": [],
                        "total_results": 0,
                        "search_timestamp": datetime.now().isoformat()
                    }
            else:
                return {
                    "search_query": search_query,
                    "status": "no_choices",
                    "error": "No choices in API response",
                    "raw_response": str(data),
                    "search_timestamp": datetime.now().isoformat()
                }
        else:
            return {
                "search_query": search_query,
                "status": "api_error",
                "error": f"HTTP {response.status_code}: {response.text}",
                "search_timestamp": datetime.now().isoformat()
            }
            
    except requests.exceptions.Timeout:
        return {
            "search_query": search_query,
            "status": "timeout",
            "error": "Request timed out after 60 seconds",
            "search_timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "search_query": search_query,
            "status": "exception",
            "error": str(e),
            "search_timestamp": datetime.now().isoformat()
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python mcp-perplexity-rfp-detector.py '<search_query>'",
            "status": "usage_error"
        }))
        sys.exit(1)
    
    search_query = sys.argv[1]
    result = call_perplexity_api(search_query)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()