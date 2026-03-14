#!/usr/bin/env python3
"""
Simple BrightData hello-world diagnostic for current environment.
"""

import asyncio
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from brightdata_sdk_client import BrightDataSDKClient  # noqa: E402


async def main() -> int:
    token_present = bool(os.getenv("BRIGHTDATA_API_TOKEN"))
    print(json.dumps({"check": "env", "brightdata_token_present": token_present}))

    client = BrightDataSDKClient()
    try:
        search = await client.search_engine(
            query="hello world brightdata sdk test",
            engine="google",
            num_results=3,
        )
        print(
            json.dumps(
                {
                    "check": "search_engine",
                    "status": search.get("status"),
                    "result_count": len(search.get("results", [])),
                    "source": (search.get("metadata") or {}).get("source"),
                }
            )
        )

        scrape = await client.scrape_as_markdown("https://example.com")
        print(
            json.dumps(
                {
                    "check": "scrape_as_markdown",
                    "status": scrape.get("status"),
                    "word_count": (scrape.get("metadata") or {}).get("word_count"),
                    "source": (scrape.get("metadata") or {}).get("source"),
                    "extraction_mode": (scrape.get("metadata") or {}).get("extraction_mode"),
                }
            )
        )
        return 0
    finally:
        await client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
