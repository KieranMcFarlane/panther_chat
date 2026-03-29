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
from judge_client_factory import build_deepseek_judge_client  # noqa: E402


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _redact_token_in_url(url: str | None) -> str | None:
    if not url:
        return url
    return re.sub(r"(token=)[^&]+", r"\1***", url)


def _tokenize_query(text: str) -> set[str]:
    tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", str(text or "").lower())
        if len(token) > 2
    }
    return tokens


def _score_search_result(query: str, item: Dict[str, Any]) -> float:
    title = str(item.get("title") or "").lower()
    snippet = str(item.get("snippet") or "").lower()
    url = str(item.get("url") or "").lower()
    text = " ".join([title, snippet, url])
    tokens = _tokenize_query(query)
    score = 0.0

    for token in tokens:
        if token in text:
            score += 1.0

    procurement_terms = {
        "rfp": 2.0,
        "tender": 2.0,
        "procurement": 2.0,
        "request for proposal": 2.5,
        "digital transformation": 1.5,
    }
    for term, weight in procurement_terms.items():
        if term in text:
            score += weight

    if "linkedin.com" in url:
        score += 0.75
    if "/news" in url or "/press" in url:
        score += 0.5
    if "official" in text or "press release" in text:
        score += 0.5

    return score


def _choose_best_search_result(query: str, results: list[Dict[str, Any]]) -> tuple[Dict[str, Any] | None, list[Dict[str, Any]]]:
    scored: list[Dict[str, Any]] = []
    for index, item in enumerate(results or []):
        candidate = dict(item or {})
        candidate["score"] = round(_score_search_result(query, candidate), 3)
        candidate["rank"] = index
        scored.append(candidate)
    scored.sort(key=lambda item: (item.get("score", 0.0), -int(item.get("rank", 0))), reverse=True)
    return (scored[0] if scored else None, scored)


async def run_smoke(
    search_query: str,
    scrape_url: str,
    output_path: Path,
    question: str,
    judge_client: Any | None = None,
) -> int:
    load_dotenv(ROOT / ".env", override=False)
    load_dotenv(BACKEND / ".env", override=False)

    brightdata = BrightDataMCPClient(timeout=20)
    claude = judge_client or build_deepseek_judge_client()

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
        search_results = list(search.get("results", []))
        best_result, ranked_results = _choose_best_search_result(search_query, search_results)
        search_hit = bool(search_results)
        report["retrieval"]["search_hit"] = search_hit
        report["retrieval"]["search_empty"] = not search_hit
        report["retrieval"]["search_results"] = [
            {
                "title": item.get("title"),
                "url": item.get("url"),
                "snippet": item.get("snippet"),
                "score": item.get("score"),
                "rank": item.get("rank"),
            }
            for item in ranked_results[:5]
        ]
        report["retrieval"]["selected_result"] = (
            {
                "title": best_result.get("title"),
                "url": best_result.get("url"),
                "snippet": best_result.get("snippet"),
                "score": best_result.get("score"),
                "rank": best_result.get("rank"),
            }
            if best_result
            else None
        )

        if not search_hit:
            print("ICF/Fact smoke: search returned 0 results, proceeding with MCP scrape evidence")

        scrape_target_url = scrape_url
        scrape_source = "provided_scrape_url"
        if best_result and best_result.get("url"):
            scrape_target_url = str(best_result.get("url") or scrape_url)
            scrape_source = "best_search_result"

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
