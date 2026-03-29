#!/usr/bin/env python3
"""Hosted BrightData MCP fact smoke with persisted evidence and DeepSeek reasoning."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from brightdata_mcp_client import BrightDataMCPClient  # noqa: E402
from claude_client import ClaudeClient  # noqa: E402


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _redact_token_in_url(url: str | None) -> str | None:
    if not url:
        return url
    return re.sub(r"(token=)[^&]+", r"\1***", url)


async def run_smoke(search_query: str, scrape_url: str, output_path: Path, question: str) -> int:
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(BACKEND / ".env", override=False)

    brightdata = BrightDataMCPClient(timeout=20)
    claude = ClaudeClient()

    report: Dict[str, Any] = {
        "run_at": _iso(),
        "query": search_query,
        "scrape_url": scrape_url,
        "retrieval": {
            "transport": getattr(brightdata, "_transport", None),
            "hosted_url": _redact_token_in_url(getattr(brightdata, "_hosted_mcp_url", None)),
            "search_attempts": [],
            "search_results": [],
            "search_hit": False,
            "search_empty": False,
            "scrape_used": False,
            "scrape_source": None,
            "scrape": {},
        },
        "reasoning": {},
    }

    try:
        prewarm = await brightdata.prewarm(timeout=20)
        report["retrieval"]["prewarm"] = prewarm

        search = await brightdata.search_engine(search_query, engine="google")
        report["retrieval"]["search_attempts"].append(
            {
                "query": search_query,
                "status": search.get("status"),
                "result_count": len(search.get("results", [])),
            }
        )
        search_hit = bool(search.get("results", []))
        report["retrieval"]["search_hit"] = search_hit
        report["retrieval"]["search_empty"] = not search_hit
        report["retrieval"]["search_results"] = [
            {
                "title": item.get("title"),
                "url": item.get("url"),
                "snippet": item.get("snippet"),
            }
            for item in search.get("results", [])[:5]
        ]

        if not search_hit:
            print("ICF/Fact smoke: search returned 0 results, proceeding with MCP scrape evidence")

        scrape_target_url = scrape_url
        scrape_source = "provided_scrape_url"
        if search_hit:
            scrape_target_url = str((search.get("results") or [{}])[0].get("url") or scrape_url)
            scrape_source = "search_result[0]"

        scrape = await brightdata.scrape_as_markdown(scrape_target_url)
        report["retrieval"]["scrape_used"] = True
        report["retrieval"]["scrape_source"] = scrape_source
        scrape_content = scrape.get("content") or ""
        report["retrieval"]["scrape"] = {
            "status": scrape.get("status"),
            "url": scrape.get("url") or scrape_target_url,
            "word_count": (scrape.get("metadata") or {}).get("word_count"),
            "source": (scrape.get("metadata") or {}).get("source"),
            "content_preview": scrape_content[:1200],
        }

        reasoning_prompt = (
            "You are reading evidence from Bright Data MCP.\n"
            "Answer only in JSON with keys: answer, founded_year, confidence, evidence_url.\n"
            f"Question: {question}\n"
            f"Evidence URL: {scrape_target_url}\n"
            f"Evidence excerpt: {scrape_content[:4000]}\n"
        )
        reasoning = await claude.query(
            prompt=reasoning_prompt,
            model="judge",
            max_tokens=400,
            json_mode=True,
        )
        report["reasoning"] = {
            "model_requested": "judge",
            "model_used": reasoning.get("model_used"),
            "content": reasoning.get("content"),
            "structured_output": reasoning.get("structured_output"),
            "final_answer": (reasoning.get("structured_output") or {}).get("answer"),
            "evidence_url": (reasoning.get("structured_output") or {}).get("evidence_url"),
            "tokens_used": reasoning.get("tokens_used"),
            "stop_reason": reasoning.get("stop_reason"),
            "provider": reasoning.get("provider"),
        }

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        print(str(output_path))
        return 0
    finally:
        await brightdata.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Hosted BrightData MCP Arsenal fact smoke")
    parser.add_argument("--query", default="Arsenal founded")
    parser.add_argument("--scrape-url", default="https://en.wikipedia.org/wiki/Arsenal_F.C.")
    parser.add_argument("--question", default="When was Arsenal founded?")
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    if args.output:
        output = Path(args.output)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output = ROOT / "backend" / "data" / "mcp_smokes" / f"arsenal_hosted_mcp_fact_smoke_{ts}.json"

    return asyncio.run(run_smoke(args.query, args.scrape_url, output, args.question))


if __name__ == "__main__":
    raise SystemExit(main())
