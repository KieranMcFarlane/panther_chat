#!/usr/bin/env python3
"""BrightData probe: log query -> top URLs -> scrape evidence to JSON."""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from brightdata_sdk_client import BrightDataSDKClient  # noqa: E402


async def run_probe(query: str, num_results: int, max_scrapes: int, output: Path) -> int:
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(BACKEND / ".env", override=False)

    client = BrightDataSDKClient()
    report = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "query": query,
        "num_results": num_results,
        "max_scrapes": max_scrapes,
        "search": {},
        "scrapes": [],
    }

    try:
        search = await client.search_engine(query=query, engine="google", num_results=num_results)
        results = search.get("results", [])
        report["search"] = {
            "status": search.get("status"),
            "source": (search.get("metadata") or {}).get("source"),
            "result_count": len(results),
            "top_results": [
                {"position": r.get("position"), "title": r.get("title"), "url": r.get("url")}
                for r in results[: min(5, len(results))]
            ],
        }

        for r in results[:max_scrapes]:
            url = r.get("url")
            if not url:
                continue
            scraped = await client.scrape_as_markdown(url)
            metadata = scraped.get("metadata") or {}
            content = (scraped.get("content") or "").strip().replace("\n", " ")
            report["scrapes"].append(
                {
                    "url": url,
                    "status": scraped.get("status"),
                    "source": metadata.get("source"),
                    "extraction_mode": metadata.get("extraction_mode"),
                    "word_count": metadata.get("word_count"),
                    "sample": content[:240],
                }
            )

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(str(output))
        return 0
    finally:
        await client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe BrightData query + scrape behavior")
    parser.add_argument("--query", required=True)
    parser.add_argument("--num-results", type=int, default=5)
    parser.add_argument("--max-scrapes", type=int, default=3)
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    if args.output:
        output = Path(args.output)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output = ROOT / "backend" / "data" / "dossiers" / "run_reports" / f"brightdata_probe_{ts}.json"

    return asyncio.run(run_probe(args.query, args.num_results, args.max_scrapes, output))


if __name__ == "__main__":
    raise SystemExit(main())
